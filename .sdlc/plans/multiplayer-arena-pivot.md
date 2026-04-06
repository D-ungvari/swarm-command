# Multiplayer .io Battle Arena Pivot Plan

## Context

Swarm Command is a mature single-player RTS engine with 27 units, 17 buildings, full combat/ability systems, AI, replay, and 219 passing tests. The vision is to **fork the core engine** into a browser-only multiplayer .io battle arena — an **original IP** with **~12 pop-culture-inspired factions**, each with distinct unit rosters and mechanics. Players drop into a shared map, choose a faction, command troops against others, and climb leaderboards.

**Key direction**: Distance from StarCraft. Keep the ECS, combat math, pathfinding, and system architecture. Replace SC2 lore/units/factions with original factions that draw on iconic pop-culture archetypes (sci-fi military, undead hordes, mecha, eldritch horror, etc.).

This plan identifies what to reuse, what to rearchitect, the recommended network model, game design, faction concepts, and a phased roadmap.

---

## 1. Network Architecture: Authoritative Server

**Lockstep (SC2-style) is wrong for .io.** It requires all clients to simulate in sync, can't handle drop-in/drop-out, and stalls on any packet loss. 

**Recommended: Authoritative Node.js server + dumb client rendering.**

```
Browser Client                    Node.js Server (per room)
──────────────                    ────────────────────────
InputManager → InputProcessor
  → simulationQueue
    → WebSocket.send(cmd) ────►   receive(cmd)
                                  validate(cmd, player)
                                  commandSystem(world, cmd)
                                  tick() @ 20Hz (all systems)
                                  for each player:
                                    cull by fog/viewport
                                    delta-compress snapshot
    ◄──── WebSocket.send(snap)
  interpolate between snapshots
  render @ 60fps
```

**Key decisions:**
- **Server tick: 20Hz** (not 60Hz) — RTS units are slow enough; interpolation hides the gap
- **No client prediction** — RTS commands affect many entities; just show command feedback (pings, ack animations) and interpolate server state
- **Binary delta snapshots** — only send changed components for visible entities (~2-5KB/tick/client)
- **WebSocket transport** — simple, browser-native, sufficient for 20Hz RTS

---

## 2. Game Design: Strategic .io Arena

The core strategic triangle — **economy vs army vs tech** — must be a real decision, not flattened away. Different strategies (rush, boom, tech) should all be viable. Simplify the *mechanics* (faster pace, fewer buildings) but preserve the *decisions*.

### The Strategic Triangle

```
        ECONOMY
       /       \
      /  spend   \
     /  minerals  \
    /   on what?   \
ARMY ──────────── TECH
  fast but weak      slow but powerful
```

- **Economy-first**: Invest in expansions/income → more total resources → larger army later. Vulnerable to early aggression.
- **Army-first**: Spend on tier-1/2 units immediately → pressure opponents → deny their economy. Falls off if game goes long.
- **Tech-first**: Rush to tier 3/4 → unlock powerful units → quality over quantity. Vulnerable to timing attacks before tech pays off.

### Economy: Contestable Resource Nodes

**No auto-income.** Instead, the map has **resource nodes** (mineral fields, gas vents) spread across the arena that players must **claim and hold**:

- **Claiming**: Build an Extractor/Refinery on a node. It generates income passively while you hold it.
- **Expansion**: Your base starts near 1-2 nodes. More nodes are scattered across the map in contested territory.
- **Raiding**: Enemy extractors can be destroyed, cutting their income. This is the primary way to hurt economies.
- **Map control = economy**: Holding territory = holding nodes = more income. This creates natural conflict points.

Workers are removed — nodes auto-generate once claimed. This keeps the economy *strategic* (where to expand, when to defend) without the *mechanical* burden of worker micro.

### 4-Tier Tech Tree with Building Chains

Each faction has a building chain that gates progressively stronger units:

```
TERRAN                              ZERG
──────                              ────
Tier 1: Command Center              Tier 1: Hatchery
  → Barracks                          → Spawning Pool
  Units: Marine, Reaper               Units: Zergling, Baneling

Tier 2: Command Center               Tier 2: Hatchery
  → Factory (requires Barracks)       → Roach Warren (requires Pool)
  Units: Marauder, Hellion,           Units: Roach, Hydralisk,
         Siege Tank, Widow Mine              Ravager

Tier 3: Command Center               Tier 3: Lair (Hatchery upgrade)
  → Starport (requires Factory)       → Spire (requires Lair)
  Units: Medivac, Viking,             Units: Mutalisk, Lurker,
         Banshee                             Infestor

Tier 4: Fusion Core (req Starport)   Tier 4: Hive (Lair upgrade)
  Units: Battlecruiser, Thor,         → Greater Spire / Ultralisk Cavern
         Liberator                    Units: Ultralisk, Brood Lord,
                                             Corruptor
```

- Each tier requires building the chain (can't skip Barracks to get Factory)
- Higher-tier buildings cost more and take longer — real investment
- Destroying a tech building removes access to those units (can rebuild)
- ~16 units per faction (curated from current 27 for arena balance)

### Attacking Economies

Multiple ways to hurt opponents economically:

1. **Raid extractors**: Destroy income-generating buildings on resource nodes
2. **Deny expansions**: Control contested nodes, prevent enemy from claiming them
3. **Snipe tech buildings**: Destroy a Factory/Spire to cut off their tier 2-3 production
4. **Base destruction**: Destroying the main base eliminates the player (but they respawn)
5. **Kill rewards**: Destroying enemy units/buildings grants a mineral bounty to the attacker

### Viable Strategies

| Strategy | Early Game | Mid Game | Late Game | Weakness |
|----------|-----------|----------|-----------|----------|
| **Rush** | Mass tier-1 units, attack immediately | Pressure enemy base/extractors | Hope to eliminate before tier 3 | Dies to defensive play + tech |
| **Boom** | Claim 3-4 nodes fast, light defense | Income advantage → mass mid-tier army | Overwhelm with numbers | Vulnerable to early raids |
| **Tech** | Minimal army, fast tier 3-4 buildings | Defend with tier-2 while teching | Tier-4 units dominate | Timing attacks before tech online |
| **Raid** | Fast mobile units (Reaper, Zergling) | Hit-and-run on extractors | Starve opponents of income | Doesn't scale if raids fail |
| **Turtle** | Defensive structures + extractors | Spine/Turret wall, safe tech | Unassailable base, push with late-game army | Loses map control, gets out-expanded |

### Spawn Economy

Players start with **both**: 1-2 pre-claimed starter nodes already producing income **and** a small mineral bank (~100 minerals). This gives immediate income flow plus flexibility to choose whether to rush a Barracks or claim a third node first. Fast onboarding without removing early-game decisions.

### Elimination: Permanent

Once your base is destroyed, you're **out of the match**. You can spectate or join a new room. This creates real stakes — every engagement matters, every raid on your economy is threatening. Higher tension than respawn, and it naturally keeps match sizes manageable as players are eliminated over time.

Matches could support a "last player standing" win condition or a score-based timer (highest score after 15-20 min wins).

### .io Meta-Game

- **Leaderboard**: score = kills + buildings destroyed + time alive + nodes held
- **Permanent elimination**: base destroyed = match over for you (spectate or join new room)
- **Match modes**: Free-for-all last-standing, timed scored rounds (15-20 min), or team-based (2v2v2v2)
- **Kill bounties**: destroying enemy units/buildings grants mineral rewards to the attacker
- **Smaller maps**: 96x96 tiles, 8-16 players, ~20-30 resource nodes per map
- **Match pacing**: Tier 4 reachable in ~8-10 min of uncontested play; raids/pressure slow this down. First eliminations around 5-8 min, matches resolve in 15-25 min.

---

## 2b. Faction Roster (~12 Factions)

The game is its own IP — factions are pop-culture *inspired* but legally distinct. Each has ~8 units across 4 tiers with a unique mechanical identity. Launch with 3-4 factions, expand to 12 over time.

### Launch Factions (MVP) — CONFIRMED

**1. Iron Legion** *(military sci-fi: Starship Troopers, Colonial Marines)*
Combined-arms infantry + vehicles. Medic sustain. The "standard" baseline faction.
Units: Trooper, Grenadier, Medic, Humvee, Siege Tank, Gunship, Titan Walker
*Identity*: Balanced, approachable, strong mid-game.

**2. The Swarm** *(bio-horror: Aliens, Tyranids)*
Cheap expendable waves, Broodmother auto-spawns free drones. Overwhelm with numbers.
Units: Drone, Spitter, Burrower, Broodmother, Ravager, Flyer, Leviathan
*Identity*: Aggression, numbers, expendable. Low skill floor, high skill ceiling with multi-prong attacks.

**3. Arcane Covenant** *(high fantasy: wizards, shielded warriors)*
Expensive but powerful. Regenerating shields, blink assassins, AOE storm spells.
Units: Acolyte, Warden, Enchanter, Blink Assassin, Storm Caller, Golem, Archmage
*Identity*: Quality over quantity. Rewards precise micro. Shield regen punishes hit-and-run.

**4. Automata** *(machines: Terminator, Cybermen, Necrons)*
Self-repairing robots. Reclaim wreckage for resources. Relentless, inevitable.
Units: Sentinel, Shredder, Repair Drone, Crawler, Disruptor, Harvester, Colossus
*Identity*: Attrition. Self-repair + wreckage reclaim means they outvalue opponents in long fights.

### Expansion Factions (post-launch)

**5. The Collective** *(Borg/Flood assimilation)*
Convert enemy units. Adapters copy killed unit's attack type. Overmind mass-controls.

**6. The Risen** *(undead necromancer horde)*
Corpse economy — Necromancers raise fallen units as skeletons. Attrition warfare.

**7. Kaiju Corps** *(Pacific Rim / Godzilla)*
Few but massive units. Each is a mini-boss. Growth = evolving, not mass producing.

**8. Wasteland Raiders** *(Mad Max post-apocalypse)*
Fastest units. Raid economy. Bomber bikes, War Rigs, pillage bonuses.

**9. Celestials** *(divine warriors / angels)*
Flying-heavy roster. Powerful heals. Aura stacking rewards tight formation.

**10. Void Cultists** *(Lovecraft eldritch horror)*
Stealth + debuffs. Whisperers reduce enemy stats. Elder Thing causes friendly fire.

**11. Mech Brigade** *(Gundam / BattleTech mecha)*
Transforming units (walker↔fighter). Pilots eject on death. Peak late-game.

**12. Feral Pack** *(werewolves / primal hunters)*
Almost all melee. Pack bonus (+30% damage when 5+ nearby). Fastest ground units.

### Faction Balance Matrix

| Faction | Speed | Durability | Range | Special Mechanic |
|---------|-------|-----------|-------|-----------------|
| Iron Legion | Med | Med | Med | Medic sustain, combined arms |
| Swarm | Med | Low | Low | Free spawns, overwhelming numbers |
| Arcane Covenant | Low | High (shields) | High | Shield regen, blink, AOE spells |
| Automata | Low | High | Med | Self-repair, wreckage reclaim |
| Collective | Med | Med | Low | Assimilate enemies |
| Risen | Med | Low | Med | Raise corpses as units |
| Kaiju Corps | Low | Very High | Med | Evolve units, not mass produce |
| Wasteland Raiders | Very High | Low | Med | Pillage bonus, hit-and-run |
| Celestials | High (air) | Med | Med | Flying roster, aura stacking |
| Void Cultists | Med | Med | Med | Stealth, debuffs, mind control |
| Mech Brigade | Low | High | High | Transforming modes, pilot eject |
| Feral Pack | Very High | Med | Melee | Pack bonus, gap-closers |

### Implementation Note
The current ECS supports this well — `faction` component becomes `factionId` (0-11), unit stats live in `UNIT_DEFS` keyed by `UnitType` enum. Adding factions = adding entries to the data tables + new UnitType enum values + rendering shapes/colors per faction. The combat/movement/ability systems are faction-agnostic — they operate on component data regardless of faction.

---

## 3. What to Reuse vs Rearchitect

### Reuse Directly (isomorphic — runs on both client and server)
| Module | Path | Notes |
|--------|------|-------|
| ECS core | `src/ecs/world.ts` | Pure data, no DOM/PixiJS deps |
| Queries + SpatialHash | `src/ecs/queries.ts`, `src/ecs/SpatialHash.ts` | Read-only, already efficient |
| All game systems | `src/systems/Movement,Combat,Ability,Death,Build,Production,Upgrade,Morph,Creep,Detection` | Pure functions of `(world, dt, ...)` — no rendering imports |
| Unit/building data | `src/data/units.ts`, `src/data/buildings.ts` | Static config tables |
| Constants/types | `src/constants.ts`, `src/types.ts` | Enums, interfaces |
| Pathfinding | `src/map/Pathfinder.ts`, `src/map/MapData.ts` | Pure JS `pathfinding` lib |
| Command types | `src/input/CommandQueue.ts` | `GameCommand` type = network protocol foundation |
| SeededRng | `src/utils/SeededRng.ts` | LCG PRNG, server-owned seed |

### Client-Only (no changes needed)
| Module | Path |
|--------|------|
| Rendering | `src/rendering/*` (UnitRenderer, TilemapRenderer, SelectionRenderer, etc.) |
| Input | `src/input/InputManager.ts`, `src/input/InputProcessor.ts` |
| Selection | `src/systems/SelectionSystem.ts` |
| Audio | `src/audio/*` |
| UI | `src/ui/*` |

### Must Rearchitect
| Area | Problem | Solution |
|------|---------|----------|
| **Game.ts** (2300 lines) | God class mixes simulation + rendering + input + lifecycle | Split into `Simulation` (server) + `ClientGame` (browser) |
| **Component globals** (`components.ts`) | TypedArrays are module-level singletons; server needs one per room | Wrap in `ComponentStore` class, or use `setActiveStore()` swap pattern |
| **Faction system** | Hardcoded Terran(1) vs Zerg(2), single `activePlayerFaction` global | Add `ownerPlayerId` component (Uint8), map player→faction on join |
| **FogSystem** | Single global `fogGrid` for one player | Per-player fog grids on server; cull snapshots by visibility |
| **CommandSystem** (1486 lines) | Trusts all commands implicitly | Add ownership validation + affordability checks on server |
| **GatherSystem** | Worker-based mining | Replace with `NodeEconomy` system: claimable resource nodes with extractors, passive income while held |

---

## 4. Phased Roadmap

### Phase 0: Extract Simulation from Game.ts
**Goal**: Headless simulation that runs on Node.js

- Create `src/simulation/Simulation.ts` — extract from Game.ts:
  - World creation, entity spawning, `tick()` method, all system calls
  - Resource state, game time, tick count
  - Zero PixiJS/DOM/Viewport references
- Create `src/simulation/ComponentStore.ts` — instance-based wrapper for TypedArrays
  - Intermediate approach: `setActiveStore(store)` swaps global arrays (avoids rewriting every system import)
- Refactor `Game.ts` to own a `Simulation` instance + rendering + input
- **All 219 tests must still pass** against `Simulation` directly

**Critical files**: `src/Game.ts`, `src/ecs/components.ts`

### Phase 1: Two-Player Networked Proof of Concept
**Goal**: Two browser tabs fighting each other via server

- Create `server/` directory with Node.js WebSocket server
- `server/GameRoom.ts` — owns a `Simulation`, ticks at 20Hz
- Client sends `GameCommand` objects over WebSocket (already well-typed)
- Server broadcasts full state snapshots to both clients
- Client renders from snapshots (no prediction)
- Each client gets a player ID mapped to a faction

**New files**: `server/GameServer.ts`, `server/GameRoom.ts`, `server/NetProtocol.ts`

### Phase 1.5: Replace SC2 Content with Original Factions
**Goal**: Rebrand from StarCraft to original IP

- Define new `FactionId` enum (0-11) replacing Terran/Zerg
- Create unit data tables for 4 launch factions (Iron Legion, Swarm, Arcane Covenant, Automata)
- ~8 units per faction across 4 tiers, each with distinct stats and abilities
- New rendering shapes/colors per faction (geometric style already supports this)
- Rename all SC2-specific references (Marine → Trooper, Zergling → Drone, etc.)
- Update building chains per faction (faction-specific names, same 4-tier structure)

**Critical files**: `src/constants.ts`, `src/data/units.ts`, `src/data/buildings.ts`, `src/types.ts`

### Phase 2: Multiplayer Arena Foundation
**Goal**: N players in shared arena with strategic .io economy

- `ownerPlayerId` component (Uint8) + multi-faction routing (player chooses from 4 launch factions)
- **Node economy system**:
  - Resource nodes placed on arena map (~20-30 per map)
  - Extractor building on nodes → passive income while held
  - Destroying enemy extractors cuts their income
  - Kill/destruction bounties (mineral reward to attacker)
- **4-tier tech tree**: Building chain validation per faction
- `SpawnManager`: assign spawn positions near 1-2 pre-claimed starter nodes + 100 mineral bank; handle permanent elimination (base destroyed = match over, spectate or leave)
- Per-player fog of war: server-side visibility culling
- Delta state compression: only send changed components since last ack
- Arena map generation: spawn zones for 8-16 players, contested resource nodes in between
- Player disconnect/reconnect handling

### Phase 3: Client Polish
**Goal**: Smooth experience despite latency

- Entity interpolation: buffer 2-3 server snapshots, lerp positions
- Command feedback: immediate visual acks (move pings, unit flash)
- Health bar smoothing, camera auto-center on spawn
- Kill feed, player count, minimap showing territories
- Mobile touch support (existing `TouchCommandBar` as foundation)

### Phase 4: .io Features
**Goal**: Full .io game experience

- Lobby/matchmaking: join available rooms or auto-create
- Leaderboard: per-room scoreboard + persistent high scores (Redis/SQLite)
- Player names on join
- PvE: neutral creep camps that drop bonus resources (reuse AISystem)
- Cosmetic progression: unit color tints, XP system
- Analytics: match stats, popular units, game duration

### Phase 5: Scale & Harden
**Goal**: Production infrastructure

- Multi-room management on single server
- Anti-cheat: server validates ownership, affordability, rate limits
- Spectator mode (read-only all-visible client)
- Load testing with 50 players, optimize hot paths
- CDN for static assets, WebSocket server on fly.io/railway

### Phase 6: Faction Expansion
**Goal**: Grow from 4 launch factions to full 12-faction roster

- Add 2 factions per release cycle (Risen + Collective, then Kaiju + Raiders, etc.)
- Each new faction = ~8 unit defs + building chain + 1-2 unique mechanics
- Balance via playtesting data (analytics from Phase 4)
- Faction-specific tutorials/challenges
- Community feedback on faction feel and balance

---

## 5. Key Technical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Component store refactor** — 15+ files import global TypedArrays | HIGH | Use `setActiveStore()` swap pattern first; avoid rewriting all system signatures |
| **Game.ts decomposition** — 2300-line god class | HIGH | Clear boundary: `tick()` internals = simulation, `render()`/`loop()` = client |
| **Pathfinding perf on server** — A* on 128x128 with 50 players | MED | Use 64x64 maps, cache aggressively, throttle to N paths/tick, reuse PF.Grid |
| **Snapshot bandwidth** — 500+ entities at 20Hz | MED | Delta compression, fog culling, viewport culling, quantize positions to uint16 |
| **Float determinism** | LOW | Non-issue — authoritative server is single source of truth, no lockstep needed |

---

## 6. Verification Plan

After each phase:
- **Phase 0**: Run `npm test` — all 219 tests pass. Run `Simulation` headlessly in Node.js with scripted commands, verify tick output matches single-player.
- **Phase 1**: Open two browser tabs → both connect → issue move/attack commands → units respond on both screens. Measure round-trip latency.
- **Phase 2**: Join 4+ clients → each spawns with base + 2 pre-claimed nodes + 100 minerals → claim contested nodes → income flows → armies fight → raid extractors to hurt economy → tech up through 4 tiers → base destroyed = eliminated (spectate) → last standing wins → leaderboard updates.
- **Phase 3**: Add 100ms artificial latency → movement still looks smooth → command feedback is instant.
- **Phase 4**: Full playtest: join, name, fight, die, respawn, climb leaderboard, leave, rejoin.
