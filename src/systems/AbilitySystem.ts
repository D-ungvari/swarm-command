import { type World, hasComponents } from '../ecs/world';
import {
  POSITION, HEALTH, ABILITY, UNIT_TYPE, BUILDING,
  posX, posY, hpCurrent, hpMax, faction, unitType,
  moveSpeed, atkCooldown, atkDamage, atkRange, atkSplash, atkMinRange, atkLastTime,
  stimEndTime, slowEndTime, slowFactor,
  siegeMode, siegeTransitionEnd,
  lastCombatTime, movePathIndex,
  energy, cloaked, burrowed, commandMode,
  injectTimer, buildingType, buildState,
  bileLandTime, bileLandX, bileLandY,
  fungalLandTime, fungalLandX, fungalLandY,
  kd8LandTime, kd8LandX, kd8LandY,
  bonusDmg, bonusVsTag,
  causticTarget,
  lockOnTarget, lockOnEndTime,
  isAir,
  parasiticBombEndTime, parasiticBombCasterFaction,
  neuralTarget, neuralEndTime, neuralStunEndTime,
  boostEndTime, boostCooldownEnd,
} from '../ecs/components';
import { entityExists } from '../ecs/world';
import { UNIT_DEFS } from '../data/units';
import {
  UnitType, Faction, SiegeMode, CommandMode, TILE_SIZE,
  STIM_SPEED_MULT, STIM_COOLDOWN_MULT,
  SIEGE_DAMAGE, SIEGE_RANGE, SIEGE_SPLASH, SIEGE_BONUS_DAMAGE, SIEGE_COOLDOWN, SIEGE_MIN_RANGE, ArmorClass,
  MEDIVAC_HEAL_RATE, MEDIVAC_HEAL_RANGE, MEDIVAC_BOOST_DURATION, MEDIVAC_BOOST_COOLDOWN,
  ROACH_REGEN_COMBAT, ROACH_REGEN_IDLE, ROACH_COMBAT_TIMEOUT,
  REAPER_REGEN_RATE, REAPER_REGEN_TIMEOUT,
  QUEEN_ENERGY_MAX, QUEEN_ENERGY_REGEN,
  INJECT_LARVA_COST, INJECT_LARVA_TIME,
  BuildingType, BuildState, isHatchType,
  CAUSTIC_SPRAY_DPS, CAUSTIC_SPRAY_RANGE,
  LOCKON_TOTAL_DAMAGE, LOCKON_DURATION, LOCKON_BREAK_RANGE,
  PARASITIC_BOMB_RADIUS, PARASITIC_BOMB_DPS,
  KD8_DAMAGE, KD8_RADIUS,
  NEURAL_PARASITE_RANGE,
} from '../constants';
import { soundManager } from '../audio/SoundManager';
import { triggerCameraShake } from '../rendering/CameraShake';
import { spatialHash } from '../ecs/SpatialHash';
import { emitProjectile } from '../rendering/ProjectileRenderer';
import { damageEvents } from './CombatSystem';

/**
 * Processes all unit abilities each tick.
 * Runs after CombatSystem and before DeathSystem.
 */
export function abilitySystem(world: World, dt: number, gameTime: number): void {
  processStimExpiry(world, gameTime);
  processSlowExpiry(world, gameTime);
  processSiegeTransitions(world, gameTime);
  processMedivacHeal(world, dt);
  processRoachRegen(world, dt, gameTime);
  processReaperRegen(world, dt, gameTime);
  processGhostCloak(world, dt);
  processQueenEnergyRegen(world, dt);
  processWidowMineBurrow(world);
  processWidowMineSentinel(world, gameTime);
  processInfestorEnergyRegen(world, dt);
  processViperEnergyRegen(world, dt);
  processCorrosiveBile(world, gameTime);
  processKD8Charge(world, gameTime);
  processFungalGrowth(world, gameTime);
  processCausticSpray(world, dt, gameTime);
  processLockOn(world, dt, gameTime);
  processParasiticBomb(world, dt, gameTime);
  processNeuralParasite(world, gameTime);
  processBoostExpiry(world, gameTime);
}

/** Medivac Boost: clear boost when it expires */
function processBoostExpiry(world: World, gameTime: number): void {
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (boostEndTime[eid] <= 0) continue;
    if (gameTime >= boostEndTime[eid]) {
      boostEndTime[eid] = 0;
    }
  }
}

/** Activate Medivac Boost for given units */
export function activateMedivacBoost(units: number[], gameTime: number): void {
  for (const eid of units) {
    if (unitType[eid] !== UnitType.Medivac) continue;
    if (hpCurrent[eid] <= 0) continue;
    if (boostEndTime[eid] > 0) continue; // already boosting
    if (boostCooldownEnd[eid] > gameTime) continue; // on cooldown
    boostEndTime[eid] = gameTime + MEDIVAC_BOOST_DURATION;
    boostCooldownEnd[eid] = gameTime + MEDIVAC_BOOST_COOLDOWN;
  }
}

function processGhostCloak(world: World, dt: number): void {
  const bits = ABILITY | UNIT_TYPE;
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (unitType[eid] !== UnitType.Ghost) continue;
    if (hpCurrent[eid] <= 0) continue;

    // Regenerate energy when not cloaked (0.7875/s)
    if (cloaked[eid] === 0 && energy[eid] < 200) {
      energy[eid] = Math.min(200, energy[eid] + dt * 0.7875);
    }

    // Drain energy while cloaked (0.9/s)
    if (cloaked[eid] === 1) {
      energy[eid] = Math.max(0, energy[eid] - dt * 0.9);
      if (energy[eid] <= 0) {
        cloaked[eid] = 0; // auto-uncloak
      }
    }
  }
}

function processStimExpiry(world: World, gameTime: number): void {
  const bits = ABILITY | UNIT_TYPE;
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (stimEndTime[eid] <= 0) continue;
    if (gameTime < stimEndTime[eid]) continue;

    // Stim expired — restore original stats
    stimEndTime[eid] = 0;
    const def = UNIT_DEFS[unitType[eid]];
    if (def) {
      moveSpeed[eid] = def.speed * TILE_SIZE;
      atkCooldown[eid] = def.attackCooldown;
    }
  }
}

function processSlowExpiry(world: World, gameTime: number): void {
  const bits = ABILITY;
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (slowEndTime[eid] <= 0) continue;
    if (gameTime < slowEndTime[eid]) continue;

    slowEndTime[eid] = 0;
    slowFactor[eid] = 0;
  }
}

function processSiegeTransitions(world: World, gameTime: number): void {
  const bits = ABILITY | UNIT_TYPE;
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (unitType[eid] !== UnitType.SiegeTank) continue;

    const mode = siegeMode[eid] as SiegeMode;
    if (mode !== SiegeMode.Packing && mode !== SiegeMode.Unpacking) continue;
    if (gameTime < siegeTransitionEnd[eid]) continue;

    if (mode === SiegeMode.Unpacking) {
      // Transition complete → Sieged
      siegeMode[eid] = SiegeMode.Sieged;
      atkDamage[eid] = SIEGE_DAMAGE;
      atkRange[eid] = SIEGE_RANGE * TILE_SIZE;
      atkSplash[eid] = SIEGE_SPLASH;
      bonusDmg[eid] = SIEGE_BONUS_DAMAGE;
      bonusVsTag[eid] = ArmorClass.Armored;
      atkCooldown[eid] = SIEGE_COOLDOWN;
      atkMinRange[eid] = SIEGE_MIN_RANGE * TILE_SIZE;
    } else {
      // Packing complete → Mobile
      siegeMode[eid] = SiegeMode.Mobile;
      const def = UNIT_DEFS[unitType[eid]];
      if (def) {
        atkDamage[eid] = def.damage;
        atkRange[eid] = def.range * TILE_SIZE;
        atkSplash[eid] = def.splashRadius;
        bonusDmg[eid] = def.bonusDamage;
        bonusVsTag[eid] = def.bonusVsTag;
        atkCooldown[eid] = def.attackCooldown;
        atkMinRange[eid] = 0;
      }
    }
  }
}

function processMedivacHeal(world: World, dt: number): void {
  const healRangePx = MEDIVAC_HEAL_RANGE * TILE_SIZE;
  const healRangeSq = healRangePx * healRangePx;
  const healAmount = MEDIVAC_HEAL_RATE * dt;

  const bits = POSITION | ABILITY | UNIT_TYPE | HEALTH;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (unitType[eid] !== UnitType.Medivac) continue;
    if (hpCurrent[eid] <= 0) continue;

    const mx = posX[eid];
    const my = posY[eid];
    const myFac = faction[eid];

    // Scan for nearby wounded bio allies
    for (let other = 1; other < world.nextEid; other++) {
      if (other === eid) continue;
      if (!hasComponents(world, other, POSITION | HEALTH | UNIT_TYPE)) continue;
      if (faction[other] !== myFac) continue;
      if (hpCurrent[other] <= 0) continue;
      if (hpCurrent[other] >= hpMax[other]) continue;

      // Only heal biological units (Marine, Marauder, SCV, Ghost, Reaper)
      const ut = unitType[other] as UnitType;
      if (ut !== UnitType.Marine && ut !== UnitType.Marauder && ut !== UnitType.SCV
        && ut !== UnitType.Ghost && ut !== UnitType.Reaper) continue;

      const dx = posX[other] - mx;
      const dy = posY[other] - my;
      if (dx * dx + dy * dy > healRangeSq) continue;

      hpCurrent[other] = Math.min(hpMax[other], hpCurrent[other] + healAmount);
    }
  }
}

function processRoachRegen(world: World, dt: number, gameTime: number): void {
  const bits = ABILITY | UNIT_TYPE | HEALTH;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (unitType[eid] !== UnitType.Roach) continue;
    if (hpCurrent[eid] <= 0) continue;
    if (hpCurrent[eid] >= hpMax[eid]) continue;

    const isInCombat = gameTime - lastCombatTime[eid] < ROACH_COMBAT_TIMEOUT;
    // SC2: fast regen (7 HP/s) only while burrowed; combat regen always active
    const rate = isInCombat ? ROACH_REGEN_COMBAT : (burrowed[eid] === 1 ? ROACH_REGEN_IDLE : ROACH_REGEN_COMBAT);
    hpCurrent[eid] = Math.min(hpMax[eid], hpCurrent[eid] + rate * dt);
  }
}

function processReaperRegen(world: World, dt: number, gameTime: number): void {
  const bits = ABILITY | UNIT_TYPE | HEALTH;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (unitType[eid] !== UnitType.Reaper) continue;
    if (hpCurrent[eid] <= 0) continue;
    if (hpCurrent[eid] >= hpMax[eid]) continue;

    const isInCombat = gameTime - lastCombatTime[eid] < REAPER_REGEN_TIMEOUT;
    if (isInCombat) continue;
    hpCurrent[eid] = Math.min(hpMax[eid], hpCurrent[eid] + REAPER_REGEN_RATE * dt);
  }
}

function processQueenEnergyRegen(world: World, dt: number): void {
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, ABILITY)) continue;
    if (unitType[eid] !== UnitType.Queen) continue;
    if (hpCurrent[eid] <= 0) continue;
    if (energy[eid] < QUEEN_ENERGY_MAX) {
      energy[eid] = Math.min(QUEEN_ENERGY_MAX, energy[eid] + QUEEN_ENERGY_REGEN * dt);
    }
  }
}

function processWidowMineBurrow(world: World): void {
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (unitType[eid] !== UnitType.WidowMine && unitType[eid] !== UnitType.Lurker) continue;
    if (hpCurrent[eid] <= 0) continue;
    if (commandMode[eid] === CommandMode.Idle && movePathIndex[eid] < 0) {
      burrowed[eid] = 1;
      cloaked[eid] = 1; // burrowed units are also cloaked
    } else {
      burrowed[eid] = 0;
      cloaked[eid] = 0;
    }
  }
}

/** Widow Mine Sentinel Missile: auto-fires at nearest enemy while burrowed, 29s cooldown */
function processWidowMineSentinel(world: World, gameTime: number): void {
  const SENTINEL_DAMAGE = 125;
  const SENTINEL_RANGE = 5 * TILE_SIZE;       // 5 tiles in pixels
  const SENTINEL_SPLASH = 2.0 * TILE_SIZE;    // 2 tile splash radius in pixels
  const SENTINEL_COOLDOWN = 29.0;             // seconds
  const SENTINEL_PROJ_SPEED = 400;            // px/s for visual

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (unitType[eid] !== UnitType.WidowMine) continue;
    if (hpCurrent[eid] <= 0) continue;
    if (burrowed[eid] === 0) continue;

    // Cooldown check (atkLastTime stores gameTime of last fire)
    if (gameTime - atkLastTime[eid] < SENTINEL_COOLDOWN) continue;

    const mx = posX[eid];
    const my = posY[eid];
    const myFac = faction[eid];

    // Find nearest enemy within range using spatial hash
    spatialHash.ensureBuilt(world);
    const candidates = spatialHash.queryRadius(mx, my, SENTINEL_RANGE);

    let nearestEid = 0;
    let nearestDistSq = Infinity;
    const rangeSq = SENTINEL_RANGE * SENTINEL_RANGE;

    for (const other of candidates) {
      if (faction[other] === myFac || faction[other] === 0) continue;
      if (hpCurrent[other] <= 0) continue;
      const dx = posX[other] - mx;
      const dy = posY[other] - my;
      const distSq = dx * dx + dy * dy;
      if (distSq <= rangeSq && distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearestEid = other;
      }
    }

    if (nearestEid === 0) continue;

    // Fire sentinel missile — set cooldown
    atkLastTime[eid] = gameTime;

    // Deal 125 raw damage to primary target
    hpCurrent[nearestEid] = Math.max(0, hpCurrent[nearestEid] - SENTINEL_DAMAGE);

    // Push damage event for floating indicator
    const victimFac = faction[nearestEid] as Faction;
    const dmgColor = victimFac === Faction.Terran ? 0xff4444 : 0xaaddff;
    if (damageEvents.length < 64) {
      damageEvents.push({
        x: posX[nearestEid],
        y: posY[nearestEid],
        amount: SENTINEL_DAMAGE,
        time: gameTime,
        color: dmgColor,
      });
    }

    // Splash: deal 125 raw damage to ALL units within 2.0 tiles (SC2: friendly fire enabled)
    const splashSq = SENTINEL_SPLASH * SENTINEL_SPLASH;
    const splashCandidates = spatialHash.queryRadius(posX[nearestEid], posY[nearestEid], SENTINEL_SPLASH);
    for (const other of splashCandidates) {
      if (other === nearestEid) continue;
      if (other === eid) continue; // don't damage self (the mine)
      if (faction[other] === 0) continue;
      if (hpCurrent[other] <= 0) continue;
      const sdx = posX[other] - posX[nearestEid];
      const sdy = posY[other] - posY[nearestEid];
      if (sdx * sdx + sdy * sdy <= splashSq) {
        hpCurrent[other] = Math.max(0, hpCurrent[other] - SENTINEL_DAMAGE);
        if (damageEvents.length < 64) {
          const splashFac = faction[other] as Faction;
          const splashColor = splashFac === Faction.Terran ? 0xff4444 : 0xaaddff;
          damageEvents.push({
            x: posX[other],
            y: posY[other],
            amount: SENTINEL_DAMAGE,
            time: gameTime,
            color: splashColor,
          });
        }
      }
    }

    // Emit projectile visual
    emitProjectile({
      fromX: mx, fromY: my,
      toX: posX[nearestEid], toY: posY[nearestEid],
      unitType: UnitType.WidowMine,
      speed: SENTINEL_PROJ_SPEED,
      time: gameTime,
    });

    // Sound + camera shake
    soundManager.playAttackAt(mx, my);
    triggerCameraShake(4); // Medium shake for sentinel missile
  }
}

function processInfestorEnergyRegen(world: World, dt: number): void {
  const INFESTOR_ENERGY_MAX = 200;
  const INFESTOR_ENERGY_REGEN = 0.5625; // per second
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, ABILITY)) continue;
    if (unitType[eid] !== UnitType.Infestor) continue;
    if (hpCurrent[eid] <= 0) continue;
    if (energy[eid] < INFESTOR_ENERGY_MAX) {
      energy[eid] = Math.min(INFESTOR_ENERGY_MAX, energy[eid] + INFESTOR_ENERGY_REGEN * dt);
    }
  }
}

function processViperEnergyRegen(world: World, dt: number): void {
  const VIPER_ENERGY_MAX = 200;
  const VIPER_ENERGY_REGEN = 0.5625; // per second
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, ABILITY)) continue;
    if (unitType[eid] !== UnitType.Viper) continue;
    if (hpCurrent[eid] <= 0) continue;
    if (energy[eid] < VIPER_ENERGY_MAX) {
      energy[eid] = Math.min(VIPER_ENERGY_MAX, energy[eid] + VIPER_ENERGY_REGEN * dt);
    }
  }
}

function processCorrosiveBile(world: World, gameTime: number): void {
  const BILE_DAMAGE = 60;
  const BILE_RADIUS = 1.5 * TILE_SIZE;
  const BILE_RADIUS_SQ = BILE_RADIUS * BILE_RADIUS;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (unitType[eid] !== UnitType.Ravager) continue;
    if (bileLandTime[eid] <= 0 || gameTime < bileLandTime[eid]) continue;

    const bx = bileLandX[eid];
    const by = bileLandY[eid];
    const myFac = faction[eid];

    // Apply splash to all enemies (can hit air and ground) in radius
    for (let other = 1; other < world.nextEid; other++) {
      if (faction[other] === myFac || faction[other] === 0) continue;
      if (!hasComponents(world, other, POSITION | HEALTH)) continue;
      if (hpCurrent[other] <= 0) continue;
      const dx = posX[other] - bx;
      const dy = posY[other] - by;
      if (dx * dx + dy * dy <= BILE_RADIUS_SQ) {
        hpCurrent[other] = Math.max(0, hpCurrent[other] - BILE_DAMAGE);
      }
    }

    soundManager.playBileImpact();
    triggerCameraShake(5); // Bile impact — medium shake

    // Reset bile state
    bileLandTime[eid] = 0;
    bileLandX[eid] = 0;
    bileLandY[eid] = 0;
  }
}

function processKD8Charge(world: World, gameTime: number): void {
  const KD8_RADIUS_PX = KD8_RADIUS * TILE_SIZE;
  const KD8_RADIUS_SQ = KD8_RADIUS_PX * KD8_RADIUS_PX;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (unitType[eid] !== UnitType.Reaper) continue;
    if (kd8LandTime[eid] <= 0 || gameTime < kd8LandTime[eid]) continue;

    const kx = kd8LandX[eid];
    const ky = kd8LandY[eid];
    const myFac = faction[eid];

    // Apply splash damage to all enemies in radius
    for (let other = 1; other < world.nextEid; other++) {
      if (faction[other] === myFac || faction[other] === 0) continue;
      if (!hasComponents(world, other, POSITION | HEALTH)) continue;
      if (hpCurrent[other] <= 0) continue;
      const dx = posX[other] - kx;
      const dy = posY[other] - ky;
      if (dx * dx + dy * dy <= KD8_RADIUS_SQ) {
        hpCurrent[other] = Math.max(0, hpCurrent[other] - KD8_DAMAGE);
      }
    }

    soundManager.playAttackAt(kx, ky);
    triggerCameraShake(3); // KD8 Charge — light shake

    // Reset KD8 state
    kd8LandTime[eid] = 0;
    kd8LandX[eid] = 0;
    kd8LandY[eid] = 0;
  }
}

function processFungalGrowth(world: World, gameTime: number): void {
  const FUNGAL_DAMAGE = 30;
  const FUNGAL_RADIUS = 2.25 * TILE_SIZE;
  const FUNGAL_RADIUS_SQ = FUNGAL_RADIUS * FUNGAL_RADIUS;
  const FUNGAL_SLOW_DURATION = 2.85; // seconds (SC2 LotV)

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (unitType[eid] !== UnitType.Infestor) continue;
    if (fungalLandTime[eid] <= 0 || gameTime < fungalLandTime[eid]) continue;

    const fx = fungalLandX[eid];
    const fy = fungalLandY[eid];
    const myFac = faction[eid];

    // Apply damage and root all enemies in radius
    for (let other = 1; other < world.nextEid; other++) {
      if (faction[other] === myFac || faction[other] === 0) continue;
      if (!hasComponents(world, other, POSITION | HEALTH)) continue;
      if (hpCurrent[other] <= 0) continue;
      const dx = posX[other] - fx;
      const dy = posY[other] - fy;
      if (dx * dx + dy * dy <= FUNGAL_RADIUS_SQ) {
        hpCurrent[other] = Math.max(0, hpCurrent[other] - FUNGAL_DAMAGE);
        // Full root for 2.85s (SC2 LotV) — Ultralisk immune (Frenzied passive)
        if (unitType[other] !== UnitType.Ultralisk) {
          slowFactor[other] = 1.0;
          slowEndTime[other] = gameTime + FUNGAL_SLOW_DURATION;
        }
      }
    }

    soundManager.playFungalGrowth();
    triggerCameraShake(3); // Fungal — light shake

    // Reset fungal state
    fungalLandTime[eid] = 0;
    fungalLandX[eid] = 0;
    fungalLandY[eid] = 0;
  }
}

/** Caustic Spray: Corruptor channels DPS against a single enemy building */
function processCausticSpray(world: World, dt: number, gameTime: number): void {
  const rangePx = CAUSTIC_SPRAY_RANGE * TILE_SIZE;
  const rangeSq = rangePx * rangePx;
  const dmg = CAUSTIC_SPRAY_DPS * dt;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (unitType[eid] !== UnitType.Corruptor) continue;
    if (hpCurrent[eid] <= 0) continue;

    const tgt = causticTarget[eid];
    if (tgt < 1) continue;

    // Validate target is still alive and is a building
    if (hpCurrent[tgt] <= 0 || !hasComponents(world, tgt, BUILDING | HEALTH)) {
      causticTarget[eid] = -1;
      continue;
    }

    // Range check
    const dx = posX[tgt] - posX[eid];
    const dy = posY[tgt] - posY[eid];
    if (dx * dx + dy * dy > rangeSq) {
      causticTarget[eid] = -1;
      continue;
    }

    // Deal channeled damage
    hpCurrent[tgt] = Math.max(0, hpCurrent[tgt] - dmg);

    // Push periodic damage events (throttle to once per second for visual clarity)
    if (damageEvents.length < 64 && Math.random() < dt * 2) {
      const victimFac = faction[tgt] as Faction;
      const dmgColor = victimFac === Faction.Terran ? 0xff4444 : 0xaaddff;
      damageEvents.push({
        x: posX[tgt],
        y: posY[tgt],
        amount: CAUSTIC_SPRAY_DPS,
        time: gameTime,
        color: dmgColor,
      });
    }

    // If target died, clear channel
    if (hpCurrent[tgt] <= 0) {
      causticTarget[eid] = -1;
    }
  }
}

/** Cyclone Lock-On: channeled damage over time while allowing movement. Breaks on range or death. */
function processLockOn(world: World, dt: number, gameTime: number): void {
  const BREAK_RANGE_PX = LOCKON_BREAK_RANGE * TILE_SIZE;
  const BREAK_RANGE_SQ = BREAK_RANGE_PX * BREAK_RANGE_PX;
  const DPS = LOCKON_TOTAL_DAMAGE / LOCKON_DURATION;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (unitType[eid] !== UnitType.Cyclone) continue;
    const tgt = lockOnTarget[eid];
    if (tgt < 0) continue;

    // Caster dead — break lock
    if (hpCurrent[eid] <= 0) {
      lockOnTarget[eid] = -1;
      lockOnEndTime[eid] = 0;
      continue;
    }

    // Target dead or doesn't exist — break lock
    if (!entityExists(world, tgt) || hpCurrent[tgt] <= 0) {
      lockOnTarget[eid] = -1;
      lockOnEndTime[eid] = 0;
      continue;
    }

    // Lock expired — break
    if (gameTime >= lockOnEndTime[eid]) {
      lockOnTarget[eid] = -1;
      lockOnEndTime[eid] = 0;
      continue;
    }

    // Range check — break if target is more than 15 tiles away
    const dx = posX[tgt] - posX[eid];
    const dy = posY[tgt] - posY[eid];
    if (dx * dx + dy * dy > BREAK_RANGE_SQ) {
      lockOnTarget[eid] = -1;
      lockOnEndTime[eid] = 0;
      continue;
    }

    // Deal damage this tick
    const dmg = DPS * dt;
    hpCurrent[tgt] = Math.max(0, hpCurrent[tgt] - dmg);

    // Push damage event (throttled for visual clarity)
    if (damageEvents.length < 64 && Math.random() < dt * 2) {
      const victimFac = faction[tgt] as Faction;
      const dmgColor = victimFac === Faction.Terran ? 0xff4444 : 0xaaddff;
      damageEvents.push({
        x: posX[tgt],
        y: posY[tgt],
        amount: Math.round(DPS),
        time: gameTime,
        color: dmgColor,
      });
    }

    // If target died, break lock
    if (hpCurrent[tgt] <= 0) {
      lockOnTarget[eid] = -1;
      lockOnEndTime[eid] = 0;
    }
  }
}

/** Parasitic Bomb: ticking AoE damage centered on a tagged enemy air unit */
function processParasiticBomb(world: World, dt: number, gameTime: number): void {
  const PB_RADIUS_PX = PARASITIC_BOMB_RADIUS * TILE_SIZE;
  const PB_RADIUS_SQ = PB_RADIUS_PX * PB_RADIUS_PX;
  const dmgThisTick = PARASITIC_BOMB_DPS * dt;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (parasiticBombEndTime[eid] <= 0 || gameTime >= parasiticBombEndTime[eid]) {
      // Clear expired bombs
      if (parasiticBombEndTime[eid] > 0 && gameTime >= parasiticBombEndTime[eid]) {
        parasiticBombEndTime[eid] = 0;
        parasiticBombCasterFaction[eid] = 0;
      }
      continue;
    }

    // Tagged unit must be alive and an air unit
    if (hpCurrent[eid] <= 0) {
      parasiticBombEndTime[eid] = 0;
      parasiticBombCasterFaction[eid] = 0;
      continue;
    }

    const casterFac = parasiticBombCasterFaction[eid];
    const bombX = posX[eid];
    const bombY = posY[eid];

    // Damage all enemy air units within radius (including the tagged unit itself)
    spatialHash.ensureBuilt(world);
    const candidates = spatialHash.queryRadius(bombX, bombY, PB_RADIUS_PX);
    for (const other of candidates) {
      if (faction[other] === casterFac || faction[other] === 0) continue;
      if (hpCurrent[other] <= 0) continue;
      if (isAir[other] !== 1) continue; // air only
      if (!hasComponents(world, other, POSITION | HEALTH)) continue;
      const dx = posX[other] - bombX;
      const dy = posY[other] - bombY;
      if (dx * dx + dy * dy > PB_RADIUS_SQ) continue;
      hpCurrent[other] = Math.max(0, hpCurrent[other] - dmgThisTick);

      // Push damage event (throttled for visual clarity)
      if (damageEvents.length < 64 && Math.random() < dt * 2) {
        const victimFac = faction[other] as Faction;
        const dmgColor = victimFac === Faction.Terran ? 0xff4444 : 0xaaddff;
        damageEvents.push({
          x: posX[other],
          y: posY[other],
          amount: Math.round(PARASITIC_BOMB_DPS),
          time: gameTime,
          color: dmgColor,
        });
      }
    }
  }
}

/** Neural Parasite: Infestor channels on an enemy, stunning it. Channel breaks on death, movement, range, or expiry. */
function processNeuralParasite(world: World, gameTime: number): void {
  const BREAK_RANGE_PX = (NEURAL_PARASITE_RANGE + 2) * TILE_SIZE; // 11 tiles break range
  const BREAK_RANGE_SQ = BREAK_RANGE_PX * BREAK_RANGE_PX;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (unitType[eid] !== UnitType.Infestor) continue;
    const tgt = neuralTarget[eid];
    if (tgt < 0) continue;

    let shouldBreak = false;

    // Infestor dead — break channel
    if (hpCurrent[eid] <= 0) shouldBreak = true;

    // Target dead or doesn't exist — break channel
    if (!shouldBreak && (!entityExists(world, tgt) || hpCurrent[tgt] <= 0)) shouldBreak = true;

    // Infestor moved (has a path) — break channel
    if (!shouldBreak && movePathIndex[eid] >= 0) shouldBreak = true;

    // Duration expired — break channel
    if (!shouldBreak && gameTime >= neuralEndTime[eid]) shouldBreak = true;

    // Range check — break if target is more than 11 tiles away
    if (!shouldBreak) {
      const dx = posX[tgt] - posX[eid];
      const dy = posY[tgt] - posY[eid];
      if (dx * dx + dy * dy > BREAK_RANGE_SQ) shouldBreak = true;
    }

    if (shouldBreak) {
      // End the stun immediately on the victim (if victim exists and is alive)
      if (entityExists(world, tgt) && hpCurrent[tgt] > 0) {
        neuralStunEndTime[tgt] = gameTime;
      }
      neuralTarget[eid] = -1;
      neuralEndTime[eid] = 0;
      continue;
    }

    // Keep the stun alive — refresh stun end time each tick
    neuralStunEndTime[tgt] = gameTime + 0.1;
  }
}

export function applyInjectLarva(world: World, queenEids: number[], gameTime: number): void {
  for (const qEid of queenEids) {
    if (unitType[qEid] !== UnitType.Queen) continue;
    if (hpCurrent[qEid] <= 0) continue;
    if (energy[qEid] < INJECT_LARVA_COST) continue;

    // Find nearest friendly Hatchery with no active inject
    let nearestHatch = 0;
    let nearestDist = Infinity;
    const myFac = faction[qEid];
    for (let eid = 1; eid < world.nextEid; eid++) {
      if (!hasComponents(world, eid, BUILDING)) continue;
      if (faction[eid] !== myFac) continue;
      if (!isHatchType(buildingType[eid])) continue;
      if (buildState[eid] !== BuildState.Complete) continue;
      if (injectTimer[eid] > 0) continue; // already injecting
      const dx = posX[eid] - posX[qEid];
      const dy = posY[eid] - posY[qEid];
      const dist = dx * dx + dy * dy;
      if (dist < nearestDist) { nearestDist = dist; nearestHatch = eid; }
    }
    if (nearestHatch === 0) continue;
    energy[qEid] -= INJECT_LARVA_COST;
    injectTimer[nearestHatch] = gameTime + INJECT_LARVA_TIME;
  }
}
