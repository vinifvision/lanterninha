// Tira do pôster uma cor viva para tingir o fundo da página do filme.
import { loadImage, proxiedPoster } from './api';
import { films } from './films';
import type { Film } from './types';

export function setTint(hex: string | null) {
  const st = document.body.style;
  if (!hex) {
    st.removeProperty('--glow'); st.removeProperty('--wash');
    document.body.classList.remove('tinted');
    return;
  }
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  st.setProperty('--glow', `rgba(${r},${g},${b},.5)`);
  st.setProperty('--wash', `rgba(${r},${g},${b},.26)`);
  document.body.classList.add('tinted');
}

const memory = new Map<string, string | null>();

/** Calcula a cor de um pôster. Se `film` for da lista, guarda nele para não recalcular. */
export async function posterColor(img: string, film?: Film | null): Promise<string | null> {
  if (film?.col) return film.col;
  if (!img) return null;
  if (memory.has(img)) return memory.get(img) ?? null;
  const im = await loadImage(proxiedPoster(img, 'w342'), true);
  if (!im) return null;
  let out: string | null = null;
  try {
    const cv = document.createElement('canvas'); cv.width = 24; cv.height = 36;
    const c = cv.getContext('2d'); if (!c) return null;
    c.drawImage(im, 0, 0, 24, 36);
    const d = c.getImageData(0, 0, 24, 36).data;
    // Média dando mais peso aos pontos mais saturados e claros
    let R = 0, G = 0, B = 0, W = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const sat = mx ? (mx - mn) / mx : 0, w = sat * sat * (mx / 255) + 0.002;
      R += r * w; G += g * w; B += b * w; W += w;
    }
    const r = R / W / 255, g = G / W / 255, b = B / W / 255;
    // Para HSL, força a cor a ficar viva (saturação alta, brilho médio) e volta para RGB
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dl = mx - mn;
    let hue = 0, l = (mx + mn) / 2, sat = dl ? dl / (1 - Math.abs(2 * l - 1)) : 0;
    if (dl) { hue = mx === r ? ((g - b) / dl) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4; hue *= 60; if (hue < 0) hue += 360; }
    if (sat >= 0.12) { // pôster quase sem cor mantém o dourado do app
      sat = Math.max(sat, 0.72); l = Math.min(0.58, Math.max(0.48, l));
      const C = (1 - Math.abs(2 * l - 1)) * sat, X = C * (1 - Math.abs(((hue / 60) % 2) - 1)), m = l - C / 2;
      const [r1, g1, b1] = [[C, X, 0], [X, C, 0], [0, C, X], [0, X, C], [X, 0, C], [C, 0, X]][Math.floor(hue / 60) % 6];
      out = '#' + [r1, g1, b1].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
    }
  } catch {
    out = null;
  }
  memory.set(img, out);
  if (out && film) { film.col = out; films.save(); }
  return out;
}
