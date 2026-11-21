import { fmt } from '../lib/format';

/** Nota pequena: uma estrela e o número ("★ 4,5"). Nunca usa o caractere ½. */
export function RatingChip({ value }: { value: number }) {
  return <span className="chip">★ {fmt(value)}</span>;
}
