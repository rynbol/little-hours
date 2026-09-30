export const TWIRL_SECONDS = 0.9, EXIT_SECONDS = 2.3, ARRIVE_SECONDS = 2.6, LAND_SECONDS = 0.7;

const ease = t => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;
const curve = (from, control, to, t, out) => {
  const u = 1 - t;
  out.x = u * u * from.x + 2 * u * t * control.x + t * t * to.x;
  out.y = u * u * from.y + 2 * u * t * control.y + t * t * to.y;
  out.z = u * u * from.z + 2 * u * t * control.z + t * t * to.z;
  return out;
};
const copy = (out, point) => { out.x = point.x; out.y = point.y; out.z = point.z; return out; };

export function createBuddyFlight() {
  const at = { x: 0, y: 0, z: 0 }, from = { x: 0, y: 0, z: 0 }, control = { x: 0, y: 0, z: 0 }, rise = { x: 0, y: 0, z: 0 }, exit = { x: 0, y: 0, z: 0 };
  const pose = { x: 0, y: 0, z: 0, scale: 1, spin: 0, flying: 0, heading: 0, visible: false, trail: false, squash: 0, landed: false, gone: false };
  let mode = 'away', trip = null, age = 0, landing = Infinity, side = 1;

  function tripTo(target) {
    copy(from, at);
    const distance = Math.hypot(target.x - at.x, target.y - at.y, target.z - at.z);
    trip = distance < 0.12 ? null : { age: 0, duration: Math.min(2.2, 0.55 + distance * 0.32), lift: 0.18 + distance * 0.16 };
  }

  function face(dx, dz, dt) {
    const speed = Math.hypot(dx, dz) / Math.max(dt, 1e-3);
    if (speed > 0.05) pose.heading = Math.atan2(dx, dz);
    pose.flying = lerp(pose.flying, Math.min(1, speed / 0.9), Math.min(1, dt * 6));
  }

  return {
    pose,
    get mode() { return mode; },
    place(point) { copy(at, point); mode = 'here'; trip = null; landing = Infinity; pose.visible = true; },
    go(target) { if (mode === 'here') tripTo(target); },
    leave(point) {
      if (mode === 'away' || mode === 'leaving') return;
      mode = 'leaving'; age = 0; copy(exit, point); copy(rise, at); rise.y += 0.32;
    },
    arrive(entry, flank = 1) { mode = 'arriving'; age = 0; side = flank; copy(at, entry); copy(from, entry); landing = Infinity; pose.visible = true; },
    update(dt, target, reducedMotion) {
      pose.landed = pose.gone = false;
      const px = at.x, pz = at.z;
      if (reducedMotion) {
        if (mode === 'leaving') { mode = 'away'; pose.gone = true; }
        if (mode === 'arriving') { mode = 'here'; pose.landed = true; }
        if (mode === 'here' && target) copy(at, target);
        Object.assign(pose, { scale: 1, spin: 0, flying: 0, trail: false, squash: 0, visible: mode === 'here' });
      } else if (mode === 'leaving') {
        age += dt;
        if (age < TWIRL_SECONDS) {
          const t = ease(age / TWIRL_SECONDS);
          at.y = lerp(rise.y - 0.32, rise.y, t); pose.spin = t * Math.PI * 4; pose.scale = 1 + Math.sin(t * Math.PI) * 0.12;
        } else {
          const t = Math.min(1, (age - TWIRL_SECONDS) / EXIT_SECONDS), e = t * t * (3 - 2 * t) * 0.35 + t * t * 0.65;
          control.x = lerp(rise.x, exit.x, 0.35); control.y = Math.max(rise.y, exit.y) + 1.1; control.z = lerp(rise.z, exit.z, 0.35);
          curve(rise, control, exit, e, at);
          pose.spin = Math.PI * 4; pose.scale = 1 - ease((t - 0.35) / 0.65) * 0.8;
          if (t >= 1) { mode = 'away'; pose.gone = true; }
        }
        pose.trail = age > TWIRL_SECONDS * 0.5 && mode === 'leaving'; pose.squash = 0;
      } else if (mode === 'arriving' && target) {
        age += dt;
        const t = Math.min(1, age / ARRIVE_SECONDS), e = 1 - (1 - t) ** 2.4;
        control.x = target.x + side * 1.4; control.y = Math.max(from.y, target.y) + 0.9; control.z = target.z + 1.1;
        curve(from, control, target, e, at);
        pose.scale = 0.2 + ease(t * 1.4) * 0.8; pose.spin = (1 - e) * Math.PI * 2 * side; pose.trail = t < 0.97;
        if (t >= 1) { mode = 'here'; trip = null; landing = 0; pose.landed = true; }
      } else if (mode === 'here' && target) {
        if (trip) {
          trip.age += dt;
          const t = ease(trip.age / trip.duration);
          control.x = (from.x + target.x) / 2; control.y = Math.max(from.y, target.y) + trip.lift; control.z = (from.z + target.z) / 2;
          curve(from, control, target, t, at);
          if (trip.age >= trip.duration) trip = null;
        } else {
          const follow = 1 - Math.exp(-dt * 4.5);
          at.x += (target.x - at.x) * follow; at.y += (target.y - at.y) * follow; at.z += (target.z - at.z) * follow;
        }
        pose.scale = 1; pose.spin = 0; pose.trail = Boolean(trip && trip.duration > 1);
      }
      if (landing < LAND_SECONDS) { landing += dt; pose.squash = Math.sin(Math.min(1, landing / LAND_SECONDS) * Math.PI * 2) * (1 - landing / LAND_SECONDS); }
      else pose.squash = 0;
      if (!reducedMotion) face(at.x - px, at.z - pz, dt);
      pose.visible = mode !== 'away';
      pose.x = at.x; pose.y = at.y; pose.z = at.z;
      return pose;
    },
  };
}
