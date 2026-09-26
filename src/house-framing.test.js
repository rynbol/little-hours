import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { Ray } from '@babylonjs/core/Culling/ray.js';
import { Camera } from '@babylonjs/core/Cameras/camera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { houseFrame } from './house-framing.js';
import { createHouseModel } from './house-model.js';
import { createHouse } from './house.js';
import { createLayout } from './layout.js';

test('opened floors keep all authored geometry framed, picking follows the room, saves stay intact', () => {
  const oldDocument = globalThis.document;
  const context = new Proxy({}, {get: (_, key) => String(key).includes('Gradient') ? () => ({addColorStop() {}}) : key === 'measureText' ? () => ({width:20}) : () => {}});
  globalThis.document = {addEventListener() {}, removeEventListener() {}, createElement: () => ({width:256,height:256,getContext:()=>context})};
  const engine = new NullEngine(), scene = new Scene(engine); scene.useRightHandedSystem = true;
  const camera = new ArcRotateCamera('test-camera', 1.12, 1.02, 32, new Vector3(0, 1.3, 0), scene); camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  const house = createHouse(createLayout());
  house.rooms.push({id:'garden',name:'Tea',layout:createLayout('sakura-studio')}, {id:'loft',name:'Clouds',layout:createLayout('cloud-loft')});
  const saved = JSON.stringify(house);
  const model = createHouseModel(scene, house, 'studio');
  try {
    const loft = model.meshes.find(m => m.metadata.houseSlot === 'loft');
    const studio = model.meshes.find(m => m.metadata.houseSlot === 'studio');
    const meshCount = scene.meshes.length;
    for (const aspect of [.45, .75, 1.5, 2.5]) for (const opened of [0, .5, 1]) for (const alpha of [.65, 1.12, 1.45]) {
      model.setOpenFloors(opened, aspect < 1.15); camera.alpha = alpha;
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
      assert.equal(studio.getWorldMatrix().getTranslation().length(), 0, 'ground floor stays in place');
    }
    model.setOpenFloors(1, false);
    assert.ok(loft.getBoundingInfo().boundingBox.maximumWorld.x < studio.getBoundingInfo().boundingBox.minimumWorld.x + .2, 'opened upper floor clears the studio');
    const hit = scene.pickWithRay(new Ray(new Vector3(-8, 9, 0), new Vector3(0, -1, 0)), mesh => mesh === loft);
    assert.equal(hit.pickedMesh?.metadata.houseSlot, 'loft', 'picking follows the unfolded upper floor');
    model.setOpenFloors(0);
    assert.equal(loft.getWorldMatrix().getTranslation().length(), 0, 'dollhouse restores the original home');
    assert.equal(JSON.stringify(house), saved);
  } finally { model.dispose(); scene.dispose(); engine.dispose(); globalThis.document = oldDocument; }
});
