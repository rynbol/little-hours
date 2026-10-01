import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';
import { Vector4 } from '@babylonjs/core/Maths/math.vector.js';
import { heightAt, WORLD } from '../../core/world-terrain.js';
import { TERRAIN_RINGS } from './terrain-mesh.js';
import { GROUND_GLSL, GROUND_UNIFORMS, applyGround } from './terrain-paint.js';
import { followEye } from './world-glsl.js';
import { createWorldRocks, MEADOW_ROCKS, rockClearings } from './rocks.js';

export const GRASS = Object.freeze({
  layers: Object.freeze([
    Object.freeze({ period: 16, blades: 12000, reach: 8, width: 0.022, height: 0.55 }),
    Object.freeze({ period: 48, blades: 20000, reach: 24, width: 0.04, height: 0.52 }),
    Object.freeze({ period: 128, blades: 40000, reach: 64, width: 0.09, height: 0.56 }),
  ]),
  step: 2, texels: 69, recentre: 8,
  clearing: Object.freeze({ halfWidth: 6.6, halfDepth: 5.2 }),
});

export function surfaceAt(x, z, rings = TERRAIN_RINGS) {
  const ring = rings.find(({ radius }) => Math.abs(x) <= radius && Math.abs(z) <= radius) ?? rings[rings.length - 1], s = ring.step;
  const x0 = Math.floor(x / s) * s, z0 = Math.floor(z / s) * s, fx = (x - x0) / s, fz = (z - z0) / s;
  if (fx === 0 && fz === 0) return heightAt(x, z);
  if (fx + fz <= 1) { const a = heightAt(x0, z0); return a + (heightAt(x0 + s, z0) - a) * fx + (heightAt(x0, z0 + s) - a) * fz; }
  const d = heightAt(x0 + s, z0 + s);
  return d + (heightAt(x0, z0 + s) - d) * (1 - fx) + (heightAt(x0 + s, z0) - d) * (1 - fz);
}

export function createGroundGrid({ texels, step }) {
  const data = new Float32Array(texels * texels * 4);
  let heights = new Float32Array(texels * texels), spare = new Float32Array(texels * texels), originX = NaN, originZ = NaN;
  const at = (i, j) => heights[Math.min(texels - 1, Math.max(0, j)) * texels + Math.min(texels - 1, Math.max(0, i))];
  function centre(x, z) {
    const nextX = Math.round(x / step) - (texels - 1) / 2, nextZ = Math.round(z / step) - (texels - 1) / 2;
    if (nextX === originX && nextZ === originZ) return false;
    for (let j = 0; j < texels; j++) for (let i = 0; i < texels; i++) {
      const oldI = nextX + i - originX, oldJ = nextZ + j - originZ, kept = oldI >= 0 && oldI < texels && oldJ >= 0 && oldJ < texels;
      spare[j * texels + i] = kept ? heights[oldJ * texels + oldI] : surfaceAt((nextX + i) * step, (nextZ + j) * step);
    }
    [heights, spare] = [spare, heights]; originX = nextX; originZ = nextZ;
    for (let j = 0; j < texels; j++) for (let i = 0; i < texels; i++) {
      const dx = at(i + 1, j) - at(i - 1, j), dz = at(i, j + 1) - at(i, j - 1), length = Math.hypot(dx, 2 * step, dz), v = (j * texels + i) * 4;
      data[v] = -dx / length; data[v + 1] = 2 * step / length; data[v + 2] = -dz / length; data[v + 3] = heights[j * texels + i];
    }
    return true;
  }
  return { data, centre, get origin() { return [originX * step, originZ * step]; } };
}

function seeded(seed) {
  let state = seed >>> 0;
  return () => { state = (state + 0x6d2b79f5) >>> 0; let t = Math.imul(state ^ (state >>> 15), 1 | state); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const BLADE_ROWS = Object.freeze([[-1, 0], [1, 0], [-0.62, 0.5], [0.62, 0.5], [0, 1]]);

export function grassBlades(layers = GRASS.layers) {
  const total = layers.reduce((sum, layer) => sum + layer.blades, 0), random = seeded(29);
  const positions = new Float32Array(total * 15), blade = new Float32Array(total * 20), indices = new Uint32Array(total * 9);
  let b = 0;
  layers.forEach(({ period, blades }, layer) => {
    const spots = Array.from({ length: blades }, () => [random() * period, random() * period, random(), random()]).sort((p, q) => (Math.floor(p[1] / 2) - Math.floor(q[1] / 2)) || (p[0] - q[0]));
    for (const [x, z, rank, seed] of spots) {
      BLADE_ROWS.forEach(([side, t], r) => { positions.set([x, t, z], (b * 5 + r) * 3); blade.set([side, rank, seed, layer], (b * 5 + r) * 4); });
      const v = b * 5; indices.set([v, v + 1, v + 2, v + 2, v + 1, v + 3, v + 2, v + 3, v + 4], b * 9);
      b++;
    }
  });
  return { positions, blade, indices };
}

const perLayer = key => `(blade.w < .5 ? ${GRASS.layers[0][key].toFixed(3)} : blade.w < 1.5 ? ${GRASS.layers[1][key].toFixed(3)} : ${GRASS.layers[2][key].toFixed(3)})`;

const GRASS_VERTEX = `precision highp float;
attribute vec3 position; attribute vec4 blade;
uniform mat4 world, viewProjection; uniform sampler2D ground; uniform vec4 groundGrid, stones[${MEADOW_ROCKS.length}];
varying vec3 vColor;
${GROUND_GLSL}
vec4 groundAt(vec2 p) {
  vec2 g = (p - groundGrid.xy) / groundGrid.w, i = floor(g), f = g - i; float n = groundGrid.z;
  vec4 a = texture2D(ground, (i + .5) / n), b = texture2D(ground, (i + vec2(1.5, .5)) / n), c = texture2D(ground, (i + vec2(.5, 1.5)) / n), d = texture2D(ground, (i + 1.5) / n);
  float h = f.x + f.y <= 1. ? a.w + (b.w - a.w) * f.x + (c.w - a.w) * f.y : d.w + (c.w - d.w) * (1. - f.x) + (b.w - d.w) * (1. - f.y);
  return vec4(normalize(mix(mix(a.xyz, b.xyz, f.x), mix(c.xyz, d.xyz, f.x), f.y)), h);
}
void main() {
  bool inner = blade.w < .5, last = blade.w > 1.5;
  float period = ${perLayer('period')}, reach = ${perLayer('reach')};
  vec2 base = position.xz + period * floor((eye.xz - position.xz) / period + .5);
  float dist = length(base - eye.xz), t = position.y, seed = blade.z;
  float keep = inner ? 1. - smoothstep(reach * .55, reach, dist) : 1. - smoothstep(reach * .45, reach, dist);
  float grow = clamp((keep - blade.y) * 5., 0., 1.);
  vec4 aim = viewProjection * world * vec4(base.x, eye.y - 1.5, base.y, 1.);
  if (keep <= blade.y || aim.w < -1. || abs(aim.x) > aim.w * 1.1 + 1.5) { vColor = vec3(0.); gl_Position = vec4(2., 2., 2., 1.); return; }
  vec4 surface = groundAt(base); vec3 n = surface.xyz;
  grow *= smoothstep(.76, .86, n.y) * smoothstep(${(WORLD.river.width * 0.8).toFixed(1)}, ${(WORLD.river.width * 1.1).toFixed(1)}, riverOffset(base)) * (1. - smoothstep(330., 380., surface.w));
  grow *= 1. - step(abs(base.x), ${GRASS.clearing.halfWidth.toFixed(2)}) * step(abs(base.y), ${GRASS.clearing.halfDepth.toFixed(2)});
  grow *= smoothstep(.55, 1.5, pathOffset(base));
  for (int i = 0; i < ${MEADOW_ROCKS.length}; i++) grow *= smoothstep(stones[i].z * .8, stones[i].z, distance(base, stones[i].xy));
  float clump = .55 + .9 * worldNoise(base / 1.9 + 3.7);
  float bloom = step(fract(seed * 91.7), smoothstep(.6, .78, worldNoise(base / 7. + 17.3)) * .3) * (1. - smoothstep(40., 55., dist));
  float height = ${perLayer('height')} * (.55 + .9 * seed) * mix(clump, 1.2, bloom) * grow, head = (.028 + .005 * dist) * grow;
  float width = mix(${perLayer('width')} * (.75 + .5 * fract(seed * 7.31)) * grow, head * (t < .25 ? .2 : .9), bloom);
  t = mix(t, 1. - head / max(height, .05) * (t < .25 ? 1. : t < .75 ? .5 : 0.), bloom);
  vec2 view = normalize(base - eye.xz + vec2(1e-3)), across = vec2(-view.y, view.x);
  float turn = seed * 43.7; vec2 face = normalize(mix(vec2(cos(turn), sin(turn)), across, mix(.6, 1., bloom)));
  float gust = groundGust(base), bend = t * t * height;
  float flutter = sin(time * 2.6 + seed * 31.) * gusts * .05;
  vec2 lean = vec2(cos(turn * 1.7), sin(turn * 1.7)) * .16 + windDir * (.34 + .34 * gust + flutter);
  vec2 xz = base + face * blade.x * width + lean * bend;
  vec3 p = vec3(xz.x, surface.w - .04 + t * height * (1. - .18 * dot(lean, lean) * t), xz.y);
  vec3 soil = groundAlbedo(base, surface.w, n, 0., dist).rgb, field = soil * mix(.84, 1.1, worldNoise(base / 2.7 + 9.1)) * (.94 + .12 * fract(seed * 13.7));
  vec3 tip = mix(field, grassTip, .45 + .55 * fract(seed * 5.3));
  vec3 color = t < .5 ? mix(field * vec3(.3, .42, .28), field, t / .5) : mix(field, tip, smoothstep(.5, 1., t));
  vec3 petal = fract(seed * 37.1) < .1 ? flowerLilac : worldNoise(base / 19. + 41.) < .42 ? flowerWhite : flowerYellow;
  color = mix(color, petal * (t < .85 ? .82 : 1.), bloom);
  color *= 1. + .1 * smoothstep(.7, 1., gust) * t;
  color = mix(color, soil, last ? smoothstep(reach * .7, reach * .98, dist) : 0.);
  vec4 worldPos = world * vec4(p, 1.);
  vec3 toward = normalize(worldPos.xyz - eye);
  color = color * groundLight(n, 0.) + sunColor * sunStrength * pow(max(dot(toward, sun), 0.), 3.) * t * t * .3 * soil;
  vColor = worldAir(color, worldPos.xyz, eye, sun, fogNear, fogFar, fogSun, fogDensity, fogHeight);
  gl_Position = viewProjection * worldPos;
}`;

const GRASS_FRAGMENT = `precision highp float;
varying vec3 vColor;
void main() { gl_FragColor = vec4(vColor, 1.); }`;

export function createWorldGrass(scene, { root, atmosphere, still }) {
  const paint = new ShaderMaterial('world-grass-paint', scene, { vertexSource: GRASS_VERTEX, fragmentSource: GRASS_FRAGMENT }, { attributes: ['position', 'blade'], uniforms: ['world', 'viewProjection', 'groundGrid', 'stones', ...GROUND_UNIFORMS], samplers: ['ground'] });
  paint.backFaceCulling = false;
  paint.setFloat('gusts', still ? 0 : 1);
  paint.setArray4('stones', rockClearings());
  followEye(scene, paint, still);
  const grid = createGroundGrid(GRASS), texture = new RawTexture(grid.data, GRASS.texels, GRASS.texels, Constants.TEXTUREFORMAT_RGBA, scene, false, false, Constants.TEXTURE_NEAREST_SAMPLINGMODE, Constants.TEXTURETYPE_FLOAT);
  texture.wrapU = texture.wrapV = Constants.TEXTURE_CLAMP_ADDRESSMODE;
  paint.setTexture('ground', texture);
  const gridUniform = new Vector4(0, 0, GRASS.texels, GRASS.step), half = (GRASS.texels - 1) / 2 * GRASS.step;
  function follow(x, z) {
    const [cx, cz] = grid.origin;
    if (Math.abs(x - cx - half) <= GRASS.recentre && Math.abs(z - cz - half) <= GRASS.recentre) return false;
    grid.centre(x, z); texture.update(grid.data);
    [gridUniform.x, gridUniform.y] = grid.origin; paint.setVector4('groundGrid', gridUniform);
    return true;
  }
  const { positions, blade, indices } = grassBlades();
  const mesh = new Mesh('world-grass', scene);
  Object.assign(new VertexData(), { positions, indices }).applyToMesh(mesh);
  mesh.setVerticesData('blade', blade, false, 4);
  mesh.material = paint; mesh.parent = root; mesh.isPickable = false; mesh.alwaysSelectAsActiveMesh = true; mesh.metadata = { castShadow: false, world: true };
  const camera = scene.activeCamera?.globalPosition;
  follow(camera?.x ?? 0, camera?.z ?? 0);
  const watch = scene.onBeforeRenderObservable.add(() => { const active = scene.activeCamera; if (active) follow(active.globalPosition.x, active.globalPosition.z); });
  mesh.onDisposeObservable.add(() => { scene.onBeforeRenderObservable.remove(watch); texture.dispose(); });
  applyGround(paint, atmosphere);
  const rocks = createWorldRocks(scene, { root, still });
  rocks.setTheme(atmosphere);
  return {
    mesh, rocks: rocks.mesh, follow,
    get origin() { return grid.origin; },
    setTheme: next => { applyGround(paint, next); rocks.setTheme(next); },
  };
}
