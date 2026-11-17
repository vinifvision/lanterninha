// Procurar alguém pelo @ e pedir amizade.
import { useEffect, useRef, useState } from 'react';
import { FriendRow } from '../components/FriendRow';
import { Overlay, OverlayHeader } from '../components/Overlay';
import { cloud, useCloud } from '../lib/cloud';
import type { Profile } from '../lib/types';
import { nav } from '../nav';

export function AddFriend() {
  const { friends } = useCloud();
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Profile | null>(null);
  const [sent, setSent] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; bad?: boolean }>({ t: '' });
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { const id = setTimeout(() => input.current?.focus(), 300); return () => clearTimeout(id); }, []);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setFound(null); setSent(''); setMsg({ t: 'Procurando…' });
    const p = await cloud.findUser(q);
    if (!p) return setMsg({ t: 'Não achei ninguém com esse @.', bad: true });
    setFound(p); setMsg({ t: '' });
  };
  const request = async (p: Profile) => {
    setBusy(true);
    const wasIncoming = friends.incoming.some((x) => x.id === p.id);
    const err = await cloud.requestFriend(p.id!);
    setBusy(false);
    if (err) return setMsg({ t: err, bad: true });
    setSent(wasIncoming ? 'Agora são amigos' : 'Pedido enviado');
  };
  const status = (p: Profile) => {
    if (sent) return <i>{sent}</i>;
    if (friends.list.some((x) => x.id === p.id)) return <i>Já é seu amigo</i>;
    if (friends.outgoing.some((x) => x.id === p.id)) return <i>Pedido enviado</i>;
    return <button className="mini" id="arq" disabled={busy} onClick={() => void request(p)}>{friends.incoming.some((x) => x.id === p.id) ? 'Aceitar' : 'Pedir amizade'}</button>;
  };

  return (
    <Overlay>
      <OverlayHeader left={<button id="ax" onClick={() => nav.close()}>Fechar</button>} title="Adicionar amigo" />
      <form id="afm" onSubmit={search}>
        <input ref={input} type="text" id="aq" placeholder="@ do seu amigo" maxLength={21} autoCapitalize="none" autoCorrect="off" spellCheck={false} value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="cta" type="submit">Procurar</button>
      </form>
      <div id="ar" style={{ marginTop: 22 }}>{found && <FriendRow p={found} right={status(found)} />}</div>
      <p className={`fmsg${msg.bad ? ' bad' : ''}`} id="am">{msg.t}</p>
    </Overlay>
  );
}
