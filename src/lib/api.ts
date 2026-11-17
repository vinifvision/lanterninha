// Conversa com as funções em /api (que por sua vez falam com o TMDB usando a chave guardada no servidor).
import { API_BASE, IMG } from './config';
import { POSTER_PATH } from './format';
import type { MovieDetails, SearchResult } from './types';

export const posterUrl = (path: string, size: 'w92' | 'w185' | 'w342' | 'w780' = 'w185') => IMG + size + path;
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

export const loadImage = (src: string, crossOrigin = false) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
