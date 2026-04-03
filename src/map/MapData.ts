import { MAP_COLS, MAP_ROWS, TileType, TILE_SIZE, Faction, BuildingType, BuildState } from '../constants';
import type { World } from '../ecs/world';
import { addEntity } from '../ecs/world';
import {
  addBuildingComponents,
  posX, posY, hpCurrent, hpMax, faction, buildingType, buildState,
  renderWidth, renderHeight, renderTint, selected,
} from '../ecs/components';

// ── Map layout variants ──
export const enum MapType {
  Plains = 0,       // current layout, refined
  Canyon = 1,       // narrow choke points through center band
  Islands = 2,      // separated by water with one land bridge
  Crossfire = 3,    // diagonal corridors, no turtling, early aggression
  Fortress = 4,     // cliff-walled bases, 2 narrow ramps, macro games
  Archipelago = 5,  // 5 islands with narrow land bridges, air-heavy
  Deadlock = 6,     // single 6-wide corridor, pure army fight
  DesertStorm = 7,  // open center, corner bases, contested expansions
  FrozenTundra = 8, // maze-like ice cliffs, branching paths
  Volcano = 9,      // circular map, central danger zone
}

export interface MapData {
  /** Flat tile grid, row-major. tiles[row * MAP_COLS + col] */
  tiles: Uint8Array;
  /** Walkable grid for pathfinding (1 = walkable, 0 = blocked) */
  walkable: Uint8Array;
  /** HP for each destructible rock tile (0 = not a rock tile, > 0 = rock HP) */
  destructibleHP: Uint16Array;
  /** Creep coverage: 1 = tile has creep, 0 = no creep */
  creepMap: Uint8Array;
  cols: number;
  rows: number;
}

/** Generate a symmetric 2-player map with the given layout */
export function generateMap(mapType: MapType = MapType.Plains): MapData {
  const tiles = new Uint8Array(MAP_COLS * MAP_ROWS);
  const walkable = new Uint8Array(MAP_COLS * MAP_ROWS);
  const destructibleHP = new Uint16Array(MAP_COLS * MAP_ROWS);
  const creepMap = new Uint8Array(MAP_COLS * MAP_ROWS);

  // Fill with ground (all walkable)
  tiles.fill(TileType.Ground);
  walkable.fill(1);

  // Border walls (shared by all layouts)
  for (let c = 0; c < MAP_COLS; c++) {
    setTile(tiles, walkable, 0, c, TileType.Water);
    setTile(tiles, walkable, MAP_ROWS - 1, c, TileType.Water);
  }
  for (let r = 0; r < MAP_ROWS; r++) {
    setTile(tiles, walkable, r, 0, TileType.Water);
    setTile(tiles, walkable, r, MAP_COLS - 1, TileType.Water);
  }

  if (mapType === MapType.Plains) {
    generatePlains(tiles, walkable, destructibleHP);
  } else if (mapType === MapType.Canyon) {
    generateCanyon(tiles, walkable, destructibleHP);
  } else if (mapType === MapType.Islands) {
    generateIslands(tiles, walkable, destructibleHP);
  } else if (mapType === MapType.Crossfire) {
    generateCrossfire(tiles, walkable, destructibleHP);
  } else if (mapType === MapType.Fortress) {
    generateFortress(tiles, walkable, destructibleHP);
  } else if (mapType === MapType.Archipelago) {
    generateArchipelago(tiles, walkable, destructibleHP);
  } else if (mapType === MapType.Deadlock) {
    generateDeadlock(tiles, walkable, destructibleHP);
  } else if (mapType === MapType.DesertStorm) {
    generateDesertStorm(tiles, walkable, destructibleHP);
  } else if (mapType === MapType.FrozenTundra) {
    generateFrozenTundra(tiles, walkable, destructibleHP);
  } else if (mapType === MapType.Volcano) {
    generateVolcano(tiles, walkable, destructibleHP);
  } else {
    generatePlains(tiles, walkable, destructibleHP);
  }

  return { tiles, walkable, destructibleHP, creepMap, cols: MAP_COLS, rows: MAP_ROWS };
}

/**
 * Plains layout — SC2 LOTV standard 3-expansion map.
 * Main → natural (narrow ramp choke) → exposed third → contested center.
 * Inspired by: Equilibrium, Nightshade, Royal Blood.
 */
function generatePlains(tiles: Uint8Array, walkable: Uint8Array, destructibleHP: Uint16Array): void {
  // ── Player 1 main base (top-left, elevated) ──
  markBaseElevation(tiles, walkable, 2, 2, 20, 20);
  placeMinerals(tiles, walkable, 10, 10);
  setTile(tiles, walkable, 8, 18, TileType.Gas);
  setTile(tiles, walkable, 14, 6, TileType.Gas);

  // ── Player 2 main base (bottom-right, elevated, 180° rotated) ──
  markBaseElevation(tiles, walkable, MAP_ROWS - 21, MAP_COLS - 21, MAP_ROWS - 3, MAP_COLS - 3);
  placeMinerals(tiles, walkable, MAP_ROWS - 14, MAP_COLS - 14);
  setTile(tiles, walkable, MAP_ROWS - 10, MAP_COLS - 20, TileType.Gas);
  setTile(tiles, walkable, MAP_ROWS - 16, MAP_COLS - 8, TileType.Gas);

  // ── Natural expansions (20 tiles from main, behind narrow ramp) ──
  placeMinerals(tiles, walkable, 10, 38);
  setTile(tiles, walkable, 8, 46, TileType.Gas);    // Natural gas 1
  setTile(tiles, walkable, 14, 46, TileType.Gas);   // Natural gas 2
  placeMinerals(tiles, walkable, MAP_ROWS - 14, MAP_COLS - 42);
  setTile(tiles, walkable, MAP_ROWS - 10, MAP_COLS - 48, TileType.Gas);
  setTile(tiles, walkable, MAP_ROWS - 16, MAP_COLS - 48, TileType.Gas);

  // ── Third bases (exposed, in opposite quadrants for risk/reward) ──
  placeMinerals(tiles, walkable, 38, 80);
  setTile(tiles, walkable, 36, 88, TileType.Gas);
  placeMinerals(tiles, walkable, MAP_ROWS - 42, MAP_COLS - 84);
  setTile(tiles, walkable, MAP_ROWS - 38, MAP_COLS - 90, TileType.Gas);

  // ── Natural ramp choke (P1) — 4-tile wide ramp in cliff wall ──
  for (let r = 22; r < 36; r++) {
    for (let c = 22; c < 36; c++) {
      if (c >= 27 && c <= 30 && r >= 27 && r <= 30) continue;
      if (Math.abs(r - 29) + Math.abs(c - 29) < 8) {
        setTile(tiles, walkable, r, c, TileType.Unbuildable);
      }
    }
  }
  // Ramp tiles at natural entrance (P1)
  placeRampTiles(tiles, walkable, 27, 27, 30, 30);

  // ── Natural ramp choke (P2, mirrored) ──
  for (let r = 92; r < 106; r++) {
    for (let c = 92; c < 106; c++) {
      if (c >= 97 && c <= 100 && r >= 97 && r <= 100) continue;
      if (Math.abs(r - 99) + Math.abs(c - 99) < 8) {
        setTile(tiles, walkable, r, c, TileType.Unbuildable);
      }
    }
  }
  // Ramp tiles at natural entrance (P2)
  placeRampTiles(tiles, walkable, 97, 97, 100, 100);

  // ── Back-door destructible rocks behind naturals (SC2 LOTV signature) ──
  // P1: rock wall behind natural mineral line, opens shortcut when destroyed
  placeBackdoorRocks(tiles, walkable, destructibleHP, 8, 50);
  // P2: mirrored
  placeBackdoorRocks(tiles, walkable, destructibleHP, MAP_ROWS - 12, MAP_COLS - 54);

  // ── Xel'Naga watchtower 1 — center map ──
  placeWatchtower(tiles, walkable, 64, 64);

  // ── Xel'Naga watchtower 2 — between naturals and thirds (symmetric) ──
  placeWatchtower(tiles, walkable, 38, 50);
  placeWatchtower(tiles, walkable, MAP_ROWS - 39, MAP_COLS - 51);

  // ── Overlook cliffs near natural mineral lines (harass spots) ──
  placeOverlookCliff(tiles, walkable, 6, 38, true);    // P1 natural: cliff above minerals
  placeOverlookCliff(tiles, walkable, MAP_ROWS - 10, MAP_COLS - 47, true); // P2 mirrored

  // ── Pocket fourth base (tucked behind side cliffs) ──
  placePocketExpansion(tiles, walkable, 58, 8, 'left');
  placePocketExpansion(tiles, walkable, MAP_ROWS - 62, MAP_COLS - 14, 'right');

  // ── Side cliffs creating diagonal map flow ──
  placeWaterPatch(tiles, walkable, 48, 18, 5);
  placeWaterPatch(tiles, walkable, 80, 110, 5);

  // ── Flanking water features ──
  placeWaterPatch(tiles, walkable, 28, 92, 6);
  placeWaterPatch(tiles, walkable, 100, 36, 6);

  // ── Terrain debris in open mid-map areas ──
  scatterTerrainDebris(tiles, walkable, 40, 40, 88, 88);

  // ── Destructible rocks — mid-map flank + third base approach ──
  placeSymmetricRocks(tiles, walkable, destructibleHP, [
    [40, 40], [40, 41], // Mid-map flank blocker
    [50, 24], [51, 24], // Third base approach blocker
  ]);
}

/**
 * Canyon layout — vertical canyon splits map, 3 symmetric passes.
 * Siege-favored with choke control. Inspired by: Ever Dream, Oxide.
 */
function generateCanyon(tiles: Uint8Array, walkable: Uint8Array, destructibleHP: Uint16Array): void {
  // ── P1 main base (elevated) ──
  markBaseElevation(tiles, walkable, 2, 2, 20, 20);
  placeMinerals(tiles, walkable, 10, 10);
  setTile(tiles, walkable, 8, 18, TileType.Gas);
  setTile(tiles, walkable, 14, 6, TileType.Gas);

  // ── P2 main base (elevated) ──
  markBaseElevation(tiles, walkable, MAP_ROWS - 21, MAP_COLS - 21, MAP_ROWS - 3, MAP_COLS - 3);
  placeMinerals(tiles, walkable, MAP_ROWS - 14, MAP_COLS - 14);
  setTile(tiles, walkable, MAP_ROWS - 10, MAP_COLS - 20, TileType.Gas);
  setTile(tiles, walkable, MAP_ROWS - 16, MAP_COLS - 8, TileType.Gas);

  // ── Naturals (same side as main, near canyon wall, 2 gas each) ──
  placeMinerals(tiles, walkable, 10, 40);
  setTile(tiles, walkable, 8, 48, TileType.Gas);
  setTile(tiles, walkable, 14, 48, TileType.Gas);
  placeMinerals(tiles, walkable, MAP_ROWS - 14, MAP_COLS - 44);
  setTile(tiles, walkable, MAP_ROWS - 10, MAP_COLS - 50, TileType.Gas);
  setTile(tiles, walkable, MAP_ROWS - 16, MAP_COLS - 50, TileType.Gas);

  // ── Third bases (across canyon, exposed — must control a pass to hold) ──
  placeMinerals(tiles, walkable, 20, 80);
  setTile(tiles, walkable, 18, 88, TileType.Gas);
  placeMinerals(tiles, walkable, MAP_ROWS - 24, MAP_COLS - 84);
  setTile(tiles, walkable, MAP_ROWS - 20, MAP_COLS - 90, TileType.Gas);

  // ── Central canyon wall — 12 tiles wide, 3 symmetric passes ──
  // Passes at rows 24-30, 61-67 (center), 98-104 — symmetric about row 64
  for (let r = 2; r < MAP_ROWS - 2; r++) {
    const isPass = (r >= 24 && r <= 30) || (r >= 61 && r <= 67) || (r >= 98 && r <= 104);
    if (isPass) continue;
    for (let c = 57; c <= 70; c++) {
      setTile(tiles, walkable, r, c, TileType.Unbuildable);
    }
  }

  // ── Watchtower position at center pass ──
  for (let r = 62; r <= 66; r++) {
    for (let c = 62; c <= 65; c++) {
      setTile(tiles, walkable, r, c, TileType.Ramp);
    }
  }

  // ── Back-door rocks behind naturals ──
  placeBackdoorRocks(tiles, walkable, destructibleHP, 8, 52);
  placeBackdoorRocks(tiles, walkable, destructibleHP, MAP_ROWS - 12, MAP_COLS - 56);

  // ── Second watchtower (near third base approach) ──
  placeWatchtower(tiles, walkable, 30, 80);
  placeWatchtower(tiles, walkable, MAP_ROWS - 31, MAP_COLS - 81);

  // ── Overlook cliffs near naturals ──
  placeOverlookCliff(tiles, walkable, 6, 40, true);
  placeOverlookCliff(tiles, walkable, MAP_ROWS - 10, MAP_COLS - 49, true);

  // ── Pocket fourth base (tucked against canyon wall) ──
  placePocketExpansion(tiles, walkable, 60, 40, 'right');
  placePocketExpansion(tiles, walkable, MAP_ROWS - 64, MAP_COLS - 46, 'left');

  // ── Side lakes for flanking interest (symmetric) ──
  placeWaterPatch(tiles, walkable, 40, 30, 5);
  placeWaterPatch(tiles, walkable, 88, 98, 5);
  placeWaterPatch(tiles, walkable, 40, 98, 4);
  placeWaterPatch(tiles, walkable, 88, 30, 4);

  // ── Terrain debris in pass corridors ──
  scatterTerrainDebris(tiles, walkable, 20, 2, 50, 55);
  scatterTerrainDebris(tiles, walkable, 78, 73, 108, 126);

  // ── Destructible rocks — block shortcut to third base across canyon ──
  placeSymmetricRocks(tiles, walkable, destructibleHP, [
    [18, 72], [19, 72],
  ]);
}

/**
 * Islands layout — water band splits map, 3 land bridges of varying width.
 * Central bridge wide (8 tiles), flanking bridges narrow (4 tiles).
 * Inspired by: Frozen Temple, Acropolis.
 */
function generateIslands(tiles: Uint8Array, walkable: Uint8Array, destructibleHP: Uint16Array): void {
  // ── P1 main base (elevated) ──
  markBaseElevation(tiles, walkable, 2, 2, 20, 20);
  placeMinerals(tiles, walkable, 10, 10);
  setTile(tiles, walkable, 8, 18, TileType.Gas);
  setTile(tiles, walkable, 14, 6, TileType.Gas);

  // ── P2 main base (elevated) ──
  markBaseElevation(tiles, walkable, MAP_ROWS - 21, MAP_COLS - 21, MAP_ROWS - 3, MAP_COLS - 3);
  placeMinerals(tiles, walkable, MAP_ROWS - 14, MAP_COLS - 14);
  setTile(tiles, walkable, MAP_ROWS - 10, MAP_COLS - 20, TileType.Gas);
  setTile(tiles, walkable, MAP_ROWS - 16, MAP_COLS - 8, TileType.Gas);

  // ── Naturals (2 gas each) ──
  placeMinerals(tiles, walkable, 10, 40);
  setTile(tiles, walkable, 8, 48, TileType.Gas);
  setTile(tiles, walkable, 14, 48, TileType.Gas);
  placeMinerals(tiles, walkable, MAP_ROWS - 14, MAP_COLS - 44);
  setTile(tiles, walkable, MAP_ROWS - 10, MAP_COLS - 50, TileType.Gas);
  setTile(tiles, walkable, MAP_ROWS - 16, MAP_COLS - 50, TileType.Gas);

  // ── Third bases (on opposite island, requires bridge control) ──
  placeMinerals(tiles, walkable, 40, 85);
  setTile(tiles, walkable, 38, 93, TileType.Gas);
  placeMinerals(tiles, walkable, MAP_ROWS - 44, MAP_COLS - 89);
  setTile(tiles, walkable, MAP_ROWS - 40, MAP_COLS - 95, TileType.Gas);

  // ── Water band across center rows 56-72 ──
  for (let r = 56; r <= 72; r++) {
    for (let c = 1; c < MAP_COLS - 1; c++) {
      setTile(tiles, walkable, r, c, TileType.Water);
    }
  }

  // ── 3 land bridges (center wide, flanks narrow) ──
  // Center bridge: cols 60-67 (8 tiles wide)
  for (let r = 56; r <= 72; r++) {
    for (let c = 60; c <= 67; c++) {
      setTile(tiles, walkable, r, c, TileType.Ground);
    }
  }
  // Left bridge: cols 25-28 (4 tiles wide)
  for (let r = 56; r <= 72; r++) {
    for (let c = 25; c <= 28; c++) {
      setTile(tiles, walkable, r, c, TileType.Ground);
    }
  }
  // Right bridge: cols 99-102 (4 tiles wide, symmetric with left)
  for (let r = 56; r <= 72; r++) {
    for (let c = 99; c <= 102; c++) {
      setTile(tiles, walkable, r, c, TileType.Ground);
    }
  }

  // ── Back-door rocks behind naturals ──
  placeBackdoorRocks(tiles, walkable, destructibleHP, 8, 52);
  placeBackdoorRocks(tiles, walkable, destructibleHP, MAP_ROWS - 12, MAP_COLS - 56);

  // ── Watchtowers on each island half (near bridges) ──
  placeWatchtower(tiles, walkable, 42, 64);
  placeWatchtower(tiles, walkable, MAP_ROWS - 43, MAP_COLS - 65);

  // ── Overlook cliffs near naturals ──
  placeOverlookCliff(tiles, walkable, 6, 40, true);
  placeOverlookCliff(tiles, walkable, MAP_ROWS - 10, MAP_COLS - 49, true);

  // ── Water features on each island half ──
  placeWaterPatch(tiles, walkable, 30, 60, 5);
  placeWaterPatch(tiles, walkable, 98, 68, 5);

  // ── Terrain debris on island surfaces ──
  scatterTerrainDebris(tiles, walkable, 20, 20, 52, 52);
  scatterTerrainDebris(tiles, walkable, 76, 76, 108, 108);

  // ── Destructible rocks — guard bridge approaches ──
  placeSymmetricRocks(tiles, walkable, destructibleHP, [
    [54, 62], [54, 63],   // Center bridge entrance guard
    [54, 26], [54, 27],   // Left bridge entrance guard
  ]);
}

/**
 * Crossfire — two diagonal corridors crossing at map center.
 * Aggression map with fast-paced skirmishes. Full bases but exposed positions.
 * Inspired by: Hardwire, Altitude.
 */
function generateCrossfire(tiles: Uint8Array, walkable: Uint8Array, destructibleHP: Uint16Array): void {
  // Create unbuildable cliffs everywhere except corridors and bases
  for (let r = 2; r < MAP_ROWS - 2; r++) {
    for (let c = 2; c < MAP_COLS - 2; c++) {
      // Skip base clearings (28×28 per corner)
      if (r < 30 && c < 30) continue;
      if (r >= MAP_ROWS - 30 && c >= MAP_COLS - 30) continue;

      // Diagonal corridor 1 (top-left to bottom-right), 12 tiles wide
      const diagDist1 = Math.abs(r - c);
      // Diagonal corridor 2 (top-right to bottom-left), 12 tiles wide
      const diagDist2 = Math.abs(r - (MAP_COLS - 1 - c));

      if (diagDist1 <= 6 || diagDist2 <= 6) continue;

      // Center open area (32×32 around crossing point)
      const centerDist = Math.max(Math.abs(r - 64), Math.abs(c - 64));
      if (centerDist <= 16) continue;

      setTile(tiles, walkable, r, c, TileType.Unbuildable);
    }
  }

  // ── P1 main base (elevated) ──
  markBaseElevation(tiles, walkable, 2, 2, 28, 28);
  placeMinerals(tiles, walkable, 10, 10);
  setTile(tiles, walkable, 8, 18, TileType.Gas);
  setTile(tiles, walkable, 14, 6, TileType.Gas);

  // ── P2 main base (elevated) ──
  markBaseElevation(tiles, walkable, MAP_ROWS - 29, MAP_COLS - 29, MAP_ROWS - 3, MAP_COLS - 3);
  placeMinerals(tiles, walkable, MAP_ROWS - 14, MAP_COLS - 14);
  setTile(tiles, walkable, MAP_ROWS - 10, MAP_COLS - 20, TileType.Gas);
  setTile(tiles, walkable, MAP_ROWS - 16, MAP_COLS - 8, TileType.Gas);

  // ── Naturals (along main diagonal corridor, near base exit) ──
  placeMinerals(tiles, walkable, 20, 22);
  setTile(tiles, walkable, 18, 20, TileType.Gas);
  setTile(tiles, walkable, 24, 20, TileType.Gas);
  placeMinerals(tiles, walkable, MAP_ROWS - 24, MAP_COLS - 26);
  setTile(tiles, walkable, MAP_ROWS - 20, MAP_COLS - 22, TileType.Gas);
  setTile(tiles, walkable, MAP_ROWS - 26, MAP_COLS - 22, TileType.Gas);

  // ── Contested center expansions (high risk, high reward) ──
  placeMinerals(tiles, walkable, 60, 56);
  setTile(tiles, walkable, 58, 54, TileType.Gas);
  placeMinerals(tiles, walkable, 64, 68);
  setTile(tiles, walkable, 66, 76, TileType.Gas);

  // ── Corridor intersection watchtower (center) ──
  placeWatchtower(tiles, walkable, 64, 64);

  // ── Back-door rocks behind bases (at corridor entrance) ──
  placeBackdoorRocks(tiles, walkable, destructibleHP, 12, 24);
  placeBackdoorRocks(tiles, walkable, destructibleHP, MAP_ROWS - 16, MAP_COLS - 28);

  // ── Terrain debris along corridors ──
  scatterTerrainDebris(tiles, walkable, 30, 30, 98, 98);

  // Water hazards along corridor edges
  placeWaterPatch(tiles, walkable, 35, 78, 4);
  placeWaterPatch(tiles, walkable, 92, 49, 4);

  // ── Destructible rocks — corridor choke tighteners ──
  placeSymmetricRocks(tiles, walkable, destructibleHP, [
    [48, 48], [48, 49],   // Center expansion approach
  ]);
}

/**
 * Fortress — cliff-walled bases with 2 ramp entrances (5 tiles wide).
 * Rich minerals, multiple gas, long macro games.
 * Inspired by: Simulacrum, Golden Wall.
 */
function generateFortress(tiles: Uint8Array, walkable: Uint8Array, destructibleHP: Uint16Array): void {
  // ── P1 main (rich minerals + 2 gas, elevated) ──
  markBaseElevation(tiles, walkable, 2, 2, 22, 22);
  placeRichMinerals(tiles, walkable, 8, 8);
  setTile(tiles, walkable, 6, 20, TileType.Gas);
  setTile(tiles, walkable, 18, 6, TileType.Gas);

  // ── P2 main (elevated) ──
  markBaseElevation(tiles, walkable, MAP_ROWS - 23, MAP_COLS - 23, MAP_ROWS - 3, MAP_COLS - 3);
  placeRichMinerals(tiles, walkable, MAP_ROWS - 14, MAP_COLS - 14);
  setTile(tiles, walkable, MAP_ROWS - 8, MAP_COLS - 22, TileType.Gas);
  setTile(tiles, walkable, MAP_ROWS - 20, MAP_COLS - 8, TileType.Gas);

  // ── Naturals (inside fortress walls, with gas) ──
  placeMinerals(tiles, walkable, 12, 38);
  setTile(tiles, walkable, 10, 46, TileType.Gas);
  setTile(tiles, walkable, 16, 46, TileType.Gas);
  placeMinerals(tiles, walkable, MAP_ROWS - 16, MAP_COLS - 42);
  setTile(tiles, walkable, MAP_ROWS - 12, MAP_COLS - 48, TileType.Gas);
  setTile(tiles, walkable, MAP_ROWS - 18, MAP_COLS - 48, TileType.Gas);

  // ── Third bases (outside fortress, exposed) ──
  placeMinerals(tiles, walkable, 42, 78);
  setTile(tiles, walkable, 40, 86, TileType.Gas);
  placeMinerals(tiles, walkable, MAP_ROWS - 46, MAP_COLS - 82);
  setTile(tiles, walkable, MAP_ROWS - 42, MAP_COLS - 88, TileType.Gas);

  // ── Fortress walls with 5-tile ramp gaps ──
  buildFortressWall(tiles, walkable, 24, 24, 20);
  buildFortressWall(tiles, walkable, MAP_ROWS - 25, MAP_COLS - 25, 20);

  // ── Center fortress (neutral position with contested resources) ──
  for (let r = 56; r < 72; r++) {
    for (let c = 56; c < 72; c++) {
      const edgeDist = Math.min(r - 56, 71 - r, c - 56, 71 - c);
      if (edgeDist === 0 || edgeDist === 1) {
        const isGap = (c >= 62 && c <= 66 && (r === 56 || r === 71)) ||
                      (r >= 62 && r <= 66 && (c === 56 || c === 71));
        if (!isGap) {
          setTile(tiles, walkable, r, c, TileType.Unbuildable);
        }
      }
    }
  }

  // Center fortress contested resources
  placeSmallMinerals(tiles, walkable, 62, 60);
  setTile(tiles, walkable, 66, 64, TileType.Gas);

  // ── Back-door rocks in fortress wall (opens second entrance when destroyed) ──
  placeBackdoorRocks(tiles, walkable, destructibleHP, 14, 42);
  placeBackdoorRocks(tiles, walkable, destructibleHP, MAP_ROWS - 18, MAP_COLS - 46);

  // ── Watchtowers flanking center fortress ──
  placeWatchtower(tiles, walkable, 46, 46);
  placeWatchtower(tiles, walkable, MAP_ROWS - 47, MAP_COLS - 47);

  // ── Pocket fifth base (inside fortress, exposed side) ──
  placePocketExpansion(tiles, walkable, 20, 58, 'top');
  placePocketExpansion(tiles, walkable, MAP_ROWS - 24, MAP_COLS - 64, 'bottom');

  // ── Terrain debris outside fortress walls ──
  scatterTerrainDebris(tiles, walkable, 46, 2, 82, 54);
  scatterTerrainDebris(tiles, walkable, 46, 74, 82, 126);

  // Scenic water features
  placeWaterPatch(tiles, walkable, 40, 92, 6);
  placeWaterPatch(tiles, walkable, 88, 36, 6);
  placeWaterPatch(tiles, walkable, 30, 64, 4);
  placeWaterPatch(tiles, walkable, 97, 64, 4);

  // ── Destructible rocks — center fortress side approach ──
  placeSymmetricRocks(tiles, walkable, destructibleHP, [
    [50, 54], [50, 55],
  ]);
}

/** Build a fortress wall — unbuildable ring around (centerR, centerC) with 2 ramp gaps (5 tiles wide) */
function buildFortressWall(tiles: Uint8Array, walkable: Uint8Array, centerR: number, centerC: number, radius: number): void {
  for (let r = centerR - radius; r <= centerR + radius; r++) {
    for (let c = centerC - radius; c <= centerC + radius; c++) {
      if (r < 1 || r >= MAP_ROWS - 1 || c < 1 || c >= MAP_COLS - 1) continue;

      const dr = Math.abs(r - centerR);
      const dc = Math.abs(c - centerC);

      // Only place on the ring edge (Chebyshev distance = radius or radius-1)
      const chebyshev = Math.max(dr, dc);
      if (chebyshev < radius - 1 || chebyshev > radius) continue;

      // Ramp gap 1: south/east side — 5 tiles wide
      if (dc >= radius - 1 && dr <= 2) continue;
      // Ramp gap 2: east/south side — 5 tiles wide
      if (dr >= radius - 1 && dc <= 2) continue;

      setTile(tiles, walkable, r, c, TileType.Unbuildable);
    }
  }
}

/** Place 4 mineral patches (resource-poor variant) */
/** Place 4 mineral patches in a slight arc (contest/pocket expansion variant) */
function placeSmallMinerals(tiles: Uint8Array, walkable: Uint8Array, startRow: number, startCol: number): void {
  // Slight concave arc: edges step back by 1 tile
  const offsets: Array<[number, number]> = [[0, 0], [0, 1], [0, 2], [0, 3]];
  for (const [dr, dc] of offsets) {
    setTile(tiles, walkable, startRow + dr, startCol + dc, TileType.Minerals);
  }
}

/** Place 12 mineral patches in a wide arc (rich base variant, 3 rows curving) */
function placeRichMinerals(tiles: Uint8Array, walkable: Uint8Array, startRow: number, startCol: number): void {
  const offsets: Array<[number, number]> = [
    [0, 0], [0, 1], [0, 2], [0, 3],   // Front row
    [1, -1], [1, 0], [1, 3], [1, 4],  // Middle row curves outward
    [2, -1], [2, 0], [2, 3], [2, 4],  // Back row maintains curve
  ];
  for (const [dr, dc] of offsets) {
    setTile(tiles, walkable, startRow + dr, startCol + dc, TileType.Minerals);
  }
}

/**
 * Archipelago — 5 islands connected by 4-tile land bridges.
 * Each island has resources. Side islands are symmetric 180° expansions.
 * Inspired by: Frozen Temple, Habitation Station.
 */
function generateArchipelago(tiles: Uint8Array, walkable: Uint8Array, destructibleHP: Uint16Array): void {
  // Fill with water, then carve islands
  for (let r = 2; r < MAP_ROWS - 2; r++) {
    for (let c = 2; c < MAP_COLS - 2; c++) {
      setTile(tiles, walkable, r, c, TileType.Water);
    }
  }

  // 5 islands: P1, P2, center, and 2 symmetric side islands
  const islands: Array<{ cr: number; cc: number; radius: number }> = [
    { cr: 20, cc: 20, radius: 18 },    // Player 1 island
    { cr: 107, cc: 107, radius: 18 },  // Player 2 island (180° mirror)
    { cr: 64, cc: 64, radius: 16 },    // Center island
    { cr: 30, cc: 97, radius: 13 },    // Expansion island (top-right)
    { cr: 97, cc: 30, radius: 13 },    // Expansion island (bottom-left, 180° mirror)
  ];

  for (const island of islands) {
    carveIsland(tiles, walkable, island.cr, island.cc, island.radius);
  }

  // 4-tile wide bridges (playable choke width)
  carveBridge(tiles, walkable, 20, 20, 64, 64, 4);     // P1 → center
  carveBridge(tiles, walkable, 107, 107, 64, 64, 4);   // P2 → center
  carveBridge(tiles, walkable, 30, 97, 64, 64, 4);     // Side1 → center
  carveBridge(tiles, walkable, 97, 30, 64, 64, 4);     // Side2 → center
  // Direct bridges to expansion islands from mains
  carveBridge(tiles, walkable, 20, 20, 30, 97, 3);     // P1 → side1 (shorter)
  carveBridge(tiles, walkable, 107, 107, 97, 30, 3);   // P2 → side2

  // ── P1 main (elevated) ──
  markBaseElevation(tiles, walkable, 4, 4, 24, 24);
  placeMinerals(tiles, walkable, 14, 14);
  setTile(tiles, walkable, 12, 22, TileType.Gas);
  setTile(tiles, walkable, 22, 12, TileType.Gas);

  // ── P2 main (elevated) ──
  markBaseElevation(tiles, walkable, MAP_ROWS - 25, MAP_COLS - 25, MAP_ROWS - 5, MAP_COLS - 5);
  placeMinerals(tiles, walkable, MAP_ROWS - 18, MAP_COLS - 18);
  setTile(tiles, walkable, MAP_ROWS - 14, MAP_COLS - 24, TileType.Gas);
  setTile(tiles, walkable, MAP_ROWS - 24, MAP_COLS - 14, TileType.Gas);

  // ── Expansion islands (natural-equivalent, 2 gas each) ──
  placeMinerals(tiles, walkable, 26, 94);
  setTile(tiles, walkable, 24, 102, TileType.Gas);
  setTile(tiles, walkable, 32, 102, TileType.Gas);
  placeMinerals(tiles, walkable, MAP_ROWS - 30, MAP_COLS - 98);
  setTile(tiles, walkable, MAP_ROWS - 26, MAP_COLS - 104, TileType.Gas);
  setTile(tiles, walkable, MAP_ROWS - 34, MAP_COLS - 104, TileType.Gas);

  // ── Center island (contested third) ──
  placeMinerals(tiles, walkable, 60, 60);
  setTile(tiles, walkable, 58, 68, TileType.Gas);
  setTile(tiles, walkable, 68, 58, TileType.Gas);

  // ── Watchtower on center island ──
  placeWatchtower(tiles, walkable, 68, 68);

  // ── Terrain debris on islands ──
  scatterTerrainDebris(tiles, walkable, 6, 6, 34, 34);
  scatterTerrainDebris(tiles, walkable, 94, 94, 122, 122);

  // ── Destructible rocks — block bridge chokepoints for early-game safety ──
  placeSymmetricRocks(tiles, walkable, destructibleHP, [
    [28, 52], [29, 52],   // Bridge approach from main to center
    [20, 28], [20, 29],   // Main island to expansion island shortcut
  ]);
}

/** Carve a circular island of ground tiles */
function carveIsland(tiles: Uint8Array, walkable: Uint8Array, centerR: number, centerC: number, radius: number): void {
  for (let r = centerR - radius; r <= centerR + radius; r++) {
    for (let c = centerC - radius; c <= centerC + radius; c++) {
      if (r < 1 || r >= MAP_ROWS - 1 || c < 1 || c >= MAP_COLS - 1) continue;
      const dist = Math.sqrt((r - centerR) ** 2 + (c - centerC) ** 2);
      if (dist <= radius) {
        setTile(tiles, walkable, r, c, TileType.Ground);
      }
    }
  }
}

/** Carve a land bridge between two points using Manhattan distance for width */
function carveBridge(tiles: Uint8Array, walkable: Uint8Array, r1: number, c1: number, r2: number, c2: number, width: number): void {
  const steps = Math.max(Math.abs(r2 - r1), Math.abs(c2 - c1));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = Math.round(r1 + (r2 - r1) * t);
    const c = Math.round(c1 + (c2 - c1) * t);
    for (let dr = -width; dr <= width; dr++) {
      for (let dc = -width; dc <= width; dc++) {
        if (Math.abs(dr) + Math.abs(dc) <= width) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr >= 1 && rr < MAP_ROWS - 1 && cc >= 1 && cc < MAP_COLS - 1) {
            setTile(tiles, walkable, rr, cc, TileType.Ground);
          }
        }
      }
    }
  }
}

/** Carve a straight corridor between two points with consistent width (Chebyshev) */
function carveLinearCorridor(tiles: Uint8Array, walkable: Uint8Array, r1: number, c1: number, r2: number, c2: number, halfWidth: number): void {
  const steps = Math.max(Math.abs(r2 - r1), Math.abs(c2 - c1));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = Math.round(r1 + (r2 - r1) * t);
    const c = Math.round(c1 + (c2 - c1) * t);
    for (let dr = -halfWidth; dr <= halfWidth; dr++) {
      for (let dc = -halfWidth; dc <= halfWidth; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= 1 && rr < MAP_ROWS - 1 && cc >= 1 && cc < MAP_COLS - 1) {
          setTile(tiles, walkable, rr, cc, TileType.Ground);
        }
      }
    }
  }
}

/**
 * Deadlock — 3-lane cliff map with narrow corridors carved through rock.
 * Main lane (center, 8 tiles wide), two flanking side lanes (5 tiles wide).
 * Each lane has a choke point. Expansion at center crossroads.
 * Inspired by: Thunderbird, Blackburn.
 */
function generateDeadlock(tiles: Uint8Array, walkable: Uint8Array, destructibleHP: Uint16Array): void {
  // Fill everything with unbuildable
  for (let r = 2; r < MAP_ROWS - 2; r++) {
    for (let c = 2; c < MAP_COLS - 2; c++) {
      setTile(tiles, walkable, r, c, TileType.Unbuildable);
    }
  }

  // ── Player 1 base area (top-left, 35×35) ──
  for (let r = 3; r < 38; r++) {
    for (let c = 3; c < 38; c++) {
      setTile(tiles, walkable, r, c, TileType.Ground);
    }
  }

  // ── Player 2 base area (bottom-right, 35×35, 180° mirror) ──
  for (let r = MAP_ROWS - 38; r < MAP_ROWS - 3; r++) {
    for (let c = MAP_COLS - 38; c < MAP_COLS - 3; c++) {
      setTile(tiles, walkable, r, c, TileType.Ground);
    }
  }

  // ── Center lane: 8-tile wide diagonal corridor ──
  carveLinearCorridor(tiles, walkable, 38, 20, MAP_ROWS - 38, MAP_COLS - 20, 4);

  // ── Left flank lane: 5-tile wide, hugs left/top edge ──
  carveLinearCorridor(tiles, walkable, 20, 38, MAP_COLS - 20, MAP_ROWS - 38, 2);

  // ── Right flank lane: 5-tile wide, hugs right/bottom edge ──
  // P1 side exit → right edge → P2 side entrance
  for (let r = 3; r < MAP_ROWS - 3; r++) {
    for (let c = MAP_COLS - 18; c < MAP_COLS - 12; c++) {
      if (r >= 1 && r < MAP_ROWS - 1 && c >= 1 && c < MAP_COLS - 1) {
        setTile(tiles, walkable, r, c, TileType.Ground);
      }
    }
  }
  // Connect P1 base to right lane
  for (let c = 38; c < MAP_COLS - 18; c++) {
    for (let dr = -2; dr <= 2; dr++) {
      const rr = 20 + dr;
      if (rr >= 1 && rr < MAP_ROWS - 1 && c >= 1 && c < MAP_COLS - 1) {
        setTile(tiles, walkable, rr, c, TileType.Ground);
      }
    }
  }
  // Connect P2 base to right lane
  for (let c = MAP_COLS - 38; c < MAP_COLS - 18; c++) {
    for (let dr = -2; dr <= 2; dr++) {
      const rr = MAP_ROWS - 21 + dr;
      if (rr >= 1 && rr < MAP_ROWS - 1 && c >= 1 && c < MAP_COLS - 1) {
        setTile(tiles, walkable, rr, c, TileType.Ground);
      }
    }
  }

  // ── Left flank lane: runs along left edge ──
  for (let r = 3; r < MAP_ROWS - 3; r++) {
    for (let c = 12; c < 18; c++) {
      if (r >= 1 && r < MAP_ROWS - 1 && c >= 1 && c < MAP_COLS - 1) {
        setTile(tiles, walkable, r, c, TileType.Ground);
      }
    }
  }
  // Connect P1 base to left lane
  for (let c = 12; c < 38; c++) {
    for (let dr = -2; dr <= 2; dr++) {
      const rr = MAP_ROWS - 21 + dr;
      if (rr >= 1 && rr < MAP_ROWS - 1) {
        setTile(tiles, walkable, rr, c, TileType.Ground);
      }
    }
  }
  // Connect P2 base to left lane
  for (let c = 12; c < MAP_COLS - 38; c++) {
    for (let dr = -2; dr <= 2; dr++) {
      const rr = 20 + dr;
      if (rr >= 1 && rr < MAP_ROWS - 1) {
        setTile(tiles, walkable, rr, c, TileType.Ground);
      }
    }
  }

  // ── Center crossroads expansion area (20×20 open) ──
  for (let r = 54; r < 74; r++) {
    for (let c = 54; c < 74; c++) {
      setTile(tiles, walkable, r, c, TileType.Ground);
    }
  }

  // ── P1 main resources (elevated, 2 gas) ──
  markBaseElevation(tiles, walkable, 3, 3, 22, 22);
  placeMinerals(tiles, walkable, 8, 8);
  setTile(tiles, walkable, 6, 16, TileType.Gas);
  setTile(tiles, walkable, 14, 6, TileType.Gas);

  // ── P2 main resources (elevated) ──
  markBaseElevation(tiles, walkable, MAP_ROWS - 23, MAP_COLS - 23, MAP_ROWS - 4, MAP_COLS - 4);
  placeMinerals(tiles, walkable, MAP_ROWS - 12, MAP_COLS - 12);
  setTile(tiles, walkable, MAP_ROWS - 8, MAP_COLS - 18, TileType.Gas);
  setTile(tiles, walkable, MAP_ROWS - 16, MAP_COLS - 8, TileType.Gas);

  // ── Natural expansion (inside base area, 2 gas each) ──
  placeMinerals(tiles, walkable, 26, 18);
  setTile(tiles, walkable, 24, 26, TileType.Gas);
  setTile(tiles, walkable, 30, 26, TileType.Gas);
  placeMinerals(tiles, walkable, MAP_ROWS - 30, MAP_COLS - 22);
  setTile(tiles, walkable, MAP_ROWS - 26, MAP_COLS - 28, TileType.Gas);
  setTile(tiles, walkable, MAP_ROWS - 32, MAP_COLS - 28, TileType.Gas);

  // ── Contested center expansion ──
  placeMinerals(tiles, walkable, 60, 60);
  setTile(tiles, walkable, 58, 68, TileType.Gas);
  setTile(tiles, walkable, 68, 58, TileType.Gas);

  // ── Watchtower at center ──
  placeWatchtower(tiles, walkable, 64, 64);

  // ── Back-door rocks behind naturals ──
  placeBackdoorRocks(tiles, walkable, destructibleHP, 24, 28);
  placeBackdoorRocks(tiles, walkable, destructibleHP, MAP_ROWS - 28, MAP_COLS - 32);

  // ── Terrain debris in base areas and center ──
  scatterTerrainDebris(tiles, walkable, 5, 5, 36, 36);
  scatterTerrainDebris(tiles, walkable, 92, 92, 123, 123);
  scatterTerrainDebris(tiles, walkable, 56, 56, 72, 72);

  // Water pools alongside corridors
  placeWaterPatch(tiles, walkable, 45, 80, 4);
  placeWaterPatch(tiles, walkable, 82, 47, 4);

  // ── Destructible rocks — block side lane shortcuts ──
  placeSymmetricRocks(tiles, walkable, destructibleHP, [
    [38, 14], [38, 15],   // Left lane choke near P1
    [22, 38], [23, 38],   // Center lane entrance
  ]);
}

/**
 * Desert Storm — open center with corner cliff bases, contested expansions.
 * Xel'Naga watchtower at center (ramp terrain). 3-tier expansion structure.
 * Inspired by: Dusk Towers, Catalyst.
 */
function generateDesertStorm(tiles: Uint8Array, walkable: Uint8Array, destructibleHP: Uint16Array): void {
  // ── P1 main base (elevated, 2 gas) ──
  markBaseElevation(tiles, walkable, 2, 2, 20, 28);
  placeMinerals(tiles, walkable, 10, 10);
  setTile(tiles, walkable, 8, 18, TileType.Gas);
  setTile(tiles, walkable, 14, 6, TileType.Gas);

  // ── P2 main base (elevated) ──
  markBaseElevation(tiles, walkable, MAP_ROWS - 21, MAP_COLS - 29, MAP_ROWS - 3, MAP_COLS - 3);
  placeMinerals(tiles, walkable, MAP_ROWS - 14, MAP_COLS - 14);
  setTile(tiles, walkable, MAP_ROWS - 10, MAP_COLS - 20, TileType.Gas);
  setTile(tiles, walkable, MAP_ROWS - 16, MAP_COLS - 8, TileType.Gas);

  // ── Naturals (inside cliff wall, 2 gas each) ──
  placeMinerals(tiles, walkable, 10, 38);
  setTile(tiles, walkable, 8, 46, TileType.Gas);
  setTile(tiles, walkable, 14, 46, TileType.Gas);
  placeMinerals(tiles, walkable, MAP_ROWS - 14, MAP_COLS - 42);
  setTile(tiles, walkable, MAP_ROWS - 10, MAP_COLS - 48, TileType.Gas);
  setTile(tiles, walkable, MAP_ROWS - 16, MAP_COLS - 48, TileType.Gas);

  // ── Corner cliff protection (P1) — L-shaped wall with 5-tile ramp ──
  for (let r = 2; r < 32; r++) {
    for (let c = 30; c < 34; c++) {
      if (r >= 12 && r <= 16) continue; // 5-tile ramp gap
      setTile(tiles, walkable, r, c, TileType.Unbuildable);
    }
  }
  for (let r = 30; r < 34; r++) {
    for (let c = 2; c < 32; c++) {
      if (c >= 12 && c <= 16) continue; // 5-tile ramp gap
      setTile(tiles, walkable, r, c, TileType.Unbuildable);
    }
  }

  // ── Corner cliff protection (P2, mirrored) ──
  for (let r = MAP_ROWS - 32; r < MAP_ROWS - 2; r++) {
    for (let c = MAP_COLS - 34; c < MAP_COLS - 30; c++) {
      if (r >= MAP_ROWS - 17 && r <= MAP_ROWS - 13) continue;
      setTile(tiles, walkable, r, c, TileType.Unbuildable);
    }
  }
  for (let r = MAP_ROWS - 34; r < MAP_ROWS - 30; r++) {
    for (let c = MAP_COLS - 32; c < MAP_COLS - 2; c++) {
      if (c >= MAP_COLS - 17 && c <= MAP_COLS - 13) continue;
      setTile(tiles, walkable, r, c, TileType.Unbuildable);
    }
  }

  // ── Third bases (exposed, in center area) ──
  placeMinerals(tiles, walkable, 50, 58);
  setTile(tiles, walkable, 48, 66, TileType.Gas);
  placeMinerals(tiles, walkable, MAP_ROWS - 54, MAP_COLS - 62);
  setTile(tiles, walkable, MAP_ROWS - 50, MAP_COLS - 68, TileType.Gas);

  // ── Fourth bases (gold minerals at high-risk positions) ──
  placeSmallMinerals(tiles, walkable, 64, 90);
  setTile(tiles, walkable, 66, 94, TileType.Gas);
  placeSmallMinerals(tiles, walkable, MAP_ROWS - 68, MAP_COLS - 94);
  setTile(tiles, walkable, MAP_ROWS - 68, MAP_COLS - 96, TileType.Gas);

  // ── Xel'Naga watchtower 1 at center ──
  placeWatchtower(tiles, walkable, 64, 64);

  // ── Xel'Naga watchtower 2 near fourth base ──
  placeWatchtower(tiles, walkable, 50, 88);
  placeWatchtower(tiles, walkable, MAP_ROWS - 51, MAP_COLS - 89);

  // ── Ramp tiles at base cliff entrances ──
  placeRampTiles(tiles, walkable, 10, 30, 14, 32);   // P1 ramp
  placeRampTiles(tiles, walkable, MAP_ROWS - 15, MAP_COLS - 33, MAP_ROWS - 11, MAP_COLS - 31);

  // ── Back-door rocks behind naturals ──
  placeBackdoorRocks(tiles, walkable, destructibleHP, 8, 50);
  placeBackdoorRocks(tiles, walkable, destructibleHP, MAP_ROWS - 12, MAP_COLS - 54);

  // ── Overlook cliffs near naturals ──
  placeOverlookCliff(tiles, walkable, 6, 38, true);
  placeOverlookCliff(tiles, walkable, MAP_ROWS - 10, MAP_COLS - 47, true);

  // ── Terrain debris across open desert center ──
  scatterTerrainDebris(tiles, walkable, 36, 36, 92, 92);

  // ── Scattered oasis water features ──
  placeWaterPatch(tiles, walkable, 40, 92, 5);
  placeWaterPatch(tiles, walkable, 87, 35, 5);
  placeWaterPatch(tiles, walkable, 82, 100, 4);
  placeWaterPatch(tiles, walkable, 45, 27, 4);

  // ── Destructible rocks — block ramp side entrance + third base shortcut ──
  placeSymmetricRocks(tiles, walkable, destructibleHP, [
    [20, 34],             // Side ramp access to natural
    [36, 56], [36, 57],   // Third base approach guard
    [48, 40], [49, 40],   // Mid-map flanking path
  ]);
}

/**
 * Frozen Tundra — 3×3 room grid with 4-tile corridors, enforced 180° symmetry.
 * Rooms serve as expansion locations and army staging areas.
 * Inspired by: Disco Bloodbath, Zen.
 */
function generateFrozenTundra(tiles: Uint8Array, walkable: Uint8Array, destructibleHP: Uint16Array): void {
  // ── Fill mid-map with cliffs, then carve rooms and corridors ──
  const mazeStart = 28;
  const mazeEnd = 100;
  const roomSize = 16;
  const wallThick = 8;  // Thicker walls = fewer but more meaningful chokepoints

  for (let r = mazeStart; r < mazeEnd; r++) {
    for (let c = mazeStart; c < mazeEnd; c++) {
      setTile(tiles, walkable, r, c, TileType.Unbuildable);
    }
  }

  // ── Carve 3×3 grid of rooms (symmetric about center) ──
  // Room positions calculated so center room is at (64,64)
  const roomPositions: Array<[number, number]> = [];
  for (let gr = 0; gr < 3; gr++) {
    for (let gc = 0; gc < 3; gc++) {
      const rr = mazeStart + 2 + gr * (roomSize + wallThick);
      const cc = mazeStart + 2 + gc * (roomSize + wallThick);
      roomPositions.push([rr, cc]);
      for (let r = rr; r < rr + roomSize && r < mazeEnd; r++) {
        for (let c = cc; c < cc + roomSize && c < mazeEnd; c++) {
          setTile(tiles, walkable, r, c, TileType.Ground);
        }
      }
    }
  }

  // ── Carve 4-tile wide corridors between adjacent rooms ──
  for (let gr = 0; gr < 3; gr++) {
    for (let gc = 0; gc < 3; gc++) {
      const [rr, cc] = roomPositions[gr * 3 + gc];
      const midR = rr + Math.floor(roomSize / 2);
      const midC = cc + Math.floor(roomSize / 2);

      // Horizontal corridor to right neighbor
      if (gc < 2) {
        const nextC = cc + roomSize;
        const endC = nextC + wallThick;
        for (let c = nextC; c < endC && c < mazeEnd; c++) {
          for (let dr = -2; dr <= 1; dr++) {
            if (midR + dr >= mazeStart && midR + dr < mazeEnd) {
              setTile(tiles, walkable, midR + dr, c, TileType.Ground);
            }
          }
        }
      }

      // Vertical corridor to bottom neighbor
      if (gr < 2) {
        const nextR = rr + roomSize;
        const endR = nextR + wallThick;
        for (let r = nextR; r < endR && r < mazeEnd; r++) {
          for (let dc = -2; dc <= 1; dc++) {
            if (midC + dc >= mazeStart && midC + dc < mazeEnd) {
              setTile(tiles, walkable, r, midC + dc, TileType.Ground);
            }
          }
        }
      }
    }
  }

  // ── Connect bases to maze via 4-tile corridors ──
  // P1 → top-left room (south entrance + east entrance)
  const [room0r, room0c] = roomPositions[0];
  for (let r = 24; r <= room0r + 2; r++) {
    for (let dc = -2; dc <= 1; dc++) {
      setTile(tiles, walkable, r, room0c + Math.floor(roomSize / 2) + dc, TileType.Ground);
    }
  }
  for (let c = 24; c <= room0c + 2; c++) {
    for (let dr = -2; dr <= 1; dr++) {
      setTile(tiles, walkable, room0r + Math.floor(roomSize / 2) + dr, c, TileType.Ground);
    }
  }

  // P2 → bottom-right room (north entrance + west entrance)
  const [room8r, room8c] = roomPositions[8];
  for (let r = room8r + roomSize - 2; r < MAP_ROWS - 24; r++) {
    for (let dc = -2; dc <= 1; dc++) {
      const cc = room8c + Math.floor(roomSize / 2) + dc;
      if (cc >= 1 && cc < MAP_COLS - 1) {
        setTile(tiles, walkable, r, cc, TileType.Ground);
      }
    }
  }
  for (let c = room8c + roomSize - 2; c < MAP_COLS - 24; c++) {
    for (let dr = -2; dr <= 1; dr++) {
      const rr = room8r + Math.floor(roomSize / 2) + dr;
      if (rr >= 1 && rr < MAP_ROWS - 1) {
        setTile(tiles, walkable, rr, c, TileType.Ground);
      }
    }
  }

  // ── P1 main resources (elevated, 2 gas) ──
  markBaseElevation(tiles, walkable, 2, 2, 22, 22);
  placeMinerals(tiles, walkable, 10, 10);
  setTile(tiles, walkable, 8, 18, TileType.Gas);
  setTile(tiles, walkable, 14, 6, TileType.Gas);

  // ── P2 main resources (elevated) ──
  markBaseElevation(tiles, walkable, MAP_ROWS - 23, MAP_COLS - 23, MAP_ROWS - 3, MAP_COLS - 3);
  placeMinerals(tiles, walkable, MAP_ROWS - 14, MAP_COLS - 14);
  setTile(tiles, walkable, MAP_ROWS - 10, MAP_COLS - 20, TileType.Gas);
  setTile(tiles, walkable, MAP_ROWS - 16, MAP_COLS - 8, TileType.Gas);

  // ── Naturals (just inside base area, 2 gas each) ──
  placeMinerals(tiles, walkable, 14, 36);
  setTile(tiles, walkable, 12, 44, TileType.Gas);
  setTile(tiles, walkable, 18, 44, TileType.Gas);
  placeMinerals(tiles, walkable, MAP_ROWS - 18, MAP_COLS - 40);
  setTile(tiles, walkable, MAP_ROWS - 14, MAP_COLS - 46, TileType.Gas);
  setTile(tiles, walkable, MAP_ROWS - 20, MAP_COLS - 46, TileType.Gas);

  // ── Third expansion in closest maze room ──
  placeSmallMinerals(tiles, walkable, room0r + 2, room0c + 2);
  setTile(tiles, walkable, room0r + 6, room0c + roomSize - 3, TileType.Gas);
  placeSmallMinerals(tiles, walkable, room8r + roomSize - 6, room8c + roomSize - 6);
  setTile(tiles, walkable, room8r + roomSize - 10, room8c + 2, TileType.Gas);

  // ── Contested center room resources ──
  const [ctrR, ctrC] = roomPositions[4]; // Center room (index 4 in 3×3)
  placeMinerals(tiles, walkable, ctrR + 3, ctrC + 3);
  setTile(tiles, walkable, ctrR + 1, ctrC + roomSize - 3, TileType.Gas);
  setTile(tiles, walkable, ctrR + roomSize - 3, ctrC + 1, TileType.Gas);

  // ── Watchtower at center room ──
  placeWatchtower(tiles, walkable, ctrR + Math.floor(roomSize / 2), ctrC + Math.floor(roomSize / 2));

  // ── Back-door rocks behind naturals ──
  placeBackdoorRocks(tiles, walkable, destructibleHP, 12, 48);
  placeBackdoorRocks(tiles, walkable, destructibleHP, MAP_ROWS - 16, MAP_COLS - 52);

  // ── Overlook cliff near P1 natural ──
  placeOverlookCliff(tiles, walkable, 10, 36, false);
  placeOverlookCliff(tiles, walkable, MAP_ROWS - 14, MAP_COLS - 42, false);

  // ── Pocket expansion in side room ──
  const [room1r, room1c] = roomPositions[1]; // top-center room
  placePocketExpansion(tiles, walkable, room1r + 2, room1c + 2, 'top');
  const [room7r, room7c] = roomPositions[7]; // bottom-center room
  placePocketExpansion(tiles, walkable, room7r + 2, room7c + 2, 'bottom');

  // ── Ice lakes in corner rooms ──
  const [room2r, room2c] = roomPositions[2]; // top-right room
  const [room6r, room6c] = roomPositions[6]; // bottom-left room
  placeWaterPatch(tiles, walkable, room2r + Math.floor(roomSize / 2), room2c + Math.floor(roomSize / 2), 4);
  placeWaterPatch(tiles, walkable, room6r + Math.floor(roomSize / 2), room6c + Math.floor(roomSize / 2), 4);

  // ── Destructible rocks — block maze corridor shortcuts ──
  placeSymmetricRocks(tiles, walkable, destructibleHP, [
    [26, 40], [27, 40],   // Base entrance to first maze room
    [40, 26], [40, 27],   // Side entrance blocker
  ]);
}

/**
 * Volcano — circular arena with impassable lava core. Bases at 7 o'clock / 1 o'clock
 * positions on the outer ring (180° symmetry). Two attack paths around the volcano.
 * 3-tier expansion structure. Inspired by: World of Sleepers, Pillars of Gold.
 */
function generateVolcano(tiles: Uint8Array, walkable: Uint8Array, destructibleHP: Uint16Array): void {
  const cx = 64;
  const cy = 64;
  const mapRadius = 60;
  const lavaCore = 10;   // Impassable inner lava
  const lavaOuter = 16;  // Ramp-marked danger ring (walkable but exposed)

  // ── Fill outside circle with water ──
  for (let r = 2; r < MAP_ROWS - 2; r++) {
    for (let c = 2; c < MAP_COLS - 2; c++) {
      const dist = Math.sqrt((r - cy) ** 2 + (c - cx) ** 2);
      if (dist > mapRadius) {
        setTile(tiles, walkable, r, c, TileType.Water);
      }
    }
  }

  // ── Central lava zone ──
  for (let r = cy - lavaOuter; r <= cy + lavaOuter; r++) {
    for (let c = cx - lavaOuter; c <= cx + lavaOuter; c++) {
      if (r < 1 || r >= MAP_ROWS - 1 || c < 1 || c >= MAP_COLS - 1) continue;
      const dist = Math.sqrt((r - cy) ** 2 + (c - cx) ** 2);
      if (dist <= lavaCore) {
        // Inner lava = impassable water
        setTile(tiles, walkable, r, c, TileType.Water);
      } else if (dist <= lavaOuter) {
        // Outer ring = walkable danger zone (ramp terrain)
        setTile(tiles, walkable, r, c, TileType.Ramp);
      }
    }
  }

  // ── Bases at 7 o'clock (P1) and 1 o'clock (P2) — 180° rotational symmetry ──
  // P1 at roughly (100, 30) — bottom-left arc
  // P2 at roughly (28, 98) — top-right arc (180° mirror)

  // P1 base cliff enclosure
  for (let r = 88; r < 104; r++) {
    for (let c = 18; c < 22; c++) {
      const dist = Math.sqrt((r - cy) ** 2 + (c - cx) ** 2);
      if (dist <= mapRadius) {
        setTile(tiles, walkable, r, c, TileType.Unbuildable);
      }
    }
  }
  for (let r = 104; r < 108; r++) {
    for (let c = 18; c < 48; c++) {
      if (c >= 30 && c <= 34) continue; // 5-tile ramp gap
      const dist = Math.sqrt((r - cy) ** 2 + (c - cx) ** 2);
      if (dist <= mapRadius) {
        setTile(tiles, walkable, r, c, TileType.Unbuildable);
      }
    }
  }

  // P2 base cliff enclosure (180° mirror)
  for (let r = 24; r < 40; r++) {
    for (let c = 106; c < 110; c++) {
      const dist = Math.sqrt((r - cy) ** 2 + (c - cx) ** 2);
      if (dist <= mapRadius) {
        setTile(tiles, walkable, r, c, TileType.Unbuildable);
      }
    }
  }
  for (let r = 20; r < 24; r++) {
    for (let c = 80; c < 110; c++) {
      if (c >= 93 && c <= 97) continue; // 5-tile ramp gap
      const dist = Math.sqrt((r - cy) ** 2 + (c - cx) ** 2);
      if (dist <= mapRadius) {
        setTile(tiles, walkable, r, c, TileType.Unbuildable);
      }
    }
  }

  // ── P1 main resources (elevated, 2 gas) ──
  markBaseElevation(tiles, walkable, 88, 22, 106, 42);
  placeMinerals(tiles, walkable, 96, 28);
  setTile(tiles, walkable, 94, 36, TileType.Gas);
  setTile(tiles, walkable, 100, 26, TileType.Gas);

  // ── P2 main resources (elevated, 180° mirror) ──
  markBaseElevation(tiles, walkable, MAP_ROWS - 107, MAP_COLS - 43, MAP_ROWS - 89, MAP_COLS - 23);
  placeMinerals(tiles, walkable, MAP_ROWS - 100, MAP_COLS - 32);
  setTile(tiles, walkable, MAP_ROWS - 96, MAP_COLS - 38, TileType.Gas);
  setTile(tiles, walkable, MAP_ROWS - 102, MAP_COLS - 28, TileType.Gas);

  // ── Naturals (just outside base wall ramp, 2 gas each) ──
  placeMinerals(tiles, walkable, 108, 38);
  setTile(tiles, walkable, 110, 46, TileType.Gas);
  setTile(tiles, walkable, 112, 36, TileType.Gas);
  placeMinerals(tiles, walkable, MAP_ROWS - 112, MAP_COLS - 42);
  setTile(tiles, walkable, MAP_ROWS - 112, MAP_COLS - 48, TileType.Gas);
  setTile(tiles, walkable, MAP_ROWS - 114, MAP_COLS - 38, TileType.Gas);

  // ── Third bases at 3 o'clock and 9 o'clock (contested, exposed) ──
  placeMinerals(tiles, walkable, cy - 4, cx + 38);
  setTile(tiles, walkable, cy - 2, cx + 46, TileType.Gas);
  placeMinerals(tiles, walkable, cy, cx - 42);
  setTile(tiles, walkable, cy + 2, cx - 48, TileType.Gas);

  // ── Cliff barriers creating two distinct attack paths (clockwise / counter-clockwise) ──
  // Top barrier (blocks direct north path)
  for (let c = cx - 6; c <= cx + 6; c++) {
    for (let r = cy - mapRadius + 6; r < cy - mapRadius + 12; r++) {
      if (r >= 1 && r < MAP_ROWS - 1 && c >= 1 && c < MAP_COLS - 1) {
        const dist = Math.sqrt((r - cy) ** 2 + (c - cx) ** 2);
        if (dist <= mapRadius) {
          setTile(tiles, walkable, r, c, TileType.Unbuildable);
        }
      }
    }
  }
  // Bottom barrier (180° mirror)
  for (let c = cx - 6; c <= cx + 6; c++) {
    for (let r = cy + mapRadius - 12; r < cy + mapRadius - 6; r++) {
      if (r >= 1 && r < MAP_ROWS - 1 && c >= 1 && c < MAP_COLS - 1) {
        const dist = Math.sqrt((r - cy) ** 2 + (c - cx) ** 2);
        if (dist <= mapRadius) {
          setTile(tiles, walkable, r, c, TileType.Unbuildable);
        }
      }
    }
  }

  // ── Watchtowers between lava ring and third bases ──
  placeWatchtower(tiles, walkable, cy, cx + 24);
  placeWatchtower(tiles, walkable, cy, cx - 24);

  // ── Ramp tiles at base cliff ramp exits ──
  placeRampTiles(tiles, walkable, 104, 30, 107, 34);   // P1 ramp
  placeRampTiles(tiles, walkable, MAP_ROWS - 108, MAP_COLS - 35, MAP_ROWS - 105, MAP_COLS - 31);

  // ── Overlook cliffs near naturals ──
  placeOverlookCliff(tiles, walkable, 112, 36, false);
  placeOverlookCliff(tiles, walkable, MAP_ROWS - 116, MAP_COLS - 42, false);

  // ── Terrain debris on arena ground ──
  scatterTerrainDebris(tiles, walkable, 20, 40, 50, 90);
  scatterTerrainDebris(tiles, walkable, 78, 38, 108, 88);

  // ── Back-door rocks behind naturals (opens arc shortcut) ──
  placeBackdoorRocks(tiles, walkable, destructibleHP, 110, 50);
  placeBackdoorRocks(tiles, walkable, destructibleHP, MAP_ROWS - 114, MAP_COLS - 54);

  // ── Destructible rocks — third base approach guard ──
  placeSymmetricRocks(tiles, walkable, destructibleHP, [
    [60, 42], [60, 43],   // Guards 9 o'clock third approach
  ]);
}

function placeRock(tiles: Uint8Array, walkable: Uint8Array, destructibleHP: Uint16Array, row: number, col: number): void {
  if (row < 1 || row >= MAP_ROWS - 1 || col < 1 || col >= MAP_COLS - 1) return;
  // Only place on ground tiles — don't overwrite minerals, gas, or water
  const idx = row * MAP_COLS + col;
  if (tiles[idx] !== TileType.Ground) return;
  setTile(tiles, walkable, row, col, TileType.Destructible);
  destructibleHP[idx] = 500;
}

/**
 * Spawn ECS entities for every destructible rock tile in the map.
 * Each rock is a BUILDING entity (BuildingType.Rock) that can be attacked.
 * When HP drops to 0, DeathSystem calls clearBuildingTiles which restores walkability.
 * Called once during Game.init().
 */
export function spawnRockEntities(world: World, map: MapData): void {
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      const idx = r * map.cols + c;
      if (map.tiles[idx] !== TileType.Destructible) continue;

      const eid = addEntity(world);
      addBuildingComponents(world, eid);

      const wx = c * TILE_SIZE + TILE_SIZE / 2;
      const wy = r * TILE_SIZE + TILE_SIZE / 2;

      posX[eid] = wx;
      posY[eid] = wy;
      hpCurrent[eid] = 500;
      hpMax[eid] = 500;
      faction[eid] = Faction.None;
      buildingType[eid] = BuildingType.Rock;
      buildState[eid] = BuildState.Complete;
      renderWidth[eid] = TILE_SIZE - 4;
      renderHeight[eid] = TILE_SIZE - 4;
      renderTint[eid] = 0x666055;
      selected[eid] = 0;
    }
  }
}

function setTile(tiles: Uint8Array, walkable: Uint8Array, row: number, col: number, type: TileType): void {
  if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return;
  const idx = row * MAP_COLS + col;
  tiles[idx] = type;
  walkable[idx] = (type === TileType.Ground || type === TileType.Ramp) ? 1 : 0;
}

function placeMinerals(tiles: Uint8Array, walkable: Uint8Array, startRow: number, startCol: number): void {
  // 8 mineral patches in a concave arc (SC2-style mineral line)
  // The arc faces inward toward where the CC/Hatch would be placed
  const offsets = [
    [0, 0], [0, 1], [0, 2], [0, 3],  // Front row (4 patches)
    [1, -1], [1, 0], [1, 3], [1, 4],  // Back row curves outward at edges
  ];
  for (const [dr, dc] of offsets) {
    setTile(tiles, walkable, startRow + dr, startCol + dc, TileType.Minerals);
  }
}

/** Place symmetric destructible rocks — positions auto-mirrored about map center (64,64) */
function placeSymmetricRocks(tiles: Uint8Array, walkable: Uint8Array, destructibleHP: Uint16Array, positions: Array<[number, number]>): void {
  for (const [r, c] of positions) {
    placeRock(tiles, walkable, destructibleHP, r, c);
    placeRock(tiles, walkable, destructibleHP, MAP_ROWS - 1 - r, MAP_COLS - 1 - c);
  }
}

/** Place ramp tiles in a rectangular area to mark elevation transitions at choke entrances */
function placeRampTiles(tiles: Uint8Array, walkable: Uint8Array, r1: number, c1: number, r2: number, c2: number): void {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      if (r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS) {
        const idx = r * MAP_COLS + c;
        if (tiles[idx] === TileType.Ground) {
          setTile(tiles, walkable, r, c, TileType.Ramp);
        }
      }
    }
  }
}

/**
 * Mark the perimeter of a main base area as elevated (Ramp tiles).
 * SC2 mains are on high ground — this creates a visual elevation border
 * around the base platform. Only marks a 2-tile thick perimeter ring.
 */
function markBaseElevation(tiles: Uint8Array, walkable: Uint8Array, r1: number, c1: number, r2: number, c2: number): void {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      if (r < 1 || r >= MAP_ROWS - 1 || c < 1 || c >= MAP_COLS - 1) continue;
      // Only mark the 2-tile perimeter ring, not the interior
      const isPerimeter = (r - r1 < 2) || (r2 - r < 2) || (c - c1 < 2) || (c2 - c < 2);
      if (!isPerimeter) continue;
      const idx = r * MAP_COLS + c;
      if (tiles[idx] === TileType.Ground) {
        setTile(tiles, walkable, r, c, TileType.Ramp);
      }
    }
  }
}

/**
 * Place a back-door destructible rock wall (SC2 LOTV signature feature).
 * A 3-tile wide, 2-tile deep rock barrier behind a natural expansion.
 * When destroyed, opens a shortcut attack path bypassing the natural ramp.
 */
function placeBackdoorRocks(tiles: Uint8Array, walkable: Uint8Array, destructibleHP: Uint16Array, row: number, col: number): void {
  for (let dr = 0; dr < 2; dr++) {
    for (let dc = 0; dc < 3; dc++) {
      placeRock(tiles, walkable, destructibleHP, row + dr, col + dc);
    }
  }
}

/**
 * Place a Xel'Naga watchtower — 3×3 elevated ramp platform with cliff ring.
 * Walkable raised ground that grants vision advantage.
 */
function placeWatchtower(tiles: Uint8Array, walkable: Uint8Array, centerR: number, centerC: number): void {
  for (let r = centerR - 3; r <= centerR + 3; r++) {
    for (let c = centerC - 3; c <= centerC + 3; c++) {
      if (r < 1 || r >= MAP_ROWS - 1 || c < 1 || c >= MAP_COLS - 1) continue;
      const dist = Math.sqrt((r - centerR) ** 2 + (c - centerC) ** 2);
      if (dist <= 1.5) {
        setTile(tiles, walkable, r, c, TileType.Ramp); // Elevated platform
      } else if (dist > 1.5 && dist <= 3) {
        // Only place cliff ring on ground tiles (don't overwrite resources/water)
        const idx = r * MAP_COLS + c;
        if (tiles[idx] === TileType.Ground) {
          setTile(tiles, walkable, r, c, TileType.Unbuildable);
        }
      }
    }
  }
  // Open 2-tile ramp access on 2 opposite sides
  setTile(tiles, walkable, centerR - 3, centerC, TileType.Ramp);
  setTile(tiles, walkable, centerR - 3, centerC + 1, TileType.Ramp);
  setTile(tiles, walkable, centerR + 3, centerC, TileType.Ramp);
  setTile(tiles, walkable, centerR + 3, centerC - 1, TileType.Ramp);
}

function placeWaterPatch(tiles: Uint8Array, walkable: Uint8Array, centerRow: number, centerCol: number, radius: number): void {
  for (let r = centerRow - radius; r <= centerRow + radius; r++) {
    for (let c = centerCol - radius; c <= centerCol + radius; c++) {
      const dist = Math.sqrt((r - centerRow) ** 2 + (c - centerCol) ** 2);
      if (dist <= radius) {
        setTile(tiles, walkable, r, c, TileType.Water);
      }
    }
  }
}

/**
 * Place an overlook cliff shelf near a base for harass play.
 * A 4×2 unbuildable cliff ledge adjacent to a mineral line that
 * flying/drop units can exploit (Liberator zones, Medivac drops).
 * Placed on one side of the mineral line as a cliff overhang.
 */
function placeOverlookCliff(tiles: Uint8Array, walkable: Uint8Array, row: number, col: number, horizontal: boolean): void {
  const w = horizontal ? 5 : 2;
  const h = horizontal ? 2 : 5;
  for (let dr = 0; dr < h; dr++) {
    for (let dc = 0; dc < w; dc++) {
      const r = row + dr;
      const c = col + dc;
      if (r >= 1 && r < MAP_ROWS - 1 && c >= 1 && c < MAP_COLS - 1) {
        const idx = r * MAP_COLS + c;
        if (tiles[idx] === TileType.Ground) {
          setTile(tiles, walkable, r, c, TileType.Unbuildable);
        }
      }
    }
  }
}

/**
 * Place a pocket expansion — a small base location tucked behind terrain.
 * Includes minerals, gas, and a protective unbuildable cliff on one side.
 */
function placePocketExpansion(tiles: Uint8Array, walkable: Uint8Array, row: number, col: number, shieldSide: 'top' | 'bottom' | 'left' | 'right'): void {
  placeSmallMinerals(tiles, walkable, row, col);
  setTile(tiles, walkable, row + 2, col + 2, TileType.Gas);

  // Protective cliff on the shield side
  if (shieldSide === 'top') {
    for (let c = col - 1; c < col + 6; c++) placeIfGround(tiles, walkable, row - 2, c);
    for (let c = col - 1; c < col + 6; c++) placeIfGround(tiles, walkable, row - 1, c);
  } else if (shieldSide === 'bottom') {
    for (let c = col - 1; c < col + 6; c++) placeIfGround(tiles, walkable, row + 2, c);
    for (let c = col - 1; c < col + 6; c++) placeIfGround(tiles, walkable, row + 3, c);
  } else if (shieldSide === 'left') {
    for (let r = row - 1; r < row + 3; r++) placeIfGround(tiles, walkable, r, col - 2);
    for (let r = row - 1; r < row + 3; r++) placeIfGround(tiles, walkable, r, col - 1);
  } else {
    for (let r = row - 1; r < row + 3; r++) placeIfGround(tiles, walkable, r, col + 5);
    for (let r = row - 1; r < row + 3; r++) placeIfGround(tiles, walkable, r, col + 6);
  }
}

function placeIfGround(tiles: Uint8Array, walkable: Uint8Array, r: number, c: number): void {
  if (r >= 1 && r < MAP_ROWS - 1 && c >= 1 && c < MAP_COLS - 1) {
    if (tiles[r * MAP_COLS + c] === TileType.Ground) {
      setTile(tiles, walkable, r, c, TileType.Unbuildable);
    }
  }
}

/**
 * Scatter terrain debris across an area to break up flat ground.
 * Places small unbuildable patches and ramp elevation tiles using a deterministic hash.
 * Avoids placing debris within 3 tiles of minerals, gas, or destructible rocks.
 */
function scatterTerrainDebris(tiles: Uint8Array, walkable: Uint8Array, r1: number, c1: number, r2: number, c2: number): void {
  for (let r = r1; r < r2; r++) {
    for (let c = c1; c < c2; c++) {
      if (r < 1 || r >= MAP_ROWS - 1 || c < 1 || c >= MAP_COLS - 1) continue;
      const idx = r * MAP_COLS + c;
      if (tiles[idx] !== TileType.Ground) continue;

      // Skip tiles near resources (3-tile exclusion zone)
      if (hasNearbyResource(tiles, r, c, 3)) continue;

      // Deterministic hash for consistent generation
      const hash = ((r * 7919 + c * 104729) >>> 0) % 100;

      // ~2% chance of small unbuildable debris (rocks, stumps)
      if (hash < 2) {
        setTile(tiles, walkable, r, c, TileType.Unbuildable);
      }
      // ~5% chance of ramp elevation patch (slight rise — walkable, adds visual variety)
      else if (hash >= 2 && hash < 7) {
        setTile(tiles, walkable, r, c, TileType.Ramp);
      }
    }
  }
}

/** Check if any tile within `radius` of (r, c) is a resource or destructible */
function hasNearbyResource(tiles: Uint8Array, row: number, col: number, radius: number): boolean {
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      const rr = row + dr;
      const cc = col + dc;
      if (rr < 0 || rr >= MAP_ROWS || cc < 0 || cc >= MAP_COLS) continue;
      const t = tiles[rr * MAP_COLS + cc];
      if (t === TileType.Minerals || t === TileType.Gas || t === TileType.Destructible) {
        return true;
      }
    }
  }
  return false;
}

/** Convert tile (col, row) to world pixel coordinates (center of tile) */
export function tileToWorld(col: number, row: number): { x: number; y: number } {
  return {
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2,
  };
}

/** Convert world pixel coordinates to tile (col, row) */
export function worldToTile(x: number, y: number): { col: number; row: number } {
  return {
    col: Math.floor(x / TILE_SIZE),
    row: Math.floor(y / TILE_SIZE),
  };
}

/** Get tile type at world coordinates */
export function getTileAt(map: MapData, x: number, y: number): TileType {
  const { col, row } = worldToTile(x, y);
  if (col < 0 || col >= map.cols || row < 0 || row >= map.rows) return TileType.Water;
  return map.tiles[row * map.cols + col] as TileType;
}

/** Check if a world position is walkable */
export function isWalkable(map: MapData, x: number, y: number): boolean {
  const { col, row } = worldToTile(x, y);
  if (col < 0 || col >= map.cols || row < 0 || row >= map.rows) return false;
  return map.walkable[row * map.cols + col] === 1;
}

/** Get all resource tile positions */
export function getResourceTiles(map: MapData): Array<{ col: number; row: number; type: TileType }> {
  const result: Array<{ col: number; row: number; type: TileType }> = [];
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      const t = map.tiles[r * map.cols + c] as TileType;
      if (t === TileType.Minerals || t === TileType.Gas) {
        result.push({ col: c, row: r, type: t });
      }
    }
  }
  return result;
}

/** Find nearest walkable tile to a given (possibly unwalkable) tile */
export function findNearestWalkableTile(map: MapData, col: number, row: number): { col: number; row: number } | null {
  if (col >= 0 && col < map.cols && row >= 0 && row < map.rows && map.walkable[row * map.cols + col] === 1) {
    return { col, row };
  }
  // BFS in expanding rings
  for (let radius = 1; radius <= 5; radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue; // only check ring
        const r = row + dr;
        const c = col + dc;
        if (c < 0 || c >= map.cols || r < 0 || r >= map.rows) continue;
        if (map.walkable[r * map.cols + c] === 1) return { col: c, row: r };
      }
    }
  }
  return null;
}

/** Check if a building footprint contains a gas geyser tile (for Refinery placement) */
export function isGeyserTile(map: MapData, col: number, row: number, tileW: number, tileH: number): boolean {
  const startCol = col - Math.floor(tileW / 2);
  const startRow = row - Math.floor(tileH / 2);
  let hasGas = false;
  for (let r = startRow; r < startRow + tileH; r++) {
    for (let c = startCol; c < startCol + tileW; c++) {
      if (c < 0 || c >= map.cols || r < 0 || r >= map.rows) return false;
      const t = map.tiles[r * map.cols + c] as TileType;
      if (t === TileType.Gas) {
        hasGas = true;
      } else if (t !== TileType.Ground && t !== TileType.Ramp) {
        // Non-gas non-ground tile in footprint — invalid placement
        return false;
      }
    }
  }
  return hasGas;
}

/** Check if a building footprint can be placed at (col, row) */
export function isBuildable(map: MapData, col: number, row: number, tileW: number, tileH: number): boolean {
  const startCol = col - Math.floor(tileW / 2);
  const startRow = row - Math.floor(tileH / 2);
  for (let r = startRow; r < startRow + tileH; r++) {
    for (let c = startCol; c < startCol + tileW; c++) {
      if (c < 0 || c >= map.cols || r < 0 || r >= map.rows) return false;
      if (map.walkable[r * map.cols + c] !== 1) return false;
      if (map.tiles[r * map.cols + c] !== TileType.Ground) return false;
    }
  }
  return true;
}

/** Mark tiles occupied by a building (unwalkable) */
export function markBuildingTiles(map: MapData, col: number, row: number, tileW: number, tileH: number): void {
  const startCol = col - Math.floor(tileW / 2);
  const startRow = row - Math.floor(tileH / 2);
  for (let r = startRow; r < startRow + tileH; r++) {
    for (let c = startCol; c < startCol + tileW; c++) {
      if (c >= 0 && c < map.cols && r >= 0 && r < map.rows) {
        map.walkable[r * map.cols + c] = 0;
      }
    }
  }
  // Invalidate pathfinder cache
  invalidatePathfinderCache();
}

/** Clear tiles occupied by a destroyed building (make walkable again) */
export function clearBuildingTiles(map: MapData, col: number, row: number, tileW: number, tileH: number): void {
  const startCol = col - Math.floor(tileW / 2);
  const startRow = row - Math.floor(tileH / 2);
  for (let r = startRow; r < startRow + tileH; r++) {
    for (let c = startCol; c < startCol + tileW; c++) {
      if (c >= 0 && c < map.cols && r >= 0 && r < map.rows) {
        map.walkable[r * map.cols + c] = 1;
        map.tiles[r * map.cols + c] = TileType.Ground;
      }
    }
  }
  invalidatePathfinderCache();
}

/** Exported callback set by Pathfinder to invalidate its cache */
let invalidatePathfinderCache: () => void = () => {};
export function setPathfinderInvalidator(fn: () => void): void {
  invalidatePathfinderCache = fn;
}
