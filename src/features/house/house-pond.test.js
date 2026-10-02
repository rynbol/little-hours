import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPond, pondLayout, inPond, DOCK, WATER, POND } from './house-pond.js';

const layout = pondLayout();
const apart = (a, b, gap) => Math.hypot(a.x - b.x, a.z - b.z) > gap;
const onDock = ({ x, z }, margin) => Math.abs(x - DOCK.x) < DOCK.width / 2 + margin && z > DOCK.to - margin;

test('lily pads float in open water, clear of each other, the dock and the boat', () => {
  assert.equal(layout.pads.length, 8);
  layout.pads.forEach((pad, i) => {
    assert.ok(inPond(pad.x, pad.z, -pad.r), `pad ${i} is afloat`);
    assert.ok(!onDock(pad, pad.r) && apart(pad, layout.boat, pad.r + layout.boat.reach), `pad ${i} is clear of the dock and boat`);
    layout.pads.slice(i + 1).forEach((other, k) => assert.ok(apart(pad, other, pad.r + other.r), `pads ${i} and ${i + k + 1} overlap`));
  });
  assert.equal(layout.pads.filter(pad => pad.bloom).length, 3);
});

test('reeds root along the waterline in clumps, never out in the middle', () => {
  assert.equal(layout.reeds.length, 59);
  for (const { x, z, tall } of layout.reeds) {
    assert.ok(inPond(x, z, .3) && !inPond(x, z, -.35), `reed at ${x.toFixed(2)}, ${z.toFixed(2)} is on the shore`);
    assert.ok(tall > .25 && tall < .9);
  }
});

test('stepping stones lead into the shallows a stride apart, clear of pads and boat', () => {
  const { steps, pads, boat } = layout;
  assert.equal(steps.length, 3);
  steps.forEach((step, i) => {
    assert.ok(inPond(step.x, step.z), `step ${i} is in the water`);
    assert.ok(pads.every(pad => apart(step, pad, step.r + pad.r)) && apart(step, boat, step.r + boat.reach), `step ${i} is clear`);
    if (i) assert.ok(!apart(step, steps[i - 1], .4), `step ${i} is a stride from the last`);
  });
  assert.ok(!inPond(...[steps[0].x, steps[0].z], -.3), 'the first step starts at the bank');
});

test('dock planks span the jetty with a gap between each board', () => {
  const { planks } = layout;
  assert.equal(planks.length, 9);
  assert.ok(planks[0].z - planks[0].depth / 2 < DOCK.to + .05 && planks.at(-1).z + planks.at(-1).depth / 2 > DOCK.from - .2);
  planks.slice(1).forEach((plank, i) => {
    const gap = plank.z - planks[i].z - (plank.depth + planks[i].depth) / 2;
    assert.ok(gap > .015 && gap < .045, `gap ${i} is ${gap.toFixed(3)}`);
  });
});

test('the water deepens toward its middle and pales to the shoal at the shore', () => {
  const water = [];
  const api = { shape(p, c) { for (let i = 0; i < p.length / 3; i++) if (Math.abs(p[i * 3 + 1] - WATER) < 1e-6) water.push({ x: p[i * 3], z: p[i * 3 + 2], light: c[i * 4] + c[i * 4 + 1] + c[i * 4 + 2] }); }, box() {}, ball() {}, cylinder() {} };
  buildPond(api);
  const near = (x, z) => water.reduce((best, v) => Math.hypot(v.x - x, v.z - z) < Math.hypot(best.x - x, best.z - z) ? v : best);
  const middle = near(10.3, .35), shore = near(POND.x - POND.rx * .9, POND.z);
  assert.ok(middle.light < 1.35, `middle is deep (${middle.light.toFixed(2)})`);
  assert.ok(shore.light - middle.light > .8, `shore ${shore.light.toFixed(2)} is paler than the middle ${middle.light.toFixed(2)}`);
});
