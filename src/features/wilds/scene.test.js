import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { EngineStore } from '@babylonjs/core/Engines/engineStore.js';
import { createWildsView } from './scene.js';

function fixture({ hidden = false, theme = 'day' } = {}) {
  const engine = new NullEngine({ renderWidth: 800, renderHeight: 600 });
  const owner = new EventTarget(), host = new EventTarget();
  let render, observer, time = 1000;
  owner.hidden = hidden;
  owner.defaultView = host;
  host.ResizeObserver = class {
    constructor(callback) { this.callback = callback; observer = this; }
    observe(target) { this.target = target; }
    disconnect() { this.target = null; }
  };
  engine.runRenderLoop = callback => { render = callback; };
  engine.stopRenderLoop = () => { render = null; };
  const canvas = { ownerDocument: owner, parentElement: { id: 'stage' }, removed: false, remove() { this.removed = true; } };
  const state = { theme, house: { coins: 84 }, petBonds: { cat: { affection: 10 } } };
  const view = createWildsView(engine, canvas, state, () => time);
  return {
    view, engine, canvas, state,
    get observer() { return observer; },
    frame(at) { time = at; render?.(); },
    visibility(next) { owner.hidden = next; owner.dispatchEvent(new Event('visibilitychange')); },
    get running() { return typeof render === 'function'; },
  };
}

test('the empty Wilds scene becomes ready only after rendering and preserves caller state', () => {
  const f = fixture();
  try {
    assert.equal(f.view.ready(), false);
    f.frame(1000);
    f.frame(1016);
    const d = f.view.diagnostics();
    assert.equal(f.view.ready(), true);
    assert.equal(d.phase, 'running');
    assert.equal(d.renderCount, 2);
    assert.equal(d.scene.getFrameId(), 2);
    assert.equal(d.scene.meshes.length, 0);
    assert.equal(d.elapsedMs, 16);
    assert.equal(d.now, 1016);
    assert.deepEqual(f.state, { theme: 'day', house: { coins: 84 }, petBonds: { cat: { affection: 10 } } });
  } finally { f.view.dispose(); }
});

test('a hidden Wilds view stops its loop and excludes hidden time when it resumes', () => {
  const f = fixture();
  try {
    f.frame(1000);
    f.frame(1020);
    f.visibility(true);
    f.frame(9000);
    assert.equal(f.running, false);
    assert.equal(f.view.diagnostics().phase, 'suspended');
    assert.equal(f.view.diagnostics().renderCount, 2);
    assert.equal(f.view.diagnostics().elapsedMs, 20);
    f.visibility(false);
    f.frame(10000);
    f.frame(10020);
    assert.equal(f.running, true);
    assert.equal(f.view.diagnostics().renderCount, 4);
    assert.equal(f.view.diagnostics().elapsedMs, 40);
  } finally { f.view.dispose(); }
});

test('mounting in a hidden document waits for visibility and a frozen clock keeps game time fixed', () => {
  const f = fixture({ hidden: true });
  try {
    f.frame(2000);
    assert.equal(f.view.ready(), false);
    assert.equal(f.running, false);
    f.visibility(false);
    f.frame(5000);
    f.frame(5000);
    assert.equal(f.view.ready(), true);
    assert.equal(f.view.diagnostics().renderCount, 2);
    assert.equal(f.view.diagnostics().now, 5000);
    assert.equal(f.view.diagnostics().elapsedMs, 0);
    f.frame(9000);
    assert.equal(f.view.diagnostics().deltaMs, 100);
    f.frame(8000);
    assert.equal(f.view.diagnostics().deltaMs, 0);
  } finally { f.view.dispose(); }
});

test('dispose removes canvas, observers and engine once and cannot resume rendering', () => {
  const f = fixture();
  f.frame(1000);
  assert.equal(EngineStore.Instances.includes(f.engine), true);
  assert.deepEqual(f.observer.target, { id: 'stage' });
  f.view.dispose();
  f.view.dispose();
  f.visibility(true);
  f.visibility(false);
  f.observer.callback();
  f.frame(1050);
  assert.equal(f.view.diagnostics().phase, 'disposed');
  assert.equal(f.view.ready(), false);
  assert.equal(f.view.diagnostics().renderCount, 1);
  assert.equal(f.view.diagnostics().scene.isDisposed, true);
  assert.equal(f.canvas.removed, true);
  assert.equal(f.observer.target, null);
  assert.equal(EngineStore.Instances.includes(f.engine), false);
  assert.equal(f.running, false);
});

test('the check themes choose distinct clear colours with a daylight fallback', () => {
  for (const [theme, colour] of [['day', '#BFD9E8FF'], ['dusk', '#D3B7C9FF'], ['rain', '#A2B2BDFF'], ['invalid', '#BFD9E8FF']]) {
    const f = fixture({ theme });
    try { assert.equal(f.view.diagnostics().scene.clearColor.toHexString(), colour); }
    finally { f.view.dispose(); }
  }
});
