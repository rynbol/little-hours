import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { createPetModel } from '../../features/pet/pets.js';
import { createCombatState, WARDEN_ARENA } from '../../core/wilds/combat.js';
import { createMovementState } from '../../core/wilds/movement.js';
import { createCombatModels } from './combat-models.js';

const surfaceAt = (x, z) => ({ height: x * .02 + z * .06 });
const initial = petId => createCombatState({ player: createMovementState({ position: { x: -132, y: -15.54, z: -215 }, yaw: .6 }), petId });
const options = { arena: WARDEN_ARENA, surfaceAt, createPet: createPetModel };

test('temporary combat actors consume positions and phases without altering combat state or pet bones', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    for (const petId of ['cat', 'dog', 'bunny', 'fox', 'panda']) {
      const models = createCombatModels(scene, { ...options, petId, ribbon: 2 }), state = initial(petId);
      state.boss.position = { x: -132, y: -15.54, z: -215 }; state.boss.yaw = .6;
      models.update(state);
      const body = scene.getMeshByName(`pet-${petId}-body`), skeleton = body.skeleton;
      skeleton.prepare(true);
      const bones = skeleton.bones.map(bone => Array.from(bone.getLocalMatrix().m));
      assert.ok(body.getPositionData(true).every(Number.isFinite));
      assert.deepEqual(models.diagnostics().bossPosition, [-132, -15.54, -215]);
      state.pet.position = { x: -140, y: -16, z: -211 }; state.pet.action = 'skill'; state.pet.actionStartedAt = 100; state.now = 120;
      state.boss.mode = 'exposed'; state.boss.action = 'stagger';
      const before = structuredClone(state); models.update(state);
      assert.deepEqual(state, before);
      assert.deepEqual(models.diagnostics().petPosition, [-140, -16, -211]);
      assert.deepEqual(skeleton.bones.map(bone => Array.from(bone.getLocalMatrix().m)), bones);
      assert.equal(scene.getMeshByName('wilds-warden-heartwood').material.emissiveColor.r, 1);
      assert.equal(scene.getMeshByName('wilds-pet-skill').isEnabled(), true);
      assert.ok(models.diagnostics().meshes <= 8);
      state.now = 1000; state.boss.mode = 'defeated'; state.boss.action = 'defeat'; state.pet.mode = 'knockout'; models.update(state);
      assert.equal(scene.getMeshByName('wilds-warden-body').isEnabled(), false);
      assert.equal(scene.getMeshByName('wilds-pet-skill').isEnabled(), false);
      assert.equal(body.visibility, .45);
      models.dispose(); models.dispose();
      assert.equal(scene.meshes.length, 0); assert.equal(scene.materials.length, 0); assert.equal(scene.skeletons.length, 0); assert.equal(scene.textures.length, 0);
    }
  } finally { scene.dispose(); engine.dispose(); }
});

test('charge and circular warnings hug the rendered ground and clear during recovery', () => {
  const engine = new NullEngine(), scene = new Scene(engine), models = createCombatModels(scene, options), state = initial('cat');
  try {
    state.boss.mode = 'telegraph'; state.boss.action = 'attack-1';
    state.boss.telegraph = { kind: 'charge', origin: { x: -132, y: -15.54, z: -215 }, direction: { x: 0, z: -1 }, length: 30, width: 2.8, radius: 1.4 };
    models.update(state);
    const mesh = scene.getMeshByName('wilds-warden-telegraph'), positions = mesh.getVerticesData('position');
    assert.equal(mesh.isEnabled(), true);
    assert.deepEqual(models.diagnostics().telegraph, { kind: 'charge', visible: true });
    assert.ok(Math.abs(positions[0] + 130.6) < .00002); assert.ok(Math.abs(positions[2] + 215) < .00002);
    assert.equal(positions.at(-1), -245);
    for (let i = 0; i < positions.length; i += 3) assert.ok(Math.abs(positions[i + 1] - surfaceAt(positions[i], positions[i + 2]).height - .075) < .00001);
    state.boss.telegraph = { ...state.boss.telegraph, kind: 'slam', length: 0, radius: 5.2 }; models.update(state);
    assert.deepEqual(models.diagnostics().telegraph, { kind: 'slam', visible: true });
    assert.ok(Math.abs(mesh.getVerticesData('position')[3] + 126.8) < .00002);
    state.boss.mode = 'recovery'; state.boss.telegraph = null; models.update(state);
    assert.equal(mesh.isEnabled(), false);
    assert.deepEqual(models.diagnostics().telegraph, { kind: null, visible: false });
  } finally { models.dispose(); scene.dispose(); engine.dispose(); }
});

test('standing stones share one mesh and lifecycle preserves pre-existing pet materials', () => {
  const engine = new NullEngine(), scene = new Scene(engine), existing = createPetModel(scene, 'cat'), fur = existing.body.material;
  const count = scene.meshes.length, controller = new AbortController(), models = createCombatModels(scene, { ...options, signal: controller.signal });
  try {
    const stones = scene.getMeshByName('wilds-standing-stones');
    assert.ok(stones.getTotalVertices() > 100);
    assert.equal(scene.meshes.filter(mesh => mesh.name === 'wilds-standing-stones').length, 1);
    const state = initial('cat'); state.playerAction = { kind: 'attack', comboIndex: 0, startedAt: 0, durationMs: 420 }; models.update(state);
    assert.equal(scene.getMeshByName('wilds-sword-strike').isEnabled(), true);
    state.playerAction = null; models.update(state);
    assert.equal(scene.getMeshByName('wilds-sword-strike').isEnabled(), false);
    controller.abort();
    assert.equal(models.diagnostics().disposed, true);
    assert.equal(scene.meshes.length, count);
    assert.equal(existing.body.material, fur); assert.equal(scene.materials.includes(fur), true);
    assert.throws(() => createCombatModels(scene, { ...options, signal: controller.signal }), { name: 'AbortError' });
    assert.equal(scene.meshes.length, count);
  } finally { models.dispose(); existing.dispose(); scene.dispose(); engine.dispose(); }
});
