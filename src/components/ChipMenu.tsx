// Chip que abre um menu de opções com a cara do app (no lugar do <select> do sistema).
// Abre logo abaixo do chip; fecha ao escolher, ao tocar fora ou com Esc.
import { useEffect, useRef, useState } from 'react';

export type ChipOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  label: string; // nome para leitores de tela, ex.: "Ano"
  value: T;
  options: ChipOption<T>[];
  onChange: (v: T) => void;
};

export function ChipMenu<T extends string>({ label, value, options, onChange }: Props<T>) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const pick = (v: T) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div className="v2cm" ref={box}>
      <button
        type="button"
        className={`v2chip v2sel${open ? ' open' : ''}`}
        aria-label={`${label}: ${current?.label ?? ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {current?.label}
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <ul className="v2cmlist" role="listbox" aria-label={label}>
          {options.map((o, i) => {
            const on = o.value === value;
            return (
              <li key={o.value} role="option" aria-selected={on} style={{ animationDelay: `${i * 25}ms` }}>
                <button type="button" className={on ? 'on' : ''} onClick={() => pick(o.value)}>
                  <span>{o.label}</span>
                  {on && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
