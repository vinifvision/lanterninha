// Palpite: adivinhar a nota que o amigo deu para cada filme.
import { useState } from 'react';
import { Overlay, OverlayHeader } from '../components/Overlay';
import { Poster } from '../components/Poster';
import { Stars } from '../components/Stars';
import { cloud } from '../lib/cloud';
import { fkey } from '../lib/films';
import { clamp, fmt, pname } from '../lib/format';
import type { Profile, RatedFilm } from '../lib/types';
import { nav } from '../nav';

/** Nota exata vale 3, meia estrela de diferença vale 2, uma estrela vale 1. */
export const pointsFor = (guess: number, actual: number) => { const d = Math.abs(guess - actual); return d === 0 ? 3 : d <= 0.5 ? 2 : d <= 1 ? 1 : 0; };
export const VERDICT = ['Errou feio.', 'Passou perto.', 'Quase!', 'Na mosca!'];

export function GuessGame({ friend, films: pool }: { friend: Profile; films: RatedFilm[] }) {
  const [i, setI] = useState(0);
  const [val, setVal] = useState(3);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ pts: number; saved: boolean } | null>(null);

  if (i >= pool.length) {
    return (
      <Overlay>
        <div className="ovh"><span /><b>Fim da rodada</b><span /></div>
        <div className="gs">
          <div className="num" style={{ marginTop: 60 }}>{total}</div>
          <p className="q2">{total === 1 ? 'ponto' : 'pontos'} em {pool.length} {pool.length === 1 ? 'palpite' : 'palpites'}</p>
          <p className="pts">Nota exata vale 3, meia estrela de diferença vale 2, uma estrela vale 1.</p>
          <button className="cta" id="gend" onClick={() => nav.close()}>Fechar</button>
        </div>
      </Overlay>
    );
  }

  const h = pool[i];
  const locked = !!answer;
  const confirm = async () => {
    if (locked) { setI(i + 1); setVal(3); setAnswer(null); return; }
    setBusy(true);
    const saved = await cloud.sendGuess(friend.id!, fkey(h), val);
    setBusy(false);
    const pts = pointsFor(val, h.s);
    if (saved) setTotal((t) => t + pts);
    setAnswer({ pts, saved });
  };
  const onStars = (e: React.MouseEvent<HTMLDivElement>) => {
    if (locked) return;
    const r = e.currentTarget.getBoundingClientRect();
    setVal(clamp(Math.ceil(((e.clientX - r.left) / r.width) * 10) / 2));
  };

  return (
    <Overlay>
      <OverlayHeader left={<button id="gx" onClick={() => nav.close()}>Sair</button>} title={`Palpite ${i + 1} de ${pool.length}`} right={<span style={{ width: 40 }} />} />
      <div className="gs" key={i}>
        <Poster img={h.img} title="" size="w342" fallback={false} className="poster" />
        <h2>{h.t}</h2>
        <p className="q2">Que nota {pname(friend)} deu?</p>
        <span id="gst">{answer ? <Stars value={h.s} anim /> : <Stars value={val} onClick={onStars} />}</span>
        <div className="num" id="gnum">{fmt(answer ? h.s : val)}</div>
        <div className="adj" style={{ margin: '14px 0 18px' }}>
          <button id="gm" aria-label="Menos" onClick={() => !locked && setVal(clamp(val - 0.5))}>−</button>
          <small>toque nas estrelas<br />ou use − e +</small>
          <button id="gp" aria-label="Mais" onClick={() => !locked && setVal(clamp(val + 0.5))}>+</button>
        </div>
        <div className={`res${answer ? ' g' + answer.pts : ''}`} id="gres">{answer ? `${VERDICT[answer.pts]} A nota foi ★ ${fmt(h.s)}` : ''}</div>
        <div className="pts" id="gpts">
          {answer ? `Seu palpite: ★ ${fmt(val)} · ${answer.saved ? `+${answer.pts}${answer.pts === 1 ? ' ponto' : ' pontos'}` : 'não consegui salvar esse palpite'}` : ''}
        </div>
        <button className="cta" id="gok" disabled={busy} onClick={() => void confirm()}>{!locked ? 'Confirmar palpite' : i + 1 < pool.length ? 'Próximo' : 'Ver resultado'}</button>
      </div>
    </Overlay>
  );
}
