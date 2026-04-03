import { isTouchDevice } from '../utils/DeviceDetect';

/** Tracks mouse and keyboard state each frame */
export interface MouseState {
  x: number;
  y: number;
  leftDown: boolean;
  rightDown: boolean;
  leftJustPressed: boolean;
  rightJustPressed: boolean;
  leftJustReleased: boolean;
  leftDoubleClick: boolean;
  /** True if the current left-button interaction started from a touch event */
  fromTouch: boolean;
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
  private lastClickTime = 0;
  private lastTouchX = 0;
  private lastTouchY = 0;
  private touchStarted2Fingers = false;
  private touch1StartTime = 0;
  private touch1StartX = 0;
  private touch1StartY = 0;
  private touch2StartTime = 0;

  // Buffered events — survive even if mousedown+mouseup happens between frames
  private pendingMouseEvents: Array<{
    type: 'leftdown' | 'leftup' | 'rightdown';
    x: number;
    y: number;
    time: number;
    isDouble?: boolean;
    fromTouch?: boolean;
  }> = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.state = {
      mouse: {
        x: 0, y: 0,
        leftDown: false, rightDown: false,
        leftJustPressed: false, rightJustPressed: false,
        leftJustReleased: false, leftDoubleClick: false,
        dragStartX: 0, dragStartY: 0, isDragging: false,
        fromTouch: false,
      },
      keys: new Set(),
      keysJustPressed: new Set(),
      shiftHeld: false,
      ctrlHeld: false,
    };

    this.bindEvents();
  }

  // Stored handler references for cleanup
  private handlers: Array<{ target: EventTarget; event: string; handler: EventListener }> = [];

  private on(target: EventTarget, event: string, handler: EventListener, opts?: AddEventListenerOptions): void {
    target.addEventListener(event, handler, opts);
    this.handlers.push({ target, event, handler });
  }

  private bindEvents(): void {
    const el = this.canvas;

    this.on(el, 'mousemove', (e) => {
      const me = e as MouseEvent;
      this.rawX = me.clientX;
      this.rawY = me.clientY;
    });

    this.on(el, 'mousedown', (e) => {
      const me = e as MouseEvent;
      if (me.button === 0) {
        this.rawLeftDown = true;
        const now = performance.now();
        const isDouble = now - this.lastClickTime < 300;
        this.lastClickTime = now;
        this.pendingMouseEvents.push({ type: 'leftdown', x: me.clientX, y: me.clientY, time: now, isDouble: isDouble || undefined });
      }
      if (me.button === 2) {
        this.rawRightDown = true;
        this.pendingMouseEvents.push({ type: 'rightdown', x: me.clientX, y: me.clientY, time: performance.now() });
      }
    });

    this.on(el, 'mouseup', (e) => {
      const me = e as MouseEvent;
      if (me.button === 0) {
        this.rawLeftDown = false;
        this.pendingMouseEvents.push({ type: 'leftup', x: me.clientX, y: me.clientY, time: performance.now() });
      }
      if (me.button === 2) this.rawRightDown = false;
    });

    this.on(el, 'contextmenu', (e) => e.preventDefault());

    this.on(window, 'keydown', (e) => {
      const ke = e as KeyboardEvent;
      // Prevent browser tab switching on Ctrl+1-9
      if (ke.ctrlKey && ke.code.startsWith('Digit')) {
        ke.preventDefault();
      }
      this.rawKeysDown.add(ke.code);
      this.rawKeysJustPressed.add(ke.code);
    });

    this.on(window, 'keyup', (e) => {
      this.rawKeysDown.delete((e as KeyboardEvent).code);
    });

    // ── Touch event layer (translates touch → pendingMouseEvents) ──
    if (isTouchDevice) {
      this.on(el, 'touchstart', (e) => {
        e.preventDefault();
        const te = e as TouchEvent;
        if (te.touches.length === 1) {
          const t = te.touches[0];
          this.rawX = t.clientX;
          this.rawY = t.clientY;
          this.lastTouchX = t.clientX;
          this.lastTouchY = t.clientY;
          this.rawLeftDown = true;
          this.touchStarted2Fingers = false;
          this.touch1StartTime = performance.now();
          this.touch1StartX = t.clientX;
          this.touch1StartY = t.clientY;
          const now = performance.now();
          const isDouble = now - this.lastClickTime < 300;
          this.lastClickTime = now;
          this.pendingMouseEvents.push({
            type: 'leftdown',
            x: t.clientX, y: t.clientY,
            time: now, isDouble: isDouble || undefined,
            fromTouch: true,
          });
        } else if (te.touches.length === 2) {
          if (!this.touchStarted2Fingers) {
            this.touchStarted2Fingers = true;
            this.touch2StartTime = performance.now();
            if (this.rawLeftDown) {
              this.rawLeftDown = false;
              this.pendingMouseEvents.push({
                type: 'leftup',
                x: this.lastTouchX, y: this.lastTouchY,
                time: performance.now(), fromTouch: true,
              });
            }
          }
        }
      }, { passive: false });

      this.on(el, 'touchmove', (e) => {
        e.preventDefault();
        const te = e as TouchEvent;
        if (te.touches.length === 1 && !this.touchStarted2Fingers) {
          const t = te.touches[0];
          this.rawX = t.clientX;
          this.rawY = t.clientY;
          this.lastTouchX = t.clientX;
          this.lastTouchY = t.clientY;
        }
      }, { passive: false });

      this.on(el, 'touchend', (e) => {
        e.preventDefault();
        const te = e as TouchEvent;
        if (te.touches.length === 0) {
          if (this.touchStarted2Fingers) {
            const elapsed = performance.now() - this.touch2StartTime;
            if (elapsed < 300) {
              this.pendingMouseEvents.push({
                type: 'rightdown',
                x: this.lastTouchX, y: this.lastTouchY,
                time: performance.now(), fromTouch: true,
              });
            }
            this.touchStarted2Fingers = false;
          } else {
            this.rawLeftDown = false;
            this.pendingMouseEvents.push({
              type: 'leftup',
              x: this.lastTouchX, y: this.lastTouchY,
              time: performance.now(), fromTouch: true,
            });
          }
        }
      }, { passive: false });
    }
  }

  /** Call once per frame to snapshot input state */
  update(): void {
    const m = this.state.mouse;
    m.x = this.rawX;
    m.y = this.rawY;

    // Promote first event of each type to InputState flags (backward compat)
    // InputProcessor will handle the full array separately.
    for (const evt of this.pendingMouseEvents) {
      if (evt.type === 'leftdown' && !m.leftJustPressed) {
        m.leftJustPressed = true;
        m.dragStartX = evt.x;
        m.dragStartY = evt.y;
        m.isDragging = false;
        m.fromTouch = !!evt.fromTouch;
      }
      if (evt.type === 'leftup' && !m.leftJustReleased) {
        m.leftJustReleased = true;
      }
      if (evt.type === 'rightdown' && !m.rightJustPressed) {
        m.rightJustPressed = true;
      }
      if (evt.isDouble && !m.leftDoubleClick) {
        m.leftDoubleClick = true;
      }
    }

    if (this.rawLeftDown && !m.isDragging) {
      const dx = m.x - m.dragStartX;
      const dy = m.y - m.dragStartY;
      const threshold = isTouchDevice ? 400 : 100; // 20px touch, 10px mouse
      if (dx * dx + dy * dy > threshold) {
        m.isDragging = true;
      }
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

  /** Reset per-frame flags (call at end of frame) */
  lateUpdate(): void {
    const m = this.state.mouse;
    if (m.leftJustReleased) {
      m.isDragging = false;
    }
  }

  /** Read pending mouse events without draining. InputProcessor calls this. */
  get rawMouseEvents(): ReadonlyArray<{
    type: 'leftdown' | 'leftup' | 'rightdown';
    x: number;
    y: number;
    time: number;
    isDouble?: boolean;
    fromTouch?: boolean;
  }> {
    return this.pendingMouseEvents;
  }

  /** Drain all pending events. Called by InputProcessor after it has consumed them. */
  clearPendingEvents(): void {
    this.pendingMouseEvents.length = 0;
  }

  /** Remove all event listeners. Call when the game is destroyed. */
  destroy(): void {
    for (const { target, event, handler } of this.handlers) {
      target.removeEventListener(event, handler);
    }
    this.handlers.length = 0;
  }

  /**
   * Mark the most recent event of the given type as consumed.
   * Called by handleMinimapClick() / handleBuildPlacement() after they consume a click,
   * so InputProcessor doesn't emit a duplicate command for the same click.
   */
  consumeLastEvent(type: 'leftdown' | 'leftup' | 'rightdown'): void {
    for (let i = this.pendingMouseEvents.length - 1; i >= 0; i--) {
      if (this.pendingMouseEvents[i].type === type) {
        this.pendingMouseEvents.splice(i, 1);
        break;
      }
    }
  }
}
