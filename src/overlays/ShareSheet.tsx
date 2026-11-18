// Prévia da imagem de compartilhar, em formato Post ou Story.
// No app de celular: "Enviar" abre a tela de compartilhar do Android e "Salvar" grava na galeria.
// No site: usa o compartilhar do navegador e o download.
import { useEffect, useRef, useState } from 'react';
import { fkey, isRated, useFilms } from '../lib/films';
import { isNativeApp } from '../lib/config';
import { canNativeSave, canNativeShare, isCancel, saveNative, shareNative } from '../lib/nativeShare';
import { cardFileName, makeCard } from '../lib/share';
import { sfx } from '../lib/sfx';
import { nav } from '../nav';

type Fmt = 'post' | 'story';
const OLD_APP = 'Atualize o app para a versão 1.2 para enviar e salvar a imagem.';

export function ShareSheet({ filmKey }: { filmKey: string }) {
  const found = useFilms().find((h) => fkey(h) === filmKey);
  const film = isRated(found) ? found : null;
  const [fmt, setFmt] = useState<Fmt>('post');
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState('Gerando…');
  const [busy, setBusy] = useState(false);
  // As duas imagens ficam guardadas: trocar Post/Story depois da primeira vez é na hora
  const made = useRef<Partial<Record<Fmt, { blob: Blob; url: string }>>>({});
  const urls = useRef<string[]>([]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  useEffect(() => {
    if (!film) return;
    let alive = true;
    const make = async (f: Fmt) => {
      const have = made.current[f];
      if (have) return have;
      const blob = await makeCard(film, f === 'story');
      if (!blob) throw new Error('vazio');
      const u = URL.createObjectURL(blob);
      urls.current.push(u);
      return (made.current[f] = { blob, url: u });
    };
    if (!made.current[fmt]) setMsg('Gerando…');
    make(fmt)
      .then((m) => {
        if (!alive) return;
        setUrl(m.url);
        setMsg('');
        // a outra já fica pronta enquanto a pessoa olha esta
        void make(fmt === 'post' ? 'story' : 'post').catch(() => null);
      })
      .catch(() => { if (alive) setMsg('Não consegui gerar a imagem.'); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fmt, filmKey]);

  if (!film) return null;
  const name = cardFileName(film.t);
  const current = () => made.current[fmt]?.blob || null;

  const download = (blob: Blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  const save = async () => {
    const blob = current();
    if (!blob || busy) return;
    if (!isNativeApp) { download(blob); setMsg('Imagem baixada.'); return; }
    if (!canNativeSave()) { setMsg(OLD_APP); return; }
    setBusy(true); setMsg('Salvando…');
    try {
      await saveNative(blob, name);
      sfx.tap();
      setMsg('Salva na galeria, no álbum Lanterninha.');
    } catch {
      setMsg('Não consegui salvar na galeria. Tente de novo.');
    } finally { setBusy(false); }
  };

  const send = async () => {
    const blob = current();
    if (!blob || busy) return;
    if (isNativeApp) {
      if (!canNativeShare()) { setMsg(OLD_APP); return; }
      setBusy(true);
      try { await shareNative(blob, name); setMsg(''); }
      catch (e) { if (!isCancel(e)) setMsg('Não consegui abrir o compartilhar. Tente de novo.'); }
      finally { setBusy(false); }
      return;
    }
    // Site: compartilhar do navegador; se não existir, baixa a imagem
    try {
      const f = new File([blob], name, { type: blob.type || 'image/jpeg' });
      if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f] }); return; }
    } catch (e) { if ((e as Error)?.name === 'AbortError') return; }
    download(blob);
    setMsg('Este navegador não abre o compartilhar. A imagem foi baixada.');
  };

  const ready = !!url && !msg.startsWith('Gerando');
  return (
    <div className="shr">
      <button className="x" aria-label="Fechar" onClick={() => nav.close()}>✕</button>
      <div className="pv" id="pv">{url && <img src={url} alt="Prévia" />}</div>
      <div className="seg">
        <button data-f="0" className={fmt === 'post' ? 'on' : ''} onClick={() => setFmt('post')}>Post</button>
        <button data-f="1" className={fmt === 'story' ? 'on' : ''} onClick={() => setFmt('story')}>Story</button>
      </div>
      <div className="row">
        <button className="cta ghost2" id="sv" disabled={!ready || busy} onClick={() => void save()}>Salvar</button>
        <button className="cta" id="sd" disabled={!ready || busy} onClick={() => void send()}>Enviar</button>
      </div>
      <small id="shm" role="status">{msg}</small>
    </div>
  );
}
