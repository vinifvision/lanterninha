// Aba Início: o que os amigos andam vendo, indicações, sua fila e listas de filmes para descobrir.
import { useEffect, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { useAsync } from '../components/hooks';
import { Poster } from '../components/Poster';
import { Stars } from '../components/Stars';
import { discover, type DiscoverList } from '../lib/api';
import { cloud, useCloud } from '../lib/cloud';
import { fkey, isRated, useFilms } from '../lib/films';
import { pname } from '../lib/format';
import type { Film, FilmInfo, FriendRating, SearchResult } from '../lib/types';
import { nav } from '../nav';

const toFilm = (m: SearchResult): FilmInfo => ({ id: m.id, t: m.title, y: m.year, o: m.original, img: m.poster });

/** "há 2 dias", "ontem", "hoje" a partir da data de quando o filme foi visto ou avaliado. */
function ago(f: Film): string {
  const when = f.ts || (f.d ? Date.parse(f.d) : 0);
  if (!when) return '';
  const days = Math.floor((Date.now() - when) / 86400000);
  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 7) return `há ${days} dias`;
  if (days < 30) return `há ${Math.floor(days / 7)} sem.`;
  return `há ${Math.floor(days / 30)} mês${days >= 60 ? 'es' : ''}`;
}

export function Home() {
  const all = useFilms();
  const account = useCloud();
  const hasFriends = !!account.user && account.friends.list.length > 0;
  const [activity, setActivity] = useState<FriendRating[] | null>(null);

  useEffect(() => {
    if (!hasFriends) { setActivity([]); return; }
    let alive = true;
    void cloud.friendsActivity(20).then((a) => { if (alive) setActivity(a); });
    return () => { alive = false; };
  }, [hasFriends, account.friends.list.length]);

  const byTs = (a: Film, b: Film) => (b.ts || 0) - (a.ts || 0);
  const queue = all.filter((h) => h.st === 'want').sort(byTs).slice(0, 12);
  // "Porque você gostou de…": o filme mais recente com nota 4 ou mais
  const liked = all.filter(isRated).filter((h) => h.s >= 4 && h.id).sort(byTs)[0];
  const hello = account.profile ? pname(account.profile) : '';
  const mine = new Set(all.map(fkey));

  return (
    <div className="screen">
      <h1>Início</h1>
      <p className="count">{hello ? `Oi, ${hello}.` : ' '}</p>

      {account.recs.length > 0 && (
        <button className="hcard" onClick={() => nav.tab('lib')}>
          <b>{account.recs.length === 1 ? '1 indicação para você' : `${account.recs.length} indicações para você`}</b>
          <small>de {[...new Set(account.recs.map((r) => pname(r.p)))].join(', ')}</small>
          <i>›</i>
        </button>
      )}

      {hasFriends && (
        <section className="hsec">
          <div className="sech"><h3>Seus amigos andam vendo</h3></div>
          {activity === null && <div className="act sk" />}
          {activity && activity.length === 0 && <p className="hnote">Quando seus amigos avaliarem filmes, eles aparecem aqui.</p>}
          {activity && activity.length > 0 && (
            <div className="hrow">
              {activity.map((r) => (
                <button className="act" key={r.p.id + fkey(r.f)} onClick={() => nav.open({ k: 'reviews', info: r.f, focusId: r.p.id, known: r })}>
                  <span className="actp"><Poster img={r.f.img} title={r.f.t} /></span>
                  <span className="actw"><Avatar p={r.p} /><b>{pname(r.p)}</b><small>{ago(r.f)}</small></span>
                  <Stars value={r.f.s} />
                  {r.f.note && <q>{r.f.note.split('\n')[0]}</q>}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {queue.length > 0 && (
        <section className="hsec">
          <div className="sech"><h3>Na sua fila</h3><button onClick={() => nav.tab('lib')}>Ver tudo</button></div>
          <div className="hrow">
            {queue.map((h) => (
              <button className="hp" key={fkey(h)} onClick={() => nav.openFilm(h)}>
                <span className="ph"><Poster img={h.img} title={h.t} /></span>
                {h.by && <small>de {h.by}</small>}
              </button>
            ))}
          </div>
        </section>
      )}

      {liked && <DiscoverRow title={`Porque você gostou de ${liked.t}`} list="similar" id={liked.id} mine={mine} />}
      <DiscoverRow title="Em cartaz" list="now" mine={mine} />
      <DiscoverRow title="Em alta na semana" list="trending" mine={mine} />
      <DiscoverRow title="Clássicos para conhecer" list="classics" mine={mine} />

      {!account.user && (
        <button className="hcard" style={{ marginTop: 8 }} onClick={() => nav.tab('prof')}>
          <b>Veja o que seus amigos estão assistindo</b>
          <small>Crie uma conta para adicionar amigos</small>
          <i>›</i>
        </button>
      )}
      <p className="credit">Listas de filmes: <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">TMDB</a></p>
    </div>
  );
}

/** Uma fileira de pôsteres que rola para o lado. Some se a lista vier vazia ou falhar. */
function DiscoverRow({ title, list, id, mine }: { title: string; list: DiscoverList; id?: number; mine: Set<string> }) {
  const items = useAsync(() => discover(list, id), [list, id]);
  if (items && items.length === 0) return null;
  return (
    <section className="hsec">
      <div className="sech"><h3>{title}</h3></div>
      <div className="hrow">
        {!items && [0, 1, 2, 3].map((i) => <span className="hp sk" key={i}><span className="ph" /></span>)}
        {items?.map((m) => (
          <button className="hp" key={m.id} onClick={() => nav.openFilm(toFilm(m))}>
            <span className="ph"><Poster img={m.poster} title={m.title} />{mine.has('m' + m.id) && <i className="mk">✓</i>}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
