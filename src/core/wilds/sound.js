import { lifeAt } from './life.js';
import { VALLEY, nearPath, trailDistance } from './valley.js';
import { weather } from './weather.js';

export const SOUND = Object.freeze({
  step: Object.freeze({ shortest: 0.62, longest: 1.25, perSpeed: 0.09, base: 0.5 }),
  stand: 0.25, wade: 0.35, trail: 1.5,
  stream: Object.freeze({ reach: 26, falls: 70 }),
});

const ramp = (h, from, to) => { const t = Math.min(1, Math.max(0, (h - from) / (to - from))); return t * t * (3 - 2 * t); };
const fade = (distance, reach) => Math.max(0, 1 - distance / reach) ** 2;

export function surfaceUnder(body, { ground, water, trail = trailDistance }) {
  const floor = ground(body.x, body.z), level = water(body.x, body.z);
  if (level > floor && body.y < level + SOUND.wade) return 'water';
  if (body.y > floor + SOUND.stand) return 'stone';
  if (trail(body.x, body.z) < SOUND.trail) return 'dirt';
  return 'grass';
}

export const createStride = () => ({ travel: 0, steps: 0 });

export function stride(walk, moved, speed, grounded) {
  if (!grounded) { walk.travel = 0; return false; }
  const S = SOUND.step, length = Math.min(S.longest, Math.max(S.shortest, S.base + speed * S.perSpeed));
  walk.travel += moved;
  if (walk.travel < length) return false;
  walk.travel %= length;
  walk.steps++;
  return true;
}

export function ambience(hour, x, z, out = { wind: 0, leaves: 0, birds: 0, crickets: 0, rain: 0, stream: 0, falls: 0 }) {
  const h = ((hour % 24) + 24) % 24, sky = weather(h), life = lifeAt(h);
  out.rain = sky.rain;
  out.wind = 0.35 + sky.cloud * 0.35 + sky.rain * 0.2;
  out.leaves = out.wind * (1 - sky.rain * 0.5);
  out.birds = life.birds;
  out.crickets = Math.max(ramp(h, 19.4, 20.8), 1 - ramp(h, 4.6, 5.9)) * (1 - sky.rain);
  const [brook] = nearPath(x, z, VALLEY.brook), [stream] = nearPath(x, z, VALLEY.stream);
  out.stream = fade(Math.min(brook, stream), SOUND.stream.reach);
  out.falls = fade(Math.hypot(x - VALLEY.falls.ledge, z - VALLEY.falls.z), SOUND.stream.falls);
  return out;
}
