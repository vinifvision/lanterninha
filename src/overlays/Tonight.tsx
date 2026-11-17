// "Não sei o que ver hoje": uma tira de película gira e para num filme.
// Dois modos: sortear da sua fila (Quero ver) ou uma surpresa no seu estilo,
// a partir dos filmes que você avaliou bem (e dos que ganharam review).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Overlay, OverlayHeader } from '../components/Overlay';
import { Poster } from '../components/Poster';
import { discover } from '../lib/api';
import { films, fkey, isRated, useFilms } from '../lib/films';
import { fmt } from '../lib/format';
import { posterUrl } from '../lib/api';
import { sfx } from '../lib/sfx';
import type { FilmInfo, RatedFilm } from '../lib/types';
import { nav } from '../nav';

type Mode = 'queue' | 'taste';
interface Pick { info: FilmInfo; why: string }

const CARD = 118, GAP = 12, STEP = CARD + GAP, LAND = 26;
const EASE: [number, number, number, number] = [0.08, 0.72, 0.12, 1];

/** Em que instantes (segundos) cada quadro passa pela janela, seguindo a mesma curva de desaceleração da animação. */
function tickTimes(distance: number, dur: number): number[] {
  const [x1, y1, x2, y2] = EASE;
  const bez = (a: number, b: number, s: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  const out: number[] = [];
  let k = 1;
  for (let i = 1; i <= 1200 && k * STEP <= distance; i++) {
    const s = i / 1200;
    if (bez(y1, y2, s) * distance >= k * STEP) { out.push(bez(x1, x2, s) * dur); k++; }
  }
  return out;
}
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
  const [phase, setPhase] = useState<'idle' | 'loading' | 'spinning' | 'landing' | 'done' | 'empty'>('idle');
  const [reel, setReel] = useState<Pick[]>([]);
  const [x, setX] = useState(0);
  const [moving, setMoving] = useState(false);
  const [width, setWidth] = useState(360);
  const [added, setAdded] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const last = useRef<number | string>('');
  const calm = useRef(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion:reduce)').matches).current;
  const DUR = calm ? 0.6 : 3.4;

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
    const target = -(LAND * STEP) + width / 2 - CARD / 2;
    sfx.reelStart();
    sfx.reelTicks(tickTimes(-target, DUR).map((t) => t + 0.03));
    requestAnimationFrame(() => requestAnimationFrame(() => { setMoving(true); setX(target); }));
  };

  const landed = phase === 'landing' || phase === 'done';
  const pick = phase === 'done' ? reel[LAND] : null;
  const inQueue = pick ? all.some((h) => fkey(h) === fkey(pick.info) && h.st === 'want') : false;

  return (
    <Overlay className="tonight">
      <OverlayHeader left={<button id="tnx" onClick={() => nav.close()}>Fechar</button>} title="Não sei o que ver" />
      <h2 className="tnh">O que vai ser hoje?</h2>
      <div className="seg">
        <button data-m="queue" className={mode === 'queue' ? 'on' : ''} disabled={phase === 'spinning' || phase === 'landing'} onClick={() => { setMode('queue'); setPhase('idle'); }}>Da minha fila{queue.length ? ' · ' + queue.length : ''}</button>
        <button data-m="taste" className={mode === 'taste' ? 'on' : ''} disabled={phase === 'spinning' || phase === 'landing'} onClick={() => { setMode('taste'); setPhase('idle'); }}>No meu estilo</button>
      </div>

      <div className={`reel${landed ? ' landed' : ''}${phase === 'spinning' ? ' going' : ''}`} ref={box}>
        <div
          className="reelstrip"
          style={{ transform: `translateX(${x}px)`, transition: moving ? `transform ${DUR}s cubic-bezier(${EASE.join(',')})` : 'none' }}
          onTransitionEnd={(e) => {
            // Só vale o fim do giro da própria tira (os pôsteres dentro dela também têm animações)
            if (e.target !== e.currentTarget || e.propertyName !== 'transform' || phase !== 'spinning') return; sfx.reelLand(); setPhase('landing'); setTimeout(() => setPhase((ph) => (ph === 'landing' ? 'done' : ph)), calm ? 200 : 900); }}
        >
          {reel.map((p, i) => (
            <span className={`rf${i === LAND && landed ? ' win' : ''}`} key={i}><Poster img={p.info.img} title={p.info.t} /></span>
          ))}
          {!reel.length && <span className="rf empty" />}
        </div>
        <div className="gate" />
        <div className="beam" aria-hidden="true" />
      </div>

      {phase === 'empty' && (
        <p className="empty" id="tnempty">{mode === 'queue'
          ? 'Sua fila está vazia. Marque filmes como "Quero ver" ou tente "No meu estilo".'
          : 'Não achei sugestões agora. Avalie alguns filmes e tente de novo.'}</p>
      )}

      <button className={`cta tnspin${pick ? ' again' : ''}`} id="tnspin" disabled={phase === 'spinning' || phase === 'landing' || phase === 'loading'} onClick={() => void spin()}>
        {phase === 'loading' ? 'Procurando…' : phase === 'spinning' || phase === 'landing' ? 'Sorteando…' : pick ? 'Sortear de novo' : 'Sortear'}
      </button>

      {/* O popup vai direto no corpo da página, para ficar centralizado por cima de tudo */}
      {pick && createPortal(
        <div className="tnpop" id="tnpick" role="dialog" aria-label={`Filme sorteado: ${pick.info.t}`}>
          <div className="tncard2">
            <button className="tnclose" aria-label="Fechar" onClick={() => setPhase('idle')}>✕</button>
            <span className="tnlabel">Hoje é dia de</span>
            {pick.info.img
              ? <img className="tnposter" src={posterUrl(pick.info.img, 'w342')} alt="" />
              : <div className="tnposter none">{pick.info.t}</div>}
            <b>{pick.info.t}</b>
            {pick.info.y && <small>{pick.info.y}</small>}
            <p>{pick.why}</p>
            <button className="cta" id="tngo" onClick={() => nav.openFilm(pick.info)}>Ver página do filme</button>
            <div className="row2">
              {mode === 'taste' && (
                <button className="cta ghost2" id="tnadd" disabled={inQueue || added} onClick={() => { films.setStatus(pick.info, 'want'); setAdded(true); }}>
                  {inQueue || added ? '✓ Na sua fila' : 'Quero ver'}
                </button>
              )}
              <button className="cta ghost2" id="tnagain" onClick={() => void spin()}>Sortear de novo</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </Overlay>
  );
}
