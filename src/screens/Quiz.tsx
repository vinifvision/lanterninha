// Dar a nota: as estrelas aparecem primeiro e a nota sai em um toque.
// "Me ajuda a decidir" abre as perguntas e a comparação com um filme parecido; no fim a nota volta para as estrelas.
// "Continuar" salva a nota e vai para Review e detalhes.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { Poster } from '../components/Poster';
import { StarPicker } from '../components/StarPicker';
import { lastCinema } from '../components/TicketEditor';
import { movieDetails } from '../lib/api';
import { cloud } from '../lib/cloud';
import { films, fkey, isRated } from '../lib/films';
import { clamp, fmt, LABELS, today } from '../lib/format';
import { buildQuestions, computeStars } from '../lib/quiz';
import type { FilmInfo, RatedFilm, Where } from '../lib/types';
import { nav } from '../nav';

interface Props {
  info: FilmInfo;
  classic: boolean;
  rewatch: RatedFilm | null;
  answers?: number[];
  /** Mudar nota: as estrelas já começam na nota atual */
  direct?: boolean;
  /** Abrir direto nas perguntas */
  help?: boolean;
}

export function Quiz({ info, classic, rewatch, answers: initial, direct: editing, help }: Props) {
  const prev = films.find(info);
  const prevRated = isRated(prev) ? prev : null;
  // Revi: guarda a nota anterior. Começa ligado quando o filme já tinha nota.
  const [rw, setRw] = useState<RatedFilm | null>(rewatch);
  const [where, setWhere] = useState<Where | undefined>(rewatch ? undefined : prev?.w);
  const questions = useMemo(() => buildQuestions(!!rw, classic), [rw, classic]);
  const [direct, setDirect] = useState(!help && !initial);
  const [step, setStep] = useState(initial ? Math.max(0, initial.length - 1) : 0);
  const [answers, setAnswers] = useState<number[]>(initial || []);
  const [picked, setPicked] = useState<number | null>(null);
  // Comparação final: filmes parecidos, do mais parecido para o menos; "Trocar filme" passa para o próximo
  const [rivals, setRivals] = useState<RatedFilm[]>([]);
  const [ri, setRi] = useState(0);
  const rival = rivals.length ? rivals[ri % rivals.length] : null;
  const [note, setNote] = useState(() => (editing && prevRated ? prevRated.s : 0));
  const [fromHelp, setFromHelp] = useState(false);
  const [dir, setDir] = useState('');
  const stars = useRef(3);
  const finalAnswers = useRef<number[]>(initial || []);
  const locked = useRef(false);
  const leaving = useRef(false);

  // Enquanto a pessoa avalia, a sincronização não mexe nos dados
  useEffect(() => { cloud.setPaused(true); return () => cloud.setPaused(false); }, []);
  useEffect(() => { nav.setProgress(direct ? null : rival ? 1 : step / questions.length); }, [direct, step, rival, questions.length]);
  // A luz da sala acende junto com a nota
  useEffect(() => {
    const b = document.body.style;
    b.setProperty('--glow', `rgba(242, 201, 127, ${(0.08 + note * 0.05).toFixed(3)})`);
    return () => b.removeProperty('--glow');
  }, [note]);
  // Diretor (para o cabeçalho) e gêneros já carregando, para a comparação não demorar no fim
  useEffect(() => {
    if (info.id) void movieDetails(info.id).then((d) => setDir(d.director)).catch(() => null);
  }, [info.id]);
  // Voltar: da comparação para a última pergunta, de uma pergunta para a anterior, da primeira para as estrelas
  useEffect(() => {
    nav.setBackHandler(() => {
      if (leaving.current || direct) return false;
      if (rival) { setRivals([]); setRi(0); return true; }
      if (step > 0) { setStep(step - 1); return true; }
      if (!help) { setDirect(true); return true; }
      return false;
    });
    return () => nav.setBackHandler(null);
  }, [direct, rival, step, help]);

  /** O X cancela tudo de uma vez. */
  const cancel = () => { leaving.current = true; nav.back(); };

  /** A nota calculada pelas perguntas volta para as estrelas. */
  const land = (v: number) => { setNote(v); setFromHelp(true); setRivals([]); setRi(0); setDirect(true); };

  /** Grava a avaliação e vai para Review e detalhes. */
  const finish = () => {
    if (!note) return;
    const old = films.find(info);
    const keep = rw || old;
    const entry: RatedFilm = { t: info.t, s: note, c: classic, ts: Date.now(), d: (!rw && old?.d) || today() };
    if (keep?.note) entry.note = keep.note;
    if (info.id) { entry.id = info.id; if (info.y) entry.y = info.y; if (info.o) entry.o = info.o; if (info.img) entry.img = info.img; }
    if (rw) { entry.p = rw.s; entry.n = (rw.n || 1) + 1; }
    else if (old?.n) { entry.p = old.p; entry.n = old.n; }
    if (where) entry.w = where;
    if (where === 'cine') {
      // Corrigindo a nota de quem já tinha ingresso: mantém o ingresso. Senão, já começa com o último cinema usado.
      if (!rw && old?.w === 'cine' && old.tk) entry.tk = old.tk;
      else { const c = lastCinema(); if (c) entry.tk = { cine: c }; }
    }
    const replaced = films.putRated(entry);
    leaving.current = true;
    nav.replace({ k: 'details', info, key: fkey(entry), base: note, classic, rewatch: rw, replaced, answers: fromHelp ? finalAnswers.current : [] });
  };

  const choose = (i: number, after: () => void) => {
    if (locked.current) return;
    locked.current = true;
    setPicked(i);
    setTimeout(() => { locked.current = false; setPicked(null); after(); }, 260);
  };

  const answer = (i: number) => choose(i, () => {
    const next = [...answers]; next[step] = i;
    setAnswers(next);
    if (step + 1 < questions.length) { setStep(step + 1); return; }
    finalAnswers.current = next;
    const value = computeStars(questions, next);
    stars.current = value;
    void findRivals(value).then((list) => { if (list.length) { setRivals(list); setRi(0); } else land(value); });
  });

  /**
   * Filmes já avaliados com nota parecida (até meia estrela de diferença), do mais parecido para o menos:
   * mesmo gênero, mesma época e mesmo tipo (clássico ou não). Os gêneros vêm do TMDB; se demorar, segue sem eles.
   */
  const findRivals = async (value: number): Promise<RatedFilm[]> => {
    const year = (f: { y?: string }) => (f.y ? +f.y : 0);
    const base = (h: RatedFilm) =>
      (!!h.c === classic ? 2 : 0) +
      (year(info) && year(h) ? Math.max(0, 3 - Math.abs(year(info) - year(h)) / 5) : 0) +
      (0.5 - Math.abs(h.s - value));
    const near = films.all.filter(isRated)
      .filter((h) => fkey(h) !== fkey(info) && Math.abs(h.s - value) <= 0.5)
      .sort((a, b) => base(b) - base(a));
    if (near.length < 2 || !info.id) return near;
    locked.current = true; // enquanto busca os gêneros, ignora toques repetidos
    const genres = (id?: number | null) => (id ? movieDetails(id).then((d) => d.genres).catch(() => [] as string[]) : Promise.resolve([] as string[]));
    const top = near.slice(0, 6);
    const timeout = new Promise<null>((r) => setTimeout(() => r(null), 700));
    const got = await Promise.race([Promise.all([genres(info.id), ...top.map((h) => genres(h.id))]), timeout]);
    locked.current = false;
    if (!got) return near;
    const [mine, ...theirs] = got;
    const shared = (i: number) => theirs[i].filter((g) => mine.includes(g)).length;
    const ranked = top.map((h, i) => ({ h, sc: base(h) + shared(i) * 3 })).sort((a, b) => b.sc - a.sc).map((x) => x.h);
    return ranked.concat(near.slice(6));
  };

  const compare = (i: number) => choose(i, () => {
    if (!rival) return;
    let v = stars.current;
    if (i === 0 && v <= rival.s) v = clamp(rival.s + 0.5);
    if (i === 1) v = rival.s;
    if (i === 2 && v >= rival.s) v = clamp(rival.s - 0.5);
    land(v);
  });

  const openHelp = () => { setDirect(false); setStep(0); setAnswers([]); };

  if (direct) {
    const sub = [info.y, dir].filter(Boolean).join(' · ');
    return (
      <div key="direct" className="screen nota2">
        <div className="nhead">
          <span className="nposter"><Poster img={info.img} title={info.t} size="w92" /></span>
          <div className="ntit"><b>{info.t}</b>{sub && <small>{sub}</small>}</div>
          <button type="button" className="x2" aria-label="Cancelar e fechar" onClick={cancel}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div className="nbig" aria-live="polite">
          <div className={`nnum${note ? '' : ' none'}`} id="dnum">{note ? fmt(note) : '–'}</div>
          <div className="nword">{note ? LABELS[note] : 'Toque nas estrelas'}</div>
        </div>
        <StarPicker value={note} onChange={(v) => { setNote(v); setFromHelp(false); }} />
        <p className="nhint">Toque na metade da estrela para meia nota</p>
        <div className="nchips">
          <button type="button" className={`nchip${where === 'cine' ? ' on' : ''}`} aria-pressed={where === 'cine'} onClick={() => setWhere(where === 'cine' ? undefined : 'cine')}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9a2 2 0 0 0 0 6v3h18v-3a2 2 0 0 0 0-6V6H3z" /></svg>No cinema
          </button>
          {prevRated && !editing && (
            <button type="button" className={`nchip${rw ? ' on' : ''}`} aria-pressed={!!rw} onClick={() => { setRw(rw ? null : prevRated); setAnswers([]); setStep(0); }}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></svg>Revi
            </button>
          )}
        </div>
        <div className="grow" />
        <Button block id="dok" disabled={!note} onClick={finish}>Continuar</Button>
        <button type="button" className="nhelp" id="helpme" onClick={openHelp}>Na dúvida? <span>Me ajuda a decidir</span></button>
      </div>
    );
  }

  if (rival) {
    const card = (f: FilmInfo, i: number, id: string, tag: string, side: 'l' | 'r') => (
      <button type="button" className={`duelc ${side}${picked === i ? ' on' : ''}`} id={id} aria-label={`${f.t} me marcou mais`} onClick={() => compare(i)}>
        <span className="duelp"><Poster img={f.img} title={f.t} size="w342" /></span>
        <span className="dueltag">{tag}</span>
      </button>
    );
    return (
      <div key="cmp" className="screen ask2">
        <div className="qlbl">Última pergunta</div>
        <h1 className="q2">Qual te marcou mais?</h1>
        <div className="duel" key={fkey(rival)}>
          {card(info, 0, 'cmpme', 'Hoje', 'l')}
          <span className="duelor" aria-hidden="true">ou</span>
          {card(rival, 2, 'cmpthem', `Sua nota ★ ${fmt(rival.s)}`, 'r')}
        </div>
        <p className="duelhint">Toque no pôster. A nota sai sozinha no final.</p>
        <div className="duelb">
          <button type="button" className={`btn btn-sec${picked === 1 ? ' on' : ''}`} id="cmptie" onClick={() => compare(1)}>Empate</button>
          <button type="button" className={`btn btn-sec${picked === 3 ? ' on' : ''}`} id="cmpskip" onClick={() => compare(3)}>Não dá pra comparar</button>
        </div>
        {rivals.length > 1 && <button type="button" className="nknow" id="cmpswap" onClick={() => setRi(ri + 1)}>Trocar filme</button>}
        <button type="button" className="nknow" onClick={() => { setRivals([]); setDirect(true); }}>Já sei minha nota</button>
      </div>
    );
  }

  const Q = questions[step];
  return (
    <div key={step} className="screen ask2">
      <div className="qlbl">Pergunta {step + 1} de {questions.length}</div>
      <h1 className="q2">{Q.q}</h1>
      {Q.s && <p className="sub">{Q.s}</p>}
      <div className="opts">
        {Q.o.map((o, i) => (
          <button type="button" key={o} className={`opt${(picked ?? answers[step]) === i ? ' on' : ''}`} onClick={() => answer(i)}>{o}</button>
        ))}
      </div>
      <button type="button" className="nknow" id="know" onClick={() => setDirect(true)}>Já sei minha nota</button>
    </div>
  );
}
