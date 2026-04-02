# SC2 Final Accuracy Audit — Corrections Needed

Audited against Liquipedia SC2 Legacy of the Void values at Faster game speed.

## Critical Fixes (gameplay-impacting)

### 1. baseArmor missing on 14 units
UnitDef needs a `baseArmor: number` field. Currently derived from ArmorClass in spawnUnitAt but the derivation is wrong (gives 1 to all Armored, 0 to all Light). SC2 has per-unit base armor values.

| Unit | Should be |
|------|-----------|
| Marauder | 1 |
| SiegeTank | 1 |
| Medivac | 1 |
| Cyclone | 1 |
| Thor | 1 |
| Battlecruiser | **3** |
| Roach | 1 |
| Queen | 1 |
| Ravager | 1 |
| Lurker | 1 |
| Ultralisk | **2** |
| Corruptor | **2** |
| Viper | 1 |

### 2. Multi-shot attacks (Reaper, Viking, Thor deal HALF damage)
| Unit | Current damage | SC2 (per attack) | Fix |
|------|---------------|-------------------|-----|
| Reaper | 4 | 4×2 = 8 | Change to 8 |
| Viking (fighter) | 10 | 10×2 = 20 | Change to 20 |
| Viking bonusDamage | 4 | 4×2 = 8 | Change to 8 |
| Thor (ground) | 30 | 30×2 = 60 | Change to 60 |

### 3. Siege mode damage
| Field | Current | SC2 |
|-------|---------|-----|
| Siege base damage | 35 (in AbilitySystem) | 40 |
| Siege bonus vs Armored | NOT IMPLEMENTED | +30 |
| Siege splash radius | 1.5 | 1.25 |
| Siege pack/unpack time | 2.0s | 2.7s |

### 4. Ability values
| Ability | Field | Current | SC2 |
|---------|-------|---------|-----|
| Stim Pack | duration | 7.0s | **11.0s** |
| Stim Pack | HP cost (Marauder) | 10 | **20** (Marine stays 10) |
| Concussive Shells | slow duration | 1.5s | 1.07s |
| Medivac | heal rate | 3.0 HP/s | **9.0 HP/game-s** |
| Roach regen (idle/burrowed) | 2.0 HP/s | **7.0 HP/s** |
| Roach regen (combat) | 0.5 HP/s | 0.38 HP/s |
| Queen Inject | larva bonus | 4 | **3** |
| Queen Inject | inject time | 40s | **29s** |
| Queen | energy regen | 0.5625/s | 0.7875/s |
| Ghost cloak | energy drain | 0.5/s | 0.9/s |
| Ghost cloak | energy regen | 1.0/s | 0.7875/s |
| Corrosive Bile | radius | 2 tiles | **0.5 tiles** |
| Fungal Growth | damage | 30 | **25** (over 3s) |
| Fungal Growth | radius | 2.5 tiles | 2.25 tiles |
| Fungal Growth | duration | 4s | **3s** |
| Fungal Growth | mechanic | 100% root | **75% slow** (NOT root) |

### 5. Unit stat corrections
| Unit | Field | Current | SC2 |
|------|-------|---------|-----|
| SCV | attackCooldown | 1000 | 1070 |
| SCV | range | 0.5 | 0.2 |
| Ghost | attackCooldown | 1500 | **1070** |
| Ghost | buildTime | 32 | 29 |
| Viking | attackCooldown | 1500 | 1430 |
| Hydralisk | speed | 2.8 | **3.15** |
| Roach | speed | 2.8 | **3.15** |
| Ravager | speed | 3.0 | **3.85** |
| Infestor | speed | 2.25 | **3.15** |
| Queen | attackCooldown | 860 | **710** |
| Zergling | range | 0.5 | 0.1 |
| Zergling | costMinerals | 50 | **25** (per individual) |
| Baneling | range | 0.3 | 0.25 |
| Baneling | costMinerals | 50 | **25** (morph cost) |
| Baneling | splashRadius | 2.0 | 2.2 |
| Drone | range | 0.5 | 0.2 |
| Drone | attackCooldown | 1000 | 1070 |
| Thor | splashRadius | 0.5 | 0 (cleave, not splash) |

### 6. Armor class mismatches
| Unit | Current | SC2 |
|------|---------|-----|
| Medivac | Light | **Armored** |
| Overlord | Light | **Armored** |
| Infestor | Light | **Armored** |
| Viper | Light | **Armored** |

### 7. Bonus damage tag mismatch
| Unit | Current bonusVsTag | SC2 |
|------|-------------------|-----|
| Corruptor | Armored | **Massive** (no Massive tag in game — use Armored as proxy or add Massive) |

### 8. Building corrections
| Building | Field | Current | SC2 |
|----------|-------|---------|-----|
| CommandCenter | buildTime | 60 | 71 |
| SupplyDepot | buildTime | 20 | 21 |
| Barracks | buildTime | 40 | 46 |
| Refinery | buildTime | 20 | 21 |
| Factory | buildTime | 45 | 43 |
| Starport | buildTime | 40 | 36 |
| EngineeringBay | costGas | 50 | **0** |
| EngineeringBay | buildTime | 35 | 25 |
| EngineeringBay | requires | Barracks | **null** (just needs CC) |
| Hatchery | costMinerals | 300 | 275 |
| Hatchery | buildTime | 0 | 71 |
| SpawningPool | hp | 750 | 1000 |
| SpawningPool | buildTime | 0 | 46 |
| RoachWarren | buildTime | 55 | 39 |
| HydraliskDen | buildTime | 40 | 29 |
| Spire | cost | 200/200 | **150/150** |
| Spire | buildTime | 71 | 66 |
| InfestationPit | buildTime | 50 | 36 |

## Summary

- **27 units audited**: 3 pass, 24 fail
- **14 units** missing correct baseArmor values
- **3 units** deal half damage (multi-shot not modeled)
- **4 units** have wrong armor class
- **6 ability constants** significantly wrong (stim duration, medivac heal, bile radius)
- **18 building values** need correction (mostly build times)
- Siege mode missing +30 vs Armored bonus damage

## How to apply

Run `/orchestrate` — the next sprint should apply ALL corrections from this file to:
- `src/data/units.ts` — unit stats + add baseArmor field
- `src/data/buildings.ts` — building stats
- `src/constants.ts` — ability constants
- `src/types.ts` — add baseArmor to UnitDef
- `src/systems/AbilitySystem.ts` — siege damage, medivac heal, fungal/bile values
- `src/systems/CombatSystem.ts` — siege bonus damage
- `src/Game.ts` — spawnUnitAt baseArmor from UnitDef
