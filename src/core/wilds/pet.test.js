import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PET, PET_ATTACKS, PET_SKILL, castSkill, createPet, hurtPet, petDown, petStrength, revivePet, stepPet } from './pet.js';

const DT = 1 / 120;
const flat = () => 0;

function seeded(seed = 5) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const walker = (x = 0, z = 0) => ({ x, z, vx: 0, vz: 0, facing: 0, state: 'move' });

function run(pet, seconds, context, each = () => {}) {
  const events = [];
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    pet.events.length = 0;
    stepPet(pet, { ground: flat, solids: [], rng: seeded(), foe: null, ...context }, DT);
    events.push(...pet.events.map(event => ({ ...event, at: t })));
    each(t);
  }
  return events;
}

test('the pet trots after you, settles at your heel and sits when you stand still', () => {
  const rng = seeded(), pet = createPet({ x: 0, z: 0, ground: flat, rng }), player = walker(0, 0);
  const states = new Set();
  run(pet, 3, { player, rng }, t => { player.vz = t < 2 ? 3 : 0; player.z += player.vz * DT; states.add(pet.state); });
  assert.ok(states.has('follow'));
  assert.ok(Math.abs(pet.z - (player.z + PET.heel[1])) < 1.2, `pet ${pet.z.toFixed(2)} behind ${player.z.toFixed(2)}`);
  const sits = run(pet, PET.sit + 0.6, { player, rng });
  assert.equal(pet.state, 'sit');
  assert.ok(sits.some(event => event.type === 'pet-sit'));
});

test('the pet wanders off to sniff a nearby spot and comes back', () => {
  const rng = seeded(), pet = createPet({ x: 0, z: 0, ground: flat, rng }), player = walker(0, 1.2);
  pet.sniffAt = 0.1; player.vz = 0.5;
  const events = run(pet, 0.5, { player, rng, spots: [{ x: 2, z: 2 }] });
  assert.ok(events.some(event => event.type === 'pet-sniff'));
  assert.deepEqual([pet.spotX, pet.spotZ], [2, 2]);
  player.vz = 0;
  run(pet, PET.sniffFor + 2, { player, rng });
  assert.ok(['follow', 'sit'].includes(pet.state));
});

test('the pet pounces from range, swipes and spins up close, and every blow scales with its bond', () => {
  for (const bond of [0, 2]) {
    const rng = seeded(), foe = { x: 0, z: 4, radius: 1.3 }, pet = createPet({ x: 0, z: 0, ground: flat, rng, bond });
    const hits = run(pet, 30, { player: walker(0, -1), foe, rng }).filter(event => event.type === 'pet-hit');
    assert.deepEqual(new Set(hits.map(event => event.attack)), new Set(['pounce', 'swipe', 'spin']));
    for (const hit of hits) assert.equal(hit.damage, PET_ATTACKS[hit.attack].damage * petStrength(bond));
    const share = hits.reduce((sum, hit) => sum + hit.damage, 0) / 30;
    assert.ok(share > 1 && share < 2.5 * petStrength(bond), `${share.toFixed(2)} damage a second at bond ${bond}`);
  }
});

test('Q dashes the pet in to bite and taunt, then waits out its cooldown', () => {
  const rng = seeded(), foe = { x: 0, z: 8, radius: 1.3 }, pet = createPet({ x: 0, z: 0, ground: flat, rng });
  assert.equal(castSkill(pet, foe), true);
  assert.equal(castSkill(pet, foe), false);
  const events = run(pet, 1, { player: walker(0, -1), foe, rng });
  assert.ok(events.some(event => event.type === 'pet-hit' && event.attack === 'dash' && event.at < 0.9));
  assert.ok(events.some(event => event.type === 'taunt' && event.time === PET_SKILL.taunt));
  run(pet, PET_SKILL.cooldown - 1.1, { player: walker(0, -1), foe, rng });
  assert.equal(castSkill(pet, foe), false);
  run(pet, 0.2, { player: walker(0, -1), foe, rng });
  assert.equal(castSkill(pet, foe), true);
});

test('a beaten pet is knocked out, never killed: it limps after you and a campfire brings it back whole', () => {
  const rng = seeded(), pet = createPet({ x: 0, z: 0, ground: flat, rng, bond: 1 });
  assert.equal(pet.max, PET.health + PET.healthPerBond);
  hurtPet(pet, { damage: 999, fromX: 0, fromZ: -1 });
  assert.deepEqual([pet.health, pet.state, petDown(pet)], [0, 'out', true]);
  assert.equal(hurtPet(pet, { damage: 10, fromX: 0, fromZ: -1 }), 0);
  const player = walker(0, 6);
  run(pet, PET.out + 1, { player, rng });
  assert.equal(pet.state, 'limp');
  revivePet(pet);
  assert.deepEqual([pet.health, pet.state], [pet.max, 'follow']);
});
