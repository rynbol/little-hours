import { Color, ConeGeometry, CylinderGeometry, Euler, Group, IcosahedronGeometry, InstancedMesh, Matrix4, PlaneGeometry, Quaternion, ShaderMaterial, Vector3 } from 'three';
import { part, merge } from './shapes.js';

const BARK = Object.freeze({ oak: '#5f4532', beech: '#8a8576', pine: '#6a4936', birch: '#e7e1d3' });
const LEAF = Object.freeze({ oak: ['#3f6d2f', '#6f9c3f'], beech: ['#4f7d32', '#86ad48'], pine: ['#2d5637', '#4a7b44'], birch: ['#7aa443', '#b3cf68'] });
const leafShade = (low, high) => (_, y) => 0.82 + Math.min(1, Math.max(0, (y - low) / (high - low))) * 0.32;

function blobs(kind, list, detail) {
  const [dark, light] = LEAF[kind], low = Math.min(...list.map(([, y, , r]) => y - r)), high = Math.max(...list.map(([, y, , r]) => y + r));
  return list.map(([x, y, z, r, squash = 0.85], i) => part(new IcosahedronGeometry(r, detail), i % 3 === 2 ? light : dark, { position: [x, y, z], scale: [1, squash, 1], rotation: [i, i * 2, 0], shade: leafShade(low, high) }));
}

export const ROOTS = Object.freeze({ dark: 0.58, rise: 0.9, spread: 1.7, opacity: 0.42, tint: '#1c2614' });
const rootShade = y => ROOTS.dark + (1 - ROOTS.dark) * Math.min(1, Math.max(0, (y + 0.3) / ROOTS.rise));

function trunk(kind, height, base, top, sides) {
  const bark = kind === 'birch' ? y => (Math.sin(y * 9.3) > 0.82 ? 0.35 : 1) : y => 0.85 + (y / height) * 0.2;
  return part(new CylinderGeometry(top, base, height, sides, 6), BARK[kind], { position: [0, height / 2 - 0.3, 0], shade: (_, y) => bark(y) * rootShade(y) });
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
  return part(new CylinderGeometry(radius * 0.6, radius, length, 5), BARK[kind], { position: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2], rotation: [tilt.x, tilt.y, tilt.z] });
}

const SHAPES = Object.freeze({
  oak: detail => detail ? merge([
    trunk('oak', 4.6, 0.42, 0.26, 8), branch('oak', [0, 3.6, 0], [1.4, 5.4, 0.3], 0.16), branch('oak', [0, 3.8, 0], [-1.2, 5.6, -0.6], 0.15),
    ...blobs('oak', [[0, 6.4, 0, 2.6], [1.7, 5.8, 0.6, 2], [-1.6, 5.9, -0.7, 2.1], [0.4, 7.6, -0.9, 1.9], [-0.6, 7.4, 1.1, 1.8], [0.9, 5.2, -1.5, 1.6]], 1),
  ]) : merge([trunk('oak', 4.6, 0.42, 0.26, 5), ...blobs('oak', [[0, 6.6, 0, 3.1, 0.8]], 0)]),
  beech: detail => detail ? merge([
    trunk('beech', 6, 0.34, 0.2, 8), branch('beech', [0, 4.8, 0], [1, 6.6, 0.4], 0.12),
    ...blobs('beech', [[0, 7.6, 0, 2.3, 1.05], [0.9, 6.4, 0.5, 1.9], [-1, 6.6, -0.4, 1.9], [0.2, 9.1, -0.3, 1.6], [-0.5, 8.4, 0.9, 1.5]], 1),
  ]) : merge([trunk('beech', 6, 0.34, 0.2, 5), ...blobs('beech', [[0, 7.8, 0, 2.6, 1.2]], 0)]),
  pine: detail => merge([
    trunk('pine', detail ? 9 : 8, 0.3, 0.12, detail ? 7 : 5),
    ...(detail ? [[3.4, 2.6, 3.2], [5.2, 2.1, 2.9], [7, 1.6, 2.5], [8.7, 1.1, 2.1], [10.2, 0.6, 1.6]] : [[3.4, 2.6, 4.6], [6.6, 1.7, 4.4], [9.4, 0.9, 3.2]]).map(([y, r, h], i) => part(new ConeGeometry(r, h, detail ? 9 : 6), LEAF.pine[i % 2], { position: [0, y + h / 2 - 0.4, 0], rotation: [0, i, 0], shade: (_, yy) => 0.78 + Math.min(1, Math.max(0, (yy - y + 0.4) / h)) * 0.35 })),
  ]),
  birch: detail => detail ? merge([
    trunk('birch', 6.2, 0.2, 0.12, 7), branch('birch', [0, 4.2, 0], [0.8, 5.6, 0.2], 0.07),
    ...blobs('birch', [[0.2, 6.6, 0, 1.6, 1.2], [-0.6, 5.6, 0.4, 1.3], [0.7, 5.4, -0.4, 1.2], [0, 7.8, 0.2, 1.1]], 1),
  ]) : merge([trunk('birch', 6.2, 0.2, 0.12, 5), ...blobs('birch', [[0, 6.6, 0, 1.9, 1.3]], 0)]),
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

export function buildTrees(trees, painterly, { wind, ground, near = () => true }) {
  const root = new Group(), material = addSway(painterly.material('#ffffff', { vertexColors: true }), wind);
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
