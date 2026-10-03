import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ATTACKS, DUMMY, POSTS, FEEL_BOUNDS, createFeelSimulation } from './feel.js';
import { heightAt } from '../world-terrain.js';

const advance = (simulation, seconds, input = {}) => {
  for (let remaining = seconds; remaining > 1e-8; remaining -= 1 / 120) simulation.step(Math.min(remaining, 1 / 120), input);
};
const click = simulation => {
  simulation.step(1 / 120, { attackPressed: true, attackHeld: true });
  simulation.step(1 / 120, { attackReleased: true });
};
const nearDummy = simulation => {
  Object.assign(simulation.state.player, { x: 0, z: -3.1, y: heightAt(0, -3.1), heading: 0 });
};

test('spawn and reset restore deterministic feet, stamina, actions and diagnostics', () => {
  const simulation = createFeelSimulation();
  const initial = structuredClone(simulation.state);
  simulation.step(0.05, { jump: true, moveX: 1 });
  simulation.reset();
  assert.deepEqual(simulation.state, initial);
  assert.equal(simulation.state.player.y, heightAt(0, 2));
});

test('run responds in one frame, sprint is faster and diagonals are normalized', () => {
  const run = createFeelSimulation(), sprint = createFeelSimulation(), diagonal = createFeelSimulation();
  run.step(1 / 60, { moveZ: 1 });
  assert.ok(run.state.player.z > 2);
  assert.equal(run.state.action.kind, 'run');
  advance(run, 0.5, { moveZ: 1 });
  advance(sprint, 0.5, { moveZ: 1, sprint: true });
  advance(diagonal, 0.5, { moveX: 1, moveZ: 1 });
  assert.ok(sprint.state.player.z > run.state.player.z + 1);
  assert.ok(sprint.state.player.stamina < 100);
  assert.ok(Math.hypot(diagonal.state.player.vx, diagonal.state.player.vz) <= 4.001);
});

test('jump launches immediately and lands exactly on changing terrain', () => {
  const simulation = createFeelSimulation();
  simulation.step(1 / 60, { jump: true, moveZ: -1 });
  assert.equal(simulation.state.player.grounded, false);
  assert.ok(simulation.state.player.y > heightAt(simulation.state.player.x, simulation.state.player.z));
  assert.equal(simulation.state.counts.jump, 1);
  advance(simulation, 1.2, { moveZ: -1 });
  assert.equal(simulation.state.player.grounded, true);
  assert.equal(simulation.state.player.y, heightAt(simulation.state.player.x, simulation.state.player.z));
});

test('dodge spends stamina once, moves immediately and exposes its protection window', () => {
  const simulation = createFeelSimulation();
  simulation.step(1 / 60, { dodge: true, moveX: 1 });
  assert.equal(simulation.state.action.kind, 'dodge');
  assert.ok(simulation.state.player.x > 0);
  assert.equal(simulation.state.player.stamina, 78);
  advance(simulation, 0.08);
  assert.equal(simulation.state.player.invulnerable, true);
  advance(simulation, 0.4);
  assert.equal(simulation.state.player.invulnerable, false);
  assert.equal(simulation.state.counts.dodge, 1);
});

test('stamina prevents unaffordable dodge and recovers after the cooldown', () => {
  const simulation = createFeelSimulation();
  simulation.state.player.stamina = 21;
  simulation.step(1 / 60, { dodge: true });
  assert.equal(simulation.state.counts.dodge, 0);
  simulation.state.player.stamina = 22;
  simulation.step(1 / 60, { dodge: true });
  assert.equal(simulation.state.player.stamina, 0);
  advance(simulation, 1);
  assert.ok(simulation.state.player.stamina > 0);
  assert.ok(simulation.state.player.stamina <= 100);
});

test('click anticipates immediately, swings on release, and records only one dummy hit', () => {
  const simulation = createFeelSimulation();
  nearDummy(simulation);
  simulation.step(1 / 120, { attackPressed: true, attackHeld: true });
  assert.equal(simulation.state.action.kind, 'charge');
  assert.equal(simulation.state.counts.attack, 0);
  simulation.step(1 / 120, { attackReleased: true });
  assert.equal(simulation.state.action.kind, 'light1');
  advance(simulation, 0.14);
  assert.equal(simulation.state.dummy.hits, 0);
  for (let frame = 0; frame < 12 && !simulation.state.lastHit; frame++) simulation.step(1 / 120);
  assert.equal(simulation.state.dummy.hits, 1);
  assert.ok(simulation.state.hitStop > 0);
  assert.equal(simulation.state.lastHit.kind, 'light1');
  advance(simulation, 0.5);
  assert.equal(simulation.state.dummy.hits, 1);
  assert.equal(simulation.state.dummy.health, 100 - ATTACKS.light1.damage);
});

test('buffered clicks chain all three attacks with distinct action serials', () => {
  const simulation = createFeelSimulation();
  click(simulation);
  const firstSerial = simulation.state.action.serial;
  advance(simulation, 0.18);
  click(simulation);
  advance(simulation, 0.25);
  assert.equal(simulation.state.action.kind, 'light2');
  assert.ok(simulation.state.action.serial > firstSerial);
  advance(simulation, 0.12);
  click(simulation);
  advance(simulation, 0.37);
  assert.equal(simulation.state.action.kind, 'light3');
  assert.equal(simulation.state.counts.lightAttacks, 3);
});

test('hold reaches charge threshold without auto-firing and release selects heavy', () => {
  const simulation = createFeelSimulation();
  simulation.step(1 / 120, { attackPressed: true, attackHeld: true });
  const serial = simulation.state.action.serial;
  advance(simulation, 0.8, { attackHeld: true });
  assert.equal(simulation.state.action.kind, 'charge');
  assert.equal(simulation.state.action.serial, serial);
  assert.equal(simulation.state.action.charge, 1);
  assert.equal(simulation.state.counts.attack, 0);
  simulation.step(1 / 120, { attackReleased: true });
  assert.equal(simulation.state.action.kind, 'heavy');
  assert.equal(simulation.state.counts.heavyAttacks, 1);
  assert.equal(simulation.state.player.stamina, 76);
});

test('short hold remains light and orbit cancellation does not attack', () => {
  const simulation = createFeelSimulation();
  simulation.step(1 / 120, { attackPressed: true });
  advance(simulation, 0.2, { attackHeld: true });
  simulation.step(1 / 120, { attackReleased: true });
  assert.equal(simulation.state.action.kind, 'light1');
  simulation.reset();
  simulation.step(1 / 120, { attackPressed: true });
  simulation.step(1 / 120, { attackCancelled: true, attackReleased: true });
  assert.equal(simulation.state.action.kind, 'idle');
  assert.equal(simulation.state.counts.attack, 0);
  simulation.step(1 / 120, { attackReleased: true });
  assert.equal(simulation.state.counts.attack, 0);
});

test('attacks miss distant targets and targets behind the player', () => {
  for (const close of [false, true]) {
    const simulation = createFeelSimulation();
    if (close) { nearDummy(simulation); simulation.state.player.heading = Math.PI; }
    click(simulation);
    advance(simulation, 0.8);
    assert.equal(simulation.state.dummy.hits, 0);
  }
});

test('hit-stop freezes movement and swing time while impact flash decays', () => {
  const simulation = createFeelSimulation();
  nearDummy(simulation);
  click(simulation);
  while (!simulation.state.lastHit) simulation.step(1 / 120);
  const { x, z } = simulation.state.player;
  const elapsed = simulation.state.action.elapsed;
  const flash = simulation.state.dummy.flash;
  simulation.step(1 / 120, { moveX: 1 });
  assert.equal(simulation.state.player.x, x);
  assert.equal(simulation.state.player.z, z);
  assert.equal(simulation.state.action.elapsed, elapsed);
  assert.ok(simulation.state.dummy.flash < flash);
});

test('lock faces the dummy while strafing and aligns an attack before its sweep', () => {
  const simulation = createFeelSimulation();
  nearDummy(simulation);
  simulation.state.player.heading = Math.PI;
  simulation.step(1 / 60, { attackPressed: true, locked: true });
  simulation.step(1 / 60, { attackReleased: true, locked: true });
  assert.equal(simulation.state.player.heading, 0);
  advance(simulation, 0.35, { locked: true });
  assert.equal(simulation.state.dummy.hits, 1);
  simulation.reset();
  simulation.step(1 / 60, { moveX: 1, locked: true });
  assert.ok(Math.abs(simulation.state.player.heading) < 0.01);
});

test('posts block sprint and dodge without tunneling and dummy blocks overlap', () => {
  for (const dodge of [false, true]) {
    const simulation = createFeelSimulation();
    const post = POSTS[3];
    Object.assign(simulation.state.player, { x: post.x - 1.8, z: post.z });
    simulation.step(0.05, { moveX: 1, sprint: true, dodge });
    advance(simulation, 0.8, { moveX: 1, sprint: true });
    assert.ok(Math.hypot(simulation.state.player.x - post.x, simulation.state.player.z - post.z) >= post.radius + 0.32 - 1e-8);
    assert.ok(simulation.state.player.x < post.x);
  }
  const simulation = createFeelSimulation();
  advance(simulation, 3, { moveZ: -1 });
  assert.ok(Math.hypot(simulation.state.player.x - DUMMY.x, simulation.state.player.z - DUMMY.z) >= DUMMY.radius + 0.32 - 1e-8);
});

test('frame gaps cap simulation time and invalid deltas leave it unchanged', () => {
  const simulation = createFeelSimulation();
  simulation.step(50, { jump: true });
  assert.ok(Math.abs(simulation.state.elapsed - 0.05) < 1e-8);
  assert.ok(simulation.state.player.y < 0.4);
  const before = structuredClone(simulation.state);
  simulation.step(NaN, { dodge: true });
  simulation.step(-1, { moveX: 1 });
  assert.deepEqual(simulation.state, before);
});

test('play boundary contains sprint and dodge, removes outward speed and allows turning back', () => {
  for (const dodge of [false, true]) {
    const simulation = createFeelSimulation();
    const player = simulation.state.player;
    Object.assign(player, { x: FEEL_BOUNDS.radius - 0.5, z: FEEL_BOUNDS.z, y: heightAt(FEEL_BOUNDS.radius - 0.5, FEEL_BOUNDS.z) });
    simulation.step(0.05, { dodge, moveX: 1, sprint: true });
    advance(simulation, 0.8, { moveX: 1, sprint: true });
    assert.ok(Math.hypot(player.x - FEEL_BOUNDS.x, player.z - FEEL_BOUNDS.z) <= FEEL_BOUNDS.radius - 0.32 + 1e-8);
    assert.ok(Math.abs(player.vx) < 1e-8);
    assert.equal(player.y, heightAt(player.x, player.z));
    const edge = player.x;
    advance(simulation, 0.2, { moveX: -1 });
    assert.ok(player.x < edge - 0.5);
  }
});

test('exhausted sprint runs while stamina recharges instead of stuttering on tiny recovery', () => {
  const simulation = createFeelSimulation();
  simulation.state.player.stamina = 0.2;
  advance(simulation, 0.1, { moveZ: 1, sprint: true });
  assert.equal(simulation.state.action.kind, 'run');
  advance(simulation, 0.9, { moveZ: 1, sprint: true });
  assert.ok(simulation.state.player.stamina > 5);
  assert.ok(simulation.state.player.stamina < 18);
  assert.equal(simulation.state.action.kind, 'run');
  assert.ok(Math.hypot(simulation.state.player.vx, simulation.state.player.vz) <= 4.001);
  advance(simulation, 0.5, { moveZ: 1, sprint: true });
  assert.equal(simulation.state.action.kind, 'sprint');
});

test('airborne dodge is ignored without stamina loss or a second action', () => {
  const simulation = createFeelSimulation();
  simulation.step(1 / 60, { jump: true });
  const stamina = simulation.state.player.stamina;
  const serial = simulation.state.action.serial;
  simulation.step(1 / 60, { dodge: true });
  assert.equal(simulation.state.action.kind, 'jump');
  assert.equal(simulation.state.action.serial, serial);
  assert.equal(simulation.state.counts.dodge, 0);
  assert.equal(simulation.state.player.stamina, stamina);
});

test('dynamic target redirects lock, collision and attack events without damaging the training dummy', () => {
  const boss = { id: 'mossheart', x: 5, z: -8, radius: 1.3, height: 4.5 };
  const simulation = createFeelSimulation({ target: () => boss });
  Object.assign(simulation.state.player, { x: 5, z: -5.5, y: heightAt(5, -5.5), heading: Math.PI });
  simulation.step(1 / 120, { attackPressed: true, locked: true });
  simulation.step(1 / 120, { attackReleased: true, locked: true });
  assert.equal(simulation.state.player.heading, 0);
  advance(simulation, 0.4);
  assert.equal(simulation.state.lastHit.targetId, 'mossheart');
  assert.equal(simulation.state.lastHit.damage, ATTACKS.light1.damage);
  assert.equal(simulation.state.lastHit.x, 5);
  assert.equal(simulation.state.dummy.health, 100);
  assert.equal(simulation.state.dummy.hits, 0);
  assert.ok(Math.hypot(simulation.state.player.x - boss.x, simulation.state.player.z - boss.z) >= boss.radius + 0.32 - 1e-8);
  boss.x = 8;
  advance(simulation, 0.5, { locked: true });
  assert.ok(simulation.state.player.heading > 0.5);
});

test('additional world obstacles block player travel while a null target releases cleanly', () => {
  const obstacle = { x: 0, z: 5, radius: 1, height: 3 };
  const simulation = createFeelSimulation({ target: () => null, obstacles: [obstacle] });
  advance(simulation, 1.2, { moveZ: 1, sprint: true, locked: true });
  assert.ok(simulation.state.player.z <= obstacle.z - obstacle.radius - 0.32 + 1e-8);
  click(simulation);
  advance(simulation, 0.6);
  assert.equal(simulation.state.lastHit, null);
});
