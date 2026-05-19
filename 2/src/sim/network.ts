// Port of network.py — steam transport network management
import { Item } from '../entities/item';
import { Well } from '../entities/well';
import { Node, WellNode, CityNode, Building, addMail } from '../entities/node';
import { Pipe } from '../entities/pipe';
import { GridPos, GRID_CENTRE, GRID_W, GRID_H, DifficultySettings } from '../constants';
import { playSound } from '../assets/loader';

// Seeded PRNG (simple LCG) for deterministic map generation
export class GameRandom {
  private seed: number;

  constructor(seed?: number) {
    this.seed = seed ?? (Date.now() & 0x7fffffff);
  }

  random(): number {
    this.seed = (this.seed * 1664525 + 1013904223) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  randint(lo: number, hi: number): number {
    return lo + Math.floor(this.random() * (hi - lo + 1));
  }

  shuffle<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  hypot(a: number, b: number): number { return Math.hypot(a, b); }
}

// Line intersection test (port of intersect.py)
function linesIntersect(
  xa1: number, ya1: number, xa2: number, ya2: number,
  xb1: number, yb1: number, xb2: number, yb2: number,
): boolean {
  const xa = xa2 - xa1, ya = ya2 - ya1;
  const xb = xb2 - xb1, yb = yb2 - yb1;
  const a = xa * yb - xb * ya;
  if (a === 0) return false;
  const b = xa * ya1 + xb1 * ya - xa1 * ya - xa * yb1;
  const tb = b / a;
  if (tb <= 0 || tb >= 1) return false;
  const ta = xa === 0 ? (yb1 + yb * tb - ya1) / ya : (xb1 + xb * tb - xa1) / xa;
  return ta > 0 && ta < 1;
}

function intersectsNode(gpos: GridPos, n1: GridPos, n2: GridPos): boolean {
  const dx = n2.x - n1.x, dy = n2.y - n1.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return false;
  const dist = Math.abs(dx * (n1.y - gpos.y) - (n1.x - gpos.x) * dy) / len;
  return dist < 0.5;
}

function gridKey(pos: GridPos): string { return `${pos.x},${pos.y}`; }

export class Network {
  groundGrid = new Map<string, Item>();
  wellList: Well[] = [];
  nodeList: Node[] = [];
  pipeList: Pipe[] = [];
  hub!: CityNode;
  dirty = false;
  popups = new Set<Building>();
  connectionValue = 0;
  private diff: DifficultySettings;
  private rng: GameRandom;

  constructor(diff: DifficultySettings, rng: GameRandom, teaching = false) {
    this.diff = diff;
    this.rng = rng;

    // Create 10 random wells
    for (let i = 0; i < 10; i++) {
      this.makeWell(teaching, true);
    }

    // Bootstrap well near city
    const { x: cx, y: cy } = GRID_CENTRE;
    const wpos: GridPos = { x: cx + 5, y: cy + this.rng.randint(-3, 3) };
    const w = new Well(wpos);
    this.addGridItem(w, true);
    const wn = new WellNode(wpos);
    wn.setDiff(diff);
    this.addFinishedNode(wn);

    // City node
    const cn = new CityNode(GRID_CENTRE);
    this.addFinishedNode(cn);

    // Bootstrap pipe
    const pipe = this.addPipe(cn, wn);
    if (pipe) {
      pipe.health = pipe.maxHealth;
      pipe.doWork();
    }

    this.hub = cn;
    this.connectionValue = 1;
    this.workPulse(0);
  }

  addFinishedNode(node: Node): void {
    node.health = node.maxHealth;
    node.doWork();
    node.complete = true;
    node.wasOnceComplete = true;
    this.addGridItem(node, true);
  }

  addGridItem(item: Item, inhibit = false): boolean {
    const key = gridKey(item.pos);

    // Check pipes crossing this position
    for (const pipe of this.pipeList) {
      if (pipe.isDestroyed()) continue;
      if (intersectsNode(item.pos, pipe.n1.pos, pipe.n2.pos)) {
        if (!inhibit) { addMail("Can't build there — pipe in the way!"); playSound('error'); }
        return false;
      }
    }

    const existing = this.groundGrid.get(key);
    if (existing instanceof Building) {
      if (!inhibit) { addMail("Can't build there — building in the way!"); playSound('error'); }
      return false;
    }

    if (item instanceof Node) {
      this.nodeList.push(item);
      this.groundGrid.set(key, item);
    } else if (item instanceof Well) {
      this.wellList.push(item);
      this.groundGrid.set(key, item);
    } else {
      return false;
    }
    return true;
  }

  isConnected(node: Building): boolean {
    return node.connectionValue === this.connectionValue;
  }

  workPulse(workPoints: number): number {
    let used = 0;
    this.connectionValue++;
    const cv = this.connectionValue;
    let now = new Set<Building>([this.hub]);

    while (now.size > 0) {
      const next = new Set<Building>();
      const sorted = Array.from(now).sort((a, b) => {
        const da = a.manhattanDistFrom(this.hub) - b.manhattanDistFrom(this.hub);
        if (da !== 0) return da;
        const xd = a.pos.x - b.pos.x;
        return xd !== 0 ? xd : a.pos.y - b.pos.y;
      });
      for (const node of sorted) {
        if (node.connectionValue < cv) {
          if (workPoints > 0 && node.needsWork()) {
            node.doWork();
            this.popup(node);
            workPoints--;
            used++;
          }
          node.connectionValue = cv;
          for (const exit of node.exits()) {
            next.add(exit as Building);
          }
        }
      }
      now = next;
    }
    return used;
  }

  popup(node: Building | null): void {
    if (node) {
      this.popups.add(node);
      node.popupCountdown = 40;
    }
  }

  expirePopups(): void {
    for (const node of this.popups) {
      node.popupCountdown--;
      if (node.popupCountdown <= 0) this.popups.delete(node);
    }
  }

  steamThink(): void {
    for (const n of this.nodeList) {
      n.steamThink();
    }
  }

  addPipe(n1: Node, n2: Node): Pipe | null {
    if (n1.isDestroyed() || n2.isDestroyed()) {
      playSound('error');
      addMail('Nodes are destroyed.');
      return null;
    }

    // Check existing pipes for collision
    for (const p of this.pipeList) {
      if (p.isDestroyed()) continue;
      if ((p.n1 === n1 && p.n2 === n2) || (p.n1 === n2 && p.n2 === n1)) {
        playSound('error');
        addMail('There is already a pipe there.');
        return null;
      }
      if (linesIntersect(p.n1.pos.x, p.n1.pos.y, p.n2.pos.x, p.n2.pos.y,
                          n1.pos.x, n1.pos.y, n2.pos.x, n2.pos.y)) {
        playSound('error');
        addMail('That crosses an existing pipe.');
        return null;
      }
    }

    // Check if any non-well item is on the line
    for (const [, item] of this.groundGrid) {
      if (item === n1 || item === n2) continue;
      if (item instanceof Well) continue;
      if (item.isDestroyed()) continue;
      if (intersectsNode(item.pos, n1.pos, n2.pos)) {
        playSound('error');
        addMail('Pipe collides with other items.');
        return null;
      }
    }

    playSound('bamboo1');
    const pipe = new Pipe(n1, n2);
    this.pipeList.push(pipe);
    this.dirty = true;
    return pipe;
  }

  getItemAtGrid(pos: GridPos): Item | null {
    return this.groundGrid.get(gridKey(pos)) ?? null;
  }

  getPipeAtGrid(pos: GridPos): Pipe | null {
    // Find the pipe whose midpoint is closest to pos, or passes through it
    let best: Pipe | null = null;
    let bestDist = 1.5;
    for (const p of this.pipeList) {
      if (p.isDestroyed()) continue;
      const dx = pos.x - p.pos.x;
      const dy = pos.y - p.pos.y;
      const d = Math.hypot(dx, dy);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
      // Also check if click is near the line
      if (intersectsNode(pos, p.n1.pos, p.n2.pos)) {
        if (d < 2) { best = p; bestDist = 0; }
      }
    }
    return best;
  }

  destroy(item: Item, by = ''): void {
    if (item instanceof Pipe) {
      this.destroyPipe(item);
      return;
    }
    if (!(item instanceof Node) || item === this.hub) return;

    playSound('destroy');

    for (const pipe of [...item.pipes]) {
      this.destroyPipe(pipe);
    }

    const key = gridKey(item.pos);
    if (this.groundGrid.get(key) !== item) return;

    this.dirty = true;
    if (by) addMail(`${item.nameType} destroyed by ${by}.`);

    item.prepareTodie();
    const idx = this.nodeList.indexOf(item);
    if (idx >= 0) this.nodeList.splice(idx, 1);

    // Restore well beneath WellNode
    if (item instanceof WellNode) {
      const w = this.wellList.find(w => w.pos.x === item.pos.x && w.pos.y === item.pos.y);
      if (w) { this.groundGrid.set(key, w); return; }
    }
    this.groundGrid.delete(key);
  }

  private destroyPipe(pipe: Pipe): void {
    this.dirty = true;
    pipe.prepareTodie();
    const removeFrom = (arr: Pipe[]) => { const i = arr.indexOf(pipe); if (i >= 0) arr.splice(i, 1); };
    removeFrom(this.pipeList);
    removeFrom(pipe.n1.pipes);
    removeFrom(pipe.n2.pipes);
  }

  makeWell(teaching = false, inhibit = false): void {
    this.dirty = true;
    const { x: cx, y: cy } = GRID_CENTRE;
    let x = cx, y = cy;

    while (this.groundGrid.has(gridKey({ x, y })) || Math.hypot(x - cx, y - cy) < 10) {
      x = this.rng.randint(0, GRID_W - 1);
      y = this.rng.randint(0, GRID_H - 1);
      if (teaching && x < cx) x += cx;
    }
    const w = new Well({ x, y });
    this.addGridItem(w, inhibit || teaching);
  }

  lose(): void {
    for (const n of this.nodeList) n.lose();
  }

  setDifficulty(diff: DifficultySettings): void {
    this.diff = diff;
  }

  buildEquilibrium(): void {
    for (let i = 0; i < 300; i++) {
      this.steamThink();
      if (this.hub.getPressure() >= 10.0) break;
    }
  }
}
