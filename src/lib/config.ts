// Endereço e chave pública do Supabase. A chave "publishable" é feita para ficar no código:
// quem protege os dados são as regras de acesso (RLS) no banco.
export const SUPABASE_URL = 'https://diyqoytezequhjzobxpi.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_2e2wmfwPRpExRQ_KMrqBfQ_V_VumbRg';

/** Onde ficam as funções /api (busca de filmes, detalhes, pôster). No site é o próprio endereço;
 *  dentro do aplicativo (Capacitor) precisa ser o endereço completo do site publicado. */
export const isNativeApp = !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
export const API_BASE = isNativeApp ? 'https://lanterninha.vercel.app/' : '/';
/** Endereço do site publicado. Os links dos e-mails (ex.: senha nova) abrem sempre aqui. */
export const SITE_URL = 'https://lanterninha.vercel.app/';
export const IMG = 'https://image.tmdb.org/t/p/';

/** Versão do Lanterninha (aparece nas Configurações). Muda a cada funcionalidade nova:
 *  chega a todo mundo pela Vercel e NÃO pede APK novo. */
export const APP_VERSION = '2.2.0';

/** Versão mais nova do APK. É separada da APP_VERSION: só muda quando mexer na parte nativa
 *  (Capacitor, plugins, ícone, nome, assinatura). Quando gerar um APK novo:
 *  1) aumente o versionCode (e o versionName) no android/app/build.gradle;
 *  2) coloque o APK em public/lanterninha.apk;
 *  3) mude build e name para os mesmos, no MESMO deploy do APK.
 *  Quem estiver com um APK mais velho (build menor) vê o aviso para atualizar. */
export const LATEST_APK = {
  build: 5,
  name: '2.0.1',
  news: 'O app agora tem assinatura própria, mais segura',
};
/** Último APK assinado com a chave de debug (do PC). Quem está nele ou antes não consegue instalar
 *  por cima do APK novo (a assinatura mudou): o aviso mostra o passo a passo para reinstalar. */
export const LAST_DEBUG_APK = 4;
/** "http" de propósito: um endereço diferente do app faz o celular abrir o navegador, que baixa o arquivo.
 *  (A Vercel passa sozinha para https.) */
export const APK_URL = 'http://lanterninha.vercel.app/lanterninha.apk';
