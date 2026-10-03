import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBox, press, stepBox, toggleLock } from './box.js';
import { HILL } from './layout.js';

const DT = 1 / 120;
const still = { moveX: 0, moveZ: 0, sprint: false, attackHeld: false };
const flat = () => 0;

function facingDummy() {
  const box = createBox(flat), { player, dummy } = box;
  player.x = dummy.x; player.z = dummy.z + 1.1; player.facing = Math.PI;
  return box;
}

function run(box, seconds, input = still) {
  const events = [];
  for (let t = 0; t < seconds - 1e-9; t += DT) events.push(...stepBox(box, typeof input === 'function' ? input(t) : input, DT).map(event => ({ ...event, at: Math.round(t * 1000) })));
  return events;
}

test('a landed hit freezes the swing and the dummy for its hit-stop, then both carry on', () => {
  const box = facingDummy();
  press(box, 'attack');
  let hitAt = null, frozen = 0;
  for (let t = 0; t < 0.5; t += DT) {
    const before = box.player.time, events = stepBox(box, still, DT);
    if (hitAt === null && events.some(event => event.type === 'hit')) hitAt = t;
    else if (hitAt !== null && box.player.time === before) frozen += DT;
  }
  assert.equal(Math.round(frozen * 1000), 50);
  assert.equal(box.dummy.health, 90);
});

test('the dummy takes chunks you can see, breaks at zero and stands back up whole', () => {
  const box = facingDummy();
  let hits = [];
  for (let swing = 0; swing < 30 && !hits.some(event => event.broke); swing++) {
    press(box, 'attack');
    hits = hits.concat(run(box, 0.25).filter(event => event.type === 'hit'));
  }
  assert.deepEqual(hits.slice(0, 3).map(event => [event.attack, event.damage]), [['light1', 10], ['light2', 11], ['light3', 18]]);
  assert.ok(hits.at(-1).broke && box.dummy.health === 0);
  run(box, 1.2);
  assert.equal(box.dummy.health, 100);
});

test('a full heavy takes 30 of the dummy\'s 100 and staggers it hardest', () => {
  const box = facingDummy();
  press(box, 'attack');
  const events = run(box, 1.6, t => ({ ...still, attackHeld: t < 1 }));
  const hits = events.filter(event => event.type === 'hit');
  assert.deepEqual(hits.map(event => [event.attack, event.damage]), [['light1', 10], ['heavy', 30]]);
});

test('lock-on takes the dummy in view within 20 m, ignores it behind the camera and lets go past 25 m', () => {
  const box = createBox(flat), { player, dummy } = box;
  const toward = Math.atan2(dummy.x - player.x, dummy.z - player.z);
  assert.equal(toggleLock(box, toward + Math.PI), null);
  assert.equal(toggleLock(box, toward), 'dummy');
  assert.equal(toggleLock(box, toward), null);
  toggleLock(box, toward);
  player.z = dummy.z + 26;
  const events = run(box, DT);
  assert.equal(box.lock, null);
  assert.ok(events.some(event => event.type === 'unlock'));
});

test('locked on, the player keeps facing the dummy while strafing round it', () => {
  const box = createBox(flat), { player, dummy } = box;
  toggleLock(box, Math.PI);
  run(box, 1.5, { ...still, moveX: 1 });
  const toward = Math.atan2(dummy.x - player.x, dummy.z - player.z), off = Math.atan2(Math.sin(toward - player.facing), Math.cos(toward - player.facing));
  assert.ok(Math.abs(off) < 0.05, `off by ${off}`);
  assert.ok(Math.abs(player.x - HILL.spawn.x) > 2, 'and moved sideways');
});
