import { describe, expect, it, vi } from 'vitest';
import type { Film } from './types';

// stats.ts também tem as partes que falam com a nuvem e com o TMDB. Aqui só testamos as contas,
// então essas duas partes viram "de mentira" (assim o teste não precisa de internet nem de login).
vi.mock('./cloud', () => ({ cloud: {} }));
vi.mock('./api', () => ({}));

import { diaryYears, filmsOfYear, goalPace, marks, NOTES, yearStats } from './stats';

type Facts = Parameters<typeof yearStats>[1] extends Map<number, infer F> ? F : never;

/** Um filme da lista, só com o que cada teste precisa. */
const filme = (t: string, extra: Partial<Film> = {}): Film => ({ t, c: false, ...extra });

describe('diaryYears e filmsOfYear', () => {
  const lista = [
    filme('A', { s: 4, d: '2025-03-01' }),
    filme('B', { st: 'seen', d: '2026-01-02' }),
    filme('C', { st: 'want', d: '2024-05-05' }),
    filme('D', { s: 3 }),
  ];

  it('lista os anos do diário do mais novo para o mais velho, sem o Quero ver', () => {
    expect(diaryYears(lista)).toEqual(['2026', '2025']);
  });

  it('pega os filmes vistos no ano, com nota e "Já vi"', () => {
    expect(filmsOfYear(lista, '2026').map((h) => h.t)).toEqual(['B']);
    expect(filmsOfYear(lista, '2024')).toEqual([]);
  });
});

describe('yearStats: o Seu Ano', () => {
  const A = filme('Pulp Fiction', { id: 1, s: 5, d: '2026-01-10', y: '1994', w: 'cine', note: 'Obra-prima' });
  const B = filme('Jackie Brown', { id: 2, s: 4, d: '2026-01-20', y: '1997', w: 'casa' });
  const C = filme('Bacurau', { id: 3, s: 2, d: '2026-03-05', y: '2019', w: 'casa' });
  const D = filme('Comédia X', { id: 4, st: 'seen', d: '2026-03-06', y: '2019', w: 'outro' });
  const E = filme('Sem dados', { id: 5, s: 4, d: '2026-12-31', y: '2023', note: '   ' });
  const lista = [A, B, C, D, E];
  const fatos = new Map<number, Facts>([
    [1, { r: 154, g: ['Crime', 'Drama'], d: [[10, 'Tarantino']], a: [[100, 'Samuel L. Jackson']], p: 4.5 }],
    [2, { r: 120, g: ['Crime'], d: [[10, 'Tarantino']], a: [[100, 'Samuel L. Jackson']], p: 2.5 }],
    [3, { r: 130, g: ['Drama'], d: [[20, 'Kleber Mendonça Filho']], a: [], p: 4 }],
    [4, { r: 96, g: ['Comédia'], d: [[30, 'Fulano']], a: [] }],
    // O filme 5 não tem dados do TMDB: precisa funcionar mesmo assim
  ]);
  const st = yearStats(lista, fatos);

  it('conta filmes, horas, reviews e a média das notas', () => {
    expect(st.count).toBe(5);
    expect(st.hours).toBe(8); // 500 minutos
    expect(st.reviews).toBe(1); // review só de espaços não conta
    expect(st.avg).toBe(3.75); // (5 + 4 + 2 + 4) / 4, sem o "Já vi"
  });

  it('separa os filmes por mês', () => {
    expect(st.months.map((m) => m.length)).toEqual([2, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  });

  it('acha a nota que você mais deu', () => {
    expect(NOTES[st.mode]).toBe(4);
    expect(st.notes[st.mode].map((h) => h.t)).toEqual(['Jackie Brown', 'Sem dados']);
  });

  it('sem nenhuma nota, a média é 0 e não há nota mais comum', () => {
    const vazio = yearStats([D], fatos);
    expect(vazio.avg).toBe(0);
    expect(vazio.mode).toBe(-1);
  });

  it('gêneros: mais vistos por quantidade e maior nota só com 2 notas ou mais', () => {
    expect(st.genres.seen.map((r) => [r.label, r.n])).toEqual([['Crime', 2], ['Drama', 2], ['Comédia', 1]]);
    expect(st.genres.liked.map((r) => [r.label, r.avg])).toEqual([['Crime', 4.5], ['Drama', 3.5]]);
  });

  it('diretores e atores só entram com 2 filmes ou mais', () => {
    expect(st.directors.seen.map((r) => r.label)).toEqual(['Tarantino']);
    expect(st.actors.seen.map((r) => r.label)).toEqual(['Samuel L. Jackson']);
  });

  it('agrupa por década, da mais nova para a mais velha', () => {
    expect(st.decades.map((r) => [r.label, r.n])).toEqual([['Anos 2020', 1], ['Anos 2010', 2], ['Anos 90', 2]]);
  });

  it('separa onde você viu: cinema, casa ou outro lugar', () => {
    expect(st.where.map((w) => [w.key, w.films.length])).toEqual([['cine', 1], ['casa', 2], ['outro', 1]]);
  });

  it('do contra: só entra quem fugiu 1 estrela ou mais da nota do público', () => {
    expect(st.contra.compared).toBe(3);
    expect(st.contra.above.map((x) => x.h.t)).toEqual(['Jackie Brown']);
    expect(st.contra.below.map((x) => x.h.t)).toEqual(['Bacurau']);
  });

  it('acha o primeiro, o último e o melhor filme do ano', () => {
    expect(st.first?.t).toBe('Pulp Fiction');
    expect(st.last?.t).toBe('Sem dados');
    expect(st.best?.t).toBe('Pulp Fiction');
  });
});

describe('goalPace: a meta do ano', () => {
  // Datas fixas, para o teste dar o mesmo resultado em qualquer dia
  const julho = new Date(2026, 6, 2);

  it('mostra quanto falta, se está no ritmo e a projeção', () => {
    const p = goalPace('2026', 30, 52, julho);
    expect(p).toMatchObject({ past: false, done: false, left: 22, ahead: 4, projected: 60 });
    expect(p.need).toBe('1 filme a cada 8 dias');
  });

  it('fala em filmes por semana quando o ritmo precisa ser maior', () => {
    expect(goalPace('2026', 10, 100, julho).need).toBe('4 filmes por semana');
  });

  it('na última semana do ano, fala em "até o fim do ano"', () => {
    const fim = new Date(2026, 11, 28);
    expect(goalPace('2026', 50, 52, fim).need).toBe('2 filmes até o fim do ano');
    expect(goalPace('2026', 51, 52, fim).need).toBe('1 filme até o fim do ano');
  });

  it('meta batida: nada falta', () => {
    expect(goalPace('2026', 52, 52, julho)).toMatchObject({ done: true, left: 0, need: '' });
  });

  it('ano que já passou', () => {
    expect(goalPace('2025', 40, 52, julho)).toMatchObject({ past: true, left: 12, projected: 40, need: '' });
  });

  it('no primeiro dia do ano ainda não dá para projetar', () => {
    expect(goalPace('2026', 0, 52, new Date(2026, 0, 1)).projected).toBe(0);
  });
});

describe('marks: sequências e marcos', () => {
  const dia = (d: string, t = d, ts = 0) => filme(t, { s: 4, d, ts });
  const lista = [
    dia('2026-03-01'), dia('2026-03-02'), dia('2026-03-03'),
    dia('2026-03-10', 'M1', 1), dia('2026-03-10', 'M2', 2), dia('2026-03-10', 'M3', 3),
    dia('2026-11-24'), dia('2026-11-25'),
  ];
  const hoje = new Date(2026, 10, 26, 12);
  const m = marks(lista, '2026', hoje);

  it('acha a maior sequência de dias seguidos', () => {
    expect(m.streak).toMatchObject({ len: 3, from: '2026-03-01', to: '2026-03-03' });
    expect(m.streak?.films).toHaveLength(3);
  });

  it('em empate, a maior sequência é a mais recente', () => {
    const r = marks([dia('2026-01-01'), dia('2026-01-02'), dia('2026-05-01'), dia('2026-05-02')], '2026', hoje);
    expect(r.streak).toMatchObject({ len: 2, from: '2026-05-01' });
  });

  it('sequência de agora conta a partir de ontem quando você ainda não viu nada hoje', () => {
    expect(m.current).toMatchObject({ len: 2, seenToday: false });
    expect(m.current?.films).toHaveLength(2);
  });

  it('sequência de agora conta hoje quando você já viu um filme hoje', () => {
    const r = marks([...lista, dia('2026-11-26')], '2026', hoje);
    expect(r.current).toMatchObject({ len: 3, seenToday: true });
    expect(r.current?.films).toHaveLength(3);
  });

  it('em outro ano não existe sequência de agora', () => {
    expect(marks(lista, '2025', hoje).current).toBeNull();
  });

  it('acha o dia de maratona', () => {
    expect(m.marathon?.day).toBe('2026-03-10');
    expect(m.marathon?.films.map((h) => h.t)).toEqual(['M1', 'M2', 'M3']);
  });

  it('separa os filmes por dia da semana', () => {
    // 01/03/2026 foi domingo; 03/03, 10/03 e 24/11 foram terça
    expect(m.week.map((w) => w.length)).toEqual([1, 1, 5, 1, 0, 0, 0]);
  });

  it('com um filme só, não há sequência nem maratona', () => {
    const r = marks([dia('2026-02-02')], '2026', hoje);
    expect(r.streak).toBeNull();
    expect(r.marathon).toBeNull();
    expect(r.milestones).toEqual([]);
  });

  it('marca os filmes de número redondo (10º, 25º…)', () => {
    const muitos = Array.from({ length: 30 }, (_, i) => dia(`2026-01-${String(i + 1).padStart(2, '0')}`, `F${i + 1}`));
    const r = marks(muitos, '2026', hoje);
    expect(r.milestones.map((x) => [x.n, x.h.t])).toEqual([[10, 'F10'], [25, 'F25']]);
  });

  it('ignora filmes sem data completa', () => {
    const r = marks([filme('Sem data', { s: 4 }), filme('Só ano', { s: 4, d: '2026' })], '2026', hoje);
    expect(r.week.flat()).toEqual([]);
  });
});
