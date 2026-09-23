import test from 'node:test';
import assert from 'node:assert/strict';
import { AVATAR_LINES, PET_LINES, pickLine, bubbleDuration } from './speech.js';
import { PETS } from './pet.js';
import { ACTIVITIES } from './companion.js';

test('lines never repeat back to back, and every moment has something short to say', () => {
  let seed = 3; const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const lines = AVATAR_LINES.start; let last = null;
  for (let i = 0; i < 200; i++) { const line = pickLine(lines, last, random); assert.notEqual(line, last); assert.ok(lines.includes(line)); last = line; }
  assert.equal(pickLine(['only'], 'only'), 'only', 'a single line still speaks');
  // Every companion state has tap lines; every pet has pet, sleepy, carry and hello lines.
  for (const state of ['idle', 'working', 'walking', 'returning', 'resting', 'sleeping', 'resting-at-desk']) assert.ok(AVATAR_LINES.tap[state].length >= 2, state);
  for (const species of Object.keys(PETS)) for (const kind of ['pet', 'sleepy', 'carry', 'hello', 'friend']) assert.ok(PET_LINES[species][kind].length >= 2, `${species} ${kind}`);
  // Every break activity, and reading in the armchair, has its own lines.
  for (const kind of [...Object.keys(ACTIVITIES), 'read']) assert.ok(AVATAR_LINES.activity[kind]?.length >= 2, kind);
  // Bubbles stay small: short lines, and each one stays long enough to read.
  const all = [...Object.values(AVATAR_LINES).flatMap(value => Array.isArray(value) ? value : Object.values(value).flat()), ...Object.values(PET_LINES).flatMap(value => Object.values(value).flat())];
  for (const line of all) assert.ok(line.length <= 48, `short enough for one small bubble: ${line}`);
  assert.ok(bubbleDuration('Hi!') >= 1900 && bubbleDuration('x'.repeat(200)) <= 5200);
});
