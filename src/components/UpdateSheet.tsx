// Aviso de versão nova do app de celular. Como o app instalado abre o site, o aviso chega até em APKs antigos
// (e tudo nele, texto e visual, muda só com um deploy, sem APK novo).
// Espera as outras telas fecharem (ex.: Novidades) para não aparecer por cima delas.
// Quem está num APK assinado com a chave de debug (até LAST_DEBUG_APK) não consegue instalar por cima:
// para essas pessoas o aviso vira um passo a passo (baixar, desinstalar, instalar, entrar na conta).
import { useEffect, useState } from 'react';
import { cloud, useCloud } from '../lib/cloud';
import { APK_URL, LAST_DEBUG_APK, LATEST_APK } from '../lib/config';
import { sfx } from '../lib/sfx';
import { appBuild, appVersion, devApkBuild } from '../native';
import { useNav } from '../nav';

const SNOOZE = 'lantUpd';
const snoozed = () => { if (devApkBuild() !== null) return false; try { return Date.now() < Number(localStorage.getItem(SNOOZE) || 0); } catch { return false; } };
const snooze = (hours: number) => { try { localStorage.setItem(SNOOZE, String(Date.now() + hours * 3600000)); } catch { /* ok */ } };

export function UpdateSheet() {
  const { overlays } = useNav();
  const [due, setDue] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [state, setState] = useState<'off' | 'in' | 'out'>('off');
  const [reinstall, setReinstall] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const { user } = useCloud();

  useEffect(() => {
    void appBuild().then((b) => {
      if (b !== null && b < LATEST_APK.build && !snoozed()) setDue(true);
      if (b !== null && b <= LAST_DEBUG_APK) setReinstall(true);
    });
    void appVersion().then(setCurrent);
  }, []);

  // Só aparece com a tela livre, um pouco depois de a pessoa chegar
  useEffect(() => {
    if (!due || state !== 'off' || overlays.length) return;
    const t = setTimeout(() => setState('in'), 1200);
    return () => clearTimeout(t);
  }, [due, state, overlays.length]);

  // No passo a passo, garante que os filmes estão salvos na conta antes de a pessoa desinstalar
  useEffect(() => {
    if (state === 'in' && reinstall && user) void cloud.syncNow();
  }, [state, reinstall, user]);

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
        {reinstall ? (
          <>
            <b id="updt">Reinstale o Lanterninha</b>
            <p>O app ganhou assinatura própria. Por isso, só desta vez, é preciso trocar o app.</p>
            <ol className="upd-steps">
              <li className={user ? 'ok' : 'warn'}>
                {user
                  ? <>Seus filmes estão salvos na conta <em>{user.email}</em></>
                  : <>Entre na sua conta ou exporte um backup nas Configurações. Sem isso, os filmes se perdem</>}
              </li>
              <li className={downloaded ? 'ok' : ''}>
                <a className="updgo" id="updgo" href={APK_URL} onClick={() => { sfx.tap(); setDownloaded(true); }}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
                  {downloaded ? 'Baixando… baixar de novo' : `Baixar a versão ${LATEST_APK.name}`}
                </a>
              </li>
              <li>Desinstale este app: segure o ícone do Lanterninha e toque em <em>Desinstalar</em></li>
              <li>Abra o arquivo baixado (na notificação ou em Downloads) e instale</li>
              <li>Abra o app novo e entre na sua conta</li>
            </ol>
          </>
        ) : (
          <>
            <b id="updt">Baixe o Lanterninha {LATEST_APK.name}</b>
            <p>{LATEST_APK.news}. Instale por cima: seus filmes continuam aqui.</p>
            <a className="updgo" id="updgo" href={APK_URL} onClick={() => { sfx.tap(); close(6); }}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
              Baixar a versão {LATEST_APK.name}
            </a>
          </>
        )}
        <button type="button" className="updno" id="updno" onClick={() => close(24)}>Agora não</button>
      </div>
    </div>
  );
}
