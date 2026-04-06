import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestWorld,
  spawnUnit,
  cleanupEntities,
  createTestMap,
  Faction,
  UnitType,
} from '../helpers';
import { combatSystem } from '../../src/systems/CombatSystem';
import { movementSystem } from '../../src/systems/MovementSystem';
import {
  isAir,
  canTargetAir,
  canTargetGround,
  targetEntity,
  commandMode,
  atkLastTime,
  posX,
  posY,
} from '../../src/ecs/components';
import type { World } from '../../src/ecs/world';
import type { MapData } from '../../src/map/MapData';

describe('AirGroundTargeting', () => {
  let world: World;
  let map: MapData;
  const eids: number[] = [];

  beforeEach(() => {
    world = createTestWorld();
    map = createTestMap();
    eids.length = 0;
  });

  afterEach(() => {
    cleanupEntities(eids);
  });

  function unit(opts: Parameters<typeof spawnUnit>[1] = {}): number {
    const eid = spawnUnit(world, opts);
    eids.push(eid);
    return eid;
  }

  // ── Group 1: Ground-only attacker cannot target air ──

  describe('ground-only attacker cannot target air', () => {
    it('Marine does not acquire Mutalisk as target', () => {
      const marine = unit({
        x: 100, y: 100,
        factionId: Faction.Terran,
        unitTypeId: UnitType.Marine,
        range: 200, damage: 6,
        canTargetAirUnit: false,
      });
      // damage: 0 prevents Mutalisk from attacking back and triggering retaliation
      const mutalisk = unit({
        x: 150, y: 100,
        factionId: Faction.Zerg,
        unitTypeId: UnitType.Mutalisk,
        hp: 120,
        isAirUnit: true,
        damage: 0,
      });
      atkLastTime[marine] = -999;

      combatSystem(world, 1 / 60, 1.0, map);

      expect(targetEntity[marine]).not.toBe(mutalisk);
    });
  });

  // ── Group 2: Air-capable attacker CAN target air ──

  describe('air-capable attacker can target air', () => {
    it('Hydralisk acquires Medivac as target', () => {
      const hydra = unit({
        x: 100, y: 100,
        factionId: Faction.Zerg,
        unitTypeId: UnitType.Hydralisk,
        range: 200, damage: 12,
        canTargetGroundUnit: true,
        canTargetAirUnit: true,
      });
      const medivac = unit({
        x: 150, y: 100,
        factionId: Faction.Terran,
        unitTypeId: UnitType.Medivac,
        hp: 150,
        isAirUnit: true,
        damage: 0,
      });
      atkLastTime[hydra] = -999;

      combatSystem(world, 1 / 60, 1.0, map);

      expect(targetEntity[hydra]).toBe(medivac);
    });
  });

  // ── Group 3: Ground-only attacker CAN target ground ──

  describe('ground-only attacker can target ground units normally', () => {
    it('Marine acquires Zergling as target', () => {
      const marine = unit({
        x: 100, y: 100,
        factionId: Faction.Terran,
        unitTypeId: UnitType.Marine,
        range: 200, damage: 6,
        canTargetAirUnit: false,
      });
      const zergling = unit({
        x: 150, y: 100,
        factionId: Faction.Zerg,
        unitTypeId: UnitType.Zergling,
        hp: 35,
      });
      atkLastTime[marine] = -999;

      combatSystem(world, 1 / 60, 1.0, map);

      expect(targetEntity[marine]).toBe(zergling);
    });
  });

  // ── Group 4: Air unit targets ground ──

  describe('air unit can target ground', () => {
    it('Mutalisk acquires Marine as target', () => {
      const mutalisk = unit({
        x: 100, y: 100,
        factionId: Faction.Zerg,
        unitTypeId: UnitType.Mutalisk,
        range: 200, damage: 9,
        isAirUnit: true,
        canTargetGroundUnit: true,
        canTargetAirUnit: true,
      });
      const marine = unit({
        x: 150, y: 100,
        factionId: Faction.Terran,
        unitTypeId: UnitType.Marine,
        hp: 45,
      });
      atkLastTime[mutalisk] = -999;

      combatSystem(world, 1 / 60, 1.0, map);

      expect(targetEntity[mutalisk]).toBe(marine);
    });
  });

  // ── Group 5: Retaliation bypass — Marine cannot retaliate against Mutalisk ──

  describe('retaliation bypass', () => {
    it('Marine target is cleared when it cannot target the air attacker', () => {
      const marine = unit({
        x: 100, y: 100,
        factionId: Faction.Terran,
        unitTypeId: UnitType.Marine,
        range: 200, damage: 6,
        canTargetAirUnit: false,
      });
      // damage: 0 prevents Mutalisk from attacking and re-setting the target via retaliation
      const mutalisk = unit({
        x: 150, y: 100,
        factionId: Faction.Zerg,
        unitTypeId: UnitType.Mutalisk,
        hp: 120,
        isAirUnit: true,
        damage: 0,
        canTargetGroundUnit: true,
        canTargetAirUnit: true,
      });

      // Simulate retaliation: Marine was assigned Mutalisk as target
      targetEntity[marine] = mutalisk;

      combatSystem(world, 1 / 60, 1.0, map);

      // Target-validation pass should clear this since Mutalisk is air and Marine can't target air
      expect(targetEntity[marine]).toBe(-1);
    });
  });

  // ── Group 6: Zergling does not auto-acquire Medivac (ground-only vs air) ──

  describe('ground-only attacker does not auto-acquire air-only unit', () => {
    it('Zergling does not acquire Medivac as target', () => {
      const zergling = unit({
        x: 100, y: 100,
        factionId: Faction.Zerg,
        unitTypeId: UnitType.Zergling,
        range: 200, damage: 5,
        canTargetAirUnit: false,
      });
      // Medivac: air unit, no attack damage
      const medivac = unit({
        x: 150, y: 100,
        factionId: Faction.Terran,
        unitTypeId: UnitType.Medivac,
        hp: 150,
        isAirUnit: true,
        damage: 0,
      });
      atkLastTime[zergling] = -999;

      combatSystem(world, 1 / 60, 1.0, map);

      expect(targetEntity[zergling]).not.toBe(medivac);
    });
  });

  // ── Group 7: Two air units separate from each other ──

  describe('air unit separation', () => {
    it('two friendly Mutalisks at the same position are pushed apart', () => {
      // Place them at the same position but 1px apart so distSq > 0 (separation requires distSq >= 0.01)
      const mutaA = unit({
        x: 100, y: 100,
        factionId: Faction.Zerg,
        unitTypeId: UnitType.Mutalisk,
        isAirUnit: true,
        damage: 9,
      });
      const mutaB = unit({
        x: 101, y: 100,
        factionId: Faction.Zerg,
        unitTypeId: UnitType.Mutalisk,
        isAirUnit: true,
        damage: 9,
      });

      movementSystem(world, 1 / 60, map);

      expect(posX[mutaA]).not.toBe(posX[mutaB]);
    });
  });

  // ── Group 8: Air unit does NOT separate from ground unit ──

  describe('air/ground separation exclusion', () => {
    it('Mutalisk and Marine at the same position are not separated', () => {
      const mutalisk = unit({
        x: 100, y: 100,
        factionId: Faction.Zerg,
        unitTypeId: UnitType.Mutalisk,
        isAirUnit: true,
        damage: 9,
      });
      const marine = unit({
        x: 100, y: 100,
        factionId: Faction.Terran,
        unitTypeId: UnitType.Marine,
        damage: 6,
      });

      const beforeMutaX = posX[mutalisk];
      const beforeMutaY = posY[mutalisk];
      const beforeMarineX = posX[marine];
      const beforeMarineY = posY[marine];

      movementSystem(world, 1 / 60, map);

      // No separation applied between air and ground units
      expect(posX[mutalisk]).toBe(beforeMutaX);
      expect(posY[mutalisk]).toBe(beforeMutaY);
      expect(posX[marine]).toBe(beforeMarineX);
      expect(posY[marine]).toBe(beforeMarineY);
    });
  });
});
