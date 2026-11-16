// Prévia da imagem de compartilhar, em formato Post ou Story.
import { useEffect, useRef, useState } from 'react';
import { fkey, isRated, useFilms } from '../lib/films';
import { cardFileName, makeCard } from '../lib/share';
import { nav } from '../nav';

export function ShareSheet({ filmKey }: { filmKey: string }) {
  const found = useFilms().find((h) => fkey(h) === filmKey);
  const film = isRated(found) ? found : null;
  const [story, setStory] = useState(false);
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState('Gerando…');
  const blob = useRef<Blob | null>(null);

  useEffect(() => {
    if (!film) return;
    let alive = true, made = '';
    blob.current = null; setMsg('Gerando…');
    makeCard(film, story)
      .then((b) => { if (!alive) return; if (!b) throw new Error('vazio'); blob.current = b; made = URL.createObjectURL(b); setUrl(made); setMsg(''); })
      .catch(() => { if (alive) setMsg('Não consegui gerar a imagem.'); });
    return () => { alive = false; if (made) URL.revokeObjectURL(made); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story, filmKey]);

  if (!film) return null;
  const name = cardFileName(film.t);
  const save = () => {
    if (!blob.current) return;
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setMsg('Imagem salva.');
  };
  const send = async () => {
    if (!blob.current) return;
    try {
      const f = new File([blob.current], name, { type: 'image/png' });
      if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f] }); return; }
    } catch (e) { if ((e as Error)?.name === 'AbortError') return; }
    save();
  };

  return (
    <div className="shr">
      <button className="x" aria-label="Fechar" onClick={() => nav.close()}>✕</button>
      <div className="pv" id="pv">{url && <img src={url} alt="Prévia" />}</div>
      <div className="seg">
        <button data-f="0" className={story ? '' : 'on'} onClick={() => setStory(false)}>Post</button>
        <button data-f="1" className={story ? 'on' : ''} onClick={() => setStory(true)}>Story</button>
      </div>
      <div className="row">
        <button className="cta ghost2" id="sv" onClick={save}>Salvar</button>
        <button className="cta" id="sd" onClick={() => void send()}>Enviar</button>
      </div>
      <small id="shm">{msg}</small>
    </div>
  );
}
