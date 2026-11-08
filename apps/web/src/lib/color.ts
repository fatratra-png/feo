import { coverUrl } from './api';

export const DEFAULT_ACCENT = '#9b8cff';

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

const hsl = (h: number, s: number, l: number) => `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;

/**
 * Picks the most "characterful" hue of an image: pixels are bucketed by hue
 * and weighted by saturation, so a small vivid area beats a large grey one.
 * The result is clamped into a range that stays readable on the dark UI.
 */
export function pickAccent(data: Uint8ClampedArray): { accent: string; onAccent: string } | null {
  const buckets = new Array(36).fill(0).map(() => ({ w: 0, s: 0, l: 0 }));
  for (let i = 0; i < data.length; i += 4) {
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    if (l < 0.12 || l > 0.92 || s < 0.18) continue;
    const w = s * s * (1 - Math.abs(l - 0.5));
    const b = buckets[Math.floor(h / 10) % 36];
    b.w += w; b.s += s * w; b.l += l * w;
  }
  let best = -1;
  let bestW = 0;
  buckets.forEach((b, i) => { if (b.w > bestW) { bestW = b.w; best = i; } });
  if (best < 0 || bestW < 0.6) return null;
  const b = buckets[best];
  const h = best * 10 + 5;
  const s = Math.min(0.88, Math.max(0.55, b.s / b.w));
  const l = Math.min(0.68, Math.max(0.58, b.l / b.w));
  // Blue/violet hues look darker at equal lightness: lift them a little.
  const lift = h > 200 && h < 290 ? 0.06 : 0;
  return { accent: hsl(h, s, l + lift), onAccent: '#0b0b10' };
}

const cache = new Map<string, Promise<{ accent: string; onAccent: string } | null>>();

export function extractAccent(songId: string) {
  let p = cache.get(songId);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 36; canvas.height = 36;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return resolve(null);
          // Crop the 16:9 thumbnail to its centre square, like the UI does.
          const side = Math.min(img.width, img.height);
          ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 36, 36);
          resolve(pickAccent(ctx.getImageData(0, 0, 36, 36).data));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = coverUrl(songId);
    });
    cache.set(songId, p);
  }
  return p;
}
