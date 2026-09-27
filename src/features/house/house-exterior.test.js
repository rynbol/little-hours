import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExteriorPart, exteriorPlan, FRONT, BACK, HALF, WALL_TOP } from './house-exterior.js';

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
