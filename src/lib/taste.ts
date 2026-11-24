// "No meu estilo" (sorteio): monta uma leva de filmes com a cara de quem está usando.
// 1. Escolhe até 6 favoritos (nota 4 ou mais). Nota 5 pesa bem mais que 4, e review dá um empurrãozinho.
// 2. Junta as recomendações do TMDB de cada favorito. Filme que aparece a partir de vários favoritos ganha mais pontos.
// 3. Corta filmes fracos (nota baixa ou poucos votos no TMDB), se ainda sobrar bastante coisa.
// 4. Aprende o gosto pelas notas: gêneros e diretores que a pessoa avalia bem sobem; os que avalia mal descem.
// 5. Devolve os melhores, cada um com um peso (w). O sorteio usa o peso: quem combina mais tem mais chance.
import { discover, movieDetails } from './api';
import { fkey, isRated } from './films';
import { fmt } from './format';
import type { Film, FilmInfo, RatedFilm, SearchResult } from './types';

export interface TastePick { info: FilmInfo; why: string; w: number }

/** Quantos favoritos usar em cada sorteio. */
const SEEDS = 6;
/** Quantas notas olhar para aprender gêneros e diretores. */
const PROFILE = 24;
/** Quantos filmes vão para o sorteio no fim. */
const KEEP = 24;
/** Filtro de qualidade (dados do TMDB). */
const MIN_VOTES = 150, MIN_RATING = 6.3;

type Rated = RatedFilm & { id: number };
interface Taste { genres: Map<number, number>; directors: Map<number, { v: number; name: string }> }
interface Cand { m: SearchResult; score: number; seeds: Rated[]; director?: string }

/** Quanto um favorito pesa: nota 4 = 1, 4,5 = 2,25, 5 = 4. */
const seedWeight = (s: number) => (s - 3) ** 2;
const clamp = (n: number) => Math.max(-1, Math.min(1, n));
const toInfo = (m: SearchResult): FilmInfo => ({ id: m.id, t: m.title, y: m.year, o: m.original, img: m.poster });

/** Média "com freio": poucos filmes puxam pouco (um único filme não decide o gosto). */
function addTo<K>(map: Map<K, { sum: number; n: number }>, key: K, d: number) {
  const cur = map.get(key) || { sum: 0, n: 0 };
  cur.sum += d; cur.n += 1; map.set(key, cur);
}
const settle = (x: { sum: number; n: number }) => x.sum / (x.n + 2);

let cache: { sig: string; taste: Promise<Taste> } | null = null;

/** Seu gosto em números: para cada gênero e diretor, quanto acima (+) ou abaixo (−) da sua média você costuma dar. */
function learnTaste(rated: Rated[]): Promise<Taste> {
  const sig = rated.map((h) => h.id + ':' + h.s).join(',');
  if (cache && cache.sig === sig) return cache.taste;
  const taste = (async () => {
    const mean = rated.reduce((a, h) => a + h.s, 0) / (rated.length || 1);
    // As notas mais longe da média ensinam mais (o que você amou e o que você odiou)
    const sample = rated
      .map((h) => ({ h, k: Math.abs(h.s - mean) + Math.random() * 0.3 }))
      .sort((a, b) => b.k - a.k).slice(0, PROFILE).map((x) => x.h);
    const details = await Promise.all(sample.map((h) => movieDetails(h.id).catch(() => null)));
    const g = new Map<number, { sum: number; n: number }>();
    const d = new Map<number, { sum: number; n: number }>();
    const names = new Map<number, string>();
    sample.forEach((h, i) => {
      const det = details[i];
      if (!det) return;
      const diff = h.s - mean;
      det.genreIds.forEach((id) => addTo(g, id, diff));
      det.directors.forEach((p) => { addTo(d, p.id, diff); names.set(p.id, p.name); });
    });
    return {
      genres: new Map([...g].map(([k, x]) => [k, settle(x)])),
      directors: new Map([...d].map(([k, x]) => [k, { v: settle(x), name: names.get(k) || '' }])),
    };
  })();
  cache = { sig, taste };
  taste.catch(() => { cache = null; });
  return taste;
}

function why(c: Cand): string {
  if (c.seeds.length >= 2) return `Porque você amou ${c.seeds[0].t} e ${c.seeds[1].t}`;
  if (c.director) return `De ${c.director}, que você costuma avaliar bem`;
  return `Porque você deu ★ ${fmt(c.seeds[0].s)} para ${c.seeds[0].t}`;
}

/** Filmes "no seu estilo", do que mais combina para o que menos combina, cada um com seu peso. */
export async function tasteCandidates(all: Film[]): Promise<TastePick[]> {
  const mine = new Set(all.map(fkey));
  const rated = all.filter(isRated).filter((h): h is Rated => !!h.id);

  const seeds = rated.filter((h) => h.s >= 4)
    .map((h) => ({ h, k: seedWeight(h.s) + (h.note ? 0.5 : 0) + Math.random() * 1.2 }))
    .sort((a, b) => b.k - a.k).slice(0, SEEDS).map((x) => x.h);

  if (!seeds.length) {
    // Sem filmes bem avaliados ainda: vai do que está em alta
    const trend = await discover('trending').catch(() => []);
    return trend.filter((m) => !mine.has('m' + m.id)).map((m) => ({ info: toInfo(m), why: 'Em alta na semana', w: 1 }));
  }

  const [lists, taste] = await Promise.all([
    Promise.all(seeds.map((h) => discover('similar', h.id).catch(() => [] as SearchResult[]))),
    learnTaste(rated).catch((): Taste => ({ genres: new Map(), directors: new Map() })),
  ]);

  // Pontos por aparecer nas recomendações: favorito com nota maior vale mais, e o topo da lista vale mais que o fim
  const cands = new Map<number, Cand>();
  lists.forEach((list, s) => list.forEach((m, i) => {
    if (mine.has('m' + m.id)) return;
    const c = cands.get(m.id) || { m, score: 0, seeds: [] };
    c.score += seedWeight(seeds[s].s) * (1 - i / (list.length + 5));
    if (!c.seeds.includes(seeds[s])) c.seeds.push(seeds[s]);
    cands.set(m.id, c);
  }));
  let pool = [...cands.values()];
  if (!pool.length) return [];

  // Apareceu a partir de vários favoritos: bônus extra
  pool.forEach((c) => { c.score *= 1 + 0.35 * (c.seeds.length - 1); });

  // Qualidade: só corta se ainda sobrar uma boa leva
  const good = pool.filter((c) => (c.m.votes ?? MIN_VOTES) >= MIN_VOTES && (c.m.rating ?? 10) >= MIN_RATING);
  if (good.length >= 8) pool = good;

  // Gêneros: média do seu gosto nos gêneros do filme
  pool.forEach((c) => {
    const g = (c.m.genres || []).map((id) => taste.genres.get(id)).filter((v): v is number => v !== undefined);
    if (g.length) c.score *= 1 + clamp(g.reduce((a, b) => a + b, 0) / g.length) * 0.6;
  });

  // Diretores: confere nos melhores colocados (os detalhes ficam guardados e o sorteio usa de novo)
  pool.sort((a, b) => b.score - a.score);
  pool = pool.slice(0, KEEP + 8);
  const details = await Promise.all(pool.map((c) => movieDetails(c.m.id).catch(() => null)));
  pool.forEach((c, i) => {
    const ds = (details[i]?.directors || []).map((p) => taste.directors.get(p.id)).filter((x): x is { v: number; name: string } => !!x);
    if (!ds.length) return;
    const best = ds.reduce((a, b) => (b.v > a.v ? b : a));
    c.score *= 1 + clamp(ds.reduce((a, b) => a + b.v, 0)) * 0.5;
    if (best.v >= 0.5) c.director = best.name;
  });

  pool.sort((a, b) => b.score - a.score);
  pool = pool.slice(0, KEEP);
  const top = pool[0].score || 1;
  return pool.map((c) => ({ info: toInfo(c.m), why: why(c), w: Math.max(0.05, c.score / top) }));
}
