// A moldura do app: barra de cima, a tela atual, as abas e o que estiver aberto por cima.
import { useEffect, useState } from 'react';
import { TAB_ICONS } from './components/icons';
import { sfx, useSound } from './lib/sfx';
import { pname } from './lib/format';
import { nav, scroller, useNav, type Overlay as OverlayState, type Screen, type Tab } from './nav';
import { AddFriend } from './overlays/AddFriend';
import { EditProfile } from './overlays/EditProfile';
import { GuessGame } from './overlays/GuessGame';
import { Recommend } from './overlays/Recommend';
import { ReviewEditor } from './overlays/ReviewEditor';
import { ReviewsPage } from './overlays/ReviewsPage';
import { ShareSheet } from './overlays/ShareSheet';
import { FilmPage } from './screens/FilmPage';
import { FriendPage } from './screens/FriendPage';
import { Home } from './screens/Home';
import { Library } from './screens/Library';
import { Profile } from './screens/Profile';
import { Quiz } from './screens/Quiz';
import { RateHome } from './screens/RateHome';
import { Result } from './screens/Result';
import { useCloud } from './lib/cloud';
import { fkey } from './lib/films';

const TABS: [Tab, string][] = [['rate', 'Avaliar'], ['home', 'Início'], ['lib', 'Meus filmes'], ['prof', 'Perfil']];

function tabScreen(tab: Tab) {
  switch (tab) {
    case 'rate': return <RateHome />;
    case 'home': return <Home />;
    case 'lib': return <Library />;
    case 'prof': return <Profile />;
  }
}
function stackScreen(s: Screen, depth: number) {
  switch (s.k) {
    case 'film': return <FilmPage key={`film-${depth}-${fkey(s.info)}`} info={s.info} />;
    case 'friend': return <FriendPage key={`friend-${s.id}`} id={s.id} />;
    case 'quiz': return <Quiz key={`quiz-${depth}`} info={s.info} classic={s.classic} rewatch={s.rewatch} answers={s.answers} />;
    case 'result': return <Result key={`res-${depth}`} info={s.info} filmKey={s.key} base={s.base} classic={s.classic} rewatch={s.rewatch} replaced={s.replaced} answers={s.answers} />;
  }
}
function overlayView(o: OverlayState, i: number) {
  switch (o.k) {
    case 'reviews': return <ReviewsPage key={i} info={o.info} focusId={o.focusId} known={o.known} />;
    case 'editor': return <ReviewEditor key={i} filmKey={o.key} />;
    case 'share': return <ShareSheet key={i} filmKey={o.key} />;
    case 'editProfile': return <EditProfile key={i} />;
    case 'addFriend': return <AddFriend key={i} />;
    case 'recommend': return <Recommend key={i} info={o.info} />;
    case 'guess': return <GuessGame key={i} friend={o.friend} films={o.films} />;
  }
}

const TAB_TITLE: Record<Tab, string> = { rate: '', home: 'Início', lib: 'Meus filmes', prof: 'Perfil' };

export function App() {
  const { tab, stack, overlays, progress } = useNav();
  const soundOn = useSound();
  const account = useCloud();
  const hasRecs = account.recs.length > 0;
  const [scrolled, setScrolled] = useState(false);
  const top = stack[stack.length - 1];
  const main = !top;
  const rating = top?.k === 'quiz' || top?.k === 'result';
  // Nome do "modo" da tela, usado pelo CSS para ajustar larguras e alinhamento
  const mode = top ? { film: 'film', friend: 'friend', quiz: 'q', result: 'res' }[top.k] : { rate: 'home', home: 'feed', lib: 'lib', prof: 'prof' }[tab];
  const alignTop = mode !== 'home' && mode !== 'q' && mode !== 'res';
  // Título que aparece na barra de cima quando a pessoa rola a tela
  const friend = top?.k === 'friend' ? account.friends.list.find((p) => p.id === top.id) : null;
  const title = top ? (top.k === 'film' ? top.info.t : friend ? pname(friend) : '') : TAB_TITLE[tab];

  useEffect(() => {
    document.body.classList.toggle('tabs-on', !rating);
    document.body.classList.toggle('root', main);
  }, [rating, main]);

  const pressTab = (k: Tab) => {
    if (tab !== k || !main) return nav.tab(k);
    scroller()?.scrollTo({ top: 0, behavior: 'smooth' }); // tocar na aba em que já está: volta ao topo
  };

  return (
    <>
      <div className="scroller" id="scroller" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 48)}>
        <div className="app">
          <div className={`top${scrolled ? ' solid' : ''}`}>
            <div className="topin">
              <button className={`back${main ? ' gone' : ''}`} id="back" aria-label="Voltar" onClick={() => nav.back()}>
                <svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg>
              </button>
              {top?.k === 'quiz'
                ? <div className="bar" id="bar"><i id="fill" style={{ width: `${(progress ?? 1) * 100}%` }} /></div>
                : main && tab === 'rate'
                  ? <div className="brand"><img src="/logo.svg" alt="" width={30} height={30} />Lanterninha</div>
                  : <b className="ttl">{title}</b>}
              {rating ? (
                <button className={`snd${soundOn ? ' on' : ''}`} id="snd" aria-label="Som" onClick={() => { sfx.toggle(); }}>
                  <svg viewBox="0 0 24 24">
                    <path d="M4 9v6h4l5 4V5L8 9H4z" />
                    <path className="w" d="M16 8.2a5 5 0 0 1 0 7.6l-1.2-1.4a3.2 3.2 0 0 0 0-4.8L16 8.2zm2.6-2.6a8.7 8.7 0 0 1 0 12.8l-1.3-1.4a6.8 6.8 0 0 0 0-10l1.3-1.4z" />
                    <path className="x" d="M16.2 9.4l1.4-1.4 2 2 2-2 1.4 1.4-2 2 2 2-1.4 1.4-2-2-2 2-1.4-1.4 2-2-2-2z" />
                  </svg>
                </button>
              ) : <span className="tsp" />}
            </div>
          </div>
          <div className={`stage${alignTop ? ' up' : ''}`} id="stage" data-mode={mode}>
            {top ? stackScreen(top, stack.length) : <div key={tab} style={{ display: 'contents' }}>{tabScreen(tab)}</div>}
          </div>
        </div>
      </div>
      <nav className={`tabs${rating ? ' off' : ''}`} id="tabs">
        <div>
          {TABS.map(([k, label]) => (
            <button key={k} className={`tab${tab === k ? ' on' : ''}`} data-v={k} onClick={() => pressTab(k)}>
              <svg viewBox="0 0 24 24"><path d={TAB_ICONS[k]} /></svg>{label}
              {k === 'lib' && hasRecs && <i className="dot" />}
            </button>
          ))}
        </div>
      </nav>
      {overlays.map(overlayView)}
    </>
  );
}
