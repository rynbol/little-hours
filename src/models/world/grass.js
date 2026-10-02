import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';
import { Vector4 } from '@babylonjs/core/Maths/math.vector.js';
import { heightAt, WORLD } from '../../core/world-terrain.js';
import { TERRAIN_RINGS, ringAt } from './terrain-mesh.js';
import { groundGLSL, GROUND_UNIFORMS, applyGround } from './terrain-paint.js';
import { GROVE_UNIFORMS } from './grove-light.js';
import { followEye } from './world-glsl.js';
import { createWorldRocks, MEADOW_ROCKS, rockClearings } from './rocks.js';
import { GRASS, grassBlades } from './grass-blades.js';

export { GRASS, grassBlades } from './grass-blades.js';

export function surfaceAt(x, z, rings = TERRAIN_RINGS) {
  const s = ringAt(x, z, rings).step;
  const x0 = Math.floor(x / s) * s, z0 = Math.floor(z / s) * s, fx = (x - x0) / s, fz = (z - z0) / s;
  if (fx === 0 && fz === 0) return heightAt(x, z);
  if (fx + fz <= 1) { const a = heightAt(x0, z0); return a + (heightAt(x0 + s, z0) - a) * fx + (heightAt(x0, z0 + s) - a) * fz; }
  const d = heightAt(x0 + s, z0 + s);
  return d + (heightAt(x0, z0 + s) - d) * (1 - fx) + (heightAt(x0 + s, z0) - d) * (1 - fz);
}

export function createGroundGrid({ texels, step, sample = surfaceAt }) {
  const data = new Float32Array(texels * texels * 4);
  let heights = new Float32Array(texels * texels), spare = new Float32Array(texels * texels), originX = NaN, originZ = NaN;
  const at = (i, j) => heights[Math.min(texels - 1, Math.max(0, j)) * texels + Math.min(texels - 1, Math.max(0, i))];
  function centre(x, z, reset = false) {
    const nextX = Math.round(x / step) - (texels - 1) / 2, nextZ = Math.round(z / step) - (texels - 1) / 2;
    if (!reset && nextX === originX && nextZ === originZ) return false;
    for (let j = 0; j < texels; j++) for (let i = 0; i < texels; i++) {
      const oldI = nextX + i - originX, oldJ = nextZ + j - originZ, kept = !reset && oldI >= 0 && oldI < texels && oldJ >= 0 && oldJ < texels;
      spare[j * texels + i] = kept ? heights[oldJ * texels + oldI] : sample((nextX + i) * step, (nextZ + j) * step);
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

const perLayer = key => `(blade.w < .5 ? ${GRASS.layers[0][key].toFixed(3)} : blade.w < 1.5 ? ${GRASS.layers[1][key].toFixed(3)} : ${GRASS.layers[2][key].toFixed(3)})`;

function dryGrassGLSL(definition) {
  const basins = definition?.water.filter(body => body.basin) ?? [];
  if (!basins.length) return `smoothstep(${(WORLD.river.width * 0.8).toFixed(1)}, ${(WORLD.river.width * 1.1).toFixed(1)}, riverOffset(base))`;
  return basins.map(body => `mix(1., smoothstep(${(body.level + .04).toFixed(3)}, ${(body.level + .85).toFixed(3)} + worldNoise(base * .24) * .35, surface.w), 1. - smoothstep(1., 1.1, length((base - vec2(${body.x.toFixed(3)}, ${body.z.toFixed(3)})) / vec2(${body.radiusX.toFixed(3)}, ${body.radiusZ.toFixed(3)}))))`).join(' * ');
}

const grassVertex = (definition, grove) => `precision highp float;
attribute vec3 position; attribute vec4 blade;
uniform mat4 world, viewProjection; uniform sampler2D ground; uniform vec4 groundGrid, bladeForm, hearthClearing, stones[${MEADOW_ROCKS.length}]; uniform float goldenHour;
varying vec3 vColor;
${groundGLSL(definition, grove)}
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
  float keep = inner ? 1. - smoothstep(reach * .55, reach, dist) : 1. - smoothstep(reach * .55, reach, dist);
  float grow = clamp((keep - blade.y) * 5., 0., 1.);
  vec4 aim = viewProjection * world * vec4(base.x, eye.y - 1.5, base.y, 1.);
  if (keep <= blade.y || aim.w < -1. || abs(aim.x) > aim.w * 1.1 + 1.5) { vColor = vec3(0.); gl_Position = vec4(2., 2., 2., 1.); return; }
  vec4 surface = groundAt(base); vec3 n = surface.xyz;
  grow *= smoothstep(.76, .86, n.y) * ${dryGrassGLSL(definition)} * (1. - smoothstep(330., 380., surface.w));
  ${definition ? '' : `grow *= 1. - step(abs(base.x), ${GRASS.clearing.halfWidth.toFixed(2)}) * step(abs(base.y), ${GRASS.clearing.halfDepth.toFixed(2)});`}
  grow *= smoothstep(1.1, 1.9, pathOffset(base));
  if (hearthClearing.z > 0.) grow *= smoothstep(hearthClearing.z, hearthClearing.w, distance(base, hearthClearing.xy));
  for (int i = 0; i < ${MEADOW_ROCKS.length}; i++) grow *= smoothstep(stones[i].z * .8, stones[i].z, distance(base, stones[i].xy));
  float clump = .55 + .9 * worldNoise(base / 1.9 + 3.7);
  float bloom = step(fract(seed * 91.7), smoothstep(.6, .78, worldNoise(base / 7. + 17.3)) * ${definition?.grass.flowers ?? '.3'}${grove ? ' * .7' : ''}) * (1. - smoothstep(40., 55., dist));
  float height = ${perLayer('height')} * ${definition?.grass.height ?? '1.'} * (.55 + .9 * seed) * mix(clump, 1.2, bloom) * grow, head = (.028 + .005 * dist) * grow;
  float nearWidth = last ? mix(bladeForm.x, 1., smoothstep(12., 48., dist)) : inner ? 1. : mix(bladeForm.y, 1., smoothstep(5., 22., dist));
  float width = mix(${perLayer('width')} * ${definition?.grass.width ?? '1.'}${grove ? ' * 2.6' : ''} * (.75 + .5 * fract(seed * 7.31)) * grow * nearWidth, head * (t < .25 ? .2 : .9), bloom);
  t = mix(t, 1. - head / max(height, .05) * (t < .25 ? 1. : t < .75 ? .5 : 0.), bloom);
  vec2 view = normalize(base - eye.xz + vec2(1e-3)), across = vec2(-view.y, view.x);
  float turn = seed * 43.7; vec2 face = normalize(mix(vec2(cos(turn), sin(turn)), across, mix(.6, 1., bloom)));
  float gust = groundGust(base), bend = t * t * height;
  float flutter = sin(time * 2.6 + seed * 31.) * gusts * .05;
  vec2 lean = vec2(cos(turn * 1.7), sin(turn * 1.7)) * bladeForm.z + windDir * (bladeForm.w + .34 * gust + flutter);
  vec2 xz = base + face * blade.x * width + lean * bend;
  vec3 p = vec3(xz.x, surface.w - .04 + t * height * (1. - .18 * dot(lean, lean) * t), xz.y);
  ${grove ? 'vec4 grove = groveAt(base, 0.);' : ''}
  vec3 soil = groundAlbedo(base, surface.w, n, ${grove ? 'grove.a * .55' : '0.'}, dist).rgb, field = soil * mix(${definition ? '.94, 1.02' : '.84, 1.1'}, worldNoise(base / 2.7 + 9.1)) * (.94 + .12 * fract(seed * 13.7));
  float sunward = goldenHour * pow(max(dot(normalize(vec3(view.x, -.2, view.y)), sun), 0.), 2.);
  field = mix(field, grassWarm * sunColor * 1.15, sunward * .3);
  vec3 tip = mix(field, mix(grassTip, grassWarm * sunColor * 1.2, sunward * .8), .45 + .55 * fract(seed * 5.3));
  vec3 color = t < .5 ? mix(field * ${definition ? 'vec3(.64, .72, .58)' : 'vec3(.3, .42, .28)'}, field, t / .5) : mix(field, tip, smoothstep(.5, 1., t));
  vec3 petal = fract(seed * 37.1) < .1 ? flowerLilac : worldNoise(base / 19. + 41.) < .42 ? flowerWhite : flowerYellow;
  ${grove ? 'petal = mix(petal, grassLight, .18);' : ''}
  color = mix(color, petal * (t < .85 ? .82 : 1.), bloom);
  color *= 1. + .22 * smoothstep(.55, 1., gust) * t;
  color = mix(color, soil, last ? smoothstep(reach * .7, reach * .98, dist) : 0.);
  vec4 worldPos = world * vec4(p, 1.);
  vec3 toward = normalize(worldPos.xyz - eye);
  color = ${grove ? 'groveLight(color, n, grove)' : 'color * groundLight(n, 0.)'} + sunColor * sunStrength * pow(max(dot(toward, sun), 0.), 3.) * t * t * ${grove ? '(.14 + .35 * goldenHour) * grove.r' : '(.3 + .9 * goldenHour)'} * soil;
  color *= contactShade(base);
  vColor = worldAir(color, worldPos.xyz, eye, sun, fogNear, fogFar, fogSun, fogDensity, fogHeight);
  gl_Position = viewProjection * worldPos;
}`;

const GRASS_FRAGMENT = `precision highp float;
varying vec3 vColor;
void main() { gl_FragColor = vec4(vColor, 1.); }`;

export function createWorldGrass(scene, { root, atmosphere, still, blades = grassBlades(), definition, surface, grove }) {
  const paint = new ShaderMaterial('world-grass-paint', scene, { vertexSource: grassVertex(definition, !!grove), fragmentSource: GRASS_FRAGMENT }, { attributes: ['position', 'blade'], uniforms: ['world', 'viewProjection', 'groundGrid', 'bladeForm', 'hearthClearing', 'stones', 'goldenHour', ...GROUND_UNIFORMS, ...(grove ? GROVE_UNIFORMS : [])], samplers: ['ground', ...(grove ? ['groveField'] : [])] });
  grove?.bind(paint);
  paint.backFaceCulling = false;
  paint.setFloat('gusts', still ? 0 : 1);
  paint.setVector4('bladeForm', definition ? new Vector4(0.24, 0.58, 0.3, 0.17) : new Vector4(1, 1, 0.16, 0.34));
  const hearth = definition?.landmarks.find(mark => mark.kind === 'hearth');
  paint.setVector4('hearthClearing', hearth ? new Vector4(hearth.x, hearth.z, hearth.restingRadius ?? hearth.radius + 0.55, hearth.restingRadius ? hearth.restingRadius + hearth.restingBlend : hearth.radius + 1) : new Vector4(0, 0, 0, 0));
  const shadow = new Vector4(0, 0, 1, 0); paint.setVector4('contactShadow', shadow);
  paint.setArray4('stones', rockClearings(definition?.rocks));
  followEye(scene, paint, still);
  const grid = createGroundGrid({ ...GRASS, ...(surface ? { sample: (x, z) => surface(x, z)?.height ?? -10000 } : {}) }), texture = new RawTexture(grid.data, GRASS.texels, GRASS.texels, Constants.TEXTUREFORMAT_RGBA, scene, false, false, Constants.TEXTURE_NEAREST_SAMPLINGMODE, Constants.TEXTURETYPE_FLOAT);
  texture.wrapU = texture.wrapV = Constants.TEXTURE_CLAMP_ADDRESSMODE;
  paint.setTexture('ground', texture);
  const gridUniform = new Vector4(0, 0, GRASS.texels, GRASS.step), half = (GRASS.texels - 1) / 2 * GRASS.step;
  function follow(x, z, reset = false) {
    const [cx, cz] = grid.origin;
    if (!reset && Math.abs(x - cx - half) <= GRASS.recentre && Math.abs(z - cz - half) <= GRASS.recentre) return false;
    grid.centre(x, z, reset); texture.update(grid.data);
    [gridUniform.x, gridUniform.y] = grid.origin; paint.setVector4('groundGrid', gridUniform);
    return true;
  }
  const { positions, blade, indices } = blades;
  const mesh = new Mesh('world-grass', scene);
  Object.assign(new VertexData(), { positions, indices }).applyToMesh(mesh);
  mesh.setVerticesData('blade', blade, false, 4);
  mesh.material = paint; mesh.parent = root; mesh.isPickable = false; mesh.alwaysSelectAsActiveMesh = true; mesh.metadata = { castShadow: false, world: true };
  const camera = scene.activeCamera?.globalPosition;
  follow(camera?.x ?? 0, camera?.z ?? 0);
  const watch = scene.onBeforeRenderObservable.add(() => { const active = scene.activeCamera; if (active) follow(active.globalPosition.x, active.globalPosition.z); });
  mesh.onDisposeObservable.add(() => { scene.onBeforeRenderObservable.remove(watch); texture.dispose(); });
  const paintGround = next => { applyGround(paint, next); paint.setFloat('goldenHour', next.goldenHour); };
  paintGround(atmosphere);
  const rocks = createWorldRocks(scene, { root, still, definition, surface, grove });
  rocks.setTheme(atmosphere);
  return {
    mesh, rocks: rocks.mesh, follow,
    setContactShadow(x, z, radius, strength) { shadow.set(x, z, radius, strength); paint.setVector4('contactShadow', shadow); rocks.setContactShadow(x, z, radius, strength); },
    refresh() { const camera = scene.activeCamera?.globalPosition; follow(camera?.x ?? 0, camera?.z ?? 0, true); rocks.refresh(); },
    get origin() { return grid.origin; },
    setTheme: next => { paintGround(next); rocks.setTheme(next); },
  };
}
