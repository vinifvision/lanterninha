// Aba Avaliar: digita o filme, escolhe na busca e começa as perguntas (ou marca como já vi / quero ver).
import { useEffect, useRef, useState } from 'react';
import { Poster } from '../components/Poster';
import { searchMovies } from '../lib/api';
import { films, isRated, useFilms } from '../lib/films';
import { fmt } from '../lib/format';
import { looksClassic } from '../lib/quiz';
import type { FilmInfo, FilmState, SearchResult } from '../lib/types';
import { nav } from '../nav';

// O que a pessoa digitou fica guardado enquanto ela passeia pelo app.
const draft = { title: '', movie: null as SearchResult | null, classic: false };
export const clearRateDraft = () => { draft.title = ''; draft.movie = null; draft.classic = false; };

export function RateHome() {
  const all = useFilms();
  const [title, setTitle] = useState(draft.title);
  const [movie, setMovie] = useState<SearchResult | null>(draft.movie);
  const [classic, setClassic] = useState(draft.classic);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [need, setNeed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const recent = all.filter(isRated).slice(0, 4);

  useEffect(() => { draft.title = title; draft.movie = movie; draft.classic = classic; }, [title, movie, classic]);

  // Busca enquanto digita, com uma pequena espera para não disparar a cada letra
  useEffect(() => {
    const q = title.trim();
    if (q.length < 2 || (movie && movie.title === q)) { setResults([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      searchMovies(q, ctl.signal).then((list) => setResults(list.slice(0, 5))).catch(() => { if (!ctl.signal.aborted) setResults([]); });
    }, 320);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [title, movie]);

  const info = (): FilmInfo | null => {
    const t = title.trim();
    if (!t) return null;
    return movie && movie.title === t ? { id: movie.id, t, y: movie.year, o: movie.original, img: movie.poster } : { t };
  };
  const askName = () => {
    setNeed(true);
    input.current?.focus();
    setTimeout(() => setNeed(false), 1200);
  };
  const pick = (m: SearchResult) => {
    setMovie(m); setTitle(m.title); setResults([]);
    input.current?.blur();
    if (looksClassic(m.year)) setClassic(true);
  };
  const rate = () => {
    const f = info(); if (!f) return askName();
    const mine = films.find(f);
    nav.startQuiz(f, { rewatch: isRated(mine) ? mine : null, classic });
  };
  const mark = (st: FilmState) => {
    const f = info(); if (!f) return askName();
    const e = films.setStatus(f, st);
    clearRateDraft();
    nav.openFilm(e);
  };

  return (
    <div className="screen">
      <div className="brand"><img src="/logo.svg" alt="" width={40} height={40} />Lanterninha</div>
      <h1>Que nota<br />dar pro filme?</h1>
      <p className="sub">Perguntas rápidas sobre o que você sentiu.</p>
      <input
        ref={input} type="text" id="t" className={need ? 'need' : ''} maxLength={80} value={title}
        placeholder={need ? 'Digita o nome do filme primeiro' : 'Nome do filme'}
        autoComplete="off" autoCorrect="off" spellCheck={false}
        onChange={(e) => { setTitle(e.target.value); setMovie(null); }}
      />
      <div className="sr">
        {results.map((m) => (
          <button className="sri" key={m.id} onClick={() => pick(m)}>
            {m.poster ? <Poster img={m.poster} title="" size="w92" fallback={false} /> : <i />}
            <div><b>{m.title}</b><small>{[m.original !== m.title ? m.original : '', m.year].filter(Boolean).join(' · ')}</small></div>
          </button>
        ))}
      </div>
      {movie && movie.title === title.trim() && (
        <button className="dlink" onClick={() => { const f = info(); if (f) nav.openFilm(f); }}>Ver página do filme ›</button>
      )}
      <button className={`sw${classic ? ' on' : ''}`} role="switch" aria-checked={classic} onClick={() => setClassic(!classic)}>
        Clássico ou filme antigo<i />
      </button>
      <button className="cta" id="go" onClick={rate}>Avaliar</button>
      <div className="two">
        <button id="bseen" onClick={() => mark('seen')}>Já vi</button>
        <button id="bwant" onClick={() => mark('want')}>Quero ver</button>
      </div>
      {recent.length > 0 && (
        <div className="recent">
          <h3>Recentes</h3>
          {recent.map((h) => (
            <button className="rc" key={h.ts + h.t} onClick={() => nav.openFilm(h)}>
              <span><Poster img={h.img} title="" size="w92" fallback={false} /><em>{h.t}</em></span>
              <b>{(h.n || 0) > 1 ? '↻ ' : ''}★ {fmt(h.s)}</b>
            </button>
          ))}
        </div>
      )}
      <p className="credit">Dados e imagens de filmes: <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">TMDB</a></p>
    </div>
  );
}
