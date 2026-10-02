import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Matrix, Vector3, Vector4 } from '@babylonjs/core/Maths/math.vector.js';
import '@babylonjs/core/Meshes/thinInstanceMesh.js';
import '@babylonjs/core/Shaders/ShadersInclude/instancesDeclaration.js';
import '@babylonjs/core/Shaders/ShadersInclude/instancesVertex.js';
import { WORLD, riverDistance, pathDistance, smooth, noise2, createTerrainField } from '../../core/world-terrain.js';
import { sampleTerrainSurface } from './terrain-mesh.js';
import { WORLD_GLSL, AIR_UNIFORMS, applyAir, followEye } from './world-glsl.js';
import { RIDGE_LIFT_GLSL, RIDGE_UNIFORMS, applyRidges } from './terrain-paint.js';
import { GROVE_GLSL, GROVE_UNIFORMS } from './grove-light.js';

export const TREE_BANDS = Object.freeze([
  Object.freeze({ from: 25, to: 450, spacing: 8, size: 1, clump: 1, spread: 1, lone: 1, behind: 450, gather: 1, fray: 0, clearing: -0.05 }),
  Object.freeze({ from: 450, to: 1300, spacing: 34, size: 1.7, clump: 2.9, spread: 1.7, lone: 0, behind: 200, gather: 0.7, fray: 1, clearing: -0.25 }),
  Object.freeze({ from: 1300, to: 3400, spacing: 46, size: 2.6, clump: 3.6, spread: 1.8, lone: 0, behind: 200, gather: 0.7, fray: 0, clearing: -0.25 }),
]);
export const WINDOW_EYE = Object.freeze({ x: -2, y: 2.24, z: -2.4 });
export const VISTA = Object.freeze({ reach: 320, clearing: 170, bearing: -0.3, halfAngle: 1.25, dip: 0.022 });
export const HERO_TREES = Object.freeze([
  Object.freeze({ bearing: -0.52, distance: 50, size: 1.3, turn: 0.4 }),
  Object.freeze({ bearing: -0.86, distance: 105, size: 1.7, turn: 2.2 }),
  Object.freeze({ bearing: 0.42, distance: 62, size: 1.3, turn: 4.1 }),
].map(hero => Object.freeze({ ...hero, x: WINDOW_EYE.x + Math.sin(hero.bearing) * hero.distance, z: WINDOW_EYE.z - Math.cos(hero.bearing) * hero.distance })));
const HERO_CLEARANCE = 11;
export const TREE_FORMS = Object.freeze({ broadleaf: 0, conifer: 1, spreading: 2 });
export const CROWN_TOPS = Object.freeze([10.6, 14.6, 9.4]);
const SPREADING_SHARE = Object.freeze({ lone: 0.7, grove: 0.35 });
export const NEAR_TREES = 115;
const LONE_TREE_AREA = 70 * 70;
const RIVER_CLEARANCE = WORLD.river.width * 1.4;
export const PATH_CLEARANCE = 2;
const FRAY_REACH = 50;

const FOLIAGE_COLORS = Object.freeze(['leafTop', 'leafUnder', 'leafMid', 'leafHaze', 'leafBack', 'leafCrown', 'needleTop', 'needleUnder', 'bark']);
const LIGHT_COLORS = ['sunColor', 'skyAmbient', 'groundAmbient', 'shadowTint'];

const PART = Object.freeze({ bark: 0, mass: 0.16, leaf: 0.25, needle: 0.5, farLeaf: 0.75, farSpreading: 0.81, farNeedle: 1 });
const VIEW_CLEARING = Object.freeze({ radius: 1.575, wind: 0.5 });

export function treeClearance(bounds, eye, target) {
  if (target.w <= 0 || Math.hypot(target.x - eye.x, target.y - eye.y, target.z - eye.z) < 0.0001) return false;
  const padding = Math.max(VIEW_CLEARING.radius, target.w) + VIEW_CLEARING.wind;
  return bounds.some(({ x, y, z, radius, height }) => {
    const size = [radius + padding, height + padding, radius + padding];
    const start = [(eye.x - x) / size[0], (eye.y - y) / size[1], (eye.z - z) / size[2]];
    const axis = [(target.x - eye.x) / size[0], (target.y - eye.y) / size[1], (target.z - eye.z) / size[2]];
    const along = Math.max(0, Math.min(1, -dot(start, axis) / dot(axis, axis)));
    return dot(add(start, axis, along), add(start, axis, along)) < 1;
  });
}

function hash(a, b, salt) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(salt, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function seeded(seed) {
  let n = 0;
  return () => hash(seed, n++, 977);
}

function groundOf(rings) {
  const grids = rings.map(({ positions, normals, colors }) => {
    const last = positions.length - 3, minX = positions[0], minZ = positions[2], step = positions[5] - minZ, nz = Math.round((positions[last + 2] - minZ) / step) + 1;
    return { minX, minZ, maxX: positions[last], maxZ: positions[last + 2], step, nx: positions.length / 3 / nz, nz, positions, normals, colors };
  });
  const at = { y: 0, cover: 0, up: 1, wet: 0 };
  return (x, z) => {
    let g = null;
    for (const grid of grids) if (x > grid.minX && x < grid.maxX && z > grid.minZ && z < grid.maxZ) { g = grid; break; }
    if (!g) return null;
    const u = (x - g.minX) / g.step, w = (z - g.minZ) / g.step, i = Math.min(g.nx - 2, Math.floor(u)), j = Math.min(g.nz - 2, Math.floor(w)), fu = u - i, fw = w - j, a = i * g.nz + j, b = a + g.nz;
    const lower = fu + fw <= 1, p = lower ? a : b + 1, q = lower ? b : a + 1, r = lower ? a + 1 : b;
    const wq = lower ? fu : 1 - fu, wr = lower ? fw : 1 - fw, wp = 1 - wq - wr;
    const blend = (data, stride, offset) => data[p * stride + offset] * wp + data[q * stride + offset] * wq + data[r * stride + offset] * wr;
    at.y = blend(g.positions, 3, 1); at.up = blend(g.normals, 3, 1); at.cover = blend(g.colors, 4, 0); at.wet = blend(g.colors, 4, 1);
    return at;
  };
}

const sightLine = (px, pz) => {
  const dx = px - WINDOW_EYE.x, dz = WINDOW_EYE.z - pz, distance = Math.hypot(dx, dz);
  if (dz <= 0 || distance >= VISTA.reach || Math.abs(Math.atan2(dx, dz) - VISTA.bearing) >= VISTA.halfAngle) return Infinity;
  return distance < VISTA.clearing ? -Infinity : WINDOW_EYE.y - distance * VISTA.dip;
};

export function plantTrees(rings) {
  const ground = groundOf(rings), x = [], y = [], z = [], width = [], height = [], turn = [], kind = [];
  const plant = (px, pz, at, grow, spin, form, tall, spread = 1) => {
    x.push(px); z.push(pz); y.push(at.y - 0.5 * grow); turn.push(spin);
    width.push(grow * spread); height.push(grow * tall); kind.push(form);
  };
  for (const hero of HERO_TREES) {
    const at = ground(hero.x, hero.z), top = WINDOW_EYE.y - hero.distance * VISTA.dip;
    if (at) plant(hero.x, hero.z, at, Math.max(0.6, Math.min(hero.size, (top - at.y) / (CROWN_TOPS[TREE_FORMS.spreading] - 0.5))), hero.turn, TREE_FORMS.spreading, 1);
  }
  const neighbour = groundOf(rings), coverAt = (x, z) => neighbour(x, z)?.cover ?? 0, heightToward = (x, z, fallback) => neighbour(x, z)?.y ?? fallback;
  TREE_BANDS.forEach(({ from, to, spacing, size, clump, spread, lone: loneShare, behind, gather, fray, clearing }, band) => {
    const cells = Math.ceil(to / spacing), lone = loneShare * spacing * spacing / LONE_TREE_AREA, salt = band * 8, scatter = 1 + 0.7 * gather, thicketSize = spacing / TREE_BANDS[0].spacing;
    for (let gx = -cells; gx < cells; gx++) for (let gz = -cells; gz < Math.ceil(behind / spacing); gz++) {
      const px = (gx + 0.5 + (hash(gx, gz, salt + 1) - 0.5) * scatter) * spacing, pz = (gz + 0.5 + (hash(gx, gz, salt + 2) - 0.5) * scatter) * spacing, d = Math.hypot(px, pz);
      if (d < from || d >= to || pz > behind || riverDistance(px, pz) < RIVER_CLEARANCE) continue;
      if (HERO_TREES.some(hero => Math.hypot(px - hero.x, pz - hero.z) < HERO_CLEARANCE * hero.size)) continue;
      const at = ground(px, pz);
      if (!at) continue;
      const grove = smooth(0.02, 0.32, noise2(px / 150, pz / 150, 91) + 0.35 * noise2(px / 48, pz / 48, 92));
      const open = (1 - smooth(0.12, 0.35, at.cover)) * (at.wet > 0 ? 0 : 1), up = at.up;
      const edge = fray && open && up > 0.55 ? Math.max(coverAt(px + FRAY_REACH, pz), coverAt(px - FRAY_REACH, pz), coverAt(px, pz + FRAY_REACH), coverAt(px, pz - FRAY_REACH)) : 0;
      const crest = fray && open && up > 0.85 ? smooth(8, 22, at.y - heightToward(px * (1 - FRAY_REACH / d), pz * (1 - FRAY_REACH / d), at.y)) : 0;
      const frayed = fray * Math.max(smooth(0.3, 0.8, edge) * smooth(0.55, 0.75, up) * 0.8, crest) * smooth(-0.3, 0.3, noise2(px / 70, pz / 70, 96));
      const meadow = Math.max(lone * smooth(0.9, 0.96, up), frayed) * open;
      const thicket = smooth(clearing, 0.4, noise2(px / (30 * thicketSize), pz / (30 * thicketSize), 94) + 0.45 * noise2(px / (12 * thicketSize), pz / (12 * thicketSize), 95)), gathered = 1 - gather + gather * thicket;
      const forest = smooth(0.04, 0.3, at.cover) * grove * 1.3 * gathered * (1 + gather), roll = hash(gx, gz, salt + 3);
      if (roll >= forest && roll >= meadow) continue;
      const alone = roll >= forest, stand = smooth(-0.05, 0.35, noise2(px / 90, pz / 90, 93)), conifer = !alone && hash(gx, gz, salt + 4) < (0.85 * smooth(25, 120, at.y) + 0.5 * smooth(0.95, 0.85, at.up)) * stand;
      const spreading = !conifer && band === 0 && hash(gx, gz, salt + 10) < (alone ? SPREADING_SHARE.lone : SPREADING_SHARE.grove);
      const form = conifer ? TREE_FORMS.conifer : spreading ? TREE_FORMS.spreading : TREE_FORMS.broadleaf;
      const massed = !alone && !conifer, scale = (0.6 + 0.65 * hash(gx, gz, salt + 5) + 0.35 * smooth(0.4, 0.9, grove)) * (1 - gather * 0.55 + gather * gathered);
      const grow = (massed ? clump : size) * scale * (alone ? 1.3 : 1), tall = 0.88 + 0.28 * hash(gx, gz, salt + 7) + gather * 0.2 * (hash(gx, gz, salt + 8) - 0.5);
      if (at.y - 0.5 * grow + grow * tall * CROWN_TOPS[form] > sightLine(px, pz)) continue;
      if (pathDistance(px, pz) < PATH_CLEARANCE + 5 * grow) continue;
      plant(px, pz, at, grow, hash(gx, gz, salt + 6) * Math.PI * 2, form, tall, massed ? spread : 1 + gather * 0.3 * (hash(gx, gz, salt + 9) - 0.5));
    }
  });
  return { count: x.length, x: Float32Array.from(x), y: Float32Array.from(y), z: Float32Array.from(z), width: Float32Array.from(width), height: Float32Array.from(height), turn: Float32Array.from(turn), kind: Uint8Array.from(kind) };
}

export function plantDefinitionTrees(rings, definition) {
  const field = createTerrainField(definition), settings = definition.trees, { minX, maxX, minZ, maxZ } = settings.bounds;
  const points = [], plant = (x, z, size, kind, turn, tall = 1) => {
    const at = sampleTerrainSurface(rings, x, z);
    if (at) points.push({ x, z, y: at.height - 0.5 * size, width: size, height: size * tall, kind, turn });
  };
  for (const hero of settings.heroes) plant(hero.x, hero.z, hero.size, hero.kind, hero.turn, hero.tall ?? 1);
  for (let ix = Math.floor(minX / settings.spacing); ix < maxX / settings.spacing; ix++) for (let iz = Math.floor(minZ / settings.spacing); iz < maxZ / settings.spacing; iz++) {
    const x = (ix + hash(ix, iz, 741)) * settings.spacing, z = (iz + hash(ix, iz, 742)) * settings.spacing;
    if (settings.opening && x > settings.opening.minX && x < settings.opening.maxX && z > settings.opening.minZ && z < settings.opening.maxZ) continue;
    const grove = settings.groveScale ? smooth(-.45, .5, noise2(x / settings.groveScale, z / settings.groveScale, 750) + .45 * noise2(x / 13, z / 13, 751)) : 1;
    const cover = field.canopyAt(x, z), size = settings.groveScale ? (.65 + hash(ix, iz, 744) * .82) * (.88 + .18 * grove) : .7 + hash(ix, iz, 744) * .65;
    const meadow = (1 - cover) * 0.028 * smooth(155, 260, -z);
    if (hash(ix, iz, 743) > cover * .76 * (settings.groveScale ? .28 + 1.04 * grove : 1) + meadow || Math.hypot(x, z) < 16 || field.pathDistance(x, z) < definition.path.width + size * 3.3) continue;
    if (settings.heroes.some(hero => Math.hypot(x - hero.x, z - hero.z) < 10 * hero.size)) continue;
    if ([...definition.landmarks, ...(definition.formations ?? [])].some(mark => !mark.distant && Math.hypot(x - mark.x, z - mark.z) < (mark.width ?? (mark.radius ? mark.radius * 3 : 4)) * 0.7)) continue;
    const at = sampleTerrainSurface(rings, x, z);
    if (!at || at.normal.y < 0.82 || field.riverDistance(x, z) < 4) continue;
    plant(x, z, size, hash(ix, iz, 745) < 0.32 ? TREE_FORMS.spreading : TREE_FORMS.broadleaf, hash(ix, iz, 746) * Math.PI * 2, settings.groveScale ? .82 + hash(ix, iz, 747) * .42 : .95 + hash(ix, iz, 747) * .2);
  }
  const data = { count: points.length };
  for (const key of ['x', 'y', 'z', 'width', 'height', 'turn']) data[key] = Float32Array.from(points, point => point[key]);
  data.kind = Uint8Array.from(points, point => point.kind);
  return data;
}

const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const blendNormal = (v, outer, inner, weight) => unit(add(unit(sub(v, outer)), unit(sub(v, inner)), weight));
const sphere = rand => { const a = rand() * Math.PI * 2, y = rand() * 2 - 1, r = Math.sqrt(1 - y * y); return [Math.cos(a) * r, y, Math.sin(a) * r]; };

const GOLDEN = (1 + Math.sqrt(5)) / 2;
const ICOSAHEDRON = [[-1, GOLDEN, 0], [1, GOLDEN, 0], [-1, -GOLDEN, 0], [1, -GOLDEN, 0], [0, -1, GOLDEN], [0, 1, GOLDEN], [0, -1, -GOLDEN], [0, 1, -GOLDEN], [GOLDEN, 0, -1], [GOLDEN, 0, 1], [-GOLDEN, 0, -1], [-GOLDEN, 0, 1]].map(unit);
const ICOSAHEDRON_FACES = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
const ROUND_CROWN = (() => {
  const vertices = ICOSAHEDRON.slice(), faces = [], edges = new Map();
  const midpoint = (a, b) => {
    const key = `${Math.min(a, b)},${Math.max(a, b)}`;
    if (!edges.has(key)) { edges.set(key, vertices.length); vertices.push(unit(add(vertices[a], vertices[b]))); }
    return edges.get(key);
  };
  for (const [a, b, c] of ICOSAHEDRON_FACES) {
    const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
    faces.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
  }
  return { vertices, faces };
})();

function shape() {
  const s = { positions: [], normals: [], colors: [], uvs: [], indices: [] };
  let trunkEnd = 0;
  s.vertex = (p, n, color, uv) => { s.positions.push(...p); s.normals.push(...n); s.colors.push(...color); s.uvs.push(...uv); return s.positions.length / 3 - 1; };
  s.card = (centre, e1, e2, normalOf, colorOf) => {
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => add(add(centre, e1, u), e2, v));
    const base = corners.map((p, k) => s.vertex(p, normalOf(p), colorOf(p), [k === 1 || k === 2 ? 1 : 0, k > 1 ? 1 : 0]))[0];
    s.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  s.tube = (from, to, r0, r1, sides, colorOf) => {
    const axis = unit(sub(to, from)), side = unit(cross(axis, Math.abs(axis[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])), other = cross(axis, side), start = s.positions.length / 3;
    for (let k = 0; k <= sides; k++) {
      const a = k / sides * Math.PI * 2, n = add([side[0] * Math.cos(a), side[1] * Math.cos(a), side[2] * Math.cos(a)], other, Math.sin(a));
      s.vertex(add(from, n, r0), n, colorOf(from), [k / sides, 0]); s.vertex(add(to, n, r1), n, colorOf(to), [k / sides, 1]);
    }
    for (let k = 0; k < sides; k++) { const a = start + k * 2; s.indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    if (start === 0) trunkEnd = s.positions.length;
  };
  s.branch = (knots, sides, colorOf) => {
    const start = s.positions.length / 3;
    knots.forEach((knot, row) => {
      const axis = unit(sub(knots[Math.min(knots.length - 1, row + 1)].slice(0, 3), knots[Math.max(0, row - 1)].slice(0, 3)));
      const side = unit(cross(axis, Math.abs(axis[2]) > .9 ? [1, 0, 0] : [0, 0, 1])), other = cross(axis, side);
      for (let k = 0; k <= sides; k++) {
        const angle = k / sides * Math.PI * 2, normal = add(side.map(v => v * Math.cos(angle)), other, Math.sin(angle));
        const radius = knot[3] * (1 + Math.sin(angle * 5 + row * .4) * .045), point = add(knot.slice(0, 3), normal, radius);
        s.vertex(point, normal, colorOf(point), [k / sides, row / (knots.length - 1)]);
      }
    });
    for (let row = 0; row < knots.length - 1; row++) for (let k = 0; k < sides; k++) {
      const a = start + row * (sides + 1) + k, b = a + sides + 1;
      s.indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
    if (start === 0) trunkEnd = s.positions.length;
  };
  s.ball = (centre, radius, squash, normalOf, colorOf, rounded = false) => {
    const start = s.positions.length / 3;
    for (const corner of rounded ? ROUND_CROWN.vertices : ICOSAHEDRON) {
      const p = add(centre, [corner[0] * radius, corner[1] * radius * squash, corner[2] * radius]);
      s.vertex(p, normalOf(p), colorOf(p), [0.5, 0.5]);
    }
    for (const face of rounded ? ROUND_CROWN.faces : ICOSAHEDRON_FACES) s.indices.push(start + face[0], start + face[1], start + face[2]);
  };
  s.data = () => {
    const bound = (start, end) => {
      let low = Infinity, high = -Infinity, radius = 0;
      for (let i = start; i < end; i += 3) { low = Math.min(low, s.positions[i + 1]); high = Math.max(high, s.positions[i + 1]); radius = Math.max(radius, Math.hypot(s.positions[i], s.positions[i + 2])); }
      const centre = (low + high) / 2, half = Math.max(0.01, (high - low) / 2);
      let grow = 1;
      for (let i = start; i < end; i += 3) grow = Math.max(grow, Math.hypot(s.positions[i] / radius, (s.positions[i + 1] - centre) / half, s.positions[i + 2] / radius));
      return [centre, radius * grow, half * grow, 0];
    };
    const trunk = bound(0, trunkEnd || s.positions.length), crown = bound(trunkEnd, s.positions.length);
    const treeTrunk = new Float32Array(s.positions.length / 3 * 4), treeCrown = new Float32Array(treeTrunk.length);
    for (let i = 0; i < treeTrunk.length; i += 4) { treeTrunk.set(trunk, i); treeCrown.set(crown, i); }
    return { positions: new Float32Array(s.positions), normals: new Float32Array(s.normals), colors: new Float32Array(s.colors), uvs: new Float32Array(s.uvs), indices: new Uint16Array(s.indices), treeTrunk, treeCrown };
  };
  return s;
}

function scatterCards(s, rand, centre, radius, squash, cards, half, lean, normalOf, colorOf) {
  for (let k = 0; k < cards; k++) {
    const dir = sphere(rand), spot = add(centre, [dir[0] * radius, dir[1] * radius * squash, dir[2] * radius], 0.3 + 0.5 * Math.sqrt(rand()));
    const facing = unit(add(add(dir, sphere(rand), 0.7), [0, 1, 0], lean)), e1 = unit(cross(facing, Math.abs(facing[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0])), e2 = cross(facing, e1);
    const spin = rand() * Math.PI * 2, size = radius * half * (0.8 + 0.4 * rand());
    const a = add([e1[0] * Math.cos(spin), e1[1] * Math.cos(spin), e1[2] * Math.cos(spin)], e2, Math.sin(spin)), b = cross(facing, a);
    s.card(spot, [a[0] * size, a[1] * size, a[2] * size], [b[0] * size, b[1] * size, b[2] * size], normalOf, colorOf(rand()));
  }
}

function woodlandLeaves(s, rand, centre, radius, squash, normalOf, colorOf, count = 72, cardWidth = .28) {
  const turn = rand() * Math.PI * 2;
  for (let k = 0; k < count; k++) {
    const y = 1 - 2 * (k + .5) / count, ring = Math.sqrt(1 - y * y), angle = turn + k * Math.PI * (3 - Math.sqrt(5));
    const dir = [Math.cos(angle) * ring, y, Math.sin(angle) * ring], reach = .79 + rand() * .08;
    const spot = add(centre, [dir[0] * radius, dir[1] * radius * squash, dir[2] * radius], reach);
    const facing = unit(add(dir, sphere(rand), .26)), side = unit(cross(facing, Math.abs(facing[1]) > .95 ? [1, 0, 0] : [0, 1, 0])), up = cross(facing, side);
    const spin = rand() * Math.PI * 2, size = radius * (cardWidth + rand() * .06), a = add(side.map(v => v * Math.cos(spin)), up, Math.sin(spin)), b = cross(facing, a);
    s.card(spot, a.map(v => v * size), b.map(v => v * size), normalOf, colorOf(rand()));
  }
}

function broadleaf() {
  const s = shape(), rand = seeded(11), canopy = [0, 6.5, 0], fork = [0.2, 3.4, 0.1];
  const clumps = [{ c: [0, 7.9, 0], r: 2.7 }];
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + rand() * 0.5, d = 2.8 + rand() * 0.7; clumps.push({ c: [Math.cos(a) * d, 5.7 + rand() * 1.4, Math.sin(a) * d], r: 2 + rand() * 0.5 }); }
  const barkColor = p => [0.45 + 0.5 * smooth(-0.5, 6, p[1]), 0.08 * smooth(1, 6, p[1]), PART.bark, 0];
  s.tube([0, -0.8, 0], fork, 0.5, 0.33, 7, barkColor);
  for (const { c } of clumps) s.tube(fork, add(fork, sub(c, fork), 0.8), 0.22, 0.08, 5, barkColor);
  for (const { c, r } of clumps) {
    const normalOf = v => blendNormal(v, canopy, c, 1.3), light = v => {
      const out = sub(v, canopy), depth = Math.min(1, Math.hypot(...out) / 4.8);
      return 0.36 + 0.22 * out[1] / (Math.hypot(...out) || 1) + 0.2 * depth + 0.38 * (v[1] - c[1]) / r;
    };
    const sway = v => Math.min(1, (v[1] / 9) ** 1.5), seed = rand();
    s.ball(c, r * 0.8, 0.78, normalOf, v => [Math.min(0.75, Math.max(0.12, light(v) - 0.12)), sway(v), PART.mass, seed]);
    scatterCards(s, rand, c, r, 0.8, 16, 0.62, 0.3, normalOf, leafSeed => v => [Math.min(1, Math.max(0.16, light(v))), sway(v), PART.leaf, leafSeed]);
  }
  return s.data();
}

function spreading() {
  const s = shape(), rand = seeded(17), canopy = [0, 6.4, 0], fork = [0.15, 2.9, 0.05], limbs = [], clumps = [{ c: [0, 7, 0], r: 2.6 }];
  for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + 0.4 + rand() * 0.6; limbs.push([Math.cos(a) * 2.6, 4.9 + rand() * 0.5, Math.sin(a) * 2.6]); }
  for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 + rand() * 0.4, d = 4.4 + rand() * 1.2; clumps.push({ c: [Math.cos(a) * d, 6.2 + rand() * 0.6, Math.sin(a) * d], r: 2.1 + rand() * 0.5 }); }
  const barkColor = p => [0.45 + 0.5 * smooth(-0.5, 5, p[1]), 0.08 * smooth(1, 5, p[1]), PART.bark, 0];
  s.tube([0, -0.8, 0], fork, 0.55, 0.4, 7, barkColor);
  for (const limb of limbs) s.tube(fork, limb, 0.3, 0.17, 5, barkColor);
  for (const { c } of clumps) {
    const limb = limbs.reduce((best, l) => Math.hypot(...sub(c, l)) < Math.hypot(...sub(c, best)) ? l : best);
    s.tube(limb, add(limb, sub(c, limb), 0.75), 0.15, 0.06, 4, barkColor);
  }
  for (const { c, r } of clumps) {
    const normalOf = v => blendNormal(v, canopy, c, 1.3), light = v => {
      const out = sub(v, canopy), depth = Math.min(1, Math.hypot(...out) / 7);
      return 0.36 + 0.22 * out[1] / (Math.hypot(...out) || 1) + 0.2 * depth + 0.38 * (v[1] - c[1]) / (r * 0.55);
    };
    const sway = v => Math.min(1, (v[1] / 9) ** 1.5), seed = rand();
    s.ball(c, r * 0.8, 0.55, normalOf, v => [Math.min(0.75, Math.max(0.12, light(v) - 0.12)), sway(v), PART.mass, seed]);
    scatterCards(s, rand, c, r, 0.55, 14, 0.62, 0.6, normalOf, leafSeed => v => [Math.min(1, Math.max(0.16, light(v))), sway(v), PART.leaf, leafSeed]);
  }
  return s.data();
}

function conifer() {
  const s = shape(), rand = seeded(31), tiers = 9, segments = 12;
  s.tube([0, -0.8, 0], [0, 13.6, 0], 0.34, 0.06, 6, p => [0.4 + 0.5 * smooth(0, 12, p[1]), 0.1 * smooth(2, 13, p[1]), PART.bark, 0]);
  for (let k = 0; k < tiers; k++) {
    const t = k / (tiers - 1), y = 2.4 + t * 10.6, r = 3.3 * (1 - t * 0.86) + 0.35, droop = r * (0.55 + 0.15 * rand()), turn = rand() * Math.PI * 2, seed = rand();
    const start = s.positions.length / 3;
    for (let j = 0; j <= segments; j++) {
      const a = turn + j / segments * Math.PI * 2, out = [Math.cos(a), 0, Math.sin(a)], reach = r * (0.88 + 0.24 * rand());
      const n = unit(add([out[0] * 0.7, 0.75, out[2] * 0.7], unit([out[0] * reach, y - 6.5, out[2] * reach]), 0.5));
      s.vertex([out[0] * 0.15, y + 0.5, out[2] * 0.15], n, [0.3 + 0.25 * t, Math.min(1, (y / 13) ** 1.5) * 0.6, PART.needle, seed], [j, 0]);
      s.vertex([out[0] * reach, y - droop, out[2] * reach], n, [Math.min(1, 0.85 + 0.15 * t), Math.min(1, (y / 13) ** 1.5) * 0.6, PART.needle, seed], [j, 1]);
    }
    for (let j = 0; j < segments; j++) { const a = start + j * 2; s.indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  return s.data();
}

function woodlandForm(wide) {
  const crowns = wide ? [
    { c: [-3.6, 6.15, .25], r: 2.3, squash: .7 },
    { c: [-1.35, 7.15, -1.05], r: 2, squash: .8 },
    { c: [1.05, 6.8, 1.3], r: 2.3, squash: .76 },
    { c: [3.9, 5.55, .2], r: 2.05, squash: .66 },
    { c: [2.75, 6.2, -2.1], r: 1.65, squash: .8 },
    { c: [-2.4, 5.35, 2.55], r: 1.6, squash: .65 },
    { c: [-.4, 5.9, -3], r: 1.7, squash: .72 },
  ] : [
    { c: [-2.2, 6.65, .25], r: 2.05, squash: .86 },
    { c: [.55, 8.1, -.75], r: 1.9, squash: .92 },
    { c: [1.75, 7.15, 1.2], r: 1.95, squash: .84 },
    { c: [3.05, 5.55, -1.1], r: 1.55, squash: .75 },
    { c: [-.65, 5.9, 2.6], r: 1.45, squash: .74 },
    { c: [-3.25, 5.15, -1.15], r: 1.25, squash: .78 },
    { c: [.1, 6.55, -2.5], r: 1.65, squash: .86 },
  ];
  const trunk = [[0, -.8, 0, .61], [.04, .5, -.03, .41], [-.1, 2.1, .07, .32], [.16, 3.7, .06, .24], [.03, 5.1, -.08, .18], [-.22, 6.4, -.04, .1]];
  const boughs = crowns.map(({ c, r }, i) => {
    const low = i === 0 || i === 3, height = low ? i === 0 ? 3.1 : 4.1 : [5.85, 6.2, 5.9, 6.1, 5.65, 6.3, 5.8][i];
    const row = trunk.findIndex(knot => knot[1] >= height), a = trunk[row - 1], b = trunk[row], fraction = (height - a[1]) / (b[1] - a[1]);
    const start = a.slice(0, 3).map((value, axis) => value + (b[axis] - value) * fraction), neck = [start[0], Math.max(5.85, start[1] + .25), start[2]];
    const tip = [c[0], Math.max(5.95, c[1]), c[2]], elbow = add(low ? start : neck, sub(tip, low ? start : neck), .4), shoulder = add(start, sub(tip, start), .76);
    elbow[1] = Math.max(low ? 3.9 : 6, elbow[1] - .2); shoulder[1] = Math.max(low ? 5.6 : 6, shoulder[1] - .15);
    elbow[2] += Math.sin(i * 3.7 + (wide ? 1 : 0)) * .2;
    const knots = [[...start, low ? .24 : .16], ...(!low ? [[...neck, .16]] : []), [...elbow, .15 + r * .015], [...shoulder, .1], [...tip, .035]];
    const twigs = [-1, 1].map(side => {
      const twig = [c[0] + side * r * .54, Math.max(5.95, c[1] + r * .15), c[2] + r * .42], bend = add(shoulder, sub(twig, shoulder), .55);
      bend[1] = Math.max(5.95, bend[1] - .12);
      return [[...shoulder, .075], [...bend, .045], [...twig, .012]];
    });
    return { knots, twigs, low };
  });
  return { trunk, crowns, boughs };
}

const WOODLAND_FORMS = [woodlandForm(false), null, woodlandForm(true)];

export function treeBranchColliders(form, style) {
  if (style !== 'woodland' || !WOODLAND_FORMS[form]) return [];
  const colliders = [];
  for (const { knots, low } of WOODLAND_FORMS[form].boughs) {
    if (!low) continue;
    for (let k = 1; k < knots.length; k++) {
      const a = knots[k - 1], b = knots[k], steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / .8));
      for (let step = 0; step < steps; step++) {
        const from = a.map((value, axis) => value + (b[axis] - value) * step / steps), to = a.map((value, axis) => value + (b[axis] - value) * (step + 1) / steps);
        const radius = Math.max(from[3], to[3]) * 1.05, baseY = Math.min(from[1], to[1]) - radius;
        colliders.push({ x: (from[0] + to[0]) / 2, z: (from[2] + to[2]) / 2, radius: Math.hypot(to[0] - from[0], to[2] - from[2]) / 2 + radius, baseY, height: Math.max(from[1], to[1]) + radius - baseY });
      }
    }
  }
  return colliders;
}

function woodlandTree(wide) {
  const s = shape(), rand = seeded(wide ? 131 : 137), canopy = [0, wide ? 6 : 6.5, 0], { trunk, crowns, boughs } = WOODLAND_FORMS[wide ? 2 : 0];
  const barkColor = p => [.58 + .35 * smooth(-.5, 6, p[1]), .06 * smooth(1.5, 6, p[1]), PART.bark, 0];
  s.branch(trunk, 10, barkColor);
  crowns.forEach(({ c, r, squash }, i) => {
    s.branch(boughs[i].knots, 6, barkColor);
    for (const twig of boughs[i].twigs) s.branch(twig, 5, barkColor);
    const normalOf = v => blendNormal(v, canopy, c, .72), light = v => {
      const out = sub(v, canopy), depth = Math.min(1, Math.hypot(...out) / (wide ? 6.8 : 5.3));
      return Math.min(.94, Math.max(.17, .35 + .2 * out[1] / (Math.hypot(...out) || 1) + .16 * depth + .3 * (v[1] - c[1]) / (r * squash)));
    };
    const sway = v => Math.min(.85, (Math.max(v[1], 0) / 10) ** 1.6), seed = rand();
    for (const [dx, dy, dz, radius] of [[0, 0, 0, .59], [-.43, .08, .16, .42], [.4, .14, -.18, .45]]) {
      const lobe = [c[0] + dx * r, c[1] + dy * r * squash, c[2] + dz * r];
      s.ball(lobe, r * radius, squash, normalOf, v => [Math.max(.14, light(v) - .13), sway(v), PART.mass, seed], true);
    }
    woodlandLeaves(s, rand, c, r, squash, normalOf, leafSeed => v => [light(v), sway(v), PART.leaf, leafSeed]);
  });
  return s.data();
}

function woodlandFar(wide) {
  const s = shape(), canopy = [0, wide ? 6 : 6.5, 0], rand = seeded(wide ? 131 : 137), { trunk, crowns, boughs } = WOODLAND_FORMS[wide ? 2 : 0];
  const barkColor = p => [.58 + .35 * smooth(-.5, 6, p[1]), .06 * smooth(1.5, 6, p[1]), PART.bark, 0];
  s.branch(trunk, 5, barkColor);
  for (const { knots, low } of boughs) s.branch(low ? knots : knots.filter((_, row) => row !== 1), 3, barkColor);
  crowns.forEach(({ c, r, squash }, crown) => {
    const start = s.positions.length / 3, seed = hash(crown, wide ? 131 : 137, 919);
    for (const corner of ROUND_CROWN.vertices) {
      const bulge = .79 + .05 * Math.sin(corner[0] * 4.1 + crown * 2.3) * Math.cos(corner[2] * 3.7 - corner[1] * 4.3);
      const point = add(c, [corner[0] * r * bulge, corner[1] * r * squash * bulge, corner[2] * r * bulge]);
      const out = sub(point, canopy), depth = Math.min(1, Math.hypot(...out) / (wide ? 6.8 : 5.3));
      const light = Math.min(.94, Math.max(.17, .35 + .2 * out[1] / (Math.hypot(...out) || 1) + .16 * depth + .3 * (point[1] - c[1]) / (r * squash)));
      s.vertex(point, blendNormal(point, canopy, c, .72), [light, Math.min(.85, (Math.max(point[1], 0) / 10) ** 1.6), PART.mass, seed], [.5, .5]);
    }
    for (const face of ROUND_CROWN.faces) s.indices.push(start + face[0], start + face[1], start + face[2]);
    woodlandLeaves(s, rand, c, r, squash, v => blendNormal(v, canopy, c, .72), leafSeed => v => {
      const out = sub(v, canopy), depth = Math.min(1, Math.hypot(...out) / (wide ? 6.8 : 5.3));
      const light = Math.min(.94, Math.max(.17, .35 + .2 * out[1] / (Math.hypot(...out) || 1) + .16 * depth + .3 * (v[1] - c[1]) / (r * squash)));
      return [light, Math.min(.85, (Math.max(v[1], 0) / 10) ** 1.6), PART.leaf, leafSeed];
    }, 24, .43);
  });
  return s.data();
}

function impostor(halfWidth, top, part) {
  const s = shape(), normal = [0, 0, 1];
  s.card([0, (top - 0.8) / 2, 0], [halfWidth, 0, 0], [0, (top + 0.8) / 2, 0], () => normal, p => [1, 0, part, 0]);
  const data = s.data();
  for (let v = 0; v < 4; v++) { data.uvs[v * 2] = data.positions[v * 3]; data.uvs[v * 2 + 1] = data.positions[v * 3 + 1]; }
  return data;
}

const TREE_KINDS = Object.freeze([
  Object.freeze({ name: 'broadleaf', near: broadleaf, far: () => impostor(5.8, 10.8, PART.farLeaf) }),
  Object.freeze({ name: 'conifer', near: conifer, far: () => impostor(3.8, 14.6, PART.farNeedle) }),
  Object.freeze({ name: 'spreading', near: spreading, far: () => impostor(8.2, 9, PART.farSpreading) }),
]);

const WOODLAND_MODELS = Object.freeze([() => woodlandTree(false), conifer, () => woodlandTree(true)]);

const TREE_CLEARANCE_GLSL = `
float treeClearance(vec4 bound, mat4 model) {
  if (viewTarget.w <= 0. || distance(eye, viewTarget.xyz) < .0001) return 0.;
  vec3 centre = (model * vec4(0., bound.x, 0., 1.)).xyz;
  vec3 size = vec3(bound.y * length(model[0].xyz), bound.z * length(model[1].xyz), bound.y * length(model[2].xyz)) + max(${VIEW_CLEARING.radius.toFixed(3)}, viewTarget.w) + ${VIEW_CLEARING.wind.toFixed(2)};
  vec3 offset = eye - centre, delta = viewTarget.xyz - eye;
  vec3 start = vec3(dot(offset, normalize(model[0].xyz)), dot(offset, normalize(model[1].xyz)), dot(offset, normalize(model[2].xyz))) / size;
  vec3 axis = vec3(dot(delta, normalize(model[0].xyz)), dot(delta, normalize(model[1].xyz)), dot(delta, normalize(model[2].xyz))) / size;
  vec3 closest = start + axis * clamp(-dot(start, axis) / dot(axis, axis), 0., 1.);
  return dot(closest, closest) < 1. ? 1. : 0.;
}`;

const treeVertex = grove => `precision highp float;
attribute vec3 position, normal; attribute vec4 color; attribute vec2 uv;
#ifdef TREE_CONNECTED_CLEARANCE
attribute vec4 treeTrunk, treeCrown;
#endif
uniform mat4 viewProjection; uniform float time; uniform vec3 eye; uniform vec4 viewTarget;
#include<instancesDeclaration>
varying vec3 vWorld, vNormal, vRight; varying vec4 vPart; varying vec2 vUv; varying float vSeed, vSpread, vTreeClearance;
${grove ? 'varying float vRootY;' : ''}
${WORLD_GLSL}
${TREE_CLEARANCE_GLSL}
void main() {
#include<instancesVertex>
  vec3 base = finalWorld[3].xyz;
  ${grove ? 'vRootY = base.y + .5 * length(finalWorld[0].xyz);' : ''}
  vTreeClearance = 0.;
#ifdef TREE_CONNECTED_CLEARANCE
  vTreeClearance = max(treeClearance(treeTrunk, finalWorld), treeClearance(treeCrown, finalWorld));
#endif
  float phase = worldHash(base.xz * .071) * 6.283, sway = color.g, leaf = step(.1, color.b) * (1. - step(.62, color.b));
  vec2 gust = vec2(sin(time * .8 + phase), cos(time * .63 + phase * 1.7)) * .16 + vec2(.22, .1) * (sin(time * .31 + base.x * .004 + base.z * .003) * .5 + .5);
  vec4 p;
  if (color.b > .62) {
    vec2 facing = normalize(eye.xz - base.xz + 1e-4);
    vRight = vec3(facing.y, 0., -facing.x); vNormal = vec3(facing.x, 0., facing.y);
    p = vec4(base + vRight * position.x * length(finalWorld[0].xyz) + vec3(0., position.y * length(finalWorld[1].xyz), 0.), 1.);
    p.xz += gust * max(position.y, 0.) * .025;
  } else {
    p = finalWorld * vec4(position, 1.);
    p.xz += gust * sway;
    p.xyz += leaf * sway * .07 * vec3(sin(time * 2.3 + color.a * 40.), sin(time * 1.9 + color.a * 31.), cos(time * 2.1 + color.a * 23.));
    vNormal = mat3(finalWorld) * normal; vRight = vec3(1., 0., 0.);
  }
  vWorld = p.xyz; vPart = color; vUv = uv; vSeed = worldHash(base.xz * .113 + 3.); vSpread = length(finalWorld[0].xyz) / length(finalWorld[1].xyz);
  gl_Position = viewProjection * p;
}`;

const treeFragment = grove => `#extension GL_OES_standard_derivatives : enable
precision highp float;
varying vec3 vWorld, vNormal, vRight; varying vec4 vPart; varying vec2 vUv; varying float vSeed, vSpread, vTreeClearance;
${grove ? 'varying float vRootY;' : ''}
uniform vec3 eye, sun, sunColor, skyAmbient, groundAmbient, shadowTint, fogNear, fogFar, fogSun;
uniform vec3 leafTop, leafUnder, leafMid, leafHaze, leafBack, leafCrown, needleTop, needleUnder, bark;
uniform vec4 viewTarget;
vec3 leafShade;
uniform float sunStrength, shadowLift, fogDensity, fogHeight, time, goldenHour;
${WORLD_GLSL}
${grove ? GROVE_GLSL : ''}
${RIDGE_LIFT_GLSL}
vec3 treeAir(vec3 color) { return liftRidges(worldAir(color, vWorld, eye, sun, fogNear, fogFar, fogSun, fogDensity, fogHeight), vWorld.y, distance(eye, vWorld)); }
float leaves(vec2 uv, float seed) {
  vec2 g = uv * 7. + seed * 31.7, cell = floor(g - .5);
  float best = 0.;
  for (int i = 0; i <= 1; i++) for (int j = 0; j <= 1; j++) {
    vec2 c = cell + vec2(float(i), float(j)), centre = c + vec2(worldHash(c + 3.1), worldHash(c + 7.7)), d = g - centre, q = (centre - seed * 31.7) / 3.5 - 1.;
    float h = worldHash(c), a = h * 6.283, x = (cos(a) * d.x + sin(a) * d.y) / .8, y = -sin(a) * d.x + cos(a) * d.y;
    best = max(best, step(dot(q, q), .7) * step(x * x + y * y * 2.2, .55 + .25 * h) * (.88 + .12 * h));
  }
  return best;
}
void clump(vec2 c, vec2 centre, float radius, float seed, inout vec4 best) {
  float reach = radius * (.9 + .25) * sqrt(1. - max(best.x, 0.));
  if (length(c - centre) >= reach + length(vec2(.45))) return;
  vec2 off = c - centre - (vec2(worldHash(centre + seed), worldHash(centre.yx + seed)) - .5) * .9;
  if (dot(off, off) >= reach * reach) return;
  vec2 d = off / (radius * (.9 + .25 * worldNoise(c * 1.7 + seed * 19. + centre)));
  float h = 1. - dot(d, d);
  if (h > best.x) best = vec4(h, d, 0.);
}
vec3 foliage(vec3 n, vec3 v, float ao, float needle, float tint, float leaf, float facing, float card) {
  vec3 ambient = mix(groundAmbient, skyAmbient, n.y * .5 + .5), shade = shadowTint * shadowLift + ambient * .35, lit = sunColor * sunStrength;
  float soft = .45 - .3 * goldenHour, wrap = clamp((dot(n, sun) + soft) / (1. + soft), 0., 1.), light = wrap * mix(.4, 1., ao);
  vec3 top = mix(leafTop, needleTop, needle), under = mix(leafShade, needleUnder, needle);
  top = mix(top, top * vec3(1.12, 1.06, .78), tint * (1. - needle) * .6);
  top = mix(top, top * vec3(.8, .92, 1.04), smoothstep(.5, 1., fract(tint * 7.31)) * (1. - needle) * .8);
  float silhouette = max(pow(1. - abs(dot(v, n)), 1.2), smoothstep(.3, .9, n.y));
  top = mix(top, leafBack, goldenHour * light * sqrt(light) * (1. - needle * .5) * .75 * mix(1., silhouette, card));
  vec3 color = mix(under * (shade * 1.5 + .32), top * lit, light) * mix(.84, 1., clamp(n.y * .5 + .5, 0., 1.)) * mix(.78, 1., ao) * leaf;
  vec3 crown = mix(leafCrown, top * lit, needle * .5) * (top / max(mix(leafTop, needleTop, needle), vec3(.01)));
  color = mix(color, crown * leaf, smoothstep(.12, .75, n.y) * mix(.5, 1., ao) * (1. - light * (.6 + .3 * goldenHour)) * .9);
  float edge = pow(1. - abs(dot(v, n)), 3.);
  float through = pow(clamp(dot(-v, sun), 0., 1.), 4.) * (.3 + .7 * edge) * (1. - wrap * .5) * .6 * mix(.5, 1., ao);
  float rim = pow(1. - abs(dot(v, n)), 1.6) * smoothstep(.4, .9, dot(n, normalize(sun + vec3(0., 1., 0.)))) * .8 * facing;
  color = mix(color, leafBack * lit * leaf, rim) + leafBack * sunStrength * through * leaf * facing;
  return mix(color, leafBack * lit * leaf, goldenHour * clamp(through * edge * 3., 0., .7) * facing);
}
void main() {
  if (vTreeClearance > .5) discard;
  float part = vPart.b, needle = step(.37, part) * (1. - step(.62, part)) + step(.87, part);
  vec3 toEye = eye - vWorld; float dist = length(toEye); vec3 v = toEye / dist;
  leafShade = mix(mix(leafUnder, leafMid, smoothstep(130., 200., dist)), leafHaze, smoothstep(300., 500., dist));
  vec3 ambient = mix(groundAmbient, skyAmbient, .6), shade = shadowTint * shadowLift + ambient * .35, lit = sunColor * sunStrength;
  vec3 color;
  if (part < .12) {
    vec3 n = normalize(vNormal);
    vec3 woodShade = shade * 1.25, woodLight = lit;
    if (viewTarget.w > 0.) { woodShade += vec3(.22); woodLight += shade * .4; }
    ${grove ? `vec4 field = groveAt(vWorld.xz, 0.);
    field.r = mix(field.r, 1., smoothstep(2.5, 5.5, vWorld.y - vRootY));
    field.g = mix(1., field.g, 1. - smoothstep(.2, 1.5, vWorld.y - vRootY));
    color = groveLight(bark, n, field) * (.82 + .18 * vPart.r);` : 'color = bark * mix(woodShade, woodLight, clamp(dot(n, sun) * .5 + .5, 0., 1.) * vPart.r) * (.7 + .3 * vPart.r);'}
  } else if (part > .62) {
    vec2 c = vUv; float seed = vSeed * 7.31;
    vec3 facing = normalize(vNormal), n; float ao, h, underside = 1.;
    if (needle > .5) {
      float t = clamp((c.y - 1.8) / 12.4, 0., 1.), tier = fract(-t * 6.5 + seed), w = 3.5 * pow(1. - t, .95) * (.74 + .26 * tier) * (.92 + .16 * worldNoise(c * 2.3 + seed * 11.));
      float nx = c.x / max(w, .05); h = 1. - nx * nx;
      if (c.y < 1.8 || h < 0.) { if (abs(c.x) < .28 && c.y < 3.) { color = bark * shade * 1.3; gl_FragColor = vec4(treeAir(color), 1.); return; } discard; }
      n = normalize(vRight * nx * .85 + vec3(0., .25 + .45 * (1. - tier), 0.) + facing * sqrt(h));
      ao = clamp(.3 + .45 * sqrt(1. - h) + .25 * t + .2 * (1. - tier), 0., 1.);
    } else {
      vec4 best = vec4(-1.);
      bool spreading = abs(part - .81) < .03;
      float flip = fract(seed * .53) < .5 ? -1. : 1.; vec2 m = vec2(c.x * flip, c.y);
      if (spreading) {
        vec2 f = vec2(m.x, 6.6 + (m.y - 6.6) * 1.4);
        clump(f, vec2(-5.6, 6.3), 2.2 * (.75 + .5 * fract(seed * 1.7)), seed, best); clump(f, vec2(-2.9, 6.9), 2.6 * (.8 + .4 * fract(seed * 2.3)), seed, best); clump(f, vec2(0., 7.5), 2.8 * (.8 + .4 * fract(seed * 3.1)), seed, best);
        clump(f, vec2(2.9, 6.8), 2.6 * (.8 + .4 * fract(seed * 4.3)), seed, best); clump(f, vec2(5.7, 6.2), 2.1 * (.6 + .8 * fract(seed * 5.9)), seed, best);
        if (best.x < 0. && (c.y < 3. || c.y > 6.2 || min(abs(m.x - (c.y - 3.) * .9), abs(m.x + (c.y - 3.) * .8)) > .32 - c.y * .02) && (abs(c.x) > .5 - c.y * .03 || c.y > 3.4)) discard;
      } else if (vSpread > 1.2) {
        clump(m, vec2(-3.4, 6.), 2.1 * (.75 + .5 * fract(seed * 1.7)), seed, best); clump(m, vec2(-.9, 7.4), 2.6 * (.75 + .5 * fract(seed * 2.3)), seed, best); clump(m, vec2(2.1, 6.6), 2.4 * (.75 + .5 * fract(seed * 3.1)), seed, best); clump(m, vec2(3.9, 4.9), 1.5 * (.6 + .8 * fract(seed * 4.3)), seed, best);
        clump(m, vec2(-2.5, 3.), 2.6 * (.8 + .4 * fract(seed * 5.9)), seed, best); clump(m, vec2(1., 3.2), 2.9 * (.8 + .4 * fract(seed * 6.7)), seed, best); clump(m, vec2(3.6, 2.6), 1.8 * (.7 + .6 * fract(seed * 7.9)), seed, best);
        if (best.x < 0.) discard;
      } else {
        clump(m, vec2(0., 7.9), 2.7 * (.8 + .4 * fract(seed * 1.7)), seed, best); clump(m, vec2(-2.9, 6.3), 2.2 * (.7 + .6 * fract(seed * 2.3)), seed, best); clump(m, vec2(2.8, 6.5), 2.2 * (.7 + .6 * fract(seed * 3.1)), seed, best);
        clump(m, vec2(-1.4, 5.5), 2.3 * (.75 + .5 * fract(seed * 4.3)), seed, best); clump(m, vec2(1.5, 5.7), 2.3 * (.75 + .5 * fract(seed * 5.9)), seed, best); clump(m, vec2(.4, 9.3), 1.7 * (.5 + fract(seed * 6.7)), seed, best);
      }
      h = best.x; best.y *= flip; underside = smoothstep(0., 2.6, c.y - (spreading ? 4.2 : vSpread > 1.2 ? .6 : 3.2) + best.z * 1.2);
      if (h < 0.) { if (spreading || (abs(c.x) < .42 - c.y * .03 && c.y < 4.6)) { color = bark * mix(shade * 1.25, lit, .25); gl_FragColor = vec4(treeAir(color), 1.); return; } discard; }
      vec2 dc = spreading ? (c - vec2(0., 6.9)) / vec2(8.2, 2.6) : (c - vec2(0., 6.6)) / 5.2;
      vec3 local = normalize(normalize(vec3(dc, sqrt(max(1. - dot(dc, dc), .05)))) * .55 + normalize(vec3(best.yz, sqrt(h))) * .45);
      n = normalize(vRight * local.x + vec3(0., local.y, 0.) + facing * local.z);
      ao = clamp(.16 + .64 * (spreading ? smoothstep(4.6, 8.8, c.y) : smoothstep(3.5, 9.8, c.y)) + .28 * sqrt(h), 0., 1.);
    }
    vec2 turned = mat2(.8, -.6, .6, .8) * c;
    float mottle = dist < 1100. ? mix(.86 + .2 * worldNoise(turned * 1.7 + seed * 7.) + .1 * worldNoise(turned * 4.1 - seed * 3.), 1., smoothstep(350., 1100., dist)) : 1.;
    color = foliage(n, v, ao, needle, vSeed, mottle, 1., 0.);
    float back = pow(clamp(dot(-v, sun), 0., 1.), 2.), band = smoothstep(40., 180., dist) * (1. - smoothstep(900., 1600., dist));
    color = mix(color, leafBack * lit, back * band * .7 * (1. - sqrt(max(h, 0.))) * clamp(n.y + .4, 0., 1.));
    color *= mix(.6, 1., underside);
    vec3 field = mix(mix(leafHaze, needleUnder, needle) * (shade * 1.35 + .25), mix(leafCrown, needleTop * lit, needle), .32);
    color = mix(color, field, smoothstep(300., 1500., dist) * .8);
    color = mix(color, leafBack * lit, goldenHour * back * smoothstep(.2, .9, n.y) * (1. - sqrt(max(h, 0.))) * .9);
  } else {
    vec2 q = vUv * 2. - 1.; float body = 1. - dot(q, q), seed = vPart.a, leaf, facing = 1.;
    if (needle > .5) {
      float tooth = abs(fract(vUv.x * 3. + seed * 7.) - .5) * 2., ragged = worldNoise(vec2(vUv.x * 9., seed * 11.));
      if (vUv.y > .72 + .28 * (1. - tooth) * (.6 + .4 * ragged)) discard;
      leaf = .76 + .24 * worldNoise(vec2(vUv.x * 30., vUv.y * 5. + seed * 3.));
    } else if (part < .2) {
      leaf = .72 + .2 * worldNoise(vWorld.xz * 1.1 + vWorld.y * .7);
    } else {
      facing = abs(dot(normalize(cross(dFdx(vWorld), dFdy(vWorld))), v));
      if (facing < .18) discard;
      facing = smoothstep(.18, .5, facing);
      if (dist > mix(75., 110., seed)) {
        if (body + (worldNoise(vUv * 3.5 + seed * 17.) - .5) * .8 + (worldNoise(vUv * 9. + seed * 5.) - .5) * .3 < .3) discard;
        leaf = .92;
      } else {
        leaf = leaves(vUv, seed);
        if (leaf <= 0. && body < .62) discard;
        if (leaf <= 0.) leaf = .84;
      }
    }
    color = foliage(normalize(vNormal), v, vPart.r, needle, vSeed, leaf, facing, step(.2, part) * (1. - needle));
  }
  ${grove ? `if (part >= .12) {
    float shelter = (1. - groveAt(vWorld.xz, 0.).b) * (1. - smoothstep(4., 14., vWorld.y - vRootY));
    color *= mix(vec3(1.), vec3(.60, .73, .81), shelter);
    color = mix(color, mix(leafHaze, skyAmbient, .38), smoothstep(24., 105., dist) * .18);
  }` : ''}
  gl_FragColor = vec4(treeAir(color), 1.);
}`;

export const treeModel = (form, style) => style === 'woodland' ? WOODLAND_MODELS[form]() : TREE_KINDS[form].near();
export const farTreeModel = (form, style) => style === 'woodland' && form !== TREE_FORMS.conifer ? woodlandFar(form === TREE_FORMS.spreading) : TREE_KINDS[form].far();

export function createTreePaint(scene, { name = 'world-trees-paint', still, connectedClearance = false, grove }) {
  const paint = new ShaderMaterial(name, scene, { vertexSource: treeVertex(grove), fragmentSource: treeFragment(grove) }, {
    attributes: ['position', 'normal', 'color', 'uv', ...(connectedClearance ? ['treeTrunk', 'treeCrown'] : [])],
    defines: connectedClearance ? ['TREE_CONNECTED_CLEARANCE'] : [],
    uniforms: ['world', 'viewProjection', ...AIR_UNIFORMS, ...RIDGE_UNIFORMS, 'sunStrength', 'shadowLift', 'goldenHour', 'viewTarget', ...LIGHT_COLORS, ...FOLIAGE_COLORS, ...(grove ? GROVE_UNIFORMS : [])],
    ...(grove ? { samplers: ['groveField'] } : {}),
  });
  paint.backFaceCulling = false;
  const target = new Vector4(0, 0, 0, 0); paint.setVector4('viewTarget', target);
  grove?.bind(paint);
  followEye(scene, paint, still);
  return {
    paint,
    setViewTarget(x, y, z, radius = 0) { target.set(x, y, z, Math.max(0, radius)); paint.setVector4('viewTarget', target); },
    setTheme(atmosphere) {
      applyAir(paint, atmosphere); applyRidges(paint, atmosphere);
      for (const key of [...FOLIAGE_COLORS, ...LIGHT_COLORS]) paint.setColor3(key, Color3.FromHexString(atmosphere[key]));
      paint.setFloat('sunStrength', atmosphere.sunStrength); paint.setFloat('shadowLift', atmosphere.shadowLift); paint.setFloat('goldenHour', atmosphere.goldenHour);
    },
  };
}

export function createWorldTrees(scene, { root, still, rings, definition, surface, grove }) {
  const planted = definition ? plantDefinitionTrees(rings, definition) : plantTrees(rings);
  const { paint, setTheme, setViewTarget } = createTreePaint(scene, { still, connectedClearance: true, grove });
  const matrices = new Float32Array(planted.count * 16);
  for (let i = 0; i < planted.count; i++) {
    const w = planted.width[i], c = Math.cos(planted.turn[i]) * w, s = Math.sin(planted.turn[i]) * w;
    matrices.set([c, 0, -s, 0, 0, planted.height[i], 0, 0, s, 0, c, 0, planted.x[i], planted.y[i], planted.z[i], 1], i * 16);
  }
  const tiers = TREE_KINDS.flatMap(({ name }, kind) => {
    const total = planted.kind.reduce((sum, k) => sum + (k === kind ? 1 : 0), 0);
    return ['near', 'far'].map(tier => {
      const mesh = new Mesh(`world-trees-${name}-${tier}`, scene);
      const data = tier === 'near' ? treeModel(kind, definition?.trees.style) : farTreeModel(kind, definition?.trees.style);
      Object.assign(new VertexData(), data).applyToMesh(mesh);
      mesh.setVerticesData('treeTrunk', data.treeTrunk, false, 4); mesh.setVerticesData('treeCrown', data.treeCrown, false, 4);
      mesh.material = paint; mesh.parent = root; mesh.isPickable = false; mesh.alwaysSelectAsActiveMesh = true; mesh.metadata = { castShadow: false, world: true };
      const buffer = new Float32Array(Math.max(1, total) * 16);
      mesh.thinInstanceSetBuffer('matrix', buffer, 16, false);
      return { mesh, buffer, count: 0 };
    });
  });
  const centre = new Vector3(Infinity, 0, Infinity), local = new Vector3(), inverse = new Matrix();
  function sortAround(x, z) {
    centre.set(x, 0, z);
    for (const tier of tiers) tier.count = 0;
    for (let i = 0; i < planted.count; i++) {
      const near = (planted.x[i] - x) ** 2 + (planted.z[i] - z) ** 2 < (definition?.trees.near ?? NEAR_TREES) ** 2, tier = tiers[planted.kind[i] * 2 + (near ? 0 : 1)];
      for (let k = 0; k < 16; k++) tier.buffer[tier.count * 16 + k] = matrices[i * 16 + k];
      tier.count++;
    }
    for (const tier of tiers) {
      tier.mesh.thinInstanceCount = tier.count; tier.mesh.setEnabled(tier.count > 0);
      if (tier.count) tier.mesh.thinInstanceBufferUpdated('matrix');
    }
  }
  const watch = scene.onBeforeRenderObservable.add(() => {
    const camera = scene.activeCamera; if (!camera) return;
    root.computeWorldMatrix().invertToRef(inverse); Vector3.TransformCoordinatesToRef(camera.globalPosition, inverse, local);
    if ((local.x - centre.x) ** 2 + (local.z - centre.z) ** 2 > 15 * 15) sortAround(local.x, local.z);
  });
  paint.onDisposeObservable.add(() => scene.onBeforeRenderObservable.remove(watch));
  sortAround(0, 0);
  return {
    planted, paint, meshes: tiers.map(tier => tier.mesh), setTheme, setViewTarget,
    refresh() {
      if (!surface) return;
      for (let i = 0; i < planted.count; i++) {
        const at = surface(planted.x[i], planted.z[i]);
        if (at) { planted.y[i] = at.height - 0.5 * planted.width[i]; matrices[i * 16 + 13] = planted.y[i]; }
      }
      sortAround(centre.x, centre.z);
    },
  };
}
