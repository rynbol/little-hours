import { ConeGeometry, CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry } from 'three';
import { PET, PET_ATTACKS } from '../../core/wilds/pet.js';
import { WOLF } from '../../core/wilds/wolf.js';
import { part, merge } from './shapes.js';

const COATS = Object.freeze({
  cat: Object.freeze({ fur: '#d99a68', belly: '#f4dcc0', ears: 'pointy', tail: 'long', stripe: '#b8754a' }),
  dog: Object.freeze({ fur: '#c79a72', belly: '#f1dcc3', ears: 'floppy', tail: 'short', stripe: '#a87b55' }),
  bunny: Object.freeze({ fur: '#e9dfd0', belly: '#fbf4ea', ears: 'long', tail: 'puff', stripe: '#d8cab6' }),
  fox: Object.freeze({ fur: '#dc7f48', belly: '#fbefe0', ears: 'pointy', tail: 'bushy', stripe: '#b85f30' }),
  panda: Object.freeze({ fur: '#c8603a', belly: '#3a2a26', ears: 'round', tail: 'ringed', stripe: '#f2e3cf' }),
  wolf: Object.freeze({ fur: '#4a5262', belly: '#7d8696', ears: 'pointy', tail: 'bushy', stripe: '#333a47' }),
});
const INK = '#231c1a', NOSE = '#4a302a';

function earParts(coat) {
  return [-1, 1].flatMap(side => {
    if (coat.ears === 'long') return [part(new CylinderGeometry(0.035, 0.05, 0.26, 6), coat.fur, { position: [side * 0.08, 0.3, -0.02], rotation: [-0.2, 0, -side * 0.18], scale: [1, 1, 0.55] })];
    if (coat.ears === 'floppy') return [part(new SphereGeometry(0.075, 8, 6), coat.stripe, { position: [side * 0.17, 0.06, 0], scale: [0.55, 1.4, 1] })];
    if (coat.ears === 'round') return [part(new SphereGeometry(0.06, 8, 6), coat.stripe, { position: [side * 0.13, 0.17, -0.02], scale: [1, 1, 0.55] })];
    return [part(new ConeGeometry(0.065, 0.15, 4), coat.fur, { position: [side * 0.11, 0.19, -0.02], rotation: [0, Math.PI / 4, -side * 0.25] })];
  });
}

function bodyGeometry(coat) {
  return merge([
    part(new SphereGeometry(0.24, 14, 10), coat.fur, { position: [0, 0.32, 0], scale: [1, 0.85, 1.45], shade: (x, y) => 0.88 + (y > 0.38 ? 0.08 : 0) + Math.abs(x) * 0.1 }),
    part(new SphereGeometry(0.2, 12, 8), coat.belly, { position: [0, 0.27, 0.06], scale: [0.85, 0.7, 1.3] }),
    ...[[-0.11, 0.2], [0.11, 0.2], [-0.11, -0.2], [0.11, -0.2]].map(([x, z]) => part(new CylinderGeometry(0.05, 0.045, 0.24, 6), coat.stripe, { position: [x, 0.12, z] })),
  ]);
}

function headGeometry(coat) {
  return merge([
    part(new SphereGeometry(0.17, 14, 10), coat.fur, { position: [0, 0, 0], scale: [1.05, 0.95, 1] }),
    part(new SphereGeometry(0.08, 10, 8), coat.belly, { position: [0, -0.045, 0.13], scale: [1.2, 0.85, 1] }),
    part(new SphereGeometry(0.025, 6, 4), NOSE, { position: [0, -0.01, 0.21] }),
    ...[-1, 1].map(side => part(new SphereGeometry(0.026, 6, 4), INK, { position: [side * 0.075, 0.035, 0.145] })),
    ...earParts(coat),
  ]);
}

function tailGeometry(coat) {
  if (coat.tail === 'puff') return merge([part(new SphereGeometry(0.08, 8, 6), coat.belly, { position: [0, 0, -0.04] })]);
  if (coat.tail === 'short') return merge([part(new CylinderGeometry(0.035, 0.05, 0.18, 6), coat.fur, { position: [0, 0.08, -0.02], rotation: [-0.6, 0, 0] })]);
  const bushy = coat.tail === 'bushy' || coat.tail === 'ringed';
  const parts = [part(new SphereGeometry(bushy ? 0.1 : 0.045, 8, 6), coat.fur, { position: [0, 0.12, -0.18], scale: [1, 1, bushy ? 2.4 : 5], rotation: [0.7, 0, 0] })];
  if (coat.tail === 'bushy') parts.push(part(new SphereGeometry(0.07, 8, 6), coat.belly, { position: [0, 0.26, -0.33] }));
  if (coat.tail === 'ringed') for (let i = 0; i < 3; i++) parts.push(part(new TorusGeometry(0.085 - i * 0.008, 0.02, 5, 10), coat.stripe, { position: [0, 0.06 + i * 0.07, -0.1 - i * 0.075], rotation: [0.7 + Math.PI / 2, 0, 0] }));
  return merge(parts);
}

function critter(painterly, coat, scale) {
  const root = new Group(), body = new Group(), glow = { value: 0 }, material = painterly.material('#ffffff', { vertexColors: true, glow });
  const torso = new Mesh(bodyGeometry(coat), material), head = new Mesh(headGeometry(coat), material), tail = new Mesh(tailGeometry(coat), material);
  for (const mesh of [torso, head, tail]) { mesh.castShadow = true; mesh.receiveShadow = true; }
  head.position.set(0, 0.48, 0.3); tail.position.set(0, 0.36, -0.3);
  body.add(torso, head, tail); root.add(body); root.scale.setScalar(scale);
  return { root, body, head, tail, glow };
}

export function buildPet(painterly, kind) {
  const view = critter(painterly, COATS[kind] ?? COATS.cat, 1);
  view.root.name = 'wilds-pet';
  let stride = 0, wag = 0, spin = 0;
  return {
    root: view.root,
    update(pet, dt, still) {
      const speed = Math.hypot(pet.vx, pet.vz), t = pet.time, attack = pet.attack && PET_ATTACKS[pet.attack];
      stride += speed * dt * 7;
      let pitch = 0, roll = 0, lift = 0, crouch = 0, nod = 0, turn = 0, wagRate = 3, wagSize = 0.15, stretch = 1;
      if (pet.state === 'sit') { pitch = -0.5; crouch = 0.07; nod = -0.25; wagSize = 0.25; }
      else if (pet.state === 'sniff') { nod = 0.55; wagRate = 16; wagSize = 0.55; }
      else if (pet.state === 'fight') { crouch = 0.05; nod = 0.12; wagRate = 8; wagSize = 0.3; }
      else if (pet.state === 'attack' && attack) {
        const active = t - attack.windup;
        if (active < 0) { crouch = 0.1; nod = 0.2; }
        else if (pet.attack === 'pounce') lift = Math.sin(Math.PI * Math.min(1, active / attack.active)) * 0.5;
        else if (pet.attack === 'swipe') turn = Math.sin(Math.PI * Math.min(1, active / Math.max(0.01, attack.active))) * 0.8;
        else if (pet.attack === 'spin' && active < attack.active && !still) spin += dt * 22;
      } else if (pet.state === 'dash') { stretch = 1.25; nod = 0.2; crouch = 0.04; }
      else if (pet.state === 'evade') lift = Math.sin(Math.PI * Math.min(1, t / PET.hop)) * 0.45;
      else if (pet.state === 'out') { roll = 1.45; crouch = 0.12; }
      else if (pet.state === 'limp') { roll = 0.12; nod = 0.25; wagSize = 0.04; }
      else if (pet.state === 'pat') { nod = -0.35; wagRate = 14; wagSize = 0.6; }
      if (pet.state !== 'attack' || pet.attack !== 'spin') spin = 0;
      if (still) { stride = 0; spin = 0; lift = Math.min(lift, 0.1); }
      const bob = still ? 0 : Math.abs(Math.sin(stride)) * Math.min(0.06, speed * 0.02);
      wag += dt * wagRate;
      view.root.position.set(pet.x, pet.y + lift + bob - crouch, pet.z);
      view.root.rotation.set(0, pet.facing + spin, 0);
      view.body.rotation.set(pitch, 0, roll);
      view.body.scale.set(1, 1, stretch);
      view.head.rotation.set(nod, turn, 0);
      view.tail.rotation.set(0, still ? 0 : Math.sin(wag) * wagSize, 0);
      view.glow.value = pet.state === 'hurt' ? 0.5 * (1 - Math.min(1, t / PET.hurt)) : 0;
      view.root.visible = true;
    },
  };
}

export function buildWolf(painterly) {
  const view = critter(painterly, COATS.wolf, 1.9);
  view.root.name = 'wilds-wolf'; view.root.visible = false;
  let stride = 0;
  return {
    root: view.root,
    update(wolf, dt, still) {
      if (!wolf) { view.root.visible = false; return; }
      view.root.visible = true;
      const speed = Math.hypot(wolf.vx, wolf.vz), t = wolf.time;
      stride += speed * dt * 4;
      let pitch = 0, nod = 0;
      if (wolf.state === 'watch') { pitch = -0.3; nod = -0.3; }
      else if (wolf.state === 'bow') { const s = Math.sin(Math.PI * Math.min(1, t / WOLF.bow)); pitch = 0.35 * s; nod = 0.75 * s; }
      const bob = still ? 0 : Math.abs(Math.sin(stride)) * Math.min(0.05, speed * 0.01);
      view.root.position.set(wolf.x, wolf.y + bob, wolf.z);
      view.root.rotation.set(0, wolf.facing, 0);
      view.body.rotation.set(pitch, 0, 0);
      view.head.rotation.set(nod, 0, 0);
      view.tail.rotation.set(0, still ? 0 : Math.sin(stride * 0.5) * 0.12, 0);
    },
  };
}
