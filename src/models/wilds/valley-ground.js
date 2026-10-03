import { Color } from 'three';
import { fbm, noise2, smooth } from '../../core/world-terrain.js';
import { VALLEY, WATER, lakeEdge, nearSegment, trailDistance, waterAt } from '../../core/wilds/valley.js';
import { groundColour } from './terrain.js';

const TONE = Object.freeze({
  strata: Object.freeze(['#c4a27e', '#d6b48c', '#b48f72', '#ceb092', '#a9836a', '#d9bf98'].map(hex => new Color(hex))),
  meadowWarm: new Color('#a3b247'), meadowCool: new Color('#4f8a52'), moss: new Color('#5d7f3a'), lichen: new Color('#9aa46a'), gravel: new Color('#c7b38f'), pebble: new Color('#9a8670'), wet: new Color('#7d7262'),
  sand: new Color('#cdb994'), silt: new Color('#4f6458'), deep: new Color('#3d5552'), dirt: new Color('#a88561'), packed: new Color('#bf9d72'),
  bark: new Color('#5b4130'), barkLight: new Color('#7a5a40'), masonry: new Color('#b9ad99'), mortar: new Color('#8f8676'), clearing: new Color('#94b456'),
});

function strata(x, z, y, out) {
  const warp = noise2(x / 31, z / 31, 141) * 2.2 + noise2(x / 5, z / 5, 142) * 0.35, layer = (y + warp) / 1.9, index = Math.floor(layer), t = smooth(0.78, 0.98, layer - index);
  const list = TONE.strata, a = list[((index % list.length) + list.length) % list.length], b = list[(((index + 1) % list.length) + list.length) % list.length];
  out.copy(a).lerp(b, t).multiplyScalar(0.9 + noise2(x / 1.4, y / 1.4 + z / 1.4, 143) * 0.18);
  return out;
}

const tone = new Color();

export function valleyPaint(x, z, y, slope, out = new Color()) {
  const { camp, oak, tower, ring } = VALLEY;
  groundColour(x, z, Math.min(slope, 0.6), 0, out);
  out.lerp(TONE.meadowWarm, smooth(0.45, 0.8, fbm(x / 38, z / 38, 2, 152)) * 0.45).lerp(TONE.meadowCool, smooth(0.5, 0.85, noise2(x / 21, z / 21, 153)) * 0.3);
  const fromCamp = Math.hypot(x - camp.x, z - camp.z);
  out.lerp(TONE.clearing, smooth(camp.flat + 6, camp.flat - 4, fromCamp) * 0.35);
  const rocky = smooth(0.72, 1.05, slope);
  if (rocky > 0) out.lerp(strata(x, z, y, tone), rocky);
  const ledge = smooth(0.15, 0.4, slope) * smooth(0.95, 0.7, slope) * smooth(9, 14, y) * smooth(-40, -60, x);
  out.lerp(TONE.moss, ledge * 0.65);
  out.lerp(TONE.lichen, rocky * smooth(0.25, 0.75, fbm(x / 6, y / 4 + z / 6, 2, 144)) * 0.25);
  const trail = smooth(2.6, 1.1, trailDistance(x, z));
  if (trail > 0) out.lerp(tone.copy(TONE.dirt).lerp(TONE.packed, smooth(0.3, 0.8, noise2(x / 2.3, z / 2.3, 145))), trail * (0.75 + noise2(x / 1.1, z / 1.1, 146) * 0.25) * (1 - rocky));
  out.lerp(TONE.dirt, smooth(2.8, 1.2, Math.hypot(x - VALLEY.campfires[0].x, z - VALLEY.campfires[0].z)) * 0.7);
  const edge = lakeEdge(x, z), water = waterAt(x, z), under = water - y;
  const shore = smooth(5, 1, edge) * smooth(2.2, 0.4, y - WATER);
  if (shore > 0) out.lerp(tone.copy(TONE.gravel).lerp(TONE.pebble, smooth(0.35, 0.7, noise2(x * 1.7, z * 1.7, 147))), shore);
  if (under > -0.15) {
    const bed = tone.copy(TONE.pebble).lerp(TONE.sand, smooth(0.3, 0.75, noise2(x / 3, z / 3, 148)) * 0.6).lerp(TONE.wet, 0.3);
    bed.lerp(TONE.silt, smooth(0.8, 2.6, under)).lerp(TONE.deep, smooth(3, 6, under));
    out.lerp(bed, smooth(-0.15, 0.2, under));
  }
  const fromOak = Math.hypot(x - oak.x, z - oak.z);
  if (fromOak < oak.trunk + 0.6 && y > oak.knoll + 1) out.copy(TONE.bark).lerp(TONE.barkLight, smooth(0.3, 0.7, noise2(Math.atan2(x - oak.x, z - oak.z) * 6, y / 3, 149)));
  const fromTower = Math.hypot(x - tower.x, z - tower.z);
  if (fromTower < tower.radius + 0.7 && slope > 0.6) out.copy(TONE.masonry).lerp(TONE.mortar, smooth(0.82, 0.92, (y / 0.7) % 1) * 0.8).multiplyScalar(0.92 + noise2(x * 2, y * 2 + z, 150) * 0.12);
  out.lerp(TONE.dirt, smooth(ring.radius - 1, ring.radius - 4, Math.hypot(x - ring.x, z - ring.z)) * smooth(0.3, 0.7, noise2(x / 3.1, z / 3.1, 151)) * 0.35);
  return out;
}

function along(path, x, z) {
  let best = [Infinity, 0, 0, 0, 0];
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1], [bx, bz] = path[i], [d, t] = nearSegment(x, z, ax, az, bx, bz), length = Math.hypot(bx - ax, bz - az);
    if (d < best[0]) best = [d, ax + (bx - ax) * t, az + (bz - az) * t, (bx - ax) / length, (bz - az) / length];
  }
  return best;
}

export function valleyFlow(x, z) {
  const { pool } = VALLEY.falls, fromPool = Math.hypot(x - pool.x, z - pool.z);
  if (fromPool < pool.radius + 1) return [(x - pool.x) / (fromPool || 1) * 1.4, (z - pool.z) / (fromPool || 1) * 1.4];
  for (const [path, speed] of [[VALLEY.brook, 0.9], [VALLEY.stream, 1.3]]) {
    const [d, , , dx, dz] = along(path, x, z);
    if (d < 4.5) return [dx * speed, dz * speed];
  }
  return [0.04, -0.02];
}

export function streamWater(ground) {
  return (x, z) => {
    const [d, px, pz] = along(VALLEY.stream, x, z);
    return d < 2.3 ? ground(px, pz) + 0.8 : -Infinity;
  };
}
