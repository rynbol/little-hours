import { AdditiveAnimationBlendMode, AnimationMixer, AnimationUtils, BufferAttribute, Color } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BOND_LEVELS } from '../../core/pet-bonds.js';
import { clockRandom } from '../../core/test-pins.js';
import { PET, PET_ATTACKS, gaitFor } from '../../core/wilds/pet.js';
import { WOLF } from '../../core/wilds/wolf.js';

export const PET_KINDS = Object.freeze(['cat', 'dog', 'bunny', 'fox', 'panda', 'wolf']);
export const PET_VIEW = Object.freeze({ fade: 0.16, quick: 0.07, settle: 10, blink: Object.freeze([2.4, 6]), still: 0.2, sideways: 0.35, backward: -0.3 });
export const PET_SIZES = Object.freeze({ wolf: WOLF.size });
const STRIDE = Object.freeze(['idle', 'walk', 'trot', 'run', 'side-left', 'side-right']);
const PHASED = Object.freeze(['dash', 'track', 'limp', 'swim']);
const CLOSED = Object.freeze(['out', 'pat', 'hurt']);
const ease = s => { const t = Math.min(1, Math.max(0, s)); return t * t * (3 - 2 * t); };
const attackLength = attack => attack.windup + attack.active + attack.recover;

export const petKind = kind => PET_KINDS.includes(kind) ? kind : 'cat';
export const petFile = kind => `wilds/pets/${petKind(kind)}.glb`;
export const ribbonColour = bond => BOND_LEVELS[Math.min(BOND_LEVELS.length - 1, Math.max(0, Math.floor(bond) || 0))].color;

export function petClip(pet, out = { name: 'stride', at: null }) {
  const set = (name, at) => { out.name = name; out.at = at === null ? null : Math.min(1, Math.max(0, at)); return out; };
  const { state, time: t } = pet, moving = Math.hypot(pet.vx, pet.vz) > PET_VIEW.still;
  if (pet.id === 'wolf') {
    if (state === 'watch') return set('sit', null);
    if (state === 'bow') return set('bow', t / WOLF.bow);
    return set('stride', null);
  }
  if (pet.swimming && state !== 'out') return set('swim', null);
  switch (state) {
    case 'attack': {
      const attack = PET_ATTACKS[pet.attack];
      if (!attack) return set('ready', null);
      if (t === 0 && moving) return set('stride', null);
      return set(pet.attack, t / attackLength(attack));
    }
    case 'fight': return set(moving ? 'stride' : 'ready', null);
    case 'dash': return set('dash', null);
    case 'evade': return set('evade', t / (PET.hop + 0.15));
    case 'hurt': return set('hurt', t / PET.hurt);
    case 'out': return set('out', t / PET.out);
    case 'limp': return moving ? set('limp', null) : set('out', 1);
    case 'sit': return set('sit', null);
    case 'sniff': return set(moving ? 'stride' : 'sniff', null);
    case 'scent': return set('track', null);
    case 'point': return set('point', t / PET.point);
    case 'dig': return set('dig', null);
    case 'pat': return set('pat', t / PET.pat);
    default: return set('stride', null);
  }
}

const bytes = new Map();

export function loadPet(kind, base = import.meta.env?.BASE_URL ?? '/') {
  const file = petFile(kind);
  if (!bytes.has(file)) {
    const request = fetch(`${base}${file}`).then(response => {
      if (!response.ok) throw new Error(`${file} answered ${response.status}`);
      return response.arrayBuffer();
    });
    request.catch(() => bytes.delete(file));
    bytes.set(file, request);
  }
  return bytes.get(file).then(data => new GLTFLoader().parseAsync(data, ''));
}

export function buildPet(model, painterly, { kind = 'cat', bond = 0, name = 'wilds-pet' } = {}) {
  const root = model.scene, glow = { value: 0 }, size = PET_SIZES[kind] ?? 1;
  root.name = name;
  const material = painterly.material('#ffffff', { vertexColors: true, glow }), ribbon = new Color(ribbonColour(bond));
  const meshes = [];
  root.traverse(object => {
    if (!object.isMesh) return;
    object.material.dispose();
    object.material = material;
    object.castShadow = true; object.receiveShadow = true; object.frustumCulled = false;
    const source = object.geometry.getAttribute('color'), colour = new Float32Array(source.count * 3);
    for (let i = 0; i < source.count; i++) {
      const tone = Math.round(source.getW(i) * 16) === 1 ? ribbon : null;
      colour[i * 3] = source.getX(i) * (tone ? tone.r : 1);
      colour[i * 3 + 1] = source.getY(i) * (tone ? tone.g : 1);
      colour[i * 3 + 2] = source.getZ(i) * (tone ? tone.b : 1);
    }
    object.geometry.setAttribute('color', new BufferAttribute(colour, 3));
    meshes.push(object);
  });

  const mixer = new AnimationMixer(root), actions = {};
  for (const clip of model.animations) {
    const additive = clip.name === 'blink';
    const action = mixer.clipAction(additive ? AnimationUtils.makeClipAdditive(clip.clone()) : clip, undefined, additive ? AdditiveAnimationBlendMode : undefined);
    action.paused = true;
    action.play();
    action.weight = 0;
    actions[clip.name] = action;
  }
  const length = name => actions[name].getClip().duration;
  const gaits = Object.fromEntries(['walk', 'trot', 'run', 'side', ...PHASED].map(gait => [gait, gaitFor(gait, size)]));
  const reach = gait => gaits[gait].speed * gaits[gait].cycle;
  const share = Object.fromEntries(STRIDE.map(clip => [clip, clip === 'idle' ? 1 : 0]));
  const picked = { name: 'stride', at: null }, slot = { name: 'stride', time: 0 }, last = { name: '', time: 0 };
  let fade = 1, fadeTime = PET_VIEW.fade, phase = 0, idle = 0, pace = 0, x = 0, z = 0, primed = false, blinkAt = 0, blinkNext = PET_VIEW.blink[0];

  function stride(pet, moved, dt) {
    if (dt > 0) pace += (moved / dt - pace) * Math.min(1, dt * PET_VIEW.settle);
    const speed = Math.hypot(pet.vx, pet.vz), { walk, trot, run } = gaits;
    const moving = ease((pace - 0.1) / 0.4), trotting = ease((pace - walk.speed) / (trot.speed * 0.8 - walk.speed)), running = ease((pace - trot.speed) / (run.speed * 0.85 - trot.speed));
    const lx = speed > 0.05 ? (pet.vx * Math.cos(pet.facing) - pet.vz * Math.sin(pet.facing)) / speed : 0;
    const lz = speed > 0.05 ? (pet.vx * Math.sin(pet.facing) + pet.vz * Math.cos(pet.facing)) / speed : 1;
    const ahead = lz * lz, left = Math.max(0, lx) ** 2, right = Math.max(0, -lx) ** 2;
    share.idle = 1 - moving;
    share.walk = moving * ahead * (1 - trotting); share.trot = moving * ahead * trotting * (1 - running); share.run = moving * ahead * trotting * running;
    share['side-left'] = moving * left; share['side-right'] = moving * right;
    const forward = reach('walk') * (1 - trotting) + (reach('trot') * (1 - running) + reach('run') * running) * trotting;
    const step = forward * ahead + reach('side') * (1 - ahead);
    phase += (lz < PET_VIEW.backward ? -moved : moved) / step;
    phase -= Math.floor(phase);
  }

  function weigh(name, time, weight) {
    if (weight <= 0 || !name) return;
    if (name !== 'stride') { actions[name].time = time; actions[name].weight += weight; return; }
    for (const key of STRIDE) {
      if (share[key] <= 0) continue;
      actions[key].time = key === 'idle' ? idle : phase * length(key);
      actions[key].weight += weight * share[key];
    }
  }

  function clips(pet, dt, still) {
    const moved = primed ? Math.hypot(pet.x - x, pet.z - z) : 0;
    x = pet.x; z = pet.z; primed = true;
    petClip(pet, picked);
    stride(pet, picked.name === 'stride' ? moved : 0, dt);
    idle = (idle + (still ? 0 : dt)) % length('idle');
    if (picked.name !== slot.name) {
      last.name = slot.name; last.time = slot.time; slot.name = picked.name; slot.time = 0; fade = 0;
      fadeTime = pet.state === 'attack' || pet.state === 'hurt' || pet.state === 'evade' ? PET_VIEW.quick : PET_VIEW.fade;
    }
    fade = still ? 1 : Math.min(1, fade + dt / fadeTime);
    if (picked.at !== null) slot.time = picked.at * length(slot.name);
    else if (PHASED.includes(slot.name)) slot.time = (slot.time / length(slot.name) + Math.max(moved / reach(slot.name), slot.name === 'swim' && !still ? dt / length('swim') * 0.5 : 0)) % 1 * length(slot.name);
    else if (slot.name !== 'stride') slot.time = (slot.time + (still ? 0 : dt)) % length(slot.name);
    for (const clip in actions) actions[clip].weight = 0;
    const blend = last.name ? ease(fade) : 1;
    weigh(last.name, last.time, 1 - blend);
    weigh(slot.name, slot.time, blend);
    blinkAt += still ? 0 : dt;
    if (blinkAt > blinkNext) { blinkAt = 0; blinkNext = PET_VIEW.blink[0] + clockRandom() * (PET_VIEW.blink[1] - PET_VIEW.blink[0]); }
    actions.blink.weight = blinkAt < length('blink') && !CLOSED.includes(slot.name) ? 1 : 0;
    actions.blink.time = Math.min(blinkAt, length('blink'));
    mixer.update(0);
  }

  return {
    root,
    get clip() { return slot.name; },
    get ribbon() { return `#${ribbon.getHexString()}`; },
    update(pet, dt, still) {
      if (!pet) { root.visible = false; primed = false; return; }
      root.visible = true;
      clips(pet, dt, still);
      root.position.set(pet.x, pet.y, pet.z);
      root.rotation.y = pet.facing;
      glow.value = pet.state === 'hurt' ? 0.5 * (1 - Math.min(1, pet.time / PET.hurt)) : 0;
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
      for (const mesh of meshes) mesh.skeleton?.dispose();
    },
  };
}
