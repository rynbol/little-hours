import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Box3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STAG, STAG_ATTACKS, STAG_GAITS } from '../../core/wilds/stag.js';
import { STAG_VIEW, buildStag, stagClip } from './stag.js';
import { createPainterly } from './painterly.js';

const FRAME = 1 / 30;

function readGlb() {
  const bytes = readFileSync(new URL('../../../public/wilds/stag.glb', import.meta.url));
  const jsonLength = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const bin = bytes.subarray(20 + jsonLength + 8);
  const floats = index => {
    const accessor = json.accessors[index], view = json.bufferViews[accessor.bufferView], width = { SCALAR: 1, VEC3: 3, VEC4: 4 }[accessor.type];
    const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    return Array.from({ length: accessor.count * width }, (_, i) => bin.readFloatLE(start + i * 4));
  };
  const clips = Object.fromEntries(json.animations.map(animation => [animation.name, {
    duration: Math.max(...animation.samplers.map(sampler => json.accessors[sampler.input].max[0])),
    track(node, path) {
      const channel = animation.channels.find(entry => json.nodes[entry.target.node].name === node && entry.target.path === path), sampler = animation.samplers[channel.sampler];
      return { times: floats(sampler.input), values: floats(sampler.output) };
    },
    joints: new Set(animation.channels.filter(entry => entry.target.path === 'rotation').map(entry => json.nodes[entry.target.node].name)),
  }]));
  return { json, clips };
}

function fastest({ times, values }) {
  let best = -1, at = 0;
  for (let i = 1; i < times.length; i++) {
    const dot = Math.abs(values.slice(i * 4 - 4, i * 4).reduce((sum, value, k) => sum + value * values[i * 4 + k], 0));
    const speed = 2 * Math.acos(Math.min(1, dot)) / (times[i] - times[i - 1]);
    if (speed > best) { best = speed; at = (times[i] + times[i - 1]) / 2; }
  }
  return at;
}

test('the stag model carries every clip the fight plays, each as long as its row in the stag tables', () => {
  const { clips } = readGlb(), close = (name, seconds) => assert.ok(Math.abs(clips[name].duration - seconds) <= FRAME + 1e-6, `${name} lasts ${clips[name].duration}, the table says ${seconds}`);
  assert.deepEqual(Object.keys(clips).sort(), ['bound', 'charge-wind', 'defeat', 'flinch', 'gallop', 'idle', 'rest', 'roots', 'shift', 'skid', 'stagger', 'stomp', 'stun', 'sweep', 'sweep-mirror', 'trot', 'wake', 'walk']);
  for (const id of ['sweep', 'stomp', 'roots']) { const { telegraph, active, recover } = STAG_ATTACKS[id]; close(id, telegraph + active + recover); }
  close('sweep-mirror', clips.sweep.duration);
  close('charge-wind', STAG_ATTACKS.charge.telegraph);
  close('skid', STAG_ATTACKS.charge.recover);
  for (const gait of ['walk', 'trot', 'gallop']) close(gait, STAG_GAITS[gait].cycle);
  for (const state of ['wake', 'stun', 'stagger', 'shift', 'defeat']) close(state, STAG[state]);
});

test('every clip poses every joint, so cross-fades never fall back to the bind pose', () => {
  const { json, clips } = readGlb(), joints = json.skins[0].joints.map(index => json.nodes[index].name);
  assert.equal(joints.length, 31);
  for (const [name, clip] of Object.entries(clips)) assert.deepEqual([...clip.joints].sort(), [...joints].sort(), name);
});

test('the stag mesh is skinned four bones a vertex with Body, Heart and Eyes paint', () => {
  const { json } = readGlb(), primitives = json.meshes.flatMap(mesh => mesh.primitives);
  assert.deepEqual(primitives.map(primitive => json.materials[primitive.material].name).sort(), ['Body', 'Eyes', 'Heart']);
  for (const primitive of primitives) assert.deepEqual(Object.keys(primitive.attributes).sort(), ['COLOR_0', 'JOINTS_0', 'NORMAL', 'POSITION', 'WEIGHTS_0']);
});

test('the sweep swings hardest inside its hit window, and its mirror is the same swing the other way', () => {
  const { clips } = readGlb(), { telegraph, active } = STAG_ATTACKS.sweep;
  for (const name of ['sweep', 'sweep-mirror']) {
    const at = fastest(clips[name].track('neck1', 'rotation'));
    assert.ok(at >= telegraph - FRAME && at <= telegraph + active + FRAME, `${name} neck swings fastest at ${at}`);
  }
  const yaw = name => { const { values } = clips[name].track('neck1', 'rotation'), mid = Math.floor(values.length / 8) * 4; return values[mid + 1] * Math.sign(values[mid + 3]); };
  assert.ok(Math.abs(yaw('sweep') + yaw('sweep-mirror')) < 0.02, `yaw ${yaw('sweep')} against ${yaw('sweep-mirror')}`);
});

test('the stag comes down from its rear when the stomp shockwave starts', () => {
  const { clips } = readGlb(), { telegraph } = STAG_ATTACKS.stomp, at = fastest(clips.stomp.track('hips', 'rotation'));
  assert.ok(at >= telegraph - 3 * FRAME && at <= telegraph + 2 * FRAME, `the body drops fastest at ${at}, the slam lands at ${telegraph}`);
});

const pose = (state, extra = {}) => stagClip({ state, time: 0, attack: null, side: 1, ...extra });

test('the stag shows the clip for its fight state, timed so the hit frames meet the sim', () => {
  assert.deepEqual(pose('dormant'), { name: 'rest', at: null });
  assert.deepEqual(pose('wake', { time: 0.9 }), { name: 'wake', at: 0.9 });
  assert.deepEqual(pose('idle'), { name: 'stride', at: null });
  assert.deepEqual(pose('telegraph', { attack: 'sweep', time: 0.3 }), { name: 'sweep', at: 0.3 });
  assert.deepEqual(pose('telegraph', { attack: 'sweep', time: 0.3, side: -1 }), { name: 'sweep-mirror', at: 0.3 });
  assert.deepEqual(pose('attack', { attack: 'stomp', time: 0.2 }), { name: 'stomp', at: 1.15 });
  assert.deepEqual(pose('recover', { attack: 'sweep', time: 0.5 }), { name: 'sweep', at: 1.57 });
  assert.deepEqual(pose('attack', { attack: 'roots', time: 1.5 }), { name: 'roots', at: 0.8 + STAG_VIEW.hold });
  assert.deepEqual(pose('recover', { attack: 'roots', time: 0.8 }), { name: 'roots', at: 1.6 });
  assert.deepEqual(pose('telegraph', { attack: 'charge', time: 0.5 }), { name: 'charge-wind', at: 0.5 });
  assert.deepEqual(pose('attack', { attack: 'charge', time: 1 }), { name: 'gallop', at: null });
  assert.deepEqual(pose('recover', { attack: 'charge', time: 0.4 }), { name: 'skid', at: 0.4 });
  assert.deepEqual(pose('recover', { time: 0.3 }), { name: 'stride', at: null });
  assert.deepEqual(pose('retreat', { time: 0.3 }), { name: 'bound', at: null });
  assert.deepEqual(pose('stun', { time: 2 }), { name: 'stun', at: 2 });
  assert.deepEqual(pose('defeat', { time: 3 }), { name: 'defeat', at: 3 });
  assert.deepEqual(pose('gone', { time: 9 }), { name: 'defeat', at: STAG.defeat });
});

test('every clip the stag can show is in the model and never runs past its end', () => {
  const { clips } = readGlb();
  for (const id of Object.keys(STAG_ATTACKS)) {
    const attack = STAG_ATTACKS[id];
    for (const [state, longest] of [['telegraph', attack.telegraph], ['attack', id === 'roots' ? 3 : attack.active], ['recover', attack.recover]]) {
      for (const side of [1, -1]) for (const time of [0, longest / 2, longest]) {
        const { name, at } = pose(state, { attack: id, time, side });
        assert.ok(clips[name], `${state} ${id} shows ${name}`);
        if (at !== null) assert.ok(at <= clips[name].duration + FRAME, `${state} ${id} at ${time} plays ${name} at ${at}`);
      }
    }
  }
});

test('the stag stands four and a half metres tall, never collapses and never sinks its hooves in any state it shows', async () => {
  const bytes = readFileSync(new URL('../../../public/wilds/stag.glb', import.meta.url));
  const model = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const stag = { x: 3, y: 1, z: -2, facing: 0.4, state: 'dormant', time: 0, attack: null, side: 1, flinch: 0, heartOpen: false };
  const view = buildStag(model, stag, createPainterly(), { blossom() {} }), box = new Box3(), heights = {};
  for (const [state, attack, time, flinch] of [['idle', null, 0, 0], ['idle', null, 0.2, 1], ['telegraph', 'sweep', 0.6, 0], ['attack', 'stomp', 0.1, 0], ['stun', null, 1.5, 0], ['retreat', null, 0.3, 0]]) {
    Object.assign(stag, { state, attack, time, flinch });
    for (let i = 0; i < 20; i++) view.update(1 / 60, false);
    view.root.updateMatrixWorld(true);
    box.setFromObject(view.root, true);
    heights[`${state} ${attack ?? ''} ${flinch}`] = [box.min.y - stag.y, box.max.y - stag.y];
  }
  assert.ok(heights['idle  0'][1] > 4.4 && heights['idle  0'][1] < 4.9, `standing ${heights['idle  0'][1]} m tall`);
  for (const [shown, [low, high]] of Object.entries(heights)) {
    assert.ok(high > 2.5, `${shown} stands ${high} m tall`);
    assert.ok(low > -0.12, `${shown} sinks ${low} m into the ground`);
  }
  view.dispose();
});
