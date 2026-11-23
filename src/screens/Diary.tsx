// Diário: os filmes vistos, mês a mês (o antigo "Meus filmes"). Abre pelo perfil.
// Tem busca por nome, filtros (ano, nota, só cinema), dá para ordenar por "Mais recentes" (mês a mês)
// ou "Maior nota" e ver em lista (padrão) ou em grade de pôsteres, que continua separada por mês.
import { ChipMenu } from '../components/ChipMenu';
import { Poster } from '../components/Poster';
import { useCloud } from '../lib/cloud';
import { fkey, isRated, useFilms } from '../lib/films';
import { fmt, MONTHS, pname } from '../lib/format';
import type { Film } from '../lib/types';
import { nav, useKept } from '../nav';

/** Ordem do diário: o visto mais recente primeiro. */
export const byDiary = (a: Film, b: Film) => (b.d || '').localeCompare(a.d || '') || (b.ts || 0) - (a.ts || 0);

/** Maior nota primeiro; quem não tem nota ("Já vi") vai para o fim. Empate: ordem do diário. */
const byScore = (a: Film, b: Film) => (isRated(b) ? b.s : -1) - (isRated(a) ? a.s : -1) || byDiary(a, b);

/** Texto sem acento e em minúsculas, para a busca achar "acao" em "Ação". */
const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

type Sort = 'recent' | 'nota';
const WEEK = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MON = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// Tudo com useKept: ao abrir um filme e voltar, o diário fica como estava (grade, filtros, busca).
// Saindo para outra aba e entrando de novo, volta ao padrão: lista, todos os anos, mais recentes.
export function Diary() {
  const all = useFilms();
  const { friends } = useCloud();
  const watched = all.filter((h) => h.st !== 'want').sort(byDiary);
  const years = [...new Set(watched.map((h) => (h.d || '').slice(0, 4)).filter(Boolean))];
  // Notas que existem no diário (da maior para a menor), para o filtro só mostrar o que tem
  const scores = [...new Set(watched.filter(isRated).map((h) => h.s))].sort((a, b) => b - a);
  const hasSeen = watched.some((h) => !isRated(h));
  const [year, setYear] = useKept('year', '');
  const [nota, setNota] = useKept('nota', ''); // '' = todas, 'none' = "Já vi" (sem nota), '4.5' = só ★ 4,5
  const [cine, setCine] = useKept('cine', false);
  const [sort, setSort] = useKept<Sort>('sort', 'recent');
  const [q, setQ] = useKept('q', '');
  const [grid, setGrid] = useKept('grid', false);

  const term = fold(q.trim());
  const list = watched.filter((h) =>
    (!year || (h.d || '').startsWith(year)) &&
    (!nota || (nota === 'none' ? !isRated(h) : isRated(h) && String(h.s) === nota)) &&
    (!cine || h.w === 'cine') &&
    (!term || fold(h.t).includes(term) || fold(h.o || '').includes(term)));
  const byNote = sort === 'nota';
  if (byNote) list.sort(byScore);
  // "Mais recentes": um bloco por mês. "Maior nota": um bloco só, sem os meses.
  const groups: { key: string; items: Film[] }[] = [];
  if (byNote) { if (list.length) groups.push({ key: 'nota', items: list }); } else list.forEach((h) => {
    const k = h.d ? h.d.slice(0, 7) : '';
    const last = groups[groups.length - 1];
    if (last && last.key === k) last.items.push(h); else groups.push({ key: k, items: [h] });
  });
  const monthName = (k: string) => {
    if (k === 'nota') return 'Maior nota';
    if (!k) return 'Sem data';
    const m = MONTHS[+k.slice(5, 7) - 1];
    return year ? m : `${m} de ${k.slice(0, 4)}`;
  };
  /** Embaixo do dia: o dia da semana ou, em "Maior nota" (sem os meses), o mês (e o ano, se não houver filtro de ano). */
  const dayNote = (d: string) => byNote ? MON[+d.slice(5, 7) - 1] + (year ? '' : ` ${d.slice(2, 4)}`) : WEEK[new Date(d + 'T12:00:00').getDay()];
  // O que aparece ao lado da nota: cinema (com quem), review, revisto
  const extra = (h: Film) => {
    const parts: string[] = [];
    if (h.w === 'cine') {
      const names = (h.tk?.with || [])
        .map((id) => friends.list.find((p) => p.id === id))
        .filter(Boolean)
        .map((p) => pname(p).split(' ')[0]);
      parts.push(names.length ? `Cinema · com ${names.join(', ')}` : 'Cinema');
    }
    if (h.note) parts.push('Review');
    if ((h.n || 1) > 1) parts.push('Revi');
    return parts.join(' · ');
  };
  const empty = !watched.length
    ? 'Seu diário começa quando você avalia um filme ou marca "Já vi".'
    : term ? 'Nenhum filme com esse nome.' : 'Nenhum filme com esse filtro.';

  const row = (h: Film) => {
    const x = extra(h);
    return (
      <button key={fkey(h)} className="v2drow" onClick={() => nav.openFilm(h)}>
        <span className={`v2day${byNote ? ' wide' : ''}`}>
          <b>{h.d ? String(+h.d.slice(8, 10)) : '–'}</b>
          <small>{h.d ? dayNote(h.d) : ''}</small>
        </span>
        <span className="v2dpos"><Poster img={h.img} title={h.t} size="w92" /></span>
        <span className="v2dtxt">
          <b>{h.t}</b>
          <span>
            <em>{isRated(h) ? '★ ' + fmt(h.s) : 'Já vi'}</em>
            {x && <small>{x}</small>}
          </span>
        </span>
      </button>
    );
  };
  // Na grade, o dia fica num selinho em cima do pôster, para continuar com cara de diário
  const cell = (h: Film, i: number) => (
    <button key={fkey(h)} className="v2dcell" style={{ animationDelay: `${Math.min(i, 16) * 22}ms` }} onClick={() => nav.openFilm(h)}>
      <span className="v2dcpos">
        <Poster img={h.img} title={h.t} />
        {h.d && <i className="v2dcday"><b>{+h.d.slice(8, 10)}</b><small>{dayNote(h.d)}</small></i>}
      </span>
      <small className="v2dcnote">
        {isRated(h) ? '★ ' + fmt(h.s) : 'Já vi'}
        {h.w === 'cine' && (
          <svg viewBox="0 0 24 24" aria-label="Cinema"><path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z" /></svg>
        )}
      </small>
    </button>
  );

  return (
    <div className="screen v2diary">
      {watched.length > 0 && (
        <div className="v2dflt">
          {years.length > 0 && (
            <ChipMenu
              label="Ano" value={year} onChange={setYear}
              options={[{ value: '', label: 'Todos' }, ...years.map((y) => ({ value: y, label: y }))]}
            />
          )}
          {scores.length > 0 && (
            <ChipMenu
              label="Nota" value={nota} onChange={setNota} chip="Nota"
              options={[
                { value: '', label: 'Todas as notas' },
                ...scores.map((s) => ({ value: String(s), label: `★ ${fmt(s)}` })),
                ...(hasSeen ? [{ value: 'none', label: 'Sem nota (Já vi)' }] : []),
              ]}
            />
          )}
          <ChipMenu<Sort>
            label="Ordenar" value={sort} onChange={setSort}
            options={[{ value: 'recent', label: 'Mais recentes' }, { value: 'nota', label: 'Maior nota' }]}
          />
          <button className={`v2chip${cine ? ' on' : ''}`} aria-pressed={cine} onClick={() => setCine(!cine)}>Só cinema</button>
        </div>
      )}
      <div className="v2dtop">
        <h1 className="v2dh">Diário</h1>
        {watched.length > 0 && (
          <button className="v2round" aria-label={grid ? 'Ver em lista' : 'Ver em grade'} onClick={() => setGrid(!grid)}>
            {grid
              ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
              : <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></svg>}
          </button>
        )}
      </div>
      {watched.length > 0 && (
        <div className="v2find">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            type="search" aria-label="Buscar no diário" maxLength={80} value={q} placeholder="Buscar no diário"
            autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="search" onChange={(e) => setQ(e.target.value)}
          />
          {q && <button type="button" className="v2clr" aria-label="Apagar" onClick={() => setQ('')}>✕</button>}
        </div>
      )}
      {list.length === 0 && <p className="empty">{empty}</p>}
      {groups.map((g) => (
        <section key={g.key || 'sem-data'} className="v2month">
          <div className="v2mh">
            <h2>{monthName(g.key)}</h2>
            <span>{g.items.length} {g.items.length === 1 ? 'filme' : 'filmes'}</span>
          </div>
          {grid ? <div className="v2dgrid">{g.items.map(cell)}</div> : g.items.map(row)}
        </section>
      ))}
    </div>
  );
}
