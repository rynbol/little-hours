import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { createPetModel } from '../../features/pet/pets.js';
import { createCombatState, WARDEN_ARENA } from '../../core/wilds/combat.js';
import { createMovementState } from '../../core/wilds/movement.js';
import { createEncounter } from './encounter.js';

test('the frozen Warden preserves the existing placeholder and still follows fight state', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const encounter = createEncounter(scene, { arena: WARDEN_ARENA, surfaceAt: () => ({ height: 0 }), createPet: createPetModel });
    const body = scene.getMeshByName('wilds-warden-body');
    assert.equal(body.getTotalVertices(), 2466);
    assert.equal(body.getTotalIndices(), 10236);
    assert.equal(encounter.diagnostics().source, 'frozen-placeholder');
    const state = createCombatState({ player: createMovementState({ position: { x: -132, y: 0, z: -215 } }) });
    state.boss.position = { x: -130, y: 4, z: -211 };
    state.boss.mode = 'exposed';
    encounter.update(state);
    assert.deepEqual(encounter.diagnostics().bossPosition, [-130, 4, -211]);
    assert.equal(scene.getMeshByName('wilds-warden-heartwood').material.emissiveColor.r, 1);
    state.boss.mode = 'defeated'; encounter.update(state);
    assert.equal(body.isEnabled(), false);
    encounter.dispose(); encounter.dispose();
    assert.equal(scene.meshes.length, 0);
    assert.equal(scene.materials.length, 0);
  } finally { scene.dispose(); engine.dispose(); }
});
