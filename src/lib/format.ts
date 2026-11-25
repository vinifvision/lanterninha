import type { FilmState, Profile } from './types';

export const LABELS: Record<number, string> = {
  5: 'Obra-prima', 4.5: 'Excelente', 4: 'Muito bom', 3.5: 'Bom', 3: 'Legal',
  2.5: 'Mediano', 2: 'Fraco', 1.5: 'Ruim', 1: 'Muito ruim', 0.5: 'Desastre',
};
export const STATE: Record<FilmState, string> = { want: 'Quero ver', seen: 'Já vi' };
export const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const STAR_PATH = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const POSTER_PATH = /^\/[\w.-]+$/;

/** "No Lanterninha desde novembro de 2026", no fuso de quem está vendo. Vazio se a data não for válida. */
export function sinceText(iso?: string): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return `No Lanterninha desde ${MONTHS[d.getMonth()].toLowerCase()} de ${d.getFullYear()}`;
}

export const pad = (n: number) => String(n).padStart(2, '0');
/** Nota com vírgula, do jeito brasileiro: 4,5 */
export const fmt = (n: number) => String(n).replace('.', ',');
export const clamp = (n: number) => Math.min(5, Math.max(0.5, n));
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
/** AAAA-MM-DD → DD/MM/AAAA */
export const fd = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : '');
export const nFriends = (n: number) => `${n} ${n === 1 ? 'amigo' : 'amigos'}`;
export const pname = (p?: Pick<Profile, 'display_name' | 'username'> | null) =>
  p ? p.display_name || (p.username ? '@' + p.username : 'Alguém') : 'Alguém';
export const duration = (min: number) =>
  min ? (Math.floor(min / 60) ? Math.floor(min / 60) + 'h' : '') + pad(min % 60) + 'min' : '';
