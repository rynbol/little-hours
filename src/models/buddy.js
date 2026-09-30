import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { CreateSphereVertexData } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { CreateCylinderVertexData } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Vector3, Quaternion, Matrix } from '@babylonjs/core/Maths/math.vector.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { BoundingInfo } from '@babylonjs/core/Culling/boundingInfo.js';
import { Skeleton } from '@babylonjs/core/Bones/skeleton.js';
import { Bone } from '@babylonjs/core/Bones/bone.js';
import '@babylonjs/core/Meshes/thinInstanceMesh.js';
import { createContactShadow } from './furniture.js';

const BONES = ['body', 'eyes', 'happy', 'sprout', 'wing-l', 'wing-r', 'find'];
const PIVOTS = { body: [0, 0, 0], eyes: [0, 0.018, 0.12], happy: [0, 0.012, 0.12], sprout: [0, 0.11, 0], 'wing-l': [-0.09, 0.04, -0.07], 'wing-r': [0.09, 0.04, -0.07], find: [0, -0.075, 0.18] };
const HAPPY_POSES = new Set(['warm', 'dance', 'twirl', 'boop', 'bounce', 'zoom', 'loop']);
const SPARKLES = 24, SIZE = 1.2;
const hex = value => Color3.FromHexString(value);
const mix = (a, b, t) => new Color3(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);

function build(colors, stage) {
  const positions = [], normals = [], vertexColors = [], indices = [], bones = [];
  const glow = hex('#fffdf6'), body = mix(hex(colors.body), glow, 0.35), shade = mix(hex(colors.shade), glow, 0.3), cheek = mix(hex(colors.cheek), glow, 0.1), ink = hex('#3b2a33'), white = hex('#fffaf2');
  const leaf = hex('#8cc57a'), leafDark = hex('#6aa35c'), gold = hex('#ffd46b'), goldLight = hex('#fff0b8'), petal = hex('#fbd3e0');
  const matrix = new Matrix(), point = new Vector3(), normal = new Vector3();
  function add(data, bone, { scale = [1, 1, 1], rotate = [0, 0, 0], at = [0, 0, 0] }, tone) {
    Matrix.ComposeToRef(new Vector3(...scale), Quaternion.RotationYawPitchRoll(rotate[1], rotate[0], rotate[2]), new Vector3(...at), matrix);
    const first = positions.length / 3, index = BONES.indexOf(bone);
    for (let i = 0; i < data.positions.length; i += 3) {
      Vector3.TransformCoordinatesFromFloatsToRef(data.positions[i], data.positions[i + 1], data.positions[i + 2], matrix, point);
      Vector3.TransformNormalFromFloatsToRef(data.normals[i] / scale[0], data.normals[i + 1] / scale[1], data.normals[i + 2] / scale[2], matrix, normal);
      normal.normalize();
      const color = typeof tone === 'function' ? tone(point) : tone;
      positions.push(point.x, point.y, point.z); normals.push(normal.x, normal.y, normal.z); vertexColors.push(color.r, color.g, color.b, 1); bones.push(index);
    }
    for (const i of data.indices) indices.push(first + i);
  }
  const ball = segments => CreateSphereVertexData({ diameter: 2, segments });
  add(ball(10), 'body', { scale: [0.13, 0.122, 0.126] }, p => mix(shade, body, Math.min(1, Math.max(0, (p.y + 0.1) / 0.13))));
  for (const side of [-1, 1]) {
    add(ball(4), 'body', { scale: [0.026, 0.016, 0.01], rotate: [0, side * 0.55, 0], at: [side * 0.066, -0.016, 0.106] }, cheek);
    add(ball(4), 'body', { scale: [0.03, 0.018, 0.034], at: [side * 0.048, -0.114, 0.02] }, shade);
    add(ball(5), 'eyes', { scale: [0.017, 0.024, 0.01], rotate: [0, side * 0.33, 0], at: [side * 0.041, 0.018, 0.119] }, ink);
    add(ball(2), 'eyes', { scale: [0.0065, 0.0065, 0.004], rotate: [0, side * 0.33, 0], at: [side * 0.036, 0.029, 0.127] }, white);
    for (let i = 0; i < 5; i++) {
      const angle = Math.PI * (0.15 + i * 0.175);
      add(ball(2), 'happy', { scale: [0.0062, 0.0062, 0.005], at: [side * 0.041 + Math.cos(angle) * 0.016, 0.01 + Math.sin(angle) * 0.013, 0.123 - Math.abs(Math.cos(angle)) * 0.004] }, ink);
    }
    const wing = `wing-${side < 0 ? 'l' : 'r'}`, veil = mix(white, hex('#d9c8f0'), 0.45);
    add(ball(6), wing, { scale: [0.07, 0.034, 0.006], rotate: [0.2, side * 0.5, side * -0.6], at: [side * 0.15, 0.075, -0.085] }, veil);
    add(ball(6), wing, { scale: [0.048, 0.024, 0.006], rotate: [0.2, side * 0.5, side * 0.05], at: [side * 0.14, 0.02, -0.085] }, veil);
  }
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI * (1.2 + i * 0.2);
    add(ball(2), 'body', { scale: [0.0048, 0.0048, 0.004], at: [Math.cos(angle) * 0.012, -0.014 + Math.sin(angle) * 0.008, 0.124] }, ink);
  }
  const level = ['seed', 'sprout', 'leafy', 'budding', 'blooming'].indexOf(stage);
  add(CreateCylinderVertexData({ height: 1, diameterTop: 0.7, diameterBottom: 1, tessellation: 6 }), 'sprout', { scale: [0.014, 0.05 + level * 0.008, 0.014], at: [0, 0.135 + level * 0.004, 0] }, leafDark);
  const top = 0.16 + level * 0.008;
  const leaves = level === 0 ? [[1, 0.8]] : level === 1 ? [[1, 0.9], [-1, 0.8]] : [[1, 1.1], [-1, 1]];
  for (const [side, size] of leaves) add(ball(4), 'sprout', { scale: [0.034 * size, 0.009, 0.018 * size], rotate: [0, 0.2 * side, side * 0.5], at: [side * 0.03 * size, top, 0] }, leaf);
  if (level === 2) add(ball(4), 'sprout', { scale: [0.022, 0.008, 0.014], rotate: [0.6, 1.6, 0], at: [0, top + 0.012, -0.018] }, leaf);
  if (level === 3) add(ball(5), 'sprout', { scale: [0.019, 0.024, 0.019], at: [0, top + 0.022, 0] }, cheek);
  if (level === 4) {
    for (let i = 0; i < 5; i++) {
      const angle = i / 5 * Math.PI * 2;
      add(ball(4), 'sprout', { scale: [0.021, 0.007, 0.013], rotate: [0, -angle, 0], at: [Math.cos(angle) * 0.019, top + 0.026, Math.sin(angle) * 0.019] }, petal);
    }
    add(ball(4), 'sprout', { scale: [0.012, 0.009, 0.012], at: [0, top + 0.03, 0] }, gold);
  }
  const star = { positions: [], normals: [], indices: [] };
  for (const face of [1, -1]) {
    const first = star.positions.length / 3;
    star.positions.push(0, 0, face * 0.35); star.normals.push(0, 0, face);
    for (let i = 0; i < 10; i++) { const angle = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.45 : 1; star.positions.push(Math.cos(angle) * r, Math.sin(angle) * r, 0); star.normals.push(Math.cos(angle) * 0.4, Math.sin(angle) * 0.4, face); }
    for (let i = 0; i < 10; i++) face > 0 ? star.indices.push(first, first + 1 + i, first + 1 + (i + 1) % 10) : star.indices.push(first, first + 1 + (i + 1) % 10, first + 1 + i);
  }
  add(star, 'find', { scale: [0.07, 0.07, 0.06], at: PIVOTS.find }, p => mix(gold, goldLight, Math.max(0, 1 - Math.hypot(p.x, p.y - PIVOTS.find[1]) / 0.03)));
  const matricesIndices = new Float32Array(bones.length * 4), matricesWeights = new Float32Array(bones.length * 4);
  bones.forEach((bone, i) => { matricesIndices[i * 4] = bone; matricesWeights[i * 4] = 1; });
  return Object.assign(new VertexData(), { positions, normals, colors: vertexColors, indices, matricesIndices, matricesWeights });
}

function haloData(colors) {
  const positions = [0, 0, 0], colorsOut = [], indices = [], tint = mix(hex(colors.body), Color3.White(), 0.55), rings = [[0.45, 0.14], [1, 0]];
  colorsOut.push(tint.r, tint.g, tint.b, 0.3);
  for (const [radius, alpha] of rings) for (let i = 0; i < 20; i++) { const angle = i / 20 * Math.PI * 2; positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0); colorsOut.push(tint.r, tint.g, tint.b, alpha); }
  for (let i = 0; i < 20; i++) {
    const a = 1 + i, b = 1 + (i + 1) % 20;
    indices.push(0, b, a, a, b, b + 20, a, b + 20, a + 20);
  }
  const normals = positions.map((_, i) => i % 3 === 2 ? 1 : 0);
  return Object.assign(new VertexData(), { positions, normals, colors: colorsOut, indices });
}

function sparkleData() {
  const positions = [], normals = [], indices = [];
  for (const [ax, az] of [[1, 0], [0, 1]]) {
    const first = positions.length / 3;
    positions.push(0, 0, 0);
    for (let i = 0; i < 8; i++) { const angle = i * Math.PI / 4, r = i % 2 ? 0.28 : 1; positions.push(Math.cos(angle) * r * ax, Math.sin(angle) * r, Math.cos(angle) * r * az); }
    for (let i = 0; i < 8; i++) indices.push(first, first + 1 + i, first + 1 + (i + 1) % 8);
  }
  for (let i = 0; i < positions.length / 3; i++) normals.push(0, 0, 1);
  const colors = [];
  for (let i = 0; i < positions.length / 3; i++) colors.push(1, 0.93, 0.72, 1);
  return Object.assign(new VertexData(), { positions, normals, colors, indices });
}

export function createBuddyModel(scene, colors, stage) {
  const root = new TransformNode('buddy', scene);
  root.rotationQuaternion = new Quaternion();
  const skeleton = new Skeleton('buddy-rig', 'buddy-rig', scene);
  const rig = new Map(BONES.map(name => [name, new Bone(name, skeleton)]));
  const body = new Mesh('buddy-body', scene);
  const halo = new Mesh('buddy-halo', scene);
  halo.parent = root; halo.billboardMode = Mesh.BILLBOARDMODE_ALL; halo.scaling.setAll(0.3); halo.isPickable = false; halo.useVertexColors = true; halo.hasVertexAlpha = true;
  halo.metadata = { buddy: true, castShadow: false, effect: 'buddy-halo' };
  halo.material = scene.getMaterialByName('buddy-halo-glow') || Object.assign(new StandardMaterial('buddy-halo-glow', scene), { disableLighting: true, diffuseColor: Color3.Black(), emissiveColor: Color3.White(), backFaceCulling: false, disableDepthWrite: true, alphaMode: 1 });
  let look = '';
  function setLook(nextColors, nextStage) {
    const key = `${nextColors.body}${nextColors.shade}${nextColors.cheek}${nextStage}`;
    if (key === look) return;
    look = key; build(nextColors, nextStage).applyToMesh(body, false); haloData(nextColors).applyToMesh(halo, false);
    body.setBoundingInfo(new BoundingInfo(new Vector3(-0.3, -0.2, -0.2), new Vector3(0.3, 0.26, 0.26)));
  }
  setLook(colors, stage);
  body.parent = root; body.skeleton = skeleton; body.numBoneInfluencers = 1;
  body.material = scene.getMaterialByName('buddy-skin') || Object.assign(new StandardMaterial('buddy-skin', scene), { diffuseColor: Color3.White(), emissiveColor: new Color3(0.5, 0.47, 0.44), specularColor: new Color3(0.1, 0.09, 0.08), specularPower: 24 });
  body.useVertexColors = true; body.hasVertexAlpha = false; body.receiveShadows = false; body.isPickable = false;
  body.metadata = { buddy: true, castShadow: false };

  const sparkle = new Mesh('buddy-sparkles', scene);
  sparkleData().applyToMesh(sparkle);
  sparkle.material = scene.getMaterialByName('buddy-sparkle-glow') || Object.assign(new StandardMaterial('buddy-sparkle-glow', scene), { disableLighting: true, diffuseColor: Color3.Black(), emissiveColor: Color3.White(), backFaceCulling: false });
  sparkle.useVertexColors = true; sparkle.isPickable = false; sparkle.metadata = { castShadow: false, effect: 'buddy-sparkle' }; sparkle.alwaysSelectAsActiveMesh = true;
  const sparkleMatrices = new Float32Array(SPARKLES * 16);
  for (let i = 0; i < SPARKLES; i++) sparkleMatrices[i * 16 + 15] = 1;
  sparkle.thinInstanceSetBuffer('matrix', sparkleMatrices, 16, false);
  sparkle.setEnabled(false);
  const motes = Array.from({ length: SPARKLES }, () => ({ age: Infinity, life: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0, spin: 0 }));
  let nextMote = 0, emitAt = 0, seed = 0.37;
  const noise = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  function emit(x, y, z, speed, size) {
    const mote = motes[nextMote]; nextMote = (nextMote + 1) % SPARKLES;
    Object.assign(mote, { age: 0, life: 0.6 + noise() * 0.5, x, y, z, vx: (noise() - 0.5) * speed, vy: (noise() - 0.3) * speed, vz: (noise() - 0.5) * speed, size: size * (0.7 + noise() * 0.6), spin: noise() * 6 });
  }

  const contact = createContactShadow('buddy-contact-shadow', 0.4, 0.4, scene, { soft: 0.12, strength: 0.2 });
  contact.metadata = { ...contact.metadata, buddy: true };

  const local = new Map(BONES.map(name => [name, Matrix.Identity()]));
  const shrink = Matrix.Scaling(1e-4, 1e-4, 1e-4), toPivot = new Matrix(), fromPivot = new Matrix(), turn = new Matrix(), q = new Quaternion(), s = new Vector3(), zero = Vector3.Zero();
  function pose(name, yaw, pitch, roll, scaleX = 1, scaleY = 1) {
    const [px, py, pz] = PIVOTS[name];
    Matrix.TranslationToRef(-px, -py, -pz, toPivot); Matrix.TranslationToRef(px, py, pz, fromPivot);
    Quaternion.RotationYawPitchRollToRef(yaw, pitch, roll, q); s.set(scaleX, scaleY, 1);
    Matrix.ComposeToRef(s, q, zero, turn);
    toPivot.multiplyToRef(turn, local.get(name)).multiplyToRef(fromPivot, local.get(name));
  }
  let fade = 1, blinkAt = 2, eyes = 1, happy = 0, lean = 0, tilt = 0, twist = 0, gone = true;
  const head = new Vector3(0, 0.03, 0);

  return {
    root, body, halo, sparkle, contact, setLook,
    headPoint(out) { return Vector3.TransformCoordinatesToRef(head, root.computeWorldMatrix(true), out); },
    burst() { const p = root.position; for (let i = 0; i < 16; i++) emit(p.x, p.y, p.z, 1.5, 0.065); emitAt = 0; },
    animate(frame, dt, seconds, reducedMotion) {
      const visible = frame.visible;
      if (visible === gone) { gone = !visible; root.setEnabled(visible); contact.setEnabled(visible); }
      const still = reducedMotion ? 0 : 1, activity = frame.activity, age = frame.activityAge || 0;
      let bob = still * Math.sin(seconds * 2.4) * 0.024, yaw = 0, pitch = 0.3 * frame.flying, roll = 0, lift = 0, wingSpeed = 9 + frame.flying * 9, wingOpen = 0.35;
      if (activity === 'perch') { bob *= 0.25; wingSpeed = 3; wingOpen = 0.1; }
      else if (activity === 'zoom') { roll = -0.35 + still * Math.sin(seconds * 2.3) * 0.12; wingSpeed = 22; bob *= 0.4; }
      else if (activity === 'loop') { wingSpeed = 22; bob = 0; }
      else if (activity === 'chat') { roll = still * Math.sin(seconds * 3.1) * 0.12; lift = still * Math.max(0, Math.sin(seconds * 6)) * 0.012; }
      else if (activity === 'warm') { roll = still * Math.sin(seconds * 1.6) * 0.2; wingSpeed = 4; }
      else if (activity === 'sniff') { pitch = 0.45 + still * Math.sin(seconds * 7) * 0.12; bob *= 0.5; }
      else if (activity === 'read') { pitch = 0.4; bob *= 0.3; wingSpeed = 3; }
      else if (activity === 'dance') { roll = still * Math.sin(seconds * 6) * 0.32; lift = still * Math.abs(Math.sin(seconds * 6)) * 0.06; yaw = still * Math.sin(seconds * 3) * 0.6; }
      else if (activity === 'peek') { pitch = 0.3; lift = still * Math.sin(seconds * 1.3) * 0.02; }
      else if (activity === 'gaze') { pitch = -0.42; bob *= 0.4; wingSpeed = 5; }
      else if (activity === 'twirl') yaw = still * seconds * 7;
      else if (activity === 'bounce') { lift = still * Math.abs(Math.sin(seconds * 4.4)) * 0.11; wingSpeed = 14; }
      else if (activity === 'boop') { const dart = still * Math.max(0, Math.sin(Math.min(1, age / 0.9) * Math.PI)); pitch = 0.35 * dart; lift = -0.05 * dart; }
      const rate = reducedMotion ? 1 : 1 - Math.exp(-dt * 6);
      if (activity !== 'twirl') twist = angleBetween(0, twist);
      lean += (pitch - lean) * rate; tilt += (roll - tilt) * rate; twist += (yaw - twist) * rate;
      const facing = frame.faceYaw + angleBetween(frame.faceYaw, frame.heading) * frame.flying;
      root.position.set(frame.x, frame.y + bob + lift, frame.z);
      const flip = activity === 'loop' ? -still * Math.min(age * 4.2, Math.PI * 2) : 0;
      Quaternion.RotationYawPitchRollToRef(facing + frame.spin + (activity === 'twirl' ? yaw : twist), lean + flip, tilt, root.rotationQuaternion);
      const squash = frame.squash || 0, size = frame.scale * SIZE;
      root.scaling.set(size * (1 + squash * 0.16), size * (1 - squash * 0.24), size * (1 + squash * 0.16));
      const seen = frame.ghost ? 0.4 : 1;
      fade += (seen - fade) * (reducedMotion ? 1 : 1 - Math.exp(-dt * 10));
      body.visibility = fade > 0.99 ? 1 : fade; halo.visibility = fade;
      body.renderingGroupId = halo.renderingGroupId = fade > 0.99 ? 0 : 1;

      const wantHappy = HAPPY_POSES.has(activity) || frame.holding || squash > 0.05 ? 1 : 0;
      happy += (wantHappy - happy) * rate;
      if (seconds > blinkAt) { blinkAt = seconds + 2.2 + noise() * 3.4; }
      const blink = !reducedMotion && seconds > blinkAt - 0.14 ? 0.1 : 1;
      eyes += (blink - eyes) * (reducedMotion ? 1 : Math.min(1, dt * 30));
      pose('body', 0, 0, 0);
      pose('eyes', 0, 0, 0, 1, eyes);
      pose('happy', 0, 0, 0);
      pose('sprout', 0, still * Math.sin(seconds * 1.7) * 0.08 - frame.flying * 0.3, still * Math.sin(seconds * 2.1) * 0.14);
      const flap = wingSpeed ? still * Math.sin(seconds * wingSpeed) * 0.55 : 0;
      pose('wing-l', -0.1, 0, wingOpen + flap);
      pose('wing-r', 0.1, 0, -wingOpen - flap);
      pose('find', still * seconds * 1.8, 0, 0);
      for (const name of BONES) {
        const hidden = (name === 'eyes' && happy > 0.5) || (name === 'happy' && happy <= 0.5) || (name === 'find' && !frame.holding);
        if (hidden) shrink.multiplyToRef(local.get(name), rig.get(name).getLocalMatrix());
        else rig.get(name).getLocalMatrix().copyFrom(local.get(name));
      }
      rig.get('body').markAsDirty();

      const height = Math.max(0, root.position.y - frame.ground);
      contact.position.set(frame.x, frame.ground + 0.003, frame.z);
      contact.scaling.setAll(Math.max(0.2, 1 - height * 0.28) * frame.scale);
      contact.visibility = Math.max(0, 1 - height / 2.2);

      if (!reducedMotion && frame.trail && (emitAt -= dt) <= 0) { emitAt = 0.035; emit(root.position.x, root.position.y, root.position.z, 0.3, 0.045 * Math.max(0.5, frame.scale)); }
      let alive = 0;
      for (let i = 0; i < SPARKLES; i++) {
        const mote = motes[i], offset = i * 16;
        if (mote.age < mote.life && !reducedMotion) {
          mote.age += dt; mote.x += mote.vx * dt; mote.y += mote.vy * dt; mote.z += mote.vz * dt; mote.vx *= 0.94; mote.vy = mote.vy * 0.94 - dt * 0.2; mote.vz *= 0.94;
          const t = mote.age / mote.life, scale = mote.age < mote.life ? mote.size * Math.sin(Math.min(1, t) * Math.PI) : 0, c = Math.cos(mote.spin + t * 3), n = Math.sin(mote.spin + t * 3);
          sparkleMatrices[offset] = c * scale; sparkleMatrices[offset + 2] = -n * scale; sparkleMatrices[offset + 5] = scale; sparkleMatrices[offset + 8] = n * scale; sparkleMatrices[offset + 10] = c * scale;
          sparkleMatrices[offset + 12] = mote.x; sparkleMatrices[offset + 13] = mote.y; sparkleMatrices[offset + 14] = mote.z;
          alive++;
        } else if (sparkleMatrices[offset + 5] !== 0) {
          mote.age = Infinity; sparkleMatrices[offset] = sparkleMatrices[offset + 5] = sparkleMatrices[offset + 10] = sparkleMatrices[offset + 2] = sparkleMatrices[offset + 8] = 0; alive++;
        }
      }
      sparkle.setEnabled(alive > 0);
      if (alive) sparkle.thinInstanceBufferUpdated('matrix');
    },
    dispose() { root.dispose(false, false); sparkle.dispose(); contact.dispose(); skeleton.dispose(); },
  };
}

function angleBetween(from, to) { return ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI; }
