// A revelação da nota: projetor, estrelas acendendo, ajuste fino, data e review.
// Para sair: "Pronto" (vai para a página do filme) ou voltar; os dois guardam a nota. "Refazer as respostas" desfaz.
import { useEffect, useRef, useState } from 'react';
import { ShareIcon } from '../components/icons';
import { Poster } from '../components/Poster';
import { Stars } from '../components/Stars';
import { WhenRow } from '../components/WhenRow';
import { Ticket } from '../components/Ticket';
import { TicketEditor } from '../components/TicketEditor';
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
  const [ticket, setTicket] = useState<'off' | 'in' | 'torn'>('off'); // ingresso: aparece e depois o canhoto é rasgado

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
    // Visto no cinema: depois da nota, entra o ingresso e o canhoto é destacado
    if (found?.w === 'cine') {
      const at = T0 + 5 * GAP + (calm ? 100 : 700);
      timers.push(setTimeout(() => setTicket('in'), at));
      timers.push(setTimeout(() => { setTicket('torn'); sfx.rip(); }, at + (calm ? 100 : 1100)));
    }
    return () => { timers.forEach(clearTimeout); proj?.remove(); cloud.setPaused(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Voltar (a seta e o botão do Android): sai do resultado e a nota fica guardada
  useEffect(() => {
    nav.setBackHandler(() => { clearRateDraft(); return false; });
    return () => nav.setBackHandler(null);
  }, []);

  if (!film) return null;
  const stars = film.s;
  const adjust = (d: number) => {
    film.s = clamp(film.s + d);
    films.save();
    sfx.tick(d > 0);
    setTouched(true); setRevealed(true); setShown(film.s);
  };
  /** Refazer: desfaz a nota e reabre a última pergunta, com as respostas de antes. */
  const redo = () => {
    films.undoRated(film, replaced);
    nav.replace({ k: 'quiz', info, classic, rewatch, answers });
  };
  /** Pronto: vai para a página do filme (ou volta para ela, se a avaliação começou lá). */
  const done = () => {
    sfx.tap();
    clearRateDraft();
    const below = nav.state.stack[nav.state.stack.length - 2];
    if (below?.k === 'film' && fkey(below.info) === filmKey) nav.back();
    else nav.replace({ k: 'film', info: film });
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
          <small>{stars === base ? (answers.length ? 'Não concorda? Ajuste.' : 'Ajuste fino') : (answers.length ? 'Sugestão era ' : 'Você escolheu ') + fmt(base)}</small>
          <button id="plus" aria-label="Aumentar meia estrela" onClick={() => adjust(0.5)}>+</button>
        </div>
        <button className="redo" id="redo" onClick={redo}>{answers.length ? 'Refazer as respostas' : 'Responder as perguntas'}</button>
        <div className="meta">
          <WhenRow film={film} />
          <button className="revbtn" id="rvb" onClick={() => nav.open({ k: 'editor', key: filmKey })}>
            {firstLine
              ? <><span>{firstLine}</span><b style={{ color: 'var(--gold)', fontWeight: 600, flex: 'none' }}>Editar</b></>
              : <>Escrever review<span>opcional</span></>}
          </button>
        </div>
        {film.w === 'cine' && ticket !== 'off' && (
          <div className="tkres" id="tkres">
            <p className="tkhint">{ticket === 'torn' ? 'Ingresso guardado na sua gaveta' : '\u00a0'}</p>
            <div className={`tkwrap in${ticket === 'torn' ? ' rip' : ''}`}><Ticket film={film} torn={ticket === 'torn'} /></div>
            {ticket === 'torn' && <TicketEditor film={film} />}
          </div>
        )}
        <button className="share" id="shr" onClick={() => nav.open({ k: 'share', key: filmKey })}><ShareIcon />Compartilhar</button>
        <div className={`resdone${revealed ? ' in' : ''}`}>
          <button className="cta" id="done" onClick={done}>Pronto</button>
          <button className="again" id="again" onClick={() => { clearRateDraft(); nav.tab('rate'); }}>Avaliar outro filme</button>
        </div>
      </div>
    </div>
  );
}
