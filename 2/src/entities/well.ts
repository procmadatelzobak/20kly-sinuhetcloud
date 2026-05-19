// Well — steam source (visual marker, no health)
import { Item } from './item';
import { GridPos } from '../constants';

export class Well extends Item {
  constructor(pos: GridPos) {
    super(pos, 'Well');
    this.emitsSteam = true;
  }
}
