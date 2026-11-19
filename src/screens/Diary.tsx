// Diário: os filmes vistos, mês a mês (o antigo "Meus filmes"). Abre pelo perfil.
import { useState } from 'react';
import { Poster } from '../components/Poster';
import { useCloud } from '../lib/cloud';
import { fkey, isRated, useFilms } from '../lib/films';
import { fmt, MONTHS, pname } from '../lib/format';
import type { Film } from '../lib/types';
import { nav } from '../nav';

/** Ordem do diário: o visto mais recente primeiro. */
export const byDiary = (a: Film, b: Film) => (b.d || '').localeCompare(a.d || '') || (b.ts || 0) - (a.ts || 0);

const WEEK = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
// Os filtros ficam guardados enquanto a pessoa passeia pelo app (null = ainda não escolheu)
const view = { year: null as string | null, cine: false };

export function Diary() {
  const all = useFilms();
  const { friends } = useCloud();
  const watched = all.filter((h) => h.st !== 'want').sort(byDiary);
  const years = [...new Set(watched.map((h) => (h.d || '').slice(0, 4)).filter(Boolean))];
  const now = String(new Date().getFullYear());
  const [year, setYear] = useState(view.year ?? (years.includes(now) ? now : ''));
  const [cine, setCine] = useState(view.cine);
  Object.assign(view, { year, cine });

  const list = watched.filter((h) => (!year || (h.d || '').startsWith(year)) && (!cine || h.w === 'cine'));
  const groups: { key: string; items: Film[] }[] = [];
  list.forEach((h) => {
    const k = h.d ? h.d.slice(0, 7) : '';
    const last = groups[groups.length - 1];
    if (last && last.key === k) last.items.push(h); else groups.push({ key: k, items: [h] });
  });
  const monthName = (k: string) => {
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
    : 'Nenhum filme com esse filtro.';

  return (
    <div className="screen v2diary">
      {watched.length > 0 && (
        <div className="v2dflt">
          {years.length > 0 && (
            <label className="v2chip v2sel">
              <select aria-label="Ano" value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="">Todos</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </label>
          )}
          <button className={`v2chip${cine ? ' on' : ''}`} aria-pressed={cine} onClick={() => setCine(!cine)}>Só cinema</button>
        </div>
      )}
      <h1 className="v2dh">Diário</h1>
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
                <span className="v2day">
                  <b>{h.d ? String(+h.d.slice(8, 10)) : '–'}</b>
                  <small>{h.d ? WEEK[new Date(h.d + 'T12:00:00').getDay()] : ''}</small>
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
