// Aba Quero ver: a fila (o que você guardou e o que os amigos indicaram), com busca.
// Os filmes já vistos ficam no Diário, que abre pelo perfil.
import { useState } from 'react';
import { FilmCard } from '../components/FilmCard';
import { Poster } from '../components/Poster';
import { cloud, useCloud } from '../lib/cloud';
import { films, fkey, useFilms } from '../lib/films';
import { pname } from '../lib/format';
import type { Film } from '../lib/types';
import { nav } from '../nav';

// A busca fica guardada enquanto a pessoa passeia pelo app.
const view = { q: '' };
export const resetLibraryView = () => { view.q = ''; };

const EMPTY = 'Aqui fica sua fila: o que você guardou e o que seus amigos indicaram.';

export function Library() {
  const all = useFilms();
  const account = useCloud();
  const [q, setQ] = useState(view.q);
  view.q = q;

  const queue = all.filter((h) => h.st === 'want');
  const recs = account.recs;
  const needle = q.trim().toLowerCase();
  const list = queue
    .filter((h) => !needle || h.t.toLowerCase().includes(needle) || (h.o || '').toLowerCase().includes(needle))
    .sort((a: Film, b: Film) => (b.ts || 0) - (a.ts || 0));
  const card = (h: Film, i: number) => <FilmCard key={fkey(h)} film={h} delay={Math.min(i, 12) * 25} onClick={() => nav.openFilm(h)} />;

  return (
    <div className="screen">
      <h1>Quero ver</h1>
      <p className="lsum">
        <b>{queue.length}</b> na fila
        {recs.length > 0 && <> · <b>{recs.length}</b> {recs.length === 1 ? 'indicação' : 'indicações'}</>}
      </p>
      {queue.length > 5 && (
        <input type="text" className="lq" id="lq" placeholder="Buscar na fila" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" autoCorrect="off" spellCheck={false} />
      )}
      {queue.length > 1 && (
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
        {list.length === 0 && !(recs.length && !needle) && <p className="empty">{needle ? 'Nenhum filme com esse nome.' : EMPTY}</p>}
        {list.length > 0 && <div className="grid">{list.map(card)}</div>}
      </div>
    </div>
  );
}
