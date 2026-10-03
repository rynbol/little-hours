import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Box3, Color, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AVATAR_OPTIONS } from '../../core/avatar.js';
import { ATTACKS, bladeAngles, bladeSegment } from '../../core/wilds/moves.js';
import { CLIMB, DODGE, HERO_GAITS, VITALS } from '../../core/wilds/player.js';
import { HERO_VIEW, buildHero, heroClip, heroLook, heroMemory } from './hero.js';
import { createPainterly } from './painterly.js';

const FRAME = 1 / 30;
const bytes = readFileSync(new URL('../../../public/wilds/hero.glb', import.meta.url));
const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
const load = () => new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const duration = animation => Math.max(...animation.samplers.map(sampler => json.accessors[sampler.input].max[0]));
const clips = Object.fromEntries(json.animations.map(animation => [animation.name, animation]));

test('the hero carries every clip the player can show, each as long as its row in the player and move tables', () => {
  assert.deepEqual(Object.keys(clips).sort(), ['backstep', 'blink', 'charge', 'climb', 'down', 'fall', 'glide', 'hang', 'heavy', 'hurt', 'idle', 'jog', 'jog-back', 'jump', 'knocked', 'land', 'leap', 'light1', 'light2', 'light3', 'mantle', 'parry', 'pet', 'rise', 'roll', 'sprint', 'stalk', 'strafe-left', 'strafe-right', 'stumble', 'swim', 'tread', 'victory', 'walk']);
  const close = (name, seconds) => assert.ok(Math.abs(duration(clips[name]) - seconds) <= FRAME + 1e-6, `${name} lasts ${duration(clips[name])}, the table says ${seconds}`);
  for (const id of Object.keys(ATTACKS)) close(id, ATTACKS[id].end);
  for (const gait of ['walk', 'jog', 'sprint', 'stalk', 'swim', 'climb']) close(gait, HERO_GAITS[gait].cycle);
  for (const name of ['strafe-left', 'strafe-right', 'jog-back']) close(name, HERO_GAITS.jog.cycle);
  for (const name of ['roll', 'backstep']) close(name, DODGE.time);
  for (const name of ['hurt', 'knocked', 'rise']) close(name, VITALS[name]);
  close('stumble', VITALS.rise);
  close('leap', CLIMB.leapTime);
  for (const [name, seconds] of Object.entries(HERO_VIEW.emotes)) close(name, seconds);
});

test('every clip poses every joint, so cross-fades never fall back to the bind pose', () => {
  const joints = json.skins[0].joints.map(index => json.nodes[index].name).sort();
  assert.ok(joints.length >= 40, `${joints.length} joints`);
  for (const [name, animation] of Object.entries(clips)) {
    const posed = new Set(animation.channels.filter(channel => channel.target.path === 'rotation').map(channel => json.nodes[channel.target.node].name));
    assert.deepEqual([...posed].sort(), joints, name);
  }
});

test('every hero part is skinned four bones a vertex and carries its colour slots', () => {
  const primitives = json.meshes.flatMap(mesh => mesh.primitives);
  assert.ok(primitives.length >= 20);
  for (const primitive of primitives) assert.deepEqual(Object.keys(primitive.attributes).sort(), ['COLOR_0', 'JOINTS_0', 'NORMAL', 'POSITION', 'WEIGHTS_0']);
  for (const style of ['bun', 'bob', 'waves', 'crop']) assert.ok(json.nodes.some(node => node.name === `hair-${style}`), style);
  for (const kind of ['starter', 'rootwood', 'steel', 'moonsteel']) assert.ok(json.nodes.some(node => node.name === `sword-${kind}`), kind);
});

test('the wardrobe dresses the fighter: style, outfit, bottoms, accessory, gear and charms pick the parts', () => {
  assert.deepEqual(heroLook().parts.sort(), ['body', 'bottom-trousers', 'glider', 'hair-bun', 'outfit-cardigan', 'sword-starter']);
  const look = heroLook({ avatar: { style: 'crop', outfit: 'sailor', bottomStyle: 'skirt', accessory: 'glasses', top: 'sky', skin: 'deep' }, wear: { sword: 'moonsteel-sword', cape: 'windleaf-cape', armour: 'leather-jerkin' }, owned: ['kestrel-feather', 'lake-pearl'] });
  assert.deepEqual(look.parts.sort(), ['accessory-glasses', 'body', 'bottom-skirt', 'feather', 'glider', 'hair-crop', 'jerkin', 'outfit-sailor', 'pearl', 'sword-moonsteel']);
  assert.equal(look.palette.skin, AVATAR_OPTIONS.skin.find(option => option.id === 'deep').color);
  assert.equal(look.palette.top, AVATAR_OPTIONS.top.find(option => option.id === 'sky').color);
  assert.deepEqual([look.palette.cape, look.palette.capeTrim], ['#5f8048', '#d8e6a0']);
  assert.deepEqual(heroLook({ avatar: { style: 'mohawk', outfit: 'armour', accessory: 'crown' } }).parts.sort(), ['body', 'bottom-trousers', 'glider', 'hair-bun', 'outfit-cardigan', 'sword-starter']);
});

const player = extra => ({ state: 'move', time: 0, attack: null, vx: 0, vz: 0, vy: 0, grounded: true, facing: 0, dodgeX: 0, dodgeZ: 1, leap: 0, charge: 0, ...extra });
const pick = (state, memory = {}) => { const out = heroClip(player(state), { ...heroMemory(), ...memory }); return [out.name, out.at === null ? null : Math.round(out.at * 100) / 100]; };

test('the hero shows the clip for its player state, timed so swings meet the sim', () => {
  assert.deepEqual(pick({}), ['stride', null]);
  assert.deepEqual(pick({ state: 'attack', attack: 'light2', time: 0.21 }), ['light2', 0.5]);
  assert.deepEqual(pick({ state: 'attack', attack: 'heavy', time: 2 }), ['heavy', 1]);
  assert.deepEqual(pick({ state: 'charge', vx: 1.5 }), ['stalk', null]);
  assert.deepEqual(pick({ state: 'charge' }), ['charge', null]);
  assert.deepEqual(pick({ state: 'dodge', time: 0.21, dodgeX: 1, dodgeZ: 0 }), ['roll', 0.5]);
  assert.deepEqual(pick({ state: 'dodge', time: 0.1, dodgeZ: -1 }), ['backstep', 0.24]);
  assert.deepEqual(pick({ state: 'dodge', time: 0.1 }, { parry: 0.1 }), ['parry', 0.5]);
  assert.deepEqual(pick({ state: 'hurt', time: 0.2 }), ['hurt', 0.5]);
  assert.deepEqual(pick({ state: 'rise', time: 0.25 }), ['stumble', 0.5]);
  assert.deepEqual(pick({ state: 'rise', time: 0.25 }, { knocked: true }), ['rise', 0.5]);
  assert.deepEqual(pick({ state: 'down', time: 0.4 }), ['knocked', 0.5]);
  assert.deepEqual(pick({ state: 'down', time: 3 }), ['down', null]);
  assert.deepEqual(pick({ state: 'climb' }), ['hang', null]);
  assert.deepEqual(pick({ state: 'climb' }, { climbing: true }), ['climb', null]);
  assert.deepEqual(pick({ state: 'climb', leap: CLIMB.leapTime / 2 }), ['leap', 0.5]);
  assert.deepEqual(pick({ state: 'glide' }), ['glide', null]);
  assert.deepEqual(pick({ state: 'swim', vx: 2 }), ['swim', null]);
  assert.deepEqual(pick({ state: 'swim' }), ['tread', null]);
  assert.deepEqual(pick({ grounded: false, vy: 3 }, { jump: 0.1 }), ['jump', 0.22]);
  assert.deepEqual(pick({ grounded: false, vy: -3 }), ['fall', null]);
  assert.deepEqual(pick({}, { land: 0.15 }), ['land', 0.5]);
  assert.deepEqual(pick({ vx: 4 }, { land: 0.15 }), ['stride', null]);
  assert.deepEqual(pick({}, { mantle: 0.1 }), ['mantle', 0.22]);
  assert.deepEqual(pick({}, { emote: 'pet', emoteTime: 0.8 }), ['pet', 0.5]);
  assert.deepEqual(pick({ vx: 3 }, { emote: 'pet', emoteTime: 0.8 }), ['stride', null]);
});

async function viewOf() {
  const model = await load(), body = player({ x: 0, y: 0, z: 0 }), view = buildHero(model, createPainterly());
  const settle = (extra, steps = 6) => { Object.assign(body, extra); for (let i = 0; i < steps; i++) view.update(body, 0.05, false); view.root.updateMatrixWorld(true); };
  return { model, body, view, settle };
}

test('the mouth and eyes face out of the head, so back-face culling never hides them, and the eyes and skin are marked for their own shading', async () => {
  const { model } = await viewOf(), body = model.scene.getObjectByName('body'), { geometry } = body;
  const position = geometry.getAttribute('position'), joints = geometry.getAttribute('skinIndex'), index = geometry.index, area = {};
  const corners = [new Vector3(), new Vector3(), new Vector3()], normal = new Vector3(), side = new Vector3();
  for (let t = 0; t < index.count; t += 3) {
    const bone = body.skeleton.bones[joints.getX(index.getX(t))].name;
    if (!['mouth', 'eyeL', 'eyeR'].includes(bone)) continue;
    corners.forEach((corner, k) => corner.fromBufferAttribute(position, index.getX(t + k)));
    normal.subVectors(corners[1], corners[0]).cross(side.subVectors(corners[2], corners[0]));
    area[bone] ??= { out: 0, in: 0 };
    area[bone][normal.z > 0 ? 'out' : 'in'] += normal.length() / 2;
  }
  for (const bone of ['mouth', 'eyeL', 'eyeR']) assert.ok(area[bone]?.out > area[bone].in, `${bone} shows ${area[bone]?.out} m² outward and ${area[bone]?.in} m² inward`);
  const parts = new Set(geometry.getAttribute('part').array);
  assert.deepEqual([...parts].sort(), [0, 1, 2, 3]);
});

test('the sword sits in the hand where the sim swings it at every hit frame', async () => {
  const { model, view, settle } = await viewOf(), sword = model.scene.getObjectByName('sword'), at = new Vector3(), pose = [0, 0], segment = { grip: [0, 0, 0], root: [0, 0, 0], tip: [0, 0, 0] };
  for (const [id, attack] of Object.entries(ATTACKS)) {
    for (const s of [0.25, 0.5, 0.75]) {
      const time = attack.strike[0] + (attack.strike[1] - attack.strike[0]) * s;
      settle({ state: 'attack', attack: id, time });
      assert.equal(view.clip, id);
      bladeAngles(attack, time, pose);
      bladeSegment({ x: 0, y: 0, z: 0, facing: 0 }, pose[0], pose[1], segment);
      sword.getWorldPosition(at);
      const miss = at.distanceTo(new Vector3(...segment.grip));
      assert.ok(miss < 0.075, `${id} at ${time.toFixed(2)} holds the grip ${miss.toFixed(3)} m from the sim's`);
    }
  }
  view.dispose();
});

test('the fighter stands about one and a half metres tall and never sinks into the ground, even rolling or knocked flat', async () => {
  const { model, body, view, settle } = await viewOf(), box = new Box3(), point = new Vector3();
  settle({}, 8);
  box.setFromObject(view.root, true);
  assert.ok(box.max.y > 1.4 && box.max.y < 1.62, `standing ${box.max.y} m tall`);
  const lowest = () => {
    let low = Infinity;
    view.root.updateMatrixWorld(true);
    model.scene.traverse(object => {
      if (!object.isMesh || !object.visible) return;
      for (let i = 0; i < object.geometry.getAttribute('position').count; i += 3) low = Math.min(low, object.localToWorld(object.getVertexPosition(i, point)).y);
    });
    return low;
  };
  const shown = { roll: ['dodge', DODGE.time], knocked: ['knocked', VITALS.knocked], rise: ['rise', VITALS.rise], down: ['down', 3], heavy: ['attack', ATTACKS.heavy.end], light3: ['attack', ATTACKS.light3.end], pet: ['move', HERO_VIEW.emotes.pet], victory: ['move', HERO_VIEW.emotes.victory] };
  for (const style of ['bun', 'waves']) {
    view.dress({ avatar: { style } });
    for (const [name, [state, end]] of Object.entries(shown)) {
      settle({ state: 'move', attack: null, time: 0 }, 10);
      if (state === 'move') view.emote(name);
      let low = Infinity;
      for (let step = 0; step <= 12; step++) {
        if (name === 'rise') view.memory.knocked = true;
        if (state === 'move') { view.update(body, end / 12, false); view.root.updateMatrixWorld(true); }
        else settle({ state, time: end * step / 12, attack: state === 'attack' ? name : null }, 3);
        low = Math.min(low, lowest());
      }
      assert.ok(low > -0.04, `${style} ${name} sinks ${low.toFixed(3)} m into the ground`);
    }
  }
  view.dispose();
});

test('changing the avatar in the wardrobe repaints the fighter in the new skin and swaps the parts', async () => {
  const { model, view } = await viewOf(), colour = model.scene.getObjectByName('body').geometry.getAttribute('color');
  const before = Array.from(colour.array);
  view.dress({ avatar: { skin: 'deep', style: 'waves' } });
  const deep = new Color(AVATAR_OPTIONS.skin.find(option => option.id === 'deep').color), warm = new Color(AVATAR_OPTIONS.skin.find(option => option.id === 'warm').color);
  const ratios = [];
  for (let i = 0; i < before.length; i += 3) if (before[i] > 1e-4 && Math.abs(before[i] - colour.array[i]) > 1e-6) ratios.push(colour.array[i] / before[i]);
  assert.ok(ratios.length > 500, `${ratios.length} skin vertices repainted`);
  assert.ok(ratios.every(ratio => Math.abs(ratio - deep.r / warm.r) < 1e-3), 'skin follows the chosen tone');
  assert.ok(model.scene.getObjectByName('hair-waves').visible && !model.scene.getObjectByName('hair-bun').visible);
  assert.deepEqual(view.parts.sort(), ['body', 'bottom-trousers', 'glider', 'hair-waves', 'outfit-cardigan', 'sword-starter']);
  view.dispose();
});
