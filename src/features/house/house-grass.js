import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector2, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { onIsland, STREAMS } from './house-island.js';
import { inPond, DOCK } from './house-pond.js';
import { pathDistance, PATH_WIDTH } from './house-paths.js';
import { PLANT_SPOTS } from './garden-model.js';
import { ARBOUR, BENCH, NEST } from './house-garden.js';

const GROUND = -.175;
export const GRASS = Object.freeze({ tries: 60000, height: [.12, .26], width: .05 });
export const HOUSE_YARD = Object.freeze({ minX: -5.6, maxX: 5.3, minZ: -2.65, maxZ: 2.7 });

const hash = n => { const s = Math.sin(n * 91.7 + 17.3) * 43758.5453; return s - Math.floor(s); };

export function grassy(x, z) {
  const { minX, maxX, minZ, maxZ } = HOUSE_YARD;
  return onIsland(x, z, .22) && !inPond(x, z, .3)
    && !(x > minX && x < maxX && z > minZ && z < maxZ)
    && !(Math.abs(x - DOCK.x) < DOCK.width / 2 + .15 && z > DOCK.to - .15 && z < DOCK.from + .3)
    && pathDistance(x, z) > PATH_WIDTH / 2 + .04
    && PLANT_SPOTS.every(([px, pz]) => Math.hypot(x - px, z - pz) > .72)
    && [ARBOUR, BENCH].every(([px, pz]) => Math.hypot(x - px, z - pz) > .5) && Math.hypot(x - NEST[0], z - NEST[1]) > .35
    && STREAMS.flat().every(([sx, sz]) => Math.hypot(x - sx, z - sz) > .34);
}

export function grassBlades() {
  const blades = [], { tries, height: [low, high] } = GRASS;
  for (let i = 0; i < tries; i++) {
    const x = -8 + hash(i) * 21.7, z = -5.4 + hash(i * 1.93 + 4.1) * 10.9;
    if (!grassy(x, z)) continue;
    const patch = Math.sin(x * .8 + z * .35) * .5 + Math.sin(z * 1.6 - x * .45 + 1) * .5;
    blades.push({ x, z, height: low + (high - low) * (.35 + .65 * hash(i * 3.3)) * (.8 + patch * .2), lean: hash(i * 5.1) * Math.PI * 2, tone: hash(i * 7.7), patch });
  }
  return blades;
}

function bladeGeometry(blades) {
  const positions = new Float32Array(blades.length * 9), uvs = new Float32Array(blades.length * 6), colors = new Float32Array(blades.length * 12);
  blades.forEach(({ x, z, height, lean, tone, patch }, i) => {
    const w = GRASS.width * (.7 + tone * .6), cx = Math.cos(lean) * w, cz = Math.sin(lean) * w, tip = .06 * height;
    positions.set([x - cx, GROUND, z - cz, x + cx, GROUND, z + cz, x + Math.cos(lean + 1.4) * tip, GROUND + height, z + Math.sin(lean + 1.4) * tip], i * 9);
    uvs.set([tone * 6.28, 0, tone * 6.28, 0, tone * 6.28, 1], i * 6);
    const warm = .5 + patch * .35 + (tone - .5) * .3;
    for (let k = 0; k < 3; k++) colors.set([warm, tone, height, 1], i * 12 + k * 4);
  });
  const data = new VertexData(); data.positions = positions; data.uvs = uvs; data.colors = colors;
  data.indices = new Uint32Array(blades.length * 3).map((_, i) => i);
  return data;
}

const VERTEX = `precision highp float;
attribute vec3 position; attribute vec2 uv; attribute vec4 color;
uniform mat4 viewProjection; uniform float time; uniform vec3 eye;
varying float vTip, vWarm, vGust, vDepth, vTone;
void main() {
  vec3 p = position; float tip = uv.y, bend = tip * tip;
  float wave = sin(dot(p.xz, vec2(.55, .22)) - time * 1.7);
  float gust = smoothstep(.35, 1., wave) * (.6 + .4 * sin(time * .37 + p.z * .3));
  float flutter = sin(time * 3.1 + uv.x + p.x * 2.3) * .25;
  p.xz += vec2(.94, .34) * bend * (.035 + gust * .09 + flutter * .02) * (color.b * 4.);
  p.y -= bend * gust * .03;
  vTip = tip; vWarm = color.r; vGust = gust * tip; vTone = color.g;
  vDepth = length(eye - p);
  gl_Position = viewProjection * vec4(p, 1.);
}`;
const FRAGMENT = `precision highp float;
varying float vTip, vWarm, vGust, vDepth, vTone;
uniform vec3 root, blade, sunlit, haze; uniform float light; uniform vec2 depth;
void main() {
  vec3 col = mix(root, mix(blade, sunlit, clamp(vWarm, 0., 1.)), smoothstep(0., .85, vTip));
  col *= .9 + vTone * .18;
  col = mix(col, sunlit * 1.08, vGust * .45);
  col *= light;
  col = mix(col, haze, smoothstep(depth.x, depth.y, vDepth) * .32);
  gl_FragColor = vec4(col, 1.);
}`;

export const GRASS_TONES = Object.freeze({
  day: { root: '#6d9440', blade: '#9fc452', sunlit: '#dfe98a', light: 1 },
  dusk: { root: '#34464c', blade: '#5e7b62', sunlit: '#9fae84', light: .92 },
  rain: { root: '#3f5c44', blade: '#6f9166', sunlit: '#a9c092', light: .95 },
});

export function createIslandGrass(scene, theme = 'day') {
  const blades = grassBlades();
  const mesh = new Mesh('island-grass', scene); bladeGeometry(blades).applyToMesh(mesh);
  const material = new ShaderMaterial('island-grass-paint', scene, { vertexSource: VERTEX, fragmentSource: FRAGMENT }, {
    attributes: ['position', 'uv', 'color'], uniforms: ['viewProjection', 'time', 'eye', 'root', 'blade', 'sunlit', 'haze', 'light', 'depth'],
  });
  material.backFaceCulling = false;
  mesh.material = material; mesh.isPickable = false; mesh.metadata = { castShadow: false }; mesh.alwaysSelectAsActiveMesh = true; mesh.freezeWorldMatrix();
  function setTheme(next, haze = [.8, .88, .96]) {
    const tones = GRASS_TONES[next] || GRASS_TONES.day;
    for (const key of ['root', 'blade', 'sunlit']) material.setColor3(key, Color3.FromHexString(tones[key]));
    material.setFloat('light', tones.light); material.setVector3('haze', new Vector3(...haze));
  }
  material.setVector2('depth', new Vector2(26, 44)); material.setFloat('time', 0); material.setVector3('eye', Vector3.Zero());
  setTheme(theme);
  return {
    mesh, count: blades.length, setTheme,
    animate(seconds, eye) { material.setFloat('time', seconds); material.setVector3('eye', eye); },
    dispose() { material.dispose(); mesh.dispose(); },
  };
}
