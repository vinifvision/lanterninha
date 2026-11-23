// Aba Início (v2): "Pra você" diz o porquê de cada sugestão; "Amigos" é o diário da turma, com o Palpite.
import { useEffect, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { useAsync } from '../components/hooks';
import { useRefresh } from '../lib/refresh';
import { Poster } from '../components/Poster';
import { Stars } from '../components/Stars';
import { StarPicker } from '../components/StarPicker';
import { Button } from '../components/Button';
import { discover, type DiscoverList } from '../lib/api';
import { cloud, useCloud } from '../lib/cloud';
import { fkey, isRated, useFilms } from '../lib/films';
import { fmt, pname } from '../lib/format';
import type { Film, FilmInfo, FriendRating, Profile, SearchResult } from '../lib/types';
import { nav } from '../nav';
import { StarIcon } from '../components/icons';
import { MineBadge } from '../components/MineBadge';
import { useSeen } from '../components/Spoiler';
import { DiscoverGrid, ListTitle } from './FullList';
import { fd } from '../lib/format';
import { sfx } from '../lib/sfx';
import type { CineTag } from '../lib/types';
import { pointsFor, VERDICT } from '../overlays/GuessGame';

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

type Chip = 'pra' | 'amigos' | 'now' | 'classics';
const CHIPS: { k: Chip; t: string }[] = [
  { k: 'pra', t: 'Pra você' },
  { k: 'amigos', t: 'Amigos' },
  { k: 'now', t: 'No cinema' },
  { k: 'classics', t: 'Clássicos' },
];
const DAY = 86400000;
/** Avaliou nos últimos 2 dias: acende o anel do rosto e a bolinha do chip Amigos. */
const isNew = (f: Film) => Date.now() - (f.ts || 0) < 2 * DAY;

export function Home() {
  const all = useFilms();
  const account = useCloud();
  const hasFriends = !!account.user && account.friends.list.length > 0;
  const [activity, setActivity] = useState<FriendRating[] | null>(null);
  const [chip, setChip] = useState<Chip>('pra');
  const tick = useRefresh();

  useEffect(() => {
    if (!hasFriends) { setActivity([]); return; }
    let alive = true;
    void cloud.friendsActivity(40).then((a) => { if (alive) setActivity(a); });
    return () => { alive = false; };
  }, [hasFriends, account.friends.list.length, tick]);

  const byTs = (a: Film, b: Film) => (b.ts || 0) - (a.ts || 0);
  const queue = all.filter((h) => h.st === 'want').sort(byTs).slice(0, 12);
  // "Porque você amou…": o filme mais recente com nota 4 ou mais
  const liked = all.filter(isRated).filter((h) => h.s >= 4 && h.id).sort(byTs)[0];
  // Meus filmes por chave, para o selo dos pôsteres: nota, "Já vi" ou "Quero ver"
  const mine = new Map(all.map((h) => [fkey(h), h] as const));
  const fresh = !!activity?.some((r) => isNew(r.f));
  const pick = (k: Chip) => { if (k !== chip) { sfx.tap(); setChip(k); } };

  return (
    <div className="screen v2home">
      <div className="v2chips" role="tablist" aria-label="Seções do início">
        {CHIPS.map((c) => (
          <button key={c.k} role="tab" aria-selected={chip === c.k} className={chip === c.k ? 'on' : ''} onClick={() => pick(c.k)}>
            {c.t}
            {c.k === 'amigos' && fresh && chip !== 'amigos' && <i className="v2dot" aria-label="Novidades" />}
          </button>
        ))}
      </div>

      {chip === 'pra' && (
        <div className="v2pane" key="pra">
          {account.tags.map((t) => <TagCard key={t.id} tag={t} />)}
          <Hero activity={activity} mine={mine} />
          {hasFriends && <Twin mine={all} />}
          {liked && <DiscoverRow title="Porque você amou" em={liked.t} list="similar" id={liked.id} mine={mine} />}

          <button className="tncard" id="tonight" onClick={() => nav.open({ k: 'tonight' })}>
            <span className="tnstrip" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map((i) => <i key={i} />)}</span>
            <b>Não sei o que ver hoje</b>
            <small>Gire a película e deixe o Lanterninha escolher</small>
          </button>

          {account.recs.length > 0 && (
            <button className="hcard" onClick={() => nav.tab('lib', 'home')}>
              <b>{account.recs.length === 1 ? '1 indicação para você' : `${account.recs.length} indicações para você`}</b>
              <small>de {[...new Set(account.recs.map((r) => pname(r.p)))].join(', ')}</small>
              <i>›</i>
            </button>
          )}

          {queue.length > 0 && (
            <section className="hsec">
              <div className="v2h"><h2>Na sua fila</h2><button onClick={() => nav.tab('lib', 'home')}>Ver tudo</button></div>
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

          <DiscoverRow title="Em alta na semana" list="trending" mine={mine} />

          {!account.user && (
            <button className="hcard" style={{ marginTop: 8 }} onClick={() => nav.tab('prof')}>
              <b>Veja o que seus amigos estão assistindo</b>
              <small>Crie uma conta para adicionar amigos</small>
              <i>›</i>
            </button>
          )}
        </div>
      )}

      {chip === 'amigos' && <FriendsPane activity={activity} friends={account.friends.list} loggedIn={!!account.user} />}
      {chip === 'now' && <div className="v2pane" key="now"><DiscoverGrid title="Em cartaz agora" list="now" mine={mine} /></div>}
      {chip === 'classics' && <div className="v2pane" key="classics"><DiscoverGrid title="Clássicos para conhecer" list="classics" mine={mine} /></div>}

      <p className="credit">Listas de filmes: <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">TMDB</a></p>
    </div>
  );
}

/** "Seus amigos amaram": filmes que a turma deu 4 ou mais e você ainda não avaliou. Um cartão por filme, passando de lado. */
function Hero({ activity, mine }: { activity: FriendRating[] | null; mine: Map<string, Film> }) {
  const [at, setAt] = useState(0);
  const by = new Map<string, FriendRating[]>();
  (activity || []).forEach((r) => {
    const k = fkey(r.f);
    if (r.f.s < 4 || isRated(mine.get(k))) return;
    by.set(k, [...(by.get(k) || []), r]);
  });
  const avg = (rs: FriendRating[]) => rs.reduce((a, r) => a + r.f.s, 0) / rs.length;
  const picks = [...by.values()]
    .map((rs) => rs.sort((a, b) => b.f.s - a.f.s))
    .sort((a, b) => b.length - a.length || avg(b) - avg(a))
    .slice(0, 3);
  if (!picks.length) return null;

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setAt(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  };
  return (
    <section className="v2hero" aria-label="Seus amigos amaram">
      <div className="v2herotrack" onScroll={onScroll}>
        {picks.map((rs) => {
          const f = rs[0].f;
          return (
            <button className="v2heroc" key={fkey(f)} onClick={() => nav.openFilm(f)}>
              <span className="v2herobg" aria-hidden="true"><Poster img={f.img} title="" fallback={false} /></span>
              <span className="v2herop"><Poster img={f.img} title={f.t} size="w342" /></span>
              <span className="v2herot">
                <span className="v2badge"><StarIcon />{rs.length > 1 ? 'Seus amigos amaram' : `${pname(rs[0].p)} amou`}</span>
                <b>{f.t}</b>
                {f.y && <small>{f.y}</small>}
                <span className="v2herow">
                  {rs.slice(0, 3).map((r) => (
                    <span key={r.p.id}><Avatar p={r.p} /><span className="n">{pname(r.p)}</span><em>★ {fmt(r.f.s)}</em></span>
                  ))}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {picks.length > 1 && (
        <div className="v2dots" aria-hidden="true">{picks.map((_, i) => <i key={i} className={i === at ? 'on' : ''} />)}</div>
      )}
    </section>
  );
}

/** Gêmeo de gosto: o amigo que mais dá notas parecidas com as suas (até meia estrela de diferença, com 3 filmes em comum ou mais). */
function Twin({ mine }: { mine: Film[] }) {
  const { friends } = useCloud();
  const tick = useRefresh();
  const ids = friends.list.map((p) => p.id).join(',');
  const lists = useAsync(() => Promise.all(friends.list.map((p) => cloud.friendFilms(p.id!))), [ids, tick], true);
  if (!lists) return null;

  const myS = new Map(mine.filter(isRated).map((h) => [fkey(h), h.s] as const));
  let best: { p: Profile; pct: number; n: number } | null = null;
  for (let i = 0; i < friends.list.length; i++) {
    const both = (lists[i] || []).filter((h) => myS.has(fkey(h)));
    if (both.length < 3) continue;
    const ok = both.filter((h) => Math.abs(h.s - (myS.get(fkey(h)) ?? 0)) <= 0.5).length;
    const pct = Math.round((ok / both.length) * 100);
    if (!best || pct > best.pct || (pct === best.pct && both.length > best.n)) best = { p: friends.list[i], pct, n: both.length };
  }
  if (!best) return null;
  const t = best;
  const name = pname(t.p);
  return (
    <section className="v2twin" aria-label="Gêmeo de gosto">
      <span className="v2ring">
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="29" className="bg" />
          <circle cx="32" cy="32" r="29" className="fg" strokeDasharray={`${(t.pct / 100) * 182} 182`} transform="rotate(-90 32 32)" />
        </svg>
        <Avatar p={t.p} />
      </span>
      <div>
        <small className="v2kick">Seu gêmeo de gosto</small>
        <p>Você e <b>{name}</b> concordam em <b className="g">{t.pct}%</b> das notas.</p>
        <button onClick={() => nav.push({ k: 'friend', id: t.p.id! })}>Ver os filmes de {name}</button>
      </div>
    </section>
  );
}

/** Aba Amigos: rostos de quem avaliou algo novo, o diário da turma e o Palpite. */
function FriendsPane({ activity, friends, loggedIn }: { activity: FriendRating[] | null; friends: Profile[]; loggedIn: boolean }) {
  // O filme do Palpite: o mais recente de um amigo em que você ainda não chutou.
  // Ele some do diário para não entregar a nota antes do chute.
  const pick = useAsync(async () => {
    if (!activity?.length) return null;
    const done = new Map<string, Set<string> | null>();
    for (const r of activity.slice(0, 12)) {
      const id = r.p.id!;
      if (!done.has(id)) done.set(id, await cloud.guessedKeys(id));
      const keys = done.get(id);
      if (!keys) return null; // o palpite ainda não está ligado no banco
      if (!keys.has(fkey(r.f))) return r;
    }
    return null;
  }, [activity], true);

  if (!loggedIn) {
    return (
      <div className="v2pane" key="amigos">
        <button className="hcard" onClick={() => nav.tab('prof')}>
          <b>Veja o que seus amigos estão assistindo</b>
          <small>Crie uma conta para adicionar amigos</small>
          <i>›</i>
        </button>
      </div>
    );
  }
  const recent = new Set((activity || []).filter((r) => isNew(r.f)).map((r) => r.p.id));
  const faces = [...friends].sort((a, b) => Number(recent.has(b.id)) - Number(recent.has(a.id)));
  const pkey = pick ? pick.p.id + fkey(pick.f) : '';
  const diary = (activity || []).filter((r) => r.p.id + fkey(r.f) !== pkey).slice(0, 16);
  const [first, ...rest] = diary;
  const loading = activity === null || (activity.length > 0 && pick === undefined);

  return (
    <div className="v2pane" key="amigos">
      <section className="v2faces" aria-label="Seus amigos">
        {faces.map((p) => (
          <button key={p.id} className={recent.has(p.id) ? 'new' : ''} onClick={() => nav.push({ k: 'friend', id: p.id! })}>
            <Avatar p={p} ring={recent.has(p.id)} />
            <small>{pname(p)}</small>
          </button>
        ))}
        <button className="v2add" onClick={() => nav.open({ k: 'addFriend' })}>
          <span className="av" aria-hidden="true">+</span>
          <small>Convidar</small>
        </button>
      </section>

      {!friends.length && <p className="hnote">Adicione amigos para ver o que a turma anda vendo.</p>}
      {friends.length > 0 && loading && <div className="v2post sk" />}
      {friends.length > 0 && activity?.length === 0 && <p className="hnote">Quando seus amigos avaliarem filmes, eles aparecem aqui.</p>}
      {!loading && (
        <>
          {first && <DiaryCard r={first} />}
          {pick && <GuessCard key={pkey} r={pick} />}
          {rest.map((r) => <DiaryCard key={r.p.id + fkey(r.f)} r={r} />)}
        </>
      )}
    </div>
  );
}

/** Uma entrada do diário da turma: quem viu, a nota e o começo da review. */
function DiaryCard({ r }: { r: FriendRating }) {
  const when = ago(r.f);
  const seen = useSeen(fkey(r.f));
  return (
    <article className="v2post">
      <div className="v2posth">
        <Avatar p={r.p} />
        <span><b>{pname(r.p)}</b> {r.f.w === 'cine' ? 'viu no cinema' : 'avaliou'}</span>
        {when && <small>{when}</small>}
      </div>
      <button className="v2postb" onClick={() => nav.open({ k: 'reviews', info: r.f, focusId: r.p.id, known: r })}>
        <span className="v2postp"><Poster img={r.f.img} title={r.f.t} /></span>
        <span className="v2postt">
          <b>{r.f.t}</b>
          <em>★ {fmt(r.f.s)}</em>
          {r.f.note && (r.f.sp && !seen ? <span className="spq">Review com spoiler · toque para ler</span> : <q>{r.f.note.split('\n')[0]}</q>)}
        </span>
      </button>
    </article>
  );
}

/** Palpite rápido: tocar nas estrelas escolhe a nota (metade esquerda = meia; dá para trocar), e só "Chutar" envia. */
function GuessCard({ r }: { r: FriendRating }) {
  const [pick, setPick] = useState(0);
  const [sent, setSent] = useState(false);
  const [res, setRes] = useState<{ pts: number; saved: boolean } | null>(null);
  const name = pname(r.p);
  const send = async () => {
    if (!pick || sent) return;
    setSent(true);
    sfx.tap();
    const saved = await cloud.sendGuess(r.p.id!, fkey(r.f), pick);
    setRes({ pts: pointsFor(pick, r.f.s), saved });
  };
  return (
    <article className="v2guess">
      <div className="v2posth">
        <Avatar p={r.p} />
        <span><b>{name}</b> acabou de ver <em>{r.f.t}</em></span>
      </div>
      <small className="v2kick">Palpite</small>
      <p>{res ? `${VERDICT[res.pts]} A nota foi ★ ${fmt(r.f.s)}` : `Quanto você acha que ${name} deu?`}</p>
      <div className={`v2gstars${sent ? ' done' : ''}`}>
        {sent ? <Stars value={pick} /> : <StarPicker value={pick} onChange={setPick} />}
        {res ? (
          <small className="v2gpts">{res.saved ? `+${res.pts} ${res.pts === 1 ? 'ponto' : 'pontos'}` : 'Não consegui salvar'}</small>
        ) : pick ? (
          <b className="v2gnum">{fmt(pick)}</b>
        ) : (
          <small className="v2ghint">Metade da estrela vale meia</small>
        )}
      </div>
      {!sent && (
        <Button block className="v2gok" disabled={!pick} onClick={() => void send()}>Chutar</Button>
      )}
    </article>
  );
}

/** Uma fileira de pôsteres que rola para o lado, com "Ver todos" no fim. Some se a lista vier vazia ou falhar. */
function DiscoverRow({ title, em, list, id, mine }: { title: string; em?: string; list: DiscoverList; id?: number; mine: Map<string, Film> }) {
  const tick = useRefresh();
  const items = useAsync(() => discover(list, id), [list, id, tick], true);
  if (items && items.length === 0) return null;
  const all = () => { sfx.tap(); nav.push({ k: 'list', title, em, list, id }); };
  return (
    <section className="hsec">
      <div className="v2h"><ListTitle title={title} em={em} /></div>
      <div className="hrow">
        {!items && [0, 1, 2, 3].map((i) => <span className="hp sk" key={i}><span className="ph" /></span>)}
        {items?.map((m) => (
          <button className="hp" key={m.id} onClick={() => nav.openFilm(toFilm(m))}>
            <span className="ph"><Poster img={m.poster} title={m.title} /><MineBadge film={mine.get('m' + m.id)} /></span>
          </button>
        ))}
        {items && (
          <button className="hp more" onClick={all} aria-label={`Ver todos: ${em ? title + ' ' + em : title}`}>
            <span className="ph"><i aria-hidden="true">›</i><b>Ver todos</b></span>
          </button>
        )}
      </div>
    </section>
  );
}

/** "Bia disse que vocês viram X juntos": confirmar põe o ingresso na sua gaveta também. */
function TagCard({ tag }: { tag: CineTag }) {
  const [out, setOut] = useState<'' | 'ok' | 'no'>('');
  const answer = (ok: boolean) => {
    setOut(ok ? 'ok' : 'no');
    if (ok) sfx.rip(); else sfx.tap();
    setTimeout(() => {
      void cloud.answerTag(tag, ok).then((f) => { if (f) nav.open({ k: 'ticket', key: fkey(f) }); });
    }, ok ? 520 : 300);
  };
  const where = [tag.cine, fd(tag.seen)].filter(Boolean).join(' · ');
  return (
    <div className={`tagcard${out ? ' out ' + out : ''}`} data-tag={tag.id}>
      <span className="tgposter"><Poster img={tag.film.img} title={tag.film.t} /></span>
      <div className="tgbody">
        <span className="tgwho"><Avatar p={tag.p} /><small>Ingresso compartilhado</small></span>
        <p><b>{pname(tag.p)}</b> disse que vocês viram <b>{tag.film.t}</b> juntos.</p>
        {where && <small className="tgwhere">{where}</small>}
        <div className="tgbtns">
          <button type="button" className="tgno" onClick={() => answer(false)} disabled={!!out}>Não fui</button>
          <button type="button" className="tgok" onClick={() => answer(true)} disabled={!!out}>Sim, eu fui</button>
        </div>
      </div>
    </div>
  );
}
