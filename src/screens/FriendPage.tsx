// Perfil de um amigo (redesign v2): compatibilidade, Top 4 com a sua nota, atalho para os Filmes dele,
// o que ele viu e você não, as reviews mais recentes e o Palpite.
import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { Banner } from '../components/Banner';
import { useArmed, useAsync } from '../components/hooks';
import { Poster } from '../components/Poster';
import { Since } from '../components/Since';
import { useRefresh } from '../lib/refresh';
import { cloud, useCloud } from '../lib/cloud';
import { fkey, isRated, useFilms } from '../lib/films';
import { fmt, pname } from '../lib/format';
import type { Film, RatedFilm } from '../lib/types';
import { nav, useNav } from '../nav';
import { byDiary } from './Diary';
import { openFriendFilm } from './FriendFilms';
import { ReviewCard } from './FriendReviews';
import { withReview } from './MyReviews';

/** Filmes que o amigo avaliou e você ainda não viu (pode estar no seu "Quero ver"), da maior nota para a menor. */
export function unseenBy(films: RatedFilm[], mine: Film[]): RatedFilm[] {
  const seen = new Set(mine.filter((h) => h.st !== 'want').map(fkey));
  return films.filter((h) => !seen.has(fkey(h))).sort((a, b) => b.s - a.s);
}

export function FriendPage({ id }: { id: string }) {
  const { friends } = useCloud();
  const p = friends.list.find((x) => x.id === id);
  const mine = useFilms();
  const tick = useRefresh();
  // Recarrega os palpites quando o jogo (tela sobreposta) fecha
  const shut = useNav().overlays.length;
  // Tudo o que ele viu (com nota e "Já vi"); as partes de nota usam só os avaliados
  const watched = useAsync<Film[] | null>(() => cloud.friendWatched(id), [id, tick], true);
  const guessed = useAsync(() => cloud.guessedKeys(id), [id, tick, shut], true);
  const [err, setErr] = useState('');

  if (!p) return <div className="screen"><p className="empty">Essa pessoa não está mais na sua lista de amigos.</p></div>;

  const name = pname(p);
  const films = watched && watched.filter(isRated);
  const myS = new Map(mine.filter(isRated).map((h) => [fkey(h), h.s] as const));
  const mySeen = new Set(mine.filter((h) => h.st !== 'want').map(fkey));
  const unseen = films ? unseenBy(films, mine) : [];
  const reviews = watched ? withReview(watched).sort(byDiary) : [];
  // Palpite só aparece quando ainda há filme sem palpite
  const pool = films && guessed ? films.filter((h) => !guessed.has(fkey(h))) : [];
  const play = () => nav.open({ k: 'guess', friend: p, films: [...pool].sort(() => Math.random() - 0.5).slice(0, 5) });
  const allFilms = () => nav.push({ k: 'friendFilms', id });

  return (
    <div className="screen v2fr">
      {p.banner ? <Banner path={p.banner} /> : <div className="pbanner v2nob" />}
      <div className="v2frhead">
        <Avatar p={p} ring />
        <div className="v2frname">
          <h1>{name}</h1>
          <p>
            {p.display_name && p.username && <>@{p.username} — </>}
            {watched && <button type="button" id="fall" onClick={allFilms}>{watched.length} {watched.length === 1 ? 'filme' : 'filmes'}</button>}
          </p>
        </div>
        <FriendMenu id={id} onError={setErr} />
      </div>
      {p.bio && <p className="bio v2bio">{p.bio}</p>}
      <Since iso={p.since} />

      {watched === undefined && <p className="empty">Carregando os filmes…</p>}
      {watched === null && <p className="empty">Não consegui carregar os filmes agora.</p>}

      {films && <Match films={films} myS={myS} name={name} />}

      {p.top4.some(Boolean) && (
        <>
          <h2 className="v2h">Top 4 de {name}</h2>
          <div className="v2frtop">
            {p.top4.map((f, i) => {
              const s = f ? myS.get(fkey(f)) : undefined;
              const h = f && watched?.find((x) => fkey(x) === fkey(f));
              return (
                <button key={i} disabled={!f} aria-label={f ? f.t : `Favorito ${i + 1} vazio`} onClick={() => h && openFriendFilm(id, h)}>
                  {f && <Poster img={f.img} title={f.t} />}
                  {s != null && <span className="v2frme">★ {fmt(s)}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}

      {watched && watched.length > 0 && (
        <nav className="v2links v2frlinks" aria-label={`Filmes de ${name}`}>
          <button onClick={allFilms}>
            <span>Filmes</span>
            <em>{watched.length}</em>
            <i aria-hidden="true">›</i>
          </button>
        </nav>
      )}

      {unseen.length > 0 && (
        <>
          <div className="v2frh">
            <h2 className="v2h">{name} viu, você não</h2>
            {unseen.length > 8 && <button type="button" onClick={() => nav.push({ k: 'friendFilms', id, only: 'unseen' })}>Ver os {unseen.length}</button>}
          </div>
          <div className="v2frrow">
            {unseen.slice(0, 8).map((h) => (
              <button key={fkey(h)} onClick={() => nav.openFilm(h)}>
                <span className="v2rpos"><Poster img={h.img} title={h.t} /></span>
                <small>★ {fmt(h.s)}</small>
              </button>
            ))}
          </div>
        </>
      )}

      {reviews.length > 0 && (
        <>
          <div className="v2frh">
            <h2 className="v2h">Reviews de {name}</h2>
            {reviews.length > 2 && <button type="button" onClick={() => nav.push({ k: 'friendReviews', id })}>Ver todas ({reviews.length})</button>}
          </div>
          <div className="v2revs v2frrevs">
            {reviews.slice(0, 2).map((h) => <ReviewCard key={fkey(h)} id={id} h={h} seen={mySeen.has(fkey(h))} />)}
          </div>
        </>
      )}

      {pool.length > 0 && (
        <div className="game v2frgame">
          <b>Palpite</b>
          <small>Tente adivinhar a nota que {name} deu. Faltam {pool.length} {pool.length === 1 ? 'filme' : 'filmes'}.</small>
          <button className="cta" id="gplay" onClick={play}>Jogar</button>
        </div>
      )}

      {watched && watched.length === 0 && <p className="empty">Ainda não marcou nenhum filme.</p>}
      <p className={`fmsg${err ? ' bad' : ''}`} id="fm">{err}</p>
    </div>
  );
}

/** Compatibilidade: quanto vocês concordam (até meia estrela de diferença) e o filme em que mais discordam. */
function Match({ films, myS, name }: { films: RatedFilm[]; myS: Map<string, number>; name: string }) {
  const both = films.filter((h) => myS.has(fkey(h)));
  if (both.length < 3) return null;
  const diff = (h: RatedFilm) => Math.abs(h.s - (myS.get(fkey(h)) ?? 0));
  const ok = both.filter((h) => diff(h) <= 0.5).length;
  const pct = Math.round((ok / both.length) * 100);
  const fight = both.reduce((a, h) => (diff(h) > diff(a) ? h : a), both[0]);
  return (
    <section className="v2frmatch" aria-label="Compatibilidade">
      <div className="v2frm1">
        <span className="v2frring">
          <svg viewBox="0 0 70 70" aria-hidden="true">
            <circle cx="35" cy="35" r="31" className="bg" />
            <circle cx="35" cy="35" r="31" className="fg" strokeDasharray={`${(pct / 100) * 195} 195`} transform="rotate(-90 35 35)" />
          </svg>
          <b>{pct}%</b>
        </span>
        <p>
          Vocês concordam em <b>{pct}%</b> dos {both.length} filmes que os dois viram.
          {pct >= 70 && <> <em>Gêmeos de gosto.</em></>}
        </p>
      </div>
      {diff(fight) >= 1.5 && (
        <button className="v2frfight" onClick={() => nav.openFilm(fight)}>
          <span className="v2frfp"><Poster img={fight.img} title={fight.t} /></span>
          <span>
            Onde vocês brigam: <i>{fight.t}</i>
            <small>você deu <em>★ {fmt(myS.get(fkey(fight))!)}</em> e {name} deu <em>★ {fmt(fight.s)}</em></small>
          </span>
        </button>
      )}
    </section>
  );
}

/** Três pontinhos: por enquanto só "Desfazer amizade" (com segundo toque para confirmar). */
function FriendMenu({ id, onError }: { id: string; onError: (e: string) => void }) {
  const [open, setOpen] = useState(false);
  const [armed, press] = useArmed(4000);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', esc); };
  }, [open]);

  const unfriend = async () => {
    if (!press()) return;
    setBusy(true);
    const e = await cloud.removeFriend(id);
    if (e) { setBusy(false); setOpen(false); onError(e); return; }
    nav.tab('prof');
  };

  return (
    <div className="v2frmenu" ref={box}>
      <button type="button" className="v2frdots" aria-label="Mais opções" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
      </button>
      {open && (
        <ul className="v2cmlist v2frlist" role="menu">
          <li role="none">
            <button type="button" role="menuitem" className="bad" disabled={busy} onClick={() => void unfriend()}>
              {armed ? 'Toque de novo para desfazer' : 'Desfazer amizade'}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
