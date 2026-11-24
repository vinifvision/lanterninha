// Estatísticas do ano ("2026 em filmes"): as contas a partir da lista de filmes e,
// para horas, gêneros, diretores e atores, os dados de cada filme no TMDB (guardados no aparelho).
import { useEffect, useState } from 'react';
import { cloud } from './cloud';
import { movieCredits, movieDetails, movieRatings } from './api';
import { isRated } from './films';
import type { Film, RatedFilm } from './types';

/** O que interessa de cada filme no TMDB, em formato curto para caber no aparelho. */
interface Facts {
  /** Duração em minutos */
  r: number;
  /** Gêneros */
  g: string[];
  /** Diretores [id, nome] */
  d: [number, string][];
  /** Elenco principal [id, nome] */
  a: [number, string][];
  /** Nota do público no TMDB, já de 0 a 5 (sem ela quando há poucos votos) */
  p?: number;
}

const KEY = 'lanterninha.fatos.v2';
// A v1 não tinha a nota do público: some para não ocupar espaço
try { localStorage.removeItem('lanterninha.fatos.v1'); } catch { /* ok */ }
const MAX = 1500;
let store: Record<string, Facts> | null = null;

function load(): Record<string, Facts> {
  if (store) return store;
  try { store = JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, Facts>; } catch { store = {}; }
  if (!store || typeof store !== 'object') store = {};
  return store;
}
function save() {
  const s = load();
  const keys = Object.keys(s);
  // Guarda no máximo MAX filmes: os mais antigos (primeiros gravados) saem
  if (keys.length > MAX) keys.slice(0, keys.length - MAX).forEach((k) => delete s[k]);
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* sem espaço: segue só na memória */ }
}

async function fetchFacts(id: number): Promise<Facts> {
  const [det, cred] = await Promise.all([movieDetails(id), movieCredits(id).catch(() => null)]);
  // A nota do público vem nos detalhes; enquanto o servidor novo não está no ar, pega na função de notas
  const vote = det.vote !== undefined ? det.vote : await movieRatings(id).then((r) => r.tmdb).catch(() => null);
  return {
    ...(vote != null ? { p: Math.round(vote * 5) / 10 } : {}),
    r: det.runtime || 0,
    g: det.genres,
    d: det.directors.map((p) => [p.id, p.name] as [number, string]),
    a: (cred?.cast || []).filter((p) => p.id).slice(0, 5).map((p) => [p.id!, p.name] as [number, string]),
  };
}

/**
 * Dados do TMDB para uma lista de filmes. Os que já estão no aparelho chegam na hora;
 * os outros são buscados de 6 em 6, e a tela vai se completando (done/total).
 */
export function useFacts(ids: number[]) {
  const key = ids.join(',');
  const [state, setState] = useState(() => ({ facts: pick(ids), done: 0 }));
  useEffect(() => {
    let alive = true;
    const s = load();
    const missing = ids.filter((id) => !s[id]);
    setState({ facts: pick(ids), done: ids.length - missing.length });
    if (!missing.length) return;
    let i = 0;
    let done = ids.length - missing.length;
    const worker = async () => {
      while (alive && i < missing.length) {
        const id = missing[i++];
        try { s[id] = await fetchFacts(id); } catch { /* fica sem esse filme */ }
        done++;
        if (alive && (done % 6 === 0 || done === ids.length)) setState({ facts: pick(ids), done });
      }
    };
    void Promise.all(Array.from({ length: 6 }, worker)).then(() => {
      save();
      if (alive) setState({ facts: pick(ids), done: ids.length });
    });
    return () => { alive = false; save(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { ...state, total: ids.length, loading: state.done < ids.length };
}
function pick(ids: number[]) {
  const s = load();
  const m = new Map<number, Facts>();
  ids.forEach((id) => s[id] && m.set(id, s[id]));
  return m;
}

/** Anos em que a pessoa tem algum filme no diário, do mais novo para o mais velho. */
export function diaryYears(films: Film[]): string[] {
  const ys = new Set<string>();
  films.forEach((h) => h.st !== 'want' && /^\d{4}/.test(h.d || '') && ys.add(h.d!.slice(0, 4)));
  return [...ys].sort((a, b) => b.localeCompare(a));
}

/** Os filmes vistos num ano (com nota e "Já vi"). */
export const filmsOfYear = (films: Film[], year: string) =>
  films.filter((h) => h.st !== 'want' && (h.d || '').startsWith(year));

export interface Rank<T = string | number> {
  key: T;
  label: string;
  /** Quantos filmes */
  n: number;
  films: Film[];
  /** Média das suas notas nesses filmes (0 se nenhum tem nota) */
  avg: number;
  /** Quantos têm nota */
  rated: number;
}
/** Os dois jeitos de ver um grupo: os mais vistos e os de maior nota média. */
export interface Ranks { seen: Rank[]; liked: Rank[] }

const avgOf = (films: Film[]) => {
  const r = films.filter(isRated);
  return r.length ? r.reduce((t, h) => t + h.s, 0) / r.length : 0;
};
const toRanks = <T,>(groups: Map<T, { label: string; films: Film[] }>): Rank<T>[] =>
  [...groups.entries()].map(([key, g]) => ({
    key, label: g.label, n: g.films.length, films: g.films, avg: avgOf(g.films), rated: g.films.filter(isRated).length,
  }));

/**
 * Mais vistos (mais filmes primeiro; empate pela ordem do nome) e Maior nota (média, só com 2 notas ou mais,
 * para um filme só não decidir). `min` = mínimo de filmes para entrar nos mais vistos.
 */
function ranks<T extends string | number>(groups: Map<T, { label: string; films: Film[] }>, top: number, min: number): Ranks {
  const all = toRanks(groups);
  return {
    seen: all.filter((r) => r.n >= min).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)).slice(0, top),
    liked: all.filter((r) => r.rated >= 2).sort((a, b) => b.avg - a.avg || b.rated - a.rated).slice(0, top),
  };
}
function add<T>(m: Map<T, { label: string; films: Film[] }>, key: T, label: string, h: Film) {
  const g = m.get(key);
  if (g) g.films.push(h);
  else m.set(key, { label, films: [h] });
}

export const NOTES = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

/** Tudo o que a tela do ano mostra, calculado de uma vez. */
export function yearStats(films: Film[], facts: Map<number, Facts>) {
  const rated = films.filter(isRated);
  const factOf = (h: Film) => (h.id ? facts.get(h.id) : undefined);

  const months: Film[][] = Array.from({ length: 12 }, () => []);
  films.forEach((h) => months[+h.d!.slice(5, 7) - 1]?.push(h));

  const notes: RatedFilm[][] = NOTES.map((s) => rated.filter((h) => h.s === s));
  let mode = -1;
  notes.forEach((l, i) => { if (l.length && (mode < 0 || l.length >= notes[mode].length)) mode = i; });

  const minutes = films.reduce((t, h) => t + (factOf(h)?.r || 0), 0);
  const avg = rated.length ? rated.reduce((t, h) => t + h.s, 0) / rated.length : 0;

  const genres = new Map<string, { label: string; films: Film[] }>();
  const directors = new Map<number, { label: string; films: Film[] }>();
  const actors = new Map<number, { label: string; films: Film[] }>();
  films.forEach((h) => {
    const f = factOf(h);
    if (!f) return;
    f.g.forEach((g) => add(genres, g, g, h));
    f.d.forEach(([id, name]) => add(directors, id, name, h));
    f.a.forEach(([id, name]) => add(actors, id, name, h));
  });

  const decades = new Map<string, { label: string; films: Film[] }>();
  films.forEach((h) => {
    if (!/^\d{4}$/.test(h.y || '')) return;
    const d = h.y!.slice(0, 3) + '0';
    add(decades, d, +d >= 2000 ? `Anos ${d}` : `Anos ${d.slice(2)}`, h);
  });

  const where = (['cine', 'casa', 'outro'] as const).map((w) => ({ key: w, films: films.filter((h) => h.w === w) }));

  // Do contra: onde a sua nota mais fugiu da do público (1 estrela ou mais de diferença)
  const vs = rated
    .filter((h) => factOf(h)?.p != null)
    .map((h) => ({ h, pub: factOf(h)!.p!, gap: h.s - factOf(h)!.p! }));
  const above = vs.filter((x) => x.gap >= 1).sort((a, b) => b.gap - a.gap).slice(0, 3);
  const below = vs.filter((x) => x.gap <= -1).sort((a, b) => a.gap - b.gap).slice(0, 3);

  const byDate = [...films].sort((a, b) => (a.d || '').localeCompare(b.d || '') || (a.ts || 0) - (b.ts || 0));
  const best = [...rated].sort((a, b) => b.s - a.s || (b.d || '').localeCompare(a.d || ''))[0];

  return {
    count: films.length,
    hours: Math.round(minutes / 60),
    reviews: films.filter((h) => (h.note || '').trim()).length,
    avg,
    months,
    notes,
    mode,
    genres: ranks(genres, 6, 1),
    // Diretor e ator só entram com 2 filmes ou mais (um filme só não diz muito)
    directors: ranks(directors, 5, 2),
    actors: ranks(actors, 5, 2),
    decades: toRanks(decades).sort((a, b) => String(b.key).localeCompare(String(a.key))),
    where,
    contra: { above, below, compared: vs.length },
    first: byDate[0],
    last: byDate[byDate.length - 1],
    best,
  };
}
export type YearStatsData = ReturnType<typeof yearStats>;

/**
 * Meta de filmes por ano. Fica no Supabase (tabela goals, só o dono lê) e uma cópia no aparelho,
 * para aparecer na hora e funcionar sem internet.
 */
const GOAL_KEY = 'lanterninha.meta.v1';
const readGoals = (): Record<string, number> => {
  try { return JSON.parse(localStorage.getItem(GOAL_KEY) || '{}') as Record<string, number>; } catch { return {}; }
};
const writeGoals = (g: Record<string, number>) => {
  try { localStorage.setItem(GOAL_KEY, JSON.stringify(g)); } catch { /* modo privado: segue sem a cópia */ }
};
const okGoal = (n: unknown) => (Number.isInteger(n) && (n as number) > 0 ? (n as number) : 0);

/** A meta de um ano e um jeito de mudar. Mostra a cópia do aparelho e confere a da nuvem logo depois. */
export function useGoal(year: string) {
  const [goal, setLocal] = useState(() => okGoal(readGoals()[year]));
  const [err, setErr] = useState('');
  useEffect(() => {
    let alive = true;
    void cloud.goals().then((remote) => {
      if (!alive || !remote) return;
      const local = okGoal(readGoals()[year]);
      const there = okGoal(remote[year]);
      if (there) {
        writeGoals({ ...readGoals(), [year]: there });
        setLocal(there);
      } else if (local) {
        // Meta criada antes de existir a nuvem: sobe agora
        void cloud.saveGoal(year, local);
      }
    });
    return () => { alive = false; };
  }, [year]);
  const save = async (n: number) => {
    const v = n > 0 ? Math.min(9999, Math.round(n)) : 0;
    const g = readGoals();
    if (v) g[year] = v;
    else delete g[year];
    writeGoals(g);
    setLocal(v);
    setErr(await cloud.saveGoal(year, v));
  };
  return { goal, save, err };
}

/** Como está a meta: quanto falta, se está no ritmo e com quantos filmes fecha o ano nesse ritmo. */
export function goalPace(year: string, count: number, goal: number, now = new Date()) {
  const y = +year;
  const start = new Date(y, 0, 1).getTime();
  const end = new Date(y + 1, 0, 1).getTime();
  const t = Math.min(end, Math.max(start, now.getTime()));
  const part = (t - start) / (end - start);
  const past = now.getFullYear() > y;
  const daysLeft = Math.max(0, Math.ceil((end - t) / 86400000));
  const left = Math.max(0, goal - count);
  return {
    past,
    done: count >= goal,
    left,
    /** Positivo: filmes à frente do ritmo; negativo: atrás */
    ahead: Math.round(count - goal * part),
    /** Com quantos filmes fecha o ano, mantendo o ritmo atual */
    projected: part > 0.02 ? Math.round(count / part) : 0,
    /** O que falta, em linguagem de gente: "4 filmes por semana", "1 filme a cada 10 dias" */
    need: needText(left, daysLeft),
  };
}

function needText(left: number, days: number): string {
  if (!left || !days) return '';
  const films = (n: number) => `${n} ${n === 1 ? 'filme' : 'filmes'}`;
  // Última semana do ano: não adianta falar em "por semana"
  if (days <= 7) return `${films(left)} até o fim do ano`;
  const perWeek = left / (days / 7);
  if (perWeek >= 1) return `${films(Math.ceil(perWeek))} por semana`;
  return `1 filme a cada ${Math.floor(days / left)} dias`;
}
