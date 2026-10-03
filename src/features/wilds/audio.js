import { clockRandom } from '../../core/test-pins.js';

const attackCues = {
  charge: [[110, .65, 'triangle', .34, 65], [220, .65, 'sine', .12, 165]],
  sweep: [[185, .7, 'triangle', .24, 280], [370, .65, 'sine', .1, 160]],
  stomp: [[65, .85, 'triangle', .38, 42], [130, .7, 'sine', .14, 65]],
  roots: [[115, .9, 'sawtooth', .12, 170], [230, .75, 'sine', .12, 115]],
};

export function createWildsAudio() {
  let context = null, master = null, muted = false, stopped = false, serial = -1, hit = 0;
  const voices = new Set();
  function releaseVoices() {
    for (const voice of voices) {
      voice.oscillator.onended = null;
      try { voice.oscillator.stop(); } catch {}
      voice.oscillator.disconnect(); voice.envelope.disconnect();
    }
    voices.clear();
  }
  function unlock() {
    if (stopped) return;
    if (!context) {
      const Audio = globalThis.window?.AudioContext || globalThis.window?.webkitAudioContext;
      if (!Audio) return;
      try {
        context = new Audio(); master = context.createGain(); master.gain.value = muted ? 0 : .18; master.connect(context.destination);
      } catch {
        context?.close().catch(() => {}); context = null; master = null;
        return;
      }
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
  }
  function tone(frequency, duration, type = 'sine', amount = .3, end = frequency) {
    if (stopped || muted || !context || context.state !== 'running') return;
    const oscillator = context.createOscillator(), envelope = context.createGain(), now = context.currentTime, voice = { oscillator, envelope };
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, now); oscillator.frequency.exponentialRampToValueAtTime(Math.max(15, end), now + duration);
    envelope.gain.setValueAtTime(.001, now); envelope.gain.exponentialRampToValueAtTime(amount, now + .015); envelope.gain.exponentialRampToValueAtTime(.001, now + duration);
    oscillator.connect(envelope); envelope.connect(master); voices.add(voice);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); voices.delete(voice); };
    oscillator.start(now); oscillator.stop(now + duration + .02);
  }
  return {
    unlock,
    setMuted(value) { if (stopped) return; muted = Boolean(value); if (master) master.gain.setTargetAtTime(muted ? 0 : .18, context.currentTime, .05); },
    suspend() { if (stopped) return; releaseVoices(); if (context?.state === 'running') context.suspend().catch(() => {}); },
    update(encounter, simulation) {
      if (stopped) return;
      const action = encounter.boss.action;
      if (action.serial !== serial) {
        serial = action.serial;
        for (const cue of attackCues[action.kind] || []) tone(...cue);
        if (action.kind === 'stunned') { tone(92, .4, 'triangle', .5, 35); tone(392, .8, 'sine', .2); }
        if (action.kind === 'phase') tone(146, 1.2, 'triangle', .3, 73);
        if (action.kind === 'defeat') { tone(262, 1.4, 'sine', .2); tone(330, 1.6, 'sine', .16); tone(392, 1.9, 'sine', .12); }
      }
      if (simulation.lastHit?.serial && simulation.lastHit.serial !== hit) {
        hit = simulation.lastHit.serial; tone(150 + clockRandom() * 30, .13, 'triangle', .4, 42); tone(680, .07, 'sine', .08, 320);
      }
    },
    dispose() {
      if (stopped) return;
      stopped = true; releaseVoices(); master?.disconnect();
      if (context) context.close().catch(() => {});
      context = null; master = null;
    },
  };
}
