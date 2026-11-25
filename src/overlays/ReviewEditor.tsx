// Tela de escrever a review: espaço grande, sem distração, com ideias de por onde começar.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useArmed } from '../components/hooks';
import { SpoilerSwitch } from '../components/Spoiler';
import { Overlay, OverlayHeader } from '../components/Overlay';
import { films, fkey, isRated, useFilms } from '../lib/films';
import { fmt, LABELS } from '../lib/format';
import { nav } from '../nav';

const HINTS = ['O que mais me marcou', 'Uma cena que ficou', 'Para quem eu recomendaria', 'O que não funcionou'];

export function ReviewEditor({ filmKey }: { filmKey: string }) {
  const found = useFilms().find((h) => fkey(h) === filmKey);
  const film = isRated(found) ? found : null;
  const start = useRef(film?.note || '').current;
  const [text, setText] = useState(start);
  const startSp = useRef(!!film?.sp).current;
  const [sp, setSp] = useState(startSp);
  const [armed, press] = useArmed();
  const area = useRef<HTMLTextAreaElement>(null);

  // A caixa cresce junto com o texto, sem a tela pular
  useLayoutEffect(() => {
    const t = area.current; if (!t) return;
    const scroller = t.closest('.ov');
    const y = scroller?.scrollTop || 0;
    t.style.height = 'auto';
    t.style.height = Math.max(t.scrollHeight, window.innerHeight * 0.46) + 'px';
    if (scroller) scroller.scrollTop = y;
  }, [text]);
  useEffect(() => {
    const id = setTimeout(() => { const t = area.current; if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }, 320);
    return () => clearTimeout(id);
  }, []);

  if (!film) return null;
  const cancel = () => { if ((text.trim() !== start.trim() || sp !== startSp) && !press()) return; nav.close(); };
  const save = () => {
    const v = text.trim() || undefined;
    const s = v && sp ? true : undefined;
    if (film.note !== v || film.sp !== s) { film.note = v; film.sp = s; films.save(); }
    nav.close();
  };
  const addHint = (h: string) => {
    setText((v) => v + (v && !v.endsWith('\n') ? '\n\n' : '') + h + ': ');
    requestAnimationFrame(() => { const t = area.current; if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } });
  };

  return (
    <Overlay className="red">
      <OverlayHeader left={<button id="rc" onClick={cancel}>{armed ? 'Descartar?' : 'Cancelar'}</button>} title="Review" right={<button className="ok" id="rs" onClick={save}>Salvar</button>} />
      <h2>{film.t}</h2>
      <p className="count" style={{ margin: 0, fontSize: 14 }}>★ {fmt(film.s)} — {LABELS[film.s]}</p>
      <div className="hints">{HINTS.map((h) => <button type="button" key={h} onClick={() => addHint(h)}>{h}</button>)}</div>
      <textarea ref={area} id="rt" maxLength={5000} placeholder="Escreva do seu jeito. Pode ser uma linha ou um textão." value={text} onChange={(e) => setText(e.target.value)} />
      <SpoilerSwitch on={sp} onChange={setSp} />
      <div className="cnt" id="rn">{text.length > 4000 ? `${text.length} / 5000` : ''}</div>
    </Overlay>
  );
}
