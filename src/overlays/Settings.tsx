// Configurações: dados da conta, som, sincronização, backup e sair.
// É aqui que entram as opções do app; o perfil fica só com o que os amigos veem.
import { useState } from 'react';
import { Backup } from '../components/Backup';
import { useArmed } from '../components/hooks';
import { Overlay, OverlayHeader } from '../components/Overlay';
import { cloud, useCloud } from '../lib/cloud';
import { APP_VERSION } from '../lib/config';
import { SOUND_ENABLED, sfx, useSound } from '../lib/sfx';
import { nav } from '../nav';
import { guide } from '../lib/guide';
import { resetLibraryView } from '../screens/Library';

const SYNC_TEXT = { ok: 'Tudo salvo na conta', busy: 'Sincronizando…', err: 'Sem conexão. Tento de novo depois.', off: 'Aguardando' };

export function Settings() {
  const account = useCloud();
  const soundOn = useSound();
  const [armed, press] = useArmed(4000);
  const [leaving, setLeaving] = useState(false);
  const [err, setErr] = useState('');
  const user = account.user;

  const signOut = async () => {
    if (!press()) return;
    setLeaving(true); resetLibraryView();
    const e = await cloud.signOut();
    if (e) { setLeaving(false); setErr(e); return; }
    nav.close();
  };

  return (
    <Overlay>
      <OverlayHeader left={<button id="cfx" onClick={() => nav.close()}>Fechar</button>} title="Configurações" />

      {user && (
        <>
          <div className="sech"><h3>Conta</h3></div>
          <div className="set">
            {account.profile?.username && <div><span>Usuário</span><b>@{account.profile.username}</b></div>}
            <div><span>E-mail</span><b id="cfmail">{user.email}</b></div>
          </div>
          <p className="setnote">Só você vê o seu e-mail. Seus amigos veem o nome, o @ e a foto.</p>
        </>
      )}

      {SOUND_ENABLED && (
        <>
          <div className="sech"><h3>Avaliação</h3></div>
          <button className={`sw${soundOn ? ' on' : ''}`} role="switch" aria-checked={soundOn} id="cfsnd" onClick={() => { sfx.toggle(); }}>
            Sons ao avaliar<i />
          </button>
        </>
      )}

      {user && (
        <>
          <div className="sech" style={{ marginTop: 30 }}><h3>Sincronização</h3></div>
          <p className={`sync ${account.sync === 'off' ? '' : account.sync}`} id="sync"><i /><span>{SYNC_TEXT[account.sync]}</span></p>
          <button className="plain" id="snow" onClick={() => void cloud.syncNow()}>Sincronizar agora</button>
        </>
      )}

      <div className="sech" style={{ marginTop: 30 }}><h3>Ajuda</h3></div>
      <button className="plain" id="cfguide" onClick={guide.replay}>Rever o tutorial</button>
      <p className="setnote">Mostra de novo, passo a passo, como dar uma nota.</p>

      <Backup />
      <p className="setnote">O backup guarda seus filmes em um arquivo, para o caso de você querer uma cópia fora da conta.</p>

      {user && (
        <>
          <button className="plain out" id="sout" style={{ marginTop: 34 }} disabled={leaving} onClick={signOut}>{armed ? 'Sair mesmo?' : 'Sair da conta'}</button>
          <p className={`fmsg${err ? ' bad' : ''}`} id="cfm">{err || (armed ? 'Seus filmes continuam salvos na conta.' : '')}</p>
        </>
      )}

      <div className="about-app">
        <img src="/logo.svg" alt="" width={44} height={44} />
        <b>Lanterninha</b>
        <span>Versão {APP_VERSION}</span>
        <span>Criado por Vinícius Fernandes</span>
        <small>
          Dados e imagens de filmes: <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">TMDB</a>.
          Onde assistir: JustWatch. Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB.
        </small>
        <small>© {new Date().getFullYear()} Vinícius Fernandes. Todos os direitos reservados.</small>
      </div>
    </Overlay>
  );
}
