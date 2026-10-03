import { AdditiveAnimationBlendMode, AnimationMixer, AnimationUtils, BufferAttribute, Color } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AVATAR_DEFAULT, AVATAR_OPTIONS } from '../../core/avatar.js';
import { clockRandom } from '../../core/test-pins.js';
import { ATTACKS } from '../../core/wilds/moves.js';
import { CLIMB, DODGE, HERO_GAITS, VITALS } from '../../core/wilds/player.js';

export const HERO_VIEW = Object.freeze({
  file: 'wilds/hero.glb', fade: 0.14, quick: 0.07, settle: 10, wall: 0.3, turn: 18, climbing: 0.2,
  blink: Object.freeze([2.2, 5.2]), emotes: Object.freeze({ pet: 1.6, victory: 2.4 }),
  moments: Object.freeze({ land: 0.3, mantle: 0.45, jump: 0.45, parry: 0.4, parryFrom: 0.1 }),
});
export const HERO_CAPES = Object.freeze({ plain: Object.freeze(['#3e5d6e', '#d9b46a']), 'sturdy-cape': Object.freeze(['#7a6346', '#cfae72']), 'windleaf-cape': Object.freeze(['#5f8048', '#d8e6a0']) });
export const HERO_SWORDS = Object.freeze({ plain: 'starter', 'rootwood-sword': 'rootwood', 'steel-sword': 'steel', 'moonsteel-sword': 'moonsteel' });
const STRIDE = Object.freeze(['idle', 'walk', 'jog', 'sprint', 'strafe-left', 'strafe-right', 'jog-back']);
const SLOTS = Object.freeze([null, 'skin', 'hair', 'top', 'topShade', 'topTrim', 'bottom', 'bottomTrim', 'cape', 'capeTrim']);
const CLOSED = Object.freeze(['down', 'knocked']);
const FIGURE_PARTS = Object.freeze({ 1: 3, 2: 4, 10: 2, 11: 1 });
const ease = s => { const t = Math.min(1, Math.max(0, s)); return t * t * (3 - 2 * t); };
const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

export const heroMemory = () => ({ jump: Infinity, land: Infinity, mantle: Infinity, parry: Infinity, emote: null, emoteTime: 0, knocked: false, climbing: false });

export function heroClip(player, memory, out = { name: 'stride', at: null }) {
  const set = (name, at) => { out.name = name; out.at = at === null ? null : Math.min(1, Math.max(0, at)); return out; };
  const { state, time: t } = player, speed = Math.hypot(player.vx, player.vz), { moments } = HERO_VIEW;
  if (state === 'attack') return set(player.attack, t / ATTACKS[player.attack].end);
  if (state === 'charge') return speed > 0.3 ? set('stalk', null) : set('charge', null);
  if (state === 'dodge') {
    if (memory.parry < moments.parry - moments.parryFrom) return set('parry', (memory.parry + moments.parryFrom) / moments.parry);
    return set(player.dodgeX * Math.sin(player.facing) + player.dodgeZ * Math.cos(player.facing) < -0.5 ? 'backstep' : 'roll', t / DODGE.time);
  }
  if (state === 'hurt') return set('hurt', t / VITALS.hurt);
  if (state === 'knocked') return set('knocked', t / VITALS.knocked);
  if (state === 'rise') return set(memory.knocked ? 'rise' : 'stumble', t / VITALS.rise);
  if (state === 'down') return t < VITALS.knocked ? set('knocked', t / VITALS.knocked) : set('down', null);
  if (state === 'glide') return set('glide', null);
  if (state === 'swim') return set(speed > 0.3 ? 'swim' : 'tread', null);
  if (state === 'climb') return player.leap > 0 ? set('leap', 1 - player.leap / CLIMB.leapTime) : set(memory.climbing ? 'climb' : 'hang', null);
  if (memory.mantle < moments.mantle) return set('mantle', memory.mantle / moments.mantle);
  if (!player.grounded) return player.vy > 0 && memory.jump < moments.jump ? set('jump', memory.jump / moments.jump) : set('fall', null);
  if (memory.emote && speed < 0.5) return set(memory.emote, memory.emoteTime / HERO_VIEW.emotes[memory.emote]);
  if (memory.land < moments.land && speed < 2) return set('land', memory.land / moments.land);
  return set('stride', null);
}

export function heroLook({ avatar, wear = {}, owned = [] } = {}) {
  const appearance = { ...AVATAR_DEFAULT, ...avatar };
  const pick = part => AVATAR_OPTIONS[part].find(option => option.id === appearance[part]) ?? AVATAR_OPTIONS[part].find(option => option.id === AVATAR_DEFAULT[part]);
  const top = pick('top'), bottom = pick('bottom'), [cape, capeTrim] = HERO_CAPES[wear.cape] ?? HERO_CAPES.plain;
  const style = AVATAR_OPTIONS.style.some(option => option.id === appearance.style) ? appearance.style : AVATAR_DEFAULT.style;
  const outfit = AVATAR_OPTIONS.outfit.some(option => option.id === appearance.outfit) ? appearance.outfit : AVATAR_DEFAULT.outfit;
  const bottomStyle = AVATAR_OPTIONS.bottomStyle.some(option => option.id === appearance.bottomStyle) ? appearance.bottomStyle : AVATAR_DEFAULT.bottomStyle;
  const parts = ['body', 'glider', `hair-${style}`, `outfit-${outfit}`, `bottom-${bottomStyle}`, `sword-${HERO_SWORDS[wear.sword] ?? HERO_SWORDS.plain}`];
  if (appearance.accessory !== 'none' && AVATAR_OPTIONS.accessory.some(option => option.id === appearance.accessory)) parts.push(`accessory-${appearance.accessory}`);
  if (wear.armour === 'leather-jerkin') parts.push('jerkin');
  if (owned.includes('kestrel-feather')) parts.push('feather');
  if (owned.includes('lake-pearl')) parts.push('pearl');
  return {
    parts,
    palette: { skin: pick('skin').color, hair: pick('hair').color, top: top.color, topShade: top.shade, topTrim: top.trim, bottom: bottom.color, bottomTrim: bottom.trim, cape, capeTrim },
  };
}

let bytes = null;

export function loadHero(base = import.meta.env?.BASE_URL ?? '/') {
  bytes ??= fetch(`${base}${HERO_VIEW.file}`).then(response => {
    if (!response.ok) throw new Error(`${HERO_VIEW.file} answered ${response.status}`);
    return response.arrayBuffer();
  });
  bytes.catch(() => { bytes = null; });
  return bytes.then(data => new GLTFLoader().parseAsync(data, ''));
}

export function buildHero(model, painterly) {
  const root = model.scene, glow = { value: 0 };
  root.name = 'wilds-hero';
  const looks = { Body: painterly.material('#ffffff', { vertexColors: true, figure: true }), Blade: painterly.material('#ffffff', { vertexColors: true, glow }) };
  const parts = new Map(), tones = {};
  root.traverse(object => {
    if (!object.isMesh) return;
    const name = object.parent.type === 'Group' && object.parent !== root ? object.parent.name : object.name.replace(/_\d+$/, '');
    const look = looks[object.material.name] ?? looks.Body;
    object.material.dispose();
    object.material = look;
    object.castShadow = true; object.receiveShadow = true; object.frustumCulled = false;
    const source = object.geometry.getAttribute('color');
    object.geometry.setAttribute('color', new BufferAttribute(new Float32Array(source.count * 3), 3));
    object.geometry.setAttribute('part', new BufferAttribute(Float32Array.from({ length: source.count }, (_, i) => FIGURE_PARTS[Math.round(source.getW(i) * 16)] ?? 0), 1));
    if (!parts.has(name)) parts.set(name, []);
    parts.get(name).push({ mesh: object, source });
  });

  function paint({ mesh, source }) {
    const colour = mesh.geometry.getAttribute('color'), out = colour.array;
    for (let i = 0; i < source.count; i++) {
      const tone = tones[SLOTS[Math.round(source.getW(i) * 16)]];
      out[i * 3] = source.getX(i) * (tone ? tone.r : 1);
      out[i * 3 + 1] = source.getY(i) * (tone ? tone.g : 1);
      out[i * 3 + 2] = source.getZ(i) * (tone ? tone.b : 1);
    }
    colour.needsUpdate = true;
  }

  let shown = [];
  function dress(look) {
    const { parts: wanted, palette } = heroLook(look);
    for (const slot of SLOTS) if (slot) tones[slot] = (tones[slot] ?? new Color()).set(palette[slot]);
    for (const [name, pieces] of parts) for (const piece of pieces) { piece.mesh.visible = wanted.includes(name); if (piece.mesh.visible) paint(piece); }
    shown = wanted.filter(name => parts.has(name));
  }

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
  const { walk, jog, sprint, climb, swim } = HERO_GAITS;
  const memory = heroMemory(), picked = { name: 'stride', at: null }, slot = { name: 'stride', time: 0 }, last = { name: '', time: 0 };
  const share = Object.fromEntries(STRIDE.map(name => [name, name === 'idle' ? 1 : 0]));
  let fade = 1, fadeTime = HERO_VIEW.fade, phase = 0, idle = 0, climbPhase = 0, swimPhase = 0, pace = 0, x = 0, y = 0, z = 0, primed = false;
  let blinkAt = 0, blinkNext = HERO_VIEW.blink[0], turn = 0, wall = 0, emoteYaw = null;

  function stride(player, moved, dt) {
    const speed = Math.hypot(player.vx, player.vz);
    if (dt > 0) pace += (moved / dt - pace) * Math.min(1, dt * HERO_VIEW.settle);
    const moving = ease((pace - 0.15) / 0.6), jogging = ease((pace - walk.speed) / (jog.speed * 0.9 - walk.speed)), sprinting = ease((pace - jog.speed) / (sprint.speed * 0.95 - jog.speed));
    const lx = speed > 0.05 ? (player.vx * Math.cos(player.facing) - player.vz * Math.sin(player.facing)) / speed : 0;
    const lz = speed > 0.05 ? (player.vx * Math.sin(player.facing) + player.vz * Math.cos(player.facing)) / speed : 1;
    const ahead = Math.max(0, lz) ** 2, back = Math.max(0, -lz) ** 2, left = Math.max(0, lx) ** 2, right = Math.max(0, -lx) ** 2;
    share.idle = 1 - moving;
    share.walk = moving * ahead * (1 - jogging); share.jog = moving * ahead * jogging * (1 - sprinting); share.sprint = moving * ahead * jogging * sprinting;
    share['strafe-left'] = moving * left; share['strafe-right'] = moving * right; share['jog-back'] = moving * back;
    const forward = walk.speed * walk.cycle * (1 - jogging) + (jog.speed * jog.cycle * (1 - sprinting) + sprint.speed * sprint.cycle * sprinting) * jogging;
    const reach = forward * ahead + jog.speed * jog.cycle * (1 - ahead);
    phase = (phase + moved / reach) % 1;
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

  function remember(player, dt, still, shift) {
    const tick = still ? 0 : dt;
    for (const key of ['jump', 'land', 'mantle', 'parry']) memory[key] += tick;
    if (player.state !== 'dodge') memory.parry = Infinity;
    if (player.state === 'knocked' || player.state === 'down') memory.knocked = true;
    else if (player.state !== 'rise') memory.knocked = false;
    memory.climbing = player.state === 'climb' && dt > 0 && shift / dt > HERO_VIEW.climbing;
    if (memory.emote) {
      memory.emoteTime += tick;
      if (memory.emoteTime >= HERO_VIEW.emotes[memory.emote] || player.state !== 'move' || Math.hypot(player.vx, player.vz) > 0.5) { memory.emote = null; emoteYaw = null; }
    }
  }

  function clips(player, dt, still) {
    const shift = primed ? Math.hypot(player.x - x, player.y - y, player.z - z) : 0, flat = primed ? Math.hypot(player.x - x, player.z - z) : 0;
    x = player.x; y = player.y; z = player.z; primed = true;
    remember(player, dt, still, shift);
    stride(player, player.state === 'move' && player.grounded ? flat : 0, dt);
    idle = (idle + (still ? 0 : dt)) % length('idle');
    if (player.state === 'climb') climbPhase = (climbPhase + shift / (climb.speed * climb.cycle)) % 1;
    if (player.state === 'swim') swimPhase = (swimPhase + flat / (swim.speed * swim.cycle)) % 1;
    heroClip(player, memory, picked);
    if (picked.name !== slot.name) {
      last.name = slot.name; last.time = slot.time; slot.name = picked.name; slot.time = 0; fade = 0;
      fadeTime = player.state === 'attack' || picked.name === 'parry' ? HERO_VIEW.quick : HERO_VIEW.fade;
    }
    fade = still ? 1 : Math.min(1, fade + dt / fadeTime);
    if (picked.at !== null) slot.time = picked.at * length(slot.name);
    else if (slot.name === 'climb') slot.time = climbPhase * length('climb');
    else if (slot.name === 'swim') slot.time = swimPhase * length('swim');
    else if (slot.name !== 'stride') slot.time = (slot.time + (still ? 0 : dt)) % length(slot.name);
    for (const name in actions) actions[name].weight = 0;
    const blend = last.name ? ease(fade) : 1;
    weigh(last.name, last.time, 1 - blend);
    weigh(slot.name, slot.time, blend);
    blinkAt += still ? 0 : dt;
    if (blinkAt > blinkNext) { blinkAt = 0; blinkNext = HERO_VIEW.blink[0] + clockRandom() * (HERO_VIEW.blink[1] - HERO_VIEW.blink[0]); }
    actions.blink.weight = blinkAt < length('blink') && !CLOSED.includes(slot.name) ? 1 : 0;
    actions.blink.time = Math.min(blinkAt, length('blink'));
    mixer.update(0);
  }

  function place(player, dt, still) {
    const climbing = player.state === 'climb', rolling = player.state === 'dodge' && slot.name === 'roll';
    wall = still ? (climbing ? 1 : 0) : wall + ((climbing ? 1 : 0) - wall) * Math.min(1, dt * 12);
    const want = rolling ? angleTo(player.facing, Math.atan2(player.dodgeX, player.dodgeZ)) : emoteYaw === null ? 0 : angleTo(player.facing, emoteYaw);
    turn = still ? want : turn + angleTo(turn, want) * Math.min(1, dt * HERO_VIEW.turn);
    root.position.set(player.x - Math.sin(player.facing) * HERO_VIEW.wall * wall, player.y, player.z - Math.cos(player.facing) * HERO_VIEW.wall * wall);
    root.rotation.y = player.facing + turn;
    glow.value = player.state === 'charge' ? (player.charge >= 1 ? 0.5 + (still ? 0 : 0.25 * Math.sin(player.time * 22)) : player.charge * 0.4) : 0;
  }

  dress();
  return {
    root, dress, memory,
    get clip() { return slot.name; },
    get parts() { return shown; },
    jump() { memory.jump = 0; },
    land(event) { if (!event.hard) memory.land = 0; },
    mantle() { memory.mantle = 0; },
    perfect() { memory.parry = 0; },
    emote(name, yaw = null) { memory.emote = name; memory.emoteTime = 0; emoteYaw = yaw; },
    update(player, dt, still) {
      clips(player, dt, still);
      place(player, dt, still);
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
      for (const pieces of parts.values()) for (const { mesh } of pieces) mesh.skeleton?.dispose();
    },
  };
}
