import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { CreateSphereVertexData } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { CreateCylinderVertexData } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreateLineSystem } from '@babylonjs/core/Meshes/Builders/linesBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Vector3, Quaternion, Matrix } from '@babylonjs/core/Maths/math.vector.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { BoundingInfo } from '@babylonjs/core/Culling/boundingInfo.js';
import { Skeleton } from '@babylonjs/core/Bones/skeleton.js';
import { Bone } from '@babylonjs/core/Bones/bone.js';
import { createContactShadow } from '../../models/furniture.js';
import { BOND_LEVELS } from '../../core/pet-bonds.js';
import { PET_REACTION, HEART_LIFE, MAX_HEARTS } from './pet.js';

// Hand-built pets. Each pet is one vertex-colored mesh on a small rig of
// rigid parts: a two-part spine, head, ears, two-part legs placed by
// two-bone IK, and a jointed tail. Poses blend, so a nap, a stretch, a sit
// and a walk flow into each other. The GPU skins the mesh: per frame the
// CPU only sets about fifty bone matrices, and no vertex buffer changes.
const UP = new Vector3(0, 1, 0), IDENTITY = Quaternion.Identity();
const smooth = t => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
const SPECIES = {
  cat: {
    scale: 1.5, stride: 0.2, spineHalf: 0.12, chest: [0.15, 0.15, 0.19], hips: [0.145, 0.14, 0.17],
    neck: [0, 0.07, -0.16], head: [0, 0.09, -0.07], headRadii: [0.165, 0.148, 0.15],
    front: { anchor: [0.085, -0.07, -0.05], lengths: [0.12, 0.12], radii: [0.045, 0.04] },
    hind: { anchor: [0.09, -0.05, 0.06], lengths: [0.13, 0.13], radii: [0.05, 0.042] },
    tail: { anchor: [0, 0.05, 0.17], count: 7, length: 0.066, radii: [0.043, 0.035] },
    // A sitting pet rests its tilted hips on the floor, not in it; a
    // standing cat carries its tail up with a curl at the tip.
    poses: { sit: { spineY: 0.235 }, stand: { tailPitch: 1.25, tailBend: -0.3 }, walk: { tailPitch: 1.0, tailBend: -0.22 } },
    colors: { fur: '#d4904f', light: '#e9b377', cream: '#f5e6cb', stripe: '#b5703b', ear: '#eba99c', nose: '#dc8a8a', eye: '#3a2a22', shine: '#fffaf0', blush: '#f2a092', mouth: '#7a4a36' },
    look: 'cat', coat: 'tabby', ears: 'pointed', flick: true,
  },
  dog: {
    scale: 1.45, stride: 0.23, spineHalf: 0.13, chest: [0.155, 0.15, 0.2], hips: [0.15, 0.142, 0.18],
    neck: [0, 0.07, -0.17], head: [0, 0.09, -0.07], headRadii: [0.16, 0.142, 0.15],
    front: { anchor: [0.09, -0.07, -0.05], lengths: [0.12, 0.12], radii: [0.047, 0.043] },
    hind: { anchor: [0.095, -0.05, 0.06], lengths: [0.13, 0.13], radii: [0.052, 0.045] },
    tail: { anchor: [0, 0.08, 0.16], count: 4, length: 0.058, radii: [0.047, 0.036] },
    // A short, happy tail that curls up over the back.
    poses: { sit: { spineY: 0.25, tailPitch: -0.2, tailWrap: 0.3 }, stand: { tailPitch: 1.35, tailBend: -0.38 }, walk: { tailPitch: 1.35, tailBend: -0.38 }, settle: { tailPitch: 1.2, tailBend: -0.3 }, stretch: { tailPitch: 1.4, tailBend: -0.3 } },
    colors: { fur: '#efddbd', light: '#f6e9d2', cream: '#fcf6ea', stripe: '#b8794c', ear: '#a9683f', nose: '#352a26', eye: '#33241d', shine: '#fffaf0', blush: '#f3a698', mouth: '#6d4632', tongue: '#ee8a8f', collar: '#c8674f', tag: '#e3bb5f' },
    look: 'dog', coat: 'saddle', ears: 'floppy', wag: true, collar: true,
  },
  bunny: {
    scale: 1.4, stride: 0.17, spineHalf: 0.1, chest: [0.15, 0.14, 0.17], hips: [0.17, 0.165, 0.19],
    neck: [0, 0.07, -0.14], head: [0, 0.085, -0.06], headRadii: [0.162, 0.148, 0.148],
    front: { anchor: [0.08, -0.07, -0.05], lengths: [0.1, 0.1], radii: [0.04, 0.036] },
    hind: { anchor: [0.1, -0.06, 0.05], lengths: [0.12, 0.12], radii: [0.058, 0.048] },
    tail: { anchor: [0, 0.1, 0.19], count: 1, length: 0.03, radii: [0.07, 0.072] },
    poses: { sit: { spineY: 0.26, tailPitch: 0.3, tailWrap: 0 }, stand: { tailPitch: 0.6, tailBend: 0 }, walk: { tailPitch: 0.6, tailBend: 0 }, loaf: { tailPitch: 0.4, tailWrap: 0 }, sleep: { tailPitch: 0.4, tailWrap: 0, tailYaw: 0 } },
    colors: { fur: '#ead8c2', light: '#f2e5d4', cream: '#fbf6ee', stripe: '#cdb8a3', ear: '#f0b3b0', nose: '#e5949a', eye: '#3a2a22', shine: '#fffaf0', blush: '#f4a9a6', mouth: '#8a5d4d' },
    look: 'cat', coat: 'plain', ears: 'long', earSpot: [0.06, 0.12, 0.12], flick: true,
  },
  fox: {
    scale: 1.45, stride: 0.22, spineHalf: 0.125, chest: [0.14, 0.14, 0.19], hips: [0.135, 0.13, 0.17],
    neck: [0, 0.075, -0.16], head: [0, 0.09, -0.07], headRadii: [0.155, 0.138, 0.15],
    front: { anchor: [0.08, -0.07, -0.05], lengths: [0.13, 0.13], radii: [0.04, 0.034] },
    hind: { anchor: [0.085, -0.05, 0.06], lengths: [0.14, 0.14], radii: [0.046, 0.037] },
    tail: { anchor: [0, 0.06, 0.17], count: 6, length: 0.074, radii: [0.062, 0.078] },
    poses: { sit: { spineY: 0.245, tailWrap: 0.5 }, stand: { tailPitch: 0.45, tailBend: 0.02 }, walk: { tailPitch: 0.5, tailBend: -0.02 }, settle: { tailPitch: 0.45 } },
    colors: { fur: '#df7a3c', light: '#ea9458', cream: '#fbf1e2', stripe: '#c7652e', ear: '#fbf1e2', nose: '#2f2320', eye: '#2d211c', shine: '#fffaf0', blush: '#f2a092', mouth: '#5e3a2c', leg: '#4a342b', paw: '#3a2a24' },
    look: 'cat', coat: 'fox', ears: 'pointed', flick: true, tailTip: 2,
  },
  panda: {
    scale: 1.42, stride: 0.19, spineHalf: 0.12, chest: [0.155, 0.14, 0.19], hips: [0.15, 0.142, 0.18],
    neck: [0, 0.07, -0.16], head: [0, 0.09, -0.07], headRadii: [0.172, 0.15, 0.152],
    front: { anchor: [0.085, -0.07, -0.05], lengths: [0.11, 0.11], radii: [0.048, 0.044] },
    hind: { anchor: [0.09, -0.05, 0.06], lengths: [0.12, 0.12], radii: [0.053, 0.046] },
    tail: { anchor: [0, 0.06, 0.17], count: 7, length: 0.068, radii: [0.06, 0.056] },
    poses: { sit: { spineY: 0.265, tailWrap: 0.4 }, stand: { tailPitch: 0.7, tailBend: -0.05 }, walk: { tailPitch: 0.55, tailBend: -0.02 } },
    colors: { fur: '#b9552c', light: '#c8683a', cream: '#f6ead9', stripe: '#8e3f22', ear: '#f6ead9', nose: '#2c201c', eye: '#2a1e1a', shine: '#fffaf0', blush: '#f2a092', mouth: '#5a3325', leg: '#3a2622', paw: '#2e201c', ring: '#e8b47f' },
    look: 'cat', coat: 'panda', ears: 'round', earSpot: [0.11, 0.095, 0.55], rings: true,
  },
};
const tailColor = (spec, i) => {
  const c = spec.colors, last = spec.tail.count - 1;
  if (spec.rings) return i % 2 ? c.ring : c.fur;
  return i > last - (spec.tailTip || 1) ? c.cream : c.fur;
};

// Pose targets in the pet's own frame (it faces -z, paws on y = 0). Pitch
// lifts the chest and lowers the hips; head pitch lifts the chin; curl bends
// the body into a C; roll leans it onto one side; tail angles follow the
// tail from its root.
const tucked = { fl: [-0.065, 0.04, -0.13], fr: [0.065, 0.04, -0.13], bl: [-0.085, 0.04, 0.1], br: [0.085, 0.04, 0.1] };
const standing = { fl: [-0.075, 0.035, -0.13], fr: [0.075, 0.035, -0.13], bl: [-0.08, 0.035, 0.15], br: [0.08, 0.035, 0.15] };
const base = { spineY: 0.31, pitch: 0, chestPitch: 0, curl: 0, roll: 0, neckLift: 0, headPitch: -0.05, headYaw: 0, headRoll: 0, earBack: 0, eyes: 1, mouth: 0, tailPitch: 1.1, tailYaw: 0, tailBend: -0.2, tailWrap: 0, dangle: 0 };
const POSES = {
  stand: { ...base, ...standing },
  walk: { ...base, ...standing },
  settle: { ...base, ...standing, spineY: 0.29, headPitch: -0.2 },
  sit: { ...base, spineY: 0.22, pitch: 0.72, chestPitch: -0.1, headPitch: 0.02, tailPitch: -0.75, tailBend: 0.12, tailWrap: 0.42, fl: [-0.06, 0.035, -0.16], fr: [0.06, 0.035, -0.16], bl: [-0.11, 0.035, -0.03], br: [0.11, 0.035, -0.03] },
  loaf: { ...base, ...tucked, spineY: 0.16, pitch: 0.05, neckLift: -0.03, headPitch: 0, tailPitch: -0.8, tailYaw: 0.3, tailBend: 0.15, tailWrap: 0.38 },
  // Asleep: a soft loaf with the chin down on the front paws, the head tipped
  // to one side and the tail wrapped round.
  sleep: { ...base, ...tucked, spineY: 0.15, curl: 0.28, roll: 0.12, neckLift: -0.095, headPitch: -0.14, headYaw: 0.38, headRoll: 0.32, earBack: 0.25, eyes: 0, tailPitch: -0.8, tailYaw: 0.5, tailBend: 0.15, tailWrap: 0.46 },
  stretch: { ...base, spineY: 0.24, pitch: -0.42, neckLift: -0.02, headPitch: 0.25, earBack: 0.2, eyes: 0, mouth: 1, tailPitch: 1.3, tailBend: -0.08, fl: [-0.07, 0.035, -0.36], fr: [0.07, 0.035, -0.36], bl: [-0.08, 0.035, 0.16], br: [0.08, 0.035, 0.16] },
  held: { ...base, ...standing, spineY: 0.32, pitch: 0.55, headPitch: 0.12, earBack: 0.35, tailPitch: -1.2, tailBend: 0.05, dangle: 1 },
};
const KEYS = Object.keys(base), PAWS = ['fl', 'fr', 'bl', 'br'];

function rigBuilder() {
  const positions = [], normals = [], colors = [], indices = [], parts = [];
  const q = new Quaternion(), a = new Vector3(), b = new Vector3();
  function push(data, hex, bone, map, show) {
    const tint = Color3.FromHexString(hex), first = positions.length / 3;
    for (let i = 0; i < data.positions.length; i += 3) {
      map(data.positions[i], data.positions[i + 1], data.positions[i + 2], data.normals[i], data.normals[i + 1], data.normals[i + 2]);
      positions.push(a.x, a.y, a.z); normals.push(b.x, b.y, b.z); colors.push(tint.r, tint.g, tint.b, 1);
    }
    for (const index of data.indices) indices.push(first + index);
    parts.push({ bone, start: first, end: positions.length / 3, show });
  }
  // One smooth torso from nose-end to tail-end. Each vertex blends between
  // the front and back spine bones, so the body bends in one soft curve,
  // and `paint` colors it (belly, bib, stripes or a saddle) per vertex.
  function torso(front, back, profile, paint) {
    const rings = [], sides = 24, first = positions.length / 3, weights = [];
    for (let k = 0; k < profile.length - 1; k++) for (let step = 0; step < 4; step++) {
      const t = step / 4, p0 = profile[Math.max(0, k - 1)], p1 = profile[k], p2 = profile[k + 1], p3 = profile[Math.min(profile.length - 1, k + 2)];
      const spline = i => 0.5 * (2 * p1[i] + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t * t + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t * t * t);
      rings.push([spline(0), Math.max(0, spline(1)), Math.max(0, spline(2)), spline(3)]);
    }
    rings.push(profile.at(-1));
    const data = { positions: [], normals: [], indices: [] };
    rings.forEach(([z, rx, ry, cy], ring) => {
      for (let side = 0; side < sides; side++) {
        const angle = side / sides * Math.PI * 2, x = Math.cos(angle) * rx, y = cy + Math.sin(angle) * ry;
        data.positions.push(x, y, z);
        const tint = Color3.FromHexString(paint(z, Math.sin(angle), x)); colors.push(tint.r, tint.g, tint.b, 1);
        weights.push(1 - smooth((z + 0.12) / 0.24));
        if (ring < rings.length - 1) { const i = ring * sides + side, j = ring * sides + (side + 1) % sides; data.indices.push(i, i + sides, j, j, i + sides, j + sides); }
      }
    });
    VertexData.ComputeNormals(data.positions, data.indices, data.normals);
    for (let i = 0; i < data.positions.length; i++) { positions.push(data.positions[i]); normals.push(data.normals[i]); }
    for (const index of data.indices) indices.push(first + index);
    parts.push({ bone: front, blend: back, weights, start: first, end: positions.length / 3 });
  }
  const rotate = (rot = [0, 0, 0]) => Quaternion.RotationYawPitchRollToRef(rot[1], rot[0], rot[2], q);
  return {
    // A soft oval: normals follow the stretched surface, not the sphere.
    ellipsoid(bone, radii, center, hex, { rot, segments = 8, show } = {}) {
      rotate(rot);
      push(CreateSphereVertexData({ diameter: 2, segments }), hex, bone, (x, y, z, nx, ny, nz) => {
        new Vector3(x * radii[0], y * radii[1], z * radii[2]).rotateByQuaternionToRef(q, a).addInPlaceFromFloats(center[0], center[1], center[2]);
        new Vector3(nx / radii[0], ny / radii[1], nz / radii[2]).normalize().rotateByQuaternionToRef(q, b);
      }, show);
    },
    // A tapered cone standing on `at`, flattened across its depth.
    cone(bone, bottom, top, height, at, hex, { rot, depth = 1, show } = {}) {
      rotate(rot);
      push(CreateCylinderVertexData({ height, diameterBottom: bottom * 2, diameterTop: top * 2, tessellation: 10 }), hex, bone, (x, y, z, nx, ny, nz) => {
        new Vector3(x, y + height / 2, z * depth).rotateByQuaternionToRef(q, a).addInPlaceFromFloats(at[0], at[1], at[2]);
        new Vector3(nx, ny, nz / depth).normalize().rotateByQuaternionToRef(q, b);
      }, show);
    },
    // A limb or tail piece of unit length along +y; its bone stretches it
    // between two joints each frame.
    segment(bone, r0, r1, hex) {
      push(CreateCylinderVertexData({ height: 1, diameterBottom: r0 * 2, diameterTop: r1 * 2, tessellation: 8 }), hex, bone, (x, y, z, nx, ny, nz) => { a.set(x, y + 0.5, z); b.set(nx, ny, nz); });
    },
    // A thin curved line for closed eyes and the little mouth.
    tube(bone, points, radius, hex, { show } = {}) {
      const data = { positions: [], normals: [], indices: [] }, sides = 5;
      points.forEach((point, i) => {
        const next = points[Math.min(points.length - 1, i + 1)], prev = points[Math.max(0, i - 1)];
        const tangent = new Vector3(next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]).normalize();
        const side = Vector3.Cross(tangent, new Vector3(0, 0, 1)).normalize(), lift = Vector3.Cross(side, tangent).normalize();
        for (let s = 0; s < sides; s++) {
          const angle = s / sides * Math.PI * 2, normal = side.scale(Math.cos(angle)).add(lift.scale(Math.sin(angle)));
          data.positions.push(point[0] + normal.x * radius, point[1] + normal.y * radius, point[2] + normal.z * radius); data.normals.push(normal.x, normal.y, normal.z);
          if (i < points.length - 1) { const k = i * sides + s, l = i * sides + (s + 1) % sides; data.indices.push(k, l, k + sides, l, l + sides, k + sides); }
        }
      });
      push(data, hex, bone, (x, y, z, nx, ny, nz) => { a.set(x, y, z); b.set(nx, ny, nz); }, show);
    },
    torso, finish() { return { positions, normals, colors, indices, parts }; },
  };
}

function buildFace(rig, spec, c) {
  const dog = spec.look === 'dog';
  const [hx, hy, hz] = spec.headRadii, ez = -hz * 0.9;
  for (const side of [-1, 1]) {
    const x = side * 0.066;
    rig.ellipsoid('head', [0.027, 0.035, 0.013], [x, 0.012, ez], c.eye, { segments: 6, show: 'open' });
    rig.ellipsoid('head', [0.009, 0.01, 0.006], [x - side * 0.007, 0.026, ez - 0.01], c.shine, { segments: 4, show: 'open' });
    rig.tube('head', Array.from({ length: 7 }, (_, i) => { const t = i / 3 - 1; return [x + t * 0.024, 0.004 + t * t * 0.01, ez - 0.006]; }), 0.0055, c.eye, { show: 'closed' });
    const bx = side * 0.088, by = -0.036;
    rig.ellipsoid('head', [0.026, 0.013, 0.004], [bx, by, -hz * Math.sqrt(Math.max(0, 1 - (bx / hx) ** 2 - (by / hy) ** 2)) + 0.001], c.blush, { rot: [0.2, side * 0.55, 0], segments: 5 });
  }
  if (dog) {
    rig.ellipsoid('head', [0.075, 0.058, 0.08], [0, -0.05, -hz * 0.84], c.cream);
    rig.ellipsoid('head', [0.03, 0.022, 0.02], [0, -0.03, -hz * 1.37], c.nose, { segments: 6 });
    rig.tube('head', [[-0.03, -0.075, -hz * 1.3], [-0.015, -0.085, -hz * 1.33], [0, -0.078, -hz * 1.36], [0.015, -0.085, -hz * 1.33], [0.03, -0.075, -hz * 1.3]], 0.0042, c.mouth);
    rig.ellipsoid('head', [0.022, 0.012, 0.03], [0, -0.1, -hz * 1.28], c.tongue, { segments: 5, show: 'tongue' });
  } else {
    if (spec.coat === 'fox') {
      rig.ellipsoid('head', [0.058, 0.044, 0.07], [0, -0.05, -hz * 0.92], c.cream, { segments: 7 });
      rig.ellipsoid('head', [0.018, 0.014, 0.013], [0, -0.035, -hz * 1.36], c.nose, { segments: 5 });
    }
    if (spec.coat === 'panda') for (const side of [-1, 1]) rig.ellipsoid('head', [0.024, 0.012, 0.008], [side * 0.062, 0.06, -hz * 0.9], c.cream, { rot: [-0.3, side * 0.3, side * -0.2], segments: 5 });
    if (spec.coat === 'panda') for (const side of [-1, 1]) rig.ellipsoid('head', [0.028, 0.05, 0.012], [side * 0.07, -0.025, -hz * 0.86], c.stripe, { rot: [0, side * 0.4, side * 0.3], segments: 5 });
    for (const side of [-1, 1]) rig.ellipsoid('head', [0.056, 0.045, 0.046], [side * 0.035, -0.052, -hz * 0.8], c.cream, { segments: 6 });
    rig.ellipsoid('head', [0.05, 0.028, 0.04], [0, -0.085, -hz * 0.7], c.cream, { segments: 6 });
    rig.ellipsoid('head', [0.019, 0.013, 0.012], [0, -0.027, -hz * 1.04], c.nose, { segments: 5 });
    rig.tube('head', [[-0.028, -0.061, -0.165], [-0.014, -0.07, -0.169], [0, -0.059, -0.17], [0.014, -0.07, -0.169], [0.028, -0.061, -0.165]], 0.0038, c.mouth);
    // Tabby marks on the forehead, laid on the curve of the head, and fluffy cheeks.
    const surface = (x, y) => -hz * Math.sqrt(Math.max(0, 1 - (x / hx) ** 2 - (y / hy) ** 2)) - 0.002;
    if (spec.coat === 'tabby') for (const [x, y, h] of [[0, 0.098, 0.034], [-0.036, 0.09, 0.026], [0.036, 0.09, 0.026]]) rig.ellipsoid('head', [0.009, h, 0.005], [x, y, surface(x, y) + 0.002], c.stripe, { rot: [-0.75, -x * 5, x * 4], segments: 4 });
  }
  rig.ellipsoid('head', [hx, hy, hz], [0, 0, 0], c.fur, { segments: 10 });
}

function buildPet(species, ribbon) {
  const spec = SPECIES[species], c = spec.colors, rig = rigBuilder(), dog = spec.look === 'dog', legTone = c.leg || c.fur;
  const [cx, cy] = spec.chest, [hx, hy] = spec.hips, front = spec.spineHalf + spec.chest[2], back = spec.spineHalf + spec.hips[2];
  const profile = [[-front, 0, 0, -0.01], [-front + 0.035, cx * 0.62, cy * 0.64, -0.01], [-front + 0.1, cx * 0.95, cy * 0.96, 0], [-spec.spineHalf, cx, cy, 0],
    [0, (cx + hx) / 2 * 0.95, (cy + hy) / 2 * 0.95, 0.005], [spec.spineHalf, hx, hy, 0], [back - 0.08, hx * 0.93, hy * 0.92, 0], [back - 0.03, hx * 0.6, hy * 0.6, 0], [back, 0, 0, 0]];
  rig.torso('chest', 'hips', profile, (z, up, x) => {
    const front = z < -spec.spineHalf - 0.06 && up < 0.25;
    if (spec.coat === 'panda') return up < -0.3 || front ? legTone : up > 0.5 ? c.fur : c.light;
    if (up < -0.45 || front) return c.cream;
    if (spec.coat === 'plain' || spec.coat === 'fox') return up > 0.5 ? c.fur : c.light;
    if (dog) return up > 0.3 && z > -0.14 && z < back - 0.06 ? c.stripe : c.fur;
    // Soft tabby bands across the back, narrowing down the sides.
    for (const band of [-0.2, -0.1, 0, 0.1, 0.19]) if (up > 0.15 && Math.abs(z - band) < 0.026 * (0.4 + up * 0.8)) return c.stripe;
    return up > 0.5 ? c.fur : c.light;
  });
  if (spec.collar) {
    // A little collar and its golden tag.
    rig.cone('collar', 0.105, 0.1, 0.04, [0, -0.02, 0], c.collar, { depth: 0.95 });
    rig.ellipsoid('collar', [0.022, 0.026, 0.008], [0, -0.05, -0.1], c.tag, { segments: 5 });
  }
  const ribbonColor = BOND_LEVELS[ribbon]?.color || BOND_LEVELS[0].color;
  for (const side of [-1, 1]) rig.ellipsoid('head', [.048, .027, .017], [side * .038, -.125, -.11], ribbonColor, { rot: [0, 0, side * -.3], segments: 3 });
  rig.ellipsoid('head', [.023, .023, .022], [0, -.125, -.125], ribbonColor, { segments: 3 });
  rig.ellipsoid('toy', [.062, .062, .062], [0, .063, 0], '#a9bca0', { segments: 4, show: 'play' });
  rig.ellipsoid('toy', [.063, .015, .063], [0, .063, 0], '#e8d4a6', { segments: 3, show: 'play' });
  rig.ellipsoid('snack', [.055, .022, .04], [0, .023, 0], '#dfb071', { segments: 3, show: 'treat' });
  for (const x of [-.021, .021]) rig.ellipsoid('snack', [.006, .003, .006], [x, .044, 0], '#bd8752', { segments: 3, show: 'treat' });
  buildFace(rig, spec, c);
  for (const side of [-1, 1]) {
    const bone = side < 0 ? 'earL' : 'earR';
    if (spec.ears === 'floppy') rig.ellipsoid(bone, [0.05, 0.095, 0.024], [0, -0.075, 0], c.ear, { segments: 7 });
    else if (spec.ears === 'long') {
      rig.ellipsoid(bone, [0.04, 0.125, 0.022], [0, 0.115, 0], c.fur, { segments: 8 });
      rig.ellipsoid(bone, [0.024, 0.098, 0.01], [0, 0.118, -0.016], c.ear, { segments: 6 });
    } else if (spec.ears === 'round') {
      rig.cone(bone, 0.068, 0.028, 0.085, [0, 0, 0], c.fur, { depth: 0.55 });
      rig.cone(bone, 0.046, 0.02, 0.066, [0, 0.006, -0.014], c.ear, { depth: 0.35 });
    } else {
      rig.cone(bone, 0.062, 0.006, 0.1, [0, 0, 0], c.fur, { depth: 0.5 });
      rig.cone(bone, 0.04, 0.004, 0.075, [0, 0.004, -0.013], c.ear, { depth: 0.35 });
    }
  }
  for (const leg of PAWS) {
    const limb = leg[0] === 'f' ? spec.front : spec.hind;
    rig.segment(`${leg}-upper`, limb.radii[0], (limb.radii[0] + limb.radii[1]) / 2, legTone);
    rig.segment(`${leg}-lower`, (limb.radii[0] + limb.radii[1]) / 2, limb.radii[1], legTone);
    const knee = (limb.radii[0] + limb.radii[1]) / 2;
    rig.ellipsoid(`${leg}-knee`, [knee, knee, knee], [0, 0, 0], legTone, { segments: 6 });
    rig.ellipsoid(`${leg}-paw`, [limb.radii[1] * 1.1, 0.035, limb.radii[1] * 1.35], [0, 0, -0.01], c.paw || c.cream, { segments: 6 });
  }
  const tail = spec.tail;
  for (let i = 0; i < tail.count; i++) {
    const r0 = tail.radii[0] + (tail.radii[1] - tail.radii[0]) * i / tail.count, r1 = tail.radii[0] + (tail.radii[1] - tail.radii[0]) * (i + 1) / tail.count;
    rig.segment(`tail${i}`, r0, r1, tailColor(spec, i));
    rig.ellipsoid(`tailJoint${i}`, [r1, r1, r1], [0, 0, 0], tailColor(spec, i), { segments: 6 });
  }
  return rig.finish();
}

// One shared heart: a flat, glowing sticker shape that always faces the room.
function heartData() {
  const outline = Array.from({ length: 40 }, (_, i) => { const t = i / 40 * Math.PI * 2; return [16 * Math.sin(t) ** 3 / 17, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17]; });
  const positions = [], colors = [], indices = [], normals = [];
  for (const [ox, oy, size, tone] of [[0, 0, 0.14, [0.93, 0.47, 0.52]], [-0.15, 0.1, 0.045, [0.97, 0.66, 0.66]], [0.16, 0.14, 0.035, [0.97, 0.7, 0.62]]]) {
    const first = positions.length / 3; positions.push(ox, oy + size * 0.3, 0); colors.push(...tone.map(v => Math.min(1, v + 0.06)), 1); normals.push(0, 0, 1);
    for (const [x, y] of outline) { positions.push(ox + x * size, oy + (y + 0.36) * size, 0); colors.push(...tone, 1); normals.push(0, 0, 1); }
    for (let i = 0; i < outline.length; i++) indices.push(first, first + 1 + i, first + 1 + (i + 1) % outline.length);
  }
  const data = new VertexData(); Object.assign(data, { positions, colors, indices, normals }); return data;
}

export function createPetModel(scene, species = 'cat', ribbon = 0) {
  const spec = SPECIES[species] || SPECIES.cat, built = buildPet(SPECIES[species] ? species : 'cat', ribbon);
  const root = new TransformNode(`pet-${species}`, scene); root.scaling.setAll(spec.scale);
  // Every part rides one bone. Eyes and tongue have their own bones, which
  // shrink away while hidden.
  const skeleton = new Skeleton(`pet-${species}-rig`, `pet-${species}-rig`, scene), skin = [], skinIndex = new Map();
  const vertexCount = built.positions.length / 3, matricesIndices = new Float32Array(vertexCount * 4), matricesWeights = new Float32Array(vertexCount * 4);
  const boneFor = (source, show) => {
    const key = show ? `${source}#${show}` : source;
    if (!skinIndex.has(key)) { skinIndex.set(key, skin.length); skin.push({ source, show, bone: new Bone(key, skeleton) }); }
    return skinIndex.get(key);
  };
  for (const part of built.parts) {
    const main = boneFor(part.bone, part.show), blend = part.blend ? boneFor(part.blend) : 0;
    for (let i = part.start; i < part.end; i++) {
      const weight = part.weights ? part.weights[i - part.start] : 1;
      matricesIndices[i * 4] = main; matricesWeights[i * 4] = weight; matricesIndices[i * 4 + 1] = blend; matricesWeights[i * 4 + 1] = 1 - weight;
    }
  }
  const body = new Mesh(`pet-${species}-body`, scene), data = new VertexData();
  Object.assign(data, { positions: built.positions, normals: built.normals, colors: built.colors, indices: built.indices, matricesIndices, matricesWeights });
  data.applyToMesh(body, false); body.parent = root; body.skeleton = skeleton; body.numBoneInfluencers = 2;
  const fur = scene.getMaterialByName('pet-fur') || Object.assign(new StandardMaterial('pet-fur', scene), { diffuseColor: Color3.White(), specularColor: new Color3(0.035, 0.03, 0.025), specularPower: 14 });
  body.material = fur; body.useVertexColors = true; body.hasVertexAlpha = false; body.receiveShadows = false; body.isPickable = false;
  body.metadata = { pet: species, cat: true, castShadow: false };
  // The rest geometry sits around the origin, so the box covers every pose.
  body.setBoundingInfo(new BoundingInfo(new Vector3(-0.6, -0.05, -0.75), new Vector3(0.6, 1.0, 0.85)));
  const bones = new Map(), shrink = Matrix.Scaling(1e-4, 1e-4, 1e-4);
  for (const part of built.parts) for (const name of [part.bone, part.blend]) if (name && !bones.has(name)) bones.set(name, Matrix.Identity());
  // Floating letters for a nap: three small Zs rise, grow and shrink away.
  const letter = [[0, 1], [1, 1], [0, 0], [1, 0]];
  const sleepLetters = CreateLineSystem(`pet-${species}-sleep-letters`, { lines: [0, 1, 2].map(() => letter.map(([x, y]) => new Vector3(x, y, 0))), updatable: true }, scene);
  sleepLetters.color = Color3.FromHexString('#f1e2c8'); sleepLetters.alpha = 0.5; sleepLetters.billboardMode = Mesh.BILLBOARDMODE_ALL;
  sleepLetters.isPickable = false; sleepLetters.metadata = { castShadow: false, effect: 'pet-sleep' }; sleepLetters.setEnabled(false); sleepLetters.alwaysSelectAsActiveMesh = true;
  const letterPositions = new Float32Array(sleepLetters.getVerticesData('position'));
  const heart = new Mesh('pet-heart', scene); heartData().applyToMesh(heart);
  const heartMaterial = scene.getMaterialByName('pet-heart-glow') || Object.assign(new StandardMaterial('pet-heart-glow', scene), { disableLighting: true, diffuseColor: Color3.Black(), emissiveColor: Color3.White(), backFaceCulling: false });
  heart.material = heartMaterial; heart.useVertexColors = true; heart.billboardMode = Mesh.BILLBOARDMODE_ALL; heart.isPickable = false; heart.metadata = { castShadow: false, effect: 'pet-heart' }; heart.setEnabled(false);
  const hearts = [heart, ...Array.from({ length: MAX_HEARTS - 1 }, (_, i) => i + 1).map(i => Object.assign(heart.clone(`pet-heart-${i}`), { metadata: heart.metadata }))];
  const contact = createContactShadow(`pet-${species}-contact-shadow`, 0.42 * spec.scale, 0.3 * spec.scale, scene, { soft: 0.24, strength: 0.3 });
  contact.metadata = { ...contact.metadata, pet: true };
  // Scratch space, reused every frame.
  const goals = Object.fromEntries(Object.entries(POSES).map(([name, pose]) => [name, { ...pose, ...spec.poses?.[name] }]));
  const current = { ...goals.sleep }, paws = {}, target = {};
  for (const leg of PAWS) { paws[leg] = Vector3.FromArray(POSES.sleep[leg]); target[leg] = new Vector3(); }
  const qChest = new Quaternion(), qHips = new Quaternion(), qHead = new Quaternion(), qLocal = new Quaternion(), qTemp = new Quaternion();
  const spine = new Vector3(), chest = new Vector3(), hips = new Vector3(), neck = new Vector3(), head = new Vector3(), v = new Vector3(), w = new Vector3();
  const anchor = new Vector3(), knee = new Vector3(), foot = new Vector3(), pole = new Vector3(), dir = new Vector3(), one = new Vector3(1, 1, 1), stretch = new Vector3(1, 1, 1);
  const joints = Array.from({ length: spec.tail.count + 1 }, () => new Vector3());
  const breathChest = new Vector3(1, 1, 1), breathHips = new Vector3(1, 1, 1);
  let gait = 0, lastWalked = 0, eyesShown = 'open', mouthShown = false, blinkAt = 3, skipped = false;
  const place = (name, rotation, at, scaling = one) => Matrix.ComposeToRef(scaling, rotation, at, bones.get(name));
  // Stride offsets for one paw (diagonal pairs move together), from the
  // frame's walk weight and gait phase.
  let stepWalking = 0, stepGait = 0;
  const stepZ = key => stepWalking * Math.sin(stepGait + (key === 'fl' || key === 'br' ? 0 : Math.PI)) * spec.stride * 0.45;
  const stepY = key => stepWalking * Math.max(0, Math.cos(stepGait + (key === 'fl' || key === 'br' ? 0 : Math.PI))) * 0.045;
  function segment(name, a, b) {
    b.subtractToRef(a, dir); const length = dir.length(); dir.scaleInPlace(1 / Math.max(length, 1e-6));
    Quaternion.FromUnitVectorsToRef(UP, dir, qTemp); stretch.set(1, length, 1); place(name, qTemp, a, stretch);
  }
  function leg(key, limb, frame, from) {
    const side = key[1] === 'l' ? -1 : 1, [upper, lower] = limb.lengths;
    v.set(side * limb.anchor[0], limb.anchor[1], limb.anchor[2]).rotateByQuaternionToRef(frame, anchor); anchor.addInPlace(from);
    if (current.dangle > 0) { target[key].copyFrom(paws[key]); target[key].x += (anchor.x - target[key].x) * current.dangle; target[key].y += (anchor.y - (upper + lower) * 0.97 - target[key].y) * current.dangle; target[key].z += (anchor.z + 0.02 - target[key].z) * current.dangle; }
    else target[key].copyFrom(paws[key]);
    target[key].subtractToRef(anchor, dir);
    const reach = Math.max(Math.abs(upper - lower) + 1e-3, Math.min(upper + lower - 1e-3, dir.length()));
    dir.normalize(); foot.copyFrom(dir).scaleInPlace(reach).addInPlace(anchor);
    // Front elbows bend back, hind knees forward, as on a real pet.
    v.set(0, 0, key[0] === 'f' ? 1 : -1).rotateByQuaternionToRef(frame, pole);
    dir.scaleToRef(Vector3.Dot(pole, dir), w); pole.subtractInPlace(w); if (pole.lengthSquared() < 1e-8) pole.set(0, 0, 1); pole.normalize();
    const along = (upper * upper - lower * lower + reach * reach) / (2 * reach), rise = Math.sqrt(Math.max(0, upper * upper - along * along));
    dir.scaleToRef(along, w); knee.copyFrom(anchor).addInPlace(w); pole.scaleToRef(rise, w); knee.addInPlace(w);
    segment(`${key}-upper`, anchor, knee); segment(`${key}-lower`, knee, foot);
    place(`${key}-knee`, IDENTITY, knee);
    Quaternion.RotationYawPitchRollToRef(key[0] === 'f' ? current.curl : -current.curl, 0, 0, qLocal); place(`${key}-paw`, qLocal, foot);
  }
  // The head's centre in world space, for speech bubbles above it.
  const headPoint = out => { Vector3.TransformCoordinatesToRef(head, root.computeWorldMatrix(true), out); return out; };
  // Taps test three soft spheres (head, chest, hips): the skinned mesh
  // itself is not pickable.
  const hitCentre = new Vector3(), hitOffset = new Vector3();
  // Returns the distance along the ray to the nearest sphere, or null.
  function hitTest(ray) {
    const world = root.computeWorldMatrix(true); let nearest = null;
    for (const [point, radius] of [[head, 0.2], [chest, 0.2], [hips, 0.19]]) {
      Vector3.TransformCoordinatesToRef(point, world, hitCentre); hitCentre.subtractToRef(ray.origin, hitOffset);
      const along = Vector3.Dot(hitOffset, ray.direction), r = radius * spec.scale, miss = hitOffset.lengthSquared() - along * along;
      if (along > 0 && miss <= r * r) { const entry = along - Math.sqrt(r * r - miss); if (nearest === null || entry < nearest) nearest = entry; }
    }
    return nearest;
  }
  return {
    root, body, contact, heart, hearts, sleepLetters, species, ribbon, headPoint, hitTest,
    animate(pose, dt, seconds, reducedMotion) {
      const ritual = pose.ritual, ritualAge = ritual && Number.isFinite(pose.ritualAge) ? pose.ritualAge : 0;
      const ritualWeight = ritual && !reducedMotion ? Math.min(1, ritualAge / .4, (3 - ritualAge) / .6) : 0;
      const playful = ritual === 'play' ? ritualWeight : 0, nibble = ritual === 'treat' ? ritualWeight : 0;
      const hop = playful * Math.max(0, Math.sin(ritualAge * Math.PI * 2.3)) * (species === 'bunny' ? .13 : .07);
      const action = ritual && ritual !== 'cuddle' ? 'stand' : goals[pose.action] ? pose.action : 'sleep';
      // A settled nap only breathes, slowly: the rig updates at half rate
      // and keeps its bones (and the GPU's copy) in between.
      const napping = action === 'sleep' && !pose.moving && pose.petAge === Infinity && !reducedMotion && current.eyes < 0.02;
      if (napping && (skipped = !skipped)) { updateEffects(pose, seconds, reducedMotion); return; }
      dt = napping ? dt * 2 : dt;
      const goal = goals[action], rate = reducedMotion ? 1 : 1 - Math.exp(-dt * 5.5);
      for (const key of KEYS) current[key] += (goal[key] - current[key]) * rate;
      for (const key of PAWS) { const g = goal[key]; paws[key].x += (g[0] - paws[key].x) * rate; paws[key].y += (g[1] - paws[key].y) * rate; paws[key].z += (g[2] - paws[key].z) * rate; }
      const still = reducedMotion ? 0 : 1, awake = action !== 'sleep';
      // Walk: diagonal legs move together, and the phase follows the ground
      // actually covered, so paws never slide.
      if (pose.walked < lastWalked) lastWalked = pose.walked;
      gait += (pose.walked - lastWalked) / spec.stride * Math.PI; lastWalked = pose.walked;
      const walking = pose.moving && !reducedMotion ? 1 : 0;
      const reaction = pose.petAge < PET_REACTION ? smooth(pose.petAge / 0.35) * smooth((PET_REACTION - pose.petAge) / 0.5) : 0;
      const breath = still * (awake ? Math.sin(seconds * 2.2) * 0.5 + 0.5 : ((seconds % 4.6) < 1.6 ? (1 - Math.cos((seconds % 4.6) / 1.6 * Math.PI)) / 2 : (1 + Math.cos(((seconds % 4.6) - 1.6) / 3 * Math.PI)) / 2));
      const breathe = awake ? 0.018 : 0.045;
      breathChest.set(1 + breath * breathe * 0.3, 1 + breath * breathe, 1 + breath * breathe * 0.35); breathHips.set(1 + breath * breathe * 0.2, 1 + breath * breathe * 0.8, 1);
      const look = still * (action === 'sit' || action === 'loaf' ? Math.sin(seconds * 0.37) * 0.45 + Math.sin(seconds * 0.93 + 1) * 0.14 : action === 'stand' ? Math.sin(seconds * 0.6) * 0.3 : 0);
      const bob = walking * Math.sin(gait * 2) * 0.008, wag = spec.wag ? (0.14 * still + reaction * 0.5 + walking * 0.2) * Math.sin(seconds * (reaction ? 17 : 9)) : still * Math.sin(seconds * 1.1) * 0.07;
      const sway = walking * Math.sin(gait) * 0.14 + (action === 'held' ? still * Math.sin(seconds * 2.1) * 0.2 : 0);
      const lifted = action === 'sleep' ? 0.11 : 0.04;
      const pitch = current.pitch, curl = current.curl, roll = current.roll + reaction * 0.1;
      Quaternion.RotationYawPitchRollToRef(curl, pitch + current.chestPitch, roll, qChest);
      Quaternion.RotationYawPitchRollToRef(-curl, pitch, roll, qHips);
      spine.set(0, current.spineY + bob + hop, 0);
      v.set(0, 0, -spec.spineHalf).rotateByQuaternionToRef(qChest, chest); chest.addInPlace(spine);
      v.set(0, 0, spec.spineHalf).rotateByQuaternionToRef(qHips, hips); hips.addInPlace(spine);
      w.copyFrom(spine); w.y += spec.chest[1] * (breathChest.y - 1); place('chest', qChest, w, breathChest);
      w.copyFrom(spine); w.y += spec.hips[1] * (breathHips.y - 1); place('hips', qHips, w, breathHips);
      Vector3.FromArrayToRef(spec.neck, 0, v); v.rotateByQuaternionToRef(qChest, neck); neck.addInPlace(chest); neck.y += current.neckLift + reaction * lifted - bob * 0.5;
      Quaternion.RotationYawPitchRollToRef(curl + current.headYaw + look * (1 - reaction), current.headPitch + reaction * 0.3 - nibble * (.35 + Math.sin(ritualAge * 19) * .06), current.headRoll + reaction * 0.3 + playful * Math.sin(ritualAge * 5) * .2, qHead);
      Vector3.FromArrayToRef(spec.head, 0, v); v.rotateByQuaternionToRef(qHead, head); head.addInPlace(neck);
      place('head', qHead, head);
      v.set(reducedMotion ? 0 : Math.sin(ritualAge * 5) * .1, 0, -.47); place('toy', IDENTITY, v);
      v.set(0, 0, -.48); place('snack', IDENTITY, v);
      // The collar rings the neck, from the chest toward the head.
      if (bones.has('collar')) { head.subtractToRef(neck, dir); dir.normalize(); Quaternion.FromUnitVectorsToRef(UP, dir, qLocal); dir.scaleInPlace(0.02).addInPlace(neck); place('collar', qLocal, dir); }
      // Ears flick now and then, and fold back while being petted.
      const flick = still * (spec.flick ? Math.max(0, Math.sin(seconds * 0.43 + 2) - 0.96) * 12 : 0);
      for (const side of [-1, 1]) {
        const name = side < 0 ? 'earL' : 'earR', back = current.earBack + reaction * 0.35 + (side < 0 ? flick * 0.3 : 0);
        if (spec.ears === 'floppy') {
          v.set(side * 0.135, 0.07, 0.005);
          Quaternion.RotationYawPitchRollToRef(0, back * 0.6 + walking * Math.sin(gait * 2 + side) * 0.12, side * (0.28 + reaction * 0.2), qLocal);
        } else {
          const [ex, ey, roll] = spec.earSpot || [0.095, 0.105, 0.3];
          v.set(side * ex, ey, 0.01);
          Quaternion.RotationYawPitchRollToRef(side * -0.25, back * (spec.ears === 'long' ? 1.3 : 0.9) + (spec.ears === 'long' ? 0.12 + still * Math.sin(seconds * 0.8 + side) * 0.05 : 0), side * -roll, qLocal);
        }
        v.rotateByQuaternionToRef(qHead, w); w.addInPlace(head); qHead.multiplyToRef(qLocal, qTemp); place(name, qTemp, w);
      }
      // Paws: stride offsets on top of the pose's paw targets.
      stepWalking = walking; stepGait = gait;
      for (const key of PAWS) { paws[key].z += stepZ(key); paws[key].y += stepY(key) + hop; }
      leg('fl', spec.front, qChest, chest); leg('fr', spec.front, qChest, chest); leg('bl', spec.hind, qHips, hips); leg('br', spec.hind, qHips, hips);
      for (const key of PAWS) { paws[key].z -= stepZ(key); paws[key].y -= stepY(key) + hop; }
      // Tail: each joint turns a little further than the last, and joints
      // that would dip below the floor rest on it instead.
      const tail = spec.tail;
      Vector3.FromArrayToRef(tail.anchor, 0, v); v.rotateByQuaternionToRef(qHips, joints[0]); joints[0].addInPlace(hips);
      for (let i = 0; i < tail.count; i++) {
        const t = i / tail.count, radius = tail.radii[0] + (tail.radii[1] - tail.radii[0]) * t;
        const segPitch = current.tailPitch + i * current.tailBend + (spec.flick ? still * reaction * Math.sin(seconds * 3 + i) * 0.05 * t : 0);
        const segYaw = -curl + current.tailYaw + i * current.tailWrap + (wag + sway) * (0.4 + t);
        joints[i + 1].set(Math.sin(segYaw) * Math.cos(segPitch), Math.sin(segPitch), Math.cos(segYaw) * Math.cos(segPitch)).scaleInPlace(tail.length).addInPlace(joints[i]);
        joints[i + 1].y = Math.max(joints[i + 1].y, radius + 0.004);
        segment(`tail${i}`, joints[i], joints[i + 1]); place(`tailJoint${i}`, IDENTITY, joints[i + 1]);
      }
      // Blink while awake; eyes close contentedly for a nap, a stretch or a pet.
      if (seconds > blinkAt + 0.14) blinkAt = seconds + 2.5 + (Math.sin(seconds * 12.9898) * 0.5 + 0.5) * 3;
      const blinking = still && seconds > blinkAt && seconds < blinkAt + 0.14;
      eyesShown = current.eyes < 0.5 || reaction > 0.3 || blinking ? 'closed' : 'open';
      mouthShown = spec.look === 'dog' && (current.mouth > 0.5 || reaction > 0.3 || walking > 0);
      for (const entry of skin) {
        const hidden = entry.show === 'open' ? eyesShown !== 'open' : entry.show === 'closed' ? eyesShown !== 'closed' : entry.show === 'tongue' ? !mouthShown : entry.show === 'play' ? ritual !== 'play' : entry.show === 'treat' ? ritual !== 'treat' : false;
        // A hidden part shrinks to a speck inside its bone, so normals stay valid.
        if (hidden) shrink.multiplyToRef(bones.get(entry.source), entry.bone.getLocalMatrix());
        else entry.bone.getLocalMatrix().copyFrom(bones.get(entry.source));
      }
      skin[0].bone.markAsDirty();
      updateEffects(pose, seconds, reducedMotion);
    },
    dispose() { for (const node of [root, sleepLetters, ...hearts, contact]) node.dispose(false, false); skeleton.dispose(); },
  };
  // The nap letters and the heart float above the head.
  function updateEffects(pose, seconds, reducedMotion) {
    const napping = pose.action === 'sleep' && pose.petAge === Infinity && !reducedMotion;
    sleepLetters.setEnabled(napping);
    if (napping) {
      headPoint(w); sleepLetters.position.set(w.x, w.y + 0.12, w.z);
      for (let i = 0; i < 3; i++) {
        const life = (seconds / 3.6 + i / 3) % 1, size = Math.sin(life * Math.PI) * (0.035 + life * 0.035), x = 0.06 + life * 0.1 + Math.sin(life * 5 + i) * 0.02, y = life * 0.34;
        for (let k = 0; k < 4; k++) { const o = (i * 4 + k) * 3; letterPositions[o] = x + letter[k][0] * size; letterPositions[o + 1] = y + letter[k][1] * size; letterPositions[o + 2] = 0; }
      }
      sleepLetters.updateVerticesData('position', letterPositions, false, false);
    }
    const live = pose.hearts.filter(each => each.age >= 0), shown = reducedMotion ? live.slice(-1) : live;
    if (shown.length) headPoint(w);
    hearts.forEach((each, i) => {
      const spark = shown[i];
      each.setEnabled(Boolean(spark));
      if (!spark) return;
      const t = spark.age, pop = reducedMotion ? 1 : smooth(t / 0.2) * (1 + Math.sin(Math.min(1, t / 0.45) * Math.PI) * 0.2), fade = 1 - smooth((t - HEART_LIFE + 0.5) / 0.5);
      const sway = reducedMotion ? 0 : Math.sin(t * 3.2 + i * 2) * 0.05 + spark.sway;
      each.position.set(w.x + sway, w.y + 0.26 + (reducedMotion ? 0 : t * (0.2 + spark.size * 0.06)), w.z);
      each.scaling.setAll(pop * spark.size * (0.7 + fade * 0.3)); each.visibility = fade;
    });
  }
}
