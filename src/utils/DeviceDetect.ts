/** True if the primary input is touch (phones/tablets), not touch-capable laptops */
export const isTouchDevice: boolean =
  typeof window !== 'undefined' &&
  window.matchMedia('(pointer: coarse)').matches;

/** True if the viewport is taller than wide (portrait orientation) */
export function isPortrait(): boolean {
  return window.innerHeight > window.innerWidth;
}
