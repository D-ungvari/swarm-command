# Swarm Command — Ultraplan
## Roadmap to a Full SC2 Browser Experience

*Based on post-audit gap analysis, 2026-04-01*

---

## Where We Are

| Dimension | Current State | SC2 Parity |
|-----------|--------------|-----------|
| Terran units | 7 / 16 | 44% |
| Zerg units | 6 / 15 | 40% |
| Playable factions | 1 (Terran only) | 33% |
| Air/ground targeting | None | 0% |
| Larva mechanic | None | 0% |
| Tech lab / Reactor | None | 0% |
| Pathfinding quality | A* per unit | ~50% |
| Multiplayer | None | 0% |
| Campaign | None | 0% |

The game plays well. It looks good. It's missing the depth layers that make SC2 feel like SC2.

---

## Phase 1 — Air/Ground Targeting (Foundation Fix)
**Why first:** Every unit added after this point needs it. Viking vs Mutalisk means nothing without it. Without it, adding air units is pointless.

### 1.1 — `isAir` component bit + targeting rules

Add a new component bit `AIR = 1 << 13` and a `canTargetAir: Uint8Array`, `canTargetGround: Uint8Array`.

```
Unit targeting rules:
Marine:       ground=yes, air=yes (SC2: yes/yes)
Marauder:     ground=yes, air=no
SiegeTank:    ground=yes, air=no
Hellion:      ground=yes, air=no
Ghost:        ground=yes, air=yes
Reaper:       ground=yes, air=no
Viking:       ground=yes(assault), air=yes(fighter)
Medivac:      ground=no,  air=no   (healer)
Thor:         ground=yes, air=yes
Battlecruiser:ground=yes, air=yes
Zergling:     ground=yes, air=no
Baneling:     ground=yes, air=no
Hydralisk:    ground=yes, air=yes
Roach:        ground=yes, air=no
Mutalisk:     ground=yes, air=yes
Corruptor:    ground=no,  air=yes  (future unit)
Infestor:     ground=yes, air=yes  (fungal)
```

In `CombatSystem.findBestTarget` and `findClosestEnemy`: filter candidates where `isAir[other] === 1 && !canTargetAir[eid]` or `isAir[other] === 0 && !canTargetGround[eid]`.

**Air units:** Medivac, Mutalisk, Viking(fighter mode). Add `isAir[eid] = 1` in `spawnUnitAt()`.

**Impact:** Adds a full dimension of strategic decision-making. Anti-air becomes a real build consideration.

### 1.2 — Pathfinding for air units

Air units should ignore walkability (they fly over walls, rocks, water). In `MovementSystem`, skip the walkability check for entities with `isAir[eid] === 1`. Also skip separation from ground units.

### 1.3 — Update hotkey panel

Fix `HotkeyPanelRenderer.ts` to reflect actual current bindings:
```
F2: Select Army    F3: Select Workers
C: Cloak (Ghost)   P: Patrol
H: Hold Position   Delete: Cancel Build
+/-: Game Speed    Escape: Pause
```

---

## Phase 2 — Playable Zerg Faction
**Why second:** The biggest single feature gap. Zerg plays completely differently — different macro, different feel, different strategy. This doubles the game's replay value.

### 2.1 — Faction Select on Start Screen

Add a faction picker: `[Terran] [Zerg]`. Store in `game.playerFaction`.

When Zerg is selected:
- Player starts at bottom-right (current Zerg base position)
- AI plays Terran (swap roles)
- The Terran AI gets a new build-order module (see Phase 5)
- Player camera starts at their Hatchery

### 2.2 — Larva System

This is Zerg's core macro mechanic. Hatcheries generate Larva. Units are morphed from Larva.

New component: `larvaCount: Uint8Array` (per Hatchery, max 3 by default, 4 after Queen inject).

`ProductionSystem` changes for Zerg buildings:
- Instead of consuming a production slot, Zerg units consume one Larva from the nearest Hatchery
- Larva replenish at 1 per 11 seconds, up to the cap
- Multiple units can be queued but each requires 1 Larva at queue time (not at completion)

### 2.3 — Queen Unit (`UnitType.Queen = 16`)

The Queen is Zerg's most important macro unit. Every Zerg player builds one immediately.

**Stats:** HP 175, 9 dmg vs ground+air, 7 range, 2.25 speed, 0.71 attack speed, costs 150m

**Abilities:**
- **Inject Larva (V):** Targets a Hatchery. After 40s, releases 4 bonus Larva. This is the core Zerg macro mechanic — players inject constantly to stay at max Larva production.
- **Creep Tumor (C):** Creates a Creep Tumor at target location (costs 25 energy). Tumors spread creep and generate their own tumors after 11s (exponential creep spread).
- **Transfuse (T):** Heals 125 HP instantly to a friendly unit (costs 50 energy, 12s cooldown).

**Energy system:** Queen starts with 25 energy, regenerates 0.5625/s, max 200.

New component: `queenEnergy: Float32Array` (or reuse `energy[eid]`).

### 2.4 — Overlord (`UnitType.Overlord = 17`)

Zerg's supply unit. Replaces supply depots.

**Stats:** HP 200, no attack, 4.0 speed, costs 100m, provides 8 supply. Is an air unit.

Zerg starts with 1 Overlord (total supply = 14 with Hatchery's 6). Must build Overlords to expand supply.

In `AISystem` (when playing Terran vs Zerg player): handle Zerg supply logic to keep the simulation correct.

### 2.5 — Zerg Building Tech Tree (Player-accessible)

When playing Zerg, player can construct:

| Building | Hotkey | Morph from | Requires | Unlocks |
|----------|--------|-----------|----------|---------|
| Hatchery | B1 | Drone morphs | — | Larva, Drones, Overlords, Zerglings |
| SpawningPool | B2 | Drone morphs | Hatchery | Zerglings, Banelings, Queen |
| RoachWarren | B3 | Drone morphs | SpawningPool | Roach, Ravager |
| HydraliskDen | B4 | Drone morphs | Hatchery | Hydralisk, Lurker |
| Spire | B5 | Drone morphs | Hatchery | Mutalisk, Corruptor |
| InfestationPit | B6 | Drone morphs | Lair | Infestor |
| EvolutionChamber | B7 | Drone morphs | Hatchery | Zerg upgrades |

**Drone morphing mechanic:** When a Drone is ordered to build, it walks to the location, transforms into the building (the Drone is consumed — Zerg loses a worker), and construction begins. Different from Terran where the SCV just walks away.

### 2.6 — Lair / Hive Upgrades

**Lair:** Hatchery can morph into a Lair for 150m/100g. Unlocks T2 units (Hydralisk, Roach speed upgrade, Lurker, Infestor, Mutalisk).

**Hive:** Lair can morph into a Hive for 200m/150g. Unlocks T3 units (Ultralisk, Brood Lord).

This creates a meaningful tech progression that mirrors SC2's Zerg tech tree.

---

## Phase 3 — Expanded Terran Roster
**The 6 most impactful missing Terran units.**

### 3.1 — Reaper (`UnitType.Reaper = 8`)
Fast early harasser. Changes the early game completely.

**Stats:** HP 60, 4 damage (Normal/Light), 5 range, 5.25 speed (fastest Terran), 22s build, 75m/50g
**Ability — KD8 Charge (D):** Throws a grenade at target location. Deals 10 damage in 1.5 tile radius. 14s cooldown.
**Passive:** Regenerates 10 HP/s when out of combat for 5s (SC2 mechanic that makes them hard to kill with small forces).
**Cliff jumping:** Can move over certain terrain obstacles (set `canJump[eid] = 1` and skip cliff-tile walkability checks in MovementSystem).

Produces from: Barracks (no add-on required — accessible early game).

### 3.2 — Viking (`UnitType.Viking = 9`)
The critical anti-air unit. Transforms between assault (ground) and fighter (air) mode.

**Stats (Fighter mode):** HP 135, 10 dmg vs air only, range 9, speed 3.0, is air
**Stats (Assault mode):** HP 135, 12 dmg (Normal/Armored) vs ground, range 5, speed 2.25, is ground

**Transform ability (E):** Toggle between modes. 4s transition. While transitioning: immobile, can't attack (like Siege Tank's pack/unpack but for air/ground).

New `vikingMode: Uint8Array` component (`FIGHTER = 0, ASSAULT = 1, TRANSFORMING = 2`).

Produces from: Starport.

### 3.3 — Widow Mine (`UnitType.WidowMine = 10`)
Burrowing ambush unit. One of SC2's most skill-testing mechanics.

**Stats:** HP 90, 125 splash damage (Explosive) in 2.5 tile radius, 29s cooldown between shots
**Passive — Dig In:** When stopped (S command), the Widow Mine burrows automatically. While burrowed: invisible (acts as cloaked), auto-attacks first enemy within 5 tile trigger range. Cannot move while burrowed.
**Dig Out:** When issued a move command, unburrows over 3s.

New component: `burrowed: Uint8Array`. Burrowed units:
- Get `cloaked[eid] = 1` (invisible to enemies)
- Cannot move (moveSpeed override = 0)
- Auto-fire at enemies within trigger range

Produces from: Factory.

### 3.4 — Cyclone (`UnitType.Cyclone = 11`)
Mobile locking-on anti-air/harass.

**Stats:** HP 120, 18 damage, 6 range, 3.0 speed, 1000ms cooldown, 150m/100g
**Ability — Lock On (C):** Lock onto an enemy for 14s. Deals 40 DPS while locked (fires every 0.1s). Can lock onto air. Cyclone must stop to fire after locking. Can be interrupted by moving.

Produces from: Factory.

### 3.5 — Thor (`UnitType.Thor = 12`)
Massive anti-air behemoth.

**Stats:** HP 400, 30 dmg vs ground (Normal/Armored), 7 range, 1.5 speed, 3000ms cooldown, 300m/200g, size 30x30
**High Impact Payload Mode (E):** Switches to anti-air mode: 6 air targets in radius, each taking 25 splash damage. Toggle between modes.

Produces from: Factory (requires Tech Lab add-on — Phase 5).

### 3.6 — Battlecruiser (`UnitType.Battlecruiser = 13`)
The iconic Terran capital ship. Late-game power unit.

**Stats:** HP 550, 8 dmg (Normal/Armored), 6 range, 1.875 speed, 250ms cooldown, 400m/300g, size 34x34, is air
**Ability — Yamato Cannon (Y):** Targets single unit. Deals 240 damage. 71s cooldown. 10 range. (The most famous SC2 ability.)
**Ability — Tactical Jump (T):** Teleports to any visible point on the map. 71s cooldown.

Produces from: Starport.

---

## Phase 4 — Expanded Zerg Roster
**6 transformative Zerg units.**

### 4.1 — Ravager (Roach morph)
**Stats:** HP 120, 16 dmg (Normal/Armored), 6 range, 3.0 speed, 25m/75g morph cost
**Ability — Corrosive Bile (C):** Launches a projectile at a target location. Deals 60 damage to ALL units in 2-tile radius after 2s travel time. Can destroy Force Fields. One of the most punishing abilities in SC2.

Morphs from Roach (like Baneling from Zergling). New `morphingFrom: Int16Array` component or reuse existing building morph pattern.

### 4.2 — Lurker (Hydralisk morph)
**Stats:** HP 200, 20 dmg (Normal) with 2.5 tile line splash, 8 range burrowed (0 unburrowed), speed 3.0, 150m/150g morph cost
**Mechanic:** Must burrow to attack. When burrowed, fires spines in a line from the lurker outward hitting all ground units. Cannot be seen without detection unless unit walks over trigger zone.

Produces from: HydraliskDen morph. Requires Lurker Den upgrade at HydraliskDen.

### 4.3 — Infestor (`UnitType.Infestor = 18`)
**Stats:** HP 90, no direct attack, 2.25 speed, 150m/150g
**Ability — Fungal Growth (F):** Roots all enemies in 2.5 tile radius for 4s. Deals 30 damage over duration. Can hit air. The most frustrating ability to play against.
**Ability — Neural Parasite (E):** Takes control of enemy unit for 15s (300 supply cost equivalent). Can control Terran units against their player. Costs 100 energy.
**Ability — Infested Terran (Passive):** Drops 2 Infested Terran units (marine-like) when killed.

Produces from: InfestationPit (requires Lair).

### 4.4 — Ultralisk (`UnitType.Ultralisk = 19`)
The Zerg's ultimate melee powerhouse.

**Stats:** HP 500, 35 dmg (Normal), 1 range (melee), 2.25 speed, 300m/200g, size 36x36
**Passive — Chitinous Plating:** Has 2 armor (hardcoded, not from upgrades — separate field).
**Passive — Frenzied:** Immune to stun/root effects (Fungal Growth, etc.).
**Special:** When the Ultralisk attacks, the cleave applies damage to all units within 1.5 tiles of the primary target (SC2's Ultralisk hits all nearby units in a swing).

Produces from: Ultralisk Cavern (requires Hive).

### 4.5 — Corruptor (`UnitType.Corruptor = 20`)
Pure anti-air Zerg unit. Counter to Battlecruiser and Thor.

**Stats:** HP 200, 14 dmg vs air only, 6 range, 2.5 speed, 150m/100g, is air
**Ability — Corruption (C):** Targets enemy unit. The unit takes 20% more damage from all sources for 30s. Costs 100 energy.

Produces from: Spire (same as Mutalisk).

### 4.6 — Viper (`UnitType.Viper = 21`)
Zerg's high-mobility support caster.

**Stats:** HP 130, no direct attack, 3.75 speed (very fast), 200m/50g, is air
**Ability — Abduct (E):** Pulls a target unit directly in front of the Viper. Can pull Siege Tanks out of siege, Thor, Battlecruisers. Range 9. Costs 75 energy.
**Ability — Blinding Cloud (C):** Creates a cloud that prevents ranged attacks in 1.5 tile radius for 10s. Costs 100 energy.
**Ability — Parasitic Bomb (R):** Attaches to an air unit — all nearby air units take 60 damage over 8s. Used to counter Terran air fleets.

---

## Phase 5 — Tech Lab / Reactor Add-ons
**Doubles Terran production depth.**

### 5.1 — Tech Lab

A building attached to Barracks/Factory/Starport. Unlocks advanced units and upgrades for that specific building.

**Mechanic:** When a Barracks has a Tech Lab, it can produce Marauder, Ghost (in addition to Marine). Without Tech Lab, Barracks can only produce Marines.

**Add-on building mechanic:**
- Place a Tech Lab adjacent to the production building (1-tile to the right in SC2)
- Simplification: represent as a flag `hasTechLab: Uint8Array` per building entity
- In `BuildMenuRenderer` / `InfoPanelRenderer`: when a Barracks without Tech Lab is selected, show a "Build Tech Lab" button
- Cost: 50m/25g, 25s build time

**Effects:**
| Building | With Tech Lab | Without Tech Lab |
|----------|--------------|-----------------|
| Barracks | Marine, Marauder, Ghost | Marine only |
| Factory | Hellion, Cyclone, SiegeTank, Thor | Hellion, Cyclone |
| Starport | Medivac, Viking, Banshee, Battlecruiser | Medivac, Viking |

### 5.2 — Reactor

A different add-on that doubles production speed (produces 2 units simultaneously).

**Mechanic:** The building runs 2 production queues in parallel.
`hasReactor: Uint8Array` flag → `ProductionSystem` runs 2 parallel progress timers for that building.

**Effects:** Any building can have a Reactor OR Tech Lab, not both.

---

## Phase 6 — Economy Depth
**Worker saturation, optimal mining, expansion pressure.**

### 6.1 — Worker Saturation Indicator

**Mechanic:** Each mineral patch has an optimal worker count (2 per patch = 16 workers for 8 patches = "full saturation"). Above saturation: workers queue wait, reducing effective income.

**Implementation:**
- `gatherSystem`: Track how many workers are mining each resource entity via a `workerCount: Uint8Array` component on resource entities
- Income calculation: If workers > 2 per patch: `income = base * (2 / workerCount)` for overflow workers
- HUD: Show worker count vs optimal (e.g., "Workers: 16/16" in green, "Workers: 8/16" in yellow)

### 6.2 — Gas Saturation (3 workers optimal)

Currently any number of workers can mine gas. In SC2, 3 workers = optimal Refinery saturation.

**Implementation:** Cap effective gas income at 3 workers per Refinery. HUD shows gas worker count.

### 6.3 — Expansion Pressure Mechanic

Currently the player has 1 base and the AI has 2. Add a meaningful expansion flow:

- Second mineral base at tile (30, 30) near player side of map (auto-spawned on Plains map only)
- Hotkey: `X` selects all idle SCVs and highlights the expansion base location with a ping
- Minimap shows expansion base location with a gold marker

### 6.4 — Mining efficiency animation

When a worker successfully mines and returns minerals, show a small "+5" floating text (using the existing `damageEvents` pattern but for resource gain). This makes the economy feel alive.

---

## Phase 7 — Pathfinding Overhaul
**Flow fields for army movement. Fixes the "blob" problem.**

### 7.1 — Flow Field Pathfinding

SC2 uses flow fields for large army movement. Our A* approach causes all units to take the same path, creating traffic jams.

**Flow field approach:**
- When a group of 5+ units is ordered to move, compute a vector field for the destination instead of individual A* paths
- Each cell in the vector field points toward the destination
- Units follow the vector field but apply individual separation steering
- Computed once for the group, not per unit

**Implementation:**
- New `FlowField` class: `computeField(map, targetCol, targetRow)` → `Float32Array` of direction angles per cell
- Store field on `GameCommand`: when `cmd.units.length >= 5`, compute a flow field and attach it to the command
- `MovementSystem` for units following a flow field: look up current cell's direction vector, apply it as velocity, don't follow explicit waypoints

### 7.2 — Stuck Detection and Recovery

Units that haven't moved in 2s while having an active path target → force a re-path from current position.

**Implementation:**
- New `lastMovedTime: Float32Array` component updated in MovementSystem when position changes
- If `gameTime - lastMovedTime[eid] > 2.0` and `movePathIndex[eid] >= 0`: call `setPath` from current position to current target

### 7.3 — Boid Flocking for Zerg Swarms

Zergling and Baneling groups should feel "swarmy" — organic, chaotic movement. Use Boid rules (separation + cohesion + alignment) for groups of 8+ Zerglings in AttackMove mode.

---

## Phase 8 — AI Build Orders
**Real strategic variety from the opponent.**

### 8.1 — AI Build Order System

Replace the current wave-based AI with a proper build-order driven AI that follows a scripted tech path with reactive deviations.

**Terran build orders** (new AI module when player is Zerg):
- **Bio aggression:** CC → Barracks → Rax → Marine/Marine/Marine push at 5:00
- **Mech:** CC → Factory (Tech Lab) → SiegeTank → expand → siege line

**Zerg build orders** (improved AI when player is Terran):
- **12-Pool:** Hatchery → SpawningPool at 12 supply → mass Zerglings at 3:30
- **Roach-Ravager push:** Roach Warren → mass Roach → 3 Ravager corrosive bile + Roach all-in at 5:00
- **Lair macro:** SpawningPool → Lair → Mutalisk harassment + ground army

### 8.2 — Build Order Priority Queue

Instead of the current timer-based wave system, replace with a queue of build actions:

```typescript
interface BuildOrder {
  trigger: 'supply' | 'time' | 'unit_count';
  triggerValue: number;
  action: 'build_unit' | 'build_building' | 'attack' | 'expand';
  target: number; // UnitType or BuildingType
}
```

The AI follows this queue in order, deviating only when under attack or significantly ahead/behind on economy.

### 8.3 — Scout-Driven Tech Responses

The AI already scouts but underuses intel. Add:
- If AI sees Siege Tanks → switch to Mutalisk/Zergling mix (Mutas dodge siege, Zerglings close gap fast)
- If AI sees mass air → build Hydralisks (anti-air)
- If AI sees no anti-air → transition to Mutalisk harassment

---

## Phase 9 — Multiplayer (Peer-to-Peer)
**The true SC2 experience.**

### 9.1 — Deterministic Simulation

The current simulation uses `performance.now()` in some places. Full determinism requires:
- Replace `Math.random()` with a seeded LCG (Linear Congruential Generator) — seed shared between both players
- Replace `performance.now()` timestamps with `gameTime` everywhere
- Verify TypedArray operations produce identical results on both clients (they will — IEEE 754 floats are deterministic)

### 9.2 — Lockstep Protocol

**Architecture:** Peer-to-peer lockstep over WebRTC data channels.

```
Player A input → GameCommand → send to Player B
Player B input → GameCommand → send to Player A

Each tick:
  - Collect local commands
  - Wait for remote commands (with 2-tick buffer)
  - Execute both players' commands in deterministic order
  - Advance simulation
```

**Input delay:** 2 ticks (33ms) is imperceptible but ensures both peers have each other's inputs before simulating.

### 9.3 — WebRTC Signaling Server

A minimal Node.js server (deployed on Render or Railway for free tier) handles WebRTC offer/answer exchange. After handshake, all game data flows P2P.

**Lobby UI:**
- "Create Game" → generates 6-character room code
- "Join Game" → enter room code
- Faction select for each player
- Map vote (both players must agree)

### 9.4 — Replay System (extends Phase 9 determinism)

Once deterministic, replays are trivial: record both players' `GameCommand` streams with timestamps. Replay by feeding commands back into the simulation. Save as JSON, shareable via URL.

---

## Phase 10 — Campaign
**Teaches mechanics. Tells a story. Dramatically increases replayability.**

### 10.1 — Terran Campaign (3 missions)

**Mission 1 — Hold the Line**
- Start with 1 CC, 6 Marines, 4 SCVs
- Defend 3 attack waves (no build menu — teaches combat micro only)
- Objective: Keep at least 1 building alive for 10 minutes
- Rewards: teaches attack-move, hold position, marine splitting

**Mission 2 — Establish Perimeter**
- Full build enabled, resource limited
- Build a Barracks + SCV economy before wave 2 hits
- Wave 2 includes Banelings (teaches why you split Marines)
- Rewards: teaches build order and production priorities

**Mission 3 — Total Annihilation**
- Full tech tree available
- Destroy all 3 Zerg Hatcheries scattered across the map
- AI has Lair and Mutalisk harassment
- Teaching moment: air defense, expansions, Siege Tank positioning

### 10.2 — Zerg Campaign (3 missions)

**Mission 1 — Swarm Rising**
- Start with 1 Hatchery, 4 Larva, 4 Drones
- Build SpawningPool → survive 2 Terran attacks with Zerglings
- Teaches: Larva inject, Zergling flood, creep advantage

**Mission 2 — The Bio Shredder**
- Defend Zerg base from Terran Marine push
- Queen inject mechanic introduced with tutorial prompt
- Teaches: Baneling vs Marines (SC2's most satisfying interaction)

**Mission 3 — Consume All**
- Full tech to Lair
- Destroy Terran expansion + main base
- Mutalisk harassment + Roach-Ravager ground attack
- Teaching moment: multi-prong, creep highways, Ravager bile vs walls

### 10.3 — Campaign System

**`src/scenarios/CampaignManager.ts`** — manages mission state, objectives, scripted events.

```typescript
interface MissionObjective {
  type: 'survive' | 'destroy' | 'build' | 'time';
  target?: number; // entity type or building type
  count?: number;
  timeLimit?: number;
  label: string; // "Destroy all Hatcheries (0/3)"
}
```

Scripted events: `{ trigger: 'time' | 'unitDied' | 'buildingBuilt', at: number, action: Function }[]`

**Mission select screen:** Separate HTML page or overlay modal on index.html.

---

## Phase 11 — Polish & Performance at Scale
**200/200 armies that run at 60 UPS.**

### 11.1 — Entity Cap Increase

Current `MAX_ENTITIES = 2048`. For 200/200 armies: increase to 4096.
TypedArray memory cost: doubles from ~256KB to ~512KB (trivial).
Spatial hash already handles 4096 entities efficiently.

### 11.2 — Web Worker Pathfinding

A* for 30+ simultaneous path requests can spike frame time. Move to Web Worker:
- Main thread posts: `{ id, startCol, startRow, endCol, endRow }`
- Worker computes A*, posts back: `{ id, path }`
- Units move straight-line until path arrives (~16ms later), then switch to waypoints
- Up to 16 concurrent path requests processed in background

### 11.3 — Instanced Rendering

PixiJS v8 supports `MeshGeometry` and GPU instancing. For 200 Marines:
- Instead of 200 individual `Graphics` objects: 1 `Graphics` template + 200 instances
- GPU handles positioning
- Expected: 5-10x render speedup for large armies

### 11.4 — LOD (Level of Detail) for distant units

When zoomed far out, draw units as 2px dots instead of full geometry.
```typescript
if (viewport.scale.x < 0.5) {
  // LOD: just dots
  g.circle(posX[eid], posY[eid], 3);
  g.fill({ color: renderTint[eid] });
} else {
  // Full geometry
  drawUnitGeometry(eid, g, gameTime);
}
```

### 11.5 — Sound Design (actual audio assets)

The current Web Audio synthesis sounds functional but not SC2-quality. Add:
- Howler.js for asset management
- Free SC2-inspired sounds from freesound.org (CC0 license)
- Per-unit voice lines (text-to-speech via Web Speech API for humour/accessibility)
- Ambient battlefield sounds (explosions, movement, building hum)

---

## Phase 12 — UI/UX Overhaul
**SC2's UI is a masterpiece of information density.**

### 12.1 — Production Tab

When multiple buildings are selected, show all their queues in a grid (SC2-style):
```
[Barracks 1] [Barracks 2] [Factory 1]
[🔵——— ] [⬜—— ] [🔴———]
  Marine       (idle)     SiegeTank
```

### 12.2 — Army Composition Tooltip

When hovering over the minimap army dot cluster, show a tooltip:
```
Your Army:
  Marines x8    Marauders x3
  SiegeTanks x2 Medivacs x1
  Supply: 43/52
```

### 12.3 — Income Stats in HUD

Show real-time income rate (minerals/min, gas/min) next to resource totals. Helps players understand whether to expand or attack.

### 12.4 — Alert System Improvements

Current: "ENEMY WAVE 3 INCOMING" text alert.

Add:
- Minimap pings with location (red exclamation dots)
- Sound priority: under-attack ping overrides music
- "Base is under attack" for specific buildings taking damage
- Camera-jump offer: clicking the alert snaps camera to the event

### 12.5 — Better Fog of War

Current: Simple dark overlay.

Add:
- Smooth transition from explored (dark) to visible (bright) via alpha lerp
- Terrain visible in explored areas even without current vision (just units/buildings hidden)
- Unit movement trails visible briefly after units leave vision (SC2 "ghost" of last known position)

---

## Sprint Map

```
Phase 1:  Air/Ground targeting (2–3 days)         → All subsequent unit additions require it
Phase 2:  Playable Zerg (1 week)                   → Doubles replay value immediately
Phase 3:  Expanded Terran 6 units (1 week)         → Reaper, Viking, Widow Mine, Cyclone, Thor, BC
Phase 4:  Expanded Zerg 6 units (1 week)           → Ravager, Lurker, Queen, Infestor, Ultralisk, Viper
Phase 5:  Tech Lab/Reactor (3–4 days)              → Real Terran macro depth
Phase 6:  Economy depth (2–3 days)                 → Worker saturation, expansion pressure
Phase 7:  Pathfinding overhaul (3–4 days)          → Flow fields, stuck recovery, Boid swarms
Phase 8:  AI build orders (3–4 days)               → Real strategic variety
Phase 9:  Multiplayer P2P (2 weeks)                → The real SC2 experience
Phase 10: Campaign 6 missions (1–2 weeks)          → Guided onboarding, narrative
Phase 11: Performance at scale (1 week)            → 200/200 armies, Web Worker A*
Phase 12: UI/UX overhaul (1 week)                  → Production tab, income stats, fog quality

Total estimated effort: ~2 months of focused development
```

---

## Priority Stack Recommendation

If only 3 phases ship, ship these:

**1. Air/Ground targeting** — Unblocks everything. Without it, new air units are broken.

**2. Playable Zerg** — The single biggest "wow" factor. Every current player has only ever played Terran.

**3. Multiplayer** — SC2 without multiplayer is a single-player game. This is the difference between "demo" and "game."

Everything else is content and polish that compounds on top of these three.

---

## What "Close to SC2" Actually Means

SC2's genius isn't the unit count — it's the interaction depth between a small number of mechanics:
- **Rock-paper-scissors at every level:** Marines counter Zerglings (splash), Banelings counter Marines (splash), Marauders counter Banelings (armor), Mutalisks counter Marauders (air), Thors counter Mutalisks, Zerglings run under Thors...
- **Macro/micro tension:** You can't do both perfectly. Inject while splitting Marines. The game rewards attention.
- **Information asymmetry:** Fog of war makes scouting have strategic weight.
- **Economic cascade:** One good Baneling bust leads to an entire economic collapse.

The game doesn't need all 31 units. It needs:
- The full damage-type interaction matrix (Phase 1 air/ground + existing Explosive/Concussive)
- 3-4 units per faction that create genuine counters to each other
- A macro mechanic that rewards constant attention (Phase 2 Larva inject)
- Two humans competing (Phase 9 multiplayer)

With Phases 1-3 done, Swarm Command hits ~70% of what makes SC2 feel like SC2.
