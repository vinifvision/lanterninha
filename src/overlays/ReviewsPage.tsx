// Reviews de um filme (redesign v2): primeiro a minha, depois as dos amigos, numa tela só.
import { useEffect, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { Overlay, OverlayHeader } from '../components/Overlay';
import { Poster } from '../components/Poster';
import { cloud, useCloud } from '../lib/cloud';
import { films, fkey, isRated, toInfo, useFilms } from '../lib/films';
import { fd, fmt, pname, STATE } from '../lib/format';
import { looksClassic } from '../lib/quiz';
import type { Film, FilmInfo, FriendRating } from '../lib/types';
import { nav, useNav } from '../nav';

interface Props { info: FilmInfo; focusId?: string; known?: FriendRating }

/** "viu no cinema · 12/11/2026" */
const when = (f: Film) => [f.w === 'cine' ? 'viu no cinema' : '', f.d ? fd(f.d) : ''].filter(Boolean).join(' · ');
/** Nota pequena com o "quando" ao lado. */
const Meta = ({ f }: { f: Film & { s: number } }) => {
  const w = when(f);
  return <small><i>★ {fmt(f.s)}</i>{w && ' · ' + w}</small>;
};

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
  const focused = focusId ? friends.find((r) => r.p.id === focusId) : undefined;
  const list = friends.slice().sort((a, b) =>
    (a.p.id === focusId ? -1 : b.p.id === focusId ? 1 : 0) || (+!!b.f.note - +!!a.f.note) || (b.f.ts || 0) - (a.f.ts || 0));
  const nText = list.filter((r) => r.f.note).length;

  return (
    <Overlay>
      <OverlayHeader
        left={<button id="vx" onClick={() => nav.close()}>Fechar</button>} title="Reviews"
        right={onFilmPage ? undefined : <button className="ok" id="vfilm" onClick={() => nav.openFilm(info)}>Filme</button>}
      />
      <div className="rv2head">
        <Poster img={info.img} title={info.t} size="w92" className="rv2p" />
        <div><small>Reviews de</small><h2>{info.t}</h2></div>
      </div>

      <article className="rv2 me" id="rvme">
        {rated ? (
          <>
            <div className="who">
              <Avatar p={account.profile} />
              <div><b>Você</b><Meta f={rated} /></div>
              <button className={`pill${rated.note ? '' : ' gold'}`} id="rved" onClick={() => nav.open({ k: 'editor', key })}>
                {rated.note ? 'Editar' : 'Escrever'}
              </button>
            </div>
            {rated.note
              ? <p className="txt">{rated.note}</p>
              : <p className="hint">Você deu a nota, mas ainda não escreveu nada. Uma frase já basta.</p>}
            {rated.note && <button className="rvlnk" id="rvsh" onClick={() => nav.open({ k: 'share', key })}>Compartilhar</button>}
          </>
        ) : (
          <>
            <div className="who">
              <Avatar p={account.profile} />
              <div><b>Você</b><small>{mine?.st ? STATE[mine.st] + ', sem nota' : 'ainda não avaliou'}</small></div>
              <button className="pill gold" id="rvgo" onClick={() => nav.startQuiz(info, { classic: looksClassic(info.y) })}>Avaliar</button>
            </div>
            <div className="acts2">
              <button className="pill" id="rvseen" aria-pressed={mine?.st === 'seen'} onClick={() => { films.setStatus(info, 'seen'); }}>Já vi</button>
              <button className="pill" id="rvwant" aria-pressed={mine?.st === 'want'} onClick={() => { films.setStatus(info, 'want', focused ? pname(focused.p) : ''); }}>Quero ver</button>
            </div>
          </>
        )}
      </article>

      {list.length > 0 && (
        <div className="rv2sec">
          <h3>Amigos</h3>
          <span>{nText === 1 ? '1 review' : `${nText} reviews`}</span>
        </div>
      )}
      <div id="rvl">
        {list.map((r, i) => (
          <article className={`rv2${r.p.id === focusId ? ' foco' : ''}`} key={r.p.id} style={{ animationDelay: `${i * 50}ms` }}>
            <div className="who">
              <Avatar p={r.p} />
              <div><b>{pname(r.p)}</b><Meta f={r.f} /></div>
            </div>
            {r.f.note ? <p className="txt">{r.f.note}</p> : <p className="hint">Só deu a nota.</p>}
          </article>
        ))}
        {!list.length && account.user && account.friends.list.length > 0 && <p className="empty" style={{ padding: '26px 10px' }}>Nenhum amigo avaliou esse filme ainda.</p>}
      </div>
    </Overlay>
  );
}
