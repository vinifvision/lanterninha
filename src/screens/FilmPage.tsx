// Página do filme: dados gerais, trailer, a minha nota em resumo e a nota dos amigos.
// Serve para qualquer filme, esteja ou não na lista de quem está olhando.
import { useEffect, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { useArmed, useAsync } from '../components/hooks';
import { PlayIcon, SendIcon, ShareIcon } from '../components/icons';
import { Poster } from '../components/Poster';
import { Stars } from '../components/Stars';
import { WhenRow } from '../components/WhenRow';
import { movieDetails, movieRatings, posterUrl } from '../lib/api';
import { cloud, useCloud } from '../lib/cloud';
import { posterColor, setTint } from '../lib/color';
import { films, fkey, isRated, toInfo, useFilms } from '../lib/films';
import { duration, fmt, LABELS, pname } from '../lib/format';
import { looksClassic } from '../lib/quiz';
import type { FilmInfo, MovieDetails } from '../lib/types';
import { nav } from '../nav';

export function FilmPage({ info: raw }: { info: FilmInfo }) {
  const info = toInfo(raw);
  const key = fkey(info);
  const all = useFilms();
  const account = useCloud();
  const film = all.find((h) => fkey(h) === key) || null;
  const rated = isRated(film) ? film : null;
  const details = useAsync<MovieDetails | null>(() => (info.id ? movieDetails(info.id) : Promise.resolve(null)), [info.id]);
  const hasFriends = !!account.user && account.friends.list.length > 0;
  const crowd = useAsync(() => (hasFriends ? cloud.filmRatings(key) : Promise.resolve([])), [key, hasFriends]);
  const [backdropReady, setBackdropReady] = useState(false);
  const [armed, press] = useArmed();

  // Fundo da página na cor do pôster; volta ao normal ao sair
  useEffect(() => {
    let alive = true;
    void posterColor(info.img || '', film).then((c) => { if (alive) setTint(c); });
    return () => { alive = false; setTint(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info.img]);

  // O banner entra suave depois de carregado
  useEffect(() => {
    setBackdropReady(false);
    if (!details?.backdrop) return;
    const img = new Image();
    img.onload = () => setBackdropReady(true);
    img.src = posterUrl(details.backdrop, 'w780');
  }, [details?.backdrop]);

  const sub = [info.o && info.o !== info.t ? info.o : '', info.y].filter(Boolean).join(' · ');
  const canRec = hasFriends && !!film && film.st !== 'want';
  const startQuiz = () => nav.startQuiz(info, { classic: looksClassic(info.y) });
  const markSeen = () => { films.setStatus(info, 'seen'); };
  const remove = () => { if (press() && film) { films.remove(film); nav.back(); } };
  const recButton = (label: string) => <button id="arec" onClick={() => nav.open({ k: 'recommend', info })}><SendIcon />{label}</button>;

  let mine: JSX.Element;
  if (rated) {
    const chips = [rated.c ? 'Clássico' : '', (rated.n || 0) > 1 ? `↻ ${rated.n}ª vez${rated.p ? ' · antes ★ ' + fmt(rated.p) : ''}` : ''].filter(Boolean);
    mine = (
      <>
        <h3>Minha nota</h3>
        <div className="rate"><b>{fmt(rated.s)}</b><div><Stars value={rated.s} anim /><span>{LABELS[rated.s]}</span></div></div>
        {chips.length > 0 && <div className="chips">{chips.map((c) => <span key={c}>{c}</span>)}</div>}
        <WhenRow film={rated} />
        <div className="rowb">
          <button id="rved" onClick={() => nav.open(rated.note ? { k: 'reviews', info } : { k: 'editor', key })}>{rated.note ? 'Minha review' : 'Escrever review'}</button>
          <button id="shr" onClick={() => nav.open({ k: 'share', key })}><ShareIcon />Compartilhar</button>
          {canRec && recButton('Indicar')}
        </div>
      </>
    );
  } else if (film?.st === 'seen') {
    mine = (
      <>
        <h3>Minha avaliação</h3>
        <div className="state">Já vi</div>
        <WhenRow film={film} />
        <button className="cta" id="arate" onClick={startQuiz}>Avaliar agora</button>
        {canRec && <div className="rowb">{recButton('Indicar para um amigo')}</div>}
      </>
    );
  } else if (film?.st === 'want') {
    mine = (
      <>
        <h3>Na minha fila</h3>
        <div className="state">Quero ver</div>
        {film.by && <p className="byline">Indicado por {film.by}</p>}
        <button className="cta" id="arate" onClick={startQuiz}>Avaliar agora</button>
        <div className="two"><button id="aseen" onClick={markSeen}>Marcar como já vi</button></div>
      </>
    );
  } else {
    mine = (
      <>
        <h3>Ainda não está nos seus filmes</h3>
        <div className="three">
          <button className="go" id="arate" onClick={startQuiz}>Avaliar</button>
          <button id="aseen" onClick={markSeen}>Já vi</button>
          <button id="awant" onClick={() => { films.setStatus(info, 'want'); }}>Quero ver</button>
        </div>
      </>
    );
  }

  const facts = details ? [duration(details.runtime), details.genres.join(', ')].filter(Boolean).join(' · ') : '';
  const providers: [string, MovieDetails['providers']['stream']][] = details
    ? [['Streaming', details.providers.stream], ['Alugar', details.providers.rent], ['Comprar', details.providers.buy]]
    : [];
  const anyProvider = providers.some(([, list]) => list.length > 0);

  return (
    <div className="screen">
      <div className={`hero${info.img ? '' : ' noimg'}`}>
        {info.img && <div className="hbg blur" style={{ backgroundImage: `url(${posterUrl(info.img, 'w342')})` }} />}
        {details?.backdrop && <div className={`hbg${backdropReady ? ' in' : ''}`} style={{ backgroundImage: `url(${posterUrl(details.backdrop, 'w780')})` }} />}
      </div>
      <div className="fhead">
        <Poster img={info.img} title="" size="w342" fallback={false} className="fposter" />
        <div><h2>{info.t}</h2>{sub && <p>{sub}</p>}</div>
      </div>
      {info.id ? <p className="facts">{facts}</p> : null}
      <Scores id={info.id ?? undefined} />
      {details?.trailer && (
        <a className="trl" id="trl" href={`https://www.youtube.com/watch?v=${details.trailer}`} target="_blank" rel="noopener noreferrer"><PlayIcon />Ver trailer</a>
      )}

      <LanternStats filmKey={key} mine={rated?.s} />
      <div className="mybox">{mine}</div>

      {hasFriends && crowd && (
        <div id="crowd">
          <h3 className="sec">Nota da galera{crowd.length > 0 && <a id="crall" onClick={() => nav.open({ k: 'reviews', info })}>Ver reviews</a>}</h3>
          <div className="gal">
            {crowd.length === 0 && <p className="none">Nenhum amigo avaliou esse filme ainda.</p>}
            {crowd.map((r) => (
              <button className="fr" key={r.p.id} onClick={() => nav.open({ k: 'reviews', info, focusId: r.p.id })}>
                <Avatar p={r.p} /><div><b>{pname(r.p)}</b></div><Stars value={r.f.s} /><i>›</i>
              </button>
            ))}
          </div>
        </div>
      )}

      {details && (
        <div className="about">
          {(details.overview || details.director || details.cast.length > 0) && (
            <>
              <h3 className="sec">Sobre o filme</h3>
              {details.overview && <p>{details.overview}</p>}
              {details.director && <small>Direção: {details.director}</small>}
              {details.cast.length > 0 && <small className="cast">Elenco: {details.cast.join(', ')}</small>}
            </>
          )}
          <h3 className="sec">Onde assistir</h3>
          <div className="prov">
            {!anyProvider && <small>Não achei esse filme em streaming no Brasil agora.</small>}
            {providers.filter(([, list]) => list.length > 0).map(([label, list]) => (
              <div key={label} style={{ display: 'block' }}>
                <em>{label}</em>
                <div>{list.map((x) => (x.logo ? <img key={x.name} src={posterUrl(x.logo, 'w92')} alt={x.name} title={x.name} loading="lazy" /> : <span key={x.name}>{x.name}</span>))}</div>
              </div>
            ))}
            {anyProvider && <small style={{ marginTop: 12 }}>Disponibilidade no Brasil · dados da JustWatch</small>}
          </div>
        </div>
      )}

      {film && (
        <div className="acts">
          {rated && <button className="main" id="are" onClick={() => nav.startQuiz(info, { rewatch: rated, classic: rated.c })}>Reassisti</button>}
          {rated && <button id="aco" onClick={() => nav.startQuiz(info, { classic: rated.c })}>Corrigir nota</button>}
          <button className="del" id="adel" onClick={remove}>{armed ? (rated ? 'Apagar mesmo?' : 'Tirar mesmo?') : rated ? 'Apagar' : 'Tirar da lista'}</button>
        </div>
      )}
    </div>
  );
}

/** Notas de fora numa linha só: IMDb e Rotten Tomatoes. Só aparece o que existir. */
function Scores({ id }: { id?: number }) {
  const ext = useAsync(() => (id ? movieRatings(id).catch(() => null) : Promise.resolve(null)), [id]);
  const one = (n: number) => fmt(Math.round(n * 10) / 10);
  const items: JSX.Element[] = [];
  if (ext?.imdb != null) {
    const body = <><img className="brand-imdb" src="/brands/imdb.png" alt="IMDb" /><b>{one(ext.imdb)}</b></>;
    items.push(ext.imdbId
      ? <a className="sc" key="imdb" href={`https://www.imdb.com/title/${ext.imdbId}/`} target="_blank" rel="noopener noreferrer">{body}</a>
      : <span className="sc" key="imdb">{body}</span>);
  }
  // Rotten Tomatoes: tomate para 60% ou mais (fresco), mancha verde abaixo disso (podre), como no site deles
  if (ext?.rt != null) {
    const fresh = ext.rt >= 60;
    items.push(
      <span className="sc" key="rt" title={`Rotten Tomatoes: ${fresh ? 'fresco' : 'podre'}`}>
        <img className="brand-rt" src={fresh ? '/brands/rt-fresh.png' : '/brands/rt-rotten.png'} alt={fresh ? 'Rotten Tomatoes, fresco' : 'Rotten Tomatoes, podre'} /><b>{ext.rt}%</b>
      </span>);
  }
  if (ext && ext.imdb == null && ext.rt == null && ext.tmdb != null) items.push(<span className="sc" key="tmdb"><i className="lbl">TMDB</i><b>{one(ext.tmdb)}</b></span>);
  if (!items.length) return null;
  return <div className="scores" id="scores">{items}</div>;
}

/** Nota no Lanterninha, no estilo do Letterboxd: gráfico de quantas pessoas deram cada nota e a média em destaque. */
function LanternStats({ filmKey, mine }: { filmKey: string; mine?: number }) {
  const st = useAsync(() => cloud.filmStats(filmKey), [filmKey, mine]);
  if (!st) return null;
  const max = st.dist ? Math.max(...st.dist) : 0;
  return (
    <div className="lstats" id="lstats">
      <div className="lhead"><img src="/logo.svg" alt="" /><span>Nota no Lanterninha</span></div>
      <div className="lrow">
        {st.dist && (
          <div className="lchart">
            <div className="hist" role="img" aria-label={`Distribuição de ${st.n} ${st.n === 1 ? 'avaliação' : 'avaliações'}`}>
              {st.dist.map((c, i) => (
                <i key={i} className={mine === (i + 1) / 2 ? 'me' : ''} title={`${fmt((i + 1) / 2)} estrela${i ? 's' : ''}: ${c}`}
                  style={{ height: `${c ? Math.max(8, (c / max) * 100) : 4}%`, animationDelay: `${i * 35}ms` }} />
              ))}
            </div>
            <div className="hl"><span>★</span><span>★★★★★</span></div>
          </div>
        )}
        <div className="lavg">
          <b>{fmt(st.avg)}</b>
          <small>{st.n} {st.n === 1 ? 'avaliação' : 'avaliações'}</small>
        </div>
      </div>
    </div>
  );
}
