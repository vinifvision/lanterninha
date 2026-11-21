// Primeira nota guiada: aprender fazendo. O app escolhe um sucesso que quase todo mundo viu
// e acende uma coisa por vez (estrelas, meia estrela, salvar), com uma dica curta e letra grande.
// Salvar grava a nota de verdade e segue o fluxo normal (Review e detalhes → Nota pronta).
import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { Poster } from '../components/Poster';
import { StarPicker } from '../components/StarPicker';
import { childhoodFilms, discover } from '../lib/api';
import { cloud } from '../lib/cloud';
import { films, fkey, isRated } from '../lib/films';
import { LABELS, today } from '../lib/format';
import { looksClassic } from '../lib/quiz';
import type { FilmInfo, RatedFilm, SearchResult } from '../lib/types';
import { nav } from '../nav';

const toInfo = (m: SearchResult): FilmInfo => ({ id: m.id, t: m.title, y: m.year, o: m.original, img: m.poster });

const TIPS: [string, string][] = [
  ['Toque numa estrela para dar a nota.', 'Não existe nota errada: é a sua.'],
  ['Quer meia estrela? Toque na metade esquerda dela.', 'Pode mudar a nota quantas vezes quiser.'],
  ['Pronto! Agora toque em Salvar nota.', 'Depois dá para escrever uma review, se quiser.'],
];

export function Guide() {
  const [list, setList] = useState<SearchResult[] | null>(null);
  const [i, setI] = useState(0);
  const [note, setNote] = useState(0);
  const [step, setStep] = useState(0);

  // Enquanto a pessoa avalia, a sincronização não mexe nos dados (como na tela de dar nota)
  useEffect(() => { cloud.setPaused(true); return () => cloud.setPaused(false); }, []);
  // Sucessos de 1995 a 2015 que a pessoa ainda não avaliou; se falhar, os clássicos do Início
  useEffect(() => {
    let alive = true;
    const rated = new Set(films.all.filter(isRated).map(fkey));
    const fresh = (l: SearchResult[]) => l.filter((m) => m.poster && !rated.has(fkey(toInfo(m))));
    childhoodFilms(1995, 2015)
      .then(fresh)
      .catch(() => [] as SearchResult[])
      .then((l) => (l.length ? l : discover('classics').then(fresh).catch(() => [] as SearchResult[])))
      .then((l) => { if (alive) setList(l); });
    return () => { alive = false; };
  }, []);

  const film = list?.length ? list[i % list.length] : null;
  const info = film ? toInfo(film) : null;

  const pick = (v: number) => { setNote(v); if (step === 0) setStep(1); };
  const swap = () => { setI(i + 1); setNote(0); setStep(0); };

  const save = () => {
    if (!info || !note) return;
    const classic = looksClassic(info.y);
    const entry: RatedFilm = { t: info.t, s: note, c: classic, ts: Date.now(), d: today() };
    if (info.id) { entry.id = info.id; if (info.y) entry.y = info.y; if (info.o) entry.o = info.o; if (info.img) entry.img = info.img; }
    const replaced = films.putRated(entry);
    nav.replace({ k: 'details', info, key: fkey(entry), base: note, classic, rewatch: null, replaced, answers: [] });
  };

  return (
    <div className="screen gd">
      <div className="gd-top">
        <div className="gd-dots" role="img" aria-label={`Passo ${step + 1} de 3`}>
          {[0, 1, 2].map((k) => <i key={k} className={k <= step ? 'on' : ''} />)}
        </div>
        <button type="button" className="gd-skip" id="gdskip" onClick={() => nav.back()}>Pular</button>
      </div>

      <p className="gd-eye">Sua primeira nota</p>
      <h1 className="gd-h">Esse você provavelmente já viu.</h1>

      {!list ? (
        <div className="gd-film"><span className="gd-poster gd-load" /></div>
      ) : !info ? (
        <p className="gd-empty">Não consegui carregar os filmes agora. Toque em Pular e avalie qualquer filme pela busca.</p>
      ) : (
        <>
          <div className="gd-film" key={fkey(info)}>
            <span className="gd-poster"><Poster img={info.img} title={info.t} size="w342" /></span>
            <div className="gd-info">
              <b>{info.t}</b>
              {info.y && <small>{info.y}</small>}
              <button type="button" className="gd-swap" id="gdswap" onClick={swap}>Não vi esse, trocar</button>
            </div>
          </div>

          <div className={`gd-stars${step < 2 ? ' lit' : ''}`}>
            <StarPicker value={note} onChange={pick} />
            <div className="gd-word" aria-live="polite">{note ? LABELS[note] : ' '}</div>
          </div>

          <div className={`gd-tip${step === 2 ? ' down' : ''}`} key={step} aria-live="polite">
            <b>{TIPS[step][0]}</b>
            <span>{TIPS[step][1]}</span>
            {step === 1 && <button type="button" className="gd-ok" id="gdok" onClick={() => setStep(2)}>Entendi</button>}
          </div>

          <Button block id="gdsave" className={step === 2 ? 'gd-lit' : ''} disabled={!note} onClick={save}>Salvar nota</Button>
        </>
      )}

      <div className="grow" />
      <p className="gd-foot">Dá para rever este tutorial em Configurações</p>
    </div>
  );
}
