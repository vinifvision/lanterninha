// Aviso de versão nova do app de celular. Como o app instalado abre o site, o aviso chega até em APKs antigos
// (e tudo nele, texto e visual, muda só com um deploy, sem APK novo).
// Espera as outras telas fecharem (ex.: Novidades) para não aparecer por cima delas.
import { useEffect, useState } from 'react';
import { APK_URL, LATEST_APK } from '../lib/config';
import { sfx } from '../lib/sfx';
import { appBuild, appVersion } from '../native';
import { useNav } from '../nav';

const SNOOZE = 'lantUpd';
const snoozed = () => { try { return Date.now() < Number(localStorage.getItem(SNOOZE) || 0); } catch { return false; } };
const snooze = (hours: number) => { try { localStorage.setItem(SNOOZE, String(Date.now() + hours * 3600000)); } catch { /* ok */ } };

export function UpdateSheet() {
  const { overlays } = useNav();
  const [due, setDue] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [state, setState] = useState<'off' | 'in' | 'out'>('off');

  useEffect(() => {
    void appBuild().then((b) => {
      if (b !== null && b < LATEST_APK.build && !snoozed()) setDue(true);
    });
    void appVersion().then(setCurrent);
  }, []);

  // Só aparece com a tela livre, um pouco depois de a pessoa chegar
  useEffect(() => {
    if (!due || state !== 'off' || overlays.length) return;
    const t = setTimeout(() => setState('in'), 1200);
    return () => clearTimeout(t);
  }, [due, state, overlays.length]);

  if (state === 'off') return null;
  const close = (hours: number) => {
    snooze(hours);
    setDue(false);
    setState('out');
    setTimeout(() => setState('off'), 350);
  };

  return (
    <div className={`updwrap ${state}`} onClick={(e) => { if (e.target === e.currentTarget) close(24); }}>
      <div className="upd" role="dialog" aria-labelledby="updt">
        <div className="upd-beam" aria-hidden="true" />
        <img className="updicon" src="/icon-192.png" alt="" />
        <div className="upd-vs" aria-label={`Versão ${LATEST_APK.name}`}>
          {current && current !== LATEST_APK.name && (
            <>
              <span className="old">{current}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </>
          )}
          <span className="new">Versão {LATEST_APK.name}</span>
        </div>
        <b id="updt">Baixe o Lanterninha {LATEST_APK.name}</b>
        <p>{LATEST_APK.news}. Instale por cima: seus filmes continuam aqui.</p>
        <a className="updgo" id="updgo" href={APK_URL} onClick={() => { sfx.tap(); close(6); }}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
          Baixar a versão {LATEST_APK.name}
        </a>
        <button type="button" className="updno" id="updno" onClick={() => close(24)}>Agora não</button>
      </div>
    </div>
  );
}
