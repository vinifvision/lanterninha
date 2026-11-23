// Puxar para baixo para recarregar. A lanterninha desce com o dedo e os feixes abrem;
// passou do ponto, vibra; soltou, os feixes giram como um farol enquanto recarrega.
import { useEffect, useRef, useState } from 'react';
import { scroller } from '../nav';
import { refresh } from '../lib/refresh';
import { sfx } from '../lib/sfx';

/** Quanto puxar (já com a resistência) para recarregar, e o máximo que desce. */
const TH = 64;
const MAX = 104;

export function PullRefresh({ enabled }: { enabled: boolean }) {
  const [pull, setPull] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'pull' | 'load' | 'done'>('idle');
  const busy = useRef(false);

  useEffect(() => {
    const el = scroller();
    if (!el || !enabled) return;
    let y0 = -1;
    let d = 0;
    let armed = false;
    /** O toque começou dentro de algo que rola sozinho (ex.: o menu dos chips)? Aí o arrasto é dele, não do recarregar. */
    const inner = (t: EventTarget | null) => {
      for (let n = t instanceof Element ? t : null; n && n !== el; n = n.parentElement) {
        if (n.hasAttribute('data-no-pull')) return true;
        const oy = getComputedStyle(n).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) return true;
      }
      return false;
    };
    const start = (e: TouchEvent) => {
      y0 = !busy.current && el.scrollTop <= 0 && e.touches.length === 1 && !inner(e.target) ? e.touches[0].clientY : -1;
      d = 0;
      armed = false;
    };
    const move = (e: TouchEvent) => {
      if (y0 < 0) return;
      const dy = e.touches[0].clientY - y0;
      if (dy <= 0 || el.scrollTop > 0) {
        if (d) { d = 0; setPull(0); setPhase('idle'); }
        return;
      }
      if (e.cancelable) e.preventDefault(); // a tela não rola enquanto puxa
      d = Math.min(MAX, dy * 0.5);
      setPull(d);
      setPhase('pull');
      if (d >= TH && !armed) sfx.haptic(8);
      armed = d >= TH;
    };
    const end = () => {
      if (y0 < 0) return;
      y0 = -1;
      if (d >= TH) {
        busy.current = true;
        setPhase('load');
        setPull(TH);
        void refresh.run().finally(() => {
          setPhase('done');
          setPull(0);
          setTimeout(() => { busy.current = false; setPhase('idle'); }, 320);
        });
      } else {
        setPull(0);
        setPhase('idle');
      }
      d = 0;
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  }, [enabled]);

  const p = Math.min(1, pull / TH);
  const show = phase !== 'idle';
  return (
    <>
      <div
        className={`ptr ${phase}${p >= 1 ? ' ready' : ''}`}
        id="ptr"
        aria-hidden="true"
        style={{ transform: `translate(-50%, ${pull - 48}px)`, opacity: show ? Math.min(1, p * 1.4) : 0 }}
      >
        <svg viewBox="0 0 40 40">
          <g className="fan" style={{ transform: phase === 'load' ? undefined : `rotate(${-80 + 80 * p}deg) scale(${0.55 + 0.45 * p})` }}>
            <path d="M20 20 L25.6 4.2 L30.4 6.8 Z" fill="#e5484d" />
            <path d="M20 20 L31.4 7.6 L34.6 12 Z" fill="#e3b467" />
            <path d="M20 20 L35.2 13 L36.2 18 Z" fill="#f3e9d5" />
          </g>
          <circle cx="20" cy="20" r="6" fill="#0f0e11" />
          <circle cx="20" cy="20" r="4.4" fill="#fbf3e2" />
          <circle cx="20" cy="20" r="1.9" fill="#0f0e11" />
        </svg>
      </div>
      <span className="sr-only" role="status">{phase === 'load' ? 'Atualizando' : ''}</span>
    </>
  );
}
