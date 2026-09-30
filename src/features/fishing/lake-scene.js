import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TargetCamera } from '@babylonjs/core/Cameras/targetCamera.js';
import { Camera } from '@babylonjs/core/Cameras/camera.js';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { PointLight } from '@babylonjs/core/Lights/pointLight.js';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer.js';
import '@babylonjs/core/Meshes/thinInstanceMesh.js';
import { createMobileCompanion, disposeAvatarTemplates } from '../../models/furniture.js';
import { createPetModel } from '../pet/index.js';
import { buildClosedHouse, buildGardenTree, gableData, houseFrame } from '../house/index.js';
import { speciesOf, tierOf } from '../../core/fishing.js';
import { clockRandom } from '../../core/test-pins.js';
import { HOUSE_SPOT, lakeWater } from './lake-ground.js';
import { placeAsset } from '../../models/assets.js';
import { POND, POND_PATH, pondRim as rim, createLakeBank, createLakeGrass } from './lake-ground.js';
import { buildFishModel } from '../../models/fish-model.js';

const cardSide = new Vector3(), DOCK_Y = .42, STAND = new Vector3(0, DOCK_Y, 1.35), HOME_BOBBER = new Vector3(-.15, 0, .2);
const PALETTES = {
  dusk: { exposure: 1.05, sky: '#ffe3c5', ground: '#645441', ambient: .55, sun: .72, sunTint: '#ffcf9f', shade: .3, lamp: .9, glow: .5, lit: '#ffc873', deep: '#2f5b72', shallow: '#6a9f9f', skyLow: '#e9b8a0', skyMid: '#8b7aa0', glint: '#ffe2b8', leaf: ['#86a275', '#97b081', '#a9bf8e'], grass: '#95a877', meadow: '#879b6c', sand: '#cdb694', stone: ['#aaa597', '#9d978a', '#b8b1a1'], light: .95 },
  day: { exposure: 1.1, sky: '#ffe9d2', ground: '#a48b6b', ambient: .66, sun: 1, sunTint: '#ffe3bb', shade: .24, lamp: 0, glow: .35, lit: '#ffd48a', deep: '#4b8a9c', shallow: '#8cc0b6', skyLow: '#f3ead8', skyMid: '#b9d6e0', glint: '#fffaf0', leaf: ['#86a86c', '#9ab97c', '#afc88e'], grass: '#a8bb82', meadow: '#9aae76', sand: '#dcc8a2', stone: ['#c9bfae', '#b8ae9d', '#d6ccb8'], light: 1 },
  rain: { exposure: 1, sky: '#dfe4e2', ground: '#5c5a52', ambient: .6, sun: .45, sunTint: '#e6e8e4', shade: .18, lamp: .7, glow: .45, lit: '#ffd08a', deep: '#3d5f6c', shallow: '#7fa3a3', skyLow: '#aebbbd', skyMid: '#7e8f98', glint: '#eef4f6', leaf: ['#6f8d6d', '#7f9d7a', '#91ab88'], grass: '#8a9f7c', meadow: '#7d9372', sand: '#b8ad98', stone: ['#a9a69c', '#9a978e', '#b6b3a8'], light: .85 },
};
const HEAD = new Vector3(STAND.x, DOCK_Y + 2.45, STAND.z), GROUND = .15, FENCE = ['#c6b99b', '#b3a585'];
const LOOK = new Vector3(.5, 0, -5), VIEW = new Vector3(.45, .85, 1).normalize(), SUN = new Vector3(3, -8, -5).normalize();
const TREES = [[-2.7, 1.36, 1.2, 'oak'], [-2.95, 1.3, .95, 'cherry'], [-.45, 1.42, 1.1, 'oak'], [-.15, 1.4, .95, 'cherry'], [.3, 1.36, 1.15, 'oak'], [.8, 1.36, .9, 'cherry'], [2.25, 1.38, 1.05, 'cherry'], [2.7, 1.38, 1.15, 'oak'], [-1.95, 1.7, 1.1, 'oak']];
const hash = n => { const s = Math.sin(n * 78.233 + 12.9898) * 43758.5453; return s - Math.floor(s); };
const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
const easeOut = t => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

const SWELL = `float swell(vec2 p, float t) { return sin(p.x * .35 + t * .8) * .02 + sin(p.y * .5 - t * .6 + p.x * .2) * .016 + sin((p.x + p.y) * 1.3 + t * 1.7) * .005; }`;
const WATER_VERTEX = `precision highp float;
attribute vec3 position; uniform mat4 world; uniform mat4 viewProjection; uniform float time; varying vec3 vWorld;
${SWELL}
void main() { vec4 w = world * vec4(position, 1.); w.y += swell(w.xz, time); vWorld = w.xyz; gl_Position = viewProjection * w; }`;
const WATER_FRAGMENT = `precision highp float;
varying vec3 vWorld; uniform float time; uniform vec3 eye, deep, shallow, skyLow, skyMid, glint, sunDir; uniform vec4 ripples[10];
${SWELL}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
void main() {
  vec2 q = vWorld.xz; float e = .05;
  vec3 n = normalize(vec3(swell(q - vec2(e, 0.), time) - swell(q + vec2(e, 0.), time), 2. * e, swell(q - vec2(0., e), time) - swell(q + vec2(0., e), time)));
  n.xz += vec2(noise(q * 1.6 + time * .3) - noise(q * 1.6 - time * .25 + 7.), noise(q * 1.9 + 3. + time * .28) - noise(q * 1.5 - time * .31 + 11.)) * .12;
  float foam = 0.;
  for (int i = 0; i < 10; i++) {
    vec4 r = ripples[i]; float age = time - r.z;
    if (age < 0. || age > 3.2 || r.w <= 0.) continue;
    vec2 d = q - r.xy; float dist = length(d) + 1e-4, k = dist - age * .85 - .05;
    float env = exp(-k * k * 7.) * exp(-age * 1.15) * r.w * smoothstep(0., .15, age);
    n.xz -= d / dist * cos(k * 11.) * env * .9; foam += max(0., sin(k * 11.)) * env;
  }
  n = normalize(n);
  vec3 v = normalize(eye - vWorld), r = reflect(-v, n);
  float fres = pow(1. - max(dot(n, v), 0.), 4.);
  float edge = length((q - vec2(0., -3.2)) / vec2(8.6, 7.2)), depth = 1. - smoothstep(.3, .95, edge);
  vec3 base = mix(mix(shallow, deep, depth), shallow * 1.25 + vec3(.07, .06, .02), smoothstep(.84, .99, edge) * .55);
  vec3 sky = mix(skyLow, skyMid, clamp(r.y * 2.2, 0., 1.));
  vec3 col = mix(base, sky, clamp(.18 + fres * .75, 0., .88));
  col += glint * pow(max(dot(r, normalize(sunDir)), 0.), 90.) * 1.1;
  float twinkle = step(.93, noise(q * 9. + vec2(time * .5, -time * .35))) * (.5 + .5 * sin(time * 5. + q.x * 7.));
  col += glint * twinkle * .22 * smoothstep(0., 1., dot(r, normalize(sunDir)) + .4);
  col += vec3(.95, .97, 1.) * min(foam * .9, .6);
  gl_FragColor = vec4(col, 1.);
}`;
const FALL_VERTEX = `precision highp float;
attribute vec3 position; attribute vec2 uv; uniform mat4 viewProjection; varying vec2 vUv;
void main() { vUv = uv; gl_Position = viewProjection * vec4(position, 1.); }`;
const FALL_FRAGMENT = `precision highp float;
varying vec2 vUv; uniform float time, pool; uniform vec3 deep, shallow, foam;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
void main() {
  if (pool > .5) {
    float n = noise(vec2(vUv.x * 22., vUv.y * 5. - time * 1.1)) * .6 + noise(vec2(vUv.x * 41., vUv.y * 9. - time * 1.9)) * .4;
    gl_FragColor = vec4(foam, (1. - smoothstep(.15, 1., vUv.y)) * (.35 + .65 * n) * .9);
    return;
  }
  float streak = noise(vec2(vUv.x * 11., vUv.y * 2.6 - time * 1.7)) * .6 + noise(vec2(vUv.x * 27. + 3., vUv.y * 6. - time * 2.9)) * .4;
  vec3 col = mix(shallow, deep, .25 + .35 * smoothstep(.2, .8, noise(vec2(vUv.x * 5., vUv.y - time * .8))));
  col = mix(col, foam, clamp(smoothstep(.5, .85, streak) * .8 + smoothstep(.8, 1., vUv.y) * .7 + (1. - smoothstep(.12, .3, vUv.y)) * .25, 0., 1.));
  gl_FragColor = vec4(col, smoothstep(0., .14, vUv.x) * smoothstep(1., .86, vUv.x) * .94);
}`;

export function createLakeScene(container, { theme = 'dusk', avatar, pet = 'cat', house, reducedMotion = false }) {
  const palette = PALETTES[theme] || PALETTES.dusk;
  const canvas = document.createElement('canvas'); canvas.className = 'lake-canvas';
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'A quiet pond at the end of a little wooden dock, beside your house');
  container.appendChild(canvas);
  const engine = new Engine(canvas, true, { alpha: true, stencil: false, powerPreference: 'high-performance' });
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));
  const scene = new Scene(engine); scene.useRightHandedSystem = true;
  scene.clearColor = new Color4(0, 0, 0, 0);
  scene.skipPointerMovePicking = true; scene.skipPointerDownPicking = true; scene.skipPointerUpPicking = true;
  scene.imageProcessingConfiguration.toneMappingEnabled = true; scene.imageProcessingConfiguration.toneMappingType = 1; scene.imageProcessingConfiguration.exposure = palette.exposure;
  const camera = new TargetCamera('lake-camera', VIEW.scale(60).addInPlace(LOOK), scene);
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA; camera.minZ = .1; camera.maxZ = 140; camera.setTarget(LOOK);
  const skyLight = new HemisphericLight('lake-sky', new Vector3(0, 1, 0), scene);
  skyLight.intensity = palette.ambient; skyLight.diffuse = Color3.FromHexString(palette.sky); skyLight.groundColor = Color3.FromHexString(palette.ground); skyLight.specular = Color3.Black();
  const sun = new DirectionalLight('lake-sun', SUN, scene); sun.position = SUN.scale(-40);
  sun.intensity = palette.sun; sun.diffuse = Color3.FromHexString(palette.sunTint); sun.specular = Color3.Black();
  sun.shadowMinZ = 1; sun.shadowMaxZ = 90; sun.autoUpdateExtends = false;
  sun.orthoLeft = -18; sun.orthoRight = 18; sun.orthoTop = 18; sun.orthoBottom = -18;
  const shadow = new ShadowGenerator(2048, sun); shadow.usePercentageCloserFiltering = true; shadow.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  shadow.bias = .002; shadow.normalBias = .02; shadow.darkness = palette.shade;
  const lamp = new PointLight('lake-lamplight', new Vector3(-.4, 2.3, 4.4), scene);
  lamp.diffuse = Color3.FromHexString('#ffc47e'); lamp.specular = Color3.Black(); lamp.intensity = palette.lamp; lamp.range = 7; lamp.setEnabled(palette.lamp > 0);
  const glow = new GlowLayer('lake-glow', scene, { mainTextureFixedSize: 512, blurKernelSize: 32 }); glow.intensity = palette.glow;

  const water = new Mesh('lake-water', scene); Object.assign(new VertexData(), lakeWater()).applyToMesh(water);
  const waterPaint = new ShaderMaterial('lake-water-paint', scene, { vertexSource: WATER_VERTEX, fragmentSource: WATER_FRAGMENT }, { attributes: ['position'], uniforms: ['world', 'viewProjection', 'time', 'eye', 'deep', 'shallow', 'skyLow', 'skyMid', 'glint', 'sunDir', 'ripples'] });
  waterPaint.setColor3('deep', Color3.FromHexString(palette.deep)); waterPaint.setColor3('shallow', Color3.FromHexString(palette.shallow));
  waterPaint.setColor3('skyLow', Color3.FromHexString(palette.skyLow)); waterPaint.setColor3('skyMid', Color3.FromHexString(palette.skyMid));
  waterPaint.setColor3('glint', Color3.FromHexString(palette.glint)); waterPaint.setVector3('sunDir', SUN.scale(-1));
  waterPaint.backFaceCulling = false; water.material = waterPaint; water.isPickable = false;
  const ripples = new Array(40).fill(0); let nextRipple = 2;
  const ripple = (x, z, strength = 1, slot) => { const i = slot ?? nextRipple; if (slot === undefined) nextRipple = 2 + (nextRipple - 1) % 8; ripples.splice(i * 4, 4, x, z, clock, strength); };

  const baked = [], glowing = [];
  let into = baked, housing = false;
  const paint = (mesh, hex, strength = 1) => {
    mesh.computeWorldMatrix(true); const data = VertexData.ExtractFromMesh(mesh); data.transform(mesh.getWorldMatrix()); mesh.dispose(); data.uvs = null;
    if (housing && strength > 1) { glowing.push(data); return; }
    const c = Color3.FromHexString(hex).scale(strength), count = data.positions.length / 3; data.colors = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) data.colors.set([c.r, c.g, c.b, 1], i * 4);
    into.push(data);
  };
  const box = (x, y, z, w, h, d, hex, rot = [0, 0, 0], strength = 1) => { const m = MeshBuilder.CreateBox('p', { width: w, height: h, depth: d }, scene); m.position.set(x, y, z); m.rotation.set(...rot); paint(m, hex, strength); };
  const ball = (x, y, z, w, h, d, hex, segments = 8, strength = 1, tilt = 0) => { const m = MeshBuilder.CreateSphere('p', { diameter: 1, segments }, scene); m.position.set(x, y, z); m.scaling.set(w, h, d); m.rotation.z = tilt; paint(m, hex, strength); };
  const cyl = (x, y, z, top, bottom, h, hex, rot = [0, 0, 0], tessellation = 10, strength = 1) => { const m = MeshBuilder.CreateCylinder('p', { diameterTop: top, diameterBottom: bottom, height: h, tessellation }, scene); m.position.set(x, y, z); m.rotation.set(...rot); paint(m, hex, strength); };
  const asset = (name, at) => baked.push(Object.assign(new VertexData(), placeAsset(name, at)));
  const api = {
    box: (x, y, z, w, h, d, hex, tilt = 0, strength = 1) => box(x, y, z, w, h, d, hex, Array.isArray(tilt) ? tilt : [0, 0, tilt], strength),
    ball: (x, y, z, w, h, d, hex, strength = 1, tilt = 0) => ball(x, y, z, w, h, d, hex, 8, strength, tilt),
    orb: (x, y, z, w, h, d, hex) => ball(x, y, z, w, h, d, hex, w < .12 ? 2 : w < .4 ? 4 : w < .8 ? 6 : 8),
    cylinder: (x, y, z, top, bottom, h, hex) => cyl(x, y, z, top, bottom, h, hex, [0, 0, 0], 12),
    prism: (x, y, z, w, h, d, hex, sideways) => { const m = new Mesh('p', scene); gableData(x, y, z, w, h, d, sideways).applyToMesh(m); paint(m, hex); },
    disc: (x, y, z, diameter, depth, hex, strength = 1, sideways = false) => cyl(x, y, z, diameter, diameter, depth, hex, sideways ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0], 18, strength),
  };
  const tree = (species, x, z, s) => buildGardenTree(api, species, x, z, GROUND - .02, s);
  const boat = (x, z, yaw) => asset('rowboat', { x, y: .2, z, yaw });
  const reeds = (x, z, count, seed) => {
    for (let i = 0; i < count; i++) {
      const dx = (hash(seed + i) - .5) * .8, dz = (hash(seed * 2 + i) - .5) * .5, tall = .55 + hash(seed * 3 + i) * .6, lean = (hash(i + seed * 5) - .5) * .25;
      box(x + dx, tall / 2 - .05, z + dz, .03, tall, .03, palette.leaf[i % 3], [lean, 0, (hash(i * 7 + seed) - .5) * .25]);
      if (i % 3 === 0) ball(x + dx + lean * .1, tall - .12, z + dz, .06, .2, .06, '#7a553c', 6);
    }
  };
  const rock = (x, y, z, s, seed) => ball(x, y + .1 * s, z, s * (1.1 + hash(seed) * .3), s * (.44 + hash(seed * 3) * .2), s * (.9 + hash(seed * 5) * .25), palette.stone[Math.abs(seed) % 3], s > 1.2 ? 10 : 6);
  const shrub = (x, y, z, s, seed = 0) => { for (let i = 0; i < 4; i++) { const a = i * 2.3 + seed; ball(x + Math.cos(a) * .28 * s * (i > 0), y + (.32 - (i > 0) * .08) * s, z + Math.sin(a) * .22 * s * (i > 0), (i ? .62 : .8) * s, (i ? .5 : .66) * s, (i ? .58 : .76) * s, palette.leaf[Math.abs(i + seed) % 3], 7); } };

  const flowers = (x, z, count, seed) => {
    const tint = [['#f3c3d0', '#f9e2e7'], ['#f6e3a8', '#fff3cf'], ['#c9b8e6', '#e4d9f4'], ['#f7f1e6', '#fdf9f1']][seed % 4];
    ball(x, .14, z, .8, .36, .7, palette.leaf[seed % 3], 7);
    for (let i = 0; i < count; i++) { const a = i * 2.4 + seed, r = .1 + hash(i + seed * 9) * .26; ball(x + Math.cos(a) * r, .32 + hash(i * 5 + seed) * .1, z + Math.sin(a) * r * .8, .17, .13, .17, tint[i % 2], 4, 1.12); }
  };
  const picket = (from, to, count) => {
    for (let i = 0; i <= count; i++) { const t = i / count, x = from[0] + (to[0] - from[0]) * t, z = from[1] + (to[1] - from[1]) * t; box(x, .45, z, .09, .62, .09, FENCE[0]); box(x, .78, z, .12, .05, .12, FENCE[1]); }
    const yaw = -Math.atan2(to[1] - from[1], to[0] - from[0]), mx = (from[0] + to[0]) / 2, mz = (from[1] + to[1]) / 2, length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    for (const y of [.36, .62]) box(mx, y, mz, length, .06, .07, FENCE[0], [0, yaw, 0]);
  };
  const bench = (x, z, yaw) => {
    for (const dz of [-.12, .02, .16]) box(x + Math.sin(yaw) * dz, .46, z + Math.cos(yaw) * dz, 1.3, .05, .1, '#b98d63', [0, yaw, 0]);
    box(x - Math.sin(yaw) * .22, .72, z - Math.cos(yaw) * .22, 1.3, .22, .05, '#a97f58', [.2, yaw, 0]);
    for (const side of [-.55, .55]) box(x + Math.cos(yaw) * side, .22, z - Math.sin(yaw) * side, .07, .44, .4, '#6f5240', [0, yaw, 0]);
  };

  const homeParts = [];
  if (house?.rooms?.length) {
    into = homeParts; housing = true; const litFrom = glowing.length;
    buildClosedHouse(api, house, theme);
    into = baked; housing = false;
    let left = Infinity, right = -Infinity;
    for (const { positions } of homeParts) for (let i = 0; i < positions.length; i += 3) { left = Math.min(left, positions[i]); right = Math.max(right, positions[i]); }
    const seat = Matrix.Translation(-(left + right) / 2, GROUND - .03, 0).multiply(Matrix.RotationY(HOUSE_SPOT.yaw)).multiply(Matrix.Translation(HOUSE_SPOT.x, 0, HOUSE_SPOT.z));
    for (const data of [...homeParts, ...glowing.slice(litFrom)]) data.transform(seat);
  }

  baked.push(Object.assign(new VertexData(), createLakeBank(palette)), Object.assign(new VertexData(), createLakeGrass(palette)));
  tree('willow', ...rim(3.2, 1.2), 1.55);
  for (const [a, k, s, species] of TREES) tree(species, ...rim(a, k), s);
  picket(rim(.05, 1.26), rim(.45, 1.24), 8);
  const stones = [[-2.95, -2.3], [-1.75, -1.2], [-.95, -.35], [.3, 1.05], [2.15, 2.75]];
  stones.forEach(([from, to], run) => { for (let a = from, i = 0; a < to; a += .09 + hash(i + run * 17) * .07, i++) { const [x, z] = rim(a, 1 + (hash(i * 5 + run) - .5) * .06); rock(x, -.12, z, .45 + hash(i * 3 + run * 7) * .5, i + run); } });
  const lip = rim(-2.05, 1.1), toward = [(POND.x - lip[0]), (POND.z - lip[1])].map((v, _, d) => v / Math.hypot(...d)), across = [-toward[1], toward[0]];
  const ledge = (u, v, y, s, seed) => rock(lip[0] + across[0] * u + toward[0] * v, y, lip[1] + across[1] * u + toward[1] * v, s * .85, seed);
  for (const [u, v, y, s] of [[0, -2.6, .7, 2.6], [-1.9, -1.6, .45, 2.2], [1.9, -1.7, .5, 2.3], [-1.45, -.2, -.25, 1.9], [1.5, -.3, -.2, 2], [-3, -.6, -.3, 1.8], [3.1, -.8, -.3, 1.7], [-3.4, -2.4, .1, 2], [3.3, -2.6, .15, 2.1]]) ledge(u, v, y, s, Math.round(u * 3 + v * 7 + 20));
  for (const [u, v, s] of [[-1.1, .9, .7], [1.2, 1, .8], [-2.2, 1.2, .55], [2.3, 1.1, .5], [-.6, 1.5, .35]]) ledge(u, v, -.15, s, Math.round(u * 5 + 11));
  for (const [u, v, s] of [[-2.3, -2.2, .9], [2.4, -2.4, 1], [0, -3.6, 1.3], [-3.6, -2, .8]]) shrub(lip[0] + across[0] * u + toward[0] * v, 1.3, lip[1] + across[1] * u + toward[1] * v, s, Math.round(u));
  { const [x, z] = [4.7, -8.3]; ball(x, -.2, z, 3.4, .8, 2.5, palette.sand, 14); ball(x, -.05, z, 2.8, .75, 2, palette.grass, 14); rock(x - 1.3, -.05, z + .8, .5, 1); rock(x + 1.4, -.05, z + .5, .4, 2); tree('cherry', x + .2, z - .2, .7); flowers(x - .6, z + .5, 8, 2); }
  for (const [a, k, n] of [[2.75, 1, 12], [.55, .98, 9], [-.2, .99, 8], [-2.45, 1, 10]]) { const [x, z] = rim(a, k); reeds(x, z, n, Math.round(a * 10)); }
  for (const [x, z, n, seed] of [[-5.6, 3.6, 12, 2], [-3.4, 5.2, 9, 3], [-7.2, -7.4, 10, 0], [-1.3, -9.9, 9, 1], [8.6, 1.4, 12, 2], [10.2, -1.8, 9, 3], [-10.2, .2, 10, 1], [-1.6, -11.6, 10, 2], [11.2, -9.4, 9, 0]]) flowers(x, z, n, seed);
  const pads = [[-2.2, -1.3, .42], [-3.1, -2.4, .34], [-1.3, -3.4, .3], [2.4, -1.8, .4], [3.2, -3, .3], [-4.2, 0, .36], [4.4, .6, .32], [-5.5, -4.3, .45], [6.2, -4.6, .38], [-.4, -6.8, .3], [-2.6, -7.2, .4], [1.9, -8.4, .36]];
  pads.forEach(([x, z, r], i) => {
    cyl(x, .045, z, r * 2, r * 2, .02, palette.leaf[i % 3], [0, 0, 0], 16);
    if (i % 3 === 0) { for (let p = 0; p < 7; p++) { const a = p / 7 * Math.PI * 2; ball(x + Math.cos(a) * .08, .12, z + Math.sin(a) * .08, .12, .1, .08, p % 2 ? '#f3c3d0' : '#f9dde4', 6, 1.08); } ball(x, .15, z, .08, .06, .08, '#f4d88a', 6); }
  });
  const plank = ['#b98d63', '#a97f58', '#c49a6e'];
  for (let z = .9; z < 5.4; z += .27) box((hash(z * 13) - .5) * .03, DOCK_Y - .02, z, 1.4 + (hash(z * 7) - .5) * .06, .06, .24, plank[Math.round(z * 11) % 3]);
  for (const side of [-1, 1]) {
    box(side * .66, DOCK_Y - .1, 3.1, .08, .08, 4.5, '#8d6849');
    for (const z of [1, 3]) cyl(side * .72, DOCK_Y / 2 - .25, z, .16, .18, DOCK_Y + .7, '#6f5240');
  }
  const posts = [[-.72, 1.02], [-.72, 5.2], [.72, 5.2], [-3.4, 4.9]];
  for (const [x, z] of posts) { cyl(x, .95, z, .09, .11, 1.9, '#6f5240'); box(x, 1.93, z, .16, .05, .16, '#4f3d31'); }
  box(1.25, .75, 5.5, .08, 1.1, .08, '#6f5240'); box(1.25, 1.18, 5.52, .95, .42, .07, '#b98d63', [0, -.25, 0]); box(1.25, 1.18, 5.56, .8, .3, .02, '#e8d6b8', [0, -.25, 0]);
  POND_PATH.forEach(([x, z], i) => cyl(x, .17, z, .5, .52, .05, ['#e3d7c1', '#d6c8ae'][i % 2], [0, 0, 0], 16));
  for (const [x, z, s] of [[4.2, 4.6, 1.2], [-6.6, 4.4, 1.1], [7.4, 3.2, .9]]) shrub(x, GROUND - .05, z, s * .8, Math.round(x));
  boat(1.75, 2.6, .5); bench(-4.6, 3.9, -.35);
  const tackle = [.46, DOCK_Y + .09, 2.15];
  box(tackle[0], tackle[1], tackle[2], .36, .18, .24, '#6f8f86', [0, .2, 0]); box(tackle[0], tackle[1] + .1, tackle[2], .38, .03, .26, '#5a766e', [0, .2, 0]);
  cyl(-.42, DOCK_Y + .14, 2.3, .38, .3, .28, '#c7a36f'); cyl(-.42, DOCK_Y + .28, 2.3, .4, .4, .03, '#a4804f');
  const sceneryPaint = new StandardMaterial('lake-scenery-paint', scene); sceneryPaint.specularColor.setAll(0);
  const batchOf = (name, parts) => {
    const mesh = new Mesh(name, scene), merged = parts.shift(); merged.merge(parts, true); merged.applyToMesh(mesh);
    mesh.material = sceneryPaint; mesh.useVertexColors = true; mesh.isPickable = false; mesh.receiveShadows = true; mesh.freezeWorldMatrix();
    return mesh;
  };
  const scenery = batchOf('lake-scenery', baked), home = homeParts.length ? batchOf('lake-house', homeParts) : null;
  const framing = [{ points: scenery.getVerticesData('position') }, ...(home ? [{ points: home.getVerticesData('position') }] : [])];
  const rest = { x: 0, y: 0, span: 10 }, aim = { x: 0, y: 0, span: 5.6 }, focusAt = new Vector3();
  const fit = () => {
    const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight), top = 76, bottom = 96, side = 12;
    const usableHeight = Math.max(120, height - top - bottom), frame = houseFrame(framing, camera.getViewMatrix(true), (width - side * 2) / usableHeight, .98), scale = frame.height / usableHeight;
    rest.x = frame.x; rest.y = frame.y + (top - bottom) * scale / 2; rest.span = height * scale;
  };
  fit();
  const view = { ...rest };

  const fallPath = [[-2.4, 1.62], [-1.2, 1.6], [0, 1.55]];
  for (let i = 1; i <= 12; i++) { const t = i / 12; fallPath.push([.2 * t + .95 * t * t, 1.55 * (1 - t ** 1.5) - .04]); }
  const fall = { positions: [], uvs: [], indices: [] }, COLS = 8;
  fallPath.forEach(([out, y], i) => {
    const t = Math.max(0, i - 2) / 12, width = 1.3 + t * .45;
    for (let c = 0; c <= COLS; c++) {
      const u = c / COLS, side = (u - .5) * width, bow = Math.sin(u * Math.PI) * .12 * t;
      fall.positions.push(lip[0] + toward[0] * (out + bow) + across[0] * side, y, lip[1] + toward[1] * (out + bow) + across[1] * side); fall.uvs.push(u, i / (fallPath.length - 1));
      if (i && c) { const n = i * (COLS + 1) + c; fall.indices.push(n - COLS - 2, n - 1, n - COLS - 1, n - COLS - 1, n - 1, n); }
    }
  });
  const pool = { positions: [], uvs: [], indices: [] }, [px, pz] = [lip[0] + toward[0] * 1.3, lip[1] + toward[1] * 1.3];
  for (let r = 0; r <= 4; r++) for (let j = 0; j <= 24; j++) {
    const a = j / 24 * Math.PI * 2, k = r / 4 * 1.5;
    pool.positions.push(px + Math.cos(a) * k * 1.2, .05, pz + Math.sin(a) * k * .8); pool.uvs.push(j / 24, r / 4);
    if (r && j) { const n = r * 25 + j; pool.indices.push(n - 26, n - 1, n - 25, n - 25, n - 1, n); }
  }
  const fallPaints = [0, 1].map(isPool => {
    const m = new ShaderMaterial(`lake-fall-paint-${isPool}`, scene, { vertexSource: FALL_VERTEX, fragmentSource: FALL_FRAGMENT }, { attributes: ['position', 'uv'], uniforms: ['viewProjection', 'time', 'pool', 'deep', 'shallow', 'foam'], needAlphaBlending: true });
    m.setFloat('pool', isPool); m.setColor3('deep', Color3.FromHexString(palette.deep)); m.setColor3('shallow', Color3.FromHexString(palette.shallow)); m.setColor3('foam', Color3.FromHexString('#f4fbf8').scale(palette.light)); m.backFaceCulling = false;
    return m;
  });
  [fall, pool].forEach((shape, isPool) => { const mesh = new Mesh(isPool ? 'lake-fall-pool' : 'lake-fall', scene); Object.assign(new VertexData(), shape).applyToMesh(mesh); mesh.material = fallPaints[isPool]; mesh.isPickable = false; mesh.freezeWorldMatrix(); });

  const light = (mesh, x, y, z) => { mesh.position.set(x, y, z); mesh.computeWorldMatrix(true); const data = VertexData.ExtractFromMesh(mesh); data.transform(mesh.getWorldMatrix()); mesh.dispose(); data.uvs = null; glowing.push(data); };
  const wires = [];
  for (const [from, to] of [[posts[0], posts[1]], [posts[1], posts[2]], [posts[1], posts[3]]]) {
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]), count = Math.max(4, Math.round(length / .34)), wire = [];
    for (let i = 0; i <= count; i++) {
      const t = i / count, x = from[0] + (to[0] - from[0]) * t, z = from[1] + (to[1] - from[1]) * t, y = 1.9 - Math.sin(t * Math.PI) * length * .09;
      wire.push(new Vector3(x, y, z));
      if (i && i < count) light(MeshBuilder.CreateSphere('p', { diameter: .085, segments: 4 }, scene), x, y - .06, z);
    }
    wires.push(wire);
  }
  for (const [x, z] of posts) light(MeshBuilder.CreateSphere('p', { diameter: .19, segments: 6 }, scene), x, 2.06, z);
  const lanternGlow = new Mesh('lake-lantern', scene), litMerged = glowing.shift(); litMerged.merge(glowing, true); litMerged.applyToMesh(lanternGlow);
  const lanternPaint = new StandardMaterial('lake-lantern-paint', scene); lanternPaint.disableLighting = true; lanternPaint.emissiveColor = Color3.FromHexString(palette.lit);
  lanternGlow.material = lanternPaint; lanternGlow.isPickable = false; lanternGlow.freezeWorldMatrix();
  const wire = MeshBuilder.CreateLineSystem('lake-wires', { lines: wires }, scene); wire.color = Color3.FromHexString('#4f3d31'); wire.alpha = .7; wire.isPickable = false; wire.freezeWorldMatrix();

  const motes = MeshBuilder.CreateSphere('lake-motes', { diameter: theme === 'dusk' ? .06 : .03, segments: 3 }, scene);
  const motePaint = new StandardMaterial('lake-mote-paint', scene); motePaint.disableLighting = true;
  motePaint.emissiveColor = Color3.FromHexString(theme === 'dusk' ? '#ffe39a' : theme === 'rain' ? '#dfe8ee' : '#fff4d6');
  motes.material = motePaint; motes.isPickable = false; motes.alwaysSelectAsActiveMesh = true;
  const MOTES = theme === 'rain' ? 90 : 48, moteMatrix = new Float32Array(MOTES * 16), moteSeeds = Array.from({ length: MOTES }, (_, i) => [(hash(i) - .5) * 20, .3 + hash(i * 2) * 2.4, 5 - hash(i * 3) * 16]);
  for (let i = 0; i < MOTES; i++) { const n = i * 16; moteMatrix[n] = moteMatrix[n + 5] = moteMatrix[n + 10] = moteMatrix[n + 15] = 1; if (theme === 'rain') moteMatrix[n + 5] = 9; }
  motes.thinInstanceSetBuffer('matrix', moteMatrix, 16, false);
  glow.addIncludedOnlyMesh(lanternGlow);

  const companion = createMobileCompanion(scene, avatar);
  const joints = companion.root.getChildMeshes().find(mesh => mesh.metadata?.rig).metadata.rig.joints;
  companion.contact.setEnabled(false);
  const pose = { x: STAND.x, z: STAND.z, yaw: 0, step: 0, moving: false, sit: 0, seatHeight: .5, doze: 0, activity: 'fish', activityTime: 0, atDesk: false, preview: null, reach: null, grip: new Vector3(.2, 1.05, -.36) };
  let petModel = null;
  try { petModel = createPetModel(scene, pet); petModel.root.position.set(.66, DOCK_Y - .01, 1.45); petModel.root.rotation.y = -.25; petModel.root.scaling.setAll(.85); petModel.contact?.setEnabled(false); } catch { petModel = null; }
  const petPose = { action: 'sit', moving: false, petAge: Infinity, walked: 0, x: .66, z: 1.45, yaw: -.25, hearts: [] };
  shadow.getShadowMap().renderList = [scenery, ...(home ? [home] : []), ...companion.root.getChildMeshes(), ...(petModel ? petModel.root.getChildMeshes() : [])];

  const rodPaint = new StandardMaterial('lake-rod-paint', scene); rodPaint.diffuseColor = Color3.FromHexString('#7a5238'); rodPaint.specularColor.setAll(.15);
  const ROD_POINTS = 12, rodPath = Array.from({ length: ROD_POINTS }, () => new Vector3()), rodRadius = (_, d) => .022 * (1 - d / 2.3) + .004;
  let rod = MeshBuilder.CreateTube('lake-rod', { path: rodPath.map((p, i) => p.set(0, i * .2, 0)), radiusFunction: rodRadius, tessellation: 6, updatable: true }, scene);
  rod.material = rodPaint; rod.parent = companion.root; rod.isPickable = false; rod.alwaysSelectAsActiveMesh = true;
  const reel = MeshBuilder.CreateCylinder('lake-reel', { diameter: .1, height: .06, tessellation: 12 }, scene);
  const reelPaint = new StandardMaterial('lake-reel-paint', scene); reelPaint.diffuseColor = Color3.FromHexString('#c9b27c'); reel.material = reelPaint; reel.parent = companion.root;
  const bobber = new TransformNode('lake-bobber', scene);
  const bobTop = MeshBuilder.CreateSphere('lake-bobber-top', { diameter: .15, segments: 8, slice: .5 }, scene), bobBottom = bobTop.clone('lake-bobber-bottom');
  const red = new StandardMaterial('lake-bobber-red', scene); red.diffuseColor = Color3.FromHexString('#e0584a'); red.emissiveColor = Color3.FromHexString('#5a1c16');
  const white = new StandardMaterial('lake-bobber-white', scene); white.diffuseColor = Color3.FromHexString('#f6efe4'); white.emissiveColor = Color3.FromHexString('#3a3530');
  bobTop.material = red; bobBottom.material = white; bobBottom.rotation.x = Math.PI; bobTop.parent = bobBottom.parent = bobber;
  const antenna = MeshBuilder.CreateCylinder('lake-bobber-stick', { diameter: .018, height: .12 }, scene); antenna.position.y = .1; antenna.material = red; antenna.parent = bobber;
  const LINE_POINTS = 16, linePoints = Array.from({ length: LINE_POINTS }, () => new Vector3());
  let line = MeshBuilder.CreateLines('lake-line', { points: linePoints, updatable: true }, scene);
  line.color = Color3.FromHexString('#f4efe6'); line.alpha = .75; line.isPickable = false; line.alwaysSelectAsActiveMesh = true;

  const drops = MeshBuilder.CreateSphere('lake-spray', { diameter: .07, segments: 3 }, scene);
  const dropPaint = new StandardMaterial('lake-spray-paint', scene); dropPaint.disableLighting = true; dropPaint.emissiveColor = new Color3(.92, .97, 1); dropPaint.alpha = .9;
  drops.material = dropPaint; drops.isPickable = false; drops.alwaysSelectAsActiveMesh = true;
  const DROPS = 90, dropMatrix = new Float32Array(DROPS * 16), spray = Array.from({ length: DROPS }, () => ({ life: 0, p: new Vector3(), v: new Vector3(), s: 1 }));
  drops.thinInstanceSetBuffer('matrix', dropMatrix, 16, false);
  const sparkles = MeshBuilder.CreatePolyhedron('lake-sparkles', { type: 1, size: .026 }, scene);
  const sparklePaint = new StandardMaterial('lake-sparkle-paint', scene); sparklePaint.disableLighting = true; sparklePaint.emissiveColor = Color3.White();
  sparkles.material = sparklePaint; sparkles.isPickable = false; sparkles.alwaysSelectAsActiveMesh = true;
  const SPARKS = 48, sparkMatrix = new Float32Array(SPARKS * 16), sparks = Array.from({ length: SPARKS }, () => ({ life: 0, p: new Vector3(), v: new Vector3(), spin: 0 }));
  sparkles.thinInstanceSetBuffer('matrix', sparkMatrix, 16, false);
  const splash = (at, count, power = 1) => {
    let made = 0;
    for (const drop of spray) {
      if (drop.life > 0) continue;
      const a = clockRandom() * Math.PI * 2, out = (.4 + clockRandom() * .9) * power;
      drop.life = .6 + clockRandom() * .5; drop.s = .5 + clockRandom() * .9; drop.p.copyFrom(at); drop.p.y = .02;
      drop.v.set(Math.cos(a) * out, (1.6 + clockRandom() * 1.8) * power, Math.sin(a) * out);
      if (++made >= count) break;
    }
  };
  const burst = (at, hex, count) => {
    sparklePaint.emissiveColor = Color3.FromHexString(hex).scale(1.2); let made = 0;
    for (const spark of sparks) {
      if (spark.life > 0) continue;
      const a = clockRandom() * Math.PI * 2, b = (clockRandom() - .3) * Math.PI, s = .6 + clockRandom() * 1.4;
      spark.life = 1 + clockRandom() * .8; spark.p.copyFrom(at); spark.v.set(Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s + .4, Math.sin(a) * Math.cos(b) * s); spark.spin = clockRandom() * 6;
      if (++made >= count) break;
    }
  };

  let fish = null;
  const buildFish = (id, size) => buildFishModel(scene, speciesOf(id), size, glow);
  const shadow = MeshBuilder.CreateDisc('lake-fish-shadow', { radius: .5, tessellation: 20 }, scene);
  const shadowPaint = new StandardMaterial('lake-fish-shadow-paint', scene); shadowPaint.disableLighting = true; shadowPaint.emissiveColor = Color3.FromHexString(palette.deep).scale(.22); shadowPaint.alpha = 0; shadowPaint.backFaceCulling = false;
  const shadowTail = MeshBuilder.CreateDisc('lake-fish-shadow-tail', { radius: .24, tessellation: 3 }, scene); shadowTail.parent = shadow; shadowTail.position.x = -.52; shadowTail.rotation.z = Math.PI; shadowTail.material = shadowPaint;
  shadow.material = shadowPaint; shadow.rotation.x = Math.PI / 2; shadow.scaling.set(1, .34, 1); shadow.isPickable = shadowTail.isPickable = false; shadow.setEnabled(false);
  const lurk = { from: new Vector3(), at: new Vector3(), heading: 0, start: 0, end: 0, nibbleAt: -9, fade: 0, size: .8 };
  const tip = new Vector3(), tipLocal = new Vector3(), base = new Vector3(), dir = new Vector3(), bend = new Vector3(), bobberAt = new Vector3(), castFrom = new Vector3(), castTo = new Vector3(), reelFrom = new Vector3(), hover = new Vector3(), world = new Matrix();
  let clock = 0, phase = 'idle', phaseAt = 0, leapDone = null, castDone = null, rise = 4, catchInfo = null, stowAt = -1, jumpAt = -9, jumps = 0, fidget = null, fidgetAt = 5, fidgets = 0;
  const struggle = { tension: 0, line: 1, pull: 0, mood: 'tug', holding: false };
  const away = new Vector3();
  const setPhase = next => { phase = next; phaseAt = clock; };
  const lively = { weight: 1, reactAt: -9, part: 'catch' };
  const FIDGETS = ['jig', 'pet', 'jig', 'look', 'bounce'];
  const fidgetK = span => fidget ? Math.max(0, Math.sin(Math.min(1, (clock - fidget.at) / span) * Math.PI)) : 0;
  let last = performance.now(), disposed = false;

  function rodShape(t) {
    const p = t - phaseAt;
    let theta = .8 + (reducedMotion ? 0 : Math.sin(clock * .8) * .03), flex = .05, lift = 0;
    const jig = fidget?.kind === 'jig' ? fidgetK(.8) : 0;
    if (phase === 'cast') {
      if (p < .55) { const k = ease(p / .55); theta = .8 - k * 1.35; lift = k; flex = -.08 * k; }
      else if (p < .9) { const k = easeOut((p - .55) / .35); theta = -.55 + k * 1.85; lift = 1 - k * 1.3; flex = .25 * Math.sin(k * Math.PI); }
      else { const k = ease((p - .9) / .5); theta = 1.3 - k * .3; lift = -.3 + k * .3; flex = .08; }
    } else if (phase === 'wait') { theta = 1 + (reducedMotion ? 0 : Math.sin(clock * .9) * .02) - jig * .22; flex = .1 + jig * .1; lift = jig * .25; }
    else if (phase === 'bite') { theta = .95 + Math.sin(clock * 30) * .02; flex = .38 + Math.sin(clock * 22) * .06; }
    else if (phase === 'reel') { const t = struggle.tension; theta = .72 - t * .22 + (struggle.holding ? 0 : .14); lift = struggle.holding ? .3 : .05; flex = .18 + t * .72 + (reducedMotion ? 0 : Math.sin(clock * (t > .86 ? 40 : 12)) * .03 * (.3 + t)); }
    else if (phase === 'leap') { theta = p < .35 ? .5 : .45; lift = .5; flex = p < .35 ? .7 : .15 * Math.max(0, 1 - (p - .35)); }
    else if (phase === 'escape') { theta = .8 + Math.max(0, .4 - p) * .5; flex = 0; }
    return { theta, flex, lift };
  }

  function update(dt) {
    clock += dt;
    const shape = rodShape(clock);
    pose.grip.set(.2, 1.02 + shape.lift * .3, -.36 + shape.lift * .16);
    pose.activityTime += dt;
    if (!reducedMotion && (phase === 'idle' || phase === 'wait') && clock > fidgetAt) {
      let kind = FIDGETS[fidgets++ % FIDGETS.length];
      if (kind === 'jig' && phase !== 'wait') kind = 'look';
      fidget = { kind, at: clock }; fidgetAt = clock + 5 + clockRandom() * 4;
      if (kind === 'bounce') lively.reactAt = clock;
      if (kind === 'pet') petPose.petAge = 0;
      if (kind === 'jig') ripple(castTo.x, castTo.z, .5, 1);
    }
    if (fidget && clock - fidget.at > 2.6) fidget = null;
    const glance = fidget?.kind === 'pet' ? -.75 : fidget?.kind === 'look' ? .6 : 0;
    pose.glance = glance * fidgetK(2.6) + (phase === 'reel' ? Math.sin(clock * 1.7) * .08 : 0);
    pose.preview = reducedMotion ? null : lively;
    companion.animate(pose, clock, reducedMotion, DOCK_Y);
    if (petModel) { if (petPose.petAge !== Infinity) petPose.petAge += dt; if (petPose.petAge > 4) petPose.petAge = Infinity; petModel.animate(petPose, dt, clock, reducedMotion); }
    const wrist = joints.wristR;
    base.set(wrist.x - .01, wrist.y - .03, wrist.z - .02);
    dir.set(.14, Math.cos(shape.theta), -Math.sin(shape.theta)).normalize();
    bend.set(0, -1, -.35); bend.subtractInPlace(dir.scale(Vector3.Dot(bend, dir))).normalize();
    for (let i = 0; i < ROD_POINTS; i++) {
      const s = i / (ROD_POINTS - 1), along = s * 2.3 - .32;
      rodPath[i].set(base.x + dir.x * along + bend.x * shape.flex * s * s * 1.4, base.y + dir.y * along + bend.y * shape.flex * s * s * 1.4, base.z + dir.z * along + bend.z * shape.flex * s * s * 1.4);
    }
    rod = MeshBuilder.CreateTube('lake-rod', { path: rodPath, radiusFunction: rodRadius, instance: rod });
    reel.position.set(base.x + dir.x * -.12 + .05, base.y + dir.y * -.12, base.z + dir.z * -.12); reel.rotation.set(0, 0, Math.PI / 2);
    tipLocal.copyFrom(rodPath[ROD_POINTS - 1]);
    world.copyFrom(companion.root.computeWorldMatrix(true));
    Vector3.TransformCoordinatesToRef(tipLocal, world, tip);

    const p = clock - phaseAt, bob = reducedMotion ? 0 : Math.sin(clock * 2.2) * .012;
    let slack = .35, visible = true;
    if (phase === 'idle') {
      bobberAt.set(tip.x + (reducedMotion ? 0 : Math.sin(clock * 1.3) * .04), tip.y - .55, tip.z); slack = 0;
    } else if (phase === 'cast') {
      if (p < .72) { bobberAt.set(tip.x, tip.y - .55 + Math.min(.5, p) * .3, tip.z); slack = 0; castFrom.copyFrom(bobberAt); }
      else {
        const k = Math.min(1, (p - .72) / .95);
        Vector3.LerpToRef(castFrom, castTo, k, bobberAt); bobberAt.y = castFrom.y * (1 - k) + Math.sin(k * Math.PI) * 1.6;
        slack = .15;
        if (k >= 1) { bobberAt.y = 0; ripple(castTo.x, castTo.z, 1.2, 0); splash(castTo, 12, .7); setPhase('wait'); castDone?.(); castDone = null; }
      }
    } else if (phase === 'wait') { bobberAt.set(castTo.x, .03 + bob, castTo.z); slack = .5; }
    else if (phase === 'bite') {
      const plunge = .09 + Math.abs(Math.sin(p * 9)) * .06;
      bobberAt.set(castTo.x + Math.sin(p * 17) * .05, -plunge, castTo.z + Math.cos(p * 13) * .04); slack = .05;
      if (Math.floor(p / .33) !== Math.floor((p - dt) / .33)) { ripple(bobberAt.x, bobberAt.z, 1, 1); splash(bobberAt, 5, .45); }
    } else if (phase === 'reel') {
      const reach = .15 + struggle.line * .85, dart = reducedMotion ? 0 : struggle.pull * reach;
      Vector3.LerpToRef(HOME_BOBBER, reelFrom, reach, bobberAt);
      bobberAt.x += Math.sin(clock * 2.3) * .5 * dart + Math.sin(clock * 6.1) * .08 * dart; bobberAt.y = -.03 - struggle.tension * .07;
      if (Math.floor(clock / .45) !== Math.floor((clock - dt) / .45)) ripple(bobberAt.x, bobberAt.z, .5 + struggle.pull, 1);
      if (struggle.mood === 'run' && Math.floor(clock / .28) !== Math.floor((clock - dt) / .28)) splash(bobberAt, 4, .4);
      slack = struggle.holding ? 0 : .12;
      if (fish) {
        away.set(bobberAt.x - STAND.x, 0, bobberAt.z - STAND.z).normalize();
        const u = (clock - jumpAt) / .9, at = fish.root.position, heading = Math.atan2(-away.z, away.x);
        at.set(bobberAt.x + away.x * .3 * fish.scale * 2, 0, bobberAt.z + away.z * .3 * fish.scale * 2);
        if (u >= 0 && u < 1) {
          at.y = -.15 + Math.sin(u * Math.PI) * (.75 + fish.scale * .5);
          fish.root.rotation.set(Math.sin(u * 14) * .25, heading + Math.sin(clock * 3) * .3, Math.cos(u * Math.PI) * 1.1);
          if (Math.floor(u * 10) !== Math.floor((u - dt / .9) * 10) && (u < .12 || u > .85)) { splash(at, 14, .75); ripple(at.x, at.z, 1.2, 0); }
        } else {
          at.y = struggle.mood === 'rest' ? -.32 : -.06 - (1 - struggle.pull) * .12;
          fish.root.rotation.set(Math.sin(clock * 4) * .12, heading + Math.sin(clock * 2.3) * .5 * struggle.pull, 0);
        }
        fish.tail.rotation.y = reducedMotion ? 0 : Math.sin(clock * (8 + struggle.pull * 18)) * (.25 + struggle.pull * .35);
      }
    } else if (phase === 'leap' || phase === 'shown') {
      visible = false; slack = 0;
    } else if (phase === 'escape') {
      const k = ease(p / .8); Vector3.LerpToRef(castTo, tip, k, bobberAt); bobberAt.y = (1 - k) * .05 + k * (tip.y - .55) + Math.sin(k * Math.PI) * .8; slack = .6 * (1 - k);
      if (k >= 1) setPhase('idle');
    }
    bobber.position.copyFrom(bobberAt); bobber.setEnabled(visible);
    for (let i = 0; i < LINE_POINTS; i++) {
      const s = i / (LINE_POINTS - 1), sag = slack * Math.min(2.5, Vector3.Distance(tip, bobberAt)) * .35 * 4 * s * (1 - s);
      Vector3.LerpToRef(tip, visible ? bobberAt : (fish ? fish.root.position : tip), s, linePoints[i]); linePoints[i].y -= sag;
      if (visible) linePoints[i].y = Math.max(linePoints[i].y, bobberAt.y - .01);
    }
    line = MeshBuilder.CreateLines('lake-line', { points: linePoints, instance: line });
    line.setEnabled(phase !== 'shown');

    if (fish && (phase === 'leap' || phase === 'shown')) {
      const k = Math.max(0, Math.min(1, (p - .35) / 1.25));
      if (phase === 'leap' && p < .35) {
        const at = fish.root.position; at.set(reelFrom.x + Math.sin(p * 40) * .06, -.05 + Math.abs(Math.sin(p * 18)) * .12, reelFrom.z);
        fish.root.rotation.set(Math.sin(p * 30) * .5, fish.root.rotation.y, .3);
        if (Math.floor(p / .1) !== Math.floor((p - dt) / .1)) splash(at, 6, .55);
      } else if (phase === 'leap') {
        const at = fish.root.position;
        Vector3.LerpToRef(reelFrom, hover, easeOut(k), at); at.y = reelFrom.y + Math.sin(k * Math.PI) * 1.5 + k * (hover.y - reelFrom.y) * 1;
        const vy = Math.cos(k * Math.PI) * 1.5;
        fish.root.rotation.set(Math.sin(k * 10) * .15, -1.2 + k * 3.2, Math.atan2(vy, 1.8) + (1 - k) * .4);
        if (k < .08 && !fish.splashed) { fish.splashed = true; splash(reelFrom, 30, 1.25); ripple(reelFrom.x, reelFrom.z, 1.6, 0); burst(reelFrom, tierOf(fish.species.tier).color, 16); }
        if (k >= 1) { setPhase('shown'); lively.reactAt = clock; burst(hover, tierOf(fish.species.tier).color, 30); petPose.petAge = 0; leapDone?.(catchInfo); leapDone = null; }
      } else {
        const hoverT = clock - phaseAt, wiggle = reducedMotion ? 0 : 1;
        fish.root.position.set(hover.x, hover.y + Math.sin(hoverT * 2) * .05 * wiggle, hover.z);
        fish.root.rotation.set(0, (reducedMotion ? .9 : .9 + Math.sin(hoverT * .8) * .5), Math.sin(hoverT * 1.7) * .1 * wiggle);
        if (!reducedMotion && Math.floor(hoverT / .7) !== Math.floor((hoverT - dt) / .7)) burst(fish.root.position, tierOf(fish.species.tier).color, 3);
      }
      fish.tail.rotation.y = Math.sin(clock * (phase === 'leap' ? 26 : 8)) * (phase === 'leap' ? .55 : .25) * (reducedMotion ? 0 : 1);
    }
    if (fish && stowAt >= 0) {
      const k = Math.min(1, (clock - stowAt) / .6);
      Vector3.LerpToRef(hover, new Vector3(-.42, DOCK_Y + .3, 2.3), ease(k), fish.root.position); fish.root.scaling.setAll(fish.scale * (1 - k * .8));
      if (k >= 1) { fish.root.dispose(false, true); fish = null; stowAt = -1 }
    }

    let lurking = false;
    if (phase === 'wait' && lurk.end > lurk.start) {
      const k = ease((clock - lurk.start) / (lurk.end - lurk.start)), nudge = clock - lurk.nibbleAt < .5 ? Math.sin((clock - lurk.nibbleAt) / .5 * Math.PI) * .3 : 0;
      const r = 2.2 * (1 - k) + .4 - nudge, swing = (reducedMotion ? 0 : Math.sin(clock * 1.3) * .5) * (1 - k);
      const c = Math.cos(swing), sn = Math.sin(swing);
      lurk.at.set(castTo.x + (lurk.from.x * c - lurk.from.z * sn) * r, 0, castTo.z + (lurk.from.x * sn + lurk.from.z * c) * r);
      lurk.heading = Math.atan2(lurk.at.z - castTo.z, castTo.x - lurk.at.x); lurk.size = .8; lurking = true;
    } else if (phase === 'bite') {
      lurk.at.set(castTo.x + Math.sin(clock * 9) * .06, 0, castTo.z + Math.cos(clock * 7) * .05); lurking = true;
    } else if (phase === 'reel' && fish) {
      lurk.at.set(fish.root.position.x, 0, fish.root.position.z); lurk.heading = fish.root.rotation.y; lurk.size = Math.max(.6, fish.scale * fish.length * 1.3);
      lurking = fish.root.position.y < -.02;
    } else if (phase === 'escape') {
      lurk.at.x += Math.cos(lurk.heading) * dt * 3; lurk.at.z -= Math.sin(lurk.heading) * dt * 3;
    }
    lurk.fade = Math.max(0, Math.min(1, lurk.fade + dt * (lurking ? 2.5 : -3)));
    shadow.setEnabled(lurk.fade > 0);
    if (lurk.fade > 0) {
      shadow.position.set(lurk.at.x, .05, lurk.at.z); shadow.rotation.y = lurk.heading; shadow.scaling.set(lurk.size, lurk.size * .34, 1);
      shadowTail.rotation.x = reducedMotion ? 0 : Math.sin(clock * (phase === 'reel' ? 14 : 6)) * .5;
      shadowPaint.alpha = .58 * lurk.fade;
    }

    const focusing = fish && (phase === 'leap' || phase === 'shown');
    const aspect = engine.getAspectRatio(camera), wide = aspect > 1.1;
    const framed = wide ? cardSide.set(hover.x + .55, hover.y - .05, hover.z - .23) : cardSide.set(hover.x, hover.y - .45, hover.z);
    if (focusing) { Vector3.TransformCoordinatesToRef(framed, camera.getViewMatrix(), focusAt); aim.x = focusAt.x; aim.y = focusAt.y; aim.span = wide ? 8 : 12; }
    const goal = focusing ? aim : rest, rate = reducedMotion ? 1 : 1 - Math.exp(-dt * 2.4);
    for (const key of ['x', 'y', 'span']) view[key] += (goal[key] - view[key]) * rate;
    camera.orthoTop = view.y + view.span / 2; camera.orthoBottom = view.y - view.span / 2;
    camera.orthoLeft = view.x - view.span * aspect / 2; camera.orthoRight = view.x + view.span * aspect / 2;

    let alive = 0;
    for (let i = 0; i < DROPS; i++) {
      const drop = spray[i], n = i * 16;
      if (drop.life > 0) {
        drop.life -= dt; drop.v.y -= 9.8 * dt; drop.p.addInPlace(drop.v.scale(dt));
        if (drop.p.y < 0 && drop.v.y < 0) { drop.life = 0; if (i % 3 === 0) ripple(drop.p.x, drop.p.z, .35); }
        alive++;
      }
      const s = drop.life > 0 ? drop.s : 0;
      dropMatrix[n] = dropMatrix[n + 5] = dropMatrix[n + 10] = s; dropMatrix[n + 15] = 1;
      dropMatrix[n + 12] = drop.p.x; dropMatrix[n + 13] = drop.p.y; dropMatrix[n + 14] = drop.p.z;
    }
    drops.thinInstanceBufferUpdated('matrix'); drops.setEnabled(alive > 0);
    let sparking = 0;
    for (let i = 0; i < SPARKS; i++) {
      const spark = sparks[i], n = i * 16;
      if (spark.life > 0) { spark.life -= dt; spark.v.scaleInPlace(1 - dt * 2.2); spark.v.y += dt * .3; spark.p.addInPlace(spark.v.scale(dt)); sparking++; }
      const s = spark.life > 0 ? Math.min(1, spark.life * 1.5) * (1 + Math.sin(clock * 12 + i) * .3) : 0, c = Math.cos(clock * 3 + spark.spin), sn = Math.sin(clock * 3 + spark.spin);
      sparkMatrix[n] = c * s; sparkMatrix[n + 2] = -sn * s; sparkMatrix[n + 5] = s; sparkMatrix[n + 8] = sn * s; sparkMatrix[n + 10] = c * s; sparkMatrix[n + 15] = 1;
      sparkMatrix[n + 12] = spark.p.x; sparkMatrix[n + 13] = spark.p.y; sparkMatrix[n + 14] = spark.p.z;
    }
    sparkles.thinInstanceBufferUpdated('matrix'); sparkles.setEnabled(sparking > 0);

    for (let i = 0; i < MOTES; i++) {
      const [x, y, z] = moteSeeds[i], n = i * 16;
      if (theme === 'rain') {
        const fall = (y * 3 - clock * 7 + i) % 3.5, h = fall < 0 ? fall + 3.5 : fall;
        moteMatrix[n + 12] = x; moteMatrix[n + 13] = h; moteMatrix[n + 14] = z;
        if (h < .12 && !reducedMotion && i % 4 === 0) ripple(x, z, .3);
      } else {
        moteMatrix[n + 12] = x + (reducedMotion ? 0 : Math.sin(clock * .3 + i * 2) * .5); moteMatrix[n + 13] = y + (reducedMotion ? 0 : Math.sin(clock * .45 + i) * .3); moteMatrix[n + 14] = z + (reducedMotion ? 0 : Math.cos(clock * .27 + i * 3) * .4);
        const twinkle = theme === 'dusk' ? .5 + .5 * Math.sin(clock * 1.6 + i * 2.1) : 1; moteMatrix[n] = moteMatrix[n + 5] = moteMatrix[n + 10] = twinkle;
      }
    }
    motes.thinInstanceBufferUpdated('matrix');
    rise -= dt;
    if (rise < 0 && !reducedMotion) { rise = 2.5 + clockRandom() * 4; ripple((clockRandom() - .5) * 10, -1 - clockRandom() * 7, .7); }

    waterPaint.setFloat('time', clock); waterPaint.setVector3('eye', camera.position); waterPaint.setArray4('ripples', ripples);
    for (const m of fallPaints) m.setFloat('time', clock);
      }

  engine.runRenderLoop(() => {
    if (disposed) return;
    const now = performance.now(), dt = Math.min(.25, (now - last) / 1000); last = now;
    update(dt); scene.render();
  });
  const resize = () => { engine.resize(); fit(); };
  window.addEventListener('resize', resize);

  return {
    cast(target = { x: -.6 + (clockRandom() - .5) * 2.2, z: -4.6 - clockRandom() * 2.2 }) {
      castTo.set(target.x, 0, target.z); setPhase('cast');
      return new Promise(resolve => { castDone = resolve; if (reducedMotion) { phaseAt = clock - 1.7; } });
    },
    approach(ms) {
      const a = clockRandom() * Math.PI * 2; lurk.from.set(Math.cos(a), 0, -Math.abs(Math.sin(a)) - .2).normalize();
      lurk.start = clock; lurk.end = clock + ms / 1000; lurk.heading = Math.atan2(lurk.from.z, -lurk.from.x);
    },
    nibble() { if (phase !== 'wait') return; lurk.nibbleAt = clock; ripple(castTo.x, castTo.z, .45, 1); bobberAt.y -= .03; bobber.position.y -= .04; },
    bite() { if (phase !== 'wait') return; setPhase('bite'); lively.reactAt = clock; petPose.petAge = 0; ripple(castTo.x, castTo.z, 1.2, 1); splash(castTo, 10, .6); },
    hook(rolled) {
      reelFrom.copyFrom(bobber.position); reelFrom.y = 0; setPhase('reel'); splash(reelFrom, 10, .7);
      fish?.root.dispose(false, true); fish = buildFish(rolled.species, rolled.size); fish.root.position.set(reelFrom.x, -.3, reelFrom.z);
      jumps = 0; jumpAt = -9; struggle.line = 1; struggle.tension = 0; lively.reactAt = clock;
    },
    fight(state, holding) {
      struggle.tension = state.tension; struggle.line = state.line; struggle.pull = state.pull; struggle.mood = state.mood; struggle.holding = holding;
      if (state.runs > jumps) { jumps = state.runs; if (!reducedMotion && clock - jumpAt > 1.2) jumpAt = clock; }
    },
    leap(caught) {
      catchInfo = caught;
      if (!fish) fish = buildFish(caught.species, caught.size);
      fish.splashed = false;
      reelFrom.copyFrom(fish.root.position); reelFrom.y = 0; hover.set(STAND.x + .9, DOCK_Y + 1.75, STAND.z - 1.05);
      setPhase('leap');
      return new Promise(resolve => { leapDone = resolve; if (reducedMotion) phaseAt = clock - 1.3; });
    },
    stow() { if (fish) stowAt = clock; setPhase('idle'); },
    escape(snapped = false) {
      if (fish) { splash(fish.root.position, snapped ? 18 : 10, .7); ripple(fish.root.position.x, fish.root.position.z, 1.3, 0); fish.root.dispose(false, true); fish = null; }
      if (phase === 'reel') castTo.copyFrom(bobber.position);
      if (snapped) lively.reactAt = clock;
      lurk.heading += Math.PI;
      setPhase('escape'); splash(castTo, 8, .5);
    },
    reset() { setPhase('idle'); },
    get phase() { return phase; },
    screenPoint() {
      const width = engine.getRenderWidth(), height = engine.getRenderHeight(), at = Vector3.Project(HEAD, Matrix.IdentityReadOnly, scene.getTransformMatrix(), camera.viewport.toGlobal(width, height));
      return { x: at.x * canvas.clientWidth / width, y: at.y * canvas.clientHeight / height };
    },
    diagnostics: () => ({ phase, fish: fish?.species.id ?? null, scene, engine, bobber: bobber.position.asArray() }),
    dispose() {
      disposed = true; window.removeEventListener('resize', resize); engine.stopRenderLoop();
      disposeAvatarTemplates(scene);
      scene.dispose(); engine.dispose(); canvas.remove();
    },
  };
}
