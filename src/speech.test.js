import test from 'node:test';
import assert from 'node:assert/strict';
import { AVATAR_LINES, PET_LINES, pickLine, bubbleDuration, createSpeech } from './speech.js';
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

// A small stand-in for the DOM: elements with the few members speech.js uses.
function fakeLayer() {
  const element = () => ({ className: '', dataset: {}, hidden: false, style: {}, textContent: '', children: [], offsetWidth: 120, offsetHeight: 34,
    classList: { set: new Set(), toggle(name, on) { on ? this.set.add(name) : this.set.delete(name); }, add(name) { this.set.add(name); }, remove(name) { this.set.delete(name); } },
    setAttribute() {}, appendChild(child) { this.children.push(child); } });
  globalThis.document = { createElement: element };
  globalThis.requestAnimationFrame = callback => callback();
  return element();
}
test('two bubbles never overlap: the higher one rises clear of the other', () => {
  const layer = fakeLayer(), points = { pet: { x: 400, y: 300, visible: true }, avatar: { x: 410, y: 290, visible: true } };
  const speech = createSpeech(layer, { anchor: who => points[who] }), y = element => Number(element.style.transform.match(/, (-?\d+)px, 0/)[1]);
  speech.say('pet', 'Mrrp. ♡', { duration: 60_000 }); speech.say('avatar', 'Who is a good friend? ♡', { duration: 60_000 });
  const [pet, avatar] = layer.children;
  assert.equal(y(pet), 300, 'the lower bubble stays on its head');
  assert.ok(y(avatar) <= 300 - 34 - 8, `the higher bubble clears it (${y(avatar)})`);
  // Side by side, far enough apart, both sit on their heads.
  points.avatar.x = 700; speech.update();
  assert.equal(y(avatar), 290);
  speech.hideAll();
});
