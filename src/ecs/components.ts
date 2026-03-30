import { MAX_ENTITIES } from '../constants';
import { componentBit, World } from './world';

// ── Component bits ──
export const POSITION = componentBit();
export const VELOCITY = componentBit();
export const HEALTH = componentBit();
export const ATTACK = componentBit();
export const MOVEMENT = componentBit();
export const SELECTABLE = componentBit();
export const RENDERABLE = componentBit();
export const UNIT_TYPE = componentBit();
export const ABILITY = componentBit();

// ── Position (x, y) ──
export const posX = new Float32Array(MAX_ENTITIES);
export const posY = new Float32Array(MAX_ENTITIES);

// ── Velocity (vx, vy) ──
export const velX = new Float32Array(MAX_ENTITIES);
export const velY = new Float32Array(MAX_ENTITIES);

// ── Health (current, max) ──
export const hpCurrent = new Float32Array(MAX_ENTITIES);
export const hpMax = new Float32Array(MAX_ENTITIES);

// ── Attack ──
export const atkDamage = new Float32Array(MAX_ENTITIES);
export const atkRange = new Float32Array(MAX_ENTITIES);
export const atkCooldown = new Float32Array(MAX_ENTITIES);
export const atkLastTime = new Float32Array(MAX_ENTITIES);
export const atkSplash = new Float32Array(MAX_ENTITIES);

// ── Movement ──
export const moveSpeed = new Float32Array(MAX_ENTITIES);
export const moveTargetX = new Float32Array(MAX_ENTITIES);
export const moveTargetY = new Float32Array(MAX_ENTITIES);
/** Index into path array, -1 = no path */
export const movePathIndex = new Int16Array(MAX_ENTITIES);

// ── Selectable ──
/** 0 = not selected, 1 = selected */
export const selected = new Uint8Array(MAX_ENTITIES);
/** Faction enum value */
export const faction = new Uint8Array(MAX_ENTITIES);

// ── Renderable ──
export const renderWidth = new Float32Array(MAX_ENTITIES);
export const renderHeight = new Float32Array(MAX_ENTITIES);
export const renderTint = new Uint32Array(MAX_ENTITIES);

// ── Unit type ──
export const unitType = new Uint8Array(MAX_ENTITIES);

// ── Combat target ──
/** Entity ID of current attack target, -1 = no target */
export const targetEntity = new Int16Array(MAX_ENTITIES);

// ── Command mode ──
/** CommandMode enum value: Idle=0, Move=1, AttackMove=2, AttackTarget=3 */
export const commandMode = new Uint8Array(MAX_ENTITIES);

// ── Attack flash timer (seconds remaining) ──
export const atkFlashTimer = new Float32Array(MAX_ENTITIES);

// ── Ability: Stim Pack ──
/** gameTime when stim expires, 0 = not stimmed */
export const stimEndTime = new Float32Array(MAX_ENTITIES);

// ── Ability: Concussive Shells (debuff on target) ──
/** gameTime when slow expires, 0 = not slowed */
export const slowEndTime = new Float32Array(MAX_ENTITIES);
/** Speed reduction multiplier (0.5 = 50% slower), 0 = no slow */
export const slowFactor = new Float32Array(MAX_ENTITIES);

// ── Ability: Siege Mode ──
/** SiegeMode enum: 0=Mobile, 1=Sieged, 2=Packing, 3=Unpacking */
export const siegeMode = new Uint8Array(MAX_ENTITIES);
/** gameTime when pack/unpack transition completes */
export const siegeTransitionEnd = new Float32Array(MAX_ENTITIES);

// ── Ability: Roach Regen ──
/** gameTime of last attack-dealt or damage-received */
export const lastCombatTime = new Float32Array(MAX_ENTITIES);

// ── Path storage (per-entity, up to 64 waypoints) ──
const MAX_PATH_LENGTH = 64;
export const paths: Float32Array[] = new Array(MAX_ENTITIES);
export const pathLengths = new Uint8Array(MAX_ENTITIES);

export function setPath(eid: number, waypoints: Array<[number, number]>): void {
  const len = Math.min(waypoints.length, MAX_PATH_LENGTH);
  if (!paths[eid]) {
    paths[eid] = new Float32Array(MAX_PATH_LENGTH * 2);
  }
  for (let i = 0; i < len; i++) {
    paths[eid][i * 2] = waypoints[i][0];
    paths[eid][i * 2 + 1] = waypoints[i][1];
  }
  pathLengths[eid] = len;
  movePathIndex[eid] = 0;
}

export function getPathWaypoint(eid: number, index: number): [number, number] | null {
  if (index < 0 || index >= pathLengths[eid]) return null;
  return [paths[eid][index * 2], paths[eid][index * 2 + 1]];
}

/** Add all components for a unit entity */
export function addUnitComponents(world: World, eid: number): void {
  world.mask[eid] |= POSITION | VELOCITY | HEALTH | ATTACK | MOVEMENT | SELECTABLE | RENDERABLE | UNIT_TYPE | ABILITY;
}

/** Reset all component data for an entity */
export function resetComponents(eid: number): void {
  posX[eid] = 0; posY[eid] = 0;
  velX[eid] = 0; velY[eid] = 0;
  hpCurrent[eid] = 0; hpMax[eid] = 0;
  atkDamage[eid] = 0; atkRange[eid] = 0; atkCooldown[eid] = 0;
  atkLastTime[eid] = 0; atkSplash[eid] = 0;
  moveSpeed[eid] = 0; moveTargetX[eid] = -1; moveTargetY[eid] = -1;
  movePathIndex[eid] = -1;
  selected[eid] = 0; faction[eid] = 0;
  renderWidth[eid] = 0; renderHeight[eid] = 0; renderTint[eid] = 0;
  unitType[eid] = 0;
  pathLengths[eid] = 0;
  targetEntity[eid] = -1;
  commandMode[eid] = 0;
  atkFlashTimer[eid] = 0;
  stimEndTime[eid] = 0;
  slowEndTime[eid] = 0;
  slowFactor[eid] = 0;
  siegeMode[eid] = 0;
  siegeTransitionEnd[eid] = 0;
  lastCombatTime[eid] = 0;
}
