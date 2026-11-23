// Review e detalhes: tudo opcional. A nota já está salva; aqui entram a review, onde viu, quem foi junto e a data.
import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { Poster } from '../components/Poster';
import { RatingChip } from '../components/RatingChip';
import { SpoilerSwitch } from '../components/Spoiler';
import { lastCinema, TicketEditor } from '../components/TicketEditor';
import { WhenRow } from '../components/WhenRow';
import { films, fkey, isRated, useFilms } from '../lib/films';
import type { Film, FilmInfo, RatedFilm, Where } from '../lib/types';
import { nav } from '../nav';

interface Props { info: FilmInfo; filmKey: string; base: number; classic: boolean; rewatch: RatedFilm | null; replaced: Film | null; answers: number[] }

const WHERE: [Where, string][] = [['cine', 'Cinema'], ['casa', 'Em casa'], ['outro', 'Em outro lugar']];

export function Details({ info, filmKey, base, classic, rewatch, replaced, answers }: Props) {
  const found = useFilms().find((h) => fkey(h) === filmKey);
  const film = isRated(found) ? found : null;
  const [text, setText] = useState(film?.note || '');
  const [sp, setSp] = useState(!!film?.sp);

  const saveNote = () => {
    if (!film) return;
    const v = text.trim() || undefined;
    const s = v && sp ? true : undefined;
    if (film.note !== v || film.sp !== s) { film.note = v; film.sp = s; films.save(); }
  };
  /** Mudar a nota: volta para as estrelas, já na nota salva. */
  const change = () => { saveNote(); nav.replace({ k: 'quiz', info, classic, rewatch: null, direct: true }); };

  // Voltar (a seta e o botão do Android) leva de volta para as estrelas
  useEffect(() => {
    nav.setBackHandler(() => { change(); return true; });
    return () => nav.setBackHandler(null);
  });

  if (!film) return null;
  const go = (save: boolean) => {
    if (save) saveNote();
    nav.replace({ k: 'result', info, key: filmKey, base, classic, rewatch, replaced, answers });
  };
  const setWhere = (w: Where) => {
    film.w = film.w === w ? undefined : w;
    if (film.w === 'cine' && !film.tk) { const c = lastCinema(); if (c) film.tk = { cine: c }; }
    films.save();
  };

  return (
    <div className="screen det2">
      <div className="dettop"><button type="button" className="detskip" id="detskip" onClick={() => go(false)}>Pular</button></div>
      <div className="dethead">
        <span className="detp"><Poster img={info.img} title={info.t} size="w92" /></span>
        <div>
          <b>{info.t}</b>
          <button type="button" className="detnote" onClick={change} aria-label="Mudar a nota"><RatingChip value={film.s} />mudar</button>
        </div>
      </div>

      <label className="lbl2" htmlFor="rv2">Sua review</label>
      <div className="revbox">
        <textarea id="rv2" maxLength={5000} placeholder="O que ficou com você depois dos créditos?" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      {text.trim() && <SpoilerSwitch on={sp} onChange={setSp} />}

      <span className="lbl2">Onde você viu</span>
      <div className="wchips" role="radiogroup" aria-label="Onde você viu">
        {WHERE.map(([w, label]) => (
          <button key={w} type="button" role="radio" aria-checked={film.w === w} className={`wchip${film.w === w ? ' on' : ''}`} onClick={() => setWhere(w)}>{label}</button>
        ))}
      </div>
      {film.w === 'cine' && (
        <div className="detcard">
          <b>Quem foi com você?</b>
          <small>Vira um ingresso para vocês</small>
          <TicketEditor film={film} />
        </div>
      )}
      <div className="detcard"><WhenRow film={film} /></div>

      <div className="grow" />
      <Button block id="detsave" onClick={() => go(true)}>Salvar no diário</Button>
    </div>
  );
}
