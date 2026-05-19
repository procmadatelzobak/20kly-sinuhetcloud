// Menu screens — main menu, difficulty, pause, save/load (port of main.py + menu.py)
import { Renderer } from '../engine/render';
import { Difficulty } from '../constants';
import { getImage } from '../assets/loader';
import { getSaveLabel, hasSave, loadGame } from '../persistence/save';
import { Network } from '../sim/network';
import { SeasonManager } from '../ai/seasons';
import { getDifficulty } from '../constants';
import { GameRandom } from '../sim/network';

export type MenuAction =
  | { type: 'START_GAME'; difficulty: Difficulty }
  | { type: 'LOAD_GAME'; slot: number }
  | { type: 'RESUME' }
  | { type: 'QUIT' }
  | { type: 'NONE' };

interface MenuButton {
  label: string;
  x: number; y: number; w: number; h: number;
  action: MenuAction;
  colour?: [number,number,number];
}

export class MenuScreen {
  private canvas: HTMLCanvasElement;
  private r: Renderer;
  private buttons: MenuButton[] = [];
  private showSaveSlots = false;
  private saveSlotMode: 'load' | 'save' = 'load';
  private pendingAction: MenuAction | null = null;
  private mode: 'main' | 'difficulty' | 'pause' | 'savemenu';

  constructor(canvas: HTMLCanvasElement, isPaused = false) {
    this.canvas = canvas;
    this.r = new Renderer(canvas.getContext('2d')!);
    this.mode = isPaused ? 'pause' : 'main';
    this.buildButtons();

    canvas.addEventListener('click', this.onClick.bind(this));
    canvas.addEventListener('keydown', this.onKey.bind(this));
  }

  private buildButtons(): void {
    this.buttons = [];
    const cw = this.canvas.width, ch = this.canvas.height;
    const bw = Math.min(300, cw * 0.4), bh = 44;
    const bx = (cw - bw) / 2;
    let by = ch * 0.45;
    const gap = 54;

    if (this.mode === 'main') {
      this.addBtn('New Game', bx, by, bw, bh, { type: 'NONE' }, [0, 180, 0]); by += gap;
      this.addBtn('Load Game', bx, by, bw, bh, { type: 'NONE' }, [0, 120, 180]); by += gap;
      this.addBtn('Quit', bx, by, bw, bh, { type: 'QUIT' }, [180, 0, 0]);
      // 'New Game' and 'Load Game' will open sub-screens
      this.buttons[0].action = { type: 'NONE' }; // handled in onClick
      this.buttons[1].action = { type: 'NONE' };
    } else if (this.mode === 'difficulty') {
      by = ch * 0.4;
      const diffs: Array<[string, Difficulty]> = [
        ['Tutorial / Beginner', 'BEGINNER'],
        ['Intermediate', 'INTERMEDIATE'],
        ['Expert', 'EXPERT'],
        ['Peaceful', 'PEACEFUL'],
      ];
      for (const [label, d] of diffs) {
        this.addBtn(label, bx, by, bw, bh, { type: 'START_GAME', difficulty: d }, [60, 100, 60]);
        by += gap;
      }
      this.addBtn('Back', bx, by, bw, bh, { type: 'NONE' }, [80, 80, 80]);
    } else if (this.mode === 'pause') {
      this.addBtn('Resume', bx, by, bw, bh, { type: 'RESUME' }, [0, 180, 0]); by += gap;
      this.addBtn('Save Game', bx, by, bw, bh, { type: 'NONE' }, [0, 120, 180]); by += gap;
      this.addBtn('Load Game', bx, by, bw, bh, { type: 'NONE' }, [0, 120, 180]); by += gap;
      this.addBtn('Quit to Menu', bx, by, bw, bh, { type: 'QUIT' }, [180, 0, 0]);
    } else if (this.mode === 'savemenu') {
      by = ch * 0.3;
      const label = this.saveSlotMode === 'save' ? 'Save to slot:' : 'Load from slot:';
      // Title (not a button)
      for (let i = 0; i < 10; i++) {
        const sl = getSaveLabel(i);
        const slotLabel = sl ? `Slot ${i}: ${sl}` : `Slot ${i}: (empty)`;
        const col: [number,number,number] = hasSave(i)
          ? (this.saveSlotMode === 'load' ? [0, 160, 220] : [220, 160, 0])
          : [60, 60, 80];
        const action: MenuAction = this.saveSlotMode === 'load'
          ? (hasSave(i) ? { type: 'LOAD_GAME', slot: i } : { type: 'NONE' })
          : { type: 'NONE' }; // save handled externally
        this.addBtn(slotLabel, bx - 50, by, bw + 100, 36, action, col);
        by += 42;
      }
      this.addBtn('Back', bx, by + 4, bw, bh, { type: 'NONE' }, [80, 80, 80]);
    }
  }

  private addBtn(label: string, x: number, y: number, w: number, h: number, action: MenuAction, colour?: [number,number,number]): void {
    this.buttons.push({ label, x, y, w, h, action, colour });
  }

  private onClick(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;

    for (let i = 0; i < this.buttons.length; i++) {
      const btn = this.buttons[i];
      if (px >= btn.x && px <= btn.x + btn.w && py >= btn.y && py <= btn.y + btn.h) {
        this.handleButtonClick(i, btn);
        return;
      }
    }
  }

  private onKey(e: KeyboardEvent): void {
    if (e.code === 'Escape' && this.mode === 'pause') {
      this.pendingAction = { type: 'RESUME' };
    }
  }

  private handleButtonClick(idx: number, btn: MenuButton): void {
    if (this.mode === 'main') {
      if (idx === 0) { this.mode = 'difficulty'; this.buildButtons(); return; }
      if (idx === 1) { this.mode = 'savemenu'; this.saveSlotMode = 'load'; this.buildButtons(); return; }
    }
    if (this.mode === 'difficulty') {
      if (idx === 4) { this.mode = 'main'; this.buildButtons(); return; }
    }
    if (this.mode === 'pause') {
      if (idx === 1) { this.mode = 'savemenu'; this.saveSlotMode = 'save'; this.buildButtons(); return; }
      if (idx === 2) { this.mode = 'savemenu'; this.saveSlotMode = 'load'; this.buildButtons(); return; }
    }
    if (this.mode === 'savemenu') {
      if (btn.label === 'Back') { this.mode = this.saveSlotMode === 'save' ? 'pause' : 'main'; this.buildButtons(); return; }
      if (this.saveSlotMode === 'save') {
        // emit save request with slot index
        this.pendingAction = { type: 'NONE' };
        // store slot index as a hack
        this.pendingSaveSlot = idx;
        return;
      }
    }
    if (btn.action.type !== 'NONE') {
      this.pendingAction = btn.action;
    }
  }

  pendingSaveSlot: number = -1;

  poll(): MenuAction | null {
    if (this.pendingAction) {
      const a = this.pendingAction;
      this.pendingAction = null;
      return a;
    }
    return null;
  }

  draw(): void {
    const { r, canvas } = this;
    const cw = canvas.width, ch = canvas.height;

    // Background
    const menuImg = getImage('mainmenu');
    if (menuImg && menuImg.complete) {
      r.ctx.drawImage(menuImg, 0, 0, cw, ch);
      r.ctx.fillStyle = 'rgba(0,0,0,0.5)';
      r.ctx.fillRect(0, 0, cw, ch);
    } else {
      r.fillRect(0, 0, cw, ch, [10, 10, 30]);
    }

    // Title
    const titleFs = Math.round(cw / 20);
    r.textCentered('20,000 Light-Years Into Space', cw / 2, ch * 0.1, titleFs, [255, 220, 100]);
    r.textCentered('Original: © Jack Whitham 2006-26 (GPL2) — TypeScript port', cw / 2, ch * 0.1 + titleFs + 6, Math.round(titleFs * 0.5), [160, 160, 120]);

    // Section title for savemenu
    if (this.mode === 'savemenu') {
      const label = this.saveSlotMode === 'save' ? 'Save Game' : 'Load Game';
      r.textCentered(label, cw / 2, ch * 0.24, Math.round(titleFs * 0.8), [255, 240, 160]);
    } else if (this.mode === 'difficulty') {
      r.textCentered('Select Difficulty', cw / 2, ch * 0.3, Math.round(titleFs * 0.8), [255, 240, 160]);
    }

    // Buttons
    for (const btn of this.buttons) {
      const col: [number,number,number] = btn.colour ?? [60, 80, 60];
      r.fillRect(btn.x, btn.y, btn.w, btn.h, col);
      r.strokeRect(btn.x, btn.y, btn.w, btn.h, [200, 200, 200]);
      const fs = Math.round(btn.h * 0.45);
      r.textCentered(btn.label, btn.x + btn.w / 2, btn.y + (btn.h - fs) / 2, fs, [240, 240, 240]);
    }
  }

  destroy(): void {
    this.canvas.removeEventListener('click', this.onClick.bind(this));
    this.canvas.removeEventListener('keydown', this.onKey.bind(this));
  }

  setMode(m: 'main' | 'difficulty' | 'pause' | 'savemenu'): void {
    this.mode = m;
    this.buildButtons();
  }
}
