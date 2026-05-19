// Port of steam_model.py — RC circuit analogy for steam pressure
import { INITIAL_NODE_CAPACITY, CAPACITY_UPGRADE } from '../constants';

const TIME_CONSTANT = 0.1;
const NEGLIGIBLE = 0.01;

export class SteamModel {
  capacitance = 1.0;
  charge = 0.0;
  voltage = 0.0;
  capacity: number;

  constructor() {
    this.capacity = INITIAL_NODE_CAPACITY;
  }

  source(current: number): void {
    const dq = current * TIME_CONSTANT;
    this.charge += dq;
    this.bound();
  }

  think(neighbours: Array<[SteamModel, number]>): number[] {
    this.voltage = this.charge / this.capacitance;
    const currents: number[] = [];

    for (const [nb, resist] of neighbours) {
      const dv = this.voltage - nb.voltage;
      if (dv >= NEGLIGIBLE) {
        const i = dv / resist;
        const dq = i * TIME_CONSTANT;
        this.charge -= dq;
        nb.charge += dq;
        currents.push(i);
      } else {
        currents.push(0.0);
      }
    }

    this.bound();
    return currents;
  }

  private bound(): void {
    if (this.charge < 0) this.charge = 0;
    else if (this.charge > this.capacity) this.charge = this.capacity;
  }

  getPressure(): number { return this.charge; }
  getCapacity(): number { return this.capacity; }

  capacityUpgrade(): void {
    this.capacity += CAPACITY_UPGRADE;
  }

  lose(): void {
    this.charge = 0;
  }
}
