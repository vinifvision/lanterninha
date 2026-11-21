// Escolher o banner do perfil: primeiro o filme (dos seus ou pela busca), depois uma cena dele.
import { useEffect, useState } from 'react';
import { useAsync } from '../components/hooks';
import { OverlayHeader } from '../components/Overlay';
import { Poster } from '../components/Poster';
import { movieBackdrops, posterUrl, searchMovies } from '../lib/api';
import { useFilms } from '../lib/films';

interface Pick { id: number; t: string; img?: string }

export function PickBanner({ current, onDone, onClose }: { current: string; onDone: (path: string) => void; onClose: () => void }) {
  const mine = useFilms().filter((h) => h.id && h.st !== 'want').slice(0, 30).map((h): Pick => ({ id: h.id!, t: h.t, img: h.img }));
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Pick[] | null>(null);
  const [film, setFilm] = useState<Pick | null>(null);

  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) { setFound(null); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      searchMovies(text, ctl.signal).then((l) => setFound(l.map((m) => ({ id: m.id, t: m.title, img: m.poster })))).catch(() => { if (!ctl.signal.aborted) setFound([]); });
    }, 320);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  const list = found ?? mine;
  return (
    <div className="ov" style={{ zIndex: 8 }}>
      <div>
        <OverlayHeader
          left={<button id="bx" onClick={film ? () => setFilm(null) : onClose}>Voltar</button>}
          title={film ? film.t : 'Banner'}
          right={!film && current ? <button id="brm" style={{ color: '#e8494f' }} onClick={() => onDone('')}>Remover</button> : <span style={{ width: 60 }} />}
        />
        {film ? <Scenes film={film} current={current} onDone={onDone} /> : (
          <>
            <input type="text" id="bq" className="lq" placeholder="Buscar um filme" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" autoCorrect="off" spellCheck={false} />
            {!found && mine.length > 0 && <p className="setnote" style={{ margin: '0 4px 14px' }}>Ou escolha um dos seus filmes.</p>}
            {list.length > 0
              ? <div className="grid">{list.map((m) => (
                  <button className="fc" key={m.id} onClick={() => setFilm(m)}><span className="ph"><Poster img={m.img} title={m.t} /></span></button>
                ))}</div>
              : <p className="empty">{found ? 'Nenhum filme com esse nome.' : 'Busque um filme para ver as cenas dele.'}</p>}
          </>
        )}
      </div>
    </div>
  );
}

function Scenes({ film, current, onDone }: { film: Pick; current: string; onDone: (path: string) => void }) {
  const [failed, setFailed] = useState(false);
  const scenes = useAsync(() => movieBackdrops(film.id).catch(() => { setFailed(true); return [] as string[]; }), [film.id]);
  if (!scenes) return <p className="empty">Carregando as cenas…</p>;
  if (!scenes.length) return <p className="empty">{failed ? 'Não consegui carregar as cenas agora.' : 'Esse filme não tem cenas disponíveis. Tente outro.'}</p>;
  return (
    <div className="scenes">
      {scenes.map((p) => (
        <button key={p} className={p === current ? 'on' : ''} aria-label="Usar esta cena" onClick={() => onDone(p)}>
          <img src={posterUrl(p, 'w780')} alt="" loading="lazy" />
        </button>
      ))}
    </div>
  );
}
