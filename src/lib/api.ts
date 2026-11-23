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

/** Uma página de uma lista do TMDB: os filmes, o número dela e quantas páginas a lista tem. */
export interface ListPage { results: SearchResult[]; page: number; totalPages: number }

/** Uma página da busca por nome (aceita erro de digitação e título original). Guardada enquanto o app está aberto. */
const searchCache = new Map<string, Promise<ListPage>>();
export function searchPage(q: string, page: number): Promise<ListPage> {
  const key = 'q=' + encodeURIComponent(q.trim().toLowerCase()) + '&page=' + page;
  let p = searchCache.get(key);
  if (!p) {
    if (searchCache.size > 60) searchCache.clear();
    p = fetch(`${API_BASE}api/search?${key}`)
      .then((r) => { if (!r.ok) throw new Error('busca indisponível'); return r.json(); })
      .then((d: { results?: unknown[]; page?: unknown; totalPages?: unknown }) => {
        const n = Number.isInteger(d.page) ? (d.page as number) : page;
        const total = Number.isInteger(d.totalPages) ? (d.totalPages as number) : n;
        return { results: cleanResults(d), page: n, totalPages: Math.max(total, n) };
      });
    searchCache.set(key, p);
    p.catch(() => searchCache.delete(key));
  }
  return p;
}

/** Só a primeira página da busca (usada onde não precisa rolar, como no Banner). */
export async function searchMovies(q: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const r = await fetch(`${API_BASE}api/search?q=${encodeURIComponent(q)}`, { signal });
  if (!r.ok) throw new Error('busca indisponível');
  return cleanResults(await r.json());
}

export type DiscoverList = 'now' | 'trending' | 'classics' | 'similar';
export type Mood = 'chorar' | 'rir' | 'br' | 'curto';

const pageCache = new Map<string, Promise<ListPage>>();

/** Busca uma página de /api/discover. Guardada enquanto o app está aberto. */
function listPage(query: string, page: number): Promise<ListPage> {
  const key = query + '&page=' + page;
  let p = pageCache.get(key);
  if (!p) {
    p = fetch(`${API_BASE}api/discover?${key}`)
      .then((r) => { if (!r.ok) throw new Error('lista indisponível'); return r.json(); })
      .then((d: { results?: unknown[]; page?: unknown; totalPages?: unknown }) => {
        const n = Number.isInteger(d.page) ? (d.page as number) : page;
        const total = Number.isInteger(d.totalPages) ? (d.totalPages as number) : n;
        return { results: cleanResults(d), page: n, totalPages: Math.max(total, n) };
      });
    pageCache.set(key, p);
    p.catch(() => pageCache.delete(key));
  }
  return p;
}

/** Uma página das listas da tela Início (em cartaz, em alta, clássicos, parecidos com um filme). */
export const discoverPage = (list: DiscoverList, page: number, id?: number) =>
  listPage(`list=${list}${id ? '&id=' + id : ''}`, page);

/** Só a primeira página, para as fileiras e quem precisa de uma amostra. */
export const discover = (list: DiscoverList, id?: number): Promise<SearchResult[]> =>
  discoverPage(list, 1, id).then((p) => p.results);

/** Explorar por clima (aba Buscar): uma página das listas do TMDB por gênero, país e duração. */
export const moodPage = (m: Mood, page: number) => listPage(`list=mood&m=${m}`, page);

/** Série do filme (vinda do servidor): confere cada campo antes de usar. */
function readCollection(raw: unknown): MovieDetails['collection'] {
  const c = raw as { name?: unknown; parts?: unknown } | null;
  if (!c || !Array.isArray(c.parts)) return null;
  const parts = c.parts
    .map((x) => x as { id?: unknown; title?: unknown; year?: unknown; poster?: unknown })
    .filter((x) => typeof x.id === 'number' && typeof x.title === 'string')
    .map((x) => ({
      id: x.id as number,
      t: x.title as string,
      y: typeof x.year === 'string' ? x.year : '',
      img: typeof x.poster === 'string' && POSTER_PATH.test(x.poster) ? x.poster : '',
    }));
  return parts.length > 1 ? { name: typeof c.name === 'string' ? c.name : '', parts } : null;
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
        release: typeof m.release === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(m.release) ? m.release : '',
        genres: Array.isArray(m.genres) ? m.genres.filter((g): g is string => typeof g === 'string') : [],
        director: typeof m.director === 'string' ? m.director : '',
        directors: (Array.isArray(m.directors) ? m.directors : [])
          .map((x) => x as { id?: unknown; name?: unknown })
          .filter((x) => Number.isInteger(x.id) && typeof x.name === 'string')
          .map((x) => ({ id: x.id as number, name: (x.name as string).slice(0, 80) })),
        companies: (Array.isArray(m.companies) ? m.companies : [])
          .map((x) => x as { id?: unknown; name?: unknown; logo?: unknown })
          .filter((x) => Number.isInteger(x.id) && typeof x.name === 'string')
          .map((x) => ({ id: x.id as number, name: (x.name as string).slice(0, 80), logo: typeof x.logo === 'string' && POSTER_PATH.test(x.logo) ? x.logo : '' })),
        backdrop: typeof m.backdrop === 'string' && POSTER_PATH.test(m.backdrop) ? m.backdrop : '',
        cast: Array.isArray(m.cast) ? m.cast.filter((g): g is string => typeof g === 'string').slice(0, 5) : [],
        trailer: typeof m.trailer === 'string' && /^[\w-]{6,20}$/.test(m.trailer) ? m.trailer : '',
        providers: { stream: people(pv.stream), rent: people(pv.rent), buy: people(pv.buy) },
        collection: readCollection(m.collection),
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
/** Filmes de sucesso de um período (usado na avaliação guiada). */
export function childhoodFilms(from: number, to: number): Promise<SearchResult[]> {
  const key = from + '-' + to;
  let p = childhoodCache.get(key);
  if (!p) {
    p = fetch(`${API_BASE}api/childhood?from=${from}&to=${to}`)
      .then((r) => { if (!r.ok) throw new Error('lista indisponível'); return r.json(); })
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
  key: { id: number | null; name: string; photo: string; role: string }[];
  cast: { id: number | null; name: string; character: string; photo: string }[];
  depts: { name: string; people: { id: number | null; job: string; name: string }[] }[];
}
const creditsCache = new Map<number, Promise<Credits>>();

/** Elenco e equipe do filme, com fotos. Tudo o que vem de fora é conferido e cortado no tamanho. */
export function movieCredits(id: number): Promise<Credits> {
  let p = creditsCache.get(id);
  if (!p) {
    const str = (v: unknown, max = 80) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
    const photo = (v: unknown) => (typeof v === 'string' && POSTER_PATH.test(v) ? v : '');
    const arr = (v: unknown) => (Array.isArray(v) ? v : []) as Record<string, unknown>[];
    const pid = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : null);
    p = fetch(`${API_BASE}api/credits?id=${id}`)
      .then((r) => { if (!r.ok) throw new Error('créditos indisponíveis'); return r.json() as Promise<Record<string, unknown>>; })
      .then((d) => ({
        key: arr(d.key).map((x) => ({ id: pid(x.id), name: str(x.name), photo: photo(x.photo), role: str(x.role) })).filter((x) => x.name).slice(0, 10),
        cast: arr(d.cast).map((x) => ({ id: pid(x.id), name: str(x.name), character: str(x.character, 100), photo: photo(x.photo) })).filter((x) => x.name).slice(0, 24),
        depts: arr(d.depts).map((x) => ({
          name: str(x.name, 40),
          people: arr(x.people).map((y) => ({ id: pid(y.id), job: str(y.job, 60), name: str(y.name) })).filter((y) => y.name).slice(0, 14),
        })).filter((x) => x.name && x.people.length).slice(0, 12),
      }));
    creditsCache.set(id, p);
    p.catch(() => creditsCache.delete(id));
  }
  return p;
}

export type PersonKind = 'person' | 'company';
/** Um filme na página de uma pessoa ou produtora. */
export interface PersonFilm extends SearchResult {
  /** Data de lançamento (AAAA-MM-DD), vazia se o TMDB não souber */
  date: string;
  /** Popularidade no TMDB, para ordenar por "Mais famosos" */
  pop: number;
  /** O que a pessoa fez nele: Atuação, Direção, Roteiro... (vazio nas produtoras) */
  roles: string[];
}
export interface PersonPage {
  name: string;
  /** Foto da pessoa ou logo da produtora */
  photo: string;
  /** Pelo que ela é conhecida (ex.: Direção), ou "Produtora" */
  known: string;
  /** Quantos filmes existem ao todo (nas produtoras a lista vem cortada nos mais populares) */
  total: number;
  films: PersonFilm[];
}
const personCache = new Map<string, Promise<PersonPage>>();

/** Todos os filmes de um diretor, ator, roteirista... ou de uma produtora. Tudo é conferido antes de usar. */
export function personPage(kind: PersonKind, id: number): Promise<PersonPage> {
  const key = kind + id;
  let p = personCache.get(key);
  if (!p) {
    const str = (v: unknown, max = 80) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
    p = fetch(`${API_BASE}api/person?type=${kind}&id=${id}`)
      .then((r) => { if (!r.ok) throw new Error('página indisponível'); return r.json() as Promise<Record<string, unknown>>; })
      .then((d) => {
        const raw = (Array.isArray(d.films) ? d.films : []) as Record<string, unknown>[];
        const extra = new Map(raw.map((x) => [x.id, x] as const));
        const films: PersonFilm[] = cleanResults({ results: raw }).map((f) => {
          const x: Record<string, unknown> = extra.get(f.id) || {};
          return {
            ...f,
            date: typeof x.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : '',
            pop: typeof x.pop === 'number' && x.pop >= 0 ? x.pop : 0,
            roles: (Array.isArray(x.roles) ? x.roles : []).filter((r): r is string => typeof r === 'string').map((r) => r.slice(0, 30)).slice(0, 6),
          };
        });
        const total = Number.isInteger(d.total) ? Math.max(d.total as number, films.length) : films.length;
        return { name: str(d.name), photo: typeof d.photo === 'string' && POSTER_PATH.test(d.photo) ? d.photo : '', known: str(d.known, 30), total, films };
      });
    personCache.set(key, p);
    p.catch(() => personCache.delete(key));
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
