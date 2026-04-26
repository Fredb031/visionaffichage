// Vision Affichage cinematic intro — Web Audio API sound design.
// All sounds are synthesized live; no audio files needed.

type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };

const MUTE_STORAGE_KEY = 'va:intro-muted';

/** Read the persisted user mute preference. Defaults to false if the key
 * is missing, localStorage is unavailable (SSR, Safari private mode with
 * quota errors, disabled storage), or any access throws. */
export function isMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Persist the user's mute preference. Writes '1' / '0' under
 * `va:intro-muted`. All localStorage failures (quota, disabled storage,
 * private mode) are swallowed so the caller never sees an exception.
 *
 * When toggled to muted while audio is mid-playback, we also ramp the
 * master gain to silence and stop every scheduled source so the user
 * actually hears silence immediately — without this, the flag only
 * suppresses *future* play* calls and the in-flight intro keeps playing
 * through to its natural end. */
export function setMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0');
  } catch {
    /* storage disabled / quota exceeded — silently ignore */
  }
  if (muted && ctxSingleton && masterGainSingleton) {
    try {
      const now = ctxSingleton.currentTime;
      masterGainSingleton.gain.cancelScheduledValues(now);
      masterGainSingleton.gain.setValueAtTime(masterGainSingleton.gain.value, now);
      masterGainSingleton.gain.linearRampToValueAtTime(0, now + 0.05);
    } catch {
      /* gain ramp failed — stopAllScheduledAudio below still silences */
    }
    stopAllScheduledAudio();
  } else if (!muted && ctxSingleton && masterGainSingleton) {
    // Restore master gain on unmute — without this, a previous mute
    // leaves master at 0 and every subsequent play* call funnels into a
    // silent chain because ensureMasterChain reuses the existing gain
    // singleton instead of recreating it.
    try {
      const now = ctxSingleton.currentTime;
      masterGainSingleton.gain.cancelScheduledValues(now);
      masterGainSingleton.gain.setValueAtTime(masterGainSingleton.gain.value, now);
      masterGainSingleton.gain.linearRampToValueAtTime(0.85, now + 0.05);
    } catch {
      /* gain ramp failed — next play* call will still attempt audio */
    }
  }
}

/** Returns true when playback should be skipped entirely: either the
 * user has opted out via `va:intro-muted`, or the OS-level
 * prefers-reduced-motion media query is active. Users who reduce motion
 * typically don't want surprise audio either. */
function shouldSkipPlayback(): boolean {
  if (typeof window === 'undefined') return true;
  if (isMuted()) return true;
  try {
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return true;
    }
  } catch {
    /* matchMedia unavailable — fall through, don't block audio */
  }
  return false;
}

let ctxSingleton: AudioContext | null = null;
let convolverSingleton: ConvolverNode | null = null;
let masterGainSingleton: GainNode | null = null;
// Track every source node we schedule so we can stop the ones whose
// start time hasn't elapsed yet (or which are mid-playback) when the
// intro unmounts. Without this, a user who clicks past the intro early
// still hears the exit whisper / lingering tones layered over the next
// page — calling stop(0) cancels both running and scheduled-but-not-yet
// playing oscillators.
type ScheduledSource = OscillatorNode | AudioBufferSourceNode;
const activeSources = new Set<ScheduledSource>();
function trackSource(src: ScheduledSource): void {
  activeSources.add(src);
  src.addEventListener('ended', () => activeSources.delete(src));
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  // Honor the user mute preference + prefers-reduced-motion BEFORE we
  // even instantiate an AudioContext. Skipping here means every public
  // play* entry point becomes a no-op without any extra guards, because
  // they all funnel through ensureMasterChain() → getCtx().
  if (shouldSkipPlayback()) return null;
  if (ctxSingleton) return ctxSingleton;
  try {
    const w = window as WindowWithWebkit;
    const Ctor = window.AudioContext || w.webkitAudioContext;
    if (!Ctor) return null;
    ctxSingleton = new Ctor();
  } catch {
    // Safari private mode, exhausted AudioContext budget, etc. Degrade
    // silently so the intro animation itself still renders.
    ctxSingleton = null;
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
  try {
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
  } catch {
    // Node creation can fail on browsers that report an AudioContext
    // exists but restrict its use (e.g. some WebView configurations).
    // Leave singletons in whatever partial state they reached; the next
    // caller will retry, and play* entry points will simply be no-ops.
    return null;
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

  trackSource(osc);
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
  trackSource(osc1);
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
  trackSource(osc2);
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
  trackSource(src);
  src.start(t0);
}

/** Stop every still-pending or running scheduled source. Safe to call
 * even if the audio context isn't running — stop(0) on an oscillator
 * that hasn't started yet cancels its scheduled start, while a running
 * one halts on the next audio tick. Used by IntroAnimation on unmount
 * so an early click-through doesn't leak the exit whisper into the
 * next page. */
export function stopAllScheduledAudio(): void {
  for (const src of activeSources) {
    try { src.stop(0); } catch { /* already stopped */ }
  }
  activeSources.clear();
}

export function disposeAudio(): void {
  if (ctxSingleton) {
    try { ctxSingleton.close(); } catch { /* noop */ }
  }
  ctxSingleton = null;
  convolverSingleton = null;
  masterGainSingleton = null;
  // Drop tracked sources too — they belong to the now-closed context.
  // Without this, the next intro mount creates a fresh ctx but the
  // Set still holds OscillatorNode refs from the dead one. A later
  // stopAllScheduledAudio() call would iterate orphan nodes (each
  // .stop(0) throws on a closed context, harmlessly caught) and the
  // refs would block GC of the closed context's node graph until the
  // next dispose. Clearing here keeps the singleton state coherent.
  activeSources.clear();
}
