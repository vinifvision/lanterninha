import type { Profile } from '../lib/types';

/** Foto de perfil, ou a inicial do nome quando não há foto. */
export function Avatar({ p, fallback, ring }: { p?: Pick<Profile, 'avatar' | 'display_name' | 'username'> | null; fallback?: string; /** Anel aceso: a pessoa avaliou algo novo */ ring?: boolean }) {
  const letter = ((p && (p.display_name || p.username)) || fallback || '?')[0].toUpperCase();
  const av = <div className="av">{p?.avatar ? <img src={p.avatar} alt="" /> : letter}</div>;
  return ring ? <div className="avr">{av}</div> : av;
}
