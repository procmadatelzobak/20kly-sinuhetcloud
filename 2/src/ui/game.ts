// Main game screen — rendering + interaction (port of ui.py + game.py)
import { Renderer } from '../engine/render';
import { Network } from '../sim/network';
import { Node, CityNode, WellNode, Building } from '../entities/node';
import { Pipe } from '../entities/pipe';
import { Well } from '../entities/well';
import { Item } from '../entities/item';
import { SeasonManager } from '../ai/seasons';
import { HUD } from './hud';
import { advanceMail, addMail } from './mail';
import { Input } from '../engine/input';
import { gridToScr, scrToGrid, getCellSize, setScreenHeight } from '../sim/grid';
import { GRID_CENTRE, GRID_W, GRID_H, PRESSURE_DANGER, PRESSURE_WARNING, Colour, Difficulty, getDifficulty } from '../constants';
import { playSound, setMuted, isMuted, resumeAudio } from '../assets/loader';
import { getImage } from '../assets/loader';
import { drainMail } from '../entities/node';
import { saveGame, loadGame } from '../persistence/save';

const FRAME_RATE = 35;
const PIPE_DOT_SFACTOR = 512;
const PIPE_DOT_FUTZFACTOR = 4.0 * FRAME_RATE;

export type GameResult = 'WIN' | 'LOSE' | 'MENU' | 'PLAYING';

export class GameScreen {
  private r: Renderer;
  private canvas: HTMLCanvasElement;
  private net: Network;
  private sm: SeasonManager;
  private hud: HUD;
  private input: Input;
  private difficulty: Difficulty;
  private diff: ReturnType<typeof getDifficulty>;

  private selected: Item | null = null;
  private buildPipeFirst: Node | null = null;
  private gameAreaSize = 0;
  private menuWidth = 0;
  private menuX = 0;
  private backdropRotation: number;
  private backdropFlip: boolean;
  private graceTimer = 0;
  private gameResult: GameResult = 'PLAYING';
  private animFrame = 0;

  // Background tile cache
  private bgCanvas: HTMLCanvasElement | null = null;
  private bgDirty = true;

  constructor(canvas: HTMLCanvasElement, net: Network, sm: SeasonManager, difficulty: Difficulty) {
    this.canvas = canvas;
    this.r = new Renderer(canvas.getContext('2d')!);
    this.net = net;
    this.sm = sm;
    this.difficulty = difficulty;
    this.diff = getDifficulty(difficulty);
    this.backdropRotation = Math.floor(Math.random() * 4) * 90;
    this.backdropFlip = Math.random() > 0.5;

    this.input = new Input(canvas);
    this.resize();

    this.hud = new HUD(this.menuX, 0, this.menuWidth, canvas.height);
    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    const W = window.innerWidth;
    const H = window.innerHeight;
    // Enforce aspect ratio
    let cw = W, ch = H;
    const aspect = 1024 / 768;
    if (cw / ch > aspect) cw = Math.floor(ch * aspect);
    else ch = Math.floor(cw / aspect);

    this.canvas.width = Math.max(cw, 920);
    this.canvas.height = Math.max(ch, 690);
    this.canvas.style.width = `${this.canvas.width}px`;
    this.canvas.style.height = `${this.canvas.height}px`;

    this.gameAreaSize = this.canvas.height;
    this.menuX = this.gameAreaSize;
    this.menuWidth = this.canvas.width - this.gameAreaSize;

    setScreenHeight(this.canvas.height);
    this.input.setGameAreaWidth(this.gameAreaSize);
    this.bgDirty = true;

    this.hud = new HUD(this.menuX, 0, this.menuWidth, this.canvas.height);
    this.r = new Renderer(this.canvas.getContext('2d')!);
  }

  update(dt: number): GameResult {
    if (this.gameResult !== 'PLAYING') return this.gameResult;

    const speed = this.input.state.fastForward ? 8 : 1;
    const effectiveDt = dt * speed;

    this.sm.advance(effectiveDt);
    advanceMail(dt);
    this.animFrame = (this.animFrame + 1) % 9;

    // Advance pipe dot animations
    for (const pipe of this.net.pipeList) {
      if (!pipe.isDestroyed()) pipe.frameAdvance(effectiveDt);
    }

    // Drain mail from entities
    for (const msg of drainMail()) addMail(msg);

    // Check pressure danger
    const pressure = this.net.hub.getPressure();
    if (pressure < PRESSURE_DANGER) {
      this.graceTimer += effectiveDt;
      if (this.graceTimer >= this.diff.GRACE_TIME) {
        this.gameResult = 'LOSE';
        playSound('emergency');
        return 'LOSE';
      }
    } else {
      this.graceTimer = 0;
    }

    // Check win condition
    if (this.net.hub.techLevel >= this.diff.CITY_MAX_TECH_LEVEL && !this.net.hub.needsWork()) {
      this.gameResult = 'WIN';
      playSound('applause');
      return 'WIN';
    }

    // Handle input
    if (this.input.consumeEscape()) {
      this.selected = null;
      this.buildPipeFirst = null;
      this.input.setMode('NEUTRAL');
      this.gameResult = 'MENU';
      return 'MENU';
    }

    for (const click of this.input.drainClicks()) {
      resumeAudio();
      if (!click.inGame) {
        // HUD click
        const mode = this.hud.hitTest(click.x, click.y);
        if (mode) {
          if (mode === 'OPEN_MENU') { this.gameResult = 'MENU'; return 'MENU'; }
          if (mode === 'FAST_FORWARD') { this.input.state.fastForward = !this.input.state.fastForward; continue; }
          this.input.setMode(mode);
          this.buildPipeFirst = null;
        }
        continue;
      }

      if (click.button === 2) {
        this.selected = null;
        this.buildPipeFirst = null;
        this.input.setMode('NEUTRAL');
        continue;
      }

      const [gx, gy] = scrToGrid(click.x, click.y);
      const gridPos = { x: gx, y: gy };
      this.handleGridClick(gridPos);
    }

    return 'PLAYING';
  }

  private handleGridClick(pos: { x: number; y: number }): void {
    const mode = this.input.state.mode;
    const item = this.net.getItemAtGrid(pos);

    switch (mode) {
      case 'BUILD_NODE':
        if (item && !item.isDestroyed()) {
          addMail("Can't build there!");
          playSound('error');
        } else {
          const newNode = new Node(pos);
          if (this.net.addGridItem(newNode)) {
            playSound('bamboo');
            this.net.dirty = true;
          }
        }
        break;

      case 'BUILD_PIPE':
        if (item instanceof Node && !item.isDestroyed()) {
          if (!this.buildPipeFirst) {
            this.buildPipeFirst = item;
            item.soundEffect();
            addMail('Select second node for pipe.');
          } else if (item === this.buildPipeFirst) {
            addMail('Select a different node.');
            playSound('error');
          } else {
            this.net.addPipe(this.buildPipeFirst, item);
            this.buildPipeFirst = null;
            this.net.dirty = true;
          }
        } else {
          // Check pipe click
          const pipe = this.net.getPipeAtGrid(pos);
          if (pipe) {
            this.selected = pipe;
          }
        }
        break;

      case 'DESTROY':
        if (item && !item.isDestroyed()) {
          this.net.destroy(item);
          this.selected = null;
          this.net.dirty = true;
        } else {
          const pipe = this.net.getPipeAtGrid(pos);
          if (pipe) {
            this.net.destroy(pipe);
            this.selected = null;
            this.net.dirty = true;
          }
        }
        break;

      case 'UPGRADE':
        if (item instanceof Building && !item.isDestroyed()) {
          item.beginUpgrade(this.diff);
          this.net.dirty = true;
        } else {
          const pipe = this.net.getPipeAtGrid(pos);
          if (pipe) {
            pipe.beginUpgrade(this.diff);
            this.net.dirty = true;
          }
        }
        break;

      case 'NEUTRAL':
        if (item) {
          this.selected = item;
          item.soundEffect();
        } else {
          const pipe = this.net.getPipeAtGrid(pos);
          if (pipe) {
            this.selected = pipe;
            pipe.soundEffect();
          } else {
            this.selected = null;
          }
        }
        break;
    }
  }

  draw(): void {
    const { r, canvas } = this;
    const gs = this.gameAreaSize;

    // Draw background (game area)
    this.drawBackground(gs, canvas.height);

    // Draw wells
    for (const well of this.net.wellList) {
      const [sx, sy] = gridToScr(well.pos.x, well.pos.y);
      const cs = getCellSize();
      const img = getImage('well');
      if (img && img.complete) {
        r.ctx.drawImage(img, sx - cs / 2, sy - cs / 2, cs, cs);
      } else {
        r.circle(sx, sy, cs / 3, [200, 100, 50]);
      }
    }

    // Draw pipes
    for (const pipe of this.net.pipeList) {
      if (!pipe.isDestroyed()) this.drawPipe(pipe);
    }

    // Draw nodes
    for (const node of this.net.nodeList) {
      if (!node.isDestroyed()) this.drawNode(node);
    }

    // Draw selection highlight
    if (this.selected && !this.selected.isDestroyed()) {
      this.drawSelection(this.selected);
    }

    // Draw pipe-building preview line
    if (this.buildPipeFirst) {
      const [sx, sy] = gridToScr(this.buildPipeFirst.pos.x, this.buildPipeFirst.pos.y);
      const mx = this.input.state.mousePos.x;
      const my = this.input.state.mousePos.y;
      r.ctx.globalAlpha = 0.5;
      r.line(sx, sy, mx, my, [0, 255, 128], 2);
      r.ctx.globalAlpha = 1;
    }

    // Draw season effects
    this.sm.drawEffects(r, 0);

    // Draw popups
    for (const node of this.net.popups) {
      if (!node.isDestroyed()) this.drawPopup(node);
    }

    // Draw HUD
    this.hud.draw(r, this.net, this.sm, this.selected, this.input.state.mode, this.difficulty, this.input.state.fastForward, isMuted());

    // Fast forward indicator
    if (this.input.state.fastForward) {
      const ffImg = getImage('fastforward');
      if (ffImg && ffImg.complete) {
        r.ctx.globalAlpha = 0.7;
        r.ctx.drawImage(ffImg, 8, canvas.height - 40, 32, 32);
        r.ctx.globalAlpha = 1;
      }
    }
  }

  private drawBackground(w: number, h: number): void {
    const r = this.r;
    const img = getImage('back');
    if (!img || !img.complete) {
      r.fillRect(0, 0, w, h, [20, 30, 20]);
      return;
    }
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const targetSize = Math.max(w, h);
    r.ctx.save();
    r.ctx.translate(w / 2, h / 2);
    r.ctx.rotate(this.backdropRotation * Math.PI / 180);
    if (this.backdropFlip) r.ctx.scale(-1, 1);
    r.ctx.drawImage(img, -targetSize / 2, -targetSize / 2, targetSize, targetSize);
    r.ctx.restore();
    // Darken
    r.ctx.fillStyle = 'rgba(0,0,0,0.35)';
    r.ctx.fillRect(0, 0, w, h);
  }

  private drawNode(node: Node): void {
    const r = this.r;
    const [sx, sy] = gridToScr(node.pos.x, node.pos.y);
    const cs = getCellSize();
    const half = cs / 2;

    let imgKey: string;
    if (node instanceof CityNode) {
      imgKey = 'city1';
    } else if (node instanceof WellNode) {
      imgKey = node.complete ? 'maker' : 'maker_u';
    } else {
      imgKey = node.complete ? 'node' : 'node_u';
    }

    const img = getImage(imgKey);
    if (img && img.complete && img.naturalWidth > 0) {
      // Tint based on tech level / health animation
      const brightness = 128 + Math.floor(127 * Math.abs(Math.sin(this.animFrame / 9 * Math.PI)));
      const dc = node.getDiagramColour();
      // Draw with color tint
      const oc = document.createElement('canvas');
      oc.width = img.naturalWidth; oc.height = img.naturalHeight;
      const octx = oc.getContext('2d')!;
      octx.drawImage(img, 0, 0);
      // Multiply by node colour
      octx.globalCompositeOperation = 'multiply';
      octx.fillStyle = `rgb(${dc[0]},${dc[1]},${dc[2]})`;
      octx.fillRect(0, 0, img.naturalWidth, img.naturalHeight);
      r.ctx.drawImage(oc, sx - half, sy - half, cs, cs);
    } else {
      // Fallback: coloured circle
      const col = node.getDiagramColour();
      r.circle(sx, sy, half * 0.8, col, null);
    }

    // Connection indicator
    if (!this.net.isConnected(node)) {
      r.circle(sx, sy, half * 0.9, null, [128, 0, 0], 2);
    }
  }

  private drawPipe(pipe: Pipe): void {
    const r = this.r;
    const [x1, y1] = gridToScr(pipe.n1.pos.x, pipe.n1.pos.y);
    const [x2, y2] = gridToScr(pipe.n2.pos.x, pipe.n2.pos.y);
    const cs = getCellSize();
    const lineW = Math.max(2, Math.floor(cs / 4));

    if (pipe.needsWork()) {
      r.line(x1, y1, x2, y2, [255, 0, 0], lineW);
      return;
    }

    // Dark green backing
    r.line(x1, y1, x2, y2, [32, 128, 20], lineW);

    if (pipe.currentN1toN2 === 0) return;

    // Animated dots
    const dots = Math.floor(pipe.length * 0.3 + 1);
    const positions = dots * Pipe.SFACTOR;
    const dotSize = Math.max(1, Math.floor(lineW / 3));

    r.ctx.fillStyle = '#00ff00';
    for (let interp = pipe.dotOffset; interp < positions; interp += Pipe.SFACTOR) {
      const t = interp / positions;
      const dx = x1 + (x2 - x1) * t;
      const dy = y1 + (y2 - y1) * t + 1;
      r.ctx.fillRect(dx - dotSize / 2, dy - dotSize / 2, dotSize, dotSize);
    }
  }

  private drawSelection(item: Item): void {
    const r = this.r;
    const cs = getCellSize();
    const highlight: Colour = [255, 255, 0];
    const lineW = Math.max(2, Math.floor(cs / 5));

    if (item instanceof Pipe) {
      const [x1, y1] = gridToScr(item.n1.pos.x, item.n1.pos.y);
      const [x2, y2] = gridToScr(item.n2.pos.x, item.n2.pos.y);
      r.line(x1, y1, x2, y2, highlight, lineW + 2);
    } else if (item instanceof CityNode) {
      const [sx, sy] = gridToScr(item.pos.x, item.pos.y);
      const half = cs / 2 + 5;
      r.strokeRect(sx - half, sy - half, half * 2, half * 2, highlight, lineW);
    } else if (item instanceof Node) {
      const [sx, sy] = gridToScr(item.pos.x, item.pos.y);
      r.circle(sx, sy, cs / 2 + lineW + 1, null, highlight, lineW);
    }
  }

  private drawPopup(node: Building): void {
    const r = this.r;
    const [sx, sy] = gridToScr(node.pos.x, node.pos.y);
    const cs = getCellSize();
    const popW = cs * 3;
    const popH = Math.max(4, cs / 3);
    const px = sx - popW / 2;
    const py = sy - cs / 2 - popH - 2;

    for (const meter of node.getPopupItems()) {
      r.bar(px, py, popW, popH, meter.current, meter.max, meter.currentColour, [40, 40, 40]);
    }
  }

  // Called externally for save/load
  saveToSlot(slot: number): void {
    saveGame(slot, this.net, this.sm, this.difficulty);
    addMail(`Game saved to slot ${slot}.`);
  }

  getSaveInfo(): { net: Network; sm: SeasonManager; difficulty: Difficulty } {
    return { net: this.net, sm: this.sm, difficulty: this.difficulty };
  }
}
