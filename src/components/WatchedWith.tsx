// "Com quem você viu?": marcar amigos fora do cinema, sem dizer onde.
// É só uma anotação sua: o amigo não recebe aviso e nada muda na conta dele.
// No cinema quem cuida disso é o ingresso (TicketEditor), que tem confirmação.
// Fica fechado numa linha discreta; ao tocar, a lista de amigos abre logo embaixo.
import { useState } from 'react';
import { useCloud } from '../lib/cloud';
import { films } from '../lib/films';
import { pname } from '../lib/format';
import type { Film, Profile } from '../lib/types';
import { Avatar } from './Avatar';

const first = (p: Profile) => pname(p).split(' ')[0];

/** "Teteus", "Teteus e Vanessa", "Teteus e mais 2" */
export const withNames = (names: string[]) =>
  names.length <= 2 ? names.join(' e ') : `${names[0]} e mais ${names.length - 1}`;

export function WatchedWith({ film }: { film: Film }) {
  const { friends } = useCloud();
  const [open, setOpen] = useState(false);
  if (!friends.list.length) return null;

  const ids = film.com || [];
  // Só aparece quem ainda é seu amigo
  const picked = friends.list.filter((p) => p.id && ids.includes(p.id));
  const toggle = (id: string) => {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    film.com = next.length ? next : undefined;
    films.save();
  };

  return (
    <div className={`wwith${open ? ' open' : ''}`}>
      <button type="button" className="wwrow" id="wwrow" aria-expanded={open} onClick={() => setOpen(!open)}>
        {picked.length ? (
          <span className="wwavs">{picked.slice(0, 3).map((p) => <Avatar key={p.id} p={p} />)}</span>
        ) : (
          <svg className="wwico" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
            <circle cx="16.5" cy="9" r="2.6" /><path d="M16 14.1c2.3.1 4 1.7 4.5 4.4" />
          </svg>
        )}
        <span className="wwtxt">{picked.length ? `Com ${withNames(picked.map(first))}` : 'Com quem você viu?'}</span>
        <em>{open ? 'Pronto' : picked.length ? 'Mudar' : '+ Amigos'}</em>
      </button>
      <div className="wwlist" aria-hidden={!open}>
        <div>
          <div className="tkfr">
            {friends.list.map((p) => (
              <button key={p.id} type="button" tabIndex={open ? 0 : -1} className={ids.includes(p.id!) ? 'on' : ''} onClick={() => toggle(p.id!)}>
                <Avatar p={p} /><span>{pname(p)}</span>
              </button>
            ))}
          </div>
          <small className="wwhint">Fica só no seu diário. Ninguém recebe aviso.</small>
        </div>
      </div>
    </div>
  );
}
