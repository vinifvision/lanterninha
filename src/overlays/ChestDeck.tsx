// Relembrar rápido: um pôster grande por vez. Direita = Já vi, esquerda = Não vi, para cima = Não lembro.
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { posterUrl } from '../lib/api';
import { chest } from '../lib/cloud';
import { useChestList } from '../lib/chestList';
import { films } from '../lib/films';
import { sfx } from '../lib/sfx';
import type { SearchResult } from '../lib/types';
import { nav } from '../nav';

type Kind = 'seen' | 'no' | 'idk';
const LABEL: Record<Kind, string> = { seen: 'Já vi', no: 'Não vi', idk: 'Não lembro' };

export function ChestDeck() {
  const st = useChestList();
  const [drag, setDrag] = useState({ x: 0, y: 0, on: false });
  const [leaving, setLeaving] = useState<{ id: number; kind: Kind } | null>(null);
  const [count, setCount] = useState(0);
  const start = useRef({ x: 0, y: 0 });

  if (!st) return null;
  // Enquanto um cartão sai voando, ele continua na tela; os próximos ficam atrás
  const queue = st.pending.filter((m) => m.id !== leaving?.id).slice(0, 3);
  const flying = leaving ? st.list.find((m) => m.id === leaving.id) : undefined;
  const top = queue[0];

  const decide = (m: SearchResult, kind: Kind) => {
    if (leaving) return;
    setLeaving({ id: m.id, kind });
    setDrag({ x: 0, y: 0, on: false });
    sfx.swipe(kind);
    setTimeout(() => {
      if (kind === 'seen') films.fromChest({ id: m.id, t: m.title, y: m.year, o: m.original, img: m.poster });
      else chest.answer(m.id, kind);
      setCount((c) => c + 1);
      setLeaving(null);
    }, 280);
  };
  const intent = (x: number, y: number): Kind | null => (y < -90 && Math.abs(y) > Math.abs(x) ? 'idk' : x > 90 ? 'seen' : x < -90 ? 'no' : null);
  const live = drag.on ? intent(drag.x, drag.y) : null;

  const down = (e: React.PointerEvent) => {
    if (leaving) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
    setDrag({ x: 0, y: 0, on: true });
  };
  const move = (e: React.PointerEvent) => { if (drag.on) setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y, on: true }); };
  const up = () => {
    if (!drag.on || !top) return;
    const k = intent(drag.x, drag.y);
    if (k) decide(top, k); else setDrag({ x: 0, y: 0, on: false });
  };

  const fly = (k: Kind) => (k === 'seen' ? 'translate(140%, 6%) rotate(24deg)' : k === 'no' ? 'translate(-140%, 6%) rotate(-24deg)' : 'translate(0, -130%) rotate(-4deg)');

  return createPortal(
    <div className="deck" id="deck">
      <div className="deckhead">
        <button id="dkx" onClick={() => nav.close()}>Fechar</button>
        <b>{count ? `${count} ${count === 1 ? 'resposta' : 'respostas'}` : 'Relembrar rápido'}</b>
        <span style={{ width: 52 }} />
      </div>
      <p className="deckhelp">Arraste para a <b>direita</b> se já viu, para a <b>esquerda</b> se não viu e para <b>cima</b> se não lembra.</p>
      <div className="stack">
        {!top && !flying && <p className="empty" id="dkend">Pronto! Você passou por todos os filmes do baú.</p>}
        {queue.slice().reverse().map((m) => {
          const i = queue.indexOf(m);
          const isTop = i === 0;
          const style: React.CSSProperties = isTop
            ? { transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 16}deg)`, transition: drag.on ? 'none' : 'transform .3s cubic-bezier(.2,.9,.3,1.2)' }
            : { transform: `translateY(${i * 14}px) scale(${1 - i * 0.05})`, opacity: 1 - i * 0.25 };
          return (
            <div key={m.id} className={`dcard${isTop ? ' front' : ''}`} style={style}
              {...(isTop ? { onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up } : {})}>
              {m.poster ? <img src={posterUrl(m.poster, 'w780')} alt="" draggable={false} /> : <div className="dnone">{m.title}</div>}
              <div className="dinfo"><b>{m.title}</b>{m.year && <small>{m.year}</small>}</div>
              {isTop && live && <span className={`stamp ${live}`}>{LABEL[live]}</span>}
            </div>
          );
        })}
        {flying && leaving && (
          <div className="dcard front" style={{ transform: fly(leaving.kind), transition: 'transform .3s ease-in', zIndex: 5 }}>
            {flying.poster ? <img src={posterUrl(flying.poster, 'w780')} alt="" /> : <div className="dnone">{flying.title}</div>}
            <span className={`stamp ${leaving.kind}`}>{LABEL[leaving.kind]}</span>
          </div>
        )}
      </div>
      {top && (
        <div className="deckbtns">
          <button className="no" id="dkno" aria-label="Não vi" onClick={() => decide(top, 'no')}>✕<small>Não vi</small></button>
          <button className="idk" id="dkidk" aria-label="Não lembro" onClick={() => decide(top, 'idk')}>?<small>Não lembro</small></button>
          <button className="seen" id="dkseen" aria-label="Já vi" onClick={() => decide(top, 'seen')}>✓<small>Já vi</small></button>
        </div>
      )}
    </div>,
    document.body,
  );
}
