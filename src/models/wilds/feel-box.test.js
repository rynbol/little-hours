import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Vector3 } from 'three';
import { createFeelBox } from './feel-box.js';
import { createFeelSimulation } from '../../core/wilds/feel.js';
import { heightAt } from '../../core/world-terrain.js';

test('the full dodge keeps the capsule above the ground and preserves the sword length', () => {
  const scene = new Scene();
  const model = createFeelBox(scene);
  const simulation = createFeelSimulation();
  let capsule, blade;
  scene.traverse(object => {
    if (object.geometry?.type === 'CapsuleGeometry') capsule = object;
    const dimensions = object.geometry?.parameters;
    if (object.geometry?.type === 'BoxGeometry' && dimensions.width === .095 && dimensions.height === .045 && dimensions.depth === 1) blade = object;
  });
  assert.ok(capsule, 'player capsule exists');
  assert.ok(blade, 'sword blade exists');
  blade.geometry.computeBoundingBox();
  const bounds = blade.geometry.boundingBox;
  const bladeLength = () => new Vector3(0, 0, bounds.min.z).applyMatrix4(blade.matrixWorld).distanceTo(new Vector3(0, 0, bounds.max.z).applyMatrix4(blade.matrixWorld));
  model.update(simulation.state, 0, false);
  scene.updateMatrixWorld(true);
  const idleLength = bladeLength();
  assert.ok(idleLength > .9, 'idle sword has its full visible length');
  simulation.step(1e-6, { dodge: true, moveZ: -1 });
  const vertices = capsule.geometry.attributes.position;
  const vertex = new Vector3();
  const sampledPhases = new Set();
  let samples = 0;
  while (simulation.state.action.kind === 'dodge') {
    model.update(simulation.state, 1 / 240, false);
    scene.updateMatrixWorld(true);
    const progress = simulation.state.action.progress;
    sampledPhases.add(Math.floor(progress * 4));
    for (let index = 0; index < vertices.count; index++) {
      vertex.fromBufferAttribute(vertices, index).applyMatrix4(capsule.matrixWorld);
      const floor = heightAt(vertex.x, vertex.z);
      assert.ok(vertex.y >= floor - 1e-6, `capsule vertex ${index} intersects the floor at roll progress ${progress}`);
    }
    assert.ok(Math.abs(bladeLength() - idleLength) < 1e-6, `sword changes length at roll progress ${progress}`);
    samples++;
    assert.ok(samples < 110, 'dodge finishes within its duration');
    simulation.step(1 / 240);
  }
  assert.ok(samples >= 100, 'all phases of the full roll were sampled');
  assert.deepEqual([...sampledPhases], [0, 1, 2, 3]);
  model.update(simulation.state, 0, false);
  scene.updateMatrixWorld(true);
  assert.ok(Math.abs(bladeLength() - idleLength) < 1e-6, 'sword retains its length after returning to idle');
});
