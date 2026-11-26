import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Film, MovieDetails, SearchResult } from './types';

// O "No meu estilo" busca recomendações e detalhes no TMDB. No teste, essas buscas viram respostas
// fixas (mock): o teste fica rápido, não depende da internet e sempre dá o mesmo resultado.
const api = vi.hoisted(() => ({ discover: vi.fn(), movieDetails: vi.fn() }));
vi.mock('./api', () => api);

type Taste = typeof import('./taste');
let tasteCandidates: Taste['tasteCandidates'];

/** Filme avaliado na sua lista. */
const nota = (id: number, s: number, t = 'Filme ' + id): Film => ({ t, s, c: false, id });
/** Filme que o TMDB devolve numa lista de recomendações. */
const sr = (id: number, extra: Partial<SearchResult> = {}): SearchResult => ({
  id, title: 'Rec ' + id, original: '', year: '2020', poster: '', rating: 7.5, votes: 1000, genres: [], ...extra,
});
const det = (genreIds: number[] = [], directors: { id: number; name: string }[] = []) =>
  ({ genreIds, directors }) as unknown as MovieDetails;

/** Monta as respostas falsas: recomendações por favorito e detalhes por filme. */
function tmdb(similar: Record<number, SearchResult[]>, details: Record<number, MovieDetails> = {}, trending: SearchResult[] = []) {
  api.discover.mockImplementation(async (kind: string, id?: number) => (kind === 'trending' ? trending : similar[id!] || []));
  api.movieDetails.mockImplementation(async (id: number) => details[id] || det());
}

beforeEach(async () => {
  vi.clearAllMocks();
  // O sorteio usa números aleatórios; fixando em 0, o resultado é sempre o mesmo
  vi.spyOn(Math, 'random').mockReturnValue(0);
  // O gosto aprendido fica guardado dentro do arquivo; recarregar zera isso entre um teste e outro
  vi.resetModules();
  ({ tasteCandidates } = await import('./taste'));
});

describe('tasteCandidates: No meu estilo', () => {
  it('sem favoritos, sugere o que está em alta (menos o que você já tem)', async () => {
    tmdb({}, {}, [sr(1), sr(2)]);
    const r = await tasteCandidates([nota(1, 3)]);
    expect(api.discover).toHaveBeenCalledWith('trending');
    expect(r).toEqual([{ info: expect.objectContaining({ id: 2 }), why: 'Em alta na semana', w: 1 }]);
  });

  it('nunca sugere filme que já está na sua lista', async () => {
    tmdb({ 10: [sr(10), sr(11), sr(12)] });
    const lista = [nota(10, 5), { t: 'Já vi', c: false, id: 12, st: 'seen' } as Film];
    const r = await tasteCandidates(lista);
    expect(r.map((p) => p.info.id)).toEqual([11]);
  });

  it('filme indicado a partir de dois favoritos sobe e explica o motivo', async () => {
    tmdb({ 10: [sr(1), sr(2)], 20: [sr(2), sr(3)] });
    const r = await tasteCandidates([nota(10, 5, 'Bacurau'), nota(20, 4, 'Aquarius')]);
    expect(r.map((p) => p.info.id)).toEqual([2, 1, 3]);
    expect(r[0].why).toBe('Porque você amou Bacurau e Aquarius');
    expect(r[1].why).toBe('Porque você deu ★ 5 para Bacurau');
    expect(r[2].why).toBe('Porque você deu ★ 4 para Aquarius');
  });

  it('o peso do sorteio fica entre 0,05 e 1, e o primeiro vale 1', async () => {
    tmdb({ 10: Array.from({ length: 20 }, (_, i) => sr(100 + i)) });
    const r = await tasteCandidates([nota(10, 5)]);
    expect(r[0].w).toBe(1);
    r.forEach((p) => {
      expect(p.w).toBeGreaterThanOrEqual(0.05);
      expect(p.w).toBeLessThanOrEqual(1);
    });
  });

  it('corta filme fraco no TMDB quando sobram 8 ou mais bons', async () => {
    const bons = Array.from({ length: 9 }, (_, i) => sr(100 + i));
    tmdb({ 10: [sr(1, { rating: 5 }), sr(2, { votes: 20 }), ...bons] });
    const ids = (await tasteCandidates([nota(10, 5)])).map((p) => p.info.id);
    expect(ids).not.toContain(1);
    expect(ids).not.toContain(2);
    expect(ids).toHaveLength(9);
  });

  it('mantém o filme fraco quando sobrariam poucos', async () => {
    tmdb({ 10: [sr(1, { rating: 5 }), sr(2), sr(3)] });
    const ids = (await tasteCandidates([nota(10, 5)])).map((p) => p.info.id);
    expect(ids).toContain(1);
  });

  it('gênero que você avalia bem sobe; o que você avalia mal desce', async () => {
    // Você amou um drama (18) e odiou um terror (27)
    tmdb(
      { 10: [sr(1, { genres: [27] }), sr(2, { genres: [18] })] },
      { 10: det([18]), 30: det([27]) },
    );
    const r = await tasteCandidates([nota(10, 5), nota(30, 1)]);
    // Sem o gosto, o terror viria primeiro (estava no topo da lista do TMDB)
    expect(r.map((p) => p.info.id)).toEqual([2, 1]);
  });

  it('diretor que você avalia bem aparece no motivo', async () => {
    const kleber = { id: 7, name: 'Kleber Mendonça Filho' };
    tmdb(
      { 10: [sr(1), sr(2)] },
      { 10: det([], [kleber]), 30: det([], [{ id: 8, name: 'Outro' }]), 2: det([], [kleber]) },
    );
    const r = await tasteCandidates([nota(10, 5, 'Bacurau'), nota(30, 1)]);
    const doKleber = r.find((p) => p.info.id === 2)!;
    expect(doKleber.why).toBe('De Kleber Mendonça Filho, que você costuma avaliar bem');
    expect(r[0].info.id).toBe(2);
  });

  it('sem nada novo para sugerir, devolve a lista vazia', async () => {
    tmdb({ 10: [sr(10)] });
    expect(await tasteCandidates([nota(10, 5)])).toEqual([]);
  });

  it('se o TMDB falhar, não quebra', async () => {
    api.discover.mockRejectedValue(new Error('sem internet'));
    api.movieDetails.mockRejectedValue(new Error('sem internet'));
    expect(await tasteCandidates([nota(10, 5)])).toEqual([]);
  });
});
