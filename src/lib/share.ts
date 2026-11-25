// Monta a imagem de compartilhar (vertical, 1080×1920, boa para Status e Stories) num canvas.
// Três estilos: Pôster (pôster grande e estrelas), Ingresso (o filme num ingresso) e Só a review.
import { loadImage, proxiedPoster } from './api';
import { fd, STAR_PATH } from './format';
import type { RatedFilm } from './types';

export type CardStyle = 'poster' | 'ticket' | 'review';

// Pôster e logo ficam guardados depois da primeira vez: trocar o estilo ou abrir de novo não baixa outra vez
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

const SANS = 'Inter,-apple-system,BlinkMacSystemFont,"Helvetica Neue",Roboto,Arial,sans-serif';
const SERIF = '"Instrument Serif",Georgia,serif';
const W = 1080, H = 1920;

/** Garante que a Instrument Serif já carregou antes de desenhar (senão o canvas usa a reserva). */
const fontsReady = () => Promise.all([
  document.fonts?.load(`80px ${SERIF}`),
  document.fonts?.load(`italic 50px ${SERIF}`),
  document.fonts?.load(`600 30px ${SANS}`),
]).catch(() => null);

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

/** Cinco estrelas centralizadas; a última de meia é cortada ao meio de verdade. */
function drawStars(c: CanvasRenderingContext2D, cx: number, y: number, sz: number, s: number, on = '#f2c97f', off = 'rgba(251,243,226,.22)') {
  const gap = sz / 6, sx = cx - (5 * sz + 4 * gap) / 2, path = new Path2D(STAR_PATH);
  for (let i = 0; i < 5; i++) {
    const f = Math.max(0, Math.min(1, s - i));
    c.save(); c.translate(sx + i * (sz + gap), y); c.scale(sz / 24, sz / 24);
    c.fillStyle = off; c.fill(path);
    if (f > 0) { c.beginPath(); c.rect(0, 0, 24 * f, 24); c.clip(); c.fillStyle = on; c.fill(path); }
    c.restore();
  }
}

/** Pôster desenhado com cantos arredondados e sombra. */
function drawPoster(c: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, r: number) {
  c.save(); c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 70; c.shadowOffsetY = 30;
  roundRect(c, x, y, w, h, r); c.fillStyle = '#111'; c.fill(); c.restore();
  c.save(); roundRect(c, x, y, w, h, r); c.clip(); c.drawImage(img, x, y, w, h); c.restore();
}

/** Fundo: o pôster bem desfocado, escurecido, com a luz do facho vindo de cima. */
function background(c: CanvasRenderingContext2D, poster: HTMLImageElement | null) {
  c.fillStyle = '#0b0a0d'; c.fillRect(0, 0, W, H);
  if (poster) {
    const t = document.createElement('canvas'); t.width = 18; t.height = 27;
    t.getContext('2d')?.drawImage(poster, 0, 0, 18, 27);
    c.save(); c.globalAlpha = 0.65; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    const sc = Math.max(W / 18, H / 27) * 1.15;
    c.drawImage(t, (W - 18 * sc) / 2, (H - 27 * sc) / 2, 18 * sc, 27 * sc); c.restore();
  }
  let g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(11,10,13,.35)'); g.addColorStop(0.55, 'rgba(11,10,13,.72)'); g.addColorStop(1, 'rgba(11,10,13,.96)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  g = c.createRadialGradient(W * 0.3, 0, 0, W * 0.3, 0, W);
  g.addColorStop(0, 'rgba(255,248,230,.22)'); g.addColorStop(1, 'rgba(255,248,230,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}

/** Assinatura no pé: logo + "Lanterninha". */
function signature(c: CanvasRenderingContext2D, logo: HTMLImageElement | null) {
  const fy = H - 150;
  c.font = `400 52px ${SERIF}`;
  const tw = c.measureText('Lanterninha').width, lw = logo ? 64 : 0, total = lw + (logo ? 18 : 0) + tw, fx = (W - total) / 2;
  if (logo) { c.save(); roundRect(c, fx, fy, 64, 64, 15); c.clip(); c.drawImage(logo, fx, fy, 64, 64); c.restore(); }
  c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = '#fbf3e2';
  c.fillText('Lanterninha', fx + lw + (logo ? 18 : 0), fy + 34);
}

function posterCard(c: CanvasRenderingContext2D, h: RatedFilm, poster: HTMLImageElement | null) {
  // Só pôster, título, ano e estrelas (a review fica para os outros estilos)
  c.font = `400 96px ${SERIF}`; const titleLines = wrapText(c, h.t, 920, 2);
  const yearH = h.y ? 72 : 0;
  const rest = titleLines.length * 110 + yearH + 50 + 100;
  const ph = poster ? Math.min(1000, 1560 - rest - 90) : 0, pw = ph / 1.5;
  let y = 140 + (1560 - (rest + (poster ? ph + 90 : 0))) / 2;
  if (poster) { drawPoster(c, poster, (W - pw) / 2, y, pw, ph, 30); y += ph + 90; }
  c.textAlign = 'center'; c.textBaseline = 'top';
  c.fillStyle = '#fbf3e2'; c.font = `400 96px ${SERIF}`;
  titleLines.forEach((l) => { c.fillText(l, W / 2, y); y += 110; });
  // Folga abaixo do título para o ano não encostar nas letras que descem (g, p, q…)
  if (h.y) { y += 24; c.fillStyle = 'rgba(251,243,226,.7)'; c.font = `500 36px ${SANS}`; c.fillText(h.y, W / 2, y); y += 48; }
  y += 50;
  drawStars(c, W / 2, y, 84, h.s);
}

function ticketCard(c: CanvasRenderingContext2D, h: RatedFilm, poster: HTMLImageElement | null) {
  const tw = 880, th = 1240, ty = (H - th) / 2 - 60, cut = 760;
  // O ingresso é desenhado à parte para recortar os furos laterais
  const t = document.createElement('canvas'); t.width = tw; t.height = th;
  const k = t.getContext('2d'); if (!k) return;
  roundRect(k, 0, 0, tw, th, 36); k.fillStyle = '#fbf3e2'; k.fill();
  k.globalCompositeOperation = 'destination-out';
  [0, tw].forEach((x) => { k.beginPath(); k.arc(x, cut, 44, 0, Math.PI * 2); k.fill(); });
  k.globalCompositeOperation = 'source-over';
  k.setLineDash([18, 16]); k.strokeStyle = 'rgba(26,20,8,.25)'; k.lineWidth = 4;
  k.beginPath(); k.moveTo(70, cut); k.lineTo(tw - 70, cut); k.stroke(); k.setLineDash([]);

  if (poster) drawPoster(k, poster, 60, 60, 300, 450, 18);
  const rx = poster ? 400 : 60, rw = tw - rx - 60;
  k.textAlign = 'left'; k.textBaseline = 'top';
  k.fillStyle = 'rgba(26,20,8,.55)'; k.font = `600 28px ${SANS}`; k.fillText('ADMITE UM', rx, 70);
  k.fillStyle = '#1a1408'; k.font = `400 76px ${SERIF}`;
  let y = 120;
  wrapText(k, h.t, rw, 4).forEach((l) => { k.fillText(l, rx, y); y += 80; });
  k.fillStyle = 'rgba(26,20,8,.6)'; k.font = `500 32px ${SANS}`;
  if (h.y) k.fillText(h.y, rx, y + 10);
  const where = h.w === 'cine' ? (h.tk?.cine ? h.tk.cine : 'No cinema') : h.w === 'casa' ? 'Em casa' : '';
  const when = [where, h.d ? fd(h.d) : ''].filter(Boolean).join(' · ');
  if (when) { k.font = `500 30px ${SANS}`; wrapText(k, when, tw - 120, 1).forEach((l) => k.fillText(l, 60, 560)); }
  const note = (h.note || '').trim();
  if (note) { k.fillStyle = '#1a1408'; k.font = `italic 400 44px ${SERIF}`; wrapText(k, '“' + note + '”', tw - 120, 2).forEach((l, i) => k.fillText(l, 60, 620 + i * 52)); }
  drawStars(k, tw / 2, cut + 90, 96, h.s, '#c8902e', 'rgba(26,20,8,.14)');
  k.textAlign = 'center'; k.fillStyle = 'rgba(26,20,8,.55)'; k.font = `600 28px ${SANS}`;
  k.fillText('SUA NOTA', tw / 2, cut + 230);

  c.save(); c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 80; c.shadowOffsetY = 36;
  c.translate(W / 2, ty + th / 2); c.rotate(-0.03); c.drawImage(t, -tw / 2, -th / 2); c.restore();
}

function reviewCard(c: CanvasRenderingContext2D, h: RatedFilm) {
  const note = (h.note || '').trim() || h.t;
  c.font = `italic 400 84px ${SERIF}`; const lines = wrapText(c, '“' + note + '”', 900, 11);
  const block = lines.length * 98 + 80 + 84 + 60 + 80;
  let y = (H - 180 - block) / 2;
  c.textAlign = 'center'; c.textBaseline = 'top'; c.fillStyle = '#fbf3e2';
  lines.forEach((l) => { c.fillText(l, W / 2, y); y += 98; });
  y += 80;
  drawStars(c, W / 2, y, 72, h.s); y += 84 + 60;
  c.font = `400 60px ${SERIF}`; c.fillText(wrapText(c, h.t + (h.y ? ' (' + h.y + ')' : ''), 900, 1)[0], W / 2, y);
}

/** Gera a imagem (JPG) no estilo escolhido. */
export async function makeCard(h: RatedFilm, style: CardStyle): Promise<Blob | null> {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d'); if (!c) return null;
  const [poster, logo] = await Promise.all([h.img ? cached(proxiedPoster(h.img, 'w500'), true) : null, cached('/logo.svg'), fontsReady()]);
  background(c, poster);
  if (style === 'ticket') ticketCard(c, h, poster);
  else if (style === 'review') reviewCard(c, h);
  else posterCard(c, h, poster);
  signature(c, logo);
  // JPG: bem mais leve e rápido de gerar que PNG, e é o formato que o WhatsApp e o Instagram preferem
  return new Promise((resolve) => cv.toBlob(resolve, 'image/jpeg', 0.92));
}

export const cardFileName = (title: string) =>
  'lanterninha-' + title.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + '.jpg';
