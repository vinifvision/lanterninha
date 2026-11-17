// Baú da infância: os filmes de sucesso de quando você tinha de 4 a 14 anos, sempre aqui para relembrar.
import { useEffect, useState } from 'react';
import { FilmCard } from '../components/FilmCard';
import { Poster } from '../components/Poster';
import { chest, cloud, useChest, useCloud } from '../lib/cloud';
import { childhoodRange, useChestList } from '../lib/chestList';
import { fkey } from '../lib/films';
import { pname } from '../lib/format';
import { nav } from '../nav';

const MIN_CARD = 20;

export function Chest() {
  const data = useChest();
  const [editing, setEditing] = useState(false);
  if (!data.born || editing) return <BornAsk current={data.born} onDone={() => setEditing(false)} />;
  return <ChestBody onChangeYear={() => setEditing(true)} />;
}

/** Pergunta o ano de nascimento: só serve para escolher os filmes. */
function BornAsk({ current, onDone }: { current?: number; onDone: () => void }) {
  const now = new Date().getFullYear();
  const [year, setYear] = useState(current || now - 22);
  const years = Array.from({ length: now - 6 - 1940 + 1 }, (_, i) => now - 6 - i);
  const r = childhoodRange(year);
  return (
    <div className="screen chest">
      <div className="chhead">
        <span className="chicon" aria-hidden="true" />
        <span className="eyebrow">Baú da infância</span>
        <h1>Em que ano você nasceu?</h1>
        <p>Com isso a gente separa os filmes que fizeram sucesso quando você era criança. Esse dado não aparece no seu perfil.</p>
      </div>
      <label className="lbl" htmlFor="born">Ano de nascimento</label>
      <select id="born" className="chsel" value={year} onChange={(e) => setYear(Number(e.target.value))}>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <p className="setnote" style={{ marginTop: 10 }}>Filmes de {r.from} a {r.to}</p>
      <button className="cta" id="chgo" onClick={() => { chest.setBorn(year); chest.dismissHint(); onDone(); }}>Abrir o baú</button>
    </div>
  );
}

function ChestBody({ onChangeYear }: { onChangeYear: () => void }) {
  const st = useChestList();
  if (!st) return null;
  const n = st.remembered.length;
  const total = Math.max(st.list.length, n);
  return (
    <div className="screen chest">
      <div className="chhead">
        <span className="chicon" aria-hidden="true" />
        <span className="eyebrow">Baú da infância</span>
        <h1>Os filmes de quando você era criança</h1>
        <p>De {st.from} a {st.to}</p>
      </div>

      <div className="chprog" id="chprog">
        <b>{n === 0 ? 'Nenhum filme lembrado ainda' : n === 1 ? 'Você lembrou de 1 filme' : `Você lembrou de ${n} filmes`}</b>
        {total > 0 && <div className="bar"><i style={{ width: `${Math.min(100, (n / total) * 100)}%` }} /></div>}
      </div>
      <button className="cta" id="chquick" disabled={!st.ready || !st.pending.length} onClick={() => nav.open({ k: 'chestDeck' })}>
        {!st.ready ? 'Abrindo o baú…' : st.pending.length ? 'Relembrar rápido' : 'Você já passou por todos'}
      </button>
      {st.failed && <p className="empty">Não consegui abrir o baú agora. Tente de novo mais tarde.</p>}

      {n >= MIN_CARD && <ChildhoodCard />}

      {n > 0 && (
        <section className="hsec" style={{ marginTop: 28 }}>
          <div className="sech"><h3>Você lembrou</h3></div>
          <div className="grid">{st.remembered.map((h, i) => <FilmCard key={fkey(h)} film={h} delay={Math.min(i, 12) * 25} onClick={() => nav.openFilm(h)} />)}</div>
        </section>
      )}

      {st.pending.length > 0 && (
        <section className="hsec" style={{ marginTop: n ? 4 : 28 }}>
          <div className="sech"><h3>Ainda no baú · {st.pending.length}</h3></div>
          <div className="grid">
            {st.pending.slice(0, 60).map((m) => (
              <button className="fc faded" key={m.id} onClick={() => nav.openFilm({ id: m.id, t: m.title, y: m.year, o: m.original, img: m.poster })}>
                <span className="ph"><Poster img={m.poster} title={m.title} /></span>
              </button>
            ))}
          </div>
        </section>
      )}

      <button className="plain" id="chyear" style={{ marginTop: 26 }} onClick={onChangeYear}>Mudar ano de nascimento</button>
    </div>
  );
}

/** "Sua infância em filmes": um mosaico dos pôsteres e quem dos amigos viu os mesmos filmes. */
function ChildhoodCard() {
  const st = useChestList();
  const { friends, user } = useCloud();
  const [match, setMatch] = useState<{ name: string; n: number } | null>(null);
  const mine = new Set((st?.remembered || []).map(fkey));

  useEffect(() => {
    if (!user || !friends.list.length) return;
    let alive = true;
    void Promise.all(friends.list.slice(0, 10).map(async (p) => {
      const keys = await cloud.friendChestKeys(p.id!);
      return { name: pname(p), n: [...keys].filter((k) => mine.has(k)).length };
    })).then((rs) => {
      if (!alive) return;
      const best = rs.sort((a, b) => b.n - a.n)[0];
      setMatch(best && best.n > 0 ? best : null);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, friends.list.length, mine.size]);

  if (!st) return null;
  const pics = st.remembered.filter((h) => h.img).slice(0, 9);
  return (
    <div className="chcard" id="chcard">
      <div className="chmosaic">{pics.map((h) => <Poster key={fkey(h)} img={h.img} title={h.t} fallback={false} />)}</div>
      <div className="chcardtx">
        <span className="eyebrow">Sua infância em filmes</span>
        <b>{st.remembered.length} filmes que marcaram você</b>
        {match && <p id="chmatch">Você e {match.name} viram {match.n} {match.n === 1 ? 'filme igual' : 'filmes iguais'} quando eram crianças.</p>}
      </div>
    </div>
  );
}
