// Compartilhar (v2): prévia da imagem em três estilos (Pôster, Ingresso, Só a review).
// No app de celular: "Enviar" abre a tela de compartilhar do Android (WhatsApp, Status, Instagram…) e "Salvar" grava na galeria.
// No site: usa o compartilhar do navegador e o download.
import { useEffect, useRef, useState } from 'react';
import { SendIcon } from '../components/icons';
import { fkey, isRated, useFilms } from '../lib/films';
import { isNativeApp } from '../lib/config';
import { canNativeSave, canNativeShare, isCancel, saveNative, shareNative } from '../lib/nativeShare';
import { cardFileName, makeCard, type CardStyle } from '../lib/share';
import { nav } from '../nav';

const OLD_APP = 'Atualize o app para a versão 1.2 para enviar e salvar a imagem.';
const STYLES: [CardStyle, string][] = [['poster', 'Pôster'], ['ticket', 'Ingresso'], ['review', 'Só a review']];

export function ShareSheet({ filmKey }: { filmKey: string }) {
  const found = useFilms().find((h) => fkey(h) === filmKey);
  const film = isRated(found) ? found : null;
  const [style, setStyle] = useState<CardStyle>('poster');
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState('Gerando…');
  const [busy, setBusy] = useState(false);
  // As imagens ficam guardadas: voltar para um estilo já visto é na hora
  const made = useRef<Partial<Record<CardStyle, { blob: Blob; url: string }>>>({});
  const urls = useRef<string[]>([]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  useEffect(() => {
    if (!film) return;
    let alive = true;
    const have = made.current[style];
    if (have) { setUrl(have.url); setMsg(''); return; }
    setMsg('Gerando…');
    makeCard(film, style)
      .then((blob) => {
        if (!blob) throw new Error('vazio');
        const u = URL.createObjectURL(blob);
        urls.current.push(u);
        made.current[style] = { blob, url: u };
        if (alive) { setUrl(u); setMsg(''); }
      })
      .catch(() => { if (alive) setMsg('Não consegui gerar a imagem.'); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style, filmKey]);

  if (!film) return null;
  const name = cardFileName(film.t);
  const current = () => made.current[style]?.blob || null;
  const hasNote = !!film.note?.trim();

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

  const ready = !!url && msg !== 'Gerando…';
  return (
    <div className="v2shr">
      <div className="v2shrh">
        <button className="v2round" aria-label="Voltar" onClick={() => nav.close()}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <b>Compartilhar</b>
        <span style={{ width: 44 }} />
      </div>

      <div className={`v2shrpv${ready ? '' : ' wait'}`}>{url && <img src={url} alt={`Prévia da imagem de ${film.t}`} />}</div>

      <div className="v2shrst" role="radiogroup" aria-label="Estilo da imagem">
        {STYLES.map(([k, label]) => (
          <button key={k} role="radio" aria-checked={style === k} className={style === k ? 'on' : ''}
            disabled={k === 'review' && !hasNote} onClick={() => setStyle(k)}>{label}</button>
        ))}
      </div>
      {!hasNote && <small className="v2shrhint">Escreva uma review para usar "Só a review".</small>}

      <div className="v2shrgo">
        <button disabled={!ready || busy} onClick={() => void send()}>
          <span className="ic send"><SendIcon /></span>Enviar
        </button>
        <button disabled={!ready || busy} onClick={() => void save()}>
          <span className="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg></span>Salvar
        </button>
      </div>
      <small className="v2shrmsg" role="status">{msg}</small>
    </div>
  );
}
