// Grade simples de filmes com título (ex.: "Março de 2026", "★ 4 em 2026"). Abre pelas estatísticas do ano.
// Com group "nota", os filmes vêm separados por nota, da maior para a menor.
import { Poster } from '../components/Poster';
import { fkey, isRated } from '../lib/films';
import { fmt } from '../lib/format';
import { NOTES } from '../lib/stats';
import type { Film } from '../lib/types';
import { nav } from '../nav';
import { openFriendFilm } from './FriendFilms';

interface Props {
  title: string;
  /** Pedaço do título que fica dourado */
  em?: string;
  /** Legenda embaixo do título (padrão: "N filmes") */
  sub?: string;
  films: Film[];
  /** Amigo dono dos filmes (tocar abre a nota dele) */
  friend?: string;
  group?: 'nota';
}

const count = (n: number) => `${n} ${n === 1 ? 'filme' : 'filmes'}`;

export function FilmGrid({ title, em, sub, films, friend, group }: Props) {
  const open = (h: Film) => (friend ? openFriendFilm(friend, h) : nav.openFilm(h));
  const at = em ? title.indexOf(em) : -1;

  const grid = (list: Film[]) => (
    <div className="v2ffgrid">
      {list.map((h, i) => (
        <button
          key={fkey(h)} className={`v2dcell${i < 16 ? ' in' : ''}`}
          style={i < 16 ? { animationDelay: `${i * 22}ms` } : undefined} onClick={() => open(h)}
        >
          <span className="v2dcpos"><Poster img={h.img} title={h.t} /></span>
          <small className="v2dcnote">{isRated(h) ? '★ ' + fmt(h.s) : 'Já vi'}</small>
        </button>
      ))}
    </div>
  );

  return (
    <div className="screen v2yr">
      <h1 className="v2frtitle v2ygt">
        {at < 0 ? title : <>{title.slice(0, at)}<em>{em}</em>{title.slice(at + em!.length)}</>}
      </h1>
      <p className="v2ffsub">{sub || count(films.length)}</p>
      {group === 'nota'
        ? [...NOTES].reverse().map((s) => {
            const l = films.filter((h) => isRated(h) && h.s === s);
            return l.length > 0 && (
              <section key={s} className="v2ygrp">
                <div className="v2ygh"><b>★ {fmt(s)}</b><span>{count(l.length)}</span></div>
                {grid(l)}
              </section>
            );
          })
        : grid(films)}
    </div>
  );
}
