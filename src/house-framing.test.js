import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { Ray } from '@babylonjs/core/Culling/ray.js';
import { Camera } from '@babylonjs/core/Cameras/camera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { houseFrame } from './house-framing.js';
import { createHouseModel, HOUSE_POSITIONS } from './house-model.js';
import { createHouseMotion } from './house-motion.js';
import { createHouse } from './house.js';
import { createLayout } from './layout.js';
import { AVATAR_DEFAULT } from './avatar.js';
import { createFurniture } from './furniture.js';

test('the opening dollhouse keeps all authored geometry framed, picking follows the room, saves stay intact', () => {
  const oldDocument = globalThis.document;
  const context = new Proxy({}, {get: (_, key) => String(key).includes('Gradient') ? () => ({addColorStop() {}}) : key === 'measureText' ? () => ({width:20}) : () => {}});
  globalThis.document = {addEventListener() {}, removeEventListener() {}, createElement: () => ({width:256,height:256,getContext:()=>context})};
  const engine = new NullEngine(), scene = new Scene(engine); scene.useRightHandedSystem = true;
  const camera = new ArcRotateCamera('test-camera', 1.12, 1.02, 32, new Vector3(0, 1.3, 0), scene); camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  const house = createHouse(createLayout());
  house.rooms.push({id:'garden',name:'Tea',layout:createLayout('sakura-studio')}, {id:'loft',name:'Clouds',layout:createLayout('cloud-loft')});
  const saved = JSON.stringify(house);
  const appearance = { ...AVATAR_DEFAULT, skin: 'deep', hair: 'silver', style: 'waves', top: 'rose', accessory: 'glasses' };
  const model = createHouseModel(scene, house, 'studio', 'day', appearance);
  try {
    const reference = createFurniture('study-desk', scene, appearance);
    const colors = root => Array.from(root.metadata.avatarHead.getChildMeshes()[0].getVerticesData('color'));
    assert.deepEqual(colors(model.live[0]), colors(reference), 'the overview wears the same saved avatar appearance as the room');
    reference.dispose(false, false);
    const loft = model.meshes.find(m => m.metadata.houseSlot === 'loft');
    const studio = model.meshes.find(m => m.metadata.houseSlot === 'studio');
    const meshCount = scene.meshes.length;
    for (const aspect of [.45, .75, 1.5, 2.5]) for (const opened of [0, .5, 1]) for (const alpha of [.65, 1.12, 1.45]) {
      model.setOpen(opened); camera.alpha = alpha;
      const frame = houseFrame(model.framing, camera.getViewMatrix(true), aspect, .92);
      camera.orthoLeft = frame.x - frame.height * aspect / 2; camera.orthoRight = frame.x + frame.height * aspect / 2;
      camera.orthoBottom = frame.y - frame.height / 2; camera.orthoTop = frame.y + frame.height / 2;
      camera.getProjectionMatrix(true); const matrix = camera.getTransformationMatrix();
      const point = new Vector3(), projected = new Vector3();
      for (const mesh of model.meshes) {
        const vertices = mesh.getVerticesData('position'), world = mesh.computeWorldMatrix(true);
        let maximum = 0;
        for (let i = 0; i < vertices.length; i += 3) {
          point.set(vertices[i],vertices[i+1],vertices[i+2]); Vector3.TransformCoordinatesToRef(point, world, projected);
          Vector3.TransformCoordinatesToRef(projected, matrix, point);
          maximum = Math.max(maximum, Math.abs(point.x), Math.abs(point.y));
        }
        assert.ok(maximum <= .921, `${mesh.name} stays within the view at ${aspect}/${opened}/${alpha}`);
      }
      assert.equal(scene.meshes.length, meshCount, 'changing the view creates no geometry');
      assert.equal(studio.getWorldMatrix().getTranslation().length(), 0, 'the rooms stay in place');
      assert.equal(loft.getWorldMatrix().getTranslation().length(), 0, 'the upper floor stays in place');
    }
    const front = model.meshes.find(m => m.name === 'house-outside-garden-front');
    model.setOpen(0); const shut = front.getBoundingInfo().boundingBox.maximumWorld.z;
    model.setOpen(1);
    assert.ok(front.getBoundingInfo().boundingBox.maximumWorld.z > shut + 3, 'the garden front swings out');
    const hit = scene.pickWithRay(new Ray(new Vector3(-2.55, 12, -.45), new Vector3(0, -1, 0)), mesh => mesh.metadata?.houseSlot === 'loft');
    assert.equal(hit.pickedMesh?.metadata.houseSlot, 'loft', 'picking finds the upper floor of the open house');
    model.setOpen(0);
    assert.ok(Math.abs(front.getBoundingInfo().boundingBox.maximumWorld.z - shut) < 1e-6, 'closing restores the front');
    const motion = createHouseMotion(HOUSE_POSITIONS); motion.bind(model);
    for (const aspect of [.45, 1.5, 2.5]) for (const opened of [0, 1]) for (const alpha of [.65, 1.45]) {
      motion.stop(); model.setOpen(opened); camera.alpha = alpha;
      const frame = houseFrame(model.framing, camera.getViewMatrix(true), aspect, .92);
      camera.orthoLeft = frame.x - frame.height * aspect / 2; camera.orthoRight = frame.x + frame.height * aspect / 2;
      camera.orthoBottom = frame.y - frame.height / 2; camera.orthoTop = frame.y + frame.height / 2;
      camera.getProjectionMatrix(true); const matrix = camera.getTransformationMatrix();
      for (const kind of ['select', 'design', 'build']) for (const time of [0, 220, 340, 580]) {
        motion.stop();
        for (const id of Object.keys(HOUSE_POSITIONS)) motion.trigger(id, kind, 0);
        motion.update(time);
        for (const mesh of model.meshes) {
          const vertices = mesh.getVerticesData('position'), world = mesh.computeWorldMatrix(true);
          const point = new Vector3(), projected = new Vector3(); let maximum = 0;
          for (let i = 0; i < vertices.length; i += 3) {
            point.set(vertices[i], vertices[i + 1], vertices[i + 2]); Vector3.TransformCoordinatesToRef(point, world, projected);
            Vector3.TransformCoordinatesToRef(projected, matrix, point);
            maximum = Math.max(maximum, Math.abs(point.x), Math.abs(point.y));
          }
          assert.ok(maximum <= 1, `${mesh.name} remains visible during ${kind} at ${aspect}/${opened}/${alpha}/${time}: ${maximum}`);
        }
      }
    }
    motion.stop(); model.setOpen(1); motion.trigger('loft', 'select', 0); motion.update(340);
    assert.equal(scene.pickWithRay(new Ray(new Vector3(-2.55, 12, -.45), new Vector3(0, -1, 0)), mesh => mesh === loft).pickedMesh, loft, 'picking follows a bouncing room');
    motion.dispose();
    assert.equal(JSON.stringify(house), saved);
  } finally { model.dispose(); scene.dispose(); engine.dispose(); globalThis.document = oldDocument; }
});
