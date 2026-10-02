import test from 'node:test';
import assert from 'node:assert/strict';
import { installTestHook } from './test-hook.js';

function environment(t) {
  const previous = { window: globalThis.window, document: globalThis.document };
  globalThis.window = {};
  globalThis.document = {
    getAnimations: () => [],
    body: { classList: { contains: () => false } },
    documentElement: { dataset: {} },
    getElementById: () => ({ hidden: true }),
    querySelectorAll: () => ['canvas'],
  };
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  });
}

test('the shared test hook waits for Wilds rendering and exposes its diagnostic stats', async t => {
  environment(t);
  let ready = false;
  const scene = { getActiveIndices: () => 0, meshes: [], materials: [], textures: [], geometries: [] };
  const wilds = { ready: () => ready, diagnostics: () => ({ scene, drawCalls: 0, renderCount: 12, pixelRatio: 2 }) };
  installTestHook({ wilds, state: { theme: 'day' } });
  await assert.rejects(window.__littleHours.ready(0), /view to be ready/);
  ready = true;
  assert.equal(await window.__littleHours.ready(), true);
  assert.equal(window.__littleHours.wilds, wilds);
  assert.deepEqual(window.__littleHours.stats('wilds'), { drawCalls: 0, triangles: 0, renderCount: 12, pixelRatio: 2, quality: null });
  assert.deepEqual(window.__littleHours.counts().wilds, { meshes: 0, materials: 0, textures: 0, geometries: 0 });
  assert.equal(await window.__littleHours.settled(), true);
});

test('Wilds GPU sampling uses the existing shared measurement path', t => {
  environment(t);
  let renders = 0, readbacks = 0;
  const engine = {
    _gl: { RGBA: 6408, UNSIGNED_BYTE: 5121, readPixels() { readbacks++; } },
    beginFrame() {}, endFrame() {},
    getRenderWidth: () => 960,
    getRenderHeight: () => 640,
  };
  const scene = { render() { renders++; }, getActiveIndices: () => 0 };
  installTestHook({ wilds: { diagnostics: () => ({ engine, scene }) } });
  const sample = window.__littleHours.gpuFrame('wilds', 4);
  assert.equal(sample.width, 960);
  assert.equal(sample.height, 640);
  assert.equal(sample.triangles, 0);
  assert.equal(renders, 9);
  assert.equal(readbacks, 9);
  assert.ok(Number.isFinite(sample.ms));
});

test('room readiness and diagnostics still work without a Wilds controller', async t => {
  environment(t);
  installTestHook({ room: { diagnostics: () => ({ scene: { getActiveIndices: () => 36 }, drawCalls: 3, renderCount: 10, pixelRatio: 1, quality: 'high' }) } });
  assert.equal(await window.__littleHours.ready(), true);
  assert.deepEqual(window.__littleHours.stats(), { drawCalls: 3, triangles: 12, renderCount: 10, pixelRatio: 1, quality: 'high' });
  assert.throws(() => window.__littleHours.stats('wilds'), /wilds view is not built/);
});

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

test('input evidence records actual DOM events and removes its listeners on stop or restart', t => {
  environment(t);
  globalThis.document = Object.assign(new EventTarget(), document);
  installTestHook({ wilds: { diagnostics: () => ({ now: 1234 }) } });
  const capture = window.__littleHours.startInputCapture();
  const down = new Event('keydown');
  Object.defineProperties(down, { code: { value: 'KeyW' }, key: { value: 'w' } });
  document.dispatchEvent(down);
  const result = window.__littleHours.stopInputCapture();
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].type, 'keydown');
  assert.equal(result.events[0].code, 'KeyW');
  assert.equal(result.events[0].trusted, false);
  assert.equal(result.events[0].gameMs, 1234);
  assert.equal(capture.startGameMs, 1234);
  assert.ok(result.events[0].realEpochMs >= capture.startEpochMs);
  document.dispatchEvent(down);
  assert.equal(result.events.length, 1);
  window.__littleHours.startInputCapture();
  window.__littleHours.startInputCapture();
  document.dispatchEvent(down);
  assert.equal(window.__littleHours.stopInputCapture().events.length, 1);
});
