import { type World, hasComponents } from '../ecs/world';
import {
  POSITION, HEALTH, ABILITY, UNIT_TYPE,
  posX, posY, hpCurrent, hpMax, faction, unitType,
  moveSpeed, atkCooldown, atkDamage, atkRange, atkSplash, atkMinRange,
  stimEndTime, slowEndTime, slowFactor,
  siegeMode, siegeTransitionEnd,
  lastCombatTime,
  bonusDmg, bonusVsTag,
} from '../ecs/components';
import { UNIT_DEFS } from '../data/units';
import {
  UnitType, Faction, SiegeMode, TILE_SIZE,
  STIM_SPEED_MULT, STIM_COOLDOWN_MULT,
  SIEGE_DAMAGE, SIEGE_RANGE, SIEGE_SPLASH, SIEGE_BONUS_DAMAGE, SIEGE_COOLDOWN, SIEGE_MIN_RANGE, ArmorClass,
  HEAL_RATE, HEAL_RANGE,
  SELF_REPAIR_RATE, SELF_REPAIR_TIMEOUT,
} from '../constants';

/**
 * Processes all unit abilities each tick.
 * Runs after CombatSystem and before DeathSystem.
 */
export function abilitySystem(world: World, dt: number, gameTime: number): void {
  processStimExpiry(world, gameTime);
  processSlowExpiry(world, gameTime);
  processSiegeTransitions(world, gameTime);
  processMedicHeal(world, dt);
  processAutomataSelfRepair(world, dt, gameTime);
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

/** Medic heal: heals nearest damaged friendly unit within HEAL_RANGE at HEAL_RATE */
function processMedicHeal(world: World, dt: number): void {
  const healRangePx = HEAL_RANGE * TILE_SIZE;
  const healRangeSq = healRangePx * healRangePx;
  const healAmount = HEAL_RATE * dt;

  const bits = POSITION | ABILITY | UNIT_TYPE | HEALTH;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (unitType[eid] !== UnitType.Medic) continue;
    if (hpCurrent[eid] <= 0) continue;

    const mx = posX[eid];
    const my = posY[eid];
    const myFac = faction[eid];

    // Find nearest damaged friendly unit
    let bestEid = -1;
    let bestDistSq = Infinity;

    for (let other = 1; other < world.nextEid; other++) {
      if (other === eid) continue;
      if (!hasComponents(world, other, POSITION | HEALTH)) continue;
      if (faction[other] !== myFac) continue;
      if (hpCurrent[other] <= 0) continue;
      if (hpCurrent[other] >= hpMax[other]) continue;

      const dx = posX[other] - mx;
      const dy = posY[other] - my;
      const distSq = dx * dx + dy * dy;
      if (distSq > healRangeSq) continue;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestEid = other;
      }
    }

    if (bestEid >= 0) {
      hpCurrent[bestEid] = Math.min(hpMax[bestEid], hpCurrent[bestEid] + healAmount);
    }
  }
}

/** Automata self-repair: all Automata units regen SELF_REPAIR_RATE when out of combat */
function processAutomataSelfRepair(world: World, dt: number, gameTime: number): void {
  const bits = ABILITY | UNIT_TYPE | HEALTH;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (faction[eid] !== Faction.Automata) continue;
    if (hpCurrent[eid] <= 0) continue;
    if (hpCurrent[eid] >= hpMax[eid]) continue;

    // Only regen if out of combat for SELF_REPAIR_TIMEOUT seconds
    if (lastCombatTime[eid] + SELF_REPAIR_TIMEOUT > gameTime) continue;

    hpCurrent[eid] = Math.min(hpMax[eid], hpCurrent[eid] + SELF_REPAIR_RATE * dt);
  }
}
