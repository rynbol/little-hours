import { clockRandom } from './test-pins.js';

export const LIGHTNING = Object.freeze({
  firstAfter: Object.freeze([10, 35]), gap: Object.freeze([24, 75]), rest: 4, stale: 2,
  pulseGap: Object.freeze([0.36, 0.6]), peaks: Object.freeze([1, 0.55, 0.32]), rise: 0.05, decay: 0.2, tail: 6,
  boltChance: 0.45, bolts: 3, bearing: Object.freeze([-0.15, 0]), distance: Object.freeze([4200, 4600]), sound: 343,
});
export const LIGHTNING_RAINBOW_GAP = 12;

const between = ([low, high], random) => low + (high - low) * random();

export function pulseLevel(age) {
  if (age < 0) return 0;
  return age < LIGHTNING.rise ? age / LIGHTNING.rise : Math.exp(-(age - LIGHTNING.rise) / LIGHTNING.decay);
}

export function createLightning({ random = clockRandom, onStrike } = {}) {
  const offsets = new Float64Array(LIGHTNING.peaks.length);
  const shape = { pulses: 0, bolt: -1, bearing: 0, distance: 0, start: 0, end: 0 };
  let nextAt = null, active = false, forced = false, level = 0, idleSince = -Infinity;

  function begin(now) {
    shape.pulses = 1 + Math.floor(random() * LIGHTNING.peaks.length);
    for (let i = 1; i < shape.pulses; i++) offsets[i] = offsets[i - 1] + between(LIGHTNING.pulseGap, random);
    shape.bolt = random() < LIGHTNING.boltChance ? Math.floor(random() * LIGHTNING.bolts) : -1;
    shape.bearing = between(LIGHTNING.bearing, random);
    shape.distance = between(LIGHTNING.distance, random);
    shape.start = now; shape.end = now + offsets[shape.pulses - 1] + LIGHTNING.rise + LIGHTNING.decay * LIGHTNING.tail;
    active = true; forced = false;
    onStrike?.(shape);
  }
  function calm(now) {
    if (active) idleSince = now;
    active = false; forced = false; level = 0;
  }

  return {
    shape,
    get level() { return level; },
    get active() { return active; },
    get idleSince() { return idleSince; },
    get nextAt() { return nextAt; },
    get thunderDelay() { return shape.distance / LIGHTNING.sound; },
    strike() { if (!active) forced = true; },
    update(now, storming, still) {
      if (!storming || still) { calm(now); nextAt = null; return level; }
      nextAt ??= now + between(LIGHTNING.firstAfter, random);
      if (!active && (forced || now >= nextAt) && now - idleSince >= LIGHTNING.rest) {
        if (!forced && now - nextAt > LIGHTNING.stale) nextAt = now + between(LIGHTNING.gap, random);
        else begin(now);
      }
      if (!active) return level;
      if (now >= shape.end) { calm(now); nextAt = now + between(LIGHTNING.gap, random); return level; }
      const age = now - shape.start;
      let sum = 0;
      for (let i = 0; i < shape.pulses; i++) sum += LIGHTNING.peaks[i] * pulseLevel(age - offsets[i]);
      level = Math.min(1, sum);
      return level;
    },
  };
}
