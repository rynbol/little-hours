import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { createWindowLightning } from './window-lightning.js';
import { createWindowSpill } from './room-window-spill.js';
import { ROOM_LIGHTS } from './room-lighting.js';

function setup() {
  const engine = new NullEngine(), room = new Scene(engine), outdoor = new Scene(engine), spill = createWindowSpill(room, new TransformNode('room', room)), backdrop = new StandardMaterial('view', room), thunder = [];
  spill.setLight(ROOM_LIGHTS.rain.wallSpill);
  const storm = createWindowLightning({ outdoor, spill, backdrop: () => backdrop, onThunder: delay => thunder.push(delay), random: () => 0.5 });
  return { engine, room, outdoor, spill, backdrop, thunder, storm, dispose() { room.dispose(); outdoor.dispose(); engine.dispose(); } };
}

test('a strike lights the far sky, the window wall in the chair and the dollhouse backdrop in cool light, then all of it goes dark', () => {
  const s = setup();
  try {
    s.storm.update(0, true, false); s.storm.strike();
    s.storm.update(1, true, false); s.storm.update(1.05, true, false);
    assert.ok(s.outdoor.getMeshByName('world-lightning-glow').isEnabled(false), 'the sky flash draws');
    assert.equal(s.spill.mesh.material._floats.flash, 0, 'no wall flash in the dollhouse view');
    s.spill.show(1); s.storm.update(1.06, true, false);
    assert.ok(s.spill.mesh.material._floats.flash > 0.5, `wall flash ${s.spill.mesh.material._floats.flash}`);
    const lift = s.backdrop.emissiveColor;
    assert.ok(lift.b > lift.r && lift.b > 0.2 && lift.b < 0.6, `cool backdrop lift ${lift.toHexString()}`);
    assert.deepEqual(s.thunder.map(delay => Math.round(delay)), [13]);
    s.storm.update(5, true, false);
    assert.equal(s.outdoor.meshes.filter(mesh => mesh.isEnabled(false)).length, 0);
    assert.equal(s.spill.mesh.material._floats.flash, 0);
    assert.equal(s.backdrop.emissiveColor.toHexString(), '#000000');
  } finally { s.dispose(); }
});

test('under reduced motion a requested strike lights nothing and makes no thunder', () => {
  const s = setup();
  try {
    s.spill.show(1);
    for (let t = 0; t < 60; t += 0.1) { s.storm.strike(); s.storm.update(t, true, true); }
    assert.equal(s.outdoor.meshes.filter(mesh => mesh.isEnabled(false)).length, 0);
    assert.equal(s.spill.mesh.material._floats.flash, 0);
    assert.equal(s.backdrop.emissiveColor.toHexString(), '#000000');
    assert.deepEqual(s.thunder, []);
  } finally { s.dispose(); }
});
