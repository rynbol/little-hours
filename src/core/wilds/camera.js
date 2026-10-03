export const RIG = Object.freeze({
  fov: 60, distance: 4.6, near: 2.2, far: 8.5, shoulder: 0.55, height: 1.38, pitch: Object.freeze([-0.42, 1.05]), rest: 0.2,
  clearance: 0.3, pushOut: 3.2, follow: 16, rise: 7, lockTurn: 7, lockPitch: 0.42, lockSide: 2, lockShoulder: 0.3, lockLook: 0.5, lockReach: 2.5, kickSpring: 220, kickDamping: 18,
});

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

export function createRig({ yaw = 0, pitch = RIG.rest, at = [0, 0, 0] } = {}) {
  const pivot = [at[0], at[1] + RIG.height, at[2]];
  return { yaw, pitch, zoom: RIG.distance, distance: RIG.distance, side: RIG.shoulder, aim: RIG.shoulder, pull: [0, 0, 0], pivot, look: [...pivot], eye: [...pivot], want: [0, 0, 0], kick: [0, 0, 0], kickSpeed: [0, 0, 0] };
}

export function orbit(rig, dx, dy) {
  rig.yaw -= dx;
  rig.pitch = clamp(rig.pitch + dy, RIG.pitch[0], RIG.pitch[1]);
}

export function zoomRig(rig, delta) { rig.zoom = clamp(rig.zoom * Math.exp(delta), RIG.near, RIG.far); }

export function kickRig(rig, x, y, z) { rig.kickSpeed[0] += x; rig.kickSpeed[1] += y; rig.kickSpeed[2] += z; }

export function moveFrom(rig, forward, right) {
  const fx = Math.sin(rig.yaw), fz = Math.cos(rig.yaw);
  let x = fx * forward - fz * right, z = fz * forward + fx * right;
  const length = Math.hypot(x, z);
  if (length > 1) { x /= length; z /= length; }
  return [x, z];
}

export function clearSpan(from, to, { ground, solids }, clearance = RIG.clearance) {
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
  let hit = 1;
  for (const solid of solids) {
    const ox = from[0] - solid.x, oz = from[2] - solid.z, radius = solid.radius + clearance;
    const a = dx * dx + dz * dz, b = 2 * (ox * dx + oz * dz), c = ox * ox + oz * oz - radius * radius;
    if (a < 1e-9 || c < 0) continue;
    const disc = b * b - 4 * a * c;
    if (disc < 0) continue;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    if (t < 0 || t >= hit) continue;
    const y = from[1] + dy * t;
    if (y >= solid.bottom - clearance && y <= solid.top + clearance) hit = t;
  }
  const below = t => from[1] + dy * t - ground(from[0] + dx * t, from[2] + dz * t) - clearance;
  const steps = 32;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (t > hit) break;
    if (below(t) < 0) {
      let lo = (i - 1) / steps, hi = t;
      for (let k = 0; k < 8; k++) { const mid = (lo + hi) / 2; if (below(mid) < 0) hi = mid; else lo = mid; }
      hit = Math.min(hit, lo);
      break;
    }
  }
  return hit;
}

export function stepRig(rig, dt, { player, lock, world, still = false }) {
  const follow = 1 - Math.exp(-RIG.follow * dt), rise = 1 - Math.exp(-RIG.rise * dt), p = rig.pivot;
  p[0] += (player.x - p[0]) * follow; p[2] += (player.z - p[2]) * follow;
  p[1] += (player.y + RIG.height - p[1]) * (player.grounded ? Math.max(rise, follow * 0.6) : rise);
  const turn = 1 - Math.exp(-RIG.lockTurn * dt);
  let side = RIG.shoulder, aim = RIG.shoulder, px = 0, py = 0, pz = 0;
  if (lock) {
    const dx = lock.x - player.x, dz = lock.z - player.z, span = Math.hypot(dx, dz) || 1, reach = Math.min(span * RIG.lockLook, RIG.lockReach);
    rig.yaw += angleTo(rig.yaw, Math.atan2(dx, dz)) * turn;
    rig.pitch += (RIG.lockPitch - rig.pitch) * turn;
    side = RIG.lockSide; aim = RIG.lockShoulder;
    px = dx / span * reach; py = ((lock.bottom + lock.top) / 2 - p[1]) * RIG.lockLook * 0.5; pz = dz / span * reach;
  }
  rig.side += (side - rig.side) * turn; rig.aim += (aim - rig.aim) * turn;
  rig.pull[0] += (px - rig.pull[0]) * turn; rig.pull[1] += (py - rig.pull[1]) * turn; rig.pull[2] += (pz - rig.pull[2]) * turn;
  for (let i = 0; i < 3; i++) {
    rig.kickSpeed[i] += (-RIG.kickSpring * rig.kick[i] - RIG.kickDamping * rig.kickSpeed[i]) * dt;
    rig.kick[i] = still ? 0 : rig.kick[i] + rig.kickSpeed[i] * dt;
    if (still) rig.kickSpeed[i] = 0;
  }
  const cp = Math.cos(rig.pitch), fx = Math.sin(rig.yaw) * cp, fy = -Math.sin(rig.pitch), fz = Math.cos(rig.yaw) * cp;
  const rx = -Math.cos(rig.yaw), rz = Math.sin(rig.yaw);
  const want = rig.want;
  want[0] = p[0] - fx * rig.zoom + rx * rig.side; want[1] = p[1] - fy * rig.zoom; want[2] = p[2] - fz * rig.zoom + rz * rig.side;
  rig.look[0] = p[0] + rx * rig.aim + rig.pull[0]; rig.look[1] = p[1] + rig.pull[1]; rig.look[2] = p[2] + rz * rig.aim + rig.pull[2];
  const reach = Math.hypot(want[0] - p[0], want[1] - p[1], want[2] - p[2]) || 1, safe = clearSpan(p, want, world) * reach;
  const eased = rig.distance + (reach - rig.distance) * (1 - Math.exp(-RIG.pushOut * dt));
  rig.distance = Math.min(safe, eased);
  const s = rig.distance / reach;
  for (let i = 0; i < 3; i++) { rig.eye[i] = p[i] + (want[i] - p[i]) * s + rig.kick[i]; rig.look[i] += rig.kick[i] * 0.6; }
  return rig;
}
