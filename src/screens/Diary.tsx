// Diário: os filmes vistos, mês a mês (o antigo "Meus filmes"). Abre pelo perfil.
// Tem busca por nome e dá para ordenar por "Mais recentes" (mês a mês) ou "Maior nota".
import { useState } from 'react';
import { ChipMenu } from '../components/ChipMenu';
import { Poster } from '../components/Poster';
import { useCloud } from '../lib/cloud';
import { fkey, isRated, useFilms } from '../lib/films';
import { fmt, MONTHS, pname } from '../lib/format';
import type { Film } from '../lib/types';
import { nav } from '../nav';

/** Ordem do diário: o visto mais recente primeiro. */
export const byDiary = (a: Film, b: Film) => (b.d || '').localeCompare(a.d || '') || (b.ts || 0) - (a.ts || 0);

/** Maior nota primeiro; quem não tem nota ("Já vi") vai para o fim. Empate: ordem do diário. */
const byScore = (a: Film, b: Film) => (isRated(b) ? b.s : -1) - (isRated(a) ? a.s : -1) || byDiary(a, b);

/** Texto sem acento e em minúsculas, para a busca achar "acao" em "Ação". */
const fold = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

type Sort = 'recent' | 'nota';
const WEEK = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MON = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
// Os filtros ficam guardados enquanto a pessoa passeia pelo app. O ano não: sempre abre em "Todos".
const view = { cine: false, sort: 'recent' as Sort, q: '' };

export function Diary() {
  const all = useFilms();
  const { friends } = useCloud();
  const watched = all.filter((h) => h.st !== 'want').sort(byDiary);
  const years = [...new Set(watched.map((h) => (h.d || '').slice(0, 4)).filter(Boolean))];
  const [year, setYear] = useState('');
  const [cine, setCine] = useState(view.cine);
  const [sort, setSort] = useState<Sort>(view.sort);
  const [q, setQ] = useState(view.q);
  Object.assign(view, { cine, sort, q });

  const term = fold(q.trim());
  const list = watched.filter((h) =>
    (!year || (h.d || '').startsWith(year)) &&
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
  // O que aparece ao lado da nota: cinema (com quem), review, revisto, Baú
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
    if (h.b) parts.push('Do Baú');
    return parts.join(' · ');
  };
  const empty = !watched.length
    ? 'Seu diário começa quando você avalia um filme ou marca "Já vi".'
    : term ? 'Nenhum filme com esse nome.' : 'Nenhum filme com esse filtro.';

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
          <ChipMenu<Sort>
            label="Ordenar" value={sort} onChange={setSort}
            options={[{ value: 'recent', label: 'Mais recentes' }, { value: 'nota', label: 'Maior nota' }]}
          />
          <button className={`v2chip${cine ? ' on' : ''}`} aria-pressed={cine} onClick={() => setCine(!cine)}>Só cinema</button>
        </div>
      )}
      <h1 className="v2dh">Diário</h1>
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
          {g.items.map((h) => {
            const x = extra(h);
            return (
              <button key={fkey(h)} className="v2drow" onClick={() => nav.openFilm(h)}>
                <span className={`v2day${byNote ? ' wide' : ''}`}>
                  <b>{h.d ? String(+h.d.slice(8, 10)) : '–'}</b>
                  {/* Em "Maior nota" os meses somem, então o dia vem com o mês (e o ano, se não houver filtro de ano) */}
                  <small>{!h.d ? '' : byNote ? MON[+h.d.slice(5, 7) - 1] + (year ? '' : ` ${h.d.slice(2, 4)}`) : WEEK[new Date(h.d + 'T12:00:00').getDay()]}</small>
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
          })}
        </section>
      ))}
    </div>
  );
}
