import test from 'node:test';
import assert from 'node:assert/strict';
import { BEDS, BED, bedBody, bedEdge, bedMarker, inBed, markerBody } from './garden-bed.js';
import { onGarden } from './garden-ground.js';

const shade = (body, bed, near) => {
  let sum = 0, count = 0;
  for (let i = 0; i < body.positions.length; i += 3) if ((Math.hypot(body.positions[i] - bed.x, body.positions[i + 2] - bed.z) < .5) === near && (near || body.positions[i + 1] < BED.rim * .6)) { sum += body.colors[i / 3 * 4]; count++; }
  return sum / count;
};

test('the six beds come in mixed sizes, mirrored left and right, on the lawn and clear of each other', () => {
  assert.equal(BEDS.length, 6);
  assert.ok(new Set(BEDS.map(bed => `${bed.width}x${bed.depth}`)).size >= 3);
  for (let i = 0; i < 6; i += 2) { assert.equal(BEDS[i].x, -BEDS[i + 1].x); assert.equal(BEDS[i].z, BEDS[i + 1].z); assert.equal(BEDS[i].turn, -BEDS[i + 1].turn || 0); }
  BEDS.forEach((bed, slot) => {
    for (let k = 0; k < 48; k++) {
      const [x, z] = bedEdge(bed, k / 48 * Math.PI * 2, 1.1);
      assert.ok(onGarden(x, z, .2), `bed ${slot} hangs off the lawn`);
      assert.ok(BEDS.every((other, at) => at === slot || !inBed(x, z, 0, [other])), `bed ${slot} runs into another bed`);
    }
  });
});

test('inBed follows the turned, dented outline of a bed', () => {
  for (const bed of BEDS) {
    assert.ok(inBed(bed.x, bed.z));
    for (let k = 0; k < 24; k++) {
      const angle = k / 24 * Math.PI * 2, [ix, iz] = bedEdge(bed, angle, .9), [ox, oz] = bedEdge(bed, angle, 1.12);
      assert.ok(inBed(ix, iz, 0, [bed]), 'a point inside the rim'); assert.ok(!inBed(ox, oz, 0, [bed]), 'a point outside the rim');
    }
  }
  assert.ok(!inBed(0, 0) && !inBed(40, 40));
});

test('a bed is a woven rim round mounded, furrowed soil', () => {
  const body = bedBody(BEDS[0], 'day', 0), count = body.positions.length / 3, heights = [];
  assert.ok(count > 2000 && count % 3 === 0);
  assert.equal(body.normals.length, count * 3); assert.equal(body.colors.length, count * 4);
  assert.ok([...body.positions, ...body.normals, ...body.colors].every(Number.isFinite));
  for (let i = 0; i < body.positions.length; i += 3) { assert.ok(body.positions[i + 1] >= 0); heights.push(body.positions[i + 1]); }
  const top = Math.max(...heights);
  assert.ok(top > BED.rim && top < BED.rim + .2, `stakes stand just proud of the rim at ${top}`);
  const soil = [];
  for (let i = 0; i < body.positions.length; i += 3) if (Math.hypot(body.positions[i] - BEDS[0].x, body.positions[i + 2] - BEDS[0].z) < .3) soil.push(body.positions[i + 1]);
  assert.ok(Math.max(...soil) > BED.soil + .08, 'the soil mounds in the middle');
  assert.ok(Math.max(...soil) - Math.min(...soil) > .03, 'furrows run across the mound');
  assert.deepEqual(bedBody(BEDS[0], 'day', 0), body);
});

test('rain darkens the soil more than it dims the woven rim', () => {
  const bed = BEDS[2], day = bedBody(bed, 'day', 2), rain = bedBody(bed, 'rain', 2);
  const soil = shade(rain, bed, true) / shade(day, bed, true), rim = shade(rain, bed, false) / shade(day, bed, false);
  assert.ok(soil < .62 && rim > .75 && rim < .85, `soil keeps ${soil} of its light, the rim ${rim}`);
});

test('an empty bed gets a small seed marker standing in its soil', () => {
  for (const bed of BEDS) {
    const [x, z] = bedMarker(bed), body = markerBody(bed, 'day'), ys = body.positions.filter((_, i) => i % 3 === 1);
    assert.ok(inBed(x, z, -.1, [bed]), 'the marker stands inside the rim');
    assert.ok(Math.min(...ys) >= BED.soil && Math.max(...ys) < BED.soil + .6 && Math.max(...ys) > BED.soil + .35);
    for (let i = 0; i < body.positions.length; i += 3) assert.ok(Math.hypot(body.positions[i] - x, body.positions[i + 2] - z) < .2);
  }
});
