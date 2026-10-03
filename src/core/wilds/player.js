import { ATTACKS, CHARGE_TIME, HOLD_TO_CHARGE, MAX_HIT_SHARE, sweepHits } from './moves.js';

export const MOVE = Object.freeze({ jog: 4.4, sprint: 6.9, charging: 1.7, accel: 36, brake: 30, air: 11, turn: 18, gravity: 25, fall: 40, jump: 7.1, coyote: 0.1, buffer: 0.14, radius: 0.32, height: 1.5, snap: 0.35 });
export const DODGE = Object.freeze({ time: 0.42, distance: 3.4, guard: Object.freeze([0.03, 0.3]), cost: 18, punish: 0.3 });
export const STAMINA = Object.freeze({ max: 100, sprint: 20, heavy: 22, regen: 38, tiredRegen: 26, delay: 0.55, recover: 35 });
export const VITALS = Object.freeze({ health: 100, mercy: 0.9, hurt: 0.4, knocked: 0.8, rise: 0.5, heavy: 8, lift: 5.5, perfect: 0.2, stumble: 22 });
export const CLIMB = Object.freeze({ steep: 1.25, speed: 1.3, side: 1.15, cost: 9, hold: 2.5, leap: 1.7, leapTime: 0.32, leapCost: 20, lip: 0.55, reach: 0.6 });
export const GLIDE = Object.freeze({ speed: 6.4, idle: 0.55, accel: 5, turn: 3.4, sink: 1.9, rise: 1.4, settle: 7, cost: 6, height: 1.2, fade: 6 });
export const SWIM = Object.freeze({ depth: 1.15, float: 1.05, speed: 2.1, fast: 3.3, accel: 7, cost: 5, fastCost: 13, tread: 1.5, wade: 0.65, shallow: 0.35 });
export const PLAIN = Object.freeze({ power: 1, guard: 0, glide: 1, sink: 1, swim: 1 });

const BUFFERED = Object.freeze(['attack', 'jump', 'dodge']);
const easeOut = (s, power = 2) => 1 - (1 - Math.min(1, Math.max(0, s))) ** power;
const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

export function createPlayer({ x = 0, z = 0, facing = 0, ground, health = VITALS.health, stamina = STAMINA.max, traits = PLAIN }) {
  return {
    x, y: ground(x, z), z, vx: 0, vy: 0, vz: 0, facing, state: 'move', time: 0, grounded: true, airTime: 0, peak: 0,
    attack: null, charge: 0, hit: new Set(), held: 0, armed: false, buffered: { attack: 0, jump: 0, dodge: 0 },
    dodgeX: 0, dodgeZ: 1, leap: 0, stamina, staminaMax: stamina, rest: 0, tired: false, sprinting: false, health, max: health, mercy: 0,
    shore: [x, z], traits: { ...traits }, events: [],
  };
}

export function growPlayer(player, { health, stamina }) {
  player.health += Math.max(0, health - player.max); player.max = health;
  player.stamina += Math.max(0, stamina - player.staminaMax); player.staminaMax = stamina;
}

export const floorTop = (deck, x, z) => {
  const dx = deck.bx - deck.ax, dz = deck.bz - deck.az, t = ((x - deck.ax) * dx + (z - deck.az) * dz) / (dx * dx + dz * dz);
  return t >= 0 && t <= 1 && Math.hypot(x - deck.ax - dx * t, z - deck.az - dz * t) <= deck.width / 2 ? deck.ay + (deck.by - deck.ay) * t : -Infinity;
};

export function floorAt(world, x, z, y = Infinity) {
  let floor = world.ground(x, z);
  for (const deck of world.decks ?? []) {
    const top = floorTop(deck, x, z);
    if (top > floor && top <= y + MOVE.snap) floor = top;
  }
  return floor;
}

export const waterAt = (world, x, z) => world.water ? world.water(x, z) : -Infinity;

export function pressPlayer(player, action) {
  const waiting = action === 'attack' && player.state === 'attack' ? ATTACKS[player.attack].chain - player.time : 0;
  if (BUFFERED.includes(action)) player.buffered[action] = MOVE.buffer + Math.max(0, waiting);
  if (action === 'attack') player.armed = true;
}

export const invulnerable = player => player.state === 'dodge' && player.time >= DODGE.guard[0] && player.time <= DODGE.guard[1];
export const perfectDodge = player => player.state === 'dodge' && player.time <= VITALS.perfect;
const STAGGERED = Object.freeze(['hurt', 'knocked', 'rise', 'down']);
const SLOPE = 0.2;

export function slopeAt(ground, x, z, out = [0, 0]) {
  out[0] = (ground(x + SLOPE, z) - ground(x - SLOPE, z)) / (2 * SLOPE);
  out[1] = (ground(x, z + SLOPE) - ground(x, z - SLOPE)) / (2 * SLOPE);
  return out;
}

export function updraftAt(world, x, z, y = -Infinity) {
  for (const draft of world.updrafts ?? []) if (Math.hypot(x - draft.x, z - draft.z) < draft.radius) return draft.lift * Math.min(1, Math.max(0, ((draft.top ?? Infinity) - y) / GLIDE.fade));
  return 0;
}

export function hurtPlayer(player, { damage, knock = 0, fromX, fromZ }) {
  const taken = Math.min(player.health, damage * (1 - player.traits.guard), player.max * MAX_HIT_SHARE);
  player.health -= taken;
  player.mercy = VITALS.mercy;
  const dx = player.x - fromX, dz = player.z - fromZ, length = Math.hypot(dx, dz) || 1;
  player.vx = dx / length * knock; player.vz = dz / length * knock;
  player.attack = null; player.charge = 0; player.sprinting = false;
  for (const action of BUFFERED) player.buffered[action] = 0;
  if (player.health <= 0) enter(player, 'down');
  else if (knock >= VITALS.heavy) { enter(player, 'knocked'); player.vy = VITALS.lift; player.grounded = false; player.peak = player.y; }
  else enter(player, 'hurt');
  player.events.push({ type: player.state === 'down' ? 'down' : 'hurt', damage: taken, heavy: player.state === 'knocked' });
  return taken;
}

export function placePlayer(player, x, z, facing, ground) {
  Object.assign(player, { x, z, y: ground(x, z), vx: 0, vy: 0, vz: 0, facing, grounded: true, airTime: 0, attack: null, charge: 0, sprinting: false, mercy: 0, stamina: player.staminaMax, tired: false });
  player.shore[0] = x; player.shore[1] = z;
  enter(player, 'move');
}

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

function canGlide(player, world) {
  return !player.grounded && !player.tired && player.stamina > 0 && player.y - Math.max(floorAt(world, player.x, player.z, player.y), waterAt(world, player.x, player.z)) > GLIDE.height;
}

function tryJump(player) {
  if (!player.buffered.jump || !(player.grounded || player.airTime < MOVE.coyote) || player.vy > 0) return false;
  player.vy = MOVE.jump; player.grounded = false; player.airTime = MOVE.coyote; player.buffered.jump = 0; player.peak = player.y;
  enter(player, 'move'); player.attack = null; player.charge = 0;
  player.events.push({ type: 'jump' });
  return true;
}

function steer(player, input, dt, world, top) {
  const depth = waterAt(world, player.x, player.z) - player.y, pace = top * (player.grounded && depth > SWIM.shallow ? SWIM.wade : 1);
  const magnitude = Math.min(1, Math.hypot(input.moveX, input.moveZ)), wantX = input.moveX * pace, wantZ = input.moveZ * pace;
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
  if (!player.grounded) {
    if (player.buffered.jump && canGlide(player, world)) { player.buffered.jump = 0; enter(player, 'glide'); player.vy = Math.max(player.vy, -GLIDE.sink); player.events.push({ type: 'glide' }); }
    return;
  }
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

function staggered(player, dt) {
  if (player.grounded) {
    const speed = Math.hypot(player.vx, player.vz), keep = Math.max(0, speed - MOVE.brake * 0.5 * dt);
    if (speed > 1e-6) { player.vx *= keep / speed; player.vz *= keep / speed; }
  }
  if (player.state === 'hurt' && player.time >= VITALS.hurt) enter(player, 'move');
  else if (player.state === 'knocked' && player.time >= VITALS.knocked && player.grounded) { enter(player, 'rise'); player.vx = 0; player.vz = 0; }
  else if (player.state === 'rise' && player.time >= VITALS.rise) enter(player, 'move');
}

const tilt = [0, 0], probe = [0, 0];

function letGo(player, kind, push = 1.5) {
  const length = Math.hypot(tilt[0], tilt[1]) || 1;
  enter(player, 'move');
  player.grounded = false; player.airTime = MOVE.coyote; player.peak = player.y; player.vy = 0;
  player.vx = -tilt[0] / length * push; player.vz = -tilt[1] / length * push;
  player.events.push({ type: kind });
}

function grab(player, input, world, x, z) {
  const push = Math.hypot(input.moveX, input.moveZ);
  if (!['move', 'glide'].includes(player.state) || player.tired || player.stamina <= 0 || push < 0.3) return false;
  slopeAt(world.ground, x, z, probe);
  const steep = Math.hypot(probe[0], probe[1]), facing = steep > 0.3 ? Math.atan2(probe[0], probe[1]) : Math.atan2(input.moveX, input.moveZ);
  if ((input.moveX * Math.sin(facing) + input.moveZ * Math.cos(facing)) / push < 0.5) return false;
  enter(player, 'climb');
  player.x = x; player.z = z; player.y = world.ground(x, z);
  player.vx = 0; player.vy = 0; player.vz = 0; player.grounded = false; player.leap = 0; player.sprinting = false;
  player.facing = facing;
  player.events.push({ type: 'grab' });
  return true;
}

function settleOn(player, world, x, z, kind) {
  player.x = x; player.z = z; player.y = world.ground(x, z);
  player.vx = 0; player.vy = 0; player.vz = 0; player.grounded = true; player.airTime = 0;
  enter(player, 'move');
  player.events.push({ type: kind });
}

function climbing(player, input, dt, world) {
  const { ground } = world;
  slopeAt(ground, player.x, player.z, tilt);
  const steep = Math.hypot(tilt[0], tilt[1]);
  if (steep < 0.3) { tilt[0] = Math.sin(player.facing); tilt[1] = Math.cos(player.facing); }
  const nx = steep < 0.3 ? tilt[0] : tilt[0] / steep, nz = steep < 0.3 ? tilt[1] : tilt[1] / steep;
  player.facing = Math.atan2(nx, nz);
  if (player.buffered.dodge) { player.buffered.dodge = 0; letGo(player, 'let-go'); return; }
  player.buffered.attack = 0;
  if (player.buffered.jump && !player.leap) { player.buffered.jump = 0; player.leap = CLIMB.leapTime; spend(player, CLIMB.leapCost); player.events.push({ type: 'leap' }); }
  const leaping = player.leap > 0;
  player.leap = Math.max(0, player.leap - dt);
  const up = leaping ? CLIMB.leap / CLIMB.leapTime : (input.moveX * nx + input.moveZ * nz) * CLIMB.speed;
  const side = leaping ? 0 : (input.moveZ * nx - input.moveX * nz) * CLIMB.side;
  const moving = Math.abs(up) + Math.abs(side) > 0.1;
  if (!leaping) spend(player, (moving ? CLIMB.cost : CLIMB.hold) * dt);
  if (player.stamina <= 0) { letGo(player, 'slip', 0.8); return; }
  if (up > 0) {
    const ax = player.x + nx * CLIMB.reach, az = player.z + nz * CLIMB.reach, ahead = ground(ax, az);
    slopeAt(ground, ax, az, probe);
    if (ahead - player.y < CLIMB.lip && Math.hypot(probe[0], probe[1]) < CLIMB.steep) { player.leap = 0; settleOn(player, world, ax, az, 'mantle'); return; }
  }
  const target = player.y + up * dt;
  let x = player.x - nz * side * dt, z = player.z + nx * side * dt;
  for (let i = 0; i < 6; i++) {
    const miss = target - ground(x, z);
    if (Math.abs(miss) < 1e-4) break;
    slopeAt(ground, x, z, probe);
    const squared = probe[0] * probe[0] + probe[1] * probe[1];
    if (squared < 0.09) { x += nx * Math.sign(miss) * 0.05; z += nz * Math.sign(miss) * 0.05; continue; }
    const gap = Math.max(-0.4, Math.min(0.4, miss / squared));
    x += probe[0] * gap; z += probe[1] * gap;
  }
  slopeAt(ground, x, z, probe);
  if (up < 0 && Math.hypot(probe[0], probe[1]) < CLIMB.steep) { settleOn(player, world, x, z, 'step-off'); return; }
  player.x = x; player.z = z; player.y = ground(x, z);
  player.vx = 0; player.vy = 0; player.vz = 0;
  collide(player, world);
}

function gliding(player, input, dt, world) {
  player.buffered.attack = 0; player.buffered.dodge = 0;
  if (player.buffered.jump) { player.buffered.jump = 0; enter(player, 'move'); player.events.push({ type: 'glide-end' }); return; }
  spend(player, GLIDE.cost * player.traits.glide * dt);
  if (player.tired) { enter(player, 'move'); player.events.push({ type: 'glide-end', tired: true }); return; }
  const magnitude = Math.min(1, Math.hypot(input.moveX, input.moveZ));
  const wantX = magnitude > 0.2 ? input.moveX * GLIDE.speed : Math.sin(player.facing) * GLIDE.speed * GLIDE.idle;
  const wantZ = magnitude > 0.2 ? input.moveZ * GLIDE.speed : Math.cos(player.facing) * GLIDE.speed * GLIDE.idle;
  const dx = wantX - player.vx, dz = wantZ - player.vz, gap = Math.hypot(dx, dz), step = Math.min(gap, GLIDE.accel * dt);
  if (gap > 1e-6) { player.vx += dx / gap * step; player.vz += dz / gap * step; }
  if (Math.hypot(player.vx, player.vz) > 0.5) { const turn = angleTo(player.facing, Math.atan2(player.vx, player.vz)); player.facing += Math.sign(turn) * Math.min(Math.abs(turn), GLIDE.turn * dt); }
  const lift = updraftAt(world, player.x, player.z, player.y), wantY = lift ? GLIDE.rise * lift : -GLIDE.sink * player.traits.sink;
  player.vy += Math.max(-GLIDE.settle * dt, Math.min(GLIDE.settle * dt, wantY - player.vy));
}

function dodging(player, input, dt, world) {
  const before = player.time - dt, s = player.time / DODGE.time;
  slide(player, DODGE.distance * (easeOut(s, 2.4) - easeOut(before / DODGE.time, 2.4)), player.dodgeX, player.dodgeZ, world);
  player.vx = 0; player.vz = 0;
  if (player.time >= DODGE.punish && player.buffered.attack) { startAttack(player, 'light1', input, world); return; }
  if (s >= 1) { enter(player, 'move'); const carry = MOVE.jog * 0.6; player.vx = player.dodgeX * carry; player.vz = player.dodgeZ * carry; }
}

function shove(player, solids) {
  for (const solid of solids) {
    const dx = player.x - solid.x, dz = player.z - solid.z, distance = Math.hypot(dx, dz), least = solid.radius + MOVE.radius;
    if (distance < least && player.y < solid.top && player.y + MOVE.height > solid.bottom) {
      const nx = distance > 1e-6 ? dx / distance : 1, nz = distance > 1e-6 ? dz / distance : 0;
      player.x = solid.x + nx * least; player.z = solid.z + nz * least;
      const into = player.vx * nx + player.vz * nz;
      if (into < 0) { player.vx -= into * nx; player.vz -= into * nz; }
    }
  }
}

function collide(player, world) {
  shove(player, world.solids);
  if (world.statics) shove(player, world.statics.near(player.x, player.z, MOVE.radius));
  const { x, z, rx, rz } = world.bounds, reach = Math.hypot((player.x - x) / rx, (player.z - z) / rz);
  if (reach > 1) { player.x = x + (player.x - x) / reach; player.z = z + (player.z - z) / reach; }
}

function swimming(player, input, dt, world) {
  for (const action of BUFFERED) player.buffered[action] = 0;
  const fast = input.sprint && !player.tired, magnitude = Math.min(1, Math.hypot(input.moveX, input.moveZ)), top = fast ? SWIM.fast : SWIM.speed;
  const dx = input.moveX * top - player.vx, dz = input.moveZ * top - player.vz, gap = Math.hypot(dx, dz), step = Math.min(gap, SWIM.accel * dt);
  if (gap > 1e-6) { player.vx += dx / gap * step; player.vz += dz / gap * step; }
  if (magnitude > 0.05) { const turn = angleTo(player.facing, Math.atan2(input.moveX, input.moveZ)); player.facing += Math.sign(turn) * Math.min(Math.abs(turn), MOVE.turn * 0.5 * dt); }
  player.sprinting = fast && magnitude > 0.2;
  spend(player, (magnitude > 0.05 ? (player.sprinting ? SWIM.fastCost : SWIM.cost) : SWIM.tread) * player.traits.swim * dt);
  if (player.stamina <= 0) {
    placePlayer(player, player.shore[0], player.shore[1], player.facing, (x, z) => floorAt(world, x, z));
    player.events.push({ type: 'washed' });
    return;
  }
  player.x += player.vx * dt; player.z += player.vz * dt;
  collide(player, world);
  const water = waterAt(world, player.x, player.z), floor = floorAt(world, player.x, player.z, water);
  if (water - floor < SWIM.depth - 0.1) { settleOn(player, world, player.x, player.z, 'wade-out'); player.y = floor; return; }
  player.y = water - SWIM.float;
}

function dive(player, world, floor) {
  const water = waterAt(world, player.x, player.z);
  if (water - floor <= SWIM.depth || player.y > water - (player.grounded ? SWIM.float - 1e-3 : 0.1)) return false;
  const speed = -player.vy;
  enter(player, 'swim');
  player.y = water - SWIM.float; player.vy = 0; player.grounded = false; player.airTime = 0; player.attack = null; player.charge = 0;
  player.events.push({ type: 'swim', speed });
  return true;
}

function fall(player, input, dt, world) {
  if (player.state === 'climb' || player.state === 'swim') return;
  const ox = player.x, oz = player.z, base = player.grounded ? floorAt(world, ox, oz, player.y) : player.y;
  player.x += player.vx * dt; player.z += player.vz * dt;
  collide(player, world);
  let floor = floorAt(world, player.x, player.z, Math.max(player.y, base));
  const moved = Math.hypot(player.x - ox, player.z - oz);
  if (moved > 1e-6 && floor - base > (player.grounded ? moved * CLIMB.steep : 0.02)) {
    if (grab(player, input, world, player.x, player.z)) return;
    player.x = ox; player.z = oz;
    slopeAt(world.ground, player.x + (player.x - ox), player.z + (player.z - oz), tilt);
    const steep = Math.hypot(tilt[0], tilt[1]) || 1, nx = tilt[0] / steep, nz = tilt[1] / steep, into = player.vx * nx + player.vz * nz;
    if (into > 0) { player.vx -= into * nx; player.vz -= into * nz; }
    floor = floorAt(world, ox, oz, player.y);
  }
  if (player.grounded) {
    if (player.y - floor > Math.min(MOVE.snap, moved * CLIMB.steep + 0.01)) { player.grounded = false; player.airTime = 0; player.vy = 0; player.peak = player.y; }
    else {
      player.y = floor;
      if (dive(player, world, floor)) return;
      if (player.state === 'move' && waterAt(world, player.x, player.z) - floor < SWIM.shallow) { player.shore[0] = player.x; player.shore[1] = player.z; }
      return;
    }
  }
  player.airTime += dt;
  if (player.state !== 'glide') player.vy -= (player.vy > 0 ? MOVE.gravity : MOVE.fall) * dt;
  player.y += player.vy * dt;
  player.peak = Math.max(player.peak, player.y);
  if (dive(player, world, floor)) return;
  if (player.y <= floor) {
    const speed = -player.vy, hard = speed > VITALS.stumble && player.state === 'move';
    player.events.push({ type: 'land', speed, height: player.peak - floor, hard });
    player.y = floor; player.vy = 0; player.grounded = true; player.airTime = 0;
    if (player.state === 'glide') { enter(player, 'move'); player.events.push({ type: 'glide-end' }); }
    if (hard) { enter(player, 'rise'); player.vx *= 0.3; player.vz *= 0.3; }
  }
}

export function stepPlayer(player, input, dt, world) {
  for (const action of BUFFERED) player.buffered[action] = Math.max(0, player.buffered[action] - dt);
  player.held = input.attackHeld ? player.held + dt : 0;
  if (!input.attackHeld) player.armed = false;
  player.time += dt;
  player.mercy = Math.max(0, player.mercy - dt);
  player.rest = Math.max(0, player.rest - dt);
  if (!player.rest && !player.sprinting && player.state !== 'charge' && player.state !== 'swim') {
    player.stamina = Math.min(player.staminaMax, player.stamina + (player.tired ? STAMINA.tiredRegen : STAMINA.regen) * dt);
    if (player.tired && player.stamina >= STAMINA.recover) player.tired = false;
  }
  if (STAGGERED.includes(player.state)) staggered(player, dt);
  else if (player.state === 'attack') attacking(player, input, dt, world);
  else if (player.state === 'charge') charging(player, input, dt, world);
  else if (player.state === 'dodge') dodging(player, input, dt, world);
  else if (player.state === 'climb') climbing(player, input, dt, world);
  else if (player.state === 'glide') gliding(player, input, dt, world);
  else if (player.state === 'swim') swimming(player, input, dt, world);
  else locomotion(player, input, dt, world);
  if (player.state !== 'move' && player.state !== 'swim') player.sprinting = false;
  fall(player, input, dt, world);
}
