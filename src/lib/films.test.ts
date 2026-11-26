import { beforeEach, describe, expect, it } from 'vitest';
import { cleanFilm, films, isRated } from './films';
import { today } from './format';
import type { Film, RatedFilm } from './types';

const AMIGO = '123e4567-e89b-12d3-a456-426614174000';
const CAMPOS = ['t', 's', 'st', 'c', 'id', 'y', 'o', 'img', 'p', 'n', 'd', 'col', 'ts', 'note', 'sp', 'by', 'w', 'tk', 'com'];

// Cada teste começa com a lista vazia, para um não interferir no outro.
beforeEach(() => films.replaceAll([]));

describe('cleanFilm: o que não entra', () => {
  it('recusa o que nem é um filme', () => {
    for (const lixo of [null, undefined, 'Bacurau', 42, true, [], {}]) expect(cleanFilm(lixo)).toBeNull();
  });

  it('recusa filme sem título ou com título só de espaços', () => {
    expect(cleanFilm({ s: 4 })).toBeNull();
    expect(cleanFilm({ t: '   ', s: 4 })).toBeNull();
    expect(cleanFilm({ t: 123, s: 4 })).toBeNull();
  });

  it('recusa nota fora de 0,5 a 5 ou que não é número', () => {
    for (const s of [0, -1, 6, 5.5, NaN, Infinity, 'abc', true, [4], { v: 4 }, null]) {
      expect(cleanFilm({ t: 'Bacurau', s })).toBeNull();
    }
  });

  it('recusa estado inventado quando não tem nota', () => {
    expect(cleanFilm({ t: 'Bacurau', st: 'admin' })).toBeNull();
  });
});

describe('cleanFilm: o que entra', () => {
  it('aceita um filme avaliado e tira os espaços do título', () => {
    expect(cleanFilm({ t: '  Bacurau ', s: 4.5, c: true, id: 1, y: '2019' }))
      .toEqual({ t: 'Bacurau', s: 4.5, c: true, id: 1, y: '2019' });
  });

  it('arredonda a nota para meia estrela', () => {
    expect(cleanFilm({ t: 'A', s: 3.7 })?.s).toBe(3.5);
    expect(cleanFilm({ t: 'A', s: 4.8 })?.s).toBe(5);
  });

  it('aceita nota escrita como texto', () => {
    expect(cleanFilm({ t: 'A', s: '4.5' })?.s).toBe(4.5);
  });

  it('filme com estado não leva nota junto', () => {
    const f = cleanFilm({ t: 'A', st: 'want', s: 5 });
    expect(f?.st).toBe('want');
    expect(f?.s).toBeUndefined();
  });
});

describe('cleanFilm: limites de tamanho', () => {
  it('corta título, review, cinema e "indicado por"', () => {
    expect(cleanFilm({ t: 'a'.repeat(300), s: 4 })?.t).toHaveLength(120);
    expect(cleanFilm({ t: 'A', s: 4, note: 'b'.repeat(6000) })?.note).toHaveLength(5000);
    expect(cleanFilm({ t: 'A', st: 'want', by: 'c'.repeat(100) })?.by).toHaveLength(44);
    expect(cleanFilm({ t: 'A', s: 4, w: 'cine', tk: { cine: 'd'.repeat(100) } })?.tk?.cine).toHaveLength(60);
  });

  it('guarda no máximo 12 amigos', () => {
    const muitos = Array(30).fill(AMIGO);
    expect(cleanFilm({ t: 'A', s: 4, com: muitos })?.com).toHaveLength(12);
    expect(cleanFilm({ t: 'A', s: 4, w: 'cine', tk: { with: muitos } })?.tk?.with).toHaveLength(12);
  });
});

describe('cleanFilm: dado malicioso ou no formato errado', () => {
  it('descarta pôster que não é um caminho do TMDB', () => {
    expect(cleanFilm({ t: 'A', s: 4, img: '/abc123.jpg' })?.img).toBe('/abc123.jpg');
    for (const img of ['https://site-estranho.com/x.jpg', 'javascript:alert(1)', '/../../x', '//x.com/a.jpg']) {
      expect(cleanFilm({ t: 'A', s: 4, img })?.img).toBeUndefined();
    }
  });

  it('descarta cor, data, ano e id no formato errado', () => {
    const f = cleanFilm({ t: 'A', s: 4, col: 'red', d: '26/11/2026', y: 2019, id: '12' });
    expect(f).toEqual({ t: 'A', s: 4, c: false });
    expect(cleanFilm({ t: 'A', s: 4, id: 1.5 })?.id).toBeUndefined();
    expect(cleanFilm({ t: 'A', s: 4, y: '20199' })?.y).toBeUndefined();
  });

  it('descarta amigos com id que não é UUID', () => {
    const f = cleanFilm({ t: 'A', s: 4, com: [AMIGO, 'robert); drop table', 7, null] });
    expect(f?.com).toEqual([AMIGO]);
    expect(cleanFilm({ t: 'A', s: 4, com: ['x'] })?.com).toBeUndefined();
  });

  it('descarta momento infinito, negativo ou no futuro', () => {
    for (const ts of [Infinity, -5, 0, Date.now() + 10 * 86_400_000, '123']) {
      expect(cleanFilm({ t: 'A', s: 4, ts })?.ts).toBeUndefined();
    }
    expect(cleanFilm({ t: 'A', s: 4, ts: 1_700_000_000_000.4 })?.ts).toBe(1_700_000_000_000);
  });

  it('descarta nota anterior e contagem fora do limite', () => {
    expect(cleanFilm({ t: 'A', s: 4, p: 7, n: 1 })).toEqual({ t: 'A', s: 4, c: false });
    expect(cleanFilm({ t: 'A', s: 4, n: 3 })?.n).toBe(3);
  });

  it('ignora campos que não são do app', () => {
    const veneno = JSON.parse('{"t":"A","s":4,"admin":true,"user_id":"outra-pessoa","__proto__":{"hack":1}}');
    const f = cleanFilm(veneno)!;
    expect(Object.keys(f).every((k) => CAMPOS.includes(k))).toBe(true);
    expect((f as unknown as Record<string, unknown>).hack).toBeUndefined();
    expect(({} as Record<string, unknown>).hack).toBeUndefined();
  });

  it('só marca spoiler quando tem review', () => {
    expect(cleanFilm({ t: 'A', s: 4, sp: true })?.sp).toBeUndefined();
    expect(cleanFilm({ t: 'A', s: 4, note: 'ótimo', sp: true })?.sp).toBe(true);
    expect(cleanFilm({ t: 'A', s: 4, note: 'ótimo', sp: 'true' })?.sp).toBeUndefined();
  });

  it('só guarda ingresso quando viu no cinema', () => {
    expect(cleanFilm({ t: 'A', s: 4, w: 'casa', tk: { cine: 'Cinema da Fundação' } })?.tk).toBeUndefined();
    expect(cleanFilm({ t: 'A', s: 4, w: 'cine', tk: { cine: 'Cinema da Fundação' } })?.tk).toEqual({ cine: 'Cinema da Fundação' });
    expect(cleanFilm({ t: 'A', s: 4, w: 'praia' })?.w).toBeUndefined();
  });

  it('"indicado por" só vale para filme sem nota', () => {
    expect(cleanFilm({ t: 'A', s: 4, by: 'Teteus' })?.by).toBeUndefined();
  });
});

const avaliado = (s: number, extra: Partial<Film> = {}): RatedFilm => ({ t: 'Bacurau', id: 1, s, c: false, ...extra });

describe('films.putRated', () => {
  it('coloca o filme novo no topo', () => {
    films.setStatus({ id: 2, t: 'Aquarius' }, 'want');
    expect(films.putRated(avaliado(4.5))).toBeNull();
    expect(films.all[0].t).toBe('Bacurau');
    expect(films.all).toHaveLength(2);
  });

  it('substitui o registro anterior do mesmo filme e devolve o antigo', () => {
    const antigo = films.setStatus({ id: 1, t: 'Bacurau' }, 'want');
    expect(films.putRated(avaliado(4))).toBe(antigo);
    expect(films.all).toHaveLength(1);
    expect(films.all[0].s).toBe(4);
  });

  it('undoRated volta a lista ao que era', () => {
    const antigo = films.setStatus({ id: 1, t: 'Bacurau' }, 'want');
    const nota = avaliado(4);
    films.undoRated(nota, films.putRated(nota));
    expect(films.all).toEqual([antigo]);
  });
});

describe('films.setStatus', () => {
  it('nunca rebaixa um filme avaliado', () => {
    const nota = avaliado(4.5);
    films.putRated(nota);
    expect(films.setStatus({ id: 1, t: 'Bacurau' }, 'want')).toBe(nota);
    expect(films.setStatus({ id: 1, t: 'Bacurau' }, 'seen')).toBe(nota);
    expect(films.all).toEqual([nota]);
    expect(isRated(films.all[0])).toBe(true);
  });

  it('marca como visto com a data de hoje', () => {
    expect(films.setStatus({ id: 1, t: 'Bacurau' }, 'seen').d).toBe(today());
  });

  it('mantém a data de visto que já existia', () => {
    films.replaceAll([{ t: 'Bacurau', id: 1, st: 'seen', c: false, d: '2025-01-10' }]);
    expect(films.setStatus({ id: 1, t: 'Bacurau' }, 'seen').d).toBe('2025-01-10');
  });

  it('mantém o "indicado por" ao salvar de novo no Quero ver', () => {
    films.setStatus({ id: 1, t: 'Bacurau' }, 'want', 'Teteus');
    expect(films.setStatus({ id: 1, t: 'Bacurau' }, 'want').by).toBe('Teteus');
    expect(films.all).toHaveLength(1);
  });
});

describe('films.merge', () => {
  it('conta os filmes novos e os atualizados', () => {
    films.setStatus({ id: 1, t: 'Bacurau' }, 'want');
    const r = films.merge([avaliado(4), { t: 'Aquarius', id: 2, s: 5, c: false }]);
    expect(r).toEqual({ added: 1, updated: 1 });
    expect(films.all).toHaveLength(2);
  });

  it('mantém a ordem do backup, com o primeiro no topo', () => {
    films.merge([{ t: 'A', s: 4, c: false }, { t: 'B', s: 3, c: false }]);
    expect(films.all.map((f) => f.t)).toEqual(['A', 'B']);
  });

  it('nunca rebaixa um filme avaliado', () => {
    films.putRated(avaliado(4.5));
    const r = films.merge([
      { t: 'Bacurau', id: 1, st: 'want', c: false },
      { t: 'Bacurau', id: 1, st: 'seen', c: false },
    ]);
    expect(r).toEqual({ added: 0, updated: 0 });
    expect(films.all).toHaveLength(1);
    expect(films.all[0].s).toBe(4.5);
  });

  it('troca a nota quando o backup também tem nota', () => {
    films.putRated(avaliado(3));
    films.merge([avaliado(5)]);
    expect(films.all[0].s).toBe(5);
  });

  it('dá um momento ao filme que chega sem', () => {
    films.merge([{ t: 'A', s: 4, c: false }]);
    expect(films.all[0].ts).toBeGreaterThan(0);
  });
});
