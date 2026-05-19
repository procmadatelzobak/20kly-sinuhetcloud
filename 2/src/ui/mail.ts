// Mail/notification system — port of mail.py
interface MailEntry { text: string; age: number; maxAge: number; colour: [number,number,number]; }

const messages: MailEntry[] = [];

export function addMail(text: string, colour: [number,number,number] = [255,255,128]): void {
  messages.push({ text, age: 0, maxAge: 3.0, colour });
  if (messages.length > 8) messages.shift();
}

export function advanceMail(dt: number): void {
  for (let i = messages.length - 1; i >= 0; i--) {
    messages[i].age += dt;
    if (messages[i].age >= messages[i].maxAge) messages.splice(i, 1);
  }
}

import { Renderer } from '../engine/render';

export function drawMail(r: Renderer, x: number, y: number, fontSize: number): void {
  let dy = y;
  for (const m of messages) {
    const alpha = Math.max(0, 1 - (m.age / m.maxAge) * 0.7);
    r.ctx.globalAlpha = alpha;
    r.text(m.text, x, dy, fontSize, m.colour);
    r.ctx.globalAlpha = 1;
    dy += fontSize + 2;
  }
}
