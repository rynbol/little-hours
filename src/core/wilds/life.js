import { clockRandom } from '../test-pins.js';
import { weather } from './weather.js';

const freeze = Object.freeze;
export const LIFE = freeze({
  deer: freeze({ startle: 20, calm: 14, run: 9, bolt: 2.8, walk: 1.2, turn: 0.6, graze: freeze([2.5, 6]), herd: freeze([freeze([-6, -289, 0.4]), freeze([8, -291, 2.6]), freeze([24, -287, 4.2])]) }),
  leaves: freeze({ count: 40, fall: 0.7, sway: 0.8, rest: freeze([5, 9]), fade: 1.4, drift: 0.35, wait: freeze([0.2, 2.5]) }),
});

const ramp = (h, from, to) => { const t = Math.min(1, Math.max(0, (h - from) / (to - from))); return t * t * (3 - 2 * t); };
const between = ([low, high], random) => low + (high - low) * random();

export function lifeAt(hour, out = { motes: 0, fireflies: 0, mist: 0, birds: 0, butterflies: 0 }) {
  const h = ((hour % 24) + 24) % 24, { rain, cloud } = weather(h);
  out.motes = ramp(h, 6.3, 7.6) * (1 - ramp(h, 19.9, 20.7)) * (1 - cloud);
  out.fireflies = Math.max(ramp(h, 19.7, 20.9), 1 - ramp(h, 4.6, 5.7));
  const morning = h < 12 ? (0.6 + 0.4 * ramp(h, 3.5, 5.2)) * (1 - ramp(h, 6.6, 8.6)) : 0;
  out.mist = Math.max(ramp(h, 21, 23) * 0.6, morning) + rain * 0.3;
  out.birds = ramp(h, 5.8, 7) * (1 - ramp(h, 19.6, 20.6)) * (1 - rain * 0.85);
  out.butterflies = ramp(h, 7.5, 9) * (1 - ramp(h, 18.6, 19.6)) * (1 - cloud);
  return out;
}

export function createHerd(spots = LIFE.deer.herd, random = clockRandom) {
  return spots.map(([x, z, facing], i) => ({ id: `deer-${i}`, x, z, facing, home: [x, z], state: 'graze', time: 0, wait: between(LIFE.deer.graze, random), speed: 0, head: 1 }));
}

function stride(deer, speed, dt, blocked) {
  for (let tries = 0; tries < 6; tries++) {
    const x = deer.x + Math.sin(deer.facing) * speed * dt, z = deer.z + Math.cos(deer.facing) * speed * dt;
    if (!blocked(x, z)) { deer.x = x; deer.z = z; deer.speed = speed; return; }
    deer.facing += LIFE.deer.turn;
  }
  deer.speed = 0;
}

export function stepHerd(herd, player, dt, { random = clockRandom, blocked = () => false } = {}) {
  const D = LIFE.deer;
  for (const deer of herd) {
    deer.time += dt;
    const dx = deer.x - player.x, dz = deer.z - player.z, near = Math.hypot(dx, dz) < D.startle;
    if (near && deer.state !== 'bolt') { deer.state = 'bolt'; deer.time = 0; deer.facing = Math.atan2(dx, dz) + (random() - 0.5) * 0.5; }
    if (deer.state === 'bolt') {
      const easing = Math.min(1, (D.bolt - deer.time) / 0.5);
      stride(deer, D.run * Math.max(0.2, easing), dt, blocked);
      if (deer.time >= D.bolt) { deer.state = 'wary'; deer.time = 0; deer.speed = 0; }
    } else if (deer.state === 'wary') {
      deer.speed = 0;
      if (deer.time >= D.calm) { deer.state = 'return'; deer.time = 0; }
    } else if (deer.state === 'return') {
      const hx = deer.home[0] - deer.x, hz = deer.home[1] - deer.z, left = Math.hypot(hx, hz);
      if (left <= D.walk * dt) { deer.x = deer.home[0]; deer.z = deer.home[1]; deer.state = 'graze'; deer.time = 0; deer.speed = 0; deer.wait = between(D.graze, random); }
      else { deer.facing = Math.atan2(hx, hz); stride(deer, D.walk, dt, blocked); }
    } else {
      deer.speed = 0;
      if (deer.time >= deer.wait) { deer.state = deer.state === 'graze' ? 'look' : 'graze'; deer.time = 0; deer.wait = between(D.graze, random); }
    }
    const down = deer.state === 'graze' ? 1 : 0;
    deer.head += (down - deer.head) * Math.min(1, dt * 3);
  }
  return herd;
}

export function createLeaves(count = LIFE.leaves.count) {
  return Array.from({ length: count }, (_, i) => ({ state: 'wait', time: 0, wait: i * 0.15, x: 0, y: 0, z: 0, phase: 0, spin: 0, petal: false, floor: 0, afloat: false, rest: 0, fade: 1 }));
}

export function stepLeaves(leaves, dt, { sources, floor, water, flow, random = clockRandom }) {
  const L = LIFE.leaves;
  for (const leaf of leaves) {
    leaf.time += dt;
    if (leaf.state === 'wait') {
      if (leaf.time < leaf.wait || !sources.length) continue;
      const tree = sources[Math.floor(random() * sources.length)], angle = random() * Math.PI * 2, r = Math.sqrt(random()) * tree.radius;
      Object.assign(leaf, { state: 'fall', time: 0, x: tree.x + Math.cos(angle) * r, z: tree.z + Math.sin(angle) * r, y: tree.y - random() * tree.radius * 0.4, phase: random() * Math.PI * 2, spin: 1 + random() * 2, petal: random() < 0.3, fade: 1, afloat: false });
    } else if (leaf.state === 'fall') {
      const sway = Math.sin(leaf.time * 2.2 + leaf.phase);
      leaf.x += Math.cos(leaf.phase) * sway * L.sway * dt;
      leaf.z += Math.sin(leaf.phase) * sway * L.sway * dt;
      leaf.y -= L.fall * (0.75 + 0.25 * Math.abs(sway)) * dt;
      const ground = floor(leaf.x, leaf.z), level = water(leaf.x, leaf.z), rest = Math.max(ground, level);
      if (leaf.y <= rest) { leaf.y = rest; leaf.afloat = level > ground; leaf.state = 'rest'; leaf.time = 0; leaf.rest = between(L.rest, random); }
    } else if (leaf.state === 'rest') {
      if (leaf.afloat) { const [fx, fz] = flow(leaf.x, leaf.z); leaf.x += (fx + Math.cos(leaf.phase) * 0.1) * L.drift * dt; leaf.z += (fz + Math.sin(leaf.phase) * 0.1) * L.drift * dt; }
      if (leaf.time >= leaf.rest) { leaf.state = 'fade'; leaf.time = 0; }
    } else if (leaf.state === 'fade') {
      leaf.fade = Math.max(0, 1 - leaf.time / L.fade);
      if (leaf.fade <= 0) { leaf.state = 'wait'; leaf.time = 0; leaf.wait = between(L.wait, random); }
    }
  }
  return leaves;
}
