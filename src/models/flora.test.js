import test from 'node:test';
import assert from 'node:assert/strict';
import { FLORA, FLORA_STAGES, floraStage, plantBody } from './flora.js';

const SPECIES = Object.keys(FLORA);
const extent = body => {
  let reach = 0, top = 0, living = 0;
  for (let i = 0; i < body.positions.length; i += 3) {
    reach = Math.max(reach, Math.hypot(body.positions[i], body.positions[i + 2])); top = Math.max(top, body.positions[i + 1]);
    if (body.sway[i + 2] > 0) living = Math.max(living, body.positions[i + 1]);
  }
  return { reach, top, living };
};
const brightest = body => Math.max(...body.colors.filter((_, i) => i % 4 < 3));

test('growth walks through five stages: seed, sprout, leafy, budding, bloom', () => {
  assert.deepEqual(FLORA_STAGES, ['seed', 'sprout', 'leafy', 'budding', 'bloom']);
  assert.deepEqual([0, .24, .25, .49, .5, .74, .75, .99, 1, 3].map(floraStage), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
});

test('every species at every stage is a sound mesh with one wind entry per vertex', () => {
  for (const species of SPECIES) for (const growth of [0, .12, .3, .6, .85, 1]) {
    const body = plantBody(species, growth, { x: 2, z: -1, floor: .3, seed: 4 }), count = body.positions.length / 3;
    assert.ok(count > 60 && body.indices.length % 3 === 0, `${species} at ${growth}`);
    assert.equal(body.normals.length, count * 3); assert.equal(body.colors.length, count * 4); assert.equal(body.sway.length, count * 3);
    assert.ok([...body.positions, ...body.normals, ...body.colors, ...body.sway].every(Number.isFinite), `${species} at ${growth} has a broken number`);
    assert.ok(body.indices.every(index => index >= 0 && index < count));
    assert.ok(body.positions.every((value, i) => i % 3 !== 1 || value >= .3 - .13), `${species} at ${growth} sinks under the soil`);
    assert.deepEqual(plantBody(species, growth, { x: 2, z: -1, floor: .3, seed: 4 }), body);
  }
});

test('each stage of a plant is visibly bigger than the one before it', () => {
  for (const species of SPECIES) {
    const sizes = [.05, .3, .6, .85, 1].map(growth => { const body = plantBody(species, growth); return { ...extent(body), triangles: body.indices.length / 3 }; });
    assert.ok(sizes[0].top < .2, `${species} seed stays a low mound`);
    assert.ok(sizes[4].living > sizes[2].living && sizes[2].living > sizes[1].living * 1.3 && sizes[1].living > sizes[0].living, `${species} grows taller: ${sizes.map(size => size.living.toFixed(2))}`);
    assert.ok(sizes[4].triangles > sizes[3].triangles && sizes[3].triangles > sizes[2].triangles, `${species} fills out`);
  }
});

test('the four species keep their own silhouettes in bloom', () => {
  const [cosmos, lavender, sunflower, moonflower] = ['cosmos', 'lavender', 'sunflower', 'moonflower'].map(species => extent(plantBody(species, 1)));
  assert.ok(sunflower.top > 1.9 && sunflower.top > cosmos.top * 1.4 && sunflower.top > lavender.top * 1.4, 'the sunflower towers');
  assert.ok(moonflower.top > 1.6 && moonflower.top < sunflower.top, 'the moonflower climbs its trellis');
  assert.ok(cosmos.reach > lavender.reach, 'cosmos spreads wider than the lavender mound');
  assert.ok(lavender.top < 1.5 && cosmos.top < 1.5);
});

test('plants bend more toward the tip, and the trellis canes stand still', () => {
  for (const species of SPECIES) {
    const { positions, sway, crown } = plantBody(species, 1);
    let low = 0, high = 0;
    for (let i = 0; i < positions.length; i += 3) {
      assert.ok(sway[i + 1] >= 0 && sway[i + 1] <= 1 && sway[i + 2] >= 0);
      if (positions[i + 1] < crown[1] * .2) low = Math.max(low, sway[i + 1]); else if (positions[i + 1] > crown[1] * .9) high = Math.max(high, sway[i + 1]);
    }
    assert.ok(high > low + .5, `${species} bends ${low} low and ${high} high`);
  }
  const sprout = plantBody('moonflower', .3), tall = [];
  for (let i = 0; i < sprout.positions.length; i += 3) if (sprout.positions[i + 1] > 1) tall.push(sprout.sway[i + 2]);
  assert.ok(tall.length > 20 && tall.every(amount => amount === 0));
});

test('the moonflower opens and glows at dusk; the day flowers take the night shade', () => {
  assert.ok(brightest(plantBody('moonflower', 1, { theme: 'dusk' })) > 1.15);
  assert.ok(brightest(plantBody('moonflower', 1, { theme: 'day' })) <= 1);
  assert.ok(brightest(plantBody('moonflower', .6, { theme: 'dusk' })) <= 1, 'only open flowers glow');
  for (const species of ['cosmos', 'lavender', 'sunflower']) assert.ok(brightest(plantBody(species, 1, { theme: 'dusk' })) < brightest(plantBody(species, 1, { theme: 'day' })));
});

test('a plant is placed, raised and scaled where it is asked for, and reports its crown', () => {
  const body = plantBody('sunflower', 1, { x: 3, z: -2, floor: .5, scale: .5 }), full = plantBody('sunflower', 1);
  assert.deepEqual(body.crown.map(value => +value.toFixed(3)), [3, +(.5 + full.crown[1] * .5).toFixed(3), -2]);
  assert.equal(plantBody('thistle', 1).positions.length, plantBody('cosmos', 1).positions.length);
});
