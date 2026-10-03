export const SHOWER = Object.freeze({ gather: 15.6, rain: 16.1, peak: 16.4, ease: 17, dry: 17.35, clear: 17.9, wet: 18.7, bow: Object.freeze([17.2, 17.75, 18.6]) });

const ramp = (h, from, to) => { const t = Math.min(1, Math.max(0, (h - from) / (to - from))); return t * t * (3 - 2 * t); };

export const createWeather = () => ({ cloud: 0, rain: 0, wet: 0, rainbow: 0 });

export function weather(hour, out = createWeather()) {
  const h = ((hour % 24) + 24) % 24, s = SHOWER;
  out.cloud = ramp(h, s.gather, s.rain) * (1 - ramp(h, s.dry, s.clear));
  out.rain = ramp(h, s.rain, s.peak) * (1 - ramp(h, s.ease, s.dry));
  out.wet = ramp(h, s.rain, s.peak) * (1 - ramp(h, s.dry, s.wet));
  out.rainbow = ramp(h, s.bow[0], s.bow[1]) * (1 - ramp(h, s.bow[1], s.bow[2]));
  return out;
}
