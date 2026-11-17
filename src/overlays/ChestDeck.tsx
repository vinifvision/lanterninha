// Relembrar rápido: um pôster grande por vez. Direita = Já vi, esquerda = Não vi, para cima = Não lembro.
// O arrastar mexe direto no cartão (sem redesenhar a tela a cada movimento do dedo), para ficar liso no celular.
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
const LIMIT = 90;
const intent = (x: number, y: number): Kind | null => (y < -LIMIT && Math.abs(y) > Math.abs(x) ? 'idk' : x > LIMIT ? 'seen' : x < -LIMIT ? 'no' : null);
const OUT: Record<Kind, string> = {
  seen: 'translate(150%, 4%) rotate(26deg)',
  no: 'translate(-150%, 4%) rotate(-26deg)',
  idk: 'translate(0, -140%) rotate(-4deg)',
};

export function ChestDeck() {
  const st = useChestList();
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const stamp = useRef<HTMLSpanElement>(null);
  const drag = useRef({ on: false, x0: 0, y0: 0, x: 0, y: 0, raf: 0 });

  if (!st) return null;
  const queue = st.pending.slice(0, 3);
  const top = queue[0];

  /** Mostra o carimbo conforme o cartão se afasta do centro. */
  const paintStamp = (x: number, y: number) => {
    const el = stamp.current; if (!el) return;
    const k = intent(x, y) || (Math.abs(y) > Math.abs(x) && y < 0 ? 'idk' : x >= 0 ? 'seen' : 'no');
    el.className = `stamp ${k}`;
    el.textContent = LABEL[k];
    el.style.opacity = String(Math.min(1, Math.max(Math.abs(x), -y) / LIMIT));
  };
  const place = () => {
    const d = drag.current, el = card.current;
    d.raf = 0;
    if (!el) return;
    el.style.transform = `translate(${d.x}px, ${d.y}px) rotate(${d.x / 16}deg)`;
    paintStamp(d.x, d.y);
  };

  const decide = (m: SearchResult, kind: Kind) => {
    if (busy) return;
    setBusy(true);
    sfx.swipe(kind);
    const el = card.current;
    if (el) { el.style.transition = 'transform .28s ease-in, opacity .28s'; el.style.transform = OUT[kind]; el.style.opacity = '0.4'; }
    if (stamp.current) { stamp.current.className = `stamp ${kind}`; stamp.current.textContent = LABEL[kind]; stamp.current.style.opacity = '1'; }
    setTimeout(() => {
      if (kind === 'seen') films.fromChest({ id: m.id, t: m.title, y: m.year, o: m.original, img: m.poster });
      else chest.answer(m.id, kind);
      setCount((c) => c + 1);
      setBusy(false);
    }, 260);
  };

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (busy) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    Object.assign(drag.current, { on: true, x0: e.clientX, y0: e.clientY, x: 0, y: 0 });
    e.currentTarget.style.transition = 'none';
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current; if (!d.on) return;
    d.x = e.clientX - d.x0; d.y = e.clientY - d.y0;
    if (!d.raf) d.raf = requestAnimationFrame(place);
  };
  const up = () => {
    const d = drag.current; if (!d.on || !top) return;
    d.on = false;
    if (d.raf) { cancelAnimationFrame(d.raf); d.raf = 0; }
    const k = intent(d.x, d.y);
    if (k) { decide(top, k); return; }
    // Não passou do limite: volta para o centro com uma molinha
    const el = card.current;
    if (el) { el.style.transition = 'transform .35s cubic-bezier(.2,.9,.3,1.25)'; el.style.transform = ''; }
    if (stamp.current) stamp.current.style.opacity = '0';
  };

  return createPortal(
    <div className="deck" id="deck">
      <div className="deckhead">
        <button id="dkx" onClick={() => nav.close()}>Fechar</button>
        <b>{count ? `${count} ${count === 1 ? 'resposta' : 'respostas'}` : 'Relembrar rápido'}</b>
        <span style={{ width: 52 }} />
      </div>
      <p className="deckhelp">Arraste para a <b>direita</b> se já viu, para a <b>esquerda</b> se não viu e para <b>cima</b> se não lembra.</p>
      <div className="stack">
        {!top && <p className="empty" id="dkend">Pronto! Você passou por todos os filmes do baú.</p>}
        {queue.slice().reverse().map((m) => {
          const i = queue.indexOf(m);
          const front = i === 0;
          return (
            <div
              key={m.id}
              ref={front ? card : undefined}
              className={`dcard${front ? ' front' : ''}`}
              style={front ? undefined : { transform: `translateY(${i * 14}px) scale(${1 - i * 0.05})`, opacity: 1 - i * 0.3 }}
              {...(front ? { onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up } : {})}
            >
              {m.poster ? <img src={posterUrl(m.poster, 'w500')} alt="" draggable={false} decoding="async" /> : <div className="dnone">{m.title}</div>}
              <div className="dinfo"><b>{m.title}</b>{m.year && <small>{m.year}</small>}</div>
              {front && <span ref={stamp} className="stamp" style={{ opacity: 0 }} />}
            </div>
          );
        })}
        {/* Já deixa o próximo pôster carregado, para não piscar quando ele chegar na frente */}
        {st.pending[3]?.poster && <img className="preload" src={posterUrl(st.pending[3].poster, 'w500')} alt="" />}
      </div>
      {top && (
        <div className="deckbtns">
          <button className="no" id="dkno" aria-label="Não vi" disabled={busy} onClick={() => decide(top, 'no')}>✕<small>Não vi</small></button>
          <button className="idk" id="dkidk" aria-label="Não lembro" disabled={busy} onClick={() => decide(top, 'idk')}>?<small>Não lembro</small></button>
          <button className="seen" id="dkseen" aria-label="Já vi" disabled={busy} onClick={() => decide(top, 'seen')}>✓<small>Já vi</small></button>
        </div>
      )}
    </div>,
    document.body,
  );
}
