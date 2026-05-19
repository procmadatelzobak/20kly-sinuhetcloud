// Save/load system — JSON to localStorage (port of save_game.py)
import { Network, GameRandom } from '../sim/network';
import { Node, WellNode, CityNode } from '../entities/node';
import { Well } from '../entities/well';
import { Pipe } from '../entities/pipe';
import { GridPos, Difficulty, Season, getDifficulty } from '../constants';
import { SeasonManager } from '../ai/seasons';

const SAVE_PREFIX = '20ly_ts_save_';
const NUM_SLOTS = 10;

interface SaveData {
  version: number;
  label: string;
  difficulty: Difficulty;
  gameTime: number;
  season: string;
  seasonEnds: number;
  difficultyLevel: number;
  wells: Array<{ x: number; y: number }>;
  nodes: Array<{
    type: 'Node' | 'WellNode' | 'CityNode';
    x: number; y: number;
    health: number; maxHealth: number;
    techLevel: number;
    complete: boolean;
    wasOnceComplete: boolean;
    steamCharge: number;
    steamCapacity: number;
    availWork?: number;
    cityUpgrade?: number;
  }>;
  pipes: Array<{
    n1: number; n2: number;
    health: number; maxHealth: number;
    techLevel: number;
    complete: boolean;
    wasOnceComplete: boolean;
    resistance: number;
  }>;
}

export function getSaveLabel(slot: number): string | null {
  const raw = localStorage.getItem(SAVE_PREFIX + slot);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as SaveData;
    return data.label;
  } catch { return null; }
}

export function hasSave(slot: number): boolean {
  return localStorage.getItem(SAVE_PREFIX + slot) !== null;
}

export function deleteSave(slot: number): void {
  localStorage.removeItem(SAVE_PREFIX + slot);
}

export function saveGame(slot: number, net: Network, sm: SeasonManager, difficulty: Difficulty): void {
  const nodeIndex = (node: Node) => net.nodeList.indexOf(node);

  const data: SaveData = {
    version: 1,
    label: `Day ${sm.getDayNumber()} — ${sm.getSeasonName()} — ${difficulty}`,
    difficulty,
    gameTime: sm.gameTime,
    season: sm.season,
    seasonEnds: sm.seasonEnds,
    difficultyLevel: sm.difficultyLevel,
    wells: net.wellList.map(w => ({ x: w.pos.x, y: w.pos.y })),
    nodes: net.nodeList.map(n => {
      const base = {
        type: (n instanceof CityNode ? 'CityNode' : n instanceof WellNode ? 'WellNode' : 'Node') as 'Node' | 'WellNode' | 'CityNode',
        x: n.pos.x, y: n.pos.y,
        health: n.health, maxHealth: n.maxHealth,
        techLevel: n.techLevel,
        complete: n.complete, wasOnceComplete: n.wasOnceComplete,
        steamCharge: n.steam.charge,
        steamCapacity: n.steam.capacity,
      };
      if (n instanceof CityNode) return { ...base, availWork: n.availWorkUnits, cityUpgrade: n.cityUpgrade };
      return base;
    }),
    pipes: net.pipeList.map(p => ({
      n1: nodeIndex(p.n1), n2: nodeIndex(p.n2),
      health: p.health, maxHealth: p.maxHealth,
      techLevel: p.techLevel,
      complete: p.complete, wasOnceComplete: p.wasOnceComplete,
      resistance: p.resistance,
    })),
  };

  localStorage.setItem(SAVE_PREFIX + slot, JSON.stringify(data));
}

export function loadGame(slot: number): { net: Network; sm: SeasonManager; difficulty: Difficulty } | null {
  const raw = localStorage.getItem(SAVE_PREFIX + slot);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as SaveData;
    const diff = getDifficulty(data.difficulty);
    const rng = new GameRandom();
    const net = new Network(diff, rng);

    // Replace generated network with saved data
    // Clear existing nodes and pipes
    net.nodeList.length = 0;
    net.pipeList.length = 0;
    net.wellList.length = 0;
    net.groundGrid.clear();

    // Restore wells
    for (const w of data.wells) {
      const well = new Well(w);
      net.wellList.push(well);
      net.groundGrid.set(`${w.x},${w.y}`, well);
    }

    // Restore nodes
    const nodeObjs: Node[] = [];
    for (const nd of data.nodes) {
      let node: Node;
      const pos: GridPos = { x: nd.x, y: nd.y };
      if (nd.type === 'CityNode') {
        const cn = new CityNode(pos);
        cn.availWorkUnits = nd.availWork ?? 1;
        cn.cityUpgrade = nd.cityUpgrade ?? 0;
        node = cn;
      } else if (nd.type === 'WellNode') {
        node = new WellNode(pos);
      } else {
        node = new Node(pos);
      }
      node.health = nd.health;
      node.maxHealth = nd.maxHealth;
      node.techLevel = nd.techLevel;
      node.complete = nd.complete;
      node.wasOnceComplete = nd.wasOnceComplete;
      node.steam.charge = nd.steamCharge;
      node.steam.capacity = nd.steamCapacity;
      net.nodeList.push(node);
      net.groundGrid.set(`${nd.x},${nd.y}`, node);
      if (nd.type === 'CityNode') net.hub = node as CityNode;
      nodeObjs.push(node);
    }

    // Restore pipes
    for (const pd of data.pipes) {
      const n1 = nodeObjs[pd.n1];
      const n2 = nodeObjs[pd.n2];
      if (!n1 || !n2) continue;
      const pipe = new Pipe(n1, n2);
      pipe.health = pd.health;
      pipe.maxHealth = pd.maxHealth;
      pipe.techLevel = pd.techLevel;
      pipe.complete = pd.complete;
      pipe.wasOnceComplete = pd.wasOnceComplete;
      pipe.resistance = pd.resistance;
      net.pipeList.push(pipe);
    }

    // Rebuild connection values
    net.workPulse(0);

    const sm = new SeasonManager(net, diff, rng);
    sm.gameTime = data.gameTime;
    sm.season = data.season as Season;
    sm.seasonEnds = data.seasonEnds;
    sm.difficultyLevel = data.difficultyLevel;

    return { net, sm, difficulty: data.difficulty };
  } catch (e) {
    console.error('Load failed:', e);
    return null;
  }
}
