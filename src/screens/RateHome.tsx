// Aba Avaliar: "O que você viu?". Busca o filme ou toca numa sugestão; um toque já leva para a nota.
import { useEffect, useRef, useState } from 'react';
import { Poster } from '../components/Poster';
import { searchMovies } from '../lib/api';
import { films, isRated, toInfo, useFilms } from '../lib/films';
import { STAR_PATH } from '../lib/format';
import { looksClassic } from '../lib/quiz';
import type { FilmInfo, SearchResult } from '../lib/types';
import { nav } from '../nav';

// O que a pessoa digitou fica guardado enquanto ela passeia pelo app.
const draft = { title: '' };
export const clearRateDraft = () => { draft.title = ''; };

/** Uma linha de filme: pôster, nome, o porquê e a estrela de avaliar. */
function Row({ f, sub, onClick }: { f: FilmInfo; sub: string; onClick: () => void }) {
  return (
    <button type="button" className="frow" onClick={onClick}>
      <span className="frp"><Poster img={f.img} title={f.t} size="w92" /></span>
      <span className="frt"><b>{f.t}</b>{sub && <small>{sub}</small>}</span>
      <span className="frs2" aria-hidden="true"><svg viewBox="0 0 24 24"><path d={STAR_PATH} /></svg></span>
    </button>
  );
}

export function RateHome() {
  const all = useFilms();
  const [title, setTitle] = useState(draft.title);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  // A busca falhou por falta de conexão (não é que o filme não exista)
  const [offline, setOffline] = useState(false);
  const [tries, setTries] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { draft.title = title; }, [title]);

  // Busca enquanto digita, com uma pequena espera para não disparar a cada letra
  useEffect(() => {
    const q = title.trim();
    setSearched(false);
    if (q.length < 2) { setResults([]); setOffline(false); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      searchMovies(q, ctl.signal)
        .then((list) => { setOffline(false); setResults(list.slice(0, 6)); setSearched(true); })
        .catch(() => { if (!ctl.signal.aborted) { setResults([]); setOffline(true); } });
    }, 320);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [title, tries]);

  /** Começa a avaliar. Filme já avaliado vira revisão; filme antigo entra como clássico. */
  const rate = (f: FilmInfo) => {
    const mine = films.find(f);
    clearRateDraft();
    nav.startQuiz(f, { rewatch: isRated(mine) ? mine : null, classic: isRated(mine) ? mine.c : looksClassic(f.y) });
  };

  // Sugestões: o que a pessoa marcou como visto (ainda sem nota) e depois a fila
  const tips = [...all.filter((h) => h.st === 'seen'), ...all.filter((h) => h.st === 'want')].slice(0, 4);
  const why = (h: (typeof all)[number]) => (h.st === 'seen' ? 'Você marcou como visto' : h.by ? `${h.by} te indicou` : 'Estava na sua fila');
  const typing = title.trim().length >= 2;

  return (
    <div className="screen rh2">
      <div className="rh2top">
        <h1>O que você viu?</h1>
        <button type="button" className="x2" aria-label="Fechar" onClick={() => nav.tab('home')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
      <div className="rh2find">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input
          ref={input} type="text" aria-label="Buscar o filme que você viu" maxLength={80} value={title}
          placeholder="Digite o nome do filme" autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="search"
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {offline && (
        <div className="offline" id="rhoff" role="status">
          <span>Sem conexão. Confira a internet.</span>
          <button onClick={() => setTries(tries + 1)}>Tentar de novo</button>
        </div>
      )}

      {typing ? (
        <>
          <div className="flist">
            {results.map((m) => (
              <Row key={m.id} f={{ id: m.id, t: m.title, y: m.year, o: m.original, img: m.poster }}
                sub={[m.original !== m.title ? m.original : '', m.year].filter(Boolean).join(' · ')}
                onClick={() => rate({ id: m.id, t: m.title, y: m.year, o: m.original, img: m.poster })} />
            ))}
          </div>
          {searched && !results.length && !offline && <p className="rh2msg">Não achei esse filme. Confira o nome.</p>}
        </>
      ) : tips.length > 0 ? (
        <>
          <h2 className="lbl2">Talvez seja um destes</h2>
          <div className="flist">
            {tips.map((h) => <Row key={(h.id || h.t) + (h.st || '')} f={toInfo(h)} sub={why(h)} onClick={() => rate(toInfo(h))} />)}
          </div>
          <p className="rh2note">Sugestões tiradas do que você marcou como visto e da sua fila.</p>
        </>
      ) : (
        <p className="rh2note">Digite o nome e toque no filme. A nota sai em um toque.</p>
      )}

      <p className="credit">Dados e imagens de filmes: <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">TMDB</a></p>
    </div>
  );
}
