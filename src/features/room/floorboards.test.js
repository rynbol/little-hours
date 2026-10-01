import test from 'node:test';
import assert from 'node:assert/strict';
import { floorBoards, woodGrain } from './floorboards.js';

const bounds = { left: -5.97, right: 5.97, back: -4.55, front: 4.55 };
const tones = ['a', 'b', 'c', 'd', 'e', 'f'];

test('floorboards are narrow planks of varied length that stagger their butt joints', () => {
  const boards = floorBoards(bounds, tones);
  assert.ok(boards.every(board => board.width > 0.15 && board.width < 0.22), 'planks are about 20 cm wide');
  const rows = [...new Set(boards.map(board => board.x.toFixed(3)))];
  assert.equal(rows.length, 57);
  const joints = rows.map(x => boards.filter(board => board.x.toFixed(3) === x).slice(1).map(board => board.z - board.length / 2));
  const aligned = joints.slice(1).filter((row, i) => row.some(z => joints[i].some(other => Math.abs(other - z) < 0.15))).length;
  assert.ok(aligned < rows.length * 0.25, `${aligned} of ${rows.length} neighbouring rows line up a joint`);
  assert.ok(new Set(boards.map(board => board.length.toFixed(2))).size > boards.length * 0.6, 'lengths vary board to board');
});

test('floorboards tile the floor edge to edge without overlapping', () => {
  const boards = floorBoards(bounds, tones);
  for (const x of new Set(boards.map(board => board.x))) {
    const row = boards.filter(board => board.x === x).sort((a, b) => a.z - b.z);
    assert.ok(Math.abs(row[0].z - row[0].length / 2 - bounds.back) < 0.01 && Math.abs(row.at(-1).z + row.at(-1).length / 2 - bounds.front) < 0.02, 'each row runs wall to wall');
    row.slice(1).forEach((board, i) => assert.ok(board.z - board.length / 2 >= row[i].z + row[i].length / 2 - 1e-9, 'no overlap'));
  }
  const used = new Set(boards.map(board => board.tone));
  assert.equal(used.size, tones.length, 'every floor tone appears');
});

test('the floor grain is a few broad, faint streaks, not fine dark lines that read as plastic', () => {
  const strokes = [];
  let style = '', width = 0;
  const context = { set fillStyle(v) {}, set strokeStyle(v) { style = v; }, set lineWidth(v) { width = v; }, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, ellipse() {}, stroke() { strokes.push({ alpha: Number(style.match(/([\d.]+)\)$/)[1]), width }); } };
  woodGrain(context, 256, 1024);
  assert.ok(strokes.length <= 24, `${strokes.length} grain strokes`);
  assert.ok(strokes.every(({ alpha }) => alpha <= 0.07), 'every streak is faint');
  assert.ok(strokes.every(({ width }) => width >= 2), 'every streak is broad');
});
