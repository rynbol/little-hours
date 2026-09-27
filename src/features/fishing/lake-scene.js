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
  float depth = 1. - smoothstep(.35, .98, length((q - vec2(0., -3.2)) / vec2(8.6, 7.2)));
  vec3 base = mix(shallow, deep, depth);
  vec3 sky = mix(skyLow, skyMid, clamp(r.y * 2.2, 0., 1.));
  vec3 col = mix(base, sky, clamp(.18 + fres * .75, 0., .88));
  col += glint * pow(max(dot(r, normalize(sunDir)), 0.), 90.) * 1.1;
  float twinkle = step(.93, noise(q * 9. + vec2(time * .5, -time * .35))) * (.5 + .5 * sin(time * 5. + q.x * 7.));
  col += glint * twinkle * .22 * smoothstep(0., 1., dot(r, normalize(sunDir)) + .4);
  col += vec3(.95, .97, 1.) * min(foam * .9, .6);
  float fog = smoothstep(16., 42., length(vWorld.xz - eye.xz));
  gl_FragColor = vec4(mix(col, skyLow, fog * .85), 1.);
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
      const dx = (hash(seed + i) - .5) * .8, dz = (hash(seed * 2 + i) - .5) * .5, tall = .7 + hash(seed * 3 + i) * .8, lean = (hash(i + seed * 5) - .5) * .25;
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
  const cottage = (x, z, yaw) => {
    const at = (dx, dz) => [x + Math.cos(yaw) * dx + Math.sin(yaw) * dz, z - Math.sin(yaw) * dx + Math.cos(yaw) * dz];
    const [cx, cz] = at(0, 0);
    box(cx, 1.35, cz, 4.4, 2.6, 3.2, '#fbf0dc', [0, yaw, 0]); box(cx, .12, cz, 4.6, .24, 3.4, '#b9a58e', [0, yaw, 0]);
    for (const side of [-1, 1]) { const [rx, rz] = at(0, side * .9); box(rx, 3.2, rz, 4.9, .14, 2.25, '#9a5f55', [side * .72, yaw, 0]); }
    const [gx, gz] = at(0, 0); box(gx, 2.8, gz, 4.3, .75, 1.7, '#fbf0dc', [0, yaw, 0]);
    const [chx, chz] = at(1.3, -.5); box(chx, 3.7, chz, .42, 1.1, .42, '#b3796b', [0, yaw, 0]);
    const [dx, dz] = at(-.6, 1.62); box(dx, .85, dz, .75, 1.35, .06, '#8f6a4f', [0, yaw, 0]);
    const [px, pz] = at(-.6, 2.05); box(px, .22, pz, 1.3, .12, .8, '#c9b69c', [0, yaw, 0]);
    return [at(.8, 1.63), at(1.75, 1.63), at(-1.6, 1.63)];
  };
  const bench = (x, z, yaw) => {
    for (const dz of [-.12, .02, .16]) box(x + Math.sin(yaw) * dz, .46, z + Math.cos(yaw) * dz, 1.3, .05, .1, '#b98d63', [0, yaw, 0]);
    box(x - Math.sin(yaw) * .22, .72, z - Math.cos(yaw) * .22, 1.3, .22, .05, '#a97f58', [.2, yaw, 0]);
    for (const side of [-.55, .55]) box(x + Math.cos(yaw) * side, .22, z - Math.sin(yaw) * side, .07, .44, .4, '#6f5240', [0, yaw, 0]);
  };

  bank();
  ball(0, -1.8, -46, 110, 4.4, 24, palette.meadow, 18);
  for (let i = 0; i < 7; i++) ball(-60 + i * 20 + hash(i) * 8, 1, -70 - hash(i * 3) * 15, 30 + hash(i * 5) * 20, 10 + hash(i * 7) * 12, 14, palette.hill[i % 3], 10);
  for (let i = 0; i < 5; i++) ball(-50 + i * 26, 4, -95, 40, 22 + hash(i) * 10, 10, palette.hill[(i + 1) % 3], 10, .92);
  const windows = cottage(5.2, -15.2, -.45);
  for (let i = 0; i < 18; i++) { const a = -Math.PI + .15 + i / 17 * (Math.PI - .3), [x, z] = rim(a, 1.55 + hash(i * 3) * .5); if (Math.hypot(x - 5.2, z + 15.2) > 3.6) (i % 3 === 1 ? blossom : tree)(x, z, .75 + hash(i * 7) * .4, i); }
  for (let i = 0; i < 16; i++) tree(-30 + i * 4, -28 - hash(i) * 5, .9 + hash(i * 2) * .5, i + 3, .6);
  for (const [a, k, s] of [[.25, 1.5, .85], [.55, 1.75, .7], [2.55, 1.6, .8], [2.9, 1.45, .95]]) { const [x, z] = rim(a, k); blossom(x, z, s, Math.round(a * 10)); }
  { const [x, z] = rim(3.2, 1.18); willow(x, z, 1.15); }
  picket(rim(-1.35, 1.62), rim(-.62, 1.5), 12); picket(rim(-.62, 1.5), rim(-.25, 1.35), 6);
  const reedsAt = [[2.75, 1], [2.2, .99], [-2.6, 1], [-.35, 1], [.5, .98], [.95, 1], [-1.9, .99]];
  reedsAt.forEach(([a, k], i) => { const [x, z] = rim(a, k); reeds(x, z, 9 + (i % 3) * 3, i + 1); });
  for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2 + hash(i) * .15, [x, z] = rim(a, 1.12 + hash(i * 11) * .3); if (Math.abs(a - Math.PI / 2) > .28) flowers(x, z, 10, i); }
  [[2.4, 1.02, .45], [-2.9, 1.01, .5], [-.8, 1.02, .6], [.2, 1.04, .4], [1.35, 1.03, .5]].forEach(([a, k, s], i) => { const [x, z] = rim(a, k); rock(x, z, s, i); });
  const pads = [[-2.2, -1.3, .42], [-3.1, -2.4, .34], [-1.3, -3.4, .3], [2.4, -1.8, .4], [3.2, -3, .3], [-4.2, 0, .36], [4.4, .6, .32], [-5.5, -4.3, .45], [5.8, -5.2, .38], [-.4, -6.8, .3], [-3.6, -7.6, .4], [3.4, -8.2, .36]];
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
  for (let i = 0; i < 12; i++) { const a = .55 + i / 11 * 2.05, [x, z] = rim(a, 1.4 + hash(i * 13) * .35); if (Math.abs(x) > 1.4) (i % 2 ? flowers(x, z, 12, i + 3) : asset('bush', { x, z, yaw: i, scale: 1.2 })); }
  boat(1.75, 2.6, .5); bench(-4.6, 3.9, -.35);
  const tackle = [.46, DOCK_Y + .09, 2.15];
  box(tackle[0], tackle[1], tackle[2], .36, .18, .24, '#6f8f86', [0, .2, 0]); box(tackle[0], tackle[1] + .1, tackle[2], .38, .03, .26, '#5a766e', [0, .2, 0]);
  cyl(-.42, DOCK_Y + .14, 2.3, .38, .3, .28, '#c7a36f'); cyl(-.42, DOCK_Y + .28, 2.3, .4, .4, .03, '#a4804f');
  const scenery = new Mesh('lake-scenery', scene), merged = baked.shift(); merged.merge(baked, true); merged.applyToMesh(scenery);
  const sceneryPaint = new StandardMaterial('lake-scenery-paint', scene); sceneryPaint.specularColor.setAll(0);
  scenery.material = sceneryPaint; scenery.useVertexColors = true; scenery.isPickable = false; scenery.freezeWorldMatrix();

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
  for (const [x, z] of windows) { const pane = MeshBuilder.CreateBox('p', { width: .62, height: .6, depth: .06 }, scene); pane.rotation.y = -.45; light(pane, x, 1.55, z); }
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
  let clock = 0, phase = 'idle', phaseAt = 0, progress = 0, tug = 0, lastTap = -9, leapDone = null, castDone = null, rise = 4, catchInfo = null, stowAt = -1;
  const setPhase = next => { phase = next; phaseAt = clock; };
  let last = performance.now(), disposed = false;

  function rodShape(t) {
    const p = t - phaseAt;
    let theta = .8 + (reducedMotion ? 0 : Math.sin(clock * .8) * .03), flex = .05, lift = 0;
    if (phase === 'cast') {
      if (p < .55) { const k = ease(p / .55); theta = .8 - k * 1.35; lift = k; flex = -.08 * k; }
      else if (p < .9) { const k = easeOut((p - .55) / .35); theta = -.55 + k * 1.85; lift = 1 - k * 1.3; flex = .25 * Math.sin(k * Math.PI); }
      else { const k = ease((p - .9) / .5); theta = 1.3 - k * .3; lift = -.3 + k * .3; flex = .08; }
    } else if (phase === 'wait') { theta = 1 + (reducedMotion ? 0 : Math.sin(clock * .9) * .02); flex = .1; }
    else if (phase === 'bite') { theta = .95 + Math.sin(clock * 30) * .02; flex = .38 + Math.sin(clock * 22) * .06; }
    else if (phase === 'reel') { const sinceTap = clock - lastTap; theta = .62 + Math.min(.3, sinceTap * .5); lift = .35 - Math.min(.35, sinceTap); flex = .55 + Math.sin(clock * 14) * .05 * (1 - progress) + tug * .2; }
    else if (phase === 'leap') { theta = .45; lift = .5; flex = .15 * Math.max(0, 1 - p); }
    else if (phase === 'escape') { theta = .8 + Math.max(0, .4 - p) * .5; flex = 0; }
    return { theta, flex, lift };
  }

  function update(dt) {
    clock += dt;
    const shape = rodShape(clock);
    pose.grip.set(.2, 1.02 + shape.lift * .3, -.36 + shape.lift * .16);
    pose.activityTime += dt;
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
      tug = Math.max(0, tug - dt * 3);
      Vector3.LerpToRef(reelFrom, HOME_BOBBER, easeOut(progress) * .85, bobberAt);
      bobberAt.x += Math.sin(clock * 5.3) * .35 * (1 - progress); bobberAt.y = -.06 - tug * .08;
      if (Math.floor(clock / .45) !== Math.floor((clock - dt) / .45)) ripple(bobberAt.x, bobberAt.z, .8, 1);
      slack = 0;
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
      const k = Math.min(1, p / 1.25);
      if (phase === 'leap') {
        const at = fish.root.position;
        Vector3.LerpToRef(reelFrom, hover, easeOut(k), at); at.y = reelFrom.y + Math.sin(k * Math.PI) * 1.5 + k * (hover.y - reelFrom.y) * 1;
        const vy = Math.cos(k * Math.PI) * 1.5;
        fish.root.rotation.set(Math.sin(k * 10) * .15, -1.2 + k * 3.2, Math.atan2(vy, 1.8) + (1 - k) * .4);
        if (k < .08 && !fish.splashed) { fish.splashed = true; splash(reelFrom, 30, 1.25); ripple(reelFrom.x, reelFrom.z, 1.6, 0); burst(reelFrom, tierOf(fish.species.tier).color, 16); }
        if (k >= 1) { setPhase('shown'); burst(hover, tierOf(fish.species.tier).color, 30); petPose.petAge = 0; leapDone?.(catchInfo); leapDone = null; }
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
    skyPaint.setFloat('time', clock);
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
    bite() { if (phase !== 'wait') return; setPhase('bite'); ripple(castTo.x, castTo.z, 1.2, 1); splash(castTo, 10, .6); },
    hook() { reelFrom.copyFrom(bobber.position); reelFrom.y = 0; progress = 0; setPhase('reel'); lastTap = clock; splash(reelFrom, 10, .7); },
    reel(next) { progress = Math.min(1, next); tug = 1; lastTap = clock; splash(bobber.position, 6, .55); ripple(bobber.position.x, bobber.position.z, .9); },
    leap(caught) {
      catchInfo = caught; fish?.root.dispose(false, true); fish = buildFish(caught.species, caught.size); fish.splashed = false;
      reelFrom.copyFrom(bobber.position); reelFrom.y = 0; hover.set(STAND.x + .9, DOCK_Y + 1.75, STAND.z - 1.05);
      fish.root.position.copyFrom(reelFrom); setPhase('leap');
      return new Promise(resolve => { leapDone = resolve; if (reducedMotion) phaseAt = clock - 1.3; });
    },
    stow() { if (fish) stowAt = clock; setPhase('idle'); },
    escape() { setPhase('escape'); splash(castTo, 8, .5); },
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
