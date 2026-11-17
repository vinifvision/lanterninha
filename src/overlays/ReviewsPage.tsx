// Reviews de um filme: a minha e as dos amigos, numa tela só.
import { useEffect, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { Overlay, OverlayHeader } from '../components/Overlay';
import { Poster } from '../components/Poster';
import { Stars } from '../components/Stars';
import { cloud, useCloud } from '../lib/cloud';
import { films, fkey, isRated, toInfo, useFilms } from '../lib/films';
import { fd, LABELS, pname, STATE } from '../lib/format';
import { looksClassic } from '../lib/quiz';
import type { Film, FilmInfo, FriendRating } from '../lib/types';
import { nav, useNav } from '../nav';

interface Props { info: FilmInfo; focusId?: string; known?: FriendRating }

export function ReviewsPage({ info: raw, focusId, known }: Props) {
  const info = toInfo(raw);
  const key = fkey(info);
  const account = useCloud();
  const { stack } = useNav();
  const mine = useFilms().find((e) => fkey(e) === key) || null;
  const rated = isRated(mine) ? mine : null;
  const [friends, setFriends] = useState<FriendRating[]>(known ? [known] : []);

  useEffect(() => {
    if (!account.user) return;
    let alive = true;
    void cloud.filmRatings(key).then((rs) => { if (alive && rs.length) setFriends(rs); });
    return () => { alive = false; };
  }, [key, account.user]);

  const top = stack[stack.length - 1];
  const onFilmPage = top?.k === 'film' && fkey(top.info) === key;
  const sub = [info.o && info.o !== info.t ? info.o : '', info.y].filter(Boolean).join(' · ');
  const when = (f: Film) => (f.d ? 'Visto em ' + fd(f.d) : '');
  const focused = focusId ? friends.find((r) => r.p.id === focusId) : undefined;
  const list = friends.slice().sort((a, b) =>
    (a.p.id === focusId ? -1 : b.p.id === focusId ? 1 : 0) || (+!!b.f.note - +!!a.f.note) || pname(a.p).localeCompare(pname(b.p)));

  return (
    <Overlay>
      <OverlayHeader
        left={<button id="vx" onClick={() => nav.close()}>Fechar</button>} title="Reviews"
        right={onFilmPage ? undefined : <button className="ok" id="vfilm" onClick={() => nav.openFilm(info)}>Filme</button>}
      />
      <div className="rvhead">
        <Poster img={info.img} title="" fallback={false} />
        <div><h2>{info.t}</h2>{sub && <p>{sub}</p>}</div>
      </div>
      <div id="rvl">
        <div className="rvc me">
          {rated ? (
            <>
              <div className="who"><Avatar p={account.profile} fallback="V" /><div><b>Você</b><small>{when(rated) || LABELS[rated.s]}</small></div><Stars value={rated.s} /></div>
              {rated.note ? <p className="txt">{rated.note}</p> : <p className="none">Você ainda não escreveu uma review.</p>}
              <div className="rowb">
                <button id="rved" onClick={() => nav.open({ k: 'editor', key })}>{rated.note ? 'Editar review' : 'Escrever review'}</button>
                <button id="rvsh" onClick={() => nav.open({ k: 'share', key })}>Compartilhar</button>
              </div>
            </>
          ) : (
            <>
              <div className="who"><Avatar p={account.profile} fallback="V" /><div><b>Você</b><small>{mine?.st ? STATE[mine.st] + ', sem nota' : 'ainda não avaliou'}</small></div></div>
              <div className="three">
                <button className="go" id="rvgo" style={{ background: 'var(--gold)' }} onClick={() => nav.startQuiz(info, { classic: looksClassic(info.y) })}>Avaliar</button>
                <button id="rvseen" onClick={() => { films.setStatus(info, 'seen'); }}>{mine?.st === 'seen' ? '✓ Já vi' : 'Já vi'}</button>
                <button id="rvwant" onClick={() => { films.setStatus(info, 'want', focused ? pname(focused.p) : ''); }}>{mine?.st === 'want' ? '✓ Quero ver' : 'Quero ver'}</button>
              </div>
            </>
          )}
        </div>
        {list.map((r) => (
          <div className={`rvc${r.p.id === focusId ? ' hl' : ''}`} key={r.p.id}>
            <div className="who"><Avatar p={r.p} /><div><b>{pname(r.p)}</b><small>{when(r.f) || LABELS[r.f.s]}</small></div><Stars value={r.f.s} /></div>
            {r.f.note ? <p className="txt">{r.f.note}</p> : <p className="none">Não escreveu review.</p>}
          </div>
        ))}
        {!list.length && account.user && account.friends.list.length > 0 && <p className="empty" style={{ padding: '26px 10px' }}>Nenhum amigo avaliou esse filme ainda.</p>}
      </div>
    </Overlay>
  );
}
