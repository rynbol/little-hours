import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { CreateSphereVertexData } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { CreateCylinderVertexData } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreateBoxVertexData } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateTorusVertexData } from '@babylonjs/core/Meshes/Builders/torusBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { FresnelParameters } from '@babylonjs/core/Materials/fresnelParameters.js';
import { Skeleton } from '@babylonjs/core/Bones/skeleton.js';
import { Bone } from '@babylonjs/core/Bones/bone.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import '@babylonjs/core/Shaders/default.vertex.js';
import '@babylonjs/core/Shaders/default.fragment.js';
import { RANGER_JOINTS, RANGER_STRIDE, rangerPose } from './ranger-pose.js';

export const RANGER_PAINT = Object.freeze({
  skin: '#ffd8bc', blush: '#f3a0a0', eye: '#2b2233', shine: '#ffffff', hair: '#4b3024', mouth: '#b4626a',
  tunic: '#5e8f3e', hood: '#4f8038', hoodRim: '#3c672c', cape: '#467534', sleeve: '#f2e8d0', leather: '#8b5a34', belt: '#6b4426',
  brass: '#d7ae52', trousers: '#454b5c', boot: '#77512f', bootCuff: '#8c633c', sole: '#4e3626',
  steel: '#dbe3ea', edge: '#f6fbff', bronze: '#c99a48', grip: '#5b3a24',
});

const BONES = Object.freeze({
  hips: Object.freeze({ parent: null, at: [0, .9, 0] }),
  spine: Object.freeze({ parent: 'hips', at: [0, .14, 0] }),
  chest: Object.freeze({ parent: 'spine', at: [0, .16, 0] }),
  head: Object.freeze({ parent: 'chest', at: [0, .17, 0] }),
  upperArmL: Object.freeze({ parent: 'chest', at: [-.19, .12, 0] }),
  foreArmL: Object.freeze({ parent: 'upperArmL', at: [0, -.27, 0] }),
  handL: Object.freeze({ parent: 'foreArmL', at: [0, -.24, 0] }),
  upperArmR: Object.freeze({ parent: 'chest', at: [.19, .12, 0] }),
  foreArmR: Object.freeze({ parent: 'upperArmR', at: [0, -.27, 0] }),
  handR: Object.freeze({ parent: 'foreArmR', at: [0, -.24, 0] }),
  thighL: Object.freeze({ parent: 'hips', at: [-.09, -.05, 0] }),
  shinL: Object.freeze({ parent: 'thighL', at: [0, -.41, 0] }),
  footL: Object.freeze({ parent: 'shinL', at: [0, -.36, 0] }),
  thighR: Object.freeze({ parent: 'hips', at: [.09, -.05, 0] }),
  shinR: Object.freeze({ parent: 'thighR', at: [0, -.41, 0] }),
  footR: Object.freeze({ parent: 'shinR', at: [0, -.36, 0] }),
});

const sphere = (radius, segments = 12) => CreateSphereVertexData({ diameter: radius * 2, segments });
const tube = (height, top, bottom, tessellation = 14) => CreateCylinderVertexData({ height, diameterTop: top * 2, diameterBottom: bottom * 2, tessellation });
const block = (width, height, depth) => CreateBoxVertexData({ width, height, depth });
const ring = (diameter, thickness) => CreateTorusVertexData({ diameter, thickness, tessellation: 24 });
const bothSides = build => [...build(-1, 'L'), ...build(1, 'R')];

const arm = (side, key) => [
  { bone: `upperArm${key}`, shape: sphere(.068), at: [.19 * side, 1.31, 0], paint: 'tunic' },
  { bone: `upperArm${key}`, shape: tube(.13, .062, .058), at: [.19 * side, 1.235, 0], paint: 'tunic' },
  { bone: `upperArm${key}`, shape: tube(.14, .046, .044), at: [.19 * side, 1.115, 0], paint: 'sleeve' },
  { bone: `foreArm${key}`, shape: sphere(.047), at: [.19 * side, 1.05, 0], paint: 'sleeve' },
  { bone: `foreArm${key}`, shape: tube(.17, .054, .046), at: [.19 * side, .93, 0], paint: 'leather' },
  { bone: `foreArm${key}`, shape: tube(.025, .058, .058), at: [.19 * side, 1.005, 0], paint: 'belt' },
  { bone: `hand${key}`, shape: sphere(.05), at: [.19 * side, .79, 0], scale: [.9, 1.1, .85], paint: 'skin' },
];

const leg = (side, key) => [
  { bone: `thigh${key}`, shape: tube(.42, .08, .068), at: [.09 * side, .64, 0], paint: 'trousers' },
  { bone: `shin${key}`, shape: sphere(.066), at: [.09 * side, .44, 0], paint: 'trousers' },
  { bone: `shin${key}`, shape: tube(.1, .062, .06), at: [.09 * side, .39, 0], paint: 'trousers' },
  { bone: `shin${key}`, shape: tube(.28, .072, .066), at: [.09 * side, .22, 0], paint: 'boot' },
  { bone: `shin${key}`, shape: tube(.06, .084, .08), at: [.09 * side, .35, 0], paint: 'bootCuff' },
  { bone: `foot${key}`, shape: sphere(.07), at: [.09 * side, .055, -.04], scale: [.95, .75, 1.6], paint: 'boot' },
  { bone: `foot${key}`, shape: block(.12, .025, .2), at: [.09 * side, .0125, -.04], paint: 'sole' },
];

const face = side => [
  { bone: 'head', shape: sphere(.03), at: [.058 * side, 1.49, -.158], scale: [.95, 1.35, .5], paint: 'eye' },
  { bone: 'head', shape: sphere(.011, 8), at: [.05 * side, 1.507, -.171], paint: 'shine' },
  { bone: 'head', shape: sphere(.006, 6), at: [.066 * side, 1.478, -.17], paint: 'shine' },
  { bone: 'head', shape: sphere(.03, 8), at: [.098 * side, 1.448, -.138], scale: [1, .5, .4], paint: 'blush' },
  { bone: 'head', shape: sphere(.04, 8), at: [.118 * side, 1.44, -.07], scale: [.9, 2.2, 1], paint: 'hair' },
];

const BLADE_DROP = 1.3, SWORD_HAND = Object.freeze([.19, .79, 0]);
const alongBlade = distance => [SWORD_HAND[0], SWORD_HAND[1] - Math.sin(BLADE_DROP) * distance, SWORD_HAND[2] - Math.cos(BLADE_DROP) * distance];

const RANGER_PARTS = [
  { bone: 'hips', shape: tube(.32, .155, .215, 16), at: [0, .82, 0], paint: 'tunic' },
  { bone: 'hips', shape: tube(.065, .162, .162, 16), at: [0, .95, 0], paint: 'belt' },
  { bone: 'hips', shape: block(.075, .055, .025), at: [0, .95, -.163], paint: 'brass' },
  { bone: 'hips', shape: block(.08, .1, .05), at: [-.15, .89, -.04], rotate: [0, .5, 0], paint: 'leather' },
  { bone: 'hips', shape: block(.05, .2, .03), at: [.15, .86, .02], rotate: [0, -.3, .15], paint: 'leather' },
  { bone: 'spine', shape: tube(.2, .148, .156, 16), at: [0, 1.08, 0], paint: 'tunic' },
  { bone: 'chest', shape: sphere(.17, 16), at: [0, 1.21, 0], scale: [1, .82, .74], paint: 'tunic' },
  { bone: 'chest', shape: block(.045, .42, .02), at: [0, 1.16, -.123], rotate: [0, 0, .62], paint: 'leather' },
  { bone: 'chest', shape: block(.045, .42, .02), at: [0, 1.16, .123], rotate: [0, 0, -.62], paint: 'leather' },
  { bone: 'chest', shape: tube(.15, .1, .235, 16), at: [0, 1.31, .005], paint: 'cape' },
  { bone: 'chest', shape: tube(.1, .05, .052), at: [0, 1.39, 0], paint: 'skin' },
  { bone: 'head', shape: sphere(.155, 18), at: [0, 1.5, -.015], paint: 'skin' },
  { bone: 'head', shape: sphere(.2, 18), at: [0, 1.52, .07], paint: 'hood' },
  { bone: 'head', shape: tube(.26, .004, .085), at: [0, 1.5, .27], rotate: [-1.95, 0, 0], paint: 'hood' },
  { bone: 'head', shape: ring(.3, .055), at: [0, 1.505, -.085], rotate: [Math.PI / 2, 0, 0], scale: [1, 1, 1.12], paint: 'hoodRim' },
  { bone: 'head', shape: sphere(.14, 14), at: [0, 1.565, -.095], scale: [.95, .42, .5], paint: 'hair' },
  { bone: 'head', shape: sphere(.045, 8), at: [.045, 1.555, -.14], scale: [1.2, .7, .5], rotate: [0, 0, -.5], paint: 'hair' },
  { bone: 'head', shape: sphere(.012, 6), at: [0, 1.43, -.166], scale: [1.4, .5, .5], paint: 'mouth' },
  ...bothSides(face),
  ...bothSides(arm),
  ...bothSides(leg),
  { bone: 'handR', shape: tube(.13, .019, .019, 8), at: alongBlade(.01), rotate: [-Math.PI / 2 - BLADE_DROP, 0, 0], paint: 'grip' },
  { bone: 'handR', shape: sphere(.028, 8), at: alongBlade(-.075), paint: 'bronze' },
  { bone: 'handR', shape: block(.19, .035, .03), at: alongBlade(.08), rotate: [-BLADE_DROP, 0, 0], paint: 'bronze' },
  { bone: 'handR', shape: block(.06, .013, .58), at: alongBlade(.39), rotate: [-BLADE_DROP, 0, 0], paint: 'steel' },
  { bone: 'handR', shape: block(.012, .016, .58), at: alongBlade(.39), rotate: [-BLADE_DROP, 0, 0], paint: 'edge' },
  { bone: 'handR', shape: tube(.09, 0, .043, 4), at: alongBlade(.725), rotate: [-Math.PI / 2 - BLADE_DROP, Math.PI / 4, 0], scale: [1, 1, .3], paint: 'steel' },
];

const paintColors = Object.fromEntries(Object.entries(RANGER_PAINT).map(([name, hex]) => [name, Color3.FromHexString(hex)]));

function rangerGeometry() {
  const positions = [], normals = [], indices = [], colors = [], matricesIndices = [], matricesWeights = [];
  const transform = new Matrix(), normalTransform = new Matrix(), point = new Vector3(), turn = new Quaternion();
  for (const part of RANGER_PARTS) {
    const [pitch, yaw, roll] = part.rotate ?? [0, 0, 0];
    Quaternion.FromEulerAnglesToRef(pitch, yaw, roll, turn);
    Matrix.ComposeToRef(Vector3.FromArray(part.scale ?? [1, 1, 1]), turn, Vector3.FromArray(part.at), transform);
    transform.invertToRef(normalTransform); normalTransform.transpose();
    const offset = positions.length / 3, color = paintColors[part.paint], bone = RANGER_JOINTS.indexOf(part.bone), shape = part.shape;
    for (let i = 0; i < shape.positions.length; i += 3) {
      Vector3.TransformCoordinatesFromFloatsToRef(shape.positions[i], shape.positions[i + 1], shape.positions[i + 2], transform, point);
      positions.push(point.x, point.y, point.z);
      Vector3.TransformNormalFromFloatsToRef(shape.normals[i], shape.normals[i + 1], shape.normals[i + 2], normalTransform, point);
      point.normalize();
      normals.push(point.x, point.y, point.z);
      colors.push(color.r, color.g, color.b, 1);
      matricesIndices.push(bone, 0, 0, 0);
      matricesWeights.push(1, 0, 0, 0);
    }
    for (const index of shape.indices) indices.push(offset + index);
  }
  return Object.assign(new VertexData(), { positions, normals, indices, colors, matricesIndices, matricesWeights });
}

function rangerSkeleton(scene, root) {
  const skeleton = new Skeleton('wilds-ranger-skeleton', 'wilds-ranger-skeleton', scene), joints = {}, bones = {};
  for (const name of RANGER_JOINTS) {
    const { parent, at } = BONES[name];
    const joint = new TransformNode(`wilds-ranger-${name}`, scene);
    joint.parent = parent ? joints[parent] : root;
    joint.position.fromArray(at);
    joint.rotationQuaternion = Quaternion.Identity();
    bones[name] = new Bone(name, skeleton, parent ? bones[parent] : null, Matrix.Translation(...at));
    bones[name].linkTransformNode(joint);
    joints[name] = joint;
  }
  return { skeleton, joints };
}

function combatPose(action, elapsedMs) {
  if (action?.kind !== 'attack' && action?.kind !== 'dodge') return null;
  return { kind: action.kind, comboIndex: action.comboIndex ?? 0, progress: Math.min(1, Math.max(0, (elapsedMs - action.startedAt) / action.durationMs)) };
}

export function createWildsPlayer(scene) {
  const root = new TransformNode('wilds-player', scene);
  const { skeleton, joints } = rangerSkeleton(scene, root);
  const paint = new StandardMaterial('wilds-ranger-paint', scene);
  paint.specularColor.set(0, 0, 0);
  paint.emissiveColor.set(.26, .24, .2);
  paint.emissiveFresnelParameters = new FresnelParameters({ leftColor: new Color3(1, .96, .86), rightColor: new Color3(0, 0, 0), bias: .15, power: 2.6 });
  const body = new Mesh('wilds-ranger', scene);
  body.material = paint;
  rangerGeometry().applyToMesh(body);
  body.parent = root;
  body.skeleton = skeleton;
  body.isPickable = false;
  const restHeight = BONES.hips.at[1];
  let disposed = false, stride = 0, pose = rangerPose();
  function apply() {
    for (const name of RANGER_JOINTS) Quaternion.FromEulerAnglesToRef(...pose[name], joints[name].rotationQuaternion);
    joints.hips.position.y = restHeight + pose.lift;
  }
  apply();
  return {
    root,
    joints,
    update({ yaw = 0, action = 'idle', speed = 0, deltaMs = 0, elapsedMs = 0, combatAction = null } = {}) {
      root.rotation.y = yaw;
      if (action === 'walk' || action === 'run') stride = (stride + speed * deltaMs / 1000 / RANGER_STRIDE[action]) % 1;
      pose = rangerPose({ action, stride, elapsedMs, combat: combatPose(combatAction, elapsedMs) });
      apply();
    },
    setAppearance() {},
    reset() { stride = 0; pose = rangerPose(); apply(); },
    diagnostics: () => ({ loaded: !disposed, placeholder: false, bones: RANGER_JOINTS.length, stride }),
    dispose() {
      if (disposed) return;
      disposed = true;
      root.dispose();
      skeleton.dispose();
      paint.dispose();
    },
  };
}
