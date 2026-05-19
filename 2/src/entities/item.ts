// Base class for all map items (port of map_items.py Item)
import { GridPos, StatTuple, Colour } from '../constants';

export abstract class Item {
  pos: GridPos;
  nameType: string;
  emitsSteam = false;

  constructor(pos: GridPos, name: string) {
    this.pos = { ...pos };
    this.nameType = name;
  }

  manhattanDistFrom(other: Item): number {
    return Math.abs(this.pos.x - other.pos.x) + Math.abs(this.pos.y - other.pos.y);
  }

  isDestroyed(): boolean { return false; }
  takeDamage(_dmgLevel: number, _damageFactor: number): boolean { return false; }
  getInformation(): StatTuple[] {
    return [{ colour: [255, 255, 0], size: 20, text: this.nameType }];
  }
  prepareTodie(): void {}
  soundEffect(): void {}
  getBaseColour(): Colour { return [255, 255, 255]; }
}
