// One owner for the room's sound: the soft rain loop and the chime at the end
// of a focus session. The context is created on a user gesture, suspended
// whenever nothing is playing so the audio device can sleep, and only the
// listener's choices are remembered, never a playing sound.
export const soundKey = 'little-hours-sound';
const DEFAULTS = { volume: 30, chime: true };

export function restoreSoundPrefs(raw) {
  let saved;
  try { saved = JSON.parse(raw); } catch { saved = null; }
  const prefs = { ...DEFAULTS };
  if (Number.isFinite(saved?.volume)) prefs.volume = Math.min(100, Math.max(0, Math.round(saved.volume)));
  if (typeof saved?.chime === 'boolean') prefs.chime = saved.chime;
  return prefs;
}

export function createAudio(storage) {
  let prefs;
  try { prefs = restoreSoundPrefs(storage.getItem(soundKey)); } catch { prefs = { ...DEFAULTS }; }
  let context = null, rainGain = null, rainSource = null;
  let rain = false, chimeUntil = 0, suspendTimer = 0;

  function save() {
    try { storage.setItem(soundKey, JSON.stringify(prefs)); } catch { /* Preferences are a convenience. */ }
  }
  const rainLevel = () => prefs.volume / 130;

  // Must run inside a user gesture the first time, so browsers allow playback.
  function ensureContext() {
    if (context) return context;
    context = new AudioContext();
    const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
    const data = buffer.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < data.length; i++) { previous = (previous + 0.025 * (Math.random() * 2 - 1)) / 1.025; data[i] = previous * 6; }
    rainSource = context.createBufferSource(); rainSource.buffer = buffer; rainSource.loop = true;
    const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1400;
    rainGain = context.createGain(); rainGain.gain.value = 0;
    rainSource.connect(filter).connect(rainGain).connect(context.destination); rainSource.start();
    return context;
  }

  // Suspend once the rain has faded and any chime has rung out.
  function settle() {
    clearTimeout(suspendTimer);
    if (!context || rain) return;
    const wait = Math.max(800, chimeUntil - performance.now());
    suspendTimer = setTimeout(() => {
      if (!rain && performance.now() >= chimeUntil) context.suspend().catch(() => {});
    }, wait);
  }

  function ring(ctx) {
    const start = ctx.currentTime + 0.05;
    const out = ctx.createGain(); out.gain.value = 0.16; out.connect(ctx.destination);
    // Two soft bell notes: a fundamental with a quiet octave partial each.
    [[659.25, 0], [987.77, 0.34]].forEach(([frequency, delay]) => {
      [[1, 1], [2, 0.18]].forEach(([multiple, level]) => {
        const osc = ctx.createOscillator(), env = ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = frequency * multiple;
        const t = start + delay;
        env.gain.setValueAtTime(0.0001, t);
        env.gain.exponentialRampToValueAtTime(level, t + 0.02);
        env.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
        osc.connect(env).connect(out);
        osc.start(t); osc.stop(t + 1.9);
      });
    });
    chimeUntil = performance.now() + 2600;
  }

  // Only after a gesture has created the context; otherwise stay silent.
  async function chime() {
    if (!prefs.chime || !context) return;
    try { await context.resume(); ring(context); settle(); } catch { /* A missed chime is not worth an error. */ }
  }

  return {
    get prefs() { return { ...prefs }; },
    get raining() { return rain; },
    // Called from the Start button so a later chime is allowed to sound.
    unlock() {
      if (!prefs.chime) return;
      try { ensureContext().resume().then(settle, () => {}); } catch { /* No audio here; the room is still quiet and fine. */ }
    },
    async setRain(on) {
      const ctx = ensureContext();
      await ctx.resume();
      rain = on;
      rainGain.gain.setTargetAtTime(on ? rainLevel() : 0, ctx.currentTime, 0.15);
      settle();
    },
    setVolume(volume) {
      prefs.volume = Math.min(100, Math.max(0, Math.round(volume)));
      save();
      if (rain && context) rainGain.gain.setTargetAtTime(rainLevel(), context.currentTime, 0.1);
    },
    // Turning the chime on is a gesture, so it can play a preview.
    setChime(on, preview = false) {
      prefs.chime = on; save();
      if (!on || !preview) return;
      try { ensureContext(); } catch { return; }
      chime();
    },
    chime,
    dispose() {
      clearTimeout(suspendTimer);
      rainSource?.stop();
      context?.close();
      context = null;
    },
  };
}
