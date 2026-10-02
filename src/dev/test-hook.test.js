import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installTestHook } from './test-hook.js';

const element = (id, selector = `#${id}`) => ({ id, tagName: 'CIRCLE', classList: [], matches: wanted => wanted.split(',').map(part => part.trim()).includes(selector) });
const transition = (target, property = 'stroke-dashoffset') => ({ playState: 'running', transitionProperty: property, effect: { target, getComputedTiming: () => ({ endTime: 550 }) } });

function page(animations) {
  globalThis.window = {};
  globalThis.document = { getAnimations: () => animations, documentElement: { dataset: {} }, body: { classList: { contains: () => false } }, getElementById: () => null };
  installTestHook({ room: null, house: null });
  return window.__littleHours;
}

test('the running timer ring ticks every second without holding a settle, while any other finite animation still does', () => {
  assert.deepEqual(page([transition(element('timer-progress'))]).busy(), []);
  assert.deepEqual(page([transition(element('timer-progress')), transition(element('pet-now'), 'scale')]).busy(), ['css animation: scale on #pet-now']);
});

test('a settle that times out names what is still busy at the end, not what was busy when it began', async () => {
  const animations = [], hook = page(animations);
  document.documentElement.dataset.placeTransition = 'enter';
  const waiting = hook.settled(60);
  delete document.documentElement.dataset.placeTransition; animations.push(transition(element('room-panel'), 'opacity'));
  await assert.rejects(waiting, { message: 'Timed out after 60 ms waiting for the page to settle (css animation: opacity on #room-panel)' });
});
