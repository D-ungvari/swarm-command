# Log: Sprint 1 — Input Architecture Overhaul
Started: 2026-04-01T00:00:00Z

## PLAN

### Goal
Eliminate click loss and input latency by decoupling input processing from the simulation tick rate.

### Architecture
Current: DOM events → boolean flags → InputState → tick() → systems read InputState
Target: DOM events → pendingMouseEvents[] → InputProcessor (per frame) → GameCommandQueue → selectionQueue (instant) + simulationQueue (per tick)

### Steps
1. Create `src/input/CommandQueue.ts` — CommandType enum, GameCommand interface, GameCommandQueue class
2. Modify `src/input/InputManager.ts` — replace boolean buffers with event array; expose rawMouseEvents getter + clearPendingEvents() + consumePendingEvent()
3. Create `src/input/InputProcessor.ts` — converts raw events to GameCommands each frame, tracks attackMovePending state
4. Modify `src/Game.ts` — restructure loop(), wire commandQueue/inputProcessor, add applySelectionCommands(), remove manual flag-clearing
5. Modify `src/systems/SelectionSystem.ts` — consume GameCommand[] instead of InputState
6. Modify `src/systems/CommandSystem.ts` — consume GameCommand[] instead of InputState, remove attackMoveMode export
7. Modify `tests/helpers.ts` — add CommandType plain-object mirror
8. Create `tests/systems/CommandQueue.test.ts`
9. Create `tests/systems/InputProcessor.test.ts`
10. Create `tests/systems/SelectionSystem.test.ts`

### Key Design Decisions
- Two queues: selectionQueue (frame-rate) + simulationQueue (tick-rate)
- snapshotSelection() in InputProcessor captures selected units at click time
- handleMinimapClick() + handleBuildPlacement() run BEFORE InputProcessor to preserve consume-by-mutation pattern
- attackMoveMode moves to InputProcessor.isAttackMovePending getter
- Tab key stays on InputState in SelectionSystem (low-risk, not causing click loss)
- const enum needs plain-object mirror in tests/helpers.ts (existing pattern)

### Risk Areas
- attackMoveMode import in SelectionSystem + Game.ts render path must be updated
- handleBuildPlacement() / handleMinimapClick() must call consumePendingEvent() alongside m.xxx = false mutations
- Two ticks in one frame: second tick gets empty simulationQueue (correct)
- snapshotSelection() timing: selection commands applied inline before simulationQueue snapshot

## DEV
