import { STAR_PATH } from '../lib/format';

interface Props {
  value: number;
  /** Faz as estrelas pularem uma a uma */
  anim?: boolean;
  /** Atraso antes da primeira estrela, em ms */
  base?: number;
  /** Intervalo entre uma estrela e a próxima, em ms */
  gap?: number;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

/** Cinco estrelas, com preenchimento de meia em meia. */
export function Stars({ value, anim = false, base = 0, gap = 90, onClick }: Props) {
  return (
    <div className="stars" onClick={onClick}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div className="star" key={i} style={anim ? { animationDelay: `${base + i * gap}ms` } : { animation: 'none' }}>
          <svg viewBox="0 0 24 24"><path d={STAR_PATH} fill="#2c2830" /></svg>
          <div className="f" style={{ width: `${Math.max(0, Math.min(1, value - i)) * 100}%` }}>
            <svg viewBox="0 0 24 24"><path d={STAR_PATH} fill="#f2c97f" /></svg>
          </div>
        </div>
      ))}
    </div>
  );
}
