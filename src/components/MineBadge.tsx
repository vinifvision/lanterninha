// Selo no canto do pôster, diferente para cada situação (o mesmo jeito do Meus filmes):
// ★ nota quando avaliei, ✓ quando vi sem dar nota e marcador quando está em "Quero ver".
import { isRated } from '../lib/films';
import { fmt } from '../lib/format';
import type { Film } from '../lib/types';
import { BookmarkIcon, StarIcon } from './icons';

export function MineBadge({ film }: { film?: Film }) {
  if (!film) return null;
  if (isRated(film)) return <i className="mk rated" aria-label={`Sua nota: ${fmt(film.s)}`}><StarIcon />{fmt(film.s)}</i>;
  if (film.st === 'want') return <i className="mk want" aria-label="Na sua fila Quero ver"><BookmarkIcon /></i>;
  return <i className="mk seen" aria-label="Já vi">✓</i>;
}
