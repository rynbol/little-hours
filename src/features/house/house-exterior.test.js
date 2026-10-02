import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClosedHouse, buildExteriorPart, exteriorPlan, hingePose, roofY, FRONT, BACK, HALF, WALL_TOP, RISE, EAVE, PALETTE } from './house-exterior.js';

function boxesOf(house, id, theme = 'day', only = null) {
  const boxes = [], { parts, options } = exteriorPlan(house, id);
  const api = new Proxy({}, { get: (_, name) => (...args) => { if (name === 'box') boxes.push(args); } });
  for (const part of parts) if (!only || part === only) buildExteriorPart(api, part, id, theme, options);
  return { boxes, options };
}

const layouts = [['studio'], ['studio', 'garden'], ['studio', 'loft'], ['studio', 'garden', 'loft']];

test('the studio always has a full outer wall at its left end', () => {
  for (const ids of layouts) {
    const house = { rooms: ids.map(id => ({ id })) }, { boxes, options } = boxesOf(house, 'studio');
    const left = -HALF - options.bay;
    const wall = boxes.find(([x, y, z, w, h, d]) => x < left && x > left - .2 && d >= FRONT - BACK && y - h / 2 <= 0 && y + h / 2 >= WALL_TOP);
    assert.ok(wall, `no left wall for ${ids.join('+')}`);
  }
});

test('the closed house follows the rooms in the save', () => {
  const extent = ids => {
    const xs = [], ys = [];
    const api = new Proxy({}, { get: (_, name) => (x, y, z, w, h) => { if (name === 'box') { xs.push(x - w / 2, x + w / 2); ys.push(y + h / 2); } } });
    buildClosedHouse(api, { rooms: ids.map(id => ({ id })) }, 'dusk');
    return { width: +(Math.max(...xs) - Math.min(...xs)).toFixed(2), top: +Math.max(...ys).toFixed(2) };
  };
  assert.deepEqual(extent(['studio']), { width: 5.84, top: 5.29 });
  assert.deepEqual(extent(['studio', 'garden']), { width: 10.94, top: 5.29 });
  assert.deepEqual(extent(['studio', 'garden', 'loft']), { width: 11.64, top: 7.92 });
});

test('the cottage front is laid in separate stones and the roof in separate shingles', () => {
  const { boxes } = boxesOf({ rooms: [{ id: 'studio' }] }, 'studio');
  const plinth = boxes.filter(([x, y, z, w, h]) => z > FRONT && y + h / 2 <= .5 && h < .2);
  assert.ok(plinth.length > 30, `only ${plinth.length} plinth stones`);
  assert.ok(new Set(plinth.map(box => box[6])).size >= 3);
  const roof = boxes.filter(([x, y]) => y > WALL_TOP + .2 && y < WALL_TOP + 1.75);
  assert.ok(roof.length > 150, `only ${roof.length} roof pieces`);
});

test('the left end wall is framed in timber like the front', () => {
  const { boxes, options } = boxesOf({ rooms: [{ id: 'studio' }] }, 'studio'), left = -HALF - options.bay;
  const frame = boxes.filter(([x, y, z, w, h, d, hex]) => x < left - .14 && x > left - .22 && y > .5 && hex === PALETTE.timber);
  assert.ok(frame.length >= 6, `only ${frame.length} timbers on the end wall`);
  assert.ok(frame.some(box => Array.isArray(box[7]) && box[7][0] !== 0), 'the end wall has no braces');
});

test('each front roof slope carries a dormer whose window glows at dusk', () => {
  for (const id of ['studio', 'garden']) {
    const house = { rooms: [{ id: 'studio' }, { id: 'garden' }] };
    const lit = theme => boxesOf(house, id, theme, 'lid').boxes.filter(([x, y, z, w, h, d, hex, tilt, strength]) => y > WALL_TOP + .4 && z > 1 && strength > 1.5);
    assert.ok(lit('dusk').length >= 1, `no lit dormer window on the ${id} roof at dusk`);
    assert.equal(lit('day').length, 0);
  }
});

test('the roof sweeps out flatter at the eaves than at the ridge', () => {
  const pitch = (a, b) => (roofY(a) - roofY(b)) / (b - a);
  assert.ok(pitch(FRONT + EAVE - .15, FRONT + EAVE) < pitch(.2, .35) * .8);
  assert.equal(+roofY(0).toFixed(2), +(WALL_TOP + RISE).toFixed(2));
});

test('plain wall panels between posts are braced in timber', () => {
  const { boxes } = boxesOf({ rooms: [{ id: 'studio' }, { id: 'garden' }, { id: 'loft' }] }, 'loft', 'day', 'front');
  const braces = boxes.filter(([x, y, z, w, h, d, hex, tilt]) => hex === PALETTE.timber && typeof tilt === 'number' && Math.abs(tilt) > .2 && z > FRONT);
  assert.ok(braces.length >= 1, 'the loft front has no braces');
});

const lightness = hex => [1, 3, 5].reduce((sum, i) => sum + parseInt(hex.slice(i, i + 2), 16), 0);

test('the roof darkens and cools at dusk and in rain', () => {
  const house = { rooms: [{ id: 'studio' }] };
  const roof = theme => boxesOf(house, 'studio', theme, 'lid').boxes.filter(([x, y, z, w, h]) => y > WALL_TOP + .3 && h === .1).map(box => box[6]);
  const day = roof('day'), dusk = roof('dusk'), rain = roof('rain'), mean = list => list.reduce((sum, hex) => sum + lightness(hex), 0) / list.length;
  assert.ok(day.length > 100);
  const blue = list => list.reduce((sum, hex) => sum + parseInt(hex.slice(5, 7), 16) / lightness(hex), 0) / list.length;
  assert.ok(mean(dusk) < mean(day) * .95 && blue(dusk) > blue(day) * 1.15, 'dusk roof keeps its daytime colour');
  assert.ok(mean(rain) < mean(day) * .85, 'rain roof does not look wet');
});

test('the chimney stands on the roof and never hangs below it', () => {
  const { boxes } = boxesOf({ rooms: [{ id: 'studio' }] }, 'studio', 'day', 'roof');
  const stack = boxes.filter(([x, y, z, w, h, d, hex, tilt]) => Math.abs(x - 1.3) < .45 && Math.abs(z + .9) < .45 && y > WALL_TOP + .3 && !tilt);
  assert.ok(stack.length > 10, `only ${stack.length} chimney pieces`);
  for (const [, y, z, , h, d] of stack) assert.ok(y - h / 2 >= roofY(Math.abs(z) - d / 2) - .06, `a chimney piece hangs below the roof at y ${(y - h / 2).toFixed(2)}`);
});

test('an open roof lid folds away to nothing', () => {
  assert.ok(hingePose('lid', {}, 1).fold < .005);
  assert.equal(hingePose('lid', {}, 0).fold, 1);
});

test('the gables are framed in timber inside as well as out', () => {
  const { boxes, options } = boxesOf({ rooms: [{ id: 'studio' }] }, 'studio', 'day', 'roof'), left = -HALF - options.bay;
  const framed = face => boxes.filter(([x, y, z, w, h, d, hex]) => Math.abs(x - face) < .02 && y > WALL_TOP && hex === PALETTE.timber).length;
  assert.ok(framed(left - .09) >= 3, 'no timber outside the gable');
  assert.ok(framed(left + .09) >= 3, 'no timber inside the gable');
});

test('the wing roof lifts its shingles where the loft shades it, and only then', () => {
  const lifted = ids => boxesOf({ rooms: ids.map(id => ({ id })) }, 'garden', 'day', 'lid').boxes.filter(([x, y, z, w, h, d, hex, tilt, strength]) => h === .1 && strength > 1.2);
  assert.ok(lifted(['studio', 'garden', 'loft']).every(([x]) => x < -HALF + 1.6) && lifted(['studio', 'garden', 'loft']).length > 10);
  assert.equal(lifted(['studio', 'garden']).length, 0);
});

test('wall flashing runs only where a roof meets a wall, and the eave beyond it ends in a timber verge', () => {
  const house = { rooms: ['studio', 'garden', 'loft'].map(id => ({ id })) }, { boxes } = boxesOf(house, 'garden', 'day', 'lid');
  const flashing = boxes.filter(([, , , , , , hex]) => hex === PALETTE.flashing);
  assert.ok(flashing.length >= 6);
  for (const [, , z] of flashing) assert.ok(Math.abs(z) <= FRONT, `flashing hangs in the air at depth ${z}`);
  const left = -HALF, verge = boxes.filter(([x, , z, w, , , hex]) => hex === PALETTE.timber && w === .1 && Math.abs(x - left) < .1 && Math.abs(z) > FRONT);
  assert.ok(verge.length >= 1, 'the eave has no end board where it passes the wall');
});
