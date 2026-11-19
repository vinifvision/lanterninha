// Indicar um filme para um ou mais amigos, com um recado opcional.
import { useState } from 'react';
import { FriendRow } from '../components/FriendRow';
import { Overlay, OverlayHeader } from '../components/Overlay';
import { cloud, useCloud } from '../lib/cloud';
import type { FilmInfo } from '../lib/types';
import { nav } from '../nav';

export function Recommend({ info }: { info: FilmInfo }) {
  const list = useCloud().friends.list;
  const [picked, setPicked] = useState<string[]>(list.length === 1 ? [list[0].id!] : []);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; bad?: boolean }>({ t: '' });

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const send = async () => {
    setBusy(true); setMsg({ t: 'Enviando…' });
    const err = await cloud.sendRec(picked, info, note.trim());
    if (err) { setBusy(false); return setMsg({ t: err, bad: true }); }
    setMsg({ t: 'Indicação enviada.' });
    setTimeout(() => nav.close(), 900);
  };

  return (
    <Overlay>
      <OverlayHeader left={<button id="rx" onClick={() => nav.close()}>Cancelar</button>} title="Indicar" right={<button className="ok" id="rok" disabled={busy} onClick={() => void send()}>Enviar</button>} />
      <p className="count" style={{ marginBottom: 14 }}>{info.t}</p>
      <div className="frs pick" style={{ marginBottom: 18 }}>
        {list.map((p) => <FriendRow key={p.id} p={p} selected={picked.includes(p.id!)} onClick={() => toggle(p.id!)} right={<span className="ck" />} />)}
      </div>
      <input type="text" id="rnote" maxLength={200} placeholder="Um recado (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <p className={`fmsg${msg.bad ? ' bad' : ''}`} id="rm">{msg.t}</p>
    </Overlay>
  );
}
