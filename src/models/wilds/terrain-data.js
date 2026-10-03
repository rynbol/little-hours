import { fbm, noise2, smooth } from '../../core/wilds/noise.js';
import { VALLEY, lakeEdge, streamCourse, trailNearest } from '../../core/wilds/valley.js';

export const CHUNK = 64;
export const LOD_STEPS = Object.freeze([1, 2, 4, 8]);

const hex = value => [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16) / 255);
const PAINT = Object.freeze({
  meadow: hex('#4f7a2e'), meadowLight: hex('#6f9436'), meadowGold: hex('#8a9a3a'), hollow: hex('#3c6228'),
  forest: hex('#3f5226'), litter: hex('#6a5432'), trail: hex('#a4835c'), trailEdge: hex('#7f7446'),
  gravel: hex('#b7a88f'), pebble: hex('#8f8270'), wet: hex('#5f5a48'), bed: hex('#4a5248'), deep: hex('#33403e'),
  stone: hex('#b89c78'), stoneDark: hex('#957b5e'), stoneLight: hex('#cdb48e'), lichen: hex('#8b9868'), moss: hex('#56702f'),
});
const blend = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function paintAndMask(x, z, height, slope, out, mask, tint, i) {
  const lake = lakeEdge(x, z), stream = streamCourse(x, z), path = trailNearest(x, z, 6);
  const patch = fbm(x / 26, z / 26, 3, 601), fine = noise2(x / 3.1, z / 3.1, 602), gold = smooth(.35, .7, fbm(x / 60, z / 60, 2, 603));
  let meadow = blend(PAINT.meadow, PAINT.meadowLight, smooth(-.25, .45, patch));
  meadow = blend(meadow, PAINT.meadowGold, gold * .55);
  meadow = blend(meadow, PAINT.hollow, smooth(.1, -.5, patch + fine * .3) * .6);
  const woods = Math.min(1, smooth(-70, -110, z) + smooth(-110, -160, x) + smooth(.2, .5, fbm(x / 90, z / 90, 2, 604)) * smooth(150, 230, Math.abs(x)));
  const grass = blend(meadow, PAINT.forest, woods * .7);
  let color = blend(grass, blend(PAINT.forest, PAINT.litter, smooth(-.1, .5, fine)), woods * .75);
  const streamEdge = stream.distance - VALLEY.stream.width * .5, shore = Math.min(lake, streamEdge);
  const beach = x > 55 && z > 90 && z < 175 ? 1 : .35;
  color = blend(color, blend(PAINT.gravel, PAINT.pebble, smooth(-.3, .5, fine)), (1 - smooth(1.5, 4 + 5 * beach, shore)) * .95);
  color = blend(color, PAINT.wet, (1 - smooth(-.5, 1.2, shore)) * .6);
  if (lake < 0) color = blend(blend(PAINT.pebble, PAINT.bed, smooth(0, -6, lake)), PAINT.deep, smooth(-8, -30, lake));
  if (stream.distance < VALLEY.stream.width * .55) color = blend(PAINT.pebble, PAINT.bed, smooth(.2, -.4, fine));
  const trailWidth = VALLEY.trailWidth, edge = path.distance + noise2(x / 1.7, z / 1.7, 612) * .3;
  if (path.distance < 5) {
    color = blend(color, PAINT.trailEdge, (1 - smooth(trailWidth * .4, trailWidth * 1.1, edge)) * .55);
    color = blend(color, PAINT.trail, (1 - smooth(trailWidth * .3, trailWidth * .56, edge)) * (.85 + .15 * fine));
  }
  const rock = smooth(.75, 1.15, slope);
  if (rock > 0) {
    const band = Math.sin(height / 5.5 * Math.PI * 2 + noise2(x / 12, z / 12, 605) * 2.4);
    let stone = blend(PAINT.stoneDark, PAINT.stoneLight, smooth(-.6, .8, band));
    stone = blend(stone, PAINT.stone, .35 + .3 * fine);
    stone = blend(stone, PAINT.lichen, smooth(.45, .75, noise2(x / 5, height / 3, 606)) * .5);
    stone = blend(stone, PAINT.moss, smooth(.5, .2, slope - .75) * .4);
    color = blend(color, stone, rock);
  }

  const camp = Math.hypot(x - VALLEY.camp.x, z - VALLEY.camp.z);
  let cover = lake < 0 || streamEdge < 0 ? 0 : smooth(.95, .55, slope);
  cover *= smooth(1.2, 3.6, shore + noise2(x / 4, z / 4, 611) * 1.5);
  cover *= smooth(trailWidth * .3, trailWidth * .55, edge);
  for (const fire of VALLEY.campfires) cover *= smooth(1.8, 3.2, Math.hypot(x - fire.x, z - fire.z));
  cover *= smooth(1, 2.6, Math.hypot(x - VALLEY.shrine.x, z - VALLEY.shrine.z));
  if (Math.hypot(x - VALLEY.waterfall.pool.x, z - VALLEY.waterfall.pool.z) < VALLEY.waterfall.pool.radius) cover = 0;
  let tall = .3 + .45 * smooth(trailWidth * .5, trailWidth * 2.6, edge);
  tall *= .45 + .55 * smooth(3, 10, camp);
  tall *= .5 + .5 * smooth(1, 6, shore);
  tall *= 1 - woods * .3 - rock * .3;
  tall += .25 * smooth(40, 10, Math.hypot(x - VALLEY.meadow.x, z - VALLEY.meadow.z)) + .12 * smooth(.2, .6, patch);
  color = blend(color, grass, Math.max(0, Math.min(1, cover)) * .75);

  out[i] = color[0] * 255; out[i + 1] = color[1] * 255; out[i + 2] = color[2] * 255; out[i + 3] = 255;
  mask[i] = Math.max(0, Math.min(1, cover)) * 255;
  mask[i + 1] = Math.max(0, Math.min(1, tall)) * 255;
  mask[i + 2] = (1 - smooth(1, 7, shore)) * 255;
  mask[i + 3] = woods * 255;
  tint[i] = grass[0] * 255; tint[i + 1] = grass[1] * 255; tint[i + 2] = grass[2] * 255; tint[i + 3] = gold * 255;
}

export function surveyGround(grid, rows = [0, grid.rows]) {
  const { columns, minX, minZ, step, heights } = grid, span = (rows[1] - rows[0]) * columns * 4;
  const colors = new Uint8Array(span), mask = new Uint8Array(span), tint = new Uint8Array(span);
  for (let r = rows[0]; r < rows[1]; r++) for (let c = 0; c < columns; c++) {
    const x = minX + c * step, z = minZ + r * step, h = heights[r * columns + c];
    const n = grid.normalAt(x, z), slope = Math.sqrt(Math.max(0, 1 - n.y * n.y)) / Math.max(.05, n.y);
    paintAndMask(x, z, h, slope, colors, mask, tint, ((r - rows[0]) * columns + c) * 4);
  }
  return { colors, mask, tint };
}

export function chunkGeometry(grid, colors, originX, originZ, step, size = CHUNK) {
  const count = Math.round(size / step) + 1, edges = (count - 1) * 4;
  const vertices = count * count + edges;
  const positions = new Float32Array(vertices * 3), normals = new Float32Array(vertices * 3), paint = new Float32Array(vertices * 4);
  const lastColumn = grid.columns - 1, lastRow = grid.rows - 1;
  const cell = (x, z) => Math.min(lastRow, Math.max(0, Math.round((z - grid.minZ) / grid.step))) * grid.columns + Math.min(lastColumn, Math.max(0, Math.round((x - grid.minX) / grid.step)));
  const reach = LOD_STEPS[LOD_STEPS.length - 1] + step;
  const seamFloor = (x, z) => {
    let low = Infinity;
    for (let d = -reach; d <= reach; d += grid.step) low = Math.min(low, grid.heights[cell(x + d, z)], grid.heights[cell(x, z + d)]);
    return low - 1;
  };
  for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) {
    const x = originX + c * step, z = originZ + r * step, v = r * count + c, g = cell(x, z);
    const n = grid.normalAt(x, z), ci = g * 4;
    positions[v * 3] = x; positions[v * 3 + 1] = grid.heights[g]; positions[v * 3 + 2] = z;
    normals[v * 3] = n.x; normals[v * 3 + 1] = n.y; normals[v * 3 + 2] = n.z;
    paint[v * 4] = colors[ci] / 255; paint[v * 4 + 1] = colors[ci + 1] / 255; paint[v * 4 + 2] = colors[ci + 2] / 255; paint[v * 4 + 3] = 1;
  }
  const edge = [];
  for (let c = 0; c < count - 1; c++) edge.push(c);
  for (let r = 0; r < count - 1; r++) edge.push(r * count + count - 1);
  for (let c = count - 1; c > 0; c--) edge.push((count - 1) * count + c);
  for (let r = count - 1; r > 0; r--) edge.push(r * count);
  edge.forEach((source, k) => {
    const v = count * count + k;
    positions[v * 3] = positions[source * 3]; positions[v * 3 + 1] = seamFloor(positions[source * 3], positions[source * 3 + 2]); positions[v * 3 + 2] = positions[source * 3 + 2];
    normals.copyWithin(v * 3, source * 3, source * 3 + 3);
    paint.copyWithin(v * 4, source * 4, source * 4 + 4);
  });
  const indices = new Uint32Array((count - 1) * (count - 1) * 6 + edge.length * 12);
  let k = 0;
  for (let r = 0; r < count - 1; r++) for (let c = 0; c < count - 1; c++) {
    const a = r * count + c, b = a + 1, d = a + count, e = d + 1;
    if ((r + c) % 2) indices.set([a, b, d, b, e, d], k); else indices.set([a, e, d, a, b, e], k);
    k += 6;
  }
  edge.forEach((source, i) => {
    const next = edge[(i + 1) % edge.length], low = count * count + i, lowNext = count * count + (i + 1) % edge.length;
    indices.set([source, low, next, next, low, lowNext, source, next, low, next, lowNext, low], k); k += 12;
  });
  return { positions, normals, colors: paint, indices };
}
