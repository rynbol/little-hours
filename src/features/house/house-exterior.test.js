import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClosedHouse, buildExteriorPart, exteriorPlan, FRONT, BACK, HALF, WALL_TOP } from './house-exterior.js';

function boxesOf(house, id) {
  const boxes = [], { parts, options } = exteriorPlan(house, id);
  const api = new Proxy({}, { get: (_, name) => (...args) => { if (name === 'box') boxes.push(args); } });
  for (const part of parts) buildExteriorPart(api, part, id, 'day', options);
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
  assert.deepEqual(extent(['studio']), { width: 5.64, top: 5.18 });
  assert.deepEqual(extent(['studio', 'garden']), { width: 10.74, top: 5.18 });
  assert.deepEqual(extent(['studio', 'garden', 'loft']), { width: 11.44, top: 7.86 });
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
  const frame = boxes.filter(([x, y, z, w, h, d, hex]) => x < left - .14 && x > left - .22 && y > .5 && hex === '#6b4a36');
  assert.ok(frame.length >= 6, `only ${frame.length} timbers on the end wall`);
  assert.ok(frame.some(box => Array.isArray(box[7]) && box[7][0] !== 0), 'the end wall has no braces');
});
