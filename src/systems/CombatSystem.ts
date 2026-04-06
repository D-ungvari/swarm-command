import { type World, hasComponents, entityExists } from '../ecs/world';
import {
  POSITION, HEALTH, ATTACK, MOVEMENT,
  posX, posY, faction, hpCurrent, loadedInto,
  atkDamage, atkRange, atkCooldown, atkLastTime, atkSplash, atkMinRange, atkHitCount, atkFlashTimer,
  targetEntity, commandMode,
  movePathIndex, setPath,
  unitType,
  slowEndTime, slowFactor, siegeMode, lastCombatTime,
  bonusDmg, bonusVsTag, armorClass, baseArmor, pendingDamage, killCount, veterancyLevel, nextAutoAcquireTime,
  cloaked, burrowed,
  isAir, canTargetGround, canTargetAir,
  blindingCloudEndTime,
  neuralStunEndTime,
} from '../ecs/components';
import { findBestTarget } from '../ecs/queries';
import { CommandMode, UnitType, SiegeMode, TILE_SIZE, MAX_ENTITIES, Faction, ArmorClass, UpgradeType, veterancyEnabled, FACTION_COLORS } from '../constants';
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
  // Iron Legion
  [UnitType.Trooper]: 700,
  [UnitType.Grenadier]: 500,
  [UnitType.Medic]: 0,
  [UnitType.Humvee]: 550,
  [UnitType.SiegeTank]: 350,
  [UnitType.Gunship]: 500,
  [UnitType.TitanWalker]: 300,
  // Swarm
  [UnitType.Drone]: 0,       // melee
  [UnitType.Spitter]: 450,
  [UnitType.Burrower]: 0,    // melee/ambush
  [UnitType.Broodmother]: 400,
  [UnitType.Ravager]: 500,
  [UnitType.Flyer]: 600,
  [UnitType.Leviathan]: 400,
  // Arcane Covenant
  [UnitType.Acolyte]: 600,
  [UnitType.Warden]: 500,
  [UnitType.Enchanter]: 550,
  [UnitType.BlinkAssassin]: 0, // melee
  [UnitType.StormCaller]: 500,
  [UnitType.Golem]: 400,
  [UnitType.Archmage]: 500,
  // Automata
  [UnitType.Sentinel]: 650,
  [UnitType.Shredder]: 700,
  [UnitType.RepairDrone]: 0,
  [UnitType.Crawler]: 550,
  [UnitType.Disruptor]: 600,
  [UnitType.Harvester]: 500,
  [UnitType.Colossus]: 400,
};

/** How far a target must move before we re-path to chase it */
const CHASE_REPATH_THRESHOLD = TILE_SIZE;
const CHASE_REPATH_SQ = CHASE_REPATH_THRESHOLD * CHASE_REPATH_THRESHOLD;

/** Attack-move units stop chasing after this distance (~12 tiles) */
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
  if (!veterancyEnabled) return;
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
  /** Color based on victim's faction */
  color: number;
  /** True if this attack missed due to low-ground penalty */
  isMiss?: boolean;
}

const MAX_DAMAGE_EVENTS = 64;
const DAMAGE_EVENT_LIFETIME = 0.8; // seconds
export const damageEvents: DamageEvent[] = [];

// ── Under-attack tracking (for player alerts) ──
let lastPlayerHitTime = 0;
let lastPlayerHitX = 0;
let lastPlayerHitY = 0;

/** Returns the position and time of the most recent hit on a player-faction entity */
export function getLastPlayerHit(): { x: number; y: number; time: number } {
  return { x: lastPlayerHitX, y: lastPlayerHitY, time: lastPlayerHitTime };
}

// Legacy alias
export const getLastTerranHit = getLastPlayerHit;

/** Faction-aware damage color: uses FACTION_COLORS or falls back to white */
function getDamageColor(victimFaction: number): number {
  return FACTION_COLORS[victimFaction] ?? 0xffffff;
}

/** Returns the weapon upgrade bonus for an attacker based on faction upgrades. */
function getWeaponBonus(resources: Record<number, PlayerResources>, attackerFaction: number, _uType: UnitType): number {
  const upgrades = resources[attackerFaction]?.upgrades;
  if (!upgrades) return 0;
  // Use tiered weapon upgrades: Weapons1/2/3
  let level = 0;
  if (upgrades[UpgradeType.Weapons3]) level = 3;
  else if (upgrades[UpgradeType.Weapons2]) level = 2;
  else if (upgrades[UpgradeType.Weapons1]) level = 1;
  return level;
}

/** Returns the armor upgrade bonus for a defender based on faction upgrades. */
function getArmorBonus(resources: Record<number, PlayerResources>, defenderFaction: number, _uType?: UnitType): number {
  const upgrades = resources[defenderFaction]?.upgrades;
  if (!upgrades) return 0;
  let level = 0;
  if (upgrades[UpgradeType.Armor3]) level = 3;
  else if (upgrades[UpgradeType.Armor2]) level = 2;
  else if (upgrades[UpgradeType.Armor1]) level = 1;
  return level;
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

    // Skip loaded units (inside a transport)
    if (loadedInto[eid] > 0) continue;

    // Neural Parasite stun: stunned units can't attack
    if (neuralStunEndTime[eid] > 0 && neuralStunEndTime[eid] > gameTime) continue;

    // Skip units that can't deal damage (Medic, RepairDrone)
    if (atkDamage[eid] === 0) continue;

    // Siege Tank in transition can't attack
    const sm = siegeMode[eid] as SiegeMode;
    if (sm === SiegeMode.Packing || sm === SiegeMode.Unpacking) continue;

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
      // Move mode: don't auto-acquire — just go to destination (right-click behavior)
      if (commandMode[eid] === CommandMode.Move) {
        continue;
      }

      // Target commitment: don't retarget too frequently (0.3s cooldown)
      if (gameTime < nextAutoAcquireTime[eid]) continue;

      // Aggro: weapon range + buffer so units engage approaching enemies
      // HoldPosition: slightly wider than weapon range (range + 1 tile)
      const aggroRange = commandMode[eid] === CommandMode.HoldPosition
        ? range + 1 * TILE_SIZE
        : range + 2 * TILE_SIZE;
      const enemy = findBestTarget(world, eid, aggroRange);
      if (enemy > 0) {
        // Player units can't auto-acquire targets hidden in deep fog
        // But allow targeting enemies within weapon range even if fog hasn't refreshed yet
        const myFac = faction[eid] as Faction;
        const edx = posX[enemy] - posX[eid];
        const edy = posY[enemy] - posY[eid];
        const enemyDistSq = edx * edx + edy * edy;
        if (myFac === Faction.IronLegion && !isTileVisible(posX[enemy], posY[enemy]) && enemyDistSq > range * range) {
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

    // Camera shake for splash-damage units
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

    // Elevation miss chance: 30% miss when attacking from low ground to high ground
    const aTile = worldToTile(posX[eid], posY[eid]);
    const tTile = worldToTile(posX[tgt], posY[tgt]);
    const aElev = map.elevation[aTile.row * map.cols + aTile.col] ?? 0;
    const tElev = map.elevation[tTile.row * map.cols + tTile.col] ?? 0;
    if (aElev < tElev && Math.random() < 0.3) {
      // MISS — push miss event and skip damage
      pendingDamage[tgt] = Math.max(0, pendingDamage[tgt] - atkDamage[eid]);
      if (damageEvents.length < MAX_DAMAGE_EVENTS) {
        damageEvents.push({ x: posX[tgt], y: posY[tgt], amount: 0, time: gameTime, color: 0xffffff, isMiss: true });
      }
      continue;
    }

    // Compute actual damage with bonus-damage model and armor reduction
    // Multi-hit: armor applies per-hit
    const baseDmg = atkDamage[eid];
    const hits = atkHitCount[eid] || 1;
    const bonus = getBonusDamage(bonusDmg[eid], bonusVsTag[eid], armorClass[tgt]);
    const weaponBonus = getWeaponBonus(resources, faction[eid], unitType[eid] as UnitType);
    const armorBonus = getArmorBonus(resources, faction[tgt], unitType[tgt] as UnitType);
    const vetBonus = veterancyEnabled ? veterancyLevel[eid] : 0; // 0-3 extra damage
    const vetArmor = veterancyEnabled ? veterancyLevel[tgt] : 0; // 0-3 extra armor
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
      const dmgColor = getDamageColor(faction[tgt]);
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

    // Track player-faction under-attack for alerts
    if (faction[tgt] === Faction.IronLegion) {
      lastPlayerHitTime = gameTime;
      lastPlayerHitX = posX[tgt];
      lastPlayerHitY = posY[tgt];
    }

    // Retaliation: victim auto-targets attacker if idle, can fight, and can target their layer
    if (targetEntity[tgt] < 1 && atkDamage[tgt] > 0 &&
        commandMode[tgt] !== CommandMode.Move) {
      const canTarget = isAir[eid] === 1 ? canTargetAir[tgt] === 1 : canTargetGround[tgt] === 1;
      if (canTarget) targetEntity[tgt] = eid;
    }

    // Track combat time for regen mechanics
    lastCombatTime[eid] = gameTime;
    lastCombatTime[tgt] = gameTime;

    // Splash damage — 3 zones: inner 100%, middle 50%, outer 25%
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
        const sDist = sdx * sdx + sdy * sdy;
        if (sDist <= splashRangeSq) {
          const sBonus = getBonusDamage(bonusDmg[eid], bonusVsTag[eid], armorClass[other]);
          const sArmorBonus = getArmorBonus(resources, faction[other], unitType[other] as UnitType);
          const fullDmg = Math.max(0.5, (atkDamage[eid] + sBonus + weaponBonus) - (baseArmor[other] + sArmorBonus));
          // Splash zones: inner 100%, middle 50%, outer 25%
          const splashMult = sDist <= innerSq ? 1.0 : sDist <= middleSq ? 0.5 : 0.25;
          const sDmg = Math.max(0.5, fullDmg * splashMult);
          hpCurrent[other] -= sDmg;
          lastCombatTime[other] = gameTime;

          if (damageEvents.length < MAX_DAMAGE_EVENTS) {
            const splashColor = getDamageColor(faction[other]);
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
