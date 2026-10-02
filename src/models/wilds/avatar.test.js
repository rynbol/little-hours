import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Ray } from '@babylonjs/core/Culling/ray.js';
import { AVATAR_OPTIONS } from '../../core/avatar.js';
import { createMovementState, stepMovement, obstacleRadiusBetween, WILDS_MOVEMENT } from '../../core/wilds/movement.js';
import { loadWildsAvatar, wildsAvatarClip } from './avatar.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { meadowRocks, rockCollider } from '../world/rocks.js';

const ROCK_PROFILES = [
  { x: 5.5, z: -8, size: [1.9, 1.15, 1.6], seat: true, climbable: true, turn: .4 },
  { x: 20, z: -8, size: [1.8, 1.2, 1.5], climbable: true, turn: 3 },
  { x: 35, z: -8, size: [2.6, 1.4, 2], climbable: true, turn: 2.2 },
];

function climbingFixture(scene) {
  const surfaceAt = () => ({ height: 0, normal: { x: 0, y: 1, z: 0 } });
  const material = new StandardMaterial('fixture-stone', scene);
  const outcrop = CreateCylinder('fixture-outcrop', { diameterBottom: 5, diameterTop: 5.2, height: 5.5, tessellation: 64 }, scene);
  outcrop.material = material;
  outcrop.position.set(-9, 2.75, -42); outcrop.computeWorldMatrix(true);
  const rocks = new Mesh('fixture-rocks', scene);
  rocks.material = material;
  Object.assign(new VertexData(), meadowRocks(ROCK_PROFILES, surfaceAt)).applyToMesh(rocks);
  const obstacles = ROCK_PROFILES.map((rock, index) => ({ id: `profile-${index}`, x: rock.x, z: rock.z, ...rockCollider(rock, index), baseY: 0, climbable: true }));
  obstacles.push({ id: 'fixture-outcrop', x: -9, z: -42, radius: 2.5, height: 5.5, baseY: 0, climbable: true });
  return { surfaceAt, obstacles, dispose() { outcrop.dispose(); rocks.dispose(); material.dispose(); } };
}

const avatarManifest = JSON.parse(readFileSync(new URL('../../../public/wilds/avatar-manifest.json', import.meta.url)));
const assetSource = new Uint8Array(readFileSync(new URL('../../../public/wilds/avatar.glb', import.meta.url)));

async function fixture(t, options = {}) {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  t.after(() => engine.dispose());
  const avatar = await loadWildsAvatar(scene, { assetSource, ...options });
  return { engine, scene, avatar };
}

function bonePosition(scene, name) {
  for (const node of scene.transformNodes) node.computeWorldMatrix(true);
  return scene.getTransformNodeByName(name).getAbsolutePosition().clone();
}

test('the loader selects every authored action and falls back from physical movement', () => {
  assert.equal(wildsAvatarClip({ speed: 4.8 }), 'walk');
  assert.equal(wildsAvatarClip({ speed: 8.5 }), 'run');
  assert.equal(wildsAvatarClip({ speed: 0 }), 'idle');
  assert.equal(wildsAvatarClip({ action: 'jump', grounded: false, speed: 4.8 }), 'jump');
  assert.equal(wildsAvatarClip({ action: 'climb', grounded: false }), 'climb');
  assert.equal(wildsAvatarClip({ action: 'unknown', grounded: false }), 'fall');
  assert.equal(wildsAvatarClip({ action: 'sprint' }), 'run');
});

test('the real Blender avatar switches every silhouette option and paints all seven palette slots', async t => {
  const { scene, avatar } = await fixture(t);
  assert.equal(avatar.diagnostics().skeletons, 1);
  for (const part of ['style', 'outfit', 'bottomStyle', 'accessory']) {
    for (const { id } of AVATAR_OPTIONS[part]) {
      avatar.setAppearance({ [part]: id });
      const selected = avatar.diagnostics().activeVariants.filter(name => name.startsWith(`variant.${part}.`));
      assert.deepEqual(selected, id === 'none' ? [] : [`variant.${part}.${id}`]);
      if (id !== 'none') {
        const prefix = `variant.${part}.${id}`;
        const rendered = scene.meshes.filter(mesh => mesh.name === prefix || mesh.name.startsWith(`${prefix}_primitive`));
        assert.ok(rendered.reduce((sum, mesh) => sum + (mesh.isEnabled() ? mesh.getTotalVertices() : 0), 0) > 20, `${prefix} must render its skinned primitives`);
        for (const mesh of rendered) {
          assert.equal(mesh.isEnabled(), true, mesh.name);
          for (let ancestor = mesh.parent; ancestor; ancestor = ancestor.parent) assert.equal(ancestor.isEnabled(), true, ancestor.name);
        }
      }
    }
  }
  avatar.setAppearance({ skin: 'deep', hair: 'silver', top: 'sky', bottom: 'plum' });
  for (const [name, expected] of [['skin', '#68432F'], ['hair', '#B1A99B'], ['top', '#718DA0'], ['top-shade', '#5B7587'], ['top-trim', '#A0B8C3'], ['bottom', '#76576F'], ['bottom-trim', '#A78CA7']]) {
    assert.equal(scene.getMaterialByName(name).albedoColor.toGammaSpace().toHexString(), expected);
  }
  assert.equal(avatar.setAppearance({ style: 'missing' }).style, 'bun');
});

test('authored clips advance only with deltaMs and reset to identical poses', async t => {
  const { scene, avatar } = await fixture(t);
  avatar.reset('walk');
  const first = bonePosition(scene, 'foot.L');
  avatar.update({ action: 'walk', speed: 4.8, deltaMs: 50, elapsedMs: 98765 });
  const moved = bonePosition(scene, 'foot.L');
  assert.ok(Math.abs(moved.z - first.z - .24) < .002);
  assert.equal(avatar.diagnostics().actionElapsedMs, 50);
  for (let i = 0; i < 5; i++) {
    scene._animate(1000);
    avatar.update({ action: 'walk', speed: 4.8, deltaMs: 0, elapsedMs: 999999 });
  }
  assert.deepEqual(bonePosition(scene, 'foot.L').asArray(), moved.asArray());
  assert.equal(avatar.diagnostics().actionElapsedMs, 50);
  avatar.reset('walk');
  assert.deepEqual(bonePosition(scene, 'foot.L').asArray(), first.asArray());
  assert.equal(avatar.diagnostics().actionElapsedMs, 0);
  assert.equal(avatar.diagnostics().cyclePhase, 0);
});

test('walk and sprint feet stay planted during stance at controller speed', async t => {
  const { scene, avatar } = await fixture(t);
  for (const [action, speed] of [['walk', 4.8], ['run', 8.5]]) {
    avatar.root.position.set(0, 0, 0);
    avatar.reset(action);
    const planted = bonePosition(scene, 'foot.L');
    for (let i = 1; i <= 4; i++) {
      avatar.root.position.z = -speed * i / 60;
      avatar.update({ action, speed, deltaMs: 1000 / 60 });
      const foot = bonePosition(scene, 'foot.L');
      assert.ok(Math.abs(foot.z - planted.z) < .002, `${action} contact drifted at frame ${i}`);
      assert.ok(Math.abs(foot.y - .12) < .002, `${action} contact left the ground at frame ${i}`);
    }
  }
});

test('real movement starts walking and running without dragging the first planted foot', async t => {
  const { scene, avatar } = await fixture(t);
  const world = { surfaceAt: () => ({ height: 0, normal: { x: 0, y: 1, z: 0 } }), obstacles: [] };
  for (const sprint of [false, true]) {
    let player = createMovementState({ position: { x: 0, y: 0, z: 0 } });
    avatar.root.position.set(0, 0, 0);
    avatar.reset();
    const planted = bonePosition(scene, 'foot.L');
    for (let frame = 1; frame <= 2; frame++) {
      player = stepMovement(player, { forward: 1, sprint }, world, 1000 / 60, frame * 1000 / 60).state;
      avatar.root.position.set(player.position.x, player.position.y, player.position.z);
      avatar.update({ action: player.action, speed: player.speed, grounded: player.grounded, deltaMs: 1000 / 60 });
      scene._animate(0);
      const foot = bonePosition(scene, 'foot.L');
      assert.ok(Math.abs(foot.z - planted.z) < .005, `${player.action} start contact slid at frame ${frame}: ${foot.z}`);
      assert.ok(Math.abs(foot.y - .12) < .005, `${player.action} start contact left the surface at frame ${frame}: ${foot.y}`);
    }
  }
});

test('real movement releases either planted lead into a recovery without dragging its contact', async t => {
  const { scene, avatar } = await fixture(t);
  const world = { surfaceAt: () => ({ height: 0, normal: { x: 0, y: 1, z: 0 } }), obstacles: [] };
  for (const sprint of [false, true]) {
    const action = sprint ? 'run' : 'walk';
    const duration = (sprint ? 26 : 32) * 1000 / 60;
    for (const phase of [.04, .18, .54, .68]) {
      let player = createMovementState({ position: { x: 0, y: 0, z: 0 } });
      player = stepMovement(player, { forward: 1, sprint }, world, phase * duration, phase * duration).state;
      avatar.root.position.set(player.position.x, player.position.y, player.position.z);
      avatar.reset(action);
      avatar.update({ action, speed: player.speed, deltaMs: phase * duration });
      scene._animate(0);
      const side = phase < .5 ? 'L' : 'R';
      const planted = bonePosition(scene, `foot.${side}`);
      for (let frame = 1; frame <= 6; frame++) {
        player = stepMovement(player, {}, world, 1000 / 60, phase * duration + frame * 1000 / 60).state;
        avatar.root.position.set(player.position.x, player.position.y, player.position.z);
        avatar.update({ action: player.action, speed: player.speed, grounded: player.grounded, deltaMs: 1000 / 60 });
        scene._animate(0);
        const foot = bonePosition(scene, `foot.${side}`);
        assert.ok(Math.abs(foot.z - planted.z) < .005, `${action} ${side} stop at phase ${phase} slid at frame ${frame}: ${foot.z - planted.z}`);
        assert.ok(Math.abs(foot.y - .12) < .005, `${action} ${side} stop contact left the surface at frame ${frame}: ${foot.y}`);
      }
      avatar.update({ action: 'idle', speed: 0, deltaMs: 300 });
      scene._animate(0);
      for (const foot of ['foot.L', 'foot.R']) {
        assert.ok(Math.abs(bonePosition(scene, foot).y - .12) < .002);
        assert.ok(Math.abs(bonePosition(scene, foot).z - player.position.z) < .002);
      }
    }
  }
});

test('releasing a run during its entry blend keeps the complete skinning palette and posed meshes finite', async t => {
  const { scene, avatar } = await fixture(t);
  avatar.update({ action: 'idle', speed: 0, yaw: 0, deltaMs: 600 });
  scene._animate(0);
  for (let frame = 1; frame <= 12; frame++) {
    const running = frame <= 6;
    avatar.root.position.x = Math.min(frame, 6) * 8.5 / 60;
    avatar.update({ action: running ? 'run' : 'idle', speed: running ? 8.5 : 0, yaw: -Math.PI / 2, deltaMs: 1000 / 60 });
    scene._animate(0);
    for (const node of scene.transformNodes) node.computeWorldMatrix(true);
    for (const skeleton of scene.skeletons) {
      skeleton.prepare(true);
      assert.ok(Array.from(skeleton.getTransformMatrices()).every(Number.isFinite), `frame ${frame} must send a finite full bone palette to GPU skinning`);
    }
    for (const mesh of scene.meshes.filter(mesh => mesh.isEnabled() && mesh.skeleton)) {
      const positions = mesh.getPositionData(true, true);
      assert.ok(positions.length > 0);
      assert.ok(positions.every(Number.isFinite), `${mesh.name} has non-finite deformed vertices at frame ${frame}`);
      assert.ok(positions.every(value => Math.abs(value) < 3), `${mesh.name} left the avatar envelope at frame ${frame}`);
    }
  }
});

test('releasing a run with both feet airborne lowers them gradually into the recovery', async t => {
  const { scene, avatar } = await fixture(t);
  for (let frame = 1; frame <= 6; frame++) {
    avatar.root.position.z = -frame * 8.5 / 60;
    avatar.update({ action: 'run', speed: 8.5, deltaMs: 1000 / 60 });
    scene._animate(0);
  }
  let before = ['L', 'R'].map(side => bonePosition(scene, `foot.${side}`).y);
  assert.ok(before.every(height => height > .20));
  for (let frame = 1; frame <= 5; frame++) {
    avatar.update({ action: 'idle', speed: 0, deltaMs: 1000 / 60 });
    scene._animate(0);
    const after = ['L', 'R'].map(side => bonePosition(scene, `foot.${side}`).y);
    for (let side = 0; side < 2; side++) assert.ok(before[side] - after[side] < .06, `airborne foot ${side} drops abruptly at recovery frame ${frame}: ${before[side] - after[side]}`);
    before = after;
  }
  assert.ok(Math.abs(Math.min(...before) - .12) < .002);
});

test('climbing plants a hand and foot while the root rises at two metres per second', async t => {
  const { scene, avatar } = await fixture(t);
  avatar.reset('climb');
  const hand = bonePosition(scene, 'hand.R');
  const foot = bonePosition(scene, 'foot.L');
  for (let frame = 1; frame <= 6; frame++) {
    avatar.root.position.y = 2 * frame / 60;
    avatar.update({ action: 'climb', speed: 2, grounded: false, deltaMs: 1000 / 60 });
    assert.ok(Math.abs(bonePosition(scene, 'hand.R').y - hand.y) < .002);
    assert.ok(Math.abs(bonePosition(scene, 'foot.L').y - foot.y) < .002);
  }
});

test('climbing braces each whole sole on the hand contact plane through its planted phase', async t => {
  const { scene, avatar } = await fixture(t);
  for (const [side, offset] of [['L', 0], ['R', 250]]) {
    avatar.root.position.set(0, 0, 0);
    avatar.reset('climb');
    avatar.update({ action: 'climb', speed: 2, deltaMs: offset });
    const planted = bonePosition(scene, `foot.${side}`).y;
    for (let frame = 0; frame <= 15; frame++) {
      if (frame) {
        avatar.root.position.y = 2 * frame / 60;
        avatar.update({ action: 'climb', speed: 2, deltaMs: 1000 / 60 });
      }
      const foot = scene.getTransformNodeByName(`foot.${side}`);
      bonePosition(scene, `foot.${side}`);
      const toe = Vector3.TransformCoordinates(new Vector3(0, .20, -.12), foot.getWorldMatrix());
      const heel = Vector3.TransformCoordinates(new Vector3(0, -.09, -.12), foot.getWorldMatrix());
      assert.ok(Math.abs(toe.z + .34) < .005, `${side} toe needs the wall plane at frame ${frame}, got ${toe.z}`);
      assert.ok(Math.abs(heel.z + .34) < .005, `${side} heel needs the wall plane at frame ${frame}, got ${heel.z}`);
      assert.ok(Math.abs(foot.getAbsolutePosition().y - planted) < .002);
      assert.ok(bonePosition(scene, `shin.${side}`).z > -.34, `${side} knee must stay outside the wall`);
    }
  }
});

test('visual facing eases through the shortest turn while placement and paused time remain exact', async t => {
  const { avatar } = await fixture(t);
  avatar.update({ yaw: 0, deltaMs: 0 });
  avatar.update({ yaw: Math.PI / 2, deltaMs: 1000 / 60 });
  assert.ok(avatar.root.rotation.y > .1 && avatar.root.rotation.y < .25);
  const beforePause = avatar.root.rotation.y;
  avatar.update({ yaw: Math.PI / 2, deltaMs: 0 });
  assert.equal(avatar.root.rotation.y, beforePause);
  for (let frame = 0; frame < 24; frame++) avatar.update({ yaw: Math.PI / 2, deltaMs: 1000 / 60 });
  assert.ok(Math.abs(avatar.root.rotation.y - Math.PI / 2) < .025);
  avatar.reset();
  avatar.update({ yaw: Math.PI - .08, deltaMs: 0 });
  assert.equal(avatar.root.rotation.y, Math.PI - .08);
  avatar.update({ yaw: -Math.PI + .08, deltaMs: 16 });
  assert.ok(avatar.root.rotation.y > Math.PI - .08 && avatar.root.rotation.y < Math.PI);
  avatar.reset();
  avatar.update({ yaw: -1.1, deltaMs: 0 });
  assert.equal(avatar.root.rotation.y, -1.1);
});

test('climbing keeps a diagonal hand and foot braced throughout two complete cycles', async t => {
  const { scene, avatar } = await fixture(t);
  avatar.reset('climb');
  for (let frame = 0; frame <= 60; frame++) {
    if (frame) avatar.update({ action: 'climb', speed: 2, deltaMs: 1000 / 60 });
    const leftFoot = bonePosition(scene, 'foot.L'), rightFoot = bonePosition(scene, 'foot.R');
    const leftHand = bonePosition(scene, 'hand.L'), rightHand = bonePosition(scene, 'hand.R');
    const leftBrace = Math.abs(leftFoot.z + .22) < .002 && Math.abs(rightHand.z + .32) < .002;
    const rightBrace = Math.abs(rightFoot.z + .22) < .002 && Math.abs(leftHand.z + .32) < .002;
    assert.ok(leftBrace || rightBrace, `a diagonal brace must support frame ${frame}`);
  }
});

test('jump compression stays grounded before the synchronized takeoff pose', async t => {
  const { scene, avatar } = await fixture(t);
  for (const timeMs of [1000 / 60, 1000 / 30, 50, 200 / 3]) {
    avatar.update({ action: 'jump', grounded: true, deltaMs: 1000 / 60, actionTimeMs: timeMs });
    scene._animate(0);
    assert.ok(Math.abs(bonePosition(scene, 'foot.L').y - .12) < .002);
    assert.ok(Math.abs(bonePosition(scene, 'foot.R').y - .12) < .002);
    if (timeMs === 50) assert.ok(bonePosition(scene, 'pelvis').y < .73);
  }
  avatar.update({ action: 'jump', grounded: false, deltaMs: 1000 / 60, actionTimeMs: 400 / 3 });
  scene._animate(0);
  assert.equal(avatar.diagnostics().actionElapsedMs, 400 / 3);
  assert.ok(bonePosition(scene, 'foot.L').y > .18);
});

test('a real running jump keeps its planted lead through compression before lifting off', async t => {
  const { scene, avatar } = await fixture(t);
  const world = { surfaceAt: () => ({ height: 0, normal: { x: 0, y: 1, z: 0 } }), obstacles: [] };
  for (const runFrames of [12, 25]) {
    let player = createMovementState({ position: { x: 0, y: 0, z: 0 } });
    avatar.root.position.set(0, 0, 0);
    avatar.reset();
    let now = 0;
    function step(input) {
      now += 1000 / 60;
      player = stepMovement(player, input, world, 1000 / 60, now).state;
      avatar.root.position.set(player.position.x, player.position.y, player.position.z);
      avatar.update({ action: player.action, speed: player.speed, grounded: player.grounded, actionTimeMs: player.actionTimeMs, deltaMs: 1000 / 60 });
      scene._animate(0);
    }
    for (let frame = 0; frame < runFrames; frame++) step({ forward: 1, sprint: true });
    const side = runFrames === 12 ? 'R' : 'L';
    const planted = bonePosition(scene, `foot.${side}`);
    for (let frame = 1; frame <= 6; frame++) {
      step({ jump: frame === 1 });
      if (frame <= 4) {
        assert.equal(player.grounded, true);
        const foot = bonePosition(scene, `foot.${side}`);
        assert.ok(Math.abs(foot.z - planted.z) < .005, `${side} jump anticipation dragged its lead at frame ${frame}`);
        assert.ok(Math.abs(foot.y - .12) < .005);
      }
      if (frame === 3) assert.ok(bonePosition(scene, 'pelvis').y < .73);
      if (frame === 6) assert.ok(player.position.y > .10);
    }
  }
});

test('running carries the torso forward and brakes with hips back over an interruptible planted recovery', async t => {
  const { scene, avatar } = await fixture(t);
  avatar.reset('run');
  assert.ok(bonePosition(scene, 'pelvis').z < -.06);
  assert.ok(bonePosition(scene, 'head').z < -.20);
  avatar.update({ action: 'idle', speed: 0, deltaMs: 100 });
  scene._animate(0);
  assert.equal(avatar.diagnostics().action, 'stop');
  assert.ok(bonePosition(scene, 'pelvis').z > .07);
  assert.ok(Math.abs(bonePosition(scene, 'head').z) < .04);
  assert.ok(Math.abs(bonePosition(scene, 'foot.L').y - .12) < .002);
  avatar.update({ action: 'idle', speed: 0, deltaMs: 300 });
  scene._animate(0);
  assert.ok(Math.abs(bonePosition(scene, 'pelvis').y - .86) < .002);
  avatar.update({ action: 'run', speed: 8.5, deltaMs: 16 });
  assert.equal(avatar.diagnostics().action, 'run');
});

test('all stop anchors and both blended leads keep the upper body clear of the actual outcrop triangles', async t => {
  const { scene, avatar } = await fixture(t);
  const world = climbingFixture(scene);
  t.after(() => world.dispose());
  let player = createMovementState({ position: { x: -9, y: world.surfaceAt(-9, -31).height, z: -31 } });
  for (let frame = 1; frame <= 102; frame++) player = stepMovement(player, { forward: -1, cameraYaw: Math.PI }, world, 1000 / 60, frame * 1000 / 60).state;
  assert.ok(Math.abs(player.position.z + 39.16) < .01);
  avatar.root.position.set(player.position.x, player.position.y, player.position.z);
  avatar.root.rotation.y = 0;
  const stone = scene.getMeshByName('fixture-outcrop');
  function clearUpperBody(label) {
    scene._animate(0);
    for (const node of scene.transformNodes) node.computeWorldMatrix(true);
    for (const skeleton of scene.skeletons) skeleton.prepare(true);
    let checked = 0;
    for (const mesh of scene.meshes.filter(mesh => mesh.isEnabled() && mesh.skeleton)) {
      mesh.computeWorldMatrix(true);
      const positions = mesh.getPositionData(true, true);
      let front = null;
      for (let index = 0; index < positions.length; index += 3) {
        const vertex = Vector3.TransformCoordinates(Vector3.FromArray(positions, index), mesh.getWorldMatrix());
        if (vertex.y < player.position.y + 1) continue;
        if (!front || vertex.z < front.z) front = vertex;
      }
      if (!front) continue;
      assert.ok(front.z - player.position.z >= -.26, `${label} ${mesh.name} projects too far toward the wall: ${front.z - player.position.z}`);
      const ray = new Ray(new Vector3(front.x, front.y, player.position.z + .5), new Vector3(0, 0, -1), 1.5);
      const hit = ray.intersectsMesh(stone);
      assert.equal(hit.hit, true, `${label} must measure the real outcrop surface`);
      assert.ok(front.z - hit.pickedPoint.z > .005, `${label} ${mesh.name} penetrates the actual outcrop triangle`);
      checked++;
    }
    assert.ok(checked >= 3);
  }
  for (const action of ['stop', 'stop-back', 'stop-right', 'stop-right-back']) {
    avatar.reset(action);
    for (const timeMs of [100 / 3, 100, 550 / 3]) {
      avatar.update({ action, speed: 0, actionTimeMs: timeMs, deltaMs: 100 / 3 });
      clearUpperBody(`${action} at ${timeMs} ms`);
    }
  }
  for (const phase of [.04, .18, .54, .68]) {
    avatar.reset('walk');
    avatar.update({ action: 'walk', speed: 4.8, deltaMs: phase * 32 * 1000 / 60 });
    scene._animate(0);
    for (let frame = 1; frame <= 11; frame++) {
      avatar.update({ action: 'idle', speed: 0, deltaMs: 1000 / 60 });
      if ([2, 6, 11].includes(frame)) clearUpperBody(`walk phase ${phase} recovery frame ${frame}`);
      else scene._animate(0);
    }
  }
});

test('landing compresses at contact and settles with planted feet while falling changes balance', async t => {
  const { scene, avatar } = await fixture(t);
  avatar.reset('fall');
  const firstHand = bonePosition(scene, 'hand.L'), firstHead = bonePosition(scene, 'head');
  avatar.update({ action: 'fall', deltaMs: 200 });
  assert.ok(Math.abs(bonePosition(scene, 'hand.L').z - firstHand.z) > .035);
  assert.ok(Math.abs(bonePosition(scene, 'head').z - firstHead.z) > .025);
  avatar.update({ action: 'land', grounded: true, deltaMs: 200 / 3 });
  assert.ok(bonePosition(scene, 'pelvis').y < .66);
  for (const timeMs of [100, 200, 1000 / 3]) {
    avatar.update({ action: 'land', deltaMs: 1000 / 30, actionTimeMs: timeMs });
    assert.ok(Math.abs(bonePosition(scene, 'foot.L').y - .12) < .002);
    assert.ok(Math.abs(bonePosition(scene, 'foot.R').y - .12) < .002);
  }
  assert.ok(Math.abs(bonePosition(scene, 'pelvis').y - .86) < .002);
});

test('the short mantle keeps its ledge foot fixed through root lift and transfer before standing', async t => {
  const { scene, avatar } = await fixture(t);
  const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
  avatar.reset('mantle');
  for (let frame = 0; frame <= 27; frame++) {
    const timeMs = frame * 1000 / 60;
    avatar.root.position.y = .55 * smooth(timeMs / 247.5);
    avatar.root.position.z = -.46 * smooth((timeMs - 247.5) / 135);
    avatar.update({ action: 'mantle', mantleAdvance: .46, grounded: false, actionTimeMs: timeMs, deltaMs: frame ? 1000 / 60 : 0 });
    const left = bonePosition(scene, 'foot.L'), right = bonePosition(scene, 'foot.R');
    if (timeMs < 324) {
      assert.ok(Math.abs(left.y - .67) < .003, `ledge foot lift drift at ${timeMs}ms`);
      assert.ok(Math.abs(left.z + .32) < .003, `ledge foot forward drift at ${timeMs}ms`);
    }
    if (timeMs > 335) {
      assert.ok(Math.abs(right.y - .67) < .003);
      assert.ok(Math.abs(right.z + .46) < .003);
    }
  }
  assert.ok(Math.abs(bonePosition(scene, 'pelvis').y - 1.41) < .003);
  assert.ok(Math.abs(bonePosition(scene, 'foot.L').z + .46) < .003);
  assert.equal(avatar.diagnostics().cyclePhase, 1);
});

test('wide mantle transfers weight from its planted ledge boot to the final stance before rising', async t => {
  const { scene, avatar } = await fixture(t);
  const smooth = value => { const phase = Math.max(0, Math.min(1, value)); return phase * phase * (3 - 2 * phase); };
  avatar.reset('mantle-wide');
  for (let frame = 0; frame <= 39; frame++) {
    const timeMs = frame * 1000 / 60;
    const lift = smooth(timeMs / 247.5), transfer = smooth((timeMs - 247.5) / 252.5);
    avatar.root.position.set(0, .55 * lift, -avatarManifest.mantleMotion.wide.advanceMetres * transfer);
    avatar.update({ action: 'mantle-wide', grounded: false, actionTimeMs: timeMs, deltaMs: frame ? 1000 / 60 : 0 });
    const left = bonePosition(scene, 'foot.L'), right = bonePosition(scene, 'foot.R');
    if (timeMs < 400) {
      assert.ok(Math.abs(left.y - .67) < .003, `wide mantle sole leaves the ledge at ${timeMs}ms`);
      assert.ok(Math.abs(left.z + 1.10) < .003, `wide mantle support slides at ${timeMs}ms`);
    }
    if (timeMs > 410) {
      assert.ok(Math.abs(right.y - .67) < .003);
      assert.ok(Math.abs(right.z + 1.18) < .003);
    }
    if (timeMs > 200) assert.ok(bonePosition(scene, 'pelvis').y > Math.min(left.y, right.y) + .12, `wide mantle hips collapse through the boots at ${timeMs}ms`);
  }
  assert.ok(Math.abs(bonePosition(scene, 'pelvis').y - 1.41) < .003);
  assert.ok(Math.abs(bonePosition(scene, 'foot.L').z + 1.18) < .003);
});

test('playback blends changes, matches reduced movement speed, and holds non-looping endpoints', async t => {
  const { scene, avatar } = await fixture(t);
  avatar.update({ action: 'walk', speed: 2.4, deltaMs: 60 });
  const blend = avatar.diagnostics().animation;
  assert.deepEqual(blend.map(({ name, weight }) => [name, weight]), [['idle', .5], ['walk', .5]]);
  assert.equal(blend[1].speedRatio, .5);
  assert.ok(Math.abs(blend[1].frame - (32 * .12 + 1.8)) < .00001);
  scene._animate(0);
  assert.ok(Math.abs(bonePosition(scene, 'foot.L').y - .12) < .002);
  assert.ok(Math.abs(bonePosition(scene, 'foot.L').z - .144) < .002);
  const walking = scene.getAnimationGroupByName('walk');
  assert.equal(walking.animatables.find(animation => animation.target.name === 'spine').weight, .5);
  assert.equal(walking.animatables.find(animation => animation.target.name === 'foot.L').weight, 1);
  avatar.update({ action: 'walk', speed: 2.4, deltaMs: 60 });
  assert.equal(avatar.diagnostics().animation[0].name, 'walk');
  assert.equal(scene.getAnimationGroupByName('idle').animatables[0].weight, 0);
  assert.equal(scene.getAnimationGroupByName('walk').animatables[0].weight, 1);
  avatar.reset('land');
  avatar.update({ action: 'land', deltaMs: 1000 });
  const settled = bonePosition(scene, 'pelvis');
  assert.ok(Math.abs(avatar.diagnostics().animation[0].frame - 20) < .00001);
  assert.equal(avatar.diagnostics().cyclePhase, 1);
  avatar.update({ action: 'land', deltaMs: 1000 });
  assert.deepEqual(bonePosition(scene, 'pelvis').asArray(), settled.asArray());
});

test('avatar ownership disposes only its imported resources and fails without leaking', async t => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  t.after(() => engine.dispose());
  const parent = new TransformNode('shared-player-root', scene);
  const avatar = await loadWildsAvatar(scene, { assetSource, parent });
  assert.equal(avatar.root.parent, parent);
  assert.ok(scene.meshes.length > 15);
  avatar.dispose();
  avatar.dispose();
  assert.deepEqual([scene.meshes.length, scene.skeletons.length, scene.materials.length, scene.animationGroups.length], [0, 0, 0, 0]);
  assert.deepEqual(scene.transformNodes.map(node => node.name), ['shared-player-root']);
  assert.equal(avatar.diagnostics().loaded, false);
  await assert.rejects(loadWildsAvatar(scene, { assetSource: new Uint8Array([1, 2, 3, 4]) }));
  const original = Buffer.from(assetSource);
  const jsonLength = original.readUInt32LE(12);
  const document = JSON.parse(original.subarray(20, 20 + jsonLength).toString());
  document.animations[0].name = 'missing-idle';
  const text = JSON.stringify(document);
  const json = Buffer.from(text.padEnd(Math.ceil(text.length / 4) * 4, ' '));
  const header = Buffer.from(original.subarray(0, 20));
  const tail = original.subarray(20 + jsonLength);
  header.writeUInt32LE(20 + json.length + tail.length, 8);
  header.writeUInt32LE(json.length, 12);
  await assert.rejects(loadWildsAvatar(scene, { assetSource: new Uint8Array(Buffer.concat([header, json, tail])) }), /missing clips: idle/);
  assert.deepEqual([scene.meshes.length, scene.skeletons.length, scene.materials.length, scene.animationGroups.length], [0, 0, 0, 0]);
});

test('locomotion onset raises the free boot and knee continuously while preserving the supporting boot', async t => {
  const { scene, avatar } = await fixture(t);
  for (const [action, speed] of [['walk', 4.8], ['run', 8.5]]) {
    avatar.root.position.set(0, 0, 0);
    avatar.reset();
    let previous = ['foot.R', 'shin.R', 'pelvis'].map(name => bonePosition(scene, name));
    for (let frame = 1; frame <= 8; frame++) {
      avatar.root.position.z -= speed / 60;
      avatar.update({ action, speed, grounded: true, deltaMs: 1000 / 60 });
      scene._animate(0);
      const current = ['foot.R', 'shin.R', 'pelvis'].map(name => bonePosition(scene, name));
      for (let index = 0; index < current.length; index++) assert.ok(Math.abs(current[index].y - previous[index].y) < .075, `${action} ${['free boot', 'knee', 'pelvis'][index]} vertical onset step ${frame} is ${current[index].y - previous[index].y}`);
      previous = current;
    }
  }
});

test('the mantle hand stays on the ledge within arm reach until the sole carries the lift', async t => {
  const { scene, avatar } = await fixture(t);
  const smooth = value => { const v = Math.max(0, Math.min(1, value)); return v * v * (3 - 2 * v); };
  for (const [action, duration] of [['mantle', 450], ['mantle-wide', 650]]) {
    avatar.reset(action);
    for (const timeMs of [80, 120, 160, 200, 240]) {
      avatar.root.position.set(0, .55 * smooth(timeMs / 247.5), 0);
      avatar.update({ action, grounded: false, actionTimeMs: timeMs, deltaMs: 120 });
      scene._animate(0);
      for (const side of ['L', 'R']) {
        const hand = bonePosition(scene, `hand.${side}`), shoulder = bonePosition(scene, `arm.${side}`), elbow = bonePosition(scene, `forearm.${side}`);
        assert.ok(Math.abs(hand.y - .59) < .025, `${action} ${side} hand must stay at ledge height at ${timeMs}ms, got ${hand.y}`);
        assert.ok(Math.abs(hand.z + (action === 'mantle-wide' ? 1.12 : .42)) < .025, `${action} ${side} hand must stay at ledge depth at ${timeMs}ms, got ${hand.z}`);
        assert.ok(Vector3.Distance(hand, shoulder) <= .466, `${action} ${side} wrist exceeds arm reach at ${timeMs}ms`);
        assert.ok(Vector3.Distance(hand, elbow) <= .223, `${action} ${side} forearm stretches at ${timeMs}ms`);
      }
    }
  }
});

test('blended stop recoveries lift the moving sole clearly before narrowing the stance', async t => {
  const { scene, avatar } = await fixture(t);
  for (const phase of [.04, .18, .54, .68]) {
    avatar.reset('walk');
    avatar.update({ action: 'walk', speed: 4.8, deltaMs: phase * 32 * 1000 / 60 });
    scene._animate(0);
    const side = phase < .5 ? 'L' : 'R';
    let peak = 0;
    for (let frame = 1; frame <= 24; frame++) {
      avatar.update({ action: 'idle', speed: 0, deltaMs: 1000 / 60 });
      scene._animate(0);
      if (frame >= 14 && frame <= 22) peak = Math.max(peak, bonePosition(scene, `foot.${side}`).y - .12);
    }
    assert.ok(peak > .16, `stop lead at phase ${phase} must lift its boot visibly, got ${peak}`);
  }
});

function posedTriangles(meshes, range = null) {
  const result = [];
  for (const mesh of meshes) {
    if (!mesh.getTotalVertices()) continue;
    mesh.computeWorldMatrix(true);
    const positions = mesh.getPositionData(true, true), rest = mesh.getVerticesData('position'), indices = mesh.getIndices();
    const vertices = [];
    for (let index = 0; index < positions.length; index += 3) vertices.push(Vector3.TransformCoordinates(Vector3.FromArray(positions, index), mesh.getWorldMatrix()));
    for (let index = 0; index < indices.length; index += 3) {
      const corners = Array.from(indices.slice(index, index + 3));
      if (range && !corners.every(corner => rest[corner * 3 + 1] > range[0] && rest[corner * 3 + 1] < range[1] && Math.abs(rest[corner * 3]) < .25)) continue;
      result.push(corners.map(corner => vertices[corner]));
    }
  }
  return result;
}

function trianglesCross(first, second) {
  for (const axis of ['x', 'y', 'z']) {
    if (Math.min(...first.map(point => point[axis])) > Math.max(...second.map(point => point[axis]))) return false;
    if (Math.max(...first.map(point => point[axis])) < Math.min(...second.map(point => point[axis]))) return false;
  }
  for (const [edges, face] of [[first, second], [second, first]]) {
    for (let index = 0; index < 3; index++) {
      const delta = edges[(index + 1) % 3].subtract(edges[index]), length = delta.length();
      if (length < .000001) continue;
      const hit = new Ray(edges[index], delta.scale(1 / length), length).intersectsTriangle(...face);
      if (hit && hit.distance > .00001 && hit.distance < length - .00001) return true;
    }
  }
  return false;
}

test('the rendered skirt never intersects visible leg skin through climbing and mantle poses', async t => {
  const { scene, avatar } = await fixture(t, { appearance: { bottomStyle: 'skirt' } });
  for (const [action, duration] of [['climb', 500], ['mantle', 450], ['mantle-wide', 650]]) {
    const counts = [];
    for (let timeMs = 0; timeMs < duration; timeMs += 50) {
      avatar.reset(action);
      avatar.update({ action, speed: 2, actionTimeMs: timeMs, deltaMs: timeMs });
      scene._animate(0);
      for (const node of scene.transformNodes) node.computeWorldMatrix(true);
      for (const skeleton of scene.skeletons) skeleton.prepare(true);
      const skin = posedTriangles(scene.meshes.filter(mesh => mesh.name.startsWith('body') && mesh.material?.name === 'skin'), [.4, .9]);
      const cloth = posedTriangles(scene.meshes.filter(mesh => mesh.name.startsWith('variant.bottomStyle.skirt')));
      assert.ok(skin.length > 100 && cloth.length > 100);
      counts.push(skin.reduce((count, triangle) => count + cloth.filter(other => trianglesCross(triangle, other)).length, 0));
    }
    assert.deepEqual(counts, counts.map(() => 0), `${action} cloth must cover the moving legs without cutting through them`);
  }
});

test('the skirt hem stays a continuous drape while alternating knees rise', async t => {
  const { scene, avatar } = await fixture(t, { appearance: { bottomStyle: 'skirt' } });
  for (const timeMs of [0, 50, 100, 150, 200, 250, 300, 350, 400, 450]) {
    avatar.reset('climb');
    avatar.update({ action: 'climb', speed: 2, deltaMs: timeMs });
    scene._animate(0);
    for (const node of scene.transformNodes) node.computeWorldMatrix(true);
    for (const skeleton of scene.skeletons) skeleton.prepare(true);
    const hem = new Map();
    const meshes = scene.meshes.filter(mesh => mesh.name.startsWith('variant.bottomStyle.skirt') && mesh.getTotalVertices());
    const base = Math.min(...meshes.flatMap(mesh => [...mesh.getVerticesData('position')].filter((value, index) => index % 3 === 1)));
    for (const mesh of meshes) {
      const positions = mesh.getPositionData(true, true), rest = mesh.getVerticesData('position');
      for (let index = 0; index < positions.length; index += 3) {
        if (Math.abs(rest[index + 1] - base) < .0001) {
          const angle = Math.atan2(rest[index + 2], rest[index]);
          hem.set(angle, Vector3.TransformCoordinates(Vector3.FromArray(positions, index), mesh.getWorldMatrix()));
        }
      }
    }
    const ring = [...hem].sort((a, b) => a[0] - b[0]).map(([, point]) => point);
    assert.ok(ring.length >= 32);
    const longest = Math.max(...ring.map((point, index) => Vector3.Distance(point, ring[(index + 1) % ring.length])));
    assert.ok(longest < .16, `raised knees must not tear the cloth silhouette into spikes at ${timeMs}ms, got ${longest}`);
  }
});

test('both mantle grips and the supporting boot contact the actual rock triangles while the controller lifts', async t => {
  const { scene, avatar } = await fixture(t);
  const world = climbingFixture(scene);
  t.after(() => world.dispose());
  const supportMeshes = scene.meshes.filter(mesh => ['fixture-outcrop', 'fixture-rocks'].includes(mesh.name));
  for (const [x, z] of [[-9, -38.98], [5.5, -5.7]]) {
    let player = createMovementState({ position: { x, y: world.surfaceAt(x, z).height, z } });
    avatar.reset();
    let contacts = 0;
    const planted = { 'hand.L': [], 'hand.R': [], 'foot.L': [] };
    for (let frame = 1; frame <= 245; frame++) {
      player = stepMovement(player, { forward: 1, climb: true, jump: true }, world, 1000 / 60, frame * 1000 / 60).state;
      avatar.root.position.set(player.position.x, player.position.y, player.position.z);
      avatar.update({ action: player.action, speed: player.speed, grounded: player.grounded, actionTimeMs: player.actionTimeMs, mantleAdvance: player.mantleAdvance, yaw: player.yaw, deltaMs: 1000 / 60 });
      scene._animate(0);
      if (player.action !== 'mantle' || player.actionTimeMs <= 0 || player.actionTimeMs > 247.5) continue;
      for (const [name, height] of [['hand.L', .04], ['hand.R', .04], ['foot.L', .12]]) {
        const point = bonePosition(scene, name);
        planted[name].push(point);
        const hit = new Ray(point.add(new Vector3(0, .5, 0)), new Vector3(0, -1, 0), 1).intersectsMeshes(supportMeshes).find(pick => pick.hit);
        assert.ok(hit, `${name} must be over an actual support triangle at ${x},${z}`);
        assert.ok(Math.abs(point.y - hit.pickedPoint.y - height) < .035, `${name} support gap at ${player.actionTimeMs}ms is ${point.y - hit.pickedPoint.y}`);
      }
      contacts++;
    }
    assert.ok(contacts >= 14, `fixture ${x},${z} must exercise the full support interval`);
    for (const [name, points] of Object.entries(planted)) for (const a of points) for (const b of points) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < .006, `${name} must remain planted on the ground-start fixture ${x},${z}`);
  }
});

test('the complete outcrop observation reaches the mantle endpoint and settles before its end', async t => {
  const { scene, avatar } = await fixture(t);
  const world = climbingFixture(scene);
  t.after(() => world.dispose());
  let player = createMovementState({ position: { x: -9, y: world.surfaceAt(-9, -38.98).height, z: -38.98 } });
  let mantleStart = null, mantleEnd = 0, finalFrame = 0;
  for (let frame = 1; frame <= 336; frame++) {
    const now = frame * 1000 / 60, held = now >= 700 && now < 4600;
    const result = stepMovement(player, { forward: held ? 1 : 0, climb: held, jump: held }, world, 1000 / 60, now);
    player = result.state;
    if (player.mantle && mantleStart === null) mantleStart = player.mantle.startedAt;
    if (result.events.some(event => event.type === 'climb-end')) mantleEnd = now;
    avatar.root.position.set(player.position.x, player.position.y, player.position.z);
    avatar.update({ action: player.action, speed: player.speed, grounded: player.grounded, actionTimeMs: player.actionTimeMs, mantleAdvance: player.mantleAdvance, yaw: player.yaw, deltaMs: 1000 / 60 });
    scene._animate(0);
    for (const animation of avatar.diagnostics().animation) if (animation.name === 'mantle') finalFrame = Math.max(finalFrame, animation.frame);
  }
  assert.notEqual(mantleStart, null);
  assert.ok(mantleEnd < 4600, `the full lift and transfer must complete before release, got ${mantleEnd}`);
  assert.ok(mantleEnd - mantleStart >= 570 && mantleEnd - mantleStart < 570 + 1000 / 60, `the reach, lift and transfer must take 570ms, got ${mantleEnd - mantleStart}`);
  assert.ok(Math.abs(finalFrame - 27) < .00001, `the authored mantle endpoint must be displayed, got ${finalFrame}`);
  assert.equal(player.grounded, true);
  assert.equal(avatar.diagnostics().action, 'idle');
  assert.ok(Math.abs(bonePosition(scene, 'foot.L').y - player.position.y - .12) < .003);
});

test('the outcrop release fixtures distinguish interrupted transfer from completed ascent', async t => {
  const { scene, avatar } = await fixture(t);
  const world = climbingFixture(scene);
  t.after(() => world.dispose());
  for (const releaseAt of [3600, 4300]) await t.test(`release at ${releaseAt}ms`, () => {
    let player = createMovementState({ position: { x: -9, y: world.surfaceAt(-9, -38.98).height, z: -38.98 } });
    let beforeRelease, afterRelease, finalFrame = 0;
    avatar.reset();
    for (let frame = 1; frame <= 336; frame++) {
      const now = frame * 1000 / 60, held = now >= 700 && now < releaseAt;
      const previous = player;
      player = stepMovement(player, { forward: held ? 1 : 0, climb: held, jump: held }, world, 1000 / 60, now).state;
      if (now === releaseAt) { beforeRelease = previous; afterRelease = player; }
      avatar.root.position.set(player.position.x, player.position.y, player.position.z);
      avatar.update({ action: player.action, speed: player.speed, grounded: player.grounded, actionTimeMs: player.actionTimeMs, mantleAdvance: player.mantleAdvance, yaw: player.yaw, deltaMs: 1000 / 60 });
      scene._animate(0);
      for (const animation of avatar.diagnostics().animation) if (animation.name === 'mantle') finalFrame = Math.max(finalFrame, animation.frame);
    }
    if (releaseAt === 3600) {
      assert.equal(beforeRelease.mode, 'mantling');
      assert.equal(afterRelease.mode, 'airborne');
      assert.equal(afterRelease.mantle, null);
      assert.ok(finalFrame > 10 && finalFrame < 27, `the interrupted transfer must not display the completed endpoint, got ${finalFrame}`);
    } else {
      assert.equal(beforeRelease.mode, 'grounded');
      assert.ok(Math.abs(finalFrame - 27) < .00001);
    }
    assert.equal(player.grounded, true);
    assert.equal(avatar.diagnostics().action, 'idle');
    assert.ok(Math.abs(bonePosition(scene, 'foot.L').y - player.position.y - .12) < .003);
  });
});


test('mantle contacts stay planted across varied rock profiles and four approach directions', async t => {
  const { scene, avatar } = await fixture(t);
  const world = climbingFixture(scene);
  t.after(() => world.dispose());
  const supportMeshes = scene.meshes.filter(mesh => mesh.name === 'fixture-rocks');
  for (const spec of ROCK_PROFILES) {
    const rock = world.obstacles.find(obstacle => obstacle.x === spec.x && obstacle.z === spec.z && obstacle.climbable);
    assert.ok(rock?.radiusProfile?.length);
    for (let angle = 0; angle < 4; angle++) await t.test(`${rock.id} approach ${angle}`, () => {
      const yaw = angle * Math.PI / 2, y = rock.baseY + rock.height - WILDS_MOVEMENT.mantleRise;
      const radius = obstacleRadiusBetween(rock, y, y + WILDS_MOVEMENT.height) + WILDS_MOVEMENT.radius;
      const x = rock.x + Math.sin(yaw) * radius, z = rock.z + Math.cos(yaw) * radius;
      let player = { ...createMovementState({ position: { x, y, z }, yaw }), mode: 'climbing', grounded: false, climbObstacle: rock };
      avatar.reset();
      const samples = { 'hand.L': [], 'hand.R': [], 'foot.L': [], 'foot.R': [] };
      const spans = {};
      let completed = false, lastTime = 0;
      for (let frame = 1; frame <= 300; frame++) {
        const result = stepMovement(player, { forward: 1, climb: true, cameraYaw: yaw }, world, 1000 / 60, frame * 1000 / 60);
        player = result.state;
        avatar.root.position.set(player.position.x, player.position.y, player.position.z);
        avatar.update({ action: player.action, speed: player.speed, grounded: player.grounded, actionTimeMs: player.actionTimeMs, mantleAdvance: player.mantleAdvance, yaw: player.yaw, deltaMs: 1000 / 60 });
        scene._animate(0);
        assert.equal(player.climbBlocked, false);
        if (player.action === 'mantle') {
          lastTime = Math.max(lastTime, player.actionTimeMs);
          if (player.position.y < rock.baseY + rock.height - .000001) {
            const clearance = Math.hypot(player.position.x - rock.x, player.position.z - rock.z) - obstacleRadiusBetween(rock, player.position.y, player.position.y + WILDS_MOVEMENT.height);
            assert.ok(clearance >= WILDS_MOVEMENT.radius - .000001, `root penetrates shoulder at ${player.actionTimeMs}ms`);
          }
          for (const [name, points] of Object.entries(samples)) {
            const time = player.actionTimeMs;
            const planted = name.startsWith('hand') ? time > 0 && time <= 247.5 : name === 'foot.L' ? time > 0 && time <= 400 : time >= 405;
            if (!planted) continue;
            const point = bonePosition(scene, name);
            const hit = new Ray(point.add(new Vector3(0, .5, 0)), new Vector3(0, -1, 0), 1).intersectsMeshes(supportMeshes).find(pick => pick.hit);
            assert.ok(hit, `${name} lacks triangle support at ${time}ms`);
            if (name.startsWith('hand')) {
              const side = name.slice(-1);
              assert.ok(Vector3.Distance(point, bonePosition(scene, `arm.${side}`)) <= .466, `${name} exceeds arm reach at ${time}ms`);
              assert.ok(Vector3.Distance(point, bonePosition(scene, `forearm.${side}`)) <= .223, `${name} stretches the forearm at ${time}ms`);
            }
            const height = name.startsWith('hand') ? .04 : .12;
            assert.ok(Math.abs(point.y - hit.pickedPoint.y - height) < .035, `${name} support gap ${point.y - hit.pickedPoint.y} at ${time}ms`);
            points.push({ time, point });
          }
        }
        if (result.events.some(event => event.type === 'climb-end')) {
          assert.equal(player.grounded, true);
          assert.ok(Math.hypot(player.position.x - rock.x, player.position.z - rock.z) < rock.radius);
          completed = true;
          break;
        }
      }
      assert.equal(completed, true);
      assert.ok(lastTime >= 630, `must observe the entire wide mantle, got ${lastTime}ms`);
      for (const [name, points] of Object.entries(samples)) {
        assert.ok(points.length >= 14, `${name} needs the complete planted interval, got ${points.length} samples`);
        let span = 0;
        for (const a of points) for (const b of points) span = Math.max(span, Math.hypot(a.point.x - b.point.x, a.point.z - b.point.z));
        spans[name] = span;
        assert.ok(span < .006, `${name} slides ${span}m across the actual rock during ${points[0].time}–${points.at(-1).time}ms`);
      }
      t.diagnostic(`${rock.id} direction ${angle}: planted horizontal spans ${JSON.stringify(spans)}`);
    });
  }
});
