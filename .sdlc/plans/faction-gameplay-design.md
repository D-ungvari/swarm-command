---
scope: Faction Gameplay Design — 4 MVP Detailed + 12-Faction Mechanical Identity Matrix
created: 2026-04-06
backlog_items: T1, T13, T14, T15, T16
task_count: 0 (design document — feeds into existing implementation tasks)
status: READY
target_repo: D-ungvari/rts.io
---

# Faction Gameplay Design Document

## Design Philosophy

Every faction must answer three questions differently:
1. **How do I win fights?** (combat identity)
2. **How do I generate advantage?** (economic identity)
3. **What am I afraid of?** (counterplay identity)

If two factions answer the same way to any two of these, they're too similar.

---

## Part 1: 12-Faction Mechanical Identity Matrix

Each faction occupies a unique coordinate in design space. No two factions share the same primary mechanic or the same strategic profile.

### The Five Design Axes

| Axis | Range | What it measures |
|------|-------|-----------------|
| **Army model** | Swarm ← → Elite | Many cheap units vs few expensive ones |
| **Tempo** | Rush ← → Greed | How early can/should you attack |
| **Economy** | Standard ← → Alternative | How reliant on extractors vs other income |
| **Engagement style** | Commit ← → Harass | All-in deathball vs hit-and-run |
| **Recovery** | Fragile ← → Resilient | How devastating is losing a fight |

### Full 12-Faction Map

| # | Faction | Army | Tempo | Economy | Engage | Recovery | Primary Mechanic | Counter Profile |
|---|---------|------|-------|---------|--------|----------|-----------------|-----------------|
| 1 | **Iron Legion** | Balanced | Mid | Standard | Push | Medium | Medic sustain | Vulnerable to burst damage that kills before healing matters |
| 2 | **The Swarm** | Swarm | Rush | Standard + free spawns | Multi-prong | High | Broodmother auto-spawns free units | Vulnerable to AoE splash that kills many cheap units |
| 3 | **Arcane Covenant** | Elite | Greed | Standard (expensive) | Controlled | Low | Shields regen between fights | Vulnerable to all-in pressure before shields matter, EMP |
| 4 | **Automata** | Balanced | Greed | Standard + wreckage | Siege/grind | Very High | Self-repair + wreckage reclaim | Vulnerable to fast aggression before repair value accrues |
| 5 | **The Collective** | Adaptive | Mid | Standard + converted units | Targeted picks | High | Assimilate enemy units to grow army | Vulnerable to homogeneous armies (nothing worth stealing) |
| 6 | **The Risen** | Swarm (secondary) | Mid-Late | Standard + corpse economy | Commit (wants big battles) | Paradoxical | Raise all dead (yours + theirs) as skeleton army | Vulnerable to avoiding fights (denying corpses) |
| 7 | **Kaiju Corps** | Ultra-Elite | Late | Standard (few expensive) | Commit (each unit matters) | Very Low | Units evolve/level up during combat | Vulnerable to focus-fire + kiting (each loss devastating) |
| 8 | **Wasteland Raiders** | Harass | Rush | Standard + pillage bonus | Hit-and-run | High | Pillage: +50% minerals from destroying enemy buildings | Vulnerable to static defense and slow-push deathballs |
| 9 | **Celestials** | Formation | Mid | Standard | Formation push | Medium | Aura stacking: +bonuses when units are grouped | Vulnerable to AoE that punishes clumping |
| 10 | **Void Cultists** | Stealth | Mid | Standard | Ambush | Medium | Most units permanently cloaked + debuff spells | Vulnerable to detection + AoE reveals |
| 11 | **Mech Brigade** | Versatile | Mid-Late | Standard + pilot salvage | Adaptive | High | Transform modes (ground ↔ air) + pilot eject | Vulnerable to early pressure before transforms researched |
| 12 | **Feral Pack** | Rush | Rush | Standard | All-in commit | High | Pack bonus: +30% damage with 5+ nearby allies | Vulnerable to kiting, terrain chokes, AoE |

### Uniqueness Verification

No two factions share the same **primary mechanic**:
- Free units (Swarm) vs raised dead (Risen) vs converted enemies (Collective) — three different "bonus army" mechanics
- Self-repair (Automata) vs medic heal (Legion) vs shield regen (Arcane) vs aura heal (Celestials) — four different sustain models
- Stealth (Void) vs burrow (Swarm's one unit) — different scale entirely
- Speed (Raiders) vs speed (Feral Pack) — Raiders are ranged vehicles, Pack is melee ground
- Transform (Mech Brigade) vs siege mode (Legion's one unit) — different scope

### Matchup Triangle (Simplified)

```
            RUSH/AGGRO
           /     |     \
      Swarm   Raiders   Feral Pack
         \      |      /
          \     |     /
     beats: Greed factions
           /     |     \
      Arcane  Automata  Kaiju
         \      |      /
          \     |     /
     beats: Harass/Fragile
           /     |     \
      Legion  Celestials  Mech Brigade
         \      |      /
          \     |     /
     beats: Rush factions (with sustained army)
```

**Special matchup disruptions:**
- Collective beats diverse armies, loses to mono-composition
- Risen wants big fights, loses to economic strangulation
- Void Cultists beat unprepared opponents, lose to detection investment

---

## Part 2: Detailed MVP Faction Gameplay

---

## IRON LEGION — "The Reliable Backbone"

### Strategic Identity
**How they win:** Sustained combined-arms pushes. Medics keep the army alive through attrition. Mixed infantry/vehicle/air compositions adapt to any threat. Jack of all trades, master of none — but the Medic makes their average army fight above its weight.

**How they generate advantage:** Standard economy. Medic healing creates a "virtual HP" advantage — a Trooper that gets healed 3 times has effectively 200 HP over a fight. Players who micro Medics well get exponentially more value.

**What they fear:** Burst damage that kills units before healing matters (Storm Caller, Disruptor EMP, Leviathan splash). If a unit dies in one hit, the Medic wasted its potential.

### Faction Personality
Iron Legion is the **beginner-friendly baseline**. Easy to pick up, hard to master. The skill ceiling comes from army composition decisions and Medic micro. A new player can just build Troopers and push. A veteran mixes Grenadiers for AoE, Siege Tanks for sieging, Gunships for air control, and microes Medics to keep everything alive.

### Unit Roles (Detailed)

#### T1: Trooper (basic ranged infantry)
- **Role:** Frontline DPS. Cheap, expendable, good against everything.
- **Stats:** 50 HP, 7 dmg, 5 range, 650ms cooldown, 50m, supply 1
- **DPS:** 10.8/s
- **Identity:** The bread-and-butter. Always useful, never the best answer.
- **Ability — Stim Pack** (active, research required):
  - Cost: 10 HP self-damage
  - Effect: +50% move speed, +40% attack speed for 8 seconds
  - Cooldown: 15s
  - **Design intent:** Rewards micro. Stimmed Troopers destroy un-stimmed ones. But HP cost means you can't use it forever — Medics offset the cost.
  - **Interaction with Medic:** Medic heals the Stim damage. This is the core Iron Legion synergy.

#### T1: Grenadier (splash damage anti-swarm)
- **Role:** AoE counter. Destroys clumped cheap units.
- **Stats:** 75 HP, 12 dmg + 8 vs Light, 4 range, 1200ms cooldown, 0.8 tile splash, 75m/25g, supply 2
- **DPS:** 10/s (16.7 vs Light)
- **Identity:** Hard-counter to Swarm Drones and Feral Pack. Useless against single heavy targets.
- **No ability.** Grenadiers are simple and effective.

#### T2: Medic (healer)
- **Role:** Force multiplier. Zero combat value, immense sustain value.
- **Stats:** 60 HP, no damage, 75m/50g, supply 1
- **Ability — Heal Aura** (passive):
  - Effect: Heals nearest injured friendly ground unit within 4 tiles at 9 HP/s
  - Cannot heal self. Cannot heal air units. Cannot heal buildings.
  - **Design intent:** Medics must be protected. They're the backbone — losing your Medics collapses the sustain advantage. But they only heal one target at a time, so burst AoE still kills through healing.
  - **Micro depth:** Position Medics behind frontline. If Medics die, retreat and rebuild.

#### T2: Humvee (fast light vehicle)
- **Role:** Scout, raider, anti-light. Fast enough to run down fleeing units.
- **Stats:** 90 HP, 8+4 vs Light dmg, 5 range, 500ms cooldown, speed 4.5, 100m/50g, supply 2
- **DPS:** 16/s (24 vs Light)
- **Identity:** Speed demon. Patrols extractors, chases retreating units, scouts enemy base. Can't fight heavy units.
- **No ability.** Speed IS the ability.

#### T2: Siege Tank (deployable artillery)
- **Role:** Siege/defense. Locks down chokepoints, breaks fortified positions.
- **Stats:** 160 HP, 15+10 vs Armored dmg, 7 range, 1800ms cooldown, 150m/100g, supply 3
- **DPS (mobile):** 8.3/s (13.9 vs Armored)
- **Ability — Siege Mode** (toggle):
  - Deploy time: 2 seconds (immobile during transition)
  - Sieged stats: 30 damage, 13 range, 1.25 tile splash radius, 2500ms cooldown
  - Sieged DPS: 12/s with splash (devastating to clumped ground)
  - Cannot move while sieged. Must un-siege to reposition (2s).
  - **Design intent:** Positional play. Set up Siege Tanks behind Trooper/Grenadier frontline. Force opponents to engage into your kill zone. But the 2s deploy makes bad positioning punishing.

#### T3: Gunship (air-to-everything)
- **Role:** Air superiority + ground harassment. Only air unit.
- **Stats:** 140 HP, 12 dmg, 6 range, 800ms cooldown, speed 3.5, air, 200m/150g, supply 3
- **DPS:** 15/s
- **Ability — Boost** (active):
  - Effect: +50% speed for 4 seconds. 20s cooldown.
  - **Design intent:** Escape or chase. Boost into enemy base for extractor raids, or boost away from anti-air. Pairs with Trooper Stim for coordinated all-ins.

#### T4: Titan Walker (heavy mech)
- **Role:** Army anchor. The "I win more" unit. Doesn't win on its own but tips any battle.
- **Stats:** 500 HP, 25+15 vs Armored dmg, 8 range, 1500ms cooldown, 1.0 splash, 400m/300g, supply 6
- **DPS:** 16.7/s (26.7 vs Armored) + splash
- **No active ability.** Just raw stats. Design intent: Titan Walker is the reward for teching to T4. It's not flashy, just incredibly effective. The skill test is getting one out alive.

### Build Order Patterns

**Rush build (vs Arcane/Automata):**
1. Barracks → 3 Troopers → 2nd Barracks → 5 more Troopers → attack at 3-4 minutes
2. Goal: Kill before shields/self-repair generate value

**Standard build (most matchups):**
1. Barracks → 2 Troopers → Extractor → 2 Medics → War Factory → Humvee patrol → expand
2. Mid-game: 2 Barracks + War Factory sustain. Mix Troopers + Grenadiers + Medics.

**Tech build (vs Swarm):**
1. Barracks → Grenadier → 2nd Grenadier → expand → War Factory → Siege Tank
2. Goal: Grenadiers counter Drone swarm. Siege Tanks lock down expansions.

### Faction Upgrades (4-6)
| Name | Building | Cost | Time | Effect |
|------|----------|------|------|--------|
| Infantry Weapons +1/+2/+3 | Barracks | 100/150/200m | 60/70/80s | All infantry +1/+2/+3 damage |
| Infantry Armor +1/+2/+3 | Barracks | 100/150/200m | 60/70/80s | All infantry +1/+2/+3 armor |
| Stim Pack Research | War Factory | 100m/50g | 80s | Unlocks Trooper Stim ability |
| Advanced Targeting | Airfield | 150m/100g | 90s | +1 range to Siege Tank (mobile), +1 range to Gunship |

---

## THE SWARM — "The Relentless Tide"

### Strategic Identity
**How they win:** Overwhelming numbers. Cheapest units in the game. Multi-prong attacks that abuse map control. Broodmother spawns free Drones that pad army size without production cost. If a Swarm player is spending their minerals, they always have more units on the field.

**How they generate advantage:** Economy of expendability. Drones cost 25m (half of a Trooper). Broodmothers generate free units. A Swarm player can trade 3 Drones for 1 Trooper and come out ahead economically. Volume creates map pressure: attack two extractors at once, defend one.

**What they fear:** AoE splash damage. Grenadiers, Siege Tanks, Storm Callers destroy Drone packs. A single Grenadier kills 3 Drones per volley. Detection also hurts — Burrower ambushes are the skill expression, and getting scouted ruins them.

### Faction Personality
The Swarm is the **aggression faction**. Low floor (just make Drones), medium ceiling (multi-prong attacks, Burrower ambushes, Broodmother positioning). Rewards players who think about map control and harass timing rather than army composition perfection.

### Unit Roles (Detailed)

#### T1: Drone (cheap melee disposable)
- **Role:** Expendable frontline. Trade efficiently against expensive units through volume.
- **Stats:** 30 HP, 5 dmg, 0.5 range (melee), 500ms cooldown, speed 4.0, 25m, supply 0.5
- **DPS:** 10/s (surprisingly high for the cost)
- **Identity:** The Zergling of rts.io. 2 Drones cost 50m = 1 Trooper. But 2 Drones do 20 DPS vs Trooper's 10.8. Mass wins if they close the gap.
- **No ability.** They're cannon fodder. Their ability is being cheap.
- **Key stat interaction:** Supply 0.5 means you can field 2× as many per supply as most factions.

#### T1: Spitter (ranged acid)
- **Role:** Ranged support. Cheaper than Trooper but fragile. Provides anti-air.
- **Stats:** 35 HP, 8 dmg, 5 range, 900ms cooldown, speed 3.0, 40m/10g, supply 1
- **DPS:** 8.9/s
- **Identity:** The "I need some range" answer. Mix 1 Spitter per 4 Drones for anti-air coverage.

#### T2: Burrower (stealth ambush)
- **Role:** Ambusher. Burrows invisible, un-burrows for devastating first strike.
- **Stats:** 80 HP, 20+5 vs Light dmg, 0.5 range (melee), 1200ms cooldown, speed 3.5, 75m/25g, supply 2
- **DPS:** 16.7/s (20.8 vs Light) normal, **33.3/s first attack** (ambush bonus)
- **Ability — Burrow** (toggle):
  - Burrowed: invisible, immobile, regenerates 3 HP/s
  - Unburrow: instant, first attack deals **2× damage** (40+10 vs Light = 50 burst!)
  - Cannot be targeted while burrowed unless enemy has detection
  - **Design intent:** Place Burrowers along enemy patrol routes or under extractors. Un-burrow when enemy walks over → devastating alpha strike. Detection hard-counters this.
  - **Micro depth:** Pre-place 3-4 Burrowers in a triangle around an extractor. When enemy raids, un-burrow all simultaneously = instant 150+ damage burst.

#### T2: Broodmother (free unit spawner)
- **Role:** Economy engine. Immobile support that spawns free Drones.
- **Stats:** 120 HP, no damage, speed 2.0, 100m/50g, supply 2
- **Ability — Brood Spawn** (passive):
  - Spawns 1 free Drone every 8 seconds
  - Max 4 active Brood Drones per Broodmother (when one dies, slot opens)
  - Brood Drones are identical to regular Drones but don't cost supply
  - Broodmother is slow and fragile — needs to be behind the frontline
  - **Design intent:** The Swarm's economic engine. A Broodmother generates ~150m worth of free Drones per minute (8s × 25m × 60/8 = ~187.5m/min equivalent). But she's fragile and slow. Killing the Broodmother is always a priority target.
  - **Balance lever:** 8s spawn rate is critical. Too fast = overwhelming. Too slow = not worth 100m/50g investment.

#### T2: Ravager (heavy melee armored)
- **Role:** Anti-armor frontline. Tanks damage, kills vehicles.
- **Stats:** 140 HP, 14+8 vs Armored dmg, 1 range, 1000ms cooldown, armor 2, 100m/50g, supply 2
- **DPS:** 14/s (22 vs Armored)
- **Ability — Corrosive Bile** (active):
  - Targeted AoE: 2 second travel time, 40 damage in 1.5 tile radius on impact
  - Range: 9 tiles (outranges everything)
  - Cooldown: 10 seconds
  - **Design intent:** Zone control. Force enemies to move out of siege positions. Punish turtling. The 2s travel time means it's dodgeable by attentive players — but devastating against stationary Siege Tanks.

#### T3: Flyer (fast air harasser)
- **Role:** Map presence. Fastest unit in the game (speed 5.0). Raids extractors, picks off stragglers.
- **Stats:** 80 HP, 10 dmg, 3 range, 700ms cooldown, speed 5.0, air, 100m/75g, supply 2
- **DPS:** 14.3/s
- **Ability — Bounce Attack** (passive):
  - Primary target takes full damage
  - 2 nearest enemies within 2 tiles take 33% damage each (3.3 dmg)
  - **Design intent:** Flyers excel against clumped armies. Send 6 Flyers into a group of Troopers — bounce attacks amplify damage significantly.

#### T4: Leviathan (massive siege beast)
- **Role:** Siege breaker. Massive HP pool, devastating AoE melee.
- **Stats:** 450 HP, 30+20 vs Armored dmg, 2 range, 2000ms cooldown, 1.5 splash, 350m/250g, supply 6
- **DPS:** 15/s (25 vs Armored) + splash
- **Ability — Devour** (active):
  - Swallow one non-massive ground unit (friend or foe). Unit is removed for 5 seconds, then expelled dead.
  - Heals Leviathan for 100 HP per devour.
  - Cooldown: 15 seconds. Range: melee.
  - **Design intent:** Remove the most threatening unit from a fight. Devour a Storm Caller before it casts. Devour a Medic to break Iron Legion sustain. Or devour your own damaged Broodmother to deny the kill and heal.

### Build Order Patterns

**12-Drone Rush (vs Arcane/Automata):**
1. Spawn Pit → 6 Drones → 2nd Spawn Pit → 6 more Drones → attack at 2 minutes
2. Goal: Kill before expensive units come out

**Broodmother Boom:**
1. Spawn Pit → 4 Drones → Evolution Den → 2 Broodmothers → expand
2. Goal: Broodmothers generate free army while you tech. Transition to Ravager + Flyer mid-game.

**Burrower Trap:**
1. Spawn Pit → 2 Burrowers → place at enemy natural → 4 Drones → Evolution Den
2. Goal: Burrower ambush kills enemy scout/expansion attempt. Follow up with Drone wave.

### Faction Upgrades
| Name | Building | Cost | Time | Effect |
|------|----------|------|------|--------|
| Carapace +1/+2/+3 | Evolution Den | 75/125/175m | 50/60/70s | All Swarm ground +1/+2/+3 armor |
| Claws +1/+2/+3 | Evolution Den | 75/125/175m | 50/60/70s | All Swarm melee +1/+2/+3 damage |
| Adrenal Surge | Spawn Pit | 100m/50g | 60s | Drones +20% attack speed |
| Broodmother Capacity | Evolution Den | 100m/100g | 90s | Broodmother max active: 4 → 6 |
| Flyer Agility | Rookery | 150m/100g | 80s | Flyers +1 range, +0.5 speed |

---

## ARCANE COVENANT — "The Glass Cannon Cathedral"

### Strategic Identity
**How they win:** Quality over quantity. Every Arcane unit is expensive but has shields that regenerate between fights. Win by taking favorable trades, retreating to regen shields, then re-engaging at full power. Blink Assassins pick off key targets. Storm Callers delete entire armies with AoE.

**How they generate advantage:** Shield regeneration is free healing. After every fight, shields restore to full in ~15 seconds. An Arcane army that wins by a thin margin and retreats is back at full shield strength before the next engagement. Over multiple fights, this compounds into a massive effective-HP advantage.

**What they fear:** All-in attacks that kill through shields in one engagement. EMP-style abilities that strip shields. Constant aggression that never lets shields regen. The Swarm's relentless waves deny the "retreat and regen" pattern.

### Faction Personality
Arcane is the **high-skill-ceiling faction**. Hard to play (expensive units, devastating losses), extremely rewarding when played well (Blink micro, Storm placement, shield regen economy). Appeals to players who want to outplay opponents with precision rather than production.

### Unit Roles (Detailed)

#### T1: Acolyte (basic ranged caster)
- **Role:** Ranged DPS. Longer range than most T1 units. Glass cannon with shields.
- **Stats:** 40 HP + 30 shield, 8 dmg, 6 range, 800ms cooldown, 60m/10g, supply 1
- **Effective HP:** 70 (but 30 regenerates for free!)
- **DPS:** 10/s
- **Identity:** Outranges Troopers (6 vs 5). Can kite most T1 units. But 40 base HP means once shields break, they die fast.

#### T1: Warden (melee tank with shield)
- **Role:** Frontline absorber. Protects Acolytes and casters.
- **Stats:** 80 HP + 60 shield, 10 dmg, 1 range (melee), 900ms cooldown, 75m/25g, supply 2
- **Effective HP:** 140 (60 regenerates!)
- **DPS:** 11.1/s
- **Ability — Shield Burst** (active):
  - Instantly restores 40 shields to self and all friendly units within 3 tiles
  - Cooldown: 30 seconds. No energy cost.
  - **Design intent:** Emergency button. When engaging, Shield Burst on the frontline keeps Wardens alive through the initial volley. Time it after the first exchange for maximum value.

#### T2: Enchanter (buff aura support)
- **Role:** Force multiplier. Boosts attack speed of nearby allies.
- **Stats:** 50 HP + 40 shield, no damage, 100m/75g, supply 2
- **Ability — Haste Aura** (passive):
  - All friendly units within 4 tiles get +25% attack speed
  - Doesn't stack with other Enchanters (only one aura applies)
  - **Design intent:** Enchanters amplify your army's DPS without contributing damage themselves. Position them centrally. Losing an Enchanter drops your whole army's DPS by 25%. High priority target.

#### T2: Blink Assassin (teleport burst)
- **Role:** Surgical striker. Blinks to target, deals burst damage, blinks out.
- **Stats:** 60 HP + 50 shield, 18+5 vs Armored dmg, 5 range, 1100ms cooldown, 125m/75g, supply 2
- **DPS:** 16.4/s (20.9 vs Armored)
- **Ability — Blink** (active, research required):
  - Teleport up to 8 tiles instantly
  - Cooldown: 10 seconds
  - **Design intent:** THE signature Arcane unit. Blink forward → kill a Medic/Broodmother/Disruptor → Blink back to safety. High risk, high reward micro. A player who Blink-micro's 4 Assassins well can dismantle any army. But bad Blinks = dead Assassins.
  - **Micro pattern:** Blink in → focus fire priority target → Blink out when shields break → wait for shield regen → repeat

#### T3: Storm Caller (AoE devastation)
- **Role:** Area denial caster. The nuke button.
- **Stats:** 45 HP + 60 shield, 25+10 vs Light dmg, 9 range, 2500ms cooldown, 200m/150g, supply 3
- **DPS (auto-attack):** 10/s (14 vs Light) — but auto-attack isn't the point
- **Ability — Arcane Storm** (active, energy-based):
  - 80 damage dealt over 3 seconds in a 2-tile radius AoE
  - Energy cost: 75 (max energy 200, regen 0.75/s)
  - Friendly fire: YES — damages all units in area
  - **Design intent:** Arcane Storm deletes armies. 80 damage kills almost any T1 unit through shields. But friendly fire means you can't cast it on top of your own army. Must cast it on the enemy side, ahead of your frontline. Timing and placement are everything.
  - **Counter:** Spread formation. If units aren't clumped, Storm Caller is inefficient.

#### T3: Golem (slow armored construct)
- **Role:** Siege unit. Slow but incredibly tanky. Soaks damage for casters behind it.
- **Stats:** 200 HP + 100 shield, 20+15 vs Armored dmg, 2 range, 1400ms cooldown, 175m/100g, supply 4
- **Effective HP:** 300 (100 regenerates!)
- **DPS:** 14.3/s (25 vs Armored)
- **Ability — Fortify** (toggle):
  - Immobile. +3 armor, +50% shield regen rate, taunt (enemies in 3 tiles auto-target Golem).
  - **Design intent:** Golem plants itself, enemies are forced to attack it while Storm Callers and Blink Assassins do the real damage. Un-fortify to advance, re-fortify to hold.

#### T4: Archmage (flying caster supreme)
- **Role:** Win condition. Absurdly powerful flying spellcaster.
- **Stats:** 120 HP + 200 shield, 30 dmg, 10 range, 2000ms cooldown, 1.5 splash, air, 400m/350g, supply 6
- **DPS:** 15/s + splash
- **Ability 1 — Chain Lightning** (active):
  - Hits primary target for 40 damage, bounces to 3 nearby targets for 25 each
  - Range: 10 tiles. Energy: 50. Cooldown: 8s.
- **Ability 2 — Mass Shield** (active):
  - Restores 100 shields to ALL friendly units within 6 tiles
  - Energy: 125. Cooldown: 30s.
  - **Design intent:** The Archmage is the ultimate combination of DPS and support. Chain Lightning clears groups, Mass Shield resets your entire army's shields mid-fight. Getting an Archmage out alive wins games.

### Shield System Details
- **Regen rate:** 2 shields/s, starts 10 seconds after last damage taken
- **Shield gate:** If a unit has shields remaining and takes lethal damage, HP cannot go below 1 from that hit (prevents one-shotting through shields)
- **EMP interaction:** Disruptor EMP drains 100 shields instantly — hard counter

### Build Order Patterns

**Blink Assassin Rush:**
1. Gateway → 2 Acolytes → Arcane Library → 2 Blink Assassins → research Blink → harass at 4 min
2. Goal: Pick off key units, retreat, regen shields, repeat

**Storm Caller Timing:**
1. Gateway → 2 Wardens → expand → Arcane Library → Observatory → 2 Storm Callers
2. Goal: Reach T3 storm. Delete opponent's army with double storm.

**Golem Push:**
1. Gateway → 3 Wardens → Observatory → 2 Golems + 2 Storm Callers
2. Goal: Golems fortify, Storms rain down behind them. Slow but unstoppable.

### Faction Upgrades
| Name | Building | Cost | Time | Effect |
|------|----------|------|------|--------|
| Shield Resonance +1/+2/+3 | Gateway | 100/150/200m | 60/70/80s | All Arcane shields: +10/+20/+30 max capacity |
| Spell Power +1/+2/+3 | Arcane Library | 125/175/225m, 50g | 70/80/90s | All ability damage +10%/+20%/+30% |
| Blink Research | Arcane Library | 150m/100g | 100s | Unlocks Blink Assassin teleport |
| Mana Efficiency | Observatory | 150m/150g | 90s | All ability energy costs -20% |

---

## AUTOMATA — "The Inevitable Machine"

### Strategic Identity
**How they win:** Attrition warfare. Self-repair means every unit gets gradually healed for free. Wreckage reclaim means killing enemy Mechanical units gives you bonus minerals. The longer the game goes, the more value Automata extract. They grind opponents down through relentless efficiency.

**How they generate advantage:** Double economy engine: (1) self-repair saves the minerals you'd spend replacing units, (2) wreckage reclaim generates bonus minerals from enemy mechanical kills. Against Automata, every destroyed vehicle is mineral income for them. Against non-mechanical factions, they still benefit from self-repair value.

**What they fear:** Fast aggression before self-repair has time to generate value. The first 3 minutes are Automata's weakest — their units have slightly below-average stats, and the self-repair hasn't had time to matter. A Swarm 12-Drone rush or Iron Legion Stim rush can end the game before Automata's passive kicks in.

### Faction Personality
Automata is the **patience faction**. Low intensity, high inevitability. Appeals to players who like macro, optimization, and long-game planning. Low skill floor (just build stuff and repair), medium ceiling (wreckage micro, EMP timing, Anchor Mode positioning).

### Unit Roles (Detailed)

All Automata units are Mechanical (ArmorClass.Armored or .Heavy). All have passive self-repair.

#### T1: Sentinel (basic ranged bot)
- **Role:** Frontline DPS. Slightly worse than Trooper in a straight fight, but self-heals.
- **Stats:** 55 HP, 6 dmg, 5 range, 700ms cooldown, 55m, supply 1
- **DPS:** 8.6/s (lower than Trooper's 10.8)
- **Passive — Self-Repair:** Regenerates 1 HP/s when not attacked for 5 seconds
- **Identity:** Loses the first fight but wins the second one. After a skirmish, Sentinels heal back up while Troopers stay damaged.

#### T1: Shredder (melee buzzsaw)
- **Role:** Anti-light melee. Aggressive close-range fighter.
- **Stats:** 70 HP, 12+4 vs Light dmg, 0.5 range (melee), 600ms cooldown, 60m/10g, supply 1
- **DPS:** 20/s (26.7 vs Light)
- **Passive — Self-Repair:** 1 HP/s out of combat
- **Identity:** Shredders SHRED light units. 20 DPS in melee is devastating. But they have to get close, and ranged units kite them.

#### T2: Repair Drone (flying healer for mechanicals)
- **Role:** In-combat healer for Automata army. Like Iron Legion's Medic but aerial.
- **Stats:** 50 HP, no damage, speed 3.5, air, 75m/50g, supply 1
- **Ability — Repair Beam** (passive):
  - Heals nearest injured friendly Mechanical unit within 4 tiles at 12 HP/s
  - Cannot heal organic units (useless against Iron Legion/Swarm)
  - **Design intent:** Repair Drone + Self-Repair + Wreckage Reclaim = the Automata attrition trifecta. The Drone heals in combat, self-repair heals between combats, reclaim harvests the aftermath.

#### T2: Crawler (spider tank all-terrain)
- **Role:** Versatile ranged unit. Ignores terrain (cliff walk). Backbone of mid-game army.
- **Stats:** 130 HP, 10+5 vs Armored dmg, 6 range, 900ms cooldown, 125m/50g, supply 2
- **DPS:** 11.1/s (16.7 vs Armored)
- **Passive — Self-Repair:** 2 HP/s out of combat (enhanced)
- **Passive — All-Terrain:** Ignores cliffs (walks over elevated terrain)
- **Identity:** The workhorse. Tanky, good damage, ignores terrain. Crawlers are always useful. Their enhanced self-repair (2 HP/s vs 1) makes them especially efficient long-term.

#### T3: Disruptor (EMP specialist)
- **Role:** Anti-shield, anti-caster. Hard-counters Arcane Covenant.
- **Stats:** 80 HP, 8 dmg, 7 range, 1200ms cooldown, 150m/125g, supply 3
- **DPS:** 6.7/s (low — but EMP is the real value)
- **Ability — EMP Blast** (active):
  - 2-tile radius AoE: drains 100 shields, disables abilities for 3 seconds
  - Energy cost: 75 (max 200, regen 0.5/s)
  - Cooldown: 12 seconds
  - **Design intent:** THE anti-Arcane unit. EMP strips shields, disables Blink, stops Storm Callers from casting. Against non-shield factions, the ability-disable is still useful (stops Stim, Burrow, Broodmother spawns for 3s).

#### T3: Harvester (wreckage reclaimer)
- **Role:** Economic unit. Converts battle aftermath into minerals.
- **Stats:** 100 HP, 5 dmg, 3 range, 1500ms cooldown, 125m/75g, supply 2
- **Ability — Wreckage Reclaim** (active):
  - Target a wreckage entity (appears when Mechanical/Armored unit dies)
  - Channel for 4 seconds → gain 25% of the dead unit's mineral cost
  - Wreckage persists for 30 seconds, then decays
  - Multiple Harvesters can reclaim different wreckage simultaneously
  - **Design intent:** After a big battle, send Harvesters to the battlefield. A destroyed Siege Tank (150m) yields 37.5m from wreckage. 5 destroyed vehicles = ~190m free minerals. This rewards aggressive play (kill stuff = get money).
  - **Wreckage rules:** Only Mechanical/Armored units leave wreckage. Organic/Light units don't. This means Wreckage is strongest vs Iron Legion vehicles, Automata mirrors, and Mech Brigade.

#### T4: Colossus (walking fortress)
- **Role:** Ultimate siege unit. Self-repairs even IN combat at 5 HP/s.
- **Stats:** 550 HP, 20+10 vs Light dmg, 9 range, 1200ms cooldown, 1.0 splash, 400m/300g, supply 6
- **DPS:** 16.7/s (25 vs Light) + splash
- **Passive — Combat Repair:** Self-repairs 5 HP/s at ALL times (even while being attacked)
  - **Design intent:** The Colossus is the ultimate attrition unit. 550 HP + 5 HP/s repair means you need 116 DPS just to overcome the regen. Anything less and the Colossus literally can't die. Small armies bounce off. Only a committed, high-DPS strike force can bring one down.

### Build Order Patterns

**Turtle Expand:**
1. Assembly Line → 3 Sentinels → expand to 3 nodes → Advanced Forge → Crawlers
2. Goal: Out-economy opponents. Self-repair keeps your small army alive while you expand.

**Crawler Push:**
1. Assembly Line → 2 Sentinels → Advanced Forge → 4 Crawlers + 1 Repair Drone → slow push
2. Goal: Crawlers with repair support are incredibly hard to remove. Just walk forward.

**Wreckage Economy:**
1. Assembly Line → Advanced Forge → Skyport → 2 Harvesters + 4 Crawlers → fight near wreckage
2. Goal: Provoke battles, reclaim wreckage, reinvest. Only works vs mechanical armies.

### Faction Upgrades
| Name | Building | Cost | Time | Effect |
|------|----------|------|------|--------|
| Weapon Calibration +1/+2/+3 | Assembly Line | 100/150/200m | 60/70/80s | All Automata +1/+2/+3 damage |
| Hull Plating +1/+2/+3 | Assembly Line | 100/150/200m | 60/70/80s | All Automata +1/+2/+3 armor |
| Enhanced Self-Repair | Advanced Forge | 125m/75g | 80s | Self-repair rate: 1→2 HP/s (all units), Crawler: 2→3 HP/s |
| Salvage Efficiency | Skyport | 150m/100g | 90s | Wreckage reclaim: 25% → 40% of mineral cost |
| EMP Overcharge | Skyport | 150m/150g | 100s | EMP radius: 2 → 3 tiles, shield drain: 100 → 150 |

---

## Part 3: Matchup Matrix (4 MVP Factions)

### Iron Legion vs The Swarm
**Legion favored early (Grenadier counters Drones), Swarm favored mid (multi-prong overwhelms).**
- Legion wants: Grenadiers for Drone clear, Siege Tanks to defend expansions, Stim for burst damage on Broodmothers
- Swarm wants: Constant Drone pressure to deny tech, Burrower ambushes on expansions, Flyer harass on extractors
- Key fight: Can Legion get Siege Tanks out before Swarm multi-prong overwhelms? If yes, Legion wins. If no, Swarm snowballs.

### Iron Legion vs Arcane Covenant
**Even matchup. Stim Troopers burst through shields, but Blink Assassins pick off Medics.**
- Legion wants: Stim rush before shields matter, or Titan Walker to overpower late game
- Arcane wants: Survive early aggression, reach Storm Caller → delete Trooper balls
- Key fight: Blink Assassins vs Medics. If Arcane kills Medics, Legion sustain collapses. If Legion kills Assassins, Arcane has no DPS.

### Iron Legion vs Automata
**Automata favored late (attrition dominates), Legion favored early (Stim rush punishes slow start).**
- Legion wants: Rush with Stim Troopers before self-repair matters. Kill Automata before value engine starts.
- Automata wants: Survive early pressure, reach Crawler + Repair Drone deathball
- Key fight: Can Legion kill the Core Node before Crawlers come out? Automata's first 3 minutes are vulnerable.

### The Swarm vs Arcane Covenant
**Swarm heavily favored. Constant aggression denies shield regeneration.**
- Swarm wants: Never let Arcane breathe. Attack every 60 seconds. Shields can't regen if damage never stops.
- Arcane wants: Storm Callers. One good Arcane Storm kills 8 Drones. But must survive to T3.
- Key fight: Blink Assassins are wasted against Drones (overkill). Arcane must invest in Storm Callers or lose to volume.

### The Swarm vs Automata
**Swarm favored early, even mid, Automata favored late. Wreckage reclaim doesn't work vs organic Drones.**
- Swarm wants: Rush before self-repair matters. Drones are organic → no wreckage for Automata
- Automata wants: Survive to Crawlers, rely on self-repair since Harvester wreckage is useless here
- Key fight: Swarm denies the one advantage (wreckage) by being organic. Automata must survive purely on self-repair.

### Arcane Covenant vs Automata
**Automata favored. EMP Disruptor is Arcane's worst nightmare.**
- Automata wants: Rush Disruptors. EMP strips 100 shields + disables Blink for 3s. Arcane crumbles.
- Arcane wants: Kill before Disruptors come out. Blink Assassin → snipe Disruptors. Storm Caller → kill before EMP.
- Key fight: Disruptor vs Storm Caller. If EMP lands first, Arcane army collapses. If Storm lands first, Automata army melts.

---

## Part 4: Expansion Faction Sketches (Ensuring Uniqueness)

Brief design notes for future factions — enough to confirm they don't overlap with MVP factions.

### 5. The Collective (Assimilation)
- **Core mechanic:** Assimilator unit can mind-control ONE enemy unit permanently (high energy cost, channel). Adapter units gain the attack type of the last enemy they killed (polymorphic).
- **Why unique:** Only faction that steals enemy composition. Army mirrors opponent's strength.
- **Doesn't overlap with:** Swarm (free units are self-generated, not stolen), Risen (corpses, not living units)

### 6. The Risen (Corpse Economy)
- **Core mechanic:** Dead units (ALL dead units, both sides) leave corpses. Necromancer raises corpses as Skeleton warriors (weaker copies). Bone Colossus is built from 10 corpses.
- **Why unique:** Only faction that WANTS battles to happen (more dead = more skeletons). Paradoxically benefits from losing units.
- **Doesn't overlap with:** Swarm (Swarm's free units come from Broodmother, not dead bodies), Collective (Collective takes living, Risen takes dead)

### 7. Kaiju Corps (Giant Monsters)
- **Core mechanic:** Only 3 unit types: Hatchling (small), Kaiju (huge), Alpha Kaiju (colossal). Hatchlings evolve into Kaiju after killing 5 units. Kaiju evolves into Alpha after killing 10 more. Each Kaiju is a one-unit army.
- **Why unique:** Only faction where individual units level up through combat. Losing a leveled Kaiju is devastating.
- **Doesn't overlap with:** Automata (Automata sustains through repair, Kaiju through evolution), Arcane (Arcane is expensive per-unit but doesn't evolve)

### 8. Wasteland Raiders (Speed & Pillage)
- **Core mechanic:** Pillage bonus: destroying any enemy building grants +50% of its mineral cost to you. All units are fast vehicles. War Rig is a mobile production building.
- **Why unique:** Only faction with building-destruction income. Rewards pure aggression on structures.
- **Doesn't overlap with:** Swarm (Swarm attacks with volume, Raiders attack extractors for economy), Automata (wreckage from units, pillage from buildings)

### 9. Celestials (Formation Auras)
- **Core mechanic:** Each unit type has a unique aura. Auras stack when multiple unit types are nearby: 2 types = +10% stats, 3 types = +25%, 4+ types = +45%. Rewards diverse composition.
- **Why unique:** Only faction that gets stronger with army DIVERSITY (not size or quality).
- **Doesn't overlap with:** Arcane Enchanter (Enchanter is one flat buff; Celestials scale with diversity), Iron Legion Medic (heals, doesn't buff)

### 10. Void Cultists (Stealth & Debuffs)
- **Core mechanic:** 5 of 7 units are permanently cloaked. Whisperer unit aura reduces enemy damage by -25% within 5 tiles. Elder Thing causes enemy friendly-fire (confused units attack allies for 3s).
- **Why unique:** Only faction where most units are invisible AND debuff-focused.
- **Doesn't overlap with:** Swarm Burrower (one stealth unit, not faction-wide), Arcane (Arcane buffs self, Void debuffs enemies)

### 11. Mech Brigade (Transforming Modes)
- **Core mechanic:** Every unit has 2 modes (e.g., Walker = ground ranged, Fighter = air melee). Transform takes 1.5s. Pilots eject on mech death — pilot is a fragile 20 HP unit that can enter a new mech from a production building for 50% cost.
- **Why unique:** Only faction with universal ground↔air switching AND salvage on death.
- **Doesn't overlap with:** Iron Legion Siege Tank (one toggle unit), Automata (wreckage gives minerals; Mech pilot gives a unit back)

### 12. Feral Pack (Pack Melee Rush)
- **Core mechanic:** ALL units are melee. Pack Bonus: when 5+ Feral units are within 3 tiles of each other, all get +30% damage and +15% speed. Alpha howl ability extends Pack Bonus to +50% for 5s.
- **Why unique:** Only all-melee faction. Pack bonus makes them devastatingly strong when grouped, completely useless when split.
- **Doesn't overlap with:** Swarm (Swarm has ranged + air; Feral is pure melee. Swarm uses multi-prong; Feral uses blob), Celestials (Celestials want diversity; Feral wants density)

---

## Part 5: Uniqueness Verification Summary

### Economy Models (all distinct)
| Model | Factions |
|-------|----------|
| Standard extractors only | Iron Legion, Arcane, Celestials, Void Cultists |
| Standard + free unit spawns | Swarm (Broodmother) |
| Standard + wreckage reclaim | Automata |
| Standard + unit conversion | Collective |
| Standard + corpse raising | Risen |
| Standard + pillage bonus | Wasteland Raiders |
| Standard + pilot salvage | Mech Brigade |
| Standard + evolution (no economy twist) | Kaiju Corps, Feral Pack |

### Sustain Models (all distinct)
| Model | Faction |
|-------|---------|
| Active unit healer (Medic) | Iron Legion |
| Shield regeneration (passive) | Arcane Covenant |
| Self-repair (passive) | Automata |
| Aura stacking (formation) | Celestials |
| Corpse raising (lose-to-gain) | Risen |
| Evolution/leveling | Kaiju Corps |
| Pilot eject (unit salvage) | Mech Brigade |
| None (glass cannon) | Swarm, Raiders, Void Cultists, Feral Pack |

### Win Condition Patterns (all distinct)
| Pattern | Faction |
|---------|---------|
| Sustained combined-arms push | Iron Legion |
| Overwhelming multi-prong waves | Swarm |
| Shield-regen attrition + spell nukes | Arcane Covenant |
| Grind + repair + reclaim | Automata |
| Absorb enemy army composition | Collective |
| Raise undead horde from battle aftermath | Risen |
| Level up 2-3 super-units | Kaiju Corps |
| Raid extractors for pillage income | Wasteland Raiders |
| Formation-stacked diverse army | Celestials |
| Stealth + debuff ambush | Void Cultists |
| Mode-switch micro versatility | Mech Brigade |
| Pack-bonus melee all-in | Feral Pack |
