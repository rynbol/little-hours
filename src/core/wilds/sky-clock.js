import { smooth } from './noise.js';

export const DAY_SEGMENTS = Object.freeze([
  { name: 'pre-dawn', from: 5, minutes: .6 },
  { name: 'dawn', from: 6, minutes: .8 },
  { name: 'morning', from: 7, minutes: 1.6 },
  { name: 'afternoon', from: 11, minutes: 1.2 },
  { name: 'shower', from: 14, minutes: 1.4 },
  { name: 'afternoon', from: 16, minutes: 1 },
  { name: 'golden', from: 18, minutes: 1.8 },
  { name: 'sunset', from: 19.2, minutes: .8 },
  { name: 'blue', from: 19.6, minutes: .8 },
  { name: 'night', from: 20.3, minutes: 1.6 },
  { name: 'night', from: 28, minutes: .4 },
].map(Object.freeze));

export const DAY_MS = Math.round(DAY_SEGMENTS.reduce((sum, segment) => sum + segment.minutes, 0) * 60_000);
export const NAMED_HOURS = Object.freeze({ morning: 9, shower: 14.9, golden: 18.4, sunset: 19.25, blue: 19.8, night: 23.5, dawn: 6.1 });
const SUNRISE = 5.85, SUNSET = 19.35;

const wrap = hour => ((hour - 5) % 24 + 24) % 24 + 5;

export function hourAt(ms) {
  let left = ((ms % DAY_MS) + DAY_MS) % DAY_MS;
  for (let i = 0; i < DAY_SEGMENTS.length; i++) {
    const segment = DAY_SEGMENTS[i], span = segment.minutes * 60_000, next = DAY_SEGMENTS[i + 1]?.from ?? 29;
    if (left < span) return wrap(segment.from + (next - segment.from) * left / span);
    left -= span;
  }
  return 5;
}

export function msAtHour(hour) {
  const target = wrap(hour);
  let ms = 0;
  for (let i = 0; i < DAY_SEGMENTS.length; i++) {
    const segment = DAY_SEGMENTS[i], next = DAY_SEGMENTS[i + 1]?.from ?? 29, span = segment.minutes * 60_000;
    if (target < next) return ms + span * (target - segment.from) / (next - segment.from);
    ms += span;
  }
  return 0;
}

export const segmentAt = hour => { const h = wrap(hour); return DAY_SEGMENTS.findLast(segment => h >= segment.from).name; };

function orbit(azimuth, elevation) {
  const c = Math.cos(elevation);
  return [Math.sin(azimuth) * c, Math.sin(elevation), Math.cos(azimuth) * c];
}

export function sunDirection(hour) {
  const h = ((hour % 24) + 24) % 24, day = (h - SUNRISE) / (SUNSET - SUNRISE);
  const azimuth = (68 + 224 * day) * Math.PI / 180;
  const elevation = (Math.sin(Math.PI * day) * 58 - 3 * (1 - Math.sin(Math.PI * Math.min(1, Math.max(0, day))))) * Math.PI / 180;
  return orbit(azimuth, day < 0 || day > 1 ? -Math.abs(Math.sin(Math.PI * day)) * .9 - .05 : elevation);
}

export function moonDirection(hour) {
  const h = ((hour % 24) + 24) % 24, night = ((h - 18.6 + 24) % 24) / 12;
  const azimuth = (100 + 170 * night) * Math.PI / 180;
  return orbit(azimuth, (Math.sin(Math.PI * Math.min(1, night)) * 46 - 4) * Math.PI / 180);
}

export function showerAt(hour) {
  const h = wrap(hour);
  return smooth(14.05, 14.45, h) * (1 - smooth(15.4, 15.85, h));
}

export function rainbowAt(hour) {
  const h = wrap(hour);
  return smooth(15.55, 15.9, h) * (1 - smooth(16.5, 17, h));
}

const KEYS = [
  { hour: 5, sky: ['#141a33', '#2a3156'], horizon: '#4a4a6e', key: ['#9fb4e6', .3], ambient: ['#2e3a62', '#191c2a', .55], fog: '#3b4166', haze: .55, stars: .8, mist: .7, exposure: 1.1, shadow: '#5a5e8c', rim: '#8aa0d6' },
  { hour: 5.9, sky: ['#3a4479', '#d8a39c'], horizon: '#f2b38d', key: ['#ffb184', .55], ambient: ['#7a7fae', '#3d3438', .6], fog: '#c9a6a8', haze: .7, stars: .25, mist: 1, exposure: 1.08, shadow: '#7c6f9c', rim: '#ffbf9a' },
  { hour: 6.8, sky: ['#5b86c4', '#f3d0ae'], horizon: '#f8dcbb', key: ['#ffd2a1', 1.35], ambient: ['#a7bce0', '#5e5440', .62], fog: '#e3d2c0', haze: .55, stars: 0, mist: .55, exposure: 1.04, shadow: '#8a86ad', rim: '#ffe0b4' },
  { hour: 9, sky: ['#4f8fd6', '#cfe2ef'], horizon: '#e4eef0', key: ['#fff1d8', 2.1], ambient: ['#b7d0ef', '#6d6a4c', .62], fog: '#d6e3e8', haze: .4, stars: 0, mist: 0, exposure: 1, shadow: '#8e9ac2', rim: '#fff6df' },
  { hour: 13, sky: ['#4a8ad6', '#d3e5ef'], horizon: '#e6eef0', key: ['#fff6e6', 2.25], ambient: ['#bad3f0', '#6d6c50', .6], fog: '#d8e4e8', haze: .38, stars: 0, mist: 0, exposure: .98, shadow: '#8e9bc4', rim: '#fff8e8' },
  { hour: 16.6, sky: ['#5390d2', '#e4dcc4'], horizon: '#f0e2c6', key: ['#ffe2b0', 2.05], ambient: ['#b3c6e4', '#6e6044', .6], fog: '#e2d8c4', haze: .45, stars: 0, mist: 0, exposure: 1, shadow: '#8c8ab4', rim: '#ffe6bc' },
  { hour: 18.4, sky: ['#5f86c4', '#f6c88e'], horizon: '#ffcf8f', key: ['#ffb866', 2.3], ambient: ['#a9b4d8', '#7a5a3c', .6], fog: '#f1c99a', haze: .6, stars: 0, mist: .05, exposure: 1.04, shadow: '#7d6fa6', rim: '#ffc27a' },
  { hour: 19.25, sky: ['#4b5d9e', '#ff9d6b'], horizon: '#ff9a62', key: ['#ff8a4c', 1.5], ambient: ['#8c86b6', '#5a3c34', .62], fog: '#e09a86', haze: .75, stars: .05, mist: .2, exposure: 1.08, shadow: '#6c5a98', rim: '#ff9f6a' },
  { hour: 19.8, sky: ['#2c3a78', '#8d7ab0'], horizon: '#b98bb0', key: ['#9fb2ee', .5], ambient: ['#5a6aa6', '#2a2636', .62], fog: '#6d6a9a', haze: .7, stars: .35, mist: .45, exposure: 1.12, shadow: '#5a5c9a', rim: '#a8b8f0' },
  { hour: 21, sky: ['#0e1430', '#253158'], horizon: '#33406a', key: ['#b4c8ff', .62], ambient: ['#2c3a6a', '#141826', .55], fog: '#262e52', haze: .5, stars: 1, mist: .8, exposure: 1.18, shadow: '#4a5490', rim: '#a9bff5' },
  { hour: 27, sky: ['#0d1330', '#232d54'], horizon: '#2d3762', key: ['#b4c8ff', .6], ambient: ['#2a3866', '#121622', .55], fog: '#242c50', haze: .5, stars: 1, mist: .9, exposure: 1.18, shadow: '#4a5490', rim: '#a9bff5' },
  { hour: 29, sky: ['#141a33', '#2a3156'], horizon: '#4a4a6e', key: ['#9fb4e6', .3], ambient: ['#2e3a62', '#191c2a', .55], fog: '#3b4166', haze: .55, stars: .8, mist: .7, exposure: 1.1, shadow: '#5a5e8c', rim: '#8aa0d6' },
];

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
const mix = (a, b, t) => a.map((value, i) => value + (b[i] - value) * t);
const grey = ([r, g, b], amount, level = 1) => { const l = (r * .3 + g * .55 + b * .15) * level; return [r + (l - r) * amount, g + (l - g) * amount, b + (l - b) * amount]; };

export function skyAt(hour) {
  const h = wrap(hour), i = KEYS.findLastIndex(key => key.hour <= h), a = KEYS[i], b = KEYS[Math.min(KEYS.length - 1, i + 1)];
  const t = b === a ? 0 : smooth(0, 1, (h - a.hour) / (b.hour - a.hour)), lerp = (x, y) => x + (y - x) * t;
  const sun = sunDirection(h), moon = moonDirection(h), shower = showerAt(h), rainbow = rainbowAt(h);
  const sunUp = smooth(-.07, .05, sun[1]), moonKey = (1 - smooth(-.12, -.02, sun[1])) * smooth(-.05, .1, moon[1]);
  const wet = Math.max(shower, smooth(15.4, 15.85, h) * (1 - smooth(15.85, 17.2, h)));
  const keyColor = mix(rgb(a.key[0]), rgb(b.key[0]), t);
  return {
    hour: h,
    segment: segmentAt(h),
    sun, moon,
    keyFrom: sunUp >= moonKey ? 'sun' : 'moon',
    key: { direction: sunUp >= moonKey ? sun : moon, color: grey(keyColor, shower * .55), intensity: lerp(a.key[1], b.key[1]) * (1 - shower * .72) },
    zenith: grey(mix(rgb(a.sky[0]), rgb(b.sky[0]), t), shower * .6, 1 - shower * .2),
    horizon: grey(mix(rgb(a.horizon), rgb(b.horizon), t), shower * .55, 1 - shower * .1),
    glow: grey(mix(rgb(a.sky[1]), rgb(b.sky[1]), t), shower * .6),
    ambient: { sky: grey(mix(rgb(a.ambient[0]), rgb(b.ambient[0]), t), shower * .4), ground: mix(rgb(a.ambient[1]), rgb(b.ambient[1]), t), intensity: lerp(a.ambient[2], b.ambient[2]) * (1 + shower * .25) },
    fog: grey(mix(rgb(a.fog), rgb(b.fog), t), shower * .5, 1 - shower * .12),
    haze: Math.min(1, lerp(a.haze, b.haze) + shower * .35),
    shadow: mix(rgb(a.shadow), rgb(b.shadow), t),
    rim: mix(rgb(a.rim), rgb(b.rim), t),
    stars: lerp(a.stars, b.stars) * (1 - shower),
    mist: lerp(a.mist, b.mist),
    exposure: lerp(a.exposure, b.exposure),
    clouds: .3 + shower * .65 + (1 - sunUp) * .05,
    shower, wet, rainbow,
    night: 1 - smooth(-.12, .02, sun[1]),
    golden: smooth(17.4, 18.2, h) * (1 - smooth(19.3, 19.7, h)),
  };
}
