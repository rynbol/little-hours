import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const bytes = readFileSync(new URL('../public/wilds/style-avatar.glb', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('../public/wilds/style-avatar-manifest.json', import.meta.url)));
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
const binary = bytes.subarray(28 + jsonLength);
const widths = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const componentTypes = { 5121: [1, 'readUInt8'], 5123: [2, 'readUInt16LE'], 5125: [4, 'readUInt32LE'], 5126: [4, 'readFloatLE'] };

function values(index) {
  const accessor = gltf.accessors[index];
  const view = gltf.bufferViews[accessor.bufferView];
  const components = widths[accessor.type];
  const [size, read] = componentTypes[accessor.componentType];
  const data = [];
  for (let entry = 0; entry < accessor.count; entry++) {
    for (let component = 0; component < components; component++) {
      data.push(binary[read]((view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) + entry * (view.byteStride ?? components * size) + component * size));
    }
  }
  return data;
}

function different(data, width) {
  return data.some((value, index) => Math.abs(value - data[index % width]) > .0001);
}

test('the isolated storybook avatar is original skinned Blender geometry with a 1.75m grounded silhouette', () => {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.equal(manifest.generator, 'tools/blender/style_avatar.py');
  assert.equal(manifest.asset, 'style-avatar.glb');
  assert.equal(manifest.forward, '+Z');
  assert.equal(manifest.up, '+Y');
  assert.equal(gltf.images?.length ?? 0, 0);
  assert.equal(gltf.textures?.length ?? 0, 0);
  assert.equal(gltf.skins.length, 1);
  const joints = gltf.skins[0].joints;
  assert.deepEqual(joints.map(index => gltf.nodes[index].name).sort(), manifest.joints.toSorted());
  assert.equal(joints.length, 16);
  assert.ok(values(gltf.skins[0].inverseBindMatrices).every(Number.isFinite));
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];
  let vertexCount = 0;
  for (const node of gltf.nodes.filter(node => node.mesh !== undefined)) {
    assert.equal(node.skin, 0, `${node.name} must deform with the skeleton`);
    for (const primitive of gltf.meshes[node.mesh].primitives) {
      const positions = values(primitive.attributes.POSITION);
      const weights = values(primitive.attributes.WEIGHTS_0);
      const indices = values(primitive.attributes.JOINTS_0);
      assert.ok(positions.every(Number.isFinite));
      assert.ok(weights.every(Number.isFinite));
      assert.equal(positions.length / 3, weights.length / 4);
      vertexCount += positions.length / 3;
      for (let vertex = 0; vertex < positions.length / 3; vertex++) {
        const total = weights.slice(vertex * 4, vertex * 4 + 4).reduce((sum, weight) => sum + weight, 0);
        assert.ok(Math.abs(total - 1) < .00001, `${node.name} vertex ${vertex} has normalized skin weights`);
        for (let slot = 0; slot < 4; slot++) assert.ok(indices[vertex * 4 + slot] < joints.length);
        for (let axis = 0; axis < 3; axis++) {
          minimum[axis] = Math.min(minimum[axis], positions[vertex * 3 + axis]);
          maximum[axis] = Math.max(maximum[axis], positions[vertex * 3 + axis]);
        }
      }
    }
  }
  assert.ok(vertexCount > 5000);
  assert.ok(Math.abs(minimum[1]) < .00001);
  assert.ok(Math.abs(maximum[1] - 1.75) < .00001);
  assert.ok(Math.abs(manifest.headCount - 4.5) < .015);
  for (let axis = 0; axis < 3; axis++) {
    assert.ok(Math.abs(minimum[axis] - manifest.bounds.min[axis]) < .00001);
    assert.ok(Math.abs(maximum[axis] - manifest.bounds.max[axis]) < .00001);
  }
});

test('the authored body exposes facial, hair, tailoring, hand and boot detail with named materials', () => {
  const nodes = new Set(gltf.nodes.map(node => node.name));
  for (const name of ['face', 'eyes', 'eyelids', 'brows', 'cheeks', 'nose', 'smile', 'hair-cap', 'hair-fringe', 'hair-bun', 'cardigan', 'collar', 'buttons', 'pockets', 'hem-knit', 'sleeve-cuffs', 'hands', 'thumbs', 'finger-folds', 'boots', 'soles', 'boot-welts']) {
    assert.ok(nodes.has(name), `${name} is authored geometry`);
  }
  for (const name of manifest.materialSlots) {
    const material = gltf.materials.find(material => material.name === name);
    assert.ok(material, `${name} is available to the styleframe shader`);
    assert.ok(material.pbrMetallicRoughness.baseColorFactor.every(Number.isFinite));
  }
  const face = gltf.meshes[gltf.nodes.find(node => node.name === 'face').mesh];
  const front = face.primitives.flatMap(primitive => values(primitive.attributes.POSITION)).filter((_, index) => index % 3 === 2);
  assert.ok(Math.max(...front) > .13);
  const nose = gltf.meshes[gltf.nodes.find(node => node.name === 'nose').mesh];
  const noseFront = nose.primitives.flatMap(primitive => values(primitive.attributes.POSITION)).filter((_, index) => index % 3 === 2);
  assert.ok(Math.max(...noseFront) > Math.max(...front) + .025);
});

test('idle and combat have finite nonempty skeletal motion, exact timing, authored hit poses, and matched endpoints', () => {
  assert.deepEqual(gltf.animations.map(animation => animation.name).sort(), ['attack1', 'attack2', 'attack3', 'dodge', 'hit', 'idle']);
  for (const animation of gltf.animations) {
    const definition = manifest.clips[animation.name];
    assert.ok(animation.channels.length >= 16);
    let duration = 0;
    let movingChannels = 0;
    for (const channel of animation.channels) {
      assert.ok(gltf.skins[0].joints.includes(channel.target.node));
      const sampler = animation.samplers[channel.sampler];
      const times = values(sampler.input);
      const data = values(sampler.output);
      const width = widths[gltf.accessors[sampler.output].type];
      assert.ok(times.length > 1);
      assert.equal(times[0], 0);
      assert.ok(times.every(Number.isFinite));
      assert.ok(data.every(Number.isFinite));
      assert.ok(times.every((time, index) => index === 0 || time > times[index - 1]));
      duration = Math.max(duration, times.at(-1));
      if (different(data, width)) movingChannels++;
      for (let component = 0; component < width; component++) {
        assert.ok(Math.abs(data[component] - data.at(-width + component)) < .00001, `${animation.name} ${gltf.nodes[channel.target.node].name} returns cleanly to idle`);
      }
      if (definition.hitMs && different(data, width)) assert.ok(times.some(time => Math.abs(time * 1000 - definition.hitMs) < .001));
      if (gltf.nodes[channel.target.node].name.startsWith('foot.')) {
        assert.equal(different(data, width), false, `${animation.name} keeps authored foot contacts fixed`);
      }
    }
    assert.ok(movingChannels >= 7, `${animation.name} visibly articulates the body`);
    assert.ok(Math.abs(duration * 1000 - definition.durationMs) < .001);
  }
  assert.deepEqual(['attack1', 'attack2', 'attack3'].map(name => [manifest.clips[name].durationMs, manifest.clips[name].hitMs]), [[420, 180], [460, 200], [620, 300]]);
});

test('raising the arms cannot pull the cardigan waist away from its hem and pockets', () => {
  const garment = gltf.meshes[gltf.nodes.find(node => node.name === 'cardigan').mesh];
  const armJoints = new Set(gltf.skins[0].joints.flatMap((node, index) => /^(arm|forearm)\./.test(gltf.nodes[node].name) ? [index] : []));
  let waistVertices = 0;
  for (const primitive of garment.primitives) {
    const positions = values(primitive.attributes.POSITION);
    const weights = values(primitive.attributes.WEIGHTS_0);
    const joints = values(primitive.attributes.JOINTS_0);
    for (let vertex = 0; vertex < positions.length / 3; vertex++) {
      if (positions[vertex * 3 + 1] > 1.10 || Math.abs(positions[vertex * 3]) > .201) continue;
      waistVertices++;
      for (let slot = 0; slot < 4; slot++) {
        if (armJoints.has(joints[vertex * 4 + slot])) assert.equal(weights[vertex * 4 + slot], 0);
      }
    }
  }
  assert.ok(waistVertices > 50);
});

test('the face, neck, cheeks, shirt, cardigan and palms expose outward front normals', () => {
  const samples = [
    ['face', ([x, y, z]) => Math.abs(x) < .035 && y > 1.46 && y < 1.58 && z > .12],
    ['face', ([x, y, z]) => Math.abs(x) < .025 && y > 1.32 && y < 1.35 && z > .04],
    ['cheeks', () => true],
    ['shirt-inset', () => true],
    ['cardigan', ([x, y, z]) => Math.abs(x) < .08 && y > .90 && y < 1.10 && z > .08],
    ['hands', ([x, y, z]) => x < -.265 && x > -.315 && y > .79 && y < .835 && z > .103],
    ['hands', ([x, y, z]) => x > .265 && x < .315 && y > .79 && y < .835 && z > .075],
  ];
  for (const [name, select] of samples) {
    const mesh = gltf.meshes[gltf.nodes.find(node => node.name === name).mesh];
    const forwardNormals = [];
    for (const primitive of mesh.primitives) {
      const positions = values(primitive.attributes.POSITION);
      const normals = values(primitive.attributes.NORMAL);
      for (let vertex = 0; vertex < positions.length / 3; vertex++) {
        if (select(positions.slice(vertex * 3, vertex * 3 + 3))) forwardNormals.push(normals[vertex * 3 + 2]);
      }
    }
    assert.ok(forwardNormals.length >= 3, `${name} provides a visible front surface sample`);
    const average = forwardNormals.reduce((sum, normal) => sum + normal, 0) / forwardNormals.length;
    assert.ok(average > .55, `${name} front normals point toward +Z, measured ${average}`);
  }
});
