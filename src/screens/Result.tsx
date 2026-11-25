// Nota pronta: o filme entrou no diário. O ingresso mostra a sessão, quem foi junto e a nota grande.
// Som só aqui (o rolo). "Pronto" vai para a página do filme (ou volta para ela, se a avaliação começou lá).
import { useEffect } from 'react';
import { Button } from '../components/Button';
import { ShareIcon } from '../components/icons';
import { Poster } from '../components/Poster';
import { Stars } from '../components/Stars';
import { useCloud } from '../lib/cloud';
import { fkey, isRated, useFilms } from '../lib/films';
import { fmt, LABELS, MONTHS, pname } from '../lib/format';
import { preloadCard } from '../lib/share';
import { sfx } from '../lib/sfx';
import type { Film, FilmInfo, RatedFilm } from '../lib/types';
import { nav } from '../nav';
import { clearRateDraft } from './RateHome';

interface Props { info: FilmInfo; filmKey: string; base: number; classic: boolean; rewatch: RatedFilm | null; replaced: Film | null; answers: number[] }

/** AAAA-MM-DD → "19 de novembro" (com o ano, se não for este). */
const longDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${+d} de ${MONTHS[+m - 1].toLowerCase()}${+y !== new Date().getFullYear() ? ` de ${y}` : ''}`;
};

export function Result({ info, filmKey, rewatch }: Props) {
  const all = useFilms();
  const { friends, sent, withMe } = useCloud();
  const found = all.find((h) => fkey(h) === filmKey);
  const film = isRated(found) ? found : null;

  useEffect(() => {
    preloadCard(info); // a imagem de compartilhar fica pronta mais rápido
    clearRateDraft();
    sfx.reelLand(0.25);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Voltar sai do resultado; a nota fica guardada
  useEffect(() => {
    nav.setBackHandler(() => false);
    return () => nav.setBackHandler(null);
  }, []);

  if (!film) return null;
  const year = String(new Date().getFullYear());
  // Conta igual ao Perfil: todos os vistos no ano, com ou sem nota
  const nYear = all.filter((h) => h.st !== 'want' && h.d?.startsWith(year)).length;
  // Quem foi junto: quem eu marquei (menos quem disse que não foi) e quem me marcou
  const ids = [...new Set([...(film.tk?.with || []).filter((id) => sent[filmKey]?.[id] !== 'declined'), ...(withMe[filmKey] || [])])];
  const names = ids.map((id) => friends.list.find((p) => p.id === id)).filter(Boolean).map((p) => pname(p!));
  const diff = rewatch ? film.s - rewatch.s : 0;

  const done = () => {
    const below = nav.state.stack[nav.state.stack.length - 2];
    if (below?.k === 'film' && fkey(below.info) === filmKey) nav.back();
    else nav.replace({ k: 'film', info: film });
  };

  return (
    <div className="screen pronto">
      <div className="prbeam" aria-hidden="true" />
      <div className="prhead">
        <small>Entrou no seu diário</small>
        <h1 className="serif">{film.d?.startsWith(year) ? `Seu ${nYear}º filme do ano` : LABELS[film.s]}</h1>
      </div>

      <div className="ptk">
        <span className="ptkp"><Poster img={info.img} title={info.t} size="w342" /></span>
        <div className="ptkb">
          <small>{film.w === 'cine' ? 'Ingresso — Sessão' : 'Diário — Sessão'}</small>
          <b>{film.d ? longDate(film.d) : 'Sem data'}</b>
          {film.w === 'cine' && film.tk?.cine && <span className="ptkc">{film.tk.cine}</span>}
          {names.length > 0 && <span className="ptkc">Você e {names.join(', ')}</span>}
          <div className="grow" />
          <div className="ptkn" role="img" aria-label={`Nota ${fmt(film.s)}`}>
            <Stars value={film.s} anim base={500} gap={110} />
            <span>{fmt(film.s)}</span>
          </div>
        </div>
      </div>

      {rewatch && <p className="prseal">{diff > 0 ? 'Cresceu na revisão' : diff < 0 ? 'Caiu na revisão' : 'Continua igual'} (antes ★ {fmt(rewatch.s)})</p>}
      {friends.list.length > 0 && (
        <button type="button" className="prrec" onClick={() => nav.open({ k: 'recommend', info })}>
          <span>Algum amigo precisa ver esse?</span><b>Indicar</b>
        </button>
      )}

      <div className="grow" />
      <Button block id="shr" onClick={() => nav.open({ k: 'share', key: filmKey })}><ShareIcon />Compartilhar</Button>
      <button type="button" className="prdone" id="done" onClick={done}>Pronto</button>
    </div>
  );
}
