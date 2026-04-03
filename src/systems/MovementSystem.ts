import { type World, hasComponents } from '../ecs/world';
import {
  POSITION, MOVEMENT, BUILDING, RESOURCE,
  posX, posY, velX, velY,
  moveSpeed, moveTargetX, moveTargetY,
  movePathIndex, pathLengths, getPathWaypoint,
  slowFactor, siegeMode, faction, hpCurrent,
  patrolOriginX, patrolOriginY, commandMode, setPath, targetEntity,
  isAir, lastMovedTime,
} from '../ecs/components';
import { spatialHash } from '../ecs/SpatialHash';
import { SiegeMode, CommandMode, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, Faction } from '../constants';
import type { MapData } from '../map/MapData';
import { worldToTile, tileToWorld } from '../map/MapData';
import { findPath } from '../map/Pathfinder';

const ARRIVAL_THRESHOLD = 4; // px — close enough to waypoint

// ── Separation constants ──
const SEPARATION_RADIUS = 12; // px — half a tile
const SEPARATION_RADIUS_SQ = SEPARATION_RADIUS * SEPARATION_RADIUS;
const SEPARATION_STRENGTH = 0.5;

/**
 * Moves entities along their paths toward their targets,
 * then applies separation steering to prevent unit stacking.
 * Runs every tick.
 */
export function movementSystem(world: World, dt: number, map?: MapData, gameTime = 0): void {
  const bits = POSITION | MOVEMENT;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;

    // Skip dead units
    if (hpCurrent[eid] <= 0) continue;

    // Siege immobilization: sieged or transitioning tanks can't move
    const sm = siegeMode[eid] as SiegeMode;
    if (sm === SiegeMode.Sieged || sm === SiegeMode.Packing || sm === SiegeMode.Unpacking) {
      velX[eid] = 0;
      velY[eid] = 0;
      movePathIndex[eid] = -1;
      continue;
    }

    const pathIdx = movePathIndex[eid];

    // Stuck detection: if has a path but hasn't moved in 0.5s, force a repath
    if (gameTime > 0 && pathIdx >= 0 && gameTime - lastMovedTime[eid] > 0.5) {
      movePathIndex[eid] = -1;
      lastMovedTime[eid] = gameTime;
    }
    if (pathIdx < 0) {
      // If patrolling and idle (path cleared by combat), re-issue path toward origin
      if (commandMode[eid] === CommandMode.Patrol && map && targetEntity[eid] < 1) {
        const startTile = worldToTile(posX[eid], posY[eid]);
        const endTile = worldToTile(patrolOriginX[eid], patrolOriginY[eid]);
        const tilePath = findPath(map, startTile.col, startTile.row, endTile.col, endTile.row);
        if (tilePath.length > 0) {
          const worldPath: Array<[number, number]> = tilePath.map(([c, r]) => {
            const wp = tileToWorld(c, r);
            return [wp.x, wp.y] as [number, number];
          });
          setPath(eid, worldPath);
          // Don't continue — fall through to the path-following logic below
        } else {
          velX[eid] = 0;
          velY[eid] = 0;
          continue;
        }
      } else {
        velX[eid] = 0;
        velY[eid] = 0;
        continue;
      }
    }

    // Get current waypoint
    const wp = getPathWaypoint(eid, pathIdx);
    if (!wp) {
      // Path complete
      movePathIndex[eid] = -1;
      velX[eid] = 0;
      velY[eid] = 0;
      continue;
    }

    const [tx, ty] = wp;
    const dx = tx - posX[eid];
    const dy = ty - posY[eid];
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < ARRIVAL_THRESHOLD) {
      movePathIndex[eid]++;
      if (movePathIndex[eid] >= pathLengths[eid]) {
        // Path complete
        if (commandMode[eid] === CommandMode.Patrol && map) {
          // Swap: current pos becomes new origin, old origin becomes new target
          const newTargetX = patrolOriginX[eid];
          const newTargetY = patrolOriginY[eid];
          patrolOriginX[eid] = posX[eid];
          patrolOriginY[eid] = posY[eid];
          // Re-path to the old origin
          const startTile = worldToTile(posX[eid], posY[eid]);
          const endTile = worldToTile(newTargetX, newTargetY);
          const tilePath = findPath(map, startTile.col, startTile.row, endTile.col, endTile.row);
          if (tilePath.length > 0) {
            const worldPath: Array<[number, number]> = tilePath.map(([c, r]) => {
              const wp = tileToWorld(c, r);
              return [wp.x, wp.y] as [number, number];
            });
            setPath(eid, worldPath);
          } else {
            // No path found — stop patrol
            movePathIndex[eid] = -1;
            commandMode[eid] = CommandMode.Idle;
            velX[eid] = 0;
            velY[eid] = 0;
          }
        } else {
          movePathIndex[eid] = -1;
          velX[eid] = 0;
          velY[eid] = 0;
        }
      }
      continue;
    }

    // Apply slow debuff: reduce effective speed
    let effectiveSpeed = slowFactor[eid] > 0
      ? moveSpeed[eid] * (1 - slowFactor[eid])
      : moveSpeed[eid];

    // Creep bonus: Zerg units on creep move 30% faster
    if (map && faction[eid] === Faction.Zerg) {
      const col = Math.floor(posX[eid] / TILE_SIZE);
      const row = Math.floor(posY[eid] / TILE_SIZE);
      if (col >= 0 && col < map.cols && row >= 0 && row < map.rows) {
        if (map.creepMap[row * map.cols + col] === 1) {
          effectiveSpeed *= 1.3;
        }
      }
    }

    const speed = effectiveSpeed * dt;
    const nx = dx / dist;
    const ny = dy / dist;
    velX[eid] = nx * effectiveSpeed;
    velY[eid] = ny * effectiveSpeed;

    posX[eid] += nx * speed;
    posY[eid] += ny * speed;
    if (gameTime > 0) {
      lastMovedTime[eid] = gameTime;
    }
  }

  // ── Separation pass ──
  // Push overlapping same-faction units apart. Only affects entities with MOVEMENT
  // (not buildings/resources). O(n^2) but fine for <200 units.
  separationPass(world, map);
}

function separationPass(world: World, map?: MapData): void {
  const bits = POSITION | MOVEMENT;

  spatialHash.ensureBuilt(world);

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (hpCurrent[eid] <= 0) continue;
    // Skip stationary units for performance — only separate moving units
    if (velX[eid] === 0 && velY[eid] === 0 && movePathIndex[eid] < 0) continue;
    // Skip buildings and resources
    if (hasComponents(world, eid, BUILDING) || hasComponents(world, eid, RESOURCE)) continue;

    const ax = posX[eid];
    const ay = posY[eid];
    const facA = faction[eid];

    const nearby = spatialHash.queryRadius(ax, ay, SEPARATION_RADIUS * 2);
    for (const other of nearby) {
      if (other <= eid) continue; // avoid double-processing
      if (!hasComponents(world, other, bits)) continue;
      if (hpCurrent[other] <= 0) continue;
      if (hasComponents(world, other, BUILDING) || hasComponents(world, other, RESOURCE)) continue;

      // Do not separate air units from ground units (different z-layer)
      if (isAir[eid] !== isAir[other]) continue;

      // Only separate same-faction units
      if (faction[other] !== facA) continue;

      const bx = posX[other];
      const by = posY[other];
      const dx = bx - ax;
      const dy = by - ay;
      const distSq = dx * dx + dy * dy;

      if (distSq >= SEPARATION_RADIUS_SQ || distSq < 0.01) continue;

      const dist = Math.sqrt(distSq);
      const overlap = SEPARATION_RADIUS - dist;
      const pushDist = overlap * SEPARATION_STRENGTH;

      // Normalize direction
      const nx = dx / dist;
      const ny = dy / dist;

      const pushX = nx * pushDist;
      const pushY = ny * pushDist;

      // Apply equal-opposite offset
      let newAX = ax - pushX;
      let newAY = ay - pushY;
      let newBX = bx + pushX;
      let newBY = by + pushY;

      // Clamp to map bounds
      newAX = Math.max(TILE_SIZE / 2, Math.min(MAP_WIDTH - TILE_SIZE / 2, newAX));
      newAY = Math.max(TILE_SIZE / 2, Math.min(MAP_HEIGHT - TILE_SIZE / 2, newAY));
      newBX = Math.max(TILE_SIZE / 2, Math.min(MAP_WIDTH - TILE_SIZE / 2, newBX));
      newBY = Math.max(TILE_SIZE / 2, Math.min(MAP_HEIGHT - TILE_SIZE / 2, newBY));

      // Don't push onto unwalkable tiles
      if (map) {
        const colA = Math.floor(newAX / TILE_SIZE);
        const rowA = Math.floor(newAY / TILE_SIZE);
        if (colA >= 0 && colA < map.cols && rowA >= 0 && rowA < map.rows) {
          if (isAir[eid] === 1 || map.walkable[rowA * map.cols + colA] === 1) {
            posX[eid] = newAX;
            posY[eid] = newAY;
          }
        }

        const colB = Math.floor(newBX / TILE_SIZE);
        const rowB = Math.floor(newBY / TILE_SIZE);
        if (colB >= 0 && colB < map.cols && rowB >= 0 && rowB < map.rows) {
          if (isAir[other] === 1 || map.walkable[rowB * map.cols + colB] === 1) {
            posX[other] = newBX;
            posY[other] = newBY;
          }
        }
      } else {
        posX[eid] = newAX;
        posY[eid] = newAY;
        posX[other] = newBX;
        posY[other] = newBY;
      }
    }
  }
}
