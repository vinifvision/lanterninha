// Endereço e chave pública do Supabase. A chave "publishable" é feita para ficar no código:
// quem protege os dados são as regras de acesso (RLS) no banco.
export const SUPABASE_URL = 'https://diyqoytezequhjzobxpi.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_2e2wmfwPRpExRQ_KMrqBfQ_V_VumbRg';

/** Onde ficam as funções /api (busca de filmes, detalhes, pôster). No site é o próprio endereço;
 *  dentro do aplicativo (Capacitor) precisa ser o endereço completo do site publicado. */
export const isNativeApp = !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
export const API_BASE = isNativeApp ? 'https://lanterninha.vercel.app/' : '/';
export const IMG = 'https://image.tmdb.org/t/p/';
