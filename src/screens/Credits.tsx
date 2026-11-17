// Elenco e equipe: quem criou o filme em destaque, o elenco com fotos e a ficha técnica completa,
// que pode "rolar" sozinha como os créditos no fim de um filme.
import { useEffect, useRef, useState } from 'react';
import { useAsync } from '../components/hooks';
import { movieCredits, posterUrl } from '../lib/api';
import { posterColor, setTint } from '../lib/color';
import type { FilmInfo } from '../lib/types';
import { scroller } from '../nav';

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

/** Foto de uma pessoa, ou as iniciais quando o TMDB não tem foto. */
function Face({ photo, name, size }: { photo: string; name: string; size: 'w185' | 'h632' }) {
  const [broken, setBroken] = useState(false);
  if (!photo || broken) return <span className="face none">{initials(name)}</span>;
  return <img className="face" src={posterUrl(photo, size)} alt="" loading="lazy" onError={() => setBroken(true)} />;
}

export function Credits({ info }: { info: FilmInfo }) {
  const credits = useAsync(() => (info.id ? movieCredits(info.id).catch(() => null) : Promise.resolve(null)), [info.id]);
  const [rolling, setRolling] = useState(false);
  const roll = useRef<HTMLElement>(null);

  // Mesmo fundo colorido da página do filme
  useEffect(() => {
    let alive = true;
    void posterColor(info.img || '').then((c) => { if (alive) setTint(c); });
    return () => { alive = false; setTint(null); };
  }, [info.img]);

  // Rolar créditos: a tela desce sozinha devagar e as barras somem, como numa sala escura; qualquer toque para
  useEffect(() => {
    document.body.classList.toggle('rolling', rolling);
    const el = scroller();
    if (!rolling || !el) return () => document.body.classList.remove('rolling');
    const start = roll.current ? roll.current.offsetTop - 90 : el.scrollTop;
    el.scrollTo({ top: start, behavior: 'smooth' });
    let raf = 0, last = 0, y = start, delay = performance.now() + 700;
    const step = (now: number) => {
      if (now > delay) {
        y += ((now - (last || now)) / 1000) * 46;
        el.scrollTop = y;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) { setRolling(false); return; }
      }
      last = now;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const stop = () => setRolling(false);
    el.addEventListener('pointerdown', stop); el.addEventListener('wheel', stop, { passive: true }); el.addEventListener('touchstart', stop, { passive: true });
    return () => { document.body.classList.remove('rolling'); cancelAnimationFrame(raf); el.removeEventListener('pointerdown', stop); el.removeEventListener('wheel', stop); el.removeEventListener('touchstart', stop); };
  }, [rolling]);

  return (
    <div className="screen credits">
      <div className="crhead">
        <span>Por trás de</span>
        <h1>{info.t}</h1>
        {info.y && <p>{info.y}</p>}
      </div>

      {credits === undefined && <div className="crkey">{[0, 1, 2].map((i) => <div className="ck sk" key={i} />)}</div>}
      {credits === null && <p className="empty">Não consegui carregar os créditos agora.</p>}

      {credits && credits.key.length > 0 && (
        <section className="hsec">
          <div className="sech"><h3>Quem fez</h3></div>
          <div className="crkey">
            {credits.key.map((p, i) => (
              <div className="ck" key={p.name + p.role} style={{ animationDelay: `${i * 60}ms` }}>
                <Face photo={p.photo} name={p.name} size="h632" />
                <div><span>{p.role}</span><b>{p.name}</b></div>
              </div>
            ))}
          </div>
        </section>
      )}

      {credits && credits.cast.length > 0 && (
        <section className="hsec">
          <div className="sech"><h3>Elenco</h3></div>
          <div className="crcast">
            {credits.cast.map((p) => (
              <div className="cc" key={p.name + p.character}>
                <Face photo={p.photo} name={p.name} size="w185" />
                <b>{p.name}</b>
                {p.character && <small>{p.character}</small>}
              </div>
            ))}
          </div>
        </section>
      )}

      {credits && credits.depts.length > 0 && (
        <section className="roll" ref={roll}>
          <div className="rollhead">
            <h3>Ficha técnica</h3>
            <button id="roll" className={rolling ? 'on' : ''} onClick={() => setRolling(!rolling)}>{rolling ? 'Parar' : '▶ Rolar créditos'}</button>
          </div>
          {credits.depts.map((d) => (
            <div className="rd" key={d.name}>
              <h4>{d.name}</h4>
              {d.people.map((p) => <div className="rp" key={p.job + p.name}><span>{p.job}</span><b>{p.name}</b></div>)}
            </div>
          ))}
          <p className="fin">{info.t}</p>
        </section>
      )}
      <p className="credit">Elenco e equipe: <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">TMDB</a></p>
    </div>
  );
}
