import test from 'node:test';
import assert from 'node:assert/strict';
import { createMovementState } from './movement.js';
import { createCombatState, stepCombat } from './combat.js';
import { createWildsHud } from '../../features/wilds/hud.js';

const arena = { center: { x: 0, y: 0, z: 0 }, radius: 18, triggerRadius: 22, resetRadius: 40, stones: [] };
const world = { surfaceAt: () => ({ height: 0, normal: { x: 0, y: 1, z: 0 } }), obstacles: [], spawn: { x: 0, y: 0, z: 45 } };
const start = () => createCombatState({ player: createMovementState({ position: { x: 0, y: 0, z: 3 } }), arena });
const damageToBoss = result => result.events.filter(event => event.type === 'damage' && event.targetId === 'mossback-warden');
function run(state, duration, controls = {}, environment = world) {
  const events = [];
  for (let at = 0; at < duration; at += 25) {
    const result = stepCombat(state, at === 0 ? controls : {}, environment, 25, state.now + 25);
    state = result.state; events.push(...result.events);
  }
  return { state, events };
}

test('C1 sword contact cannot cross a standing stone or tree trunk', () => {
  for (const obstacle of [{ radius: .65, height: 3.8 }, { radius: .4, height: 8 }]) {
    const blocked = run(start(), 250, { actions: ['attack', 'recall'] }, { ...world, obstacles: [{ x: 0, z: 1.5, baseY: 0, ...obstacle }] });
    assert.equal(damageToBoss(blocked).length, 0);
  }
  const clear = run(start(), 250, { actions: ['attack', 'recall'] });
  assert.equal(damageToBoss(clear).length, 1);
});

test('C2 pet attack waits for contact and rechecks a target that moved away', () => {
  const initial = start();
  initial.pet.position = { x: 0, y: 0, z: 2.1 };
  initial.pet.mode = 'fight'; initial.pet.targetId = 'mossback-warden'; initial.pet.actionStartedAt = -1000;
  const began = run(initial, 25);
  assert.equal(began.state.pet.action, 'attack');
  assert.equal(damageToBoss(began).length, 0);
  const connects = run(began.state, 250);
  assert.equal(damageToBoss(connects).length, 1);
  began.state.boss.position = { x: 15, y: 0, z: 0 };
  const misses = run(began.state, 250);
  assert.equal(damageToBoss(misses).length, 0);
});

test('C2 queued pet skill approaches before it can hit and recall cancels the contact', () => {
  const initial = start(); initial.pet.position = { x: 0, y: 0, z: 10 };
  const queued = run(initial, 25, { actions: ['lock', 'skill'] });
  assert.equal(damageToBoss(queued).length, 0);
  assert.equal(queued.state.pet.skillQueued, true);
  const recalled = run(queued.state, 1500, { actions: ['recall'] });
  assert.equal(damageToBoss(recalled).length, 0);
  assert.equal(recalled.state.pet.skillQueued, false);
  const reached = run(queued.state, 1800);
  assert.ok(damageToBoss(reached).some(event => event.amount === 24));
});

test('C3 every landed hit requests hit-stop and misses do not', () => {
  const landed = run(start(), 250, { actions: ['attack', 'recall'] });
  const hits = landed.events.filter(event => event.type === 'damage');
  const pauses = landed.events.filter(event => event.type === 'hit-stop');
  assert.equal(hits.length, 1);
  assert.equal(pauses.length, hits.length);
  assert.ok(pauses.every(event => event.durationMs > 0 && event.durationMs < 100));
  const missed = start(); missed.player.yaw = Math.PI;
  const miss = run(missed, 250, { actions: ['attack', 'recall'] });
  assert.equal(miss.events.filter(event => event.type === 'hit-stop').length, 0);
});

test('C5 death restores pet skill readiness and clears timers from the failed fight', () => {
  const initial = start();
  initial.pet.position = { x: 0, y: 0, z: 2.1 };
  initial.pet.actionStartedAt = -1000;
  const used = run(initial, 300, { actions: ['lock', 'skill'] });
  assert.ok(used.events.some(event => event.type === 'pet-skill'));
  assert.ok(used.state.pet.skillReadyAt > used.state.now);
  used.state.player.health = 6;
  used.state.pet.health = 1;
  Object.assign(used.state.boss, { engaged: true, mode: 'telegraph', move: 'slam', nextActionAt: used.state.now + 25, telegraph: { kind: 'slam', origin: { x: 0, z: 0 }, radius: 5.2 } });
  const reset = run(used.state, 25);
  assert.ok(reset.events.some(event => event.type === 'player-defeated'));
  assert.ok(reset.events.some(event => event.type === 'pet-knockout'));
  assert.equal(reset.state.pet.health, reset.state.pet.maxHealth);
  assert.equal(reset.state.pet.mode, 'follow');
  assert.equal(reset.state.pet.contact, null);
  const nodes = [];
  const document = { createElement() { const node = { className: '', textContent: '', dataset: {}, style: {}, setAttribute() {}, append() {}, prepend() {}, remove() {} }; nodes.push(node); return node; } };
  const hud = createWildsHud({ ownerDocument: document, append() {} });
  hud.update({ combat: reset.state, player: reset.state.player, elapsedMs: reset.state.now });
  assert.match(nodes.find(node => node.className === 'wilds-pet-skill').textContent, /ready/);
  assert.equal(nodes.find(node => node.className === 'wilds-companion').dataset.ready, 'true');
  assert.ok(reset.state.pet.nextAttackAt <= reset.state.now);
  assert.ok(reset.state.pet.recoverAt <= reset.state.now);
});
