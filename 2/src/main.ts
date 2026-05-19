// 20,000 Light-Years Into Space — TypeScript reimplementation
// Original: © Jack Whitham 2006-26 (GPL2) — TypeScript port by sinuhetcloud 2026

import { loadAll } from './assets/loader';
import { setMuted } from './assets/loader';
import { Network, GameRandom } from './sim/network';
import { getDifficulty, Difficulty } from './constants';
import { SeasonManager } from './ai/seasons';
import { GameScreen } from './ui/game';
import { MenuScreen, MenuAction } from './ui/menu';
import { setScreenHeight } from './sim/grid';
import { loadGame, saveGame } from './persistence/save';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;

async function init(): Promise<void> {
  // Size canvas
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Loading screen
  drawLoading(0);

  await loadAll((pct) => drawLoading(pct));

  drawLoading(100);
  await new Promise(r => setTimeout(r, 200));

  // Start with main menu
  startMenu();
}

function resizeCanvas(): void {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const aspect = 1024 / 768;
  let cw = W, ch = H;
  if (cw / ch > aspect) cw = Math.floor(ch * aspect);
  else ch = Math.floor(cw / aspect);
  canvas.width = Math.max(cw, 920);
  canvas.height = Math.max(ch, 690);
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;
  setScreenHeight(canvas.height);
}

function drawLoading(pct: number): void {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#c8a000';
  ctx.font = `${Math.round(h / 20)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('20,000 Light-Years Into Space', w / 2, h / 2 - 30);
  ctx.fillStyle = '#666';
  ctx.fillText('TypeScript port — loading assets...', w / 2, h / 2 + 10);
  // Bar
  const bw = Math.min(400, w * 0.5);
  const bh = 12;
  const bx = (w - bw) / 2;
  const by = h / 2 + 50;
  ctx.fillStyle = '#333';
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = '#0a0';
  ctx.fillRect(bx, by, bw * pct / 100, bh);
}

let animId: number | null = null;

function stopLoop(): void {
  if (animId !== null) { cancelAnimationFrame(animId); animId = null; }
}

// ──────────────── MENU SCREEN ────────────────
let menuScreen: MenuScreen | null = null;

function startMenu(isPaused = false, onResume?: () => void, onSave?: (slot: number) => void): void {
  stopLoop();

  menuScreen = new MenuScreen(canvas, isPaused);
  let raf: number;

  const loop = () => {
    const action = menuScreen!.poll();
    if (action) {
      handleMenuAction(action, onResume, onSave);
      if (action.type !== 'NONE') return; // avoid re-running loop after action
    }

    // Check pending save
    if (menuScreen!.pendingSaveSlot >= 0) {
      const slot = menuScreen!.pendingSaveSlot;
      menuScreen!.pendingSaveSlot = -1;
      if (onSave) onSave(slot);
      startMenu(true, onResume, onSave);
      return;
    }

    menuScreen!.draw();
    animId = raf = requestAnimationFrame(loop);
  };

  animId = raf = requestAnimationFrame(loop);
}

function handleMenuAction(action: MenuAction, onResume?: () => void, onSave?: (slot: number) => void): void {
  switch (action.type) {
    case 'START_GAME':
      startGame(action.difficulty);
      break;
    case 'LOAD_GAME': {
      const loaded = loadGame(action.slot);
      if (loaded) {
        resumeGame(loaded.net, loaded.sm, loaded.difficulty);
      } else {
        startMenu();
      }
      break;
    }
    case 'RESUME':
      if (onResume) onResume();
      break;
    case 'QUIT':
      startMenu(false);
      break;
  }
}

// ──────────────── GAME SCREEN ────────────────
function startGame(difficulty: Difficulty): void {
  const diff = getDifficulty(difficulty);
  const rng = new GameRandom();
  const net = new Network(diff, rng);
  net.buildEquilibrium();
  const sm = new SeasonManager(net, diff, rng);
  resumeGame(net, sm, difficulty);
}

function resumeGame(net: Network, sm: SeasonManager, difficulty: Difficulty): void {
  stopLoop();

  const gameScreen = new GameScreen(canvas, net, sm, difficulty);

  let last = performance.now();

  const loop = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.1); // cap at 100ms
    last = now;

    const result = gameScreen.update(dt);

    gameScreen.draw();

    if (result === 'MENU') {
      // Pause — show pause menu
      startMenu(true,
        () => resumeGame(net, sm, difficulty),
        (slot) => { gameScreen.saveToSlot(slot); }
      );
      return;
    } else if (result === 'WIN') {
      drawEndScreen(canvas, true);
      setTimeout(() => startMenu(), 5000);
      return;
    } else if (result === 'LOSE') {
      drawEndScreen(canvas, false);
      setTimeout(() => startMenu(), 5000);
      return;
    }

    animId = requestAnimationFrame(loop);
  };

  animId = requestAnimationFrame(loop);
}

function drawEndScreen(canvas: HTMLCanvasElement, win: boolean): void {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = win ? 'rgba(0,50,0,0.85)' : 'rgba(50,0,0,0.85)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = win ? '#88ff88' : '#ff8888';
  ctx.font = `${Math.round(h / 10)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(win ? '🌟 Victory!' : '💀 Defeat', w / 2, h / 2 - 30);
  ctx.font = `${Math.round(h / 20)}px sans-serif`;
  ctx.fillStyle = '#ccc';
  ctx.fillText(win ? 'The city is powered and thriving!' : 'The city steam pressure collapsed.', w / 2, h / 2 + 30);
  ctx.fillText('Returning to main menu...', w / 2, h / 2 + 70);
}

// ── Boot ──
init().catch(console.error);
