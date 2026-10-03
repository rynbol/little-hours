import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { createWildsView } from '../../features/wilds/scene.js';
import { WARDEN_ARENA } from './combat.js';

async function fixture() {
  const owner = new EventTarget(), host = new EventTarget(), engine = new NullEngine();
  owner.defaultView = host; owner.hidden = false;
  host.ResizeObserver = class { observe() {} disconnect() {} };
  const canvas = { ownerDocument: owner, parentElement: {}, remove() {} };
  let now = 0, render, controls = {}, actor, cameraInput;
  engine.runRenderLoop = callback => { render = callback; }; engine.stopRenderLoop = () => {};
  const spawn = { ...WARDEN_ARENA.center, z: WARDEN_ARENA.center.z + 3 };
  const view = createWildsView(engine, canvas, { theme: 'day', pet: 'cat' }, () => now, {
    createWorld: () => ({ spawn, obstacles: [], surfaceAt: () => ({ height: spawn.y, normal: { x: 0, y: 1, z: 0 } }), update() {}, diagnostics: () => ({}), dispose() {} }),
    loadAvatar: scene => ({ root: new TransformNode('player', scene), update(frame) { actor = frame; }, diagnostics: () => actor, dispose() {} }),
    createInput: () => ({ read() { const value = controls; controls = {}; return value; }, dispose() {} }),
    createHud: () => ({ update() {}, dispose() {} }),
    createCombatModels: () => ({ update() {}, diagnostics() {}, dispose() {} }),
    createCamera: scene => ({ camera: new FreeCamera('camera', Vector3.Zero(), scene), setPose() {}, update(player, input) { cameraInput = input; return { cameraYaw: 0, cameraPitch: 0 }; }, diagnostics() {}, dispose() {} }),
  });
  await view.initialization;
  render();
  return { view, get actor() { return actor; }, get cameraInput() { return cameraInput; }, frame(delta, input = {}) { now += delta; controls = input; render(); } };
}

test('C3 scene pauses action time on impact, keeps camera responsive and buffers commands', async () => {
  const f = await fixture();
  try {
    f.frame(100, { actions: ['recall', 'attack'] }); f.frame(100);
    const impact = f.view.diagnostics();
    assert.ok(impact.events.some(event => event.type === 'damage'));
    f.frame(20, { lookX: 10, actions: ['attack'] });
    assert.equal(f.view.diagnostics().elapsedMs, impact.elapsedMs);
    assert.equal(f.cameraInput.lookX, 10);
    assert.equal(f.actor.deltaMs, 0);
    f.frame(100);
    assert.equal(f.view.diagnostics().combat.playerAction.buffered, true);
  } finally { f.view.dispose(); }
});

test('L1 integration supplies the actual combat action to the character animator', async () => {
  const f = await fixture();
  try {
    f.frame(16, { actions: ['attack'] });
    assert.equal(f.actor.combatAction?.kind, 'attack');
    assert.equal(f.actor.combatAction, f.view.diagnostics().combat.playerAction);
  } finally { f.view.dispose(); }
});
