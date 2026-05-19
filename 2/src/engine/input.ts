// Input handling — mouse + keyboard events
export type BuildMode = 'BUILD_NODE' | 'BUILD_PIPE' | 'DESTROY' | 'UPGRADE' | 'NEUTRAL' | 'OPEN_MENU' | 'FAST_FORWARD';

export interface InputState {
  mode: BuildMode;
  mousePos: { x: number; y: number };
  mouseInGame: boolean;
  lastClick: { x: number; y: number; button: number } | null;
  keys: Set<string>;
  fastForward: boolean;
  mute: boolean;
  escapePressed: boolean;
}

export class Input {
  state: InputState = {
    mode: 'NEUTRAL',
    mousePos: { x: 0, y: 0 },
    mouseInGame: false,
    lastClick: null,
    keys: new Set(),
    fastForward: false,
    mute: false,
    escapePressed: false,
  };

  private canvas: HTMLCanvasElement;
  private gameAreaWidth: number = 0;
  private pendingClicks: Array<{ x: number; y: number; button: number; inGame: boolean }> = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', (e) => this.state.keys.delete(e.code));
  }

  setGameAreaWidth(w: number): void { this.gameAreaWidth = w; }

  private getCanvasPos(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  private onMouseMove(e: MouseEvent): void {
    const pos = this.getCanvasPos(e);
    this.state.mousePos = pos;
    this.state.mouseInGame = pos.x < this.gameAreaWidth;
  }

  private onMouseDown(e: MouseEvent): void {
    const pos = this.getCanvasPos(e);
    const inGame = pos.x < this.gameAreaWidth;
    this.pendingClicks.push({ x: pos.x, y: pos.y, button: e.button, inGame });
    e.preventDefault();
  }

  private onKeyDown(e: KeyboardEvent): void {
    this.state.keys.add(e.code);
    switch (e.code) {
      case 'KeyN': this.state.mode = 'BUILD_NODE'; break;
      case 'KeyP': this.state.mode = 'BUILD_PIPE'; break;
      case 'KeyD': case 'Backspace': this.state.mode = 'DESTROY'; break;
      case 'KeyU': this.state.mode = 'UPGRADE'; break;
      case 'Escape': this.state.escapePressed = true; this.state.mode = 'OPEN_MENU'; break;
      case 'KeyF': this.state.fastForward = !this.state.fastForward; break;
      case 'KeyM': this.state.mute = !this.state.mute; break;
    }
    if (['KeyN','KeyP','KeyD','KeyU','Backspace','Escape','KeyF','KeyM'].includes(e.code)) {
      e.preventDefault();
    }
  }

  drainClicks(): Array<{ x: number; y: number; button: number; inGame: boolean }> {
    return this.pendingClicks.splice(0);
  }

  consumeEscape(): boolean {
    if (this.state.escapePressed) { this.state.escapePressed = false; return true; }
    return false;
  }

  setMode(m: BuildMode): void { this.state.mode = m; }
}
