import { test } from 'node:test';
import { execFileSync } from 'node:child_process';

test('garden navigation releases the previous house model and its disposed selection mesh', () => {
  execFileSync(process.execPath, ['--expose-gc', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
    import { Scene } from '@babylonjs/core/scene.js';
    import { freshState } from './src/core/state.js';
    import { createHouseModel } from './src/features/house/house-model.js';
    const context = new Proxy({}, { get: (_, key) => String(key).includes('Gradient') ? () => ({ addColorStop() {} }) : key === 'measureText' ? () => ({ width: 20 }) : () => {} });
    globalThis.document = { addEventListener() {}, removeEventListener() {}, createElement: () => ({ width: 256, height: 256, getContext: () => context }) };
    const engine = new NullEngine(), scene = new Scene(engine), house = freshState().house;
    let previous = createHouseModel(scene, house, 'studio');
    const modelRef = new WeakRef(previous), selectionRef = new WeakRef(previous.pieces.get('selection').mesh);
    const garden = createHouseModel(scene, house, 'orchard', 'day', undefined, previous);
    assert.equal(garden.pieces.get('studio').mesh, previous.pieces.get('studio').mesh);
    previous.dispose(); previous = null;
    for (let i = 0; i < 5; i++) { await new Promise(setImmediate); globalThis.gc(); }
    assert.equal(modelRef.deref() === undefined, true, 'the old model can be collected while the garden stays alive');
    assert.equal(selectionRef.deref() === undefined, true, 'the disposed room selection can be collected');
    assert.ok(garden.meshes.every(mesh => !mesh.isDisposed()));
    garden.dispose(); scene.dispose(); engine.dispose();
  `], { cwd: new URL('../../../', import.meta.url), timeout: 30000, stdio: 'pipe' });
});
