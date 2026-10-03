export const RIG = Object.freeze({
  pivot: 1.3, shoulder: .5, lead: 2.4,
  distance: Object.freeze({ min: 1.8, max: 10, start: 4.6 }),
  pitch: Object.freeze({ min: -.45, max: 1.1, start: .2 }),
  fov: 1.06, sprintFov: .07, clearance: .3, ease: 2.6,
  lock: Object.freeze({ reach: 34, turn: 6 }),
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const angleTo = (from, to) => { let d = (to - from) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

export const createRig = (yaw = 0) => ({ yaw, pitch: RIG.pitch.start, distance: RIG.distance.start, reach: RIG.distance.start, fov: RIG.fov, lock: 0 });
export const orbitRig = (rig, yaw, pitch) => ({ ...rig, yaw: rig.yaw + yaw, pitch: clamp(rig.pitch + pitch, RIG.pitch.min, RIG.pitch.max) });
export const zoomRig = (rig, steps) => ({ ...rig, distance: clamp(rig.distance * 1.13 ** steps, RIG.distance.min, RIG.distance.max) });

function clearReach(world, from, dir, want) {
  const step = .2;
  for (let d = step; d <= want + 1e-6; d += step) {
    const x = from.x + dir.x * d, y = from.y + dir.y * d, z = from.z + dir.z * d;
    if (y < world.ground(x, z) + RIG.clearance) return Math.max(.5, d - step * 1.5);
    for (const c of world.blockers(x, z, RIG.clearance + 1)) {
      if (y < c.bottom || y > c.top + RIG.clearance) continue;
      if (Math.hypot(x - c.x, z - c.z) < c.r + RIG.clearance) return Math.max(.5, d - step * 1.5);
    }
  }
  return want;
}

export function frameRig(rig, { at, target = null, sprint = false, steering = false }, world, dt) {
  let { yaw, pitch } = rig;
  const span = target ? Math.hypot(target.x - at.x, target.z - at.z) : Infinity, locked = span < RIG.lock.reach;
  const lock = rig.lock + ((locked ? 1 : 0) - rig.lock) * Math.min(1, dt * 4);
  let want = rig.distance;
  if (locked) {
    if (!steering) yaw += angleTo(yaw, Math.atan2(target.x - at.x, target.z - at.z)) * Math.min(1, RIG.lock.turn * dt);
    pitch += (clamp(pitch, .08, .42) - pitch) * Math.min(1, dt * 3);
    want = Math.max(want, 4.4 + Math.min(span, 18) * .16 + target.height * .3);
  }
  const forward = { x: Math.sin(yaw) * Math.cos(pitch), y: -Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) };
  const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  const pivot = { x: at.x, y: at.y + RIG.pivot, z: at.z };
  const ideal = { x: -forward.x * want + right.x * RIG.shoulder, y: -forward.y * want, z: -forward.z * want + right.z * RIG.shoulder };
  const length = Math.hypot(ideal.x, ideal.y, ideal.z), dir = { x: ideal.x / length, y: ideal.y / length, z: ideal.z / length };
  const allowed = clearReach(world, pivot, dir, length);
  const reach = Math.min(allowed, allowed < rig.reach ? allowed : rig.reach + (allowed - rig.reach) * Math.min(1, dt * RIG.ease));
  const eye = { x: pivot.x + dir.x * reach, y: pivot.y + dir.y * reach, z: pivot.z + dir.z * reach };
  eye.y = Math.max(eye.y, world.ground(eye.x, eye.z) + RIG.clearance);
  const near = reach / length;
  const free = { x: pivot.x + right.x * RIG.shoulder * near + forward.x * RIG.lead, y: pivot.y + forward.y * RIG.lead * .5, z: pivot.z + right.z * RIG.shoulder * near + forward.z * RIG.lead };
  const look = !target ? free : (() => {
    const middle = { x: at.x + (target.x - at.x) * .42, y: Math.max(pivot.y, at.y + (target.y + target.height * .45 - at.y) * .5), z: at.z + (target.z - at.z) * .42 };
    return { x: free.x + (middle.x - free.x) * lock, y: free.y + (middle.y - free.y) * lock, z: free.z + (middle.z - free.z) * lock };
  })();
  const fov = rig.fov + ((sprint ? RIG.fov + RIG.sprintFov : RIG.fov) - rig.fov) * Math.min(1, dt * 3);
  return { rig: { ...rig, yaw, pitch, reach, lock, fov }, eye, look, fov };
}
