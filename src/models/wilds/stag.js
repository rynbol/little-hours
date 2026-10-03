import { AdditiveAnimationBlendMode, AnimationMixer, AnimationUtils, Group, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STAG, STAG_ATTACKS, STAG_GAITS } from '../../core/wilds/stag.js';

export const STAG_VIEW = Object.freeze({ file: 'wilds/stag.glb', fade: 0.18, hold: 0.35, reach: 0.9, settle: 8, crumble: Object.freeze([2.4, 4.3]), petals: 46 });
const LOOSE = Object.freeze(['wake', 'stun', 'stagger', 'shift', 'defeat']);
const STRIDE = Object.freeze(['idle', 'walk', 'trot']);
const ease = s => { const t = Math.min(1, Math.max(0, s)); return t * t * (3 - 2 * t); };
const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

export function stagClip(stag, out = { name: 'stride', at: null }) {
  const { state, time: t, attack: id } = stag, attack = id && STAG_ATTACKS[id];
  const set = (name, at) => { out.name = name; out.at = at; return out; };
  if (state === 'dormant') return set('rest', null);
  if (state === 'gone') return set('defeat', STAG.defeat);
  if (LOOSE.includes(state)) return set(state, t);
  if (state === 'retreat') return set('bound', null);
  if (!attack) return set('stride', null);
  if (id === 'charge') return state === 'telegraph' ? set('charge-wind', t) : state === 'attack' ? set('gallop', null) : set('skid', t);
  const name = id === 'sweep' && stag.side < 0 ? 'sweep-mirror' : id;
  if (state === 'telegraph') return set(name, t);
  if (id === 'roots') return set(name, attack.telegraph + (state === 'attack' ? Math.min(t, STAG_VIEW.hold) : STAG_VIEW.hold + t * (attack.recover - STAG_VIEW.hold) / attack.recover));
  return set(name, attack.telegraph + (state === 'attack' ? t : attack.active + t));
}

let bytes = null;

export function loadStag(base = import.meta.env?.BASE_URL ?? '/') {
  bytes ??= fetch(`${base}${STAG_VIEW.file}`).then(response => {
    if (!response.ok) throw new Error(`${STAG_VIEW.file} answered ${response.status}`);
    return response.arrayBuffer();
  });
  bytes.catch(() => { bytes = null; });
  return bytes.then(data => new GLTFLoader().parseAsync(data, ''));
}

export function buildStag(model, stag, painterly, effects) {
  const root = new Group(), body = model.scene, flinch = { value: 0 }, heart = { value: 0.5 }, eyes = { value: 0.4 }, dissolve = { value: 0 };
  root.name = 'wilds-stag';
  root.add(body);
  const looks = {
    Body: painterly.material('#ffffff', { vertexColors: true, glow: flinch, dissolve }),
    Heart: painterly.material('#ffffff', { vertexColors: true, glow: heart, rim: false, dissolve }),
    Eyes: painterly.material('#ffffff', { vertexColors: true, glow: eyes, dissolve }),
  };
  const meshes = [], bones = [];
  body.traverse(object => {
    if (object.isBone) bones.push(object);
    if (!object.isMesh) return;
    const look = looks[object.material.name] ?? looks.Body;
    object.material.dispose();
    object.material = look;
    object.castShadow = true; object.receiveShadow = true; object.frustumCulled = false;
    meshes.push(object);
  });

  const mixer = new AnimationMixer(body), actions = {};
  for (const clip of model.animations) {
    const additive = clip.name === 'flinch';
    const action = mixer.clipAction(additive ? AnimationUtils.makeClipAdditive(clip.clone()) : clip, undefined, additive ? AdditiveAnimationBlendMode : undefined);
    action.paused = true;
    action.play();
    action.weight = 0;
    actions[clip.name] = action;
  }
  const length = name => actions[name].getClip().duration;
  const { walk, trot, gallop } = STAG_GAITS;
  const shown = { name: 'stride', at: null }, slot = { name: stagClip(stag, shown).name, time: 0 }, last = { name: '', time: 0 }, share = { idle: 1, walk: 0, trot: 0 }, at = new Vector3();
  let fade = 1, phase = 0, galloping = 0, idle = 0, pace = 0, x = stag.x, z = stag.z, facing = stag.facing, clock = 0, petals = 0, spawned = 0;

  function weigh(name, time, weight) {
    if (weight <= 0) return;
    if (name !== 'stride') { actions[name].time = time; actions[name].weight += weight; return; }
    for (const key of STRIDE) {
      actions[key].time = key === 'idle' ? idle : phase * length(key);
      actions[key].weight += weight * share[key];
    }
  }

  function step(dt, still) {
    const moved = Math.hypot(stag.x - x, stag.z - z), turned = Math.abs(angleTo(facing, stag.facing)), travel = moved + turned * STAG_VIEW.reach;
    x = stag.x; z = stag.z; facing = stag.facing;
    if (dt > 0) pace += (travel / dt - pace) * Math.min(1, dt * STAG_VIEW.settle);
    const moving = ease((pace - 0.15) / 0.75), trotting = ease((pace - walk.speed) / (trot.speed * 0.85 - walk.speed));
    share.idle = 1 - moving; share.walk = moving * (1 - trotting); share.trot = moving * trotting;
    phase = (phase + travel / (walk.speed * walk.cycle * (1 - trotting) + trot.speed * trot.cycle * trotting)) % 1;
    galloping = (galloping + moved / (gallop.speed * gallop.cycle)) % 1;
    idle = (idle + (still ? 0 : dt)) % length('idle');
    stagClip(stag, shown);
    if (shown.name !== slot.name) { last.name = slot.name; last.time = slot.time; slot.name = shown.name; slot.time = 0; fade = 0; }
    fade = Math.min(1, fade + dt / STAG_VIEW.fade);
    if (shown.at !== null) slot.time = shown.at;
    else if (slot.name === 'gallop') slot.time = galloping * length('gallop');
    else if (slot.name !== 'stride') slot.time = (slot.time + (still ? 0 : dt)) % length(slot.name);
    for (const name in actions) actions[name].weight = 0;
    const blend = last.name ? ease(fade) : 1;
    weigh(last.name, last.time, 1 - blend);
    weigh(slot.name, slot.time, blend);
    actions.flinch.weight = stag.flinch > 0 ? 1 : 0;
    actions.flinch.time = (1 - stag.flinch) * length('flinch');
    mixer.update(0);
  }

  function shade(dt, still) {
    const attack = stag.attack && STAG_ATTACKS[stag.attack];
    const warm = stag.state === 'telegraph' ? ease(stag.time / attack.telegraph) : stag.state === 'shift' ? Math.sin(Math.PI * Math.min(1, stag.time / STAG.shift)) : 0;
    clock += still ? 0 : dt;
    const beat = still ? 0 : Math.sin(clock * (stag.heartOpen ? 9 : 2.2));
    const soften = stag.state === 'defeat' ? 1 - ease(stag.time / 2.5) * 0.75 : stag.state === 'gone' ? 0.25 : 1;
    flinch.value = Math.max(stag.flinch * 0.45, warm * 0.12);
    heart.value = ((stag.heartOpen ? 1.5 + beat * 0.35 : 0.45 + beat * 0.12) + warm * 0.5) * soften;
    eyes.value = (stag.state === 'dormant' ? 0.1 : 0.35 + warm * 0.7) * soften;
    const [from, to] = STAG_VIEW.crumble;
    dissolve.value = stag.state === 'defeat' ? ease((stag.time - from) / (to - from)) : stag.state === 'gone' ? 1 : 0;
    root.visible = dissolve.value < 1;
    for (const mesh of meshes) mesh.castShadow = dissolve.value < 0.4;
  }

  function scatter(dt, still) {
    if (still || dissolve.value <= 0 || dissolve.value >= 1) return;
    root.updateMatrixWorld();
    for (petals += dt * STAG_VIEW.petals; petals >= 1; petals--) {
      bones[(spawned++ * 7) % bones.length].getWorldPosition(at);
      effects.blossom(at.x, at.y, at.z);
    }
  }

  return {
    root,
    get clip() { return slot.name; },
    get dissolve() { return dissolve.value; },
    update(dt, still) {
      root.position.set(stag.x, stag.y, stag.z);
      root.rotation.y = stag.facing;
      step(dt, still);
      shade(dt, still);
      scatter(dt, still);
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(body);
      for (const mesh of meshes) mesh.skeleton?.dispose();
    },
  };
}
