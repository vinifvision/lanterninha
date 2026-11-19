// Monta a imagem de compartilhar (pôster, nome, estrelas, review) num canvas.
import { loadImage, proxiedPoster } from './api';
import { fmt, LABELS, STAR_PATH } from './format';
import type { RatedFilm } from './types';

// Pôster e logo ficam guardados depois da primeira vez: trocar Post/Story ou abrir de novo não baixa outra vez
const images = new Map<string, Promise<HTMLImageElement | null>>();
const cached = (src: string, cross = false) => {
  let p = images.get(src);
  if (!p) {
    p = loadImage(src, cross).then((img) => { if (!img) images.delete(src); return img; });
    images.set(src, p);
  }
  return p;
};
/** Começa a baixar o pôster antes de a pessoa tocar em Compartilhar (a página do filme chama isto). */
export function preloadCard(h: { img?: string | null }) {
  if (h.img) void cached(proxiedPoster(h.img, 'w500'), true);
  void cached('/logo.svg');
}

const FONT = '-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue",Inter,Roboto,Arial,sans-serif';

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/), lines: string[] = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width <= maxW || !line) line = t;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let l = lines[maxLines - 1];
    while (l.length > 1 && ctx.measureText(l + '…').width > maxW) l = l.slice(0, -1);
    lines[maxLines - 1] = l.replace(/[\s,.;:]+$/, '') + '…';
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Gera a imagem (JPG). `story` = formato vertical de tela cheia; senão, formato de post. */
export async function makeCard(h: RatedFilm, story: boolean): Promise<Blob | null> {
  const W = 1080, H = story ? 1920 : 1350;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d'); if (!c) return null;
  const [poster, logo] = await Promise.all([h.img ? cached(proxiedPoster(h.img, 'w500'), true) : null, cached('/logo.svg')]);

  c.fillStyle = '#0b0a0d'; c.fillRect(0, 0, W, H);
  if (poster) { // fundo: o pôster bem desfocado (reduz e amplia; funciona em qualquer navegador)
    const t = document.createElement('canvas'); t.width = 18; t.height = 27;
    t.getContext('2d')?.drawImage(poster, 0, 0, 18, 27);
    c.save(); c.globalAlpha = 0.6; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    const sc = Math.max(W / 18, H / 27) * 1.15;
    c.drawImage(t, (W - 18 * sc) / 2, (H - 27 * sc) / 2, 18 * sc, 27 * sc); c.restore();
  }
  let g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(10,10,12,.45)'); g.addColorStop(0.55, 'rgba(10,10,12,.78)'); g.addColorStop(1, 'rgba(10,10,12,.97)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  g = c.createRadialGradient(W * 0.3, 0, 0, W * 0.3, 0, W);
  g.addColorStop(0, 'rgba(242,201,127,.20)'); g.addColorStop(1, 'rgba(242,201,127,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);

  const note = (h.note || '').trim(), fy = H - (story ? 190 : 120), top = story ? 150 : 70, avail = fy - 50 - top;
  c.font = `700 66px ${FONT}`; const titleLines = wrapText(c, h.t, 900, 2);
  c.font = `400 40px ${FONT}`; const noteLines = note ? wrapText(c, '“' + note + '”', 880, story ? 6 : 3) : [];
  const sub = [h.o && h.o !== h.t ? h.o : '', h.y || ''].filter(Boolean).join(' · ');
  const rest = titleLines.length * 78 + (sub ? 56 : 10) + 50 + 96 + 26 + 52 + (noteLines.length ? 44 + noteLines.length * 58 : 0);
  // o pôster ocupa o espaço que sobrar, até um tamanho máximo
  const ph = poster ? Math.min(story ? 810 : 660, avail - rest - 70) : 0, pw = ph / 1.5;
  let y = top + (avail - (rest + (poster ? ph + 70 : 0))) / 2;

  if (poster) {
    const x = (W - pw) / 2;
    c.save(); c.shadowColor = 'rgba(0,0,0,.65)'; c.shadowBlur = 70; c.shadowOffsetY = 30;
    roundRect(c, x, y, pw, ph, 30); c.fillStyle = '#111'; c.fill(); c.restore();
    c.save(); roundRect(c, x, y, pw, ph, 30); c.clip(); c.drawImage(poster, x, y, pw, ph); c.restore();
    y += ph + 70;
  }
  c.textAlign = 'center'; c.textBaseline = 'top';
  c.fillStyle = '#f4eee3'; c.font = `700 66px ${FONT}`;
  titleLines.forEach((l) => { c.fillText(l, W / 2, y); y += 78; });
  if (sub) { c.fillStyle = '#a1a1a8'; c.font = `400 36px ${FONT}`; c.fillText(wrapText(c, sub, 900, 1)[0], W / 2, y + 6); y += 56; } else y += 10;
  y += 50;

  const sz = 96, gap = 16, sx = (W - (5 * sz + 4 * gap)) / 2, path = new Path2D(STAR_PATH);
  for (let i = 0; i < 5; i++) {
    const x = sx + i * (sz + gap), f = Math.max(0, Math.min(1, h.s - i));
    c.save(); c.translate(x, y); c.scale(sz / 24, sz / 24);
    c.fillStyle = 'rgba(255,255,255,.16)'; c.fill(path);
    if (f > 0) { c.beginPath(); c.rect(0, 0, 24 * f, 24); c.clip(); c.fillStyle = '#f2c97f'; c.fill(path); }
    c.restore();
  }
  y += sz + 26;
  c.fillStyle = '#f2c97f'; c.font = `600 44px ${FONT}`; c.fillText(fmt(h.s) + '  ·  ' + LABELS[h.s], W / 2, y); y += 52;
  if (noteLines.length) { y += 44; c.fillStyle = '#e9e9ee'; c.font = `400 40px ${FONT}`; noteLines.forEach((l) => { c.fillText(l, W / 2, y); y += 58; }); }

  // assinatura
  c.font = `600 38px ${FONT}`;
  const tw = c.measureText('Lanterninha').width, lw = logo ? 64 : 0, total = lw + (logo ? 18 : 0) + tw, fx = (W - total) / 2;
  if (logo) { c.save(); roundRect(c, fx, fy, 64, 64, 15); c.clip(); c.drawImage(logo, fx, fy, 64, 64); c.restore(); }
  c.textAlign = 'left'; c.fillStyle = 'rgba(245,245,247,.9)'; c.fillText('Lanterninha', fx + lw + (logo ? 18 : 0), fy + 12);
  // JPG: bem mais leve e rápido de gerar que PNG, e é o formato que o WhatsApp e o Instagram preferem
  return new Promise((resolve) => cv.toBlob(resolve, 'image/jpeg', 0.92));
}

export const cardFileName = (title: string) =>
  'lanterninha-' + title.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + '.jpg';
