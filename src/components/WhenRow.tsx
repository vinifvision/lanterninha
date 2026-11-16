import { films } from '../lib/films';
import { today } from '../lib/format';
import type { Film } from '../lib/types';

/** Linha "Visto em", com a opção de dizer que não lembra a data. */
export function WhenRow({ film }: { film: Film }) {
  const set = (d: string | undefined) => { film.d = d || undefined; films.save(); };
  return (
    <>
      <div className="when">
        Visto em
        <input type="date" value={film.d || ''} max={today()} onChange={(e) => set(e.target.value)} />
      </div>
      {film.d && <button className="nodate" onClick={() => set(undefined)}>Não lembro a data</button>}
    </>
  );
}
