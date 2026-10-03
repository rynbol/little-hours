import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HILL } from './layout.js';
import { CAMPFIRE, ENCOUNTER, FLURRY, LOCK, POST, createSim, interact, petSkill, press, stepSim, toggleLock } from './sim.js';
import { STAG, hurtStag } from './stag.js';
import { hurtPet } from './pet.js';

const DT = 1 / 120;
const still = { moveX: 0, moveZ: 0, sprint: false, attackHeld: false };
const flat = () => 0;

function seeded(seed = 3) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const make = (options = {}) => createSim(HILL, flat, { rng: seeded(), ...options });

function run(sim, seconds, input = still) {
  const events = [];
  for (let t = 0; t < seconds - 1e-9; t += DT) for (const event of stepSim(sim, typeof input === 'function' ? input(t) : input, DT)) events.push({ ...event, at: t });
  return events;
}

function place(body, x, z, facing = body.facing) { body.x = x; body.z = z; body.facing = facing; }

function facingDummy() {
  const sim = make(), { player, dummy } = sim;
  place(player, dummy.x, dummy.z + 1.1, Math.PI);
  return sim;
}

function awakeStag(sim, gap = 2.6) {
  const { player, stag } = sim;
  place(player, stag.x, stag.z + STAG.radius + gap, Math.PI);
  run(sim, STAG.wake + 0.05);
  place(player, stag.x, stag.z + STAG.radius + gap, Math.PI);
  stag.facing = 0; stag.rest = 99;
  return sim;
}

function sweepAt(sim) {
  Object.assign(sim.stag, { attack: 'sweep', state: 'telegraph', time: 0, side: 1, facing: 0 });
}

test('a landed hit freezes the swing and the dummy for its hit-stop, then both carry on', () => {
  const sim = facingDummy();
  press(sim, 'attack');
  let hitAt = null, frozen = 0;
  for (let t = 0; t < 0.5; t += DT) {
    const before = sim.player.time, events = stepSim(sim, still, DT);
    if (hitAt === null && events.some(event => event.type === 'hit')) hitAt = t;
    else if (hitAt !== null && sim.player.time === before) frozen += DT;
  }
  assert.equal(Math.round(frozen * 1000), 50);
  assert.equal(sim.dummy.health, 90);
});

test('the dummy takes chunks you can see, breaks at zero and stands back up whole', () => {
  const sim = facingDummy();
  let hits = [];
  for (let swing = 0; swing < 30 && !hits.some(event => event.broke); swing++) {
    press(sim, 'attack');
    hits = hits.concat(run(sim, 0.25).filter(event => event.type === 'hit'));
  }
  assert.deepEqual(hits.slice(0, 3).map(event => [event.attack, event.damage]), [['light1', 10], ['light2', 11], ['light3', 18]]);
  assert.ok(hits.at(-1).broke && sim.dummy.health === 0);
  run(sim, 1.2);
  assert.equal(sim.dummy.health, 100);
});

test('lock-on takes a target in view within range, ignores one behind the camera and lets go past the keep distance', () => {
  const sim = make(), { player, dummy } = sim;
  const toward = Math.atan2(dummy.x - player.x, dummy.z - player.z);
  assert.equal(toggleLock(sim, toward + Math.PI), null);
  assert.equal(toggleLock(sim, toward), 'dummy');
  assert.equal(toggleLock(sim, toward), null);
  toggleLock(sim, toward);
  player.z = dummy.z + LOCK.keep + 1;
  const events = run(sim, DT);
  assert.equal(sim.lock, null);
  assert.ok(events.some(event => event.type === 'unlock'));
});

test('a full heavy takes 30 of the dummy\'s 100', () => {
  const sim = facingDummy();
  press(sim, 'attack');
  const hits = run(sim, 1.6, t => ({ ...still, attackHeld: t < 1 })).filter(event => event.type === 'hit');
  assert.deepEqual(hits.map(event => [event.attack, event.damage]), [['light1', 10], ['heavy', 30]]);
});

test('locked on, the player keeps facing the dummy while strafing round it', () => {
  const sim = make(), { player, dummy } = sim;
  toggleLock(sim, Math.PI);
  run(sim, 1.5, { ...still, moveX: 1 });
  const toward = Math.atan2(dummy.x - player.x, dummy.z - player.z), off = Math.atan2(Math.sin(toward - player.facing), Math.cos(toward - player.facing));
  assert.ok(Math.abs(off) < 0.05, `off by ${off}`);
  assert.ok(Math.abs(player.x - HILL.spawn.x) > 2, 'and moved sideways');
});

test('training posts stand solid in the player\'s way', () => {
  const sim = make(), { player } = sim, [x, z] = HILL.posts[0];
  place(player, x, z + 2, Math.PI);
  run(sim, 1.5, { ...still, moveZ: -1 });
  assert.ok(Math.hypot(player.x - x, player.z - z) >= POST.radius + 0.3, `${player.x}, ${player.z}`);
});

test('walking into the stone ring wakes the stag, and walking far away calms it whole', () => {
  const sim = make(), { player, stag, arena } = sim;
  place(player, arena.x, arena.z + arena.radius + 1, Math.PI);
  assert.equal(run(sim, 0.2).length, 0);
  const events = run(sim, 1.5, { ...still, moveZ: -1 });
  assert.ok(events.some(event => event.type === 'awaken'));
  assert.equal(sim.encounter, 'fight');
  run(sim, STAG.wake + 0.1, { ...still, moveZ: -1 });
  hurtStag(stag, 60);
  place(player, arena.x, arena.z + arena.radius + ENCOUNTER.calm + 1);
  assert.ok(run(sim, DT).some(event => event.type === 'calm'));
  assert.equal(stag.state, 'dormant');
  assert.equal(stag.health, stag.max);
});

test('a dodge in the last 0.2 s before a blow slows the stag and opens a flurry under 1.5 s', () => {
  const probe = awakeStag(make());
  sweepAt(probe);
  const landed = run(probe, 1.5).find(event => event.type === 'hurt');
  assert.equal(landed.damage, 16);
  const sim = awakeStag(make());
  sweepAt(sim);
  const dodgeAt = landed.at - 0.1;
  let pressed = false;
  const events = run(sim, landed.at + 0.05, t => { if (!pressed && t >= dodgeAt) { pressed = true; press(sim, 'dodge'); } return pressed ? { ...still, moveX: 1 } : still; });
  assert.ok(events.some(event => event.type === 'perfect'));
  assert.ok(!events.some(event => event.type === 'hurt'));
  assert.equal(sim.player.health, 100);
  const clock = sim.stag.clock;
  let open = 0;
  for (let t = 0; t < 3 && sim.flurry > 0; t += DT) { stepSim(sim, still, DT); open += DT; }
  assert.ok(open > 1 && open < 1.5, `flurry lasted ${open}`);
  assert.ok(sim.stag.clock - clock < open * FLURRY.slow + 0.01);
});

test('a dodge after the blow has landed is too late and the hit takes its chunk', () => {
  const sim = awakeStag(make());
  sweepAt(sim);
  const events = run(sim, 1.5, t => { if (t > 1.2) press(sim, 'dodge'); return still; });
  assert.ok(events.some(event => event.type === 'hurt'));
  assert.ok(!events.some(event => event.type === 'perfect'));
  assert.equal(sim.player.health, 84);
});

test('light hits in a flurry do half again as much', () => {
  const sim = awakeStag(make(), 0.35);
  sim.flurry = 1;
  press(sim, 'attack');
  const hit = run(sim, 0.3).find(event => event.type === 'hit');
  assert.deepEqual([hit.id, hit.damage, hit.flurry], ['stag', 15, true]);
});

test('a stag kneeling in defeat takes no more blows', () => {
  const sim = awakeStag(make(), 0.35);
  hurtStag(sim.stag, STAG.health / 2);
  run(sim, STAG.shift + 0.1);
  hurtStag(sim.stag, STAG.health);
  press(sim, 'attack');
  assert.deepEqual(run(sim, 0.3).filter(event => event.type === 'hit'), []);
});

test('a charge into a standing stone stuns the stag, and a heavy on its open heart does 1.8 times', () => {
  const sim = make(), { player, stag, stones, arena } = sim;
  const stone = stones[4], dx = stone.x - arena.x, dz = stone.z - arena.z, length = Math.hypot(dx, dz);
  place(player, stone.x - dx / length * 2.5, stone.z - dz / length * 2.5, Math.atan2(-dx, -dz));
  run(sim, STAG.wake + 0.1);
  Object.assign(stag, { attack: 'charge', state: 'telegraph', time: 0, facing: Math.atan2(dx, dz), rest: 99 });
  const events = run(sim, 2.5);
  assert.ok(events.some(event => event.type === 'stun' && event.stone === stone.id));
  assert.ok(stag.heartOpen);
  place(player, stag.x - Math.sin(stag.facing) * (STAG.radius + 0.45), stag.z - Math.cos(stag.facing) * (STAG.radius + 0.45), stag.facing);
  player.mercy = 0; player.state = 'move'; player.health = 100;
  press(sim, 'attack');
  const swing = run(sim, 1.6, t => ({ ...still, attackHeld: t < 0.9 })).filter(event => event.type === 'hit');
  const heavy = swing.find(event => event.attack === 'heavy');
  assert.deepEqual([heavy.damage, heavy.heart], [54, true]);
});

test('defeat wakes you at the last lit campfire with full health, the pet back and the stag calm and whole', () => {
  const sim = make(), { player, pet, stag } = sim;
  const fire = sim.campfires.find(entry => entry.id === 'stones');
  place(player, fire.x + CAMPFIRE.light - 0.5, fire.z);
  assert.ok(run(sim, DT).some(event => event.type === 'kindle' && event.id === 'stones'));
  awakeStag(sim);
  hurtStag(stag, 100);
  hurtPet(pet, { damage: 999, fromX: stag.x, fromZ: stag.z });
  player.health = 10;
  sweepAt(sim);
  const events = run(sim, 1.5 + ENCOUNTER.respawn);
  assert.ok(events.some(event => event.type === 'down'));
  assert.ok(events.some(event => event.type === 'respawn' && event.id === 'stones'));
  assert.ok(Math.hypot(player.x - fire.x, player.z - fire.z) < 2.5);
  assert.deepEqual([player.health, player.state, pet.health === pet.max, pet.state, stag.state, stag.health, sim.encounter], [100, 'move', true, 'follow', 'dormant', stag.max, 'calm']);
});

test('walking up to a campfire lights it, makes it the checkpoint and revives a knocked-out pet', () => {
  const sim = make(), { player, pet } = sim;
  const fire = sim.campfires.find(entry => entry.id === 'stones');
  place(player, fire.x + 6, fire.z, -Math.PI / 2);
  hurtPet(pet, { damage: 999, fromX: 0, fromZ: 0 });
  assert.equal(pet.state, 'out');
  const events = run(sim, 4, { ...still, moveX: -0.6 });
  assert.ok(fire.lit && sim.lastFire === 'stones');
  assert.ok(events.some(event => event.type === 'kindle'));
  run(sim, 4);
  assert.equal(pet.health, pet.max);
});

test('E at a lit campfire rests to full health, and E by the pet pats it', () => {
  const sim = make(), { player, pet } = sim;
  const fire = sim.campfires.find(entry => entry.id === 'camp');
  place(player, fire.x + 1.5, fire.z);
  run(sim, DT);
  player.health = 40;
  assert.equal(interact(sim), 'rest');
  assert.equal(player.health, 100);
  place(player, 9, 0); place(pet, 9.6, 0.4);
  assert.equal(interact(sim), 'pat');
  const events = run(sim, 2);
  assert.deepEqual(events.filter(event => event.type.startsWith('pet-') || event.type === 'pat').map(event => event.type), ['pat', 'pet-pat', 'pet-sit']);
});

test('the pet\'s skill dashes in and draws the stag\'s next attack, then waits on its cooldown', () => {
  const sim = awakeStag(make(), 3), { pet, stag, player } = sim;
  place(player, stag.x, stag.z - STAG.radius - 3);
  place(pet, stag.x + 4, stag.z + 3);
  stag.rest = 0.3;
  assert.equal(petSkill(sim), true);
  assert.equal(petSkill(sim), false);
  const seen = [];
  let off = null;
  for (let t = 0; t < 2 && off === null; t += DT) for (const event of stepSim(sim, still, DT)) {
    seen.push(event.type === 'pet-hit' ? `pet-hit:${event.attack}` : event.type);
    if (event.type === 'telegraph') { const towardPet = Math.atan2(pet.x - stag.x, pet.z - stag.z); off = Math.atan2(Math.sin(towardPet - stag.facing), Math.cos(towardPet - stag.facing)); }
  }
  assert.ok(seen.indexOf('pet-hit:dash') >= 0 && seen.indexOf('pet-hit:dash') < seen.indexOf('telegraph'), seen.join(' '));
  assert.ok(seen.includes('skill-wait'));
  assert.ok(Math.abs(off) < 0.7, `the stag looks ${off} rad away from the pet`);
});

test('beating the stag ends the fight in victory, and E at the ring centre calls it back for a rematch', () => {
  const sim = awakeStag(make());
  hurtStag(sim.stag, STAG.health / 2);
  run(sim, STAG.shift + 0.1);
  hurtStag(sim.stag, STAG.health);
  const events = run(sim, STAG.defeat + 0.2);
  assert.ok(events.some(event => event.type === 'victory'));
  assert.equal(sim.encounter, 'won');
  place(sim.player, sim.arena.x + 1, sim.arena.z);
  assert.equal(interact(sim), 'rematch');
  run(sim, DT);
  assert.equal(sim.stag.state, 'wake');
});

test('once the stag is calmed it no longer stands in your way, and calling it back makes it solid again', () => {
  const sim = make({ beaten: true }), { player, stag } = sim, walkThrough = () => {
    place(player, stag.x, stag.z + 3, Math.PI);
    run(sim, 1.5, { ...still, moveZ: -1 });
    return player.z < stag.z - 1;
  };
  assert.equal(walkThrough(), true);
  place(player, sim.arena.x + 1, sim.arena.z);
  interact(sim);
  run(sim, DT);
  assert.equal(walkThrough(), false);
});
