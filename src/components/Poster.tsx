import { useState } from 'react';
import { posterUrl } from '../lib/api';

interface Props {
  img?: string;
  title: string;
  size?: 'w92' | 'w185' | 'w342';
  /** Mostra um pôster de reserva (cor + título) quando não há pôster ou ele falha */
  fallback?: boolean;
  className?: string;
}

/** Cores do pôster de reserva: [início, fim, cor do texto]. */
const TONES: [string, string, string][] = [
  ['#f6d36a', '#b9791c', '#1a1408'],
  ['#f0767a', '#a3262c', '#1a0a0b'],
  ['#f3e6c8', '#b8a47c', '#1a1408'],
  ['#8fb3c9', '#3d5a6e', '#0b0f14'],
  ['#b49ad6', '#5b3f80', '#fbf3e2'],
];
/** Sempre a mesma cor para o mesmo filme. */
const tone = (t: string) => {
  let h = 0;
  for (const c of t) h = (h * 31 + c.charCodeAt(0)) | 0;
  return TONES[Math.abs(h) % TONES.length];
};

/** Pôster do filme (da API). Se não houver imagem ou ela falhar, mostra o pôster de reserva. */
export function Poster({ img, title, size = 'w185', fallback = true, className }: Props) {
  const [broken, setBroken] = useState(false);
  if (!img || broken) {
    if (!fallback) return null;
    const [a, b, ink] = tone(title);
    return (
      <span className="pfb" style={{ background: `linear-gradient(165deg, ${a}, ${b})`, color: ink }}>
        <em>{title}</em>
      </span>
    );
  }
  return <img className={className} src={posterUrl(img, size)} alt={title} loading="lazy" onError={() => setBroken(true)} />;
}
