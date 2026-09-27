import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TargetCamera } from '@babylonjs/core/Cameras/targetCamera.js';
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
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer.js';
import '@babylonjs/core/Meshes/thinInstanceMesh.js';
import { createMobileCompanion, disposeAvatarTemplates } from '../../models/furniture.js';
import { createPetModel } from '../pet/index.js';
import { speciesOf, tierOf } from '../../core/fishing.js';
import { clockRandom } from '../../core/test-pins.js';
import { placeAsset } from '../../models/assets.js';

const cardSide = new Vector3(), DOCK_Y = .42, STAND = new Vector3(0, DOCK_Y, 1.35), HOME_BOBBER = new Vector3(-.15, 0, .2);
const PALETTES = {
  dusk: { top: '#2e2a5a', mid: '#8b6d9f', low: '#f2b8a2', sun: '#ffd8a3', sunDir: [-.35, .1, -1], deep: '#34506f', shallow: '#7fa5ad', glint: '#ffe2b8', leaf: ['#7e9d74', '#91ae7e', '#a5c08c'], blossom: ['#e2a9b8', '#eec0c9', '#d696aa'], hill: ['#6f5f8e', '#8a74a2', '#a58bb0'], grass: '#86a36c', meadow: '#7b9863', sand: '#d2b894', trunk: '#6b4f3c', light: 1, stars: 1 },
  day: { top: '#6fa9d8', mid: '#aed5ea', low: '#f5ead6', sun: '#fff6dc', sunDir: [.35, .45, -1], deep: '#3d7b93', shallow: '#95cfc6', glint: '#ffffff', leaf: ['#6f9a60', '#86ad6c', '#a0c282'], blossom: ['#f0b9c6', '#f7d0d7', '#e7a3b6'], hill: ['#8aa9c2', '#a3bdd0', '#bdd0dc'], grass: '#a3c27f', meadow: '#93b572', sand: '#e0cba3', trunk: '#76584a', light: 1, stars: 0 },
  rain: { top: '#56627a', mid: '#8491a3', low: '#c2c9ce', sun: '#e9eef0', sunDir: [0, .35, -1], deep: '#3a5463', shallow: '#76979d', glint: '#eef4f6', leaf: ['#5f7c62', '#708f71', '#84a282'], blossom: ['#c9a2b0', '#d8b6c0', '#bb90a1'], hill: ['#72808f', '#8795a2', '#9eabb5'], grass: '#7f9a74', meadow: '#728d69', sand: '#b9ab94', trunk: '#5e4a3d', light: .84, stars: 0 },
};
const POND = { x: 0, z: -3.2, rx: 8.6, rz: 7.2 }, HEAD = new Vector3(STAND.x, DOCK_Y + 2.45, STAND.z), FOCUS_EYE = new Vector3(3.3, 3.1, 7.6);
const rim = (a, k) => [POND.x + Math.cos(a) * POND.rx * k, POND.z + Math.sin(a) * POND.rz * k];
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
  float fog = smoothstep(16., 42., length(vWorld.xz - eye.xz));
  gl_FragColor = vec4(mix(col, skyLow, fog * .85), 1.);
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
const SKY_VERTEX = `precision highp float;
attribute vec3 position; uniform mat4 worldViewProjection; varying vec3 vDir;
void main() { vDir = position; gl_Position = worldViewProjection * vec4(position, 1.); }`;
const SKY_FRAGMENT = `precision highp float;
varying vec3 vDir; uniform vec3 top, mid, low, sun, sunDir; uniform float stars, time;
float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
void main() {
  vec3 d = normalize(vDir); float h = d.y;
  vec3 col = h < .12 ? mix(low, mid, smoothstep(-.02, .12, h)) : mix(mid, top, smoothstep(.12, .6, h));
  float s = max(dot(d, normalize(sunDir)), 0.);
  col += sun * (pow(s, 900.) * 1.4 + pow(s, 24.) * .28 + pow(s, 4.) * .08);
  vec3 cell = floor(d * 220.); float star = step(.9975, hash(cell)) * smoothstep(.15, .5, h) * stars;
  col += vec3(1., .95, .85) * star * (.55 + .45 * sin(time * 2. + hash(cell + 3.) * 30.));
  gl_FragColor = vec4(col, 1.);
}`;

export function createLakeScene(container, { theme = 'dusk', avatar, pet = 'cat', reducedMotion = false }) {
  const palette = PALETTES[theme] || PALETTES.dusk;
  const canvas = document.createElement('canvas'); canvas.className = 'lake-canvas';
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'A quiet pond at the end of a little wooden dock');
  container.appendChild(canvas);
  const engine = new Engine(canvas, true, { stencil: false, powerPreference: 'high-performance' });
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));
  const scene = new Scene(engine); scene.useRightHandedSystem = true;
  scene.clearColor = Color4.FromHexString(palette.low + 'ff');
  scene.skipPointerMovePicking = true; scene.skipPointerDownPicking = true; scene.skipPointerUpPicking = true;
  scene.imageProcessingConfiguration.toneMappingEnabled = true; scene.imageProcessingConfiguration.toneMappingType = 1; scene.imageProcessingConfiguration.exposure = 1.08;
  const camera = new TargetCamera('lake-camera', new Vector3(5.6, 7, 16), scene);
  camera.fov = .7; camera.minZ = .1; camera.maxZ = 220;
  const camHome = { eye: camera.position.clone(), look: new Vector3(-.8, -.1, -3.6) }, camLook = camHome.look.clone(), camEye = camHome.eye.clone();
  camera.setTarget(camLook);
  const skyLight = new HemisphericLight('lake-sky', new Vector3(0, 1, 0), scene);
  skyLight.intensity = .78 * palette.light; skyLight.groundColor = Color3.FromHexString(palette.deep).scale(.9); skyLight.diffuse = Color3.FromHexString(palette.mid).scale(.5).add(new Color3(.5, .5, .5));
  const sun = new DirectionalLight('lake-sun', new Vector3(-palette.sunDir[0], -Math.max(.35, palette.sunDir[1]), -palette.sunDir[2]).normalize(), scene);
  sun.intensity = .95 * palette.light; sun.diffuse = Color3.FromHexString(palette.sun);
  const fill = new DirectionalLight('lake-fill', new Vector3(-.45, -.6, -1).normalize(), scene);
  fill.intensity = .62 * palette.light; fill.diffuse = Color3.FromHexString(palette.mid).scale(.45).add(new Color3(.5, .48, .5)); fill.specular = Color3.Black();
  const glow = new GlowLayer('lake-glow', scene, { mainTextureFixedSize: 512, blurKernelSize: 32 }); glow.intensity = theme === 'day' ? .35 : .75;

  const sky = MeshBuilder.CreateSphere('lake-sky-dome', { diameter: 400, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
  const skyPaint = new ShaderMaterial('lake-sky-paint', scene, { vertexSource: SKY_VERTEX, fragmentSource: SKY_FRAGMENT }, { attributes: ['position'], uniforms: ['worldViewProjection', 'top', 'mid', 'low', 'sun', 'sunDir', 'stars', 'time'] });
  for (const key of ['top', 'mid', 'low', 'sun']) skyPaint.setColor3(key, Color3.FromHexString(palette[key]));
  skyPaint.setVector3('sunDir', new Vector3(...palette.sunDir)); skyPaint.setFloat('stars', palette.stars);
  sky.material = skyPaint; sky.isPickable = false; sky.infiniteDistance = true;

  const water = MeshBuilder.CreateGround('lake-water', { width: POND.rx * 2.4, height: POND.rz * 2.4, subdivisions: 64 }, scene); water.position.z = POND.z;
  const waterPaint = new ShaderMaterial('lake-water-paint', scene, { vertexSource: WATER_VERTEX, fragmentSource: WATER_FRAGMENT }, { attributes: ['position'], uniforms: ['world', 'viewProjection', 'time', 'eye', 'deep', 'shallow', 'skyLow', 'skyMid', 'glint', 'sunDir', 'ripples'] });
  waterPaint.setColor3('deep', Color3.FromHexString(palette.deep)); waterPaint.setColor3('shallow', Color3.FromHexString(palette.shallow));
  waterPaint.setColor3('skyLow', Color3.FromHexString(palette.low)); waterPaint.setColor3('skyMid', Color3.FromHexString(palette.mid));
  waterPaint.setColor3('glint', Color3.FromHexString(palette.glint)); waterPaint.setVector3('sunDir', new Vector3(...palette.sunDir));
  water.material = waterPaint; water.isPickable = false;
  const ripples = new Array(40).fill(0); let nextRipple = 2;
  const ripple = (x, z, strength = 1, slot) => { const i = slot ?? nextRipple; if (slot === undefined) nextRipple = 2 + (nextRipple - 1) % 8; ripples.splice(i * 4, 4, x, z, clock, strength); };

  const baked = [];
  const paint = (mesh, hex, strength = 1) => {
    mesh.computeWorldMatrix(true); const data = VertexData.ExtractFromMesh(mesh); data.transform(mesh.getWorldMatrix()); mesh.dispose();
    const c = Color3.FromHexString(hex).scale(strength), count = data.positions.length / 3; data.colors = new Float32Array(count * 4); data.uvs = null;
    for (let i = 0; i < count; i++) data.colors.set([c.r, c.g, c.b, 1], i * 4);
    baked.push(data);
  };
  const box = (x, y, z, w, h, d, hex, rot = [0, 0, 0]) => { const m = MeshBuilder.CreateBox('p', { width: w, height: h, depth: d }, scene); m.position.set(x, y, z); m.rotation.set(...rot); paint(m, hex); };
  const ball = (x, y, z, w, h, d, hex, segments = 8, strength = 1) => { const m = MeshBuilder.CreateSphere('p', { diameter: 1, segments }, scene); m.position.set(x, y, z); m.scaling.set(w, h, d); paint(m, hex, strength); };
  const cyl = (x, y, z, top, bottom, h, hex, rot = [0, 0, 0], tessellation = 10) => { const m = MeshBuilder.CreateCylinder('p', { diameterTop: top, diameterBottom: bottom, height: h, tessellation }, scene); m.position.set(x, y, z); m.rotation.set(...rot); paint(m, hex); };
  const asset = (name, at) => baked.push(Object.assign(new VertexData(), placeAsset(name, at)));
  const tree = (x, z, s, seed, y = 0) => asset(seed % 5 === 2 ? 'tree-pine' : ['tree-round-a', 'tree-round-b', 'tree-round-c'][seed % 3], { x, y, z, yaw: seed * 1.3, scale: s * (seed % 5 === 2 ? 1.6 : 1.9) });
  const blossom = (x, z, s, seed) => asset(['tree-blossom-a', 'tree-blossom-b'][seed % 2], { x, z, yaw: seed, scale: s * 1.8 });
  const willow = (x, z, s) => asset('tree-willow', { x, z, yaw: .6, scale: s * 1.7 });
  const boat = (x, z, yaw) => asset('rowboat', { x, y: .2, z, yaw });
  const reeds = (x, z, count, seed) => {
    for (let i = 0; i < count; i++) {
      const dx = (hash(seed + i) - .5) * .8, dz = (hash(seed * 2 + i) - .5) * .5, tall = .55 + hash(seed * 3 + i) * .6, lean = (hash(i + seed * 5) - .5) * .25;
      box(x + dx, tall / 2 - .05, z + dz, .03, tall, .03, palette.leaf[i % 3], [lean, 0, (hash(i * 7 + seed) - .5) * .25]);
      if (i % 3 === 0) ball(x + dx + lean * .1, tall - .12, z + dz, .06, .2, .06, '#7a553c', 6);
    }
  };
  const rock = (x, z, s, seed) => asset(['rock-a', 'rock-b'][seed % 2], { x, y: -.05, z, yaw: seed * 2.1, scale: s * 1.15 });

  const bank = () => {
    const RINGS = [[.97, -.08, 'sand'], [1.02, .03, 'sand'], [1.07, .1, 'grass'], [1.25, .13, 'grass'], [1.7, .14, 'meadow'], [2.6, .15, 'grass'], [4.5, .15, 'meadow'], [8, .15, 'meadow']], SEG = 120;
    const positions = [], colors = [], indices = [], normals = [];
    for (let r = 0; r < RINGS.length; r++) for (let i = 0; i < SEG; i++) {
      const a = i / SEG * Math.PI * 2, [k, y, tone] = RINGS[r], wobble = r < 3 ? (hash(i * 3.1) - .5) * .04 + Math.sin(a * 5 + 1) * .02 : 0, [x, z] = rim(a, k + wobble);
      const c = Color3.FromHexString(palette[tone]).scale(.95 + hash(i * 7 + r * 31) * .1);
      positions.push(x, y, z); normals.push(0, 1, 0); colors.push(c.r, c.g, c.b, 1);
      if (r) { const n = r * SEG + i, m = r * SEG + (i + 1) % SEG; indices.push(n - SEG, n, m - SEG, m - SEG, n, m); }
    }
    const data = new VertexData(); Object.assign(data, { positions, normals, colors: new Float32Array(colors), indices }); baked.push(data);
  };
  const flowers = (x, z, count, seed) => {
    const tint = [['#f3c3d0', '#f9e2e7'], ['#f6e3a8', '#fff3cf'], ['#c9b8e6', '#e4d9f4'], ['#f7f1e6', '#fdf9f1']][seed % 4];
    ball(x, .14, z, .8, .36, .7, palette.leaf[seed % 3], 7);
    for (let i = 0; i < count; i++) { const a = i * 2.4 + seed, r = .1 + hash(i + seed * 9) * .26; ball(x + Math.cos(a) * r, .32 + hash(i * 5 + seed) * .1, z + Math.sin(a) * r * .8, .17, .13, .17, tint[i % 2], 6, 1.12); }
  };
  const picket = (from, to, count) => {
    for (let i = 0; i <= count; i++) { const t = i / count, x = from[0] + (to[0] - from[0]) * t, z = from[1] + (to[1] - from[1]) * t; box(x, .45, z, .08, .62, .05, '#f3ebdd'); box(x, .78, z, .06, .06, .05, '#f3ebdd', [0, 0, Math.PI / 4]); }
    const yaw = -Math.atan2(to[1] - from[1], to[0] - from[0]), mx = (from[0] + to[0]) / 2, mz = (from[1] + to[1]) / 2, length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    for (const y of [.34, .6]) box(mx, y, mz, length, .05, .03, '#e6dccb', [0, yaw, 0]);
  };
  const cottage = (x, z, yaw, k = 1.45) => {
    const at = (dx, dz) => [x + (Math.cos(yaw) * dx + Math.sin(yaw) * dz) * k, z + (-Math.sin(yaw) * dx + Math.cos(yaw) * dz) * k];
    const [cx, cz] = at(0, 0);
    box(cx, 1.35 * k, cz, 4.4 * k, 2.6 * k, 3.2 * k, '#fbf0dc', [0, yaw, 0]); box(cx, .12 * k, cz, 4.6 * k, .24 * k, 3.4 * k, '#b9a58e', [0, yaw, 0]);
    for (const side of [-1, 1]) { const [rx, rz] = at(0, side * .9); box(rx, 3.2 * k, rz, 4.9 * k, .14 * k, 2.25 * k, '#9a5f55', [side * .72, yaw, 0]); }
    box(cx, 2.8 * k, cz, 4.3 * k, .75 * k, 1.7 * k, '#fbf0dc', [0, yaw, 0]);
    const [chx, chz] = at(1.3, -.5); box(chx, 3.7 * k, chz, .42 * k, 1.1 * k, .42 * k, '#b3796b', [0, yaw, 0]);
    const [dx, dz] = at(-.6, 1.62); box(dx, .85 * k, dz, .75 * k, 1.35 * k, .06 * k, '#8f6a4f', [0, yaw, 0]);
    const [px, pz] = at(-.6, 2.05); box(px, .22 * k, pz, 1.3 * k, .12 * k, .8 * k, '#c9b69c', [0, yaw, 0]);
    return [at(.8, 1.63), at(1.75, 1.63), at(-1.6, 1.63)];
  };
  const bench = (x, z, yaw) => {
    for (const dz of [-.12, .02, .16]) box(x + Math.sin(yaw) * dz, .46, z + Math.cos(yaw) * dz, 1.3, .05, .1, '#b98d63', [0, yaw, 0]);
    box(x - Math.sin(yaw) * .22, .72, z - Math.cos(yaw) * .22, 1.3, .22, .05, '#a97f58', [.2, yaw, 0]);
    for (const side of [-.55, .55]) box(x + Math.cos(yaw) * side, .22, z - Math.sin(yaw) * side, .07, .44, .4, '#6f5240', [0, yaw, 0]);
  };

  bank();
  ball(0, -1.8, -46, 110, 4.4, 24, palette.meadow, 18);
  const haze = Color3.FromHexString(palette.low).scale(.7).add(Color3.FromHexString(palette.mid).scale(.3));
  const ridge = (z, base, rise, crowns, hex, fade, seed, half = 170) => {
    const tone = Color3.Lerp(Color3.FromHexString(hex), haze, fade), foot = tone.scale(.9), positions = [], colors = [], normals = [], indices = [];
    const columns = Math.round(half * 2 / (crowns ? .6 : 2.5));
    let crown = -half, radius = 0, puff = 0;
    for (let i = 0; i <= columns; i++) {
      const x = -half + i * half * 2 / columns;
      if (crowns && x > crown + radius) { crown = x; radius = crowns * (.5 + hash(seed + i) * 1.1); puff = .3 + hash(seed * 3 + i) * .35; }
      const bump = crowns ? Math.sqrt(Math.max(0, 1 - ((x - crown - radius / 2) / (radius / 2)) ** 2)) * radius * puff : 0;
      const top = base + rise * (.55 + .3 * Math.sin(x * .031 + seed) + .15 * Math.sin(x * .087 + seed * 2)) + bump;
      positions.push(x, top, z, x, base - 14, z + 6);
      colors.push(tone.r, tone.g, tone.b, 1, foot.r, foot.g, foot.b, 1);
      normals.push(0, .5, .87, 0, .5, .87);
      if (i) indices.push(i * 2 - 2, i * 2, i * 2 - 1, i * 2 - 1, i * 2, i * 2 + 1);
    }
    baked.push(Object.assign(new VertexData(), { positions, colors, normals, indices }));
  };
  ridge(-140, 3, 9, 0, palette.hill[2], .75, 5, 260);
  ridge(-105, 0, 7, 4, palette.leaf[0], .58, 9, 220);
  ridge(-72, -1, 5, 3, palette.leaf[0], .3, 2, 190);
  ridge(-44, -1.5, 3.2, 2.2, palette.leaf[0], .08, 7, 150);
  const windows = cottage(5.4, -15.8, -.45);
  willow(...rim(3.2, 1.16), 1.1);
  for (const [x, z, s, seed] of [[-7.6, -12.8, 1.1, 0], [-2.6, -14, .85, 4], [9.6, -19, 1.15, 1], [12.2, -8.6, .95, 7], [-12.6, -8, 1, 3]]) tree(x, z, s, seed);
  for (const [x, z, s] of [[-10.3, -11.2, 1.05], [13.4, -12.6, .9]]) asset('tree-pine', { x, z, yaw: x, scale: s * 1.7 });
  for (const [x, z, s, seed] of [[1.2, -16.4, .85, 0], [11.4, -3.6, .8, 1], [-11.4, 4.6, .85, 3]]) blossom(x, z, s, seed);
  asset('tree-fruit', { x: 10.2, z: -14.2, yaw: 1, scale: 1.45 });
  for (const [x, z, s] of [[-18, -22, 1.1], [-12, -25, .95], [16, -23, 1.2], [21, -27, 1]]) tree(x, z, s, Math.round(x));
  picket(rim(-.9, 1.5), rim(-.25, 1.35), 10);
  const stones = [[-2.95, -2.3], [-1.75, -1.2], [-.95, -.35], [.3, 1.05], [2.15, 2.75]];
  stones.forEach(([from, to], run) => { for (let a = from, i = 0; a < to; a += .09 + hash(i + run * 17) * .07, i++) { const [x, z] = rim(a, 1 + (hash(i * 5 + run) - .5) * .06); asset(['rock-a', 'rock-b'][i % 2], { x, y: -.12, z, yaw: i * 2.1, scale: .45 + hash(i * 3 + run * 7) * .5 }); } });
  const lip = rim(-2.05, 1.1), toward = [(POND.x - lip[0]), (POND.z - lip[1])].map((v, _, d) => v / Math.hypot(...d)), across = [-toward[1], toward[0]];
  const ledge = (u, v, y, s, yaw, name = 'rock-b') => asset(name, { x: lip[0] + across[0] * u + toward[0] * v, y, z: lip[1] + across[1] * u + toward[1] * v, yaw, scale: s });
  for (const [u, v, y, s] of [[0, -2.6, .7, 2.6], [-1.9, -1.6, .45, 2.2], [1.9, -1.7, .5, 2.3], [-1.45, -.2, -.25, 1.9], [1.5, -.3, -.2, 2], [-3, -.6, -.3, 1.8], [3.1, -.8, -.3, 1.7], [-3.4, -2.4, .1, 2], [3.3, -2.6, .15, 2.1]]) ledge(u, v, y, s, u * 2.3 + v);
  for (const [u, v, s] of [[-1.1, .9, .7], [1.2, 1, .8], [-2.2, 1.2, .55], [2.3, 1.1, .5], [-.6, 1.5, .35]]) ledge(u, v, -.15, s, u * 3, 'rock-a');
  for (const [u, v, s] of [[-2.3, -2.2, .9], [2.4, -2.4, 1], [0, -3.6, 1.3], [-3.6, -2, .8]]) asset('bush', { x: lip[0] + across[0] * u + toward[0] * v, y: 1.35, z: lip[1] + across[1] * u + toward[1] * v, yaw: u, scale: s });
  { const [x, z] = [4.7, -8.3]; ball(x, -.2, z, 3.4, .8, 2.5, palette.sand, 14); ball(x, -.05, z, 2.8, .75, 2, palette.grass, 14); rock(x - 1.3, z + .8, .5, 1); rock(x + 1.4, z + .5, .4, 2); blossom(x + .2, z - .2, .55, 1); flowers(x - .6, z + .5, 8, 2); }
  for (const [a, k, n] of [[2.75, 1, 12], [.55, .98, 9], [-.2, .99, 8], [-2.45, 1, 10]]) { const [x, z] = rim(a, k); reeds(x, z, n, Math.round(a * 10)); }
  for (const [x, z, n, seed] of [[3.2, -12.4, 12, 0], [7.9, -12.6, 10, 1], [-5.6, 3.6, 12, 2], [-3.4, 5.2, 9, 3], [-7.2, -7.4, 10, 0], [-1.3, -9.9, 9, 1], [8.6, 1.4, 12, 2], [10.2, -1.8, 9, 3], [-10.2, .2, 10, 1]]) flowers(x, z, n, seed);
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
  for (let i = 0; i < 8; i++) { const t = i / 7; cyl(-.35 - t * 3.6, .17, 5.9 + Math.sin(t * Math.PI) * 1.1 - t * 1.4, .5, .52, .05, ['#e3d7c1', '#d6c8ae'][i % 2]); }
  for (const [x, z, s] of [[4.2, 4.6, 1.2], [-6.6, 4.4, 1.1], [7.4, 3.2, .9]]) asset('bush', { x, z, yaw: x, scale: s });
  boat(1.75, 2.6, .5); bench(-4.6, 3.9, -.35);
  const tackle = [.46, DOCK_Y + .09, 2.15];
  box(tackle[0], tackle[1], tackle[2], .36, .18, .24, '#6f8f86', [0, .2, 0]); box(tackle[0], tackle[1] + .1, tackle[2], .38, .03, .26, '#5a766e', [0, .2, 0]);
  cyl(-.42, DOCK_Y + .14, 2.3, .38, .3, .28, '#c7a36f'); cyl(-.42, DOCK_Y + .28, 2.3, .4, .4, .03, '#a4804f');
  const scenery = new Mesh('lake-scenery', scene), merged = baked.shift(); merged.merge(baked, true); merged.applyToMesh(scenery);
  const sceneryPaint = new StandardMaterial('lake-scenery-paint', scene); sceneryPaint.specularColor.setAll(0);
  scenery.material = sceneryPaint; scenery.useVertexColors = true; scenery.isPickable = false; scenery.freezeWorldMatrix();

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

  const glowing = [], light = (mesh, x, y, z) => { mesh.position.set(x, y, z); mesh.computeWorldMatrix(true); const data = VertexData.ExtractFromMesh(mesh); data.transform(mesh.getWorldMatrix()); mesh.dispose(); data.uvs = null; glowing.push(data); };
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
  for (const [x, z] of windows) { const pane = MeshBuilder.CreateBox('p', { width: .9, height: .87, depth: .08 }, scene); pane.rotation.y = -.45; light(pane, x, 2.25, z); }
  const lanternGlow = new Mesh('lake-lantern', scene), litMerged = glowing.shift(); litMerged.merge(glowing, true); litMerged.applyToMesh(lanternGlow);
  const lanternPaint = new StandardMaterial('lake-lantern-paint', scene); lanternPaint.disableLighting = true; lanternPaint.emissiveColor = Color3.FromHexString('#ffd48a').scale(theme === 'day' ? .75 : 1.1);
  lanternGlow.material = lanternPaint; lanternGlow.isPickable = false; lanternGlow.freezeWorldMatrix();
  const wire = MeshBuilder.CreateLineSystem('lake-wires', { lines: wires }, scene); wire.color = Color3.FromHexString('#4f3d31'); wire.alpha = .7; wire.isPickable = false; wire.freezeWorldMatrix();

  const motes = MeshBuilder.CreateSphere('lake-motes', { diameter: theme === 'dusk' ? .06 : .03, segments: 3 }, scene);
  const motePaint = new StandardMaterial('lake-mote-paint', scene); motePaint.disableLighting = true;
  motePaint.emissiveColor = Color3.FromHexString(theme === 'dusk' ? '#ffe39a' : theme === 'rain' ? '#dfe8ee' : '#fff4d6');
  motes.material = motePaint; motes.isPickable = false; motes.alwaysSelectAsActiveMesh = true;
  const MOTES = theme === 'rain' ? 90 : 48, moteMatrix = new Float32Array(MOTES * 16), moteSeeds = Array.from({ length: MOTES }, (_, i) => [(hash(i) - .5) * 20, .3 + hash(i * 2) * 2.4, 5 - hash(i * 3) * 16]);
  for (let i = 0; i < MOTES; i++) { const n = i * 16; moteMatrix[n] = moteMatrix[n + 5] = moteMatrix[n + 10] = moteMatrix[n + 15] = 1; if (theme === 'rain') moteMatrix[n + 5] = 9; }
  motes.thinInstanceSetBuffer('matrix', moteMatrix, 16, false);
  if (theme !== 'day') glow.addIncludedOnlyMesh?.(lanternGlow);

  const companion = createMobileCompanion(scene, avatar);
  const joints = companion.root.getChildMeshes().find(mesh => mesh.metadata?.rig).metadata.rig.joints;
  companion.contact.setEnabled(false);
  const pose = { x: STAND.x, z: STAND.z, yaw: 0, step: 0, moving: false, sit: 0, seatHeight: .5, doze: 0, activity: 'fish', activityTime: 0, atDesk: false, preview: null, reach: null, grip: new Vector3(.2, 1.05, -.36) };
  let petModel = null;
  try { petModel = createPetModel(scene, pet); petModel.root.position.set(.66, DOCK_Y - .01, 1.45); petModel.root.rotation.y = -.25; petModel.root.scaling.setAll(.85); petModel.contact?.setEnabled(false); } catch { petModel = null; }
  const petPose = { action: 'sit', moving: false, petAge: Infinity, walked: 0, x: .66, z: 1.45, yaw: -.25, hearts: [] };

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
  function buildFish(id, size) {
    const species = speciesOf(id), look = species.look, stretch = { slim: [1, .3], deep: [1, .5], round: [.9, .62], long: [1.15, .3], koi: [1.05, .36], eel: [1.9, .13], sturgeon: [1.4, .24] }[look.shape];
    const root = new TransformNode('lake-fish', scene), body = MeshBuilder.CreateSphere('lake-fish-body', { diameter: 1, segments: 18 }, scene);
    body.scaling.set(stretch[0], stretch[1], stretch[1] * .55); body.parent = root;
    const pos = body.getVerticesData('position'), nor = body.getVerticesData('normal'), colors = new Float32Array(pos.length / 3 * 4);
    const C = hex => Color3.FromHexString(hex), bodyC = C(look.body), belly = C(look.belly), patch = look.patch ? C(look.patch) : null, dark = C('#3d3a33');
    for (let i = 0; i < pos.length / 3; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], ny = nor[i * 3 + 1];
      let c = Color3.Lerp(bodyC, belly, ease((-ny + .15) * 1.6));
      if (look.mark === 'spots' && hash(Math.floor(x * 22) * 7.1 + Math.floor(y * 22) * 3.3) > .8 && ny > -.3) c = Color3.Lerp(c, dark, .45);
      if (look.mark === 'stripes' && Math.sin(x * 26) > .55 && ny > -.4) c = Color3.Lerp(c, C('#4e5a34'), .5);
      if (look.mark === 'patches' && Math.sin(x * 9 + 1) * Math.cos(y * 8 + x * 4) > .25 && ny > -.5) c = patch;
      if (look.mark === 'stars' && hash(Math.floor(x * 30) + Math.floor(y * 30) * 17.7 + Math.floor(pos[i * 3 + 2] * 30) * 3.1) > .9 && ny > -.2) c = C('#fff6d8');
      if (look.mark === 'plates' && Math.abs(Math.sin(x * 28)) > .85 && Math.abs(ny) < .5) c = C('#d9d4e6');
      colors.set([c.r, c.g, c.b, 1], i * 4);
    }
    body.setVerticesData('color', colors);
    const skin = new StandardMaterial('lake-fish-skin', scene); skin.specularColor.setAll(.35); skin.specularPower = 40;
    if (look.glow) skin.emissiveColor = C(look.glow).scale(.28);
    body.material = skin;
    const finPaint = new StandardMaterial('lake-fish-fin', scene); finPaint.diffuseColor = C(look.fin); finPaint.alpha = .92; finPaint.backFaceCulling = false; finPaint.specularColor.setAll(.1);
    if (look.glow) finPaint.emissiveColor = C(look.glow).scale(.25);
    const tailPivot = new TransformNode('lake-fish-tail', scene); tailPivot.parent = root; tailPivot.position.x = -stretch[0] * .46;
    if (look.shape !== 'eel') for (const side of [-1, 1]) {
      const lobe = MeshBuilder.CreateDisc('lake-fish-lobe', { radius: stretch[1] * .62, tessellation: 3 }, scene);
      lobe.material = finPaint; lobe.parent = tailPivot; lobe.position.set(-stretch[1] * .35, side * stretch[1] * .28, 0); lobe.rotation.z = Math.PI + side * .45; lobe.scaling.set(1.1, .7, 1);
    }
    const dorsal = MeshBuilder.CreateDisc('lake-fish-dorsal', { radius: stretch[1] * .5, tessellation: 3 }, scene);
    dorsal.material = finPaint; dorsal.parent = root; dorsal.position.set(-.05, stretch[1] * .45, 0); dorsal.rotation.z = Math.PI / 2 + .5; dorsal.scaling.set(.9, 1.4, 1);
    const eyePaint = new StandardMaterial('lake-fish-eye', scene); eyePaint.diffuseColor = C('#1f1b18'); eyePaint.specularColor.setAll(.9);
    for (const side of [-1, 1]) { const eye = MeshBuilder.CreateSphere('lake-fish-eye', { diameter: Math.max(.05, stretch[1] * .17), segments: 6 }, scene); eye.material = eyePaint; eye.parent = root; eye.position.set(stretch[0] * .36, stretch[1] * .1, side * stretch[1] * .22); }
    if (look.whiskers) for (const side of [-1, 1]) {
      const whisker = MeshBuilder.CreateTube('lake-fish-whisker', { path: [new Vector3(stretch[0] * .47, -stretch[1] * .08, side * .03), new Vector3(stretch[0] * .56, -stretch[1] * .3, side * .1), new Vector3(stretch[0] * .5, -stretch[1] * .6, side * .14)], radius: .008, tessellation: 4 }, scene);
      whisker.material = finPaint; whisker.parent = root;
    }
    const scale = Math.max(.42, Math.min(1.5, size / 38)) * .62;
    root.scaling.setAll(scale);
    root.getChildMeshes().forEach(mesh => { mesh.isPickable = false; if (look.glow) glow.addIncludedOnlyMesh?.(mesh); });
    return { root, tail: tailPivot, species, scale };
  }

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

    const focusing = fish && (phase === 'leap' || phase === 'shown');
    const aspect = engine.getAspectRatio(camera), wide = aspect > 1.1; camera.fov = aspect < 1 ? 1.12 : .7;
    const framed = wide ? cardSide.set(hover.x + .55, hover.y - .05, hover.z - .23) : cardSide.set(hover.x, hover.y - .45, hover.z);
    const goalLook = focusing ? framed : camHome.look, goalEye = focusing ? FOCUS_EYE : camHome.eye;
    const rate = reducedMotion ? 1 : 1 - Math.exp(-dt * 2.4);
    Vector3.LerpToRef(camLook, goalLook, rate, camLook); Vector3.LerpToRef(camEye, goalEye, rate, camEye);
    if (!reducedMotion) camEye.y += Math.sin(clock * .35) * .0015;
    camera.position.copyFrom(camEye); camera.setTarget(camLook);

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
    skyPaint.setFloat('time', clock); for (const m of fallPaints) m.setFloat('time', clock);
      }

  engine.runRenderLoop(() => {
    if (disposed) return;
    const now = performance.now(), dt = Math.min(.05, (now - last) / 1000); last = now;
    update(dt); scene.render();
  });
  const resize = () => engine.resize();
  window.addEventListener('resize', resize);

  return {
    cast(target = { x: -.6 + (clockRandom() - .5) * 2.2, z: -4.6 - clockRandom() * 2.2 }) {
      castTo.set(target.x, 0, target.z); setPhase('cast');
      return new Promise(resolve => { castDone = resolve; if (reducedMotion) { phaseAt = clock - 1.7; } });
    },
    nibble() { if (phase !== 'wait') return; ripple(castTo.x, castTo.z, .45, 1); bobberAt.y -= .03; bobber.position.y -= .04; },
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
