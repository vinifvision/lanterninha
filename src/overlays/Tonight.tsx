// "Não sei o que ver hoje": uma tira de película gira e para num filme.
// Dois modos: sortear da sua fila (Quero ver) ou uma surpresa no seu estilo,
// a partir dos filmes que você avaliou bem (e dos que ganharam review).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Overlay, OverlayHeader } from '../components/Overlay';
import { Poster } from '../components/Poster';
import { discover } from '../lib/api';
import { films, fkey, isRated, useFilms } from '../lib/films';
import { fmt } from '../lib/format';
import type { FilmInfo, RatedFilm } from '../lib/types';
import { nav } from '../nav';

type Mode = 'queue' | 'taste';
interface Pick { info: FilmInfo; why: string }

const CARD = 118, GAP = 12, STEP = CARD + GAP, LAND = 26;
const shuffle = <T,>(a: T[]) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

/** Filmes "no seu estilo": recomendações do TMDB a partir de filmes que você avaliou bem. Review conta como um empurrãozinho. */
async function tasteCandidates(all: ReturnType<typeof useFilms>): Promise<Pick[]> {
  const mine = new Set(all.map(fkey));
  const liked = all.filter(isRated).filter((h): h is RatedFilm & { id: number } => !!h.id && h.s >= 4)
    .map((h) => ({ h, w: h.s + (h.note ? 0.75 : 0) + Math.random() * 1.5 }))
    .sort((a, b) => b.w - a.w).slice(0, 3).map((x) => x.h);
  const out: Pick[] = [];
  const seen = new Set<number>();
  const lists = await Promise.all(liked.map((h) => discover('similar', h.id).then((l) => ({ h, l })).catch(() => ({ h, l: [] }))));
  for (const { h, l } of lists) {
    for (const m of l) {
      if (seen.has(m.id) || mine.has('m' + m.id)) continue;
      seen.add(m.id);
      out.push({ info: { id: m.id, t: m.title, y: m.year, o: m.original, img: m.poster }, why: `Porque você deu ★ ${fmt(h.s)} para ${h.t}` });
    }
  }
  if (out.length) return out;
  // Sem filmes bem avaliados ainda: vai do que está em alta
  const trend = await discover('trending').catch(() => []);
  return trend.filter((m) => !mine.has('m' + m.id)).map((m) => ({ info: { id: m.id, t: m.title, y: m.year, o: m.original, img: m.poster }, why: 'Em alta na semana' }));
}

export function Tonight({ start }: { start?: Mode }) {
  const all = useFilms();
  const queue: Pick[] = all.filter((h) => h.st === 'want').map((h) => ({ info: h, why: h.by ? `Indicado por ${h.by}` : 'Está na sua fila' }));
  const [mode, setMode] = useState<Mode>(start || (queue.length ? 'queue' : 'taste'));
  const [phase, setPhase] = useState<'idle' | 'loading' | 'spinning' | 'done' | 'empty'>('idle');
  const [reel, setReel] = useState<Pick[]>([]);
  const [x, setX] = useState(0);
  const [moving, setMoving] = useState(false);
  const [width, setWidth] = useState(360);
  const [added, setAdded] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const last = useRef<number | string>('');
  const calm = useRef(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion:reduce)').matches).current;

  useLayoutEffect(() => { if (box.current) setWidth(box.current.clientWidth); }, []);

  // Antes do primeiro sorteio, a tira mostra pôsteres parados de onde o filme vai sair
  useEffect(() => {
    if (phase !== 'idle') return;
    if (mode === 'queue') setReel(shuffle(queue).slice(0, 8));
    else void tasteCandidates(all).then((c) => setReel(shuffle(c).slice(0, 8)));
    setX(0); setMoving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, phase]);

  const spin = async () => {
    setAdded(false);
    setPhase('loading');
    const pool = mode === 'queue' ? queue : await tasteCandidates(all);
    if (!pool.length) { setPhase('empty'); return; }
    // Evita cair no mesmo filme duas vezes seguidas
    const options = pool.length > 1 ? pool.filter((p) => (p.info.id || p.info.t) !== last.current) : pool;
    const chosen = options[Math.floor(Math.random() * options.length)];
    last.current = chosen.info.id || chosen.info.t;
    const fill = Array.from({ length: LAND + 4 }, (_, i) => (i === LAND ? chosen : pool[Math.floor(Math.random() * pool.length)]));
    setReel(fill); setMoving(false); setX(0); setPhase('spinning');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setMoving(true);
      setX(-(LAND * STEP) + width / 2 - CARD / 2);
    }));
  };

  const pick = phase === 'done' ? reel[LAND] : null;
  const inQueue = pick ? all.some((h) => fkey(h) === fkey(pick.info) && h.st === 'want') : false;

  return (
    <Overlay className="tonight">
      <OverlayHeader left={<button id="tnx" onClick={() => nav.close()}>Fechar</button>} title="Não sei o que ver" />
      <h2 className="tnh">O que vai ser hoje?</h2>
      <div className="seg">
        <button data-m="queue" className={mode === 'queue' ? 'on' : ''} disabled={phase === 'spinning'} onClick={() => { setMode('queue'); setPhase('idle'); }}>Da minha fila{queue.length ? ' · ' + queue.length : ''}</button>
        <button data-m="taste" className={mode === 'taste' ? 'on' : ''} disabled={phase === 'spinning'} onClick={() => { setMode('taste'); setPhase('idle'); }}>No meu estilo</button>
      </div>

      <div className={`reel${phase === 'done' ? ' landed' : ''}${phase === 'spinning' ? ' going' : ''}`} ref={box}>
        <div
          className="reelstrip"
          style={{ transform: `translateX(${x}px)`, transition: moving ? `transform ${calm ? 0.6 : 3.4}s cubic-bezier(.08,.72,.12,1)` : 'none' }}
          onTransitionEnd={() => { if (phase === 'spinning') setPhase('done'); }}
        >
          {reel.map((p, i) => (
            <span className={`rf${i === LAND && phase === 'done' ? ' win' : ''}`} key={i}><Poster img={p.info.img} title={p.info.t} /></span>
          ))}
          {!reel.length && <span className="rf empty" />}
        </div>
        <div className="gate" />
      </div>

      {phase === 'empty' && (
        <p className="empty" id="tnempty">{mode === 'queue'
          ? 'Sua fila está vazia. Marque filmes como "Quero ver" ou tente "No meu estilo".'
          : 'Não achei sugestões agora. Avalie alguns filmes e tente de novo.'}</p>
      )}

      {pick && (
        <div className="tnpick" id="tnpick">
          <b>{pick.info.t}</b>
          {pick.info.y && <small>{pick.info.y}</small>}
          <p>{pick.why}</p>
          <div className="row2">
            <button className="cta" id="tngo" onClick={() => nav.openFilm(pick.info)}>Ver filme</button>
            {mode === 'taste' && (
              <button className="cta ghost2" id="tnadd" disabled={inQueue || added} onClick={() => { films.setStatus(pick.info, 'want'); setAdded(true); }}>
                {inQueue || added ? '✓ Na sua fila' : 'Quero ver'}
              </button>
            )}
          </div>
        </div>
      )}

      <button className={`cta tnspin${pick ? ' again' : ''}`} id="tnspin" disabled={phase === 'spinning' || phase === 'loading'} onClick={() => void spin()}>
        {phase === 'loading' ? 'Procurando…' : phase === 'spinning' ? 'Sorteando…' : pick ? 'Sortear de novo' : 'Sortear'}
      </button>
    </Overlay>
  );
}
