import test from 'node:test';
import assert from 'node:assert/strict';
import * as movement from './movement.js';

const { createMovementState, stepMovement, obstacleRadiusBetween } = movement;

const flat = { surfaceAt: () => ({ height: 0, normal: { x: 0, y: 1, z: 0 } }), obstacles: [], bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 } };
const start = options => createMovementState({ position: { x: 0, y: 0, z: 0 }, ...options });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < .000001, `${actual} should equal ${expected}`);

test('walking is camera relative, normalizes diagonal input and leaves the prior state untouched', () => {
  const original = start(), before = structuredClone(original);
  const north = stepMovement(original, { forward: 1, cameraYaw: 0 }, flat, 1000, 1000).state;
  close(north.position.z, -4.8);
  close(north.position.x, 0);
  close(north.speed, 4.8);
  assert.equal(north.action, 'walk');
  const west = stepMovement(original, { forward: 1, cameraYaw: Math.PI / 2 }, flat, 1000, 1000).state;
  close(west.position.x, -4.8);
  close(west.position.z, 0);
  const diagonal = stepMovement(original, { forward: 1, strafe: 1, cameraYaw: 0 }, flat, 1000, 1000).state;
  close(diagonal.position.x, 3.394112549695428);
  close(diagonal.position.z, -3.394112549695428);
  close(diagonal.yaw, -Math.PI / 4);
  assert.deepEqual(original, before);
});

test('sprinting spends fourteen stamina per second and recovery starts after six hundred milliseconds', () => {
  const running = stepMovement(start(), { forward: 1, sprint: true }, flat, 1000, 1000).state;
  close(running.position.z, -8.5);
  close(running.stamina, 86);
  assert.equal(running.action, 'run');
  const waiting = stepMovement(running, {}, flat, 600, 1600).state;
  close(waiting.stamina, 86);
  close(waiting.speed, 0);
  assert.equal(waiting.action, 'idle');
  const recovered = stepMovement(waiting, {}, flat, 500, 2100).state;
  close(recovered.stamina, 97);
  close(stepMovement(recovered, {}, flat, 1000, 3100).state.stamina, 100);
});

test('exhausted sprint keeps walking while held, and a released sprint can start again', () => {
  const result = stepMovement(start({ stamina: 7 }), { forward: 1, sprint: true }, flat, 1000, 1000);
  close(result.state.position.z, -6.65);
  close(result.state.stamina, 0);
  assert.equal(result.state.action, 'walk');
  assert.deepEqual(result.events, [{ type: 'exhausted', activity: 'sprint' }]);
  const holding = stepMovement(result.state, { forward: 1, sprint: true }, flat, 1000, 2000).state;
  close(holding.position.z, -11.45);
  close(holding.stamina, 19.8);
  const released = stepMovement(holding, {}, flat, 100, 2100).state;
  const restarted = stepMovement(released, { forward: 1, sprint: true }, flat, 100, 2200).state;
  assert.equal(restarted.action, 'run');
  close(restarted.stamina, 20.6);
});

test('jump follows seven metres per second and gravity twenty, then lands once without held-key repeats', () => {
  const airborne = stepMovement(start(), { jump: true }, flat, 1300 / 3, 1300 / 3);
  close(airborne.state.position.y, 1.225);
  close(airborne.state.velocity.y, 0);
  assert.equal(airborne.state.grounded, false);
  assert.deepEqual(airborne.events, [{ type: 'jump' }]);
  const landed = stepMovement(airborne.state, { jump: true }, flat, 400, 2500 / 3);
  close(landed.state.position.y, 0);
  assert.equal(landed.state.grounded, true);
  assert.equal(landed.state.action, 'land');
  assert.equal(landed.events.filter(event => event.type === 'land').length, 1);
  assert.equal(landed.events.filter(event => event.type === 'jump').length, 0);
  const holding = stepMovement(landed.state, { jump: true }, flat, 1000, 5500 / 3).state;
  assert.equal(holding.action, 'idle');
  close(holding.position.y, 0);
  const released = stepMovement(holding, {}, flat, 10, 5530 / 3).state;
  assert.equal(stepMovement(released, { jump: true }, flat, 10, 5560 / 3).state.action, 'jump');
});

test('rendered triangle height grounds the player while a steep ascent is rejected', () => {
  const slope = { ...flat, surfaceAt: (x, z) => ({ height: -z * .25, normal: { x: 0, y: .9701425001453319, z: .24253562503633297 } }) };
  const climbed = stepMovement(start(), { forward: 1 }, slope, 1000, 1000).state;
  close(climbed.position.z, -4.8);
  close(climbed.position.y, 1.2);
  const steep = { ...flat, surfaceAt: (x, z) => ({ height: -z * 2, normal: { x: 0, y: .4472135954999579, z: .8944271909999159 } }) };
  const blocked = stepMovement(start(), { forward: 1 }, steep, 1000, 1000).state;
  close(blocked.position.z, 0);
  close(blocked.position.y, 0);
  assert.equal(blocked.action, 'idle');
});

test('landing holds the authored one-third-second clip and new movement or jump interrupts it immediately', () => {
  const airborne = { ...start({ position: { x: 0, y: .0001, z: 0 } }), mode: 'airborne', grounded: false };
  const landed = stepMovement(airborne, {}, flat, 8, 8).state;
  assert.equal(landed.action, 'land');
  close(landed.position.y, 0);
  const finishing = stepMovement(landed, {}, flat, 333, 341).state;
  assert.equal(finishing.action, 'land');
  close(finishing.position.y, 0);
  assert.equal(stepMovement(finishing, {}, flat, 1, 342).state.action, 'idle');
  const walking = stepMovement(landed, { forward: 1 }, flat, 10, 18).state;
  assert.equal(walking.action, 'walk');
  close(walking.position.z, -.048);
  const jumping = stepMovement(landed, { jump: true }, flat, 10, 18).state;
  assert.equal(jumping.action, 'jump');
  close(jumping.position.y, 0);
  assert.equal(jumping.grounded, true);
  close(jumping.actionTimeMs, 10);
});

test('small collision steps prevent tunneling through a trunk during a long sprint frame', () => {
  const world = { ...flat, obstacles: [{ x: 0, z: -2, radius: .5, baseY: 0, height: 6, climbable: false }] };
  const blocked = stepMovement(start(), { forward: 1, sprint: true }, world, 1000, 1000).state;
  close(blocked.position.z, -1.16);
  close(blocked.position.x, 0);
  close(blocked.speed, 0);
  const around = stepMovement(blocked, { strafe: 1, forward: 1, cameraYaw: 0 }, world, 1000, 2000).state;
  assert.ok(around.position.x > 3);
  assert.ok(around.position.z < -3);
});

test('a held climb mounts an explicit rock and its top continues to support the player', () => {
  const world = { ...flat, obstacles: [{ x: 0, z: -1, radius: .6, baseY: 0, height: 2, climbable: true }] };
  const rising = stepMovement(start(), { forward: 1, jump: true, climb: true }, world, 500, 500);
  close(rising.state.position.y, 1);
  close(rising.state.stamina, 90);
  close(rising.state.speed, 2);
  assert.equal(rising.state.action, 'climb');
  assert.deepEqual(rising.events, [{ type: 'climb-start' }]);
  const mounted = stepMovement(rising.state, { forward: 1, climb: true }, world, 795, 1295);
  close(mounted.state.position.y, 2);
  close(mounted.state.position.z, -.52);
  close(mounted.state.stamina, 74.1);
  assert.equal(mounted.state.grounded, true);
  assert.deepEqual(mounted.events, [{ type: 'climb-end' }]);
  const standing = stepMovement(mounted.state, {}, world, 500, 1795).state;
  close(standing.position.y, 2);
  assert.equal(standing.action, 'idle');
});

test('climbing exhaustion releases the face and lands rather than reattaching while Space is held', () => {
  const world = { ...flat, obstacles: [{ x: 0, z: -1, radius: .6, baseY: 0, height: 5, climbable: true }] };
  const exhausted = stepMovement(start({ stamina: 5 }), { forward: 1, climb: true }, world, 1000, 1000);
  close(exhausted.state.position.y, 0);
  assert.equal(exhausted.state.grounded, true);
  assert.equal(exhausted.events.filter(event => event.type === 'climb-start').length, 1);
  assert.equal(exhausted.events.filter(event => event.type === 'exhausted').length, 1);
  assert.equal(exhausted.events.filter(event => event.type === 'land').length, 1);
});

test('refreshing the nearby obstacle list does not switch the face during a climb', () => {
  const rock = { x: 0, z: -1, radius: .6, baseY: 0, height: 3, climbable: true };
  const tree = { x: 15, z: -1, radius: .5, baseY: 0, height: 12, climbable: false };
  const world = { ...flat, obstacles: [rock, tree] };
  const rising = stepMovement(start(), { forward: 1, climb: true }, world, 500, 500).state;
  close(rising.position.y, 1);
  world.obstacles = [tree, rock];
  const continued = stepMovement(rising, { forward: 1, climb: true }, world, 500, 1000);
  close(continued.state.position.y, 2);
  close(continued.state.speed, 2);
  assert.equal(continued.state.action, 'climb');
  assert.deepEqual(continued.events, []);
});

test('walking off a ledge falls, unavailable triangles block movement, and bounds include body radius', () => {
  const ledge = { ...flat, surfaceAt: (x, z) => ({ height: z < -.5 ? -3 : 0, normal: { x: 0, y: 1, z: 0 } }) };
  const falling = stepMovement(start(), { forward: 1 }, ledge, 300, 300).state;
  assert.equal(falling.action, 'fall');
  assert.equal(falling.grounded, false);
  assert.ok(falling.position.y < -.3 && falling.position.y > -.5);
  const missing = { ...flat, surfaceAt: (x, z) => z < -.5 ? null : { height: 0, normal: { x: 0, y: 1, z: 0 } } };
  const stopped = stepMovement(start(), { forward: 1 }, missing, 1000, 1000).state;
  close(stopped.position.z, -.48);
  close(stopped.position.y, 0);
  const bounded = stepMovement(start(), { forward: 1 }, { ...flat, bounds: { minX: -1, maxX: 1, minZ: -1, maxZ: 1 } }, 1000, 1000).state;
  close(bounded.position.z, -.66);
});

test('one second and sixty frame updates produce the same unobstructed movement and stamina', () => {
  const input = { forward: 1, sprint: true };
  const single = stepMovement(start(), input, flat, 1000, 1000).state;
  let framed = start();
  for (let frame = 1; frame <= 60; frame++) framed = stepMovement(framed, input, flat, 1000 / 60, frame * 1000 / 60).state;
  close(framed.position.z, -8.5);
  close(framed.stamina, 86);
  close(framed.position.z, single.position.z);
  close(framed.stamina, single.stamina);
});

test('profile radii interpolate in world height and include the widest part of the body interval', () => {
  const obstacle = { radius: 1, baseY: 10, radiusProfile: [{ height: 0, radius: 1.2 }, { height: 1, radius: 2 }, { height: 2, radius: 1 }] };
  close(obstacleRadiusBetween(obstacle, 10.5), 1.6);
  close(obstacleRadiusBetween(obstacle, 11.5), 1.5);
  close(obstacleRadiusBetween(obstacle, 10.5, 11.5), 2);
  close(obstacleRadiusBetween(obstacle, 11.5, 10.5), 2);
  close(obstacleRadiusBetween({ radius: .6, baseY: 10 }, 0, 30), .6);
});

test('walking and climbing follow a broad shoulder while the summit keeps its original support radius', () => {
  const obstacle = { x: 0, z: -4, radius: 1, baseY: 0, height: 3, climbable: true, radiusProfile: [{ height: 0, radius: 1.4 }, { height: 1, radius: 2 }, { height: 2, radius: 1.4 }, { height: 3, radius: 1.1 }] };
  const world = { ...flat, obstacles: [obstacle] };
  const stopped = stepMovement(start(), { forward: 1 }, world, 1000, 1000).state;
  close(stopped.position.z, -1.66);
  const rising = stepMovement(stopped, { forward: 1, climb: true }, world, 1000, 2000).state;
  close(rising.position.y, 2);
  close(rising.position.z, -2.26);
  assert.equal(rising.action, 'climb');
  const mounted = stepMovement(rising, { forward: 1, climb: true }, world, 995, 2995).state;
  close(mounted.position.y, 3);
  close(mounted.position.z, -3.575);
  assert.equal(mounted.grounded, true);
  const unsupported = start({ position: { x: 0, y: 3, z: -2.9 } });
  const falling = stepMovement(unsupported, {}, world, 20, 20).state;
  assert.equal(falling.grounded, false);
  assert.ok(falling.position.y < 3);
  assert.ok(falling.position.z > -2.56);
  const dropped = { ...start({ position: { x: 0, y: 2.5, z: -2.41 } }), mode: 'airborne', velocity: { x: 0, y: -3, z: 0 } };
  const descended = stepMovement(dropped, {}, world, 200, 200).state;
  close(descended.position.y, 1.5);
  assert.ok(descended.position.z >= -1.96 - 0.000001);
});

test('jump compression holds planted feet for five frames and synchronizes the seven-metre-per-second ascent', () => {
  const original = start(), before = structuredClone(original);
  const compressed = stepMovement(original, { jump: true, forward: 1 }, flat, 50, 50);
  assert.deepEqual(compressed.state.position, { x: 0, y: 0, z: 0 });
  assert.equal(compressed.state.grounded, true);
  assert.equal(compressed.state.action, 'jump');
  close(compressed.state.actionTimeMs, 50);
  assert.deepEqual(compressed.events, [{ type: 'jump' }]);
  assert.deepEqual(original, before);
  const liftoff = stepMovement(compressed.state, {}, flat, 100 / 3, 250 / 3).state;
  close(liftoff.position.y, 0);
  close(liftoff.velocity.y, 7);
  assert.equal(liftoff.grounded, false);
  close(liftoff.actionTimeMs, 250 / 3);
  const ascending = stepMovement(liftoff, {}, flat, 200, 850 / 3).state;
  close(ascending.position.y, 1);
  close(ascending.velocity.y, 3);
  close(ascending.actionTimeMs, 850 / 3);
  const apex = stepMovement(ascending, {}, flat, 150, 1300 / 3).state;
  close(apex.position.y, 1.225);
  close(apex.velocity.y, 0);
  assert.equal(apex.action, 'fall');
});

test('a zero-time movement call cannot consume a jump edge or progress an action', () => {
  const initial = start(), frozen = stepMovement(initial, { jump: true, forward: 1 }, flat, 0, 1000);
  assert.deepEqual(frozen.state, initial);
  assert.deepEqual(frozen.events, []);
  const compressed = stepMovement(frozen.state, { jump: true }, flat, 40, 1040).state;
  const still = stepMovement(compressed, {}, flat, 0, 4000).state;
  assert.deepEqual(still, compressed);
  const lifted = stepMovement(still, {}, flat, 60, 1100).state;
  close(lifted.position.y, .11388888888888889);
  close(lifted.actionTimeMs, 100);
});

test('mantle entry holds the root until the authored grip and ledge boot have settled', () => {
  const rock = { x: 0, z: -1, radius: .6, baseY: 0, height: 2, climbable: true }, world = { ...flat, obstacles: [rock] }, input = { forward: 1, climb: true };
  let state = stepMovement(start(), input, world, 725, 725).state;
  const anchor = { ...state.position };
  for (let elapsed = 20; elapsed <= 120; elapsed += 20) {
    state = stepMovement(state, input, world, 20, 725 + elapsed).state;
    assert.deepEqual(state.position, anchor);
    close(state.actionTimeMs, 0);
  }
  state = stepMovement(state, input, world, 20, 865).state;
  assert.ok(state.position.y > anchor.y);
  close(state.actionTimeMs, 20);
});

test('the standard mantle lifts before its inset and holds the authored settle while spending climb stamina', () => {
  const rock = { x: 0, z: -1, radius: .6, baseY: 0, height: 2, climbable: true }, world = { ...flat, obstacles: [rock] }, input = { forward: 1, climb: true };
  let state = stepMovement(start(), input, world, 725, 725).state;
  assert.equal(state.action, 'mantle');
  assert.equal(state.grounded, false);
  close(state.actionTimeMs, 0);
  close(state.position.y, 1.45);
  close(state.position.z, -.06);
  close(state.mantleAdvance, .46);
  state = stepMovement(state, input, world, 120, 845).state;
  const before = structuredClone(state);
  const halfway = stepMovement(state, input, world, 123.75, 968.75).state;
  close(halfway.position.y, 1.725);
  close(halfway.position.z, -.06);
  close(halfway.actionTimeMs, 123.75);
  assert.deepEqual(state, before);
  state = stepMovement(halfway, input, world, 123.75, 1092.5).state;
  close(state.position.y, 2);
  close(state.position.z, -.06);
  state = stepMovement(state, input, world, 67.5, 1160).state;
  close(state.position.z, -.29);
  close(state.position.y, 2);
  assert.equal(state.grounded, false);
  state = stepMovement(state, input, world, 67.5, 1227.5).state;
  close(state.position.z, -.52);
  close(state.actionTimeMs, 382.5);
  state = stepMovement(state, input, world, 67, 1294.5).state;
  assert.equal(state.action, 'mantle');
  close(state.position.z, -.52);
  const complete = stepMovement(state, input, world, .5, 1295);
  assert.equal(complete.state.grounded, true);
  assert.equal(complete.state.action, 'idle');
  close(complete.state.position.z, -.52);
  close(complete.state.stamina, 74.1);
  assert.deepEqual(complete.events, [{ type: 'climb-end' }]);
});

test('profiled shoulders keep the shared root path clear through lift and land both boots inside the summit', () => {
  const rock = { x: 0, z: -4, radius: 1, baseY: 0, height: 3, climbable: true, radiusProfile: [{ height: 0, radius: 1.4 }, { height: 1, radius: 2 }, { height: 2, radius: 1.4 }, { height: 3, radius: 1.1 }] };
  const world = { ...flat, obstacles: [rock] }, input = { forward: 1, climb: true };
  const walking = stepMovement(start(), { forward: 1 }, world, 1000, 1000).state;
  let state = stepMovement(walking, input, world, 1225, 2225).state;
  close(state.position.y, 2.45);
  close(state.mantleAdvance, 1.18);
  close(state.actionTimeMs, 0);
  state = stepMovement(state, input, world, 120, 2345).state;
  for (let frame = 1; frame <= 15; frame++) {
    state = stepMovement(state, input, world, 16.5, 2345 + frame * 16.5).state;
    const surfaceRadius = obstacleRadiusBetween(rock, state.position.y, state.position.y + 1.75);
    assert.ok(Math.hypot(state.position.x - rock.x, state.position.z - rock.z) >= surfaceRadius + .34 - .000001);
    close(state.position.z, -2.395);
  }
  close(state.position.y, 3);
  close(state.position.z, -2.395);
  state = stepMovement(state, input, world, 126.25, 2718.75).state;
  close(state.position.z, -2.985);
  close(state.position.y, 3);
  assert.equal(state.grounded, false);
  state = stepMovement(state, input, world, 126.25, 2845).state;
  close(state.position.z, -3.575);
  assert.equal(state.action, 'mantle');
  state = stepMovement(state, input, world, 150, 2995).state;
  close(state.position.z, -3.575);
  assert.equal(state.grounded, true);
  assert.equal(state.mantle, null);
  assert.ok(Math.hypot(state.position.x - rock.x, state.position.z - rock.z) + .171 < rock.radius);
});

test('releasing or exhausting a mantle stops the transfer and a held exhausted key cannot reattach', () => {
  const rock = { x: 0, z: -1, radius: .6, baseY: 0, height: 2, climbable: true }, world = { ...flat, obstacles: [rock] }, input = { forward: 1, climb: true };
  const entered = stepMovement(start(), input, world, 725, 725).state;
  const released = stepMovement(entered, {}, world, 10, 735);
  assert.equal(released.state.action, 'fall');
  assert.equal(released.state.mantle, null);
  assert.deepEqual(released.events, [{ type: 'climb-end' }]);
  const tired = { ...entered, stamina: 1 }, before = structuredClone(tired);
  const exhausted = stepMovement(tired, input, world, 1000, 1725);
  assert.equal(exhausted.state.mantle, null);
  assert.equal(exhausted.state.grounded, true);
  assert.equal(exhausted.state.climbExhausted, true);
  assert.equal(exhausted.events.filter(event => event.type === 'exhausted').length, 1);
  assert.equal(exhausted.events.filter(event => event.type === 'climb-end').length, 1);
  assert.equal(exhausted.events.filter(event => event.type === 'climb-start').length, 0);
  assert.deepEqual(tired, before);
});

test('a blocked mantle cancels before entering another body and stays released while climb is held', () => {
  const rock = { x: 0, z: -2, radius: .6, baseY: 0, height: 2, climbable: true };
  const blocker = { x: 0, z: -2, radius: .3, baseY: 0, height: 4, climbable: false };
  const world = { ...flat, obstacles: [rock, blocker] }, input = { forward: 1, climb: true };
  const walking = stepMovement(start(), { forward: 1 }, world, 1000, 1000).state;
  let state = stepMovement(walking, input, world, 725, 1725).state, cancellations = 0;
  assert.equal(state.action, 'mantle');
  for (let frame = 1; frame <= 180; frame++) {
    const next = stepMovement(state, input, world, 1000 / 120, 1725 + frame * 1000 / 120);
    state = next.state;
    cancellations += next.events.filter(event => event.type === 'climb-end').length;
    for (const obstacle of world.obstacles) {
      if (state.position.y >= obstacle.height - .000001) continue;
      assert.ok(Math.hypot(state.position.x - obstacle.x, state.position.z - obstacle.z) >= obstacle.radius + .34 - .000001, `frame ${frame} ${state.mode} ${JSON.stringify(state.position)} radius ${obstacle.radius}`);
    }
  }
  assert.equal(cancellations, 1);
  assert.equal(state.climbBlocked, true);
  assert.equal(state.mantle, null);
  assert.equal(state.grounded, true);
});

test('jump and complete mantle timing do not depend on render frame partitions', () => {
  const jumpInput = { jump: true, forward: 1 }, once = stepMovement(start(), jumpInput, flat, 450, 450).state;
  for (const fps of [30, 60, 144]) {
    let state = start(), time = 0;
    while (time < 450 - .000001) {
      const delta = Math.min(1000 / fps, 450 - time); time += delta;
      state = stepMovement(state, jumpInput, flat, delta, time).state;
    }
    close(state.position.y, once.position.y);
    close(state.position.z, once.position.z);
    close(state.velocity.y, once.velocity.y);
    assert.equal(state.action, 'fall');
  }
  const rock = { x: 0, z: -1, radius: .6, baseY: 0, height: 2, climbable: true }, world = { ...flat, obstacles: [rock] }, input = { forward: 1, climb: true };
  for (const fps of [30, 60, 144]) {
    let state = start(), time = 0;
    while (time < 1295 - .000001) {
      const delta = Math.min(1000 / fps, 1295 - time); time += delta;
      state = stepMovement(state, input, world, delta, time).state;
    }
    close(state.position.y, 2);
    close(state.position.z, -.52);
    close(state.stamina, 74.1);
    assert.equal(state.grounded, true);
  }
});


test('climb release uses fall even with upward momentum and cannot reuse an earlier jump clock', () => {
  const rock = { x: 0, z: -1, radius: .6, baseY: 0, height: 2, climbable: true }, world = { ...flat, obstacles: [rock] };
  for (const jumpStartedAt of [-Infinity, -10000]) {
    const initial = { ...start(), jumpStartedAt };
    const climbed = stepMovement(initial, { forward: 1, climb: true }, world, 500, 500).state;
    assert.equal(climbed.action, 'climb');
    assert.equal(climbed.jumpStartedAt, -Infinity);
    const released = stepMovement(climbed, {}, world, 1000 / 60, 500 + 1000 / 60).state;
    assert.ok(released.velocity.y > 0);
    assert.equal(released.action, 'fall');
    assert.equal(released.actionTimeMs, null);
    assert.equal(released.jumpStartedAt, -Infinity);
  }
});

test('holding climb during an ordinary uphill approach mounts the outcrop without latching an obstruction', () => {
  const rock = { x: -9, z: -42, radius: 2.5, baseY: 9.729777336120605, height: 5.5, climbable: true };
  const world = { ...flat, obstacles: [rock], surfaceAt: (x, z) => ({ height: 8.4193501663208 - (z + 39.16) * .456, normal: { x: 0, y: .9098666447420003, z: .4148991890423521 } }) };
  for (const fps of [30, 60, 144]) for (const z of [-38.9, -39.1, -39.16]) {
    let state = start({ position: { x: -9, y: world.surfaceAt(-9, z).height, z } }), mounted = false;
    for (let frame = 1; frame <= fps * 4; frame++) {
      state = stepMovement(state, { forward: 1, climb: true, cameraYaw: 0 }, world, 1000 / fps, frame * 1000 / fps).state;
      assert.equal(state.climbBlocked, false, `${fps} fps approach from ${z}`);
      assert.ok(state.position.y >= world.surfaceAt(state.position.x, state.position.z).height - .000001);
      if (state.grounded && state.position.y > 15) { mounted = true; break; }
    }
    assert.equal(mounted, true, `${fps} fps approach from ${z}`);
    close(state.position.y, 15.229777336120605);
    assert.ok(state.stamina < 40 && state.stamina > 20);
  }
});

test('a profiled shoulder attaches above a walkable bank before continuing its climb', () => {
  const rock = { x: 0, z: -4, radius: 1, baseY: 0, height: 3, climbable: true, radiusProfile: [{ height: 0, radius: 1.4 }, { height: 1, radius: 2 }, { height: 2, radius: 1.4 }, { height: 3, radius: 1.1 }] };
  const world = { ...flat, obstacles: [rock], surfaceAt: (x, z) => ({ height: -z * .5, normal: { x: 0, y: .8944271909999159, z: .4472135954999579 } }) };
  const initial = start({ position: { x: 0, y: .75, z: -1.5 } }), before = structuredClone(initial);
  const climbing = stepMovement(initial, { forward: 1, climb: true }, world, 500, 500).state;
  assert.equal(climbing.action, 'climb');
  assert.equal(climbing.climbBlocked, false);
  assert.ok(climbing.position.y > 1.8);
  assert.deepEqual(initial, before);
  const mounted = stepMovement(climbing, { forward: 1, climb: true }, world, 1095, 1595).state;
  assert.equal(mounted.grounded, true);
  close(mounted.position.y, 3);
});

test('grounding the climb attachment also clears the wider shoulder now beside the head', () => {
  const rock = { x: 0, z: -4, radius: 1.5, baseY: 1.2, height: 1.7, climbable: true, radiusProfile: [{ height: -.1, radius: 1.65 }, { height: .35, radius: 2.15 }, { height: .65, radius: 2.4 }, { height: 1.7, radius: 1.75 }] };
  const world = { ...flat, obstacles: [rock], surfaceAt: (x, z) => ({ height: -(z + 1.2) * .5, normal: { x: 0, y: .8944271909999159, z: .4472135954999579 } }) };
  let state = start({ position: { x: 0, y: 0, z: -1.2 } });
  for (let frame = 1; frame <= 120; frame++) {
    state = stepMovement(state, { forward: 1, climb: true }, world, 1000 / 60, frame * 1000 / 60).state;
    assert.equal(state.climbBlocked, false);
    assert.ok(state.position.y >= world.surfaceAt(state.position.x, state.position.z).height - .000001);
    if (state.position.y < 2.9 - .000001) assert.ok(Math.hypot(state.position.x, state.position.z + 4) >= obstacleRadiusBetween(rock, state.position.y, state.position.y + 1.75) + .34 - .000001);
  }
  assert.equal(state.grounded, true);
  close(state.position.y, 2.9);
});

test('climb attachment cannot use steep ground or an oversized step as a foothold', () => {
  const rock = { x: 0, z: -1, radius: .6, baseY: 0, height: 2, climbable: true };
  const surfaces = [
    (x, z) => ({ height: -z * 2, normal: { x: 0, y: .4472135954999579, z: .8944271909999159 } }),
    (x, z) => ({ height: z < -.01 ? .6 : 0, normal: { x: 0, y: 1, z: 0 } }),
  ];
  for (const surfaceAt of surfaces) {
    const result = stepMovement(start(), { forward: 1, climb: true }, { ...flat, obstacles: [rock], surfaceAt }, 2000, 2000);
    close(result.state.position.x, 0);
    close(result.state.position.y, 0);
    close(result.state.position.z, 0);
    assert.equal(result.state.climbBlocked, true);
    assert.equal(result.state.grounded, true);
    assert.equal(result.events.filter(event => event.type === 'climb-start').length, 1);
    assert.equal(result.events.filter(event => event.type === 'climb-end').length, 1);
  }
});

test('a climb corrected onto a bank still stops below an overhanging prop', () => {
  const rock = { x: 0, z: -1, radius: .6, baseY: 0, height: 2, climbable: true };
  const overhang = { x: 0, z: -1, radius: 1, baseY: 1.85, height: .3, climbable: false };
  const world = { ...flat, obstacles: [rock, overhang], surfaceAt: (x, z) => ({ height: -z * .5, normal: { x: 0, y: .8944271909999159, z: .4472135954999579 } }) };
  let state = start(), ended = 0;
  for (let frame = 1; frame <= 120; frame++) {
    const result = stepMovement(state, { forward: 1, climb: true }, world, 1000 / 60, frame * 1000 / 60);
    state = result.state;
    ended += result.events.filter(event => event.type === 'climb-end').length;
    assert.ok(state.position.y + 1.75 <= 1.85 + .000001);
  }
  assert.equal(ended, 1);
  assert.equal(state.climbBlocked, true);
  assert.equal(state.grounded, true);
  close(state.position.y, .03);
});
