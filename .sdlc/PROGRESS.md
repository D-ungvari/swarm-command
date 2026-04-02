# Progress

## Product Vision
**SC2 Mechanics Practice Tool** — like mechanics.gg for LoL skillshots, but for StarCraft 2.
True SC2 unit stats. Browser tab. No install. No account. Opens in 2 seconds.

## Current Phase
IN PROGRESS — Sprint PT.1: SC2 stat accuracy audit

## Current Work
### Sprint PT.1: Verify all unit stats vs SC2 wiki
- [ ] Audit Marine, Marauder, Reaper, Ghost, SCV vs SC2 values
- [ ] Audit SiegeTank (mobile + siege), Hellion, Medivac
- [ ] Audit Zergling, Baneling, Roach, Hydralisk, Mutalisk vs SC2 values
- [ ] Fix any mismatches in `src/data/units.ts`
- [ ] Add damage type accuracy note (Normal/Concussive/Explosive multipliers match SC2)

## Sprint 1 Completed ✅
- F.1: Prereq labels ("Req: Barracks") on locked build menu slots
- F.2: Flash + "Build X first" tooltip on locked key press
- F.4: RoachWarren/HydraliskDen/Spire/InfestationPit defined + Zerg build menu
- F.5: Production buttons gated by tech (Infestor needs InfestationPit etc.)
Commit: 47dc8e6

## Scope
Tier 0 and 1 only (Sprints 1–55 + PT sprints). Tier 2+ only where it serves the practice tool.
