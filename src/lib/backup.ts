// Backup em arquivo: exporta e importa todos os filmes do aparelho.
import { cleanFilm, films } from './films';
import { today } from './format';
import type { Film } from './types';

/** Baixa (ou compartilha, no celular) um arquivo com todos os filmes. Devolve a mensagem para mostrar. */
export async function exportBackup(): Promise<string> {
  if (!films.all.length) return 'Ainda não há filmes para exportar.';
  const name = `lanterninha-backup-${today()}.json`;
  const json = JSON.stringify({ app: 'lanterninha', versao: 1, exportadoEm: new Date().toISOString(), filmes: films.all }, null, 1);
  try {
    const file = new File([json], name, { type: 'application/json' });
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
      return 'Backup pronto.';
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return '';
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return 'Backup baixado: ' + name;
}

export async function importBackup(file: File): Promise<string> {
  try {
    const data = JSON.parse(await file.text()) as unknown;
    const raw = Array.isArray(data) ? data : ((data as { filmes?: unknown[] })?.filmes ?? []);
    const list = raw.map(cleanFilm).filter((f): f is Film => !!f);
    if (!list.length) throw new Error('vazio');
    const { added, updated } = films.merge(list);
    return `${added} novos, ${updated} atualizados.`;
  } catch {
    return 'Não consegui ler esse arquivo.';
  }
}
