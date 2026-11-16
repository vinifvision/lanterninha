import type { TopItem } from '../lib/types';
import { Poster } from './Poster';

/** Os quatro favoritos do perfil. `empty` é o que aparece no espaço vazio. */
export function TopFour({ top4, empty, onPick, id }: { top4: (TopItem | null)[]; empty: string; onPick: (i: number) => void; id?: string }) {
  return (
    <div className="t4" id={id}>
      {top4.map((f, i) => (
        <button key={i} data-i={i} className={f ? 'has' : ''} aria-label={`Favorito ${i + 1}`} onClick={() => onPick(i)}>
          {f ? <Poster img={f.img} title={f.t} /> : empty}
        </button>
      ))}
    </div>
  );
}
