# Swarm Command — Unit & Building Iteration Plan

> Every unit and building in the game, what's done, what's missing, and what to build next.
> Last updated after 30-iteration polish pass (2026-04-04).

## Status Legend

| Symbol | Meaning |
|--------|---------|
| Done | Fully implemented, SC2-accurate |
| Partial | Basic attack/move works, missing signature ability or mechanic |
| Missing | Not in game yet |

---

## TERRAN UNITS (13)

### SCV — Done
- [x] Basic stats (45 HP, 5 dmg, melee, 1500ms cooldown)
- [x] Mineral/gas gathering
- [x] Building construction (B hotkey, ghost preview)
- [x] Repair (right-click damaged building/mech, 22.4 HP/s)
- [ ] Multi-SCV speed build (multiple SCVs on one building)

### Marine — Done
- [x] Basic stats (45 HP, 6 dmg, 5 range)
- [x] Stim Pack (10 HP cost, 1.5x speed, 2x attack speed, 7.5s)
- [x] Can target air + ground
- **No further iteration needed**

### Marauder — Done
- [x] Basic stats (125 HP, 10 dmg, +10 vs Armored)
- [x] Stim Pack (20 HP cost)
- [x] Concussive Shells (50% slow, 1.07s)
- [x] Ground-only targeting
- **No further iteration needed**

### Siege Tank — Done
- [x] Basic stats (160 HP, 15 dmg mobile, 860ms cooldown)
- [x] Siege Mode toggle (2.7s pack/unpack)
- [x] Sieged: 35 dmg, 13 range, 1.25 splash, +30 vs Armored
- [x] Cannot move while sieged
- **No further iteration needed**

### Medivac — Done
- [x] Basic stats (150 HP, air unit, no attack)
- [x] Passive heal (9 HP/s, 4 range, biological units only: Marine, Marauder, SCV, Ghost, Reaper)
- [ ] Boost ability (temporary speed burst)
- [ ] Unit transport (load/unload ground units)

### Ghost — Done
- [x] Basic stats (125 HP, 10 dmg, +10 vs Light, 1500ms cooldown)
- [x] Cloak (energy drain 0.9/s, regen 0.7875/s uncloaked)
- [x] Snipe (170 dmg, 10 range, 75 energy, bio targets only)
- [x] EMP Round (AoE energy drain, 1.5 tile radius, 75 energy, 10 range)
- [x] Starts with 50 energy (SC2-accurate)

### Hellion — Done
- [x] Basic stats (90 HP, 8 dmg, +6 vs Light, 1.5 splash)
- [x] Fast speed (5.95)
- [x] Ground-only, line splash
- [x] Hellbat transformation (E key toggle: 135 HP, 18 dmg melee, 3.15 speed, +11 vs Light)
- [x] Proportional HP scaling on transform

### Reaper — Done
- [x] Basic stats (60 HP, 8 dmg, 5 range, fast 5.25 speed)
- [x] Passive HP regen (2.0 HP/s after 3s out of combat)
- [x] KD8 Charge (5 dmg AoE, 1.5 tile radius, 1s delay, 14s cooldown, D hotkey)
- [ ] Cliff jumping (ignore terrain height for pathing)

### Viking — Done
- [x] Fighter Mode (air): 20 dmg, 9 range, +8 vs Armored, targets air only
- [x] Assault Mode (ground): 12 dmg, 6 range, no bonus, targets ground only
- [x] Transformation toggle via E key
- [x] Bonus damage correctly cleared/restored on transform
- **No further iteration needed**

### Widow Mine — Done
- [x] Auto-burrow when idle (separate `burrowed` component from Ghost cloak)
- [x] Sentinel Missile (125 dmg + 2.0 tile splash, auto-fires while burrowed, 29s cooldown)
- [x] Skipped from normal CombatSystem — all attack via AbilitySystem sentinel
- **No further iteration needed**

### Cyclone — Done
- [x] Basic stats (120 HP, 18 dmg, fast 4.725 speed)
- [x] Lock-On ability (400 dmg over 14s, can move during, breaks at 15 tiles, Q hotkey)
- [x] Lock-On beam visual indicator
- **No further iteration needed**

### Thor — Done
- [x] Basic stats (400 HP, 60 dmg ground, 7 range)
- [x] Mode switch (E key): Javelin (24 dmg, 11 range, single-target AA) vs Explosive (6 dmg + 0.5 splash, 10 range AA)
- [x] Ground attack unchanged across modes
- [x] Vehicle Weapons upgrade applies correctly
- **No further iteration needed**

### Battlecruiser — Done
- [x] Basic stats (550 HP, 8 dmg, 90ms cooldown, 3 armor)
- [x] Yamato Cannon (240 dmg, 10 range, 71s cooldown)
- [x] Air unit, targets air + ground
- [ ] Tactical Jump (teleport to any visible location)

---

## ZERG UNITS (14)

### Drone — Done
- [x] Mineral/gas gathering
- [x] Morph into building (drone consumed)
- **No further iteration needed**

### Zergling — Done
- [x] Basic stats (35 HP, 5 dmg, melee, fast 4.13 speed, 0.5 supply)
- [x] Spawns in pairs
- [ ] Adrenal Glands upgrade, Metabolic Boost upgrade

### Baneling — Done
- [x] Basic stats (30 HP, 16 dmg + 19 vs Light, 2.2 splash, 0.5 supply)
- [x] Suicide attack (dies on detonation)
- [x] Splash damage works (atkSplash initialized at spawn)
- [x] Burrow ability (R key toggle, cloaked while burrowed)

### Hydralisk — Done
- [x] Basic stats (90 HP, 12 dmg, 5 range, 590ms cooldown)
- [x] Can target air + ground
- [ ] Grooved Spines (+1 range), Muscular Augments (speed)

### Roach — Done
- [x] Basic stats (145 HP, 16 dmg, 4 range, 2 supply)
- [x] Passive HP regen (0.38 combat / 7.0 idle)
- [x] Burrow ability (R key toggle, cloaked while burrowed)

### Mutalisk — Done
- [x] Basic stats (120 HP, 9 dmg, 3 range, very fast 5.6 speed)
- [x] Bounce attack — glaive bounces to 2 additional targets (9→3→1 dmg, 1.5 tile bounce range)
- [x] Bounce damage indicators and combat time tracking

### Queen — Done
- [x] Basic stats (175 HP, 9 air / 8 ground, 7 range)
- [x] Inject Larva (25 energy, +3 larva after 29s)
- [x] Transfuse (75 HP heal, 50 energy, 7 range)
- [x] Energy system (200 max, 0.7875/s regen, starts at 25)
- [ ] Creep Tumor

### Overlord — Done
- [x] Basic stats (200 HP, no attack, 0 supply cost)
- [x] Provides 8 supply
- [ ] Generate Creep, transport, Overseer morph

### Ravager — Done
- [x] Corrosive Bile (60 dmg, 1.5 splash, 5s cooldown, 2s travel)
- **No further iteration needed**

### Lurker — Done
- [x] Auto-burrow when idle
- [x] Must be burrowed to attack (CombatSystem enforces via `burrowed` component)
- [x] 20 dmg, 8 range, 1.0 splash, +10 vs Armored

### Infestor — Done
- [x] Fungal Growth (30 dmg, 2.25 radius, 75% slow 3s, 100 energy)
- [x] Neural Parasite (channeled stun, 7s, 100 energy, 9 range, N hotkey)
- [x] Energy system (200 max, 0.5625/s regen, starts at 50)

### Ultralisk — Done
- [x] Basic stats (500 HP, 35 dmg, 1.5 splash, 2 armor, 6 supply)
- [x] Frenzied passive — immune to Concussive Shells and Fungal Growth slow
- [ ] Chitinous Plating upgrade (+2 armor)

### Corruptor — Done
- [x] Basic stats (200 HP, 14 dmg, +6 vs Armored, air-only)
- [x] Caustic Spray (channeled 4.7 DPS vs buildings, C hotkey)
- [ ] Morph to Brood Lord (stretch goal)

### Viper — Done
- [x] Abduct (9 range, 75 energy, teleports target)
- [x] Blinding Cloud (AoE reduce range to melee, 2 tile radius, 6s, 100 energy, B hotkey)
- [x] Parasitic Bomb (120 AoE dmg over 7s to nearby air, 3 tile radius, 125 energy, P hotkey)
- [x] Consume (drain 200 HP from allied building → 50 energy, 7 range)
- [x] Energy system (200 max, 0.5625/s regen, starts at 50)
- **All 4 abilities implemented**

---

## TERRAN BUILDINGS (8 existing)

| Building | HP | Cost | Build | Size | Attack | Status |
|----------|----|----|-------|------|--------|--------|
| Command Center | 1500 | 400M | 71s | 3x3 | — | Done |
| Supply Depot | 400 | 100M | 21s | 2x2 | — | Done (lower/raise) |
| Barracks | 1000 | 150M | 46s | 3x3 | — | Done |
| Refinery | 500 | 75M | 21s | 2x2 | — | Done |
| Factory | 1250 | 150M/100G | 43s | 3x3 | — | Done |
| Starport | 1300 | 150M/100G | 36s | 3x3 | — | Done |
| Engineering Bay | 850 | 125M | 25s | 3x2 | — | Done |
| Missile Turret | 250 | 100M | 18s | 1x1 | 12 dmg, air-only | **NEW** |

### Still Missing (Terran)
- Bunker (load infantry, +1 range)
- Armory (vehicle/ship upgrades, gates Thor + BC)
- Ghost Academy (gates Ghost)
- Fusion Core (gates Battlecruiser)
- Sensor Tower (radar)

## ZERG BUILDINGS (9 existing)

| Building | HP | Cost | Build | Size | Attack | Status |
|----------|----|----|-------|------|--------|--------|
| Hatchery | 1500 | 275M | 71s | 3x3 | — | Done |
| Spawning Pool | 1000 | 200M | 46s | 2x2 | — | Done |
| Evolution Chamber | 750 | 75M | 25s | 2x2 | — | Done |
| Roach Warren | 850 | 150M | 39s | 2x2 | — | Done |
| Hydralisk Den | 850 | 100M/100G | 29s | 2x2 | — | Done |
| Spire | 850 | 150M/150G | 66s | 2x2 | — | Done |
| Infestation Pit | 850 | 100M/100G | 36s | 2x2 | — | Done |
| Spine Crawler | 300 | 100M | 36s | 1x1 | 25.9 dmg, ground | **NEW** |
| Spore Crawler | 400 | 75M | 21s | 1x1 | 15 dmg, air | **NEW** |

### Still Missing (Zerg)
- Extractor (Zerg gas building)
- Baneling Nest (gates Baneling)
- Ultralisk Cavern (gates Ultralisk)
- Lair / Hive (tech progression)
- Nydus Network (transport)

---

## UNIT COMPLETENESS SCORECARD (Post-Iteration)

| Unit | Stats | Attack | Abilities | Score |
|------|-------|--------|-----------|-------|
| **Terran** | | | | |
| SCV | Done | Done | Repair Done | 90% |
| Marine | Done | Done | Stim Done | 100% |
| Marauder | Done | Done | Stim+Conc Done | 100% |
| Siege Tank | Done | Done | Siege Done | 100% |
| Medivac | Done | Done | Heal Done | 70% |
| Ghost | Done | Done | Cloak+Snipe+EMP Done | 95% |
| Hellion | Done | Done | Hellbat Transform Done | 100% |
| Reaper | Done | Done | Regen+KD8 Done | 90% |
| Viking | Done | Done | Transform Done | 100% |
| Widow Mine | Done | Done | Sentinel+Burrow Done | 100% |
| Cyclone | Done | Done | Lock-On Done | 100% |
| Thor | Done | Done | Mode Switch Done | 100% |
| Battlecruiser | Done | Done | Yamato Done | 85% |
| **Zerg** | | | | |
| Drone | Done | Done | Morph Done | 100% |
| Zergling | Done | Done | — | 85% |
| Baneling | Done | Done | Explode+Burrow Done | 90% |
| Hydralisk | Done | Done | — | 85% |
| Roach | Done | Done | Regen+Burrow Done | 90% |
| Mutalisk | Done | Done | Bounce Done | 100% |
| Queen | Done | Done | Inject+Transfuse Done | 90% |
| Overlord | Done | — | Supply Done | 60% |
| Ravager | Done | Done | Bile Done | 100% |
| Lurker | Done | Done | Burrow-attack Done | 100% |
| Infestor | Done | — | Fungal+Neural Done | 90% |
| Ultralisk | Done | Done | Frenzied Done | 85% |
| Corruptor | Done | Done | Caustic Done | 85% |
| Viper | Done | — | All 4 abilities Done | 100% |

**Overall: ~93% complete across all units (up from ~70%)**

## BUGS FIXED IN THIS PASS

1. Splash damage never set at spawn (broke 5 units)
2. Supply never freed on unit death (permanent supply block)
3. SCV repair rate 1000x too slow
4. Lurker could attack while mobile
5. Hatchery first unit never consumed larva
6. UI production bypassed tech requirements
7. All casters started at wrong energy (200 instead of 50/25)
8. Weapon upgrades only applied to 2 of 7 mech units
9. Medivac healed mechanical Hellion
10. Viking retained air bonus damage in ground mode
11. BuildSystem used Date.now() instead of gameTime
12. EvolutionChamber had wrong prerequisite
13. Cloaked/burrowed state collision (now separate components)
14. Thor dealt 60 dmg vs air (should be 24)

## NEW ABILITIES ADDED

| Ability | Unit | Type | Key |
|---------|------|------|-----|
| EMP Round | Ghost | Ground AoE | E |
| KD8 Charge | Reaper | Ground AoE | D |
| Lock-On | Cyclone | Channeled | Q |
| Mode Switch | Thor | Toggle | E |
| Hellbat Transform | Hellion | Toggle | E |
| Caustic Spray | Corruptor | Channel vs buildings | C |
| Blinding Cloud | Viper | Ground AoE | B |
| Parasitic Bomb | Viper | Unit-targeted AoE | P |
| Consume | Viper | Targeted ally building | — |
| Baneling Burrow | Baneling | Toggle | R |
| Roach Burrow | Roach | Toggle | R |
| Neural Parasite | Infestor | Channeled stun | N |
| Sentinel Missile | Widow Mine | Auto (burrowed) | — |
| Reaper Regen | Reaper | Passive | — |
| Ultralisk Frenzied | Ultralisk | Passive | — |
