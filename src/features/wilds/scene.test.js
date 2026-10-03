import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { EngineStore } from '@babylonjs/core/Engines/engineStore.js';
import { createWildsView } from './scene.js';
import { WARDEN_ARENA } from '../../core/wilds/combat.js';

async function fixture({ hidden = false, theme = 'day', deferAssets = false, failAsset = null, failHud = false, progress, petId = 'cat', spawn = { x: 0, y: 0, z: 0, yaw: 0 }, terrainHeight = () => 0 } = {}) {
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
  const state = { theme, pet: petId, house: { coins: 84 }, petBonds: { cat: { affection: 10 }, dog: { affection: 45 } }, ...(progress ? { wilds: progress } : {}) };
  const saved = structuredClone(state), progressChanges = [];
  let controls = {}, actorFrame = null, worldDisposed = 0, avatarDisposed = 0, inputReads = 0, worldSignal, combatFrame, modelOptions, modelDisposed = 0, hudFrame, lockedTarget;
  const worldGate = Promise.withResolvers(), avatarGate = Promise.withResolvers();
  const world = { spawn, surfaceAt: (x, z) => ({ height: terrainHeight(x, z), normal: { x: 0, y: 1, z: 0 } }), obstacles: [], update() {}, diagnostics: () => ({ location: 'Fixture' }), dispose() { worldDisposed++; } };
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
      read() { inputReads++; const snapshot = controls; controls = { ...controls, jump: false, actions: [] }; return snapshot; },
      dispose() {},
    }),
    createCamera: scene => {
      const camera = new FreeCamera('fixture-camera', new Vector3(0, 2, 6), scene);
      let yaw = 0;
      return { camera, update(player, input, delta, target) { lockedTarget = target; return { cameraYaw: yaw, cameraPitch: 0 }; }, diagnostics: () => ({ yaw }), setPose(pose) { yaw = pose.yaw; }, dispose() { camera.dispose(); } };
    },
    createHud: () => ({ update(frame) { hudFrame = frame; if (failHud) throw new Error('Fixture HUD failed'); }, dispose() {} }),
    createCombatModels: async (scene, options) => { modelOptions = options; return { update(frame) { combatFrame = frame; }, diagnostics: () => combatFrame, dispose() { modelDisposed++; } }; },
  };
  const view = createWildsView(engine, canvas, state, () => time, dependencies, { onProgress: progress => progressChanges.push(structuredClone(progress)) });
  if (!deferAssets) await view.initialization;
  return {
    view, engine, canvas, state, saved, world, progressChanges,
    get modelOptions() { return modelOptions; },
    get modelDisposed() { return modelDisposed; },
    get hudFrame() { return hudFrame; },
    get lockedTarget() { return lockedTarget; },
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
    assert.deepEqual(f.state, f.saved);
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
    assert.deepEqual(sun.direction.asArray(), [.5457491135496484, -.7173560908995228, .43307983549125045]);
    assert.equal(sun.diffuse.toHexString(), '#FFF0C8');
    assert.equal(sky.diffuse.toHexString(), '#A2C4EA');
    assert.equal(sky.groundColor.toHexString(), '#8AA056');
    assert.deepEqual(bounce.direction.asArray(), [-.65, -.45, -.75]);
    assert.equal(bounce.diffuse.toHexString(), '#BED6E3');
    assert.ok(sun.intensity > bounce.intensity && bounce.intensity > 0);
    assert.ok(bounce.direction.z < 0 && sun.direction.z > 0);
  } finally { f.view.dispose(); }
});

test('the scene selects the existing pet and bond without changing protected save slices', async () => {
  const f = await fixture({ petId: 'dog', progress: { totalXp: 260 } });
  try {
    f.frame(1000);
    assert.equal(f.modelOptions.petId, 'dog');
    assert.equal(f.view.diagnostics().combat.pet.id, 'dog');
    assert.equal(f.view.diagnostics().combat.pet.maxHealth, 91);
    assert.equal(f.view.diagnostics().player.maxHealth, 124);
    assert.equal(f.view.diagnostics().player.maxStamina, 108);
    assert.deepEqual(f.state, f.saved);
    assert.deepEqual(f.progressChanges, []);
    assert.equal(f.hudFrame.combat.pet.id, 'dog');
  } finally { f.view.dispose(); }
  assert.equal(f.modelDisposed, 1);
});

test('locking, attacking and placing keep combat models and camera synchronized without changing progress', async () => {
  const f = await fixture({ progress: { totalXp: 260 } });
  try {
    f.frame(1000);
    const center = WARDEN_ARENA.center;
    f.view.place({ position: { x: center.x, z: center.z + 3 }, stamina: 70 });
    f.input({ actions: ['lock', 'attack'] });
    f.frame(1100);
    let d = f.view.diagnostics();
    assert.equal(d.combat.targetId, 'mossback-warden');
    assert.equal(d.combat.playerAction.kind, 'attack');
    assert.equal(f.lockedTarget.id, 'mossback-warden');
    assert.equal(d.combatModels.playerAction.kind, 'attack');
    assert.equal(d.events.find(event => event.type === 'attack').at, 0);
    const health = d.player.health, maxStamina = d.player.maxStamina, progress = structuredClone(d.combat.progress);
    f.view.place({ position: { x: 12, z: 9 }, stamina: 11 });
    d = f.view.diagnostics();
    assert.deepEqual(d.player.position, { x: 12, y: 0, z: 9 });
    assert.deepEqual(d.combat.pet.position, { x: 13.2, y: 0, z: 9.8 });
    assert.equal(d.combat.targetId, null);
    assert.equal(d.combat.playerAction, null);
    assert.equal(f.lockedTarget, null);
    assert.equal(d.player.health, health);
    assert.equal(d.player.maxStamina, maxStamina);
    assert.equal(d.player.stamina, 11);
    assert.deepEqual(d.combat.progress, progress);
    assert.deepEqual(f.state, f.saved);
  } finally { f.view.dispose(); }
});

test('earned boss rewards update only Wilds persistence once and remain observable after later frames', async () => {
  const f = await fixture({ progress: { totalXp: 9000 } });
  try {
    f.frame(1000);
    for (let frame = 1; frame <= 600 && !f.progressChanges.length; frame++) {
      const d = f.view.diagnostics();
      if (!d.combat.playerAction) {
        f.view.place({ position: { x: d.combat.boss.position.x, z: d.combat.boss.position.z + 2 }, yaw: 0 });
        f.input({ actions: ['lock', 'attack', 'skill'] });
      } else f.input({ actions: ['attack'] });
      f.frame(1000 + frame * 100);
    }
    const d = f.view.diagnostics();
    assert.equal(d.combat.boss.mode, 'defeated');
    assert.equal(f.progressChanges.length, 1);
    assert.equal(f.state.wilds.totalXp, 9260);
    assert.deepEqual(f.state.wilds.materials, { heartwood: 1 });
    assert.deepEqual(f.state.wilds.trophies, ['mossback-warden']);
    assert.deepEqual(f.state.house, f.saved.house);
    assert.deepEqual(f.state.petBonds, f.saved.petBonds);
    assert.ok(d.eventHistory.some(event => event.type === 'progress-changed'));
    f.frame(d.now + 100);
    assert.equal(f.progressChanges.length, 1);
    assert.ok(f.view.diagnostics().eventHistory.some(event => event.type === 'boss-defeated'));
  } finally { f.view.dispose(); }
});

test('recent combat history stays bounded while frozen and hidden frames preserve combat time', async () => {
  const f = await fixture();
  try {
    f.frame(1000);
    f.view.place({ position: { x: WARDEN_ARENA.center.x, z: WARDEN_ARENA.center.z + 32 } });
    for (let frame = 1; frame <= 50; frame++) {
      f.input({ actions: ['lock'] });
      f.frame(1000 + frame * 20);
    }
    const before = f.view.diagnostics();
    assert.equal(before.eventHistory.length, 40);
    assert.equal(before.eventHistory.at(-1).type, 'lock-changed');
    const snapshot = structuredClone(before.combat);
    f.frame(2000);
    f.visibility(true);
    f.frame(9000);
    f.visibility(false);
    f.frame(10000);
    assert.deepEqual(f.view.diagnostics().combat, snapshot);
    assert.equal(f.view.diagnostics().elapsedMs, 1000);
    assert.equal(f.view.diagnostics().eventHistory.length, 40);
  } finally { f.view.dispose(); }
});

test('the Forest spawn orients the initial player and camera along the shared path', async () => {
  const f = await fixture({ spawn: { x: -106.5, y: 12, z: -180, yaw: -.6 } });
  try {
    f.frame(1000);
    const d = f.view.diagnostics();
    assert.deepEqual(d.player.position, { x: -106.5, y: 12, z: -180 });
    assert.equal(d.player.yaw, -.6);
    assert.equal(d.cameraYaw, -.6);
    assert.equal(d.cameraState.yaw, -.6);
  } finally { f.view.dispose(); }
});


test('the first frozen frame places the boss and companion on their own terrain heights', async () => {
  const f = await fixture({ spawn: { x: -106.5, y: 12, z: -180, yaw: -.6 }, terrainHeight: (x, z) => z < -200 ? 37 : 12 + (x + 106.5) * .1 });
  try {
    f.frame(1000);
    const d = f.view.diagnostics();
    assert.equal(d.elapsedMs, 0);
    assert.equal(d.deltaMs, 0);
    assert.equal(d.combat.arena.center.y, 37);
    assert.equal(d.combat.boss.position.y, 37);
    assert.deepEqual(d.combat.pet.position, { x: -105, y: 12.15, z: -178.5 });
    assert.equal(d.combatModels.boss.position.y, 37);
    assert.equal(d.player.position.y, 12);
    assert.deepEqual(f.state, f.saved);
  } finally { f.view.dispose(); }
});
