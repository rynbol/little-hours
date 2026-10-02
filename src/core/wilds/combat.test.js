import test from 'node:test';
import assert from 'node:assert/strict';
import { createMovementState } from './movement.js';
import { createCombatState, stepCombat } from './combat.js';

const arena = { center: { x: 0, y: 0, z: 0 }, radius: 18, triggerRadius: 22, resetRadius: 40, stones: [{ id: 'stone', x: 8, z: 8, radius: 1.1, height: 3.8 }] };
const world = { surfaceAt: () => ({ height: 0, normal: { x: 0, y: 1, z: 0 } }), obstacles: [], spawn: { x: 0, y: 0, z: 45, yaw: 0 } };
const start = (position = { x: 0, y: 0, z: 3 }, options = {}) => createCombatState({ player: createMovementState({ position }), arena, ...options });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < .000001, `${actual} should equal ${expected}`);
function run(state, frames, controls = () => ({}), from = state.now, environment = world) {
  const events = [];
  for (let frame = 1; frame <= frames; frame++) {
    const now = from + frame * 50, result = stepCombat(state, controls(state, now, frame), environment, 50, now);
    state = result.state; events.push(...result.events);
  }
  return { state, events };
}

test('lock faces the target and the sword resolves three buffered hits once each', () => {
  const previous = start(), before = structuredClone(previous);
  const result = run(previous, 26, (state, now) => ({ actions: now === 50 ? ['recall', 'lock', 'attack'] : [100, 150, 500, 550].includes(now) ? ['attack'] : [] }));
  assert.deepEqual(previous, before);
  assert.equal(result.state.targetId, 'mossback-warden');
  close(result.state.player.yaw, 0);
  assert.deepEqual(result.events.filter(event => event.type === 'damage').map(event => [event.sourceId, event.amount]), [['player', 10], ['player', 11], ['player', 14]]);
  assert.equal(result.state.boss.health, 385);
  close(result.state.player.stamina, 82);
  assert.equal(result.state.playerAction.comboIndex, 2);
  assert.equal(result.state.playerAction.buffered, false);
});

test('unlocked sword misses behind the player and cannot hit through a large height gap', () => {
  const behind = start({ x: 0, y: 0, z: -3 });
  const result = run(behind, 4, (state, now) => ({ actions: now === 50 ? ['attack', 'recall'] : [] }));
  assert.equal(result.state.boss.health, 420);
  const facing = run(start(), 4, (state, now) => ({ actions: now === 50 ? ['attack', 'recall'] : [] }));
  assert.equal(facing.state.boss.health, 410);
  const ledge = { ...world, surfaceAt: (x, z) => ({ height: z > 1 ? 5 : 0, normal: { x: 0, y: 1, z: 0 } }) };
  const above = run(start({ x: 0, y: 5, z: 3 }), 4, (state, now) => ({ actions: now === 50 ? ['attack', 'recall'] : [] }), 0, ledge);
  assert.equal(above.state.boss.health, 420);
});

test('dodge travels four and a half metres, costs one payment, and shares sprint stamina', () => {
  const result = run(start({ x: 0, y: 0, z: 50 }), 10, () => ({ strafe: 1, actions: ['dodge'] }));
  close(result.state.player.position.x, 4.5);
  close(result.state.player.stamina, 76);
  assert.equal(result.state.playerAction, null);
  assert.equal(result.events.filter(event => event.type === 'dodge').length, 1);
  const sprint = run(result.state, 10, () => ({ forward: 1, sprint: true }));
  close(sprint.state.player.stamina, 69);
  const exhausted = start({ x: 0, y: 0, z: 50 }); exhausted.player.stamina = 23;
  const failed = run(exhausted, 1, () => ({ actions: ['dodge'] }));
  assert.equal(failed.state.playerAction, null);
  close(failed.state.player.position.z, 50);
});

test('dodge uses the movement collision solver and cannot cross a standing stone', () => {
  const result = run(start({ x: 5, y: 0, z: 8 }), 10, () => ({ strafe: 1, cameraYaw: 0, actions: ['dodge'] }));
  close(result.state.player.position.x, 6.56);
  close(result.state.player.position.z, 8);
  close(result.state.player.stamina, 76);
});

test('walking into the Warden stops at its body while the sword can reach it', () => {
  const approached = run(start(), 5, () => ({ forward: 1, actions: ['recall'] }));
  close(approached.state.player.position.z, 1.8);
  const stopped = run(approached.state, 5, () => ({ forward: 1 }));
  close(stopped.state.player.position.z, 1.59);
  const hit = run(stopped.state, 4, (state, now, frame) => ({ actions: frame === 1 ? ['attack'] : [] }));
  assert.equal(hit.state.boss.health, 410);
});

test('only the middle of a dodge avoids the Warden strike', () => {
  const swing = hitAt => {
    const state = start({ x: 0, y: 0, z: 1 });
    Object.assign(state.boss, { engaged: true, mode: 'telegraph', move: 'sweep', nextActionAt: hitAt, telegraph: { kind: 'sweep', origin: { x: 0, z: 0 }, radius: 4.6 } });
    return run(state, 8, (state, now) => ({ actions: now === 50 ? ['dodge', 'recall'] : [], strafe: 1 }));
  };
  assert.equal(swing(100).state.player.health, 100);
  assert.equal(swing(375).state.player.health, 84);
  assert.equal(swing(25).state.player.health, 84);
});

test('a dodged charge hits a standing stone and exposes heartwood for four and a half seconds', () => {
  let dodged = false;
  const result = run(start({ x: 5, y: 0, z: 5 }), 65, state => {
    if (state.boss.mode === 'charge' && !dodged) { dodged = true; return { strafe: 1, cameraYaw: 0, actions: ['dodge', 'recall'] }; }
    return {};
  });
  const exposed = result.events.find(event => event.type === 'boss-exposed');
  assert.equal(exposed.stoneId, 'stone');
  assert.equal(exposed.until - exposed.at, 4500);
  assert.equal(result.state.boss.mode, 'exposed');
  assert.equal(result.state.player.health, 100);
  assert.equal(dodged, true);
});

test('pet follows the lock, skill respects range and cooldown, recall persists until command', () => {
  const initial = start(), fought = run(initial, 30, (state, now) => ({ actions: now === 50 ? ['lock', 'skill'] : ['skill'] }));
  assert.equal(fought.events.filter(event => event.type === 'pet-skill').length, 1);
  assert.equal(fought.events.find(event => event.type === 'damage' && event.sourceId === 'cat').amount, 24);
  assert.equal(fought.state.pet.cooldownMs, 14000);
  assert.equal(fought.state.pet.skillReadyAt, 14000);
  assert.equal(fought.state.pet.mode, 'fight');
  const recalled = run(fought.state, 30, (state, now, frame) => ({ actions: frame === 1 ? ['recall'] : [] }));
  assert.equal(recalled.state.pet.mode, 'recall');
  assert.equal(recalled.state.pet.targetId, null);
  assert.equal(recalled.events.filter(event => event.type === 'damage' && event.sourceId === 'cat').length, 0);
  const commanded = run(recalled.state, 1, () => ({ actions: ['command'] }));
  assert.equal(commanded.state.pet.mode, 'fight');
  assert.equal(commanded.state.pet.targetId, 'mossback-warden');
  const bonded = start(undefined, { bondIndex: 3 });
  assert.equal(bonded.pet.maxHealth, 102);
  assert.equal(bonded.pet.damage, 11);
  assert.equal(bonded.pet.cooldownMs, 10640);
});

test('exposed heartwood increases player and pet damage and the half-health phase introduces roots', () => {
  const state = start();
  Object.assign(state.boss, { engaged: true, mode: 'exposed', exposedUntil: 4500, nextActionAt: 4500 });
  const result = run(state, 4, (state, now) => ({ actions: now === 50 ? ['lock', 'skill', 'attack'] : [] }));
  assert.deepEqual(result.events.filter(event => event.type === 'damage').map(event => [event.sourceId, event.amount]), [['cat', 48], ['player', 18]]);
  const phase = start({ x: 6, y: 0, z: 0 });
  phase.boss.health = 210;
  const roots = run(phase, 300, (state, now, frame) => ({ actions: frame === 1 ? ['recall'] : [] }));
  assert.equal(roots.events.filter(event => event.type === 'boss-phase').length, 1);
  assert.equal(roots.events.find(event => event.type === 'boss-phase').phase, 2);
  assert.ok(roots.events.some(event => event.type === 'boss-strike' && event.move === 'roots'));
});

test('leaving the arena resets an unfinished fight without modifying persistent progress', () => {
  const state = start({ x: 0, y: 0, z: 42 }, { progress: { totalXp: 35 } });
  state.boss.engaged = true; state.boss.health = 100;
  state.targetId = 'mossback-warden'; state.pet.targetId = 'mossback-warden'; state.pet.mode = 'fight';
  const result = run(state, 1);
  assert.equal(result.state.boss.health, 420);
  assert.equal(result.state.boss.engaged, false);
  assert.equal(result.state.targetId, null);
  assert.equal(result.state.pet.mode, 'follow');
  assert.equal(result.state.progress.totalXp, 35);
  assert.equal(result.events.filter(event => event.type === 'boss-reset').length, 1);
});

test('pet knockout recovers after thirty seconds and defeat restores both companions without losing progress', () => {
  const state = start();
  state.pet.health = 1; state.pet.position = { x: 0, y: 0, z: 1 };
  Object.assign(state.boss, { engaged: true, mode: 'telegraph', move: 'slam', nextActionAt: 50, telegraph: { kind: 'slam', origin: { x: 0, z: 0 }, radius: 5.2 } });
  const knocked = run(state, 1);
  assert.equal(knocked.state.pet.mode, 'knockout');
  assert.equal(knocked.state.pet.health, 0);
  assert.equal(knocked.state.pet.recoverAt, 30050);
  knocked.state.player.position = { x: 0, y: 0, z: 50 };
  const recovered = run(knocked.state, 600);
  assert.equal(recovered.state.pet.health, 70);
  assert.equal(recovered.events.filter(event => event.type === 'pet-recovered').length, 1);
  const doomed = start(undefined, { progress: { totalXp: 35, materials: { wood: 2 } } });
  doomed.player.health = 1;
  Object.assign(doomed.boss, { engaged: true, mode: 'telegraph', move: 'slam', nextActionAt: 50, telegraph: { kind: 'slam', origin: { x: 0, z: 0 }, radius: 5.2 } });
  const respawned = run(doomed, 1);
  assert.equal(respawned.state.player.health, 100);
  assert.equal(respawned.state.pet.health, 70);
  assert.deepEqual(respawned.state.player.position, { x: 0, y: 0, z: 45 });
  assert.deepEqual(respawned.state.progress, { version: 1, totalXp: 35, discoveries: [], materials: { wood: 2 }, bossVictories: {}, trophies: [] });
  assert.equal(respawned.state.boss.health, 420);
  assert.equal(respawned.events.filter(event => event.type === 'player-defeated').length, 1);
});

test('a first Warden victory is playable with only starting stats and real movement and combat commands', () => {
  let state = start({ x: 5, y: 0, z: 5 });
  const events = [];
  for (let frame = 1; frame <= 2400 && state.boss.health > 0; frame++) {
    const now = frame * 50, boss = state.boss, player = state.player;
    const dx = boss.position.x - player.position.x, dz = boss.position.z - player.position.z, gap = Math.hypot(dx, dz);
    const cameraYaw = Math.atan2(-dx, -dz), actions = state.targetId ? [] : ['lock'];
    let forward = gap > 3.2 ? 1 : 0, strafe = 0;
    if (boss.mode === 'charge' && !state.playerAction && player.stamina >= 24) { actions.push('dodge'); forward = 0; strafe = 1; }
    else if (boss.mode === 'telegraph' && boss.move !== 'charge' && boss.nextActionAt - now < 400) { forward = -1; }
    else if (gap <= 4 && !['telegraph', 'charge', 'phase'].includes(boss.mode) && player.stamina >= 12) actions.push('attack');
    if (gap < 12 && now >= state.pet.skillReadyAt) actions.push('skill');
    const result = stepCombat(state, { forward, strafe, cameraYaw, actions }, world, 50, now);
    state = result.state; events.push(...result.events);
  }
  assert.equal(state.boss.mode, 'defeated', JSON.stringify({ boss: state.boss, player: state.player, deaths: events.filter(event => event.type === 'player-defeated').length }));
  assert.equal(events.filter(event => event.type === 'player-defeated').length, 0);
  assert.ok(events.some(event => event.type === 'damage' && event.sourceId === 'cat'));
  assert.ok(events.some(event => event.type === 'boss-phase' && event.phase === 2));
  assert.ok(events.some(event => event.type === 'dodge'));
  assert.deepEqual(state.progress, { version: 1, totalXp: 260, discoveries: [], materials: { heartwood: 1 }, bossVictories: { 'mossback-warden': 1 }, trophies: ['mossback-warden'] });
  assert.equal(state.player.maxHealth, 124);
  assert.equal(state.player.maxStamina, 108);
  assert.equal(state.player.attack, 14);
  assert.equal(events.filter(event => event.type === 'progress-changed').length, 1);
  assert.deepEqual(events.find(event => event.type === 'boss-defeated').reward, { xp: 260, materials: { heartwood: 1 }, trophy: 'mossback-warden' });
  const continued = run(state, 100, () => ({ actions: ['attack', 'skill', 'command'] }));
  assert.deepEqual(continued.state.progress, state.progress);
  assert.equal(continued.events.filter(event => event.type === 'progress-changed').length, 0);
  const reloaded = start(undefined, { progress: state.progress });
  assert.equal(reloaded.boss.mode, 'defeated');
  assert.equal(reloaded.boss.health, 0);
});
