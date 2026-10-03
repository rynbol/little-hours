export const BLADE = Object.freeze({ pivot: Object.freeze([0, 1.0, 0.05]), inner: 0.3, reach: 1.3, rest: Object.freeze([38, -52]), raised: Object.freeze([12, 74]) });

export const ATTACKS = Object.freeze({
  light1: Object.freeze({ strike: Object.freeze([0.09, 0.17]), end: 0.4, chain: 0.17, lunge: 0.55, damage: 10, hitStop: 0.05, nudge: 0.05, from: Object.freeze([72, 6]), to: Object.freeze([-78, -14]), next: 'light2' }),
  light2: Object.freeze({ strike: Object.freeze([0.08, 0.16]), end: 0.42, chain: 0.16, lunge: 0.5, damage: 11, hitStop: 0.05, nudge: 0.05, from: Object.freeze([-82, -22]), to: Object.freeze([70, 16]), next: 'light3' }),
  light3: Object.freeze({ strike: Object.freeze([0.16, 0.3]), end: 0.68, chain: 0.68, lunge: 0.95, damage: 18, hitStop: 0.08, nudge: 0.1, from: Object.freeze([110, -4]), to: Object.freeze([-250, -8]), next: null }),
  heavy: Object.freeze({ strike: Object.freeze([0.12, 0.21]), end: 0.78, chain: 0.78, lunge: 1.25, damage: 30, weakDamage: 20, hitStop: 0.12, nudge: 0.16, from: Object.freeze([4, 96]), to: Object.freeze([0, -36]), next: null }),
});

export const HOLD_TO_CHARGE = 0.24;
export const CHARGE_TIME = 0.55;
export const MAX_HIT_SHARE = 1 / 3;

const FOLLOW = 0.08, BACK = 0.1;
const ease = s => 1 - (1 - s) * (1 - s);
const clamp01 = s => Math.min(1, Math.max(0, s));
const lerp = (a, b, t) => a + (b - a) * t;

export function bladeAngles(attack, t, out = [0, 0]) {
  const { strike: [start, stop], end, from, to } = attack, rest = BLADE.rest;
  const windYaw = from[0] + (from[0] - to[0]) * BACK, windPitch = from[1] + (from[1] - to[1]) * BACK;
  if (t < start) {
    const s = ease(clamp01(t / start));
    out[0] = lerp(rest[0], windYaw, s); out[1] = lerp(rest[1], windPitch, s);
  } else if (t <= stop) {
    const s = ease((t - start) / (stop - start));
    out[0] = lerp(windYaw, to[0], s); out[1] = lerp(windPitch, to[1], s);
  } else {
    const overYaw = to[0] + (to[0] - from[0]) * FOLLOW, overPitch = to[1] + (to[1] - from[1]) * FOLLOW, settle = stop + 0.06;
    if (t < settle) { const s = ease((t - stop) / 0.06); out[0] = lerp(to[0], overYaw, s); out[1] = lerp(to[1], overPitch, s); }
    else { const s = ease(clamp01((t - settle) / Math.max(0.01, end - settle))), home = rest[0] + Math.round((overYaw - rest[0]) / 360) * 360; out[0] = lerp(overYaw, home, s); out[1] = lerp(overPitch, rest[1], s); }
  }
  return out;
}

export function bladeSegment(body, yaw, pitch, out = { root: [0, 0, 0], tip: [0, 0, 0] }) {
  const a = yaw * Math.PI / 180, p = pitch * Math.PI / 180, face = body.facing;
  const lx = Math.sin(a) * Math.cos(p), ly = Math.sin(p), lz = Math.cos(a) * Math.cos(p);
  const fx = Math.sin(face), fz = Math.cos(face), rx = -fz, rz = fx;
  const [px, py, pz] = BLADE.pivot;
  const ox = body.x + rx * px + fx * pz, oy = body.y + py, oz = body.z + rz * px + fz * pz;
  const dx = rx * lx + fx * lz, dz = rz * lx + fz * lz;
  out.root[0] = ox + dx * BLADE.inner; out.root[1] = oy + ly * BLADE.inner; out.root[2] = oz + dz * BLADE.inner;
  out.tip[0] = ox + dx * BLADE.reach; out.tip[1] = oy + ly * BLADE.reach; out.tip[2] = oz + dz * BLADE.reach;
  return out;
}

export function segmentMeetsCylinder(a, b, cylinder) {
  const { x, z, radius, bottom, top } = cylinder;
  const ax = a[0] - x, az = a[2] - z, dx = b[0] - a[0], dz = b[2] - a[2], dy = b[1] - a[1];
  const length = dx * dx + dz * dz;
  let lo = 0, hi = 1;
  if (length > 1e-9) {
    const along = -(ax * dx + az * dz) / length, closest = (ax + dx * along) ** 2 + (az + dz * along) ** 2;
    if (closest > radius * radius) return false;
    const half = Math.sqrt((radius * radius - closest) / length);
    lo = Math.max(0, along - half); hi = Math.min(1, along + half);
    if (lo > hi) return false;
  } else if (ax * ax + az * az > radius * radius) return false;
  const y0 = a[1] + dy * lo, y1 = a[1] + dy * hi;
  return Math.max(y0, y1) >= bottom && Math.min(y0, y1) <= top;
}

const swing = [0, 0], blade = { root: [0, 0, 0], tip: [0, 0, 0] };

export function sweepHits(body, attack, t0, t1, targets, already = new Set()) {
  const [start, stop] = attack.strike, from = Math.max(t0, start), to = Math.min(t1, stop), hits = [];
  if (from > to || !targets.length) return hits;
  bladeAngles(attack, from, swing);
  const yaw0 = swing[0], pitch0 = swing[1];
  bladeAngles(attack, to, swing);
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(swing[0] - yaw0), Math.abs(swing[1] - pitch0)) / 5));
  for (let i = 0; i <= steps; i++) {
    bladeAngles(attack, from + (to - from) * i / steps, swing);
    bladeSegment(body, swing[0], swing[1], blade);
    for (const target of targets) if (!already.has(target.id) && !hits.includes(target.id) && segmentMeetsCylinder(blade.root, blade.tip, target)) hits.push(target.id);
  }
  return hits;
}

export function hitDamage(attack, charge, maxHealth) {
  const raw = attack.weakDamage === undefined ? attack.damage : lerp(attack.weakDamage, attack.damage, clamp01(charge));
  return Math.min(raw, maxHealth * MAX_HIT_SHARE);
}
