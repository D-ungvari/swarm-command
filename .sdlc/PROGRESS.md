# Progress

## Current Phase
SESSION HANDOFF — Backlog #1-5 complete

## Current Work
(none)

## Session Handoff
- **Completed this session:** Backlog #5 (AI opponent)
- **Previously completed:** Backlog #1-4
- **Next session should:** Pick up Backlog #6 (Minimap + unit info panel)
- **No blockers**

## Git Log
- 803a29d feat: add AI opponent with Zerg unit spawning and attack waves
- bad3b01 feat: add buildings & production system
- 520faeb feat: add economy system with mineral gathering
- 79ac303 feat: initial commit — engine foundation, combat, abilities

## Architecture Notes
- System order: selection → command → build → production → movement → combat → ability → gather → death → AI
- 13 component bits used, 19 remaining
- AI is a "cheating AI" with simulated mineral income and direct unit spawning
- Attack waves: accumulate army → attack-move to player CC → reset cycle
- 123 tests across 8 test files
