// Boas-vindas e primeira nota guiada: o que já foi mostrado fica guardado no aparelho.
import { nav } from '../nav';

const WELCOME = 'lantBoasVindas';
const GUIDE = 'lantGuia';
const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const put = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* modo privado: segue sem guardar */ } };

export const guide = {
  /** A tela de boas-vindas ainda não apareceu neste aparelho */
  welcomeDue: () => get(WELCOME) !== '1',
  welcomeSeen: () => put(WELCOME, '1'),
  /** Conta acabou de ser criada: a primeira nota guiada fica esperando a pessoa sair do cadastro */
  mark: () => put(GUIDE, 'pending'),
  pending: () => get(GUIDE) === 'pending',
  /** Abre a primeira nota guiada (só uma vez por conta nova; depois, só pelo "Rever o tutorial") */
  start() {
    put(GUIDE, 'done');
    nav.tab('rate');
    nav.push({ k: 'guide' });
  },
  /** "Rever o tutorial", nas Configurações */
  replay() {
    nav.home();
    guide.start();
  },
};
