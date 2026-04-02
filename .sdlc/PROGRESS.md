# Progress

## Product Vision
**SC2 Mechanics Practice Tool** — like mechanics.gg for LoL skillshots, but for StarCraft 2.

## Current Phase
IDLE — Tier 0/1/2 backlog CLEAR

## All Shipped (cumulative across all sessions)

### Foundation (original sprints 1-13 + gap fixes 30-40 + ULTRAPLAN phases 1-12)
- Hand-rolled ECS, fixed timestep, PixiJS v8 renderer
- 29 units (13 Terran + 16 Zerg), air/ground targeting
- Playable Terran OR Zerg, AI plays opposite faction
- Damage types, armor, upgrades (6 tracks), abilities (Yamato, Bile, Fungal, Abduct, Cloak)
- Fog of war, minimap, camera shake, projectile visuals, death animations
- Deterministic seeded RNG, command recorder, replay save/load
- Mobile touch support, 4 difficulty levels, 3 map layouts
- GitHub Actions CI/CD deploy

### Practice Tool (PT sprints)
- SC2 stat accuracy audit (55 corrections vs Liquipedia)
- 14 practice scenarios (Marine Split, Baneling Bust, Tank Drop, etc.)
- Build order data (5 build orders)
- Scenario result screen with S/A/B/C/D grading
- Start screen pivoted to "PRACTICE SCENARIOS" as primary action

### Iteration A — Selection UI
- Ctrl+click type-filter, control group indicator strip (1-9), tab breadcrumb display

### Iteration B — AI Overhaul
- Base defense (peels 40% army to intercept), faster pressure (4-unit first wave)
- Army routes through map center (visible crossing), 2 permanent harassment squads
- Vanguard at map center, reactive threat assessment, Queen auto-inject
- AI auto-builds 5 buildings as waves progress, Ultralisk at wave 12+

### Iteration C — Visual Overhaul
- Marine 22-layer redesign (pauldrons, T-visor, Gauss rifle, breathing animation)
- 11 colour palette constants codified
- Every unit visually upgraded (Queen redesign, Ultralisk blades, Infestor spores, etc.)
- Crystal mineral clusters, gas jets, segmented health bars, SC2 selection brackets

### Iteration D — Audio
- Voice lines (Speech API), positional fade, 6 ability sounds, adaptive music drone

### Iteration E — Game Systems
- Veterancy system (kills → stars → stat bonuses)
- Turbo mode, F9 fog toggle, camera soft nudge toward combat

### Iteration F — Tech Tree
- Prerequisite labels, locked building flash, 4 new Zerg buildings, production gating

### Iteration H — Campaign
- 10 campaign missions (5 Terran + 5 Zerg), mission select screen, localStorage unlock progression

### Iteration I — Map Editor
- Tile painting canvas, Ground/Water/Rock/Destructible tools, save/load to localStorage

### Iteration L — Competitive
- 8 achievements with localStorage persistence and toast notifications
- 3 win conditions (Destroy All, Timed Survival, Economy)

### Iteration AA — Start Menu
- Difficulty visual cards (replaced dropdown with EASY/NORMAL/HARD/BRUTAL cards)
- README rewritten for practice tool positioning

## Remaining (out of scope, Tier 3+)
- Multiplayer (WebRTC signaling server, lockstep loop, lobby UI)
- Protoss faction
- More content (Banshee, Liberator, Brood Lord, Swarm Host)
- AI Director, ranked MMR, modding, analytics, native apps, engine OSS

## Stats
- 197 tests passing, 0 TypeScript errors
- ~50 commits across these sessions
- Game live at https://d-ungvari.github.io/swarm-command/
