// Aba Meus filmes: assistidos (com ou sem nota, em diário ou por nota) e a fila, com busca.
import { useState } from 'react';
import { FilmCard } from '../components/FilmCard';
import { Poster } from '../components/Poster';
import { cloud, useCloud } from '../lib/cloud';
import { films, fkey, isRated, useFilms } from '../lib/films';
import { fmt, MONTHS, pname } from '../lib/format';
import type { Film } from '../lib/types';
import { nav } from '../nav';

type LibTab = 'watched' | 'want';
type Sort = 'recent' | 'nota' | 'menor';

// As escolhas da tela ficam guardadas enquanto a pessoa passeia pelo app.
const view = { tab: 'watched' as LibTab, sort: 'recent' as Sort, star: 0, q: '' };
export const resetLibraryView = () => { view.tab = 'watched'; view.sort = 'recent'; view.star = 0; view.q = ''; };

const SORTS: [Sort, string][] = [['recent', 'Diário'], ['nota', 'Maior nota'], ['menor', 'Menor nota']];
const EMPTY: Record<LibTab, string> = {
  watched: 'Nada por aqui ainda. Avalie um filme ou marque como "Já vi" e ele aparece nesta tela.',
  want: 'Aqui fica sua fila: o que você guardou e o que seus amigos indicaram.',
};

export function Library() {
  const all = useFilms();
  const account = useCloud();
  const [tab, setTab] = useState(view.tab);
  const [sort, setSort] = useState(view.sort);
  const [star, setStar] = useState(view.star);
  const [q, setQ] = useState(view.q);
  Object.assign(view, { tab, sort, star, q });

  const rated = all.filter(isRated);
  const count = { rated: rated.length, watched: all.filter((h) => h.st !== 'want').length, want: all.filter((h) => h.st === 'want').length };
  const year = String(new Date().getFullYear());
  const avg = rated.length ? fmt(Math.round((rated.reduce((a, h) => a + h.s, 0) / rated.length) * 10) / 10) : '–';
  const thisYear = rated.filter((h) => (h.d || '').startsWith(year)).length;
  const recs = tab === 'want' ? account.recs : [];
  const queueTotal = count.want + account.recs.length;

  const needle = q.trim().toLowerCase();
  const bucket = (h: Film) => Math.max(1, Math.floor(h.s || 0));
  const byTs = (a: Film, b: Film) => (b.ts || 0) - (a.ts || 0);
  // Assistidos = avaliados + vistos sem nota
  let list = all.filter((h) => (tab === 'want' ? h.st === 'want' : h.st !== 'want'))
    .filter((h) => !needle || h.t.toLowerCase().includes(needle) || (h.o || '').toLowerCase().includes(needle));
  if (tab === 'watched') {
    // star: 0 = todas, 1 a 5 = faixa de nota, -1 = sem nota
    list = list.filter((h) => !star || (star === -1 ? !isRated(h) : isRated(h) && bucket(h) === star));
    // Nas ordens por nota, quem não tem nota vai para o fim
    const val = (h: Film, none: number) => (isRated(h) ? h.s : none);
    if (sort === 'nota') list.sort((a, b) => val(b, -1) - val(a, -1) || byTs(a, b));
    else if (sort === 'menor') list.sort((a, b) => val(a, 99) - val(b, 99) || byTs(a, b));
    else list.sort((a, b) => (b.d || '').localeCompare(a.d || '') || byTs(a, b));
  } else list.sort(byTs);

  // No diário, os filmes são agrupados pelo mês em que foram vistos
  const groups: { key: string; items: Film[] }[] = [];
  if (tab === 'watched' && sort === 'recent') {
    list.forEach((h) => {
      const k = h.d ? h.d.slice(0, 7) : '';
      const last = groups[groups.length - 1];
      if (last && last.key === k) last.items.push(h); else groups.push({ key: k, items: [h] });
    });
  }
  const card = (h: Film, i: number) => <FilmCard key={fkey(h)} film={h} delay={Math.min(i, 12) * 25} onClick={() => nav.openFilm(h)} />;
  const emptyMsg = needle ? 'Nenhum filme com esse nome.' : tab === 'watched' && star ? (star === -1 ? 'Todos os seus filmes têm nota.' : 'Nenhum filme com essa nota.') : EMPTY[tab];

  return (
    <div className="screen">
      <h1>Meus filmes</h1>
      <p className="lsum">
        <b>{count.watched}</b> {count.watched === 1 ? 'assistido' : 'assistidos'} · média <b>{avg}</b>
        {thisYear > 0 && <> · <b>{thisYear}</b> em {year}</>}
      </p>
      {all.length > 5 && (
        <input type="text" className="lq" id="lq" placeholder="Buscar nos meus filmes" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" autoCorrect="off" spellCheck={false} />
      )}
      <div className="seg">
        <button className={tab === 'watched' ? 'on' : ''} data-t="watched" onClick={() => setTab('watched')}>Assistidos{count.watched ? ' · ' + count.watched : ''}</button>
        <button className={tab === 'want' ? 'on' : ''} data-t="want" onClick={() => setTab('want')}>Quero ver{queueTotal ? ' · ' + queueTotal : ''}</button>
      </div>
      {tab === 'watched' && count.watched > 0 && (
        <div className="chipsf">
          {SORTS.map(([k, label]) => <button key={k} data-s={k} className={sort === k ? 'on' : ''} onClick={() => setSort(k)}>{label}</button>)}
          <span style={{ width: 1, background: 'var(--card2)', flex: 'none', margin: '6px 2px' }} />
          {[0, 5, 4, 3, 2, 1, ...(count.watched > count.rated ? [-1] : [])].map((n) => <button key={n} data-n={n} className={star === n ? 'on' : ''} onClick={() => setStar(n)}>{n === -1 ? 'Sem nota' : n ? '★ ' + n : 'Todas'}</button>)}
        </div>
      )}

      {tab === 'want' && count.want > 1 && (
        <button className="plain" id="tnlib" style={{ marginBottom: 18 }} onClick={() => nav.open({ k: 'tonight', start: 'queue' })}>Sortear um filme da fila</button>
      )}
      {recs.length > 0 && (
        <>
          <div className="sech"><h3>Indicações para você</h3></div>
          {recs.map((r) => (
            <div className="rcd" key={r.id}>
              {r.film.img ? <Poster img={r.film.img} title="" fallback={false} /> : <div className="noimg" />}
              <div>
                <b>{r.film.t}</b>
                <small>de {pname(r.p)}{r.film.y ? ' · ' + r.film.y : ''}</small>
                {r.note && <p>“{r.note}”</p>}
                <div className="row2">
                  <button className="mini" data-ra onClick={() => { films.setStatus(r.film, 'want', pname(r.p)); void cloud.dropRec(r.id); }}>Quero ver</button>
                  <button className="mini no" data-rd onClick={() => void cloud.dropRec(r.id)}>Dispensar</button>
                </div>
              </div>
            </div>
          ))}
          <div style={{ height: 18 }} />
        </>
      )}

      <div id="lbody">
        {list.length === 0 && !(recs.length && !needle) && <p className="empty">{emptyMsg}</p>}
        {groups.length > 0
          ? groups.map((g) => (
              <div key={g.key || 'sem-data'}>
                <div className="mhead">{g.key ? `${MONTHS[+g.key.slice(5, 7) - 1]} de ${g.key.slice(0, 4)}` : 'Sem data'}<span>{g.items.length}</span></div>
                <div className="grid">{g.items.map(card)}</div>
              </div>
            ))
          : list.length > 0 && <div className="grid">{list.map(card)}</div>}
      </div>
    </div>
  );
}
