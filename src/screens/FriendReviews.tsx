// Reviews de um amigo: os filmes em que ele escreveu alguma coisa, do mais recente para o mais antigo.
// O perfil dele mostra as 2 mais recentes (ReviewCard) e o "Ver todas" abre esta tela.
// Review com spoiler de filme que você não viu fica escondida até abrir.
import { useAsync } from '../components/hooks';
import { Poster } from '../components/Poster';
import { cloud, useCloud } from '../lib/cloud';
import { fkey, isRated, useFilms } from '../lib/films';
import { fmt, MONTHS, pname } from '../lib/format';
import { useRefresh } from '../lib/refresh';
import type { Film } from '../lib/types';
import { openFriendFilm } from './FriendFilms';
import { byDiary } from './Diary';
import { withReview } from './MyReviews';

const when = (d?: string) => (d ? `${+d.slice(8, 10)} de ${MONTHS[+d.slice(5, 7) - 1].toLowerCase()} de ${d.slice(0, 4)}` : '');

/** Um cartão de review do amigo. `seen` = você já viu o filme (aí o spoiler aparece direto). */
export function ReviewCard({ id, h, seen }: { id: string; h: Film; seen: boolean }) {
  const hide = !!h.sp && !seen;
  return (
    <button className="v2rev" onClick={() => openFriendFilm(id, h)}>
      <span className="v2dpos"><Poster img={h.img} title={h.t} size="w92" /></span>
      <span className="v2revt">
        <b>{h.t}</b>
        <span>
          <em>{isRated(h) ? '★ ' + fmt(h.s) : 'Já vi'}</em>
          {h.d && <small>{when(h.d)}</small>}
        </span>
        {hide ? <q className="v2ffsp">Tem spoiler. Toque para ler.</q> : <q>{h.note!.trim()}</q>}
      </span>
    </button>
  );
}

export function FriendReviews({ id }: { id: string }) {
  const { friends } = useCloud();
  const p = friends.list.find((x) => x.id === id);
  const mine = useFilms();
  const tick = useRefresh();
  const films = useAsync<Film[] | null>(() => cloud.friendWatched(id), [id, tick], true);
  if (!p) return <div className="screen"><p className="empty">Essa pessoa não está mais na sua lista de amigos.</p></div>;
  const seen = new Set(mine.filter((h) => h.st !== 'want').map(fkey));
  const list = films ? withReview(films).sort(byDiary) : [];
  return (
    <div className="screen v2diary">
      <h1 className="v2dh">Reviews de {pname(p)}</h1>
      {films === undefined && <p className="empty">Carregando as reviews…</p>}
      {films === null && <p className="empty">Não consegui carregar as reviews agora.</p>}
      {films && list.length === 0 && <p className="empty">{pname(p).split(' ')[0]} ainda não escreveu nenhuma review.</p>}
      <div className="v2revs">
        {list.map((h) => <ReviewCard key={fkey(h)} id={id} h={h} seen={seen.has(fkey(h))} />)}
      </div>
    </div>
  );
}
