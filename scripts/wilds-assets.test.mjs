import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AVATAR_OPTIONS } from '../src/core/avatar.js';

const bytes = readFileSync(new URL('../public/wilds/avatar.glb', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('../public/wilds/avatar-manifest.json', import.meta.url)));
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
const binary = bytes.subarray(28 + jsonLength);

function values(index) {
  const accessor = gltf.accessors[index];
  const view = gltf.bufferViews[accessor.bufferView];
  assert.equal(accessor.componentType, 5126);
  const components = { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 }[accessor.type];
  const result = [];
  for (let i = 0; i < accessor.count; i++) {
    for (let j = 0; j < components; j++) {
      result.push(binary.readFloatLE((view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) + i * (view.byteStride ?? components * 4) + j * 4));
    }
  }
  return result;
}

function rearSurface(mesh, x, height) {
  const hits = [];
  for (const primitive of mesh.primitives) {
    const positions = values(primitive.attributes.POSITION);
    const accessor = gltf.accessors[primitive.indices];
    const view = gltf.bufferViews[accessor.bufferView];
    const width = accessor.componentType === 5123 ? 2 : 4;
    const indexAt = index => binary[width === 2 ? 'readUInt16LE' : 'readUInt32LE']((view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) + index * width);
    for (let index = 0; index < accessor.count; index += 3) {
      const [a, b, c] = [0, 1, 2].map(offset => positions.slice(indexAt(index + offset) * 3, indexAt(index + offset) * 3 + 3));
      const determinant = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(determinant) < 1e-10) continue;
      const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (height - c[1])) / determinant;
      const v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (height - c[1])) / determinant;
      if (u >= 0 && v >= 0 && u + v <= 1) hits.push({ z: u * a[2] + v * b[2] + (1 - u - v) * c[2], material: gltf.materials[primitive.material].name });
    }
  }
  return hits.sort((a, b) => b.z - a.z)[0];
}

test('the committed Blender GLB contains complete animated locomotion, a deforming rig, and no image substitutes', () => {
  assert.deepEqual(JSON.parse(readFileSync(new URL('../src/core/wilds/mantle-motion.json', import.meta.url))), manifest.mantleMotion);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.deepEqual(gltf.animations.map(animation => animation.name).sort(), ['climb', 'fall', 'idle', 'jump', 'land', 'mantle', 'mantle-wide', 'run', 'stop', 'stop-back', 'stop-right', 'stop-right-back', 'walk']);
  assert.equal(gltf.skins.length, 1);
  assert.deepEqual(gltf.skins[0].joints.map(index => gltf.nodes[index].name).filter(name => !name.startsWith('skirt.')).sort(), ['arm.L', 'arm.R', 'foot.L', 'foot.R', 'forearm.L', 'forearm.R', 'hand.L', 'hand.R', 'head', 'pelvis', 'shin.L', 'shin.R', 'spine', 'thigh.L', 'thigh.R']);
  assert.equal(gltf.images?.length ?? 0, 0);
  for (const animation of gltf.animations) {
    const definition = manifest.clips[animation.name];
    assert.ok(animation.channels.length >= 15);
    let maximum = 0;
    let varyingChannels = 0;
    for (const sampler of animation.samplers) {
      const times = values(sampler.input);
      const data = values(sampler.output);
      assert.ok(times.length >= 2);
      assert.equal(times[0], 0);
      assert.ok(data.every(Number.isFinite));
      maximum = Math.max(maximum, times.at(-1));
      const width = data.length / times.length;
      if (data.some((value, index) => Math.abs(value - data[index % width]) > .0001)) varyingChannels++;
    }
    assert.ok(varyingChannels >= 5, `${animation.name} must animate the body, not an empty root`);
    assert.ok(Math.abs(maximum * 1000 - definition.durationMs) < .01);
    assert.ok(animation.channels.every(channel => gltf.skins[0].joints.includes(channel.target.node)));
  }
});

test('every existing wardrobe silhouette and palette maps to authored meshes and material slots', () => {
  const names = new Set(gltf.nodes.map(node => node.name));
  for (const [part, options] of Object.entries(manifest.variants)) {
    assert.deepEqual(options, AVATAR_OPTIONS[part].map(option => option.id));
    for (const option of options) {
      if (option === 'none') continue;
      const name = `variant.${part}.${option}`;
      assert.ok(names.has(name), `${name} needs an authored mesh`);
      const node = gltf.nodes.find(node => node.name === name);
      assert.equal(node.skin, 0);
      assert.ok(gltf.meshes[node.mesh].primitives.every(primitive => primitive.attributes.JOINTS_0 !== undefined && primitive.attributes.WEIGHTS_0 !== undefined));
    }
  }
  for (const name of manifest.materialSlots) {
    const material = gltf.materials.find(material => material.name === name);
    assert.ok(material, `Missing material slot ${name}`);
    assert.ok(material.pbrMetallicRoughness.roughnessFactor >= .8);
  }
  const body = gltf.meshes[gltf.nodes.find(node => node.name === 'body').mesh];
  const positions = body.primitives.flatMap(primitive => values(primitive.attributes.POSITION));
  const heights = positions.filter((_, index) => index % 3 === 1);
  assert.ok(Math.abs(Math.min(...heights)) < .001);
  assert.ok(Math.max(...heights) > 1.6 && Math.max(...heights) < 1.8);
});

test('the overall rear straps form continuous fabric above the shirt from waist to shoulder', () => {
  const outfit = gltf.meshes[gltf.nodes.find(node => node.name === 'variant.outfit.overalls').mesh];
  for (const sign of [-1, 1]) {
    for (const height of [.94, 1.02, 1.10, 1.18, 1.23]) {
      const x = sign * (height > 1.18 ? .125 : .105);
      const surface = rearSurface(outfit, x, height);
      assert.equal(surface?.material, 'bottom', `rear strap at ${x}, ${height} must cover the shirt continuously`);
    }
  }
});

test('the independently baked foot contacts retain a continuous calf and sock skin', () => {
  const joints = gltf.skins[0].joints;
  const footIndices = ['L', 'R'].map(side => joints.indexOf(gltf.nodes.findIndex(node => node.name === `foot.${side}`)));
  const body = gltf.meshes[gltf.nodes.find(node => node.name === 'body').mesh];
  let calfVertices = 0;
  for (const primitive of body.primitives) {
    if (gltf.materials[primitive.material].name !== 'skin') continue;
    const positions = values(primitive.attributes.POSITION);
    const weights = values(primitive.attributes.WEIGHTS_0);
    const accessor = gltf.accessors[primitive.attributes.JOINTS_0];
    const view = gltf.bufferViews[accessor.bufferView];
    const width = accessor.componentType === 5121 ? 1 : 2;
    for (let vertex = 0; vertex < positions.length / 3; vertex++) {
      const height = positions[vertex * 3 + 1];
      if (height < .119 || height > .226) continue;
      let ankleWeight = 0;
      for (let slot = 0; slot < 4; slot++) {
        const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) + vertex * (view.byteStride ?? 4 * width) + slot * width;
        const joint = binary[width === 1 ? 'readUInt8' : 'readUInt16LE'](offset);
        if (footIndices.includes(joint)) ankleWeight += weights[vertex * 4 + slot];
      }
      assert.ok(ankleWeight > .99, `calf endpoint ${vertex} must follow its authored foot contact`);
      calfVertices++;
    }
  }
  assert.ok(calfVertices >= 32);
});

test('the skirt hem overlaps the visible leg mesh without a missing upper-thigh band', () => {
  const body = gltf.meshes[gltf.nodes.find(node => node.name === 'body').mesh];
  const skirt = gltf.meshes[gltf.nodes.find(node => node.name === 'variant.bottomStyle.skirt').mesh];
  const legHeights = [];
  for (const primitive of body.primitives) {
    if (gltf.materials[primitive.material].name !== 'skin') continue;
    const positions = values(primitive.attributes.POSITION);
    for (let index = 0; index < positions.length; index += 3) {
      if (Math.abs(positions[index]) < .25 && positions[index + 1] < .9) legHeights.push(positions[index + 1]);
    }
  }
  const skirtHeights = skirt.primitives.flatMap(primitive => values(primitive.attributes.POSITION).filter((value, index) => index % 3 === 1));
  assert.ok(Math.max(...legHeights) > Math.min(...skirtHeights) + .025);
});
