import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';
import { Vector4 } from '@babylonjs/core/Maths/math.vector.js';
import { GROUND_UNIFORMS, applyGround } from '../world/terrain-paint.js';
import { followEye } from '../world/world-glsl.js';
import { GRASS } from '../world/grass-blades.js';
import { MEADOW_ROCKS, rockClearings } from '../world/rocks.js';
import { WILDS_GROUND_GLSL } from './ground.js';
import { SHADOW_UNIFORMS, SHADOW_SAMPLERS } from './light.js';

export const WILDS_GRASS = Object.freeze({
  rings: Object.freeze([
    Object.freeze({ period: 28, reach: 14, density: 90 }),
    Object.freeze({ period: 80, reach: 40, density: 26 }),
    Object.freeze({ period: 190, reach: 95, density: 4.5 }),
  ]),
  blade: Object.freeze({ width: 0.03, height: 0.36, widenEvery: 9 }),
  field: Object.freeze({ texels: 105, step: 2, recentre: 8 }),
  parting: 0.8,
});

const BLADE_ROWS = Object.freeze([[-1, 0], [1, 0], [-0.8, 0.38], [0.8, 0.38], [-0.48, 0.72], [0.48, 0.72], [0, 1]]);
const BLADE_FACES = Object.freeze([0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6]);

function seeded(seed) {
  let state = seed >>> 0;
  return () => { state = (state + 0x6d2b79f5) >>> 0; let t = Math.imul(state ^ (state >>> 15), 1 | state); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function wildsBlades(rings = WILDS_GRASS.rings) {
  const sides = rings.map(ring => Math.round(ring.period * Math.sqrt(ring.density))), count = sides.reduce((sum, side) => sum + side * side, 0);
  const roots = new Float32Array(count * 4), random = seeded(53);
  let blade = 0;
  rings.forEach(({ period }, ring) => {
    const side = sides[ring], cell = period / side;
    for (let j = 0; j < side; j++) for (let i = 0; i < side; i++, blade++) roots.set([(i + random()) * cell, (j + random()) * cell, random(), ring + random() * 0.99], blade * 4);
  });
  return { roots, count };
}

export function createGroundField({ texels, step, sample }) {
  const cells = texels * texels, data = new Float32Array(cells * 4);
  let heights = new Float32Array(cells), covers = new Float32Array(cells), spareHeights = new Float32Array(cells), spareCovers = new Float32Array(cells), originX = NaN, originZ = NaN;
  const at = (i, j) => heights[Math.min(texels - 1, Math.max(0, j)) * texels + Math.min(texels - 1, Math.max(0, i))];
  function centre(x, z, reset = false) {
    const nextX = Math.round(x / step) - (texels - 1) / 2, nextZ = Math.round(z / step) - (texels - 1) / 2;
    if (!reset && nextX === originX && nextZ === originZ) return false;
    for (let j = 0; j < texels; j++) for (let i = 0; i < texels; i++) {
      const oldI = nextX + i - originX, oldJ = nextZ + j - originZ, cell = j * texels + i;
      if (!reset && oldI >= 0 && oldI < texels && oldJ >= 0 && oldJ < texels) { spareHeights[cell] = heights[oldJ * texels + oldI]; spareCovers[cell] = covers[oldJ * texels + oldI]; continue; }
      const surface = sample((nextX + i) * step, (nextZ + j) * step);
      spareHeights[cell] = surface?.height ?? -10000; spareCovers[cell] = surface?.cover ?? 0;
    }
    [heights, spareHeights] = [spareHeights, heights]; [covers, spareCovers] = [spareCovers, covers]; originX = nextX; originZ = nextZ;
    for (let j = 0; j < texels; j++) for (let i = 0; i < texels; i++) {
      const dx = at(i + 1, j) - at(i - 1, j), dz = at(i, j + 1) - at(i, j - 1), length = Math.hypot(dx, 2 * step, dz), cell = j * texels + i;
      data.set([-dx / length, -dz / length, covers[cell], heights[cell]], cell * 4);
    }
    return true;
  }
  return { data, centre, get origin() { return [originX * step, originZ * step]; } };
}

const glsl = value => value.toFixed(3);
const perRing = key => `(ring < .5 ? ${glsl(WILDS_GRASS.rings[0][key])} : ring < 1.5 ? ${glsl(WILDS_GRASS.rings[1][key])} : ${glsl(WILDS_GRASS.rings[2][key])})`;

const GRASS_VERTEX = `precision highp float;
attribute vec3 position; attribute vec4 blade;
uniform mat4 world, viewProjection; uniform sampler2D ground; uniform vec4 groundGrid, walker, stones[${MEADOW_ROCKS.length}]; uniform float goldenHour;
varying vec3 vColor; varying float vFold;
${WILDS_GROUND_GLSL}
void groundAt(vec2 p, out vec3 n, out float height, out float canopy) {
  vec2 g = (p - groundGrid.xy) / groundGrid.w, i = floor(g), f = g - i; float size = groundGrid.z;
  vec4 a = texture2D(ground, (i + .5) / size), b = texture2D(ground, (i + vec2(1.5, .5)) / size), c = texture2D(ground, (i + vec2(.5, 1.5)) / size), d = texture2D(ground, (i + 1.5) / size);
  height = f.x + f.y <= 1. ? a.w + (b.w - a.w) * f.x + (c.w - a.w) * f.y : d.w + (c.w - d.w) * (1. - f.x) + (b.w - d.w) * (1. - f.y);
  vec3 m = mix(mix(a.xyz, b.xyz, f.x), mix(c.xyz, d.xyz, f.x), f.y);
  n = normalize(vec3(m.x, sqrt(max(1. - m.x * m.x - m.y * m.y, .01)), m.y)); canopy = m.z;
}
void main() {
  float ring = floor(blade.w), rank = fract(blade.w), seed = blade.z, t = position.y;
  float period = ${perRing('period')}, reach = ${perRing('reach')};
  vec2 base = blade.xy + period * floor((eye.xz - blade.xy) / period + .5);
  float dist = length(base - eye.xz), keep = 1. - smoothstep(reach * .45, reach, dist);
  vec4 aim = viewProjection * world * vec4(base.x, eye.y - 1.5, base.y, 1.);
  vColor = vec3(0.); vFold = 0.; gl_Position = vec4(2., 2., 2., 1.);
  if (keep <= rank || aim.w < -1. || abs(aim.x) > aim.w * 1.1 + 1.5) return;
  vec3 n; float level, canopy; groundAt(base, n, level, canopy);
  float grow = clamp((keep - rank) * 5., 0., 1.) * sward(base, level, n);
  grow *= 1. - step(abs(base.x), ${glsl(GRASS.clearing.halfWidth)}) * step(abs(base.y), ${glsl(GRASS.clearing.halfDepth)});
  for (int i = 0; i < ${MEADOW_ROCKS.length}; i++) grow *= smoothstep(stones[i].z * .8, stones[i].z, distance(base, stones[i].xy));
  if (grow < .02) return;
  float swath = worldNoise(base / 17. + 3.7), clump = worldNoise(base / 2.3 + 11.);
  float bloom = ring < 1.5 ? step(fract(seed * 91.7), smoothstep(.74, .88, worldNoise(base / 8. + 17.3)) * .035) * (1. - smoothstep(30., 45., dist)) : 0.;
  float tall = ${glsl(WILDS_GRASS.blade.height)} * (.72 + .56 * fract(seed * 7.31)) * (.78 + .3 * swath + .28 * clump) * (1. + dist / 250.) * grow;
  float wide = ${glsl(WILDS_GRASS.blade.width)} * (1. + dist / ${glsl(WILDS_GRASS.blade.widenEvery)}) * (.8 + .4 * fract(seed * 3.17)) * min(grow * 2., 1.);
  vec2 view = normalize(base - eye.xz + vec2(1e-3)), across = vec2(-view.y, view.x);
  float turn = seed * 43.7; vec2 face = normalize(mix(vec2(cos(turn), sin(turn)), across, .7));
  float gust = groundGust(base), ripple = gusts * sin(dot(base, windDir) * 1.1 - time * 3.1 + seed * 6.);
  vec2 lean = vec2(cos(turn * 1.7), sin(turn * 1.7)) * .34 + windDir * (.2 + .5 * gust + .07 * ripple);
  vec2 away = base - walker.xz; float beside = length(away);
  float press = walker.w * (1. - smoothstep(.15, ${glsl(WILDS_GRASS.parting)}, beside)) * step(abs(level - walker.y), 1.2);
  lean += away / max(beside, .05) * press * 1.2;
  tall *= 1. - .3 * press;
  float head = (.02 + .003 * dist) * grow, stem = tall * 1.08, row = position.z;
  float lift = mix(t * tall, row < .5 ? 0. : stem + head * (row - 2.) * .9, bloom);
  float span = mix(position.x * wide, sign(position.x) * head * (row > 1.5 && row < 2.5 ? 1. : .22), bloom);
  float reachUp = lift / max(tall, .01), bend = reachUp * reachUp * tall;
  vec2 xz = base + face * span + lean * bend;
  vec3 p = vec3(xz.x, level - .03 + lift * (1. - .22 * min(dot(lean, lean), 1.5) * min(reachUp, 1.)), xz.y);
  vec3 soil = mix(mix(grass, grassLight, .7), groundAlbedo(base, level, n, canopy, dist).rgb, smoothstep(1.5, 2.6, pathOffset(base)));
  float sunward = goldenHour * pow(max(dot(normalize(vec3(view.x, -.2, view.y)), sun), 0.), 2.);
  float soften = 1. - .55 * smoothstep(8., 50., dist);
  vec3 tip = mix(soil, mix(grassTip, grassWarm * sunColor * 1.2, sunward * .8), (.24 + .2 * swath) * (.7 + .6 * fract(seed * 5.3)) * soften);
  vec3 color = mix(soil * mix(1., turfDepth(0.), soften), soil, smoothstep(0., .5, t));
  color = mix(color, tip, smoothstep(.3, 1., t));
  color *= 1. + .2 * smoothstep(.5, 1., gust) * t;
  vec3 petal = fract(seed * 37.1) < .14 ? flowerLilac : worldNoise(base / 19. + 41.) < .5 ? flowerWhite : flowerYellow;
  color = mix(color, petal, bloom * step(1.5, row));
  color = mix(color, soil * turfDepth(dist), smoothstep(reach * .7, reach, dist) * step(1.5, ring));
  vec4 worldPos = world * vec4(p, 1.);
  float shadow = sunShadow(vec3(base.x, level + .12, base.y), 2.2);
  color = wildsLit(color, n, n, worldPos.xyz, canopy, dist, shadow);
  color += sunColor * sunStrength * pow(max(dot(normalize(worldPos.xyz - eye), sun), 0.), 3.) * t * t * (.3 + .9 * goldenHour) * soil * (1. - bloom) * (1. - shadow);
  color *= contactShade(base);
  vColor = worldAir(color, worldPos.xyz, eye, sun, fogNear, fogFar, fogSun, fogDensity, fogHeight);
  vFold = position.x * (1. - bloom) * (1. - smoothstep(6., 18., dist));
  gl_Position = viewProjection * worldPos;
}`;

const GRASS_FRAGMENT = `precision highp float;
varying vec3 vColor; varying float vFold;
void main() { gl_FragColor = vec4(vColor * (1. + .07 * clamp(vFold * 6., -1., 1.)), 1.); }`;

export function createWildsGrass(scene, { root, atmosphere, still = false, surface, blades = wildsBlades() }) {
  const paint = new ShaderMaterial('wilds-grass-paint', scene, { vertexSource: GRASS_VERTEX, fragmentSource: GRASS_FRAGMENT }, { attributes: ['position', 'blade'], uniforms: ['world', 'viewProjection', 'groundGrid', 'walker', 'stones', 'goldenHour', ...GROUND_UNIFORMS, ...SHADOW_UNIFORMS], samplers: ['ground', ...SHADOW_SAMPLERS] });
  paint.backFaceCulling = false;
  paint.setFloat('gusts', still ? 0 : 1);
  const shadow = new Vector4(0, 0, 1, 0), walker = new Vector4(0, -10000, 0, 0);
  paint.setVector4('contactShadow', shadow); paint.setVector4('walker', walker);
  paint.setArray4('stones', rockClearings());
  followEye(scene, paint, still);
  const { texels, step, recentre } = WILDS_GRASS.field;
  const field = createGroundField({ texels, step, sample: surface }), texture = new RawTexture(field.data, texels, texels, Constants.TEXTUREFORMAT_RGBA, scene, false, false, Constants.TEXTURE_NEAREST_SAMPLINGMODE, Constants.TEXTURETYPE_FLOAT);
  texture.wrapU = texture.wrapV = Constants.TEXTURE_CLAMP_ADDRESSMODE;
  paint.setTexture('ground', texture);
  const grid = new Vector4(0, 0, texels, step), half = (texels - 1) / 2 * step;
  function follow(x, z, reset = false) {
    const [cx, cz] = field.origin;
    if (!reset && Math.abs(x - cx - half) <= recentre && Math.abs(z - cz - half) <= recentre) return false;
    field.centre(x, z, reset); texture.update(field.data);
    [grid.x, grid.y] = field.origin; paint.setVector4('groundGrid', grid);
    return true;
  }
  const mesh = new Mesh('wilds-grass', scene);
  Object.assign(new VertexData(), { positions: BLADE_ROWS.flatMap(([side, t], row) => [side, t, row >> 1]), indices: [...BLADE_FACES] }).applyToMesh(mesh);
  mesh.setVerticesBuffer(new VertexBuffer(scene.getEngine(), blades.roots, 'blade', false, false, 4, true));
  mesh.forcedInstanceCount = blades.count;
  mesh.material = paint; mesh.parent = root; mesh.isPickable = false; mesh.alwaysSelectAsActiveMesh = true; mesh.metadata = { castShadow: false, world: true };
  const camera = scene.activeCamera?.globalPosition;
  follow(camera?.x ?? 0, camera?.z ?? 0);
  const watch = scene.onBeforeRenderObservable.add(() => { const active = scene.activeCamera; if (active) follow(active.globalPosition.x, active.globalPosition.z); });
  mesh.onDisposeObservable.add(() => { scene.onBeforeRenderObservable.remove(watch); texture.dispose(); });
  const setTheme = next => { applyGround(paint, next); paint.setFloat('goldenHour', next.goldenHour); };
  setTheme(atmosphere);
  return {
    mesh, blades: blades.count, follow, setTheme,
    get origin() { return field.origin; },
    setWalker(x, y, z, strength) { walker.set(x, y, z, strength); paint.setVector4('walker', walker); },
    setContactShadow(x, z, radius, strength) { shadow.set(x, z, radius, strength); paint.setVector4('contactShadow', shadow); },
  };
}
