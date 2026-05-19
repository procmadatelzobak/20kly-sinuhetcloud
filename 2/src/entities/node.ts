// Node, WellNode, CityNode — port of map_items.py
import { Item } from './item';
import { Pipe } from './pipe';
import { SteamModel } from '../sim/steam';
import { GridPos, Colour, StatTuple, BarMeter,
  HEALTH_UNIT, NODE_HEALTH_UNITS, NODE_MAX_TECH_LEVEL,
  NODE_UPGRADE_WORK, WORK_UNIT_SIZE, CITY_UPGRADE_WORK, CITY_COLOUR,
  WORK_STEAM_DEMAND, STATIC_STEAM_DEMAND,
  DifficultySettings, PIPE_MAX_TECH_LEVEL, PIPE_UPGRADE_WORK_FACTOR,
  PIPE_UPGRADE_RESISTANCE_FACTOR,
} from '../constants';
import { playSound } from '../assets/loader';

export abstract class Building extends Item {
  health: number;
  maxHealth: number;
  complete = false;
  wasOnceComplete = false;
  baseColour: Colour = [255, 255, 255];
  connectionValue = 0;
  popupCountdown = 0;
  destroyed = false;
  techLevel = 1;

  constructor(pos: GridPos, name: string) {
    super(pos, name);
    this.health = 0;
    this.maxHealth = 5 * HEALTH_UNIT;
  }

  isDestroyed(): boolean { return this.destroyed; }
  needsWork(): boolean { return this.maxHealth !== this.health; }
  isBroken(): boolean { return this.needsWork(); }

  prepareTodie(): void {
    this.health = 0;
    this.destroyed = true;
  }

  takeDamage(dmgLevel: number, damageFactor: number): boolean {
    const x = Math.floor(dmgLevel * damageFactor);
    this.health -= x;
    if (this.health <= 0) {
      this.prepareTodie();
      return true;
    }
    return false;
  }

  doWork(): void {
    if (this.destroyed) return;
    if (this.health < this.maxHealth) {
      this.health += WORK_UNIT_SIZE;
    }
    if (this.health >= this.maxHealth) {
      this.health = this.maxHealth;
      if (this.wasOnceComplete) {
        playSound('double');
      } else {
        playSound('whoosh1');
      }
      this.complete = true;
      this.wasOnceComplete = true;
    }
  }

  getHealthMeter(): BarMeter {
    return { current: this.health, currentColour: [0, 255, 0], max: this.maxHealth, maxColour: [255, 0, 0] };
  }

  getPopupItems(): BarMeter[] {
    return [this.getHealthMeter()];
  }

  getDiagramColour(): Colour {
    let [r, g, b] = this.baseColour;
    if (this.complete) {
      if (this.health < this.maxHealth) {
        g = Math.floor(this.health * g / this.maxHealth);
        b = Math.floor(this.health * b / this.maxHealth);
        if (r < 128) r = 128;
      }
    } else {
      if (this.health > 0) {
        r = Math.floor(this.health * r / this.maxHealth);
        b = Math.floor(this.health * b / this.maxHealth);
        if (r < 128) r = 128;
      } else {
        r = g = b = 128;
      }
    }
    return [r, g, b];
  }

  getTechLevel(): string { return `Tech Level ${this.techLevel}`; }

  getInformation(): StatTuple[] {
    const l: StatTuple[] = [{ colour: [255, 255, 0], size: 20, text: this.nameType }];
    const h = Math.floor((this.health * 100) / this.maxHealth);
    const h2 = this.maxHealth - this.health;
    let units = '';
    if (h2 > 0) {
      units = `${h2} more unit${h2 !== 1 ? 's' : ''} req'd `;
    }
    if (this.complete) {
      if (this.health === this.maxHealth) {
        l.push({ colour: this.getDiagramColour(), size: 15, text: 'Operational' });
      } else {
        l.push({ colour: this.getDiagramColour(), size: 15, text: `Damaged, ${h}% health` });
        l.push({ colour: null, size: null, bar: this.getHealthMeter() });
        l.push({ colour: [128, 128, 128], size: 10, text: `${units}to complete repairs` });
      }
      l.push({ colour: [128, 128, 0], size: 15, text: this.getTechLevel() });
    } else {
      if (this.health > 0) {
        l.push({ colour: this.getDiagramColour(), size: 15, text: `Building, ${h}% done` });
        l.push({ colour: null, size: null, bar: this.getHealthMeter() });
        l.push({ colour: [128, 128, 128], size: 10, text: `${units}to finish building` });
      } else {
        l.push({ colour: this.getDiagramColour(), size: 15, text: 'Not Built' });
      }
    }
    return l;
  }

  beginUpgrade(_diff: DifficultySettings): void {}
  exits(): Building[] { return []; }
}

export class Node extends Building {
  pipes: Pipe[] = [];
  steam: SteamModel;
  frameIndex = 0; // 0-8 for blinking animation

  constructor(pos: GridPos, name = 'Node') {
    super(pos, name);
    this.maxHealth = NODE_HEALTH_UNITS * HEALTH_UNIT;
    this.baseColour = [255, 192, 0];
    this.steam = new SteamModel();
  }

  steamThink(): void {
    const nl: Array<[SteamModel, number]> = [];
    for (const p of this.exits() as Pipe[]) {
      if (!p.isBroken()) {
        const other = p.n1 === this ? p.n2 : p.n1;
        if (!other.isBroken()) {
          nl.push([other.steam, p.resistance]);
        }
      }
    }
    const currents = this.steam.think(nl);
    const pipes = this.exits() as Pipe[];
    for (let i = 0; i < pipes.length; i++) {
      const current = currents[i] ?? 0;
      if (current > 0) {
        pipes[i].flowingFrom(this, current);
      }
    }
    this.frameIndex = (this.frameIndex + 1) % 9;
  }

  exits(): Pipe[] { return this.pipes; }

  getPopupItems(): BarMeter[] {
    return [...super.getPopupItems(), this.getPressureMeter()];
  }

  getPressureMeter(): BarMeter {
    return { current: Math.floor(this.getPressure()), currentColour: [100, 100, 255], max: Math.floor(this.steam.getCapacity()), maxColour: [0, 0, 100] };
  }

  getPressure(): number { return this.steam.getPressure(); }

  getInformation(): StatTuple[] {
    return [...super.getInformation(), { colour: [128, 128, 128], size: 15, text: `Steam pressure: ${this.steam.getPressure().toFixed(1)} P` }];
  }

  beginUpgrade(diff: DifficultySettings): void {
    if (this.techLevel >= NODE_MAX_TECH_LEVEL) {
      addMail('Node cannot be upgraded further.');
      playSound('error');
    } else if (this.needsWork()) {
      addMail('Node must be operational before an upgrade can begin.');
      playSound('error');
    } else {
      playSound('crisp');
      this.techLevel++;
      this.maxHealth += NODE_UPGRADE_WORK * HEALTH_UNIT;
      this.complete = false;
      this.steam.capacityUpgrade();
    }
  }

  soundEffect(): void { playSound('bamboo'); }
  lose(): void { this.steam.lose(); }
}

export class CityNode extends Node {
  availWorkUnits = 1;
  cityUpgrade = 0;
  cityUpgradeStart = 1;
  totalSteam = 0;

  constructor(pos: GridPos) {
    super(pos, 'City');
    this.baseColour = [...CITY_COLOUR] as Colour;
  }

  beginUpgrade(diff: DifficultySettings): void {
    if (this.cityUpgrade === 0) {
      playSound('mechanical_1');
      this.cityUpgrade = this.cityUpgradeStart = (
        (CITY_UPGRADE_WORK + this.techLevel * diff.CITY_UPGRADE_WORK_PER_LEVEL) * HEALTH_UNIT
      );
      this.availWorkUnits++;
    } else {
      addMail('City is already being upgraded.');
      playSound('error');
    }
  }

  needsWork(): boolean { return this.cityUpgrade !== 0; }
  isBroken(): boolean { return false; }

  doWork(): void {
    if (this.cityUpgrade > 0) {
      this.cityUpgrade--;
      if (this.cityUpgrade === 0) {
        this.techLevel++;
        this.steam.capacityUpgrade();
        playSound('cityups');
        addMail(`City upgraded to level ${this.techLevel}!`);
      }
    }
  }

  getAvailWorkUnits(): number { return this.availWorkUnits; }

  getSteamDemand(): number {
    return this.availWorkUnits * WORK_STEAM_DEMAND + STATIC_STEAM_DEMAND;
  }

  getSteamSupply(): number {
    let supply = 0;
    for (const pipe of this.pipes) {
      if (this === pipe.n1) supply -= pipe.currentN1toN2;
      else supply += pipe.currentN1toN2;
    }
    return supply;
  }

  steamThink(): void {
    const demand = this.getSteamDemand();
    this.totalSteam += demand;
    this.steam.source(-demand);
    super.steamThink();
  }

  takeDamage(_dmgLevel: number, _df: number): boolean { return false; }

  getPopupItems(): BarMeter[] {
    return [this.getCityUpgradeMeter(), this.getPressureMeter()];
  }

  getCityUpgradeMeter(): BarMeter {
    if (this.cityUpgrade === 0) return { current: 0, currentColour: [0, 0, 0], max: 1, maxColour: [64, 64, 64] };
    return { current: this.cityUpgradeStart - this.cityUpgrade, currentColour: [255, 255, 50], max: this.cityUpgradeStart, maxColour: [64, 64, 64] };
  }

  getTechLevel(): string { return `Tech Level ${this.techLevel}`; }
  soundEffect(): void { playSound('computer'); }
}

export class WellNode extends Node {
  production = 0;
  private _diff: DifficultySettings | null = null;

  constructor(pos: GridPos) {
    super(pos, 'Steam Maker');
    this.baseColour = [255, 0, 192];
    this.emitsSteam = true;
  }

  setDiff(diff: DifficultySettings): void { this._diff = diff; }

  steamThink(): void {
    const diff = this._diff;
    if (diff && !this.needsWork()) {
      this.production = diff.BASIC_STEAM_PRODUCTION + this.techLevel * diff.STEAM_PRODUCTION_PER_LEVEL;
      this.steam.source(this.production);
    } else {
      this.production = 0;
    }
    super.steamThink();
  }

  getInformation(): StatTuple[] {
    return [...super.getInformation(), { colour: this.baseColour, size: 15, text: `Steam production: ${this.production.toFixed(1)} U` }];
  }

  soundEffect(): void { playSound('bamboo1'); }
}

// Global mail queue (used by entities to add messages)
const mailQueue: string[] = [];
export function addMail(msg: string): void { mailQueue.push(msg); }
export function drainMail(): string[] { return mailQueue.splice(0); }

// Pipe upgrade needs these — forward-declared type usage
export { PIPE_MAX_TECH_LEVEL, PIPE_UPGRADE_WORK_FACTOR, PIPE_UPGRADE_RESISTANCE_FACTOR };
