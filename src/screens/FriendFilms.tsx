// Todos os filmes que um amigo avaliou, em grade. Abre pelo "N filmes" do perfil dele ou pelo "Ver os N".
import { useState } from 'react';
import { useAsync } from '../components/hooks';
import { Poster } from '../components/Poster';
import { cloud, useCloud } from '../lib/cloud';
import { fkey, useFilms } from '../lib/films';
import { fmt, pname } from '../lib/format';
import { useRefresh } from '../lib/refresh';
import type { RatedFilm } from '../lib/types';
import { nav } from '../nav';
import { unseenBy } from './FriendPage';

type Show = 'all' | 'unseen';

export function FriendFilms({ id, only }: { id: string; only?: 'unseen' }) {
  const { friends } = useCloud();
  const p = friends.list.find((x) => x.id === id);
  const mine = useFilms();
  const tick = useRefresh();
  const films = useAsync<RatedFilm[] | null>(() => cloud.friendFilms(id), [id, tick], true);
  const [show, setShow] = useState<Show>(only || 'all');

  if (!p) return <div className="screen"><p className="empty">Essa pessoa não está mais na sua lista de amigos.</p></div>;
  const name = pname(p);
  const list = !films ? [] : show === 'unseen' ? unseenBy(films, mine) : [...films].sort((a, b) => b.s - a.s);
  const open = (f: RatedFilm) => nav.open({ k: 'reviews', info: f, focusId: id, known: { p, f } });

  return (
    <div className="screen v2fr">
      <h1 className="v2frtitle">Filmes de {name}</h1>
      <div className="v2chips" role="tablist">
        <button role="tab" aria-selected={show === 'all'} className={show === 'all' ? 'on' : ''} onClick={() => setShow('all')}>Todos</button>
        <button role="tab" aria-selected={show === 'unseen'} className={show === 'unseen' ? 'on' : ''} onClick={() => setShow('unseen')}>Você não viu</button>
      </div>
      {films === undefined && <p className="empty">Carregando os filmes…</p>}
      {films === null && <p className="empty">Não consegui carregar os filmes agora.</p>}
      {films && list.length === 0 && (
        <p className="empty">{show === 'unseen' ? `Você já viu tudo que ${name} avaliou.` : 'Ainda não avaliou nenhum filme.'}</p>
      )}
      <div className="v2frgrid">
        {list.map((h) => (
          <button key={fkey(h)} onClick={() => open(h)}>
            <span className="v2rpos"><Poster img={h.img} title={h.t} /></span>
            <small>★ {fmt(h.s)}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
