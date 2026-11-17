// Endereço e chave pública do Supabase. A chave "publishable" é feita para ficar no código:
// quem protege os dados são as regras de acesso (RLS) no banco.
export const SUPABASE_URL = 'https://diyqoytezequhjzobxpi.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_2e2wmfwPRpExRQ_KMrqBfQ_V_VumbRg';

/** Onde ficam as funções /api (busca de filmes, detalhes, pôster). No site é o próprio endereço;
 *  dentro do aplicativo (Capacitor) precisa ser o endereço completo do site publicado. */
export const isNativeApp = !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
export const API_BASE = isNativeApp ? 'https://lanterninha.vercel.app/' : '/';
export const IMG = 'https://image.tmdb.org/t/p/';

/** Versão mais nova do app de celular. Quando gerar um APK novo:
 *  1) aumente o versionCode no android/app/build.gradle;
 *  2) coloque o APK em public/lanterninha.apk;
 *  3) mude estes números para os mesmos. Quem estiver com um APK mais velho vê o aviso para atualizar. */
export const LATEST_APK = { build: 2, name: '1.1', news: 'Cinemas perto de mim no ingresso' };
/** "http" de propósito: um endereço diferente do app faz o celular abrir o navegador, que baixa o arquivo.
 *  (A Vercel passa sozinha para https.) */
export const APK_URL = 'http://lanterninha.vercel.app/lanterninha.apk';
