import { type World, hasComponents } from '../ecs/world';
import {
  POSITION, SELECTABLE, MOVEMENT, UNIT_TYPE, BUILDING, HEALTH,
  posX, posY, selected, moveTargetX, moveTargetY, hpMax,
  setPath, appendPath, getPathWaypoint, pathLengths, faction, movePathIndex, unitType, velX, velY,
  targetEntity, commandMode,
  patrolOriginX, patrolOriginY,
  stimEndTime, hpCurrent, moveSpeed, atkCooldown,
  siegeMode, siegeTransitionEnd,
  workerState, workerTargetEid, resourceType, resourceRemaining,
  rallyX, rallyY, buildState, buildingType, prodUnitType, prodProgress, prodTimeTotal,
  prodQueue, prodQueueLen, PROD_QUEUE_MAX,
  cloaked, burrowed,
  energy, injectTimer, larvaCount, larvaRegenTimer,
  isAir, canTargetGround, canTargetAir, atkRange, atkDamage, bonusDmg, bonusVsTag,
  atkLastTime,
  bileLandTime, bileLandX, bileLandY,
  fungalLandTime, fungalLandX, fungalLandY,
  kd8LandTime, kd8LandX, kd8LandY,
  depotLowered,
  causticTarget,
  lockOnTarget, lockOnEndTime,
  thorMode,
  hellbatMode,
  renderWidth, renderHeight, atkSplash,
  blindingCloudEndTime,
  parasiticBombEndTime, parasiticBombCasterFaction,
  neuralTarget, neuralEndTime, neuralStunEndTime,
} from '../ecs/components';
import { UNIT_DEFS } from '../data/units';
import { BUILDING_DEFS } from '../data/buildings';
import { findEnemyAt, findResourceAt, findBuildingAt, findFriendlyAt, findFriendlyBuildingAt, hasCompletedBuilding, findNearbyMinerals } from '../ecs/queries';
import { CommandType, type GameCommand } from '../input/CommandQueue';
import type { MapData } from '../map/MapData';
import { worldToTile, tileToWorld, findNearestWalkableTile, markBuildingTiles, clearBuildingTiles } from '../map/MapData';
import { findPath } from '../map/Pathfinder';
import {
  Faction, CommandMode, UnitType, SiegeMode, ResourceType, WorkerState, BuildState, BuildingType, ArmorClass, TILE_SIZE, isHatchType, UpgradeType,
  STIM_DURATION, STIM_HP_COST, STIM_HP_COST_MARAUDER, STIM_SPEED_MULT, STIM_COOLDOWN_MULT,
  SIEGE_PACK_TIME,
  INJECT_LARVA_COST, INJECT_LARVA_TIME, LARVA_MAX, LARVA_REGEN_TIME,
  SNIPE_DAMAGE, SNIPE_ENERGY_COST, SNIPE_RANGE,
  EMP_RANGE, EMP_RADIUS, EMP_ENERGY_DRAIN, EMP_ENERGY_COST,
  TRANSFUSE_HEAL, TRANSFUSE_ENERGY_COST, TRANSFUSE_RANGE,
  CAUSTIC_SPRAY_RANGE,
  LOCKON_RANGE, LOCKON_DURATION, LOCKON_COOLDOWN,
  BLINDING_CLOUD_RANGE, BLINDING_CLOUD_RADIUS, BLINDING_CLOUD_DURATION, BLINDING_CLOUD_COST,
  PARASITIC_BOMB_RANGE, PARASITIC_BOMB_RADIUS, PARASITIC_BOMB_DURATION, PARASITIC_BOMB_COST,
  VIPER_CONSUME_RANGE, VIPER_CONSUME_HP_COST, VIPER_CONSUME_ENERGY,
  KD8_COOLDOWN, KD8_DELAY, KD8_RANGE,
  NEURAL_PARASITE_RANGE, NEURAL_PARASITE_DURATION, NEURAL_PARASITE_COST,
} from '../constants';
import type { PlayerResources } from '../types';
import type { Viewport } from 'pixi-viewport';
import { addCommandPing } from '../rendering/UnitRenderer';
import { emitProjectile } from '../rendering/ProjectileRenderer';
import { simplifyPath } from '../utils/pathUtils';
import { damageEvents } from './CombatSystem';
import { soundManager } from '../audio/SoundManager';
import { triggerCameraShake } from '../rendering/CameraShake';

/**
 * Translates queued game commands into move/attack/attack-move commands for selected units.
 * Also handles ability commands (Stim, Siege), rally points, and production.
 */
export function commandSystem(
  world: World,
  commands: GameCommand[],
  viewport: Viewport,
  map: MapData,
  gameTime: number,
  resources?: Record<number, PlayerResources>,
  playerFaction: Faction = Faction.Terran,
): void {
  for (const cmd of commands) {
    switch (cmd.type) {
      case CommandType.Stop:
        if (cmd.units) stopUnits(world, cmd.units);
        break;

      case CommandType.HoldPosition:
        if (cmd.units) holdUnits(world, cmd.units);
        break;

      case CommandType.Patrol: {
        const units = cmd.units ?? [];
        if (units.length === 0) break;
        // Record current position as patrol origin for each unit
        for (const eid of units) {
          patrolOriginX[eid] = posX[eid];
          patrolOriginY[eid] = posY[eid];
        }
        issuePathCommand(world, units, cmd.wx!, cmd.wy!, map, CommandMode.Patrol, cmd.shiftHeld ?? false);
        addCommandPing(cmd.wx!, cmd.wy!, 0xffaa00, gameTime);
        break;
      }

      case CommandType.Stim:
        if (cmd.units && resources && resources[playerFaction]?.upgrades[UpgradeType.StimPack]) {
          applyStim(world, cmd.units, gameTime);
          soundManager.playStimActivation();
        }
        break;

      case CommandType.SiegeToggle:
        if (cmd.units) {
          // Siege mode requires SiegeTech research; other transforms (Viking, Hellion, Thor) are always available
          const hasSiegeTech = resources && resources[playerFaction]?.upgrades[UpgradeType.SiegeTech];
          if (hasSiegeTech) toggleSiegeMode(world, cmd.units, gameTime);
          vikingTransform(world, cmd.units);
          hellionTransform(cmd.units);
          thorModeSwitch(cmd.units);
          soundManager.playSiegeMode();
        }
        break;

      case CommandType.Cloak:
        if (cmd.units) {
          for (const eid of cmd.units) {
            if (unitType[eid] !== UnitType.Ghost) continue;
            cloaked[eid] = cloaked[eid] === 1 ? 0 : 1; // toggle
          }
          soundManager.playCloakToggle();
        }
        break;

      case CommandType.BanelingBurrow:
        if (cmd.units) {
          for (const eid of cmd.units) {
            if (unitType[eid] !== UnitType.Baneling) continue;
            if (hpCurrent[eid] <= 0) continue;
            if (burrowed[eid] === 0) {
              // Burrow: become invisible, stop movement
              burrowed[eid] = 1;
              cloaked[eid] = 1;
              velX[eid] = 0;
              velY[eid] = 0;
              movePathIndex[eid] = -1;
              pathLengths[eid] = 0;
              commandMode[eid] = CommandMode.Idle;
              targetEntity[eid] = -1;
            } else {
              // Unburrow: become visible
              burrowed[eid] = 0;
              cloaked[eid] = 0;
            }
          }
        }
        break;

      case CommandType.RoachBurrow:
        if (cmd.units) {
          for (const eid of cmd.units) {
            if (unitType[eid] !== UnitType.Roach) continue;
            if (hpCurrent[eid] <= 0) continue;
            if (burrowed[eid] === 0) {
              // Burrow: become invisible, stop movement
              burrowed[eid] = 1;
              cloaked[eid] = 1;
              velX[eid] = 0;
              velY[eid] = 0;
              movePathIndex[eid] = -1;
              pathLengths[eid] = 0;
              commandMode[eid] = CommandMode.Idle;
              targetEntity[eid] = -1;
            } else {
              // Unburrow: become visible
              burrowed[eid] = 0;
              cloaked[eid] = 0;
            }
          }
        }
        break;

      case CommandType.InjectLarva: {
        if (!cmd.units) break;
        for (const qEid of cmd.units) {
          if (unitType[qEid] !== UnitType.Queen) continue;
          if (hpCurrent[qEid] <= 0) continue;
          if (energy[qEid] < INJECT_LARVA_COST) continue;
          // Find nearest friendly Hatchery with no active inject
          let best = 0, bestDist = Infinity;
          const myFac = faction[qEid];
          for (let eid = 1; eid < world.nextEid; eid++) {
            if (!hasComponents(world, eid, BUILDING)) continue;
            if (faction[eid] !== myFac) continue;
            if (!isHatchType(buildingType[eid])) continue;
            if (buildState[eid] !== BuildState.Complete) continue;
            if (injectTimer[eid] > 0) continue;
            const d = (posX[eid] - posX[qEid]) ** 2 + (posY[eid] - posY[qEid]) ** 2;
            if (d < bestDist) { bestDist = d; best = eid; }
          }
          if (best === 0) continue;
          energy[qEid] -= INJECT_LARVA_COST;
          injectTimer[best] = gameTime + INJECT_LARVA_TIME;
        }
        break;
      }

      case CommandType.Yamato: {
        if (!cmd.units) break;
        const YAMATO_RANGE = 10 * TILE_SIZE;
        const YAMATO_COOLDOWN = 71; // seconds
        const YAMATO_DAMAGE = 240;
        for (const eid of cmd.units) {
          if (unitType[eid] !== UnitType.Battlecruiser) continue;
          if (hpCurrent[eid] <= 0) continue;
          // Use atkLastTime for cooldown tracking (reuse existing field)
          if (atkLastTime[eid] + YAMATO_COOLDOWN > gameTime) continue;
          // Find enemy nearest to click position (or nearest to caster if no click)
          const myFac = faction[eid];
          const yamatoRefX = cmd.wx ?? posX[eid];
          const yamatoRefY = cmd.wy ?? posY[eid];
          let bestTgt = 0;
          let bestDist = Infinity;
          for (let other = 1; other < world.nextEid; other++) {
            if (!hasComponents(world, other, POSITION | UNIT_TYPE)) continue;
            if (faction[other] === myFac || faction[other] === 0) continue;
            if (hpCurrent[other] <= 0) continue;
            if (isAir[other] === 1 && !canTargetAir[eid]) continue;
            if (isAir[other] === 0 && !canTargetGround[eid]) continue;
            const dxR = posX[other] - posX[eid];
            const dyR = posY[other] - posY[eid];
            if (dxR * dxR + dyR * dyR > YAMATO_RANGE * YAMATO_RANGE) continue;
            const dx = posX[other] - yamatoRefX;
            const dy = posY[other] - yamatoRefY;
            const distSq = dx * dx + dy * dy;
            if (distSq < bestDist) {
              bestDist = distSq;
              bestTgt = other;
            }
          }
          if (bestTgt === 0) continue;
          atkLastTime[eid] = gameTime;
          hpCurrent[bestTgt] = Math.max(0, hpCurrent[bestTgt] - YAMATO_DAMAGE);
          // Emit a large orange-red projectile visual
          emitProjectile({
            fromX: posX[eid], fromY: posY[eid],
            toX: posX[bestTgt], toY: posY[bestTgt],
            unitType: UnitType.Battlecruiser,
            speed: 200,
            time: gameTime,
          });
          // Push a distinctive damage event so it's visible
          damageEvents.push({
            x: posX[bestTgt],
            y: posY[bestTgt],
            amount: YAMATO_DAMAGE,
            time: gameTime,
            color: 0xff6600,
          });
          addCommandPing(posX[bestTgt], posY[bestTgt], 0xff6600, gameTime);
          triggerCameraShake(8); // Yamato is the biggest gun — heavy shake
          soundManager.playYamato();
        }
        break;
      }

      case CommandType.CorrosiveBile: {
        if (!cmd.units) break;
        const BILE_COOLDOWN = 5; // seconds per-unit
        for (const eid of cmd.units) {
          if (unitType[eid] !== UnitType.Ravager) continue;
          if (hpCurrent[eid] <= 0) continue;
          // Use atkLastTime for cooldown tracking
          if (atkLastTime[eid] + BILE_COOLDOWN > gameTime) continue;
          atkLastTime[eid] = gameTime;
          bileLandTime[eid] = gameTime + 2; // 2s travel time
          bileLandX[eid] = cmd.wx!;
          bileLandY[eid] = cmd.wy!;
        }
        addCommandPing(cmd.wx!, cmd.wy!, 0x88ff00, gameTime);
        break;
      }

      case CommandType.KD8Charge: {
        if (!cmd.units) break;
        const KD8_RANGE_PX = KD8_RANGE * TILE_SIZE;
        const KD8_RANGE_SQ = KD8_RANGE_PX * KD8_RANGE_PX;
        for (const eid of cmd.units) {
          if (unitType[eid] !== UnitType.Reaper) continue;
          if (hpCurrent[eid] <= 0) continue;
          // Cooldown check
          if (atkLastTime[eid] + KD8_COOLDOWN > gameTime) continue;
          // Range check from caster to target location
          const dx = cmd.wx! - posX[eid];
          const dy = cmd.wy! - posY[eid];
          if (dx * dx + dy * dy > KD8_RANGE_SQ) continue;
          atkLastTime[eid] = gameTime;
          kd8LandTime[eid] = gameTime + KD8_DELAY;
          kd8LandX[eid] = cmd.wx!;
          kd8LandY[eid] = cmd.wy!;
        }
        addCommandPing(cmd.wx!, cmd.wy!, 0xff6622, gameTime);
        break;
      }

      case CommandType.FungalGrowth: {
        if (!cmd.units) break;
        const FUNGAL_ENERGY_COST = 100;
        const FUNGAL_COOLDOWN = 10; // seconds per-unit
        for (const eid of cmd.units) {
          if (unitType[eid] !== UnitType.Infestor) continue;
          if (hpCurrent[eid] <= 0) continue;
          if (energy[eid] < FUNGAL_ENERGY_COST) continue;
          if (atkLastTime[eid] + FUNGAL_COOLDOWN > gameTime) continue;
          energy[eid] -= FUNGAL_ENERGY_COST;
          atkLastTime[eid] = gameTime;
          fungalLandTime[eid] = gameTime + 1; // 1s travel time
          fungalLandX[eid] = cmd.wx!;
          fungalLandY[eid] = cmd.wy!;
        }
        addCommandPing(cmd.wx!, cmd.wy!, 0x00ff44, gameTime);
        break;
      }

      case CommandType.Abduct: {
        if (!cmd.units) break;
        const ABDUCT_RANGE = 9 * TILE_SIZE;
        const ABDUCT_ENERGY_COST = 75;
        const abductClickX = cmd.wx;
        const abductClickY = cmd.wy;
        for (const eid of cmd.units) {
          if (unitType[eid] !== UnitType.Viper) continue;
          if (hpCurrent[eid] <= 0) continue;
          if (energy[eid] < ABDUCT_ENERGY_COST) continue;
          // Find enemy nearest to click position within range
          const myFac = faction[eid];
          let tgt = 0;
          if (abductClickX !== undefined && abductClickY !== undefined) {
            let bestDist = Infinity;
            for (let other = 1; other < world.nextEid; other++) {
              if (!hasComponents(world, other, POSITION | HEALTH)) continue;
              if (faction[other] === myFac || faction[other] === 0) continue;
              if (hpCurrent[other] <= 0) continue;
              const dxR = posX[other] - posX[eid];
              const dyR = posY[other] - posY[eid];
              if (dxR * dxR + dyR * dyR > ABDUCT_RANGE * ABDUCT_RANGE) continue;
              const dx = posX[other] - abductClickX;
              const dy = posY[other] - abductClickY;
              const distSq = dx * dx + dy * dy;
              if (distSq < bestDist) { bestDist = distSq; tgt = other; }
            }
          } else {
            tgt = targetEntity[eid]; // fallback: use existing target
          }
          if (tgt < 1) continue;
          if (hpCurrent[tgt] <= 0) continue;
          const adx = posX[tgt] - posX[eid];
          const ady = posY[tgt] - posY[eid];
          if (adx * adx + ady * ady > ABDUCT_RANGE * ABDUCT_RANGE) continue;
          energy[eid] -= ABDUCT_ENERGY_COST;
          // Teleport target next to the Viper
          posX[tgt] = posX[eid] + 2 * TILE_SIZE;
          posY[tgt] = posY[eid];
          movePathIndex[tgt] = -1; // stop movement
          addCommandPing(posX[eid], posY[eid], 0xcc44ff, gameTime);
        }
        break;
      }

      case CommandType.EMP: {
        if (!cmd.units) break;
        const EMP_RANGE_PX = EMP_RANGE * TILE_SIZE;
        const EMP_RADIUS_PX = EMP_RADIUS * TILE_SIZE;
        const EMP_RADIUS_SQ = EMP_RADIUS_PX * EMP_RADIUS_PX;
        for (const eid of cmd.units) {
          if (unitType[eid] !== UnitType.Ghost) continue;
          if (hpCurrent[eid] <= 0) continue;
          if (energy[eid] < EMP_ENERGY_COST) continue;
          // Range check: cast location must be within cast range of the Ghost
          const dxR = cmd.wx! - posX[eid];
          const dyR = cmd.wy! - posY[eid];
          if (dxR * dxR + dyR * dyR > EMP_RANGE_PX * EMP_RANGE_PX) continue;
          energy[eid] -= EMP_ENERGY_COST;
          const myFac = faction[eid];
          // Drain energy from all enemy units in radius
          for (let other = 1; other < world.nextEid; other++) {
            if (!hasComponents(world, other, POSITION | HEALTH)) continue;
            if (faction[other] === myFac || faction[other] === 0) continue;
            if (hpCurrent[other] <= 0) continue;
            const dx = posX[other] - cmd.wx!;
            const dy = posY[other] - cmd.wy!;
            if (dx * dx + dy * dy <= EMP_RADIUS_SQ) {
              energy[other] = Math.max(0, energy[other] - EMP_ENERGY_DRAIN);
            }
          }
          addCommandPing(cmd.wx!, cmd.wy!, 0x00ccff, gameTime);
          break; // only one Ghost casts per command
        }
        break;
      }

      case CommandType.BlindingCloud: {
        if (!cmd.units) break;
        const BC_RANGE_PX = BLINDING_CLOUD_RANGE * TILE_SIZE;
        const BC_RADIUS_PX = BLINDING_CLOUD_RADIUS * TILE_SIZE;
        const BC_RADIUS_SQ = BC_RADIUS_PX * BC_RADIUS_PX;
        for (const eid of cmd.units) {
          if (unitType[eid] !== UnitType.Viper) continue;
          if (hpCurrent[eid] <= 0) continue;
          if (energy[eid] < BLINDING_CLOUD_COST) continue;
          // Range check: cast location must be within cast range of the Viper
          const dxR = cmd.wx! - posX[eid];
          const dyR = cmd.wy! - posY[eid];
          if (dxR * dxR + dyR * dyR > BC_RANGE_PX * BC_RANGE_PX) continue;
          energy[eid] -= BLINDING_CLOUD_COST;
          const myFac = faction[eid];
          // Apply blinding cloud debuff to all enemy GROUND units in radius
          for (let other = 1; other < world.nextEid; other++) {
            if (!hasComponents(world, other, POSITION | HEALTH)) continue;
            if (faction[other] === myFac || faction[other] === 0) continue;
            if (hpCurrent[other] <= 0) continue;
            if (isAir[other] === 1) continue; // ground only
            if (hasComponents(world, other, BUILDING)) continue; // not buildings
            const dx = posX[other] - cmd.wx!;
            const dy = posY[other] - cmd.wy!;
            if (dx * dx + dy * dy <= BC_RADIUS_SQ) {
              blindingCloudEndTime[other] = gameTime + BLINDING_CLOUD_DURATION;
            }
          }
          addCommandPing(cmd.wx!, cmd.wy!, 0x8844ff, gameTime);
          break; // only one Viper casts per command
        }
        break;
      }

      case CommandType.ParasiticBomb: {
        if (!cmd.units) break;
        const PB_RANGE_PX = PARASITIC_BOMB_RANGE * TILE_SIZE;
        const pbClickX = cmd.wx;
        const pbClickY = cmd.wy;
        for (const eid of cmd.units) {
          if (unitType[eid] !== UnitType.Viper) continue;
          if (hpCurrent[eid] <= 0) continue;
          if (energy[eid] < PARASITIC_BOMB_COST) continue;
          const myFac = faction[eid];
          // Find enemy AIR unit nearest to click position within cast range
          let bestTgt = 0;
          let bestDist = Infinity;
          for (let other = 1; other < world.nextEid; other++) {
            if (!hasComponents(world, other, POSITION | HEALTH)) continue;
            if (faction[other] === myFac || faction[other] === 0) continue;
            if (hpCurrent[other] <= 0) continue;
            if (isAir[other] !== 1) continue; // air only
            // Must be within cast range of the Viper
            const dxR = posX[other] - posX[eid];
            const dyR = posY[other] - posY[eid];
            if (dxR * dxR + dyR * dyR > PB_RANGE_PX * PB_RANGE_PX) continue;
            // Pick closest to click position
            const refX = pbClickX ?? posX[eid];
            const refY = pbClickY ?? posY[eid];
            const dx = posX[other] - refX;
            const dy = posY[other] - refY;
            const distSq = dx * dx + dy * dy;
            if (distSq < bestDist) {
              bestDist = distSq;
              bestTgt = other;
            }
          }
          if (bestTgt === 0) continue;
          energy[eid] -= PARASITIC_BOMB_COST;
          parasiticBombEndTime[bestTgt] = gameTime + PARASITIC_BOMB_DURATION;
          parasiticBombCasterFaction[bestTgt] = myFac;
          addCommandPing(posX[bestTgt], posY[bestTgt], 0xff4488, gameTime);
          break; // only one Viper casts per command
        }
        break;
      }

      case CommandType.ViperConsume: {
        if (!cmd.units) break;
        const CONSUME_RANGE_PX = VIPER_CONSUME_RANGE * TILE_SIZE;
        const consumeClickX = cmd.wx;
        const consumeClickY = cmd.wy;
        for (const eid of cmd.units) {
          if (unitType[eid] !== UnitType.Viper) continue;
          if (hpCurrent[eid] <= 0) continue;
          if (energy[eid] >= 200) continue; // already full energy
          const myFac = faction[eid];
          // Find friendly building nearest to click within range
          let bestTgt = 0;
          let bestDist = Infinity;
          for (let other = 1; other < world.nextEid; other++) {
            if (!hasComponents(world, other, POSITION | HEALTH | BUILDING)) continue;
            if (faction[other] !== myFac) continue;
            if (hpCurrent[other] <= 0) continue;
            if (hpCurrent[other] <= VIPER_CONSUME_HP_COST) continue; // building must survive
            const dxR = posX[other] - posX[eid];
            const dyR = posY[other] - posY[eid];
            if (dxR * dxR + dyR * dyR > CONSUME_RANGE_PX * CONSUME_RANGE_PX) continue;
            const refX = consumeClickX ?? posX[eid];
            const refY = consumeClickY ?? posY[eid];
            const dx = posX[other] - refX;
            const dy = posY[other] - refY;
            const distSq = dx * dx + dy * dy;
            if (distSq < bestDist) { bestDist = distSq; bestTgt = other; }
          }
          if (bestTgt === 0) continue;
          // Drain HP from building, restore energy to Viper
          hpCurrent[bestTgt] -= VIPER_CONSUME_HP_COST;
          energy[eid] = Math.min(200, energy[eid] + VIPER_CONSUME_ENERGY);
          addCommandPing(posX[bestTgt], posY[bestTgt], 0x66ff44, gameTime);
          break; // one Viper per command
        }
        break;
      }

      case CommandType.Snipe: {
        if (!cmd.units) break;
        const SNIPE_RANGE_PX = SNIPE_RANGE * TILE_SIZE;
        // If click position provided, find enemy nearest to click; else auto-target nearest to caster
        const snipeClickX = cmd.wx;
        const snipeClickY = cmd.wy;
        for (const eid of cmd.units) {
          if (unitType[eid] !== UnitType.Ghost) continue;
          if (hpCurrent[eid] <= 0) continue;
          if (energy[eid] < SNIPE_ENERGY_COST) continue;
          const myFac = faction[eid];
          let bestTgt = 0;
          let bestDist = Infinity;
          for (let other = 1; other < world.nextEid; other++) {
            if (!hasComponents(world, other, POSITION | UNIT_TYPE)) continue;
            if (faction[other] === myFac || faction[other] === 0) continue;
            if (hpCurrent[other] <= 0) continue;
            // SC2 LotV Steady Targeting hits all unit types (biological + mechanical)
            // Must be in range of the Ghost
            const dxR = posX[other] - posX[eid];
            const dyR = posY[other] - posY[eid];
            if (dxR * dxR + dyR * dyR > SNIPE_RANGE_PX * SNIPE_RANGE_PX) continue;
            // Pick closest to click position (or closest to caster if no click)
            const refX = snipeClickX ?? posX[eid];
            const refY = snipeClickY ?? posY[eid];
            const dx = posX[other] - refX;
            const dy = posY[other] - refY;
            const distSq = dx * dx + dy * dy;
            if (distSq < bestDist) {
              bestDist = distSq;
              bestTgt = other;
            }
          }
          if (bestTgt === 0) continue;
          energy[eid] -= SNIPE_ENERGY_COST;
          hpCurrent[bestTgt] = Math.max(0, hpCurrent[bestTgt] - SNIPE_DAMAGE);
          emitProjectile({
            fromX: posX[eid], fromY: posY[eid],
            toX: posX[bestTgt], toY: posY[bestTgt],
            unitType: UnitType.Ghost,
            speed: 400,
            time: gameTime,
          });
          damageEvents.push({
            x: posX[bestTgt],
            y: posY[bestTgt],
            amount: SNIPE_DAMAGE,
            time: gameTime,
            color: 0x00ccff,
          });
          addCommandPing(posX[bestTgt], posY[bestTgt], 0x00ccff, gameTime);
          soundManager.playSnipe();
        }
        break;
      }

      case CommandType.Transfuse: {
        if (!cmd.units) break;
        const TRANSFUSE_RANGE_PX = TRANSFUSE_RANGE * TILE_SIZE;
        const transClickX = cmd.wx;
        const transClickY = cmd.wy;
        for (const eid of cmd.units) {
          if (unitType[eid] !== UnitType.Queen) continue;
          if (hpCurrent[eid] <= 0) continue;
          if (energy[eid] < TRANSFUSE_ENERGY_COST) continue;
          const myFac = faction[eid];
          let bestTgt = 0;
          let bestDist = Infinity;
          for (let other = 1; other < world.nextEid; other++) {
            if (other === eid) continue;
            if (!hasComponents(world, other, POSITION | HEALTH)) continue;
            if (faction[other] !== myFac) continue;
            if (hpCurrent[other] <= 0) continue;
            if (hpCurrent[other] >= hpMax[other]) continue;
            const dxR = posX[other] - posX[eid];
            const dyR = posY[other] - posY[eid];
            if (dxR * dxR + dyR * dyR > TRANSFUSE_RANGE_PX * TRANSFUSE_RANGE_PX) continue;
            const refX = transClickX ?? posX[eid];
            const refY = transClickY ?? posY[eid];
            const dx = posX[other] - refX;
            const dy = posY[other] - refY;
            const distSq = dx * dx + dy * dy;
            if (distSq < bestDist) {
              bestDist = distSq;
              bestTgt = other;
            }
          }
          if (bestTgt === 0) continue;
          energy[eid] -= TRANSFUSE_ENERGY_COST;
          hpCurrent[bestTgt] = Math.min(hpMax[bestTgt], hpCurrent[bestTgt] + TRANSFUSE_HEAL);
          addCommandPing(posX[bestTgt], posY[bestTgt], 0x44ff44, gameTime);
          soundManager.playTransfuse();
        }
        break;
      }

      case CommandType.CausticSpray: {
        if (!cmd.units) break;
        const CAUSTIC_RANGE_PX = CAUSTIC_SPRAY_RANGE * TILE_SIZE;
        const sprayClickX = cmd.wx;
        const sprayClickY = cmd.wy;
        for (const eid of cmd.units) {
          if (unitType[eid] !== UnitType.Corruptor) continue;
          if (hpCurrent[eid] <= 0) continue;
          // Find enemy building nearest to click position within range
          const myFac = faction[eid];
          let bestTgt = 0;
          let bestDist = Infinity;
          for (let other = 1; other < world.nextEid; other++) {
            if (!hasComponents(world, other, POSITION | HEALTH | BUILDING)) continue;
            if (faction[other] === myFac || faction[other] === 0) continue;
            if (hpCurrent[other] <= 0) continue;
            // Must be in range of the Corruptor
            const dxR = posX[other] - posX[eid];
            const dyR = posY[other] - posY[eid];
            if (dxR * dxR + dyR * dyR > CAUSTIC_RANGE_PX * CAUSTIC_RANGE_PX) continue;
            // Pick closest to click position
            const refX = sprayClickX ?? posX[eid];
            const refY = sprayClickY ?? posY[eid];
            const dx = posX[other] - refX;
            const dy = posY[other] - refY;
            const distSq = dx * dx + dy * dy;
            if (distSq < bestDist) {
              bestDist = distSq;
              bestTgt = other;
            }
          }
          if (bestTgt === 0) continue;
          // Start channeling: set target, stop movement
          causticTarget[eid] = bestTgt;
          targetEntity[eid] = -1;
          commandMode[eid] = CommandMode.Idle;
          movePathIndex[eid] = -1;
          velX[eid] = 0;
          velY[eid] = 0;
          addCommandPing(posX[bestTgt], posY[bestTgt], 0x88ff22, gameTime);
        }
        break;
      }

      case CommandType.LockOn: {
        if (!cmd.units) break;
        const LOCKON_RANGE_PX = LOCKON_RANGE * TILE_SIZE;
        const lockOnClickX = cmd.wx;
        const lockOnClickY = cmd.wy;
        for (const eid of cmd.units) {
          if (unitType[eid] !== UnitType.Cyclone) continue;
          if (hpCurrent[eid] <= 0) continue;
          // Cooldown check (reuse atkLastTime)
          if (atkLastTime[eid] + LOCKON_COOLDOWN > gameTime) continue;
          // Already locked on? Skip
          if (lockOnTarget[eid] >= 0) continue;
          const myFac = faction[eid];
          let bestTgt = 0;
          let bestDist = Infinity;
          for (let other = 1; other < world.nextEid; other++) {
            if (!hasComponents(world, other, POSITION | UNIT_TYPE)) continue;
            if (faction[other] === myFac || faction[other] === 0) continue;
            if (hpCurrent[other] <= 0) continue;
            // Must be in activation range of the Cyclone
            const dxR = posX[other] - posX[eid];
            const dyR = posY[other] - posY[eid];
            if (dxR * dxR + dyR * dyR > LOCKON_RANGE_PX * LOCKON_RANGE_PX) continue;
            // Pick closest to click position
            const refX = lockOnClickX ?? posX[eid];
            const refY = lockOnClickY ?? posY[eid];
            const dx = posX[other] - refX;
            const dy = posY[other] - refY;
            const distSq = dx * dx + dy * dy;
            if (distSq < bestDist) {
              bestDist = distSq;
              bestTgt = other;
            }
          }
          if (bestTgt === 0) continue;
          lockOnTarget[eid] = bestTgt;
          lockOnEndTime[eid] = gameTime + LOCKON_DURATION;
          atkLastTime[eid] = gameTime; // set cooldown start
          addCommandPing(posX[bestTgt], posY[bestTgt], 0xff4444, gameTime);
          soundManager.playAttackAt(posX[eid], posY[eid]);
        }
        break;
      }

      case CommandType.NeuralParasite: {
        if (!cmd.units) break;
        const NP_RANGE_PX = NEURAL_PARASITE_RANGE * TILE_SIZE;
        const npClickX = cmd.wx;
        const npClickY = cmd.wy;
        for (const eid of cmd.units) {
          if (unitType[eid] !== UnitType.Infestor) continue;
          if (hpCurrent[eid] <= 0) continue;
          if (energy[eid] < NEURAL_PARASITE_COST) continue;
          // Already channeling? Skip
          if (neuralTarget[eid] >= 0) continue;
          const myFac = faction[eid];
          // Find enemy nearest to click position within cast range
          let bestTgt = 0;
          let bestDist = Infinity;
          for (let other = 1; other < world.nextEid; other++) {
            if (!hasComponents(world, other, POSITION | HEALTH)) continue;
            if (faction[other] === myFac || faction[other] === 0) continue;
            if (hpCurrent[other] <= 0) continue;
            // Must be within cast range of the Infestor
            const dxR = posX[other] - posX[eid];
            const dyR = posY[other] - posY[eid];
            if (dxR * dxR + dyR * dyR > NP_RANGE_PX * NP_RANGE_PX) continue;
            // Pick closest to click position
            const refX = npClickX ?? posX[eid];
            const refY = npClickY ?? posY[eid];
            const dx = posX[other] - refX;
            const dy = posY[other] - refY;
            const distSq = dx * dx + dy * dy;
            if (distSq < bestDist) {
              bestDist = distSq;
              bestTgt = other;
            }
          }
          if (bestTgt === 0) continue;
          // Start channel: deduct energy, set neural state, stop Infestor movement
          energy[eid] -= NEURAL_PARASITE_COST;
          neuralTarget[eid] = bestTgt;
          neuralEndTime[eid] = gameTime + NEURAL_PARASITE_DURATION;
          neuralStunEndTime[bestTgt] = gameTime + NEURAL_PARASITE_DURATION;
          // Stop Infestor movement (must remain stationary)
          targetEntity[eid] = -1;
          commandMode[eid] = CommandMode.Idle;
          movePathIndex[eid] = -1;
          velX[eid] = 0;
          velY[eid] = 0;
          addCommandPing(posX[bestTgt], posY[bestTgt], 0xcc44ff, gameTime);
          break; // only one Infestor casts per command
        }
        break;
      }

      case CommandType.DepotLower: {
        if (!cmd.units) break;
        for (const eid of cmd.units) {
          if (!hasComponents(world, eid, BUILDING)) continue;
          if (buildingType[eid] !== BuildingType.SupplyDepot) continue;
          if (buildState[eid] !== BuildState.Complete) continue;
          const tile = worldToTile(posX[eid], posY[eid]);
          const def = BUILDING_DEFS[BuildingType.SupplyDepot];
          if (depotLowered[eid] === 0) {
            // Lower the depot — make tiles walkable
            depotLowered[eid] = 1;
            clearBuildingTiles(map, tile.col, tile.row, def.tileWidth, def.tileHeight);
          } else {
            // Raise the depot — make tiles unwalkable
            depotLowered[eid] = 0;
            markBuildingTiles(map, tile.col, tile.row, def.tileWidth, def.tileHeight);
          }
        }
        break;
      }

      case CommandType.Cancel:
        if (resources) cancelSelectedBuildings(world, resources);
        break;

      case CommandType.Produce:
        if (resources) handleProductionCommand(world, cmd, resources);
        break;

      case CommandType.AttackMove: {
        const units = cmd.units ?? [];
        if (units.length === 0) break;
        // Check if clicking on an enemy
        const enemy = findEnemyAt(world, cmd.wx!, cmd.wy!, playerFaction);
        if (enemy > 0) {
          for (const eid of units) {
            targetEntity[eid] = enemy;
            commandMode[eid] = CommandMode.AttackTarget;
          }
        } else {
          issuePathCommand(world, units, cmd.wx!, cmd.wy!, map, CommandMode.AttackMove, cmd.shiftHeld ?? false);
        }
        addCommandPing(cmd.wx!, cmd.wy!, 0xff8844, gameTime);
        break;
      }

      case CommandType.Move: {
        // Right-click — CommandSystem reclassifies based on world state
        const units = cmd.units ?? [];
        const wx = cmd.wx!;
        const wy = cmd.wy!;

        // Set rally point for selected buildings
        const selectedBuildings = getSelectedBuildings(world);
        for (const eid of selectedBuildings) {
          rallyX[eid] = wx;
          rallyY[eid] = wy;
        }

        if (units.length === 0) break;

        // Check if right-clicking on a mineral patch
        const resource = findResourceAt(world, wx, wy);
        if (resource > 0 && resourceType[resource] === ResourceType.Mineral) {
          const workers: number[] = [];
          const nonWorkers: number[] = [];
          for (const eid of units) {
            const ut = unitType[eid] as UnitType;
            (ut === UnitType.SCV || ut === UnitType.Drone ? workers : nonWorkers).push(eid);
          }
          // Distribute workers evenly across nearby mineral patches (SC2 smart-gather)
          const nearbyMinerals = findNearbyMinerals(world, wx, wy, 12 * TILE_SIZE);
          const patches = nearbyMinerals.length > 0 ? nearbyMinerals : [resource];

          for (let wi = 0; wi < workers.length; wi++) {
            const eid = workers[wi];
            // Round-robin assignment: each worker gets the next least-saturated patch
            const patch = patches[wi % patches.length];
            workerTargetEid[eid] = patch;
            workerState[eid] = WorkerState.MovingToResource;
            commandMode[eid] = CommandMode.Gather;
            targetEntity[eid] = -1;
            const resTile = worldToTile(posX[patch], posY[patch]);
            const walkable = findNearestWalkableTile(map, resTile.col, resTile.row);
            if (walkable) {
              const startTile = worldToTile(posX[eid], posY[eid]);
              const tilePath = findPath(map, startTile.col, startTile.row, walkable.col, walkable.row);
              if (tilePath.length > 0) {
                setPath(eid, tilePath.map(([c, r]) => { const wp = tileToWorld(c, r); return [wp.x, wp.y] as [number, number]; }));
              }
            }
          }
          if (nonWorkers.length > 0) issuePathCommand(world, nonWorkers, wx, wy, map, CommandMode.Move);
          if (workers.length > 0) addCommandPing(wx, wy, 0x44bbff, gameTime);
          break;
        }

        // Check gas building (Refinery or Extractor)
        let refinery = findBuildingAt(world, wx, wy, BuildingType.Refinery);
        if (refinery <= 0) refinery = findBuildingAt(world, wx, wy, BuildingType.Extractor);
        if (refinery > 0 && resourceRemaining[refinery] > 0) {
          const workers: number[] = [];
          const nonWorkers: number[] = [];
          for (const eid of units) {
            const ut = unitType[eid] as UnitType;
            (ut === UnitType.SCV || ut === UnitType.Drone ? workers : nonWorkers).push(eid);
          }
          for (const eid of workers) {
            workerTargetEid[eid] = refinery;
            workerState[eid] = WorkerState.MovingToResource;
            commandMode[eid] = CommandMode.Gather;
            targetEntity[eid] = -1;
            const refTile = worldToTile(posX[refinery], posY[refinery]);
            const walkable = findNearestWalkableTile(map, refTile.col, refTile.row);
            if (walkable) {
              const startTile = worldToTile(posX[eid], posY[eid]);
              const tilePath = findPath(map, startTile.col, startTile.row, walkable.col, walkable.row);
              if (tilePath.length > 0) {
                setPath(eid, tilePath.map(([c, r]) => { const wp = tileToWorld(c, r); return [wp.x, wp.y] as [number, number]; }));
              }
            }
          }
          if (nonWorkers.length > 0) issuePathCommand(world, nonWorkers, wx, wy, map, CommandMode.Move);
          if (workers.length > 0) addCommandPing(wx, wy, 0x44ff66, gameTime);
          break;
        }

        // Check if right-clicking on a friendly building (SCV repair)
        const friendlyBuilding = findFriendlyBuildingAt(world, wx, wy, playerFaction);
        if (friendlyBuilding > 0 && hpCurrent[friendlyBuilding] < hpMax[friendlyBuilding]) {
          const scvs: number[] = [];
          const others: number[] = [];
          for (const eid of units) {
            (unitType[eid] === UnitType.SCV ? scvs : others).push(eid);
          }
          for (const eid of scvs) {
            workerTargetEid[eid] = friendlyBuilding;
            workerState[eid] = WorkerState.Repairing;
            commandMode[eid] = CommandMode.Gather;
            targetEntity[eid] = -1;
            const bldTile = worldToTile(posX[friendlyBuilding], posY[friendlyBuilding]);
            const walkable = findNearestWalkableTile(map, bldTile.col, bldTile.row);
            if (walkable) {
              const startTile = worldToTile(posX[eid], posY[eid]);
              const tilePath = findPath(map, startTile.col, startTile.row, walkable.col, walkable.row);
              if (tilePath.length > 0) {
                setPath(eid, tilePath.map(([c, r]) => { const wp = tileToWorld(c, r); return [wp.x, wp.y] as [number, number]; }));
              }
            }
          }
          if (others.length > 0) issuePathCommand(world, others, wx, wy, map, CommandMode.Move, cmd.shiftHeld ?? false);
          if (scvs.length > 0) addCommandPing(wx, wy, 0x44ff44, gameTime);
          break;
        }

        // Check if right-clicking on a friendly unit (Medivac heal-follow, SCV repair)
        const friendly = findFriendlyAt(world, wx, wy, playerFaction);
        if (friendly > 0) {
          const medivacs: number[] = [];
          const scvs: number[] = [];
          const others: number[] = [];
          for (const eid of units) {
            if (unitType[eid] === UnitType.Medivac) medivacs.push(eid);
            else if (unitType[eid] === UnitType.SCV) scvs.push(eid);
            else others.push(eid);
          }
          if (medivacs.length > 0) {
            issuePathCommand(world, medivacs, posX[friendly], posY[friendly], map, CommandMode.Move);
            addCommandPing(posX[friendly], posY[friendly], 0x00ffff, gameTime);
          }
          // SCV repair: target must be damaged and Terran faction (mechanical)
          if (scvs.length > 0 && hpCurrent[friendly] < hpMax[friendly] && faction[friendly] === Faction.Terran) {
            for (const eid of scvs) {
              workerTargetEid[eid] = friendly;
              workerState[eid] = WorkerState.Repairing;
              commandMode[eid] = CommandMode.Gather;
              targetEntity[eid] = -1;
            }
            issuePathCommand(world, scvs, posX[friendly], posY[friendly], map, CommandMode.Move);
            // Re-set worker state after issuePathCommand (it clears workerState to Idle)
            for (const eid of scvs) {
              workerState[eid] = WorkerState.Repairing;
              workerTargetEid[eid] = friendly;
              commandMode[eid] = CommandMode.Gather;
            }
            addCommandPing(posX[friendly], posY[friendly], 0x44ff44, gameTime);
          } else if (scvs.length > 0) {
            others.push(...scvs);
          }
          if (others.length > 0) {
            issuePathCommand(world, others, wx, wy, map, CommandMode.Move, cmd.shiftHeld ?? false);
            addCommandPing(wx, wy, cmd.shiftHeld ? 0xffff44 : 0x44ff44, gameTime);
          }
          break;
        }

        // Check enemy — set target and path the closest unit immediately; CombatSystem handles the rest
        const enemy = findEnemyAt(world, wx, wy, playerFaction);
        if (enemy > 0) {
          let firstPathed = false;
          for (const eid of units) {
            targetEntity[eid] = enemy;
            commandMode[eid] = CommandMode.AttackTarget;
            // Path only the first unit immediately; others chase via CombatSystem next tick
            if (!firstPathed) {
              const startTile = worldToTile(posX[eid], posY[eid]);
              const endTile = worldToTile(posX[enemy], posY[enemy]);
              const chasePath = findPath(map, startTile.col, startTile.row, endTile.col, endTile.row);
              if (chasePath.length > 0) {
                const wp = chasePath.map(([c, r]) => {
                  const p = tileToWorld(c, r);
                  return [p.x, p.y] as [number, number];
                });
                setPath(eid, wp);
              }
              firstPathed = true;
            } else {
              movePathIndex[eid] = -1;
            }
          }
          addCommandPing(wx, wy, 0xff4444, gameTime);
          break;
        }

        // Plain move
        issuePathCommand(world, units, wx, wy, map, CommandMode.Move, cmd.shiftHeld ?? false);
        addCommandPing(wx, wy, cmd.shiftHeld ? 0xffff44 : 0x44ff44, gameTime);
        if (units.length > 0) soundManager.playVoiceLine(unitType[units[0]], 'command');
        break;
      }
    }
  }
}

function applyStim(world: World, units: number[], gameTime: number): void {
  for (const eid of units) {
    const ut = unitType[eid] as UnitType;
    if (ut !== UnitType.Marine && ut !== UnitType.Marauder) continue;

    // Already stimmed — just refresh duration
    if (stimEndTime[eid] > gameTime) {
      stimEndTime[eid] = gameTime + STIM_DURATION;
      continue;
    }

    const hpCost = ut === UnitType.Marauder ? STIM_HP_COST_MARAUDER : STIM_HP_COST;

    // Can't stim if it would kill the unit
    if (hpCurrent[eid] <= hpCost) continue;

    // Apply stim
    hpCurrent[eid] -= hpCost;
    stimEndTime[eid] = gameTime + STIM_DURATION;

    const def = UNIT_DEFS[unitType[eid]];
    if (def) {
      moveSpeed[eid] = def.speed * TILE_SIZE * STIM_SPEED_MULT;
      atkCooldown[eid] = def.attackCooldown * STIM_COOLDOWN_MULT;
    }
  }
}

function toggleSiegeMode(world: World, units: number[], gameTime: number): void {
  for (const eid of units) {
    if (unitType[eid] !== UnitType.SiegeTank) continue;

    const mode = siegeMode[eid] as SiegeMode;

    // Can't interrupt a transition
    if (mode === SiegeMode.Packing || mode === SiegeMode.Unpacking) continue;

    if (mode === SiegeMode.Mobile) {
      // Start unpacking → will become Sieged
      siegeMode[eid] = SiegeMode.Unpacking;
      siegeTransitionEnd[eid] = gameTime + SIEGE_PACK_TIME;
      movePathIndex[eid] = -1; // Stop movement
    } else {
      // Sieged → start packing → will become Mobile
      siegeMode[eid] = SiegeMode.Packing;
      siegeTransitionEnd[eid] = gameTime + SIEGE_PACK_TIME;
    }
  }
}

export function vikingTransform(world: World, units: number[]): void {
  for (const eid of units) {
    if (unitType[eid] !== UnitType.Viking) continue;
    if (hpCurrent[eid] <= 0) continue;

    if (isAir[eid] === 1) {
      // Fighter (air) → Assault (ground)
      isAir[eid] = 0;
      canTargetGround[eid] = 1;
      canTargetAir[eid] = 0;
      atkRange[eid] = 6 * TILE_SIZE;
      atkDamage[eid] = 12;
      bonusDmg[eid] = 0;
      bonusVsTag[eid] = -1;
    } else {
      // Assault (ground) → Fighter (air)
      isAir[eid] = 1;
      canTargetGround[eid] = 0;
      canTargetAir[eid] = 1;
      atkRange[eid] = 9 * TILE_SIZE;
      atkDamage[eid] = 20;
      bonusDmg[eid] = 8;
      bonusVsTag[eid] = ArmorClass.Armored;
    }
  }
}

/** Toggle Hellion ↔ Hellbat transformation */
function hellionTransform(units: number[]): void {
  for (const eid of units) {
    if (unitType[eid] !== UnitType.Hellion) continue;
    if (hpCurrent[eid] <= 0) continue;

    if (hellbatMode[eid] === 0) {
      // Hellion → Hellbat (melee mode)
      hellbatMode[eid] = 1;
      const hpRatio = hpCurrent[eid] / hpMax[eid];
      hpMax[eid] = 135;
      hpCurrent[eid] = Math.min(135, Math.round(hpRatio * 135));
      atkDamage[eid] = 18;
      atkRange[eid] = 0.5 * TILE_SIZE;
      moveSpeed[eid] = 3.15 * TILE_SIZE;
      atkSplash[eid] = 1.0;
      bonusDmg[eid] = 12;
      renderWidth[eid] = 20;
      renderHeight[eid] = 16;
    } else {
      // Hellbat → Hellion (ranged mode)
      hellbatMode[eid] = 0;
      const hpRatio = hpCurrent[eid] / hpMax[eid];
      hpMax[eid] = 90;
      hpCurrent[eid] = Math.min(90, Math.round(hpRatio * 90));
      atkDamage[eid] = 8;
      atkRange[eid] = 5 * TILE_SIZE;
      moveSpeed[eid] = 5.95 * TILE_SIZE;
      atkSplash[eid] = 1.5;
      bonusDmg[eid] = 6;
      renderWidth[eid] = 16;
      renderHeight[eid] = 12;
    }
  }
}

/** Toggle Thor anti-air mode: Javelin Missiles (0) ↔ Explosive Payload (1) */
function thorModeSwitch(units: number[]): void {
  for (const eid of units) {
    if (unitType[eid] !== UnitType.Thor) continue;
    if (hpCurrent[eid] <= 0) continue;
    thorMode[eid] = thorMode[eid] === 0 ? 1 : 0;
  }
}

function stopUnits(world: World, units: number[]): void {
  for (const eid of units) {
    targetEntity[eid] = -1;
    commandMode[eid] = CommandMode.Idle;
    moveTargetX[eid] = -1;
    moveTargetY[eid] = -1;
    movePathIndex[eid] = -1;
    workerState[eid] = WorkerState.Idle;
    workerTargetEid[eid] = -1;
    causticTarget[eid] = -1;
  }
}

function holdUnits(world: World, units: number[]): void {
  for (const eid of units) {
    targetEntity[eid] = -1;
    commandMode[eid] = CommandMode.HoldPosition;
    movePathIndex[eid] = -1;
    velX[eid] = 0;
    velY[eid] = 0;
    workerState[eid] = WorkerState.Idle;
    workerTargetEid[eid] = -1;
    causticTarget[eid] = -1;
  }
}

function getSelectedBuildings(world: World): number[] {
  const buildings: number[] = [];
  const bits = SELECTABLE | POSITION | BUILDING;
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (selected[eid] !== 1) continue;
    if (buildState[eid] !== BuildState.Complete) continue;
    buildings.push(eid);
  }
  return buildings;
}

/** Tech building required before a unit can be trained */
const UNIT_TECH_REQS: Partial<Record<number, number>> = {
  [UnitType.Zergling]:  BuildingType.SpawningPool,
  [UnitType.Queen]:     BuildingType.SpawningPool,
  [UnitType.Baneling]:  BuildingType.SpawningPool,
  [UnitType.Roach]:     BuildingType.RoachWarren,
  [UnitType.Ravager]:   BuildingType.RoachWarren,
  [UnitType.Hydralisk]: BuildingType.HydraliskDen,
  [UnitType.Lurker]:    BuildingType.HydraliskDen,
  [UnitType.Mutalisk]:  BuildingType.Spire,
  [UnitType.Corruptor]: BuildingType.Spire,
  [UnitType.Infestor]:  BuildingType.InfestationPit,
  [UnitType.Viper]:     BuildingType.InfestationPit,
  [UnitType.Ultralisk]: BuildingType.InfestationPit,
};

function handleProductionCommand(
  world: World,
  cmd: GameCommand,
  resources: Record<number, PlayerResources>,
): void {
  const buildings = getSelectedBuildings(world);
  if (buildings.length === 0) return;

  const slotIndex = cmd.data ?? 0;

  for (const eid of buildings) {
    // Check if queue is full (current production + queue items)
    const qLen = prodQueueLen[eid];
    const totalQueued = (prodUnitType[eid] !== 0 ? 1 : 0) + qLen;
    if (totalQueued >= PROD_QUEUE_MAX) continue; // Queue full

    const bDef = BUILDING_DEFS[buildingType[eid]];
    if (!bDef || slotIndex >= bDef.produces.length) continue;

    const uType = bDef.produces[slotIndex];
    const uDef = UNIT_DEFS[uType];
    if (!uDef) continue;

    const fac = faction[eid];
    const res = resources[fac];
    if (!res) continue;

    // Check tech requirement
    const techReq = UNIT_TECH_REQS[uType];
    if (techReq !== undefined && !hasCompletedBuilding(world, fac as Faction, techReq as BuildingType)) continue;

    // Check resources
    if (res.minerals < uDef.costMinerals || res.gas < uDef.costGas) continue;

    // Check supply
    if (uDef.supply > 0 && res.supplyUsed + uDef.supply > res.supplyProvided) continue;

    // Deduct cost
    res.minerals -= uDef.costMinerals;
    res.gas -= uDef.costGas;

    // Zerg Hatchery/Lair/Hive: check larva availability
    if (isHatchType(buildingType[eid]) && larvaCount[eid] <= 0) continue;

    // If nothing is currently producing, start immediately
    if (prodUnitType[eid] === 0) {
      // Consume larva for Zerg
      if (isHatchType(buildingType[eid])) {
        larvaCount[eid]--;
        if (larvaRegenTimer[eid] <= 0 && larvaCount[eid] < LARVA_MAX) {
          larvaRegenTimer[eid] = LARVA_REGEN_TIME;
        }
      }
      prodUnitType[eid] = uType;
      prodProgress[eid] = uDef.buildTime;
      prodTimeTotal[eid] = uDef.buildTime;
    } else {
      // Add to queue
      const qBase = eid * PROD_QUEUE_MAX;
      prodQueue[qBase + qLen] = uType;
      prodQueueLen[eid] = qLen + 1;
    }
    break; // Only queue on the first available building
  }
}

/** Cancel selected buildings under construction — refund 75% of cost, destroy the building */
function cancelSelectedBuildings(world: World, resources: Record<number, PlayerResources>): void {
  const bits = SELECTABLE | POSITION | BUILDING;
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (selected[eid] !== 1) continue;
    if (buildState[eid] !== BuildState.UnderConstruction) continue;

    const fac = faction[eid];
    const res = resources[fac];
    const bDef = BUILDING_DEFS[buildingType[eid]];

    // Refund 75% of mineral/gas cost
    if (res && bDef) {
      res.minerals += Math.floor(bDef.costMinerals * 0.75);
      res.gas += Math.floor(bDef.costGas * 0.75);
    }

    // Kill the building (DeathSystem will clean up tiles, release builder)
    hpCurrent[eid] = 0;
  }
}

export function issuePathCommand(
  world: World,
  units: number[],
  tx: number,
  ty: number,
  map: MapData,
  mode: CommandMode,
  shiftQueue: boolean = false,
): void {
  if (units.length === 0) return;

  // Compute relative position offsets from lead unit (SC2-style position preservation)
  const leadEidForOffset = units[0];

  // No group speed restriction — each unit moves at its own speed

  // Calculate ONE lead path from the first unit to destination
  const leadEid = units[0];
  const leadStart = worldToTile(posX[leadEid], posY[leadEid]);
  let mainEndTile = worldToTile(tx, ty);
  if (mainEndTile.col >= 0 && mainEndTile.col < map.cols && mainEndTile.row >= 0 && mainEndTile.row < map.rows) {
    if (map.walkable[mainEndTile.row * map.cols + mainEndTile.col] !== 1) {
      const walkable = findNearestWalkableTile(map, mainEndTile.col, mainEndTile.row);
      if (walkable) mainEndTile = walkable;
    }
  }

  const leadTilePath = findPath(map, leadStart.col, leadStart.row, mainEndTile.col, mainEndTile.row);
  if (leadTilePath.length === 0 && units.length > 0) {
    // No path found — still set mode and clear state for all units
    for (const eid of units) {
      if (!shiftQueue) {
        targetEntity[eid] = -1;
        commandMode[eid] = mode;
        velX[eid] = 0;
        velY[eid] = 0;
        workerState[eid] = WorkerState.Idle;
        workerTargetEid[eid] = -1;
      }
    }
    return;
  }

  // Convert lead path to world coordinates and simplify (remove collinear waypoints)
  const rawWorldPath: Array<[number, number]> = leadTilePath.map(([c, r]) => {
    const wp = tileToWorld(c, r);
    return [wp.x, wp.y] as [number, number];
  });
  const leadWorldPath = simplifyPath(rawWorldPath);

  for (let i = 0; i < units.length; i++) {
    const eid = units[i];

    if (siegeMode[eid] === SiegeMode.Sieged || siegeMode[eid] === SiegeMode.Packing || siegeMode[eid] === SiegeMode.Unpacking) {
      continue;
    }

    // Compact formation: units converge toward destination in a tight cluster
    // Use relative positions but compress aggressively so group arrives together
    let offsetX = posX[eid] - posX[leadEidForOffset];
    let offsetY = posY[eid] - posY[leadEidForOffset];
    const offsetDist = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
    // Scale spread with group size: small groups (2 tiles), larger groups wider (4 tiles)
    const maxSpread = Math.min(4, 1.5 + units.length / 15) * TILE_SIZE;
    if (offsetDist > 0) {
      const scale = Math.min(1, maxSpread / offsetDist);
      offsetX *= scale;
      offsetY *= scale;
    }

    // Every unit paths individually from its own position to its offset destination
    let unitPath: Array<[number, number]>;
    const unitStart = worldToTile(posX[eid], posY[eid]);
    const destX = tx + offsetX;
    const destY = ty + offsetY;
    let unitEnd = worldToTile(destX, destY);
    // Ensure destination is walkable
    if (unitEnd.col >= 0 && unitEnd.col < map.cols && unitEnd.row >= 0 && unitEnd.row < map.rows) {
      if (map.walkable[unitEnd.row * map.cols + unitEnd.col] !== 1) {
        const wk = findNearestWalkableTile(map, unitEnd.col, unitEnd.row);
        if (wk) unitEnd = wk;
      }
    }
    const indivPath = (unitStart.col === unitEnd.col && unitStart.row === unitEnd.row)
      ? [[unitEnd.col, unitEnd.row] as [number, number]]
      : findPath(map, unitStart.col, unitStart.row, unitEnd.col, unitEnd.row);
    if (indivPath.length > 0) {
      unitPath = simplifyPath(indivPath.map(([c, r]) => {
        const wp = tileToWorld(c, r);
        return [wp.x, wp.y] as [number, number];
      }));
    } else {
      // Fallback: direct line to destination (stuck detection will repath if needed)
      unitPath = [[destX, destY] as [number, number]];
    }

    // Verify final waypoint is walkable; snap to nearest walkable if not
    if (unitPath.length > 0) {
      const lastIdx = unitPath.length - 1;
      const [lastX, lastY] = unitPath[lastIdx];
      const lastTile = worldToTile(lastX, lastY);
      if (lastTile.col >= 0 && lastTile.col < map.cols && lastTile.row >= 0 && lastTile.row < map.rows) {
        if (map.walkable[lastTile.row * map.cols + lastTile.col] !== 1) {
          const wk = findNearestWalkableTile(map, lastTile.col, lastTile.row);
          if (wk) {
            const wp = tileToWorld(wk.col, wk.row);
            unitPath[lastIdx] = [wp.x, wp.y];
          }
        }
      }
    }

    if (shiftQueue) {
      appendPath(eid, unitPath);
    } else {
      setPath(eid, unitPath);
    }

    moveTargetX[eid] = tx + offsetX;
    moveTargetY[eid] = ty + offsetY;
    if (!shiftQueue) {
      targetEntity[eid] = -1;
      commandMode[eid] = mode;
      velX[eid] = 0;
      velY[eid] = 0;
      workerState[eid] = WorkerState.Idle;
      workerTargetEid[eid] = -1;
      causticTarget[eid] = -1;
    }
  }
}
