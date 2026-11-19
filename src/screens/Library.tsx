// Aba Quero ver (v2): a fila em baralho. Um pôster por vez: "Agora não" passa para o próximo,
// "Ver hoje" abre o filme e "Já vi esse" tira da fila. Arrastar o pôster para o lado também passa.
// O botão de grade mostra a fila inteira, com busca. As indicações dos amigos ficam embaixo.
import { useRef, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { FilmCard } from '../components/FilmCard';
import { Poster } from '../components/Poster';
import { useAsync } from '../components/hooks';
import { movieDetails } from '../lib/api';
import { cloud, useCloud } from '../lib/cloud';
import { films, fkey, useFilms } from '../lib/films';
import { pad, pname } from '../lib/format';
import { useRefresh } from '../lib/refresh';
import { sfx } from '../lib/sfx';
import type { Film } from '../lib/types';
import { nav } from '../nav';

// Busca, modo grade e os filmes passados ("Agora não") ficam guardados enquanto a pessoa passeia pelo app.
const view = { q: '', grid: false, skipped: [] as string[] };
export const resetLibraryView = () => { view.q = ''; };

const EMPTY = 'Aqui fica sua fila: o que você guardou e o que seus amigos indicaram.';
/** 102 minutos → "1h42" */
/** Lugares do monte: 0 é o de cima; 3 fica escondido atrás, pronto para aparecer. */
const SLOTS = [
  { y: 0, r: 0, s: 1, o: 1 },
  { y: -10, r: -4, s: 0.95, o: 0.7 },
  { y: -18, r: 5, s: 0.9, o: 0.45 },
  { y: -24, r: 0, s: 0.85, o: 0 },
];
/** Lugar j do monte (aceita meio-termo, para os de baixo subirem aos poucos enquanto arrasta). */
function slot(j: number): React.CSSProperties {
  const a = Math.max(0, Math.min(3, j)), k = Math.min(2, Math.floor(a)), f = a - k;
  const A = SLOTS[k], B = SLOTS[k + 1];
  const mix = (p: 'y' | 'r' | 's' | 'o') => A[p] + (B[p] - A[p]) * f;
  return { transform: `translateY(${mix('y')}px) rotate(${mix('r')}deg) scale(${mix('s')})`, opacity: mix('o') };
}
export const hm = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h${pad(min % 60)}` : `${min}min`);

export function Library() {
  const all = useFilms();
  const account = useCloud();
  const tick = useRefresh();
  const [q, setQ] = useState(view.q);
  const [grid, setGrid] = useState(view.grid);
  const [skipped, setSkipped] = useState(view.skipped);
  const [out, setOut] = useState<'' | 'l' | 'r' | 'seen'>('');
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; t: number; moved: boolean } | null>(null);
  // Quantas vezes cada filme já foi passado: muda a chave, para ele voltar ao fundo do monte sem atravessar a tela
  const gen = useRef(new Map<string, number>());
  view.q = q; view.grid = grid; view.skipped = skipped;

  const queue = all.filter((h) => h.st === 'want').sort((a: Film, b: Film) => (b.ts || 0) - (a.ts || 0));
  const recs = account.recs;
  const byFriends = queue.filter((h) => h.by).length;

  // Baralho: os passados vão para o fim, na ordem em que foram passados
  const deck = [
    ...queue.filter((h) => !skipped.includes(fkey(h))),
    ...skipped.map((k) => queue.find((h) => fkey(h) === k)).filter((h): h is Film => !!h),
  ];
  const top = deck[0];
  const det = useAsync(() => (top?.id ? movieDetails(top.id) : Promise.resolve(null)), [top ? fkey(top) : '']);

  // Match: um amigo também quer ver um filme da sua fila
  const ids = account.friends.list.map((p) => p.id).join(',');
  const theirs = useAsync(() => cloud.friendsWant(), [ids, tick], true);
  const mine = new Set(queue.map(fkey));
  const match = (theirs || []).find((x) => mine.has(fkey(x.f)));

  /** Tira o pôster de cima: ele sai voando para o lado (ou sobe, no "Já vi") e os de baixo sobem juntos. */
  const next = (how: 'l' | 'r' | 'seen') => {
    if (!top || out) return;
    const k = fkey(top);
    setOut(how); setDragging(false);
    sfx.swipe(how === 'seen' ? 'seen' : 'no');
    setTimeout(() => {
      if (how === 'seen') films.setStatus(top, 'seen');
      else { gen.current.set(k, (gen.current.get(k) || 0) + 1); setSkipped((s) => [...s.filter((x) => x !== k), k]); }
      setOut(''); setDx(0);
    }, 420);
  };

  // Posição de cada pôster no monte: 0 é o de cima. Enquanto o de cima sai, os outros já sobem um lugar.
  const pull = Math.min(1, Math.abs(dx) / 140);
  const place = (i: number): React.CSSProperties | undefined => {
    if (i === 0) {
      if (out === 'seen') return { transform: 'translateY(-70px) scale(0.86)', opacity: 0 };
      if (out) { const s = out === 'l' ? -1 : 1; return { transform: `translateX(${s * 130}%) rotate(${s * 20}deg)`, opacity: 0 }; }
      if (dx) return { transform: `translateX(${dx}px) rotate(${dx / 16}deg) scale(1)`, opacity: 1, zIndex: 10 };
      return { ...slot(0), zIndex: 10 };
    }
    return { ...slot(out ? i - 1 : i - pull), zIndex: 10 - i };
  };

  const needle = q.trim().toLowerCase();
  const list = queue.filter((h) => !needle || h.t.toLowerCase().includes(needle) || (h.o || '').toLowerCase().includes(needle));
  const card = (h: Film, i: number) => <FilmCard key={fkey(h)} film={h} delay={Math.min(i, 12) * 25} onClick={() => nav.openFilm(h)} />;

  const info = det ? [det.runtime ? hm(det.runtime) : '', det.providers.stream.length ? 'no streaming' : det.providers.rent.length ? 'pra alugar' : ''].filter(Boolean).join(' · ') : '';
  const sub = [top?.y, det?.director].filter(Boolean).join(' · ');

  return (
    <div className="screen v2qv">
      <div className="v2qvtop">
        <div>
          <h1>Quero ver</h1>
          <p className="v2qvsum">
            {queue.length} {queue.length === 1 ? 'filme' : 'filmes'}
            {byFriends > 0 && <> · {byFriends} {byFriends === 1 ? 'indicado' : 'indicados'} por amigos</>}
          </p>
        </div>
        {queue.length > 0 && (
          <button className="v2round" aria-label={grid ? 'Ver em baralho' : 'Ver em grade'} onClick={() => setGrid(!grid)}>
            {grid
              ? <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="3" width="12" height="18" rx="2" /></svg>
              : <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></svg>}
          </button>
        )}
      </div>

      {match && (
        <button className="v2match" onClick={() => nav.openFilm(match.f)}>
          <Avatar p={match.p} />
          <span>Deu match: você e {pname(match.p)} querem ver <em>{match.f.t}</em></span>
        </button>
      )}

      {queue.length === 0 ? (
        <div className="v2qvempty">
          <p className="empty">{EMPTY}</p>
          <button className="btn btn-sec" onClick={() => nav.tab('search')}>Buscar filmes</button>
        </div>
      ) : grid ? (
        <>
          {queue.length > 5 && (
            <input type="text" className="lq" id="lq" placeholder="Buscar na fila" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" autoCorrect="off" spellCheck={false} />
          )}
          <div id="lbody">
            {list.length === 0 ? <p className="empty">Nenhum filme com esse nome.</p> : <div className="grid">{list.map(card)}</div>}
          </div>
        </>
      ) : (
        <>
          <div className="v2deck">
            {deck.slice(0, 4).map((h, i) => {
              const isTop = i === 0;
              return (
                <article
                  key={fkey(h) + '#' + (gen.current.get(fkey(h)) || 0)}
                  className={`v2card${isTop ? ' top' : ''}${isTop && dragging ? ' drag' : ''}${isTop && out ? ' leave' : ''}`}
                  style={place(i)}
                  aria-hidden={!isTop}
                  onPointerDown={isTop ? (e) => { if (out) return; drag.current = { x: e.clientX, t: Date.now(), moved: false }; e.currentTarget.setPointerCapture(e.pointerId); } : undefined}
                  onPointerMove={isTop ? (e) => {
                    const d = drag.current; if (!d) return;
                    const m = e.clientX - d.x;
                    if (!d.moved && Math.abs(m) > 6) { d.moved = true; setDragging(true); }
                    if (d.moved) setDx(m);
                  } : undefined}
                  onPointerUp={isTop ? () => {
                    const d = drag.current; drag.current = null;
                    if (!d) return;
                    if (!d.moved) { nav.openFilm(h); return; }
                    // Passa se arrastou bastante ou se jogou rápido para o lado
                    const fast = Math.abs(dx) / Math.max(1, Date.now() - d.t) > 0.6;
                    if ((Math.abs(dx) > 100 || (fast && Math.abs(dx) > 40)) && deck.length > 1) next(dx < 0 ? 'l' : 'r');
                    else { setDragging(false); setDx(0); }
                  } : undefined}
                  onPointerCancel={isTop ? () => { drag.current = null; setDragging(false); setDx(0); } : undefined}
                >
                  <Poster img={h.img} title={h.t} size="w342" />
                  <span className="v2topsh" aria-hidden="true" />
                  {isTop && info && <span className="v2tag">{info}</span>}
                  <div className="v2topt">
                    <b>{h.t}</b>
                    {isTop && sub && <small>{sub}</small>}
                    {isTop && h.by && <span className="v2by"><i>{h.by[0].toUpperCase()}</i>Indicado por {h.by}</span>}
                  </div>
                </article>
              );
            })}
          </div>
          <div className="v2deckbtns">
            <button className="v2act" aria-label="Agora não, passar para o próximo" disabled={deck.length < 2} onClick={() => next('l')}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
            </button>
            <button className="btn btn-primary" onClick={() => top && nav.openFilm(top)}>Ver hoje</button>
            <button className="v2act" aria-label="Já vi esse" onClick={() => next('seen')}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
            </button>
          </div>
        </>
      )}

      {recs.length > 0 && (
        <>
          <div className="sech"><h3>Indicações para você</h3></div>
          {recs.map((r) => (
            <div className="rcd" key={r.id}>
              {r.film.img ? <Poster img={r.film.img} title="" fallback={false} /> : <div className="noimg" />}
              <div>
                <b>{r.film.t}</b>
                <small>de {pname(r.p)}{r.film.y ? ' · ' + r.film.y : ''}</small>
                {r.note && <p>“{r.note}”</p>}
                <div className="row2">
                  <button className="mini" data-ra onClick={() => { films.setStatus(r.film, 'want', pname(r.p)); void cloud.dropRec(r.id); }}>Quero ver</button>
                  <button className="mini no" data-rd onClick={() => void cloud.dropRec(r.id)}>Dispensar</button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
