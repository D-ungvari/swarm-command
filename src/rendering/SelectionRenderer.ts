import { Graphics, Container } from 'pixi.js';
import { SELECTION_COLOR } from '../constants';
import type { InputState } from '../input/InputManager';

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

  render(input: InputState): void {
    const g = this.graphics;
    g.clear();

    const m = input.mouse;
    if (!m.leftDown || !m.isDragging) return;

    const x = Math.min(m.dragStartX, m.x);
    const y = Math.min(m.dragStartY, m.y);
    const w = Math.abs(m.x - m.dragStartX);
    const h = Math.abs(m.y - m.dragStartY);

    // Selection box
    g.rect(x, y, w, h);
    g.fill({ color: SELECTION_COLOR, alpha: 0.1 });
    g.rect(x, y, w, h);
    g.stroke({ color: SELECTION_COLOR, width: 1, alpha: 0.8 });
  }
}
