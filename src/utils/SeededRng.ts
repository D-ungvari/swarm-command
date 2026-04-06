/**
 * Seedable pseudo-random number generator (LCG algorithm).
 * Produces identical sequences given the same seed — required for replay determinism.
 */
export class SeededRng {
  private _state: number;

  constructor(seed: number = Date.now() & 0x7fffffff) {
    this._state = seed >>> 0;
  }

  /** Returns a float in [0, 1) */
  next(): number {
    // LCG parameters from Numerical Recipes
    this._state = (Math.imul(1664525, this._state) + 1013904223) >>> 0;
    return this._state / 4294967296;
  }

  /** Returns an integer in [0, max) */
  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }

  /** Reset to a specific seed */
  seed(n: number): void {
    this._state = n >>> 0;
  }

  getSeed(): number { return this._state; }
}

/** Module-level shared RNG — use this everywhere instead of Math.random() */
export const rng = new SeededRng();

/** Reset to a specific seed (call at game start; both players use the same seed for determinism) */
export function seedRng(seed: number): void {
  rng.seed(seed);
}
