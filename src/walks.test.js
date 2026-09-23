import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, createLayout, validatePlacement, pieceCount, MAX_ITEMS, ROOM_BOUNDS } from './layout.js';
import { FURNITURE, getFurniture } from './catalog.js';
import { activitySpots, createCompanionRoutine, navigationObstacles, planCompanionTrip, reachableFloor, reaches, seatsFor, walkable } from './companion.js';
import { createPetRoutine, petHome, petObstacles, petSpots } from './pet.js';

// Walks of the companion and the pet together: no jumps, no furniture, and
// always a way back to the desk and home.
const seeded = (seed = 7) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const isDesk = item => getFurniture(item.type)?.category === 'Study';

test('from every activity spot, the companion picks a seat that it can walk back to the desk from', () => {
  for (const preset of PRESETS) {
    const layout = createLayout(preset.id), obstacles = navigationObstacles(layout);
    const exits = seatsFor(layout.items.find(item => item.id === layout.activeDeskId)).map(seat => seat.portal);
    const reached = reachableFloor(layout, exits, obstacles), canReach = point => reaches(reached, point, obstacles);
    for (const spot of activitySpots(layout, { night: true, canReach })) {
      const trip = planCompanionTrip(layout, spot, false, undefined, { canReach });
      if (trip) assert.ok(planCompanionTrip(layout, trip.end, true), `${preset.id}: from the ${spot.kind} spot, the ${trip.end.itemId} seat leads back to the desk`);
    }
  }
});

test('a pet with nowhere else to go walks home and never jumps', () => {
  // A row of bookcases closes off the pet's corner, with one spot left in it.
  const shelves = [-3.25, -1.25, 0.75, 2.75].map((z, i) => ({ id: `shelf-${i}`, type: 'bookcase', x: 2.75, z, rotation: 1 }));
  const layout = { presetId: 'writers-loft', activeDeskId: 'desk', v: 2, items: [{ id: 'desk', type: 'study-desk', x: -2, z: -2.25, rotation: 0 }, ...shelves, { id: 'pet-bed', type: 'pet-bed', x: 4.5, z: 3.5, rotation: 0 }] };
  const routine = createPetRoutine({ random: () => 0.1 }); routine.setLayout(layout);
  let last = { ...routine.pose }, farthest = 0, states = new Set();
  for (let i = 0; i < 90 * 30; i++) {
    routine.update(1 / 30, false); states.add(routine.pose.state);
    assert.ok(distance(routine.pose, last) < 0.05, `no jump at ${(i / 30).toFixed(1)} s (${last.state} to ${routine.pose.state})`);
    farthest = Math.max(farthest, distance(routine.pose, petHome(layout))); last = { ...routine.pose };
  }
  assert.ok(farthest > 3, 'it went to the one spot in its corner'); assert.ok(states.has('returning') && states.has('settling'), 'and walked back to bed');
});

test('the companion and the pet keep out of the places where the other is going', () => {
  const layout = createLayout('writers-loft'), spot = petSpots(layout)[0];
  assert.ok(!petSpots(layout, { companion: { x: 0, z: -3.5, to: { x: spot.x, z: spot.z } } }).some(entry => distance(entry, spot) < 0.7), 'the pet does not sit where the companion is going');
  const pet = { x: 0.75, z: 1.5, yaw: 0, state: 'walking', moving: true, held: false };
  const target = activitySpots(layout)[0];
  assert.ok(!activitySpots(layout, { pet: { ...pet, to: { x: target.x, z: target.z } } }).some(entry => distance(entry, target) < 0.6), 'the companion does not stand where the pet is going');
});

test('the companion walks around a pet that sits down in its way', () => {
  const layout = createLayout('writers-loft'), routine = createCompanionRoutine(() => {}, { random: () => 0.5 });
  routine.setLayout(layout); routine.setIntent('working'); routine.setIntent('break');
  // The pet sits down on the longest stretch of the walk, after it began.
  const path = routine.diagnostics().path, legs = path.slice(1).map((b, i) => [path[i], b]).sort((p, q) => distance(...q) - distance(...p)), [a, b] = legs[0];
  assert.ok(distance(a, b) > 1.5, 'a long stretch to sit on');
  routine.update(1 / 60, false);
  const pet = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, yaw: 0, state: 'sitting', moving: false, held: false };
  routine.setContext({ pet });
  let closest = Infinity;
  for (let i = 0; i < 40 * 60 && routine.pose.state === 'walking'; i++) { routine.update(1 / 60, false); if (routine.pose.moving) closest = Math.min(closest, distance(routine.pose, pet)); }
  assert.notEqual(routine.pose.state, 'walking', 'and it gets there');
  assert.ok(closest > 0.43, `it passes the pet with room to spare (${closest.toFixed(2)} m)`);
});

// Random rooms from every design, crowded or thinned out, with focus and
// breaks at random moments, taps, carries and switches.
function randomRoom(preset, random) {
  const style = preset.style || 'retreat', layout = createLayout(preset.id), items = layout.items;
  const spot = (type, id) => {
    for (let k = 0; k < 60; k++) {
      const candidate = { id, type, rotation: Math.floor(random() * 4), x: Math.round((ROOM_BOUNDS.minX + random() * 11) * 4) / 4, z: Math.round((ROOM_BOUNDS.minZ + random() * 8.4) * 4) / 4 };
      if (validatePlacement(items, candidate, style).valid) return candidate;
    }
    return null;
  };
  for (const item of items) if (getFurniture(item.type).mount !== 'wall' && random() < 0.6) Object.assign(item, spot(item.type, item.id) || {});
  const types = FURNITURE.filter(entry => entry.mount !== 'wall' && !entry.unique).map(entry => entry.id);
  for (let k = 0; k < 60 && pieceCount(items) < MAX_ITEMS; k++) { const extra = spot(types[Math.floor(random() * types.length)], `extra-${k}`); if (extra) items.push(extra); }
  const desks = items.filter(isDesk); layout.activeDeskId = desks[Math.floor(random() * desks.length)].id;
  return layout;
}
test('in random rooms the companion and the pet never jump, never walk into furniture and always get back', () => {
  for (const [index, preset] of PRESETS.entries()) for (const crowded of [false, true]) {
    const random = seeded(index * 2 + crowded + 11), layout = crowded ? randomRoom(preset, random) : createLayout(preset.id);
    const companion = createCompanionRoutine(() => {}, { random }), pet = createPetRoutine({ random });
    pet.setCompanion(companion.pose); companion.setContext({ pet: pet.pose, night: random() < 0.5 });
    companion.setLayout(layout); pet.setLayout(layout); companion.setIntent('working');
    const solids = navigationObstacles(layout), desk = navigationObstacles(layout, layout.activeDeskId), home = petObstacles(layout), name = `${preset.id}${crowded ? ' (crowded)' : ''}`;
    let focus = true, spell = 20, since = 0, lastHome = 0, before = { ...companion.pose }, petBefore = { ...pet.pose };
    for (let frame = 0; frame < 4 * 60 * 60; frame++) {
      const now = frame / 60; let dropped = false;
      if ((spell -= 1 / 60) <= 0) { focus = !focus; spell = focus ? 10 + random() * 40 : 20 + random() * 80; companion.setIntent(focus ? 'working' : 'break'); since = now; }
      if (random() < 1 / 900) pet.pet();
      if (random() < 1 / 1500 && pet.pickUp()) { pet.moveHeld(ROOM_BOUNDS.minX + random() * 11, ROOM_BOUNDS.minZ + random() * 8.4); pet.drop(); dropped = true; }
      companion.update(1 / 60, false); pet.update(1 / 60, false);
      const c = companion.pose, p = pet.pose, at = () => `${name} at ${now.toFixed(1)} s`;
      if (distance(c, before) >= 0.1) assert.fail(`${at()}: the companion jumps from ${before.state} to ${c.state}`);
      if (!dropped && distance(p, petBefore) >= 0.1) assert.fail(`${at()}: the pet jumps from ${petBefore.state} to ${p.state}`);
      if (c.moving && before.moving && !c.atDesk && !walkable(c, solids) && !walkable(c, desk)) assert.fail(`${at()}: the companion walks into furniture`);
      if (!p.held && !walkable(p, home)) assert.fail(`${at()}: the pet stands in furniture`);
      if (focus && now - since > 30 && c.state !== 'working') assert.fail(`${at()}: not back at the desk after focus resumed (${c.state})`);
      if (p.state === 'sleeping') lastHome = now;
      if (now - lastHome >= 200) assert.fail(`${at()}: the pet does not get home`);
      before = { ...c }; petBefore = { ...p };
    }
  }
});
