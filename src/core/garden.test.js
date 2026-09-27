import { test } from 'node:test';
import assert from 'node:assert/strict';
import { studyTrees, GARDEN_TREES } from './garden.js';

test('each study day grows one tree, full at an hour and smaller below', () => {
  const trees = studyTrees([{ date: '2026-09-02', minutes: 25 }, { date: '2026-09-01', minutes: 90 }, { date: '2026-09-02', minutes: 5 }, { date: '2026-09-03', minutes: 15 }]);
  assert.deepEqual(trees.map(tree => [tree.date, tree.minutes, tree.growth]), [['2026-09-01', 90, 1], ['2026-09-02', 30, 0.5], ['2026-09-03', 15, 0.25]]);
  assert.deepEqual(studyTrees([]), []);
});

test('the garden keeps the most recent days', () => {
  const history = Array.from({ length: 40 }, (_, i) => ({ date: `2026-08-${String(i + 1).padStart(2, '0')}`, minutes: 25 }));
  const trees = studyTrees(history);
  assert.equal(trees.length, GARDEN_TREES); assert.equal(trees.at(-1).date, '2026-08-40');
});
