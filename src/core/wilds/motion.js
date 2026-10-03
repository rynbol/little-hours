export const MOTION = Object.freeze({
  radius: .32, height: 1.5,
  walk: 1.9, jog: 4.4, sprint: 7.2, wade: .55,
  accel: 22, airAccel: 6, turn: 13,
  gravity: 17, jump: 5.6, coyote: .12, stepUp: .5, maxSlope: .92,
  roll: { duration: .56, distance: 3.7, cost: 20, invulnerable: [.06, .44] },
  stamina: { max: 100, sprint: 17, regen: 34, delay: .7, jump: 6 },
  deep: .95, shallow: .22,
  land: { hard: 10.5, duration: .3 },
});

export function createBody({ x, z, y, yaw = 0 }) {
  return { x, y, z, vx: 0, vy: 0, vz: 0, yaw, grounded: true, airTime: 0, stamina: MOTION.stamina.max, spent: 0, exhausted: false, roll: null, landing: 0, wading: 0, gait: 'idle', speed: 0, impact: 0 };
}

const lengthOf = (x, z) => Math.hypot(x, z);
const angleTo = (from, to) => { let d = (to - from) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

function footing(world, x, z, y) {
  const ground = world.ground(x, z);
  let deck = null;
  for (const surface of world.decks?.(x, z) ?? []) if (surface <= y + MOTION.stepUp && (deck === null || surface > deck)) deck = surface;
  return deck !== null && deck > ground ? { height: deck, deck: true } : { height: ground, deck: false };
}

function blocked(world, body, x, z) {
  const here = footing(world, body.x, body.z, body.y), there = footing(world, x, z, body.y);
  const run = Math.max(1e-4, lengthOf(x - body.x, z - body.z));
  if (body.grounded && there.height - here.height > MOTION.stepUp && (there.height - here.height) / run > MOTION.maxSlope * 1.2) return true;
  if (!body.grounded && there.height > body.y + MOTION.stepUp) return true;
  const water = world.water(x, z);
  if (water && water.height - there.height > MOTION.deep) {
    const current = world.water(body.x, body.z);
    return !current || water.height - there.height > current.height - here.height;
  }
  return false;
}

function pushOut(world, body) {
  for (const blocker of world.blockers(body.x, body.z, MOTION.radius + 2) ?? []) {
    if (body.y > blocker.top || body.y + 1.4 < blocker.bottom) continue;
    const dx = body.x - blocker.x, dz = body.z - blocker.z, d = lengthOf(dx, dz), reach = blocker.r + MOTION.radius;
    if (d >= reach) continue;
    const nx = d > 1e-5 ? dx / d : 1, nz = d > 1e-5 ? dz / d : 0;
    body.x = blocker.x + nx * reach; body.z = blocker.z + nz * reach;
    const into = body.vx * nx + body.vz * nz;
    if (into < 0) { body.vx -= nx * into; body.vz -= nz * into; }
  }
  const bounds = world.bounds;
  if (bounds) { body.x = Math.min(bounds.maxX, Math.max(bounds.minX, body.x)); body.z = Math.min(bounds.maxZ, Math.max(bounds.minZ, body.z)); }
}

export function canRoll(body) { return !body.roll && (body.grounded || body.airTime < MOTION.coyote) && body.stamina >= MOTION.roll.cost * .5; }

export function stepBody(body, input, world, dt, { locked = false, rooted = false, push = null } = {}) {
  const next = { ...body, impact: 0, landing: Math.max(0, body.landing - dt) };
  const moveLength = Math.min(1, lengthOf(input.x, input.z));
  const water = world.water(next.x, next.z), here = footing(world, next.x, next.z, next.y);
  next.wading = water ? Math.max(0, water.height - here.height) : 0;

  if (input.dodge && canRoll(next)) {
    const dirX = moveLength > .1 ? input.x / moveLength : Math.sin(next.yaw), dirZ = moveLength > .1 ? input.z / moveLength : Math.cos(next.yaw);
    next.roll = { t: 0, dirX, dirZ };
    next.yaw = Math.atan2(dirX, dirZ);
    next.stamina = Math.max(0, next.stamina - MOTION.roll.cost); next.spent = 0;
  }

  let sprinting = false, targetSpeed = 0;
  if (next.roll) {
    next.roll = { ...next.roll, t: next.roll.t + dt };
    const t = next.roll.t / MOTION.roll.duration, speed = MOTION.roll.distance / MOTION.roll.duration * 1.5 * (1 - t) ** .5 * Math.min(1, t * 8 + .4);
    next.vx = next.roll.dirX * speed; next.vz = next.roll.dirZ * speed;
    if (next.roll.t >= MOTION.roll.duration) next.roll = null;
  } else if (!rooted) {
    sprinting = input.sprint && moveLength > .3 && !next.exhausted && next.wading < MOTION.shallow * 2;
    const base = sprinting ? MOTION.sprint : moveLength < .55 ? MOTION.walk : MOTION.jog;
    targetSpeed = base * (moveLength < .55 ? Math.min(1, moveLength / .55) : 1) * (next.wading > MOTION.shallow ? MOTION.wade : 1) * (next.landing > 0 ? .4 : 1);
    const tx = moveLength > 1e-3 ? input.x / moveLength * targetSpeed : 0, tz = moveLength > 1e-3 ? input.z / moveLength * targetSpeed : 0;
    const accel = (next.grounded ? MOTION.accel : MOTION.airAccel) * dt, dvx = tx - next.vx, dvz = tz - next.vz, dv = lengthOf(dvx, dvz);
    if (dv > 0) { const k = Math.min(1, accel * (dv > 2 ? 1 : 1.6) / dv); next.vx += dvx * k; next.vz += dvz * k; }
    if (moveLength > .05 && !locked) next.yaw += angleTo(next.yaw, Math.atan2(input.x, input.z)) * Math.min(1, MOTION.turn * dt);
  } else {
    const decay = Math.max(0, 1 - 12 * dt); next.vx *= decay; next.vz *= decay;
  }
  if (locked && input.face !== undefined && !next.roll) next.yaw += angleTo(next.yaw, input.face) * Math.min(1, MOTION.turn * dt);
  if (push) { next.vx += push.x; next.vz += push.z; next.vy = Math.max(next.vy, push.y ?? 0); if (push.y) next.grounded = false; }

  if (input.jump && !next.roll && !rooted && (next.grounded || next.airTime < MOTION.coyote) && next.stamina >= MOTION.stamina.jump && next.wading < MOTION.deep * .7) {
    next.vy = MOTION.jump; next.grounded = false; next.airTime = MOTION.coyote; next.stamina -= MOTION.stamina.jump; next.spent = 0;
  }

  const steps = Math.max(1, Math.ceil(lengthOf(next.vx, next.vz) * dt / .25)), sub = dt / steps;
  for (let i = 0; i < steps; i++) {
    const nx = next.x + next.vx * sub, nz = next.z + next.vz * sub;
    if (!blocked(world, next, nx, nz)) { next.x = nx; next.z = nz; }
    else if (!blocked(world, next, nx, next.z)) { next.x = nx; next.vz *= .2; }
    else if (!blocked(world, next, next.x, nz)) { next.z = nz; next.vx *= .2; }
    else { next.vx = 0; next.vz = 0; }
    pushOut(world, next);
  }

  const under = footing(world, next.x, next.z, next.y);
  if (next.grounded) {
    if (under.height < next.y - .6 && !under.deck) { next.grounded = false; next.airTime = 0; next.vy = 0; }
    else { next.y = under.height; next.vy = 0; }
  }
  if (!next.grounded) {
    next.airTime += dt;
    next.vy -= MOTION.gravity * dt;
    next.y += next.vy * dt;
    const roof = world.ceiling?.(next.x, next.z, next.y) ?? Infinity;
    if (next.y + MOTION.height > roof) { next.y = roof - MOTION.height; next.vy = Math.min(0, next.vy); }
    if (next.y <= under.height) {
      if (-next.vy > MOTION.land.hard) next.landing = MOTION.land.duration;
      next.impact = -next.vy;
      next.y = under.height; next.vy = 0; next.grounded = true; next.airTime = 0;
    }
  }

  if (sprinting && lengthOf(next.vx, next.vz) > MOTION.jog) { next.stamina = Math.max(0, next.stamina - MOTION.stamina.sprint * dt); next.spent = 0; }
  else { next.spent += dt; if (next.spent > MOTION.stamina.delay) next.stamina = Math.min(MOTION.stamina.max, next.stamina + MOTION.stamina.regen * dt * (next.exhausted ? .7 : 1)); }
  if (next.stamina <= 0) next.exhausted = true;
  if (next.exhausted && next.stamina >= MOTION.stamina.max * .35) next.exhausted = false;

  next.speed = lengthOf(next.vx, next.vz);
  next.gait = next.roll ? 'roll' : !next.grounded ? (next.vy > 0 ? 'jump' : 'fall') : next.landing > 0 ? 'land' : next.speed < .15 ? 'idle' : next.speed < (MOTION.walk + MOTION.jog) / 2 ? 'walk' : next.speed < (MOTION.jog + MOTION.sprint) / 2 ? 'jog' : 'sprint';
  return next;
}

export const invulnerable = body => Boolean(body.roll && body.roll.t >= MOTION.roll.invulnerable[0] && body.roll.t <= MOTION.roll.invulnerable[1]);
