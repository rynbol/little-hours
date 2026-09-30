import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { sunbeamShape, CLASSIC_WINDOW, BEAM_SLICES, createSunbeam } from './room-sunbeam.js';
import { ROOM_LIGHTS } from './room-lighting.js';

const corners = (shape, slice) => [0, 1, 2, 3].map(k => shape.positions.slice((slice * 4 + k) * 3, (slice * 4 + k) * 3 + 3));

test('the day sunbeam runs from the window glass down onto the floor inside the room', () => {
  const shape = sunbeamShape(CLASSIC_WINDOW, ROOM_LIGHTS.day.direction, 0);
  assert.equal(shape.indices.length, BEAM_SLICES * 6);
  for (let i = 0; i < BEAM_SLICES; i++) {
    const [bottom, top, landTop, landBottom] = corners(shape, i);
    assert.equal(bottom[2], CLASSIC_WINDOW.z);
    assert.equal(top[2], CLASSIC_WINDOW.z);
    assert.equal(landTop[1], 0);
    assert.equal(landBottom[1], 0);
    assert.ok(landTop[2] > landBottom[2] && landBottom[2] > CLASSIC_WINDOW.z);
  }
});

test('the beam follows the arch, tallest at the middle of the window', () => {
  const shape = sunbeamShape(CLASSIC_WINDOW, ROOM_LIGHTS.day.direction, 0), mid = Math.floor(BEAM_SLICES / 2);
  const tops = Array.from({ length: BEAM_SLICES }, (_, i) => corners(shape, i)[1][1]);
  assert.ok(tops[mid] > tops[0] && tops[mid] > tops[BEAM_SLICES - 1]);
  assert.ok(Math.abs(tops[mid] - (CLASSIC_WINDOW.arch.y + CLASSIC_WINDOW.arch.radius)) < .05);
});

test('only daylight casts a visible beam', () => {
  assert.ok(ROOM_LIGHTS.day.beam > 0);
  assert.equal(ROOM_LIGHTS.dusk.beam, 0);
  assert.equal(ROOM_LIGHTS.rain.beam, 0);
});

test('the beam fades out as the seat view takes over and returns at full strength after', () => {
  const engine = new NullEngine(), scene = new Scene(engine), beam = createSunbeam(scene);
  beam.setLight('#fff1d2', .45);
  beam.animate(1, .5); assert.equal(beam.mesh.material._floats.strength, .225); assert.ok(beam.mesh.isEnabled(false));
  beam.animate(2, 0); assert.equal(beam.mesh.isEnabled(false), false);
  beam.setLight('#fff1d2', .45); assert.equal(beam.mesh.isEnabled(false), false);
  beam.animate(3, 1); assert.ok(beam.mesh.isEnabled(false)); assert.equal(beam.mesh.material._floats.strength, .45);
  engine.dispose();
});
