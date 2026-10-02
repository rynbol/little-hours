import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { EngineStore } from '@babylonjs/core/Engines/engineStore.js';
import { createWildsView } from './scene.js';

async function fixture({ hidden = false, theme = 'day', deferAssets = false, failAsset = null, failHud = false } = {}) {
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
  let controls = {}, actorFrame = null, worldDisposed = 0, avatarDisposed = 0, inputReads = 0, worldSignal;
  const worldGate = Promise.withResolvers(), avatarGate = Promise.withResolvers();
  const world = { spawn: { x: 0, y: 0, z: 0, yaw: 0 }, surfaceAt: () => ({ height: 0, normal: { x: 0, y: 1, z: 0 } }), obstacles: [], update() {}, diagnostics: () => ({ location: 'Fixture' }), dispose() { worldDisposed++; } };
  const dependencies = {
    createWorld: async (scene, { signal }) => {
      worldSignal = signal;
      if (failAsset === 'world') throw new Error('Fixture world failed');
      if (deferAssets) await worldGate.promise;
      return world;
    },
    loadAvatar: async scene => {
      if (failAsset === 'avatar') throw new Error('Fixture avatar failed');
      const avatar = { root: new TransformNode('fixture-avatar', scene), update(frame) { actorFrame = frame; }, diagnostics: () => actorFrame, setAppearance() {}, reset() {}, dispose() { avatarDisposed++; this.root.dispose(); } };
      if (deferAssets) await avatarGate.promise;
      return avatar;
    },
    createInput: () => ({
      read() { inputReads++; const snapshot = controls; controls = { ...controls, jump: false }; return snapshot; },
      dispose() {},
    }),
    createCamera: scene => {
      const camera = new FreeCamera('fixture-camera', new Vector3(0, 2, 6), scene);
      return { camera, update: () => ({ cameraYaw: 0, cameraPitch: 0 }), diagnostics: () => ({}), setPose() {}, dispose() { camera.dispose(); } };
    },
    createHud: () => ({ update() { if (failHud) throw new Error('Fixture HUD failed'); }, dispose() {} }),
  };
  const view = createWildsView(engine, canvas, state, () => time, dependencies);
  if (!deferAssets) await view.initialization;
  return {
    view, engine, canvas, state, world,
    input(value) { controls = value; },
    resolveAssets() { worldGate.resolve(); avatarGate.resolve(); return view.initialization; },
    disposals: () => ({ world: worldDisposed, avatar: avatarDisposed }),
    get inputReads() { return inputReads; },
    get worldSignal() { return worldSignal; },
    get observer() { return observer; },
    frame(at) { time = at; render?.(); },
    visibility(next) { owner.hidden = next; owner.dispatchEvent(new Event('visibilitychange')); },
    get running() { return typeof render === 'function'; },
  };
}

test('the loaded Wilds scene becomes ready only after rendering and preserves caller state', async () => {
  const f = await fixture();
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

test('assets completing after disposal are released without restarting the scene', async () => {
  const f = await fixture({ deferAssets: true });
  try {
    f.frame(1000);
    assert.equal(f.view.diagnostics().loaded, false);
    assert.equal(EngineStore.Instances.includes(f.engine), true);
    f.view.dispose();
    assert.equal(f.worldSignal.aborted, true);
    assert.equal(f.running, false);
    assert.equal(f.canvas.removed, true);
    await f.resolveAssets();
    const d = f.view.diagnostics();
    assert.deepEqual(f.disposals(), { world: 1, avatar: 1 });
    assert.equal(d.phase, 'disposed');
    assert.equal(d.loaded, false);
    assert.equal(d.renderCount, 1);
    assert.equal(d.scene.isDisposed, true);
    assert.equal(EngineStore.Instances.includes(f.engine), false);
    f.visibility(true);
    f.visibility(false);
    f.frame(1100);
    assert.equal(f.running, false);
    assert.equal(f.view.diagnostics().renderCount, 1);
  } finally { f.view.dispose(); }
  assert.deepEqual(f.disposals(), { world: 1, avatar: 1 });
});

test('either failed asset releases its fulfilled sibling and leaves a renderable loading scene', async () => {
  for (const failAsset of ['world', 'avatar']) {
    const f = await fixture({ failAsset });
    try {
      const expected = failAsset === 'world' ? { world: 0, avatar: 1 } : { world: 1, avatar: 0 };
      assert.equal(f.view.diagnostics().failure, `Fixture ${failAsset} failed`);
      assert.equal(f.view.diagnostics().loaded, false);
      assert.deepEqual(f.disposals(), expected);
      f.frame(1000);
      f.frame(1100);
      assert.equal(f.view.diagnostics().renderCount, 2);
      assert.equal(f.view.diagnostics().scene.activeCamera.name, 'wilds-loading-camera');
      assert.equal(f.view.ready(), false);
      f.view.dispose();
      assert.deepEqual(f.disposals(), expected);
    } finally { f.view.dispose(); }
  }
});

test('finishing asynchronous loading starts the avatar at zero delta despite prior loading frames', async () => {
  const f = await fixture({ deferAssets: true });
  try {
    f.frame(1000);
    f.frame(1100);
    assert.equal(f.view.diagnostics().deltaMs, 100);
    assert.equal(f.view.diagnostics().loaded, false);
    await f.resolveAssets();
    let d = f.view.diagnostics();
    assert.equal(d.loaded, true);
    assert.equal(d.avatar.action, 'idle');
    assert.equal(d.avatar.deltaMs, 0);
    assert.deepEqual(d.player.position, { x: 0, y: 0, z: 0 });
    f.input({ forward: 1 });
    f.frame(1200);
    assert.equal(f.view.diagnostics().avatar.deltaMs, 0);
    f.frame(1300);
    d = f.view.diagnostics();
    assert.equal(d.avatar.deltaMs, 100);
    assert.equal(d.avatar.action, 'walk');
    assert.ok(Math.abs(d.player.position.z + .48) < .000001);
  } finally { f.view.dispose(); }
});

test('collision candidates refresh before movement and visual targets use the resulting position in the same frame', async () => {
  const f = await fixture(), updates = [];
  try {
    f.frame(1000);
    f.world.refreshObstacles = position => updates.push({ phase: 'collision', z: position.z });
    f.world.update = ({ position }) => updates.push({ phase: 'visual', z: position.z });
    f.input({ forward: 1, sprint: true });
    f.frame(1100);
    assert.deepEqual(updates.map(update => update.phase), ['collision', 'visual']);
    assert.equal(updates[0].z, 0);
    assert.ok(Math.abs(updates[1].z + .85) < .000001);
    assert.equal(updates[1].z, f.view.diagnostics().player.position.z);
    assert.equal(f.view.diagnostics().avatar.action, 'run');
  } finally { f.view.dispose(); }
});

test('a startup HUD exception disposes the new actors and retains the loading camera for later frames', async () => {
  const f = await fixture({ failHud: true });
  try {
    const d = f.view.diagnostics();
    assert.equal(d.failure, 'Fixture HUD failed');
    assert.equal(d.loaded, false);
    assert.deepEqual(f.disposals(), { world: 1, avatar: 1 });
    assert.equal(d.scene.cameras.length, 1);
    assert.equal(d.scene.activeCamera.name, 'wilds-loading-camera');
    f.frame(1000);
    f.frame(1100);
    assert.equal(f.view.diagnostics().renderCount, 2);
    assert.equal(f.view.diagnostics().scene.getFrameId(), 2);
    assert.equal(f.view.ready(), false);
  } finally { f.view.dispose(); }
  assert.deepEqual(f.disposals(), { world: 1, avatar: 1 });
});

test('frozen renders preserve the jump edge and synchronize grounded compression through liftoff', async () => {
  const f = await fixture();
  try {
    f.frame(1000);
    f.input({ jump: true });
    f.frame(1000);
    f.frame(1000);
    assert.equal(f.inputReads, 0);
    assert.equal(f.view.diagnostics().player.position.y, 0);
    f.frame(1050);
    let d = f.view.diagnostics();
    assert.equal(f.inputReads, 1);
    assert.equal(d.player.action, 'jump');
    assert.equal(d.player.grounded, true);
    assert.equal(d.player.position.y, 0);
    assert.equal(d.avatar.actionTimeMs, 50);
    f.frame(1050);
    assert.equal(f.inputReads, 1);
    assert.equal(f.view.diagnostics().avatar.actionTimeMs, 50);
    f.frame(1100);
    d = f.view.diagnostics();
    assert.equal(f.inputReads, 2);
    assert.equal(d.player.grounded, false);
    assert.ok(Math.abs(d.player.position.y - .11388888888888889) < .000001);
    assert.ok(Math.abs(d.player.velocity.y - 20 / 3) < .000001);
    assert.equal(d.avatar.action, 'jump');
    assert.equal(d.avatar.actionTimeMs, 100);
    f.frame(1100);
    assert.equal(f.view.diagnostics().avatar.actionTimeMs, 100);
  } finally { f.view.dispose(); }
});

test('a hidden Wilds view stops its loop and excludes hidden time when it resumes', async () => {
  const f = await fixture();
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

test('mounting in a hidden document waits for visibility and a frozen clock keeps game time fixed', async () => {
  const f = await fixture({ hidden: true });
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

test('dispose removes canvas, observers and engine once and cannot resume rendering', async () => {
  const f = await fixture();
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

test('the check themes choose distinct clear colours with a daylight fallback', async () => {
  for (const [theme, colour] of [['day', '#BFD9E8FF'], ['dusk', '#D3B7C9FF'], ['rain', '#A2B2BDFF'], ['invalid', '#BFD9E8FF']]) {
    const f = await fixture({ theme });
    try { assert.equal(f.view.diagnostics().scene.clearColor.toHexString(), colour); }
    finally { f.view.dispose(); }
  }
});


test('scene routes input through movement and supplies pinned delta to the Blender actor', async () => {
  const f = await fixture();
  try {
    f.frame(1000);
    f.input({ forward: 1 });
    for (let i = 1; i <= 10; i++) f.frame(1000 + i * 100);
    const d = f.view.diagnostics();
    assert.ok(Math.abs(d.player.position.z + 4.8) < .00001);
    assert.equal(d.player.action, 'walk');
    assert.equal(d.avatar.deltaMs, 100);
    f.frame(2000);
    assert.equal(f.view.diagnostics().avatar.deltaMs, 0);
    assert.ok(Math.abs(f.view.diagnostics().player.position.z + 4.8) < .00001);
    assert.equal(f.view.place({ position: { x: 3, z: 2 }, stamina: 7 }), true);
    assert.deepEqual(f.view.diagnostics().player.position, { x: 3, y: 0, z: 2 });
    assert.equal(f.view.diagnostics().player.stamina, 7);
  } finally { f.view.dispose(); }
  assert.deepEqual(f.disposals(), { world: 1, avatar: 1 });
});


test('draw diagnostics count one render rather than accumulating the entire session', async () => {
  const f = await fixture();
  try {
    const { scene, engine } = f.view.diagnostics();
    scene.onAfterRenderObservable.add(() => engine._drawCalls.addCount(7, false));
    f.frame(1000);
    assert.equal(f.view.diagnostics().drawCalls, 7);
    f.frame(1016);
    assert.equal(f.view.diagnostics().drawCalls, 7);
    scene.render();
    assert.equal(f.view.diagnostics().drawCalls, 7);
  } finally { f.view.dispose(); }
});

test('the scene passes logical facing to the avatar without snapping its displayed root', async () => {
  const f = await fixture();
  try {
    f.frame(1000);
    const root = f.view.diagnostics().scene.getTransformNodeByName('fixture-avatar');
    root.rotation.y = 0.25;
    f.input({ strafe: 1 });
    f.frame(1100);
    const d = f.view.diagnostics();
    assert.equal(d.avatar.yaw, -Math.PI / 2);
    assert.equal(root.rotation.y, 0.25);
    assert.equal(d.avatar.deltaMs, 100);
  } finally { f.view.dispose(); }
});

test('the scene holds the authored reach then passes exact mantle time and advance', async () => {
  const f = await fixture();
  try {
    f.world.obstacles.push({ x: 0, z: -1, radius: .6, baseY: 0, height: 2, climbable: true });
    f.frame(1000);
    f.input({ forward: 1, climb: true });
    for (let time = 1100; time <= 1700; time += 100) f.frame(time);
    f.frame(1725);
    let d = f.view.diagnostics();
    assert.equal(d.avatar.action, 'mantle');
    assert.ok(Math.abs(d.avatar.actionTimeMs) < .000001);
    assert.ok(Math.abs(d.avatar.mantleAdvance - .46) < .000001);
    assert.equal(d.avatar.grounded, false);
    const reaching = { ...d.player.position };
    f.frame(1800);
    d = f.view.diagnostics();
    assert.equal(d.avatar.actionTimeMs, 0);
    assert.deepEqual(d.player.position, reaching);
    f.frame(1845);
    f.frame(1920);
    d = f.view.diagnostics();
    assert.ok(Math.abs(d.avatar.actionTimeMs - 75) < .000001);
    const position = { ...d.player.position };
    f.frame(1920);
    assert.deepEqual(f.view.diagnostics().player.position, position);
    assert.ok(Math.abs(f.view.diagnostics().avatar.actionTimeMs - 75) < .000001);
  } finally { f.view.dispose(); }
});

test('the avatar sun follows the world direction while a cool side fill preserves shaded form', async () => {
  const f = await fixture({ theme: 'day' });
  try {
    const { scene } = f.view.diagnostics();
    const sun = scene.getLightByName('wilds-sun'), sky = scene.getLightByName('wilds-sky-light'), bounce = scene.getLightByName('wilds-sky-bounce');
    assert.deepEqual(sun.direction.asArray(), [.45, -.72, .528]);
    assert.equal(sun.diffuse.toHexString(), '#FFF4DC');
    assert.equal(sky.diffuse.toHexString(), '#A9C4D6');
    assert.equal(sky.groundColor.toHexString(), '#8A9A5C');
    assert.deepEqual(bounce.direction.asArray(), [-.65, -.45, -.75]);
    assert.equal(bounce.diffuse.toHexString(), '#BED6E3');
    assert.ok(sun.intensity > bounce.intensity && bounce.intensity > 0);
    assert.ok(bounce.direction.z < 0 && sun.direction.z > 0);
  } finally { f.view.dispose(); }
});
