import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { createPetBelongings } from './pet-belongings.js';
import { PET_BELONGINGS, PET_FOODS } from '../../core/pet-care.js';

test('pet belongings keep finite geometry and reuse their mesh and material budget across purchases', () => {
  const engine = new NullEngine(), scene = new Scene(engine), parent = new TransformNode('room', scene);
  const start = [scene.meshes.length, scene.materials.length], props = createPetBelongings(scene, parent);
  for (const species of Object.keys(PET_FOODS)) for (const fabric of PET_BELONGINGS) for (const food of ['supper', 'crunch']) {
    props.setStyle({ fabric: fabric.id, food }, species);
    assert.deepEqual([scene.meshes.length, scene.materials.length], [start[0] + 4, start[1] + 1]);
    for (const mesh of [props.blanket, props.bowl, props.food, props.toy]) {
      assert.equal(mesh.parent, parent); assert.equal(mesh.isPickable, false);
      const positions = mesh.getVerticesData('position'), normals = mesh.getVerticesData('normal'), colors = mesh.getVerticesData('color');
      assert.ok(positions.length > 0 && positions.every(Number.isFinite));
      assert.equal(normals.length, positions.length); assert.equal(colors.length, positions.length / 3 * 4);
      assert.ok(mesh.getIndices().every(i => i >= 0 && i < positions.length / 3));
      for (let i = 0; i < normals.length; i += 3) assert.ok(Math.abs(Math.hypot(normals[i], normals[i + 1], normals[i + 2]) - 1) < .001);
    }
  }
  const vertices = props.blanket.getVerticesData('position'); props.setStyle({ fabric: 'blue', food: 'crunch' }, 'panda');
  assert.equal(props.blanket.getVerticesData('position'), vertices);
  props.dispose(); assert.deepEqual([scene.meshes.length, scene.materials.length], start);
  scene.dispose(); engine.dispose();
});

test('a meal stays in its floor bowl, empties visibly, and leaves an owned blanket on the bed', () => {
  const engine = new NullEngine(), scene = new Scene(engine), props = createPetBelongings(scene);
  props.setStyle({ fabric: 'rose', food: 'supper' }, 'cat');
  const bed = { x: 1, z: 2, rotation: 1 }, dining = { prop: { x: 2, z: 3 } };
  const show = (care, reduced = false, editing = false) => props.update({ care }, bed, dining, .2, .08, reduced, editing);
  show(null); assert.equal(props.blanket.isEnabled(), true); assert.equal(props.bowl.isEnabled(), true); assert.equal(props.food.isEnabled(), false); assert.equal(props.toy.isEnabled(), false);
  assert.deepEqual(props.blanket.position.asArray(), [1, .2, 2]); assert.equal(props.blanket.rotation.y, Math.PI / 2);
  const meal = { kind: 'treat', phase: 'active', age: 0, prop: dining.prop };
  show(meal); const bowl = props.bowl.position.asArray(); assert.equal(props.food.isEnabled(), true); assert.equal(props.food.scaling.x, 1);
  show({ ...meal, age: 4 }); assert.deepEqual(props.bowl.position.asArray(), bowl); assert.ok(props.food.scaling.x < .21);
  show({ ...meal, phase: 'content' }); assert.equal(props.food.isEnabled(), false);
  show({ ...meal, kind: 'play', age: 1 }); assert.equal(props.toy.isEnabled(), true); assert.equal(props.bowl.isEnabled(), false);
  show({ ...meal, kind: 'play', age: 1 }, true); const still = props.toy.position.asArray();
  show({ ...meal, kind: 'play', age: 2 }, true); assert.deepEqual(props.toy.position.asArray(), still);
  show(meal, false, true); assert.equal(props.food.isEnabled(), false); assert.equal(props.bowl.isEnabled(), false);
  props.dispose(); scene.dispose(); engine.dispose();
});
