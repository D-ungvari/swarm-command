/** True if the current device supports touch input */
export const isTouchDevice: boolean =
  typeof window !== 'undefined' &&
  (('ontouchstart' in window) || navigator.maxTouchPoints > 0);

/** True if the viewport is taller than wide (portrait orientation) */
export function isPortrait(): boolean {
  return window.innerHeight > window.innerWidth;
}
