// O ingresso de papel: picote, nome do filme, sessão e cinema. O canhoto pode ser "rasgado" com animação.
import { useCloud } from '../lib/cloud';
import { fkey } from '../lib/films';
import { fd, fmt, pname } from '../lib/format';
import type { Film } from '../lib/types';

export function Ticket({ film, torn, onClick }: { film: Film; torn?: boolean; onClick?: () => void }) {
  const { friends, sent, withMe } = useCloud();
  const tk = film.tk || {};
  const key = fkey(film);
  // Quem eu marquei (menos quem disse que não foi) e quem me marcou e eu confirmei
  const ids = [...new Set([...(tk.with || []).filter((id) => sent[key]?.[id] !== 'declined'), ...(withMe[key] || [])])];
  const names = ids.map((id) => friends.list.find((p) => p.id === id)).filter(Boolean).map((p) => pname(p!));
  const num = String(film.ts || 0).slice(-6).padStart(6, '0');
  const body = (
    <>
      <div className="tmain">
        <span className="tk1">Lanterninha<em> · Entrada</em></span>
        <b className="tktitle">{film.t}</b>
        <div className="tkrow">
          <div><small>Sessão</small><span>{fd(film.d) || '—'}</span></div>
          <div><small>Cinema</small><span>{tk.cine || '—'}</span></div>
        </div>
        {names.length > 0 && <div className="tkwith"><small>Com</small><span>{names.join(', ')}</span></div>}
      </div>
      <div className="tstub">
        <span className="tkno">Nº {num}</span>
        {typeof film.s === 'number' && <b>★ {fmt(film.s)}</b>}
        {film.y && <small>{film.y}</small>}
      </div>
    </>
  );
  return onClick
    ? <button type="button" className={`ticket${torn ? ' torn' : ''}`} onClick={onClick}>{body}</button>
    : <div className={`ticket${torn ? ' torn' : ''}`}>{body}</div>;
}
