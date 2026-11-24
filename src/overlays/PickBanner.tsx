// Escolher o banner do perfil: primeiro o filme (favoritos, maiores notas ou pela busca), depois uma cena dele.
import { useEffect, useState } from 'react';
import { useAsync } from '../components/hooks';
import { OverlayHeader } from '../components/Overlay';
import { Poster } from '../components/Poster';
import { movieBackdrops, posterUrl, searchMovies } from '../lib/api';
import { useCloud } from '../lib/cloud';
import { useFilms } from '../lib/films';
import type { TopItem } from '../lib/types';

interface Pick { id: number; t: string; img?: string }

export function PickBanner({ current, onDone, onClose }: { current: string; onDone: (path: string) => void; onClose: () => void }) {
  const account = useCloud();
  const all = useFilms();
  /** Primeiro os 4 favoritos do perfil... */
  const favs = (account.profile?.top4 || []).filter((x): x is TopItem => !!x && x.id != null).map((x): Pick => ({ id: x.id!, t: x.t, img: x.img }));
  /** ...depois os filmes com maior nota (sem repetir). */
  const seenIds = new Set(favs.map((f) => f.id));
  const best = all
    .filter((h) => h.id && h.st !== 'want')
    .sort((a, b) => (b.s || 0) - (a.s || 0) || (b.ts || 0) - (a.ts || 0))
    .filter((h) => !seenIds.has(h.id!) && !!seenIds.add(h.id!))
    .slice(0, 30)
    .map((h): Pick => ({ id: h.id!, t: h.t, img: h.img }));
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
            {found
              ? (found.length ? <Grid list={found} onPick={setFilm} /> : <p className="empty">Nenhum filme com esse nome.</p>)
              : (favs.length || best.length) ? (
                  <>
                    {favs.length > 0 && <><p className="setnote" style={{ margin: '0 4px 10px' }}>Seus favoritos</p><Grid list={favs} onPick={setFilm} /></>}
                    {best.length > 0 && <><p className="setnote" style={{ margin: favs.length ? '22px 4px 10px' : '0 4px 10px' }}>Maiores notas</p><Grid list={best} onPick={setFilm} /></>}
                  </>
                )
                : <p className="empty">Busque um filme para ver as cenas dele.</p>}
          </>
        )}
      </div>
    </div>
  );
}

function Grid({ list, onPick }: { list: Pick[]; onPick: (m: Pick) => void }) {
  return (
    <div className="grid">{list.map((m) => (
      <button className="fc" key={m.id} onClick={() => onPick(m)}><span className="ph"><Poster img={m.img} title={m.t} /></span></button>
    ))}</div>
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
