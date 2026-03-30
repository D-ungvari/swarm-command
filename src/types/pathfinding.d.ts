declare module 'pathfinding' {
  interface FinderOptions {
    allowDiagonal?: boolean;
    dontCrossCorners?: boolean;
    diagonalMovement?: number;
    heuristic?: (dx: number, dy: number) => number;
    weight?: number;
  }

  class Grid {
    constructor(width: number, height: number);
    constructor(matrix: number[][]);
    setWalkableAt(x: number, y: number, walkable: boolean): void;
    isWalkableAt(x: number, y: number): boolean;
    clone(): Grid;
    getNodeAt(x: number, y: number): { x: number; y: number; walkable: boolean };
    width: number;
    height: number;
  }

  class AStarFinder {
    constructor(opts?: FinderOptions);
    findPath(startX: number, startY: number, endX: number, endY: number, grid: Grid): number[][];
  }

  class JumpPointFinder {
    constructor(opts?: FinderOptions);
    findPath(startX: number, startY: number, endX: number, endY: number, grid: Grid): number[][];
  }

  const DiagonalMovement: {
    Always: number;
    Never: number;
    IfAtMostOneObstacle: number;
    OnlyWhenNoObstacles: number;
  };

  export { Grid, AStarFinder, JumpPointFinder, DiagonalMovement, FinderOptions };
}
