// A revelação da nota: projetor, estrelas acendendo, ajuste fino, data e review.
import { useEffect, useRef, useState } from 'react';
import { ShareIcon } from '../components/icons';
import { Poster } from '../components/Poster';
import { Stars } from '../components/Stars';
import { WhenRow } from '../components/WhenRow';
import { cloud } from '../lib/cloud';
import { films, fkey, isRated, useFilms } from '../lib/films';
import { clamp, fmt, LABELS } from '../lib/format';
import { classicSeal } from '../lib/quiz';
import { sfx } from '../lib/sfx';
import type { Film, FilmInfo, RatedFilm } from '../lib/types';
import { nav } from '../nav';
import { clearRateDraft } from './RateHome';

interface Props { info: FilmInfo; filmKey: string; base: number; classic: boolean; rewatch: RatedFilm | null; replaced: Film | null; answers: number[] }

const GAP = 170;

export function Result({ info, filmKey, base, classic, rewatch, replaced, answers }: Props) {
  const all = useFilms();
  const found = all.find((h) => fkey(h) === filmKey);
  const film = isRated(found) ? found : null;
  const calm = useRef(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion:reduce)').matches).current;
  const T0 = calm ? 200 : 1150;
  const [shown, setShown] = useState(calm ? base : 0);   // número que conta até a nota
  const [revealed, setRevealed] = useState(calm);
  const [touched, setTouched] = useState(false);          // a pessoa já ajustou a nota

  // Projetor, sons e contagem: só uma vez, quando a tela abre
  useEffect(() => {
    cloud.setPaused(true);
    const timers: ReturnType<typeof setTimeout>[] = [];
    let proj: HTMLDivElement | null = null;
    if (!calm) {
      proj = document.createElement('div');
      proj.className = 'proj';
      proj.innerHTML = '<i></i><i></i><i></i><b></b>';
      document.body.appendChild(proj);
      timers.push(setTimeout(() => proj?.remove(), 1700));
      sfx.projector(1.05);
      const stepMs = GAP / (base > 2.5 ? 1.6 : 1);
      for (let v = 0.5, n = 0; v <= base; v += 0.5, n++) {
        const value = v;
        timers.push(setTimeout(() => { setShown(value); if (value === base) setRevealed(true); }, T0 - 180 + n * stepMs));
      }
    }
    for (let i = 0; i < Math.ceil(base); i++) sfx.star(i, (T0 + i * GAP) / 1000, base - i < 1);
    if (base >= 4.5) sfx.fanfare((T0 + 5 * GAP) / 1000);
    return () => { timers.forEach(clearTimeout); proj?.remove(); cloud.setPaused(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Voltar: desfaz a avaliação e reabre a última pergunta
  useEffect(() => {
    nav.setBackHandler(() => {
      if (film) films.undoRated(film, replaced);
      nav.replace({ k: 'quiz', info, classic, rewatch, answers });
      return true;
    });
    return () => nav.setBackHandler(null);
  }, [film, replaced, info, classic, rewatch, answers]);

  if (!film) return null;
  const stars = film.s;
  const adjust = (d: number) => {
    film.s = clamp(film.s + d);
    films.save();
    sfx.tick(d > 0);
    setTouched(true); setRevealed(true); setShown(film.s);
  };
  const diff = rewatch ? stars - rewatch.s : 0;
  const sub = [info.o && info.o !== info.t ? info.o : '', info.y || ''].filter(Boolean).join(' · ');
  const firstLine = film.note?.split('\n')[0];

  return (
    <div className="screen">
      <div className="center">
        <Poster img={info.img} title="" size="w342" fallback={false} className="poster" />
        <div className="film">{info.t}{info.id ? <small>{sub}</small> : null}</div>
        <Stars value={stars} anim={!touched} base={T0 - 180} gap={GAP} />
        <div className={`num${revealed && !touched ? ' tick' : ''}`} id="num">{fmt(touched ? stars : shown)}</div>
        <div className="label" style={{ transition: 'opacity .4s', opacity: revealed ? 1 : 0 }}>{LABELS[stars]}</div>
        {rewatch && (
          <div><div className="seal">Antes ★ {fmt(rewatch.s)} · {diff > 0 ? 'Cresceu na revisão' : diff < 0 ? 'Caiu na revisão' : 'Continua igual'}</div></div>
        )}
        {classic && <div className="seal">{classicSeal(stars)}</div>}
        <div className="adj">
          <button id="minus" aria-label="Diminuir meia estrela" onClick={() => adjust(-0.5)}>−</button>
          <small>{stars === base ? 'Não concorda? Ajuste.' : 'Sugestão era ' + fmt(base)}</small>
          <button id="plus" aria-label="Aumentar meia estrela" onClick={() => adjust(0.5)}>+</button>
        </div>
        <div className="meta">
          <WhenRow film={film} />
          <button className="revbtn" id="rvb" onClick={() => nav.open({ k: 'editor', key: filmKey })}>
            {firstLine
              ? <><span>{firstLine}</span><b style={{ color: 'var(--gold)', fontWeight: 600, flex: 'none' }}>Editar</b></>
              : <>Escrever review<span>opcional</span></>}
          </button>
        </div>
        <button className="share" id="shr" onClick={() => nav.open({ k: 'share', key: filmKey })}><ShareIcon />Compartilhar</button>
        <button className="cta" id="again" onClick={() => { clearRateDraft(); nav.tab('rate'); }}>Avaliar outro filme</button>
      </div>
    </div>
  );
}
