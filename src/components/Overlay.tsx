import type { ReactNode } from 'react';

/** Tela que abre por cima de tudo (editar perfil, reviews, palpite…). */
export function Overlay({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`ov ${className}`}>
      <div>{children}</div>
    </div>
  );
}

/** Cabeçalho padrão: ação à esquerda, título no meio, ação à direita. */
export function OverlayHeader({ left, title, right }: { left: ReactNode; title: string; right?: ReactNode }) {
  return (
    <div className="ovh">
      {left}
      <b>{title}</b>
      {right ?? <span style={{ width: 52 }} />}
    </div>
  );
}
