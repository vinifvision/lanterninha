import { fmt, STATE } from '../lib/format';
import type { Film } from '../lib/types';
import { Poster } from './Poster';

/** Cartão da grade: pôster com a nota (ou o estado) por cima. */
export function FilmCard({ film, onClick, delay = 0 }: { film: Film; onClick: () => void; delay?: number }) {
  return (
    <button className="fc" onClick={onClick} style={{ animationDelay: `${delay}ms` }}>
      <span className="ph">
        <Poster img={film.img} title={film.t} />
        {film.st
          ? <span className="bdg tag">{film.st === 'want' ? (film.by ? 'de ' + film.by : STATE.want) : 'sem nota'}</span>
          : <span className="bdg">{(film.n || 0) > 1 ? '↻ ' : ''}★ {fmt(film.s || 0)}</span>}
      </span>
    </button>
  );
}
