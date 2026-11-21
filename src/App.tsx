// A moldura do app: barra de cima, a tela atual, as abas e o que estiver aberto por cima.
import { useEffect, useState } from "react";
import { GearIcon, TabIcon } from "./components/icons";
import { SOUND_ENABLED, sfx, useSound } from "./lib/sfx";
import { pname } from "./lib/format";
import {
  nav,
  scroller,
  useNav,
  type Overlay as OverlayState,
  type Screen,
  type Tab,
} from "./nav";
import { AddFriend } from "./overlays/AddFriend";
import { EditProfile } from "./overlays/EditProfile";
import { GuessGame } from "./overlays/GuessGame";
import { Recommend } from "./overlays/Recommend";
import { ReviewEditor } from "./overlays/ReviewEditor";
import { ReviewsPage } from "./overlays/ReviewsPage";
import { NewPassword } from "./overlays/NewPassword";
import { Signup } from "./overlays/Signup";
import { Welcome } from "./overlays/Welcome";
import { Guide } from "./screens/Guide";
import { guide } from "./lib/guide";
import { films as filmStore } from "./lib/films";
import { Settings } from "./overlays/Settings";
import { ShareSheet } from "./overlays/ShareSheet";
import { TicketSheet } from "./overlays/TicketSheet";
import { Tonight } from "./overlays/Tonight";
import { Credits } from "./screens/Credits";
import { Chest } from "./screens/Chest";
import { ChestDeck } from "./overlays/ChestDeck";
import { FilmEdit } from "./overlays/FilmEdit";
import { FilmPage } from "./screens/FilmPage";
import { FriendPage } from "./screens/FriendPage";
import { Home } from "./screens/Home";
import { Library } from "./screens/Library";
import { Diary } from "./screens/Diary";
import { Profile } from "./screens/Profile";
import { Search } from "./screens/Search";
import { Quiz } from "./screens/Quiz";
import { RateHome } from "./screens/RateHome";
import { Result } from "./screens/Result";
import { Details } from "./screens/Details";
import { cloud, useCloud } from "./lib/cloud";
import { fkey } from "./lib/films";
import { Analytics } from "@vercel/analytics/react";
import { UpdateSheet } from "./components/UpdateSheet";
import { PullRefresh } from "./components/PullRefresh";

// Ordem da barra flutuante.
const TABS: [Tab, string][] = [
  ["home", "Início"],
  ["search", "Buscar"],
  ["rate", "Avaliar"],
  ["lib", "Quero ver"],
  ["prof", "Você"],
];

function tabScreen(tab: Tab) {
  switch (tab) {
    case "rate":
      return <RateHome />;
    case "search":
      return <Search />;
    case "home":
      return <Home />;
    case "lib":
      return <Library />;
    case "prof":
      return <Profile />;
  }
}
function stackScreen(s: Screen, depth: number) {
  switch (s.k) {
    case "film":
      return <FilmPage key={`film-${depth}-${fkey(s.info)}`} info={s.info} />;
    case "credits":
      return <Credits key={`credits-${depth}`} info={s.info} />;
    case "chest":
      return <Chest key="chest" />;
    case "diary":
      return <Diary key="diary" />;
    case "guide":
      return <Guide key={`guide-${depth}`} />;
    case "friend":
      return <FriendPage key={`friend-${s.id}`} id={s.id} />;
    case "quiz":
      return (
        <Quiz
          key={`quiz-${depth}`}
          info={s.info}
          classic={s.classic}
          rewatch={s.rewatch}
          answers={s.answers}
          direct={s.direct}
          help={s.help}
        />
      );
    case "details":
      return (
        <Details
          key={`det-${depth}`}
          info={s.info}
          filmKey={s.key}
          base={s.base}
          classic={s.classic}
          rewatch={s.rewatch}
          replaced={s.replaced}
          answers={s.answers}
        />
      );
    case "result":
      return (
        <Result
          key={`res-${depth}`}
          info={s.info}
          filmKey={s.key}
          base={s.base}
          classic={s.classic}
          rewatch={s.rewatch}
          replaced={s.replaced}
          answers={s.answers}
        />
      );
  }
}
function overlayView(o: OverlayState, i: number) {
  switch (o.k) {
    case "reviews":
      return (
        <ReviewsPage
          key={i}
          info={o.info}
          focusId={o.focusId}
          known={o.known}
        />
      );
    case "editor":
      return <ReviewEditor key={i} filmKey={o.key} />;
    case "share":
      return <ShareSheet key={i} filmKey={o.key} />;
    case "editProfile":
      return <EditProfile key={i} />;
    case "addFriend":
      return <AddFriend key={i} />;
    case "settings":
      return <Settings key={i} />;
    case "newPassword":
      return <NewPassword key={i} />;
    case "signup":
      return <Signup key={i} />;
    case "welcome":
      return <Welcome key={i} />;
    case "ticket":
      return <TicketSheet key={i} filmKey={o.key} />;
    case "chestDeck":
      return <ChestDeck key={i} />;
    case "filmEdit":
      return <FilmEdit key={i} filmKey={o.key} />;
    case "tonight":
      return <Tonight key={i} start={o.start} />;
    case "recommend":
      return <Recommend key={i} info={o.info} />;
    case "guess":
      return <GuessGame key={i} friend={o.friend} films={o.films} />;
  }
}

const TAB_TITLE: Record<Tab, string> = {
  rate: "",
  search: "Buscar",
  home: "Início",
  lib: "Quero ver",
  prof: "Você",
};

/** Telas com "puxar para recarregar": Início, Quero ver, Diário, Perfil, página do filme e perfil do amigo. */
const PULL_MODES = new Set(["feed", "lib", "diary", "prof", "film", "friend"]);

export function App() {
  const { tab, stack, overlays, progress, from } = useNav();
  const soundOn = useSound();
  const account = useCloud();
  // Bolinhas nas abas: algo esperando a pessoa (indicação, convite de ingresso, pedido de amizade)
  const badge: Record<Tab, boolean> = {
    rate: false,
    search: false,
    home: account.tags.length > 0,
    lib: account.recs.length > 0,
    prof: account.friends.incoming.length > 0,
  };
  const [scrolled, setScrolled] = useState(false);
  // Link de "Esqueci minha senha": abre a tela de senha nova.
  // Link vencido: leva para o Perfil, onde aparece o aviso e dá para pedir outro.
  useEffect(() => {
    if (account.recovery) {
      cloud.recoveryShown();
      nav.home();
      nav.tab("prof");
      nav.open({ k: "newPassword" });
    } else if (account.linkError) {
      if (account.user) cloud.linkErrorShown();
      else nav.tab("prof");
    }
  }, [account.recovery, account.linkError, account.user]);
  // Primeira vez no app, sem conta e sem filmes: tela de boas-vindas (uma vez só)
  useEffect(() => {
    if (!account.checked || account.user || filmStore.all.length || !guide.welcomeDue()) return;
    guide.welcomeSeen();
    nav.open({ k: "welcome" });
  }, [account.checked, account.user]);
  // Conta recém-criada: assim que a pessoa sai do cadastro, começa a primeira nota guiada
  useEffect(() => {
    if (!account.user || overlays.length || !guide.pending()) return;
    guide.start();
  }, [account.user, overlays.length]);
  const top = stack[stack.length - 1];
  const main = !top;
  const rating =
    top?.k === "quiz" || top?.k === "details" || top?.k === "result" || top?.k === "guide";
  // Nome do "modo" da tela, usado pelo CSS para ajustar larguras e alinhamento
  const mode = top
    ? {
        film: "film",
        credits: "credits",
        chest: "chest",
        diary: "diary",
        guide: "guide",
        friend: "friend",
        quiz: "q",
        details: "det",
        result: "res",
      }[top.k]
    : { rate: "rate", search: "search", home: "feed", lib: "lib", prof: "prof" }[tab];
  const alignTop = mode !== "home" && mode !== "q" && mode !== "res";
  // Título que aparece na barra de cima quando a pessoa rola a tela
  const friend =
    top?.k === "friend"
      ? account.friends.list.find((p) => p.id === top.id)
      : null;
  const title = top
    ? top.k === "chest"
      ? "Baú da infância"
      : top.k === "diary"
      ? "Diário"
      : top.k === "film" || top.k === "credits"
        ? top.info.t
        : friend
          ? pname(friend)
          : ""
    : TAB_TITLE[tab];

  useEffect(() => {
    document.body.classList.toggle("tabs-on", !rating);
    document.body.classList.toggle("root", main);
  }, [rating, main]);

  const pressTab = (k: Tab) => {
    if (tab !== k || !main) return nav.tab(k);
    scroller()?.scrollTo({ top: 0, behavior: "smooth" }); // tocar na aba em que já está: volta ao topo
  };

  return (
    <>
      <div
        className="scroller"
        id="scroller"
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 48)}
      >
        <div className="app">
          <div className={`top${scrolled ? " solid" : ""}`}>
            <div className="topin">
              <button
                className={`back${main && !from ? " gone" : ""}`}
                id="back"
                aria-label="Voltar"
                onClick={() => nav.back()}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M15 5l-7 7 7 7" />
                </svg>
              </button>
              {top?.k === "quiz" && progress !== null ? (
                <div className="bar" id="bar">
                  <i id="fill" style={{ width: `${(progress ?? 1) * 100}%` }} />
                </div>
              ) : main && (tab === "rate" || tab === "home") ? (
                <div className="brand">
                  <img src="/logo.svg" alt="" width={30} height={30} />
                  Lanterninha
                </div>
              ) : (
                <b className="ttl">{title}</b>
              )}
              {rating && SOUND_ENABLED ? (
                <button
                  className={`snd${soundOn ? " on" : ""}`}
                  id="snd"
                  aria-label="Som"
                  onClick={() => {
                    sfx.toggle();
                  }}
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M4 9v6h4l5 4V5L8 9H4z" />
                    <path
                      className="w"
                      d="M16 8.2a5 5 0 0 1 0 7.6l-1.2-1.4a3.2 3.2 0 0 0 0-4.8L16 8.2zm2.6-2.6a8.7 8.7 0 0 1 0 12.8l-1.3-1.4a6.8 6.8 0 0 0 0-10l1.3-1.4z"
                    />
                    <path
                      className="x"
                      d="M16.2 9.4l1.4-1.4 2 2 2-2 1.4 1.4-2 2 2 2-1.4 1.4-2-2-2 2-1.4-1.4 2-2-2-2z"
                    />
                  </svg>
                </button>
              ) : main && tab === "prof" ? (
                <button
                  className="gear"
                  id="cfg"
                  aria-label="Configurações"
                  onClick={() => nav.open({ k: "settings" })}
                >
                  <GearIcon />
                </button>
              ) : (
                <span className="tsp" />
              )}
            </div>
          </div>
          <div
            className={`stage${alignTop ? " up" : ""}`}
            id="stage"
            data-mode={mode}
          >
            {top ? (
              stackScreen(top, stack.length)
            ) : (
              <div key={tab} style={{ display: "contents" }}>
                {tabScreen(tab)}
              </div>
            )}
          </div>
        </div>
      </div>
      <nav className={`tabs${rating ? " off" : ""}`} id="tabs">
        <div>
          {TABS.map(([k, label]) => (
            <button
              key={k}
              className={`tab${tab === k ? " on" : ""}${k === "rate" ? " mid" : ""}`}
              data-v={k}
              aria-label={label}
              aria-current={tab === k ? "page" : undefined}
              onClick={() => pressTab(k)}
            >
              <TabIcon tab={k} />
              {badge[k] && <i className="dot" />}
            </button>
          ))}
        </div>
      </nav>
      {/* Puxar para recarregar: nas telas que mostram coisas da internet */}
      <PullRefresh enabled={PULL_MODES.has(mode) && !overlays.length} />
      {overlays.map(overlayView)}
      <UpdateSheet />
      <Analytics />
    </>
  );
}
