import { useEffect, useRef, useState } from 'react';

/** Botão de dois toques: o primeiro "arma" (e desarma sozinho depois de um tempo), o segundo confirma. */
export function useArmed(ms = 3000): [boolean, () => boolean] {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  /** Devolve true quando é o segundo toque (pode executar a ação). */
  const press = () => {
    if (armed) { clearTimeout(timer.current); setArmed(false); return true; }
    setArmed(true);
    timer.current = setTimeout(() => setArmed(false), ms);
    return false;
  };
  return [armed, press];
}

/** Guarda o resultado de uma busca assíncrona; ignora a resposta se o componente sumir ou a chave mudar. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    let alive = true;
    setValue(undefined);
    load().then((v) => { if (alive) setValue(v); }).catch(() => { /* fica sem dado */ });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}
