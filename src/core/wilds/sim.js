import { clockRandom } from '../test-pins.js';
import { MOVE, VITALS, createPlayer, floorAt, growPlayer, hurtPlayer, invulnerable, perfectDodge, placePlayer, pressPlayer, stepPlayer } from './player.js';
import { ATTACKS, hitDamage } from './moves.js';
import { STAG, createStag, hurtStag, resetStag, stagAwake, stepStag, threatens, wakeStag } from './stag.js';
import { castSkill, createPet, hurtPet, patPet, petDown, placePet, revivePet, stepPet, warnPet, whistlePet } from './pet.js';
import { createStatics } from './solids.js';
import { plantValley, trunkSolids } from './flora.js';
import { emptyWilds, wildsStats } from './progress.js';
import { POTION } from './gear.js';

export const POST = Object.freeze({ radius: 0.17, height: 1.35 });
export const DUMMY = Object.freeze({ radius: 0.3, height: 1.65, health: 100, mend: 2.2, refill: 1.1, stiffness: 140, damping: 8, shove: 0.24 });
export const LOCK = Object.freeze({ range: 22, keep: 28, cone: 1.25 });
export const FLURRY = Object.freeze({ time: 1.3, slow: 0.12, haste: 1.25, damage: 1.5 });
export const CAMPFIRE = Object.freeze({ light: 2.8, radius: 0.55, revive: 3.2 });
export const ENCOUNTER = Object.freeze({ enter: 1, calm: 14, respawn: 2.6, rematch: 4 });
export const DAY = Object.freeze({ length: 720, dawn: 6.5, dusk: 20.5 });
export const REACH = Object.freeze({ secret: 1.8, herb: 1.5, shop: 2.6, rise: 1.6 });
export const HERB = Object.freeze({ heal: 18 });

export function createSim(layout, ground, { bond = 0, kind = 'cat', rng = clockRandom, progress = emptyWilds(), hour = 9 } = {}) {
  const stats = wildsStats(progress), trees = plantValley(ground), lit = progress.lit, beaten = progress.beaten.includes('stag');
  const world = { ground, targets: [], solids: [], statics: createStatics([...layout.walls, ...trunkSolids(trees)]), bounds: layout.bounds, updrafts: layout.updrafts, decks: layout.decks, water: layout.water, lock: null };
  const floor = (x, z) => floorAt(world, x, z);
  const player = createPlayer({ ...layout.spawn, ground: floor, health: stats.health, stamina: stats.stamina, traits: stats.traits });
  const { x: dx, z: dz } = layout.dummy, base = ground(dx, dz);
  const dummy = { id: 'dummy', x: dx, z: dz, y: base, radius: DUMMY.radius, bottom: base, top: base + DUMMY.height, health: DUMMY.health, max: DUMMY.health, tiltX: 0, tiltZ: 0, spinX: 0, spinZ: 0, hurt: 0, quiet: 0, broken: 0 };
  const posts = layout.posts.map(([x, z], i) => { const y = ground(x, z); return { id: `post-${i}`, x, z, y, radius: POST.radius, bottom: y, top: y + POST.height }; });
  const stones = layout.ring.places.map(([x, z], i) => { const y = ground(x, z); return { id: `stone-${i}`, x, z, y, radius: layout.stone.radius, bottom: y, top: y + layout.stone.height }; });
  const arena = { x: layout.ring.x, z: layout.ring.z, radius: layout.ring.radius, facing: layout.ring.facing, ground };
  const stag = createStag(arena);
  if (beaten) stag.state = 'gone';
  const pet = createPet({ x: player.x + 0.9, z: player.z + 1.2, ground: floor, bond, kind, rng });
  const campfires = layout.campfires.map(fire => ({ ...fire, y: ground(fire.x, fire.z), radius: CAMPFIRE.radius, lit: lit.includes(fire.id) }));
  const secrets = layout.secrets.map(spot => ({ ...spot, y: floor(spot.x, spot.z), found: progress.secrets.includes(spot.id), dug: !spot.buried }));
  const herbs = layout.herbs.map(spot => ({ ...spot, y: floor(spot.x, spot.z), picked: false }));
  const merchant = { ...layout.merchant, y: ground(layout.merchant.x, layout.merchant.z) };
  const sim = {
    layout, ground, floor, rng, player, pet, stag, dummy, posts, stones, campfires, arena, trees, secrets, herbs, merchant,
    level: stats.level, potions: progress.potions, hour,
    lastFire: campfires.find(fire => fire.lit)?.id ?? campfires[0].id,
    encounter: beaten ? 'won' : 'calm', lock: null, stop: 0, flurry: 0, perfect: false, taunt: 0, down: 0, events: [], queued: [],
    playerBody: { id: 'player', x: 0, z: 0, radius: MOVE.radius, airborne: 0 }, petBody: { id: 'pet', x: 0, z: 0, radius: pet.radius, airborne: 0 },
    world,
  };
  seatStag(sim);
  return sim;
}

function seatStag(sim) {
  const here = sim.stag.state !== 'gone' ? [sim.stag] : [];
  sim.world.targets = [sim.dummy, ...here];
  sim.world.solids = [...sim.posts, ...sim.stones, sim.dummy, ...here];
}

const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

export function pickTarget(sim, viewYaw) {
  const { player } = sim;
  let best = null, bestScore = Infinity;
  for (const target of sim.world.targets) {
    const dx = target.x - player.x, dz = target.z - player.z, distance = Math.hypot(dx, dz) - target.radius, off = Math.abs(angleTo(viewYaw, Math.atan2(dx, dz)));
    if (distance > LOCK.range || off > LOCK.cone) continue;
    const score = distance + off * 6;
    if (score < bestScore) { best = target; bestScore = score; }
  }
  return best;
}

export function toggleLock(sim, viewYaw) {
  sim.lock = sim.lock ? null : pickTarget(sim, viewYaw)?.id ?? null;
  sim.queued.push({ type: sim.lock ? 'lock' : 'unlock' });
  return sim.lock;
}

export const press = (sim, action) => pressPlayer(sim.player, action);
export const lockTarget = sim => sim.world.targets.find(target => target.id === sim.lock) ?? null;
export const foe = sim => sim.encounter === 'fight' && stagAwake(sim.stag) ? sim.stag : null;

export function petSkill(sim) {
  const target = foe(sim);
  const cast = castSkill(sim.pet, target);
  if (!cast) sim.queued.push({ type: 'skill-wait', cooldown: sim.pet.cooldown });
  return cast;
}

const flat = (entry, player) => Math.hypot(entry.x - player.x, entry.z - player.z);
const within = (entry, player, reach) => flat(entry, player) < reach && Math.abs(entry.y - player.y) < REACH.rise;

function nearest(list, player, reach, open) {
  let best = null, closest = reach;
  for (const entry of list) if (open(entry) && within(entry, player, closest)) { best = entry; closest = flat(entry, player); }
  return best;
}

export const nextRest = hour => hour >= DAY.dawn && hour < DAY.dusk ? DAY.dusk : DAY.dawn;

function rest(sim, fire) {
  const { player, pet } = sim;
  player.health = player.max; player.stamina = player.staminaMax; sim.lastFire = fire.id;
  revivePet(pet);
  for (const herb of sim.herbs) herb.picked = false;
  sim.hour = nextRest(sim.hour);
  sim.queued.push({ type: 'rest', id: fire.id, hour: sim.hour });
}

export function interact(sim) {
  const { player, pet } = sim;
  const fire = sim.campfires.find(entry => entry.lit && flat(entry, player) < CAMPFIRE.light);
  if (fire && sim.encounter !== 'fight') { rest(sim, fire); return 'rest'; }
  if (within(sim.merchant, player, REACH.shop)) { sim.queued.push({ type: 'shop' }); return 'shop'; }
  const secret = nearest(sim.secrets, player, REACH.secret, entry => !entry.found && entry.dug);
  if (secret) { secret.found = true; sim.queued.push({ type: 'secret', id: secret.id }); return 'secret'; }
  const herb = nearest(sim.herbs, player, REACH.herb, entry => !entry.picked);
  if (herb) {
    herb.picked = true;
    const healed = Math.min(HERB.heal, player.max - player.health);
    player.health += healed;
    sim.queued.push({ type: 'herb', healed });
    return 'herb';
  }
  if (sim.encounter === 'won' && Math.hypot(sim.arena.x - player.x, sim.arena.z - player.z) < ENCOUNTER.rematch) {
    resetStag(sim.stag, sim.ground);
    seatStag(sim);
    sim.encounter = 'calm';
    sim.queued.push({ type: 'rematch' });
    return 'rematch';
  }
  if (!foe(sim) && Math.hypot(pet.x - player.x, pet.z - player.z) < 1.8 && patPet(pet, player)) {
    sim.queued.push({ type: 'pat' });
    return 'pat';
  }
  return null;
}

export function interactable(sim) {
  const { player } = sim;
  if (sim.encounter !== 'fight' && sim.campfires.some(entry => entry.lit && flat(entry, player) < CAMPFIRE.light)) return 'rest';
  if (within(sim.merchant, player, REACH.shop)) return 'shop';
  if (nearest(sim.secrets, player, REACH.secret, entry => !entry.found && entry.dug)) return 'secret';
  if (nearest(sim.herbs, player, REACH.herb, entry => !entry.picked)) return 'herb';
  if (sim.encounter === 'won' && Math.hypot(sim.arena.x - player.x, sim.arena.z - player.z) < ENCOUNTER.rematch) return 'rematch';
  if (!foe(sim) && Math.hypot(sim.pet.x - player.x, sim.pet.z - player.z) < 1.8 && !petDown(sim.pet)) return 'pat';
  return null;
}

export function whistle(sim) {
  const came = whistlePet(sim.pet);
  sim.queued.push({ type: came ? 'whistle' : 'whistle-unheard' });
  return came;
}

export function drink(sim) {
  const { player } = sim;
  if (sim.potions <= 0 || player.state === 'down' || player.health >= player.max) { sim.queued.push({ type: 'potion-wait', potions: sim.potions }); return false; }
  sim.potions -= 1;
  player.health = Math.min(player.max, player.health + Math.round(player.max * POTION.heal));
  sim.queued.push({ type: 'potion', potions: sim.potions });
  return true;
}

export function equip(sim, stats, potions = sim.potions) {
  growPlayer(sim.player, { health: stats.health, stamina: stats.stamina });
  sim.player.traits = { ...stats.traits };
  sim.potions = potions;
  if (stats.level > sim.level) {
    sim.player.health = sim.player.max; sim.player.stamina = sim.player.staminaMax;
    sim.queued.push({ type: 'level', level: stats.level, from: sim.level });
  }
  sim.level = stats.level;
}

function strikeDummy(sim, event) {
  const { dummy, player } = sim, attack = ATTACKS[event.attack];
  const damage = Math.round(hitDamage(attack, event.charge, dummy.max) * player.traits.power);
  dummy.health = Math.max(0, dummy.health - damage);
  dummy.hurt = 1; dummy.quiet = 0;
  const dx = dummy.x - player.x, dz = dummy.z - player.z, length = Math.hypot(dx, dz) || 1, shove = DUMMY.shove * damage;
  dummy.spinX += dx / length * shove; dummy.spinZ += dz / length * shove;
  sim.stop = Math.max(sim.stop, attack.hitStop);
  const broke = dummy.health === 0 && !dummy.broken;
  if (broke) dummy.broken = DUMMY.refill;
  sim.events.push({ ...event, damage, health: dummy.health, broke });
}

function strikeStag(sim, event) {
  const { stag } = sim, attack = ATTACKS[event.attack];
  if (stag.state === 'defeat' || stag.state === 'gone') return;
  if (stag.state === 'dormant') begin(sim);
  const heart = stag.heartOpen && event.attack === 'heavy', flurry = sim.flurry > 0;
  const damage = Math.round(hitDamage(attack, event.charge, Infinity) * (heart ? STAG.heartBonus : 1) * (flurry ? FLURRY.damage : 1) * sim.player.traits.power);
  const taken = hurtStag(stag, damage);
  sim.stop = Math.max(sim.stop, attack.hitStop + (heart ? 0.04 : 0));
  sim.events.push({ ...event, damage: taken, heart, flurry, health: stag.health });
}

function settleDummy(dummy, dt) {
  dummy.spinX += (-DUMMY.stiffness * dummy.tiltX - DUMMY.damping * dummy.spinX) * dt;
  dummy.spinZ += (-DUMMY.stiffness * dummy.tiltZ - DUMMY.damping * dummy.spinZ) * dt;
  dummy.tiltX += dummy.spinX * dt; dummy.tiltZ += dummy.spinZ * dt;
  dummy.hurt = Math.max(0, dummy.hurt - dt * 5);
  dummy.quiet += dt;
  if (dummy.broken) {
    dummy.broken = Math.max(0, dummy.broken - dt);
    if (!dummy.broken) dummy.health = dummy.max;
  } else if (dummy.quiet > DUMMY.mend) dummy.health = Math.min(dummy.max, dummy.health + dummy.max * dt);
}

function begin(sim) {
  sim.encounter = 'fight';
  wakeStag(sim.stag);
  sim.events.push({ type: 'awaken' });
}

function respawn(sim) {
  const { player, pet, ground, floor } = sim, fire = sim.campfires.find(entry => entry.id === sim.lastFire);
  const away = Math.atan2(sim.arena.x - fire.x, sim.arena.z - fire.z);
  placePlayer(player, fire.x + Math.sin(away) * 1.8, fire.z + Math.cos(away) * 1.8, away, floor);
  player.health = player.max;
  placePet(pet, player.x + Math.cos(away) * 1.1, player.z - Math.sin(away) * 1.1, floor);
  revivePet(pet);
  if (sim.encounter === 'fight') { resetStag(sim.stag, ground); sim.encounter = 'calm'; }
  sim.lock = null; sim.flurry = 0; sim.taunt = 0; sim.down = 0;
  sim.events.push({ type: 'respawn', id: fire.id });
}

function tendFires(sim) {
  const { player, pet } = sim;
  for (const fire of sim.campfires) {
    const distance = Math.hypot(fire.x - player.x, fire.z - player.z);
    if (distance < CAMPFIRE.light && player.state !== 'down') {
      if (!fire.lit) { fire.lit = true; sim.events.push({ type: 'kindle', id: fire.id }); }
      sim.lastFire = fire.id;
    }
    if (fire.lit && petDown(pet) && Math.hypot(fire.x - pet.x, fire.z - pet.z) < CAMPFIRE.revive) revivePet(pet);
  }
}

function contact(sim, event) {
  const { player, pet } = sim;
  if (event.who === 'pet') { hurtPet(pet, event); return; }
  if (player.state === 'down' || player.mercy > 0) return;
  if (perfectDodge(player) && !sim.perfect) { perfect(sim); return; }
  if (invulnerable(player) || (sim.perfect && player.state === 'dodge')) { sim.events.push({ type: 'evade', attack: event.attack }); return; }
  hurtPlayer(player, event);
  drain(sim, player.events);
}

function perfect(sim) {
  sim.flurry = FLURRY.time; sim.perfect = true;
  sim.events.push({ type: 'perfect', attack: sim.stag.attack });
}

function bodyOf(sim, player) {
  return Object.assign(sim.playerBody, { x: player.x, z: player.z, airborne: player.y - floorAt(sim.world, player.x, player.z, player.y) });
}

function pushOut(body, solids) {
  for (const solid of solids) {
    const dx = body.x - solid.x, dz = body.z - solid.z, distance = Math.hypot(dx, dz), least = solid.radius + body.radius;
    if (distance < least && distance > 1e-6) { body.x = solid.x + dx / distance * least; body.z = solid.z + dz / distance * least; }
  }
}

function drain(sim, from) {
  for (const event of from) sim.events.push(event);
  from.length = 0;
}

export function stepSim(sim, input, dt) {
  sim.events.length = 0;
  drain(sim, sim.queued);
  const frozen = Math.min(sim.stop, dt);
  sim.stop -= frozen;
  const h = dt - frozen;
  if (h <= 0) return sim.events;
  const { player, pet, stag, ground } = sim;
  sim.hour = (sim.hour + h * 24 / DAY.length) % 24;
  const flurry = sim.flurry > 0;
  sim.flurry = Math.max(0, sim.flurry - h);
  sim.taunt = Math.max(0, sim.taunt - h);
  const target = lockTarget(sim);
  if (sim.lock && (!target || Math.hypot(target.x - player.x, target.z - player.z) > LOCK.keep)) { sim.lock = null; sim.events.push({ type: 'unlock' }); }
  sim.world.lock = lockTarget(sim);

  player.events.length = 0;
  stepPlayer(player, input, flurry ? h * FLURRY.haste : h, sim.world);
  if (player.state !== 'dodge') sim.perfect = false;
  for (const event of player.events) {
    if (event.type === 'hit' && event.id === 'dummy') strikeDummy(sim, event);
    else if (event.type === 'hit' && event.id === 'stag') strikeStag(sim, event);
    else {
      sim.events.push(event);
      if (event.type === 'dodge' && stagAwake(stag) && threatens(stag, bodyOf(sim, player), VITALS.perfect)) perfect(sim);
    }
  }
  settleDummy(sim.dummy, h);

  const distance = Math.hypot(sim.arena.x - player.x, sim.arena.z - player.z);
  if (sim.encounter === 'calm' && stag.state === 'dormant' && distance < sim.arena.radius - ENCOUNTER.enter && player.state !== 'down') begin(sim);
  if (sim.encounter === 'fight' && distance > sim.arena.radius + ENCOUNTER.calm && player.state !== 'down') {
    resetStag(stag, ground); sim.encounter = 'calm';
    sim.events.push({ type: 'calm' });
  }

  if (stag.state !== 'gone' && stag.state !== 'dormant') {
    const bodies = [];
    if (player.state !== 'down') bodies.push(bodyOf(sim, player));
    if (!petDown(pet)) { Object.assign(sim.petBody, { x: pet.x, z: pet.z }); bodies.push(sim.petBody); }
    const prey = sim.taunt > 0 && !petDown(pet) ? pet : player;
    stepStag(stag, { prey, bodies, arena: sim.arena, stones: sim.stones, rng: sim.rng }, flurry ? h * FLURRY.slow : h);
    if (!(stag.state === 'attack' && stag.attack === 'charge')) pushOut(stag, sim.stones);
  }
  for (const event of stag.events) {
    if (event.type === 'contact') contact(sim, event);
    else {
      if (event.type === 'telegraph') warnPet(pet, stag, sim.rng);
      if (event.type === 'gone') { sim.encounter = 'won'; sim.lock = null; seatStag(sim); sim.events.push({ type: 'victory' }); }
      sim.events.push(event);
    }
  }
  stag.events.length = 0;

  stepPet(pet, { player, foe: foe(sim), world: sim.world, rng: sim.rng, scents: sim.secrets }, h);
  for (const event of pet.events) {
    if (event.type === 'dug') { const secret = sim.secrets.find(entry => entry.id === event.id); if (secret) secret.dug = true; sim.events.push(event); }
    else if (event.type === 'pet-hit') {
      const taken = hurtStag(stag, event.damage);
      sim.events.push({ ...event, damage: taken, health: stag.health });
    } else if (event.type === 'taunt') sim.taunt = event.time;
    else sim.events.push(event);
  }
  pet.events.length = 0;
  drain(sim, stag.events);

  tendFires(sim);
  if (player.state === 'down' && (sim.down += h) >= ENCOUNTER.respawn) respawn(sim);
  return sim.events;
}
