import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { EngineStore } from '@babylonjs/core/Engines/engineStore.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { createWildsStyleView } from './style-frame.js';

async function fixture({ hidden = false, still = false, defer = false, fail } = {}) {
  const engine = new NullEngine({ renderWidth: 1280, renderHeight: 900 });
  const owner = new EventTarget(), host = new EventTarget();
  owner.hidden = hidden; owner.defaultView = host;
  host.matchMedia = () => ({ matches: still });
  let render, time = 1000, worldOptions, actorOptions, disconnected = false;
  host.ResizeObserver = class { observe() {} disconnect() { disconnected = true; } };
  engine.runRenderLoop = callback => { render = callback; };
  engine.stopRenderLoop = () => { render = null; };
  const canvas = { ownerDocument: owner, parentElement: {}, removed: false, remove() { this.removed = true; } };
  const state = { theme: 'dusk', avatar: { hair: 2 }, pet: 'cat', wilds: { experience: 93 } }, saved = structuredClone(state);
  const gate = Promise.withResolvers(), disposal = { world: 0, actors: 0 };
  let placement, subject, shadowOptions, actorTheme, worldTheme, world, rainVisible = false, rainFrame = null, rainDisposed = false;
  const dependencies = {
    createRain: () => ({ mesh: { isEnabled: () => rainVisible }, setTheme(theme) { rainVisible = theme === 'rain'; }, animate(time, aspect) { rainFrame = { time, aspect }; }, dispose() { rainDisposed = true; } }),
    createWorld: async (scene, options) => {
      worldOptions = options;
      if (defer) await gate.promise;
      if (fail === 'world') throw new Error('Fixture world failure');
      world = { root: new TransformNode('fixture-world', scene), surfaceAt: (x, z) => ({ height: 10 + x * .05 + z * .01 }), setTheme(theme) { worldTheme = theme; }, diagnostics: () => ({ location: 'Forest trail', scenery: 'forest', theme: worldTheme }), dispose() { disposal.world++; world.root.dispose(); } };
      return world;
    },
    loadActors: async (scene, options) => {
      actorOptions = options;
      if (defer) await gate.promise;
      if (fail === 'actors') throw new Error('Fixture actors failure');
      return { place(poses, surfaceAt) { placement = Object.fromEntries(Object.entries(poses).map(([id, pose]) => [id, { ...pose, y: surfaceAt(pose.x, pose.z).height }])); }, setSubject(next, options) { subject = next; shadowOptions = options; }, setTheme(next) { actorTheme = next; }, diagnostics: () => ({ subject, theme: actorTheme, placement, shadowOptions }), dispose() { disposal.actors++; } };
    },
  };
  const view = createWildsStyleView(engine, canvas, state, () => time, dependencies);
  if (!defer) await view.initialization;
  return {
    view, state, saved, engine, canvas, disposal,
    get world() { return world; },
    get rain() { return { visible: rainVisible, frame: rainFrame, disposed: rainDisposed }; },
    get options() { return { worldOptions, actorOptions }; },
    get disconnected() { return disconnected; },
    get running() { return !!render; },
    frame(next) { time = next; render?.(); },
    visibility(next) { owner.hidden = next; owner.dispatchEvent(new Event('visibilitychange')); },
    resolve() { gate.resolve(); return view.initialization; },
  };
}

test('the Forest style frame is ready after its first render with grounded placements and unchanged save data', async () => {
  const f = await fixture();
  try {
    assert.equal(f.view.ready(), false);
    f.frame(1042);
    const d = f.view.diagnostics();
    assert.equal(f.view.ready(), true);
    assert.equal(d.renderCount, 1);
    assert.equal(d.now, 1042);
    assert.equal(d.actors.subject, 'group');
    assert.equal(d.actors.theme, 'dusk');
    assert.equal(d.world.scenery, 'forest');
    assert.ok(Math.abs(d.actors.placement.avatar.y - 1.3874) < .000001);
    assert.deepEqual(f.state, f.saved);
    assert.equal(d.scene.meshes.length, 0);
  } finally { f.view.dispose(); }
});

test('presentation isolates authored subjects and accepts an exact scenery comparison camera', async () => {
  const f = await fixture();
  try {
    const first = f.view.diagnostics().cameraState;
    assert.equal(f.view.presentation({ subject: 'avatar', angle: 'side', theme: 'rain' }), true);
    const portrait = f.view.diagnostics();
    assert.equal(portrait.actors.subject, 'avatar');
    assert.equal(portrait.actors.theme, 'rain');
    assert.equal(portrait.world.theme, 'rain');
    assert.ok(Math.abs(portrait.cameraState.target[1] - 2.2674) < .000001);
    assert.notDeepEqual(portrait.cameraState.position, first.position);
    assert.equal(f.view.presentation({ actors: false, camera: { position: [8, 4, 12], target: [1, 2, 3], fov: .7 } }), true);
    const control = f.view.diagnostics();
    assert.deepEqual(control.cameraState.position, [8, 4, 12]);
    assert.ok(control.cameraState.target.every((value, i) => Math.abs(value - [1, 2, 3][i]) < .00001));
    assert.equal(control.cameraState.fov, .7);
    assert.equal(control.actors.subject, 'scenery');
    assert.equal(f.view.presentation({ angle: 'invalid' }), false);
    assert.equal(f.view.presentation({ camera: { position: [NaN, 4, 3], target: [1, 2, 3] } }), false);
    assert.deepEqual(f.view.diagnostics().cameraState.position, [8, 4, 12]);
  } finally { f.view.dispose(); }
});

test('neutral portrait setup hides Forest and ground effects and restoring Forest brings them back', async () => {
  const f = await fixture();
  try {
    f.view.presentation({ subject: 'cat', backdrop: 'portrait' });
    assert.equal(f.world.root.isEnabled(), false);
    assert.equal(f.view.diagnostics().scene.clearColor.toHexString(), '#DFD7CAFF');
    assert.deepEqual(f.view.diagnostics().actors.shadowOptions, { shadows: false });
    f.view.presentation({ backdrop: 'forest' });
    assert.equal(f.world.root.isEnabled(), true);
    assert.deepEqual(f.view.diagnostics().actors.shadowOptions, { shadows: true });
  } finally { f.view.dispose(); }
});

test('hidden tabs suspend rendering and reduced motion reaches the shared Forest builder', async () => {
  const f = await fixture({ hidden: true, still: true });
  try {
    assert.equal(f.running, false);
    f.frame(2000);
    assert.equal(f.view.diagnostics().renderCount, 0);
    assert.equal(f.options.worldOptions.still, true);
    f.visibility(false); f.frame(2020);
    assert.equal(f.running, true);
    assert.equal(f.view.diagnostics().renderCount, 1);
    f.visibility(true); f.frame(2050);
    assert.equal(f.view.diagnostics().renderCount, 1);
  } finally { f.view.dispose(); }
});

test('disposing an incomplete style frame aborts asset work and releases late results exactly once', async () => {
  const f = await fixture({ defer: true });
  await Promise.resolve();
  f.view.dispose();
  await f.resolve();
  f.view.dispose();
  assert.deepEqual(f.disposal, { world: 1, actors: 1 });
  assert.equal(f.options.worldOptions.signal.aborted, true);
  assert.equal(f.options.actorOptions.signal.aborted, true);
  assert.equal(f.view.diagnostics().phase, 'disposed');
  assert.equal(f.view.ready(), false);
  assert.equal(f.running, false);
  assert.equal(f.disconnected, true);
  assert.equal(f.canvas.removed, true);
  assert.equal(EngineStore.Instances.includes(f.engine), false);
});

test('a failed world or actor load releases the successful sibling and reports the failure', async () => {
  for (const fail of ['world', 'actors']) {
    const f = await fixture({ fail });
    try {
      assert.equal(f.view.ready(), false);
      assert.equal(f.view.diagnostics().failure, `Fixture ${fail} failure`);
      assert.deepEqual(f.disposal, fail === 'world' ? { world: 0, actors: 1 } : { world: 1, actors: 0 });
      f.frame(1001);
      assert.equal(f.view.diagnostics().renderCount, 1);
    } finally { f.view.dispose(); }
  }
});


test('Forest rain uses pinned time, freezes in reduced motion, and stays out of neutral portraits', async () => {
  for (const still of [true, false]) {
    const f = await fixture({ still });
    try {
      f.view.presentation({ theme: 'rain' });
      f.frame(2250);
      assert.equal(f.rain.visible, true);
      assert.deepEqual(f.rain.frame, { time: still ? 0 : 2.25, aspect: 1280 / 900 });
      f.visibility(true); f.frame(2400);
      assert.equal(f.rain.frame.time, still ? 0 : 2.25);
      f.view.presentation({ backdrop: 'portrait' });
      assert.equal(f.rain.visible, false);
      f.view.presentation({ backdrop: 'forest' });
      assert.equal(f.rain.visible, true);
    } finally { f.view.dispose(); }
    assert.equal(f.rain.disposed, true);
  }
});
