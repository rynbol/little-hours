import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const definitions = {
  cat: { clips: ['attack', 'idle', 'recover', 'skill'], height: [.68, .78], joints: 21, triangles: [9000, 44000] },
  warden: { clips: ['charge', 'defeat', 'idle', 'phase', 'roots', 'slam', 'stagger', 'sweep'], height: [2.9, 3.2], joints: 19, triangles: [6000, 28000] },
};

function asset(kind) {
  const bytes = readFileSync(new URL(`../public/wilds/style-${kind}.glb`, import.meta.url));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const length = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + length));
  const binary = bytes.subarray(28 + length);
  const manifest = JSON.parse(readFileSync(new URL(`../public/wilds/style-${kind}-manifest.json`, import.meta.url)));
  const widths = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const readers = { 5121: ['readUInt8', 1], 5123: ['readUInt16LE', 2], 5125: ['readUInt32LE', 4], 5126: ['readFloatLE', 4] };
  function values(index) {
    const accessor = gltf.accessors[index];
    const view = gltf.bufferViews[accessor.bufferView];
    const [read, size] = readers[accessor.componentType];
    const width = widths[accessor.type];
    const data = [];
    for (let row = 0; row < accessor.count; row++) {
      for (let column = 0; column < width; column++) {
        data.push(binary[read]((view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) + row * (view.byteStride ?? width * size) + column * size));
      }
    }
    return data;
  }
  return { gltf, manifest, values };
}

for (const [kind, expected] of Object.entries(definitions)) {
  test(`the ${kind} GLB has a complete skinned quadruped, grounded feet, and authored material colours`, () => {
    const { gltf, manifest, values } = asset(kind);
    assert.equal(manifest.generator, 'tools/blender/style_creatures.py');
    assert.equal(manifest.forward, '+Z');
    assert.equal(manifest.up, '+Y');
    assert.equal(gltf.images?.length ?? 0, 0);
    assert.equal(gltf.textures?.length ?? 0, 0);
    assert.equal(gltf.skins.length, 1);
    const skin = gltf.skins[0];
    const joints = skin.joints.map(index => gltf.nodes[index].name);
    assert.equal(joints.length, expected.joints);
    assert.deepEqual([...joints].sort(), [...manifest.joints].sort());
    for (const position of ['front.L', 'front.R', 'hind.L', 'hind.R']) {
      for (const segment of ['upper', 'lower', 'paw']) assert.ok(joints.includes(`${position}.${segment}`));
      assert.equal(manifest.contacts[position][1], 0);
    }
    const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    let triangles = 0;
    const pawVertices = Object.fromEntries(['front.L', 'front.R', 'hind.L', 'hind.R'].map(name => [name, 0]));
    for (const node of gltf.nodes.filter(node => node.mesh !== undefined)) {
      assert.equal(node.skin, 0);
      for (const primitive of gltf.meshes[node.mesh].primitives) {
        const positions = values(primitive.attributes.POSITION);
        const weights = values(primitive.attributes.WEIGHTS_0);
        const jointIndices = values(primitive.attributes.JOINTS_0);
        triangles += gltf.accessors[primitive.indices].count / 3;
        for (let vertex = 0; vertex < positions.length / 3; vertex++) {
          let total = 0;
          for (let component = 0; component < 3; component++) {
            const value = positions[vertex * 3 + component];
            assert.ok(Number.isFinite(value));
            bounds.min[component] = Math.min(bounds.min[component], value);
            bounds.max[component] = Math.max(bounds.max[component], value);
          }
          for (let slot = 0; slot < 4; slot++) {
            const weight = weights[vertex * 4 + slot];
            assert.ok(weight >= 0 && weight <= 1);
            total += weight;
            const bone = joints[jointIndices[vertex * 4 + slot]];
            if (weight > .99 && positions[vertex * 3 + 1] < .02 && bone.endsWith('.paw')) pawVertices[bone.slice(0, -4)]++;
          }
          assert.ok(Math.abs(total - 1) < .0001, `${kind} vertex ${vertex} must have a complete skin weight`);
        }
      }
    }
    assert.ok(triangles >= expected.triangles[0] && triangles <= expected.triangles[1]);
    assert.equal(triangles, manifest.triangles);
    assert.ok(Math.abs(bounds.min[1]) < .0001);
    assert.ok(bounds.max[1] >= expected.height[0] && bounds.max[1] <= expected.height[1]);
    for (const [paw, count] of Object.entries(pawVertices)) assert.ok(count >= 4, `${paw} must have a skinned ground contact`);
    for (const key of ['min', 'max']) {
      for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(bounds[key][axis] - manifest.bounds[key][axis]) < .00001);
    }
    for (const name of manifest.materialSlots) {
      const material = gltf.materials.find(item => item.name === name);
      assert.ok(material, `${name} material is exported`);
      assert.ok(material.pbrMetallicRoughness.roughnessFactor >= .8);
      assert.ok(material.pbrMetallicRoughness.baseColorFactor.slice(0, 3).every(value => value > 0 && value <= 1));
    }
  });

  test(`the ${kind} clips animate the skeleton with authored attack phases and planted idle paws`, () => {
    const { gltf, manifest, values } = asset(kind);
    assert.deepEqual(gltf.animations.map(animation => animation.name).sort(), expected.clips);
    for (const animation of gltf.animations) {
      const definition = manifest.clips[animation.name];
      let duration = 0;
      let changing = 0;
      for (const channel of animation.channels) {
        assert.ok(gltf.skins[0].joints.includes(channel.target.node));
        const sampler = animation.samplers[channel.sampler];
        const times = values(sampler.input);
        const output = values(sampler.output);
        assert.equal(times[0], 0);
        assert.ok(times.length >= 2);
        assert.ok(output.every(Number.isFinite));
        duration = Math.max(duration, times.at(-1));
        const width = output.length / times.length;
        const change = output.some((value, index) => Math.abs(value - output[index % width]) > .0001);
        if (change) changing++;
        if (animation.name === 'idle' && gltf.nodes[channel.target.node].name.endsWith('.paw')) assert.equal(change, false, 'idle foot contacts must remain planted');
      }
      assert.ok(changing >= 4, `${animation.name} must animate at least four skeletal channels`);
      assert.ok(Math.abs(duration * 1000 - definition.durationMs) < .01);
      if (definition.hitFraction !== undefined) {
        assert.ok(definition.anticipationFraction > 0);
        assert.ok(definition.anticipationFraction < definition.hitFraction);
        assert.ok(definition.hitFraction < definition.settleFraction);
        assert.ok(definition.settleFraction < 1);
      }
    }
  });
}

test('the Warden has an emissive heartwood core while the cat keeps distinct ginger, cream and eye materials', () => {
  const cat = asset('cat').gltf;
  for (const name of ['ginger', 'cream', 'stripe', 'ear', 'nose', 'eye-dark', 'catchlight']) assert.ok(cat.materials.some(material => material.name === name));
  const warden = asset('warden').gltf;
  for (const name of ['heartwood', 'heartwood-core']) {
    const material = warden.materials.find(item => item.name === name);
    assert.ok(material.emissiveFactor.some(value => value > .1));
  }
});

test('the Warden eye sockets remain attached to its head after shaping their almond profile', () => {
  const { gltf, values } = asset('warden');
  const socketMaterial = gltf.materials.findIndex(material => material.name === 'eye-rim');
  let vertices = 0;
  for (const mesh of gltf.meshes) {
    for (const primitive of mesh.primitives) {
      if (primitive.material !== socketMaterial) continue;
      const positions = values(primitive.attributes.POSITION);
      for (let index = 0; index < positions.length; index += 3) {
        assert.ok(Math.abs(positions[index]) > .05 && Math.abs(positions[index]) < .23);
        assert.ok(positions[index + 1] > 2.26 && positions[index + 1] < 2.39);
        assert.ok(positions[index + 2] > 1.19 && positions[index + 2] < 1.34);
        vertices++;
      }
    }
  }
  assert.ok(vertices >= 100);
});

test('the cat eye rims stay narrow enough to preserve the cheek and forehead silhouette', () => {
  const { gltf, values } = asset('cat');
  const widths = {};
  for (const name of ['eye-rim', 'eye-dark']) {
    const material = gltf.materials.findIndex(item => item.name === name);
    const x = gltf.meshes.flatMap(mesh => mesh.primitives.filter(primitive => primitive.material === material).flatMap(primitive => values(primitive.attributes.POSITION).filter((value, index) => index % 3 === 0 && value > 0)));
    widths[name] = Math.max(...x) - Math.min(...x);
  }
  assert.ok(widths['eye-rim'] < .100);
  assert.ok(widths['eye-rim'] - widths['eye-dark'] < .016);
});
