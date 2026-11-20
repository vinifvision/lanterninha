// Aba Buscar (v2): procurar filme, ver os recentes, explorar por clima (listas do TMDB por gênero e duração)
// e "Quem você mais assiste" (os diretores que mais aparecem nos filmes que você avaliou).
import { useEffect, useState } from 'react';
import { Poster } from '../components/Poster';
import { useAsync } from '../components/hooks';
import { moodFilms, movieCredits, posterUrl, searchMovies, type Mood } from '../lib/api';
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
// O que a pessoa digitou e a lista aberta ficam guardados enquanto ela passeia pelo app.
const draft: { q: string; pane: Pane | null } = { q: '', pane: null };

export function Search() {
  const all = useFilms();
  const [q, setQ] = useState(draft.q);
  const [pane, setPane] = useState(draft.pane);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [offline, setOffline] = useState(false);
  const [tries, setTries] = useState(0);
  const [recent, setRecent] = useState(loadRecent);
  draft.q = q; draft.pane = pane;

  // Busca enquanto digita, com uma pequena espera para não disparar a cada letra
  useEffect(() => {
    const t0 = q.trim();
    setSearched(false);
    if (t0.length < 2) { setResults([]); setOffline(false); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      searchMovies(t0, ctl.signal)
        .then((l) => { setOffline(false); setResults(l.slice(0, 12)); setSearched(true); })
        .catch(() => { if (!ctl.signal.aborted) { setResults([]); setOffline(true); } });
    }, 320);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, tries]);

  const mine = new Map(all.map((h) => [fkey(h), h] as const));
  // Só filmes com nota: marcar como visto não conta
  const rated = all.filter(isRated);
  const people = useAsync(() => topPeople(rated), [rated.length]);
  // Lista do clima: undefined carregando, 'err' quando falhou
  const moodList = useAsync(() => (pane?.mood ? moodFilms(pane.mood).then((l) => l.map(toInfo)).catch(() => 'err' as const) : Promise.resolve(null)), [pane?.mood || '', tries]);
  const paneFilms = pane?.films || (moodList === 'err' ? null : moodList);

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
  const typing = q.trim().length >= 2;

  return (
    <div className="screen v2sr">
      <h1>Buscar</h1>
      <div className="v2find">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input
          type="search" aria-label="Buscar filme" maxLength={80} value={q} placeholder="Nome do filme"
          autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="search" onChange={(e) => setQ(e.target.value)}
        />
        {q && <button type="button" className="v2clr" aria-label="Apagar" onClick={() => setQ('')}>✕</button>}
      </div>

      {offline && (
        <div className="offline" role="status">
          <span>Sem conexão. Confira a internet.</span>
          <button onClick={() => setTries(tries + 1)}>Tentar de novo</button>
        </div>
      )}

      {typing ? (
        <div className="v2slist">
          {results.map((m) => row(toInfo(m), [m.year, m.original !== m.title ? m.original : ''].filter(Boolean).join(' · ')))}
          {searched && !results.length && !offline && <p className="rh2msg">Não achei esse filme. Confira o nome.</p>}
        </div>
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
              {moodList === 'err' && !pane.films ? (
                <div className="v2err">Não consegui carregar essa lista.<button className="btn btn-sec" onClick={() => setTries(tries + 1)}>Tentar de novo</button></div>
              ) : !paneFilms ? <p className="rh2note">Carregando…</p> : paneFilms.length === 0 ? <p className="rh2note">Nada por aqui agora.</p> : (
                <div className="v2sgrid">
                  {paneFilms.map((f) => (
                    <button type="button" key={fkey(f)} onClick={() => open(f)} aria-label={f.t}>
                      <Poster img={f.img} title={f.t} size="w185" />
                    </button>
                  ))}
                </div>
              )}
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
