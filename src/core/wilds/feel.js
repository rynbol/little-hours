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
export const DUMMY = Object.freeze({ id: 'dummy', x: 0, z: -5, radius: 0.55, height: 1.8 });
export const FEEL_BOUNDS = Object.freeze({ x: 0, z: -4, radius: 44 });

const CHARGE_TIME = 0.38;
const PLAYER_RADIUS = 0.32;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const movingActions = new Set(['idle', 'run', 'sprint', 'jump', 'land']);

export function createFeelSimulation({ target = () => DUMMY, obstacles = [], world = null, bounds = FEEL_BOUNDS, posts = POSTS, stats = { stamina: 100, attack: 1 } } = {}) {
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
  let climb = null, regrabDelay = 0, climbLeap = 0, swimExitDelay = 0;
  const staminaMaximum = () => Math.max(1, Number(stats.stamina) || 100);
  const floorAt = (x, z, ceiling = Infinity) => world ? world.floorAt(x, z, ceiling) : heightAt(x, z);

  function action(kind, duration = 0) {
    if (state.action?.kind === kind && (movingActions.has(kind) || ['climb', 'glide', 'swim'].includes(kind))) return;
    state.action = { kind, elapsed: 0, duration, serial: ++serial, progress: 0, hitWindow: false, swingAngle: 0, charge: 0 };
    attackHit = false;
  }

  function reset(spawn = { x: 0, z: 2 }) {
    serial = 0;
    hitSerial = 0;
    heldTime = 0;
    held = false;
    queuedAttack = null;
    regenDelay = 0;
    combo = 0;
    comboTime = 0;
    sprintExhausted = false;
    climb = null; regrabDelay = 0; climbLeap = 0; swimExitDelay = 0;
    const x = spawn.x ?? 0, z = spawn.z ?? 2;
    Object.assign(state, {
      player: { x, y: spawn.y ?? floorAt(x, z), z, vx: 0, vy: 0, vz: 0, heading: 0, grounded: true, stamina: staminaMaximum(), maxStamina: staminaMaximum(), normal: normalAt(x, z), invulnerable: false, mode: 'ground' },
      dummy: { hits: 0, health: 100, flash: 0 },
      counts: { attack: 0, dodge: 0, jump: 0, lightAttacks: 0, heavyAttacks: 0, hits: 0, climb: 0, glide: 0, swim: 0 },
      hitStop: 0,
      hitStopped: false,
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
    const aim = target();
    if (locked && aim) state.player.heading = Math.atan2(aim.x - state.player.x, state.player.z - aim.z);
    combo = kind === 'heavy' ? 0 : Number(kind.at(-1));
    comboTime = row.duration + 0.3;
    state.counts.attack++;
    state.counts[kind === 'heavy' ? 'heavyAttacks' : 'lightAttacks']++;
    action(kind, row.duration);
  }

  function collide(obstacle) {
    const player = state.player;
    if (player.y > (obstacle.y ?? heightAt(obstacle.x, obstacle.z)) + (obstacle.height ?? 1.8)) return;
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
    const aim = target();
    if (!aim) return;
    const dx = aim.x - player.x, dz = aim.z - player.z, distance = Math.hypot(dx, dz);
    if (distance > row.range + aim.radius || Math.abs(player.y - (aim.y ?? floorAt(aim.x, aim.z))) > 1) return;
    const bearing = angleDifference(Math.atan2(dx, -dz), player.heading);
    const start = (clamp((from - row.hitStart) / (row.hitEnd - row.hitStart), 0, 1) - 0.5) * row.arc;
    const end = (clamp((to - row.hitStart) / (row.hitEnd - row.hitStart), 0, 1) - 0.5) * row.arc;
    const tolerance = Math.asin(Math.min(1, aim.radius / Math.max(distance, aim.radius))) + 0.12;
    if (bearing < start - tolerance || bearing > end + tolerance) return;
    attackHit = true;
    if ((aim.id ?? 'dummy') === 'dummy') state.dummy.hits++;
    state.counts.hits++;
    const damage = row.damage * Math.max(0, Number(stats.attack) || 1);
    if ((aim.id ?? 'dummy') === 'dummy') state.dummy.health = Math.max(0, state.dummy.health - damage);
    state.dummy.flash = 0.22;
    state.hitStop = state.action.kind === 'heavy' ? 0.075 : 0.045;
    state.lastHit = { serial: ++hitSerial, kind: state.action.kind, targetId: aim.id ?? 'dummy', damage, x: aim.x, y: (aim.y ?? floorAt(aim.x, aim.z)) + 0.9, z: aim.z };
  }

  function releaseClimb() {
    climb = null; climbLeap = 0; regrabDelay = 0.8;
    state.player.mode = 'air'; state.player.grounded = false;
    action('jump');
  }

  function traversal(dt, input, moveX, moveZ, moving) {
    if (!world) return false;
    const player = state.player, before = { x: player.x, y: player.y, z: player.z };
    regrabDelay = Math.max(0, regrabDelay - dt); swimExitDelay = Math.max(0, swimExitDelay - dt);
    if (!climb && regrabDelay === 0 && moving && player.stamina > 5 && player.mode !== 'glide' && ['idle', 'run', 'sprint', 'jump', 'land'].includes(state.action.kind)) {
      const contact = world.climbContact(player, moveX, moveZ);
      if (contact && moveX * contact.normal[0] + moveZ * contact.normal[2] < -0.2 && player.y < contact.top - .1) {
        climb = contact; player.mode = 'climb'; player.grounded = false; player.vx = 0; player.vy = 0; player.vz = 0;
        held = false; queuedAttack = null; state.counts.climb++; action('climb');
      }
    }
    if (climb) {
      const nx = climb.normal[0], nz = climb.normal[2];
      const inward = Math.max(0, -moveX * nx - moveZ * nz), side = moveX * -nz + moveZ * nx;
      const cost = moving || climbLeap > 0 ? 6.5 : 2;
      player.stamina = Math.max(0, player.stamina - cost * dt); regenDelay = .5;
      player.heading = Math.atan2(-nx, nz);
      player.x = climb.x - nz * side * 1.5 * dt; player.z = climb.z + nx * side * 1.5 * dt;
      if (climbLeap > 0) { climbLeap = Math.max(0, climbLeap - dt); player.vy = Math.max(0, player.vy - 18 * dt); }
      else player.vy = inward * 1.5;
      player.y += player.vy * dt;
      const next = world.climbContact(player, -nx, -nz);
      if (next?.id === climb.id) climb = next;
      if (player.y >= climb.top - .05) {
        player.x -= nx * .7; player.z -= nz * .7;
        player.y = floorAt(player.x, player.z, climb.top + .4); player.grounded = true; player.vy = 0; player.mode = 'ground'; climb = null; climbLeap = 0; regrabDelay = .35; action('land', .12);
      } else if (!player.stamina || !next || next.id !== climb.id) releaseClimb();
      else if (climbLeap === 0 && state.action.kind === 'climbLeap') action('climb');
      player.normal = climb ? [...climb.normal] : normalAt(player.x, player.z);
      player.invulnerable = false;
      return true;
    }
    const water = world.waterAt(player.x, player.z);
    const submerged = water && water.depth > .6 && player.y < water.height + .1 && swimExitDelay === 0;
    if (submerged && player.mode !== 'swim') { player.mode = 'swim'; player.grounded = false; held = false; queuedAttack = null; state.counts.swim++; action('swim'); }
    if (player.mode === 'swim') {
      if (!submerged) { player.mode = 'air'; action('jump'); }
      else {
        player.stamina = moving ? Math.max(0, player.stamina - 8 * dt) : Math.min(staminaMaximum(), player.stamina + 6 * dt);
        const speed = player.stamina > 0 ? 2.2 : .85, blend = 1 - Math.exp(-dt * 12);
        player.vx += (moveX * speed - player.vx) * blend; player.vz += (moveZ * speed - player.vz) * blend;
        if (moving) player.heading = Math.atan2(moveX, -moveZ);
        player.x += player.vx * dt; player.z += player.vz * dt; player.y = water.height - .45; player.vy = 0; player.grounded = false;
        world.resolve(player, before);
        for (const obstacle of [...posts, ...obstacles]) collide(obstacle);
        const aim = target(); if (aim) collide(aim);
        const nextWater = world.waterAt(player.x, player.z);
        if (!nextWater || nextWater.depth <= .6) { player.y = floorAt(player.x, player.z, water.height + .5); player.mode = 'ground'; player.grounded = true; action('land', .12); }
        player.normal = normalAt(player.x, player.z); player.invulnerable = false; regenDelay = .5;
        return true;
      }
    }
    if (player.mode === 'glide') {
      player.stamina = Math.max(0, player.stamina - 6 * dt); regenDelay = .5;
      const speed = 6.5, mx = moving ? moveX : Math.sin(player.heading) * .7, mz = moving ? moveZ : -Math.cos(player.heading) * .7;
      if (moving) player.heading = Math.atan2(mx, -mz);
      const blend = 1 - Math.exp(-dt * 5);
      player.vx += (mx * speed - player.vx) * blend; player.vz += (mz * speed - player.vz) * blend;
      player.vy = clamp(player.vy + ((world.updraftAt(player.x, player.z) || 0) - 1.8 - player.vy * 1.125) * dt, -1.6, 4);
      player.x += player.vx * dt; player.z += player.vz * dt; player.y += player.vy * dt;
      world.resolve(player, before);
      for (const obstacle of [...posts, ...obstacles]) collide(obstacle);
      const aim = target(); if (aim) collide(aim);
      const floor = floorAt(player.x, player.z, before.y + .35);
      if (player.y <= floor && player.vy <= 0) { player.y = floor; player.vy = 0; player.grounded = true; player.mode = 'ground'; action('land', .12); }
      else if (player.stamina === 0) { player.mode = 'air'; action('jump'); }
      player.normal = normalAt(player.x, player.z); player.invulnerable = false;
      return true;
    }
    return false;
  }

  function advance(dt, input, moveX, moveZ, moving) {
    state.elapsed += dt;
    state.dummy.flash = Math.max(0, state.dummy.flash - dt);
    if (state.hitStop > 0 || state.hitStopped) { state.hitStopped = true; state.hitStop = Math.max(0, state.hitStop - dt); return; }
    const player = state.player;
    const current = state.action;
    const previousElapsed = current.elapsed;
    current.elapsed += dt;
    comboTime = Math.max(0, comboTime - dt);
    regenDelay = Math.max(0, regenDelay - dt);
    if (traversal(dt, input, moveX, moveZ, moving)) { state.action.progress = state.action.duration ? clamp(state.action.elapsed / state.action.duration, 0, 1) : 0; return; }
    if (held) heldTime += dt;
    if (current.kind === 'charge') current.charge = clamp(heldTime / CHARGE_TIME, 0, 1);
    const row = ATTACKS[current.kind];
    const canMove = movingActions.has(current.kind);
    const aim = target();
    if (canMove && moving) player.heading = input.locked && aim ? Math.atan2(aim.x - player.x, player.z - aim.z) : Math.atan2(moveX, -moveZ);
    else if (canMove && input.locked && aim) player.heading = Math.atan2(aim.x - player.x, player.z - aim.z);
    if (!input.sprint || player.stamina >= 18) sprintExhausted = false;
    if (player.stamina <= 0) sprintExhausted = true;
    const sprint = canMove && moving && input.sprint && !sprintExhausted;
    if (sprint) { player.stamina = Math.max(0, player.stamina - 18 * dt); regenDelay = 0.55; }
    else if ((!world || player.grounded) && regenDelay === 0 && current.kind !== 'charge' && !row && current.kind !== 'dodge') player.stamina = Math.min(staminaMaximum(), player.stamina + 24 * dt);
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
    const previous = { x: player.x, y: player.y, z: player.z };
    player.x += player.vx * dt;
    player.z += player.vz * dt;
    for (const post of posts) collide(post);
    for (const obstacle of obstacles) collide(obstacle);
    if (aim) collide(aim);
    if (world) world.resolve(player, previous);
    if (bounds) {
      const boundaryX = player.x - bounds.x, boundaryZ = player.z - bounds.z;
      const boundaryDistance = Math.hypot(boundaryX, boundaryZ);
      const boundaryRadius = bounds.radius - PLAYER_RADIUS;
      if (boundaryDistance > boundaryRadius) {
        const nx = boundaryX / boundaryDistance, nz = boundaryZ / boundaryDistance;
        player.x = bounds.x + nx * boundaryRadius;
        player.z = bounds.z + nz * boundaryRadius;
        const outward = Math.max(0, player.vx * nx + player.vz * nz);
        player.vx -= outward * nx;
        player.vz -= outward * nz;
      }
    }
    const floor = floorAt(player.x, player.z, world ? previous.y + .4 : Infinity);
    if (world && player.grounded && player.y - floor > .35) { player.grounded = false; player.mode = 'air'; action('jump'); }
    player.normal = normalAt(player.x, player.z);
    if (player.grounded) { player.y = floor; player.vy = 0; }
    else {
      player.vy -= 20 * dt;
      player.y += player.vy * dt;
      if (player.y <= floor && player.vy <= 0) { player.y = floor; player.vy = 0; player.grounded = true; action('land', 0.12); }
    }
    player.mode = player.grounded ? 'ground' : 'air';
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
    state.hitStopped = false;
    const length = Math.hypot(input.moveX || 0, input.moveZ || 0);
    const scale = Math.max(1, length);
    const moveX = (input.moveX || 0) / scale, moveZ = (input.moveZ || 0) / scale;
    const moving = length > 0.01;
    const player = state.player;
    player.maxStamina = staminaMaximum(); player.stamina = Math.min(player.stamina, player.maxStamina);
    let traversalJump = false;
    if (world && input.dodge && climb) releaseClimb();
    if (world && input.jump && climb && spend(14)) { climbLeap = .35; player.vy = 6.4; action('climbLeap', .35); state.counts.jump++; traversalJump = true; }
    else if (world && input.jump && player.mode === 'swim' && spend(8)) { player.mode = 'air'; swimExitDelay = .5; player.vy = 5.5; action('jump'); state.counts.jump++; traversalJump = true; }
    else if (world && input.jump && !player.grounded && !climb && player.mode !== 'swim') {
      if (player.mode === 'glide') { player.mode = 'air'; action('jump'); }
      else if (player.stamina > 2) { player.mode = 'glide'; player.vy = Math.min(player.vy, 2); held = false; queuedAttack = null; action('glide'); state.counts.glide++; }
      traversalJump = true;
    }
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
    } else if (input.jump && !traversalJump && player.grounded && movingActions.has(state.action.kind) && spend(8)) {
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
