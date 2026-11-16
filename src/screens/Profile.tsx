// Aba Perfil: entrar ou criar conta; depois, o perfil com top 4, amigos, placar e sincronização.
import { useState } from 'react';
import { Avatar } from '../components/Avatar';
import { FriendRow } from '../components/FriendRow';
import { useAsync } from '../components/hooks';
import { TopFour } from '../components/TopFour';
import { cleanProfile, cloud, useCloud } from '../lib/cloud';
import { fkey, isRated, useFilms } from '../lib/films';
import { fmt, nFriends } from '../lib/format';
import type { Profile as ProfileData } from '../lib/types';
import { nav } from '../nav';

const EMPTY_PROFILE = cleanProfile({}) as ProfileData;

export function Profile() {
  const account = useCloud();
  if (!account.ready) {
    return (
      <div className="screen">
        <h1>Perfil</h1><p className="count">Conectando…</p>
        <p className="empty">Se isso não mudar, confere tua internet.</p>
      </div>
    );
  }
  return account.user ? <Account /> : <AuthForm />;
}

function AuthForm() {
  const all = useFilms();
  const [up, setUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const hint = all.length && up ? 'Os filmes deste aparelho vão junto pra tua conta.' : '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const bad = (t: string) => setMsg({ t, bad: true });
    const mail = email.trim();
    if (up && !/^[a-z0-9_.]{3,20}$/.test(name)) return bad('O nome de usuário precisa de 3 a 20 letras, números, ponto ou _.');
    if (!/^\S+@\S+\.\S+$/.test(mail)) return bad('Esse e-mail não parece válido.');
    if (pw.length < 6) return bad('A senha precisa ter pelo menos 6 caracteres.');
    setBusy(true); setMsg({ t: up ? 'Criando…' : 'Entrando…' });
    const r = up ? await cloud.signUp(name, mail, pw) : await cloud.signIn(mail, pw);
    setBusy(false);
    if (r === 'CONFIRM') { setUp(false); setMsg({ t: 'Conta criada. Te mandei um e-mail: confirma por lá e depois entra aqui.' }); }
    else if (r) bad(r);
  };

  return (
    <div className="screen">
      <h1>Perfil</h1>
      <p className="count">Entre pra guardar teus filmes na conta e ver em qualquer aparelho.</p>
      <div className="seg">
        <button data-m="in" className={up ? '' : 'on'} onClick={() => { setUp(false); setMsg(null); }}>Entrar</button>
        <button data-m="up" className={up ? 'on' : ''} onClick={() => { setUp(true); setMsg(null); }}>Criar conta</button>
      </div>
      <form id="af" noValidate onSubmit={submit}>
        {up && (
          <input type="text" id="un" placeholder="Nome de usuário" maxLength={20} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
            value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))} />
        )}
        <input type="email" id="em" placeholder="E-mail" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" id="pw" placeholder="Senha" autoComplete={up ? 'new-password' : 'current-password'} value={pw} onChange={(e) => setPw(e.target.value)} />
        <button className="cta" id="ago" type="submit" disabled={busy}>{up ? 'Criar conta' : 'Entrar'}</button>
      </form>
      <p className={`fmsg${msg?.bad ? ' bad' : ''}`} id="fm">{msg ? msg.t : hint}</p>
    </div>
  );
}

function Account() {
  const account = useCloud();
  const all = useFilms();
  const user = account.user!;
  const pr = account.profile || EMPTY_PROFILE;
  const rated = all.filter(isRated);
  const avg = rated.length ? rated.reduce((a, h) => a + h.s, 0) / rated.length : 0;
  const title = pr.display_name || (pr.username ? '@' + pr.username : 'Minha conta');
  const [err, setErr] = useState('');

  const openTop = (i: number) => {
    const f = pr.top4[i];
    if (!f) return nav.open({ k: 'editProfile' });
    const h = all.find((x) => fkey(x) === fkey(f));
    if (h) nav.openFilm(h);
  };
  return (
    <div className="screen">
      <h1>Perfil</h1><p className="count">&nbsp;</p>
      <div className="pf">
        <Avatar p={pr} fallback={user.email} />
        <div>
          <b>{title}</b>
          {pr.display_name && pr.username && <em>@{pr.username}</em>}
          {account.social && <small>{nFriends(account.friends.list.length)}</small>}
        </div>
      </div>
      {pr.bio && <p className="bio">{pr.bio}</p>}
      {account.extended && (
        <>
          <button className="plain" id="ped" style={{ margin: '-6px 0 28px' }} onClick={() => nav.open({ k: 'editProfile' })}>Editar perfil</button>
          <div className="sech"><h3>Top 4</h3></div>
          <TopFour id="t4" top4={pr.top4} empty="+" onPick={openTop} />
        </>
      )}
      {account.social && <><FriendsBlock onError={setErr} /><Board /></>}
      <div className="stat">
        <div><b>{rated.length}</b><span>{rated.length === 1 ? 'filme' : 'filmes'}</span></div>
        <div><b>{rated.length ? fmt(Math.round(avg * 10) / 10) : '–'}</b><span>nota média</span></div>
      </div>
      <p className={`fmsg${err ? ' bad' : ''}`} id="fm">{err}</p>
    </div>
  );
}

function FriendsBlock({ onError }: { onError: (t: string) => void }) {
  const { friends } = useCloud();
  const [busy, setBusy] = useState('');
  const act = async (fn: (id: string) => Promise<string>, id: string) => {
    setBusy(id);
    const e = await fn(id);
    setBusy('');
    if (e) onError(e);
  };
  const empty = !friends.list.length && !friends.outgoing.length;
  return (
    <>
      {friends.incoming.length > 0 && (
        <>
          <div className="sech"><h3>Pedidos de amizade</h3></div>
          <div className="frs">
            {friends.incoming.map((p) => (
              <FriendRow key={p.id} p={p} right={
                <>
                  <button className="mini" data-ok={p.id} disabled={busy === p.id} onClick={() => void act(cloud.acceptFriend, p.id!)}>Aceitar</button>
                  <button className="mini no" data-no={p.id} disabled={busy === p.id} onClick={() => void act(cloud.removeFriend, p.id!)}>Recusar</button>
                </>
              } />
            ))}
          </div>
        </>
      )}
      <div className="sech"><h3>Amigos{friends.list.length ? ' · ' + friends.list.length : ''}</h3><button id="fadd" onClick={() => nav.open({ k: 'addFriend' })}>Adicionar</button></div>
      <div className="frs">
        {empty && <p className="tip" style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>Ninguém por aqui ainda. Adiciona um amigo pelo @ dele.</p>}
        {friends.list.map((p) => <FriendRow key={p.id} p={p} right={<i>›</i>} onClick={() => nav.push({ k: 'friend', id: p.id! })} />)}
        {friends.outgoing.map((p) => <FriendRow key={p.id} p={p} right={<i>Pedido enviado</i>} />)}
      </div>
    </>
  );
}

function Board() {
  const rows = useAsync(() => cloud.board(), []);
  if (!rows || !rows.length) return <div id="board" />;
  return (
    <div id="board">
      <div className="sech"><h3>Placar do palpite</h3></div>
      <div className="frs board">
        {rows.map((r, k) => (
          <FriendRow key={r.p.id || k} p={r.p} left={<i className="pos">{k + 1}</i>} name={r.me ? 'Tu' : undefined}
            small={`${r.n} ${r.n === 1 ? 'palpite' : 'palpites'}`} right={<span className="rt">{r.pts} pts</span>} />
        ))}
      </div>
    </div>
  );
}
