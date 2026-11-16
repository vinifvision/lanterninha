// As perguntas da avaliação e a conta que transforma respostas em estrelas.
import { clamp } from './format';

export interface Question {
  q: string;
  /** Texto de apoio embaixo da pergunta */
  s?: string;
  /** Peso da pergunta na nota final */
  w: number;
  /** As cinco respostas, da melhor para a pior */
  o: string[];
}

/** Valor de cada resposta, da melhor (1) para a pior. */
const VALUES = [1, 0.78, 0.55, 0.3, 0.05];

const BASE: Question[] = [
  { q: 'Como você saiu do filme?', w: 3, o: ['Apaixonado', 'Feliz, gostei bastante', 'Satisfeito, foi ok', 'Meio frustrado', 'Decepcionado'] },
  { q: 'Prendeu sua atenção?', w: 2, o: ['O tempo todo', 'Quase o tempo todo', 'Indo e voltando', 'Só em poucas partes', 'Quase nada'] },
  { q: 'Sentiu alguma coisa?', s: 'Riu, chorou, ficou tenso, se arrepiou…', w: 2, o: ['Muito, me pegou forte', 'Bastante', 'Um pouco', 'Bem pouco', 'Nada'] },
  { q: 'Vai ficar na sua cabeça?', w: 2, o: ['Por anos', 'Por semanas', 'Por uns dias', 'Até amanhã', 'Já esqueci'] },
  { q: 'Veria de novo?', w: 2, o: ['Hoje mesmo', 'Com certeza, um dia', 'Talvez', 'Difícil', 'Nunca'] },
  { q: 'Algo te impressionou?', s: 'Uma cena, uma atuação, uma imagem, a música…', w: 1, o: ['Quase tudo', 'Várias coisas', 'Uma coisa ou outra', 'Quase nada', 'Nada'] },
  { q: 'Recomendaria?', w: 1, o: ['Pra todo mundo', 'Pra maioria', 'Pra quem curte o estilo', 'Pra poucos', 'Pra ninguém'] },
];
const REWATCH: Question[] = [
  { q: 'Como foi rever?', s: 'Comparando com a última vez.', w: 2, o: ['Ainda melhor', 'Tão bom quanto', 'Um pouco menos', 'Bem menos', 'Perdeu a graça'] },
];
const CLASSIC: Question[] = [
  { q: 'Envelheceu bem?', s: 'Assistindo hoje, como ele se sai?', w: 1.5, o: ['Parece feito hoje', 'Bem, com um detalhe ou outro', 'Dá pra sentir a idade', 'Bastante datado', 'Difícil de assistir hoje'] },
  { q: 'Pra você, a fama é merecida?', s: 'Esquece o que os outros dizem.', w: 1.5, o: ['Totalmente', 'Em boa parte', 'Mais ou menos', 'Pouco', 'Não entendi a fama'] },
];

export const buildQuestions = (rewatch: boolean, classic: boolean): Question[] =>
  BASE.concat(rewatch ? REWATCH : [], classic ? CLASSIC : []);

/** Média ponderada das respostas, convertida para estrelas de meia em meia (1 a 5). */
export function computeStars(questions: Question[], answers: number[]): number {
  let sum = 0, weight = 0;
  questions.forEach((Q, i) => { sum += VALUES[answers[i]] * Q.w; weight += Q.w; });
  return clamp(Math.round((0.5 + (sum / weight) * 4.5) * 2) / 2);
}

export const classicSeal = (stars: number) =>
  stars >= 4 ? 'Clássico que merece a fama' : stars >= 3 ? 'Respeito mais do que amo' : 'Importante, mas não é pra mim';

/** Filmes com 35 anos ou mais já entram no modo clássico. */
export const looksClassic = (year?: string) => !!(year && +year <= new Date().getFullYear() - 35);
