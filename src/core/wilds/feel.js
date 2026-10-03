import { heightAt, normalAt } from '../world-terrain.js';

export const ATTACKS = Object.freeze(Object.fromEntries(Object.entries({
  light1: { duration: 0.42, hitStart: 0.12, hitEnd: 0.23, range: 1.8, arc: 2.3, damage: 12, cost: 8, travel: 0.34 },
  light2: { duration: 0.46, hitStart: 0.14, hitEnd: 0.26, range: 1.95, arc: 2.6, damage: 15, cost: 9, travel: 0.4 },
  light3: { duration: 0.58, hitStart: 0.2, hitEnd: 0.34, range: 2.15, arc: 2.8, damage: 21, cost: 12, travel: 0.48 },
  heavy: { duration: 0.82, hitStart: 0.25, hitEnd: 0.43, range: 2.4, arc: 2.5, damage: 35, cost: 24, travel: 0.6 },
}).map(([kind, row]) => [kind, Object.freeze(row)])));

export const POSTS = Object.freeze([
  { x: -4, z: -4, radius: 0.48, height: 2.2 },
  { x: 4, z: -4, radius: 0.48, height: 2.2 },
  { x: -6, z: 2, radius: 0.6, height: 2.6 },
  { x: 6, z: 2, radius: 0.6, height: 2.6 },
].map(Object.freeze));
export const DUMMY = Object.freeze({ x: 0, z: -5, radius: 0.55 });
export const FEEL_BOUNDS = Object.freeze({ x: 0, z: -4, radius: 44 });

const CHARGE_TIME = 0.38;
const PLAYER_RADIUS = 0.32;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const movingActions = new Set(['idle', 'run', 'sprint', 'jump', 'land']);

export function createFeelSimulation() {
  const state = {};
  let serial = 0;
  let hitSerial = 0;
  let attackHit = false;
  let heldTime = 0;
  let held = false;
  let queuedAttack = null;
  let regenDelay = 0;
  let combo = 0;
  let comboTime = 0;
  let dodgeX = 0;
  let dodgeZ = -1;
  let sprintExhausted = false;

  function action(kind, duration = 0) {
    if (state.action?.kind === kind && movingActions.has(kind)) return;
    state.action = { kind, elapsed: 0, duration, serial: ++serial, progress: 0, hitWindow: false, swingAngle: 0, charge: 0 };
    attackHit = false;
  }

  function reset() {
    serial = 0;
    hitSerial = 0;
    heldTime = 0;
    held = false;
    queuedAttack = null;
    regenDelay = 0;
    combo = 0;
    comboTime = 0;
    sprintExhausted = false;
    Object.assign(state, {
      player: { x: 0, y: heightAt(0, 2), z: 2, vx: 0, vy: 0, vz: 0, heading: 0, grounded: true, stamina: 100, normal: normalAt(0, 2), invulnerable: false },
      dummy: { hits: 0, health: 100, flash: 0 },
      counts: { attack: 0, dodge: 0, jump: 0, lightAttacks: 0, heavyAttacks: 0, hits: 0 },
      hitStop: 0,
      lastHit: null,
      elapsed: 0,
    });
    action('idle');
    return state;
  }

  function spend(cost) {
    if (state.player.stamina < cost) return false;
    state.player.stamina -= cost;
    regenDelay = 0.65;
    return true;
  }

  function startAttack(request, locked) {
    const kind = request === 'heavy' ? 'heavy' : `light${comboTime > 0 ? combo % 3 + 1 : 1}`;
    const row = ATTACKS[kind];
    if (!state.player.grounded || !spend(row.cost)) {
      if (state.action.kind === 'charge') action('idle');
      return;
    }
    if (locked) state.player.heading = Math.atan2(DUMMY.x - state.player.x, state.player.z - DUMMY.z);
    combo = kind === 'heavy' ? 0 : Number(kind.at(-1));
    comboTime = row.duration + 0.3;
    state.counts.attack++;
    state.counts[kind === 'heavy' ? 'heavyAttacks' : 'lightAttacks']++;
    action(kind, row.duration);
  }

  function collide(obstacle) {
    const player = state.player;
    if (player.y > heightAt(obstacle.x, obstacle.z) + (obstacle.height ?? 1.8)) return;
    const dx = player.x - obstacle.x, dz = player.z - obstacle.z;
    const distance = Math.hypot(dx, dz), radius = PLAYER_RADIUS + obstacle.radius;
    if (distance >= radius) return;
    const nx = distance > 1e-6 ? dx / distance : 1;
    const nz = distance > 1e-6 ? dz / distance : 0;
    player.x = obstacle.x + nx * radius;
    player.z = obstacle.z + nz * radius;
    const inward = player.vx * nx + player.vz * nz;
    if (inward < 0) { player.vx -= inward * nx; player.vz -= inward * nz; }
  }

  function strike(row, from, to) {
    if (attackHit || to < row.hitStart || from > row.hitEnd) return;
    const player = state.player;
    const dx = DUMMY.x - player.x, dz = DUMMY.z - player.z, distance = Math.hypot(dx, dz);
    if (distance > row.range + DUMMY.radius || Math.abs(player.y - heightAt(DUMMY.x, DUMMY.z)) > 1) return;
    const bearing = angleDifference(Math.atan2(dx, -dz), player.heading);
    const start = (clamp((from - row.hitStart) / (row.hitEnd - row.hitStart), 0, 1) - 0.5) * row.arc;
    const end = (clamp((to - row.hitStart) / (row.hitEnd - row.hitStart), 0, 1) - 0.5) * row.arc;
    const tolerance = Math.asin(Math.min(1, DUMMY.radius / Math.max(distance, DUMMY.radius))) + 0.12;
    if (bearing < start - tolerance || bearing > end + tolerance) return;
    attackHit = true;
    state.dummy.hits++;
    state.counts.hits++;
    state.dummy.health = Math.max(0, state.dummy.health - row.damage);
    state.dummy.flash = 0.22;
    state.hitStop = state.action.kind === 'heavy' ? 0.075 : 0.045;
    state.lastHit = { serial: ++hitSerial, kind: state.action.kind, x: DUMMY.x, y: heightAt(DUMMY.x, DUMMY.z) + 0.9, z: DUMMY.z };
  }

  function advance(dt, input, moveX, moveZ, moving) {
    state.elapsed += dt;
    state.dummy.flash = Math.max(0, state.dummy.flash - dt);
    if (state.hitStop > 0) { state.hitStop = Math.max(0, state.hitStop - dt); return; }
    const player = state.player;
    const current = state.action;
    const previousElapsed = current.elapsed;
    current.elapsed += dt;
    comboTime = Math.max(0, comboTime - dt);
    regenDelay = Math.max(0, regenDelay - dt);
    if (held) heldTime += dt;
    if (current.kind === 'charge') current.charge = clamp(heldTime / CHARGE_TIME, 0, 1);
    const row = ATTACKS[current.kind];
    const canMove = movingActions.has(current.kind);
    if (canMove && moving) player.heading = input.locked ? Math.atan2(DUMMY.x - player.x, player.z - DUMMY.z) : Math.atan2(moveX, -moveZ);
    else if (canMove && input.locked) player.heading = Math.atan2(DUMMY.x - player.x, player.z - DUMMY.z);
    if (!input.sprint || player.stamina >= 18) sprintExhausted = false;
    if (player.stamina <= 0) sprintExhausted = true;
    const sprint = canMove && moving && input.sprint && !sprintExhausted;
    if (sprint) { player.stamina = Math.max(0, player.stamina - 18 * dt); regenDelay = 0.55; }
    else if (regenDelay === 0 && current.kind !== 'charge' && !row && current.kind !== 'dodge') player.stamina = Math.min(100, player.stamina + 24 * dt);
    let targetX = 0, targetZ = 0;
    if (canMove) {
      const speed = sprint ? 7 : 4;
      targetX = moveX * speed;
      targetZ = moveZ * speed;
    } else if (current.kind === 'dodge') {
      const speed = 9.5 * (1 - current.elapsed / current.duration * 0.45);
      targetX = dodgeX * speed;
      targetZ = dodgeZ * speed;
    } else if (row && current.elapsed < row.hitEnd) {
      const speed = row.travel / row.hitEnd;
      targetX = Math.sin(player.heading) * speed;
      targetZ = -Math.cos(player.heading) * speed;
    } else if (current.kind === 'charge') {
      targetX = moveX * 0.7;
      targetZ = moveZ * 0.7;
    }
    const blend = 1 - Math.exp(-dt * (canMove ? 28 : 45));
    player.vx += (targetX - player.vx) * blend;
    player.vz += (targetZ - player.vz) * blend;
    player.x += player.vx * dt;
    player.z += player.vz * dt;
    for (const post of POSTS) collide(post);
    collide(DUMMY);
    const boundaryX = player.x - FEEL_BOUNDS.x, boundaryZ = player.z - FEEL_BOUNDS.z;
    const boundaryDistance = Math.hypot(boundaryX, boundaryZ);
    const boundaryRadius = FEEL_BOUNDS.radius - PLAYER_RADIUS;
    if (boundaryDistance > boundaryRadius) {
      const nx = boundaryX / boundaryDistance, nz = boundaryZ / boundaryDistance;
      player.x = FEEL_BOUNDS.x + nx * boundaryRadius;
      player.z = FEEL_BOUNDS.z + nz * boundaryRadius;
      const outward = Math.max(0, player.vx * nx + player.vz * nz);
      player.vx -= outward * nx;
      player.vz -= outward * nz;
    }
    const floor = heightAt(player.x, player.z);
    player.normal = normalAt(player.x, player.z);
    if (player.grounded) { player.y = floor; player.vy = 0; }
    else {
      player.vy -= 20 * dt;
      player.y += player.vy * dt;
      if (player.y <= floor && player.vy <= 0) { player.y = floor; player.vy = 0; player.grounded = true; action('land', 0.12); }
    }
    player.invulnerable = current.kind === 'dodge' && current.elapsed >= 0.035 && current.elapsed <= 0.27;
    if (row) {
      current.hitWindow = current.elapsed >= row.hitStart && current.elapsed <= row.hitEnd;
      current.swingAngle = (clamp((current.elapsed - row.hitStart) / (row.hitEnd - row.hitStart), 0, 1) - 0.5) * row.arc;
      strike(row, previousElapsed, current.elapsed);
    }
    current.progress = current.duration ? clamp(current.elapsed / current.duration, 0, 1) : 0;
    if (current.kind !== 'charge' && current.duration && current.elapsed >= current.duration && state.action === current) {
      action(player.grounded ? 'idle' : 'jump');
      if (queuedAttack) { const request = queuedAttack; queuedAttack = null; startAttack(request, input.locked); }
      else if (held && player.grounded) action('charge', CHARGE_TIME);
    }
    if (player.grounded && ['idle', 'run', 'sprint'].includes(state.action.kind)) action(moving ? sprint ? 'sprint' : 'run' : 'idle');
  }

  function step(dt, input = {}) {
    dt = Number.isFinite(dt) ? clamp(dt, 0, 0.05) : 0;
    if (dt === 0) return state;
    const length = Math.hypot(input.moveX || 0, input.moveZ || 0);
    const scale = Math.max(1, length);
    const moveX = (input.moveX || 0) / scale, moveZ = (input.moveZ || 0) / scale;
    const moving = length > 0.01;
    const player = state.player;
    if (input.attackCancelled) {
      held = false;
      heldTime = 0;
      queuedAttack = null;
      if (state.action.kind === 'charge') action('idle');
    }
    if (input.attackPressed && !input.attackCancelled) {
      held = true;
      heldTime = 0;
      if (movingActions.has(state.action.kind) && player.grounded) action('charge', CHARGE_TIME);
    }
    if (input.attackReleased && held && !input.attackCancelled) {
      const request = held && heldTime >= CHARGE_TIME ? 'heavy' : 'light';
      held = false;
      if (ATTACKS[state.action.kind]) queuedAttack = request;
      else if (state.action.kind === 'charge' || movingActions.has(state.action.kind)) startAttack(request, input.locked);
    }
    if (input.dodge && player.grounded && state.action.kind !== 'dodge' && spend(22)) {
      held = false;
      queuedAttack = null;
      dodgeX = moving ? moveX / Math.hypot(moveX, moveZ) : Math.sin(player.heading);
      dodgeZ = moving ? moveZ / Math.hypot(moveX, moveZ) : -Math.cos(player.heading);
      action('dodge', 0.42);
      state.counts.dodge++;
    } else if (input.jump && player.grounded && movingActions.has(state.action.kind) && spend(8)) {
      player.grounded = false;
      player.vy = 7.2;
      action('jump');
      state.counts.jump++;
    }
    for (let remaining = dt; remaining > 1e-8;) {
      const slice = Math.min(remaining, 1 / 120);
      advance(slice, input, moveX, moveZ, moving);
      remaining -= slice;
    }
    return state;
  }

  reset();
  return { state, step, reset };
}
