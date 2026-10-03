import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase.js';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Frustum } from '@babylonjs/core/Maths/math.frustum.js';
import { random } from '../../core/wilds/noise.js';
import { noiseTexture } from './noise-texture.js';
import { WIND_GLSL } from './wind.js';

export const GRASS_TIERS = Object.freeze([
  Object.freeze({ size: 8, blades: 6400, segments: 3, width: .034, tall: .64, face: .3, shade: .42, normal: .3, near: -8, far: 22 }),
  Object.freeze({ size: 8, blades: 1900, segments: 2, width: .075, tall: .66, face: .6, shade: .58, normal: .2, near: 18, far: 56 }),
  Object.freeze({ size: 16, blades: 2600, segments: 1, width: .16, tall: .68, face: .9, shade: .76, normal: .1, near: 50, far: 120 }),
]);

export function bladeGeometry({ size, blades, segments }, seed = 17) {
  const rand = random(seed), perBlade = segments * 2 + 1, count = blades * perBlade;
  const positions = new Float32Array(count * 3), shape = new Float32Array(count * 4), normals = new Float32Array(count * 3);
  const indices = new Uint32Array(blades * (segments * 6 - 3));
  let v = 0, k = 0, clump = null;
  for (let b = 0; b < blades; b++) {
    if (!clump || clump.left-- <= 0) clump = { x: rand() * size, z: rand() * size, reach: .05 + rand() * .15, keep: rand(), vary: rand(), left: 3 + Math.floor(rand() * 6) };
    const spin = rand() * Math.PI * 2, out = Math.sqrt(rand()) * clump.reach;
    const x = (clump.x + Math.cos(spin) * out + size) % size, z = (clump.z + Math.sin(spin) * out + size) % size;
    const angle = spin + (rand() - .5) * .8, keep = clump.keep * .85 + rand() * .15, vary = clump.vary * .55 + rand() * .45, first = v;
    for (let level = 0; level <= segments; level++) for (const side of level === segments ? [0] : [-1, 1]) {
      positions[v * 3] = x; positions[v * 3 + 1] = level / segments; positions[v * 3 + 2] = z;
      shape[v * 4] = side; shape[v * 4 + 1] = angle; shape[v * 4 + 2] = keep; shape[v * 4 + 3] = vary;
      normals[v * 3 + 1] = 1;
      v++;
    }
    for (let level = 0; level < segments - 1; level++) { const a = first + level * 2; indices.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], k); k += 6; }
    const last = first + (segments - 1) * 2;
    indices.set([last, last + 1, v - 1], k); k += 3;
  }
  return { positions, shape, normals, indices };
}

const VERTEX_DEFINITIONS = `
#ifdef WILDS_GRASS
attribute vec4 grassShape;
uniform sampler2D grassHeights;
uniform sampler2D grassMask;
uniform sampler2D grassTint;
uniform sampler2D grassNoise;
varying vec3 vGrassColor;
varying float vGrassT;
${WIND_GLSL}
float grassTexel(ivec2 c) { return texelFetch(grassHeights, clamp(c, ivec2(0), ivec2(int(grassField.w) - 1, int(grassArea.x) - 1)), 0).r; }
vec3 grassGround(vec2 p) {
  vec2 g = (p - grassField.xy) / grassField.z, i = floor(g), f = g - i;
  ivec2 c = ivec2(i);
  float a = grassTexel(c), b = grassTexel(c + ivec2(1, 0)), d = grassTexel(c + ivec2(0, 1)), e = grassTexel(c + ivec2(1, 1));
  return vec3(mix(mix(a, b, f.x), mix(d, e, f.x), f.y), mix(b - a, e - d, f.y), mix(d - a, e - b, f.x));
}
vec2 grassUV(vec2 p) { return ((p - grassField.xy) / grassField.z + .5) / vec2(grassField.w, grassArea.x); }
float grassHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec2 grassAway(vec2 root, vec4 pusher) {
  vec2 d = root - pusher.xy;
  float l = length(d);
  return l > .001 ? d / l * (1. - smoothstep(pusher.z * .3, pusher.z, l)) * pusher.w : vec2(0.);
}
#endif
`;

const VERTEX_MAIN = `
#ifdef WILDS_GRASS
{
  vec2 origin = finalWorld[3].xz;
  float tileHash = grassHash(origin * .1371 + .5);
  float size = grassTier.w;
  vec2 local = position.xz;
  if (tileHash > .5) local.x = size - local.x;
  if (fract(tileHash * 7.31) > .5) local.y = size - local.y;
  if (fract(tileHash * 13.7) > .5) local = local.yx;
  vec2 root = origin + local;
  float t = position.y, side = grassShape.x, angle = grassShape.y + tileHash * 6.2831;
  float keep = fract(grassShape.z + tileHash * .618), vary = grassShape.w;
  vec2 uv = grassUV(root);
  vec4 mask = texture(grassMask, uv);
  vec4 tint = texture(grassTint, uv);
  float dist = distance(root, grassEye.xz);
  float fade = smoothstep(grassTier.x, grassTier.x + 4., dist) * (1. - smoothstep(grassTier.y - 7., grassTier.y, dist));
  float grow = smoothstep(0., .05, smoothstep(.3, .7, mask.r) * fade - keep);
  float field = texture(grassNoise, root * .0131).r;
  float tall = grassArea.z * mix(.3, 1.05, mask.g) * mix(.7, 1.25, smoothstep(.3, .72, field)) * mix(.62, 1.3, vary) * grow * smoothstep(.3, 1.4, distance(root, grassEye.xz));
  vec3 ground = grassGround(root);
  float gust = windGust(grassNoise, root, grassWind);
  float comb = texture(grassNoise, root * .017 + .53).g * 9.;
  vec2 lean = normalize(vec2(cos(comb), sin(comb)) + vec2(cos(angle), sin(angle)) * 1.2 + vec2(.0001)) * (.18 + .46 * vary * vary);
  vec2 bend = lean + grassWind.xy * grassWind.w * (gust * 1.1 + .14 + .1 * sin(grassWind.z * 2.6 + vary * 31. + dot(root, vec2(.9, .6))));
  bend += (grassAway(root, grassPush0) + grassAway(root, grassPush1) + grassAway(root, grassPush2) + grassAway(root, grassPush3)) * 1.7;
  float b = length(bend);
  if (b > 1.5) { bend *= 1.5 / b; b = 1.5; }
  vec2 toward = b > .001 ? bend / b : vec2(0., 1.);
  float phi = b * .9 + .3 * vary;
  vec3 p0 = vec3(root.x, ground.x - .03, root.y);
  vec3 p1 = p0 + tall * vec3(toward.x * .06, .66, toward.y * .06);
  vec3 p2 = p0 + tall * vec3(sin(phi) * toward.x, cos(phi), sin(phi) * toward.y);
  vec3 spine = mix(mix(p0, p1, t), mix(p1, p2, t), t);
  vec3 tangent = normalize(mix(p1 - p0, p2 - p1, t) + vec3(0., .0001, 0.));
  vec2 across = vec2(-toward.y, toward.x);
  vec2 toEye = normalize(grassEye.xz - root + vec2(.0001));
  vec2 viewSide = vec2(-toEye.y, toEye.x);
  vec2 sideDir = normalize(mix(across, viewSide * (dot(across, viewSide) < 0. ? -1. : 1.), grassArea.y) + vec2(.0001));
  vec3 sideW = vec3(sideDir.x, 0., sideDir.y);
  float width = grassTier.z * (.7 + .6 * vary) * (1. - pow(t, 1.6) * .94) * min(1., grow * 3.);
  worldPos.xyz = spine + sideW * side * width;
  vec3 terrainN = normalize(vec3(-ground.y, grassField.z, -ground.z));
  vec3 bladeN = normalize(cross(sideW, tangent));
  if (dot(bladeN, grassEye.xyz - spine) < 0.) bladeN = -bladeN;
  vec3 sunward = vec3(grassSun.x, 0., grassSun.z) / max(.0001, length(grassSun.xz));
  vNormalW = normalize(mix(terrainN, normalize(bladeN + sideW * side * .5), grassLook.z) + sunward * t * (1. - abs(grassSun.y)) * 1.1);
  float dry = tint.a * .5 + smoothstep(.55, .85, texture(grassNoise, root * .0193 + .31).b) * .3;
  vec3 hue = tint.rgb * (.92 + .16 * vary);
  hue = mix(hue, hue * vec3(1.14, 1.05, .74), dry);
  vec3 top = mix(hue * 1.3, vec3(.66, .7, .38), .22);
  vGrassColor = mix(hue * grassLook.y, top, smoothstep(0., 1., t)) * (1. + gust * .28 * t * t) * grassLook.x;
  vGrassT = t;
}
#endif
`;

const FRAGMENT_DEFINITIONS = `
#ifdef WILDS_GRASS
varying vec3 vGrassColor;
varying float vGrassT;
#endif
`;

class GrassPlugin extends MaterialPluginBase {
  constructor(material, field, tier) {
    super(material, 'WildsGrass', 210, { WILDS_GRASS: false }, true, true);
    this.field = field; this.tier = tier;
  }
  getClassName() { return 'WildsGrassPlugin'; }
  isCompatible(language) { return language === 0; }
  prepareDefines(defines) { defines.WILDS_GRASS = true; }
  getAttributes(attributes) { attributes.push('grassShape'); }
  getSamplers(samplers) { samplers.push('grassHeights', 'grassMask', 'grassTint', 'grassNoise'); }
  getActiveTextures(list) { list.push(this.field.heights, this.field.mask, this.field.tint, this.field.noise); }
  hasTexture(texture) { return [this.field.heights, this.field.mask, this.field.tint, this.field.noise].includes(texture); }
  getUniforms() {
    const names = ['grassField', 'grassArea', 'grassTier', 'grassWind', 'grassEye', 'grassPush0', 'grassPush1', 'grassPush2', 'grassPush3', 'grassLook', 'grassSun', 'grassSunColor'];
    return {
      ubo: names.map(name => ({ name, size: 4, type: 'vec4' })),
      vertex: `uniform vec4 ${names.join(', ')};`,
      fragment: `uniform vec4 ${names.join(', ')};`,
    };
  }
  bindForSubMesh(ubo) {
    const { field, tier } = this, s = field.state;
    ubo.updateFloat4('grassField', field.minX, field.minZ, field.step, field.columns);
    ubo.updateFloat4('grassArea', field.rows, tier.face, tier.tall, 0);
    ubo.updateFloat4('grassTier', tier.near, tier.far, tier.width, tier.size);
    ubo.updateFloat4('grassWind', ...s.wind);
    ubo.updateFloat4('grassEye', ...s.eye, 0);
    s.pushers.forEach((p, i) => ubo.updateFloat4(`grassPush${i}`, p[0], p[1], p[2], p[3]));
    ubo.updateFloat4('grassLook', s.tint, tier.shade, tier.normal, 0);
    ubo.updateFloat4('grassSun', ...s.sun, 0);
    ubo.updateFloat4('grassSunColor', ...s.sunColor, s.glow);
    ubo.setTexture('grassHeights', field.heights);
    ubo.setTexture('grassMask', field.mask);
    ubo.setTexture('grassTint', field.tint);
    ubo.setTexture('grassNoise', field.noise);
  }
  getCustomCode(shaderType) {
    if (shaderType === 'vertex') return { CUSTOM_VERTEX_DEFINITIONS: VERTEX_DEFINITIONS, CUSTOM_VERTEX_UPDATE_WORLDPOS: VERTEX_MAIN };
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: FRAGMENT_DEFINITIONS,
      CUSTOM_FRAGMENT_UPDATE_DIFFUSE: '#ifdef WILDS_GRASS\ndiffuseColor = vGrassColor;\n#endif',
      CUSTOM_FRAGMENT_BEFORE_FOG: '#ifdef WILDS_GRASS\ncolor.rgb += grassSunColor.rgb * vGrassColor * pow(max(dot(-viewDirectionW, grassSun.xyz), 0.), 5.) * vGrassT * vGrassT * grassSunColor.a;\n#endif',
    };
  }
}

function tileStats(field, size) {
  const across = Math.ceil((field.columns - 1) * field.step / size), down = Math.ceil((field.rows - 1) * field.step / size);
  const low = new Float32Array(across * down).fill(Infinity), high = new Float32Array(across * down).fill(-Infinity), grass = new Uint8Array(across * down);
  for (let r = 0; r < field.rows; r++) for (let c = 0; c < field.columns; c++) {
    const tile = Math.min(down - 1, Math.floor(r * field.step / size)) * across + Math.min(across - 1, Math.floor(c * field.step / size)), i = r * field.columns + c;
    low[tile] = Math.min(low[tile], field.grid.heights[i]); high[tile] = Math.max(high[tile], field.grid.heights[i]);
    grass[tile] = Math.max(grass[tile], field.maskData[i * 4]);
  }
  return { across, down, low, high, grass };
}

function aabbVisible(planes, minX, minY, minZ, maxX, maxY, maxZ) {
  for (const plane of planes) {
    const { x, y, z } = plane.normal;
    if (x * (x > 0 ? maxX : minX) + y * (y > 0 ? maxY : minY) + z * (z > 0 ? maxZ : minZ) + plane.d < 0) return false;
  }
  return true;
}

export function createGrass(scene, survey) {
  const { grid, mask } = survey;
  const heights = new RawTexture(grid.heights, grid.columns, grid.rows, Constants.TEXTUREFORMAT_R, scene, false, false, Texture.NEAREST_SAMPLINGMODE, Constants.TEXTURETYPE_FLOAT);
  const maskTexture = RawTexture.CreateRGBATexture(mask, grid.columns, grid.rows, scene, false, false, Texture.BILINEAR_SAMPLINGMODE);
  const tint = RawTexture.CreateRGBATexture(survey.tint, grid.columns, grid.rows, scene, false, false, Texture.BILINEAR_SAMPLINGMODE);
  for (const texture of [heights, maskTexture, tint]) texture.wrapU = texture.wrapV = Texture.CLAMP_ADDRESSMODE;
  const state = { wind: [1, 0, 0, .5], eye: [0, 0, 0], pushers: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], tint: 1, sun: [0, 1, 0], sunColor: [1, 1, 1], glow: .4 };
  const field = { grid, maskData: mask, minX: grid.minX, minZ: grid.minZ, step: grid.step, columns: grid.columns, rows: grid.rows, heights, mask: maskTexture, tint, noise: noiseTexture(scene), state };
  const frustum = Frustum.GetPlanes(scene.getTransformMatrix());

  const tiers = GRASS_TIERS.map((tier, index) => {
    const material = new StandardMaterial(`wilds-grass-${index}`, scene);
    material.diffuseColor = new Color3(1, 1, 1); material.specularColor = new Color3(0, 0, 0);
    material.backFaceCulling = false;
    new GrassPlugin(material, field, tier);
    const geometry = bladeGeometry(tier, 17 + index), mesh = new Mesh(`wilds-grass-${index}`, scene), data = new VertexData();
    Object.assign(data, { positions: geometry.positions, normals: geometry.normals, indices: geometry.indices });
    data.applyToMesh(mesh, false);
    mesh.setVerticesBuffer(new VertexBuffer(scene.getEngine(), geometry.shape, 'grassShape', false, false, 4));
    mesh.material = material; mesh.isPickable = false; mesh.receiveShadows = true; mesh.alwaysSelectAsActiveMesh = true; mesh.doNotSyncBoundingInfo = true;
    const reach = Math.ceil((tier.far + tier.size) / tier.size) * 2 + 1, capacity = reach * reach, matrices = new Float32Array(capacity * 16);
    for (let i = 0; i < capacity; i++) { matrices[i * 16] = matrices[i * 16 + 5] = matrices[i * 16 + 10] = matrices[i * 16 + 15] = 1; }
    mesh.thinInstanceSetBuffer('matrix', matrices, 16, false);
    mesh.thinInstanceCount = 0;
    return { tier, mesh, material, matrices, capacity, stats: tileStats(field, tier.size) };
  });

  function place(entry, eye) {
    const { tier, matrices, stats, mesh } = entry, size = tier.size;
    let count = 0;
    const c0 = Math.floor((eye.x - tier.far - grid.minX) / size), c1 = Math.floor((eye.x + tier.far - grid.minX) / size);
    const r0 = Math.floor((eye.z - tier.far - grid.minZ) / size), r1 = Math.floor((eye.z + tier.far - grid.minZ) / size);
    for (let r = Math.max(0, r0); r <= Math.min(stats.down - 1, r1); r++) for (let c = Math.max(0, c0); c <= Math.min(stats.across - 1, c1); c++) {
      const tile = r * stats.across + c;
      if (stats.grass[tile] < 8) continue;
      const x = grid.minX + c * size, z = grid.minZ + r * size;
      const nearX = Math.max(x, Math.min(eye.x, x + size)), nearZ = Math.max(z, Math.min(eye.z, z + size));
      const farX = Math.abs(eye.x - x) > Math.abs(eye.x - x - size) ? x : x + size, farZ = Math.abs(eye.z - z) > Math.abs(eye.z - z - size) ? z : z + size;
      if (Math.hypot(nearX - eye.x, nearZ - eye.z) > tier.far || Math.hypot(farX - eye.x, farZ - eye.z) < tier.near) continue;
      if (!aabbVisible(frustum, x - 1, stats.low[tile] - .2, z - 1, x + size + 1, stats.high[tile] + 1.2, z + size + 1)) continue;
      if (count >= entry.capacity) break;
      matrices[count * 16 + 12] = x; matrices[count * 16 + 13] = 0; matrices[count * 16 + 14] = z;
      count++;
    }
    mesh.thinInstanceCount = count;
    mesh.thinInstanceBufferUpdated('matrix');
    return count;
  }

  return {
    state, meshes: tiers.map(entry => entry.mesh),
    update(camera, { wind, pushers = [], sun, sunColor, glow = .4, tint: brightness = 1 }) {
      const eye = camera.globalPosition;
      Frustum.GetPlanesToRef(camera.getTransformationMatrix(), frustum);
      state.eye = [eye.x, eye.y, eye.z]; state.wind = wind; state.sun = sun; state.sunColor = sunColor; state.glow = glow; state.tint = brightness;
      for (let i = 0; i < 4; i++) state.pushers[i] = pushers[i] ?? [0, 0, 0, 0];
      return tiers.map(entry => place(entry, eye));
    },
    dispose() { tiers.forEach(({ mesh, material }) => { mesh.dispose(); material.dispose(); }); heights.dispose(); maskTexture.dispose(); tint.dispose(); },
  };
}
