// Canvas2D rendering helpers
import { Colour } from '../constants';
import { getImage } from '../assets/loader';

export function colourToCSS(c: Colour, alpha = 1): string {
  return alpha < 1
    ? `rgba(${c[0]},${c[1]},${c[2]},${alpha})`
    : `rgb(${c[0]},${c[1]},${c[2]})`;
}

export class Renderer {
  ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) { this.ctx = ctx; }

  clear(w: number, h: number): void {
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, w, h);
  }

  fillRect(x: number, y: number, w: number, h: number, colour: Colour | string): void {
    this.ctx.fillStyle = typeof colour === 'string' ? colour : colourToCSS(colour);
    this.ctx.fillRect(x, y, w, h);
  }

  strokeRect(x: number, y: number, w: number, h: number, colour: Colour, lineWidth = 1): void {
    this.ctx.strokeStyle = colourToCSS(colour);
    this.ctx.lineWidth = lineWidth;
    this.ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  }

  line(x1: number, y1: number, x2: number, y2: number, colour: Colour, width = 1): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.strokeStyle = colourToCSS(colour);
    this.ctx.lineWidth = width;
    this.ctx.stroke();
  }

  circle(cx: number, cy: number, r: number, fillColour?: Colour | null, strokeColour?: Colour | null, lineWidth = 1): void {
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (fillColour) { this.ctx.fillStyle = colourToCSS(fillColour); this.ctx.fill(); }
    if (strokeColour) { this.ctx.strokeStyle = colourToCSS(strokeColour); this.ctx.lineWidth = lineWidth; this.ctx.stroke(); }
  }

  polygon(points: [number, number][], fillColour?: Colour | null, strokeColour?: Colour | null, lineWidth = 1): void {
    if (points.length < 2) return;
    this.ctx.beginPath();
    this.ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) this.ctx.lineTo(points[i][0], points[i][1]);
    this.ctx.closePath();
    if (fillColour) { this.ctx.fillStyle = colourToCSS(fillColour); this.ctx.fill(); }
    if (strokeColour) { this.ctx.strokeStyle = colourToCSS(strokeColour); this.ctx.lineWidth = lineWidth; this.ctx.stroke(); }
  }

  text(str: string, x: number, y: number, size: number, colour: Colour, align: CanvasTextAlign = 'left'): void {
    this.ctx.fillStyle = colourToCSS(colour);
    this.ctx.font = `${size}px "DejaVu Sans", sans-serif`;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(str, x, y);
  }

  textCentered(str: string, x: number, y: number, size: number, colour: Colour): void {
    this.text(str, x, y, size, colour, 'center');
  }

  image(key: string, dx: number, dy: number, dw: number, dh: number, tintColour?: Colour): void {
    const img = getImage(key);
    if (!img || !img.complete || img.naturalWidth === 0) return;
    if (tintColour) {
      // Draw tinted via offscreen canvas
      const oc = document.createElement('canvas');
      oc.width = img.naturalWidth; oc.height = img.naturalHeight;
      const octx = oc.getContext('2d')!;
      octx.drawImage(img, 0, 0);
      octx.globalCompositeOperation = 'source-atop';
      const brightness = tintColour[0] / 255;
      octx.fillStyle = `rgba(${tintColour[0]},${tintColour[1]},${tintColour[2]},${1 - brightness})`;
      octx.fillRect(0, 0, img.naturalWidth, img.naturalHeight);
      this.ctx.drawImage(oc, dx, dy, dw, dh);
    } else {
      this.ctx.drawImage(img, dx, dy, dw, dh);
    }
  }

  imageTiled(key: string, x: number, y: number, w: number, h: number): void {
    const img = getImage(key);
    if (!img || !img.complete) return;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    if (iw === 0 || ih === 0) return;
    for (let ty = y; ty < y + h; ty += ih) {
      for (let tx = x; tx < x + w; tx += iw) {
        this.ctx.drawImage(img, tx, ty, Math.min(iw, x + w - tx), Math.min(ih, y + h - ty));
      }
    }
  }

  imageRotated(key: string, cx: number, cy: number, w: number, h: number, angleDeg: number, flipH = false): void {
    const img = getImage(key);
    if (!img || !img.complete) return;
    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate((angleDeg * Math.PI) / 180);
    if (flipH) this.ctx.scale(-1, 1);
    this.ctx.drawImage(img, -w / 2, -h / 2, w, h);
    this.ctx.restore();
  }

  bar(x: number, y: number, w: number, h: number, current: number, max: number, fillColour: Colour, bgColour: Colour): void {
    const frac = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    this.ctx.fillStyle = colourToCSS(bgColour);
    this.ctx.fillRect(x, y, w, h);
    this.ctx.fillStyle = colourToCSS(fillColour);
    this.ctx.fillRect(x, y, Math.floor(w * frac), h);
  }

  withClip(x: number, y: number, w: number, h: number, fn: () => void): void {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(x, y, w, h);
    this.ctx.clip();
    fn();
    this.ctx.restore();
  }
}
