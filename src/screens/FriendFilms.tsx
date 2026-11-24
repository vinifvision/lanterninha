// Filmes de um amigo: tudo o que ele viu, em grade, com a nota dele embaixo do pôster e,
// se você também viu, a sua num selinho em cima do pôster (dourado quando vocês deram a mesma nota).
// Abre pelo "N filmes" e pelo "Filmes" do perfil dele, ou pelo "Ver os N" do "viu, você não" (já nesse chip).
// Para não pesar com muitos filmes: desenha 60 pôsteres por vez e carrega mais ao chegar perto do fim.
import { useEffect, useRef } from 'react';
import { ChipMenu } from '../components/ChipMenu';
import { useAsync } from '../components/hooks';
import { Poster } from '../components/Poster';
import { cloud, useCloud } from '../lib/cloud';
import { fkey, isRated, useFilms } from '../lib/films';
import { fmt, pname } from '../lib/format';
import { useRefresh } from '../lib/refresh';
import type { Film } from '../lib/types';
import { nav, scroller, useKept } from '../nav';
import { byDiary } from './Diary';

type Show = 'all' | 'rated' | 'seen' | 'unseen';
type Sort = 'recent' | 'nota' | 'agree' | 'fight';

/** Quantos pôsteres entram de cada vez. */
const STEP = 60;

/** Texto sem acento e em minúsculas, para a busca achar "acao" em "Ação". */
const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Década do lançamento: "1994" → "1990". */
const decade = (h: Film) => (/^\d{4}/.test(h.y || '') ? h.y!.slice(0, 3) + '0' : '');
const decadeName = (d: string) => (+d < 2000 ? `Anos ${d.slice(2)}` : `Anos ${d}`);

/** Abre o filme: com nota, a review dele (mesmo que seja só a nota); sem nota, a página do filme. */
export function openFriendFilm(id: string, h: Film) {
  const { friends } = cloud.state;
  const p = friends.list.find((x) => x.id === id);
  if (p && isRated(h)) nav.open({ k: 'reviews', info: h, focusId: id, known: { p, f: h } });
  else nav.openFilm(h);
}

export function FriendFilms({ id, only }: { id: string; only?: 'unseen' }) {
  const { friends } = useCloud();
  const p = friends.list.find((x) => x.id === id);
  const mine = useFilms();
  const tick = useRefresh();
  const films = useAsync<Film[] | null>(() => cloud.friendWatched(id), [id, tick], true);
  const [show, setShow] = useKept<Show>('show', only || 'all');
  const [nota, setNota] = useKept('nota', ''); // '' = todas, '4.5' = só ★ 4,5
  const [dec, setDec] = useKept('dec', ''); // '' = todas, '1990' = anos 90
  const [sort, setSort] = useKept<Sort>('sort', 'recent');
  const [q, setQ] = useKept('q', '');
  const [limit, setLimit] = useKept('limit', STEP);
  const end = useRef<HTMLDivElement>(null);

  const all = films || [];
  // O que você viu (com ou sem nota), para o selinho e para o "Você não viu"
  const myMap = new Map(mine.filter((h) => h.st !== 'want').map((h) => [fkey(h), h] as const));
  const mineOf = (h: Film) => myMap.get(fkey(h));
  /** Diferença entre as notas, quando os dois deram nota. */
  const gap = (h: Film) => {
    const m = mineOf(h);
    return isRated(h) && isRated(m) ? Math.abs(h.s - m.s) : -1;
  };

  const scores = [...new Set(all.filter(isRated).map((h) => h.s))].sort((a, b) => b - a);
  const decades = [...new Set(all.map(decade).filter(Boolean))].sort((a, b) => +b - +a);
  const term = fold(q.trim());
  const list = all.filter((h) =>
    (show === 'all' || (show === 'rated' ? isRated(h) : show === 'seen' ? !isRated(h) : !mineOf(h))) &&
    (!nota || (isRated(h) && String(h.s) === nota)) &&
    (!dec || decade(h) === dec) &&
    (!term || fold(h.t).includes(term) || fold(h.o || '').includes(term)));
  if (sort === 'nota') list.sort((a, b) => (isRated(b) ? b.s : -1) - (isRated(a) ? a.s : -1) || byDiary(a, b));
  else if (sort === 'fight') list.sort((a, b) => gap(b) - gap(a) || byDiary(a, b));
  // Concordam: os que os dois deram nota, da menor diferença para a maior; o resto vai para o fim
  else if (sort === 'agree') list.sort((a, b) => (gap(a) < 0 ? 99 : gap(a)) - (gap(b) < 0 ? 99 : gap(b)) || byDiary(a, b));
  else list.sort(byDiary);
  const more = list.length > limit;

  // Quando o fim da grade chega perto da tela, desenha mais 60. Refaz o observador a cada leva:
  // se o fim continuar visível (tela grande), ele já pede a próxima.
  useEffect(() => {
    const el = end.current;
    if (!el || !more) return;
    const io = new IntersectionObserver((es) => { if (es[0]?.isIntersecting) setLimit((n) => n + STEP); }, {
      root: scroller(),
      rootMargin: '0px 0px 700px 0px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, [more, limit, films]);

  if (!p) return <div className="screen"><p className="empty">Essa pessoa não está mais na sua lista de amigos.</p></div>;
  const name = pname(p);
  const first = name.split(' ')[0];

  /** Trocar um filtro volta para os primeiros 60. */
  const pick = <T,>(set: (v: T) => void) => (v: T) => { set(v); setLimit(STEP); };
  const chip = (v: Show, label: string) => (
    <button role="tab" aria-selected={show === v} className={show === v ? 'on' : ''} onClick={() => pick(setShow)(v)}>{label}</button>
  );
  const rated = all.filter(isRated).length;
  const both = all.some((h) => gap(h) >= 0);
  const empty = !all.length
    ? `${first} ainda não marcou nenhum filme.`
    : term || nota || dec ? 'Nenhum filme com esse filtro.'
    : show === 'unseen' ? `Você já viu tudo que ${first} viu.`
    : show === 'seen' ? `${first} deu nota em todos os filmes que viu.`
    : 'Nenhum filme aqui ainda.';

  // Só os 16 primeiros entram com animação, para não pesar.
  const cell = (h: Film, i: number) => {
    const m = mineOf(h);
    const same = isRated(h) && isRated(m) && m.s === h.s;
    return (
      <button
        key={fkey(h)} className={`v2dcell${i < 16 ? ' in' : ''}`}
        style={i < 16 ? { animationDelay: `${i * 22}ms` } : undefined} onClick={() => openFriendFilm(id, h)}
      >
        <span className="v2dcpos">
          <Poster img={h.img} title={h.t} />
          {m && (
            <i className={`v2ffme${same ? ' eq' : ''}`} aria-label={isRated(m) ? `Sua nota: ${fmt(m.s)}` : 'Você viu'}>
              {isRated(m) ? <>Você <b>★ {fmt(m.s)}</b></> : 'Você viu'}
            </i>
          )}
        </span>
        <small className="v2dcnote">
          {isRated(h) ? '★ ' + fmt(h.s) : <span className="v2ffseen">Já vi</span>}
          {(h.note || '').trim() && (
            <svg viewBox="0 0 24 24" aria-label="Tem review"><path d="M5 5h14v10H9l-4 4z" /></svg>
          )}
        </small>
      </button>
    );
  };

  return (
    <div className="screen v2fr">
      <h1 className="v2frtitle">Filmes de {name}</h1>
      {films && all.length > 0 && (
        <p className="v2ffsub">{all.length} {all.length === 1 ? 'visto' : 'vistos'} · {rated} com nota</p>
      )}
      <div className="v2chips" role="tablist">
        {chip('all', 'Todos')}
        {chip('rated', 'Com nota')}
        {chip('seen', 'Só viu')}
        {chip('unseen', 'Você não viu')}
      </div>
      {all.length > 0 && (
        <div className="v2dflt">
          {scores.length > 0 && show !== 'seen' && (
            <ChipMenu
              label="Nota" value={nota} onChange={pick(setNota)} chip="Nota"
              options={[{ value: '', label: 'Todas as notas' }, ...scores.map((s) => ({ value: String(s), label: `★ ${fmt(s)}` }))]}
            />
          )}
          {decades.length > 1 && (
            <ChipMenu
              label="Década" value={dec} onChange={pick(setDec)} chip="Década"
              options={[{ value: '', label: 'Todas as décadas' }, ...decades.map((d) => ({ value: d, label: decadeName(d) }))]}
            />
          )}
          <ChipMenu<Sort>
            label="Ordenar" value={sort} onChange={pick(setSort)}
            options={[
              { value: 'recent', label: 'Mais recentes' },
              { value: 'nota', label: 'Maior nota' },
              ...(both ? [
                { value: 'agree' as Sort, label: 'Onde vocês concordam' },
                { value: 'fight' as Sort, label: 'Onde vocês discordam' },
              ] : []),
            ]}
          />
        </div>
      )}
      {all.length > 0 && (
        <div className="v2find">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            type="search" aria-label="Buscar" maxLength={80} value={q} placeholder={`Buscar nos filmes de ${first}`}
            autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="search" onChange={(e) => pick(setQ)(e.target.value)}
          />
          {q && <button type="button" className="v2clr" aria-label="Apagar" onClick={() => pick(setQ)('')}>✕</button>}
        </div>
      )}
      {films === undefined && <p className="empty">Carregando os filmes…</p>}
      {films === null && <p className="empty">Não consegui carregar os filmes agora.</p>}
      {films && list.length === 0 && <p className="empty">{empty}</p>}
      <div className="v2ffgrid">{list.slice(0, limit).map(cell)}</div>
      {more && <div ref={end} className="v2ffend" aria-hidden="true" />}
    </div>
  );
}
