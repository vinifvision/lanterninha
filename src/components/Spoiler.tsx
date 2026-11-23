// Spoiler nas reviews: a chave do editor e o texto borrado para quem ainda não viu o filme.
import { useState } from 'react';
import { fkey, useFilms } from '../lib/films';
import { sfx } from '../lib/sfx';

/** A pessoa já viu esse filme (avaliou ou marcou "Já vi")? */
export function useSeen(key: string): boolean {
  return useFilms().some((h) => fkey(h) === key && h.st !== 'want');
}

/** Chave "Tem spoiler" do editor de review. */
export function SpoilerSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" className={`sw spsw${on ? ' on' : ''}`} role="switch" aria-checked={on} id="rsp" onClick={() => { sfx.tap(); onChange(!on); }}>
      <span>Tem spoiler<small>Fica borrada para quem ainda não viu o filme</small></span><i />
    </button>
  );
}

/** Texto da review. Com spoiler (e a pessoa sem ter visto), fica borrado até ela tocar. */
export function SpoilerText({ text, hide }: { text: string; hide: boolean }) {
  const [open, setOpen] = useState(false);
  if (!hide || open) return <span className={`txt${hide ? ' spopen' : ''}`}>{text}</span>;
  return (
    <button type="button" className="spoil" onClick={() => { sfx.tap(); setOpen(true); }}>
      <span className="txt" aria-hidden="true">{text}</span>
      <span><b>Contém spoiler</b><small>Toque para ler mesmo assim</small></span>
    </button>
  );
}
