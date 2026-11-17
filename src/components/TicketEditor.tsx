// Campos do ingresso: o cinema (o app lembra o último usado) e os amigos que foram junto. Tudo opcional.
import { useCloud } from '../lib/cloud';
import { films, useFilms } from '../lib/films';
import { pname } from '../lib/format';
import type { Film } from '../lib/types';
import { Avatar } from './Avatar';

const LAST = 'lantCine';
export const lastCinema = () => { try { return localStorage.getItem(LAST) || ''; } catch { return ''; } };

export function TicketEditor({ film }: { film: Film }) {
  const all = useFilms();
  const { friends } = useCloud();
  const tk = film.tk || {};
  // Cinemas já usados em outros ingressos, para sugerir enquanto digita
  const known = [...new Set(all.map((h) => h.tk?.cine).filter((c): c is string => !!c))].slice(0, 20);

  const update = (patch: Partial<NonNullable<Film['tk']>>) => {
    const next = { ...tk, ...patch };
    if (!next.cine) delete next.cine;
    if (!next.with?.length) delete next.with;
    film.tk = next.cine || next.with ? next : undefined;
    films.save();
  };
  const setCine = (v: string) => {
    update({ cine: v.slice(0, 60) || undefined });
    try { if (v.trim()) localStorage.setItem(LAST, v.trim()); } catch { /* ok */ }
  };
  const toggle = (id: string) => {
    const w = tk.with || [];
    update({ with: w.includes(id) ? w.filter((x) => x !== id) : [...w, id] });
  };

  return (
    <div className="tked">
      <label className="lbl" htmlFor="tkcine">Cinema</label>
      <input id="tkcine" type="text" list="tkcines" maxLength={60} placeholder="Ex.: Cinema São Luiz" value={tk.cine || ''} onChange={(e) => setCine(e.target.value)} autoComplete="off" />
      <datalist id="tkcines">{known.map((c) => <option key={c} value={c} />)}</datalist>
      {friends.list.length > 0 && (
        <>
          <span className="lbl">Quem foi junto</span>
          <div className="tkfr">
            {friends.list.map((p) => (
              <button key={p.id} type="button" className={(tk.with || []).includes(p.id!) ? 'on' : ''} data-f={p.id} onClick={() => toggle(p.id!)}>
                <Avatar p={p} /><span>{pname(p)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
