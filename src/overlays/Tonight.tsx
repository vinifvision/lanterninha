// "Não sei o que ver hoje": uma tira de película gira e para num filme.
// De onde sortear: sua fila (Quero ver), só os indicados por amigos, ou uma surpresa no seu estilo.
// Filtro de tempo com um toque, aviso de continuação, "Esse não" (veta da rodada) e Duelo (sorteia 2, você escolhe).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../components/Button';
import { Overlay } from '../components/Overlay';
import { Poster } from '../components/Poster';
import { discover, movieDetails, posterUrl } from '../lib/api';
import { films, fkey, isRated, useFilms } from '../lib/films';
import { fmt } from '../lib/format';
import { sfx } from '../lib/sfx';
import type { FilmInfo, RatedFilm } from '../lib/types';
import { nav } from '../nav';

type Source = 'queue' | 'friends' | 'taste';
type Time = 'short' | 'normal' | 'any';
interface Pick { info: FilmInfo; why: string; min?: number }
interface Sequel { prev: FilmInfo; target: FilmInfo; first: boolean; name: string }

/** Limite de duração de cada opção do filtro de tempo, em minutos. */
const TIME_MAX: Record<Time, number> = { short: 100, normal: 135, any: Infinity };
const TIMES: [Time, string][] = [['short', 'Pouco tempo · até 1h40'], ['normal', 'Normal · até 2h15'], ['any', 'Tanto faz']];

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
const pid = (p: Pick) => fkey(p.info);
const hm = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;

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

/** Tira os filmes que ainda não lançaram. Ano depois do atual já sai direto; os do ano atual (ou sem ano) têm a data conferida. */
async function dropUnreleased(pool: Pick[]): Promise<{ ok: Pick[]; out: number }> {
  const year = new Date().getFullYear();
  const today = new Date().toISOString().slice(0, 10);
  const yr = (p: Pick) => Number(p.info.y) || 0;
  const check = pool.filter((p) => p.info.id && (yr(p) === year || !yr(p)));
  const dates = await Promise.all(check.map((p) => movieDetails(p.info.id as number).then((d) => d.release).catch(() => '')));
  const future = new Set(check.filter((_, i) => dates[i] > today).map(pid));
  const ok = pool.filter((p) => yr(p) <= year && !future.has(pid(p)));
  return { ok, out: pool.length - ok.length };
}

/** Deixa só os filmes que cabem no tempo escolhido. Consulta a duração de até 30 deles (fica em cache). */
async function fitTime(pool: Pick[], time: Time): Promise<Pick[]> {
  if (time === 'any') return pool;
  const sample = shuffle(pool.filter((p) => p.info.id)).slice(0, 30);
  const mins = await Promise.all(sample.map((p) => movieDetails(p.info.id as number).then((d) => d.runtime).catch(() => 0)));
  return sample.map((p, i) => ({ ...p, min: mins[i] })).filter((p) => p.min > 0 && p.min <= TIME_MAX[time]);
}

export function Tonight({ start }: { start?: 'queue' | 'taste' }) {
  const all = useFilms();
  const queue: Pick[] = all.filter((h) => h.st === 'want').map((h) => ({ info: h, why: h.by ? `Indicado por ${h.by}` : 'Está na sua fila' }));
  const friends = queue.filter((p) => !!(p.info as { by?: string }).by);
  const [source, setSource] = useState<Source>(start || (queue.length ? 'queue' : 'taste'));
  const [time, setTime] = useState<Time>('any');
  const [phase, setPhase] = useState<'idle' | 'loading' | 'spinning' | 'landing' | 'done' | 'empty'>('idle');
  const [empty, setEmpty] = useState<'base' | 'time' | 'veto' | 'soon'>('base');
  const [soon, setSoon] = useState(0);
  const [reel, setReel] = useState<Pick[]>([]);
  const [chosen, setChosen] = useState<Pick | null>(null);
  const [sequel, setSequel] = useState<Sequel | null>(null);
  const [duel, setDuel] = useState<Pick[] | null>(null);
  const [vetoCount, setVetoCount] = useState(0);
  const [x, setX] = useState(0);
  const [moving, setMoving] = useState(false);
  const [width, setWidth] = useState(360);
  const [added, setAdded] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const last = useRef('');
  const pool = useRef<Pick[]>([]);
  const vetoed = useRef(new Set<string>());
  const calm = useRef(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion:reduce)').matches).current;
  const DUR = calm ? 0.6 : 3.4;
  const busy = phase === 'spinning' || phase === 'landing' || phase === 'loading';

  useLayoutEffect(() => { if (box.current) setWidth(box.current.clientWidth); }, []);

  // Antes do primeiro sorteio, a tira mostra pôsteres parados de onde o filme vai sair
  useEffect(() => {
    if (phase !== 'idle') return;
    let off = false;
    const show = (c: Pick[]) => void dropUnreleased(c).then(({ ok, out }) => {
      if (off) return;
      setReel(shuffle(ok).slice(0, 8));
      setSoon(source === 'taste' ? 0 : out);
    });
    if (source === 'taste') void tasteCandidates(all).then(show);
    else show(source === 'friends' ? friends : queue);
    setX(0); setMoving(false);
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, phase]);

  const seenIt = (f: FilmInfo) => all.some((h) => fkey(h) === fkey(f) && (isRated(h) || h.st === 'seen'));

  // Depois de cair num filme: busca a duração e confere se é continuação de outro que você ainda não viu
  useEffect(() => {
    const id = phase === 'done' ? chosen?.info.id : null;
    if (!id) return;
    let off = false;
    void movieDetails(id).then((d) => {
      if (off) return;
      if (d.runtime) setChosen((c) => (c && c.info.id === id && !c.min ? { ...c, min: d.runtime } : c));
      const parts = d.collection?.parts || [];
      const idx = parts.findIndex((p) => p.id === id);
      if (idx <= 0 || seenIt(parts[idx - 1])) return;
      const target = parts.slice(0, idx).find((p) => !seenIt(p)) || parts[0];
      setSequel({ prev: parts[idx - 1], target, first: target.id === parts[0].id, name: d.collection?.name || '' });
    }).catch(() => {});
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, chosen?.info.id]);

  const spin = async () => {
    setAdded(false); setSequel(null); setDuel(null);
    setPhase('loading');
    const raw = source === 'taste' ? await tasteCandidates(all) : source === 'friends' ? friends : queue;
    const released = await dropUnreleased(raw);
    if (source !== 'taste') setSoon(released.out);
    const base = released.ok.filter((p) => !vetoed.current.has(pid(p)));
    if (!base.length) {
      setEmpty(vetoed.current.size && released.ok.length ? 'veto' : raw.length && !released.ok.length ? 'soon' : 'base');
      setPhase('empty'); return;
    }
    const list = await fitTime(base, time);
    if (!list.length) { setEmpty('time'); setPhase('empty'); return; }
    pool.current = list;
    // Evita cair no mesmo filme duas vezes seguidas
    const options = list.length > 1 ? list.filter((p) => pid(p) !== last.current) : list;
    const pick = options[Math.floor(Math.random() * options.length)];
    last.current = pid(pick);
    setChosen(pick);
    const fill = Array.from({ length: LAND + 4 }, (_, i) => (i === LAND ? pick : list[Math.floor(Math.random() * list.length)]));
    setReel(fill); setMoving(false); setX(0); setPhase('spinning');
    const target = -(LAND * STEP) + width / 2 - CARD / 2;
    sfx.reelStart();
    sfx.reelTicks(tickTimes(-target, DUR).map((t) => t + 0.03));
    requestAnimationFrame(() => requestAnimationFrame(() => { setMoving(true); setX(target); }));
  };

  /** "Esse não": tira o filme desta sessão de sorteio e gira de novo. */
  const veto = () => {
    if (!chosen) return;
    vetoed.current.add(pid(chosen)); setVetoCount(vetoed.current.size);
    void spin();
  };
  const clearVetoes = () => { vetoed.current.clear(); setVetoCount(0); sfx.tap(); };

  /** Duelo: sorteia mais um da mesma leva e você escolhe entre os dois. */
  const rivals = chosen ? pool.current.filter((p) => pid(p) !== pid(chosen) && !vetoed.current.has(pid(p))) : [];
  const startDuel = () => {
    if (!chosen || !rivals.length) return;
    sfx.tap();
    setSequel(null);
    setDuel([chosen, rivals[Math.floor(Math.random() * rivals.length)]]);
  };
  const choose = (p: Pick) => { sfx.reelLand(); setDuel(null); setSequel(null); setAdded(false); setChosen(p); };

  const swapToFirst = () => {
    if (!sequel) return;
    choose({ info: sequel.target, why: sequel.name ? `Para começar ${sequel.name} do jeito certo` : 'Para ver na ordem' });
  };

  const changeSource = (s: Source) => { if (s !== source) { sfx.tap(); setSource(s); setPhase('idle'); } };
  const changeTime = (t: Time) => { if (t !== time) { sfx.tap(); setTime(t); if (phase === 'empty') setPhase('idle'); } };

  const landed = phase === 'landing' || phase === 'done';
  const pick = phase === 'done' ? chosen : null;
  const inQueue = pick ? all.some((h) => fkey(h) === fkey(pick.info) && h.st === 'want') : false;
  const sources: [Source, string][] = [
    ['queue', `Da minha fila${queue.length ? ' · ' + queue.length : ''}`],
    ...(friends.length ? [['friends', `Indicados · ${friends.length}`] as [Source, string]] : []),
    ['taste', 'No meu estilo'],
  ];
  const emptyMsg = empty === 'time'
    ? `Nada aqui com ${time === 'short' ? 'até 1h40' : 'até 2h15'}. Tente outro tempo ou "No meu estilo".`
    : empty === 'soon'
      ? 'Os filmes daqui ainda não lançaram. Tente outro lugar.'
      : empty === 'veto'
      ? 'Você vetou todos daqui. Limpe os vetos ou troque de lugar.'
      : source === 'taste'
        ? 'Não achei sugestões agora. Avalie alguns filmes e tente de novo.'
        : 'Sua fila está vazia. Marque filmes como "Quero ver" ou tente "No meu estilo".';

  return (
    <Overlay className="tonight v2tn">
      <div className="v2tnh">
        <button className="v2round" id="tnx" aria-label="Fechar" onClick={() => nav.close()}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <b>Sorteio</b>
        <span style={{ width: 44 }} />
      </div>

      <small className="v2kick gold">Não sei o que ver</small>
      <h1 className="v2tnt">O que vai ser hoje?</h1>

      <small className="v2tnl">De onde</small>
      <div className="v2chips" role="radiogroup" aria-label="De onde sortear">
        {sources.map(([k, label]) => (
          <button key={k} data-m={k} role="radio" aria-checked={source === k} className={source === k ? 'on' : ''} disabled={busy} onClick={() => changeSource(k)}>{label}</button>
        ))}
      </div>

      <small className="v2tnl">Quanto tempo você tem?</small>
      <div className="v2chips" role="radiogroup" aria-label="Tempo disponível">
        {TIMES.map(([k, label]) => (
          <button key={k} data-t={k} role="radio" aria-checked={time === k} className={time === k ? 'on' : ''} disabled={busy} onClick={() => changeTime(k)}>{label}</button>
        ))}
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

      {phase === 'empty' && <p className="v2tnempty" id="tnempty">{emptyMsg}</p>}

      <Button block className="v2tnspin" id="tnspin" disabled={busy} onClick={() => void spin()}>
        {phase === 'loading' ? (time === 'any' ? 'Procurando…' : 'Conferindo a duração…') : phase === 'spinning' || phase === 'landing' ? 'Sorteando…' : pick ? 'Sortear de novo' : 'Sortear'}
      </Button>
      {soon > 0 && (
        <p className="v2tnveto" id="tnsoon">{soon === 1 ? '1 filme daqui ainda não lançou' : `${soon} filmes daqui ainda não lançaram`}</p>
      )}
      {vetoCount > 0 && (
        <p className="v2tnveto">{vetoCount === 1 ? '1 filme vetado' : `${vetoCount} filmes vetados`} · <button onClick={clearVetoes}>Limpar</button></p>
      )}

      {/* O popup vai direto no corpo da página, para ficar centralizado por cima de tudo */}
      {pick && createPortal(
        <div className="tnpop" id="tnpick" role="dialog" aria-label={duel ? 'Duelo de filmes' : `Filme sorteado: ${pick.info.t}`}>
          <div className="v2tncard">
            <button className="v2round v2tnclose" aria-label="Fechar" onClick={() => { setDuel(null); setPhase('idle'); }}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>

            {duel ? (
              <>
                <small className="v2kick gold">Duelo · escolha um</small>
                <div className="v2tnduel">
                  {duel.map((p, i) => (
                    <button key={pid(p)} className="v2tnfighter" style={{ animationDelay: `${i * 0.12}s` }} onClick={() => choose(p)}>
                      {p.info.img ? <img src={posterUrl(p.info.img, 'w342')} alt="" /> : <span>{p.info.t}</span>}
                      <b>{p.info.t}</b>
                      <small>{[p.info.y, p.min ? hm(p.min) : ''].filter(Boolean).join(' · ')}</small>
                    </button>
                  ))}
                  <i className="v2tnvs" aria-hidden="true">vs</i>
                </div>
                <Button variant="secondary" block onClick={() => setDuel(null)}>Voltar</Button>
              </>
            ) : (
              <>
                <small className="v2kick gold">Hoje é dia de</small>
                {pick.info.img
                  ? <img key={pid(pick)} className="tnposter" src={posterUrl(pick.info.img, 'w342')} alt="" />
                  : <div key={pid(pick)} className="tnposter none">{pick.info.t}</div>}
                <b className="v2tntitle">{pick.info.t}</b>
                <small className="v2tnmeta">{[pick.info.y, pick.min ? hm(pick.min) : ''].filter(Boolean).join(' · ')}</small>
                <p className="v2tnwhy">{pick.why}</p>

                {sequel && (
                  <div className="v2tnseq" id="tnseq" role="note">
                    <span>É a continuação de <b>{sequel.prev.t}</b>. {sequel.first ? 'Quer ver o primeiro antes?' : `Quer ver ${sequel.target.t} antes?`}</span>
                    <button onClick={swapToFirst}>Trocar por {sequel.target.t}</button>
                  </div>
                )}

                <Button block id="tngo" onClick={() => nav.openFilm(pick.info)}>Ver página do filme</Button>
                <div className="v2tnrow">
                  <Button variant="secondary" id="tnveto" onClick={veto}>Esse não</Button>
                  <Button variant="secondary" id="tnduel" disabled={!rivals.length} onClick={startDuel}>Duelo</Button>
                  {(!inQueue || added) && (
                    <Button variant="secondary" id="tnadd" disabled={added} onClick={() => { films.setStatus(pick.info, 'want'); setAdded(true); sfx.tap(); }}>
                      {added ? '✓ Na fila' : 'Quero ver'}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </Overlay>
  );
}
