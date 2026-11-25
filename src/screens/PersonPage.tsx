// Página de uma pessoa (diretor, ator, roteirista...) ou de uma produtora (ex.: Marvel, Neon):
// todos os filmes dela, com os que você já viu marcados, quanto da obra você já viu,
// a sua média para ela e quais amigos também viram cada filme.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { useAsync } from '../components/hooks';
import { MineBadge } from '../components/MineBadge';
import { Poster } from '../components/Poster';
import { StarIcon } from '../components/icons';
import { personPage, posterUrl, type PersonFilm, type PersonKind } from '../lib/api';
import { cloud, useCloud } from '../lib/cloud';
import { posterColor, setTint } from '../lib/color';
import { fkey, isRated, useFilms } from '../lib/films';
import { fmt } from '../lib/format';
import { refresh, useRefresh } from '../lib/refresh';
import type { Film, Profile } from '../lib/types';
import { nav, scroller, useKept } from '../nav';
import { Face } from './Credits';

type Sort = 'pop' | 'new';
/** Quantos pôsteres desenhar de cada vez: com 300 de uma vez a rolagem fica pesada no celular. */
const STEP = 36;
const ALL = 'Tudo';
const today = () => new Date().toISOString().slice(0, 10);
/** Ainda não lançou (ou o TMDB não sabe quando): não conta no "quanto você viu". */
const upcoming = (f: PersonFilm, now: string) => !f.date || f.date > now;
const seen = (h?: Film) => !!h && h.st !== 'want';

export function PersonPage({ kind, id, name, photo }: { kind: PersonKind; id: number; name: string; photo?: string }) {
  const tick = useRefresh();
  const data = useAsync(() => personPage(kind, id).catch(() => null), [kind, id, tick], true);
  const all = useFilms();
  const account = useCloud();
  const mine = useMemo(() => new Map(all.map((h) => [fkey(h), h] as const)), [all]);
  const [role, setRole] = useKept<string | null>('role', null);
  const [sort, setSort] = useKept<Sort>('sort', 'pop');
  const [unseen, setUnseen] = useKept('unseen', false);
  const now = today();

  // Memorizado: um [] novo a cada desenho fazia a busca dos amigos recomeçar sem parar e travava o app
  const films = useMemo(() => data?.films || [], [data]);
  // Funções que a pessoa teve, da mais frequente para a menos (só aparecem se houver mais de uma)
  const roles = useMemo(() => {
    const n = new Map<string, number>();
    films.forEach((f) => f.roles.forEach((r) => n.set(r, (n.get(r) || 0) + 1)));
    return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([r]) => r);
  }, [films]);
  // Abre no que ela é conhecida: Tarantino abre em Direção, um ator em Atuação
  const current = role ?? (data && roles.length > 1 && roles.includes(data.known) ? data.known : ALL);

  const inRole = useMemo(() => (current === ALL ? films : films.filter((f) => f.roles.includes(current))), [films, current]);
  const shown = useMemo(() => {
    const list = unseen ? inRole.filter((f) => !seen(mine.get('m' + f.id))) : inRole.slice();
    if (sort === 'pop') list.sort((a, b) => b.pop - a.pop);
    else list.sort((a, b) => (b.date || '9999').localeCompare(a.date || '9999'));
    return list;
  }, [inRole, unseen, sort, mine]);

  // Desenha os pôsteres aos poucos, conforme a pessoa desce
  const [limit, setLimit] = useKept('limit', STEP);
  // Trocar o filtro volta a desenhar poucos pôsteres (mas não ao voltar para a página)
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } setLimit(STEP); }, [current, unseen, sort]);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = end.current;
    if (!el || limit >= shown.length) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) setLimit((n) => n + STEP); }, {
      root: scroller(),
      rootMargin: '0px 0px 900px 0px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, [limit, shown.length]);

  // Quanto da obra você já viu, e a sua média para ela
  const out = inRole.filter((f) => !upcoming(f, now));
  const mineHere = out.map((f) => mine.get('m' + f.id)).filter(seen);
  const notas = mineHere.filter(isRated).map((h) => h.s);
  const avg = notas.length ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10 : null;
  const cut = kind === 'company' && data && data.total > films.length;

  // A galera: quais amigos avaliaram cada filme
  const hasFriends = !!account.user && account.friends.list.length > 0;
  const keys = useMemo(() => films.map((f) => 'm' + f.id), [films]);
  const crowd = useAsync(
    () => (hasFriends && keys.length ? cloud.friendsSeen(keys) : Promise.resolve(new Map<string, Profile[]>())),
    [keys, hasFriends, tick],
    true,
  );
  const crowdHere = crowd ? out.filter((f) => crowd.get('m' + f.id)?.length).length : 0;

  // Fundo na cor da foto da pessoa (o logo das produtoras é transparente, então fica sem)
  const pic = data?.photo || photo || '';
  useEffect(() => {
    if (kind !== 'person' || !pic) return;
    let alive = true;
    void posterColor(pic).then((c) => { if (alive) setTint(c); });
    return () => { alive = false; setTint(null); };
  }, [kind, pic]);

  const title = data?.name || name;
  return (
    <div className={`screen person${kind === 'company' ? ' studio' : ''}`}>
      <header className="phead">
        {kind === 'company' ? (
          <span className="plogo">{pic ? <img src={posterUrl(pic, 'w185')} alt="" /> : <b>{title}</b>}</span>
        ) : (
          <Face photo={pic} name={title} size="h632" />
        )}
        {data?.known && <span className="pkick">{data.known}</span>}
        <h1>{title}</h1>
      </header>

      {data === null && (
        <div className="v2err">Não consegui carregar os filmes agora.<button className="btn btn-sec" onClick={() => void refresh.run()}>Tentar de novo</button></div>
      )}

      {data && out.length > 0 && (
        <Progress seen={mineHere.length} total={out.length} avg={avg} cut={!!cut} crowd={crowdHere} />
      )}

      {data && films.length > 0 && (
        <>
          <div className="chipsf pchips">
            {roles.length > 1 && [ALL, ...roles].map((r) => (
              <button key={r} className={current === r ? 'on' : ''} onClick={() => setRole(r)}>{r}</button>
            ))}
            <button className={unseen ? 'on' : ''} onClick={() => setUnseen(!unseen)}>Só os que não vi</button>
          </div>
          <div className="psort">
            <span>{shown.length} {shown.length === 1 ? 'filme' : 'filmes'}</span>
            <button onClick={() => setSort(sort === 'pop' ? 'new' : 'pop')}>
              {sort === 'pop' ? 'Mais famosos' : 'Mais recentes'} <i aria-hidden="true">⇅</i>
            </button>
          </div>
        </>
      )}

      {data && films.length === 0 && <p className="hnote">O TMDB ainda não tem filmes aqui.</p>}
      {data && films.length > 0 && shown.length === 0 && <p className="hnote">Você já viu todos daqui.</p>}

      <div className="v2grid pgrid">
        {data === undefined && [0, 1, 2, 3, 4, 5].map((i) => <span className="hp sk" key={i}><span className="ph" /></span>)}
        {shown.slice(0, limit).map((f, i) => {
          const h = mine.get('m' + f.id);
          const friends = crowd?.get('m' + f.id) || [];
          return (
            <button
              className={`hp${seen(h) ? ' got' : ''}${i < 12 ? ' in' : ''}`}
              key={f.id}
              style={i < 12 ? { animationDelay: `${i * 35}ms` } : undefined}
              onClick={() => nav.openFilm({ id: f.id, t: f.title, y: f.year, o: f.original, img: f.poster })}
            >
              <span className="ph">
                <Poster img={f.poster} title={f.title} />
                <MineBadge film={h} />
                {upcoming(f, now) && <i className="soon">Em breve</i>}
                {friends.length > 0 && (
                  <span className="pfr" aria-label={`${friends.length} ${friends.length === 1 ? 'amigo viu' : 'amigos viram'}`}>
                    {friends.slice(0, 2).map((p) => <Avatar key={p.id} p={p} />)}
                    {friends.length > 2 && <em>+{friends.length - 2}</em>}
                  </span>
                )}
              </span>
              <small>{f.year || '—'}{kind === 'person' && current === ALL && f.roles.length > 0 && `, ${f.roles[0]}`}</small>
            </button>
          );
        })}
      </div>
      {limit < shown.length && <div ref={end} className="pmore" />}
      <p className="credit">Filmes: <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">TMDB</a></p>
    </div>
  );
}

/** Cartão "Você viu X de Y": a barra enche devagar quando a página abre. */
function Progress({ seen, total, avg, cut, crowd }: { seen: number; total: number; avg: number | null; cut: boolean; crowd: number }) {
  const [fill, setFill] = useState(0);
  const pct = Math.round((seen / total) * 100);
  useEffect(() => {
    const t = setTimeout(() => setFill(pct), 120);
    return () => clearTimeout(t);
  }, [pct]);
  const done = seen === total;
  return (
    <section className={`pprog${done ? ' done' : ''}`}>
      <div className="pptop">
        <div>
          <span>Você viu</span>
          <b>{seen} <small>de {total}</small></b>
        </div>
        {avg != null && (
          <div className="ppavg">
            <span>Sua média</span>
            <b><StarIcon />{fmt(avg)}</b>
          </div>
        )}
      </div>
      <div className="ppbar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ width: `${fill}%` }} />
      </div>
      <p>
        {done ? 'Você viu todos. Respeito.' : seen === 0 ? 'Ainda nenhum. Bom lugar para começar.' : `${pct}% ${cut ? 'dos mais populares' : 'da obra'}.`}
        {crowd > 0 && <> A galera já viu {crowd}.</>}
      </p>
    </section>
  );
}
