import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, ShaderMaterial, UniformsLib, UniformsUtils, Vector3 } from 'three';

const NOISE = `float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }`;

export const WATER_LOOK = Object.freeze({ shallow: '#4fb7ae', deep: '#14527e', foam: '#f4fbf6', sky: '#9cc7e2', sparkle: '#fff6dc' });

function lakeMaterial() {
  return new ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: UniformsUtils.merge([UniformsLib.fog, {
      shallow: { value: new Color(WATER_LOOK.shallow) }, deep: { value: new Color(WATER_LOOK.deep) }, foam: { value: new Color(WATER_LOOK.foam) },
      skyTint: { value: new Color(WATER_LOOK.sky) }, sparkle: { value: new Color(WATER_LOOK.sparkle) }, sunDirection: { value: new Vector3(0, 1, 0) }, time: { value: 0 }, light: { value: 1 },
    }]),
    vertexShader: `attribute float depth; attribute vec2 flow; varying float vDepth; varying vec2 vFlow; varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vDepth = depth; vFlow = flow;
  vec4 world = modelMatrix * vec4(position, 1.0); vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: `uniform vec3 shallow; uniform vec3 deep; uniform vec3 foam; uniform vec3 skyTint; uniform vec3 sparkle; uniform vec3 sunDirection; uniform float time; uniform float light;
varying float vDepth; varying vec2 vFlow; varying vec3 vWorld;
#include <fog_pars_fragment>
${NOISE}
void main() {
  vec2 p = vWorld.xz - vFlow * time;
  float ripple = noise(p * 0.55 + time * 0.12) * 0.6 + noise(p * 1.7 - time * 0.2) * 0.4;
  vec3 n = normalize(vec3((noise(p * 0.9 + 3.1 + time * 0.15) - 0.5) * 0.35, 1.0, (noise(p * 0.9 - 7.3 - time * 0.13) - 0.5) * 0.35));
  vec3 view = normalize(cameraPosition - vWorld);
  float fresnel = pow(1.0 - max(dot(view, vec3(0.0, 1.0, 0.0)), 0.0), 3.0);
  float d = clamp(vDepth, 0.0, 8.0);
  vec3 colour = mix(shallow, deep, smoothstep(0.25, 4.2, d));
  colour = mix(colour, skyTint, fresnel * 0.4);
  colour += vec3(0.04, 0.06, 0.05) * smoothstep(0.55, 0.8, ripple);
  float glint = pow(max(dot(reflect(-view, n), sunDirection), 0.0), 180.0);
  colour += sparkle * step(0.35, glint) * 0.9;
  float edge = smoothstep(0.1, 0.0, d + (noise(p * 2.3 + time * 0.4) - 0.5) * 0.08) * (0.55 + 0.45 * sin(time * 1.3 + d * 40.0 + noise(p * 0.7) * 6.0));
  float flowFoam = smoothstep(0.62, 0.8, noise(p * 1.3)) * clamp(length(vFlow) * 0.6, 0.0, 1.0);
  colour = mix(colour, foam, max(edge * 0.7, flowFoam * 0.6));
  float alpha = mix(0.3, 0.92, smoothstep(0.05, 2.2, d));
  alpha = max(alpha, edge * 0.7);
  gl_FragColor = vec4(colour * light, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
  });
}

export function buildWaterSurface(ground, waterAt, flowAt, { area, step = 1.5 }) {
  const [x0, x1, z0, z1] = area, columns = Math.ceil((x1 - x0) / step) + 1, rows = Math.ceil((z1 - z0) / step) + 1, count = columns * rows;
  const level = new Float32Array(count).fill(-Infinity);
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) level[j * columns + i] = waterAt(x0 + i * step, z0 + j * step);
  const filled = Float32Array.from(level);
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const k = j * columns + i;
    if (level[k] > -1e9) continue;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = i + di, jj = j + dj;
      if (ii >= 0 && jj >= 0 && ii < columns && jj < rows) filled[k] = Math.max(filled[k], level[jj * columns + ii]);
    }
  }
  const positions = new Float32Array(count * 3), depths = new Float32Array(count), flows = new Float32Array(count * 2);
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const k = j * columns + i, x = x0 + i * step, z = z0 + j * step, y = filled[k] > -1e9 ? filled[k] : 0;
    positions.set([x, y, z], k * 3);
    depths[k] = y - ground(x, z);
    flows.set(flowAt(x, z), k * 2);
  }
  const indices = [];
  for (let j = 0; j < rows - 1; j++) for (let i = 0; i < columns - 1; i++) {
    const a = j * columns + i, b = a + 1, c = a + columns, d = c + 1;
    if ([a, b, c, d].every(k => filled[k] < -1e9)) continue;
    if (![a, b, c, d].some(k => level[k] > -1e9)) continue;
    indices.push(a, c, b, b, c, d);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('depth', new BufferAttribute(depths, 1));
  geometry.setAttribute('flow', new BufferAttribute(flows, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function sheetMaterial() {
  return new ShaderMaterial({
    transparent: true, depthWrite: false, side: DoubleSide, fog: true,
    uniforms: UniformsUtils.merge([UniformsLib.fog, { time: { value: 0 }, light: { value: 1 }, body: { value: new Color('#9fd3dc') }, foam: { value: new Color(WATER_LOOK.foam) } }]),
    vertexShader: `varying vec2 vUv;
#include <fog_pars_vertex>
void main() { vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: `uniform float time; uniform float light; uniform vec3 body; uniform vec3 foam; varying vec2 vUv;
#include <fog_pars_fragment>
${NOISE}
void main() {
  float streak = noise(vec2(vUv.x * 26.0, vUv.y * 2.2 + time * 2.6)) * 0.65 + noise(vec2(vUv.x * 61.0, vUv.y * 5.0 + time * 3.4)) * 0.35;
  float edgeFade = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
  float white = smoothstep(0.42, 0.72, streak) + smoothstep(0.75, 1.0, vUv.y) * 0.7;
  vec3 colour = mix(body, foam, clamp(white, 0.0, 1.0));
  float alpha = (0.55 + white * 0.4) * edgeFade * smoothstep(0.0, 0.04, vUv.y);
  gl_FragColor = vec4(colour * light, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
  });
}

export function sheetGeometry({ lip, land, z, width, bulge = 0.4 }, segments = 18, across = 6) {
  const positions = [], uvs = [], indices = [];
  for (let s = 0; s <= segments; s++) {
    const t = s / segments, x = lip[0] + (land[0] - lip[0]) * Math.sqrt(t), y = lip[1] + (land[1] - lip[1]) * t;
    for (let a = 0; a <= across; a++) {
      const u = a / across, sway = Math.sin(u * Math.PI) * bulge * Math.sin(t * Math.PI);
      positions.push(x + sway, y, z - width / 2 + width * u);
      uvs.push(u, t);
    }
  }
  for (let s = 0; s < segments; s++) for (let a = 0; a < across; a++) {
    const i = s * (across + 1) + a;
    indices.push(i, i + across + 1, i + 1, i + 1, i + across + 1, i + across + 2);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  return geometry;
}

export function buildWater({ surfaces, sheets }) {
  const root = new Group(), lake = lakeMaterial(), fall = sheetMaterial();
  root.name = 'wilds-water';
  for (const geometry of surfaces) { const mesh = new Mesh(geometry, lake); mesh.renderOrder = 2; root.add(mesh); }
  for (const sheet of sheets) { const mesh = new Mesh(sheetGeometry(sheet), fall); mesh.renderOrder = 3; root.add(mesh); }
  return {
    root,
    update(seconds, sun, light, still) {
      if (!still) { lake.uniforms.time.value = seconds; fall.uniforms.time.value = seconds; }
      lake.uniforms.sunDirection.value.copy(sun);
      lake.uniforms.light.value = light; fall.uniforms.light.value = light;
    },
  };
}
