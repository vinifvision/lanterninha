// Conversa com as funções em /api (que por sua vez falam com o TMDB usando a chave guardada no servidor).
import { API_BASE, IMG, SITE_URL } from './config';
import { POSTER_PATH } from './format';
import type { MovieDetails, SearchResult } from './types';

export const posterUrl = (path: string, size: 'w92' | 'w185' | 'w342' | 'w500' | 'w780' | 'h632' = 'w185') => IMG + size + path;
/** Pôster servido pelo próprio site, para poder ser desenhado na imagem de compartilhar. */
export const proxiedPoster = (path: string, size: 'w342' | 'w500' = 'w500') =>
  `${API_BASE}api/img?size=${size}&path=${encodeURIComponent(path)}`;

/** Confere e limpa uma lista de filmes vinda das funções do servidor. */
function cleanResults(data: { results?: unknown[] }): SearchResult[] {
  return (data.results || [])
    .map((x) => x as Record<string, unknown>)
    .filter((m) => m && Number.isInteger(m.id) && typeof m.title === 'string')
    .map((m) => ({
      id: m.id as number,
      title: m.title as string,
      original: typeof m.original === 'string' ? m.original : '',
      year: typeof m.year === 'string' && /^\d{4}$/.test(m.year) ? m.year : '',
      poster: typeof m.poster === 'string' && POSTER_PATH.test(m.poster) ? m.poster : '',
    }));
}

export async function searchMovies(q: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const r = await fetch(`${API_BASE}api/search?q=${encodeURIComponent(q)}`, { signal });
  if (!r.ok) throw new Error('busca indisponível');
  return cleanResults(await r.json());
}

export type DiscoverList = 'now' | 'trending' | 'classics' | 'similar';
const discoverCache = new Map<string, Promise<SearchResult[]>>();

/** Listas da tela Início (em cartaz, em alta, clássicos, parecidos com um filme). Guardadas enquanto o app está aberto. */
export function discover(list: DiscoverList, id?: number): Promise<SearchResult[]> {
  const key = list + (id ? ':' + id : '');
  let p = discoverCache.get(key);
  if (!p) {
    p = fetch(`${API_BASE}api/discover?list=${list}${id ? '&id=' + id : ''}`)
      .then((r) => { if (!r.ok) throw new Error('lista indisponível'); return r.json(); })
      .then(cleanResults);
    discoverCache.set(key, p);
    p.catch(() => discoverCache.delete(key));
  }
  return p;
}

export type Mood = 'chorar' | 'rir' | 'br' | 'curto';
/** Explorar por clima (aba Buscar): listas do TMDB por gênero, país e duração. Guardadas enquanto o app está aberto. */
export function moodFilms(m: Mood): Promise<SearchResult[]> {
  const key = 'mood:' + m;
  let p = discoverCache.get(key);
  if (!p) {
    p = fetch(`${API_BASE}api/discover?list=mood&m=${m}`)
      .then((r) => { if (!r.ok) throw new Error('lista indisponível'); return r.json(); })
      .then(cleanResults);
    discoverCache.set(key, p);
    p.catch(() => discoverCache.delete(key));
  }
  return p;
}

const detailsCache = new Map<number, Promise<MovieDetails>>();

export function movieDetails(id: number): Promise<MovieDetails> {
  let p = detailsCache.get(id);
  if (!p) {
    p = (async () => {
      const r = await fetch(`${API_BASE}api/movie?id=${id}`);
      if (!r.ok) throw new Error('detalhes indisponíveis');
      const m = (await r.json()) as Partial<MovieDetails>;
      const people = (list: unknown) =>
        (Array.isArray(list) ? list : [])
          .map((x) => x as { name?: unknown; logo?: unknown })
          .filter((x) => typeof x.name === 'string')
          .map((x) => ({ name: x.name as string, logo: typeof x.logo === 'string' && POSTER_PATH.test(x.logo) ? x.logo : '' }));
      const pv = (m.providers || {}) as Record<string, unknown>;
      return {
        overview: typeof m.overview === 'string' ? m.overview : '',
        runtime: typeof m.runtime === 'number' ? m.runtime : 0,
        genres: Array.isArray(m.genres) ? m.genres.filter((g): g is string => typeof g === 'string') : [],
        director: typeof m.director === 'string' ? m.director : '',
        backdrop: typeof m.backdrop === 'string' && POSTER_PATH.test(m.backdrop) ? m.backdrop : '',
        cast: Array.isArray(m.cast) ? m.cast.filter((g): g is string => typeof g === 'string').slice(0, 5) : [],
        trailer: typeof m.trailer === 'string' && /^[\w-]{6,20}$/.test(m.trailer) ? m.trailer : '',
        providers: { stream: people(pv.stream), rent: people(pv.rent), buy: people(pv.buy) },
      };
    })();
    detailsCache.set(id, p);
    p.catch(() => detailsCache.delete(id));
  }
  return p;
}

const backdropCache = new Map<number, Promise<string[]>>();

/** Cenas do filme (imagens largas, sem texto) para escolher como banner do perfil. */
export function movieBackdrops(id: number): Promise<string[]> {
  let p = backdropCache.get(id);
  if (!p) {
    p = fetch(`${API_BASE}api/images?id=${id}`)
      .then((r) => { if (!r.ok) throw new Error('imagens indisponíveis'); return r.json() as Promise<{ backdrops?: unknown[] }>; })
      .then((d) => (d.backdrops || []).filter((x): x is string => typeof x === 'string' && POSTER_PATH.test(x)));
    backdropCache.set(id, p);
    p.catch(() => backdropCache.delete(id));
  }
  return p;
}

export interface Ratings { imdbId: string; tmdb: number | null; imdb: number | null; rt: number | null; mc: number | null }
const ratingsCache = new Map<number, Promise<Ratings>>();

/** Notas do filme em outras plataformas (IMDb, Rotten Tomatoes, Metacritic e TMDB). */
export function movieRatings(id: number): Promise<Ratings> {
  let p = ratingsCache.get(id);
  if (!p) {
    const n = (v: unknown, max: number) => (typeof v === 'number' && v >= 0 && v <= max ? v : null);
    const get = (base: string) =>
      fetch(`${base}api/ratings?id=${id}`)
        .then((r) => { if (!r.ok) throw new Error('notas indisponíveis'); return r.json() as Promise<Record<string, unknown>>; })
        .then((d): Ratings => ({
          imdbId: typeof d.imdbId === 'string' && /^tt\d{5,10}$/.test(d.imdbId) ? d.imdbId : '',
          tmdb: n(d.tmdb, 10), imdb: n(d.imdb, 10), rt: n(d.rt, 100), mc: n(d.mc, 100),
        }));
    // Nas prévias da Vercel a chave da OMDb pode não existir: sem IMDb e sem RT, pergunta ao site principal.
    const local = API_BASE !== SITE_URL && location.origin + '/' !== SITE_URL;
    p = get(API_BASE).then((r) =>
      local && r.imdb == null && r.rt == null ? get(SITE_URL).catch(() => r) : r,
    );
    ratingsCache.set(id, p);
    p.catch(() => ratingsCache.delete(id));
  }
  return p;
}

const childhoodCache = new Map<string, Promise<SearchResult[]>>();
/** Filmes de sucesso de um período (para o Baú da infância). */
export function childhoodFilms(from: number, to: number): Promise<SearchResult[]> {
  const key = from + '-' + to;
  let p = childhoodCache.get(key);
  if (!p) {
    p = fetch(`${API_BASE}api/childhood?from=${from}&to=${to}`)
      .then((r) => { if (!r.ok) throw new Error('baú indisponível'); return r.json(); })
      .then(cleanResults);
    childhoodCache.set(key, p);
    p.catch(() => childhoodCache.delete(key));
  }
  return p;
}

export interface Cinema { name: string; place: string; km: number }
let cinemaCache: { at: string; list: Promise<Cinema[]> } | null = null;

/** Cinemas reais perto da pessoa (OpenStreetMap). A posição vai arredondada e não fica guardada. */
export function nearbyCinemas(lat: number, lon: number): Promise<Cinema[]> {
  const at = lat.toFixed(2) + ',' + lon.toFixed(2);
  if (cinemaCache?.at === at) return cinemaCache.list;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 60) : '');
  const list = fetch(`${API_BASE}api/cinemas?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}`)
    .then((r) => { if (!r.ok) throw new Error('cinemas indisponíveis'); return r.json() as Promise<{ cinemas?: Record<string, unknown>[] }>; })
    .then((d) => (d.cinemas || []).map((c) => ({ name: str(c.name), place: str(c.place), km: Number(c.km) || 0 })).filter((c) => c.name));
  cinemaCache = { at, list };
  list.catch(() => { cinemaCache = null; });
  return list;
}

export interface Credits {
  key: { name: string; photo: string; role: string }[];
  cast: { name: string; character: string; photo: string }[];
  depts: { name: string; people: { job: string; name: string }[] }[];
}
const creditsCache = new Map<number, Promise<Credits>>();

/** Elenco e equipe do filme, com fotos. Tudo o que vem de fora é conferido e cortado no tamanho. */
export function movieCredits(id: number): Promise<Credits> {
  let p = creditsCache.get(id);
  if (!p) {
    const str = (v: unknown, max = 80) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
    const photo = (v: unknown) => (typeof v === 'string' && POSTER_PATH.test(v) ? v : '');
    const arr = (v: unknown) => (Array.isArray(v) ? v : []) as Record<string, unknown>[];
    p = fetch(`${API_BASE}api/credits?id=${id}`)
      .then((r) => { if (!r.ok) throw new Error('créditos indisponíveis'); return r.json() as Promise<Record<string, unknown>>; })
      .then((d) => ({
        key: arr(d.key).map((x) => ({ name: str(x.name), photo: photo(x.photo), role: str(x.role) })).filter((x) => x.name).slice(0, 10),
        cast: arr(d.cast).map((x) => ({ name: str(x.name), character: str(x.character, 100), photo: photo(x.photo) })).filter((x) => x.name).slice(0, 24),
        depts: arr(d.depts).map((x) => ({
          name: str(x.name, 40),
          people: arr(x.people).map((y) => ({ job: str(y.job, 60), name: str(y.name) })).filter((y) => y.name).slice(0, 14),
        })).filter((x) => x.name && x.people.length).slice(0, 12),
      }));
    creditsCache.set(id, p);
    p.catch(() => creditsCache.delete(id));
  }
  return p;
}

export const loadImage = (src: string, crossOrigin = false) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
