import { type World, hasComponents } from '../ecs/world';
import {
  POSITION, HEALTH, ABILITY, UNIT_TYPE, BUILDING,
  posX, posY, hpCurrent, hpMax, faction, unitType,
  moveSpeed, atkCooldown, atkDamage, atkRange, atkSplash,
  stimEndTime, slowEndTime, slowFactor,
  siegeMode, siegeTransitionEnd,
  lastCombatTime, movePathIndex,
  energy, cloaked, commandMode,
  injectTimer, buildingType, buildState,
  bileLandTime, bileLandX, bileLandY,
  fungalLandTime, fungalLandX, fungalLandY,
  bonusDmg, bonusVsTag,
} from '../ecs/components';
import { UNIT_DEFS } from '../data/units';
import {
  UnitType, Faction, SiegeMode, CommandMode, TILE_SIZE,
  STIM_SPEED_MULT, STIM_COOLDOWN_MULT,
  SIEGE_DAMAGE, SIEGE_RANGE, SIEGE_SPLASH, SIEGE_BONUS_DAMAGE, ArmorClass,
  MEDIVAC_HEAL_RATE, MEDIVAC_HEAL_RANGE,
  ROACH_REGEN_COMBAT, ROACH_REGEN_IDLE, ROACH_COMBAT_TIMEOUT,
  QUEEN_ENERGY_MAX, QUEEN_ENERGY_REGEN,
  INJECT_LARVA_COST, INJECT_LARVA_TIME,
  BuildingType, BuildState,
} from '../constants';
import { soundManager } from '../audio/SoundManager';
import { triggerCameraShake } from '../rendering/CameraShake';

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
  processGhostCloak(world, dt);
  processQueenEnergyRegen(world, dt);
  processWidowMineBurrow(world);
  processInfestorEnergyRegen(world, dt);
  processViperEnergyRegen(world, dt);
  processCorrosiveBile(world, gameTime);
  processFungalGrowth(world, gameTime);
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

      // Only heal biological Terran units (Marine, Marauder, SCV, Ghost, Reaper, Hellion)
      const ut = unitType[other] as UnitType;
      if (ut !== UnitType.Marine && ut !== UnitType.Marauder && ut !== UnitType.SCV
        && ut !== UnitType.Ghost && ut !== UnitType.Reaper && ut !== UnitType.Hellion) continue;

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
    const rate = isInCombat ? ROACH_REGEN_COMBAT : ROACH_REGEN_IDLE;
    hpCurrent[eid] = Math.min(hpMax[eid], hpCurrent[eid] + rate * dt);
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
      cloaked[eid] = 1; // burrowed = effectively cloaked
    } else {
      cloaked[eid] = 0; // unburrow when moving
    }
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

function processFungalGrowth(world: World, gameTime: number): void {
  const FUNGAL_DAMAGE = 30;
  const FUNGAL_RADIUS = 2.25 * TILE_SIZE;
  const FUNGAL_RADIUS_SQ = FUNGAL_RADIUS * FUNGAL_RADIUS;
  const FUNGAL_SLOW_DURATION = 3; // seconds

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
        // 75% slow for 3s (not a root)
        slowFactor[other] = 0.75;
        slowEndTime[other] = gameTime + FUNGAL_SLOW_DURATION;
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
      if (buildingType[eid] !== BuildingType.Hatchery) continue;
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
