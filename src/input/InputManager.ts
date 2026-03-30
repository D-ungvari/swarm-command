/** Tracks mouse and keyboard state each frame */
export interface MouseState {
  x: number;
  y: number;
  leftDown: boolean;
  rightDown: boolean;
  leftJustPressed: boolean;
  rightJustPressed: boolean;
  leftJustReleased: boolean;
  /** Drag start position (screen space) */
  dragStartX: number;
  dragStartY: number;
  isDragging: boolean;
}

export interface InputState {
  mouse: MouseState;
  keys: Set<string>;
  keysJustPressed: Set<string>;
  shiftHeld: boolean;
  ctrlHeld: boolean;
}

export class InputManager {
  state: InputState;
  private canvas: HTMLCanvasElement;
  private prevLeftDown = false;
  private prevRightDown = false;
  private rawLeftDown = false;
  private rawRightDown = false;
  private rawX = 0;
  private rawY = 0;
  private rawKeysDown = new Set<string>();
  private rawKeysJustPressed = new Set<string>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.state = {
      mouse: {
        x: 0, y: 0,
        leftDown: false, rightDown: false,
        leftJustPressed: false, rightJustPressed: false,
        leftJustReleased: false,
        dragStartX: 0, dragStartY: 0, isDragging: false,
      },
      keys: new Set(),
      keysJustPressed: new Set(),
      shiftHeld: false,
      ctrlHeld: false,
    };

    this.bindEvents();
  }

  private bindEvents(): void {
    const el = this.canvas;

    el.addEventListener('mousemove', (e) => {
      this.rawX = e.clientX;
      this.rawY = e.clientY;
    });

    el.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.rawLeftDown = true;
      if (e.button === 2) this.rawRightDown = true;
    });

    el.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.rawLeftDown = false;
      if (e.button === 2) this.rawRightDown = false;
    });

    el.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      this.rawKeysDown.add(e.code);
      this.rawKeysJustPressed.add(e.code);
    });

    window.addEventListener('keyup', (e) => {
      this.rawKeysDown.delete(e.code);
    });
  }

  /** Call once per game tick to snapshot input state */
  update(): void {
    const m = this.state.mouse;
    m.x = this.rawX;
    m.y = this.rawY;

    m.leftJustPressed = this.rawLeftDown && !this.prevLeftDown;
    m.rightJustPressed = this.rawRightDown && !this.prevRightDown;
    m.leftJustReleased = !this.rawLeftDown && this.prevLeftDown;

    // Track drag
    if (m.leftJustPressed) {
      m.dragStartX = m.x;
      m.dragStartY = m.y;
      m.isDragging = false;
    }
    if (this.rawLeftDown && !m.isDragging) {
      const dx = m.x - m.dragStartX;
      const dy = m.y - m.dragStartY;
      if (dx * dx + dy * dy > 25) { // 5px threshold
        m.isDragging = true;
      }
    }
    if (m.leftJustReleased) {
      // isDragging stays true for one frame so selection system can read it
    }

    m.leftDown = this.rawLeftDown;
    m.rightDown = this.rawRightDown;

    this.prevLeftDown = this.rawLeftDown;
    this.prevRightDown = this.rawRightDown;

    this.state.keys = new Set(this.rawKeysDown);
    this.state.keysJustPressed = new Set(this.rawKeysJustPressed);
    this.rawKeysJustPressed.clear();

    this.state.shiftHeld = this.rawKeysDown.has('ShiftLeft') || this.rawKeysDown.has('ShiftRight');
    this.state.ctrlHeld = this.rawKeysDown.has('ControlLeft') || this.rawKeysDown.has('ControlRight');
  }

  /** Reset per-frame flags (call at end of tick) */
  lateUpdate(): void {
    const m = this.state.mouse;
    if (m.leftJustReleased) {
      m.isDragging = false;
    }
  }
}
