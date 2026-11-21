// Tela "Novidades": comemora uma versão nova. O conteúdo vem de src/lib/novidades.ts
// (para a próxima versão, mude só a lista lá).
import { useState, type CSSProperties } from 'react';
import { Button } from '../components/Button';
import { Overlay } from '../components/Overlay';
import { NOVIDADES, type NovIcone } from '../lib/novidades';
import { sfx } from '../lib/sfx';
import { nav } from '../nav';

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;
const STAR = 'M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2 6.3 20.3l1.2-6.4L2.8 9.5l6.4-.8z';

function Icone({ k }: { k: NovIcone }) {
  switch (k) {
    case 'visual':
      return <svg viewBox="0 0 24 24" {...S}><path d="M11 4l1.7 4.8L17.5 10.5l-4.8 1.7L11 17l-1.7-4.8L4.5 10.5l4.8-1.7z" /><path d="M18.5 3v4M16.5 5h4" /></svg>;
    case 'baralho':
      return <svg viewBox="0 0 24 24" {...S}><rect x="8.5" y="3.5" width="11" height="15" rx="2" transform="rotate(10 14 11)" /><rect x="4.5" y="5.5" width="11" height="15" rx="2" /></svg>;
    case 'porque':
      return <svg viewBox="0 0 24 24" {...S}><path d="M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" /></svg>;
    case 'diario':
      return <svg viewBox="0 0 24 24" {...S}><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M4 10h16M8.5 3v4M15.5 3v4M8 14h2M12 14h2M8 17h2" /></svg>;
    case 'meia':
      return (
        <svg viewBox="0 0 24 24" {...S}>
          <path d={STAR} />
          <path d="M12 2.8 9.2 8.7l-6.4.8 4.7 4.4-1.2 6.4L12 17.2z" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'tempo':
      return <svg viewBox="0 0 24 24" {...S}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M10 2.5h4" /></svg>;
    case 'semfim':
      return <svg viewBox="0 0 24 24" {...S}><path d="M7 9a3 3 0 1 0 0 6c2.2 0 3.3-1.6 5-3s2.8-3 5-3a3 3 0 1 1 0 6c-2.2 0-3.3-1.6-5-3S9.2 9 7 9z" /></svg>;
    default:
      return <svg viewBox="0 0 24 24" {...S}><path d={STAR} /></svg>;
  }
}

/** Partículas de poeira flutuando no facho do projetor (posições fixas, para não "pular" a cada render). */
const DUST = Array.from({ length: 16 }, (_, i) => ({
  left: `${30 + ((i * 37) % 40)}%`,
  top: `${8 + ((i * 53) % 46)}%`,
  size: 2 + (i % 3),
  delay: `${-((i * 0.9) % 7)}s`,
  dur: `${6 + (i % 5)}s`,
}));

export function Novidades() {
  const [leaving, setLeaving] = useState(false);
  const start = () => {
    if (leaving) return;
    sfx.tap();
    setLeaving(true);
    setTimeout(() => nav.close(), 380);
  };
  const n = NOVIDADES.itens.length;

  return (
    <Overlay className={`nv${leaving ? ' out' : ''}`}>
      <div className="nv-beam" aria-hidden="true" />
      <div className="nv-dust" aria-hidden="true">
        {DUST.map((d, i) => (
          <i key={i} style={{ left: d.left, top: d.top, width: d.size, height: d.size, animationDelay: d.delay, animationDuration: d.dur }} />
        ))}
      </div>
      <div className="nv-body" role="dialog" aria-labelledby="nvt">
        <div className="nv-logo">
          <img src="/logo.svg" alt="" width={64} height={64} />
        </div>
        <small className="nv-v">Versão {NOVIDADES.id}</small>
        <h1 id="nvt">{NOVIDADES.titulo}</h1>
        {NOVIDADES.subtitulo && <p className="nv-sub">{NOVIDADES.subtitulo}</p>}
        <ul className="nv-list">
          {NOVIDADES.itens.map((it, i) => (
            <li key={it.titulo} style={{ '--d': `${700 + i * 90}ms` } as CSSProperties}>
              <span className={`nv-ic${it.icone === 'meia' || it.icone === 'estrela' ? ' gold' : ''}`}><Icone k={it.icone} /></span>
              <span className="nv-tx">
                <b>{it.titulo}</b>
                <small>{it.texto}</small>
              </span>
            </li>
          ))}
        </ul>
        <div className="nv-go" style={{ '--d': `${800 + n * 90}ms` } as CSSProperties}>
          <Button block id="nvgo" onClick={start}>{NOVIDADES.botao}</Button>
        </div>
      </div>
    </Overlay>
  );
}
