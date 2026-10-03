import { clockRandom } from '../../core/test-pins.js';

export const MIX = Object.freeze({
  master: 0.3, ease: 0.6,
  beds: Object.freeze({
    wind: Object.freeze({ gain: 0.32, filter: 'bandpass', frequency: 420, q: 0.6 }),
    leaves: Object.freeze({ gain: 0.08, filter: 'highpass', frequency: 3200, q: 0.5 }),
    rain: Object.freeze({ gain: 0.32, filter: 'highpass', frequency: 1400, q: 0.4 }),
    stream: Object.freeze({ gain: 0.22, filter: 'bandpass', frequency: 1300, q: 0.45 }),
    falls: Object.freeze({ gain: 0.5, filter: 'lowpass', frequency: 760, q: 0.3 }),
  }),
  steps: Object.freeze({
    grass: Object.freeze({ filter: 'bandpass', frequency: 2300, q: 0.9, length: 0.09, gain: 0.16 }),
    dirt: Object.freeze({ filter: 'lowpass', frequency: 950, q: 0.7, length: 0.07, gain: 0.22 }),
    stone: Object.freeze({ filter: 'bandpass', frequency: 3200, q: 4, length: 0.035, gain: 0.26, knock: 190 }),
    water: Object.freeze({ filter: 'lowpass', frequency: 2200, to: 450, q: 0.8, length: 0.22, gain: 0.3 }),
  }),
  birds: Object.freeze({ every: Object.freeze([1.6, 5.5]), pitch: Object.freeze([2400, 4600]), gain: 0.05 }),
  crickets: Object.freeze({ every: Object.freeze([0.35, 0.9]), pitch: 4600, gain: 0.025 }),
});

const between = ([low, high], random) => low + random() * (high - low);

export function createSound({ random = clockRandom, make = () => new AudioContext() } = {}) {
  const counts = { steps: { grass: 0, dirt: 0, stone: 0, water: 0 }, swishes: 0, thuds: 0, creaks: 0, rumbles: 0, birds: 0, crickets: 0 };
  const targets = [], beds = {};
  let audio = null, master = null, noise = null, muted = false, birdAt = 0, cricketAt = 0, disposed = false;

  function wake() {
    if (disposed) return;
    if (audio) { if (audio.state === 'suspended') audio.resume(); return; }
    try { audio = make(); } catch { return; }
    master = audio.createGain();
    master.gain.value = muted ? 0 : MIX.master;
    master.connect(audio.destination);
    noise = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = random() * 2 - 1;
    for (const [name, bed] of Object.entries(MIX.beds)) {
      const source = audio.createBufferSource(), filter = audio.createBiquadFilter(), gain = audio.createGain();
      source.buffer = noise; source.loop = true;
      filter.type = bed.filter; filter.frequency.value = bed.frequency; filter.Q.value = bed.q;
      gain.gain.value = 0;
      source.connect(filter).connect(gain).connect(master);
      source.start(0, random() * 2);
      beds[name] = gain;
    }
  }

  const voice = (pan = 0) => {
    const level = audio.createGain(), side = audio.createStereoPanner();
    level.gain.value = 0; side.pan.value = pan;
    level.connect(side).connect(master);
    return level;
  };
  const envelope = (param, at, peak, length, attack = 0.005) => {
    param.setValueAtTime(0, at);
    param.linearRampToValueAtTime(peak, at + attack);
    param.exponentialRampToValueAtTime(0.0001, at + length);
  };

  function burst({ filter: type, frequency, to, q, length, gain, attack }, pan = 0) {
    const at = audio.currentTime, source = audio.createBufferSource(), filter = audio.createBiquadFilter(), level = voice(pan);
    source.buffer = noise;
    filter.type = type; filter.Q.value = q;
    const pitch = 0.9 + random() * 0.2;
    filter.frequency.setValueAtTime(frequency * pitch, at);
    if (to) filter.frequency.exponentialRampToValueAtTime(to * pitch, at + length);
    envelope(level.gain, at, gain, length, attack);
    source.connect(filter).connect(level);
    source.start(at, random() * 1.5, length + 0.05);
  }

  function tone({ type = 'sine', frequency, to, length, gain, attack, delay = 0 }, pan = 0) {
    const at = audio.currentTime + delay, oscillator = audio.createOscillator(), level = voice(pan);
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    if (to) oscillator.frequency.exponentialRampToValueAtTime(to, at + length);
    envelope(level.gain, at, gain, length, attack);
    oscillator.connect(level);
    oscillator.start(at); oscillator.stop(at + length + 0.05);
  }

  function birdCall() {
    const base = between(MIX.birds.pitch, random), notes = 2 + Math.floor(random() * 3), pan = random() * 1.6 - 0.8;
    for (let i = 0; i < notes; i++) {
      const length = 0.06 + random() * 0.08;
      tone({ frequency: base * (0.9 + random() * 0.3), to: base * (1.15 + random() * 0.35), length, gain: MIX.birds.gain, attack: 0.01, delay: i * (length + 0.04) }, pan);
    }
    counts.birds++;
  }

  function cricketChirp() {
    const pan = random() * 1.4 - 0.7;
    for (let i = 0; i < 3; i++) tone({ frequency: MIX.crickets.pitch, length: 0.022, gain: MIX.crickets.gain, attack: 0.003, delay: i * 0.05 }, pan);
    counts.crickets++;
  }

  const awake = () => Boolean(audio) && audio.state === 'running';

  return {
    attach(...surfaces) {
      for (const surface of surfaces) { surface.addEventListener('keydown', wake); surface.addEventListener('pointerdown', wake); targets.push(surface); }
    },
    wake,
    hush() { if (audio?.state === 'running') audio.suspend(); },
    get muted() { return muted; },
    setMuted(on) {
      muted = on;
      if (master) master.gain.setTargetAtTime(on ? 0 : MIX.master, audio.currentTime, 0.05);
    },
    update(levels, dt, seconds) {
      if (!awake()) return;
      const at = audio.currentTime, gust = 0.75 + 0.25 * Math.sin(seconds * 0.31) * Math.sin(seconds * 0.17 + 1.3);
      for (const [name, bed] of Object.entries(MIX.beds)) beds[name].gain.setTargetAtTime(levels[name] * bed.gain * (name === 'wind' || name === 'leaves' ? gust : 1), at, MIX.ease);
      if (levels.birds > 0.05 && (birdAt -= dt) <= 0) { birdAt = between(MIX.birds.every, random) / levels.birds; birdCall(); }
      if (levels.crickets > 0.05 && (cricketAt -= dt) <= 0) { cricketAt = between(MIX.crickets.every, random) / levels.crickets; cricketChirp(); }
    },
    step(surface, loud = 1) {
      if (!awake()) return;
      const sound = MIX.steps[surface];
      burst({ ...sound, gain: sound.gain * loud });
      if (sound.knock) tone({ frequency: sound.knock, to: sound.knock * 0.7, length: 0.05, gain: sound.gain * 0.5 * loud });
      counts.steps[surface]++;
    },
    swish(heavy) {
      if (!awake()) return;
      burst({ filter: 'bandpass', frequency: heavy ? 380 : 520, to: heavy ? 1900 : 2600, q: 1.3, length: heavy ? 0.3 : 0.2, gain: heavy ? 0.3 : 0.22, attack: 0.04 });
      counts.swishes++;
    },
    thud(heavy) {
      if (!awake()) return;
      tone({ frequency: heavy ? 120 : 150, to: 48, length: heavy ? 0.26 : 0.18, gain: heavy ? 0.55 : 0.4 });
      burst({ filter: 'lowpass', frequency: 700, q: 0.7, length: 0.06, gain: 0.3 });
      counts.thuds++;
    },
    creak() {
      if (!awake()) return;
      const at = audio.currentTime, oscillator = audio.createOscillator(), filter = audio.createBiquadFilter(), level = voice();
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(68, at);
      oscillator.frequency.linearRampToValueAtTime(96, at + 0.25);
      oscillator.frequency.linearRampToValueAtTime(74, at + 0.7);
      filter.type = 'bandpass'; filter.frequency.value = 620; filter.Q.value = 7;
      envelope(level.gain, at, 0.2, 0.75, 0.08);
      oscillator.connect(filter).connect(level);
      oscillator.start(at); oscillator.stop(at + 0.8);
      counts.creaks++;
    },
    rumble() {
      if (!awake()) return;
      burst({ filter: 'lowpass', frequency: 150, q: 0.6, length: 1.4, gain: 0.7, attack: 0.08 });
      counts.rumbles++;
    },
    diagnostics() { return { awake: awake(), state: audio?.state ?? 'asleep', muted, counts: structuredClone(counts) }; },
    dispose() {
      disposed = true;
      for (const surface of targets) { surface.removeEventListener('keydown', wake); surface.removeEventListener('pointerdown', wake); }
      audio?.close();
      audio = null;
    },
  };
}
