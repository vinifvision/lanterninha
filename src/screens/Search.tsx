// Aba Buscar (v2): procurar filme, pessoa (ator, diretor...) ou produtora, ver os recentes, explorar por clima (listas do TMDB por gênero e duração)
// e "Quem você mais assiste" (os diretores que mais aparecem nos filmes que você avaliou).
import { useEffect, useState } from 'react';
import { Poster } from '../components/Poster';
import { useAsync } from '../components/hooks';
import { moodPage, movieCredits, posterUrl, searchNames, searchPage, type Mood, type NameHit, type PersonKind } from '../lib/api';
import { MineBadge } from '../components/MineBadge';
import { ListEnd, usePages } from '../components/Paged';
import { fkey, isRated, useFilms } from '../lib/films';
import { fmt, POSTER_PATH } from '../lib/format';
import type { Film, FilmInfo, SearchResult } from '../lib/types';
import { nav } from '../nav';

const toInfo = (m: SearchResult): FilmInfo => ({ id: m.id, t: m.title, y: m.year, o: m.original, img: m.poster });

// Recentes: os últimos filmes abertos pela busca, guardados no aparelho
const RKEY = 'lanterninhaRecentes';
function loadRecent(): FilmInfo[] {
  try {
    const a = JSON.parse(localStorage.getItem(RKEY) || '[]') as unknown[];
    return (Array.isArray(a) ? a : [])
      .map((x) => x as Record<string, unknown>)
      .filter((x) => x && typeof x.t === 'string' && x.t.trim())
      .map((x) => ({
        id: Number.isInteger(x.id) ? (x.id as number) : null,
        t: (x.t as string).slice(0, 120),
        y: typeof x.y === 'string' && /^\d{4}$/.test(x.y) ? x.y : '',
        o: typeof x.o === 'string' ? x.o.slice(0, 160) : '',
        img: typeof x.img === 'string' && POSTER_PATH.test(x.img) ? x.img : '',
      }))
      .slice(0, 5);
  } catch { return []; }
}
const saveRecent = (l: FilmInfo[]) => { try { localStorage.setItem(RKEY, JSON.stringify(l)); } catch { /* sem espaço */ } };

const MOODS: { m: Mood; t: string; a: string; b: string }[] = [
  { m: 'chorar', t: 'Pra chorar de soluçar', a: '#2f4a6a', b: '#141c2a' },
  { m: 'rir', t: 'Pra rir com os amigos', a: '#c9762e', b: '#4a220e' },
  { m: 'br', t: 'Cinema brasileiro', a: '#a63a2c', b: '#3a100a' },
  { m: 'curto', t: 'Menos de 1h40', a: '#4a5a3a', b: '#161c12' },
];
const FACES = ['#e6cf9a', '#e9a6a0', '#a9c4dc'];

interface Person { n: string; photo: string; films: Film[] }
let peopleCache: { key: string; p: Promise<Person[]> } | null = null;
/** Diretores que mais aparecem nos filmes que você avaliou (até os 30 mais recentes). Guardado enquanto o app está aberto. */
function topPeople(rated: Film[]): Promise<Person[]> {
  const sample = rated.filter((h) => h.id).slice(0, 30);
  const key = sample.map(fkey).join(',');
  if (peopleCache?.key === key) return peopleCache.p;
  // A direção vem dos créditos do filme, com a foto de cada pessoa
  const p = Promise.all(sample.map((h) => movieCredits(h.id!)
    .then((c) => ({ h, ds: c.key.filter((k) => k.role.split(' e ').some((r) => /^dire[çc][ãa]o$/i.test(r.trim()))) }))
    .catch(() => ({ h, ds: [] as { name: string; photo: string }[] }))))
    .then((rows) => {
      const by = new Map<string, Person>();
      rows.forEach(({ h, ds }) => ds.forEach((d) => {
        const cur = by.get(d.name) || { n: d.name, photo: d.photo, films: [] };
        if (!cur.films.includes(h)) cur.films.push(h);
        by.set(d.name, cur);
      }));
      return [...by.values()].filter((x) => x.films.length >= 2).sort((a, b) => b.films.length - a.films.length).slice(0, 3);
    });
  peopleCache = { key, p };
  return p;
}
const initials = (n: string) => { const w = n.trim().split(/\s+/); return ((w[0]?.[0] || '') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase(); };

type Pane = { title: string; mood?: Mood; films?: FilmInfo[] };
type Tab = 'all' | 'movie' | 'person' | 'company';
const TABS: { k: Tab; t: string }[] = [
  { k: 'all', t: 'Tudo' }, { k: 'movie', t: 'Filmes' }, { k: 'person', t: 'Pessoas' }, { k: 'company', t: 'Produtoras' },
];
// Na aba "Tudo" só aparecem as pessoas e produtoras cujo nome bate bem com o que foi digitado
const strongPeople = (l: NameHit[] | null) => (l || []).filter((h) => h.sim >= 0.8 && (h.photo || h.pop >= 1)).slice(0, 3);
const strongCompanies = (l: NameHit[] | null) =>
  (l || []).filter((h) => h.sim >= 0.85).sort((a, b) => Number(!!b.photo) - Number(!!a.photo)).slice(0, 2);
// O que a pessoa digitou fica guardado enquanto ela passeia pelo app.
// A categoria aberta continua ao voltar da página de um filme, mas fecha quando a pessoa
// vai para outra aba: ao voltar para a Buscar, aparecem as categorias de novo.
const draft: { q: string; pane: Pane | null; tab: Tab } = { q: '', pane: null, tab: 'all' };
nav.subscribe(() => { if (nav.state.tab !== 'search') draft.pane = null; });

export function Search() {
  const all = useFilms();
  const [q, setQ] = useState(draft.q);
  const [pane, setPane] = useState(draft.pane);
  const [tab, setTab] = useState(draft.tab);
  // O texto que vale para a busca: só muda depois de uma pequena pausa na digitação
  const [dq, setDq] = useState(draft.q.trim());
  const [recent, setRecent] = useState(loadRecent);
  draft.q = q; draft.pane = pane; draft.tab = tab;

  // Busca enquanto digita, com uma pequena espera para não disparar a cada letra
  useEffect(() => {
    const t = setTimeout(() => setDq(q.trim()), 320);
    return () => clearTimeout(t);
  }, [q]);
  // Todos os resultados: vai buscando as próximas páginas conforme a pessoa desce
  const found = usePages(dq.length >= 2 ? (page) => searchPage(dq, page) : null, [dq], 'busca');
  const results: SearchResult[] = found.items || [];
  // Pessoas e produtoras: a primeira página já aparece no "Tudo"; nas abas próprias, carregam mais ao descer
  const ppl = usePages(dq.length >= 2 ? (page) => searchNames('person', dq, page) : null, [dq], 'busca-pessoas');
  const cos = usePages(dq.length >= 2 ? (page) => searchNames('company', dq, page) : null, [dq], 'busca-produtoras');
  const offline = found.failed && !found.items && ppl.failed && !ppl.items;

  const mine = new Map(all.map((h) => [fkey(h), h] as const));
  // Só filmes com nota: marcar como visto não conta
  const rated = all.filter(isRated);
  const people = useAsync(() => topPeople(rated), [rated.length]);
  // Lista do clima: vai buscando as próximas páginas conforme a pessoa desce
  const mood = pane?.mood;
  const moods = usePages(mood ? (page) => moodPage(mood, page) : null, [mood || ''], 'clima');
  const paneFilms = pane?.films || (mood ? moods.items?.map(toInfo) : null) || null;

  const open = (f: FilmInfo) => {
    const next = [f, ...recent.filter((r) => fkey(r) !== fkey(f))].slice(0, 5);
    setRecent(next); saveRecent(next);
    nav.openFilm(f);
  };
  /** O que aparece à direita: ★ nota, "Quero ver" ou "Já vi". */
  const status = (f: FilmInfo) => {
    const h = mine.get(fkey(f));
    if (isRated(h)) return <span className="v2st on">★ {fmt(h.s)}</span>;
    if (h?.st === 'want') return <span className="v2st">Quero ver</span>;
    if (h?.st === 'seen') return <span className="v2st">Já vi</span>;
    return null;
  };
  const row = (f: FilmInfo, sub: string) => (
    <button type="button" className="v2srow" key={fkey(f)} onClick={() => open(f)}>
      <span className="v2srp"><Poster img={f.img} title={f.t} size="w92" /></span>
      <span className="v2srt"><b>{f.t}</b>{sub && <small>{sub}</small>}</span>
      {status(f)}
    </button>
  );
  /** Linha de uma pessoa (foto redonda) ou produtora (logo em cartão claro). */
  const nameRow = (kind: PersonKind, h: NameHit) => (
    <button type="button" className="v2srow" key={kind + h.id} onClick={() => nav.openPerson(kind, h.id, h.name, h.photo || undefined)}>
      <span className={kind === 'person' ? 'v2sface' : 'v2slogo'}>
        {h.photo
          ? <img src={posterUrl(h.photo, kind === 'person' ? 'w185' : 'w92')} alt="" loading="lazy" />
          : <i>{kind === 'person' ? initials(h.name) : h.name.slice(0, 1).toUpperCase()}</i>}
      </span>
      <span className="v2srt"><b>{h.name}</b>{h.sub && <small>{h.sub}</small>}</span>
      <span className="v2sgo" aria-hidden="true">›</span>
    </button>
  );
  const filmRows = () => results.map((m) => row(toInfo(m), [m.year, m.original !== m.title ? m.original : ''].filter(Boolean).join(' · ')));
  const typing = q.trim().length >= 2;
  const topPpl = strongPeople(ppl.items);
  const topCos = strongCompanies(cos.items);
  const nothingAll = found.done && found.items?.length === 0 && ppl.items?.length === 0 && cos.items?.length === 0;

  return (
    <div className="screen v2sr">
      <h1>Buscar</h1>
      <div className="v2find">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input
          type="search" aria-label="Buscar filme, pessoa ou produtora" maxLength={80} value={q} placeholder="Filmes, pessoas, produtoras"
          autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="search" onChange={(e) => setQ(e.target.value)}
        />
        {q && <button type="button" className="v2clr" aria-label="Apagar" onClick={() => setQ('')}>✕</button>}
      </div>

      {offline && (
        <div className="offline" role="status">
          <span>Sem conexão. Confira a internet.</span>
          <button onClick={found.retry}>Tentar de novo</button>
        </div>
      )}

      {typing ? (
        <>
        <div className="chipsf v2stabs" role="tablist">
          {TABS.map((t) => (
            <button type="button" role="tab" key={t.k} aria-selected={tab === t.k} className={tab === t.k ? 'on' : ''} onClick={() => setTab(t.k)}>{t.t}</button>
          ))}
        </div>

        {tab === 'all' && (
          <div className="v2stab" key="all">
            {topPpl.length > 0 && (
              <>
                <div className="v2sh v2shs"><h2>Pessoas</h2>{(ppl.items?.length || 0) > topPpl.length && <button type="button" onClick={() => setTab('person')}>Ver todas</button>}</div>
                <div className="v2slist">{topPpl.map((h) => nameRow('person', h))}</div>
              </>
            )}
            {topCos.length > 0 && (
              <>
                <div className="v2sh v2shs"><h2>Produtoras</h2>{(cos.items?.length || 0) > topCos.length && <button type="button" onClick={() => setTab('company')}>Ver todas</button>}</div>
                <div className="v2slist">{topCos.map((h) => nameRow('company', h))}</div>
              </>
            )}
            {(topPpl.length > 0 || topCos.length > 0) && results.length > 0 && <div className="v2sh v2shs"><h2>Filmes</h2></div>}
            <div className="v2slist">{filmRows()}</div>
            {nothingAll && <p className="rh2msg">Não achei nada com esse nome. Confira se está escrito certo.</p>}
            {dq.length >= 2 && <ListEnd p={found} />}
          </div>
        )}

        {tab === 'movie' && (
          <div className="v2stab" key="movie">
            <div className="v2slist">
              {filmRows()}
              {found.done && found.items?.length === 0 && <p className="rh2msg">Não achei esse filme. Confira o nome.</p>}
            </div>
            {dq.length >= 2 && <ListEnd p={found} />}
          </div>
        )}

        {tab === 'person' && (
          <div className="v2stab" key="person">
            <div className="v2slist">
              {(ppl.items || []).map((h) => nameRow('person', h))}
              {ppl.done && ppl.items?.length === 0 && <p className="rh2msg">Não achei ninguém com esse nome.</p>}
            </div>
            {dq.length >= 2 && <ListEnd p={ppl} />}
          </div>
        )}

        {tab === 'company' && (
          <div className="v2stab" key="company">
            <div className="v2slist">
              {(cos.items || []).map((h) => nameRow('company', h))}
              {cos.done && cos.items?.length === 0 && <p className="rh2msg">Não achei nenhuma produtora com esse nome.</p>}
            </div>
            {dq.length >= 2 && <ListEnd p={cos} />}
          </div>
        )}
        </>
      ) : (
        <>
          {recent.length > 0 && (
            <>
              <div className="v2sh"><h2>Recentes</h2><button type="button" onClick={() => { setRecent([]); saveRecent([]); }}>Limpar</button></div>
              <div className="v2slist">{recent.map((f) => row(f, f.y || ''))}</div>
            </>
          )}

          {pane ? (
            <section className="v2pane" key={pane.title}>
              <div className="v2sh"><h2 className="serif big">{pane.title}</h2><button type="button" onClick={() => setPane(null)}>Fechar</button></div>
              {mood && !pane.films && moods.failed && !moods.items ? (
                <div className="v2err">Não consegui carregar essa lista.<button className="btn btn-sec" onClick={moods.retry}>Tentar de novo</button></div>
              ) : !paneFilms ? <p className="rh2note">Carregando…</p> : paneFilms.length === 0 ? <p className="rh2note">Nada por aqui agora.</p> : (
                <div className="v2sgrid">
                  {paneFilms.map((f) => (
                    <button type="button" key={fkey(f)} onClick={() => open(f)} aria-label={f.t}>
                      <Poster img={f.img} title={f.t} size="w185" />
                      <MineBadge film={mine.get(fkey(f))} />
                    </button>
                  ))}
                </div>
              )}
              {mood && !pane.films && <ListEnd p={moods} />}
            </section>
          ) : (
            <>
              <h2 className="v2sh2">Explorar por clima</h2>
              <div className="v2moods">
                {MOODS.map((m) => (
                  <button type="button" key={m.m} style={{ background: `linear-gradient(140deg, ${m.a}, ${m.b})` }} onClick={() => setPane({ title: m.t, mood: m.m })}>
                    <span>{m.t}</span>
                  </button>
                ))}
              </div>

              {people && people.length > 0 && (
                <>
                  <h2 className="v2sh2">Quem você mais assiste</h2>
                  <div className="v2ppl">
                    {people.map((p, i) => (
                      <button type="button" key={p.n} onClick={() => setPane({ title: p.n, films: p.films })}>
                        {p.photo ? <img src={posterUrl(p.photo, 'w185')} alt="" loading="lazy" /> : <i style={{ background: FACES[i % FACES.length] }}>{initials(p.n)}</i>}
                        <span>{p.n}</span>
                        <small>{p.films.length} {p.films.length === 1 ? 'filme avaliado' : 'filmes avaliados'}</small>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      <p className="credit">Dados e imagens de filmes: <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">TMDB</a></p>
    </div>
  );
}
