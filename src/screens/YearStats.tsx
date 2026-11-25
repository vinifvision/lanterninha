// "2026 em filmes": as estatísticas do ano, no estilo das do Letterboxd. Abre pelo cartão "Seu 2026" no perfil.
// Tudo é tocável: um mês, uma nota, um gênero ou uma década abrem os filmes; diretor e ator abrem a página da pessoa.
import { useState } from 'react';
import { Poster } from '../components/Poster';
import { isRated, useFilms } from '../lib/films';
import { fmt, MONTHS } from '../lib/format';
import { diaryYears, filmsOfYear, goalPace, marks, NOTES, useFacts, useGoal, yearStats, type Rank, type Ranks } from '../lib/stats';
import type { Film } from '../lib/types';
import { nav, useKept } from '../nav';
import { byDiary } from './Diary';

const WHERE = { cine: 'No cinema', casa: 'Em casa', outro: 'Outro lugar' } as const;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function YearStats({ year }: { year: string }) {
  const all = useFilms();
  const years = diaryYears(all);
  const [y, setY] = useKept('ano', year);
  const films = filmsOfYear(all, y);
  const ids = films.filter((h) => h.id).map((h) => h.id!);
  const { facts, done, total, loading } = useFacts(ids);
  const st = yearStats(films, facts);

  /**
   * Abre a grade com os filmes escolhidos (do mais recente para o mais antigo).
   * `em` é o pedaço do título que fica dourado (ex.: "★ 3,5" em "★ 3,5 em 2026").
   */
  const show = (title: string, em: string, list: Film[], extra?: { sub?: string; group?: 'nota' }) => {
    if (list.length) nav.push({ k: 'filmGrid', title, em, films: [...list].sort(byDiary), ...extra });
  };
  const person = (r: Rank) => nav.push({ k: 'person', kind: 'person', id: r.key as number, name: r.label });

  if (!films.length) {
    return (
      <div className="screen v2yr">
        <h1 className="v2yrtitle">{y} <em>em filmes</em></h1>
        <p className="empty">Nenhum filme no diário em {y}.</p>
      </div>
    );
  }

  // Empate: todos os campeões ficam dourados e entram na frase
  const maxMonth = Math.max(...st.months.map((m) => m.length));
  const bestMonths = MONTHS.filter((_, i) => st.months[i].length === maxMonth);
  const maxNote = Math.max(1, ...st.notes.map((l) => l.length));
  const bestNotes = NOTES.filter((_, i) => st.notes[i].length === maxNote).map((s) => '★ ' + fmt(s));
  const withWhere = st.where.reduce((t, w) => t + w.films.length, 0);
  const rated = films.filter(isRated);

  return (
    <div className="screen v2yr">
      <h1 className="v2yrtitle">{y} <em>em filmes</em></h1>

      {years.length > 1 && (
        <div className="v2chips" role="tablist" aria-label="Ano">
          {years.map((a) => (
            <button key={a} role="tab" aria-selected={a === y} className={a === y ? 'on' : ''} onClick={() => setY(a)}>{a}</button>
          ))}
        </div>
      )}

      <div className="v2ynums">
        <button type="button" onClick={() => show(`Seus filmes de ${y}`, y, films)}>
          <b>{st.count}</b><span>{st.count === 1 ? 'filme' : 'filmes'}</span>
        </button>
        <div>
          <b>{st.hours || (loading ? '…' : '–')}</b><span>{st.hours === 1 ? 'hora' : 'horas'}</span>
        </div>
        <button type="button" disabled={!st.reviews} onClick={() => nav.push({ k: 'myReviews', year: y })}>
          <b>{st.reviews}</b><span>{st.reviews === 1 ? 'review' : 'reviews'}</span>
        </button>
        <button type="button" disabled={!rated.length} onClick={() => show(`Suas notas em ${y}`, y, rated, { group: 'nota' })}>
          <b className="g">{st.avg ? '★ ' + fmt(Math.round(st.avg * 10) / 10) : '–'}</b><span>nota média</span>
        </button>
      </div>

      <Goal key={y} year={y} count={st.count} />

      {loading && (
        <div className="v2yload" role="status">
          <span>Buscando horas, gêneros e elenco… {done}/{total}</span>
          <i><b style={{ width: `${(done / Math.max(1, total)) * 100}%` }} /></i>
        </div>
      )}

      <section className="v2yc" aria-label="Mês a mês">
        <h2>Mês a mês</h2>
        <p>
          {bestMonths.length === 1
            ? `${bestMonths[0]} foi o seu mês mais cheio: ${plural(maxMonth, 'filme', 'filmes')}.`
            : `${join(bestMonths)} foram os seus meses mais cheios: ${plural(maxMonth, 'filme', 'filmes')} cada.`}
        </p>
        <div className="v2bars v2ytap">
          {st.months.map((m, i) => (
            <button key={i} type="button" disabled={!m.length} aria-label={`${MONTHS[i]}: ${plural(m.length, 'filme', 'filmes')}`}
              onClick={() => show(`${MONTHS[i]} de ${y}`, MONTHS[i], m)}>
              {m.length > 0 && <em>{m.length}</em>}
              <span className={m.length === maxMonth ? 'on' : m.length ? '' : 'z'} style={{ height: m.length ? 8 + Math.round((m.length / maxMonth) * 64) : 4 }} />
              <small>{MONTHS[i][0]}</small>
            </button>
          ))}
        </div>
      </section>

      <Marks films={films} year={y} show={show} />

      {rated.length > 0 && (
        <section className="v2yc" aria-label="Suas notas">
          <h2>Suas notas</h2>
          <p>
            {bestNotes.length === 1 ? 'A nota que você mais deu foi ' : 'As notas que você mais deu foram '}
            <b className="g">{join(bestNotes)}</b>, {plural(maxNote, 'vez', 'vezes')}{bestNotes.length > 1 ? ' cada' : ''}.
          </p>
          <div className="v2bars v2ytap v2ynotes">
            {st.notes.map((l, i) => (
              <button key={i} type="button" disabled={!l.length} aria-label={`★ ${fmt(NOTES[i])}: ${plural(l.length, 'filme', 'filmes')}`}
                onClick={() => show(`★ ${fmt(NOTES[i])} em ${y}`, `★ ${fmt(NOTES[i])}`, l)}>
                {l.length > 0 && <em>{l.length}</em>}
                <span className={l.length === maxNote ? 'on' : l.length ? '' : 'z'} style={{ height: l.length ? 8 + Math.round((l.length / maxNote) * 64) : 4 }} />
                <small>{NOTES[i] % 1 ? '' : NOTES[i]}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {(st.contra.above.length > 0 || st.contra.below.length > 0) && (
        <section className="v2yc" aria-label="Do contra">
          <h2>Do contra</h2>
          <p>Onde a sua nota mais fugiu da nota do público (TMDB).</p>
          {st.contra.above.length > 0 && <Contra title="Você gostou mais que todo mundo" list={st.contra.above} />}
          {st.contra.below.length > 0 && <Contra title="Todo mundo gostou, você não" list={st.contra.below} />}
        </section>
      )}

      <RankSection id="gen" title="Gêneros" data={st.genres} onPick={(r) => show(`${r.label} em ${y}`, r.label, r.films)} />
      <RankSection id="dir" title="Diretores" data={st.directors} onPick={person} />
      <RankSection id="atr" title="Atores" data={st.actors} onPick={person} />

      {st.decades.length > 0 && (
        <section className="v2yc" aria-label="Décadas">
          <h2>De que época</h2>
          <Rows items={st.decades} onPick={(r) => show(r.label, r.label, r.films, { sub: `${plural(r.n, 'filme visto', 'filmes vistos')} em ${y}` })} />
        </section>
      )}

      {withWhere > 0 && (
        <section className="v2yc" aria-label="Onde você viu">
          <h2>Onde você viu</h2>
          <div className="v2ywbar" aria-hidden="true">
            {st.where.map((w) => w.films.length > 0 && <i key={w.key} className={w.key} style={{ flex: w.films.length }} />)}
          </div>
          <div className="v2ywleg">
            {st.where.map((w) => w.films.length > 0 && (
              <button key={w.key} type="button" onClick={() => show(`${WHERE[w.key]} em ${y}`, WHERE[w.key], w.films)}>
                <i className={w.key} aria-hidden="true" />{WHERE[w.key]}<em>{w.films.length}</em>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="v2yc" aria-label="Destaques">
        <h2>Destaques</h2>
        <div className="v2yhl">
          {st.best && <Highlight label="Maior nota" h={st.best} note={'★ ' + fmt(st.best.s)} />}
          {st.first && <Highlight label="Primeiro do ano" h={st.first} />}
          {st.last && st.last !== st.first && <Highlight label="O mais recente" h={st.last} />}
        </div>
      </section>
    </div>
  );
}

/** "A, B e C" */
const join = (l: string[]) => (l.length > 1 ? l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1] : l[0] || '');

/**
 * Um bloco com "Mais vistos" e "Maior nota" (a média das suas notas, com 2 notas ou mais).
 * A escolha fica guardada ao abrir um filme e voltar.
 */
function RankSection({ id, title, data, onPick }: { id: string; title: string; data: Ranks; onPick: (r: Rank) => void }) {
  const [mode, setMode] = useKept<'seen' | 'liked'>('rk-' + id, 'seen');
  const m = data.liked.length ? mode : 'seen';
  if (!data.seen.length && !data.liked.length) return null;
  const liked = m === 'liked';
  const items = liked ? data.liked : data.seen;
  return (
    <section className="v2yc" aria-label={title}>
      <div className="v2ych">
        <h2>{title}</h2>
        {data.liked.length > 0 && data.seen.length > 0 && (
          <div className="v2yseg" role="tablist" aria-label={`Ordem de ${title.toLowerCase()}`}>
            <button role="tab" aria-selected={!liked} className={!liked ? 'on' : ''} onClick={() => setMode('seen')}>Mais vistos</button>
            <button role="tab" aria-selected={liked} className={liked ? 'on' : ''} onClick={() => setMode('liked')}>Maior nota</button>
          </div>
        )}
      </div>
      {liked && <p>A média das suas notas, com pelo menos 2 filmes.</p>}
      {items.length ? (
        <Rows
          key={m} items={items} onPick={onPick}
          value={liked ? (r) => '★ ' + fmt(Math.round(r.avg * 10) / 10) : (r) => String(r.n)}
          size={liked ? (r) => r.avg : (r) => r.n}
        />
      ) : (
        <p>Ninguém aparece em 2 filmes ou mais ainda.</p>
      )}
    </section>
  );
}

/** Lista com barrinhas. Quem tem o maior valor (todos, se empatar) fica dourado. */
function Rows({ items, onPick, value = (r) => String(r.n), size = (r) => r.n }: {
  items: Rank[];
  onPick: (r: Rank) => void;
  value?: (r: Rank) => string;
  size?: (r: Rank) => number;
}) {
  const max = Math.max(0.0001, ...items.map(size));
  return (
    <div className="v2yrows">
      {items.map((r, i) => (
        <button key={String(r.key)} type="button" style={{ animationDelay: `${i * 40}ms` }} onClick={() => onPick(r)}>
          <span className="l">{r.label}</span>
          <em className={size(r) === max ? 'on' : ''}>{value(r)}</em>
          <span className="b"><i className={size(r) === max ? 'on' : ''} style={{ width: `${Math.max(6, (size(r) / max) * 100)}%` }} /></span>
        </button>
      ))}
    </div>
  );
}

const PRESETS: [number, string][] = [[52, '1 por semana'], [100, ''], [150, ''], [200, ''], [365, '1 por dia']];

/**
 * Meta do ano: sem meta, um convite para definir; com meta, o anel de progresso, se está no ritmo
 * e quanto falta por semana. Tocar no anel deixa mudar a meta (dá para digitar o número).
 */
function Goal({ year, count }: { year: string; count: number }) {
  const { goal, save, err } = useGoal(year);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState('');
  const pace = goalPace(year, count, goal || 1);
  const past = pace.past;
  // Ano que já acabou e não tinha meta: não tem o que mostrar
  if (!goal && past && !edit) return null;

  const n = Math.min(9999, parseInt(draft, 10) || 0);
  const open = () => { setDraft(String(goal || 100)); setEdit(true); };
  const done = (v: number) => { void save(v); setEdit(false); };
  const step = (d: number) => setDraft(String(Math.max(1, Math.min(9999, n + d))));

  if (edit) {
    return (
      <section className="v2yc v2ygoal" aria-label={`Meta de ${year}`}>
        <h2>Quantos filmes em {year}?</h2>
        <div className="v2ystep">
          <button type="button" aria-label="Menos" onClick={() => step(-1)}>−</button>
          <input
            type="text" inputMode="numeric" pattern="[0-9]*" maxLength={4} aria-label="Meta de filmes"
            value={draft} onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyDown={(e) => e.key === 'Enter' && n > 0 && done(n)}
          />
          <button type="button" aria-label="Mais" onClick={() => step(1)}>+</button>
        </div>
        <p className="v2yhint">Toque no número para digitar.</p>
        <div className="v2ypre">
          {PRESETS.map(([v, t]) => (
            <button key={v} type="button" className={n === v ? 'on' : ''} onClick={() => setDraft(String(v))}>
              {v}{t && <small>{t}</small>}
            </button>
          ))}
        </div>
        <div className="v2yact">
          {goal > 0 && <button type="button" className="bad" onClick={() => done(0)}>Tirar meta</button>}
          <button type="button" onClick={() => setEdit(false)}>Cancelar</button>
          <button type="button" className="ok" disabled={!n} onClick={() => done(n)}>Salvar</button>
        </div>
      </section>
    );
  }

  if (!goal) {
    return (
      <button type="button" className="v2yc v2ygoal v2ynew" onClick={open}>
        <span>
          <b>Meta de {year}</b>
          <small>Quantos filmes você quer ver este ano?</small>
        </span>
        <i aria-hidden="true">Definir</i>
      </button>
    );
  }

  const pct = Math.min(1, count / goal);
  // Um selinho curto com a situação e, embaixo, uma frase só
  const chip = pace.done ? ['Meta batida', 'up']
    : past ? ['Não deu', 'down']
    : pace.ahead > 0 ? [`${pace.ahead} à frente do ritmo`, 'up']
    : pace.ahead < 0 ? [`${-pace.ahead} atrás do ritmo`, 'down']
    : ['No ritmo', 'up'];
  const line = pace.done ? (count > goal ? `${plural(count - goal, 'filme', 'filmes')} além da meta.` : '')
    : past ? `Faltaram ${plural(pace.left, 'filme', 'filmes')}.`
    : `Faltam ${pace.left}: ${pace.need}.`;

  return (
    <>
      <button type="button" className={`v2yc v2ygoal${pace.done ? ' done' : ''}`} aria-label={`Meta de ${year}: ${count} de ${goal}. Tocar para mudar`} onClick={open}>
        <span className="v2yring">
          <svg viewBox="0 0 70 70" aria-hidden="true">
            <circle cx="35" cy="35" r="31" className="bg" />
            <circle cx="35" cy="35" r="31" className="fg" strokeDasharray={`${pct * 195} 195`} transform="rotate(-90 35 35)" />
          </svg>
          <b>{Math.round(pct * 100)}%</b>
        </span>
        <span className="v2ygt2">
          <small>Meta de {year}</small>
          <b>{count} <em>de {goal}</em></b>
          <i className={chip[1]}>{chip[0]}</i>
          {line && <span>{line}</span>}
        </span>
      </button>
      {err && <p className="fmsg bad">{err}</p>}
    </>
  );
}

const WEEK = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
/** "3 de março" */
const dayText = (d: string) => `${+d.slice(8, 10)} de ${MONTHS[+d.slice(5, 7) - 1].toLowerCase()}`;
/** "3 a 8 de março" ou "28 de fevereiro a 2 de março" */
const rangeText = (a: string, b: string) =>
  a.slice(5, 7) === b.slice(5, 7) ? `${+a.slice(8, 10)} a ${dayText(b)}` : `${dayText(a)} a ${dayText(b)}`;

type Show = (title: string, em: string, list: Film[], extra?: { sub?: string }) => void;

/** Marcos e sequências: maior sequência, sequência de agora, maratona, dia favorito e os filmes de número redondo. */
function Marks({ films, year, show }: { films: Film[]; year: string; show: Show }) {
  const m = marks(films, year);
  const maxWeek = Math.max(...m.week.map((l) => l.length));
  const fav = m.week.findIndex((l) => l.length === maxWeek);
  if (!m.streak && !m.current && !m.marathon && !m.milestones.length && !maxWeek) return null;
  const tiles = [
    m.current && {
      k: 'cur', label: 'Sequência atual', big: plural(m.current.len, 'dia', 'dias'), fire: true,
      sub: m.current.seenToday ? 'Você já viu hoje' : 'Veja um hoje para não perder',
      open: () => show(`${m.current!.len} dias seguidos`, `${m.current!.len} dias`, m.current!.films),
    },
    m.streak && {
      k: 'best', label: 'Maior sequência', big: plural(m.streak.len, 'dia', 'dias'),
      sub: rangeText(m.streak.from, m.streak.to),
      open: () => show(`${m.streak!.len} dias seguidos`, `${m.streak!.len} dias`, m.streak!.films, { sub: rangeText(m.streak!.from, m.streak!.to) }),
    },
    m.marathon && {
      k: 'mar', label: 'Dia de maratona', big: plural(m.marathon.films.length, 'filme', 'filmes'),
      sub: dayText(m.marathon.day),
      open: () => show(`Maratona de ${dayText(m.marathon!.day)}`, dayText(m.marathon!.day), m.marathon!.films),
    },
  ].filter(Boolean) as { k: string; label: string; big: string; sub: string; fire?: boolean; open: () => void }[];

  return (
    <section className="v2yc" aria-label="Marcos e sequências">
      <h2>Marcos e sequências</h2>
      {tiles.length > 0 && (
        <div className="v2ytiles">
          {tiles.map((t) => (
            <button key={t.k} type="button" className={t.fire ? 'fire' : ''} onClick={t.open}>
              <small>{t.label}</small>
              <b>{t.big}</b>
              <span>{t.sub}</span>
            </button>
          ))}
        </div>
      )}

      {maxWeek > 0 && (
        <>
          <p className="v2yfav">Seu dia de cinema é <b>{WEEK[fav].toLowerCase()}</b>.</p>
          <div className="v2bars v2ytap v2yweek">
            {m.week.map((l, i) => (
              <button key={i} type="button" disabled={!l.length} aria-label={`${WEEK[i]}: ${plural(l.length, 'filme', 'filmes')}`}
                onClick={() => show(`${WEEK[i]}s de ${year}`, `${WEEK[i]}s`, l)}>
                {l.length > 0 && <em>{l.length}</em>}
                <span className={l.length === maxWeek ? 'on' : l.length ? '' : 'z'} style={{ height: l.length ? 6 + Math.round((l.length / maxWeek) * 44) : 4 }} />
                <small>{WEEK[i][0]}</small>
              </button>
            ))}
          </div>
        </>
      )}

      {m.milestones.length > 0 && (
        <div className="v2ymiles" aria-label="Marcos do ano">
          {m.milestones.map(({ n, h }) => (
            <button key={n} type="button" onClick={() => nav.openFilm(h)}>
              <span className="v2dcpos"><Poster img={h.img} title={h.t} /><i>{n}º</i></span>
              <small>{h.d ? dayText(h.d) : ''}</small>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/** Os filmes do "Do contra": pôster, sua nota, a do público e a diferença. */
function Contra({ title, list }: { title: string; list: { h: Film; pub: number; gap: number }[] }) {
  const one = (n: number) => fmt(Math.round(n * 10) / 10);
  return (
    <div className="v2yct">
      <h3>{title}</h3>
      {list.map(({ h, pub, gap }) => (
        <button key={h.id || h.t} type="button" onClick={() => nav.openFilm(h)}>
          <span className="v2dcpos"><Poster img={h.img} title={h.t} size="w92" /></span>
          <span className="t">
            <b>{h.t}</b>
            <small><em>Você ★ {isRated(h) ? fmt(h.s) : ''}</em><span>Público ★ {one(pub)}</span></small>
          </span>
          <i className={gap > 0 ? 'up' : 'down'}>{gap > 0 ? '+' : '−'}{one(Math.abs(gap))}</i>
        </button>
      ))}
    </div>
  );
}

function Highlight({ label, h, note }: { label: string; h: Film; note?: string }) {
  return (
    <button type="button" onClick={() => nav.openFilm(h)}>
      <span className="v2dcpos"><Poster img={h.img} title={h.t} /></span>
      <small>{label}</small>
      <b>{note || h.t}</b>
    </button>
  );
}
