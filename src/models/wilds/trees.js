import { BufferAttribute, BufferGeometry, Color, CylinderGeometry, Euler, Group, IcosahedronGeometry, InstancedMesh, Matrix4, PlaneGeometry, Quaternion, ShaderMaterial, Vector3 } from 'three';
import { part, merge } from './shapes.js';

const BARK = Object.freeze({ oak: '#5f4532', beech: '#8a8576', pine: '#5b4a3e', birch: '#e7e1d3' });
const LEAF = Object.freeze({ oak: ['#3f6d2f', '#7aa843'], beech: ['#4f7d32', '#93b84e'], pine: ['#2b5236', '#55854a'], birch: ['#7aa443', '#bcd46e'] });
const leafShade = (low, high) => y => 0.78 + Math.min(1, Math.max(0, (y - low) / (high - low))) * 0.38;
const hash = (i, k) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;

export const CARD = Object.freeze({ core: 0.82, lift: 0.95, blend: 0.55, leaves: 5 });
export const NEEDLES = Object.freeze({ size: 0.62, farSize: 1.05, fringe: 2, top: 1, sprigs: 7, blend: 0.4, core: 0.85 });

function build(positions, normals, colours, cards) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colours), 3));
  geometry.setAttribute('card', new BufferAttribute(new Float32Array(cards), 4));
  return geometry;
}

export function canopy([dark, light], list, { detail, cards, size }) {
  const low = Math.min(...list.map(([, y, , r]) => y - r)), high = Math.max(...list.map(([, y, , r]) => y + r)), shade = leafShade(low, high);
  const weight = list.reduce((sum, [, , , r]) => sum + r ** 3, 0), centre = new Vector3(...[0, 1, 2].map(axis => list.reduce((sum, blob) => sum + blob[axis] * blob[3] ** 3, 0) / weight));
  const area = list.reduce((sum, [, , , r]) => sum + r * r, 0), positions = [], normals = [], colours = [], attributes = [], tone = new Color(), spot = new Vector3(), own = new Vector3(), whole = new Vector3();
  const lean = (point, middle) => own.copy(point).sub(middle).normalize().lerp(whole.copy(point).sub(centre).normalize(), CARD.blend).normalize();
  list.forEach(([x, y, z, r, squash = 0.85], b) => {
    const middle = new Vector3(x, y, z), core = new IcosahedronGeometry(r * CARD.core, detail).toNonIndexed(), points = core.attributes.position;
    for (let v = 0; v < points.count; v++) {
      spot.set(points.getX(v), points.getY(v) * squash, points.getZ(v)).add(middle);
      positions.push(spot.x, spot.y, spot.z);
      const n = lean(spot, middle); normals.push(n.x, n.y, n.z);
      tone.set(b % 3 === 2 ? light : dark).multiplyScalar(shade(spot.y) * 0.74);
      colours.push(tone.r, tone.g, tone.b); attributes.push(0, 0, 0, 0);
    }
    core.dispose();
    const count = Math.max(4, Math.round(cards * r * r / area));
    for (let c = 0; c < count; c++) {
      const seed = b * 97 + c * 13 + 1, u = hash(seed, 1) * Math.PI * 2, h = 1 - Math.pow(hash(seed, 2), 0.75) * 1.7, ring = Math.sqrt(Math.max(0, 1 - h * h)), out = r * (CARD.lift + hash(seed, 3) * 0.14);
      spot.set(Math.cos(u) * ring * out, h * out * squash, Math.sin(u) * ring * out).add(middle);
      const n = lean(spot, middle), half = size * (0.8 + hash(seed, 4) * 0.45), height = (spot.y - low) / (high - low);
      tone.set(dark).lerp(new Color(light), Math.min(1, Math.max(0, height * 0.9 + (hash(seed, 5) - 0.4) * 0.5))).multiplyScalar(shade(spot.y) * (0.9 + n.y * 0.08));
      for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) {
        positions.push(spot.x, spot.y, spot.z); normals.push(n.x, n.y, n.z); colours.push(tone.r, tone.g, tone.b);
        attributes.push(cx, cy, half, 0.05 + hash(seed, 6) * 0.95);
      }
    }
  });
  return build(positions, normals, colours, attributes);
}

function tier(y, radius, height, points, droop, turn) {
  const [dark, light] = LEAF.pine, positions = [], normals = [], colours = [], top = new Color(light).lerp(new Color(dark), 0.25).multiplyScalar(NEEDLES.core), tip = new Color(light).multiplyScalar(NEEDLES.core), valley = new Color(dark).multiplyScalar(NEEDLES.core), under = new Color(dark).multiplyScalar(0.62);
  const ring = Array.from({ length: points * 2 }, (_, k) => {
    const a = k / (points * 2) * Math.PI * 2 + turn, sharp = k % 2 === 0, r = sharp ? radius * (0.86 + hash(k + turn * 31, 7) * 0.28) : radius * 0.52;
    return { at: [Math.cos(a) * r, sharp ? y - droop * (0.8 + hash(k + turn * 31, 8) * 0.4) : y + height * 0.14, Math.sin(a) * r], colour: sharp ? tip : valley };
  });
  const apex = [0, y + height, 0], hub = [0, y + height * 0.2, 0], push = (at, normal, colour) => { positions.push(...at); normals.push(...normal); colours.push(colour.r, colour.g, colour.b); };
  const outward = (at, up) => { const n = new Vector3(at[0], up, at[2]).normalize(); return [n.x, n.y, n.z]; };
  ring.forEach((corner, k) => {
    const next = ring[(k + 1) % ring.length], mid = [(corner.at[0] + next.at[0]) / 2, 0, (corner.at[2] + next.at[2]) / 2];
    push(apex, outward(mid, radius * 1.4), top); push(next.at, outward(next.at, radius * 0.55), next.colour); push(corner.at, outward(corner.at, radius * 0.55), corner.colour);
    push(hub, outward(mid, -radius * 0.1), under); push(corner.at, outward(corner.at, -radius * 0.05), under); push(next.at, outward(next.at, -radius * 0.05), under);
  });
  return build(positions, normals, colours, new Array(positions.length / 3 * 4).fill(0));
}

function needles(list, { points, size }) {
  const [dark, light] = LEAF.pine, positions = [], normals = [], colours = [], cards = [], tone = new Color(), spot = new Vector3(), normal = new Vector3(), whole = new Vector3();
  const low = list[0][0] - list[0][1] * 0.32, high = list.at(-1)[0] + list.at(-1)[2], middle = new Vector3(0, (low + high) / 2, 0);
  list.forEach(([y, r, h], t) => {
    const turn = t * 1.7, count = points * NEEDLES.fringe + Math.round(points * NEEDLES.top * r / list[0][1]);
    for (let c = 0; c < count; c++) {
      const seed = t * 131 + c * 17 + 3, fringe = c < points * NEEDLES.fringe, k = c % points;
      const a = fringe ? (k * 2 + (c >= points ? 1 : 0)) / (points * 2) * Math.PI * 2 + turn + (hash(seed, 1) - 0.5) * 0.25 : hash(seed, 1) * Math.PI * 2;
      const out = fringe ? 0.88 + hash(seed, 2) * 0.16 : 0.45 + hash(seed, 2) * 0.35, drop = fringe ? r * 0.32 * (c < points ? 1 : 0.55) : 0;
      spot.set(Math.cos(a) * r * out, fringe ? y - drop + size * 0.35 : y + h * Math.pow(1 - out, 1.3) - r * 0.32 * out * out + 0.05, Math.sin(a) * r * out);
      normal.set(Math.cos(a), 0.5 + (1 - out) * 0.6, Math.sin(a)).normalize().lerp(whole.copy(spot).sub(middle).normalize(), NEEDLES.blend).normalize();
      const height = (spot.y - low) / (high - low), half = size * (0.8 + hash(seed, 3) * 0.4) * (0.65 + r / list[0][1] * 0.35);
      tone.set(dark).lerp(new Color(light), Math.min(1, Math.max(0, (fringe ? 0.55 : 0.25) + height * 0.35 + (hash(seed, 4) - 0.5) * 0.3))).multiplyScalar(0.85 + height * 0.25);
      for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) {
        positions.push(spot.x, spot.y, spot.z); normals.push(normal.x, normal.y, normal.z); colours.push(tone.r, tone.g, tone.b);
        cards.push(cx, cy, half, 1.05 + hash(seed, 5) * 0.9);
      }
    }
  });
  return build(positions, normals, colours, cards);
}

const plain = geometry => {
  geometry.deleteAttribute('uv');
  geometry.setAttribute('card', new BufferAttribute(new Float32Array(geometry.attributes.position.count * 4), 4));
  return geometry;
};

export const ROOTS = Object.freeze({ dark: 0.58, rise: 0.9, spread: 1.7, opacity: 0.42, tint: '#1c2614' });
const rootShade = y => ROOTS.dark + (1 - ROOTS.dark) * Math.min(1, Math.max(0, (y + 0.3) / ROOTS.rise));

function trunk(kind, height, base, top, sides) {
  const bark = kind === 'birch' ? y => (Math.sin(y * 9.3) > 0.82 ? 0.35 : 1) : y => 0.85 + (y / height) * 0.2;
  return plain(part(new CylinderGeometry(top, base, height, sides, 6), BARK[kind], { position: [0, height / 2 - 0.3, 0], shade: (_, y) => bark(y) * rootShade(y) }));
}

function roots(trees, ground) {
  const material = new ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    uniforms: { tint: { value: new Color(ROOTS.tint) } },
    vertexShader: `varying vec2 vSpot;
void main() { vSpot = position.xz; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 tint; varying vec2 vSpot;
void main() { float r = dot(vSpot, vSpot); if (r > 1.0) discard; float fall = 1.0 - r; gl_FragColor = vec4(tint, fall * fall * ${ROOTS.opacity.toFixed(2)}); }`,
  });
  const mesh = new InstancedMesh(new PlaneGeometry(2, 2).rotateX(-Math.PI / 2), material, trees.length), matrix = new Matrix4(), tilt = new Quaternion(), at = new Vector3(), size = new Vector3(), up = new Vector3(0, 1, 0), normal = new Vector3();
  trees.forEach((tree, i) => {
    normal.set(ground(tree.x - 1, tree.z) - ground(tree.x + 1, tree.z), 2, ground(tree.x, tree.z - 1) - ground(tree.x, tree.z + 1)).normalize();
    const spread = ROOTS.spread * tree.scale * (tree.kind === 'pine' ? 0.85 : 1);
    mesh.setMatrixAt(i, matrix.compose(at.set(tree.x, ground(tree.x, tree.z) + 0.04, tree.z), tilt.setFromUnitVectors(up, normal), size.set(spread, 1, spread)));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.renderOrder = 1; mesh.name = 'wilds-tree-roots';
  return mesh;
}

function branch(kind, from, to, radius) {
  const dir = new Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]), length = dir.length();
  const tilt = new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize()));
  return plain(part(new CylinderGeometry(radius * 0.6, radius, length, 5), BARK[kind], { position: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2], rotation: [tilt.x, tilt.y, tilt.z] }));
}

const PINE = Object.freeze({
  near: Object.freeze([[1.7, 2.8, 2.4], [3.3, 2.5, 2.4], [4.9, 2.15, 2.3], [6.4, 1.8, 2.2], [7.8, 1.4, 2], [9.1, 1, 1.8], [10.2, 0.6, 1.6]]),
  far: Object.freeze([[2, 2.8, 3.4], [4.8, 2.2, 3.2], [7.4, 1.5, 2.8], [9.6, 0.8, 2.2]]),
});

const SHAPES = Object.freeze({
  oak: detail => detail ? merge([
    trunk('oak', 4.6, 0.42, 0.26, 8), branch('oak', [0, 3.6, 0], [1.4, 5.4, 0.3], 0.16), branch('oak', [0, 3.8, 0], [-1.2, 5.6, -0.6], 0.15),
    canopy(LEAF.oak, [[0, 6.4, 0, 2.6], [1.7, 5.8, 0.6, 2], [-1.6, 5.9, -0.7, 2.1], [0.4, 7.6, -0.9, 1.9], [-0.6, 7.4, 1.1, 1.8], [0.9, 5.2, -1.5, 1.6]], { detail: 1, cards: 150, size: 0.62 }),
  ]) : merge([trunk('oak', 4.6, 0.42, 0.26, 5), canopy(LEAF.oak, [[0, 6.6, 0, 3.1, 0.8]], { detail: 0, cards: 26, size: 1 })]),
  beech: detail => detail ? merge([
    trunk('beech', 6, 0.34, 0.2, 8), branch('beech', [0, 4.8, 0], [1, 6.6, 0.4], 0.12),
    canopy(LEAF.beech, [[0, 7.6, 0, 2.3, 1.05], [0.9, 6.4, 0.5, 1.9], [-1, 6.6, -0.4, 1.9], [0.2, 9.1, -0.3, 1.6], [-0.5, 8.4, 0.9, 1.5]], { detail: 1, cards: 130, size: 0.56 }),
  ]) : merge([trunk('beech', 6, 0.34, 0.2, 5), canopy(LEAF.beech, [[0, 7.8, 0, 2.6, 1.2]], { detail: 0, cards: 24, size: 0.9 })]),
  pine: detail => merge([
    trunk('pine', detail ? 9 : 8, 0.3, 0.12, detail ? 7 : 5),
    ...PINE[detail ? 'near' : 'far'].map(([y, r, h], i) => tier(y, r, h, detail ? 9 : 7, r * 0.32, i * 1.7)),
    needles(PINE[detail ? 'near' : 'far'], { points: detail ? 9 : 7, size: detail ? NEEDLES.size : NEEDLES.farSize }),
  ]),
  birch: detail => detail ? merge([
    trunk('birch', 6.2, 0.2, 0.12, 7), branch('birch', [0, 4.2, 0], [0.8, 5.6, 0.2], 0.07),
    canopy(LEAF.birch, [[0.2, 6.6, 0, 1.6, 1.2], [-0.6, 5.6, 0.4, 1.3], [0.7, 5.4, -0.4, 1.2], [0, 7.8, 0.2, 1.1]], { detail: 1, cards: 90, size: 0.42 }),
  ]) : merge([trunk('birch', 6.2, 0.2, 0.12, 5), canopy(LEAF.birch, [[0, 6.6, 0, 1.9, 1.3]], { detail: 0, cards: 20, size: 0.7 })]),
});

const CLOSE = Object.freeze({ gone: 1.4, whole: 3.6 });

export function addSway(material, wind, { from = 2.5, amount = 0.012, key = 'wilds-trees' } = {}) {
  const before = material.onBeforeCompile;
  material.onBeforeCompile = shader => {
    before?.(shader);
    shader.uniforms.windTime = wind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float windTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vec3 rootAt = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
float bend = max(0.0, position.y - ${from.toFixed(2)});
float gust = sin(windTime * 1.1 + rootAt.x * 0.13 + rootAt.z * 0.11) * 0.7 + sin(windTime * 2.3 + rootAt.z * 0.31) * 0.3;
transformed.x += gust * bend * ${amount.toFixed(4)};
transformed.z += gust * bend * ${(amount / 2).toFixed(4)};`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
if (smoothstep(${CLOSE.gone.toFixed(2)}, ${CLOSE.whole.toFixed(2)}, length(vViewPosition)) < fract(dot(floor(gl_FragCoord.xy), vec2(0.7548777, 0.5698403)))) discard;`);
  };
  material.customProgramCacheKey = () => key;
  return material;
}

function addLeaves(material) {
  const before = material.onBeforeCompile;
  material.onBeforeCompile = shader => {
    before?.(shader);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 card;\nvarying vec4 vCard;')
      .replace('#include <project_vertex>', `#include <project_vertex>
vCard = card;
float spin = (card.w > 1.0 ? 0.0 : card.w * 6.2832) + sin(windTime * 1.7 + card.w * 40.0) * 0.12;
mvPosition.xy += mat2(cos(spin), sin(spin), -sin(spin), cos(spin)) * card.xy * card.z * length(instanceMatrix[0].xyz);
gl_Position = projectionMatrix * mvPosition;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vCard;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
if (vCard.w > 1.0) {
  vec2 stem = vCard.xy * 1.05 - vec2(0.0, 0.95);
  float sprig = 0.0;
  for (int k = 0; k < ${NEEDLES.sprigs}; k++) {
    float angle = (float(k) - ${((NEEDLES.sprigs - 1) / 2).toFixed(1)}) * 0.3 + (fract(vCard.w * (5.31 + float(k) * 2.7)) - 0.5) * 0.3;
    vec2 along = vec2(sin(angle), -cos(angle));
    float t = dot(stem, along) / (1.35 + fract(vCard.w * (2.9 + float(k) * 1.9)) * 0.55), side = abs(dot(stem, vec2(along.y, -along.x)));
    sprig = max(sprig, step(0.0, t) * step(t, 1.0) * step(side, 0.15 * (1.0 - t) + 0.02));
  }
  if (sprig < 0.5) discard;
} else if (vCard.w > 0.0) {
  vec2 stem = vCard.xy * 1.08 - vec2(0.0, -0.92);
  float leafy = 0.0;
  for (int k = 0; k < ${CARD.leaves}; k++) {
    float angle = (float(k) - ${((CARD.leaves - 1) / 2).toFixed(1)}) * 0.42 + (fract(vCard.w * (7.13 + float(k) * 3.1)) - 0.5) * 0.35;
    vec2 along = vec2(sin(angle), cos(angle));
    float t = dot(stem, along) / (1.45 + fract(vCard.w * (3.7 + float(k) * 1.3)) * 0.4), side = abs(dot(stem, vec2(along.y, -along.x)));
    leafy = max(leafy, step(0.0, t) * step(t, 1.0) * step(side, 0.34 * sin(3.1416 * clamp(t, 0.0, 1.0)) * (1.0 - t * 0.35)));
  }
  if (leafy < 0.5) discard;
}`);
  };
  return material;
}

export const leafyMaterial = (painterly, wind) => addLeaves(addSway(painterly.material('#ffffff', { vertexColors: true, rim: false }), wind));

export function buildTrees(trees, painterly, { wind, ground, near = () => true }) {
  const root = new Group(), material = leafyMaterial(painterly, wind);
  root.name = 'wilds-trees';
  const matrix = new Matrix4(), turn = new Quaternion(), lean = new Quaternion(), at = new Vector3(), size = new Vector3(), tint = new Color(), axis = new Vector3();
  for (const kind of Object.keys(SHAPES)) for (const detail of [true, false]) {
    const chosen = trees.filter(tree => tree.kind === kind && near(tree) === detail);
    if (!chosen.length) continue;
    const mesh = new InstancedMesh(SHAPES[kind](detail), material, chosen.length);
    chosen.forEach((tree, i) => {
      turn.setFromAxisAngle(axis.set(0, 1, 0), tree.turn);
      lean.setFromAxisAngle(axis.set(Math.cos(tree.turn), 0, Math.sin(tree.turn)), tree.lean);
      matrix.compose(at.set(tree.x, tree.y - 0.15, tree.z), lean.multiply(turn), size.setScalar(tree.scale));
      mesh.setMatrixAt(i, matrix);
      const roll = ((Math.sin(tree.x * 12.9898 + tree.z * 78.233) * 43758.5453) % 1 + 1) % 1;
      tint.setRGB(1, 1, 1).offsetHSL((roll - 0.5) * 0.05, 0, (roll - 0.5) * 0.12);
      if (kind === 'beech' && roll > 0.9) tint.setRGB(1.25, 1.02, 0.62);
      mesh.setColorAt(i, tint);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = detail; mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    mesh.name = `wilds-trees-${kind}-${detail ? 'near' : 'far'}`;
    root.add(mesh);
  }
  root.add(roots(trees.filter(near), ground));
  return root;
}
