import { floorAt, waterAt } from './player.js';

export const PET = Object.freeze({
  scent: 16, scentRest: 18, scentGiveUp: 1.6, scentLeash: 12, dig: 1.6, point: 3, swim: 0.45, float: 0.28, paddle: 0.6, step: 0.6, climb: 1.15,
  radius: 0.34, height: 0.6, heel: Object.freeze([0.9, -1.2]), arrive: 0.45, trot: 3.1, run: 6.6, accel: 26, turn: 10, leash: 26,
  sit: 1.1, pat: 1.6, sniffEvery: Object.freeze([5, 9]), sniffFor: 2.4, sniffReach: Object.freeze([1.6, 3.2]),
  health: 44, healthPerBond: 12, strengthPerBond: 0.25, hurt: 0.5, knock: 4.5, out: 1.8, limp: 0.62,
  orbit: 2.6, orbitSpeed: 0.55, close: 1.2, think: Object.freeze([0.7, 1.4]), wary: 5.5, evade: 0.55, evadePerBond: 0.12, hop: 0.36, hopDistance: 2.2, range: 30,
});

export const PET_ATTACKS = Object.freeze({
  pounce: Object.freeze({ windup: 0.32, active: 0.36, recover: 0.45, leap: 9.5, range: Object.freeze([2.2, 4.8]), reach: 0.55, damage: 5, ticks: 1, weight: 2 }),
  swipe: Object.freeze({ windup: 0.16, active: 0.12, recover: 0.34, leap: 0, range: Object.freeze([0, 3]), reach: 0.75, damage: 3, ticks: 1, weight: 3 }),
  spin: Object.freeze({ windup: 0.22, active: 0.6, recover: 0.45, leap: 0, range: Object.freeze([0, 2.6]), reach: 0.95, damage: 2, ticks: 3, weight: 1 }),
});

export const PET_SKILL = Object.freeze({ cooldown: 12, speed: 11, longest: 0.9, reach: 0.6, damage: 5, taunt: 3.2 });

const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const between = (rng, [lo, hi]) => lo + (hi - lo) * rng();
const FIGHTING = Object.freeze(['fight', 'attack', 'dash', 'evade']);

export const petStrength = bond => 1 + PET.strengthPerBond * bond;

export function createPet({ x, z, ground, rng, bond = 0, kind = 'cat' }) {
  const max = PET.health + PET.healthPerBond * bond;
  return {
    id: 'pet', kind, bond, x, z, y: ground(x, z), vx: 0, vz: 0, facing: 0, radius: PET.radius, bottom: 0, top: PET.height,
    state: 'follow', time: 0, health: max, max, attack: null, ticks: 0, closing: 0, think: 0, side: 1, cooldown: 0, sniffAt: between(rng, PET.sniffEvery), still: 0,
    spotX: x, spotZ: z, hopX: 0, hopZ: 0, scent: null, scentAt: 0, best: Infinity, stuck: 0, swimming: false, events: [],
  };
}

function enter(pet, state) { pet.state = state; pet.time = 0; }

export const petFighting = pet => FIGHTING.includes(pet.state);
export const petDown = pet => pet.state === 'out' || pet.state === 'limp';

function head(pet, x, z, speed, dt) {
  const dx = x - pet.x, dz = z - pet.z, distance = Math.hypot(dx, dz);
  const wantX = distance > 1e-6 ? dx / distance * speed : 0, wantZ = distance > 1e-6 ? dz / distance * speed : 0;
  const gx = wantX - pet.vx, gz = wantZ - pet.vz, gap = Math.hypot(gx, gz), step = Math.min(gap, PET.accel * dt);
  if (gap > 1e-6) { pet.vx += gx / gap * step; pet.vz += gz / gap * step; }
  if (Math.hypot(pet.vx, pet.vz) > 0.3) turn(pet, Math.atan2(pet.vx, pet.vz), dt);
}

function brake(pet, dt) {
  const speed = Math.hypot(pet.vx, pet.vz), keep = Math.max(0, speed - PET.accel * dt);
  if (speed > 1e-6) { pet.vx *= keep / speed; pet.vz *= keep / speed; }
}

function turn(pet, toward, dt) {
  const gap = angleTo(pet.facing, toward);
  pet.facing += Math.sign(gap) * Math.min(Math.abs(gap), PET.turn * dt);
}

function heel(player) {
  const fx = Math.sin(player.facing), fz = Math.cos(player.facing), [side, back] = PET.heel;
  return [player.x - fz * side + fx * back, player.z + fx * side + fz * back];
}

function follow(pet, player, dt, speedCap) {
  const [hx, hz] = heel(player), distance = Math.hypot(hx - pet.x, hz - pet.z);
  if (distance < PET.arrive) { brake(pet, dt); return true; }
  const speed = Math.min(speedCap, distance > 2.5 ? PET.run : PET.trot * Math.min(1, 0.4 + distance / 1.2));
  head(pet, hx, hz, speed, dt);
  return false;
}

function choose(distance, rng) {
  const options = Object.entries(PET_ATTACKS).filter(([, attack]) => distance >= attack.range[0] && distance < attack.range[1]);
  if (!options.length) return null;
  let roll = rng() * options.reduce((sum, [, attack]) => sum + attack.weight, 0);
  for (const [id, attack] of options) { roll -= attack.weight; if (roll <= 0) return id; }
  return options.at(-1)[0];
}

function reaches(pet, foe, reach) {
  return Math.hypot(foe.x - pet.x, foe.z - pet.z) - foe.radius - PET.radius <= reach;
}

function strike(pet, foe, damage, attack) {
  pet.events.push({ type: 'pet-hit', attack, damage: damage * petStrength(pet.bond), x: foe.x, z: foe.z });
}

function fight(pet, foe, dt, rng) {
  const dx = pet.x - foe.x, dz = pet.z - foe.z, distance = Math.hypot(dx, dz) || 1, gap = distance - foe.radius - PET.radius;
  pet.think -= dt;
  const around = Math.atan2(dx, dz) + pet.side * PET.orbitSpeed * dt * 3, ring = foe.radius + PET.orbit;
  head(pet, foe.x + Math.sin(around) * ring, foe.z + Math.cos(around) * ring, gap > PET.orbit + 1.5 ? PET.run : PET.trot, dt);
  turn(pet, Math.atan2(foe.x - pet.x, foe.z - pet.z), dt);
  if (pet.think > 0) return;
  pet.think = between(rng, PET.think);
  if (rng() < 0.25) pet.side = -pet.side;
  const id = choose(gap, rng);
  if (!id) return;
  pet.attack = id; pet.ticks = 0; pet.closing = 0;
  enter(pet, 'attack');
  pet.events.push({ type: 'pet-attack', attack: id });
}

function attacking(pet, foe, dt) {
  const attack = PET_ATTACKS[pet.attack];
  if (!attack.leap && pet.time < attack.windup && !reaches(pet, foe, attack.reach) && (pet.closing += dt) < PET.close) {
    head(pet, foe.x, foe.z, PET.run, dt);
    pet.time = 0;
    return;
  }
  const t = pet.time;
  if (t < attack.windup) { brake(pet, dt); turn(pet, Math.atan2(foe.x - pet.x, foe.z - pet.z), dt); return; }
  const active = t - attack.windup;
  if (active < attack.active) {
    if (attack.leap && !reaches(pet, foe, attack.reach)) { pet.vx = Math.sin(pet.facing) * attack.leap; pet.vz = Math.cos(pet.facing) * attack.leap; }
    else brake(pet, dt * 4);
    const due = Math.min(attack.ticks, Math.floor(active / attack.active * attack.ticks) + 1);
    if (pet.ticks < due && reaches(pet, foe, attack.reach)) { pet.ticks = due; strike(pet, foe, attack.damage, pet.attack); }
    else if (pet.ticks < due - 1) pet.ticks = due - 1;
    return;
  }
  brake(pet, dt * 2);
  if (active >= attack.active + attack.recover) { pet.attack = null; enter(pet, 'fight'); }
}

function dashing(pet, foe, dt) {
  pet.vx = Math.sin(pet.facing) * PET_SKILL.speed; pet.vz = Math.cos(pet.facing) * PET_SKILL.speed;
  turn(pet, Math.atan2(foe.x - pet.x, foe.z - pet.z), dt);
  if (reaches(pet, foe, PET_SKILL.reach)) {
    strike(pet, foe, PET_SKILL.damage, 'dash');
    pet.events.push({ type: 'taunt', time: PET_SKILL.taunt });
    pet.vx *= 0.2; pet.vz *= 0.2;
    pet.attack = 'swipe'; pet.ticks = 1;
    enter(pet, 'attack'); pet.time = PET_ATTACKS.swipe.windup + PET_ATTACKS.swipe.active;
  } else if (pet.time >= PET_SKILL.longest) { pet.events.push({ type: 'taunt', time: PET_SKILL.taunt }); enter(pet, 'fight'); }
}

export function castSkill(pet, foe) {
  if (pet.cooldown > 0 || petDown(pet) || pet.state === 'hurt' || !foe) return false;
  pet.cooldown = PET_SKILL.cooldown;
  pet.attack = null;
  pet.facing = Math.atan2(foe.x - pet.x, foe.z - pet.z);
  enter(pet, 'dash');
  pet.events.push({ type: 'pet-skill' });
  return true;
}

export function warnPet(pet, foe, rng) {
  if (!petFighting(pet) || pet.state === 'dash' || Math.hypot(foe.x - pet.x, foe.z - pet.z) > PET.wary + foe.radius) return false;
  if (rng() >= PET.evade + PET.evadePerBond * pet.bond) return false;
  const dx = pet.x - foe.x, dz = pet.z - foe.z, length = Math.hypot(dx, dz) || 1;
  pet.hopX = dx / length; pet.hopZ = dz / length; pet.attack = null;
  enter(pet, 'evade');
  pet.events.push({ type: 'pet-evade' });
  return true;
}

export function hurtPet(pet, { damage, knock = PET.knock, fromX, fromZ }) {
  if (petDown(pet) || pet.state === 'evade' && pet.time < PET.hop) return 0;
  const taken = Math.min(pet.health, damage);
  pet.health -= taken;
  const dx = pet.x - fromX, dz = pet.z - fromZ, length = Math.hypot(dx, dz) || 1;
  pet.vx = dx / length * knock; pet.vz = dz / length * knock; pet.attack = null;
  if (pet.health <= 0) { enter(pet, 'out'); pet.events.push({ type: 'pet-out' }); }
  else { enter(pet, 'hurt'); pet.events.push({ type: 'pet-hurt', damage: taken }); }
  return taken;
}

export function revivePet(pet) {
  pet.health = pet.max;
  if (petDown(pet) || pet.state === 'hurt') { enter(pet, 'follow'); pet.events.push({ type: 'pet-revive' }); }
}

export function patPet(pet, player) {
  if (petDown(pet) || petFighting(pet) || pet.state === 'hurt') return false;
  pet.facing = Math.atan2(player.x - pet.x, player.z - pet.z);
  enter(pet, 'pat');
  pet.events.push({ type: 'pet-pat' });
  return true;
}

export function placePet(pet, x, z, ground) {
  pet.x = x; pet.z = z; pet.y = ground(x, z); pet.vx = 0; pet.vz = 0; pet.attack = null; pet.scent = null;
  if (!petDown(pet)) enter(pet, 'follow');
}

export function whistlePet(pet) {
  if (petDown(pet) || pet.state === 'hurt') return false;
  pet.attack = null; pet.scent = null;
  enter(pet, 'come');
  pet.events.push({ type: 'pet-come' });
  return true;
}

function smell(pet, player, scents) {
  let best = null, nearest = PET.scent;
  for (const scent of scents) {
    if (scent.found) continue;
    const distance = Math.hypot(scent.x - pet.x, scent.z - pet.z);
    if (distance < nearest && Math.hypot(scent.x - player.x, scent.z - player.z) < PET.scent + 4) { best = scent; nearest = distance; }
  }
  return best;
}

function giveUpScent(pet, state = 'follow') {
  pet.scent = null; pet.scentAt = PET.scentRest;
  enter(pet, state);
}

function scenting(pet, player, scents, dt) {
  const scent = scents.find(entry => entry.id === pet.scent);
  if (!scent || scent.found || Math.hypot(player.x - pet.x, player.z - pet.z) > PET.scentLeash) { giveUpScent(pet); return; }
  const distance = Math.hypot(scent.x - pet.x, scent.z - pet.z);
  if (distance < 1.1) {
    brake(pet, dt);
    enter(pet, scent.buried && !scent.dug ? 'dig' : 'point');
    return;
  }
  if (distance < pet.best - 0.4) { pet.best = distance; pet.stuck = 0; }
  else if ((pet.stuck += dt) > PET.scentGiveUp) { brake(pet, dt); enter(pet, 'point'); return; }
  head(pet, scent.x, scent.z, PET.trot * 1.2, dt);
}

export function stepPet(pet, { player, foe, world, rng, scents = [] }, dt) {
  const ground = (x, z) => floorAt(world, x, z);
  pet.time += dt;
  pet.cooldown = Math.max(0, pet.cooldown - dt);
  pet.scentAt = Math.max(0, pet.scentAt - dt);
  const engaged = foe && Math.hypot(foe.x - player.x, foe.z - player.z) < PET.range;
  const playerStill = Math.hypot(player.vx, player.vz) < 0.2 && player.state === 'move';
  pet.still = playerStill ? pet.still + dt : 0;
  if (pet.state !== 'out' && Math.hypot(player.x - pet.x, player.z - pet.z) > PET.leash) { const [hx, hz] = heel(player); placePet(pet, hx, hz, ground); }
  switch (pet.state) {
    case 'hurt': brake(pet, dt * 0.6); if (pet.time >= PET.hurt) enter(pet, engaged ? 'fight' : 'follow'); break;
    case 'out': brake(pet, dt * 0.6); if (pet.time >= PET.out) enter(pet, 'limp'); break;
    case 'limp': follow(pet, player, dt, PET.trot * PET.limp); break;
    case 'evade': {
      const s = pet.time / PET.hop, speed = PET.hopDistance / PET.hop * 2 * Math.max(0, 1 - s);
      pet.vx = pet.hopX * speed; pet.vz = pet.hopZ * speed;
      if (pet.time >= PET.hop + 0.15) enter(pet, engaged ? 'fight' : 'follow');
      break;
    }
    case 'dash': if (engaged) dashing(pet, foe, dt); else enter(pet, 'follow'); break;
    case 'attack': if (engaged) attacking(pet, foe, dt); else { pet.attack = null; enter(pet, 'follow'); } break;
    case 'fight': if (engaged) fight(pet, foe, dt, rng); else enter(pet, 'follow'); break;
    case 'pat': brake(pet, dt); if (engaged) enter(pet, 'fight'); else if (pet.time >= PET.pat) enter(pet, 'follow'); break;
    case 'sit': {
      brake(pet, dt);
      const [hx, hz] = heel(player);
      if (engaged) enter(pet, 'fight');
      else if (!playerStill || Math.hypot(hx - pet.x, hz - pet.z) > 1.5) enter(pet, 'follow');
      break;
    }
    case 'come': if (follow(pet, player, dt, PET.run)) enter(pet, engaged ? 'fight' : 'follow'); break;
    case 'scent': if (engaged) giveUpScent(pet, 'fight'); else scenting(pet, player, scents, dt); break;
    case 'point': {
      brake(pet, dt);
      const scent = scents.find(entry => entry.id === pet.scent);
      if (scent) turn(pet, Math.atan2(scent.x - pet.x, scent.z - pet.z), dt);
      if (engaged) giveUpScent(pet, 'fight');
      else if (!scent || pet.time >= PET.point) giveUpScent(pet);
      break;
    }
    case 'dig': {
      brake(pet, dt);
      if (engaged) giveUpScent(pet, 'fight');
      else if (pet.time >= PET.dig) { pet.events.push({ type: 'dug', id: pet.scent }); giveUpScent(pet); }
      break;
    }
    case 'sniff': {
      if (engaged) { enter(pet, 'fight'); break; }
      const away = Math.hypot(pet.spotX - pet.x, pet.spotZ - pet.z);
      if (away > 0.3 && pet.time < 2.5) head(pet, pet.spotX, pet.spotZ, PET.trot, dt);
      else brake(pet, dt);
      if (pet.time > PET.sniffFor + 1 || Math.hypot(player.x - pet.x, player.z - pet.z) > 6) { enter(pet, 'follow'); pet.sniffAt = between(rng, PET.sniffEvery); }
      break;
    }
    default: {
      if (engaged) { enter(pet, 'fight'); pet.think = between(rng, PET.think); break; }
      const arrived = follow(pet, player, dt, PET.run), scent = pet.scentAt > 0 ? null : smell(pet, player, scents);
      pet.sniffAt -= dt;
      if (scent) { pet.scent = scent.id; pet.best = Infinity; pet.stuck = 0; enter(pet, 'scent'); pet.events.push({ type: 'pet-scent', id: scent.id }); }
      else if (arrived && pet.still > PET.sit) { enter(pet, 'sit'); pet.events.push({ type: 'pet-sit' }); }
      else if (pet.sniffAt <= 0 && Math.hypot(player.vx, player.vz) < PET.trot) {
        const angle = rng() * Math.PI * 2, reach = between(rng, PET.sniffReach);
        pet.spotX = pet.x + Math.sin(angle) * reach; pet.spotZ = pet.z + Math.cos(angle) * reach;
        enter(pet, 'sniff'); pet.events.push({ type: 'pet-sniff' });
      }
    }
  }
  const pace = pet.swimming ? PET.paddle : 1, fromX = pet.x, fromZ = pet.z;
  pet.x += pet.vx * pace * dt; pet.z += pet.vz * pace * dt;
  push(pet, world.solids);
  if (world.statics) push(pet, world.statics.near(pet.x, pet.z, PET.radius));
  const moved = Math.hypot(pet.x - fromX, pet.z - fromZ), rise = world.ground(pet.x, pet.z) - world.ground(fromX, fromZ);
  if (moved > 1e-6 && rise > moved * PET.climb && world.ground(pet.x, pet.z) > pet.y + (pet.swimming ? PET.float + PET.step : 0)) { pet.x = fromX; pet.z = fromZ; pet.vx = 0; pet.vz = 0; }
  const below = floorAt(world, pet.x, pet.z, pet.y + PET.step), water = waterAt(world, pet.x, pet.z);
  pet.swimming = water - below > PET.swim;
  pet.y = pet.swimming ? water - PET.float : below; pet.bottom = pet.y; pet.top = pet.y + PET.height;
  return pet.events;
}

function push(pet, solids) {
  for (const solid of solids) {
    if (pet.y >= solid.top || pet.y + PET.height <= solid.bottom) continue;
    const dx = pet.x - solid.x, dz = pet.z - solid.z, distance = Math.hypot(dx, dz), least = solid.radius + PET.radius;
    if (distance < least) { const nx = distance > 1e-6 ? dx / distance : 1, nz = distance > 1e-6 ? dz / distance : 0; pet.x = solid.x + nx * least; pet.z = solid.z + nz * least; }
  }
}
