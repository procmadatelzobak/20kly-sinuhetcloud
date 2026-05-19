// HUD — stats panel + control buttons (port of stats.py + ui.py controls)
import { Renderer, colourToCSS } from '../engine/render';
import { Network } from '../sim/network';
import { Node, CityNode, WellNode } from '../entities/node';
import { Pipe } from '../entities/pipe';
import { Item } from '../entities/item';
import { Building } from '../entities/node';
import { SeasonManager } from '../ai/seasons';
import { BarMeter, StatTuple, Colour, PRESSURE_DANGER, PRESSURE_WARNING, PRESSURE_OK, PRESSURE_GOOD, Difficulty, getDifficulty } from '../constants';
import { getImage } from '../assets/loader';
import { BuildMode } from '../engine/input';
import { drawMail } from './mail';

export interface Button {
  label: string;
  key: string;
  mode: BuildMode;
  icon?: string;
}

const BUTTONS: Button[] = [
  { label: 'Build Node', key: 'N', mode: 'BUILD_NODE', icon: 'node_u' },
  { label: 'Build Pipe', key: 'P', mode: 'BUILD_PIPE', icon: 'bricks' },
  { label: 'Destroy', key: 'D', mode: 'DESTROY', icon: 'destroy' },
  { label: 'Upgrade', key: 'U', mode: 'UPGRADE', icon: 'upgrade' },
  { label: 'Fast Fwd', key: 'F', mode: 'FAST_FORWARD', icon: 'fastforward' },
  { label: 'Menu', key: 'ESC', mode: 'OPEN_MENU', icon: 'menuicon' },
];

export class HUD {
  private x: number;
  private y: number;
  private w: number;
  private h: number;
  private sc: number; // scale factor (height / 600)
  buttonRects: Array<{ x: number; y: number; w: number; h: number; mode: BuildMode }> = [];

  constructor(x: number, y: number, w: number, h: number) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.sc = h / 600;
  }

  private sc_(v: number): number { return Math.round(v * this.sc); }

  draw(r: Renderer, net: Network, sm: SeasonManager, selected: Item | null, mode: BuildMode, difficulty: Difficulty, fastForward: boolean, muted: boolean): void {
    const { x, y, w, h } = this;
    const margin = this.sc_(10);
    const sc = this.sc;
    let curY = y + margin;

    // Background
    r.fillRect(x, y, w, h, [20, 20, 30]);

    // Header image
    const headerImg = getImage('headersm');
    if (headerImg && headerImg.complete) {
      const hh = Math.min(this.sc_(60), 80);
      const hw = Math.floor(headerImg.naturalWidth * hh / headerImg.naturalHeight);
      const hx = x + (w - hw) / 2;
      r.ctx.drawImage(headerImg, hx, curY, hw, hh);
      curY += hh + margin;
    }

    // Rivets texture strip
    const rivetsImg = getImage('rivets');
    if (rivetsImg && rivetsImg.complete) {
      const rh = this.sc_(8);
      r.withClip(x, curY, w, rh, () => r.imageTiled('rivets', x, curY, w, rh));
      curY += rh + margin;
    }

    // Selected entity stats
    const statsH = this.sc_(120);
    r.fillRect(x, curY, w, statsH, [10, 10, 20]);
    r.strokeRect(x, curY, w, statsH, [60, 60, 80]);
    if (selected) {
      this.drawStatTuples(r, x + margin, curY + margin, w - margin * 2, selected.getInformation(), sc);
    }
    curY += statsH + margin;

    // Rivets
    if (rivetsImg && rivetsImg.complete) {
      const rh = this.sc_(8);
      r.withClip(x, curY, w, rh, () => r.imageTiled('rivets', x, curY, w, rh));
      curY += rh + margin;
    }

    // Global stats
    const globalH = this.sc_(130);
    r.fillRect(x, curY, w, globalH, [10, 10, 20]);
    r.strokeRect(x, curY, w, globalH, [60, 60, 80]);
    this.drawGlobalStats(r, x + margin, curY + margin, w - margin * 2, net, sm, difficulty, sc);
    curY += globalH + margin;

    // Rivets
    if (rivetsImg && rivetsImg.complete) {
      const rh = this.sc_(8);
      r.withClip(x, curY, w, rh, () => r.imageTiled('rivets', x, curY, w, rh));
      curY += rh + margin;
    }

    // Control buttons
    const btnH = this.sc_(34);
    const btnW = w - margin * 2;
    this.buttonRects = [];

    for (const btn of BUTTONS) {
      const active = (btn.mode === mode) || (btn.mode === 'FAST_FORWARD' && fastForward);
      const bg: Colour = active ? [60, 100, 60] : [30, 30, 40];
      r.fillRect(x + margin, curY, btnW, btnH, bg);
      r.strokeRect(x + margin, curY, btnW, btnH, active ? [0, 200, 0] : [80, 80, 100]);

      // Icon
      const icon = btn.icon;
      if (icon) {
        const ico = getImage(icon);
        if (ico && ico.complete) {
          const iSize = Math.min(btnH - 4, 28);
          r.ctx.drawImage(ico, x + margin + 4, curY + (btnH - iSize) / 2, iSize, iSize);
        }
      }

      const fs = this.sc_(13);
      r.text(`[${btn.key}] ${btn.label}`, x + margin + btnH + 4, curY + (btnH - fs) / 2, fs, [220, 220, 220]);
      this.buttonRects.push({ x: x + margin, y: curY, w: btnW, h: btnH, mode: btn.mode });
      curY += btnH + 4;
    }

    // Mute indicator
    if (muted) {
      r.text('[ MUTED - press M ]', x + margin, curY + 4, this.sc_(11), [180, 80, 80]);
    }

    // Mail
    drawMail(r, x + margin, curY + this.sc_(20), this.sc_(12));
  }

  private drawStatTuples(r: Renderer, x: number, y: number, w: number, tuples: StatTuple[], sc: number): void {
    let dy = y;
    for (const t of tuples) {
      if (t.bar) {
        const bh = Math.round(6 * sc);
        r.bar(x, dy, w, bh, t.bar.current, t.bar.max, t.bar.currentColour, t.bar.maxColour);
        dy += bh + 2;
      } else if (t.text && t.colour && t.size) {
        const fs = Math.max(8, Math.round(t.size * sc));
        r.text(t.text, x, dy, fs, t.colour);
        dy += fs + 2;
      }
      if (dy > y + 100 * sc) break;
    }
  }

  private drawGlobalStats(r: Renderer, x: number, y: number, w: number, net: Network, sm: SeasonManager, difficulty: Difficulty, sc: number): void {
    const fs = Math.round(12 * sc);
    const fs2 = Math.round(14 * sc);
    const fss = Math.round(11 * sc);
    let dy = y;

    // Day + season
    r.text(`Day ${sm.getDayNumber()}`, x, dy, fs2, [200, 200, 100]);
    dy += fs2 + 2;
    const daysLeft = sm.getDaysUntilNextSeason();
    r.text(`${sm.getSeasonName()} season (${daysLeft}s left)`, x, dy, fss, [160, 160, 120]);
    dy += fss + 4;

    // Alien warnings
    for (const info of sm.getExtraInfo()) {
      r.text(info.text, x, dy, fss, info.colour);
      dy += fss + 2;
    }

    // Work units
    const diff = getDifficulty(difficulty);
    const avail = net.hub.getAvailWorkUnits();
    r.text(`Work units: ${avail}`, x, dy, fss, [180, 180, 100]);
    dy += fss + 4;

    // Supply vs demand
    const supply = net.hub.getSteamSupply();
    const demand = net.hub.getSteamDemand();
    const ratio = demand > 0 ? supply / demand : 0;
    const supColour: Colour = ratio >= 1 ? [0, 200, 0] : ratio >= 0.7 ? [200, 200, 0] : [255, 80, 0];
    r.text(`Supply: ${supply.toFixed(1)} / Demand: ${demand.toFixed(1)}`, x, dy, fss, supColour);
    dy += fss + 2;

    // City pressure bar
    const pressure = net.hub.getPressure();
    const capacity = net.hub.steam.getCapacity();
    const pColour: Colour = pressure >= PRESSURE_GOOD ? [0, 200, 0] : pressure >= PRESSURE_OK ? [200, 200, 0] : pressure >= PRESSURE_WARNING ? [255, 130, 0] : [255, 0, 0];
    r.text(`City pressure: ${pressure.toFixed(1)} P`, x, dy, fss, pColour);
    dy += fss + 2;
    const bh = Math.round(7 * sc);
    r.bar(x, dy, w, bh, pressure, capacity, pColour, [40, 40, 40]);
    dy += bh + 2;

    // City tech level
    r.text(`City: Level ${net.hub.techLevel} / ${diff.CITY_MAX_TECH_LEVEL}`, x, dy, fss, [200, 160, 60]);
  }

  hitTest(px: number, py: number): BuildMode | null {
    for (const btn of this.buttonRects) {
      if (px >= btn.x && px <= btn.x + btn.w && py >= btn.y && py <= btn.y + btn.h) {
        return btn.mode;
      }
    }
    return null;
  }
}
