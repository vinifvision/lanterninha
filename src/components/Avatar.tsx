import type { Profile } from '../lib/types';

/** Foto de perfil, ou a inicial do nome quando não há foto. */
export function Avatar({ p, fallback }: { p?: Pick<Profile, 'avatar' | 'display_name' | 'username'> | null; fallback?: string }) {
  const letter = ((p && (p.display_name || p.username)) || fallback || '?')[0].toUpperCase();
  return <div className="av">{p?.avatar ? <img src={p.avatar} alt="" /> : letter}</div>;
}
