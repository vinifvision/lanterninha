import { useSyncExternalStore } from 'react';
// Efeitos sonoros gerados na hora pelo navegador, sem arquivos de áudio.
// Tocam só em momentos pontuais: avaliação, revelação da nota e o sorteio do "Não sei o que ver hoje".
type Wave = OscillatorType;

let ctx: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;
let on = true;
try { on = localStorage.getItem('lantSom') !== '0'; } catch { /* mantém ligado */ }

/** Sons desligados por enquanto (vão ser refeitos). A vibração continua. Para religar, mude para true. */
export const SOUND_ENABLED = false;

const listeners = new Set<() => void>();

function audio(): AudioContext | null {
  if (!SOUND_ENABLED || !on) return null;
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, vol: number, when = 0, type: Wave = 'sine') {
  const c = audio(); if (!c) return;
  const t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, freq: number, when = 0) {
  const c = audio(); if (!c) return;
  const t = c.currentTime + when;
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 0.2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  n.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(f).connect(g).connect(c.destination);
  n.start(t); n.stop(t + dur + 0.02);
}

const buzz = (ms: number) => { try { if (on && navigator.vibrate) navigator.vibrate(ms); } catch { /* sem vibração */ } };

const STAR_NOTES = [523.25, 587.33, 659.25, 783.99, 880];
const SCALE = [392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];

export const sfx = {
  get on() { return on; },
  toggle(): boolean {
    on = !on;
    try { localStorage.setItem('lantSom', on ? '1' : '0'); } catch { /* ok */ }
    if (on) tone(660, 0.12, 0.06);
    listeners.forEach((l) => l());
    return on;
  },
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },

  /** Toque numa resposta: estalo mecânico + nota de marimba que sobe a escala a cada pergunta. */
  tap(step = 0) {
    const f = SCALE[Math.min(step, SCALE.length - 1)];
    noise(0.012, 0.22, 3400); noise(0.022, 0.15, 1300, 0.05); tone(130, 0.07, 0.09);
    tone(f, 0.32, 0.13, 0.05); tone(f * 4, 0.07, 0.03, 0.05); tone(f * 2, 0.14, 0.03, 0.05, 'triangle');
    buzz(8);
  },
  /** Ajuste de meia estrela para cima ou para baixo. */
  /** Só uma vibração curta, sem som (ex.: puxar para recarregar passou do ponto). */
  haptic(ms = 8) { buzz(ms); },
  tick(up: boolean) { tone(up ? 740 : 520, 0.08, 0.05, 0, 'triangle'); buzz(6); },
  /** Projetor rodando antes da nota aparecer. */
  projector(dur: number) {
    for (let t = 0; t < dur; t += 1 / 17) noise(0.022, 0.035 + 0.05 * (t / dur), 950, t);
    tone(82, dur, 0.035, 0, 'sawtooth');
  },
  /** Uma estrela acendendo. */
  star(i: number, when: number, half: boolean) {
    tone(STAR_NOTES[i], half ? 0.3 : 0.55, half ? 0.045 : 0.085, when);
    tone(STAR_NOTES[i] * 2, half ? 0.2 : 0.4, half ? 0.012 : 0.022, when, 'triangle');
    setTimeout(() => buzz(half ? 6 : 12), when * 1000);
  },
  /** Sorteio: a película começa a girar (um sopro que sobe). */
  reelStart() {
    for (let k = 0; k < 6; k++) noise(0.09, 0.03 + k * 0.008, 700 + k * 260, k * 0.05);
    tone(70, 0.5, 0.04, 0, 'sawtooth');
  },
  /** Sorteio: um quadro passando pela janela. Os tiques vão espaçando conforme a película desacelera. */
  reelTicks(times: number[]) {
    times.forEach((t, i) => {
      const late = i / Math.max(1, times.length - 1);
      noise(0.014, 0.12 + 0.1 * late, 3000 - 900 * late, t);
      tone(1500 - 500 * late, 0.03, 0.025 + 0.025 * late, t, 'triangle');
      if (late > 0.75) setTimeout(() => buzz(5), t * 1000);
    });
  },
  /** Sorteio: a película trava no filme escolhido (batida + acorde que acende). */
  reelLand(when = 0) {
    noise(0.05, 0.28, 520, when); tone(98, 0.22, 0.12, when);
    [523.25, 659.25, 783.99, 1046.5].forEach((f, k) => tone(f, 0.9, 0.05, when + 0.12 + k * 0.06));
    tone(1568, 0.6, 0.02, when + 0.4, 'triangle');
    setTimeout(() => buzz(18), when * 1000);
  },
  /** Ingresso: o canhoto sendo rasgado no picote (papel). */
  rip() {
    for (let k = 0; k < 9; k++) noise(0.03, 0.09 + 0.02 * Math.sin(k), 2600 - k * 170, k * 0.022);
    noise(0.06, 0.08, 900, 0.21);
    buzz(10);
  },
  /** Baú da infância: um cartão saindo (já vi sobe a nota, não vi desce, não lembro fica no meio). */
  swipe(kind: 'seen' | 'no' | 'idk') {
    noise(0.08, 0.06, kind === 'idk' ? 1800 : 1200);
    if (kind === 'seen') { tone(659.25, 0.18, 0.06, 0.02); tone(987.77, 0.22, 0.05, 0.08); }
    else if (kind === 'no') tone(330, 0.14, 0.04, 0.02, 'triangle');
    else tone(523.25, 0.16, 0.035, 0.02, 'triangle');
    buzz(kind === 'seen' ? 12 : 6);
  },
  /** Brilho final para notas altas. */
  fanfare(when: number) { [1046.5, 1318.5, 1568].forEach((f, k) => tone(f, 0.7, 0.035, when + k * 0.07)); },
};

/** Diz se o som está ligado e avisa quando muda. */
export function useSound(): boolean {
  return useSyncExternalStore(sfx.subscribe, () => sfx.on);
}
