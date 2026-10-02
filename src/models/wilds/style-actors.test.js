import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { AssetContainer } from '@babylonjs/core/assetContainer.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Animation } from '@babylonjs/core/Animations/animation.js';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { loadStyleActors, createStylePaint } from './style-actors.js';

function fixture() {
  const engine = new NullEngine(), scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  new FreeCamera('fixture-camera', new Vector3(0, 2, 5), scene);
  const containers = [], paths = [];
  async function loadContainer(path) {
    paths.push(path);
    const container = new AssetContainer(scene), rig = new TransformNode('authored-rig', scene);
    const mesh = CreateBox('authored-mesh', { width: .4, depth: .4, height: 1 }, scene);
    mesh.position.y = .5; mesh.parent = rig;
    const material = new PBRMaterial('authored-cloth', scene);
    material.albedoColor = Color3.FromHexString('#b27848').toLinearSpace(true);
    mesh.material = material;
    const animation = new Animation('authored-idle', 'rotation.y', 24, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);
    animation.setKeys([{ frame: 0, value: .12 }, { frame: 24, value: .12 }]);
    const group = new AnimationGroup('idle', scene);
    group.addTargetedAnimation(animation, rig);
    Object.assign(container, { rootNodes: [rig], transformNodes: [rig], meshes: [mesh], materials: [material], animationGroups: [group] });
    container.removeAllFromScene();
    containers.push(container);
    return container;
  }
  return { engine, scene, containers, paths, loadContainer, dispose() { scene.dispose(); engine.dispose(); } };
}

test('the style loader shows all three authored actors, preserves their colors, and holds the Blender idle pose', async () => {
  const f = fixture();
  try {
    const actors = await loadStyleActors(f.scene, { loadContainer: f.loadContainer });
    actors.place({ avatar: { x: 3, z: 4, yaw: .6 }, cat: { x: 4, z: 3 }, warden: { x: 6, z: 5 } }, () => ({ height: 2 }));
    f.scene.render();
    assert.deepEqual(f.paths.sort(), ['/wilds/style-avatar.glb', '/wilds/style-cat.glb', '/wilds/style-warden.glb']);
    assert.deepEqual(actors.diagnostics().avatar.pose, { x: 3, y: 2.006, z: 4, yaw: .6, normal: [0, 1, 0] });
    assert.deepEqual(actors.diagnostics().cat.clips, ['idle']);
    assert.equal(actors.diagnostics().warden.source, 'style-warden.glb');
    const color = actors.diagnostics().avatar.materials[0].albedo;
    assert.ok(color.every((value, i) => Math.abs(value - [178 / 255, 120 / 255, 72 / 255][i]) < .00001));
    assert.equal(f.containers[0].transformNodes[0].rotation.y, .12);
    assert.equal(f.containers[0].animationGroups[0].isPlaying, false);
    assert.equal(f.containers[0].meshes[0].material.getClassName(), 'ShaderMaterial');
    actors.setSubject('cat');
    assert.equal(actors.actors.cat.root.isEnabled(), true);
    assert.equal(actors.actors.cat.shadow.isEnabled(), true);
    assert.equal(actors.actors.avatar.root.isEnabled(), false);
    actors.setSubject('group', { shadows: false });
    assert.equal(actors.actors.avatar.root.isEnabled(), true);
    assert.equal(actors.actors.cat.shadow.isEnabled(), false);
    actors.dispose(); actors.dispose();
    assert.equal(actors.diagnostics().warden.disposed, true);
    assert.equal(f.scene.meshes.length, 0);
    assert.equal(f.scene.transformNodes.length, 0);
  } finally { f.dispose(); }
});

test('contact shadows follow the sampled ground and the whole actor aligns to its slope', async () => {
  const f = fixture();
  try {
    const actors = await loadStyleActors(f.scene, { loadContainer: f.loadContainer });
    const surfaceAt = (x, z) => ({ height: 2 + x * .2 - z * .1 });
    actors.place({ avatar: { x: 3, z: 4, yaw: .6 } }, surfaceAt);
    const actor = actors.actors.avatar, positions = actor.shadow.getVerticesData('position');
    assert.ok(positions.length > 100);
    for (let i = 0; i < positions.length; i += 3) assert.ok(Math.abs(positions[i + 1] - surfaceAt(positions[i], positions[i + 2]).height - .012) < .000001);
    const upright = new Vector3(0, 1, 0).rotateByQuaternionToRef(actor.root.rotationQuaternion, new Vector3());
    assert.ok(Math.abs(upright.x + .19518) < .00001);
    assert.ok(Math.abs(upright.z - .09759) < .00001);
    assert.ok(Math.abs(actor.root.position.y - 2.206) < .000001);
    actors.dispose();
  } finally { f.dispose(); }
});

test('theme changes use the Forest atmosphere while retaining the authored albedo', () => {
  const f = fixture();
  try {
    const source = new PBRMaterial('clay', f.scene);
    source.albedoColor = Color3.FromHexString('#cf956f').toLinearSpace(true);
    const material = createStylePaint(f.scene, source, 'day');
    const before = material.paint._colors3.albedo.asArray();
    assert.deepEqual(before, source.albedoColor.asArray());
    assert.equal(material.paint.metadata.colorSpace, 'linear');
    assert.ok(material.paint._colors3.skyFill.b > material.paint._colors3.skyFill.r);
    assert.ok(material.paint._colors3.groundFill.r > material.paint._colors3.groundFill.b);
    material.setTheme('dusk');
    assert.equal(material.paint._colors3.keyColor.toGammaSpace(true).toHexString(), '#FFD49C');
    assert.equal(material.paint._floats.sunStrength, 1);
    assert.ok(material.paint._colors3.groundFill.r > material.paint._colors3.groundFill.b);
    assert.equal(material.paint._floats.rimStrength, .2);
    assert.equal(material.paint._floats.fogDensity, .00042);
    material.setTheme('rain');
    assert.equal(material.paint._colors3.keyColor.toGammaSpace(true).toHexString(), '#C8CCC0');
    assert.equal(material.paint._floats.sunStrength, .4);
    assert.equal(material.paint._floats.rimStrength, .1);
    assert.deepEqual(material.paint._colors3.albedo.asArray(), before);
    material.paint.dispose();
  } finally { f.dispose(); }
});

test('a missing authored idle clip rejects the set and disposes every loaded actor', async () => {
  const f = fixture();
  try {
    await assert.rejects(loadStyleActors(f.scene, { loadContainer: async path => {
      const container = await f.loadContainer(path);
      if (path.includes('cat')) { container.animationGroups[0].dispose(); container.animationGroups = []; }
      return container;
    } }), /style cat is missing its authored idle clip/);
    assert.equal(f.containers.length, 3);
    assert.equal(f.scene.meshes.length, 0);
    assert.equal(f.scene.transformNodes.length, 0);
    assert.equal(f.scene.materials.some(material => material.name.startsWith('wilds-style-')), false);
  } finally { f.dispose(); }
});

test('aborting a loaded actor set releases its renderable nodes', async () => {
  const f = fixture(), controller = new AbortController();
  try {
    const actors = await loadStyleActors(f.scene, { loadContainer: f.loadContainer, signal: controller.signal });
    actors.setSubject('warden');
    assert.equal(actors.actors.warden.root.isEnabled(), true);
    controller.abort();
    assert.equal(actors.diagnostics().warden.disposed, true);
    assert.equal(f.scene.meshes.length, 0);
    actors.dispose();
  } finally { f.dispose(); }
});
