// Curtir review: o botão de coração e o texto "Curtida por Fulano e Ciclano".
import { useState } from 'react';
import { pname } from '../lib/format';
import { sfx } from '../lib/sfx';
import type { Profile } from '../lib/types';

/** Coração com o número de curtidas. Só pula a animação quando a pessoa acende agora (não ao abrir a tela). */
export function LikeButton({ n, on, onClick }: { n: number; on: boolean; onClick: () => void }) {
  const [pop, setPop] = useState(false);
  const tap = () => { if (!on) { setPop(true); sfx.tap(); } else setPop(false); onClick(); };
  return (
    <button type="button" className={`like${on ? ' on' : ''}${on && pop ? ' pop' : ''}`} aria-pressed={on} aria-label={on ? 'Descurtir review' : 'Curtir review'} onClick={tap}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.2-4.4-8.9-8.9C2 8 4 4.8 7.3 4.8c1.9 0 3.5 1 4.7 2.7 1.2-1.7 2.8-2.7 4.7-2.7C20 4.8 22 8 20.9 11.1 19.2 15.6 12 20 12 20z" /></svg>
      {n > 0 && <span key={n}>{n}</span>}
    </button>
  );
}

/** "Teteus", "Teteus e Vanessa", "Teteus, Vanessa e mais 2". Vazio se ninguém curtiu. */
export function likedBy(ids: string[], friends: Profile[]): string {
  if (!ids.length) return '';
  const names = ids.map((id) => friends.find((f) => f.id === id)).filter((p): p is Profile => !!p).map(pname);
  const rest = ids.length - Math.min(names.length, 2);
  if (!names.length) return ids.length === 1 ? '1 pessoa' : `${ids.length} pessoas`;
  if (rest <= 0) return names.length === 1 ? names[0] : `${names[0]} e ${names[1]}`;
  return names.length === 1 ? `${names[0]} e mais ${rest}` : `${names[0]}, ${names[1]} e mais ${rest}`;
}
