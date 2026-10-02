import test from 'node:test';
import assert from 'node:assert/strict';
import { gardenGround, gardenCliff, gardenEdge, onGarden, GARDEN_DEPTH, TURF_LIGHT } from './garden-ground.js';

test('garden turf is a flat walkable lawn in island greens with a lip that hangs over the edge', () => {
  const { positions, indices, colors } = gardenGround();
  assert.ok(positions.length / 3 < 1500);
  assert.equal(colors.length, positions.length / 3 * 4);
  assert.ok([...positions, ...colors].every(Number.isFinite));
  assert.ok(indices.every(n => n >= 0 && n < positions.length / 3));
  const heights = positions.filter((_, i) => i % 3 === 1);
  assert.equal(Math.max(...heights), 0);
  assert.ok(Math.min(...heights) < -.2 && Math.min(...heights) > -.4);
  for (let i = 0; i < positions.length; i += 3) {
    assert.ok(onGarden(positions[i], positions[i + 2], -.1));
    const [r, g, b] = colors.slice(i / 3 * 4, i / 3 * 4 + 3);
    assert.ok(g > r && g > b, 'turf is green');
  }
});

test('garden turf dims and cools at dusk and in rain so it matches the blades growing on it', () => {
  const mean = theme => { const { colors } = gardenGround(theme), sum = [0, 0, 0]; for (let i = 0; i < colors.length; i += 4) for (let k = 0; k < 3; k++) sum[k] += colors[i + k]; return sum.map(v => v / (colors.length / 4)); };
  const day = mean('day'), dusk = mean('dusk'), rain = mean('rain');
  assert.deepEqual(TURF_LIGHT.day, [1, 1, 1]);
  assert.ok(dusk[0] < day[0] * .6 && dusk[2] / dusk[0] > day[2] / day[0] * 1.4, 'dusk turf is darker and bluer');
  assert.ok(rain[0] < day[0] * .8 && rain[0] > dusk[0], 'rain sits between day and dusk');
});

test('a rock cliff with spires hangs under the garden, inside its outline', () => {
  const [body, ...spires] = gardenCliff();
  assert.ok(spires.length >= 4);
  const lowest = ({ positions }) => Math.min(...positions.filter((_, i) => i % 3 === 1)), highest = ({ positions }) => Math.max(...positions.filter((_, i) => i % 3 === 1));
  assert.equal(lowest(body), GARDEN_DEPTH);
  assert.ok(highest(body) < -.2 && highest(body) > -.4, 'the cliff starts under the lip');
  for (const part of [body, ...spires]) {
    assert.ok([...part.positions, ...part.colors].every(Number.isFinite));
    for (let i = 0; i < part.positions.length; i += 3) assert.ok(onGarden(part.positions[i], part.positions[i + 2], -.45));
  }
  for (const spire of spires) assert.ok(highest(spire) < -1.5 && lowest(spire) < GARDEN_DEPTH);
  const [x, z] = gardenEdge(1.2), [ix, iz] = gardenEdge(1.2, .9);
  assert.ok(onGarden(ix, iz) && !onGarden(x + (x - ix), z + (z - iz)));
});
