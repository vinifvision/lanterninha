import { beforeEach, describe, expect, it } from 'vitest';
import { exportBackup, importBackup } from './backup';
import { films } from './films';

const ERRO = 'Não consegui ler esse arquivo.';

/** Monta um arquivo .json de mentira, como se a pessoa tivesse escolhido no celular. */
const arquivo = (conteudo: unknown) =>
  new File([typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo)], 'backup.json', { type: 'application/json' });

beforeEach(() => films.replaceAll([]));

describe('importBackup', () => {
  it('lê o formato do app ({ filmes: [...] })', async () => {
    await importBackup(arquivo({ app: 'lanterninha', versao: 1, filmes: [{ t: 'Bacurau', s: 4.5, c: false }, { t: 'Aquarius', st: 'want', c: false }] }));
    expect(films.all.map((f) => f.t)).toEqual(['Bacurau', 'Aquarius']);
  });

  it('lê uma lista pura de filmes', async () => {
    await importBackup(arquivo([{ t: 'Bacurau', s: 4.5, c: false }]));
    expect(films.all).toHaveLength(1);
  });

  it('descarta os filmes inválidos e deixa entrar o resto', async () => {
    await importBackup(arquivo({ filmes: [{ t: 'Bacurau', s: 4 }, { t: '', s: 3 }, null, 'texto', { t: 'Nota 99', s: 99 }] }));
    expect(films.all.map((f) => f.t)).toEqual(['Bacurau']);
  });

  it('limpa os campos perigosos de quem entra', async () => {
    await importBackup(arquivo([{ t: 'Bacurau', s: 4, img: 'https://site-estranho.com/x.jpg', ts: Infinity, admin: true }]));
    const f = films.all[0] as unknown as Record<string, unknown>;
    expect(f.img).toBeUndefined();
    expect(f.admin).toBeUndefined();
    expect(Number.isFinite(f.ts)).toBe(true);
  });

  it('avisa e não muda nada com arquivo quebrado, vazio ou sem filme válido', async () => {
    films.setStatus({ id: 1, t: 'Bacurau' }, 'want');
    const antes = films.all.slice();
    for (const c of ['{ isso não é json', '', 'null', [], { filmes: [] }, { filmes: 'texto' }, [{ t: '' }]]) {
      expect(await importBackup(arquivo(c))).toBe(ERRO);
    }
    expect(films.all).toEqual(antes);
  });

  it('backup antigo não apaga a nota de um filme avaliado', async () => {
    films.putRated({ t: 'Bacurau', id: 1, s: 4.5, c: false });
    await importBackup(arquivo({ filmes: [{ t: 'Bacurau', id: 1, st: 'want', c: false }] }));
    expect(films.all).toHaveLength(1);
    expect(films.all[0].s).toBe(4.5);
    expect(films.all[0].st).toBeUndefined();
  });
});

describe('exportBackup', () => {
  it('avisa quando ainda não há filmes', async () => {
    expect(await exportBackup()).toBe('Ainda não há filmes para exportar.');
  });
});
