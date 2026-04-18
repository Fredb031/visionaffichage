// Vision Affichage cinematic intro — Web Audio API sound design.
// All sounds are synthesized live; no audio files needed.

type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };

let ctxSingleton: AudioContext | null = null;
let convolverSingleton: ConvolverNode | null = null;
let masterGainSingleton: GainNode | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctxSingleton) return ctxSingleton;
  const w = window as WindowWithWebkit;
  const Ctor = window.AudioContext || w.webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctxSingleton = new Ctor();
  } catch {
    return null;
  }
  return ctxSingleton;
}

function generateReverb(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const impulse = ctx.createBuffer(2, length, sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

function ensureMasterChain(): { ctx: AudioContext; convolver: ConvolverNode; master: GainNode } | null {
  const ctx = getCtx();
  if (!ctx) return null;
  if (!masterGainSingleton) {
    masterGainSingleton = ctx.createGain();
    masterGainSingleton.gain.setValueAtTime(0.85, ctx.currentTime);
    masterGainSingleton.connect(ctx.destination);
  }
  if (!convolverSingleton) {
    convolverSingleton = ctx.createConvolver();
    convolverSingleton.buffer = generateReverb(ctx, 2.5, 3.0);
    convolverSingleton.connect(masterGainSingleton);
  }
  return { ctx, convolver: convolverSingleton, master: masterGainSingleton };
}

export async function unlockAudio(): Promise<boolean> {
  const ctx = getCtx();
  if (!ctx) return false;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      return false;
    }
  }
  return ctx.state === 'running';
}

/** Layer 1 — Horizon tone. 220 Hz sine, fades over 1.8s. */
export function playHorizonTone(delaySec = 0): void {
  const chain = ensureMasterChain();
  if (!chain) return;
  const { ctx, convolver, master } = chain;
  const t0 = ctx.currentTime + delaySec;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, t0);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(0.08, t0 + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.8);

  // Wet to convolver, dry blended at 10% to master
  const dry = ctx.createGain();
  dry.gain.setValueAtTime(0.1, t0);

  osc.connect(gain);
  gain.connect(convolver);
  gain.connect(dry);
  dry.connect(master);

  osc.start(t0);
  osc.stop(t0 + 2.0);
}

/** Layer 2 — Logo tone. 440 Hz + 880 Hz shimmer through lowpass. */
export function playLogoTone(delaySec = 0): void {
  const chain = ensureMasterChain();
  if (!chain) return;
  const { ctx, convolver } = chain;
  const t0 = ctx.currentTime + delaySec;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2000, t0);
  filter.Q.setValueAtTime(0.8, t0);
  filter.connect(convolver);

  // Fundamental
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(440, t0);
  const g1 = ctx.createGain();
  g1.gain.setValueAtTime(0, t0);
  g1.gain.linearRampToValueAtTime(0.12, t0 + 0.002);
  g1.gain.setValueAtTime(0.12, t0 + 0.082);
  g1.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
  osc1.connect(g1);
  g1.connect(filter);
  osc1.start(t0);
  osc1.stop(t0 + 1.5);

  // Shimmer harmonic
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(880, t0);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0, t0);
  g2.gain.linearRampToValueAtTime(0.04, t0 + 0.002);
  g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
  osc2.connect(g2);
  g2.connect(filter);
  osc2.start(t0);
  osc2.stop(t0 + 0.4);
}

/** Layer 3 — Exit whisper. Filtered noise burst, sub-perceptible. */
export function playExitWhisper(delaySec = 0): void {
  const chain = ensureMasterChain();
  if (!chain) return;
  const { ctx, convolver } = chain;
  const t0 = ctx.currentTime + delaySec;

  // 0.4s of white noise
  const len = Math.floor(ctx.sampleRate * 0.4);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(800, t0);
  filter.Q.setValueAtTime(4.0, t0);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(0.04, t0 + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(convolver);
  src.start(t0);
}

export function disposeAudio(): void {
  if (ctxSingleton) {
    try { ctxSingleton.close(); } catch { /* noop */ }
  }
  ctxSingleton = null;
  convolverSingleton = null;
  masterGainSingleton = null;
}
