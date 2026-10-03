import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, invulnerable, pressPlayer, stepPlayer } from './player.js';

const DT = 1 / 120;
const still = { moveX: 0, moveZ: 0, sprint: false, attackHeld: false };
const open = (ground = () => 0) => ({ ground, targets: [], solids: [], bounds: { x: 0, z: 0, radius: 500 }, lock: null });

function run(player, seconds, input = still, world = open(), each = () => {}) {
  const events = [];
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    player.events.length = 0;
    stepPlayer(player, typeof input === 'function' ? input(t) : input, DT, world);
    events.push(...player.events.map(event => ({ ...event, at: Math.round(t * 1000) })));
    each(player, t);
  }
  return events;
}

test('every input shows on the very next step, well inside 100 ms', () => {
  for (const [action, state] of [['attack', 'attack'], ['dodge', 'dodge']]) {
    const player = createPlayer({ ground: () => 0 });
    pressPlayer(player, action);
    run(player, DT);
    assert.equal(player.state, state);
  }
  const jumper = createPlayer({ ground: () => 0 });
  pressPlayer(jumper, 'jump'); run(jumper, DT);
  assert.ok(jumper.y > 0 && !jumper.grounded);
  const runner = createPlayer({ ground: () => 0 });
  run(runner, DT, { ...still, moveZ: 1 });
  assert.ok(runner.vz > 0.2);
  run(runner, 0.14, { ...still, moveZ: 1 });
  assert.equal(Math.round(runner.vz * 10) / 10, 4.4, 'up to a jog in under 0.15 s');
});

test('a jump rises about a metre and lands half a second later', () => {
  const player = createPlayer({ ground: () => 0 });
  let peak = 0;
  pressPlayer(player, 'jump');
  const events = run(player, 1, still, open(), p => { peak = Math.max(peak, p.y); });
  assert.equal(Math.round(peak * 10) / 10, 1);
  assert.deepEqual(events.filter(event => event.type === 'land').map(event => event.at), [500]);
});

test('a jump pressed just after running off a ledge still jumps, and one pressed too late does not', () => {
  const ledge = (_, z) => z > 1 ? -3 : 0;
  for (const [late, jumps] of [[0.06, true], [0.2, false]]) {
    const player = createPlayer({ ground: ledge });
    let pressed = false, offAt = null;
    const events = run(player, 0.8, () => ({ ...still, moveZ: 1 }), open(ledge), (p, t) => {
      if (!p.grounded && offAt === null) offAt = t;
      if (offAt !== null && !pressed && t - offAt >= late) { pressed = true; pressPlayer(p, 'jump'); }
    });
    assert.equal(events.some(event => event.type === 'jump'), jumps, `pressed ${late} s after the edge`);
  }
});

test('a jump pressed just before landing fires on touchdown', () => {
  const player = createPlayer({ ground: () => 0 });
  pressPlayer(player, 'jump');
  let pressed = false;
  const events = run(player, 1.2, still, open(), (p, t) => { if (!pressed && t > 0.42) { pressed = true; pressPlayer(p, 'jump'); } });
  assert.deepEqual(events.filter(event => event.type === 'jump' || event.type === 'land').map(event => event.type), ['jump', 'land', 'jump', 'land']);
});

test('a dodge rolls about three and a half metres, is untouchable through its middle and costs stamina', () => {
  const player = createPlayer({ ground: () => 0 });
  pressPlayer(player, 'dodge');
  const guarded = [];
  run(player, 0.6, still, open(), (p, t) => { if (invulnerable(p)) guarded.push(Math.round(t * 1000)); });
  assert.equal(Math.round(player.z * 10) / 10, 3.5);
  assert.deepEqual([guarded[0], guarded.at(-1)], [33, 292]);
  assert.equal(Math.round(player.stamina), 84);
});

test('sprinting drains stamina until you are winded, then dodges wait for it to come back', () => {
  const player = createPlayer({ ground: () => 0 });
  const events = run(player, 6, { ...still, moveZ: 1, sprint: true });
  assert.ok(events.some(event => event.type === 'tired'));
  assert.equal(Math.round(player.vz * 10) / 10, 4.4, 'winded, you jog');
  pressPlayer(player, 'dodge');
  run(player, DT);
  assert.notEqual(player.state, 'dodge');
  run(player, 2);
  pressPlayer(player, 'dodge');
  run(player, DT);
  assert.equal(player.state, 'dodge');
});

test('three presses chain the three-hit combo, each starting only once the last blade has finished', () => {
  const player = createPlayer({ ground: () => 0 });
  pressPlayer(player, 'attack');
  let presses = 1;
  const events = run(player, 1.6, still, open(), (p, t) => { if (presses < 3 && t > presses * 0.12) { presses++; pressPlayer(p, 'attack'); } });
  assert.deepEqual(events.filter(event => event.type === 'swing').map(event => `${event.attack}@${event.at}`), ['light1@0', 'light2@175', 'light3@342']);
});

test('holding the button through a swing charges a heavy that lands on release, and a tap does not', () => {
  const player = createPlayer({ ground: () => 0 });
  pressPlayer(player, 'attack');
  const events = run(player, 1.9, t => ({ ...still, attackHeld: t < 1 }));
  assert.deepEqual(events.filter(event => ['swing', 'charge'].includes(event.type)).map(event => `${event.type}:${event.attack ?? ''}@${event.at}`), ['swing:light1@0', 'charge:@233', 'swing:heavy@1008']);
  assert.equal(events.find(event => event.attack === 'heavy').charge, 1);
  const tapper = createPlayer({ ground: () => 0 });
  pressPlayer(tapper, 'attack');
  const taps = run(tapper, 1, t => ({ ...still, attackHeld: t < 0.1 }));
  assert.deepEqual(taps.filter(event => ['swing', 'charge'].includes(event.type)).map(event => event.attack ?? event.type), ['light1']);
});

test('a dodge cancels the end of a swing but never the strike itself', () => {
  const player = createPlayer({ ground: () => 0 });
  pressPlayer(player, 'attack');
  let pressed = false;
  const events = run(player, 0.5, still, open(), (p, t) => { if (!pressed && t > 0.05) { pressed = true; pressPlayer(p, 'dodge'); } });
  const dodge = events.find(event => event.type === 'dodge');
  assert.ok(dodge && dodge.at >= 170 && dodge.at < 200, `dodged at ${dodge?.at}`);
});

test('the player stops against posts instead of walking through them', () => {
  const player = createPlayer({ ground: () => 0 });
  const world = { ...open(), solids: [{ x: 0, z: 2, radius: 0.17, bottom: 0, top: 1.35 }] };
  run(player, 2, { ...still, moveZ: 1 }, world);
  assert.ok(player.z < 2 - 0.17 - 0.3, `stopped at ${player.z}`);
});
