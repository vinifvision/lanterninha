// Reviews de um filme (redesign v2): primeiro a minha, depois as dos amigos, numa tela só.
import { useEffect, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { Overlay, OverlayHeader } from '../components/Overlay';
import { Poster } from '../components/Poster';
import { SpoilerText } from '../components/Spoiler';
import { LikeButton, likedBy } from '../components/LikeButton';
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
  return <small><i>★ {fmt(f.s)}</i>{w && ' · ' + w}{f.note && f.sp && <em className="sptag">spoiler</em>}</small>;
};

export function ReviewsPage({ info: raw, focusId, known }: Props) {
  const info = toInfo(raw);
  const key = fkey(info);
  const account = useCloud();
  const { stack } = useNav();
  const mine = useFilms().find((e) => fkey(e) === key) || null;
  const rated = isRated(mine) ? mine : null;
  /** Quem já viu o filme lê as reviews com spoiler direto; quem não viu, vê borrado. */
  const seen = !!mine && mine.st !== 'want';
  const [friends, setFriends] = useState<FriendRating[]>(known ? [known] : []);
  /** Curtidas: autor → quem curtiu (null enquanto carrega ou se o banco não tiver a tabela) */
  const [likes, setLikes] = useState<Record<string, string[]> | null>(null);
  const me = account.user?.id || '';

  useEffect(() => {
    if (!account.user) return;
    let alive = true;
    void cloud.filmRatings(key).then((rs) => { if (alive && rs.length) setFriends(rs); });
    void cloud.reviewLikes(key).then((l) => { if (alive) setLikes(l); });
    return () => { alive = false; };
  }, [key, account.user]);

  /** Curte ou descurte na hora; se o banco recusar, recarrega do jeito que está lá. */
  const toggleLike = (author: string) => {
    if (!likes || !me) return;
    const has = (likes[author] || []).includes(me);
    setLikes({ ...likes, [author]: has ? likes[author].filter((x) => x !== me) : [...(likes[author] || []), me] });
    void cloud.likeReview(author, key, !has).then((ok) => { if (!ok) void cloud.reviewLikes(key).then(setLikes); });
  };
  const myLikes = likedBy(likes?.[me] || [], account.friends.list);

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
            {rated.note && myLikes && <p className="rvlikes"><b>♥</b> Curtida por {myLikes}</p>}
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
            {r.f.note ? <SpoilerText text={r.f.note} hide={!!r.f.sp && !seen} /> : <p className="hint">Só deu a nota.</p>}
            {r.f.note && likes && (
              <div className="rvfoot">
                <LikeButton n={(likes[r.p.id] || []).length} on={(likes[r.p.id] || []).includes(me)} onClick={() => toggleLike(r.p.id)} />
              </div>
            )}
          </article>
        ))}
        {!list.length && account.user && account.friends.list.length > 0 && <p className="empty" style={{ padding: '26px 10px' }}>Nenhum amigo avaliou esse filme ainda.</p>}
      </div>
    </Overlay>
  );
}
