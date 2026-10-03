import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AnimationMixer, Color, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BOND_LEVELS } from '../../core/pet-bonds.js';
import { PET, PET_ATTACKS, gaitFor } from '../../core/wilds/pet.js';
import { WOLF } from '../../core/wilds/wolf.js';
import { PET_KINDS, PET_SIZES, buildPet, petClip, ribbonColour } from './pet.js';
import { createPainterly } from './painterly.js';

const FRAME = 1 / 30, KEY = 60;
const files = Object.fromEntries(PET_KINDS.map(kind => [kind, readFileSync(new URL(`../../../public/wilds/pets/${kind}.glb`, import.meta.url))]));
const jsonOf = bytes => JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
const load = kind => new GLTFLoader().parseAsync(files[kind].buffer.slice(files[kind].byteOffset, files[kind].byteOffset + files[kind].byteLength), '');
const duration = (json, animation) => Math.max(...animation.samplers.map(sampler => json.accessors[sampler.input].max[0]));
const CLIPS = ['blink', 'bow', 'dash', 'dig', 'evade', 'hurt', 'idle', 'limp', 'out', 'pat', 'point', 'pounce', 'ready', 'run', 'side-left', 'side-right', 'sit', 'sniff', 'spin', 'swim', 'swipe', 'track', 'trot', 'walk'];

const lengths = kind => {
  const size = PET_SIZES[kind] ?? 1, cycle = gait => gaitFor(gait, size).cycle;
  return {
    idle: 4, ready: 1.6, sit: 3, sniff: 2.4, dig: 0.5, blink: 0.2, point: PET.point, pat: PET.pat, hurt: PET.hurt, out: PET.out, evade: PET.hop + 0.15, bow: WOLF.bow,
    walk: cycle('walk'), trot: cycle('trot'), run: cycle('run'), dash: cycle('dash'), track: cycle('track'), limp: cycle('limp'), swim: cycle('swim'), 'side-left': cycle('side'), 'side-right': cycle('side'),
    ...Object.fromEntries(Object.entries(PET_ATTACKS).map(([id, attack]) => [id, attack.windup + attack.active + attack.recover])),
  };
};

test('every pet carries the clips its sim shows, each as long as its row in the pet tables, the wolf at its own size', () => {
  for (const kind of PET_KINDS) {
    const json = jsonOf(files[kind]), clips = Object.fromEntries(json.animations.map(animation => [animation.name, animation])), want = lengths(kind);
    assert.deepEqual(Object.keys(clips).sort(), CLIPS, kind);
    for (const name of CLIPS) assert.ok(Math.abs(duration(json, clips[name]) - want[name]) <= FRAME + 1e-6, `${kind} ${name} lasts ${duration(json, clips[name])}, the table says ${want[name]}`);
  }
  assert.ok(Math.abs(lengths('wolf').trot / lengths('cat').trot - Math.sqrt(WOLF.size)) < 1e-9);
});

test('every clip poses every joint and every vertex is skinned with its colour slot', () => {
  for (const kind of PET_KINDS) {
    const json = jsonOf(files[kind]), joints = json.skins[0].joints.map(index => json.nodes[index].name).sort();
    assert.ok(joints.length >= 25, `${kind} has ${joints.length} joints`);
    for (const animation of json.animations) {
      const posed = new Set(animation.channels.filter(channel => channel.target.path === 'rotation').map(channel => json.nodes[channel.target.node].name));
      assert.deepEqual([...posed].sort(), joints, `${kind} ${animation.name}`);
    }
    for (const primitive of json.meshes.flatMap(mesh => mesh.primitives)) assert.deepEqual(Object.keys(primitive.attributes).sort(), ['COLOR_0', 'JOINTS_0', 'NORMAL', 'POSITION', 'WEIGHTS_0'], kind);
  }
});

function extent(scene) {
  const point = new Vector3(), out = { low: Infinity, top: -Infinity };
  scene.updateMatrixWorld(true);
  scene.traverse(object => {
    if (!object.isMesh) return;
    const joints = object.geometry.getAttribute('skinIndex'), weights = object.geometry.getAttribute('skinWeight');
    for (let i = 0; i < object.geometry.getAttribute('position').count; i += 4) {
      const y = object.localToWorld(object.getVertexPosition(i, point)).y;
      out.low = Math.min(out.low, y);
      const main = [0, 1, 2, 3].reduce((best, k) => weights.getComponent(i, k) > weights.getComponent(i, best) ? k : best, 0);
      if (!object.skeleton.bones[joints.getComponent(i, main)].name.startsWith('tail')) out.top = Math.max(out.top, y);
    }
  });
  return out;
}

test('pets stand at their room height with ears above the sim body, the wolf nearly twice as tall, and no clip sinks a paw into the ground', async () => {
  const tops = {};
  for (const kind of PET_KINDS) {
    const model = await load(kind), mixer = new AnimationMixer(model.scene);
    for (const clip of model.animations) {
      if (clip.name === 'swim' || clip.name === 'blink') continue;
      const action = mixer.clipAction(clip);
      action.play();
      let low = Infinity;
      for (let step = 0; step <= 8; step++) {
        action.time = Math.round(clip.duration * step / 8 * KEY) / KEY;
        mixer.update(0);
        const { low: under, top } = extent(model.scene);
        low = Math.min(low, under);
        if (clip.name === 'idle' && step === 0) tops[kind] = top;
      }
      action.stop();
      assert.ok(low > -0.03 * (PET_SIZES[kind] ?? 1), `${kind} ${clip.name} sinks ${low.toFixed(3)} m into the ground`);
    }
  }
  assert.ok(tops.cat > PET.height && tops.cat < PET.height + 0.15, `the cat's ears reach ${tops.cat} m`);
  for (const kind of ['dog', 'fox', 'panda']) assert.ok(Math.abs(tops[kind] - tops.cat) < 0.1, `${kind}'s ears reach ${tops[kind]} m`);
  assert.ok(tops.bunny > 0.75 && tops.bunny < 0.95, `the bunny's ears reach ${tops.bunny} m`);
  assert.ok(Math.abs(tops.wolf / tops.cat - WOLF.size) < 0.15, `the wolf stands ${tops.wolf} m tall`);
});

const pet = extra => ({ id: 'pet', state: 'follow', time: 0, attack: null, vx: 0, vz: 0, facing: 0, swimming: false, ...extra });
const pick = extra => { const out = petClip(pet(extra)); return [out.name, out.at === null ? null : Math.round(out.at * 100) / 100]; };

test('the pet shows the clip for its sim state, its attacks timed so the hits land on the swing', () => {
  const pounce = PET_ATTACKS.pounce, total = pounce.windup + pounce.active + pounce.recover;
  assert.deepEqual(pick({}), ['stride', null]);
  assert.deepEqual(pick({ state: 'come', vx: 6 }), ['stride', null]);
  assert.deepEqual(pick({ state: 'attack', attack: 'pounce', time: total / 2 }), ['pounce', 0.5]);
  assert.deepEqual(pick({ state: 'attack', attack: 'spin', time: 9 }), ['spin', 1]);
  assert.deepEqual(pick({ state: 'attack', attack: 'swipe', time: 0, vx: 5 }), ['stride', null]);
  assert.deepEqual(pick({ state: 'attack', attack: 'swipe', time: 0 }), ['swipe', 0]);
  assert.deepEqual(pick({ state: 'fight' }), ['ready', null]);
  assert.deepEqual(pick({ state: 'fight', vx: 2 }), ['stride', null]);
  assert.deepEqual(pick({ state: 'dash', vz: 11 }), ['dash', null]);
  assert.deepEqual(pick({ state: 'evade', time: (PET.hop + 0.15) / 2 }), ['evade', 0.5]);
  assert.deepEqual(pick({ state: 'hurt', time: PET.hurt / 4 }), ['hurt', 0.25]);
  assert.deepEqual(pick({ state: 'out', time: PET.out / 2 }), ['out', 0.5]);
  assert.deepEqual(pick({ state: 'limp' }), ['out', 1]);
  assert.deepEqual(pick({ state: 'limp', vx: 1.5 }), ['limp', null]);
  assert.deepEqual(pick({ state: 'sit' }), ['sit', null]);
  assert.deepEqual(pick({ state: 'sniff' }), ['sniff', null]);
  assert.deepEqual(pick({ state: 'sniff', vz: 1 }), ['stride', null]);
  assert.deepEqual(pick({ state: 'scent', vz: 3 }), ['track', null]);
  assert.deepEqual(pick({ state: 'point', time: PET.point / 2 }), ['point', 0.5]);
  assert.deepEqual(pick({ state: 'dig' }), ['dig', null]);
  assert.deepEqual(pick({ state: 'pat', time: PET.pat / 2 }), ['pat', 0.5]);
  assert.deepEqual(pick({ state: 'follow', swimming: true }), ['swim', null]);
  assert.deepEqual(pick({ state: 'out', swimming: true, time: 0 }), ['out', 0]);
  assert.deepEqual(pick({ id: 'wolf', state: 'watch' }), ['sit', null]);
  assert.deepEqual(pick({ id: 'wolf', state: 'bow', time: WOLF.bow / 2 }), ['bow', 0.5]);
  assert.deepEqual(pick({ id: 'wolf', state: 'follow', vx: 3 }), ['stride', null]);
});

test('the bond ribbon wears the colour of the bond level and the wild wolf wears none', async () => {
  assert.deepEqual([0, 1, 2, 3, 9, -1].map(ribbonColour), [...BOND_LEVELS.map(level => level.color), BOND_LEVELS.at(-1).color, BOND_LEVELS[0].color]);
  const ribbonVertices = async (kind, bond) => {
    const model = await load(kind), source = [];
    model.scene.traverse(object => { if (object.isMesh) source.push(object.geometry.getAttribute('color')); });
    const before = source.map(colour => ({ count: colour.count, slots: Array.from({ length: colour.count }, (_, i) => Math.round(colour.getW(i) * 16)), red: Array.from({ length: colour.count }, (_, i) => colour.getX(i)) }));
    const view = buildPet(model, createPainterly(), { kind, bond });
    const painted = [];
    model.scene.traverse(object => { if (object.isMesh) painted.push(object.geometry.getAttribute('color')); });
    const ratios = [];
    before.forEach(({ count, slots, red }, mesh) => { for (let i = 0; i < count; i++) if (slots[i] === 1) ratios.push(painted[mesh].getX(i) / red[i]); });
    view.dispose();
    return { ratios, ribbon: view.ribbon };
  };
  const sage = await ribbonVertices('cat', 2);
  assert.equal(sage.ribbon, BOND_LEVELS[2].color);
  assert.ok(sage.ratios.length > 200, `${sage.ratios.length} ribbon vertices`);
  assert.ok(sage.ratios.every(ratio => Math.abs(ratio - new Color(BOND_LEVELS[2].color).r) < 1e-3), 'the ribbon takes the sage tone');
  assert.equal((await ribbonVertices('wolf', 0)).ratios.length, 0);
});

test('the view follows the pet, walks at a stroll and gallops at a run, and hides the wolf until it joins', async () => {
  const model = await load('cat'), view = buildPet(model, createPainterly(), { kind: 'cat' }), body = pet({ x: 0, y: 2, z: 0, facing: 1 });
  for (let i = 0; i < 20; i++) view.update(body, 1 / 30, false);
  assert.deepEqual([view.root.position.y, view.root.rotation.y, view.clip], [2, 1, 'stride']);
  for (let i = 0; i < 30; i++) { body.vz = PET.run; body.z += PET.run / 30; view.update(body, 1 / 30, false); }
  assert.ok(view.root.position.z > 4);
  Object.assign(body, { state: 'attack', attack: 'pounce', time: 0.4, vz: 0 });
  view.update(body, 1 / 30, false);
  assert.equal(view.clip, 'pounce');
  view.dispose();
  const wolf = buildPet(await load('wolf'), createPainterly(), { kind: 'wolf', name: 'wilds-wolf' });
  wolf.update(null, 1 / 30, false);
  assert.equal(wolf.root.visible, false);
  wolf.update(pet({ id: 'wolf', state: 'watch', x: 1, y: 0, z: 1 }), 1 / 30, false);
  assert.deepEqual([wolf.root.visible, wolf.clip, wolf.root.name], [true, 'sit', 'wilds-wolf']);
  wolf.dispose();
});
