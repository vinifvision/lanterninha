// Editar perfil: foto, nome, bio e os quatro favoritos.
import { useRef, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { Overlay, OverlayHeader } from '../components/Overlay';
import { Poster } from '../components/Poster';
import { TopFour } from '../components/TopFour';
import { loadImage } from '../lib/api';
import { cleanProfile, cloud, useCloud } from '../lib/cloud';
import { fkey, isRated, useFilms } from '../lib/films';
import { fmt } from '../lib/format';
import type { Profile, TopItem } from '../lib/types';
import { nav } from '../nav';

/** Corta a foto no centro e reduz para 256px, até caber no limite do banco. */
async function photoToAvatar(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  const im = await loadImage(url).catch(() => null);
  URL.revokeObjectURL(url);
  if (!im) return '';
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const c = cv.getContext('2d');
  if (!c) return '';
  const m = Math.min(im.naturalWidth, im.naturalHeight);
  c.drawImage(im, (im.naturalWidth - m) / 2, (im.naturalHeight - m) / 2, m, m, 0, 0, 256, 256);
  let q = 0.82, out = cv.toDataURL('image/jpeg', q);
  while (out.length > 78000 && q > 0.4) { q -= 0.1; out = cv.toDataURL('image/jpeg', q); }
  return out.length <= 78000 ? out : '';
}

export function EditProfile() {
  const account = useCloud();
  const pr = account.profile || (cleanProfile({}) as Profile);
  const [avatar, setAvatar] = useState(pr.avatar);
  const [name, setName] = useState(pr.display_name);
  const [bio, setBio] = useState(pr.bio);
  const [top4, setTop4] = useState(pr.top4.slice());
  const [slot, setSlot] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; bad?: boolean }>({ t: '' });
  const file = useRef<HTMLInputElement>(null);

  const pickPhoto = async (f?: File) => {
    if (!f) return;
    setMsg({ t: 'Preparando a foto…' });
    const a = await photoToAvatar(f);
    if (!a) return setMsg({ t: 'Não consegui usar essa imagem.', bad: true });
    setAvatar(a); setMsg({ t: '' });
  };
  const save = async () => {
    setBusy(true); setMsg({ t: 'Salvando…' });
    const err = await cloud.saveProfile({ display_name: name.trim() || null, bio: bio.trim() || null, avatar: avatar || null, top4 });
    if (err) { setBusy(false); return setMsg({ t: err, bad: true }); }
    nav.close();
  };
  const setTop = (i: number, f: TopItem | null) => { setTop4((t) => t.map((x, k) => (k === i ? f : x))); setSlot(null); };

  return (
    <>
      <Overlay>
        <OverlayHeader left={<button id="ex" onClick={() => nav.close()}>Cancelar</button>} title="Editar perfil" right={<button className="ok" id="eok" disabled={busy} onClick={() => void save()}>Salvar</button>} />
        <div className="avedit">
          <span id="eav"><Avatar p={{ avatar, display_name: name, username: pr.username }} fallback={account.user?.email} /></span>
          <div>
            <button id="eph" onClick={() => file.current?.click()}>Trocar foto</button>
            {avatar && <button id="erm" style={{ color: 'var(--muted)' }} onClick={() => setAvatar('')}>Remover</button>}
          </div>
          <input ref={file} type="file" id="ef" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void pickPhoto(f); }} />
        </div>
        <label className="lbl" htmlFor="edn">Nome</label>
        <input type="text" id="edn" maxLength={40} placeholder="Como teus amigos te veem" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="lbl" htmlFor="ebio" style={{ marginTop: 8 }}>Bio</label>
        <textarea id="ebio" maxLength={160} placeholder="Uma linha sobre ti e teus filmes" value={bio} onChange={(e) => setBio(e.target.value)} />
        <span className="lbl" style={{ marginTop: 20 }}>Favoritos · toque para escolher ou trocar</span>
        <div style={{ marginBottom: 8 }}><TopFour id="et4" top4={top4} empty="+" onPick={setSlot} /></div>
        <p className={`fmsg${msg.bad ? ' bad' : ''}`} id="em2">{msg.t}</p>
      </Overlay>
      {slot !== null && <PickTop slot={slot} top4={top4} onDone={(f) => setTop(slot, f)} onClose={() => setSlot(null)} />}
    </>
  );
}

/** Escolher um favorito entre os filmes já avaliados. */
function PickTop({ slot, top4, onDone, onClose }: { slot: number; top4: (TopItem | null)[]; onDone: (f: TopItem | null) => void; onClose: () => void }) {
  const used = top4.map((f, i) => (f && i !== slot ? fkey(f) : null));
  const list = useFilms().filter(isRated).filter((h) => !used.includes(fkey(h))).sort((a, b) => b.s - a.s);
  return (
    <div className="ov" style={{ zIndex: 8 }}>
      <div>
        <OverlayHeader
          left={<button id="px" onClick={onClose}>Voltar</button>} title={`Favorito ${slot + 1}`}
          right={top4[slot] ? <button id="prm" style={{ color: '#ff5a52' }} onClick={() => onDone(null)}>Remover</button> : <span style={{ width: 60 }} />}
        />
        {list.length > 0
          ? <div className="grid">{list.map((h) => (
              <button className="fc" key={fkey(h)} onClick={() => onDone({ id: h.id || null, t: h.t, img: h.img || '', y: h.y || '' })}>
                <span className="ph"><Poster img={h.img} title={h.t} /></span><b>★ {fmt(h.s)}</b>
              </button>
            ))}</div>
          : <p className="empty">Teus favoritos saem dos filmes que tu já avaliou.<br />Avalia alguns e volta aqui.</p>}
      </div>
    </div>
  );
}
