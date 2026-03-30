import { type World, hasComponents, entityExists } from '../ecs/world';
import {
  POSITION, HEALTH, ATTACK, MOVEMENT,
  posX, posY, faction, hpCurrent,
  atkDamage, atkRange, atkCooldown, atkLastTime, atkSplash, atkFlashTimer,
  targetEntity, commandMode,
  movePathIndex, setPath,
  unitType,
  slowEndTime, slowFactor, siegeMode, lastCombatTime,
} from '../ecs/components';
import { findClosestEnemy } from '../ecs/queries';
import { CommandMode, UnitType, SiegeMode, TILE_SIZE, MAX_ENTITIES, SLOW_DURATION, SLOW_FACTOR, Faction } from '../constants';
import { findPath } from '../map/Pathfinder';
import { worldToTile, tileToWorld, type MapData } from '../map/MapData';
import { isTileVisible } from './FogSystem';
import { soundManager } from '../audio/SoundManager';

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

/**
 * Handles target acquisition, attack execution, damage, splash, and chase logic.
 * Runs every tick after MovementSystem.
 */
export function combatSystem(world: World, dt: number, gameTime: number, map: MapData): void {
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
      }
    }

    // --- Auto-acquire target ---
    if (targetEntity[eid] < 1) {
      const enemy = findClosestEnemy(world, eid, range);
      if (enemy > 0) {
        // Terran units can't auto-acquire targets hidden in fog
        const myFac = faction[eid] as Faction;
        if (myFac === Faction.Terran && !isTileVisible(posX[enemy], posY[enemy])) {
          // Enemy is in fog — pretend we don't see them
          if (commandMode[eid] === CommandMode.Idle || commandMode[eid] === CommandMode.AttackTarget) {
            continue;
          } else {
            continue;
          }
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
      // Target out of range — chase (unless pure Move mode)
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

    // Stop moving while attacking
    movePathIndex[eid] = -1;

    // Apply damage
    hpCurrent[tgt] -= atkDamage[eid];

    // Push damage event for floating indicator
    if (damageEvents.length < MAX_DAMAGE_EVENTS) {
      // Color based on victim faction: red if Terran got hit, blue-white if Zerg got hit
      const victimFac = faction[tgt] as Faction;
      const dmgColor = victimFac === Faction.Terran ? 0xff4444 : 0xaaddff;
      damageEvents.push({
        x: posX[tgt],
        y: posY[tgt],
        amount: atkDamage[eid],
        time: gameTime,
        color: dmgColor,
      });
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
          hpCurrent[other] -= atkDamage[eid];
          lastCombatTime[other] = gameTime;

          // Splash damage event
          if (damageEvents.length < MAX_DAMAGE_EVENTS) {
            const splashVictimFac = faction[other] as Faction;
            const splashColor = splashVictimFac === Faction.Terran ? 0xff4444 : 0xaaddff;
            damageEvents.push({
              x: posX[other],
              y: posY[other],
              amount: atkDamage[eid],
              time: gameTime,
              color: splashColor,
            });
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
