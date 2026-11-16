import { useState } from 'react';
import { posterUrl } from '../lib/api';

interface Props {
  img?: string;
  title: string;
  size?: 'w92' | 'w185' | 'w342';
  /** Mostra o título no lugar quando não há pôster (ou ele falha) */
  fallback?: boolean;
  className?: string;
}

/** Pôster do filme. Se a imagem falhar, cai para o título em texto (ou some). */
export function Poster({ img, title, size = 'w185', fallback = true, className }: Props) {
  const [broken, setBroken] = useState(false);
  if (!img || broken) return fallback ? <span>{title}</span> : null;
  return <img className={className} src={posterUrl(img, size)} alt={title} loading="lazy" onError={() => setBroken(true)} />;
}
