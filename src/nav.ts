// Navegação do app: aba atual, pilha de telas abertas por cima dela e telas sobrepostas (overlays).
import { useState, useSyncExternalStore } from 'react';
import type { Film, FilmInfo, FriendRating, Profile, RatedFilm } from './lib/types';
import type { DiscoverList, PersonKind } from './lib/api';

export type Tab = 'rate' | 'search' | 'home' | 'lib' | 'prof';

export type Screen =
  | { k: 'film'; info: FilmInfo }
  | { k: 'friend'; id: string }
  | { k: 'friendFilms'; id: string; only?: 'unseen' }
  | { k: 'friendReviews'; id: string }
  | { k: 'credits'; info: FilmInfo }
  | { k: 'person'; kind: PersonKind; id: number; name: string; photo?: string }
  | { k: 'list'; title: string; em?: string; list: DiscoverList; id?: number }
  | { k: 'diary' }
  | { k: 'myReviews' }
  | { k: 'justSeen' }
  | { k: 'friends' }
  | { k: 'guide' }
  | { k: 'quiz'; info: FilmInfo; classic: boolean; rewatch: RatedFilm | null; answers?: number[]; direct?: boolean; help?: boolean }
  | { k: 'details'; info: FilmInfo; key: string; base: number; classic: boolean; rewatch: RatedFilm | null; replaced: Film | null; answers: number[] }
  | { k: 'result'; info: FilmInfo; key: string; base: number; classic: boolean; rewatch: RatedFilm | null; replaced: Film | null; answers: number[] };

export type Overlay =
  | { k: 'reviews'; info: FilmInfo; focusId?: string; known?: FriendRating }
  | { k: 'editor'; key: string }
  | { k: 'share'; key: string }
  | { k: 'editProfile' }
  | { k: 'addFriend' }
  | { k: 'settings' }
  | { k: 'newPassword' }
  | { k: 'signup' }
  | { k: 'welcome' }
  | { k: 'novidades' }
  | { k: 'ticket'; key: string }
  | { k: 'filmEdit'; key: string }
  | { k: 'tonight'; start?: 'queue' | 'taste' }
  | { k: 'recommend'; info: FilmInfo }
  | { k: 'guess'; friend: Profile; films: RatedFilm[] };

export interface NavState {
  tab: Tab;
  stack: Screen[];
  overlays: Overlay[];
  /** Avanço da avaliação (0 a 1), ou null fora dela */
  progress: number | null;
  /** Aba de onde a pessoa veio por um atalho (ex.: "Ver tudo" no Início), para o botão voltar */
  from?: Tab | null;
}

let state: NavState = { tab: 'rate', stack: [], overlays: [], progress: null };
const listeners = new Set<() => void>();
/** Uma tela pode tratar o "voltar" por conta própria (ex.: voltar uma pergunta). Devolve true se tratou. */
let backHandler: (() => boolean) | null = null;
/** O mesmo, para a tela sobreposta do topo (ex.: criar conta volta um passo). */
let overlayBack: (() => boolean) | null = null;
const set = (patch: Partial<NavState>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };

/** A área que rola (o corpo da página fica parado, como em um aplicativo). */
export const scroller = () => document.getElementById('scroller');
/** Posição da rolagem de cada tela que ficou para trás na pilha. */
let scrolls: number[] = [];
/** Cada pedido de rolagem ganha um número; um pedido novo cancela o anterior. */
let scrollGen = 0;
/**
 * Rola depois que a tela nova for desenhada. Se o conteúdo ainda está chegando
 * (a tela ainda não é alta o bastante), tenta de novo por até ~1 segundo.
 */
const scrollTo = (y: number) => {
  const g = ++scrollGen;
  let tries = 0;
  const go = () => {
    if (g !== scrollGen) return;
    const el = scroller();
    if (el) el.scrollTop = y;
    if (y > 0 && (!el || Math.abs(el.scrollTop - y) > 1) && ++tries < 60) requestAnimationFrame(go);
  };
  go(); requestAnimationFrame(go);
};
// Se a pessoa mexer na tela enquanto a posição volta, para de forçar a rolagem
['touchstart', 'wheel'].forEach((ev) => window.addEventListener(ev, () => { scrollGen++; }, { passive: true }));

/**
 * Estado de cada tela que ficou para trás na pilha (aba escolhida, filtros, páginas já carregadas),
 * para ela voltar do jeito que estava. A chave começa pela profundidade da tela na pilha (0 = a aba).
 */
const kept = new Map<string, unknown>();
/** Esquece o estado das telas desta profundidade para cima. */
const forget = (from: number) => { for (const k of [...kept.keys()]) if (Number(k.split('|')[0]) >= from) kept.delete(k); };

/** Igual ao useState, mas a tela lembra o valor quando a pessoa abre outra por cima e volta. */
export function useKept<T>(key: string, init: T | (() => T)) {
  const [id] = useState(() => `${state.stack.length}|${key}`);
  const pair = useState<T>(() => (kept.has(id) ? (kept.get(id) as T) : typeof init === 'function' ? (init as () => T)() : init));
  kept.set(id, pair[0]);
  return pair;
}
/** Diz se a tela já tem um valor guardado para esta chave (ex.: para não buscar a lista de novo). */
export const isKept = (key: string) => kept.has(`${state.stack.length}|${key}`);

export const nav = {
  get state() { return state; },
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },

  /** Vai para uma aba, fechando qualquer tela aberta por cima. */
  tab(tab: Tab, from?: Tab) { scrolls = []; kept.clear(); set({ tab, stack: [], progress: null, from: from ?? null }); scrollTo(0); },
  push(screen: Screen) { scrolls.push(scroller()?.scrollTop || 0); forget(state.stack.length + 1); set({ stack: [...state.stack, screen] }); scrollTo(0); },
  /** Troca a tela do topo (ex.: da avaliação para o resultado). */
  replace(screen: Screen) { forget(state.stack.length); set({ stack: [...state.stack.slice(0, -1), screen], progress: null }); scrollTo(0); },
  setBackHandler(fn: (() => boolean) | null) { backHandler = fn; },
  setOverlayBackHandler(fn: (() => boolean) | null) { overlayBack = fn; },
  back() {
    if (state.overlays.length) { if (overlayBack?.()) return; return nav.close(); }
    if (backHandler?.()) return;
    if (state.stack.length) {
      // Volta para o ponto da tela em que a pessoa estava antes de abrir esta
      const y = scrolls.pop() || 0;
      forget(state.stack.length);
      set({ stack: state.stack.slice(0, -1), progress: null });
      scrollTo(y);
    } else if (state.from) nav.tab(state.from);
  },
  /** Fecha tudo que está aberto por cima da aba. */
  home() { scrolls = []; forget(1); set({ stack: [], overlays: [], progress: null }); },

  open(overlay: Overlay) { set({ overlays: [...state.overlays, overlay] }); },
  close() { set({ overlays: state.overlays.slice(0, -1) }); },
  setProgress(progress: number | null) { if (progress !== state.progress) set({ progress }); },

  /** Atalho: começar a avaliar um filme. */
  startQuiz(info: FilmInfo, opts: { rewatch?: RatedFilm | null; classic: boolean; direct?: boolean; help?: boolean }) {
    set({ overlays: [] });
    nav.push({ k: 'quiz', info, classic: opts.classic, rewatch: opts.rewatch || null, direct: opts.direct, help: opts.help });
  },
  /** Página de um diretor, ator, roteirista... ou de uma produtora, com todos os filmes. */
  openPerson(kind: PersonKind, id: number, name: string, photo?: string) { set({ overlays: [] }); nav.push({ k: 'person', kind, id, name, photo }); },
  openFilm(info: FilmInfo) { set({ overlays: [] }); nav.push({ k: 'film', info }); },
};

export function useNav(): NavState {
  return useSyncExternalStore(nav.subscribe, () => state);
}
