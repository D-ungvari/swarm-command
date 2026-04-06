/**
 * Module-level camera shake state.
 * triggerCameraShake() is called from CombatSystem on heavy explosions.
 * consumeCameraShake() is called from Game.render() each frame.
 */

let _shake = 0;

export function triggerCameraShake(amount: number): void {
  _shake = Math.max(_shake, amount);
}

export function consumeCameraShake(dt: number): number {
  const s = _shake;
  _shake = Math.max(0, _shake - dt * 25);
  return s;
}
