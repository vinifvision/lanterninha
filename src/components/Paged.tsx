// Listas que crescem sozinhas: busca a próxima página quando a pessoa chega perto do fim
// e nunca repete um filme que já está na tela.
import { useCallback, useEffect, useRef, useState } from 'react';
import { scroller } from '../nav';

export interface Page<T> { results: T[]; page: number; totalPages: number }

export interface Paged<T> {
  /** null enquanto a primeira página não chegou */
  items: T[] | null;
  loading: boolean;
  /** Acabou de verdade: não há mais páginas */
  done: boolean;
  /** A última busca falhou (a pessoa pode tentar de novo) */
  failed: boolean;
  more: () => void;
  retry: () => void;
}

interface State<T> { items: T[] | null; next: number; done: boolean; failed: boolean }

/**
 * Carrega uma lista página por página. `load` recebe o número da página (a partir de 1);
 * com `load` nulo a lista fica vazia. Quando algo em `deps` muda, recomeça do zero.
 */
export function usePages<T extends { id: number }>(load: ((page: number) => Promise<Page<T>>) | null, deps: unknown[]): Paged<T> {
  const [st, setSt] = useState<State<T>>({ items: null, next: 1, done: !load, failed: false });
  const [loading, setLoading] = useState(false);
  const stRef = useRef(st);
  stRef.current = st;
  const loadRef = useRef(load);
  loadRef.current = load;
  const busy = useRef(false);
  // Cada recomeço ganha um número novo; respostas de antes dele são ignoradas
  const gen = useRef(0);

  const fetchPage = useCallback((page: number) => {
    const fn = loadRef.current;
    if (!fn || busy.current) return;
    const g = gen.current;
    busy.current = true;
    setLoading(true);
    fn(page)
      .then((d) => {
        if (g !== gen.current) return;
        setSt((s) => {
          const seen = new Set((s.items || []).map((x) => x.id));
          const fresh = d.results.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
          return { items: [...(s.items || []), ...fresh], next: page + 1, done: page >= d.totalPages || d.results.length === 0, failed: false };
        });
      })
      .catch(() => { if (g === gen.current) setSt((s) => ({ ...s, failed: true })); })
      .finally(() => { if (g === gen.current) { busy.current = false; setLoading(false); } });
  }, []);

  useEffect(() => {
    gen.current++;
    busy.current = false;
    setLoading(false);
    setSt({ items: null, next: 1, done: !loadRef.current, failed: false });
    fetchPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const more = useCallback(() => {
    const s = stRef.current;
    if (!s.done && !s.failed) fetchPage(s.next);
  }, [fetchPage]);
  const retry = useCallback(() => {
    setSt((s) => ({ ...s, failed: false }));
    fetchPage(stRef.current.next);
  }, [fetchPage]);

  return { items: st.items, loading, done: st.done, failed: st.failed, more, retry };
}

/**
 * Fim da lista: fica de olho na rolagem e pede mais quando a pessoa se aproxima.
 * Mostra um carregando discreto, um aviso quando acabou ou um "Tentar de novo" se falhou.
 */
export function ListEnd({ p }: { p: Paged<unknown> }) {
  const ref = useRef<HTMLDivElement>(null);
  const { items, loading, done, failed, more, retry } = p;

  useEffect(() => {
    const el = ref.current;
    if (!el || !items || done || failed || loading) return;
    // Recriado a cada página: se o fim ainda estiver à vista, já pede a próxima
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) more(); }, {
      root: scroller(),
      rootMargin: '0px 0px 700px 0px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, [items, loading, done, failed, more]);

  if (!items || (done && items.length === 0)) return null;
  if (failed) {
    return (
      <div className="v2end" role="status">
        Não consegui carregar mais filmes.
        <button type="button" onClick={retry}>Tentar de novo</button>
      </div>
    );
  }
  if (done) return <p className="v2end fin">Você chegou ao fim da lista</p>;
  return (
    <div className="v2end" ref={ref}>
      <span className="v2spin" role="status" aria-label="Carregando mais filmes" />
    </div>
  );
}
