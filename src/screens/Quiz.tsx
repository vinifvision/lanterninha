// As perguntas da avaliação, uma por tela, e a comparação final com um filme de nota parecida.
// Atalho "Já sei minha nota": pula as perguntas e a pessoa escolhe a nota direto nas estrelas.
import { useEffect, useMemo, useRef, useState } from 'react';
import { cloud } from '../lib/cloud';
import { films, fkey, isRated } from '../lib/films';
import { buildQuestions, computeStars } from '../lib/quiz';
import { sfx } from '../lib/sfx';
import type { FilmInfo, RatedFilm, Where } from '../lib/types';
import { lastCinema } from '../components/TicketEditor';
import { nav } from '../nav';
import { StarPicker } from '../components/StarPicker';
import { clamp, fmt, LABELS, today } from '../lib/format';

interface Props { info: FilmInfo; classic: boolean; rewatch: RatedFilm | null; answers?: number[]; direct?: boolean }

export function Quiz({ info, classic, rewatch, answers: initial, direct: startDirect }: Props) {
  const questions = useMemo(() => buildQuestions(!!rewatch, classic), [rewatch, classic]);
  // Quem volta da tela do resultado cai na última pergunta, com as respostas de antes
  const [step, setStep] = useState(initial ? Math.max(0, initial.length - 1) : 0);
  const [answers, setAnswers] = useState<number[]>(initial || []);
  const [picked, setPicked] = useState<number | null>(null);
  const [rival, setRival] = useState<RatedFilm | null>(null);
  // Última tela: onde a pessoa viu o filme (não mexe na nota)
  const [asking, setAsking] = useState(false);
  const pending = useRef(3);
  const stars = useRef(3);
  const finalAnswers = useRef<number[]>(initial || []);
  const locked = useRef(false);
  // Nota escolhida direto nas estrelas ("Já sei minha nota"). Vindo de "Mudar nota", já começa na nota atual.
  const [direct, setDirect] = useState(!!startDirect);
  const [picked5, setPicked5] = useState(() => { const cur = films.find(info); return startDirect && isRated(cur) ? cur.s : 0; });

  // Enquanto a pessoa avalia, a sincronização não mexe nos dados
  useEffect(() => { cloud.setPaused(true); return () => cloud.setPaused(false); }, []);
  useEffect(() => { nav.setProgress(asking || rival || direct ? 1 : step / questions.length); }, [step, rival, asking, direct, questions.length]);
  // Voltar: da comparação para a última pergunta, de uma pergunta para a anterior, e da primeira para fora
  useEffect(() => {
    nav.setBackHandler(() => {
      if (asking) { setAsking(false); return true; }
      if (direct && !startDirect) { setDirect(false); return true; }
      if (rival) { setRival(null); return true; }
      if (step > 0) { setStep(step - 1); return true; }
      return false;
    });
    return () => nav.setBackHandler(null);
  }, [step, rival, asking, direct, startDirect]);

  /** Depois da nota calculada, só falta saber onde viu. */
  const ask = (value: number) => { pending.current = value; setAsking(true); };

  /** Grava a avaliação e vai para a tela do resultado. */
  const finish = (value: number, where?: Where) => {
    const old = films.find(info);
    const keep = rewatch || old;
    const entry: RatedFilm = { t: info.t, s: value, c: classic, ts: Date.now(), d: (!rewatch && old?.d) || today() };
    if (keep?.note) entry.note = keep.note;
    if (info.id) { entry.id = info.id; if (info.y) entry.y = info.y; if (info.o) entry.o = info.o; if (info.img) entry.img = info.img; }
    if (rewatch) { entry.p = rewatch.s; entry.n = (rewatch.n || 1) + 1; }
    else if (old?.n) { entry.p = old.p; entry.n = old.n; }
    if (where) entry.w = where;
    if (where === 'cine') {
      // Corrigindo a nota de quem já tinha ingresso: mantém o ingresso. Senão, já começa com o último cinema usado.
      if (!rewatch && old?.w === 'cine' && old.tk) entry.tk = old.tk;
      else { const c = lastCinema(); if (c) entry.tk = { cine: c }; }
    }
    const replaced = films.putRated(entry);
    nav.replace({ k: 'result', info, key: fkey(entry), base: value, classic, rewatch, replaced, answers: finalAnswers.current });
  };

  const choose = (i: number, after: () => void) => {
    if (locked.current) return;
    locked.current = true;
    setPicked(i);
    sfx.tap(step);
    setTimeout(() => { locked.current = false; setPicked(null); after(); }, 260);
  };

  const answer = (i: number) => choose(i, () => {
    const next = [...answers]; next[step] = i;
    setAnswers(next);
    if (step + 1 < questions.length) { setStep(step + 1); return; }
    finalAnswers.current = next;
    const value = computeStars(questions, next);
    stars.current = value;
    // Procura um filme já avaliado com nota parecida, de preferência do mesmo tipo (clássico ou não)
    const near = films.all.filter(isRated).filter((h) => fkey(h) !== fkey(info) && Math.abs(h.s - value) <= 0.5);
    const found = near.find((h) => !!h.c === classic) || near[0] || null;
    if (found) setRival(found); else ask(value);
  });

  const compare = (i: number) => choose(i, () => {
    if (!rival) return;
    let v = stars.current;
    if (i === 0 && v <= rival.s) v = clamp(rival.s + 0.5);
    if (i === 1) v = rival.s;
    if (i === 2 && v >= rival.s) v = clamp(rival.s - 0.5);
    ask(v);
  });

  /** Confirmar a nota escolhida nas estrelas. Em "Mudar nota", não pergunta de novo onde viu. */
  const confirmDirect = () => {
    if (!picked5) return;
    finalAnswers.current = [];
    sfx.tap();
    if (startDirect) finish(picked5, films.find(info)?.w);
    else ask(picked5);
  };

  if (direct && !asking) {
    return (
      <div key="direct" className="screen">
        <div className="q">{startDirect ? 'Qual a nota agora?' : 'Qual a sua nota?'}</div>
        <p className="sub">Toque ou arraste nas estrelas. A metade de uma estrela vale meia.</p>
        <div className="dpick">
          <StarPicker value={picked5} onChange={setPicked5} />
          <div className={`dnum${picked5 ? '' : ' none'}`} id="dnum">{picked5 ? fmt(picked5) : '–'}</div>
          <div className="label">{picked5 ? LABELS[picked5] : '\u00a0'}</div>
          <div className="adj">
            <button id="dminus" aria-label="Diminuir meia estrela" disabled={!picked5 || picked5 <= 0.5} onClick={() => { setPicked5(clamp(picked5 - 0.5)); sfx.tick(false); }}>−</button>
            <button id="dplus" aria-label="Aumentar meia estrela" disabled={picked5 >= 5} onClick={() => { setPicked5(clamp((picked5 || 0) + 0.5)); sfx.tick(true); }}>+</button>
          </div>
        </div>
        <button className="cta" id="dok" disabled={!picked5} onClick={confirmDirect}>Confirmar</button>
        <button className="helpme" id="helpme" onClick={() => { setDirect(false); setStep(0); }}>Me ajuda a decidir</button>
      </div>
    );
  }

  const WHERE: [Where | undefined, string][] = [['cine', 'No cinema'], ['casa', 'Em casa'], ['outro', 'Em outro lugar']];
  if (asking) {
    return (
      <div key="where" className="screen">
        <div className="q">Onde você viu?</div>
        <p className="sub">Não muda a nota. Fica guardado com o filme.</p>
        <div className="opts">
          {WHERE.map(([w, label], i) => (
            <button key={label} className={`opt${picked === i ? ' on' : ''}`} data-w={w} onClick={() => choose(i, () => finish(pending.current, w))}>{label}</button>
          ))}
          <button className="opt" style={{ background: 'none', color: 'var(--muted)', textAlign: 'center' }} onClick={() => choose(3, () => finish(pending.current))}>Pular</button>
        </div>
      </div>
    );
  }

  if (rival) {
    return (
      <div key="cmp" className="screen">
        <div className="q">Qual te marcou mais?</div>
        <p className="sub">Se tivesse que escolher um para guardar na memória.</p>
        <div className="opts">
          <button className={`opt${picked === 0 ? ' on' : ''}`} onClick={() => compare(0)}>{info.t || 'Este filme'}</button>
          <button className={`opt${picked === 2 ? ' on' : ''}`} onClick={() => compare(2)}>{rival.t}</button>
          <button className={`opt${picked === 1 ? ' on' : ''}`} onClick={() => compare(1)}>Empate</button>
          <button className="opt" style={{ background: 'none', color: 'var(--muted)', textAlign: 'center' }} onClick={() => compare(3)}>Não dá pra comparar</button>
        </div>
      </div>
    );
  }

  const Q = questions[step];
  return (
    <div key={step} className="screen">
      <div className="q">{Q.q}</div>
      <p className="sub">{Q.s || ' '}</p>
      <div className="opts">
        {Q.o.map((o, i) => (
          <button key={o} className={`opt${(picked ?? answers[step]) === i ? ' on' : ''}`} onClick={() => answer(i)}>{o}</button>
        ))}
      </div>
      {step === 0 && <button className="know" id="know" onClick={() => { sfx.tap(); setDirect(true); }}>Já sei minha nota</button>}
    </div>
  );
}

