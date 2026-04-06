/**
 * RTS.io Faction Definitions
 *
 * 4 launch factions, each with distinct identity and mechanics.
 * Replaces SC2 Terran/Zerg with original IP.
 */

// ─── Faction IDs ─────────────────────────────────────────────────────────

export const enum FactionId {
  None = 0,
  IronLegion = 1,    // Military sci-fi: combined arms, medic sustain
  Swarm = 2,         // Bio-horror: cheap units, broodmother spawns
  ArcaneCovenant = 3, // High fantasy: shields, blink, AOE spells
  Automata = 4,      // Machines: self-repair, wreckage reclaim

  // Expansion factions (post-launch)
  Collective = 5,    // Assimilation
  Risen = 6,         // Undead necromancer
  KaijuCorps = 7,    // Giant monsters
  WastelandRaiders = 8, // Mad Max raiders
  Celestials = 9,    // Divine warriors
  VoidCultists = 10, // Eldritch horror
  MechBrigade = 11,  // Mecha/Gundam
  FeralPack = 12,    // Werewolf pack
}

// ─── Faction Metadata ────────────────────────────────────────────────────

export interface FactionDef {
  id: FactionId;
  name: string;
  shortName: string;
  color: number;       // Primary faction color (hex)
  colorLight: number;  // Lighter variant for UI
  description: string;
  mechanic: string;    // One-line unique mechanic summary
}

export const FACTION_DEFS: Record<number, FactionDef> = {
  [FactionId.IronLegion]: {
    id: FactionId.IronLegion,
    name: 'Iron Legion',
    shortName: 'Legion',
    color: 0x4488cc,
    colorLight: 0x66aaee,
    description: 'Combined-arms military with infantry, vehicles, and air support.',
    mechanic: 'Medic sustain — heal nearby infantry in combat.',
  },
  [FactionId.Swarm]: {
    id: FactionId.Swarm,
    name: 'The Swarm',
    shortName: 'Swarm',
    color: 0x88cc44,
    colorLight: 0xaaee66,
    description: 'Bio-organic horde that overwhelms with cheap expendable units.',
    mechanic: 'Broodmother auto-spawns free drones over time.',
  },
  [FactionId.ArcaneCovenant]: {
    id: FactionId.ArcaneCovenant,
    name: 'Arcane Covenant',
    shortName: 'Arcane',
    color: 0xaa66dd,
    colorLight: 0xcc88ff,
    description: 'Powerful but expensive casters with regenerating energy shields.',
    mechanic: 'All units have shields that regenerate out of combat.',
  },
  [FactionId.Automata]: {
    id: FactionId.Automata,
    name: 'Automata',
    shortName: 'Automata',
    color: 0xcc8844,
    colorLight: 0xeeaa66,
    description: 'Relentless machines that self-repair and reclaim wreckage.',
    mechanic: 'All units slowly self-repair. Harvesters reclaim destroyed units for minerals.',
  },
};

// ─── Launch Faction IDs ──────────────────────────────────────────────────

export const LAUNCH_FACTIONS = [
  FactionId.IronLegion,
  FactionId.Swarm,
  FactionId.ArcaneCovenant,
  FactionId.Automata,
] as const;
