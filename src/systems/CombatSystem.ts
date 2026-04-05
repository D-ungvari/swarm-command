import { type World, hasComponents, entityExists } from '../ecs/world';
import {
  POSITION, HEALTH, ATTACK, MOVEMENT,
  posX, posY, faction, hpCurrent,
  atkDamage, atkRange, atkCooldown, atkLastTime, atkSplash, atkMinRange, atkHitCount, atkFlashTimer,
  targetEntity, commandMode,
  movePathIndex, setPath,
  unitType,
  slowEndTime, slowFactor, siegeMode, lastCombatTime,
  bonusDmg, bonusVsTag, armorClass, baseArmor, pendingDamage, killCount, veterancyLevel, nextAutoAcquireTime,
  cloaked, burrowed,
  isAir, canTargetGround, canTargetAir,
  thorMode,
  blindingCloudEndTime,
  neuralStunEndTime,
} from '../ecs/components';
import { findBestTarget } from '../ecs/queries';
import { CommandMode, UnitType, SiegeMode, TILE_SIZE, MAX_ENTITIES, SLOW_DURATION, SLOW_FACTOR, Faction, ArmorClass, UpgradeType } from '../constants';
import { getBonusDamage } from '../combat/damageCalc';
import { findPath } from '../map/Pathfinder';
import { worldToTile, tileToWorld, type MapData } from '../map/MapData';
import { isTileVisible } from './FogSystem';
import { soundManager } from '../audio/SoundManager';
import { type PlayerResources } from '../types';
import { emitProjectile } from '../rendering/ProjectileRenderer';
import { triggerCameraShake } from '../rendering/CameraShake';
import { spatialHash } from '../ecs/SpatialHash';
import { simplifyPath } from '../utils/pathUtils';

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

/** Attack-move units stop chasing after this distance (SC2 ~12 tiles) */
const CHASE_LEASH_RANGE = 12 * TILE_SIZE;
const CHASE_LEASH_SQ = CHASE_LEASH_RANGE * CHASE_LEASH_RANGE;

/** Per-entity: last known target position we pathed toward */
const chaseTargetX = new Float32Array(MAX_ENTITIES);
const chaseTargetY = new Float32Array(MAX_ENTITIES);

/** Reset per-entity combat state (for tests / game restart) */
export function resetCombatEntity(eid: number): void {
  chaseTargetX[eid] = 0;
  chaseTargetY[eid] = 0;
  nextAutoAcquireTime[eid] = 0;
}

const FLASH_DURATION = 0.12; // seconds

/** Recompute veterancy level from kill count (called after each kill) */
function updateVeterancy(eid: number): void {
  const kills = killCount[eid];
  if (kills >= 20) veterancyLevel[eid] = 3;      // Hero
  else if (kills >= 10) veterancyLevel[eid] = 2;  // Elite
  else if (kills >= 4) veterancyLevel[eid] = 1;   // Veteran
}

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
    if (uType === UnitType.SiegeTank || uType === UnitType.Hellion ||
        uType === UnitType.WidowMine || uType === UnitType.Cyclone ||
        uType === UnitType.Thor || uType === UnitType.Battlecruiser ||
        uType === UnitType.Viking) return upgrades[UpgradeType.VehicleWeapons];
    return upgrades[UpgradeType.InfantryWeapons]; // Marine, Marauder, Ghost, Reaper, SCV
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

    // Neural Parasite stun: stunned units can't attack
    if (neuralStunEndTime[eid] > 0 && neuralStunEndTime[eid] > gameTime) continue;

    // Skip units that can't deal damage (Medivac)
    if (atkDamage[eid] === 0) continue;

    // Siege Tank in transition can't attack
    const sm = siegeMode[eid] as SiegeMode;
    if (sm === SiegeMode.Packing || sm === SiegeMode.Unpacking) continue;

    // Lurker can only attack while burrowed
    if (unitType[eid] === UnitType.Lurker && burrowed[eid] === 0) continue;

    // Widow Mine attacks via sentinel missile ability (AbilitySystem), not normal combat
    if (unitType[eid] === UnitType.WidowMine) continue;

    const target = targetEntity[eid];
    let range = atkRange[eid];

    // Blinding Cloud: ground units have range clamped to melee (0.5 tiles)
    if (blindingCloudEndTime[eid] > 0 && gameTime < blindingCloudEndTime[eid] && isAir[eid] === 0) {
      range = Math.min(range, 0.5 * TILE_SIZE);
    } else if (blindingCloudEndTime[eid] > 0 && gameTime >= blindingCloudEndTime[eid]) {
      blindingCloudEndTime[eid] = 0; // expired — clear
    }

    // --- Target validation ---
    if (target >= 1) {
      if (!entityExists(world, target) || hpCurrent[target] <= 0) {
        pendingDamage[target] = Math.max(0, pendingDamage[target] - atkDamage[eid]);
        targetEntity[eid] = -1;
        if (commandMode[eid] === CommandMode.AttackTarget) {
          commandMode[eid] = CommandMode.Idle;
        }
      } else if (
        (isAir[target] === 1 && !canTargetAir[eid]) ||
        (isAir[target] === 0 && !canTargetGround[eid])
      ) {
        pendingDamage[target] = Math.max(0, pendingDamage[target] - atkDamage[eid]);
        targetEntity[eid] = -1;
        if (commandMode[eid] === CommandMode.AttackTarget) {
          commandMode[eid] = CommandMode.Idle;
        }
      }
    }

    // --- Auto-acquire target ---
    if (targetEntity[eid] < 1) {
      // Move mode: don't auto-acquire — just go to destination (SC2 right-click behavior)
      if (commandMode[eid] === CommandMode.Move || commandMode[eid] === CommandMode.Gather || commandMode[eid] === CommandMode.Build) {
        continue;
      }

      // Target commitment: don't retarget too frequently (0.3s cooldown)
      if (gameTime < nextAutoAcquireTime[eid]) continue;

      // SC2 aggro: weapon range + buffer so units engage approaching enemies
      // HoldPosition: slightly wider than weapon range (range + 1 tile)
      const aggroRange = commandMode[eid] === CommandMode.HoldPosition
        ? range + 1 * TILE_SIZE
        : range + 2 * TILE_SIZE;
      const enemy = findBestTarget(world, eid, aggroRange);
      if (enemy > 0) {
        // Terran units can't auto-acquire targets hidden in deep fog
        // But allow targeting enemies within weapon range even if fog hasn't refreshed yet
        const myFac = faction[eid] as Faction;
        const edx = posX[enemy] - posX[eid];
        const edy = posY[enemy] - posY[eid];
        const enemyDistSq = edx * edx + edy * edy;
        if (myFac === Faction.Terran && !isTileVisible(posX[enemy], posY[enemy]) && enemyDistSq > range * range) {
          continue;
        }
        targetEntity[eid] = enemy;
        pendingDamage[enemy] += atkDamage[eid];
        nextAutoAcquireTime[eid] = gameTime + 0.15; // 0.15s before next auto-acquire
        movePathIndex[eid] = -1;
      } else if (commandMode[eid] === CommandMode.Idle || commandMode[eid] === CommandMode.AttackTarget) {
        continue; // No target, nothing to do
      } else {
        continue; // AttackMove with no enemy nearby — keep moving
      }
    }

    const tgt = targetEntity[eid];
    if (tgt < 1) continue;

    // Thor has longer range vs air: Javelin=11 tiles, Explosive=10 tiles (ground stays at base range)
    if (unitType[eid] === UnitType.Thor && isAir[tgt] === 1) {
      range = (thorMode[eid] === 0 ? 11 : 10) * TILE_SIZE;
    }

    // --- Range check ---
    const dx = posX[tgt] - posX[eid];
    const dy = posY[tgt] - posY[eid];
    const distSq = dx * dx + dy * dy;
    const rangeSq = range * range;

    if (distSq > rangeSq) {
      // Sieged tanks can't chase — drop target and let auto-acquire find in-range one
      if (sm === SiegeMode.Sieged) {
        pendingDamage[tgt] = Math.max(0, pendingDamage[tgt] - atkDamage[eid]);
        targetEntity[eid] = -1;
        continue;
      }
      // HoldPosition: drop target instead of chasing — stay put
      if (commandMode[eid] === CommandMode.HoldPosition) {
        pendingDamage[tgt] = Math.max(0, pendingDamage[tgt] - atkDamage[eid]);
        targetEntity[eid] = -1;
        continue;
      }
      // AttackTarget: chase the explicit target regardless of distance until it dies.
      // AttackMove: chase up to CHASE_LEASH_RANGE then drop target and resume path.
      if (commandMode[eid] !== CommandMode.Move) {
        if (commandMode[eid] === CommandMode.AttackMove && distSq > CHASE_LEASH_SQ) {
          pendingDamage[tgt] = Math.max(0, pendingDamage[tgt] - atkDamage[eid]);
          targetEntity[eid] = -1;
        } else {
          chaseTarget(eid, tgt, map, gameTime);
        }
      }
      continue;
    }

    // --- Minimum range check (e.g. Siege Tank in siege mode) ---
    if (atkMinRange[eid] > 0 && distSq < atkMinRange[eid] * atkMinRange[eid]) {
      targetEntity[eid] = -1;
      continue;
    }

    // --- Attack execution ---
    // Convert cooldown from ms to seconds for comparison
    const cooldownSec = atkCooldown[eid] / 1000;
    if (gameTime - atkLastTime[eid] < cooldownSec) continue;

    // Fire!
    atkLastTime[eid] = gameTime;
    atkFlashTimer[eid] = FLASH_DURATION;
    soundManager.playAttackAt(posX[eid], posY[eid]);

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

    // Compute actual damage with SC2 bonus-damage model and armor reduction
    // Multi-hit: armor applies per-hit (Reaper 4×2, Queen ground 4×2, Thor Javelin 6×4)
    let baseDmg = atkDamage[eid];
    let hits = atkHitCount[eid] || 1;
    // Queen dual attack: 4×2=8 vs ground (hitCount=2), 9×1 vs air
    if (unitType[eid] === UnitType.Queen && isAir[tgt] === 0) {
      baseDmg = 8;
    } else if (unitType[eid] === UnitType.Queen && isAir[tgt] === 1) {
      hits = 1; // air attack is single-hit
    }
    // Thor anti-air: mode 0 = Javelin Missiles (6×4=24, single-target), mode 1 = Explosive Payload (6×1, splash)
    let thorSplashActive = false;
    if (unitType[eid] === UnitType.Thor && isAir[tgt] === 1) {
      if (thorMode[eid] === 0) {
        baseDmg = 24; // Javelin total (6 per hit × 4 hits)
      } else {
        baseDmg = 6;
        hits = 1; // Explosive Payload is single-hit + splash
        thorSplashActive = true;
      }
    }
    // Thor ground attack is single-hit (60 damage)
    if (unitType[eid] === UnitType.Thor && isAir[tgt] === 0) {
      hits = 1;
    }
    const bonus = getBonusDamage(bonusDmg[eid], bonusVsTag[eid], armorClass[tgt]);
    const weaponBonus = getWeaponBonus(resources, faction[eid], unitType[eid] as UnitType);
    const armorBonus = getArmorBonus(resources, faction[tgt]);
    const vetBonus = veterancyLevel[eid]; // 0-3 extra damage
    const vetArmor = veterancyLevel[tgt]; // 0-3 extra armor
    const totalArmor = baseArmor[tgt] + armorBonus + vetArmor;
    // Multi-hit: split damage evenly, apply armor per hit
    const perHitDmg = baseDmg / hits;
    const perHitBonus = bonus / hits;
    const perHitWeapon = weaponBonus / hits;
    const perHitVet = vetBonus / hits;
    let rawDmg = 0;
    for (let h = 0; h < hits; h++) {
      rawDmg += Math.max(0.5, (perHitDmg + perHitBonus + perHitWeapon + perHitVet) - totalArmor);
    }

    // Apply damage
    hpCurrent[tgt] -= rawDmg;

    // Overkill prevention: subtract delivered damage from pending total
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
      updateVeterancy(eid);
      // Clear pending damage for ALL units targeting this dead entity
      pendingDamage[tgt] = 0;
      for (let a = 1; a < world.nextEid; a++) {
        if (targetEntity[a] === tgt) {
          targetEntity[a] = -1;
          // Return to previous command mode (idle or resume attack-move)
          if (commandMode[a] === CommandMode.AttackTarget) {
            commandMode[a] = CommandMode.Idle;
          }
        }
      }
    }

    // Track Terran under-attack for player alerts
    if (faction[tgt] === Faction.Terran) {
      lastTerranHitTime = gameTime;
      lastTerranHitX = posX[tgt];
      lastTerranHitY = posY[tgt];
    }

    // Mutalisk glaive bounce — hits 2 additional targets at reduced damage (9→3→1)
    if (unitType[eid] === UnitType.Mutalisk) {
      const bounceRange = 1.5 * TILE_SIZE; // 1.5 tiles
      const bounceRangeSq = bounceRange * bounceRange;
      let lastX = posX[tgt];
      let lastY = posY[tgt];
      let lastDmg = rawDmg;
      const bounced = new Set([eid, tgt]);

      spatialHash.ensureBuilt(world);
      const myFac = faction[eid];

      for (let bounce = 0; bounce < 2; bounce++) {
        const bounceDmg = Math.max(1, Math.round(lastDmg / 3));
        // Find nearest enemy NOT already bounced to
        let nearestEid = 0;
        let nearestDist = Infinity;
        const bounceCandidates = spatialHash.queryRadius(lastX, lastY, bounceRange);
        for (const other of bounceCandidates) {
          if (bounced.has(other)) continue;
          if (!hasComponents(world, other, POSITION | HEALTH)) continue;
          if (faction[other] === myFac || faction[other] === 0) continue;
          if (hpCurrent[other] <= 0) continue;
          const bdx = posX[other] - lastX;
          const bdy = posY[other] - lastY;
          const bDistSq = bdx * bdx + bdy * bdy;
          if (bDistSq < bounceRangeSq && bDistSq < nearestDist) {
            nearestDist = bDistSq;
            nearestEid = other;
          }
        }
        if (nearestEid === 0) break;

        // Emit bounce projectile from previous bounce position
        emitProjectile({
          fromX: lastX, fromY: lastY,
          toX: posX[nearestEid], toY: posY[nearestEid],
          unitType: UnitType.Mutalisk,
          speed: 600,
          time: gameTime,
        });

        hpCurrent[nearestEid] -= bounceDmg;
        bounced.add(nearestEid);
        lastX = posX[nearestEid];
        lastY = posY[nearestEid];
        lastDmg = bounceDmg;
        lastCombatTime[nearestEid] = gameTime;

        // Floating damage indicator for bounce hit
        if (damageEvents.length < MAX_DAMAGE_EVENTS) {
          const bounceVicFac = faction[nearestEid] as Faction;
          const bounceColor = bounceVicFac === Faction.Terran ? 0xff4444 : 0xaaddff;
          damageEvents.push({
            x: posX[nearestEid],
            y: posY[nearestEid],
            amount: bounceDmg,
            time: gameTime,
            color: bounceColor,
          });
        }

        // Track Terran under-attack for bounce hits too
        if (faction[nearestEid] === Faction.Terran) {
          lastTerranHitTime = gameTime;
          lastTerranHitX = posX[nearestEid];
          lastTerranHitY = posY[nearestEid];
        }

        if (hpCurrent[nearestEid] <= 0) {
          killCount[eid]++;
          updateVeterancy(eid);
          pendingDamage[nearestEid] = 0;
        }
      }
    }

    // Retaliation: victim auto-targets attacker if idle, can fight, and can target their layer
    if (targetEntity[tgt] < 1 && atkDamage[tgt] > 0 &&
        commandMode[tgt] !== CommandMode.Move && commandMode[tgt] !== CommandMode.Gather) {
      const canTarget = isAir[eid] === 1 ? canTargetAir[tgt] === 1 : canTargetGround[tgt] === 1;
      if (canTarget) targetEntity[tgt] = eid;
    }

    // Track combat time for Roach regen
    lastCombatTime[eid] = gameTime;
    lastCombatTime[tgt] = gameTime;

    // Marauder: Concussive Shells — slow the target (Ultralisk immune: Frenzied passive)
    if (unitType[eid] === UnitType.Marauder && unitType[tgt] !== UnitType.Ultralisk) {
      slowEndTime[tgt] = gameTime + SLOW_DURATION;
      slowFactor[tgt] = SLOW_FACTOR;
    }

    // Splash damage — SC2 uses 3 zones: inner 100%, middle 50%, outer 25%
    if (atkSplash[eid] > 0) {
      const splashRange = atkSplash[eid] * TILE_SIZE;
      const splashRangeSq = splashRange * splashRange;
      const innerSq = (splashRange * 0.4) * (splashRange * 0.4);   // 0-40% radius: 100%
      const middleSq = (splashRange * 0.7) * (splashRange * 0.7);  // 40-70% radius: 50%
      // 70-100% radius: 25%
      const myFac = faction[eid];
      const tx = posX[tgt];
      const ty = posY[tgt];

      for (let other = 1; other < world.nextEid; other++) {
        if (other === tgt || other === eid) continue;
        if (!hasComponents(world, other, POSITION | HEALTH)) continue;
        if (faction[other] === myFac) continue;
        if (hpCurrent[other] <= 0) continue;
        // Splash respects air/ground targeting
        if (isAir[other] === 1 && canTargetAir[eid] === 0) continue;
        if (isAir[other] === 0 && canTargetGround[eid] === 0) continue;

        const sdx = posX[other] - tx;
        const sdy = posY[other] - ty;
        const distSq = sdx * sdx + sdy * sdy;
        if (distSq <= splashRangeSq) {
          const sBonus = getBonusDamage(bonusDmg[eid], bonusVsTag[eid], armorClass[other]);
          const sArmorBonus = getArmorBonus(resources, faction[other]);
          const fullDmg = Math.max(0.5, (atkDamage[eid] + sBonus + weaponBonus) - (baseArmor[other] + sArmorBonus));
          // SC2 splash zones: inner 100%, middle 50%, outer 25%
          const splashMult = distSq <= innerSq ? 1.0 : distSq <= middleSq ? 0.5 : 0.25;
          const sDmg = Math.max(0.5, fullDmg * splashMult);
          hpCurrent[other] -= sDmg;
          lastCombatTime[other] = gameTime;

          if (damageEvents.length < MAX_DAMAGE_EVENTS) {
            const splashVictimFac = faction[other] as Faction;
            const splashColor = splashVictimFac === Faction.Terran ? 0xff4444 : 0xaaddff;
            damageEvents.push({
              x: posX[other],
              y: posY[other],
              amount: Math.round(sDmg),
              time: gameTime,
              color: splashColor,
            });
          }

          if (hpCurrent[other] <= 0) {
            killCount[eid]++;
            updateVeterancy(eid);
            pendingDamage[other] = 0;
          }
        }
      }
    }

    // Thor Explosive Payload splash (0.5 tile radius, air-only)
    if (thorSplashActive) {
      const thorSplashRange = 0.5 * TILE_SIZE;
      const thorSplashRangeSq = thorSplashRange * thorSplashRange;
      const myFac = faction[eid];
      const tx = posX[tgt];
      const ty = posY[tgt];

      for (let other = 1; other < world.nextEid; other++) {
        if (other === tgt || other === eid) continue;
        if (!hasComponents(world, other, POSITION | HEALTH)) continue;
        if (faction[other] === myFac) continue;
        if (hpCurrent[other] <= 0) continue;
        // Explosive Payload only splashes air targets
        if (isAir[other] !== 1) continue;

        const sdx = posX[other] - tx;
        const sdy = posY[other] - ty;
        const dSq = sdx * sdx + sdy * sdy;
        if (dSq <= thorSplashRangeSq) {
          const sBonus = getBonusDamage(bonusDmg[eid], bonusVsTag[eid], armorClass[other]);
          const sArmorBonus = getArmorBonus(resources, faction[other]);
          const sDmg = Math.max(0.5, (baseDmg + sBonus + weaponBonus) - (baseArmor[other] + sArmorBonus));
          hpCurrent[other] -= sDmg;
          lastCombatTime[other] = gameTime;

          if (damageEvents.length < MAX_DAMAGE_EVENTS) {
            const splashVictimFac = faction[other] as Faction;
            const splashColor = splashVictimFac === Faction.Terran ? 0xff4444 : 0xaaddff;
            damageEvents.push({
              x: posX[other],
              y: posY[other],
              amount: Math.round(sDmg),
              time: gameTime,
              color: splashColor,
            });
          }

          if (hpCurrent[other] <= 0) {
            killCount[eid]++;
            updateVeterancy(eid);
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

function chaseTarget(eid: number, tgt: number, map: MapData, gameTime: number): void {
  // Air units fly in a straight line — no A* needed
  // Offset based on eid to prevent stacking on the same pixel
  if (isAir[eid]) {
    const angle = ((eid * 2654435769) & 0xffff) / 0xffff * Math.PI * 2; // hash-based spread
    const spread = 8 + (eid % 5) * 4; // 8-24px offset
    const destX = posX[tgt] + Math.cos(angle) * spread;
    const destY = posY[tgt] + Math.sin(angle) * spread;
    setPath(eid, [[destX, destY]]);
    chaseTargetX[eid] = posX[tgt];
    chaseTargetY[eid] = posY[tgt];
    return;
  }

  // Stagger re-path for large armies: only re-path every 4 ticks per unit
  if ((Math.floor(gameTime * 60) % 4) !== (eid % 4)) return;

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
    const worldPath: Array<[number, number]> = simplifyPath(tilePath.map(([c, r]) => {
      const wp = tileToWorld(c, r);
      return [wp.x, wp.y] as [number, number];
    }));
    setPath(eid, worldPath);
  }
}

