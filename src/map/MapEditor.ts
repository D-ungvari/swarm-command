import { TileType, MAP_COLS, MAP_ROWS } from '../constants';

export class MapEditor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private tiles: Uint8Array;
  private cols: number;
  private rows: number;
  private currentTool: number = 0; // TileType
  private scale: number;

  constructor(container: HTMLElement, cols = MAP_COLS, rows = MAP_ROWS) {
    this.cols = cols;
    this.rows = rows;
    this.tiles = new Uint8Array(cols * rows);
    this.tiles.fill(TileType.Ground as number);

    this.canvas = document.createElement('canvas');
    this.canvas.width = 400;
    this.canvas.height = 400;
    this.scale = this.canvas.width / cols;
    this.canvas.style.cssText = 'border: 1px solid #334; cursor: crosshair; image-rendering: pixelated;';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;

    // Paint on click/drag
    const paint = (e: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      const col = Math.floor((e.clientX - rect.left) / this.scale);
      const row = Math.floor((e.clientY - rect.top) / this.scale);
      if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
        this.tiles[row * this.cols + col] = this.currentTool;
        this.draw();
      }
    };
    let painting = false;
    this.canvas.addEventListener('mousedown', (e) => { painting = true; paint(e); });
    this.canvas.addEventListener('mousemove', (e) => { if (painting) paint(e); });
    this.canvas.addEventListener('mouseup', () => { painting = false; });
    this.canvas.addEventListener('mouseleave', () => { painting = false; });

    this.draw();
  }

  setTool(tileType: number): void { this.currentTool = tileType; }

  draw(): void {
    const { ctx, tiles, cols, rows, scale } = this;
    const COLORS: Record<number, string> = {
      [TileType.Ground as number]: '#2a3a2a',
      [TileType.Water as number]: '#1a2a4a',
      [TileType.Unbuildable as number]: '#1a1a12',
      [TileType.Destructible as number]: '#666055',
      [TileType.Minerals as number]: '#44bbff',
      [TileType.Gas as number]: '#44ff66',
    };
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = COLORS[tiles[r * cols + c]] || '#2a3a2a';
        ctx.fillRect(c * scale, r * scale, scale, scale);
      }
    }
  }

  /** Export tiles as a JSON-stringifiable object */
  exportMap(): { cols: number; rows: number; tiles: number[] } {
    return { cols: this.cols, rows: this.rows, tiles: Array.from(this.tiles) };
  }

  /** Import from saved data */
  importMap(data: { cols: number; rows: number; tiles: number[] }): void {
    this.cols = data.cols;
    this.rows = data.rows;
    this.tiles = new Uint8Array(data.tiles);
    this.scale = this.canvas.width / this.cols;
    this.draw();
  }

  /** Save to localStorage */
  save(): void {
    localStorage.setItem('swarm_custom_map', JSON.stringify(this.exportMap()));
  }

  /** Load from localStorage */
  load(): boolean {
    const saved = localStorage.getItem('swarm_custom_map');
    if (!saved) return false;
    try { this.importMap(JSON.parse(saved)); return true; }
    catch { return false; }
  }

  getTiles(): Uint8Array { return this.tiles; }

  destroy(): void {
    this.canvas.remove();
  }
}
