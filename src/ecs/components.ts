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
export const RESOURCE = componentBit();
export const WORKER = componentBit();
export const BUILDING = componentBit();
export const SUPPLY = componentBit();

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
export const atkMinRange = new Float32Array(MAX_ENTITIES);
export const atkHitCount = new Uint8Array(MAX_ENTITIES);

// ── Movement ──
export const moveSpeed = new Float32Array(MAX_ENTITIES);
export const groupSpeed = new Float32Array(MAX_ENTITIES); // 0 = use own speed, >0 = capped group speed
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

// ── Air / targeting capability ──
/** 1 = this unit is an air unit (flies over terrain, separate z-layer) */
export const isAir = new Uint8Array(MAX_ENTITIES);
/** 1 = this unit can attack ground targets */
export const canTargetGround = new Uint8Array(MAX_ENTITIES);
/** 1 = this unit can attack air targets */
export const canTargetAir = new Uint8Array(MAX_ENTITIES);

// ── Combat target ──
/** Entity ID of current attack target, -1 = no target */
export const targetEntity = new Int16Array(MAX_ENTITIES);

// ── Command mode ──
/** CommandMode enum value: Idle=0, Move=1, AttackMove=2, AttackTarget=3 */
export const commandMode = new Uint8Array(MAX_ENTITIES);

// ── Attack flash timer (seconds remaining) ──
export const atkFlashTimer = new Float32Array(MAX_ENTITIES);

// ── Bonus damage & armor ──
/** Extra damage applied when target has matching armor tag */
export const bonusDmg = new Float32Array(MAX_ENTITIES);
/** ArmorClass value that triggers bonus (-1 = no bonus, 0 = Light, 1 = Armored) */
export const bonusVsTag = new Int8Array(MAX_ENTITIES);
/** ArmorClass enum: Light=0, Armored=1 */
export const armorClass = new Uint8Array(MAX_ENTITIES);
/** Flat damage reduction applied before final damage (upgraded by armor upgrades) */
export const baseArmor = new Float32Array(MAX_ENTITIES);
/** Sum of committed incoming damage from pending attacks — used for overkill prevention */
export const pendingDamage = new Float32Array(MAX_ENTITIES);
/** Lifetime kill count for this entity */
export const killCount = new Uint16Array(MAX_ENTITIES);
/** Veterancy level: 0=Novice, 1=Veteran, 2=Elite, 3=Hero */
export const veterancyLevel = new Uint8Array(MAX_ENTITIES);
/** gameTime when next auto-acquire is allowed (0.15s cooldown between scans) */
export const nextAutoAcquireTime = new Float32Array(MAX_ENTITIES);

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

// ── Death animation ──
/** gameTime when unit died (0 = alive). Used for shrink/fade-out animation. */
export const deathTime = new Float32Array(MAX_ENTITIES);

// ── Cloak ──
/** Energy pool for cloaking. Max 200, drains 0.5/s while cloaked. */
export const energy = new Float32Array(MAX_ENTITIES);
/** 1 = cloaked, 0 = visible */
export const cloaked = new Uint8Array(MAX_ENTITIES);
/** 1 = burrowed (Lurker, WidowMine), 0 = unburrowed. Separate from cloak. */
export const burrowed = new Uint8Array(MAX_ENTITIES);

// ── Detection ──
/** 1 = this entity is a detector (MissileTurret, SporeCrawler, Overseer, Raven) */
export const isDetector = new Uint8Array(MAX_ENTITIES);
/** Detection range in world pixels */
export const detectionRange = new Float32Array(MAX_ENTITIES);
/** 1 = revealed by detection this tick (reset each frame) */
export const revealed = new Uint8Array(MAX_ENTITIES);

// ── Transport / Cargo ──
/** Max number of units this entity can carry (Medivac=8) */
export const cargoCapacity = new Uint8Array(MAX_ENTITIES);
/** Current number of loaded units */
export const cargoCount = new Uint8Array(MAX_ENTITIES);
/** Entity ID of the transport this unit is loaded into (0 = not loaded) */
export const loadedInto = new Int16Array(MAX_ENTITIES);
/** Medivac Boost: game time when boost expires (0 = no boost) */
export const boostEndTime = new Float32Array(MAX_ENTITIES);
/** Medivac Boost: game time when cooldown expires (0 = available) */
export const boostCooldownEnd = new Float32Array(MAX_ENTITIES);

// ── Morph ──
/** Target unit type to morph into (0 = not morphing) */
export const morphTarget = new Uint8Array(MAX_ENTITIES);
/** Morph timer remaining (seconds) */
export const morphProgress = new Float32Array(MAX_ENTITIES);
/** Total morph time for progress bar */
export const morphTimeTotal = new Float32Array(MAX_ENTITIES);

// ── Resource node ──
/** ResourceType enum: Mineral=1, Gas=2 */
export const resourceType = new Uint8Array(MAX_ENTITIES);
export const resourceRemaining = new Float32Array(MAX_ENTITIES);
/** How many workers are currently mining this resource entity */
export const workerCountOnResource = new Uint8Array(MAX_ENTITIES);

// ── Worker ──
/** WorkerState enum: Idle=0, MovingToResource=1, Mining=2, ReturningToBase=3 */
export const workerState = new Uint8Array(MAX_ENTITIES);
export const workerCarrying = new Float32Array(MAX_ENTITIES);
/** Resource entity being gathered from, -1 = none */
export const workerTargetEid = new Int16Array(MAX_ENTITIES);
export const workerMineTimer = new Float32Array(MAX_ENTITIES);
export const workerBaseX = new Float32Array(MAX_ENTITIES);
export const workerBaseY = new Float32Array(MAX_ENTITIES);

// ── Patrol ──
/** World position where patrol command was issued (one end of patrol route) */
export const patrolOriginX = new Float32Array(MAX_ENTITIES);
export const patrolOriginY = new Float32Array(MAX_ENTITIES);

// ── Stuck detection ──
/** gameTime when this entity last moved (path-following) */
export const lastMovedTime = new Float32Array(MAX_ENTITIES);

// ── Larva (Zerg Hatchery production) ──
/** Current larva count on this Hatchery (0-LARVA_MAX) */
export const larvaCount = new Uint8Array(MAX_ENTITIES);
/** Countdown to next larva spawn, in seconds */
export const larvaRegenTimer = new Float32Array(MAX_ENTITIES);
/** GameTime when inject larva completes (0 = no inject active) */
export const injectTimer = new Float32Array(MAX_ENTITIES);

// ── Ability: Corrosive Bile (Ravager) ──
/** gameTime when the bile impacts the target location, 0 = inactive */
export const bileLandTime = new Float32Array(MAX_ENTITIES);
/** World X position of the bile impact */
export const bileLandX = new Float32Array(MAX_ENTITIES);
/** World Y position of the bile impact */
export const bileLandY = new Float32Array(MAX_ENTITIES);

// ── Ability: Fungal Growth (Infestor) ──
/** gameTime when the fungal growth impacts the target location, 0 = inactive */
export const fungalLandTime = new Float32Array(MAX_ENTITIES);
/** World X position of the fungal impact */
export const fungalLandX = new Float32Array(MAX_ENTITIES);
/** World Y position of the fungal impact */
export const fungalLandY = new Float32Array(MAX_ENTITIES);

// ── Ability: KD8 Charge (Reaper) ──
/** gameTime when the KD8 charge detonates at the target location, 0 = inactive */
export const kd8LandTime = new Float32Array(MAX_ENTITIES);
/** World X position of the KD8 charge detonation */
export const kd8LandX = new Float32Array(MAX_ENTITIES);
/** World Y position of the KD8 charge detonation */
export const kd8LandY = new Float32Array(MAX_ENTITIES);

// ── Ability: Caustic Spray (Corruptor) ──
/** Entity ID of the building being channeled on, -1 = no channel */
export const causticTarget = new Int16Array(MAX_ENTITIES);

// ── Ability: Cyclone Lock-On ──
/** Target entity ID for Lock-On channel, -1 = no lock */
export const lockOnTarget = new Int16Array(MAX_ENTITIES);
/** gameTime when Lock-On expires (0 = inactive) */
export const lockOnEndTime = new Float32Array(MAX_ENTITIES);

// ── Ability: Thor Anti-Air Mode ──
/** 0 = Javelin Missiles (single-target, 24 dmg, 11 range), 1 = Explosive Payload (splash, 6 dmg, 10 range) */
export const thorMode = new Uint8Array(MAX_ENTITIES);

// ── Ability: Blinding Cloud (debuff on victim) ──
/** gameTime when blinding cloud range reduction expires (0 = not affected) */
export const blindingCloudEndTime = new Float32Array(MAX_ENTITIES);

// ── Ability: Parasitic Bomb (debuff on target air unit) ──
/** gameTime when parasitic bomb expires (0 = not affected) */
export const parasiticBombEndTime = new Float32Array(MAX_ENTITIES);
/** Faction of the caster who applied the parasitic bomb */
export const parasiticBombCasterFaction = new Uint8Array(MAX_ENTITIES);

// ── Ability: Neural Parasite (Infestor) ──
/** Entity ID of the target being mind-controlled, -1 = none (on Infestor) */
export const neuralTarget = new Int16Array(MAX_ENTITIES);
/** gameTime when the channel ends (on Infestor) */
export const neuralEndTime = new Float32Array(MAX_ENTITIES);
/** gameTime when the stun ends (on victim). While > gameTime, victim is stunned. */
export const neuralStunEndTime = new Float32Array(MAX_ENTITIES);

// ── Supply Depot lowered state ──
/** 0 = raised (default), 1 = lowered (walkable) */
export const depotLowered = new Uint8Array(MAX_ENTITIES);

// ── Ability: Hellion/Hellbat Transform ──
/** 0 = Hellion (ranged), 1 = Hellbat (melee) */
export const hellbatMode = new Uint8Array(MAX_ENTITIES);

// ── Addon (Tech Lab / Reactor) ──
/** 0=none, 1=TechLab, 2=Reactor */
export const addonType = new Uint8Array(MAX_ENTITIES);

// ── Building ──
/** BuildingType enum value */
export const buildingType = new Uint8Array(MAX_ENTITIES);
/** BuildState enum: 0=none, 1=UnderConstruction, 2=Complete */
export const buildState = new Uint8Array(MAX_ENTITIES);
/** Construction progress 0.0 to 1.0 */
export const buildProgress = new Float32Array(MAX_ENTITIES);
/** Total build time in seconds */
export const buildTimeTotal = new Float32Array(MAX_ENTITIES);
/** Entity ID of the SCV constructing this building, -1 = none */
export const builderEid = new Int16Array(MAX_ENTITIES);
/** Rally point world position, -1 = no rally */
export const rallyX = new Float32Array(MAX_ENTITIES);
export const rallyY = new Float32Array(MAX_ENTITIES);

// ── Building Upgrade (Hatchery→Lair→Hive) ──
/** Target BuildingType being upgraded to, 0 = not upgrading */
export const upgradingTo = new Uint8Array(MAX_ENTITIES);
/** Upgrade timer remaining (seconds) */
export const upgradeProgress = new Float32Array(MAX_ENTITIES);
/** Total upgrade time */
export const upgradeTimeTotal = new Float32Array(MAX_ENTITIES);
/** UnitType currently being produced, 0 = idle */
export const prodUnitType = new Uint8Array(MAX_ENTITIES);
/** Production timer remaining (seconds) */
export const prodProgress = new Float32Array(MAX_ENTITIES);
/** Total production time for current unit */
export const prodTimeTotal = new Float32Array(MAX_ENTITIES);

// ── Reactor Slot 2 (parallel production for Reactor-equipped buildings) ──
export const prodSlot2UnitType = new Uint8Array(MAX_ENTITIES);
export const prodSlot2Progress = new Float32Array(MAX_ENTITIES);
export const prodSlot2TimeTotal = new Float32Array(MAX_ENTITIES);

// ── Supply ──
/** How much supply this entity provides */
export const supplyProvided = new Uint8Array(MAX_ENTITIES);
/** How much supply this entity costs (1 for units, 0 for buildings) */
export const supplyCost = new Uint8Array(MAX_ENTITIES);

// ── Production Queue (up to 5 items per building) ──
export const PROD_QUEUE_MAX = 5;
/** Flat queue: prodQueue[eid * 5 + 0..4] = UnitType values */
export const prodQueue = new Uint8Array(MAX_ENTITIES * PROD_QUEUE_MAX);
/** Parallel morph timers for Zerg queue items (all morph simultaneously) */
export const prodQueueProgress = new Float32Array(MAX_ENTITIES * PROD_QUEUE_MAX);
export const prodQueueTimeTotal = new Float32Array(MAX_ENTITIES * PROD_QUEUE_MAX);
/** Number of items currently in the queue for each entity */
export const prodQueueLen = new Uint8Array(MAX_ENTITIES);

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

/** Append waypoints to an existing path (for shift-queue commands) */
export function appendPath(eid: number, waypoints: Array<[number, number]>): void {
  if (!paths[eid]) {
    paths[eid] = new Float32Array(MAX_PATH_LENGTH * 2);
  }
  const currentLen = pathLengths[eid];
  const addLen = Math.min(waypoints.length, MAX_PATH_LENGTH - currentLen);
  for (let i = 0; i < addLen; i++) {
    paths[eid][(currentLen + i) * 2] = waypoints[i][0];
    paths[eid][(currentLen + i) * 2 + 1] = waypoints[i][1];
  }
  pathLengths[eid] = currentLen + addLen;
  // If unit was idle (no path), start following from the beginning of the appended segment
  if (movePathIndex[eid] < 0) {
    movePathIndex[eid] = currentLen;
  }
}

export function getPathWaypoint(eid: number, index: number): [number, number] | null {
  if (index < 0 || index >= pathLengths[eid]) return null;
  return [paths[eid][index * 2], paths[eid][index * 2 + 1]];
}

/** Add all components for a unit entity */
export function addUnitComponents(world: World, eid: number): void {
  world.mask[eid] |= POSITION | VELOCITY | HEALTH | ATTACK | MOVEMENT | SELECTABLE | RENDERABLE | UNIT_TYPE | ABILITY;
}

/** Add WORKER component to an existing unit entity */
export function addWorkerComponent(world: World, eid: number): void {
  world.mask[eid] |= WORKER;
}

/** Add components for a resource node entity (mineral patch, gas geyser) */
export function addResourceComponents(world: World, eid: number): void {
  world.mask[eid] |= POSITION | HEALTH | SELECTABLE | RENDERABLE | RESOURCE;
}

/** Add components for a building entity */
export function addBuildingComponents(world: World, eid: number): void {
  world.mask[eid] |= POSITION | HEALTH | SELECTABLE | RENDERABLE | BUILDING | SUPPLY;
}

/** Reset all component data for an entity */
export function resetComponents(eid: number): void {
  posX[eid] = 0; posY[eid] = 0;
  velX[eid] = 0; velY[eid] = 0;
  hpCurrent[eid] = 0; hpMax[eid] = 0;
  atkDamage[eid] = 0; atkRange[eid] = 0; atkCooldown[eid] = 0;
  atkLastTime[eid] = 0; atkSplash[eid] = 0; atkMinRange[eid] = 0; atkHitCount[eid] = 1;
  bonusDmg[eid] = 0; bonusVsTag[eid] = -1; armorClass[eid] = 0; baseArmor[eid] = 0;
  pendingDamage[eid] = 0; killCount[eid] = 0; veterancyLevel[eid] = 0;
  moveSpeed[eid] = 0; moveTargetX[eid] = -1; moveTargetY[eid] = -1;
  movePathIndex[eid] = -1;
  selected[eid] = 0; faction[eid] = 0;
  renderWidth[eid] = 0; renderHeight[eid] = 0; renderTint[eid] = 0;
  unitType[eid] = 0;
  isAir[eid] = 0;
  canTargetGround[eid] = 0;
  canTargetAir[eid] = 0;
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
  deathTime[eid] = 0;
  energy[eid] = 0;
  cloaked[eid] = 0;
  burrowed[eid] = 0;
  isDetector[eid] = 0;
  detectionRange[eid] = 0;
  revealed[eid] = 0;
  cargoCapacity[eid] = 0;
  cargoCount[eid] = 0;
  loadedInto[eid] = 0;
  boostEndTime[eid] = 0;
  boostCooldownEnd[eid] = 0;
  morphTarget[eid] = 0;
  morphProgress[eid] = 0;
  morphTimeTotal[eid] = 0;
  resourceType[eid] = 0;
  resourceRemaining[eid] = 0;
  workerCountOnResource[eid] = 0;
  workerState[eid] = 0;
  workerCarrying[eid] = 0;
  workerTargetEid[eid] = -1;
  workerMineTimer[eid] = 0;
  workerBaseX[eid] = 0;
  workerBaseY[eid] = 0;
  patrolOriginX[eid] = 0;
  patrolOriginY[eid] = 0;
  lastMovedTime[eid] = 0;
  larvaCount[eid] = 0;
  larvaRegenTimer[eid] = 0;
  injectTimer[eid] = 0;
  bileLandTime[eid] = 0;
  bileLandX[eid] = 0;
  bileLandY[eid] = 0;
  fungalLandTime[eid] = 0;
  fungalLandX[eid] = 0;
  fungalLandY[eid] = 0;
  kd8LandTime[eid] = 0;
  kd8LandX[eid] = 0;
  kd8LandY[eid] = 0;
  causticTarget[eid] = -1;
  lockOnTarget[eid] = -1;
  lockOnEndTime[eid] = 0;
  thorMode[eid] = 0;
  hellbatMode[eid] = 0;
  blindingCloudEndTime[eid] = 0;
  parasiticBombEndTime[eid] = 0;
  parasiticBombCasterFaction[eid] = 0;
  neuralTarget[eid] = -1;
  neuralEndTime[eid] = 0;
  neuralStunEndTime[eid] = 0;
  depotLowered[eid] = 0;
  addonType[eid] = 0;
  buildingType[eid] = 0;
  buildState[eid] = 0;
  buildProgress[eid] = 0;
  buildTimeTotal[eid] = 0;
  builderEid[eid] = -1;
  rallyX[eid] = -1;
  rallyY[eid] = -1;
  upgradingTo[eid] = 0;
  upgradeProgress[eid] = 0;
  upgradeTimeTotal[eid] = 0;
  prodUnitType[eid] = 0;
  prodProgress[eid] = 0;
  prodTimeTotal[eid] = 0;
  prodSlot2UnitType[eid] = 0;
  prodSlot2Progress[eid] = 0;
  prodSlot2TimeTotal[eid] = 0;
  supplyProvided[eid] = 0;
  supplyCost[eid] = 0;
  // Clear production queue
  prodQueueLen[eid] = 0;
  const qBase = eid * PROD_QUEUE_MAX;
  for (let i = 0; i < PROD_QUEUE_MAX; i++) {
    prodQueue[qBase + i] = 0;
    prodQueueProgress[qBase + i] = 0;
    prodQueueTimeTotal[qBase + i] = 0;
  }
}
