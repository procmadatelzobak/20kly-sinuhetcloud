// Season state machine — port of game.py season logic + quiet/storm/quake seasons
import { Season, LENGTH_OF_SEASON, DifficultySettings, STORM_DAMAGE, TWO_PI } from '../constants';
import { Network, GameRandom } from '../sim/network';
import { Node, WellNode, CityNode } from '../entities/node';
import { Pipe } from '../entities/pipe';
import { AlienSeason } from './aliens';
import { playSound } from '../assets/loader';
import { Renderer } from '../engine/render';
import { getCellSize, gridToScr } from '../sim/grid';

export class SeasonManager {
  season: Season = Season.START;
  gameTime = 0; // game seconds
  seasonEnds = 0;
  seasonEffect = 0;
  difficultyLevel = 1.0;
  private diff: DifficultySettings;
  private net: Network;
  private rng: GameRandom;
  private alienSeason: AlienSeason | null = null;
  private quake: QuakeSeason | null = null;
  private storm: StormSeason | null = null;
  private workTimer = 0.1;
  private workUnitsTotal = 0;
  private _isShaking = false;
  private earthquakeFaultLines: EarthquakeFaultLine[] = [];
  private stormClouds: StormCloud[] = [];

  constructor(net: Network, diff: DifficultySettings, rng: GameRandom) {
    this.net = net;
    this.diff = diff;
    this.rng = rng;
  }

  advance(dt: number): void {
    this.gameTime += dt;
    this.workTimer -= dt;

    if (this.workTimer <= 0) {
      this.workTimer = 0.1;
      const avail = this.net.hub.getAvailWorkUnits();
      this.workUnitsTotal = avail;
      this.net.workPulse(avail);
      this.net.steamThink();
      this.net.expirePopups();
    }

    // Season transitions
    if (this.season === Season.START) {
      this.season = Season.QUIET;
      this.seasonEnds = this.gameTime + LENGTH_OF_SEASON;
      this.seasonEffect = this.gameTime + 2;
    } else if (this.gameTime >= this.seasonEnds) {
      this.nextSeason();
    }

    // Per-season updates
    const period = this.getSeasonPeriod();
    if (period > 0 && this.gameTime >= this.seasonEffect) {
      this.seasonEffect = this.gameTime + period;
      this.doSeasonEffect();
    }

    // Frame updates for effects
    this.updateEffects(dt);
  }

  private nextSeason(): void {
    this.seasonEnds = this.gameTime + LENGTH_OF_SEASON;
    this.seasonEffect = this.gameTime + 2;

    switch (this.season) {
      case Season.QUIET:
        this.season = Season.ALIEN;
        if (this.diff.DAMAGE_FACTOR < 1.7) { // not expert (peaceful mode doesn't get aliens)
          playSound('aliensappr');
        }
        this.alienSeason = new AlienSeason(this.net, this.difficultyLevel, this.rng);
        break;
      case Season.ALIEN:
        this.season = Season.QUAKE;
        playSound('quakewarn');
        this.quake = new QuakeSeason(this.rng);
        break;
      case Season.QUAKE:
        this.season = Season.STORM;
        playSound('stormwarn');
        this.storm = new StormSeason(this.rng);
        break;
      case Season.STORM:
        this.season = Season.QUIET;
        this.difficultyLevel += 0.2;
        this.alienSeason = null;
        this.quake = null;
        this.storm = null;
        this._isShaking = false;
        break;
    }
  }

  private getSeasonPeriod(): number {
    switch (this.season) {
      case Season.QUIET: return 0;
      case Season.ALIEN: return 16;
      case Season.QUAKE: return 4;
      case Season.STORM: return 2;
      default: return 0;
    }
  }

  private doSeasonEffect(): void {
    switch (this.season) {
      case Season.ALIEN:
        this.alienSeason?.perPeriod();
        break;
      case Season.QUAKE:
        this.doQuakeDamage();
        break;
      case Season.STORM:
        this.doStormDamage();
        break;
    }
  }

  private doQuakeDamage(): void {
    // Pick a random node or pipe and damage it
    const targets: Array<Node | Pipe> = [...this.net.nodeList, ...this.net.pipeList].filter(t => !t.isDestroyed() && t !== this.net.hub);
    if (targets.length === 0) return;
    const idx = this.rng.randint(0, targets.length - 1);
    const target = targets[idx];
    const destroyed = target instanceof Pipe
      ? target.takeDamage(STORM_DAMAGE, this.diff.DAMAGE_FACTOR)
      : target.takeDamage(STORM_DAMAGE, this.diff.DAMAGE_FACTOR);
    if (destroyed) this.net.destroy(target, 'quake');
    this._isShaking = true;
    // Add fault line visual
    this.earthquakeFaultLines.push(new EarthquakeFaultLine(this.rng));
    setTimeout(() => { this._isShaking = false; }, 500);
  }

  private doStormDamage(): void {
    // Pick a random pipe and damage it
    const pipes = this.net.pipeList.filter(p => !p.isDestroyed());
    if (pipes.length === 0) return;
    const idx = this.rng.randint(0, pipes.length - 1);
    const pipe = pipes[idx];
    const destroyed = pipe.takeDamage(STORM_DAMAGE, this.diff.DAMAGE_FACTOR);
    if (destroyed) this.net.destroy(pipe, 'storm');
    this.stormClouds.push(new StormCloud(this.rng));
    playSound('stormdmg');
  }

  private updateEffects(dt: number): void {
    if (this.season === Season.ALIEN) this.alienSeason?.perFrame(dt);
    this.earthquakeFaultLines = this.earthquakeFaultLines.filter(f => { f.update(dt); return f.alive; });
    this.stormClouds = this.stormClouds.filter(s => { s.update(dt); return s.alive; });
  }

  drawEffects(r: Renderer, offsetX: number): void {
    if (this.season === Season.ALIEN) this.alienSeason?.draw(r, offsetX);
    for (const f of this.earthquakeFaultLines) f.draw(r, offsetX);
    for (const s of this.stormClouds) s.draw(r, offsetX);
  }

  isShaking(): boolean { return this._isShaking; }
  getShakeOffset(): [number, number] {
    if (!this._isShaking) return [0, 0];
    return [this.rng.randint(-3, 3), this.rng.randint(-3, 3)];
  }

  getDayNumber(): number { return Math.floor(this.gameTime); }
  getSeasonName(): string { return this.season; }
  getDaysUntilNextSeason(): number { return Math.max(0, Math.floor(this.seasonEnds - this.gameTime)); }
  getWorkUnitsTotal(): number { return this.workUnitsTotal; }

  getExtraInfo(): Array<{ colour: [number,number,number]; text: string }> {
    return this.alienSeason?.getExtraInfo() ?? [];
  }
}

class QuakeSeason {
  private rng: GameRandom;
  constructor(rng: GameRandom) { this.rng = rng; }
}

class StormSeason {
  private rng: GameRandom;
  constructor(rng: GameRandom) { this.rng = rng; }
}

class EarthquakeFaultLine {
  x1: number; y1: number; x2: number; y2: number;
  life = 1.0;
  alive = true;

  constructor(rng: GameRandom) {
    const [x1, y1] = gridToScr(rng.randint(0, 49), rng.randint(0, 49));
    const [x2, y2] = gridToScr(rng.randint(0, 49), rng.randint(0, 49));
    this.x1 = x1; this.y1 = y1; this.x2 = x2; this.y2 = y2;
  }

  update(dt: number): void { this.life -= dt * 2; if (this.life <= 0) this.alive = false; }

  draw(r: Renderer, offsetX: number): void {
    const alpha = Math.max(0, this.life);
    r.ctx.globalAlpha = alpha;
    r.line(this.x1 + offsetX, this.y1, this.x2 + offsetX, this.y2, [255, 200, 0], 2);
    r.ctx.globalAlpha = 1;
  }
}

class StormCloud {
  x: number; y: number; w: number; h: number;
  life = 1.0;
  alive = true;

  constructor(rng: GameRandom) {
    const cs = getCellSize();
    this.x = rng.randint(0, 49) * cs;
    this.y = rng.randint(0, 49) * cs;
    this.w = rng.randint(2, 5) * cs;
    this.h = rng.randint(1, 3) * cs;
  }

  update(dt: number): void { this.life -= dt * 1.5; if (this.life <= 0) this.alive = false; }

  draw(r: Renderer, offsetX: number): void {
    r.ctx.globalAlpha = Math.max(0, this.life) * 0.6;
    r.fillRect(this.x + offsetX, this.y, this.w, this.h, [200, 200, 255]);
    r.ctx.globalAlpha = 1;
  }
}
