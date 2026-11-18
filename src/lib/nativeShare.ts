// Enviar e salvar a imagem de compartilhar no app de celular (Android), com os complementos nativos:
// Share (abre a tela de compartilhar do Android: WhatsApp, Status, Instagram…), Filesystem (guarda o
// arquivo um instante antes de enviar) e Media (salva na galeria, no álbum "Lanterninha").
// O app instalado abre o site publicado, então um APK antigo pode rodar este código sem os complementos:
// por isso cada função confere antes se o complemento existe.
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Media } from '@capacitor-community/media';
import { isNativeApp } from './config';

const ALBUM = 'Lanterninha';

/** O APK instalado já tem o compartilhar nativo (versão 1.2 ou mais nova)? */
export const canNativeShare = () =>
  isNativeApp && Capacitor.isPluginAvailable('Share') && Capacitor.isPluginAvailable('Filesystem');
/** O APK instalado já consegue salvar na galeria? */
export const canNativeSave = () => isNativeApp && Capacitor.isPluginAvailable('Media');

const toBase64 = (b: Blob) =>
  new Promise<string>((ok, bad) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1] || '');
    r.onerror = () => bad(r.error);
    r.readAsDataURL(b);
  });

/** A pessoa fechou a tela de compartilhar sem escolher nada: não é erro. */
export const isCancel = (e: unknown) => /cancel/i.test(String((e as Error)?.message || e));

/** Abre a tela de compartilhar do Android com a imagem. */
export async function shareNative(blob: Blob, name: string) {
  const { uri } = await Filesystem.writeFile({
    path: 'compartilhar/' + name,
    data: await toBase64(blob),
    directory: Directory.Cache,
    recursive: true,
  });
  await Share.share({ files: [uri], dialogTitle: 'Compartilhar' });
}

/** O álbum "Lanterninha" da galeria (cria na primeira vez). */
async function albumId(): Promise<string> {
  const { path } = await Media.getAlbumsPath();
  const find = async () =>
    (await Media.getAlbums()).albums.find((a) => a.name === ALBUM && a.identifier.startsWith(path))?.identifier;
  let id = await find();
  if (!id) {
    await Media.createAlbum({ name: ALBUM });
    id = await find();
  }
  if (!id) throw new Error('não consegui criar o álbum');
  return id;
}

/** Salva a imagem na galeria do celular, no álbum "Lanterninha". */
export async function saveNative(blob: Blob, name: string) {
  await Media.savePhoto({
    path: `data:${blob.type || 'image/jpeg'};base64,` + (await toBase64(blob)),
    albumIdentifier: await albumId(),
    fileName: name.replace(/\.\w+$/, ''),
  });
}
