// Recarregar a página: "puxar para baixo" e o "Tentar de novo" usam isto.
// Cada recarga aumenta um contador; as telas põem o contador nas dependências do que carregam,
// então tudo o que vem da internet é buscado de novo (amigos, notas, listas, detalhes do filme).
import { useSyncExternalStore } from 'react';
import { cloud } from './cloud';

let tick = 0;
let busy: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export const refresh = {
  get tick() { return tick; },
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  /** Recarrega tudo. Dura pelo menos 0,7 s, para a animação não piscar. */
  run(): Promise<void> {
    if (busy) return busy;
    tick++;
    emit();
    const wait = new Promise<void>((r) => setTimeout(r, 700));
    const sync = cloud.state.user
      ? Promise.allSettled([cloud.syncNow(), cloud.loadFriends()]).then(() => undefined)
      : Promise.resolve();
    busy = Promise.all([wait, sync]).then(() => undefined).finally(() => { busy = null; });
    return busy;
  },
};

/** O número da última recarga (use nas dependências do que a tela busca na internet). */
export function useRefresh(): number {
  return useSyncExternalStore(refresh.subscribe, () => tick);
}
