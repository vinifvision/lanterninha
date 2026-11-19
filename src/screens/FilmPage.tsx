// Página do filme (redesign v2): Avaliar em destaque, três atalhos com ícones, sinopse, aviso de streaming,
// a nota da galera em gráfico (com o rosto de cada amigo), trechos das reviews e o cartão de Elenco e equipe.
// Serve para qualquer filme, esteja ou não na lista de quem está olhando.
import { useEffect, useState } from "react";
import { Avatar } from "../components/Avatar";
import { useArmed, useAsync } from "../components/hooks";
import { BookmarkIcon, PlayIcon, SendIcon, ShareIcon, StarIcon } from "../components/icons";
import { Poster } from "../components/Poster";
import { Stars } from "../components/Stars";
import { WhenRow } from "../components/WhenRow";
import { movieCredits, movieDetails, movieRatings, posterUrl } from "../lib/api";
import { refresh, useRefresh } from "../lib/refresh";
import { preloadCard } from "../lib/share";
import { sfx } from "../lib/sfx";
import { cloud, useCloud } from "../lib/cloud";
import { posterColor, setTint } from "../lib/color";
import { films, fkey, isRated, toInfo, useFilms } from "../lib/films";
import { duration, fd, fmt, LABELS, nFriends } from "../lib/format";
import { looksClassic } from "../lib/quiz";
import type { Film, FilmInfo, FriendRating, MovieDetails } from "../lib/types";
import { nav } from "../nav";
import "../styles/v2-filme.css";

const EyeIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
);
const PenIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg>
);
const BellIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 21h4" /></svg>
);

/** Nota pequena: uma estrela e o número, "★ 4,5". */
const star = (s: number) => "★ " + fmt(s);

export function FilmPage({ info: raw }: { info: FilmInfo }) {
  const info = toInfo(raw);
  const key = fkey(info);
  const all = useFilms();
  const account = useCloud();
  const film = all.find((h) => fkey(h) === key) || null;
  const rated = isRated(film) ? film : null;
  // Sem conexão: a página mostra o que já tem e avisa. "Tentar de novo" e puxar para baixo recarregam tudo.
  const tick = useRefresh();
  const [detailsFailed, setDetailsFailed] = useState(false);
  const details = useAsync<MovieDetails | null>(
    () =>
      info.id
        ? movieDetails(info.id).then(
            (d) => { setDetailsFailed(false); return d; },
            (e) => { setDetailsFailed(true); throw e; },
          )
        : Promise.resolve(null),
    [info.id, tick],
    true,
  );
  const hasFriends = !!account.user && account.friends.list.length > 0;
  const crowd = useAsync(
    () => (hasFriends ? cloud.filmRatings(key) : Promise.resolve([] as FriendRating[])),
    [key, hasFriends, tick],
    true,
  );
  const [backdropReady, setBackdropReady] = useState(false);
  const [moreText, setMoreText] = useState(false);
  const [armed, press] = useArmed();

  // Fundo da página na cor do pôster; volta ao normal ao sair
  useEffect(() => {
    let alive = true;
    void posterColor(info.img || "", film).then((c) => {
      if (alive) setTint(c);
    });
    return () => {
      alive = false;
      setTint(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info.img]);

  // Se já tenho nota, o pôster da imagem de compartilhar começa a baixar agora (Compartilhar abre mais rápido)
  useEffect(() => {
    if (rated) preloadCard(rated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!rated, info.img]);

  // O banner entra suave depois de carregado
  useEffect(() => {
    setBackdropReady(false);
    if (!details?.backdrop) return;
    const img = new Image();
    img.onload = () => setBackdropReady(true);
    img.src = posterUrl(details.backdrop, "w780");
  }, [details?.backdrop]);

  const meta = [
    info.y,
    details?.runtime ? duration(details.runtime) : "",
    details?.genres[0] || "",
  ]
    .filter(Boolean)
    .join(" · ");
  const canRec = hasFriends && !!film && film.st !== "want";
  const classic = looksClassic(info.y);
  const startQuiz = () => nav.startQuiz(info, { classic });
  const rateAgain = () => rated && nav.startQuiz(info, { classic, rewatch: rated });
  const toggle = (st: "seen" | "want") => {
    sfx.tap();
    if (film && film.st === st) films.remove(film);
    else films.setStatus(info, st);
  };
  const remove = () => {
    if (press() && film) {
      films.remove(film);
      nav.back();
    }
  };

  const trailer = details?.trailer ? (
    <a
      className="play"
      id="trl"
      href={`https://www.youtube.com/watch?v=${details.trailer}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      <PlayIcon />
      Trailer
    </a>
  ) : (
    <button className="play" id="trl" disabled>
      <PlayIcon />
      Trailer
    </button>
  );

  const stream = details?.providers.stream || [];
  const providers: [string, MovieDetails["providers"]["stream"]][] = details
    ? [
        ["Streaming", details.providers.stream],
        ["Alugar", details.providers.rent],
        ["Comprar", details.providers.buy],
      ]
    : [];
  const anyProvider = providers.some(([, list]) => list.length > 0);
  const friendRatings = crowd || [];

  return (
    <div className="screen fp2">
      <div className={`hero${info.img ? "" : " noimg"}`}>
        {info.img && (
          <div
            className="hbg blur"
            style={{ backgroundImage: `url(${posterUrl(info.img, "w342")})` }}
          />
        )}
        {details?.backdrop && (
          <div
            className={`hbg${backdropReady ? " in" : ""}`}
            style={{
              backgroundImage: `url(${posterUrl(details.backdrop, "w780")})`,
            }}
          />
        )}
      </div>
      <div className="fhead2">
        <div className="ft">
          <h1>{info.t}</h1>
          {info.o && info.o !== info.t && <p className="orig">{info.o}</p>}
          {meta && <p>{meta}</p>}
          {details?.director && (
            <p className="dir">
              Dirigido por <b>{details.director}</b>
            </p>
          )}
        </div>
        <Poster img={info.img} title="" size="w342" fallback={false} className="fposter2" />
      </div>
      <Scores id={info.id ?? undefined} />

      <div className="fact2">
        <button className="avaliar" id="arate" onClick={rated ? rateAgain : startQuiz}>
          <StarIcon />
          {rated ? "Avaliar de novo" : "Avaliar"}
        </button>
        <div className="tri">
          {rated ? (
            <>
              <button
                id="rved"
                onClick={() =>
                  nav.open(rated.note ? { k: "reviews", info } : { k: "editor", key })
                }
              >
                <PenIcon />
                {rated.note ? "Sua review" : "Escrever"}
              </button>
              <button id="shr" onClick={() => nav.open({ k: "share", key })}>
                <ShareIcon />
                Compartilhar
              </button>
            </>
          ) : (
            <>
              <button id="awant" aria-pressed={film?.st === "want"} onClick={() => toggle("want")}>
                <BookmarkIcon />
                Quero ver
              </button>
              <button id="aseen" aria-pressed={film?.st === "seen"} onClick={() => toggle("seen")}>
                <EyeIcon />
                Já vi
              </button>
            </>
          )}
          {trailer}
        </div>
        {film?.st === "want" && film.by && <p className="byline2">Indicado por {film.by}</p>}
      </div>

      {rated && (
        <div className="mybox mine2">
          <div className="myhead">
            <h3>Minha nota</h3>
            <button id="medit" onClick={() => nav.open({ k: "filmEdit", key })}>
              Editar
            </button>
          </div>
          <div className="rate">
            <b>{fmt(rated.s)}</b>
            <div>
              <Stars value={rated.s} anim />
              <span>{LABELS[rated.s]}</span>
            </div>
          </div>
          <MyChips film={rated} />
          {rated.w === "cine" && (
            <button className="tkmini" id="tkb" onClick={() => nav.open({ k: "ticket", key })}>
              <span>Ingresso</span>
              <b>{rated.tk?.cine || "Visto no cinema"}</b>
              <i>›</i>
            </button>
          )}
          {canRec && (
            <div className="rowb">
              <button id="arec" onClick={() => nav.open({ k: "recommend", info })}>
                <SendIcon />
                Indicar
              </button>
            </div>
          )}
        </div>
      )}
      {!rated && film?.st === "seen" && (
        <div className="mybox mine2">
          <WhenRow film={film} />
          {canRec && (
            <div className="rowb">
              <button id="arec" onClick={() => nav.open({ k: "recommend", info })}>
                <SendIcon />
                Indicar para um amigo
              </button>
            </div>
          )}
        </div>
      )}

      {details?.overview && (
        <p className={`sinopse${moreText ? "" : " cut"}`} onClick={() => setMoreText(true)}>
          {details.overview}
        </p>
      )}
      {details?.overview && !moreText && details.overview.length > 160 && (
        <button className="mais" onClick={() => setMoreText(true)}>
          Mais
        </button>
      )}

      {details && stream.length === 0 && <StreamAlert filmKey={key} />}

      {detailsFailed && (
        <div className="offline" id="fpoff" role="status">
          <span>Sem conexão: alguns dados do filme não carregaram.</span>
          <button onClick={() => { sfx.tap(); void refresh.run(); }}>Tentar de novo</button>
        </div>
      )}

      {hasFriends && crowd && <Galera crowd={friendRatings} info={info} />}
      {(!hasFriends || (crowd && crowd.length === 0)) && (
        <LanternStats filmKey={key} mine={rated?.s} />
      )}
      {hasFriends && crowd && <Disse crowd={friendRatings} info={info} />}

      {info.id ? <CastCard info={info} /> : null}

      {details && anyProvider && (
        <div className="about">
          <h3 className="sec">Onde assistir</h3>
          <div className="prov">
            {providers
              .filter(([, list]) => list.length > 0)
              .map(([label, list]) => (
                <div key={label} style={{ display: "block" }}>
                  <em>{label}</em>
                  <div>
                    {list.map((x) =>
                      x.logo ? (
                        <img
                          key={x.name}
                          src={posterUrl(x.logo, "w92")}
                          alt={x.name}
                          title={x.name}
                          loading="lazy"
                        />
                      ) : (
                        <span key={x.name}>{x.name}</span>
                      ),
                    )}
                  </div>
                </div>
              ))}
            <small style={{ marginTop: 12 }}>
              Disponibilidade no Brasil · dados da JustWatch
            </small>
          </div>
        </div>
      )}

      {film && !rated && (
        <div className="acts">
          <button className="del" id="adel" onClick={remove}>
            {armed ? "Tirar mesmo?" : "Tirar da lista"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Etiquetas da minha nota: clássico, onde vi, reassistido, data. */
function MyChips({ film }: { film: Film }) {
  const chips = [
    film.c ? "Clássico" : "",
    film.w === "cine" ? "No cinema" : film.w === "casa" ? "Em casa" : "",
    (film.n || 0) > 1 ? `↻ ${film.n}ª vez${film.p ? " · antes ★ " + fmt(film.p) : ""}` : "",
    film.d ? "Visto em " + fd(film.d) : "",
  ].filter(Boolean);
  if (!chips.length) return null;
  return (
    <div className="chips">
      {chips.map((c) => (
        <span key={c}>{c}</span>
      ))}
    </div>
  );
}

/**
 * Aviso de streaming: quando o filme ainda não está em nenhum streaming no Brasil.
 * Por enquanto a escolha fica guardada só no aparelho; a notificação de verdade vem depois.
 */
const ALERTS = "lant.avisoStreaming";
const readAlerts = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(ALERTS) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};
function StreamAlert({ filmKey }: { filmKey: string }) {
  const [on, setOn] = useState(() => readAlerts().includes(filmKey));
  useEffect(() => setOn(readAlerts().includes(filmKey)), [filmKey]);
  const flip = () => {
    const next = !on;
    const list = readAlerts().filter((k) => k !== filmKey);
    if (next) list.push(filmKey);
    try {
      localStorage.setItem(ALERTS, JSON.stringify(list));
    } catch {
      /* ok */
    }
    sfx.tap();
    setOn(next);
  };
  return (
    <button
      className="aviso"
      id="aviso"
      role="switch"
      aria-checked={on}
      aria-label="Avisar quando chegar no streaming"
      onClick={flip}
    >
      <BellIcon />
      <span className="tx">
        Ainda não chegou no streaming.
        <small>{on ? "Te aviso quando chegar." : "Quer que eu avise quando chegar?"}</small>
      </span>
      <span className="sw2" aria-hidden="true" />
    </button>
  );
}

/** Nota da galera: média dos amigos e um gráfico de 0,5 a 5 com o rosto de quem deu cada nota. */
function Galera({ crowd, info }: { crowd: FriendRating[]; info: FilmInfo }) {
  const cols: FriendRating[][] = Array.from({ length: 10 }, () => []);
  crowd.forEach((r) => {
    const i = Math.min(9, Math.max(0, Math.round(r.f.s * 2) - 1));
    cols[i].push(r);
  });
  const max = Math.max(1, ...cols.map((c) => c.length));
  const avg = crowd.length ? Math.round((crowd.reduce((a, r) => a + r.f.s, 0) / crowd.length) * 10) / 10 : 0;
  const label = cols
    .map((c, i) => (c.length ? `${c.length} de ${fmt((i + 1) / 2)}` : ""))
    .filter(Boolean)
    .join(", ");
  return (
    <section className="galera" id="crowd" aria-label="Nota da galera">
      <div className="gh">
        <div>
          <h2>Nota da galera</h2>
          <small>
            {crowd.length ? `${nFriends(crowd.length)} ${crowd.length === 1 ? "viu" : "viram"}` : "Nenhum amigo avaliou ainda"}
          </small>
        </div>
        {crowd.length > 0 && <b>{fmt(avg)}</b>}
      </div>
      {crowd.length > 0 && (
        <>
          <button
            className="gchart"
            aria-label={`Notas dos amigos: ${label}. Ver reviews`}
            onClick={() => nav.open({ k: "reviews", info })}
          >
            {cols.map((c, i) => (
              <span className="gcol" key={i}>
                {c.length > 3 && <span className="gmore">+{c.length - 2}</span>}
                {(c.length > 3 ? c.slice(0, 2) : c).map((r) => (
                  <Avatar key={r.p.id} p={r.p} />
                ))}
                <span
                  className={`gbar${c.length ? " on" : ""}`}
                  style={{
                    height: c.length ? 22 + (c.length / max) * 48 : 6,
                    animationDelay: `${i * 35}ms`,
                  }}
                />
              </span>
            ))}
          </button>
          <div className="gaxis" aria-hidden="true">
            <span>★ 0,5</span>
            <span>★ 5</span>
          </div>
        </>
      )}
    </section>
  );
}

/** O que a galera disse: até dois trechos de review e o atalho para a tela de Reviews. */
function Disse({ crowd, info }: { crowd: FriendRating[]; info: FilmInfo }) {
  const withText = crowd.filter((r) => r.f.note);
  if (!withText.length) return null;
  return (
    <section className="disse" aria-label="O que os amigos disseram">
      <div className="dh">
        <h2>O que a galera disse</h2>
        <button id="crall" onClick={() => nav.open({ k: "reviews", info })}>
          {withText.length === 1 ? "Ver a review" : `Ver as ${withText.length} reviews`}
        </button>
      </div>
      <div className="dsays">
        {withText.slice(0, 2).map((r) => (
          <button
            className="dsay"
            key={r.p.id}
            onClick={() => nav.open({ k: "reviews", info, focusId: r.p.id })}
          >
            <span className="who">
              <Avatar p={r.p} />
              <span>{star(r.f.s)}</span>
            </span>
            <p>“{r.f.note}”</p>
          </button>
        ))}
      </div>
    </section>
  );
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/** Cartão de Elenco e equipe: rostos sobrepostos de quem está no filme, levando para os créditos. */
function CastCard({ info }: { info: FilmInfo }) {
  const cast = useAsync(
    () => (info.id ? movieCredits(info.id).then((c) => c.cast.slice(0, 4)).catch(() => []) : Promise.resolve([])),
    [info.id],
    true,
  );
  return (
    <button className="ecard" id="crd" onClick={() => nav.push({ k: "credits", info })}>
      {cast && cast.length > 0 && (
        <span className="faces" aria-hidden="true">
          {cast.map((p) =>
            p.photo ? (
              <img key={p.name} src={posterUrl(p.photo, "w185")} alt="" loading="lazy" />
            ) : (
              <span key={p.name}>{initials(p.name)}</span>
            ),
          )}
        </span>
      )}
      <span className="tx">
        <b>Elenco e equipe</b>
        <small>Quem fez esse filme acontecer</small>
      </span>
      <span className="go" aria-hidden="true">›</span>
    </button>
  );
}

/** Notas de fora numa linha só: IMDb e Rotten Tomatoes. Só aparece o que existir. */
function Scores({ id }: { id?: number }) {
  const tick = useRefresh();
  const ext = useAsync(
    () => (id ? movieRatings(id).catch(() => null) : Promise.resolve(null)),
    [id, tick],
    true,
  );
  const one = (n: number) => fmt(Math.round(n * 10) / 10);
  const items: JSX.Element[] = [];
  if (ext?.imdb != null) {
    const body = (
      <>
        <img className="brand-imdb" src="/brands/imdb.png" alt="IMDb" />
        <b>{one(ext.imdb)}</b>
      </>
    );
    items.push(
      ext.imdbId ? (
        <a
          className="sc"
          key="imdb"
          href={`https://www.imdb.com/title/${ext.imdbId}/`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {body}
        </a>
      ) : (
        <span className="sc" key="imdb">
          {body}
        </span>
      ),
    );
  }
  // Rotten Tomatoes: tomate para 60% ou mais (fresco), mancha verde abaixo disso (podre), como no site deles
  if (ext?.rt != null) {
    const fresh = ext.rt >= 60;
    items.push(
      <span
        className="sc"
        key="rt"
        title={`Rotten Tomatoes: ${fresh ? "fresco" : "podre"}`}
      >
        <img
          className="brand-rt"
          src={fresh ? "/brands/rt-fresh.png" : "/brands/rt-rotten.png"}
          alt={fresh ? "Rotten Tomatoes, fresco" : "Rotten Tomatoes, podre"}
        />
        <b>{ext.rt}%</b>
      </span>,
    );
  }
  if (!items.length) return null;
  return (
    <div className="scores" id="scores">
      {items}
    </div>
  );
}

/** Nota no Lanterninha (todo mundo): aparece quando ainda não há nota de amigos. */
function LanternStats({ filmKey, mine }: { filmKey: string; mine?: number }) {
  const tick = useRefresh();
  const st = useAsync(() => cloud.filmStats(filmKey), [filmKey, mine, tick], true);
  if (!st) return null;
  const max = st.dist ? Math.max(...st.dist) : 0;
  return (
    <div className="lstats" id="lstats">
      <div className="lhead">
        <img src="/logo.svg" alt="" />
        <span>Nota no Lanterninha</span>
      </div>
      <div className="lrow">
        {st.dist && (
          <div className="lchart">
            <div
              className="hist"
              role="img"
              aria-label={`Distribuição de ${st.n} ${st.n === 1 ? "avaliação" : "avaliações"}`}
            >
              {st.dist.map((c, i) => (
                <i
                  key={i}
                  className={mine === (i + 1) / 2 ? "me" : ""}
                  title={`${fmt((i + 1) / 2)} estrela${i ? "s" : ""}: ${c}`}
                  style={{
                    height: `${c ? Math.max(8, (c / max) * 100) : 4}%`,
                    animationDelay: `${i * 35}ms`,
                  }}
                />
              ))}
            </div>
            <div className="hl">
              <span>★</span>
              <span>★★★★★</span>
            </div>
          </div>
        )}
        <div className="lavg">
          <b>{fmt(st.avg)}</b>
          <small>
            {st.n} {st.n === 1 ? "avaliação" : "avaliações"}
          </small>
        </div>
      </div>
    </div>
  );
}
