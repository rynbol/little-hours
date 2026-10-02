import { test } from 'node:test';
import assert from 'node:assert/strict';
import { terrainRing } from './terrain-mesh.js';
import { WILDS_WORLD } from '../../core/wilds/world-definition.js';

test('terrain workers apply serialized definitions, ring layouts and translated centers', async () => {
  const original = globalThis.self, posted = [];
  globalThis.self = { postMessage: (data, transfers) => posted.push({ data, transfers }) };
  try {
    await import('./terrain-worker.js');
    const rings = [{ minX: -8, maxX: 8, minZ: -8, maxZ: 8, step: 2 }], center = { x: 32, z: -64 };
    self.onmessage({ data: { job: 'ring', index: 0, rings, center, definition: WILDS_WORLD } });
    assert.deepEqual(posted[0].data, terrainRing(0, rings, WILDS_WORLD, center));
    assert.equal(posted[0].data.positions[0], 24);
    assert.equal(posted[0].transfers.length, 4);
    self.onmessage({ data: { job: 'grass', layers: [{ period: 16, blades: 3 }] } });
    assert.equal(posted[1].data.positions.length, 45);
    assert.equal(posted[1].data.indices.length, 27);
  } finally { if (original === undefined) delete globalThis.self; else globalThis.self = original; }
});
