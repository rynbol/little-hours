import test from 'node:test';
import { placeAsset } from '../../models/assets.js';
import assert from 'node:assert/strict';
import { onIsland, edgePoint, islandCliff, buildIsland, ISLAND, ISLAND_DEPTH, STREAMS, waterfalls } from './house-island.js';
import { landmassEdge, onLandmass } from './island-landform.js';
import { strataSteps, hangingRoots } from '../../models/landform.js';
import { HOUSE_POSITIONS } from './house-model.js';
import { GARDEN_CENTER } from './house-garden.js';

test('every room, the stair and the whole garden stand on the island', () => {
  const corners = [];
  for (const [x, , z] of Object.values(HOUSE_POSITIONS)) for (const dx of [-2.5, 2.5]) for (const dz of [-2.1, 2.9]) corners.push([x + dx, z + dz]);
  for (const dx of [-2.75, 2.75]) for (const dz of [-3.2, 3.2]) corners.push([GARDEN_CENTER[0] + dx, dz]);
  corners.push([-5.7, 1.9], [-5.7, -1.2]);
  for (const [x, z] of corners) assert.ok(onIsland(x, z, .15), `${x}, ${z} is off the island`);
});

test('each stream runs from the lawn over the edge and falls clear of the island', () => {
  assert.equal(STREAMS.length, 3);
  for (const course of STREAMS) {
    assert.ok(course.slice(0, -1).every(([x, z]) => onIsland(x, z, .3)), JSON.stringify(course));
    assert.equal(onIsland(...course.at(-1), .1), false);
  }
  for (const { points, rim } of waterfalls()) {
    const [, top] = points[rim], [x, bottom, z] = points.at(-1);
    assert.ok(top > -.2 && bottom < -3.4 && !onIsland(x, z), `falls from ${top} to ${bottom}`);
  }
});

test('one layered cliff carries the lawn and the forest all around a single rim and narrows to a keel below', () => {
  const [{ positions }] = islandCliff();
  const occupied = new Set();
  let lowest = 0, beyondLawn = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const [x, y, z] = positions.slice(i, i + 3);
    lowest = Math.min(lowest, y);
    if (y < -.5) continue;
    const angle = Math.atan2(z - ISLAND.cz, x - ISLAND.cx);
    const [ex, ez] = landmassEdge(angle);
    assert.ok(Math.abs(Math.hypot(x - ISLAND.cx, z - ISLAND.cz) - Math.hypot(ex - ISLAND.cx, ez - ISLAND.cz)) < .3, `cliff rim at ${x}, ${z} must follow the shore`);
    if (!onIsland(x, z, -2)) beyondLawn++;
    occupied.add(Math.floor((angle + Math.PI) / (Math.PI * 2) * 24) % 24);
  }
  assert.equal(occupied.size, 24, 'the cliff supports every part of the shore');
  assert.ok(beyondLawn > 10, 'the same cliff runs on under the forest');
  assert.equal(lowest, ISLAND_DEPTH);
});

test('the rock face steps down in ledges, each band a different stone', () => {
  const steps = strataSteps(-.45, ISLAND_DEPTH);
  assert.ok(steps.every((step, i) => !i || step.y < steps[i - 1].y && step.scale <= steps[i - 1].scale), 'each layer sits lower and tucks in');
  assert.ok(new Set(steps.map(step => step.color)).size >= 10, 'the strata read as separate bands');
  const ledges = steps.filter((step, i) => i && steps[i - 1].y - step.y < .15 * Math.abs(ISLAND_DEPTH) * .2);
  assert.ok(ledges.length >= 4, `only ${ledges.length} ledges`);
});

test('roots and moss hang from the rim of the lawn, not from inside it', () => {
  const hung = [], api = { box: (x, y, z, w, h) => hung.push({ x, y, z, h }), ball: (x, y, z, w, h) => hung.push({ x, y, z, h }), cylinder() {}, shape() {} };
  hangingRoots(api, { edge: a => edgePoint(a, .998), top: -.43, count: 110 });
  assert.ok(hung.length > 50 && hung.length < 90, `${hung.length} roots`);
  for (const { x, y, z } of hung) {
    assert.ok(y < -.43, 'every root hangs below the rim');
    assert.equal(onIsland(x, z, .1), false, `${x}, ${z} hangs inside the lawn`);
  }
  const outside = [];
  hangingRoots({ box: (x, y, z) => outside.push([x, z]), ball: (x, y, z) => outside.push([x, z]) }, { edge: a => edgePoint(a), top: 0, count: 110, open: x => x > ISLAND.cx });
  assert.ok(outside.length > 0 && outside.every(([x]) => x > ISLAND.cx));
});

test('the forest swells out of the island outline with no notch or step where they meet', () => {
  const radius = a => { const [x, z] = landmassEdge(a); return Math.hypot(x - ISLAND.cx, z - ISLAND.cz); };
  const lawn = a => { const [x, z] = edgePoint(a); return Math.hypot(x - ISLAND.cx, z - ISLAND.cz); };
  const step = Math.PI / 720;
  let widest = 0;
  for (let a = -Math.PI; a < Math.PI; a += step) {
    assert.ok(radius(a) >= lawn(a) - 1e-9, `the shore cuts into the lawn at ${a}`);
    const bend = radius(a + step) - 2 * radius(a) + radius(a - step);
    assert.ok(Math.abs(bend) < .01, `the shore kinks at ${a.toFixed(3)} (${bend})`);
    widest = Math.max(widest, radius(a) - lawn(a));
  }
  assert.ok(widest > 4, `the forest reaches only ${widest} past the lawn`);
  assert.ok(onLandmass(9, -8) && !onIsland(9, -8));
});

test('the grass lip is lit by the way each stretch of shore really faces, on the forest flank too', () => {
  const shapes = [], quiet = () => {};
  buildIsland({ box: quiet, ball: quiet, cylinder: quiet, prism: quiet, disc: quiet, orb: quiet, shape: (positions, colors, normals) => shapes.push({ positions, normals }) });
  const [{ positions, normals }] = shapes;
  let flank = 0;
  for (let t = 0; t < positions.length; t += 9) {
    if (normals[t + 1] > .9) continue;
    const [a, b, c] = [0, 3, 6].map(k => positions.slice(t + k, t + k + 3));
    const u = b.map((v, k) => v - a[k]), w = c.map((v, k) => v - a[k]), fx = u[1] * w[2] - u[2] * w[1], fz = u[0] * w[1] - u[1] * w[0];
    const face = Math.hypot(fx, fz), given = Math.hypot(normals[t], normals[t + 2]);
    if (face < 1e-9) continue;
    assert.ok(Math.abs(fx * normals[t] + fz * normals[t + 2]) / face / given > .85, `the lip at ${a[0]}, ${a[2]} is lit from the wrong side`);
    if (!onIsland(a[0], a[2], -.6)) flank++;
  }
  assert.ok(flank > 40, `only ${flank} lip faces on the forest shore`);
});

test('the grass rim dims and cools at dusk and in rain, so it does not glow against the lawn', () => {
  const lip = theme => {
    const shapes = [], quiet = () => {};
    buildIsland({ box: quiet, ball: quiet, cylinder: quiet, prism: quiet, disc: quiet, orb: quiet, shape: (positions, colors, normals) => shapes.push({ colors, normals }) }, theme);
    const [{ colors, normals }] = shapes, sum = [0, 0, 0];
    let count = 0;
    for (let v = 0; v < normals.length / 3; v++) if (normals[v * 3 + 1] < .9) { for (let k = 0; k < 3; k++) sum[k] += colors[v * 4 + k]; count++; }
    return sum.map(value => value / count);
  };
  const day = lip('day'), dusk = lip('dusk'), rain = lip('rain');
  assert.ok(dusk[1] < day[1] * .72 && dusk[2] / dusk[1] > day[2] / day[1] * 1.2, `dusk lip ${dusk}`);
  assert.ok(rain[1] < day[1] * .9 && rain[1] > dusk[1], `rain lip ${rain}`);
});

test('the shore bushes take the dusk and rain light with the rim, so none stays lime against a dark lawn', () => {
  const bush = placeAsset('bush'), size = bush.positions.length, plain = bush.colors.filter((_, i) => i % 4 === 1).reduce((sum, green) => sum + green, 0) / (bush.colors.length / 4);
  const bushes = theme => {
    const greens = [], quiet = () => {};
    buildIsland({ box: quiet, ball: quiet, cylinder: quiet, prism: quiet, disc: quiet, orb: quiet, shape: (positions, colors) => { if (positions.length !== size) return; let green = 0; for (let v = 1; v < colors.length; v += 4) green += colors[v]; greens.push(green / (colors.length / 4)); } }, theme);
    return greens;
  };
  const day = bushes('day'), dusk = bushes('dusk'), rain = bushes('rain');
  const shore = day.map((green, i) => Math.abs(green - plain) < .001 ? i : -1).filter(i => i >= 0);
  assert.ok(shore.length >= 12, `only ${shore.length} shore bushes`);
  shore.forEach(i => { const green = day[i]; assert.ok(Math.abs(dusk[i] / green - .68) < .01, `bush ${i} at dusk ${dusk[i] / green}`); assert.ok(Math.abs(rain[i] / green - .84) < .01, `bush ${i} in rain ${rain[i] / green}`); });
});
