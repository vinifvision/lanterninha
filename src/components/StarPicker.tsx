// Escolher a nota direto nas estrelas: tocar (metade esquerda = meia estrela) ou arrastar o dedo.
import { useRef } from 'react';
import { fmt } from '../lib/format';
import { sfx } from '../lib/sfx';
import { Stars } from './Stars';

interface Props {
  /** Nota escolhida (0 = nenhuma ainda) */
  value: number;
  onChange: (v: number) => void;
}

export function StarPicker({ value, onChange }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const last = useRef(value);
  last.current = value;

  /** Posição do dedo → nota de meia em meia (0,5 a 5). */
  const at = (clientX: number) => {
    const r = box.current!.getBoundingClientRect();
    const k = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return Math.min(5, Math.max(0.5, Math.ceil(k * 10) / 2));
  };
  const set = (v: number) => {
    if (v === last.current) return;
    sfx.tick(v > last.current);
    last.current = v;
    onChange(v);
  };

  return (
    <div
      ref={box}
      className="spick"
      id="spick"
      role="slider"
      tabIndex={0}
      aria-label="Sua nota"
      aria-valuemin={0.5}
      aria-valuemax={5}
      aria-valuenow={value || undefined}
      aria-valuetext={value ? `${fmt(value)} ${value === 1 ? 'estrela' : 'estrelas'}` : 'Nenhuma nota ainda'}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = true; set(at(e.clientX)); }}
      onPointerMove={(e) => { if (drag.current) set(at(e.clientX)); }}
      onPointerUp={() => { drag.current = false; }}
      onPointerCancel={() => { drag.current = false; }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); set(Math.min(5, (value || 0) + 0.5)); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); set(Math.max(0.5, (value || 1) - 0.5)); }
      }}
    >
      <Stars value={value} />
    </div>
  );
}
