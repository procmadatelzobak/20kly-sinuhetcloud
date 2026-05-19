// Alien invasion AI — port of alien_invasion.py
import { Network, GameRandom } from '../sim/network';
import { Node, WellNode, CityNode } from '../entities/node';
import { Pipe } from '../entities/pipe';
import { Item } from '../entities/item';
import { TWO_PI, TWO_THIRDS_PI, Colour } from '../constants';
import { floatGridToScr } from '../sim/grid';
import { Renderer } from '../engine/render';
import { playSound } from '../assets/loader';

interface AlienTarget {
  item: Item | null;
  pos: { x: number; y: number };
  score: number;
}

export class AlienSeason {
  private net: Network;
  private alienTechLevel: number;
  private rng: GameRandom;
  private aliens: Alien[] = [];
  private targetList: AlienTarget[] = [];
  private t2Announced = false;
  private newAliens = false;

  constructor(net: Network, alienTechLevel: number, rng: GameRandom) {
    this.net = net;
    this.alienTechLevel = alienTechLevel;
    this.rng = rng;
    this.computeTargets(5);
  }

  private computeTargets(m: number): void {
    // Pipes with most current
    const pipeCandidates: AlienTarget[] = this.net.pipeList.map(p => ({
      item: p,
      pos: { x: p.pos.x, y: p.pos.y },
      score: Math.abs(p.currentN1toN2),
    }));
    pipeCandidates.sort((a, b) => a.score - b.score);
    const targets: AlienTarget[] = pipeCandidates.slice(-m * 2);

    // Nodes with most connections
    const nodeCandidates: AlienTarget[] = this.net.nodeList.map(n => ({
      item: n,
      pos: { x: n.pos.x, y: n.pos.y },
      score: n.pipes.length,
    }));
    nodeCandidates.sort((a, b) => a.score - b.score);
    targets.push(...nodeCandidates.slice(-m));

    // Busiest wells
    const wellCandidates: AlienTarget[] = this.net.nodeList
      .filter(n => n instanceof WellNode)
      .map(n => ({
        item: n,
        pos: { x: n.pos.x, y: n.pos.y },
        score: n.pipes.reduce((s, p) => s + Math.abs(p.currentN1toN2), 0),
      }));
    wellCandidates.sort((a, b) => a.score - b.score);
    targets.push(...wellCandidates.slice(-m));

    // No city targets
    this.targetList = targets.filter(t => !(t.item instanceof CityNode));
  }

  perPeriod(): void {
    if (this.alienTechLevel >= 1.7) {
      this.computeTargets(3);
      if (!this.t2Announced) {
        playSound('alient2');
        this.t2Announced = true;
      }
    }

    const numAliens = this.rng.randint(2, 2 + Math.floor(this.alienTechLevel));
    let alienAngle = this.rng.random() * TWO_PI;
    const { x: cx, y: cy } = { x: 25, y: 25 };
    const alienRadius = cx + cy;

    const ex = cx + alienRadius * Math.cos(alienAngle + Math.PI);
    const ey = cy + alienRadius * Math.sin(alienAngle + Math.PI);

    const numTargets = this.rng.randint(1, 1 + Math.floor(this.alienTechLevel));
    const shuffled = [...this.targetList];
    this.rng.shuffle(shuffled);
    const alienTargets: AlienTarget[] = shuffled.slice(0, numTargets);
    alienTargets.push({ item: null, pos: { x: ex, y: ey }, score: 0 });

    if (alienTargets.length <= 1) return;

    for (let i = 0; i < numAliens; i++) {
      const sx = cx + alienRadius * Math.cos(alienAngle);
      const sy = cy + alienRadius * Math.sin(alienAngle);
      const a = new Alien(this.net, this.alienTechLevel, this.t2Announced, this.rng);
      a.pos = { x: sx, y: sy };
      a.targets = [...alienTargets];
      this.aliens.push(a);
      alienAngle += 0.15;
      this.newAliens = true;
    }

    // Remove done aliens from front
    while (this.aliens.length > 0 && this.aliens[0].done) {
      this.aliens.shift();
    }
  }

  perFrame(dt: number): void {
    for (const alien of this.aliens) alien.perFrame(dt);
    if (this.newAliens) {
      playSound('ring');
      this.newAliens = false;
    }
  }

  draw(r: Renderer, offsetX: number): void {
    for (const alien of this.aliens) alien.draw(r, offsetX);
  }

  getExtraInfo(): Array<{ colour: [number, number, number]; text: string }> {
    const rookies = this.aliens.filter(a => a.rookie).length;
    if (rookies > 0) return [{ colour: [255, 0, 0], text: 'Aliens approaching!' }];
    return [];
  }
}

class Alien {
  pos: { x: number; y: number } = { x: 0, y: 0 };
  targets: AlienTarget[] = [];
  done = false;
  rookie = true;

  private net: Network;
  private techLevel: number;
  private rng: GameRandom;
  private colour1: Colour;
  private colour2: Colour;
  private currentTarget: AlienTarget | null = null;
  private speed = 0;
  private attackAngle = 0;
  private heading = 0;
  private inZone = false;
  private countdown = 0;
  private rotation: number;
  private laser: [[number,number],[number,number]] | null = null;
  private points: [number,number][] = [[-1,-1],[-1,-1],[-1,-1]];

  static ATTACK_DIST = 2.5;
  static MAX_SPEED = 14.0;
  static ACC = 0.4;
  static MAX_TIME = 1.2;
  static SIZE = 1;

  constructor(net: Network, techLevel: number, t2: boolean, rng: GameRandom) {
    this.net = net;
    this.techLevel = techLevel;
    this.rng = rng;
    this.rotation = 0.05 + rng.random() * 0.05;
    if (t2) {
      this.colour1 = [128, 128, 0];
      this.colour2 = [255, 200, 0];
    } else {
      this.colour1 = [128, 0, 0];
      this.colour2 = [255, 100, 0];
    }
  }

  perFrame(dt: number): void {
    this.laser = null;
    if (!this.currentTarget) {
      if (this.targets.length === 0) { this.done = true; return; }
      this.currentTarget = this.targets.shift()!;
      this.countdown = Alien.MAX_TIME;
      const { x, y } = this.pos;
      const { x: tx, y: ty } = this.currentTarget.pos;
      this.attackAngle = Math.atan2(y - ty, x - tx);
      this.heading = this.attackAngle + Math.PI;
      this.inZone = false;
    }

    const { x: tx, y: ty } = this.currentTarget.pos;
    const zx = tx + Math.cos(this.attackAngle) * Alien.ATTACK_DIST;
    const zy = ty + Math.sin(this.attackAngle) * Alien.ATTACK_DIST;
    let { x, y } = this.pos;

    if (this.inZone) {
      this.pos = { x: zx, y: zy };
      x = zx; y = zy;
      this.rookie = false;
      this.attackAngle += this.rotation;
      this.heading += this.rotation;
      this.countdown -= dt;

      if (this.countdown < 0) {
        this.currentTarget = null;
      } else if (this.currentTarget.item && this.currentTarget.item.takeDamage(this.techLevel, 1.0)) {
        this.net.destroy(this.currentTarget.item, 'aliens');
        this.currentTarget = null;
      } else {
        this.laser = [floatGridToScr(x, y) as [number,number], floatGridToScr(this.currentTarget.pos.x, this.currentTarget.pos.y) as [number,number]];
      }
    } else {
      const dist = Math.hypot(zx - x, zy - y);
      if (dist > 0.1) {
        this.speed = Math.min(this.speed + Alien.ACC, Alien.MAX_SPEED);
        let s = this.speed * dt;
        if (s > dist) s = dist;
        x += Math.cos(this.heading) * s;
        y += Math.sin(this.heading) * s;
        this.pos = { x, y };
      } else {
        this.inZone = true;
      }
    }

    // Compute triangle points in screen space
    for (let i = 0; i < 3; i++) {
      const a = [0, TWO_THIRDS_PI, -TWO_THIRDS_PI][i];
      const px = x + Math.cos(a + this.heading) * Alien.SIZE;
      const py = y + Math.sin(a + this.heading) * Alien.SIZE;
      this.points[i] = floatGridToScr(px, py) as [number,number];
    }
  }

  draw(r: Renderer, offsetX: number): void {
    const pts = this.points.map(([px, py]) => [px + offsetX, py] as [number,number]);
    r.polygon(pts, this.colour1, this.colour2, 1);
    if (this.laser) {
      const [[ax, ay], [bx, by]] = this.laser;
      r.line(ax + offsetX, ay, bx + offsetX, by, [255, 255, 255], 1);
    }
  }
}
