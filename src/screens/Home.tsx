// Aba Início. Por enquanto mostra só o que o app já sabe (indicações, fila e últimas notas).
// O conteúdo novo desta tela (amigos, em cartaz, clássicos) entra depois da reorganização.
import { FilmCard } from '../components/FilmCard';
import { useCloud } from '../lib/cloud';
import { fkey, isRated, useFilms } from '../lib/films';
import { pname } from '../lib/format';
import type { Film } from '../lib/types';
import { nav } from '../nav';

export function Home() {
  const all = useFilms();
  const account = useCloud();
  const byTs = (a: Film, b: Film) => (b.ts || 0) - (a.ts || 0);
  const queue = all.filter((h) => h.st === 'want').sort(byTs).slice(0, 6);
  const recent = all.filter(isRated).sort(byTs).slice(0, 6);
  const hello = account.profile ? pname(account.profile) : '';
  const row = (list: Film[]) => <div className="grid">{list.map((h, i) => <FilmCard key={fkey(h)} film={h} delay={i * 25} onClick={() => nav.openFilm(h)} />)}</div>;
  const nothing = !queue.length && !recent.length && !account.recs.length;

  return (
    <div className="screen">
      <h1>Início</h1>
      <p className="count">{hello ? `Oi, ${hello}.` : ' '}</p>
      {account.recs.length > 0 && (
        <button className="hcard" onClick={() => nav.tab('lib')}>
          <b>{account.recs.length === 1 ? '1 indicação pra ti' : `${account.recs.length} indicações pra ti`}</b>
          <small>de {[...new Set(account.recs.map((r) => pname(r.p)))].join(', ')}</small>
          <i>›</i>
        </button>
      )}
      {queue.length > 0 && <><div className="sech"><h3>Na tua fila</h3></div>{row(queue)}</>}
      {recent.length > 0 && <><div className="sech" style={{ marginTop: 28 }}><h3>Tuas últimas notas</h3></div>{row(recent)}</>}
      {nothing && <p className="empty">Tua tela inicial vai se enchendo conforme tu avalia filmes e adiciona amigos.</p>}
      <button className="cta" style={{ marginTop: 32 }} onClick={() => nav.tab('rate')}>Avaliar um filme</button>
    </div>
  );
}
