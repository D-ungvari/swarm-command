# Log: AI opponent — build orders, attack waves
Started: 2026-03-30

## PLAN
### Scope
- Cheating AI controlling Zerg faction
- Virtual mineral income (simulates workers)
- Direct unit spawning at Zerg base area
- Attack waves when army reaches threshold
- Progressive difficulty (larger waves, faster income)
- Single medium difficulty

### Key decisions
- Module-level state in AISystem.ts (no new ECS components)
- Decision tick every 30 frames (0.5s) for performance
- Army tracked via Set<number> of entity IDs
- 30s initial delay before AI starts
- Attack threshold: 8 + 3*waveCount (capped at 25)
- Spawn 1 unit per decision tick max
- Zerg supply set to 200 (effectively unlimited)
- Remove hardcoded Zerg demo units, AI spawns organically

## DEV
