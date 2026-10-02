import MANTLE_MOTION from './mantle-motion.json' with { type: 'json' };

export const WILDS_MOVEMENT = Object.freeze({
  walkSpeed: 4.8,
  sprintSpeed: 8.5,
  jumpSpeed: 7,
  jumpAnticipationMs: 1000 / 12,
  mantleReachMs: MANTLE_MOTION.reachMs,
  mantleRise: MANTLE_MOTION.riseMetres,
  mantleLiftMs: MANTLE_MOTION.liftMs,
  mantleTransferMs: MANTLE_MOTION.normal.transferMs,
  mantleDurationMs: MANTLE_MOTION.normal.durationMs,
  wideMantleTransferMs: MANTLE_MOTION.wide.transferMs,
  wideMantleDurationMs: MANTLE_MOTION.wide.durationMs,
  wideMantleAdvance: .6,
  landDurationMs: 1000 / 3,
  gravity: 20,
  climbSpeed: 2,
  sprintCost: 14,
  climbCost: 20,
  staminaRecovery: 22,
  recoveryDelay: 600,
  radius: .34,
  height: 1.75,
  maxSlope: Math.cos(50 * Math.PI / 180),
  stepHeight: .38,
  substepMs: 1000 / 120,
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function obstacleRadiusBetween(obstacle, bottom, top = bottom) {
  const profile = obstacle.radiusProfile;
  if (!profile?.length) return obstacle.radius;
  const low = Math.min(bottom, top) - obstacle.baseY, high = Math.max(bottom, top) - obstacle.baseY;
  const radiusAt = height => {
    if (height <= profile[0].height) return profile[0].radius;
    for (let i = 1; i < profile.length; i++) {
      if (height > profile[i].height) continue;
      const previous = profile[i - 1], next = profile[i], fraction = (height - previous.height) / (next.height - previous.height);
      return previous.radius + (next.radius - previous.radius) * fraction;
    }
    return profile.at(-1).radius;
  };
  let radius = Math.max(radiusAt(low), radiusAt(high));
  for (const point of profile) if (point.height >= low && point.height <= high) radius = Math.max(radius, point.radius);
  return radius;
}

export function createMovementState({ position, yaw = 0, stamina = 100, maxStamina = 100 }) {
  const origin = { x: position.x, y: position.y, z: position.z };
  return {
    position: { ...origin },
    velocity: { x: 0, y: 0, z: 0 },
    safePosition: { ...origin },
    yaw,
    stamina: clamp(stamina, 0, maxStamina),
    maxStamina,
    mode: 'grounded',
    grounded: true,
    action: 'idle',
    speed: 0,
    lastSpentAt: -Infinity,
    landedAt: -Infinity,
    jumpHeld: false,
    jumpPending: false,
    jumpStartedAt: -Infinity,
    mantle: null,
    mantleAdvance: null,
    actionTimeMs: null,
    climbBlocked: false,
    sprintExhausted: false,
    climbExhausted: false,
    climbObstacle: null,
  };
}

function surfaceUnder(world, x, z, feetY) {
  const surface = world.surfaceAt(x, z);
  if (!surface) return null;
  let support = surface;
  for (const obstacle of world.obstacles || []) {
    const top = obstacle.baseY + obstacle.height;
    if (top > support.height && top <= feetY + .001 && Math.hypot(x - obstacle.x, z - obstacle.z) < obstacle.radius) {
      support = { height: top, normal: { x: 0, y: 1, z: 0 } };
    }
  }
  return support;
}

function collide(world, position, x, z) {
  const bounds = world.bounds;
  if (bounds) {
    x = clamp(x, bounds.minX + WILDS_MOVEMENT.radius, bounds.maxX - WILDS_MOVEMENT.radius);
    z = clamp(z, bounds.minZ + WILDS_MOVEMENT.radius, bounds.maxZ - WILDS_MOVEMENT.radius);
  }
  for (let pass = 0; pass < 3; pass++) {
    for (const obstacle of world.obstacles || []) {
      if (position.y >= obstacle.baseY + obstacle.height - .000001 || position.y + WILDS_MOVEMENT.height <= obstacle.baseY) continue;
      const radius = obstacleRadiusBetween(obstacle, position.y, position.y + WILDS_MOVEMENT.height) + WILDS_MOVEMENT.radius;
      let dx = x - obstacle.x, dz = z - obstacle.z;
      const length = Math.hypot(dx, dz);
      if (length >= radius) continue;
      if (length < .00001) {
        dx = position.x - obstacle.x;
        dz = position.z - obstacle.z;
      }
      const divisor = Math.hypot(dx, dz) || 1;
      x = obstacle.x + dx / divisor * radius;
      z = obstacle.z + (divisor === 1 && !dx && !dz ? radius : dz / divisor * radius);
    }
  }
  const surface = surfaceUnder(world, x, z, position.y);
  if (!surface) return { x: position.x, z: position.z };
  const rise = surface.height - position.y;
  if (rise > .001 && (surface.normal.y < WILDS_MOVEMENT.maxSlope || rise > WILDS_MOVEMENT.stepHeight)) {
    return { x: position.x, z: position.z };
  }
  return { x, z };
}

function climbTarget(state, world, direction) {
  for (const obstacle of world.obstacles || []) {
    if (!obstacle.climbable || state.position.y >= obstacle.baseY + obstacle.height - .001) continue;
    if (state.position.y + WILDS_MOVEMENT.height < obstacle.baseY) continue;
    const dx = obstacle.x - state.position.x, dz = obstacle.z - state.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= obstacleRadiusBetween(obstacle, state.position.y, state.position.y + WILDS_MOVEMENT.height) + WILDS_MOVEMENT.radius + .18 && dx * direction.x + dz * direction.z > distance * .55) return obstacle;
  }
  return null;
}

function spend(state, amount, at, activity, events) {
  state.stamina = Math.max(0, state.stamina - amount);
  state.lastSpentAt = at;
  if (state.stamina < .00001) {
    state.stamina = 0;
    state[`${activity}Exhausted`] = true;
    events.push({ type: 'exhausted', activity });
  }
}

function beginMantle(state, obstacle, at) {
  const dx = state.position.x - obstacle.x, dz = state.position.z - obstacle.z, length = Math.hypot(dx, dz), inset = Math.max(0, obstacle.radius - .12);
  const wide = length - inset > WILDS_MOVEMENT.wideMantleAdvance;
  const advance = wide ? MANTLE_MOTION.wide.advanceMetres : length - inset;
  const end = { x: state.position.x - dx / length * advance, y: obstacle.baseY + obstacle.height, z: state.position.z - dz / length * advance };
  state.mantle = { obstacle, startedAt: at, start: { ...state.position }, end, advance, durationMs: WILDS_MOVEMENT.mantleReachMs + (wide ? WILDS_MOVEMENT.wideMantleDurationMs : WILDS_MOVEMENT.mantleDurationMs), transferMs: wide ? WILDS_MOVEMENT.wideMantleTransferMs : WILDS_MOVEMENT.mantleTransferMs };
  state.mode = 'mantling';
  state.velocity = { x: 0, y: 0, z: 0 };
}

function mantlePosition(mantle, elapsed) {
  elapsed = Math.max(0, elapsed - WILDS_MOVEMENT.mantleReachMs);
  const ease = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
  const lift = ease(elapsed / WILDS_MOVEMENT.mantleLiftMs), transfer = ease((elapsed - WILDS_MOVEMENT.mantleLiftMs) / (mantle.transferMs - WILDS_MOVEMENT.mantleLiftMs));
  const y = mantle.start.y + (mantle.end.y - mantle.start.y) * lift;
  return { x: mantle.start.x + (mantle.end.x - mantle.start.x) * transfer, y, z: mantle.start.z + (mantle.end.z - mantle.start.z) * transfer };
}

function bodyClear(world, position) {
  const surface = world.surfaceAt(position.x, position.z), bounds = world.bounds;
  if (!surface || surface.height > position.y + .001) return false;
  if (bounds && (position.x < bounds.minX + WILDS_MOVEMENT.radius || position.x > bounds.maxX - WILDS_MOVEMENT.radius || position.z < bounds.minZ + WILDS_MOVEMENT.radius || position.z > bounds.maxZ - WILDS_MOVEMENT.radius)) return false;
  return !(world.obstacles || []).some(obstacle => position.y < obstacle.baseY + obstacle.height - .000001 && position.y + WILDS_MOVEMENT.height > obstacle.baseY && Math.hypot(position.x - obstacle.x, position.z - obstacle.z) < obstacleRadiusBetween(obstacle, position.y, position.y + WILDS_MOVEMENT.height) + WILDS_MOVEMENT.radius - .000001);
}

function leaveClimb(state, events, blocked = false) {
  state.mode = 'airborne';
  state.jumpStartedAt = -Infinity;
  state.climbObstacle = null;
  state.mantle = null;
  if (blocked) state.climbBlocked = true;
  events.push({ type: 'climb-end' });
}

export function stepMovement(previous, input, world, deltaMs, now, { forcedVelocity = null } = {}) {
  const state = { ...previous, position: { ...previous.position }, velocity: { ...previous.velocity }, safePosition: { ...previous.safePosition }, mantle: previous.mantle ? { ...previous.mantle, start: { ...previous.mantle.start }, end: { ...previous.mantle.end } } : null };
  const events = [], duration = Math.max(0, deltaMs);
  if (!duration) return { state, events };
  if (!input.sprint) state.sprintExhausted = false;
  if (!input.climb) { state.climbExhausted = false; state.climbBlocked = false; }
  const forward = clamp(input.forward || 0, -1, 1), strafe = clamp(input.strafe || 0, -1, 1);
  const magnitude = Math.max(1, Math.hypot(forward, strafe)), cameraYaw = input.cameraYaw ?? state.yaw;
  const direction = {
    x: (-Math.sin(cameraYaw) * forward + Math.cos(cameraYaw) * strafe) / magnitude,
    z: (-Math.cos(cameraYaw) * forward - Math.sin(cameraYaw) * strafe) / magnitude,
  };
  const moving = Math.hypot(direction.x, direction.z) > .001;
  if (moving && state.mode !== 'mantling') state.yaw = Math.atan2(-direction.x, -direction.z);
  let jump = Boolean(input.jump && !state.jumpHeld), at = now - duration;
  state.jumpHeld = Boolean(input.jump);
  while (at < now - .0000001) {
    let milliseconds = Math.min(WILDS_MOVEMENT.substepMs, now - at), spent = false, held = false;
    const target = input.climb && moving && !state.climbExhausted && !state.climbBlocked && state.stamina > 0 ? climbTarget(state, world, direction) : null;
    if (state.mode === 'mantling') {
      const mantle = state.mantle, toward = mantle && (mantle.end.x - mantle.start.x) * direction.x + (mantle.end.z - mantle.start.z) * direction.z;
      if (!input.climb || !moving || state.stamina <= 0 || !mantle || toward < mantle.advance * .55 || !(world.obstacles || []).includes(mantle.obstacle)) leaveClimb(state, events);
    } else if (target !== null && state.mode !== 'climbing') {
      state.mode = 'climbing';
      state.climbObstacle = target;
      state.jumpPending = false;
      state.jumpStartedAt = -Infinity;
      state.velocity.y = 0;
      events.push({ type: 'climb-start' });
    }
    if (state.mode === 'climbing') {
      const obstacle = state.climbObstacle;
      if (!input.climb || !moving || state.stamina <= 0 || !obstacle || target !== obstacle) leaveClimb(state, events);
      else if (state.position.y >= obstacle.baseY + obstacle.height - WILDS_MOVEMENT.mantleRise - .0000001) beginMantle(state, obstacle, at);
    }
    if (state.mode === 'mantling') {
      const mantle = state.mantle;
      milliseconds = Math.min(milliseconds, mantle.startedAt + mantle.durationMs - at, state.stamina / WILDS_MOVEMENT.climbCost * 1000);
      const next = mantlePosition(mantle, at + milliseconds - mantle.startedAt);
      if (!bodyClear(world, next)) {
        leaveClimb(state, events, true);
        state.velocity = { x: 0, y: 0, z: 0 };
      } else {
        const seconds = milliseconds / 1000;
        state.velocity = { x: (next.x - state.position.x) / seconds, y: (next.y - state.position.y) / seconds, z: (next.z - state.position.z) / seconds };
        state.position = next;
        spend(state, WILDS_MOVEMENT.climbCost * seconds, at + milliseconds, 'climb', events);
        spent = held = true; jump = false;
        if (at + milliseconds >= mantle.startedAt + mantle.durationMs - .0000001) {
          state.mode = 'grounded'; state.mantle = null; state.climbObstacle = null;
          state.velocity = { x: 0, y: 0, z: 0 };
          events.push({ type: 'climb-end' });
        } else if (!state.stamina) leaveClimb(state, events);
      }
    } else if (state.mode === 'climbing') {
      const obstacle = state.climbObstacle, threshold = obstacle.baseY + obstacle.height - WILDS_MOVEMENT.mantleRise;
      milliseconds = Math.min(milliseconds, (threshold - state.position.y) / WILDS_MOVEMENT.climbSpeed * 1000, state.stamina / WILDS_MOVEMENT.climbCost * 1000);
      const seconds = milliseconds / 1000, old = { ...state.position };
      const y = old.y + WILDS_MOVEMENT.climbSpeed * seconds, dx = old.x - obstacle.x, dz = old.z - obstacle.z, distance = Math.hypot(dx, dz);
      const radius = obstacleRadiusBetween(obstacle, y, y + WILDS_MOVEMENT.height) + WILDS_MOVEMENT.radius;
      const reach = obstacle.radiusProfile ? radius : Math.max(radius, distance - WILDS_MOVEMENT.walkSpeed * seconds);
      const next = { x: obstacle.x + dx / distance * reach, y, z: obstacle.z + dz / distance * reach };
      const ground = world.surfaceAt(next.x, next.z);
      if (ground && ground.height > y && ground.normal.y >= WILDS_MOVEMENT.maxSlope && ground.height - old.y <= WILDS_MOVEMENT.stepHeight) {
        next.y = ground.height;
        const clearance = Math.max(reach, obstacleRadiusBetween(obstacle, next.y, next.y + WILDS_MOVEMENT.height) + WILDS_MOVEMENT.radius);
        next.x = obstacle.x + dx / distance * clearance; next.z = obstacle.z + dz / distance * clearance;
      }
      if (!bodyClear(world, next)) { leaveClimb(state, events, true); state.velocity = { x: 0, y: 0, z: 0 }; }
      else {
        state.position = next;
        state.velocity = { x: (next.x - old.x) / seconds, y: WILDS_MOVEMENT.climbSpeed, z: (next.z - old.z) / seconds };
        spend(state, WILDS_MOVEMENT.climbCost * seconds, at + milliseconds, 'climb', events);
        spent = held = true; jump = false;
        if (!state.stamina) leaveClimb(state, events);
        else if (state.position.y >= threshold - .0000001) beginMantle(state, obstacle, at + milliseconds);
      }
    }
    if (!held) {
      if (jump && state.mode === 'grounded') {
        state.jumpPending = true;
        state.jumpStartedAt = at;
        events.push({ type: 'jump' });
      }
      jump = false;
      if (state.jumpPending) {
        milliseconds = Math.min(milliseconds, state.jumpStartedAt + WILDS_MOVEMENT.jumpAnticipationMs - at);
        state.velocity = { x: 0, y: 0, z: 0 };
        if (at + milliseconds >= state.jumpStartedAt + WILDS_MOVEMENT.jumpAnticipationMs - .0000001) {
          state.jumpPending = false; state.mode = 'airborne'; state.velocity.y = WILDS_MOVEMENT.jumpSpeed;
        }
      } else {
        const dt = milliseconds / 1000;
        const running = !forcedVelocity && input.sprint && moving && state.mode === 'grounded' && state.stamina > 0 && !state.sprintExhausted;
        const runSeconds = running ? Math.min(dt, state.stamina / WILDS_MOVEMENT.sprintCost) : 0;
        const distance = WILDS_MOVEMENT.walkSpeed * dt + (WILDS_MOVEMENT.sprintSpeed - WILDS_MOVEMENT.walkSpeed) * runSeconds;
        const old = { ...state.position }, candidate = collide(world, old,
          old.x + (forcedVelocity ? forcedVelocity.x * dt : direction.x * distance),
          old.z + (forcedVelocity ? forcedVelocity.z * dt : direction.z * distance));
        state.position.x = candidate.x; state.position.z = candidate.z;
        const support = surfaceUnder(world, candidate.x, candidate.z, old.y);
        if (state.mode === 'grounded' && support && old.y - support.height <= WILDS_MOVEMENT.stepHeight) {
          state.position.y = support.height; state.velocity.y = 0;
        } else {
          state.mode = 'airborne';
          const nextY = old.y + state.velocity.y * dt - .5 * WILDS_MOVEMENT.gravity * dt * dt;
          state.velocity.y -= WILDS_MOVEMENT.gravity * dt;
          if (support && nextY <= support.height && state.velocity.y <= 0) {
            events.push({ type: 'land', speed: -state.velocity.y });
            state.position.y = support.height; state.velocity.y = 0; state.mode = 'grounded'; state.landedAt = at + milliseconds; state.jumpStartedAt = -Infinity;
          } else {
            state.position.y = nextY;
            const cleared = collide(world, state.position, state.position.x, state.position.z);
            state.position.x = cleared.x; state.position.z = cleared.z;
          }
        }
        state.velocity.x = (state.position.x - old.x) / dt;
        state.velocity.z = (state.position.z - old.z) / dt;
        if (running && Math.hypot(state.velocity.x, state.velocity.z) > .001) {
          spend(state, WILDS_MOVEMENT.sprintCost * runSeconds, at + milliseconds, 'sprint', events); spent = true;
        }
      }
    }
    at += milliseconds;
    if (!spent) {
      const recoveringMs = Math.max(0, at - Math.max(at - milliseconds, state.lastSpentAt + WILDS_MOVEMENT.recoveryDelay));
      state.stamina = Math.min(state.maxStamina, state.stamina + WILDS_MOVEMENT.staminaRecovery * recoveringMs / 1000);
    }
    if (state.mode === 'grounded') state.safePosition = { ...state.position };
    if (state.position.y < state.safePosition.y - 30) {
      state.position = { ...state.safePosition }; state.velocity = { x: 0, y: 0, z: 0 }; state.mode = 'grounded';
      state.jumpPending = false; state.jumpStartedAt = -Infinity; state.mantle = null; state.climbObstacle = null;
      events.push({ type: 'recover' });
    }
  }
  state.grounded = state.mode === 'grounded';
  state.speed = state.mode === 'climbing' ? Math.abs(state.velocity.y) : Math.hypot(state.velocity.x, state.velocity.z);
  state.action = state.mode === 'mantling' ? 'mantle' : state.mode === 'climbing' ? 'climb' : state.jumpPending ? 'jump' : !state.grounded ? (state.velocity.y > .0000001 && Number.isFinite(state.jumpStartedAt) ? 'jump' : 'fall')
    : state.speed > 6 ? 'run' : state.speed > .01 ? 'walk' : now - state.landedAt < WILDS_MOVEMENT.landDurationMs ? 'land' : 'idle';
  state.actionTimeMs = state.action === 'mantle' ? Math.max(0, now - state.mantle.startedAt - WILDS_MOVEMENT.mantleReachMs) : state.action === 'jump' && Number.isFinite(state.jumpStartedAt) ? now - state.jumpStartedAt : null;
  state.mantleAdvance = state.mantle?.advance ?? null;
  return { state, events };
}
