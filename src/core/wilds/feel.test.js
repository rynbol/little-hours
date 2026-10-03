import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ATTACKS, DUMMY, POSTS, FEEL_BOUNDS, createFeelSimulation } from './feel.js';
import { heightAt } from '../world-terrain.js';
import { createValleyWorld, SOLIDS, LAKE, SECRETS } from './world.js';
import { createAdventure } from './progression.js';

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

function traversalWorld() {
  return {
    floorAt(x, z, ceiling = Infinity) { return Math.abs(x) <= 2 && z >= -6 && z <= -2 && ceiling >= 4 ? 4 : 0; },
    climbContact(player, moveX, moveZ) {
      if (Math.abs(player.x) > 2.32 || Math.abs(player.z + 1.68) > .65 || player.y > 4.1 || moveZ >= -.15) return null;
      return { id: 'rock', x: player.x, z: -1.68, bottom: 0, top: 4, normal: [0, 0, 1] };
    },
    resolve(player, previous) { if (player.y < 3.96 && Math.abs(player.x) < 2.32 && player.z < -1.68 && previous.z >= -1.69) { player.z = -1.68; player.vz = 0; } },
    waterAt: () => null,
    updraftAt: () => 0,
  };
}

test('world walking attaches to a physical face, traverses sideways, leaps and mantles onto its actual support', () => {
  const world = traversalWorld(), simulation = createFeelSimulation({ world, posts: [], bounds: null, target: () => null });
  simulation.reset({ x: 0, z: -1.1 });
  simulation.step(1 / 60, { moveZ: -1 });
  assert.equal(simulation.state.action.kind, 'climb');
  assert.equal(simulation.state.player.mode, 'climb');
  assert.equal(simulation.state.counts.climb, 1);
  assert.equal(simulation.state.player.z, -1.68);
  advance(simulation, .5, { moveZ: -1 });
  const height = simulation.state.player.y;
  assert.ok(height > .7 && height < 1);
  advance(simulation, .4, { moveX: 1 });
  assert.ok(simulation.state.player.x > .5);
  assert.equal(simulation.state.player.y, height);
  const stamina = simulation.state.player.stamina;
  simulation.step(1 / 60, { jump: true, moveZ: -1 });
  assert.equal(simulation.state.action.kind, 'climbLeap');
  assert.ok(simulation.state.player.vy > 5);
  assert.ok(simulation.state.player.stamina < stamina - 14);
  advance(simulation, 2.1, { moveZ: -1 });
  assert.equal(simulation.state.player.grounded, true);
  assert.equal(simulation.state.player.y, 4);
  assert.ok(simulation.state.player.z <= -2);
});

test('climbing exhaustion releases the face, cannot instantly regrab, and lands safely without stamina regeneration in air', () => {
  const simulation = createFeelSimulation({ world: traversalWorld(), posts: [], bounds: null, target: () => null });
  simulation.reset({ x: 0, z: -1.1 });
  advance(simulation, .5, { moveZ: -1 });
  simulation.state.player.stamina = .01;
  simulation.step(1 / 60, { moveZ: -1 });
  assert.equal(simulation.state.player.mode, 'air');
  assert.equal(simulation.state.counts.climb, 1);
  advance(simulation, .2, { moveZ: -1 });
  assert.equal(simulation.state.counts.climb, 1);
  assert.equal(simulation.state.player.grounded, false);
  advance(simulation, .5);
  assert.equal(simulation.state.player.grounded, true);
  assert.equal(simulation.state.player.y, 0);
});

test('walking off a supported ledge falls rather than snapping down, while valley travel has no training radius', () => {
  const world = traversalWorld(), simulation = createFeelSimulation({ world, posts: [], bounds: null, target: () => null });
  simulation.reset({ x: 1.9, z: -4 });
  assert.equal(simulation.state.player.y, 4);
  advance(simulation, .2, { moveX: 1 });
  assert.equal(simulation.state.player.grounded, false);
  assert.ok(simulation.state.player.y > 3);
  advance(simulation, 1);
  assert.equal(simulation.state.player.y, 0);
  simulation.reset({ x: 55, z: 2 });
  advance(simulation, .5, { moveX: 1 });
  assert.ok(simulation.state.player.x > 56.5);
});

test('airborne Space opens a steerable glider immediately, updrafts lift and exhaustion folds it', () => {
  const world = traversalWorld(), simulation = createFeelSimulation({ world, posts: [], bounds: null, target: () => null });
  simulation.reset({ x: 5, z: 0, y: 15 });
  simulation.step(1 / 60);
  assert.equal(simulation.state.player.grounded, false);
  simulation.step(1 / 60, { jump: true, moveX: 1 });
  assert.equal(simulation.state.action.kind, 'glide');
  assert.equal(simulation.state.counts.glide, 1);
  const start = simulation.state.player.y;
  advance(simulation, 2, { moveX: 1 });
  assert.ok(simulation.state.player.x > 16);
  assert.ok(simulation.state.player.y > start - 3.3);
  assert.ok(simulation.state.player.stamina < 90);
  world.updraftAt = () => 3.8;
  const low = simulation.state.player.y;
  advance(simulation, 2, { moveZ: -1 });
  assert.ok(simulation.state.player.y > low);
  simulation.state.player.stamina = .01;
  simulation.step(1 / 60);
  assert.equal(simulation.state.player.mode, 'air');
  assert.equal(simulation.state.action.kind, 'jump');
});

test('deep water swims at a stamina cost, allows exhausted movement and rest, then grounds on the shore', () => {
  const world = traversalWorld();
  world.waterAt = (x, z) => x >= 10 && x < 15 ? { id: 'lake', height: 3, depth: 3 } : null;
  const simulation = createFeelSimulation({ world, posts: [], bounds: null, target: () => null });
  simulation.reset({ x: 11, z: 0 });
  simulation.step(1 / 60, { moveX: 1 });
  assert.equal(simulation.state.action.kind, 'swim');
  assert.equal(simulation.state.player.y, 2.55);
  assert.equal(simulation.state.counts.swim, 1);
  advance(simulation, .5, { moveX: 1 });
  assert.ok(simulation.state.player.stamina < 96);
  simulation.state.player.stamina = 0;
  const x = simulation.state.player.x;
  advance(simulation, .3, { moveX: 1 });
  assert.ok(simulation.state.player.x > x + .15);
  advance(simulation, .3);
  assert.ok(simulation.state.player.stamina > 1.5);
  advance(simulation, 3, { moveX: 1 });
  assert.equal(simulation.state.player.mode, 'ground');
  assert.equal(simulation.state.player.y, 0);
});

test('mutable progression stats change stamina cap and damage without changing attack timing or checkpoint height', () => {
  const stats = { stamina: 140, attack: 1.5 }, simulation = createFeelSimulation({ stats });
  assert.equal(simulation.state.player.stamina, 140);
  nearDummy(simulation); click(simulation); advance(simulation, .4);
  assert.equal(simulation.state.lastHit.damage, ATTACKS.light1.damage * 1.5);
  assert.equal(simulation.state.dummy.health, 82);
  stats.stamina = 160; stats.attack = 2;
  simulation.reset({ x: 0, z: -3.1, y: heightAt(0, -3.1) });
  assert.equal(simulation.state.player.maxStamina, 160);
  click(simulation); advance(simulation, .4);
  assert.equal(simulation.state.lastHit.damage, 24);
  assert.equal(simulation.state.action.duration, ATTACKS.light1.duration);
});

test('real valley practice rock and lake share collision, climbing support and swimming elevations', () => {
  const world = createValleyWorld(), rock = SOLIDS.find(solid => solid.id === 'practice-ledge');
  const simulation = createFeelSimulation({ world, posts: [], bounds: null, target: () => null });
  simulation.reset({ x: rock.x, z: rock.z + rock.halfZ + .45 });
  advance(simulation, .1, { moveZ: -1 });
  assert.equal(simulation.state.player.mode, 'climb');
  for (let frame = 0; frame < 600 && !simulation.state.player.grounded; frame++) simulation.step(1 / 120, { moveZ: -1 });
  assert.equal(simulation.state.player.y, rock.top);
  assert.equal(simulation.state.player.grounded, true);
  simulation.reset({ x: -160, z: -400 });
  simulation.step(1 / 60, { moveX: -1 });
  assert.equal(simulation.state.player.mode, 'swim');
  assert.equal(simulation.state.player.y, LAKE.height - .45);
});

test('base stamina can reach the real stamina-seed cliff and glider lands on a supported surface', () => {
  const world = createValleyWorld(), cliff = SOLIDS.find(solid => solid.id === 'cliff');
  const simulation = createFeelSimulation({ world, posts: [], bounds: null, target: () => null });
  simulation.reset({ x: cliff.x, z: cliff.z + cliff.halfZ + .45 });
  advance(simulation, .1, { moveZ: -1 });
  for (let frame = 0; frame < 1800 && !simulation.state.player.grounded; frame++) simulation.step(1 / 120, { moveZ: -1 });
  assert.equal(simulation.state.player.y, cliff.top);
  assert.equal(simulation.state.player.grounded, true);
  assert.ok(simulation.state.player.stamina > 10);
  const ledge = traversalWorld(), flying = createFeelSimulation({ world: ledge, posts: [], bounds: null, target: () => null });
  flying.reset({ x: 0, z: -4, y: 7 });
  flying.step(1 / 60);
  flying.step(1 / 60, { jump: true });
  flying.state.player.heading = 0;
  for (let frame = 0; frame < 900 && !flying.state.player.grounded; frame++) flying.step(1 / 120, { moveX: 0, moveZ: 0 });
  assert.equal(flying.state.player.mode, 'ground');
  assert.equal(flying.state.player.y, ledge.floorAt(flying.state.player.x, flying.state.player.z));
});

test('a tired approach can recover at the real cliff foot before a complete climb', () => {
  const world = createValleyWorld(), cliff = SOLIDS.find(solid => solid.id === 'cliff');
  const simulation = createFeelSimulation({ world, posts: [], bounds: null, target: () => null });
  simulation.reset({ x: cliff.x, z: cliff.z + cliff.halfZ + .45 });
  simulation.state.player.stamina = 6;
  advance(simulation, 1.4, { moveZ: -1 });
  assert.ok(simulation.state.player.y < cliff.top - 10);
  advance(simulation, 5);
  assert.equal(simulation.state.player.grounded, true);
  assert.equal(simulation.state.player.stamina, simulation.state.player.maxStamina);
  simulation.step(1 / 60, { moveZ: -1 });
  for (let frame = 0; frame < 1800 && !simulation.state.player.grounded; frame++) simulation.step(1 / 120, { moveZ: -1 });
  assert.equal(simulation.state.player.y, cliff.top);
  assert.ok(simulation.state.player.stamina > 10);
});


const walkTo = (simulation, x, z, seconds = 20) => {
  for (let frame = 0; frame < seconds * 120; frame++) {
    const player = simulation.state.player, dx = x - player.x, dz = z - player.z, distance = Math.hypot(dx, dz);
    if (distance < .3) return true;
    simulation.step(1 / 120, { moveX: dx / distance, moveZ: dz / distance });
  }
  return false;
};

test('base stamina climbs the actual oak and jumps, glides and lands on the wind chest ledge', () => {
  const world = createValleyWorld(), simulation = createFeelSimulation({ world, posts: [], bounds: null, target: () => null, stats: { stamina: 100, attack: 1 } });
  const ledge = SOLIDS.find(solid => solid.id === 'glide-ledge'), adventure = createAdventure();
  simulation.reset({ x: 37, z: -220 });
  assert.equal(adventure.claim('wind-chest', simulation.state.player), false);
  simulation.step(1 / 120, { moveX: -1 });
  for (let frame = 0; frame < 1800 && !simulation.state.player.grounded; frame++) simulation.step(1 / 120, { moveX: -1 });
  assert.equal(simulation.state.player.grounded, true);
  assert.equal(simulation.state.player.y, world.floorAt(simulation.state.player.x, simulation.state.player.z));
  assert.ok(simulation.state.player.stamina > 20);
  advance(simulation, 5);
  assert.equal(simulation.state.player.stamina, 100);
  assert.equal(walkTo(simulation, 24, -220), true);
  const player = simulation.state.player, dx = ledge.x - player.x, dz = ledge.z - player.z, distance = Math.hypot(dx, dz);
  assert.ok(distance > 50);
  const input = { moveX: dx / distance, moveZ: dz / distance };
  simulation.step(1 / 120, { ...input, jump: true });
  advance(simulation, .15, input);
  simulation.step(1 / 120, { ...input, jump: true });
  assert.equal(simulation.state.player.mode, 'glide');
  assert.equal(walkTo(simulation, ledge.x, ledge.z, 12), true);
  assert.ok(simulation.state.player.y > ledge.top + 10);
  assert.equal(adventure.claim('wind-chest', simulation.state.player), false);
  simulation.step(1 / 120, { jump: true });
  for (let frame = 0; frame < 600 && !simulation.state.player.grounded; frame++) simulation.step(1 / 120);
  assert.equal(simulation.state.player.grounded, true);
  assert.equal(simulation.state.player.y, ledge.top);
  assert.ok(Math.hypot(simulation.state.player.x - ledge.x, simulation.state.player.z - ledge.z) < .5);
  assert.ok(simulation.state.player.stamina > 40);
  assert.equal(simulation.state.counts.climb, 1);
  assert.equal(simulation.state.counts.jump, 1);
  assert.equal(simulation.state.counts.glide, 1);
  assert.equal(adventure.claim('wind-chest', simulation.state.player), true);
  assert.equal(adventure.claim('wind-chest', simulation.state.player), false);
  assert.equal(adventure.save.xp, 55);
});

test('the actual falls secret has a walkable passage below its overhang and the ruin secret has a climbable roof route', () => {
  const world = createValleyWorld(), simulation = createFeelSimulation({ world, posts: [], bounds: null, target: () => null });
  const adventure = createAdventure(), overhang = SOLIDS.find(solid => solid.id === 'secret-overhang');
  simulation.reset({ x: -119, z: -354 });
  assert.equal(walkTo(simulation, -119, -350), true);
  assert.equal(simulation.state.player.grounded, true);
  assert.ok(simulation.state.player.y + 1.45 < overhang.bottom);
  assert.equal(simulation.state.counts.climb, 0);
  assert.equal(adventure.claim('falls-heart', simulation.state.player), true);
  simulation.reset({ x: -91.1, z: -305 });
  simulation.step(1 / 120, { moveX: 1 });
  for (let frame = 0; frame < 1440 && !simulation.state.player.grounded; frame++) simulation.step(1 / 120, { moveX: 1 });
  assert.equal(simulation.state.counts.climb, 1);
  assert.equal(walkTo(simulation, -87, -305), true);
  assert.equal(simulation.state.player.grounded, true);
  assert.equal(adventure.claim('ruin-cape', simulation.state.player), true);
});

test('all eight secret positions have collectible-height support outside physical solid bodies', () => {
  const world = createValleyWorld();
  for (const secret of SECRETS) {
    const floor = world.floorAt(secret.x, secret.z, secret.y + .4);
    assert.ok(Math.abs(floor - secret.y) <= .65 + 1e-8, secret.id);
    assert.equal(world.waterAt(secret.x, secret.z), null, secret.id);
    for (const solid of SOLIDS) {
      const inside = Math.abs(secret.x - solid.x) < solid.halfX && Math.abs(secret.z - solid.z) < solid.halfZ;
      assert.ok(!inside || floor >= solid.top - .04 || floor + 1.45 < solid.bottom, `${secret.id} intersects ${solid.id}`);
    }
  }
});
