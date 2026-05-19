// Asset loading — images and audio
import { ASSET_MAP, SOUND_MAP } from '../constants';

const images = new Map<string, HTMLImageElement>();
const audioBuffers = new Map<string, AudioBuffer>();
let audioCtx: AudioContext | null = null;
let muted = false;

function getDataPath(filename: string): string {
  // Vite base is '/2/', assets are in public/data/
  return `data/${filename}`;
}

export async function loadAll(onProgress?: (pct: number) => void): Promise<void> {
  const imgKeys = Object.keys(ASSET_MAP);
  const sndKeys = Object.keys(SOUND_MAP);
  const total = imgKeys.length + sndKeys.length;
  let done = 0;

  const report = () => { if (onProgress) onProgress(Math.round((done / total) * 100)); };

  // Load images
  await Promise.all(imgKeys.map(async (key) => {
    const filename = ASSET_MAP[key];
    const img = new Image();
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve(); // continue even if missing
      img.src = getDataPath(filename);
    });
    images.set(key, img);
    done++;
    report();
  }));

  // Load audio (non-blocking — fail gracefully)
  try {
    audioCtx = new AudioContext();
    await Promise.all(sndKeys.map(async (key) => {
      const filename = SOUND_MAP[key];
      try {
        const resp = await fetch(getDataPath(filename));
        if (resp.ok) {
          const buf = await resp.arrayBuffer();
          const decoded = await audioCtx!.decodeAudioData(buf);
          audioBuffers.set(key, decoded);
        }
      } catch { /* ignore missing sounds */ }
      done++;
      report();
    }));
  } catch {
    done += sndKeys.length;
    report();
  }
}

export function getImage(key: string): HTMLImageElement | null {
  return images.get(key) ?? null;
}

export function playSound(key: string): void {
  if (muted || !audioCtx || !audioBuffers.has(key)) return;
  try {
    const src = audioCtx.createBufferSource();
    src.buffer = audioBuffers.get(key)!;
    src.connect(audioCtx.destination);
    src.start();
  } catch { /* ignore */ }
}

export function setMuted(m: boolean): void { muted = m; }
export function isMuted(): boolean { return muted; }

export function resumeAudio(): void {
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
