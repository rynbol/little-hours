import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { PRESETS, createLayout, validatePlacement } from './layout.js';
import { createMobileCompanion, disposeFurnitureAssets } from './furniture.js';
import { petSpots } from './pet.js';
import { companionIntent, localPoint, planCompanionTrip, planActivityTrip, planDoorwayTrip, activitySpots, navigationObstacles, walkable, clearSegment, createCompanionRoutine, DOOR_TRIP_SECONDS, DOZE_AFTER, ACTIVITIES } from './companion.js';

// A repeatable "random".
const seeded = (seed = 7) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const advance = (routine, seconds, reduced = false) => { for (let i = 0; i < Math.ceil(seconds * 60); i++) routine.update(1 / 60, reduced); };
// Advances until the routine reaches `state`, for at most `seconds`.
const until = (routine, state, seconds = 60, reduced = false) => { for (let i = 0; i < seconds * 60 && routine.pose.state !== state; i++) routine.update(1 / 60, reduced); return routine.pose.state; };
test('companion intent distinguishes new visits, working, paused and completed sessions', () => {
  assert.equal(companionIntent({ running: false, remaining: 1500, duration: 1500 }), 'rest');
  assert.equal(companionIntent({ running: true, remaining: 1300, duration: 1500 }), 'working');
  assert.equal(companionIntent({ running: false, remaining: 1300, duration: 1500 }), 'rest');
  // A finished session rests like any other non-focus state.
  const finished = { running: false, remaining: 0, duration: 1500, completedAt: 10_000 };
  assert.equal(companionIntent(finished, 10_000 + 60_000), 'rest');
  assert.equal(companionIntent(finished, 10_000 + 16 * 60_000), 'rest', 'a finished session leaves the companion resting');
  assert.equal(companionIntent({ running: false, remaining: 0, duration: 1500 }), 'rest', 'an old save without a finish time rests too');
});
test('a non-focus visit rests on the sofa without detouring through an activity', () => {
  const layout = createLayout('ember-library'), routine = createCompanionRoutine();
  routine.setLayout(layout); routine.setIntent('rest');
  assert.equal(routine.pose.state, 'walking');
  assert.equal(until(routine, 'resting', 60), 'resting');
  assert.equal(routine.pose.seated, true);
  assert.equal(layout.items.find(item => item.id === routine.pose.seatId).type, 'daybed');
  assert.equal(routine.pose.activity, null);
});
test('every preset has a sofa route with clearance around solids and the sleeping cat', () => {
  for (const preset of PRESETS) {
    const layout = createLayout(preset.id), before = JSON.stringify(layout), trip = planCompanionTrip(layout, null, false);
    assert.ok(trip, preset.id); assert.equal(layout.items.find(i => i.id === trip.end.itemId).type, 'daybed');
    const obstacles = navigationObstacles(layout);
    for (let i = 1; i < trip.path.length; i++) {
      const a = trip.path[i - 1], b = trip.path[i];
      for (let t = 0; t <= 1; t += .002) assert.ok(walkable({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, obstacles), `${preset.id} never clips a corner`);
    }
    assert.ok(planCompanionTrip(layout, trip.end, true), 'a seated companion can get back to the desk');
    assert.equal(JSON.stringify(layout), before, 'planning never moves furniture');
  }
  assert.equal(clearSegment({ x: -1, z: 0 }, { x: 1, z: 0 }, [{ minX: -.01, maxX: .01, minZ: -.01, maxZ: .01 }]), false, 'thin obstacles cannot fall between samples');
});
test('every room design has clear routes to both doorways, including the modeled loft stairs', () => {
  for (const preset of PRESETS) {
    const layout = createLayout(preset.id), obstacles = navigationObstacles(layout);
    for (const link of [{ id: 'garden', built: true, upstairs: false, z: 2.35 }, { id: 'loft', built: true, upstairs: true, z: -2.05 }]) {
      const route = planDoorwayTrip(layout, null, link, obstacles);
      assert.ok(route, `${preset.id} can reach ${link.id}`);
      assert.equal(route.end.door, true);
      assert.equal(route.end.link.id, link.id);
      assert.ok(route.end.portal.x > 7 && Math.abs(route.end.portal.z - link.z) < 1e-6);
      assert.ok(Math.abs(route.end.portal.height - (link.upstairs ? .95 : 0)) < 1e-6);
      for (let i = 1; i < route.path.length; i++) {
        const a = route.path[i - 1], b = route.path[i];
        // Every segment before the open porch stays inside the room's clear
        // floor; the transition outside is independently checked by planner.
        if (a.x <= 5.1 && b.x <= 5.1) for (let t = 0; t <= 1; t += .02) {
          const point = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
          assert.ok(walkable(point, obstacles), `${preset.id} ${link.id} stays clear at ${point.x},${point.z}`);
        }
      }
    }
  }
});
test('door walks animate from the current companion pose, face the door and finish exactly once', () => {
  const layout = createLayout('writers-loft'), link = { id: 'loft', built: true, upstairs: true, z: -2.05 };
  const routine = createCompanionRoutine(() => {});
  routine.setLayout(layout); routine.setIntent('working');
  let reached = null, opened = null, elapsed = 0, elapsedFrames = 0;
  assert.equal(routine.walkToDoor(link, value => { reached = value.id; }, () => { opened = { x: routine.pose.x, z: routine.pose.z, activity: routine.pose.activity, reach: routine.pose.reach }; }), true);
  const start = { x: routine.pose.x, z: routine.pose.z };
  assert.equal(routine.pose.goal, 'door'); assert.equal(routine.pose.moving, true);
  for (let i = 0; i < 48; i++, elapsedFrames++, elapsed += 1 / 60) routine.update(1 / 60, false);
  assert.notDeepEqual({ x: routine.pose.x, z: routine.pose.z }, start, 'the companion visibly leaves the desk');
  assert.equal(opened, null, 'the door stays closed while the avatar approaches');
  while (elapsed < DOOR_TRIP_SECONDS && opened === null) { routine.update(1 / 60, false); elapsedFrames++; elapsed += 1 / 60; }
  assert.ok(opened, 'the avatar reaches for the handle to open the door');
  assert.equal(opened.activity, 'door');
  assert.ok(opened.reach && Math.hypot(opened.reach.x - opened.x, opened.reach.z - opened.z) < .55, 'the reaching hand can reach the door handle');
  assert.equal(reached, null, 'the room does not change while the door is opening');
  while (elapsed < DOOR_TRIP_SECONDS + 1 / 60 && reached === null) { routine.update(1 / 60, false); elapsedFrames++; elapsed += 1 / 60; }
  assert.equal(reached, 'loft'); assert.equal(routine.pose.state, 'at-door');
  assert.equal(elapsedFrames, Math.round(DOOR_TRIP_SECONDS * 60), 'every door trip uses its fixed arrival time');
  assert.equal(routine.pose.moving, false); assert.equal(routine.pose.walkHeight, .95);
  advance(routine, 2); assert.equal(reached, 'loft', 'door arrival fires once');
});
test('door arrival time stays fixed from desk, sofa and mid-walk starting positions', () => {
  const link = { id: 'garden', built: true, upstairs: false, z: 2.35 };
  const cases = [];
  const atDesk = createCompanionRoutine(() => {}); atDesk.setLayout(createLayout('writers-loft')); atDesk.setIntent('working'); cases.push(atDesk);
  const atSofa = createCompanionRoutine(() => {}); atSofa.setLayout(createLayout('writers-loft')); atSofa.setIntent('break');
  assert.equal(until(atSofa, 'resting', 90), 'resting'); cases.push(atSofa);
  const midWalk = createCompanionRoutine(() => {}); midWalk.setLayout(createLayout('writers-loft')); midWalk.setIntent('break'); advance(midWalk, .25); cases.push(midWalk);
  const frames = cases.map(routine => {
    let arrived = false, opened = false;
    assert.equal(routine.walkToDoor(link, () => { arrived = true; }, () => { opened = true; }), true);
    let frame = 0;
    for (; frame < 360 && !arrived; frame++) routine.update(1 / 60, false);
    assert.equal(opened, true, 'every starting pose includes the handle interaction');
    assert.equal(arrived, true, 'every starting pose reaches the door');
    return frame;
  });
  assert.deepEqual(frames, [frames[0], frames[0], frames[0]], 'source position does not affect planned arrival time');
  assert.equal(frames[0], Math.ceil(DOOR_TRIP_SECONDS * 60));
});
test('a moving pet can trigger a door-route detour without restarting the fixed arrival time', () => {
  const routine = createCompanionRoutine(() => {}), layout = createLayout('writers-loft');
  routine.setLayout(layout); routine.setIntent('working');
  let arrived = false, opens = 0, frame = 0;
  assert.equal(routine.walkToDoor({ id: 'garden', built: true, upstairs: false, z: 2.35 }, () => { arrived = true; }, () => opens++), true);
  for (; frame < 360 && !arrived; frame++) {
    if (frame === 60) {
      const { x, z, to } = routine.pose, dx = to.x - x, dz = to.z - z, length = Math.hypot(dx, dz);
      routine.setContext({ pet: { x: x + dx / length * .85, z: z + dz / length * .85, yaw: 0, state: 'sleeping', moving: false, held: false } });
    }
    routine.update(1 / 60, false);
  }
  assert.equal(opens, 1, 'the route detour still opens the door exactly once');
  assert.equal(arrived, true, 'the re-planned path still reaches the door');
  assert.equal(frame, Math.ceil(DOOR_TRIP_SECONDS * 60), 'a pet detour keeps the original arrival time');
});
test('a paused break can redirect its current walk to a door, and cancelling a door trip returns safely to the desk', () => {
  const layout = createLayout('writers-loft'), link = { id: 'garden', built: true, upstairs: false, z: 2.35 };
  const routine = createCompanionRoutine(() => {});
  routine.setLayout(layout); routine.setIntent('break'); advance(routine, 1.1);
  let reached = false;
  assert.equal(routine.walkToDoor(link, () => { reached = true; }), true, 'a moving companion can choose the door');
  const before = { x: routine.pose.x, z: routine.pose.z };
  advance(routine, .6);
  assert.notDeepEqual({ x: routine.pose.x, z: routine.pose.z }, before);
  assert.equal(routine.cancelDoorWalk({ returnToDesk: true }), true);
  assert.equal(routine.pose.atDesk, true); assert.equal(routine.pose.moving, false);
  advance(routine, 2); assert.equal(reached, false, 'cancellation never transitions rooms');
});
test('starting focus during a door walk cancels the trip and reports that no room change occurred', () => {
  const routine = createCompanionRoutine(() => {}), layout = createLayout('writers-loft');
  routine.setLayout(layout); routine.setIntent('idle');
  let result = null;
  assert.equal(routine.walkToDoor({ id: 'garden', built: true, upstairs: false, z: 2.35 }, value => { result = value; }), true);
  advance(routine, .5);
  routine.setIntent('working');
  assert.deepEqual(result, { cancelled: true });
  assert.equal(routine.pose.atDesk, true); assert.equal(routine.pose.moving, false);
  advance(routine, 2); assert.deepEqual(result, { cancelled: true }, 'the cancelled walk cannot arrive later');
});
test('entering edit mode during a door walk cancels the pending arrival and unlocks the next trip', () => {
  const routine = createCompanionRoutine(() => {}), layout = createLayout('writers-loft');
  routine.setLayout(layout); routine.setIntent('idle');
  let result = null, openings = 0, arrivals = 0;
  const garden = { id: 'garden', built: true, upstairs: false, z: 2.35 };
  assert.equal(routine.walkToDoor(garden, value => { result = value; }, () => openings++), true);
  advance(routine, .5);
  routine.setEditing(true);
  assert.deepEqual(result, { cancelled: true });
  assert.equal(routine.pose.atDesk, true); assert.equal(routine.pose.moving, false);
  advance(routine, 5);
  assert.deepEqual(result, { cancelled: true }, 'the edited trip cannot arrive after it was cancelled');
  assert.equal(openings, 0, 'a cancelled approach never opens its door');
  routine.setEditing(false);
  assert.equal(routine.walkToDoor(garden, () => arrivals++), true, 'editing releases the pending-door lock');
  routine.cancelDoorWalk(); advance(routine, 5);
  assert.equal(arrivals, 0, 'cancelling the replacement trip does not call it later');
});
test('reduced motion completes a door walk without leaving the companion or callback in a traveling state', () => {
  const routine = createCompanionRoutine(() => {}), layout = createLayout('writers-loft');
  routine.setLayout(layout); routine.setIntent('idle');
  let reached = 0;
  assert.equal(routine.walkToDoor({ id: 'garden', built: true, upstairs: false, z: 2.35 }, () => reached++), true);
  routine.update(1 / 60, true);
  assert.equal(reached, 1); assert.equal(routine.pose.state, 'at-door'); assert.equal(routine.pose.moving, false);
});
test('breaks do one thing in the room, settle on a seat, doze, and resume working at the original desk', () => {
  const changes = [], routine = createCompanionRoutine(value => changes.push(value.state), { random: () => 0.5 });
  routine.setLayout(createLayout('writers-loft')); routine.setIntent('working');
  assert.equal(routine.pose.state, 'working'); assert.equal(routine.pose.atDesk, true);
  routine.setIntent('break'); assert.equal(routine.pose.state, 'walking');
  const first = { x: routine.pose.x, z: routine.pose.z }; advance(routine, 2);
  assert.notDeepEqual({ x: routine.pose.x, z: routine.pose.z }, first);
  assert.equal(until(routine, 'busy', 30), 'busy'); assert.ok(ACTIVITIES[routine.pose.activity]); assert.equal(routine.pose.sit, 0, 'an activity is done standing');
  assert.equal(until(routine, 'resting', 60), 'resting'); assert.equal(routine.pose.atDesk, false); assert.equal(routine.pose.sit, 1);
  // Seated, it tells the pet where its feet and its way out are.
  assert.ok(routine.pose.seated && routine.pose.portal, 'seated, with a way out');
  const friends = petSpots(createLayout('writers-loft'), { companion: routine.pose }).filter(spot => spot.kind === 'friend');
  assert.ok(friends.length >= 1 && friends.every(spot => Math.hypot(spot.x - routine.pose.portal.x, spot.z - routine.pose.portal.z) > 0.65), 'the pet can curl up at its feet, clear of its way out');
  advance(routine, DOZE_AFTER + 2.5); assert.equal(routine.pose.state, 'sleeping'); assert.equal(routine.pose.doze, 1);
  routine.setIntent('working'); assert.equal(routine.pose.state, 'returning');
  advance(routine, 20); assert.equal(routine.pose.state, 'working'); assert.equal(routine.pose.atDesk, true);
  assert.deepEqual(changes, ['working', 'walking', 'busy', 'walking', 'resting', 'sleeping', 'returning', 'working']);
});
test('every design offers break activities the companion can reach, each facing its piece', () => {
  for (const preset of PRESETS) {
    const layout = createLayout(preset.id), obstacles = navigationObstacles(layout), pet = { x: 0.75, z: 1.5, yaw: 0, state: 'sleeping', moving: false };
    const spots = activitySpots(layout, { night: false, windowX: -2.7, pet });
    const reached = spots.filter(spot => planActivityTrip(layout, null, spot));
    assert.ok(new Set(reached.map(spot => spot.kind)).size >= 3, `${preset.id}: ${reached.map(spot => spot.kind)}`);
    assert.ok(planCompanionTrip(layout, null, false, ['lounge-chair']), `${preset.id}: the reading chair can be reached, past its tea table`);
    for (const spot of spots) {
      assert.ok(walkable(spot, obstacles), `${preset.id} ${spot.kind} stands on clear floor`);
      // The record player sits toward one end of its cabinet; at the hearth
      // the companion faces the fire straight on.
      const item = layout.items.find(entry => entry.id === spot.itemId), target = spot.kind === 'record' ? localPoint(item, -0.25, 0) : item || (spot.kind === 'pet' ? pet : { x: spot.x, z: -10 });
      const toward = spot.kind === 'warm' ? item.rotation * Math.PI / 2 : Math.atan2(-(target.x - spot.x), -(target.z - spot.z));
      assert.ok(Math.abs(Math.atan2(Math.sin(toward - spot.yaw), Math.cos(toward - spot.yaw))) < 1e-6, `${preset.id} ${spot.kind} faces its piece`);
    }
    // A switched-off fire is no place to warm up; a walking pet is not petted.
    const cold = structuredClone(layout); for (const item of cold.items) if (item.type === 'fireplace') item.off = true;
    assert.ok(!activitySpots(cold).some(spot => spot.kind === 'warm'));
    assert.ok(!activitySpots(layout, { pet: { ...pet, moving: true } }).some(spot => spot.kind === 'pet'));
  }
});
test('the companion waters the Swiss cheese plant too, facing it', () => {
  const layout = createLayout('writers-loft'), monstera = { id: 'test-monstera', type: 'monstera', x: -1, z: 1, rotation: 0 };
  // Whatever a design puts on this spot makes way, so only the plant is tested.
  layout.items = layout.items.filter(item => validatePlacement([item], monstera).valid);
  assert.ok(validatePlacement(layout.items, monstera).valid, 'the plant stands on free floor');
  layout.items.push(monstera);
  const spot = activitySpots(layout).find(entry => entry.kind === 'water' && entry.itemId === monstera.id);
  assert.ok(spot && planActivityTrip(layout, null, spot), 'the companion can walk to it with the watering can');
  const toward = Math.atan2(-(monstera.x - spot.x), -(monstera.z - spot.z));
  assert.ok(Math.abs(Math.atan2(Math.sin(toward - spot.yaw), Math.cos(toward - spot.yaw))) < 1e-6);
});
test('at night an unlit lamp comes first: the companion switches it on once, then sits', () => {
  // The library's lamp stands in a corner that furniture closes off; the
  // greenhouse lamp is in the open.
  const layout = createLayout('moonlit-greenhouse'), lamp = layout.items.find(item => item.type === 'floor-lamp');
  lamp.off = true;
  assert.ok(activitySpots(layout, { night: true }).some(spot => spot.kind === 'lamp'), 'an unlit lamp is an activity at night');
  assert.ok(!activitySpots(layout, { night: false }).some(spot => spot.kind === 'lamp'), 'but not by day');
  const uses = [], routine = createCompanionRoutine(() => {}, { onUse: use => uses.push({ ...use, at: routine.pose.activityTime }) });
  routine.setLayout(layout); routine.setContext({ night: true }); routine.setIntent('break');
  assert.equal(until(routine, 'busy', 40), 'busy'); assert.equal(routine.pose.activity, 'lamp');
  assert.equal(until(routine, 'walking', 20), 'walking');
  assert.equal(uses.length, 1); assert.equal(uses[0].kind, 'lamp'); assert.equal(uses[0].itemId, lamp.id);
  assert.ok(Math.abs(uses[0].at - ACTIVITIES.lamp.useAt) < 0.05, 'the switch clicks at its moment');
  assert.equal(until(routine, 'resting', 40), 'resting');
  assert.equal(uses.length, 1, 'nothing else is used');
  // Switched off again on purpose, the lamp stays off for the rest of the visit.
  lamp.off = true; routine.setIntent('working'); assert.equal(until(routine, 'working', 40), 'working');
  routine.setIntent('break'); for (let i = 0; i < 60 * 60 && routine.pose.state !== 'resting'; i++) { routine.update(1 / 60, false); assert.notEqual(routine.pose.activity, 'lamp'); }
  assert.equal(uses.filter(use => use.kind === 'lamp').length, 1, 'no second switch-on');
});
test('a visit goes through every activity the room offers before it repeats one', () => {
  const layout = createLayout('writers-loft'), routine = createCompanionRoutine(() => {}, { random: seeded(3) }), kinds = [];
  routine.setLayout(layout); routine.setContext({ windowX: -2.7, pet: { x: 0.75, z: 1.5, yaw: 0, state: 'sleeping', moving: false, held: false } });
  for (let i = 0; i < 6; i++) {
    routine.setIntent('working'); until(routine, 'working', 60); routine.setIntent('break');
    for (let j = 0; j < 60 * 60 && !['busy', 'resting'].includes(routine.pose.state); j++) routine.update(1 / 60, false);
    kinds.push(routine.pose.activity);
  }
  const first = kinds.slice(0, new Set(kinds).size);
  assert.equal(new Set(first).size, first.length, `no repeat before every choice is used: ${kinds}`);
  assert.ok(new Set(kinds).size >= 3, `${kinds}`);
});
test('a night break reaches an unlit lamp from whichever side is open', () => {
  // The Cloud loft lamp stands in a corner: only its back side can be reached.
  const layout = createLayout('cloud-loft'), lamp = layout.items.find(item => item.type === 'floor-lamp'); lamp.off = true;
  const routine = createCompanionRoutine(() => {}, { random: () => 0.5 }); routine.setLayout(layout); routine.setContext({ night: true }); routine.setIntent('break');
  assert.equal(routine.pose.goal, 'lamp'); assert.equal(until(routine, 'busy', 40), 'busy'); assert.equal(routine.pose.activity, 'lamp');
});
test('activity spots keep clear of a still pet', () => {
  const layout = createLayout('writers-loft'), fire = layout.items.find(item => item.type === 'fireplace');
  const warm = activitySpots(layout).find(spot => spot.kind === 'warm');
  assert.ok(warm, 'the loft hearth has a warm spot');
  const pet = { x: warm.x + 0.2, z: warm.z, yaw: 0, state: 'sitting', moving: false, held: false };
  const beside = activitySpots(layout, { pet }).find(spot => spot.kind === 'warm' && spot.itemId === fire.id);
  assert.ok(beside && Math.hypot(beside.x - pet.x, beside.z - pet.z) > 0.6, 'no warming up on top of the pet: the companion stands beside it at the hearth');
  assert.ok(activitySpots(layout, { pet: { ...pet, held: true } }).some(spot => spot.kind === 'warm'), 'a carried pet is no bother');
});
test('resuming focus during an activity walks straight back to the desk, without a rise', () => {
  const routine = createCompanionRoutine(() => {}, { random: () => 0.5 }); routine.setLayout(createLayout('ember-library')); routine.setIntent('break');
  assert.equal(until(routine, 'busy', 40), 'busy'); advance(routine, 1);
  routine.setIntent('working'); assert.equal(routine.pose.state, 'returning'); assert.equal(routine.pose.activity, null);
  let lowest = 1; for (let i = 0; i < 60 && routine.pose.state === 'returning'; i++) { routine.update(1 / 60, false); lowest = Math.min(lowest, routine.pose.sit); }
  assert.equal(lowest, 0, 'standing, it never dips into a seated pose on the way');
  assert.equal(until(routine, 'working', 40), 'working'); assert.equal(routine.pose.atDesk, true);
  // The next break is a new break with its own activity.
  routine.setIntent('break'); assert.equal(until(routine, 'busy', 40), 'busy');
});
test('the armchair is for reading; reduced motion skips standing activities', () => {
  const layout = createLayout('ember-library'), chair = layout.items.find(item => item.type === 'lounge-chair');
  assert.ok(chair, 'the library has an armchair');
  const reading = planCompanionTrip(layout, null, false, ['lounge-chair']);
  assert.ok(reading && reading.end.itemId === chair.id);
  const routine = createCompanionRoutine(() => {}, { random: () => 0.5 }); routine.setLayout(layout);
  routine.update(0, true); routine.setIntent('break');
  const seen = new Set(); for (let i = 0; i < 20; i++) { routine.update(0, true); seen.add(routine.pose.state); }
  assert.ok(!seen.has('busy'), 'reduced motion never stands at an activity');
  assert.equal(routine.pose.state, 'resting');
  assert.equal(routine.pose.activity, routine.diagnostics().destination === chair.id ? 'read' : null, 'only the armchair reads');
  // With motion, the reading chair is one of the choices, and there the companion reads.
  const reader = createCompanionRoutine(() => {}, { random: () => 0.99 }), onlyChair = { ...layout, items: layout.items.filter(item => !['fireplace', 'plant', 'moon-tree', 'low-cabinet', 'daybed', 'ottoman'].includes(item.type)) };
  reader.setLayout(onlyChair); reader.setContext({ windowX: 40 }); reader.setIntent('break');
  assert.equal(until(reader, 'resting', 40), 'resting'); assert.equal(reader.pose.activity, 'read');
});
test('a pet that gets up ends the fuss early; a moved piece sends a busy companion on', () => {
  const layout = createLayout('ember-library'), pet = { x: 0.75, z: 1.5, yaw: 0, state: 'sleeping', moving: false, held: false };
  const onlyPet = { ...layout, items: layout.items.filter(item => !['fireplace', 'plant', 'moon-tree', 'low-cabinet', 'lounge-chair'].includes(item.type)) };
  const uses = [], routine = createCompanionRoutine(() => {}, { onUse: use => uses.push(use.kind) });
  routine.setLayout(onlyPet); routine.setContext({ pet, windowX: 40 }); routine.setIntent('break');
  assert.equal(until(routine, 'busy', 40), 'busy'); assert.equal(routine.pose.activity, 'pet');
  advance(routine, 2); assert.deepEqual(uses, ['pet'], 'the companion pets it once');
  pet.moving = true; routine.update(1 / 60, false); assert.equal(routine.pose.state, 'walking', 'the pet walked off, so the companion moves on');
  // Busy at the fire: an unrelated move keeps it there; moving the fire does not.
  const fire = createLayout('ember-library'), warm = createCompanionRoutine(() => {}, { random: () => 0.5 });
  const onlyFire = { ...fire, items: fire.items.filter(item => !['plant', 'moon-tree', 'low-cabinet', 'lounge-chair'].includes(item.type)) };
  warm.setLayout(onlyFire); warm.setContext({ windowX: 40 }); warm.setIntent('break');
  assert.equal(until(warm, 'busy', 40), 'busy'); assert.equal(warm.pose.activity, 'warm');
  const spot = { x: warm.pose.x, z: warm.pose.z }, moved = structuredClone(onlyFire), other = moved.items.find(item => item.type === 'daybed'); other.x += other.x > 0 ? -0.2 : 0.2;
  warm.setLayout(moved); assert.equal(warm.pose.state, 'busy'); assert.deepEqual({ x: warm.pose.x, z: warm.pose.z }, spot);
  const shifted = structuredClone(moved); shifted.items.find(item => item.type === 'fireplace').x += 0.4;
  warm.setLayout(shifted); assert.equal(warm.pose.state, 'walking'); assert.equal(warm.pose.activity, null);
  // A layout with only a switch changed (a reset, or another tab) is read
  // without a new plan: the companion sees that a lamp is now lit.
  const lit = createCompanionRoutine(() => {}, { random: () => 0.5 }), dark = createLayout('moonlit-greenhouse');
  dark.items.find(item => item.type === 'floor-lamp').off = true;
  lit.setLayout(dark); lit.setContext({ night: true }); lit.setIntent('working');
  const relit = structuredClone(dark); delete relit.items.find(item => item.type === 'floor-lamp').off;
  lit.useLayout(relit); lit.setIntent('break');
  assert.equal(until(lit, 'busy', 40), 'busy'); assert.notEqual(lit.pose.activity, 'lamp', 'no walk to a lamp that is already lit');
  // A fire switched off (a tap changes the live layout in place) ends the warming.
  const cold = createCompanionRoutine(() => {}, { random: () => 0.5 }), hearth = structuredClone(onlyFire);
  cold.setLayout(hearth); cold.setContext({ windowX: 40 }); cold.setIntent('break');
  assert.equal(until(cold, 'busy', 40), 'busy'); advance(cold, 1); assert.equal(cold.pose.state, 'busy');
  hearth.items.find(item => item.type === 'fireplace').off = true; cold.update(1 / 60, false);
  assert.equal(cold.pose.state, 'walking', 'no warming up at a cold hearth');
});
test('resuming mid-walk replans from the current position and repeated intent does not restart trips', () => {
  const routine = createCompanionRoutine(); routine.setLayout(createLayout()); routine.setIntent('break'); advance(routine, 3);
  const before = { x: routine.pose.x, z: routine.pose.z };
  routine.setIntent('break'); assert.deepEqual({ x: routine.pose.x, z: routine.pose.z }, before);
  routine.setIntent('working'); assert.deepEqual({ x: routine.pose.x, z: routine.pose.z }, before, 'changing intent does not teleport');
  advance(routine, 20); assert.equal(routine.pose.state, 'working');
  routine.setIntent('break'); advance(routine, 2); routine.setIntent('working'); advance(routine, 1); routine.setIntent('break');
  assert.equal(until(routine, 'resting', 60), 'resting');
});
test('missing or blocked seating rests at the desk, and a missing sofa cannot strand the avatar', () => {
  const layout = createLayout(), desk = layout.items.find(i => i.id === layout.activeDeskId), routine = createCompanionRoutine();
  routine.setLayout({ ...layout, items: [desk] }); routine.setIntent('break');
  // It may look out of the window first; then, with no seat, it rests at the desk.
  assert.equal(until(routine, 'resting-at-desk', 60), 'resting-at-desk'); assert.equal(routine.pose.atDesk, true);
  const blocked = { ...layout, items: [...layout.items, { id: 'block-exit', type: 'daybed', x: desk.x, z: desk.z + 1.6, rotation: 0 }] };
  assert.equal(planCompanionTrip(blocked, null, false), null, 'an obstructed chair exit never starts a trip');
  routine.setLayout(layout); advance(routine, 20); assert.equal(routine.pose.atDesk, false);
  routine.setLayout({ ...layout, items: [desk] }); assert.equal(routine.pose.atDesk, true);
  routine.setIntent('working'); assert.equal(routine.pose.state, 'working');
});
test('editing and reduced motion settle deterministically without changing timer or layout data', () => {
  const layout = createLayout(), routine = createCompanionRoutine(); routine.setLayout(layout); routine.setIntent('break'); advance(routine, 2);
  routine.setEditing(true); assert.equal(routine.pose.atDesk, true); const editPose = { ...routine.pose }; advance(routine, 10); assert.deepEqual(routine.pose, editPose);
  routine.setEditing(false); routine.update(0, true); assert.equal(routine.pose.state, 'resting');
  const rest = { ...routine.pose }; advance(routine, 80, true); assert.deepEqual(routine.pose, rest);
  routine.setIntent('working'); routine.update(0, true); assert.equal(routine.pose.state, 'working'); assert.equal(routine.pose.atDesk, true);
});
test('walking and seated poses reuse two body/head meshes with grounded feet and finite normals', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const avatar = createMobileCompanion(scene), body = scene.getMeshByName('companion-articulated-body');
    const meshes = scene.meshes.length, materials = scene.materials.length, geometry = body.geometry;
    assert.equal(avatar.root.getChildMeshes().length, 5, 'body, head, one small sleep-letter batch, a book and a watering can');
    const pose = { atDesk: false, x: 0, z: 0, yaw: 0, sit: 0, seatHeight: .80, doze: 0, step: 0, moving: true };
    for (let i = 0; i < 150; i++) {
      pose.step = i * .1; pose.sit = i < 70 ? 0 : Math.min(1, (i - 70) / 30); pose.doze = i > 100 ? 1 : 0;
      avatar.animate(pose, i / 60, false);
      const positions = body.getVerticesData('position'), normals = body.getVerticesData('normal');
      for (let j = 0; j < positions.length; j++) assert.ok(Number.isFinite(positions[j]) && Number.isFinite(normals[j]));
      for (let j = 1; j < positions.length; j += 3) assert.ok(positions[j] >= -.0001, 'feet remain above the floor');
    }
    assert.equal(body.geometry, geometry); assert.equal(scene.meshes.length, meshes); assert.equal(scene.materials.length, materials);
    assert.ok(avatar.root.getChildMeshes().every(mesh => !mesh.isPickable && !mesh.receiveShadows && mesh.metadata.castShadow === false));
    avatar.animate(pose, 5, true); const still = Array.from(body.getVerticesData('position'));
    avatar.animate(pose, 25, true); assert.deepEqual(Array.from(body.getVerticesData('position')), still);
    // Every break activity: grounded, finite, the right prop only, hands
    // where they reach, and no new meshes.
    // The spots put each target about 0.55 in front of the companion.
    const reaches = { record: { x: 0, z: -0.52, y: 1.05 }, lamp: { x: 0.05, z: -0.55, y: 1.5 }, pet: { x: 0.05, z: -0.55, y: 0.4 } };
    for (const activity of ['warm', 'window', 'water', 'record', 'pet', 'lamp', 'read']) {
      Object.assign(pose, { moving: false, sit: activity === 'read' ? 1 : 0, doze: 0, activity, activityTime: 0, useAt: 1.6, reach: reaches[activity] ? { ...reaches[activity] } : null });
      for (let i = 0; i < 90; i++) {
        pose.activityTime = i / 30; avatar.animate(pose, 30 + i / 30, false);
        const positions = body.getVerticesData('position'), normals = body.getVerticesData('normal');
        for (let j = 0; j < positions.length; j++) assert.ok(Number.isFinite(positions[j]) && Number.isFinite(normals[j]), activity);
        for (let j = 1; j < positions.length; j += 3) assert.ok(positions[j] >= -.0001, `${activity}: feet and knees stay above the floor`);
      }
      assert.equal(avatar.book.isEnabled(), activity === 'read', `${activity}: book`); assert.equal(avatar.can.isEnabled(), activity === 'water', `${activity}: can`);
      if (reaches[activity]) {
        // The right hand ends within a few centimetres of what it touches.
        const joints = body.metadata.rig.joints, hand = joints.wristR, goal = reaches[activity];
        pose.activityTime = 4; avatar.animate(pose, 40, true);
        assert.ok(Math.hypot(hand.x - goal.x, hand.y - goal.y, hand.z - goal.z) < 0.06, `${activity}: the hand reaches ${JSON.stringify(goal)}, at ${hand.x.toFixed(2)},${hand.y.toFixed(2)},${hand.z.toFixed(2)}`);
      }
    }
    assert.equal(scene.meshes.length, meshes); assert.equal(scene.materials.length, materials);
    pose.activity = null; for (let i = 0; i < 60; i++) avatar.animate(pose, 50 + i / 30, false);
    assert.ok(!avatar.book.isEnabled() && !avatar.can.isEnabled(), 'props go away with their activity');
    pose.atDesk = true; avatar.animate(pose, 26, false); assert.equal(avatar.root.isEnabled(), false); assert.equal(avatar.contact.isEnabled(), false);
  } finally { disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); }
});

test('a piece or a pet on a rug raises the point that the hand reaches for', () => {
  const desk = { id: 'desk', type: 'study-desk', x: -2, z: -3, rotation: 0 }, cabinet = { id: 'cabinet', type: 'low-cabinet', x: 1.5, z: 0, rotation: 0 };
  const lamp = { id: 'lamp', type: 'floor-lamp', x: 3, z: 0, rotation: 0, off: true }, rug = { id: 'rug', type: 'rug', x: 2, z: 0.5, rotation: 0 }, field = 0.0515;
  const reaches = (items, pet, floor) => Object.fromEntries(activitySpots({ presetId: null, items, activeDeskId: desk.id }, { night: true, pet, floor }).filter(spot => spot.reach).map(spot => {
    assert.ok(Math.abs(spot.reach.y - { record: 1.05, lamp: 1.5, pet: 0.4 }[spot.kind] - spot.reach.lift) < 1e-9, `${spot.kind}: the reach says how high its piece stands`);
    return [spot.kind, spot.reach.y];
  }));
  const near = (value, goal, label) => assert.ok(Math.abs(value - goal) < 1e-9, `${label}: ${value}, not ${goal}`);
  // The cabinet, the lamp and the sitting pet all stand on the rug's field.
  const onFloor = { x: 2, z: 1, yaw: 0, state: 'sitting', moving: false, held: false }, bed = { id: 'pet-bed', type: 'pet-bed', x: -3.5, z: 2, rotation: 0 };
  const low = reaches([desk, cabinet, lamp, bed], onFloor), high = reaches([desk, rug, cabinet, lamp, bed], onFloor);
  assert.deepEqual(Object.keys(high).sort(), ['lamp', 'pet', 'record']);
  near(high.record, low.record + field, 'the record player'); near(high.lamp, low.lamp + field, 'the lamp switch'); near(high.pet, low.pet + field, 'the pet');
  // A pet asleep in its bed is as high as the bed stands.
  const inBed = { ...onFloor, state: 'sleeping' }, raisedBed = { ...bed, x: 2, z: 1 };
  near(reaches([desk, rug, cabinet, lamp, raisedBed], inBed).pet, reaches([desk, cabinet, lamp, raisedBed], inBed).pet + field, 'the pet in a raised bed');
  // On the sakura tatami the rugs lie 7.5 mm higher (see rugStack), and so does a pet on bare tatami.
  const tatami = reaches([desk, rug, cabinet, lamp, bed], onFloor, 0.2275);
  near(tatami.record, high.record + 0.0075, 'the record player on the tatami'); near(tatami.lamp, high.lamp + 0.0075, 'the lamp switch on the tatami'); near(tatami.pet, high.pet + 0.0075, 'the pet on the tatami');
  near(reaches([desk, cabinet, lamp, bed], onFloor, 0.2275).pet, low.pet + 0.0075, 'the pet on bare tatami');
});
test('from the floor or a rug, the right hand reaches a record, switch or pet as well as on bare floor', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const avatar = createMobileCompanion(scene), body = scene.getMeshByName('companion-articulated-body'), hand = body.metadata.rig.joints.wristR;
    const targets = { record: { x: 0, z: -0.52, y: 1.05 }, lamp: { x: 0.05, z: -0.55, y: 1.5 }, pet: { x: 0.05, z: -0.55, y: 0.4 } };
    // The joints are in the companion's own space; the goal counts from the floor.
    const miss = (activity, ground, lift) => {
      const goal = { ...targets[activity], y: targets[activity].y + lift, lift };
      avatar.animate({ atDesk: false, x: 0, z: 0, yaw: 0, sit: 0, seatHeight: .80, doze: 0, step: 0, moving: false, activity, activityTime: 4, useAt: 1.6, reach: goal }, 40, true, ground);
      assert.equal(avatar.root.position.y, ground, 'the companion stands where it is told');
      const positions = body.getVerticesData('position');
      for (let j = 1; j < positions.length; j += 3) assert.ok(positions[j] >= -.0001, `${activity}: feet and knees stay above the ground`);
      return Math.hypot(hand.x - goal.x, ground + hand.y - (0.22 + goal.y), hand.z - goal.z);
    };
    for (const activity of Object.keys(targets)) {
      const bare = miss(activity, 0.22, 0);
      assert.ok(bare < 0.06, `${activity}: the hand reaches on bare floor (${bare.toFixed(3)})`);
      // Standing higher than the piece, the knees bend; lower, the arm reaches up.
      for (const ground of [0.22, 0.22 + 0.0515, 0.22 + 0.08]) for (const lift of [0, 0.0515, 0.08]) {
        const off = miss(activity, ground, lift);
        assert.ok(off < bare + 0.002, `${activity}, the piece ${lift} and the companion ${(ground - 0.22).toFixed(4)} above the floor: the hand is ${off.toFixed(3)} away, ${bare.toFixed(3)} on bare floor`);
      }
    }
  } finally { disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); }
});
test('a layout change elsewhere leaves a resting companion on its seat', () => {
  const layout = createLayout('ember-library'), routine = createCompanionRoutine();
  routine.setLayout(layout); routine.setIntent('break'); advance(routine, 40);
  const rested = { ...routine.pose }, seatId = routine.diagnostics().destination;
  assert.equal(rested.atDesk, false); assert.ok(['resting', 'sleeping'].includes(rested.state));
  // Move the piece farthest from the seat, as another tab might.
  const moved = structuredClone(layout), seat = moved.items.find(item => item.id === seatId);
  const far = moved.items.filter(item => item.id !== seatId && item.id !== moved.activeDeskId).sort((a, b) => Math.hypot(b.x - seat.x, b.z - seat.z) - Math.hypot(a.x - seat.x, a.z - seat.z))[0];
  far.x += far.x > 0 ? -0.25 : 0.25;
  routine.setLayout(moved);
  assert.equal(routine.pose.atDesk, false, 'no jump back to the desk');
  assert.deepEqual([routine.pose.x, routine.pose.z, routine.pose.state], [rested.x, rested.z, rested.state], 'the companion keeps its seat, pose and doze');
  // Moving the seat itself still sends the companion back to settle again.
  const seatMoved = structuredClone(moved); seatMoved.items.find(item => item.id === seatId).x += 0.5;
  routine.setLayout(seatMoved);
  assert.notDeepEqual([routine.pose.x, routine.pose.z], [rested.x, rested.z]);
});
