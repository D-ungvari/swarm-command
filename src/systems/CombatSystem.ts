import { type World, hasComponents, entityExists } from '../ecs/world';
import {
  POSITION, HEALTH, ATTACK, MOVEMENT,
  posX, posY, faction, hpCurrent,
  atkDamage, atkRange, atkCooldown, atkLastTime, atkSplash, atkFlashTimer,
  targetEntity, commandMode,
  movePathIndex, setPath,
  unitType,
  slowEndTime, slowFactor, siegeMode, lastCombatTime,
  atkDamageType, armorClass, baseArmor, pendingDamage, killCount,
  cloaked,
  isAir, canTargetGround, canTargetAir,
} from '../ecs/components';
import { findBestTarget } from '../ecs/queries';
import { CommandMode, UnitType, SiegeMode, TILE_SIZE, MAX_ENTITIES, SLOW_DURATION, SLOW_FACTOR, Faction, DamageType, ArmorClass, UpgradeType } from '../constants';
import { getDamageMultiplier } from '../combat/damageCalc';
import { findPath } from '../map/Pathfinder';
import { worldToTile, tileToWorld, type MapData } from '../map/MapData';
import { isTileVisible } from './FogSystem';
import { soundManager } from '../audio/SoundManager';
import { type PlayerResources } from '../types';
import { emitProjectile } from '../rendering/ProjectileRenderer';
import { triggerCameraShake } from '../rendering/CameraShake';

const PROJECTILE_SPEEDS: Partial<Record<UnitType, number>> = {
  [UnitType.Marine]: 700,
  [UnitType.Marauder]: 500,
  [UnitType.SiegeTank]: 350,
  [UnitType.SCV]: 600,
  [UnitType.Zergling]: 0,    // melee — no projectile
  [UnitType.Baneling]: 0,    // contact — no projectile
  [UnitType.Hydralisk]: 550,
  [UnitType.Roach]: 450,
  [UnitType.Drone]: 400,
  [UnitType.Mutalisk]: 600,
  [UnitType.Ghost]: 650,
  [UnitType.Hellion]: 550,
  [UnitType.Reaper]: 700,
  [UnitType.Viking]: 500,
  [UnitType.Cyclone]: 600,
  [UnitType.Thor]: 300,
  [UnitType.Battlecruiser]: 400,
  [UnitType.WidowMine]: 0, // no visual projectile (it's a mine)
};

/** How far a target must move before we re-path to chase it */
const CHASE_REPATH_THRESHOLD = TILE_SIZE;
const CHASE_REPATH_SQ = CHASE_REPATH_THRESHOLD * CHASE_REPATH_THRESHOLD;

/** Per-entity: last known target position we pathed toward */
const chaseTargetX = new Float32Array(MAX_ENTITIES);
const chaseTargetY = new Float32Array(MAX_ENTITIES);

const FLASH_DURATION = 0.12; // seconds

// ── Damage events for floating damage indicators ──
export interface DamageEvent {
  x: number;
  y: number;
  amount: number;
  time: number;
  /** Color based on victim's faction: red = Terran hit, blue-white = Zerg hit */
  color: number;
}

const MAX_DAMAGE_EVENTS = 64;
const DAMAGE_EVENT_LIFETIME = 0.8; // seconds
export const damageEvents: DamageEvent[] = [];

// ── Under-attack tracking (for player alerts) ──
let lastTerranHitTime = 0;
let lastTerranHitX = 0;
let lastTerranHitY = 0;

/** Returns the position and time of the most recent hit on a Terran entity */
export function getLastTerranHit(): { x: number; y: number; time: number } {
  return { x: lastTerranHitX, y: lastTerranHitY, time: lastTerranHitTime };
}

/** Returns the weapon upgrade bonus for an attacker based on faction and unit type. */
function getWeaponBonus(resources: Record<number, PlayerResources>, attackerFaction: number, uType: UnitType): number {
  const upgrades = resources[attackerFaction]?.upgrades;
  if (!upgrades) return 0;
  if (attackerFaction === Faction.Terran) {
    if (uType === UnitType.SiegeTank || uType === UnitType.Hellion) return upgrades[UpgradeType.VehicleWeapons];
    return upgrades[UpgradeType.InfantryWeapons]; // Marine, Marauder, Medivac, SCV
  }
  // Zerg
  if (uType === UnitType.Zergling || uType === UnitType.Baneling) return upgrades[UpgradeType.ZergMelee];
  return upgrades[UpgradeType.ZergRanged]; // Hydralisk, Roach, Drone
}

/** Returns the armor upgrade bonus for a defender based on faction. */
function getArmorBonus(resources: Record<number, PlayerResources>, defenderFaction: number): number {
  const upgrades = resources[defenderFaction]?.upgrades;
  if (!upgrades) return 0;
  if (defenderFaction === Faction.Terran) return upgrades[UpgradeType.InfantryArmor];
  return upgrades[UpgradeType.ZergCarapace]; // all Zerg units
}

/**
 * Handles target acquisition, attack execution, damage, splash, and chase logic.
 * Runs every tick after MovementSystem.
 */
export function combatSystem(world: World, dt: number, gameTime: number, map: MapData, resources: Record<number, PlayerResources> = {}): void {
  // Clean up expired damage events
  while (damageEvents.length > 0 && gameTime - damageEvents[0].time > DAMAGE_EVENT_LIFETIME) {
    damageEvents.shift();
  }

  const combatBits = POSITION | HEALTH | ATTACK;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, combatBits)) continue;
    if (hpCurrent[eid] <= 0) continue;

    // Decrement flash timer
    if (atkFlashTimer[eid] > 0) {
      atkFlashTimer[eid] = Math.max(0, atkFlashTimer[eid] - dt);
    }

    // Skip units that can't deal damage (Medivac)
    if (atkDamage[eid] === 0) continue;

    // Siege Tank in transition can't attack
    const sm = siegeMode[eid] as SiegeMode;
    if (sm === SiegeMode.Packing || sm === SiegeMode.Unpacking) continue;

    const target = targetEntity[eid];
    const range = atkRange[eid];

    // --- Target validation ---
    if (target >= 1) {
      if (!entityExists(world, target) || hpCurrent[target] <= 0) {
        targetEntity[eid] = -1;
        // If was attack-moving, resume path (movement system handles this via existing path)
        // If was attacking a specific target, go idle
        if (commandMode[eid] === CommandMode.AttackTarget) {
          commandMode[eid] = CommandMode.Idle;
        }
      } else if (
        (isAir[target] === 1 && !canTargetAir[eid]) ||
        (isAir[target] === 0 && !canTargetGround[eid])
      ) {
        // Can't target this unit type — drop it silently
        targetEntity[eid] = -1;
        if (commandMode[eid] === CommandMode.AttackTarget) {
          commandMode[eid] = CommandMode.Idle;
        }
      }
    }

    // --- Auto-acquire target ---
    if (targetEntity[eid] < 1) {
      // Search with a generous aggro range: max of attack range and 6 tiles (192px)
      // This ensures melee units detect ranged attackers shooting them
      // HoldPosition: only acquire within actual attack range (no wider aggro)
      const aggroRange = commandMode[eid] === CommandMode.HoldPosition
        ? range
        : Math.max(range, 6 * TILE_SIZE);
      const enemy = findBestTarget(world, eid, aggroRange);
      if (enemy > 0) {
        // Terran units can't auto-acquire targets hidden in fog
        const myFac = faction[eid] as Faction;
        if (myFac === Faction.Terran && !isTileVisible(posX[enemy], posY[enemy])) {
          continue;
        }
        targetEntity[eid] = enemy;
        // Stop movement to engage
        movePathIndex[eid] = -1;
      } else if (commandMode[eid] === CommandMode.Idle || commandMode[eid] === CommandMode.AttackTarget) {
        continue; // No target, nothing to do
      } else {
        continue; // AttackMove with no enemy nearby — keep moving
      }
    }

    const tgt = targetEntity[eid];
    if (tgt < 1) continue;

    // --- Range check ---
    const dx = posX[tgt] - posX[eid];
    const dy = posY[tgt] - posY[eid];
    const distSq = dx * dx + dy * dy;
    const rangeSq = range * range;

    if (distSq > rangeSq) {
      // Sieged tanks can't chase — drop target and let auto-acquire find in-range one
      if (sm === SiegeMode.Sieged) {
        targetEntity[eid] = -1;
        continue;
      }
      // HoldPosition: drop target instead of chasing — stay put
      if (commandMode[eid] === CommandMode.HoldPosition) {
        targetEntity[eid] = -1;
        continue;
      }
      // AttackTarget: chase the explicit target regardless of distance until it dies.
      // Auto-acquire (findBestTarget) will never override a live explicit target
      // because targetEntity[eid] is only cleared on target death (above).
      if (commandMode[eid] !== CommandMode.Move) {
        chaseTarget(eid, tgt, map);
      }
      continue;
    }

    // --- Attack execution ---
    // Convert cooldown from ms to seconds for comparison
    const cooldownSec = atkCooldown[eid] / 1000;
    if (gameTime - atkLastTime[eid] < cooldownSec) continue;

    // Fire!
    atkLastTime[eid] = gameTime;
    atkFlashTimer[eid] = FLASH_DURATION;
    soundManager.playAttack();

    // Camera shake for splash-damage units (Siege Tank, Baneling)
    if (atkSplash[eid] > 0) {
      triggerCameraShake(atkSplash[eid] * 1.5);
    }

    // Emit projectile visual (cosmetic only — damage already applied below)
    const projSpeed = PROJECTILE_SPEEDS[unitType[eid] as UnitType] ?? 500;
    if (projSpeed > 0) {
      emitProjectile({
        fromX: posX[eid], fromY: posY[eid],
        toX: posX[tgt], toY: posY[tgt],
        unitType: unitType[eid],
        speed: projSpeed,
        time: gameTime,
      });
    }

    // Stop moving while attacking
    movePathIndex[eid] = -1;

    // Compute actual damage with type modifier and armor reduction
    const mult = getDamageMultiplier(atkDamageType[eid] as DamageType, armorClass[tgt] as ArmorClass);
    const weaponBonus = getWeaponBonus(resources, faction[eid], unitType[eid] as UnitType);
    const armorBonus = getArmorBonus(resources, faction[tgt]);
    const rawDmg = Math.max(1, ((atkDamage[eid] + weaponBonus) * mult) - (baseArmor[tgt] + armorBonus));

    // Commit damage to pending (overkill prevention tracks this)
    pendingDamage[tgt] += rawDmg;

    // Apply damage
    hpCurrent[tgt] -= rawDmg;
    pendingDamage[tgt] = Math.max(0, pendingDamage[tgt] - rawDmg);

    // Push damage event for floating indicator
    if (damageEvents.length < MAX_DAMAGE_EVENTS) {
      // Color based on victim faction: red if Terran got hit, blue-white if Zerg got hit
      const victimFac = faction[tgt] as Faction;
      const dmgColor = victimFac === Faction.Terran ? 0xff4444 : 0xaaddff;
      damageEvents.push({
        x: posX[tgt],
        y: posY[tgt],
        amount: rawDmg,
        time: gameTime,
        color: dmgColor,
      });
    }

    if (hpCurrent[tgt] <= 0) {
      killCount[eid]++;
      pendingDamage[tgt] = 0; // prevent stale pending on entity recycling
    }

    // Track Terran under-attack for player alerts
    if (faction[tgt] === Faction.Terran) {
      lastTerranHitTime = gameTime;
      lastTerranHitX = posX[tgt];
      lastTerranHitY = posY[tgt];
    }

    // Mutalisk glaive bounce — hits 2 additional targets at reduced damage
    if (unitType[eid] === UnitType.Mutalisk) {
      const bounceRange = 3 * TILE_SIZE; // 96px
      let lastX = posX[tgt];
      let lastY = posY[tgt];
      let lastDmg = rawDmg;
      const bounced = new Set([tgt]);

      for (let bounce = 0; bounce < 2; bounce++) {
        const bounceDmg = Math.max(1, Math.round(lastDmg * 0.3));
        // Find nearest enemy NOT already bounced to
        let nearestEid = 0;
        let nearestDist = Infinity;
        const myFac = faction[eid];
        for (let other = 1; other < world.nextEid; other++) {
          if (bounced.has(other)) continue;
          if (!hasComponents(world, other, POSITION | HEALTH)) continue;
          if (faction[other] === myFac || faction[other] === 0) continue;
          if (hpCurrent[other] <= 0) continue;
          const dx = posX[other] - lastX;
          const dy = posY[other] - lastY;
          const distSq = dx * dx + dy * dy;
          if (distSq < bounceRange * bounceRange && distSq < nearestDist) {
            nearestDist = distSq;
            nearestEid = other;
          }
        }
        if (nearestEid === 0) break;

        hpCurrent[nearestEid] -= bounceDmg;
        bounced.add(nearestEid);
        lastX = posX[nearestEid];
        lastY = posY[nearestEid];
        lastDmg = bounceDmg;

        // Emit bounce projectile
        emitProjectile({
          fromX: posX[tgt], fromY: posY[tgt],
          toX: posX[nearestEid], toY: posY[nearestEid],
          unitType: UnitType.Mutalisk,
          speed: 600,
          time: gameTime,
        });

        // Track Terran under-attack for bounce hits too
        if (faction[nearestEid] === Faction.Terran) {
          lastTerranHitTime = gameTime;
          lastTerranHitX = posX[nearestEid];
          lastTerranHitY = posY[nearestEid];
        }

        if (hpCurrent[nearestEid] <= 0) {
          killCount[eid]++;
          pendingDamage[nearestEid] = 0;
        }
      }
    }

    // Retaliation: victim auto-targets attacker if idle and can fight
    if (targetEntity[tgt] < 1 && atkDamage[tgt] > 0 &&
        commandMode[tgt] !== CommandMode.Move && commandMode[tgt] !== CommandMode.Gather) {
      targetEntity[tgt] = eid;
    }

    // Track combat time for Roach regen
    lastCombatTime[eid] = gameTime;
    lastCombatTime[tgt] = gameTime;

    // Marauder: Concussive Shells — slow the target
    if (unitType[eid] === UnitType.Marauder) {
      slowEndTime[tgt] = gameTime + SLOW_DURATION;
      slowFactor[tgt] = SLOW_FACTOR;
    }

    // Splash damage
    if (atkSplash[eid] > 0) {
      const splashRange = atkSplash[eid] * TILE_SIZE;
      const splashRangeSq = splashRange * splashRange;
      const myFac = faction[eid];
      const tx = posX[tgt];
      const ty = posY[tgt];

      for (let other = 1; other < world.nextEid; other++) {
        if (other === tgt || other === eid) continue;
        if (!hasComponents(world, other, POSITION | HEALTH)) continue;
        if (faction[other] === myFac) continue;
        if (hpCurrent[other] <= 0) continue;

        const sdx = posX[other] - tx;
        const sdy = posY[other] - ty;
        if (sdx * sdx + sdy * sdy <= splashRangeSq) {
          const sMult = getDamageMultiplier(atkDamageType[eid] as DamageType, armorClass[other] as ArmorClass);
          const sArmorBonus = getArmorBonus(resources, faction[other]);
          const sDmg = Math.max(1, ((atkDamage[eid] + weaponBonus) * sMult) - (baseArmor[other] + sArmorBonus));
          hpCurrent[other] -= sDmg;
          lastCombatTime[other] = gameTime;

          // Splash damage event
          if (damageEvents.length < MAX_DAMAGE_EVENTS) {
            const splashVictimFac = faction[other] as Faction;
            const splashColor = splashVictimFac === Faction.Terran ? 0xff4444 : 0xaaddff;
            damageEvents.push({
              x: posX[other],
              y: posY[other],
              amount: sDmg,
              time: gameTime,
              color: splashColor,
            });
          }

          if (hpCurrent[other] <= 0) {
            killCount[eid]++;
            pendingDamage[other] = 0;
          }
        }
      }
    }

    // Baneling: suicide unit — dies after attacking
    if (unitType[eid] === UnitType.Baneling) {
      hpCurrent[eid] = 0;
    }
  }
}

function chaseTarget(eid: number, tgt: number, map: MapData): void {
  // Air units fly in a straight line — no A* needed
  if (isAir[eid]) {
    setPath(eid, [[posX[tgt], posY[tgt]]]);
    chaseTargetX[eid] = posX[tgt];
    chaseTargetY[eid] = posY[tgt];
    return;
  }

  const tx = posX[tgt];
  const ty = posY[tgt];

  // Only re-path if target moved significantly
  const cdx = tx - chaseTargetX[eid];
  const cdy = ty - chaseTargetY[eid];
  if (movePathIndex[eid] >= 0 && cdx * cdx + cdy * cdy < CHASE_REPATH_SQ) {
    return; // Still pathing toward recent position
  }

  chaseTargetX[eid] = tx;
  chaseTargetY[eid] = ty;

  const startTile = worldToTile(posX[eid], posY[eid]);
  const endTile = worldToTile(tx, ty);
  const tilePath = findPath(map, startTile.col, startTile.row, endTile.col, endTile.row);

  if (tilePath.length > 0) {
    const worldPath: Array<[number, number]> = tilePath.map(([c, r]) => {
      const wp = tileToWorld(c, r);
      return [wp.x, wp.y] as [number, number];
    });
    setPath(eid, worldPath);
  }
}
