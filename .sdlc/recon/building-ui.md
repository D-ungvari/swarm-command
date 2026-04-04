---
subsystem: Building Selection UI & Info Panel
last_verified: 2026-04-05
created_for: Implement proper clickable building UI with visual units, upgrades, options
files_in_scope: src/rendering/InfoPanelRenderer.ts, src/rendering/BuildMenuRenderer.ts, src/rendering/PortraitRenderer.ts, src/Game.ts, src/data/buildings.ts, src/data/units.ts, src/systems/UpgradeSystem.ts
---

## Recon: Building Selection UI

**Codebase patterns:** All UI is DOM-based (`document.createElement`), inline CSS via `style.cssText`, callbacks registered via setter methods. Portraits are Canvas 2D pre-rendered at 44x44px and cached. Production buttons are 42x42px with flex grid layout. Panel at `position: fixed; bottom: 16px; left: 12px`. Pointer events: panel `none`, button rows `auto`.

### Files in scope
| File | Purpose | Key patterns |
|------|---------|-------------|
| InfoPanelRenderer.ts | Bottom info panel — production/research/addon/ability buttons | 1049 lines, callbacks for each action type, `update()` per frame |
| BuildMenuRenderer.ts | B-key build menu — building placement options | 249 lines, 9 slots, affordability + tech-lock states |
| PortraitRenderer.ts | 44x44 Canvas 2D unit portraits, cached | Map<number, Canvas>, `getPortrait(unitType)` |
| Game.ts | Wires callbacks, handles production/research/addon clicks | `handleProductionButtonClick()` at ~line 1913 |
| buildings.ts | BuildingDef data — produces[], costs, requirements | Record<number, BuildingDef> |
| units.ts | UnitDef data — costs, names, colors, supply | Record<number, UnitDef> |
| UpgradeSystem.ts | Upgrade costs, encode/decode, completion | UPGRADE_COSTS, encodeResearch() |

### Architecture context
- Production buttons exist and work — `updateProductionButtons()` creates 42x42 divs with click handlers
- Research buttons exist for EngBay/EvoChamber — `updateResearchButtons()`
- Addon buttons exist for Barracks/Factory/Starport — `updateAddonButtons()`
- Ability buttons exist for selected units — uses UNIT_ABILITIES mapping
- Queue display shows text labels only — `updateQueueDisplay()`
- PortraitRenderer has pre-rendered 44x44 canvases for all unit types
- Callbacks: setProductionCallback, setResearchCallback, setAddonCallback, setAbilityCallback

### Adjacent files (DO NOT MODIFY)
- SelectionSystem.ts — handles selection logic, not UI
- CommandSystem.ts — handles command execution
- ProductionSystem.ts — handles production timer advancement
- CombatSystem.ts — unrelated

### Existing test coverage
- No direct tests for InfoPanelRenderer or BuildMenuRenderer
- Tests exist for AI production queuing (AISystem.test.ts)
