// Lista completa de uma categoria (o "Ver todos" das fileiras do Início, e os chips No cinema e Clássicos):
// uma grade de pôsteres que vai carregando mais filmes conforme a pessoa desce.
import { useMemo } from 'react';
import { MineBadge } from '../components/MineBadge';
import { ListEnd, usePages } from '../components/Paged';
import { Poster } from '../components/Poster';
import { discoverPage, type DiscoverList } from '../lib/api';
import { fkey, useFilms } from '../lib/films';
import { useRefresh } from '../lib/refresh';
import type { Film, FilmInfo, SearchResult } from '../lib/types';
import { nav } from '../nav';

const toFilm = (m: SearchResult): FilmInfo => ({ id: m.id, t: m.title, y: m.year, o: m.original, img: m.poster });

/** Título das listas: em "Porque você amou X", o nome do filme acende. */
export function ListTitle({ title, em }: { title: string; em?: string }) {
  return <h2>{title}{em && <> <em>{em}</em></>}</h2>;
}

/** Grade de uma lista do TMDB com rolagem infinita. */
export function DiscoverGrid({ title, em, list, id, mine }: { title: string; em?: string; list: DiscoverList; id?: number; mine: Map<string, Film> }) {
  const tick = useRefresh();
  const p = usePages((page) => discoverPage(list, page, id), [list, id, tick]);
  return (
    <section className="hsec">
      <div className="v2h"><ListTitle title={title} em={em} /></div>
      {p.failed && !p.items ? (
        <div className="v2err">Não consegui carregar essa lista.<button className="btn btn-sec" onClick={p.retry}>Tentar de novo</button></div>
      ) : p.items && p.items.length === 0 && p.done ? (
        <p className="hnote">Nada por aqui agora.</p>
      ) : (
        <div className="v2grid">
          {!p.items && [0, 1, 2, 3, 4, 5].map((i) => <span className="hp sk" key={i}><span className="ph" /></span>)}
          {p.items?.map((m) => (
            <button className="hp" key={m.id} onClick={() => nav.openFilm(toFilm(m))}>
              <span className="ph"><Poster img={m.poster} title={m.title} /><MineBadge film={mine.get('m' + m.id)} /></span>
            </button>
          ))}
        </div>
      )}
      <ListEnd p={p} />
    </section>
  );
}

export function FullList({ title, em, list, id }: { title: string; em?: string; list: DiscoverList; id?: number }) {
  const all = useFilms();
  const mine = useMemo(() => new Map(all.map((h) => [fkey(h), h] as const)), [all]);
  return (
    <div className="screen v2home">
      <DiscoverGrid title={title} em={em} list={list} id={id} mine={mine} />
      <p className="credit">Listas de filmes: <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">TMDB</a></p>
    </div>
  );
}
