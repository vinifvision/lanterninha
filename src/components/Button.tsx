import type { ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = facho (ação principal, só uma por tela); secondary = corredor */
  variant?: 'primary' | 'secondary';
  block?: boolean;
}

/** Botão pílula do sistema visual v2. */
export function Button({ variant = 'primary', block, className = '', ...rest }: Props) {
  const cls = `btn ${variant === 'primary' ? 'btn-primary' : 'btn-sec'}${block ? ' block' : ''} ${className}`.trim();
  return <button type="button" className={cls} {...rest} />;
}
