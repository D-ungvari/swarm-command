import { type World, hasComponents } from '../ecs/world';
import { POSITION, BUILDING } from '../ecs/components';
import { posX, posY, faction, buildingType, buildState } from '../ecs/components';
import { Faction, BuildState, BuildingType } from '../constants';
import { worldToTile, type MapData } from '../map/MapData';

// Creep spreads outward from Zerg buildings up to this tile radius
const CREEP_RADIUS = 10;
// Seconds between each spread tick
const CREEP_SPREAD_INTERVAL = 5;

// Buildings that generate creep
const CREEP_BUILDINGS = new Set<BuildingType>([
  BuildingType.Hatchery,
  BuildingType.SpawningPool,
]);

let timeSinceSpread = 0;

/**
 * Spreads creep from completed Zerg buildings every CREEP_SPREAD_INTERVAL seconds.
 * Call this each game tick from Game.ts.
 */
export function creepSystem(world: World, map: MapData, dt: number): void {
  timeSinceSpread += dt;
  if (timeSinceSpread < CREEP_SPREAD_INTERVAL) return;
  timeSinceSpread = 0;

  spreadCreep(world, map);
}

/** BFS flood-fill creep outward by 1 tile per spread tick, up to CREEP_RADIUS from each building. */
function spreadCreep(world: World, map: MapData): void {
  const bits = POSITION | BUILDING;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (faction[eid] !== Faction.Zerg) continue;
    if (buildState[eid] !== BuildState.Complete) continue;
    if (!CREEP_BUILDINGS.has(buildingType[eid] as BuildingType)) continue;

    const origin = worldToTile(posX[eid], posY[eid]);
    bfsSpreadCreep(map, origin.col, origin.row);
  }
}

function bfsSpreadCreep(map: MapData, originCol: number, originRow: number): void {
  const { creepMap, cols, rows } = map;
  const maxRadiusSq = CREEP_RADIUS * CREEP_RADIUS;

  // BFS queue using flat tile indices
  const queue: number[] = [];
  const visited = new Uint8Array(cols * rows);

  const startIdx = originRow * cols + originCol;
  queue.push(startIdx);
  visited[startIdx] = 1;
  creepMap[startIdx] = 1;

  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const row = Math.floor(idx / cols);
    const col = idx % cols;

    // Four cardinal neighbours
    const neighbours: [number, number][] = [
      [col - 1, row],
      [col + 1, row],
      [col, row - 1],
      [col, row + 1],
    ];

    for (const [nc, nr] of neighbours) {
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const nIdx = nr * cols + nc;
      if (visited[nIdx]) continue;
      visited[nIdx] = 1;

      // Distance check from origin
      const ndc = nc - originCol;
      const ndr = nr - originRow;
      if (ndc * ndc + ndr * ndr > maxRadiusSq) continue;

      // Spread to this tile and continue BFS
      creepMap[nIdx] = 1;
      queue.push(nIdx);
    }
  }
}

/** Reset the creep timer (call when starting a new game). */
export function resetCreepSystem(): void {
  timeSinceSpread = 0;
}
