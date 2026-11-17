// Aviso de versão nova do app de celular. Como o app instalado abre o site, o aviso chega até em APKs antigos.
import { useEffect, useState } from 'react';
import { APK_URL, LATEST_APK } from '../lib/config';
import { sfx } from '../lib/sfx';
import { appBuild } from '../native';

const SNOOZE = 'lantUpd';
const snoozed = () => { try { return Date.now() < Number(localStorage.getItem(SNOOZE) || 0); } catch { return false; } };
const snooze = (hours: number) => { try { localStorage.setItem(SNOOZE, String(Date.now() + hours * 3600000)); } catch { /* ok */ } };

export function UpdateSheet() {
  const [state, setState] = useState<'off' | 'in' | 'out'>('off');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    void appBuild().then((b) => {
      if (b !== null && b < LATEST_APK.build && !snoozed()) timer = setTimeout(() => setState('in'), 1200);
    });
    return () => clearTimeout(timer);
  }, []);

  if (state === 'off') return null;
  const close = (hours: number) => { snooze(hours); setState('out'); setTimeout(() => setState('off'), 350); };

  return (
    <div className={`updwrap ${state}`} onClick={(e) => { if (e.target === e.currentTarget) close(24); }}>
      <div className="upd" role="dialog" aria-labelledby="updt">
        <img className="updicon" src="/icon-192.png" alt="" />
        <small className="updv">Versão {LATEST_APK.name}</small>
        <b id="updt">Tem um Lanterninha novo</b>
        <p>{LATEST_APK.news}. Baixe e instale por cima: seus filmes continuam aqui.</p>
        <a className="updgo" id="updgo" href={APK_URL} onClick={() => { sfx.tap(); close(6); }}>Baixar atualização</a>
        <button type="button" className="updno" id="updno" onClick={() => close(24)}>Agora não</button>
      </div>
    </div>
  );
}
