// O Baú da infância: o período da infância de quem nasceu num ano e o que ainda falta responder.
import { useEffect, useState } from 'react';
import { childhoodFilms } from './api';
import { useChest } from './cloud';
import { fkey, useFilms } from './films';
import type { Film, SearchResult } from './types';

export const childhoodRange = (born: number) => {
  const now = new Date().getFullYear();
  return { from: born + 4, to: Math.min(born + 14, now) };
};

export interface ChestState {
  ready: boolean;
  failed: boolean;
  from: number;
  to: number;
  /** Todos os filmes do período */
  list: SearchResult[];
  /** Ainda não respondidos (depois vêm os "não lembro", para uma segunda chance) */
  pending: SearchResult[];
  /** Filmes que a pessoa lembrou (marcados pelo Baú) */
  remembered: Film[];
}

export function useChestList(): ChestState | null {
  const data = useChest();
  const all = useFilms();
  const [list, setList] = useState<SearchResult[] | null>(null);
  const [failed, setFailed] = useState(false);
  const range = data.born ? childhoodRange(data.born) : null;

  useEffect(() => {
    if (!range) return;
    let alive = true;
    setList(null); setFailed(false);
    childhoodFilms(range.from, range.to).then((l) => { if (alive) setList(l); }).catch(() => { if (alive) { setFailed(true); setList([]); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.from, range?.to]);

  if (!range) return null;
  const mine = new Set(all.filter((h) => h.st !== 'want' || h.b).map(fkey));
  const fresh = (list || []).filter((m) => !mine.has('m' + m.id) && !data.no.includes(m.id) && !data.idk.includes(m.id));
  const again = (list || []).filter((m) => !mine.has('m' + m.id) && data.idk.includes(m.id));
  return {
    ready: !!list, failed, ...range, list: list || [],
    pending: [...fresh, ...again],
    remembered: all.filter((h) => h.b).sort((a, b) => (b.ts || 0) - (a.ts || 0)),
  };
}
