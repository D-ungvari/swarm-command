import { Graphics, Container } from 'pixi.js';
import { SELECTION_COLOR } from '../constants';
import type { InputState } from '../input/InputManager';
import { isTouchDevice } from '../utils/DeviceDetect';

/** Brighter selection color for the outline */
const BRIGHT_SELECTION = 0x44ff44;
/** Corner bracket length in pixels */
const CORNER_LEN = 8;
/** Corner bracket thickness */
const CORNER_W = 2;

/**
 * Renders the drag-selection box in screen space.
 * This container should NOT be a child of the viewport
 * (it renders in screen coords, not world coords).
 */
export class SelectionRenderer {
  container: Container;
  private graphics: Graphics;

  constructor() {
    this.container = new Container();
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
  }

  render(input: InputState, _gameTime: number): void {
    const g = this.graphics;
    g.clear();

    const m = input.mouse;
    if (!m.leftDown || !m.isDragging || isTouchDevice) return;

    const x = Math.min(m.dragStartX, m.x);
    const y = Math.min(m.dragStartY, m.y);
    const w = Math.abs(m.x - m.dragStartX);
    const h = Math.abs(m.y - m.dragStartY);

    // Slightly brighter fill
    g.rect(x, y, w, h);
    g.fill({ color: SELECTION_COLOR, alpha: 0.12 });

    // Brighter, slightly thicker outline
    g.rect(x, y, w, h);
    g.stroke({ color: BRIGHT_SELECTION, width: 1.5, alpha: 0.85 });

    // Corner brackets (L-shaped) at each corner
    const cLen = Math.min(CORNER_LEN, w / 2, h / 2);
    if (cLen < 2) return;

    // Top-left
    g.moveTo(x, y + cLen);
    g.lineTo(x, y);
    g.lineTo(x + cLen, y);
    g.stroke({ color: 0xffffff, width: CORNER_W, alpha: 0.9 });

    // Top-right
    g.moveTo(x + w - cLen, y);
    g.lineTo(x + w, y);
    g.lineTo(x + w, y + cLen);
    g.stroke({ color: 0xffffff, width: CORNER_W, alpha: 0.9 });

    // Bottom-left
    g.moveTo(x, y + h - cLen);
    g.lineTo(x, y + h);
    g.lineTo(x + cLen, y + h);
    g.stroke({ color: 0xffffff, width: CORNER_W, alpha: 0.9 });

    // Bottom-right
    g.moveTo(x + w - cLen, y + h);
    g.lineTo(x + w, y + h);
    g.lineTo(x + w, y + h - cLen);
    g.stroke({ color: 0xffffff, width: CORNER_W, alpha: 0.9 });
  }
}
