// Pipe — connects two nodes (port of map_items.py Pipe)
import { Building, Node, addMail } from './node';
import { GridPos, HEALTH_UNIT, RESISTANCE_FACTOR,
  PIPE_MAX_TECH_LEVEL, PIPE_UPGRADE_WORK_FACTOR, PIPE_UPGRADE_RESISTANCE_FACTOR,
  DifficultySettings, StatTuple } from '../constants';
import { playSound } from '../assets/loader';

export class Pipe extends Building {
  n1: Node;
  n2: Node;
  length: number;
  resistance: number;
  currentN1toN2 = 0.0;
  dotOffset = 0; // animation state

  static readonly SFACTOR = 512;
  static readonly FUTZFACTOR = 4.0 * 35.0;

  constructor(n1: Node, n2: Node) {
    const pos: GridPos = { x: Math.floor((n1.pos.x + n2.pos.x) / 2), y: Math.floor((n1.pos.y + n2.pos.y) / 2) };
    super(pos, 'Pipe');
    this.n1 = n1;
    this.n2 = n2;
    n1.pipes.push(this);
    n2.pipes.push(this);
    const dx = n1.pos.x - n2.pos.x;
    const dy = n1.pos.y - n2.pos.y;
    this.length = Math.hypot(dx, dy);
    this.maxHealth = Math.floor(this.length + 1) * HEALTH_UNIT;
    this.baseColour = [0, 255, 0];
    this.resistance = (this.length + 2) * RESISTANCE_FACTOR;
  }

  flowingFrom(node: Node, current: number): void {
    if (node === this.n1) {
      this.currentN1toN2 = current;
    } else {
      this.currentN1toN2 = -current;
    }
  }

  takeDamage(dmgLevel: number, damageFactor: number): boolean {
    return super.takeDamage(dmgLevel * (this.length + 1), damageFactor);
  }

  beginUpgrade(_diff: DifficultySettings): void {
    if (this.techLevel >= PIPE_MAX_TECH_LEVEL) {
      addMail('Pipe cannot be upgraded further.');
      playSound('error');
    } else if (this.needsWork()) {
      addMail('Pipe must be operational before an upgrade can begin.');
      playSound('error');
    } else {
      playSound('crisp');
      this.techLevel++;
      this.maxHealth += Math.floor(PIPE_UPGRADE_WORK_FACTOR * this.length * HEALTH_UNIT);
      this.complete = false;
      this.resistance *= PIPE_UPGRADE_RESISTANCE_FACTOR;
    }
  }

  exits(): Node[] { return [this.n1, this.n2]; }

  frameAdvance(frameTime: number): void {
    this.dotOffset += Math.floor(Pipe.FUTZFACTOR * frameTime * this.currentN1toN2);
    if (this.dotOffset < 0) {
      this.dotOffset = Pipe.SFACTOR - ((-this.dotOffset) % Pipe.SFACTOR);
    } else {
      this.dotOffset = this.dotOffset % Pipe.SFACTOR;
    }
  }

  getInformation(): StatTuple[] {
    return [...super.getInformation(),
      { colour: [128, 128, 128], size: 15, text: `${this.length.toFixed(1)} km` },
      { colour: [128, 128, 128], size: 15, text: `Flow rate: ${Math.abs(this.currentN1toN2).toFixed(1)} U` },
    ];
  }

  soundEffect(): void { playSound('bamboo2'); }
}
