// Perfil de um amigo: top 4, filmes avaliados e o jogo do palpite.
import { useState } from 'react';
import { Avatar } from '../components/Avatar';
import { Banner } from '../components/Banner';
import { useArmed, useAsync } from '../components/hooks';
import { useRefresh } from '../lib/refresh';
import { Poster } from '../components/Poster';
import { Favorites } from '../components/TopFour';
import { cloud, useCloud } from '../lib/cloud';
import { fkey } from '../lib/films';
import { fmt, nFriends, pname } from '../lib/format';
import type { RatedFilm } from '../lib/types';
import { nav } from '../nav';

export function FriendPage({ id }: { id: string }) {
  const { friends } = useCloud();
  const p = friends.list.find((x) => x.id === id);
  const tick = useRefresh();
  const count = useAsync(() => cloud.friendCount(id), [id, tick], true);
  const films = useAsync<RatedFilm[] | null>(() => cloud.friendFilms(id), [id, tick], true);
  const [armed, press] = useArmed(4000);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [gameMsg, setGameMsg] = useState('');

  if (!p) return <div className="screen"><p className="empty">Essa pessoa não está mais na sua lista de amigos.</p></div>;

  const openReview = (f: RatedFilm) => nav.open({ k: 'reviews', info: f, focusId: id, known: { p, f } });
  const unfriend = async () => {
    if (!press()) return;
    setBusy(true);
    const e = await cloud.removeFriend(id);
    if (e) { setBusy(false); setErr(e); return; }
    nav.tab('prof');
  };
  const play = async () => {
    if (!films) return;
    const done = await cloud.guessedKeys(id);
    if (!done) return setErr('O palpite ainda não está ligado no banco.');
    const pool = films.filter((h) => !done.has(fkey(h))).sort(() => Math.random() - 0.5).slice(0, 5);
    if (!pool.length) return setGameMsg('Você já deu palpite em todos os filmes dessa pessoa.');
    nav.open({ k: 'guess', friend: p, films: pool });
  };
  const avg = films?.length ? films.reduce((a, h) => a + h.s, 0) / films.length : 0;

  return (
    <div className="screen">
      <Banner path={p.banner} />
      <div className={`pf${p.banner ? ' onb' : ''}`} style={p.banner ? undefined : { marginTop: 10 }}>
        <Avatar p={p} />
        <div>
          <b>{pname(p)}</b>
          {p.display_name && p.username && <em>@{p.username}</em>}
          <small id="fcount">{count != null ? nFriends(count) : ''}</small>
        </div>
      </div>
      {p.bio && <p className="bio">{p.bio}</p>}
      {p.top4.some(Boolean) && (
        <>
          <Favorites id="ft4" top4={p.top4} empty="" onPick={(i) => {
            const f = p.top4[i], h = f && films?.find((x) => fkey(x) === fkey(f));
            if (h) openReview(h);
          }} />
        </>
      )}
      <div id="ffilms">
        {films === undefined && <p className="empty">Carregando os filmes…</p>}
        {films === null && <p className="empty">Não consegui carregar os filmes agora.</p>}
        {films && (
          <>
            {films.length > 0 && (
              <div className="game">
                <b>Palpite</b>
                <small id="gmsg">{gameMsg || `Tente adivinhar a nota que ${pname(p)} deu para cada filme.`}</small>
                <button className="cta" id="gplay" onClick={() => void play()}>Jogar</button>
              </div>
            )}
            <div className="stat">
              <div><b>{films.length}</b><span>{films.length === 1 ? 'filme' : 'filmes'}</span></div>
              <div><b>{films.length ? fmt(Math.round(avg * 10) / 10) : '–'}</b><span>nota média</span></div>
            </div>
            {films.length > 0
              ? <div className="grid">{films.map((h) => (
                  <button className="fc" key={fkey(h)} onClick={() => openReview(h)}>
                    <span className="ph"><Poster img={h.img} title={h.t} /></span><b>★ {fmt(h.s)}</b>
                  </button>
                ))}</div>
              : <p className="empty">Ainda não avaliou nenhum filme.</p>}
          </>
        )}
      </div>
      <button className="plain out" id="unf" style={{ marginTop: 36 }} disabled={busy} onClick={unfriend}>{armed ? 'Desfazer mesmo?' : 'Desfazer amizade'}</button>
      <p className={`fmsg${err ? ' bad' : ''}`} id="fm">{err}</p>
    </div>
  );
}
