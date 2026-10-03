import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ATTACKS, bladeAngles, hitDamage, sweepHits } from './moves.js';

const body = { x: 0, y: 0, z: 0, facing: 0 };
const dummyAt = (bearing, distance) => { const a = bearing * Math.PI / 180; return { id: 'dummy', x: Math.sin(a) * distance, z: Math.cos(a) * distance, radius: 0.3, bottom: 0, top: 1.65 }; };
function firstHit(id, target) {
  for (let t = 0; t < ATTACKS[id].end; t += 1 / 240) if (sweepHits(body, ATTACKS[id], t, t + 1 / 240, [target]).length) return Math.round(t * 1000);
  return null;
}

test('a swing lands only where the blade reaches: in front within the tip, never past it or behind', () => {
  assert.equal(firstHit('light1', dummyAt(0, 1.2)) !== null, true);
  assert.equal(firstHit('light1', dummyAt(0, 1.75)), null);
  assert.equal(firstHit('light1', dummyAt(180, 1)), null);
  assert.equal(firstHit('heavy', dummyAt(0, 1.4)) !== null, true);
  assert.equal(firstHit('heavy', dummyAt(90, 1)), null);
  assert.equal(firstHit('light3', dummyAt(180, 1)) !== null, true, 'the third hit spins all the way round');
});

test('the blade meets each side when it gets there: the opener cuts right to left, the backhand left to right', () => {
  const left = dummyAt(50, 1.1), right = dummyAt(-50, 1.1);
  assert.ok(firstHit('light1', right) < firstHit('light1', left));
  assert.ok(firstHit('light2', left) < firstHit('light2', right));
  for (const id of Object.keys(ATTACKS)) {
    const hit = firstHit(id, dummyAt(0, 1.2));
    assert.ok(hit >= ATTACKS[id].strike[0] * 1000 - 5 && hit <= ATTACKS[id].strike[1] * 1000, `${id} hits inside its strike window, at ${hit} ms`);
  }
});

test('the blade winds up, sweeps and comes home to rest without jumping', () => {
  for (const [id, attack] of Object.entries(ATTACKS)) {
    let last = bladeAngles(attack, 0, [0, 0]);
    for (let t = 1 / 2000; t <= attack.end; t += 1 / 2000) {
      const now = bladeAngles(attack, t, [0, 0]);
      assert.ok(Math.abs(now[0] - last[0]) < 4 && Math.abs(now[1] - last[1]) < 4, `${id} jumps at ${t.toFixed(4)} s`);
      last = now;
    }
    const home = bladeAngles(attack, attack.end, [0, 0]);
    assert.deepEqual([((Math.round(home[0]) % 360) + 360) % 360, Math.round(home[1])], [38, -52]);
  }
});

test('the heavy grows with its charge, and no hit takes more than a third of full health', () => {
  assert.equal(hitDamage(ATTACKS.heavy, 0, 100), 20);
  assert.equal(hitDamage(ATTACKS.heavy, 0.5, 100), 25);
  assert.equal(hitDamage(ATTACKS.heavy, 1, 100), 30);
  assert.equal(hitDamage(ATTACKS.light1, 0, 100), 10);
  assert.equal(hitDamage(ATTACKS.heavy, 1, 60), 20);
  for (const attack of Object.values(ATTACKS)) assert.ok(hitDamage(attack, 1, 100) <= 100 / 3);
});
