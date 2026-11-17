// Aba Meus filmes: avaliados (em diário ou por nota), já vistos e a fila, com busca.
import { useState } from 'react';
import { FilmCard } from '../components/FilmCard';
import { Poster } from '../components/Poster';
import { cloud, useCloud } from '../lib/cloud';
import { films, fkey, isRated, useFilms } from '../lib/films';
import { fmt, MONTHS, pname } from '../lib/format';
import type { Film } from '../lib/types';
import { nav } from '../nav';

type LibTab = 'rated' | 'seen' | 'want';
type Sort = 'recent' | 'nota' | 'menor';

// As escolhas da tela ficam guardadas enquanto a pessoa passeia pelo app.
const view = { tab: 'rated' as LibTab, sort: 'recent' as Sort, star: 0, q: '' };
export const resetLibraryView = () => { view.tab = 'rated'; view.sort = 'recent'; view.star = 0; view.q = ''; };

const SORTS: [Sort, string][] = [['recent', 'Diário'], ['nota', 'Maior nota'], ['menor', 'Menor nota']];
const EMPTY: Record<LibTab, string> = {
  rated: 'Nada por aqui ainda. Avalie um filme e ele aparece nesta tela.',
  seen: 'Aqui ficam os filmes que você viu mas não deu nota.',
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
  const count = { rated: rated.length, seen: all.filter((h) => h.st === 'seen').length, want: all.filter((h) => h.st === 'want').length };
  const year = String(new Date().getFullYear());
  const avg = rated.length ? fmt(Math.round((rated.reduce((a, h) => a + h.s, 0) / rated.length) * 10) / 10) : '–';
  const thisYear = rated.filter((h) => (h.d || '').startsWith(year)).length;
  const recs = tab === 'want' ? account.recs : [];
  const queueTotal = count.want + account.recs.length;

  const needle = q.trim().toLowerCase();
  const bucket = (h: Film) => Math.max(1, Math.floor(h.s || 0));
  const byTs = (a: Film, b: Film) => (b.ts || 0) - (a.ts || 0);
  let list = all.filter((h) => (h.st || 'rated') === tab).filter((h) => !needle || h.t.toLowerCase().includes(needle) || (h.o || '').toLowerCase().includes(needle));
  if (tab === 'rated') {
    list = list.filter((h) => !star || bucket(h) === star);
    if (sort === 'nota') list.sort((a, b) => (b.s || 0) - (a.s || 0) || byTs(a, b));
    else if (sort === 'menor') list.sort((a, b) => (a.s || 0) - (b.s || 0) || byTs(a, b));
    else list.sort((a, b) => (b.d || '').localeCompare(a.d || '') || byTs(a, b));
  } else list.sort(byTs);

  // No diário, os filmes são agrupados pelo mês em que foram vistos
  const groups: { key: string; items: Film[] }[] = [];
  if (tab === 'rated' && sort === 'recent') {
    list.forEach((h) => {
      const k = h.d ? h.d.slice(0, 7) : '';
      const last = groups[groups.length - 1];
      if (last && last.key === k) last.items.push(h); else groups.push({ key: k, items: [h] });
    });
  }
  const card = (h: Film, i: number) => <FilmCard key={fkey(h)} film={h} delay={Math.min(i, 12) * 25} onClick={() => nav.openFilm(h)} />;
  const emptyMsg = needle ? 'Nenhum filme com esse nome.' : tab === 'rated' && star ? 'Nenhum filme com essa nota.' : EMPTY[tab];

  return (
    <div className="screen">
      <h1>Meus filmes</h1>
      <p className="lsum">
        <b>{count.rated}</b> {count.rated === 1 ? 'avaliado' : 'avaliados'} · média <b>{avg}</b>
        {thisYear > 0 && <> · <b>{thisYear}</b> em {year}</>}
      </p>
      {all.length > 5 && (
        <input type="text" className="lq" id="lq" placeholder="Buscar nos meus filmes" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" autoCorrect="off" spellCheck={false} />
      )}
      <div className="seg">
        <button className={tab === 'rated' ? 'on' : ''} data-t="rated" onClick={() => setTab('rated')}>Avaliados</button>
        <button className={tab === 'seen' ? 'on' : ''} data-t="seen" onClick={() => setTab('seen')}>Já vi{count.seen ? ' · ' + count.seen : ''}</button>
        <button className={tab === 'want' ? 'on' : ''} data-t="want" onClick={() => setTab('want')}>Quero ver{queueTotal ? ' · ' + queueTotal : ''}</button>
      </div>
      {tab === 'rated' && count.rated > 0 && (
        <div className="chipsf">
          {SORTS.map(([k, label]) => <button key={k} data-s={k} className={sort === k ? 'on' : ''} onClick={() => setSort(k)}>{label}</button>)}
          <span style={{ width: 1, background: 'var(--card2)', flex: 'none', margin: '6px 2px' }} />
          {[0, 5, 4, 3, 2, 1].map((n) => <button key={n} data-n={n} className={star === n ? 'on' : ''} onClick={() => setStar(n)}>{n ? '★ ' + n : 'Todas'}</button>)}
        </div>
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
