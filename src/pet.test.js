import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { PRESETS, createLayout, petBed } from './layout.js';
import { seatsFor, walkable, findWalkingPath } from './companion.js';
import { createPetRoutine, petSpots, petObstacles, petHome, insideBed, PET_REACTION, PETS } from './pet.js';
import { createPetModel } from './pets.js';
import { disposeFurnitureAssets } from './furniture.js';

// A repeatable "random" so every run takes the same walk.
const seeded = (seed = 7) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const advance = (routine, seconds, reduced = false) => { for (let i = 0; i < Math.ceil(seconds * 30); i++) routine.update(1 / 30, reduced); };
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

test('favorite spots in every room are clear floor that never blocks a desk chair', () => {
  for (const preset of PRESETS) {
    const layout = createLayout(preset.id), obstacles = petObstacles(layout), spots = petSpots(layout);
    assert.ok(spots.length >= 3, `${preset.id} has places to visit`);
    const exits = layout.items.filter(item => item.type.endsWith('desk')).flatMap(item => seatsFor(item)).flatMap(seat => [seat.portal, seat.side]);
    for (const spot of spots) {
      assert.ok(walkable(spot, obstacles), `${preset.id} ${spot.kind} is clear`);
      assert.ok(exits.every(exit => distance(exit, spot) > 0.65), `${preset.id} ${spot.kind} leaves the chair free`);
    }
    if (layout.items.some(item => item.type === 'fireplace')) assert.ok(spots.some(spot => spot.kind === 'fire'), `${preset.id} pet loves the fire`);
  }
  // A fire that is switched off is no longer a favorite.
  const cold = createLayout('ember-library'); cold.items.find(item => item.type === 'fireplace').off = true;
  assert.ok(!petSpots(cold).some(spot => spot.kind === 'fire'));
});

test('a day in the life: nap, stretch, stroll, sit, walk home, turn around and sleep', () => {
  for (const preset of PRESETS) {
    const states = [], routine = createPetRoutine({ random: seeded(), onChange: ({ state }) => states.push(state) });
    const layout = createLayout(preset.id); routine.setLayout(layout);
    const home = petHome(layout);
    assert.deepEqual([routine.pose.x, routine.pose.z, routine.pose.state], [home.x, home.z, 'sleeping']);
    advance(routine, 27); assert.ok(['waking', 'walking', 'sitting'].includes(routine.pose.state), `${preset.id} wakes after its first nap`);
    const obstacles = petObstacles(layout);
    let walkedClear = true, sat = false;
    for (let i = 0; i < 30 * 90 && !(sat && routine.pose.state === 'sleeping'); i++) {
      routine.update(1 / 30, false);
      if (routine.pose.moving && !insideBed(layout, routine.pose)) walkedClear &&= walkable(routine.pose, obstacles);
      sat ||= routine.pose.state === 'sitting';
    }
    assert.ok(walkedClear, `${preset.id} pet never walks through furniture`);
    assert.ok(sat, `${preset.id} pet sits somewhere it likes`);
    assert.equal(routine.pose.state, 'sleeping', `${preset.id} pet comes home to sleep`);
    assert.ok(distance(routine.pose, home) < 1e-6 && Math.abs(routine.pose.yaw - home.yaw) < 1e-6, 'it lies down in its bed, the same way round');
    assert.ok(states.includes('settling') && states.includes('returning'), `${preset.id} walks home and turns once around first`);
    assert.equal(JSON.stringify(layout), JSON.stringify(createLayout(preset.id)), 'a stroll never moves furniture');
  }
});

test('picked up and put down, the pet sits a moment, then walks home', () => {
  const layout = createLayout('writers-loft'), routine = createPetRoutine({ random: seeded(3) });
  routine.setLayout(layout);
  assert.equal(routine.pickUp(), true); assert.equal(routine.pose.state, 'held');
  routine.moveHeld(99, -99); assert.ok(routine.pose.x <= 5.5 && routine.pose.z >= -4.2, 'a carried pet stays inside the room');
  // Dropped onto the desk, it lands on the clear floor beside it.
  const desk = layout.items.find(item => item.id === layout.activeDeskId);
  routine.moveHeld(desk.x, desk.z); routine.drop();
  assert.equal(routine.pose.state, 'sitting'); assert.ok(walkable(routine.pose, petObstacles(layout)));
  advance(routine, 1); assert.equal(routine.pose.state, 'sitting', 'it looks around first');
  advance(routine, 6); assert.equal(routine.pose.state, 'returning');
  advance(routine, 40); assert.equal(routine.pose.state, 'sleeping'); assert.ok(distance(routine.pose, petHome(layout)) < 1e-6);
  // Set down in a corner that furniture closes off, it lands where it can
  // still walk home, instead of being stuck or jumping back to bed.
  const ember = createLayout('ember-library'), boxed = createPetRoutine({ random: seeded(5) }); boxed.setLayout(ember);
  boxed.pickUp(); boxed.moveHeld(-2.48, 3.26); boxed.drop();
  assert.ok(findWalkingPath(ember, boxed.pose, petHome(ember), petObstacles(ember)), 'the landing spot has a way home');
  assert.ok(distance(boxed.pose, { x: -2.48, z: 3.26 }) < 1.6, 'and it is close to where it was set down');
  // Dropped onto its own bed, it settles straight in.
  routine.pickUp(); const bed = petBed(layout); routine.moveHeld(bed.x + 0.2, bed.z); routine.drop();
  assert.equal(routine.pose.state, 'settling');
});

test('petting pauses a nap and a walk; editing and reduced motion keep the pet home', () => {
  const layout = createLayout('ember-library'), routine = createPetRoutine({ random: seeded(11) });
  routine.setLayout(layout);
  routine.pet(); advance(routine, 1); assert.ok(routine.pose.petAge < PET_REACTION);
  advance(routine, 2); assert.equal(routine.pose.petAge, Infinity, 'the reaction ends');
  advance(routine, 26); while (routine.pose.state !== 'walking') routine.update(1 / 30, false);
  const before = { x: routine.pose.x, z: routine.pose.z }; routine.pet(); advance(routine, 1);
  assert.deepEqual({ x: routine.pose.x, z: routine.pose.z }, before, 'a walking pet stops to be petted');
  advance(routine, 3); assert.notDeepEqual({ x: routine.pose.x, z: routine.pose.z }, before, 'then carries on');
  routine.setEditing(true); assert.equal(routine.pose.state, 'sleeping'); assert.ok(distance(routine.pose, petHome(layout)) < 1e-6);
  advance(routine, 60); assert.equal(routine.pose.state, 'sleeping', 'no strolls while decorating');
  routine.setEditing(false); advance(routine, 120, true); assert.equal(routine.pose.state, 'sleeping', 'reduced motion: no strolls');
  // A moved bed takes the sleeping pet with it, without restarting its nap.
  const moved = structuredClone(layout); Object.assign(petBed(moved), { x: -3.5, z: 2, rotation: 1 });
  routine.setLayout(moved); assert.deepEqual([routine.pose.x, routine.pose.z], [-3.5, 2]);
});

test('cat and dog models: one mesh, finite poses, paws on the floor, eyes that close for a nap', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    for (const species of Object.keys(PETS)) {
      const model = createPetModel(scene, species), meshes = scene.meshes.length, geometry = model.body.geometry;
      const pose = { action: 'sleep', moving: false, walked: 0, petAge: Infinity };
      const positions = () => model.body.getPositionData(true);
      for (const action of ['sleep', 'stretch', 'walk', 'stand', 'sit', 'loaf', 'held', 'settle']) {
        pose.action = action; pose.moving = action === 'walk';
        for (let i = 0; i < 90; i++) { pose.walked += pose.moving ? 0.01 : 0; model.animate(pose, 1 / 30, i / 30, false); }
        const data = positions(), normals = model.body.getNormalsData(true);
        assert.ok(data.every(Number.isFinite) && normals.every(Number.isFinite), `${species} ${action} is finite`);
        let lowest = Infinity; for (let j = 1; j < data.length; j += 3) lowest = Math.min(lowest, data[j]);
        if (action !== 'held') assert.ok(lowest > -0.02, `${species} ${action} stays on the floor (${lowest.toFixed(3)})`);
        const box = model.body.getBoundingInfo().boundingBox;
        let inside = true; for (let j = 0; j < data.length; j += 3) inside &&= data[j] >= box.minimum.x && data[j] <= box.maximum.x && data[j + 1] <= box.maximum.y && data[j + 2] >= box.minimum.z && data[j + 2] <= box.maximum.z;
        assert.ok(inside, `${species} ${action} fits its picking box`);
      }
      // Asleep, the pet shows closed eyes and floating letters; petting brings a heart.
      pose.action = 'sleep'; pose.moving = false; for (let i = 0; i < 60; i++) model.animate(pose, 1 / 30, 3 + i / 30, false);
      assert.equal(model.sleepLetters.isEnabled(), true); assert.equal(model.heart.isEnabled(), false);
      pose.petAge = 0.5; model.animate(pose, 1 / 30, 6, false);
      assert.equal(model.heart.isEnabled(), true); assert.equal(model.sleepLetters.isEnabled(), false);
      pose.petAge = Infinity;
      assert.equal(model.body.geometry, geometry); assert.equal(scene.meshes.length, meshes, 'animation allocates no meshes');
      assert.ok(!model.body.receiveShadows && model.body.skeleton.bones.length < 60, 'one small rig');
      // Reduced motion rests exactly: two frames far apart are identical.
      model.animate(pose, 1 / 30, 10, true); const still = Array.from(positions());
      model.animate(pose, 1 / 30, 25, true); assert.deepEqual(Array.from(positions()), still);
      model.dispose();
    }
  } finally { disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); }
});
