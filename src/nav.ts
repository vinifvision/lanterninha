// Navegação do app: aba atual, pilha de telas abertas por cima dela e telas sobrepostas (overlays).
import { useSyncExternalStore } from 'react';
import type { Film, FilmInfo, FriendRating, Profile, RatedFilm } from './lib/types';

export type Tab = 'rate' | 'home' | 'lib' | 'prof';

export type Screen =
  | { k: 'film'; info: FilmInfo }
  | { k: 'friend'; id: string }
  | { k: 'quiz'; info: FilmInfo; classic: boolean; rewatch: RatedFilm | null; answers?: number[] }
  | { k: 'result'; info: FilmInfo; key: string; base: number; classic: boolean; rewatch: RatedFilm | null; replaced: Film | null; answers: number[] };

export type Overlay =
  | { k: 'reviews'; info: FilmInfo; focusId?: string; known?: FriendRating }
  | { k: 'editor'; key: string }
  | { k: 'share'; key: string }
  | { k: 'editProfile' }
  | { k: 'addFriend' }
  | { k: 'settings' }
  | { k: 'recommend'; info: FilmInfo }
  | { k: 'guess'; friend: Profile; films: RatedFilm[] };

export interface NavState {
  tab: Tab;
  stack: Screen[];
  overlays: Overlay[];
  /** Avanço da avaliação (0 a 1), ou null fora dela */
  progress: number | null;
}

let state: NavState = { tab: 'rate', stack: [], overlays: [], progress: null };
const listeners = new Set<() => void>();
/** Uma tela pode tratar o "voltar" por conta própria (ex.: voltar uma pergunta). Devolve true se tratou. */
let backHandler: (() => boolean) | null = null;
const set = (patch: Partial<NavState>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };

/** A área que rola (o corpo da página fica parado, como em um aplicativo). */
export const scroller = () => document.getElementById('scroller');
/** Posição da rolagem de cada tela que ficou para trás na pilha. */
let scrolls: number[] = [];
/** Rola depois que a tela nova for desenhada. */
const scrollTo = (y: number) => {
  const go = () => { const el = scroller(); if (el) el.scrollTop = y; };
  go(); requestAnimationFrame(go);
};

export const nav = {
  get state() { return state; },
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },

  /** Vai para uma aba, fechando qualquer tela aberta por cima. */
  tab(tab: Tab) { scrolls = []; set({ tab, stack: [], progress: null }); scrollTo(0); },
  push(screen: Screen) { scrolls.push(scroller()?.scrollTop || 0); set({ stack: [...state.stack, screen] }); scrollTo(0); },
  /** Troca a tela do topo (ex.: da avaliação para o resultado). */
  replace(screen: Screen) { set({ stack: [...state.stack.slice(0, -1), screen], progress: null }); scrollTo(0); },
  setBackHandler(fn: (() => boolean) | null) { backHandler = fn; },
  back() {
    if (state.overlays.length) return nav.close();
    if (backHandler?.()) return;
    if (state.stack.length) {
      // Volta para o ponto da tela em que a pessoa estava antes de abrir esta
      const y = scrolls.pop() || 0;
      set({ stack: state.stack.slice(0, -1), progress: null });
      scrollTo(y);
    }
  },
  /** Fecha tudo que está aberto por cima da aba. */
  home() { scrolls = []; set({ stack: [], overlays: [], progress: null }); },

  open(overlay: Overlay) { set({ overlays: [...state.overlays, overlay] }); },
  close() { set({ overlays: state.overlays.slice(0, -1) }); },
  setProgress(progress: number | null) { if (progress !== state.progress) set({ progress }); },

  /** Atalho: começar a avaliar um filme. */
  startQuiz(info: FilmInfo, opts: { rewatch?: RatedFilm | null; classic: boolean }) {
    set({ overlays: [] });
    nav.push({ k: 'quiz', info, classic: opts.classic, rewatch: opts.rewatch || null });
  },
  openFilm(info: FilmInfo) { set({ overlays: [] }); nav.push({ k: 'film', info }); },
};

export function useNav(): NavState {
  return useSyncExternalStore(nav.subscribe, () => state);
}
