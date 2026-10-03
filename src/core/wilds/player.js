import { ATTACKS, CHARGE_TIME, HOLD_TO_CHARGE, sweepHits } from './moves.js';

export const MOVE = Object.freeze({ jog: 4.4, sprint: 6.9, charging: 1.7, accel: 36, brake: 30, air: 11, turn: 18, gravity: 25, fall: 40, jump: 7.1, coyote: 0.1, buffer: 0.14, radius: 0.32, height: 1.5, snap: 0.35 });
export const DODGE = Object.freeze({ time: 0.42, distance: 3.4, guard: Object.freeze([0.03, 0.3]), cost: 18, punish: 0.3 });
export const STAMINA = Object.freeze({ max: 100, sprint: 20, heavy: 22, regen: 38, tiredRegen: 26, delay: 0.55, recover: 35 });

const BUFFERED = Object.freeze(['attack', 'jump', 'dodge']);
const easeOut = (s, power = 2) => 1 - (1 - Math.min(1, Math.max(0, s))) ** power;
const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

export function createPlayer({ x = 0, z = 0, facing = 0, ground }) {
  return {
    x, y: ground(x, z), z, vx: 0, vy: 0, vz: 0, facing, state: 'move', time: 0, grounded: true, airTime: 0, peak: 0,
    attack: null, charge: 0, hit: new Set(), held: 0, armed: false, buffered: { attack: 0, jump: 0, dodge: 0 },
    dodgeX: 0, dodgeZ: 1, stamina: STAMINA.max, rest: 0, tired: false, sprinting: false, events: [],
  };
}

export function pressPlayer(player, action) {
  const waiting = action === 'attack' && player.state === 'attack' ? ATTACKS[player.attack].chain - player.time : 0;
  if (BUFFERED.includes(action)) player.buffered[action] = MOVE.buffer + Math.max(0, waiting);
  if (action === 'attack') player.armed = true;
}

export const invulnerable = player => player.state === 'dodge' && player.time >= DODGE.guard[0] && player.time <= DODGE.guard[1];

function spend(player, amount) {
  player.stamina = Math.max(0, player.stamina - amount);
  player.rest = STAMINA.delay;
  if (player.stamina === 0 && !player.tired) { player.tired = true; player.events.push({ type: 'tired' }); }
}

function enter(player, state) { player.state = state; player.time = 0; }

function nearest(player, targets, cone, heading = player.facing) {
  let best = null, bestDistance = Infinity;
  for (const target of targets) {
    const dx = target.x - player.x, dz = target.z - player.z, distance = Math.hypot(dx, dz);
    if (distance < bestDistance && Math.abs(angleTo(heading, Math.atan2(dx, dz))) < cone) { best = target; bestDistance = distance; }
  }
  return best && { target: best, distance: bestDistance };
}

function aim(player, input, world) {
  const lock = world.lock;
  if (lock) { player.facing = Math.atan2(lock.x - player.x, lock.z - player.z); return; }
  if (Math.hypot(input.moveX, input.moveZ) > 0.2) player.facing = Math.atan2(input.moveX, input.moveZ);
  const near = nearest(player, world.targets, Math.PI / 3);
  if (near && near.distance < 3) player.facing = Math.atan2(near.target.x - player.x, near.target.z - player.z);
}

function startAttack(player, id, input, world) {
  enter(player, 'attack');
  player.attack = id; player.hit.clear(); player.buffered.attack = 0; player.sprinting = false;
  aim(player, input, world);
  player.events.push({ type: 'swing', attack: id, charge: player.charge });
}

function startDodge(player, input, world) {
  if (player.tired || player.stamina <= 0) return false;
  spend(player, DODGE.cost);
  const length = Math.hypot(input.moveX, input.moveZ);
  if (length > 0.2) { player.dodgeX = input.moveX / length; player.dodgeZ = input.moveZ / length; }
  else if (world.lock) { player.dodgeX = -Math.sin(player.facing); player.dodgeZ = -Math.cos(player.facing); }
  else { player.dodgeX = Math.sin(player.facing); player.dodgeZ = Math.cos(player.facing); }
  if (!world.lock) player.facing = Math.atan2(player.dodgeX, player.dodgeZ);
  enter(player, 'dodge');
  player.buffered.dodge = 0; player.attack = null; player.charge = 0; player.sprinting = false;
  player.events.push({ type: 'dodge', backstep: length <= 0.2 && Boolean(world.lock) });
  return true;
}

function tryJump(player) {
  if (!player.buffered.jump || !(player.grounded || player.airTime < MOVE.coyote) || player.vy > 0) return false;
  player.vy = MOVE.jump; player.grounded = false; player.airTime = MOVE.coyote; player.buffered.jump = 0; player.peak = player.y;
  enter(player, 'move'); player.attack = null; player.charge = 0;
  player.events.push({ type: 'jump' });
  return true;
}

function steer(player, input, dt, world, top) {
  const magnitude = Math.min(1, Math.hypot(input.moveX, input.moveZ)), wantX = input.moveX * top, wantZ = input.moveZ * top;
  const rate = player.grounded ? (magnitude > 0.05 ? MOVE.accel : MOVE.brake) : MOVE.air;
  const dx = wantX - player.vx, dz = wantZ - player.vz, gap = Math.hypot(dx, dz), step = Math.min(gap, rate * dt);
  if (gap > 1e-6) { player.vx += dx / gap * step; player.vz += dz / gap * step; }
  const face = world.lock && !player.sprinting ? Math.atan2(world.lock.x - player.x, world.lock.z - player.z) : magnitude > 0.05 ? Math.atan2(input.moveX, input.moveZ) : player.facing;
  const turn = angleTo(player.facing, face);
  player.facing += Math.sign(turn) * Math.min(Math.abs(turn), MOVE.turn * dt);
}

function locomotion(player, input, dt, world) {
  const moving = Math.hypot(input.moveX, input.moveZ) > 0.2;
  player.sprinting = Boolean(input.sprint && moving && !player.tired && (player.grounded || player.sprinting));
  if (player.sprinting) { spend(player, STAMINA.sprint * dt); if (player.tired) player.sprinting = false; }
  steer(player, input, dt, world, player.sprinting ? MOVE.sprint : MOVE.jog);
  if (tryJump(player)) return;
  if (!player.grounded) return;
  if (player.buffered.dodge && startDodge(player, input, world)) return;
  if (player.buffered.attack) startAttack(player, 'light1', input, world);
}

function slide(player, distance, x, z, world) {
  const near = nearest(player, world.targets, 0.7, Math.atan2(x, z));
  const room = near ? Math.max(0, near.distance - near.target.radius - MOVE.radius - 0.35) : Infinity;
  const step = Math.min(distance, room);
  player.x += x * step; player.z += z * step;
}

function attacking(player, input, dt, world) {
  const attack = ATTACKS[player.attack], t = player.time, before = t - dt;
  if (t < attack.strike[0]) aim(player, input, world);
  const fx = Math.sin(player.facing), fz = Math.cos(player.facing);
  slide(player, attack.lunge * (easeOut(t / attack.strike[1]) - easeOut(before / attack.strike[1])), fx, fz, world);
  player.vx = 0; player.vz = 0;
  for (const id of sweepHits(player, attack, before, t, world.targets, player.hit)) { player.hit.add(id); player.events.push({ type: 'hit', id, attack: player.attack, charge: player.charge }); }
  const recovering = t >= attack.strike[1];
  if (recovering && player.armed && player.held >= HOLD_TO_CHARGE && player.attack !== 'heavy' && !player.tired) { enter(player, 'charge'); player.attack = null; player.charge = 0; player.events.push({ type: 'charge' }); return; }
  if (recovering && player.buffered.dodge && startDodge(player, input, world)) return;
  if (recovering && tryJump(player)) return;
  if (player.buffered.attack && t >= attack.chain && attack.next) { startAttack(player, attack.next, input, world); return; }
  if (t >= attack.end) { enter(player, 'move'); player.attack = null; player.charge = 0; if (player.buffered.attack) startAttack(player, 'light1', input, world); }
}

function charging(player, input, dt, world) {
  player.charge = Math.min(1, player.time / CHARGE_TIME);
  steer(player, input, dt, world, MOVE.charging);
  if (!world.lock && Number.isFinite(input.view)) { const turn = angleTo(player.facing, input.view); player.facing += Math.sign(turn) * Math.min(Math.abs(turn), MOVE.turn * dt); }
  if (player.buffered.dodge && startDodge(player, input, world)) return;
  if (!input.attackHeld) { spend(player, STAMINA.heavy); startAttack(player, 'heavy', { moveX: 0, moveZ: 0 }, world); }
}

function dodging(player, input, dt, world) {
  const before = player.time - dt, s = player.time / DODGE.time;
  slide(player, DODGE.distance * (easeOut(s, 2.4) - easeOut(before / DODGE.time, 2.4)), player.dodgeX, player.dodgeZ, world);
  player.vx = 0; player.vz = 0;
  if (player.time >= DODGE.punish && player.buffered.attack) { startAttack(player, 'light1', input, world); return; }
  if (s >= 1) { enter(player, 'move'); const carry = MOVE.jog * 0.6; player.vx = player.dodgeX * carry; player.vz = player.dodgeZ * carry; }
}

function collide(player, world) {
  for (const solid of world.solids) {
    const dx = player.x - solid.x, dz = player.z - solid.z, distance = Math.hypot(dx, dz), least = solid.radius + MOVE.radius;
    if (distance < least && player.y < solid.top) {
      const nx = distance > 1e-6 ? dx / distance : 1, nz = distance > 1e-6 ? dz / distance : 0;
      player.x = solid.x + nx * least; player.z = solid.z + nz * least;
      const into = player.vx * nx + player.vz * nz;
      if (into < 0) { player.vx -= into * nx; player.vz -= into * nz; }
    }
  }
  const { x, z, radius } = world.bounds, dx = player.x - x, dz = player.z - z, distance = Math.hypot(dx, dz);
  if (distance > radius) { player.x = x + dx / distance * radius; player.z = z + dz / distance * radius; }
}

function fall(player, dt, world) {
  player.x += player.vx * dt; player.z += player.vz * dt;
  collide(player, world);
  const floor = world.ground(player.x, player.z);
  if (player.grounded) {
    if (player.y - floor > MOVE.snap) { player.grounded = false; player.airTime = 0; player.vy = 0; player.peak = player.y; }
    else { player.y = floor; return; }
  }
  player.airTime += dt;
  player.vy -= (player.vy > 0 ? MOVE.gravity : MOVE.fall) * dt;
  player.y += player.vy * dt;
  player.peak = Math.max(player.peak, player.y);
  if (player.y <= floor) {
    player.events.push({ type: 'land', speed: -player.vy, height: player.peak - floor });
    player.y = floor; player.vy = 0; player.grounded = true; player.airTime = 0;
  }
}

export function stepPlayer(player, input, dt, world) {
  for (const action of BUFFERED) player.buffered[action] = Math.max(0, player.buffered[action] - dt);
  player.held = input.attackHeld ? player.held + dt : 0;
  if (!input.attackHeld) player.armed = false;
  player.time += dt;
  player.rest = Math.max(0, player.rest - dt);
  if (!player.rest && !player.sprinting && player.state !== 'charge') {
    player.stamina = Math.min(STAMINA.max, player.stamina + (player.tired ? STAMINA.tiredRegen : STAMINA.regen) * dt);
    if (player.tired && player.stamina >= STAMINA.recover) player.tired = false;
  }
  if (player.state === 'attack') attacking(player, input, dt, world);
  else if (player.state === 'charge') charging(player, input, dt, world);
  else if (player.state === 'dodge') dodging(player, input, dt, world);
  else locomotion(player, input, dt, world);
  if (player.state !== 'move') player.sprinting = false;
  fall(player, dt, world);
}
