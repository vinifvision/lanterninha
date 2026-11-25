// Guarda os filmes no aparelho (localStorage) e avisa a interface quando algo muda.
import { useSyncExternalStore } from 'react';
import { POSTER_PATH, today, UUID } from './format';
import type { Film, FilmInfo, FilmState, RatedFilm, Ticket } from './types';

const KEY = 'notaFilmeV2';

/** Deixa passar só o que está no formato esperado. Tudo que entra no app (aparelho, nuvem, backup) passa por aqui. */
export function cleanFilm(x: unknown): Film | null {
  const r = x as Record<string, unknown> | null;
  if (!r || typeof r.t !== 'string' || !r.t.trim()) return null;
  const st: FilmState | '' = r.st === 'want' || r.st === 'seen' ? r.st : '';
  const s = Math.round(Number(r.s) * 2) / 2;
  if (!st && !(s >= 0.5 && s <= 5)) return null;
  const e: Film = st ? { t: r.t.trim().slice(0, 120), st, c: !!r.c } : { t: r.t.trim().slice(0, 120), s, c: !!r.c };
  if (st && typeof r.by === 'string' && r.by.trim()) e.by = r.by.trim().slice(0, 44);
  if (Number.isInteger(r.id)) e.id = r.id as number;
  if (typeof r.y === 'string' && /^\d{4}$/.test(r.y)) e.y = r.y;
  if (typeof r.o === 'string') e.o = r.o.slice(0, 160);
  if (typeof r.img === 'string' && POSTER_PATH.test(r.img)) e.img = r.img;
  if (typeof r.p === 'number' && r.p >= 0.5 && r.p <= 5) e.p = r.p;
  if (Number.isInteger(r.n) && (r.n as number) > 1) e.n = r.n as number;
  if (typeof r.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.d)) e.d = r.d;
  if (typeof r.col === 'string' && /^#[0-9a-f]{6}$/.test(r.col)) e.col = r.col;
  if (typeof r.ts === 'number' && r.ts > 0) e.ts = Math.round(r.ts);
  if (typeof r.note === 'string' && r.note.trim()) e.note = r.note.trim().slice(0, 5000);
  if (e.note && r.sp === true) e.sp = true;
  if (r.w === 'cine' || r.w === 'casa' || r.w === 'outro') e.w = r.w;
  if (e.w === 'cine' && r.tk && typeof r.tk === 'object') {
    const t = r.tk as Record<string, unknown>, tk: Ticket = {};
    if (typeof t.cine === 'string' && t.cine.trim()) tk.cine = t.cine.trim().slice(0, 60);
    if (Array.isArray(t.with)) {
      const w = t.with.filter((x): x is string => typeof x === 'string' && UUID.test(x)).slice(0, 12);
      if (w.length) tk.with = w;
    }
    if (tk.cine || tk.with) e.tk = tk;
  }
  if (Array.isArray(r.com)) {
    const com = r.com.filter((x): x is string => typeof x === 'string' && UUID.test(x)).slice(0, 12);
    if (com.length) e.com = com;
  }
  return e;
}

/** Chave única de um filme: pelo id do TMDB quando existe, senão pelo título. */
export const fkey = (h: FilmInfo) => (h.id ? 'm' + h.id : 't:' + h.t.toLowerCase());
export const isRated = (h: Film | null | undefined): h is RatedFilm => !!h && !h.st && typeof h.s === 'number';
export const toInfo = (h: FilmInfo): FilmInfo => ({ id: h.id || null, t: h.t, y: h.y || '', o: h.o || '', img: h.img || '' });

/** Impressão digital do conteúdo de um filme, para saber o que mudou desde a última sincronização. */
export function fhash(h: Film): string {
  const j = JSON.stringify(cleanFilm(h) || h);
  let x = 5381;
  for (let i = 0; i < j.length; i++) x = ((x << 5) + x + j.charCodeAt(i)) | 0;
  return x + ':' + j.length;
}

function load(): Film[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]') as unknown[];
    const list = (Array.isArray(raw) ? raw : []).map(cleanFilm).filter((f): f is Film => !!f);
    list.forEach((h, i) => { if (!h.ts) h.ts = Date.now() - i * 1000; });
    return list;
  } catch {
    return [];
  }
}

let hist: Film[] = load();
let version = 0;
const listeners = new Set<() => void>();
let onLocalChange: (() => void) | null = null;

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(hist)); } catch { /* sem espaço ou modo privado: segue só na memória */ }
}
function emit() {
  version++;
  listeners.forEach((l) => l());
}

export const films = {
  get all(): Film[] { return hist; },
  rated(): RatedFilm[] { return hist.filter(isRated); },
  find(info: FilmInfo): Film | null { const k = fkey(info); return hist.find((h) => fkey(h) === k) || null; },

  /** Chamar depois de mexer em um filme: grava, redesenha e agenda o envio para a nuvem. */
  save() { persist(); emit(); onLocalChange?.(); },

  /** Troca a lista inteira sem agendar envio (usado pela sincronização e pelo sair da conta). */
  replaceAll(list: Film[]) { hist = list; persist(); emit(); },

  remove(film: Film) { hist = hist.filter((h) => h !== film); films.save(); },

  /** Coloca um filme avaliado no topo, substituindo o registro anterior do mesmo filme. */
  putRated(entry: RatedFilm): Film | null {
    const k = fkey(entry);
    const replaced = hist.find((h) => fkey(h) === k) || null;
    hist = hist.filter((h) => h !== replaced);
    hist.unshift(entry);
    films.save();
    return replaced;
  },

  /** Desfaz um `putRated` (quando a pessoa volta da tela do resultado). */
  undoRated(entry: Film, replaced: Film | null) {
    hist = hist.filter((h) => h !== entry);
    if (replaced) hist.unshift(replaced);
    films.save();
  },

  /** Cria ou atualiza um filme sem nota. Nunca rebaixa um filme já avaliado. */
  setStatus(info: FilmInfo, st: FilmState, by?: string): Film {
    const cur = films.find(info);
    if (cur && !cur.st) return cur;
    const e: Film = { t: info.t, st, c: false, ts: Date.now() };
    if (info.id) { e.id = info.id; if (info.y) e.y = info.y; if (info.o) e.o = info.o; if (info.img) e.img = info.img; }
    if (st === 'seen') e.d = cur?.d || today();
    if (st === 'want') { const b = by || cur?.by; if (b) e.by = b; }
    hist = hist.filter((h) => h !== cur);
    hist.unshift(e);
    films.save();
    return e;
  },

  /** O amigo confirmou que viu junto: o filme entra como visto no cinema (a nota, se houver, fica como está). */
  fromTag(info: FilmInfo, cine: string, seen: string): Film {
    let cur = films.find(info);
    if (!cur || cur.st === 'want') {
      const e: Film = { t: info.t, st: 'seen', c: false, ts: Date.now() };
      if (info.id) { e.id = info.id; if (info.y) e.y = info.y; if (info.o) e.o = info.o; if (info.img) e.img = info.img; }
      const old = cur;
      hist = hist.filter((h) => h !== old);
      hist.unshift(e);
      cur = e;
    }
    cur.w = 'cine';
    if (cine && !cur.tk?.cine) cur.tk = { ...cur.tk, cine };
    if (seen && !cur.d) cur.d = seen;
    films.save();
    return cur;
  },

  /** Junta um backup aos filmes atuais. Devolve quantos entraram e quantos foram atualizados. */
  merge(incoming: Film[]): { added: number; updated: number } {
    let added = 0, updated = 0;
    incoming.slice().reverse().forEach((f) => {
      if (!f.ts) f.ts = Date.now();
      const i = hist.findIndex((h) => fkey(h) === fkey(f));
      if (i >= 0) { hist[i] = f; updated++; } else { hist.unshift(f); added++; }
    });
    films.save();
    return { added, updated };
  },

  setLocalChangeHandler(fn: () => void) { onLocalChange = fn; },
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
};

/** Hook: devolve a lista de filmes e redesenha o componente quando ela muda. */
export function useFilms(): Film[] {
  useSyncExternalStore(films.subscribe, () => version);
  return hist;
}
