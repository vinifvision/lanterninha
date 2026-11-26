import { describe, expect, it } from 'vitest';
import { clamp, duration, fd, fmt, nFriends, pname, sinceText } from './format';

describe('fmt', () => {
  it('mostra a nota com vírgula', () => {
    expect(fmt(4.5)).toBe('4,5');
    expect(fmt(3)).toBe('3');
  });
});

describe('clamp', () => {
  it('mantém a nota entre 0,5 e 5', () => {
    expect(clamp(7)).toBe(5);
    expect(clamp(0)).toBe(0.5);
    expect(clamp(3.5)).toBe(3.5);
  });
});

describe('fd', () => {
  it('troca AAAA-MM-DD por DD/MM/AAAA', () => {
    expect(fd('2026-11-26')).toBe('26/11/2026');
  });

  it('devolve vazio sem data', () => {
    expect(fd(undefined)).toBe('');
  });
});

describe('nFriends', () => {
  it('usa singular e plural', () => {
    expect(nFriends(1)).toBe('1 amigo');
    expect(nFriends(3)).toBe('3 amigos');
  });
});

describe('duration', () => {
  it('mostra horas e minutos', () => {
    expect(duration(135)).toBe('2h15min');
    expect(duration(45)).toBe('45min');
  });

  it('devolve vazio sem duração', () => {
    expect(duration(0)).toBe('');
  });
});

describe('pname', () => {
  it('prefere o nome, depois o @usuário, depois "Alguém"', () => {
    expect(pname({ display_name: 'Vini', username: 'vini' })).toBe('Vini');
    expect(pname({ display_name: '', username: 'vini' })).toBe('@vini');
    expect(pname(null)).toBe('Alguém');
  });
});

describe('sinceText', () => {
  it('monta o texto com mês e ano', () => {
    expect(sinceText('2026-11-15T12:00:00Z')).toBe('No Lanterninha desde novembro de 2026');
  });

  it('devolve vazio com data inválida ou sem data', () => {
    expect(sinceText('não é data')).toBe('');
    expect(sinceText()).toBe('');
  });
});
