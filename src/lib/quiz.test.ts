import { describe, expect, it } from 'vitest';
import { buildQuestions, classicSeal, computeStars, looksClassic } from './quiz';

// Respostas: 0 é a melhor opção e 4 é a pior.
const todas = (n: number, resposta: number) => Array(n).fill(resposta);

describe('buildQuestions', () => {
  it('tem 7 perguntas na avaliação normal', () => {
    expect(buildQuestions(false, false)).toHaveLength(7);
  });

  it('ganha 1 pergunta quando é para rever e 2 quando é clássico', () => {
    expect(buildQuestions(true, false)).toHaveLength(8);
    expect(buildQuestions(false, true)).toHaveLength(9);
    expect(buildQuestions(true, true)).toHaveLength(10);
  });
});

describe('computeStars', () => {
  const perguntas = buildQuestions(false, false);

  it('dá 5 estrelas quando todas as respostas são as melhores', () => {
    expect(computeStars(perguntas, todas(7, 0))).toBe(5);
  });

  it('dá meia estrela quando todas as respostas são as piores', () => {
    expect(computeStars(perguntas, todas(7, 4))).toBe(0.5);
  });

  it('dá 3 estrelas quando todas as respostas são as do meio', () => {
    expect(computeStars(perguntas, todas(7, 2))).toBe(3);
  });

  it('sempre devolve uma nota de meia em meia estrela, entre 0,5 e 5', () => {
    const qs = buildQuestions(true, true);
    for (let r = 0; r < 200; r++) {
      const respostas = qs.map(() => Math.floor(Math.random() * 5));
      const nota = computeStars(qs, respostas);
      expect(nota).toBeGreaterThanOrEqual(0.5);
      expect(nota).toBeLessThanOrEqual(5);
      expect(nota * 2).toBe(Math.round(nota * 2));
    }
  });

  it('pergunta com peso maior puxa mais a nota', () => {
    // Melhor resposta na pergunta de peso 3 e pior no resto, contra o contrário.
    const pesoAltoBom = [0, 4, 4, 4, 4, 4, 4];
    const pesoBaixoBom = [4, 4, 4, 4, 4, 4, 0];
    expect(computeStars(perguntas, pesoAltoBom)).toBeGreaterThan(computeStars(perguntas, pesoBaixoBom));
  });
});

describe('classicSeal', () => {
  it('escolhe o selo pela nota', () => {
    expect(classicSeal(4.5)).toBe('Clássico que merece a fama');
    expect(classicSeal(3)).toBe('Respeito mais do que amo');
    expect(classicSeal(2)).toBe('Importante, mas não é pra mim');
  });
});

describe('looksClassic', () => {
  const ano = new Date().getFullYear();

  it('considera clássico o filme com 35 anos ou mais', () => {
    expect(looksClassic(String(ano - 35))).toBe(true);
    expect(looksClassic('1972')).toBe(true);
  });

  it('não considera clássico filme recente ou sem ano', () => {
    expect(looksClassic(String(ano - 34))).toBe(false);
    expect(looksClassic(undefined)).toBe(false);
    expect(looksClassic('')).toBe(false);
  });
});
