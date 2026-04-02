# Progress

## Product Vision
**SC2 Mechanics Practice Tool** — true SC2 numbers, browser-based, no install.

## Current Phase
READY FOR CORRECTIONS — Apply AUDIT_CORRECTIONS.md

## What to do next
Run `/orchestrate` to apply ALL corrections from `AUDIT_CORRECTIONS.md`:
1. Add `baseArmor` field to UnitDef + set per-unit SC2 values (14 units)
2. Fix multi-shot damage (Reaper 4→8, Viking 10→20, Thor 30→60)
3. Fix siege mode (damage 35→40, add +30 vs Armored, radius 1.5→1.25, pack time 2→2.7)
4. Fix ability constants (stim 7→11s, medivac heal 3→9, inject 4→3 larva, bile radius 2→0.5)
5. Fix armor classes (Medivac/Overlord/Infestor/Viper → Armored)
6. Fix unit speeds (Hydralisk/Roach 2.8→3.15, Ravager 3→3.85, Infestor 2.25→3.15)
7. Fix all building build times and costs
8. Fix Fungal Growth (root→75% slow, 30→25 dmg, 4→3s duration)

## 198 tests passing. 0 TypeScript errors.
