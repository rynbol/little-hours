import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLIMB, GLIDE, VITALS, createPlayer, hurtPlayer, invulnerable, pressPlayer, stepPlayer } from './player.js';
import { smooth } from '../world-terrain.js';

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

const cliff = (rise, from = 3) => (_, z) => rise * smooth(from, from + 2, z);
const forward = { ...still, moveZ: 1 };
const types = events => events.map(event => event.type);

test('walking into a cliff grabs it, holding forward climbs slowly, and the lip mantles you onto the top', () => {
  const ground = cliff(4);
  const player = createPlayer({ ground });
  let highest = 0;
  const events = run(player, 6, forward, open(ground), p => { if (p.state === 'climb') highest = Math.max(highest, p.y); });
  assert.deepEqual(types(events).filter(type => ['grab', 'mantle'].includes(type)), ['grab', 'mantle']);
  const grab = events.find(event => event.type === 'grab').at, mantle = events.find(event => event.type === 'mantle').at;
  assert.ok(mantle - grab > 2300 && mantle - grab < 3000, `climbed four metres in ${mantle - grab} ms`);
  assert.ok(highest > 3.4);
  assert.equal(player.state, 'move');
  assert.equal(player.y, 4);
  assert.ok(player.z > 5);
  assert.ok(player.stamina > 60, `stamina ${player.stamina}`);
});

test('a climb lets go when stamina runs out, and you cannot grab again until you have your breath back', () => {
  const ground = (_, z) => z > 3 ? (z - 3) * 3 : 0;
  const player = createPlayer({ ground });
  const grabs = [];
  const events = run(player, 16, forward, open(ground), p => { if (p.state === 'climb' && p.time === 0) grabs.push(p.tired); });
  const slip = events.find(event => event.type === 'slip');
  assert.ok(slip && slip.at > 9000 && slip.at < 13000, `held on for ${slip?.at} ms`);
  assert.ok(events.some(event => event.type === 'land' && event.at > slip.at), 'fell back to the foot of the wall');
  assert.deepEqual(grabs, grabs.map(() => false));
  assert.ok(events.filter(event => event.type === 'grab').every(event => event.at < slip.at || event.at > slip.at + 1000));
});

test('a winded player walks into a cliff and stops at its foot instead of walking up it', () => {
  const ground = cliff(4);
  const player = createPlayer({ ground });
  player.stamina = 0; player.tired = true;
  const events = run(player, 1.1, forward, open(ground));
  assert.ok(!types(events).includes('grab'));
  assert.ok(player.y < 0.6, `stood at ${player.y.toFixed(2)} m`);
  assert.ok(player.z < 3.7, `stopped at z ${player.z.toFixed(2)}`);
});

test('jump on a wall leaps upward for a chunk of stamina, and dodge lets go', () => {
  const ground = (_, z) => z > 3 ? (z - 3) * 3 : 0;
  const player = createPlayer({ ground });
  run(player, 1.2, forward, open(ground));
  assert.equal(player.state, 'climb');
  const before = { y: player.y, stamina: player.stamina };
  pressPlayer(player, 'jump');
  const events = run(player, CLIMB.leapTime + 0.05, still, open(ground));
  assert.ok(types(events).includes('leap'));
  assert.equal(Math.round((player.y - before.y) * 10) / 10, CLIMB.leap);
  assert.ok(before.stamina - player.stamina >= CLIMB.leapCost);
  pressPlayer(player, 'dodge');
  const drop = run(player, 1.5, still, open(ground));
  assert.deepEqual(types(drop).filter(type => ['let-go', 'land'].includes(type)), ['let-go', 'land']);
  assert.equal(player.state, 'move');
});

test('jump in the air high above the ground opens the glider, which sinks slowly and steers, and jump folds it', () => {
  const ground = () => 0;
  const player = createPlayer({ ground, y: 12 });
  player.y = 12; player.grounded = false;
  run(player, 0.3, still, open(ground));
  pressPlayer(player, 'jump');
  const start = player.z;
  const events = run(player, 2, forward, open(ground));
  assert.ok(types(events).includes('glide'));
  assert.equal(player.state, 'glide');
  assert.equal(Math.round(-player.vy * 10) / 10, GLIDE.sink);
  assert.ok(player.z - start > 8, `drifted ${(player.z - start).toFixed(1)} m`);
  pressPlayer(player, 'jump');
  const fold = run(player, 1.5, still, open(ground));
  assert.deepEqual(types(fold).filter(type => ['glide-end', 'land'].includes(type)), ['glide-end', 'land']);
});

test('a jump from flat ground never opens the glider', () => {
  const player = createPlayer({ ground: () => 0 });
  pressPlayer(player, 'jump');
  let pressed = false;
  const events = run(player, 1, still, open(), (p, t) => { if (!pressed && t > 0.25) { pressed = true; pressPlayer(p, 'jump'); } });
  assert.ok(!types(events).includes('glide'));
});

test('warm air over the meadow lifts a glider, and the glider folds when stamina is spent', () => {
  const ground = () => 0;
  const world = { ...open(ground), updrafts: [{ x: 0, z: 0, radius: 6, lift: 1.6 }] };
  const player = createPlayer({ ground });
  player.y = 6; player.grounded = false;
  run(player, 0.2, still, world, p => { p.x = 0; p.z = 0; });
  pressPlayer(player, 'jump');
  run(player, 2, still, world, p => { p.x = 0; p.z = 0; });
  assert.ok(player.y > 6.5, `rose to ${player.y.toFixed(2)} m`);
  player.stamina = 3;
  const events = run(player, 1, still, world);
  assert.ok(events.some(event => event.type === 'glide-end' && event.tired));
});

test('walking off a cliff falls instead of striding down it, and a long fall stumbles without hurting', () => {
  const ground = (_, z) => 10 - 10 * smooth(1, 2, z);
  const player = createPlayer({ ground });
  player.y = 10;
  const events = run(player, 2.2, forward, open(ground));
  const land = events.find(event => event.type === 'land');
  assert.ok(land && land.height > 9, `fell ${land?.height}`);
  assert.ok(land.hard);
  assert.equal(player.health, VITALS.health);
  const short = createPlayer({ ground: cliff(-3, 1) });
  const steps = run(short, 1.5, forward, open(cliff(-3, 1)));
  assert.ok(steps.some(event => event.type === 'land' && !event.hard));
});

test('no single hit takes more than a third of your health, and a heavy one knocks you down and back up', () => {
  const player = createPlayer({ ground: () => 0 });
  assert.equal(Math.round(hurtPlayer(player, { damage: 80, fromX: 0, fromZ: -1 })), 33);
  run(player, 1);
  assert.equal(player.state, 'move');
  hurtPlayer(player, { damage: 10, knock: VITALS.heavy, fromX: 0, fromZ: -1 });
  assert.equal(player.state, 'knocked');
  const states = new Set();
  run(player, 2.5, still, open(), p => states.add(p.state));
  assert.deepEqual([...states], ['knocked', 'rise', 'move']);
  assert.ok(player.z > 0.5, 'thrown away from the blow');
});
