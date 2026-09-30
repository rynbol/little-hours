import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { waterfalls } from './house-island.js';
import { pondPoint, WATER } from './house-pond.js';
import { ISLAND_ATMOSPHERES } from './island-atmosphere.js';

const VERTEX = `precision highp float;
attribute vec3 position; attribute vec2 uv, uv2; uniform mat4 viewProjection; uniform float time; uniform vec3 right, up;
varying vec2 vUv; varying float vKind, vFade;
void main() {
  vUv = uv; vKind = uv2.x; vFade = 1.; vec3 p = position;
  if (uv2.x < -4.5) {
    float seed = -5. - uv2.x, age = fract(time * .18 + seed), size = uv2.y * (.5 + age * 1.3);
    p += vec3(sin(seed * 40.) * .9, .15 + age * .5, cos(seed * 40.) * .9) * age;
    p += (right * uv.x + up * uv.y) * size;
    vFade = smoothstep(0., .2, age) * (1. - smoothstep(.5, 1., age));
  }
  gl_Position = viewProjection * vec4(p, 1.);
}`;
const FRAGMENT = `precision highp float;
varying vec2 vUv; varying float vKind, vFade; uniform float time, light; uniform vec3 deep, shallow, foam;
vec4 premultiply(vec3 rgb, float a) { return vec4(rgb * a, a); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
void main() {
  if (vKind < -4.5) {
    float r = length(vUv), wisp = noise(vUv * 2.5 + vec2(vKind * 7., time * .3));
    gl_FragColor = premultiply(foam * light * (1.02 + .06 * wisp), (1. - smoothstep(.05, 1., r + (wisp - .5) * .3)) * vFade * .26);
    return;
  }
  if (vKind < -.5) {
    float glint = smoothstep(.7, .95, noise(vUv * 3.2 + vec2(time * .25, -time * .18)) * .6 + noise(vUv * 7.1 - vec2(time * .4, time * .3)) * .4);
    gl_FragColor = premultiply(foam * light, glint * .45 * smoothstep(1., .75, -vKind - 1.));
    return;
  }
  float falling = step(.5, vKind), t = max(0., vKind - 1.), speed = mix(.8, 2.4, falling);
  float streak = noise(vec2(vUv.x * mix(5., 10., falling), vUv.y * 2.4 - time * speed)) * .6 + noise(vec2(vUv.x * 21. + 3., vUv.y * 5.5 - time * speed * 1.6)) * .4;
  vec3 col = mix(deep, shallow, .4 + .4 * noise(vec2(vUv.x * 3., vUv.y * 1.3 - time * speed * .5)));
  float white = falling < .5 ? smoothstep(.62, .9, streak) * .45 : clamp(smoothstep(.45, .85, streak) * .75 + (1. - smoothstep(0., .12, t)) * .45 + smoothstep(.55, 1., t) * .6, 0., 1.);
  float side = smoothstep(0., .16, vUv.x) * smoothstep(1., .84, vUv.x);
  gl_FragColor = premultiply(mix(col, foam, white) * light, side * mix(.95, .92 * (1. - smoothstep(.7, 1., t)), falling));
}`;
const LIGHT = { dusk: .82, rain: .9, day: 1 };

function streamShape(shape) {
  for (const { points, rim } of waterfalls()) {
    const start = shape.positions.length / 3, COLS = 6;
    let run = 0;
    points.forEach(([x, y, z], i) => {
      const [nx, , nz] = points[Math.min(points.length - 1, i + 1)], [px, , pz] = points[Math.max(0, i - 1)], l = Math.hypot(nx - px, nz - pz) || 1;
      const falling = i >= rim, t = falling ? (i - rim) / (points.length - 1 - rim) : 0, width = falling ? .42 + t * .3 : .4;
      if (i) run += Math.hypot(x - points[i - 1][0], y - points[i - 1][1], z - points[i - 1][2]);
      for (let c = 0; c <= COLS; c++) {
        const u = c / COLS, side = (u - .5) * width, bow = falling ? Math.sin(u * Math.PI) * .08 * t : 0;
        shape.positions.push(x - (nz - pz) / l * side + (nx - px) / l * bow, y, z + (nx - px) / l * side + (nz - pz) / l * bow);
        shape.uvs.push(u, run); shape.uv2s.push(falling ? 1 + t : 0, 0);
        if (i && c) { const n = start + i * (COLS + 1) + c; shape.indices.push(n - COLS - 2, n - 1, n - COLS - 1, n - COLS - 1, n - 1, n); }
      }
    });
  }
}

export const SPRAY_PER_FALL = 12;
export function sprayPuffs() {
  return waterfalls().flatMap(({ points }, f) => {
    const [x, y, z] = points.at(-1);
    return Array.from({ length: SPRAY_PER_FALL }, (_, k) => {
      const a = k * 2.4 + f, reach = .15 + (k % 4) * .16;
      return { x: x + Math.cos(a) * reach, y: y + .35 - (k % 4) * .14, z: z + Math.sin(a) * reach, size: .5 + (k % 3) * .16, seed: ((k * .618 + f * .31) % 1) };
    });
  });
}

function sprayShape(shape) {
  for (const { x, y, z, size, seed } of sprayPuffs()) {
    const start = shape.positions.length / 3;
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { shape.positions.push(x, y, z); shape.uvs.push(u, v); shape.uv2s.push(-5 - seed, size); }
    shape.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }
}

function pondShape(shape) {
  const start = shape.positions.length / 3, SEG = 48, RINGS = 4;
  for (let r = 0; r <= RINGS; r++) for (let j = 0; j <= SEG; j++) {
    const k = r / RINGS * .93, [x, z] = pondPoint(j / SEG * Math.PI * 2, k);
    shape.positions.push(x, WATER + .006, z); shape.uvs.push(x, z); shape.uv2s.push(-1 - k, 0);
    if (r && j) { const n = start + r * (SEG + 1) + j; shape.indices.push(n - SEG - 2, n - 1, n - SEG - 1, n - SEG - 1, n - 1, n); }
  }
}

export function createIslandWater(scene, theme) {
  const shape = { positions: [], uvs: [], uv2s: [], indices: [] };
  streamShape(shape); pondShape(shape); sprayShape(shape);
  const mesh = new Mesh('island-water', scene), data = new VertexData();
  Object.assign(data, { positions: shape.positions, uvs: shape.uvs, uvs2: shape.uv2s, indices: shape.indices }); data.applyToMesh(mesh);
  const paint = new ShaderMaterial('island-water-paint', scene, { vertexSource: VERTEX, fragmentSource: FRAGMENT }, { attributes: ['position', 'uv', 'uv2'], uniforms: ['viewProjection', 'time', 'light', 'deep', 'shallow', 'foam', 'right', 'up'], needAlphaBlending: true });
  paint.setColor3('foam', Color3.FromHexString('#f3fbf8'));
  paint.setFloat('time', 0); paint.backFaceCulling = false; paint.alphaMode = Constants.ALPHA_PREMULTIPLIED_PORTERDUFF;
  mesh.material = paint; mesh.isPickable = false; mesh.alwaysSelectAsActiveMesh = true; mesh.freezeWorldMatrix();
  const right = new Vector3(1, 0, 0), up = new Vector3(0, 1, 0); paint.setVector3('right', right); paint.setVector3('up', up);
  const water = {
    mesh,
    setTheme(next) { const colors = ISLAND_ATMOSPHERES[next]; paint.setFloat('light', LIGHT[next] ?? 1); paint.setColor3('deep', Color3.FromHexString(colors.deep)); paint.setColor3('shallow', Color3.FromHexString(colors.shallow)); },
    animate(seconds, camera) {
      paint.setFloat('time', seconds);
      if (camera) { camera.getDirectionToRef(Vector3.RightReadOnly, right); camera.getDirectionToRef(Vector3.UpReadOnly, up); paint.setVector3('right', right); paint.setVector3('up', up); }
    },
  };
  water.setTheme(theme);
  return water;
}
