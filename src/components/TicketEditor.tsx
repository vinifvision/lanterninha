// Campos do ingresso: o cinema (o app lembra o último usado) e os amigos que foram junto. Tudo opcional.
import { useState } from 'react';
import { nearbyCinemas, type Cinema } from '../lib/api';
import { cloud, useCloud } from '../lib/cloud';
import { films, fkey, useFilms } from '../lib/films';
import { pname } from '../lib/format';
import type { Film } from '../lib/types';
import { Avatar } from './Avatar';

const LAST = 'lantCine';
export const lastCinema = () => { try { return localStorage.getItem(LAST) || ''; } catch { return ''; } };

export function TicketEditor({ film }: { film: Film }) {
  const all = useFilms();
  const { friends, sent, withMe } = useCloud();
  const key = fkey(film);
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
    cloud.syncTags();
  };

  return (
    <div className="tked">
      <label className="lbl" htmlFor="tkcine">Cinema</label>
      <input id="tkcine" type="text" list="tkcines" maxLength={60} placeholder="Ex.: Cinema São Luiz" value={tk.cine || ''} onChange={(e) => setCine(e.target.value)} autoComplete="off" />
      <datalist id="tkcines">{known.map((c) => <option key={c} value={c} />)}</datalist>
      <NearbyCinemas onPick={setCine} />
      {friends.list.length > 0 && (
        <>
          <span className="lbl">Quem foi junto <em className="lblhint">(a pessoa confirma)</em></span>
          <div className="tkfr">
            {friends.list.map((p) => (
              <button key={p.id} type="button" className={(tk.with || []).includes(p.id!) || withMe[key]?.includes(p.id!) ? 'on' : ''} data-f={p.id}
                disabled={withMe[key]?.includes(p.id!)} onClick={() => toggle(p.id!)}>
                <Avatar p={p} /><span>{pname(p)}</span>
                <TagState s={withMe[key]?.includes(p.id!) ? 'tagged' : (tk.with || []).includes(p.id!) ? sent[key]?.[p.id!] : undefined} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** A resposta do amigo marcado, embaixo do nome dele. */
function TagState({ s }: { s?: 'pending' | 'accepted' | 'declined' | 'tagged' }) {
  if (!s) return null;
  return <small className={`tgst ${s}`}>{s === 'tagged' ? 'marcou você' : s === 'accepted' ? '✓ confirmou' : s === 'declined' ? 'não foi' : 'aguardando'}</small>;
}

/** "Cinemas perto de mim": pede a localização uma vez e lista os cinemas reais por perto. */
function NearbyCinemas({ onPick }: { onPick: (name: string) => void }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'denied' | 'error'>('idle');
  const [list, setList] = useState<Cinema[]>([]);

  const find = () => {
    if (!navigator.geolocation) { setState('error'); return; }
    setState('busy');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        nearbyCinemas(pos.coords.latitude, pos.coords.longitude)
          .then((l) => { setList(l); setState('done'); })
          .catch(() => setState('error'));
      },
      (err) => setState(err.code === err.PERMISSION_DENIED ? 'denied' : 'error'),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 },
    );
  };

  if (state === 'idle' || state === 'busy') {
    return (
      <button type="button" className="near" id="tknear" disabled={state === 'busy'} onClick={find}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
        {state === 'busy' ? 'Procurando cinemas…' : 'Cinemas perto de mim'}
      </button>
    );
  }
  if (state === 'denied') return <p className="nearmsg">Sem acesso à localização. Digite o nome do cinema.</p>;
  if (state === 'error') return <p className="nearmsg">Não consegui buscar os cinemas agora. Digite o nome do cinema.</p>;
  if (!list.length) return <p className="nearmsg">Não achei cinemas por perto. Digite o nome do cinema.</p>;
  return (
    <div className="nearlist" id="tknearlist">
      {list.map((c) => (
        <button type="button" key={c.name} onClick={() => { onPick(c.name); setState('idle'); }}>
          <b>{c.name}</b>
          <small>{[c.place, c.km ? `${String(c.km).replace('.', ',')} km` : ''].filter(Boolean).join(', ')}</small>
        </button>
      ))}
    </div>
  );
}
