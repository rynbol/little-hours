import { Color, CustomBlending, Mesh, OneMinusSrcAlphaFactor, PlaneGeometry, ShaderMaterial, SrcAlphaFactor, UniformsLib, UniformsUtils, Vector3, ZeroFactor, OneFactor } from 'three';
import { VALLEY, WATER } from '../../core/wilds/valley.js';

export const MIST = Object.freeze({ layers: Object.freeze([0.35, 1.3, 2.6]), margin: 26, opacity: 0.5, drift: Object.freeze([0.9, -0.35]) });

export function buildMist(time) {
  const { ax, az, bx, bz, radius } = VALLEY.lake;
  const x0 = Math.min(ax, bx) - radius - MIST.margin, x1 = Math.max(ax, bx) + radius + MIST.margin, z0 = Math.min(az, bz) - radius - MIST.margin, z1 = Math.max(az, bz) + radius + MIST.margin;
  const material = new ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    blending: CustomBlending, blendSrc: SrcAlphaFactor, blendDst: OneMinusSrcAlphaFactor, blendSrcAlpha: ZeroFactor, blendDstAlpha: OneFactor,
    uniforms: UniformsUtils.merge([UniformsLib.fog, { time, amount: { value: 0 }, tint: { value: new Color() }, lit: { value: new Color() }, sun: { value: new Vector3(0, 1, 0) }, layer: { value: 0 } }]),
    vertexShader: `varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: `uniform float time; uniform float amount; uniform vec3 tint; uniform vec3 lit; uniform vec3 sun; varying vec3 vWorld;
#include <fog_pars_fragment>
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += noise(p) * a; p = p * 2.03 + 11.7; a *= 0.5; } return v; }
void main() {
  vec2 a = vec2(${ax.toFixed(1)}, ${az.toFixed(1)}), b = vec2(${bx.toFixed(1)}, ${bz.toFixed(1)}), p = vWorld.xz;
  float t = clamp(dot(p - a, b - a) / dot(b - a, b - a), 0.0, 1.0), edge = length(p - mix(a, b, t)) - ${radius.toFixed(1)};
  float inside = 1.0 - smoothstep(-6.0, ${(MIST.margin * 0.7).toFixed(1)}, edge);
  vec2 flow = vec2(${MIST.drift[0].toFixed(2)}, ${MIST.drift[1].toFixed(2)}) * time;
  float wisps = smoothstep(0.38, 0.8, fbm(p * 0.035 + flow * 0.02) * 0.65 + fbm(p * 0.09 - flow * 0.045) * 0.45);
  vec3 view = normalize(vWorld - cameraPosition);
  float glow = pow(max(dot(view, sun), 0.0), 4.0);
  gl_FragColor = vec4(mix(tint, lit, glow * 0.7), wisps * inside * amount * ${MIST.opacity.toFixed(2)});
  #include <fog_fragment>
}`,
  });
  const meshes = MIST.layers.map((height, i) => {
    const layer = material.clone();
    layer.uniforms.time = time;
    layer.uniforms.amount.value = 0;
    const mesh = new Mesh(new PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), layer);
    mesh.position.set((x0 + x1) / 2, WATER + height, (z0 + z1) / 2);
    mesh.name = `wilds-mist-${i}`; mesh.renderOrder = 6 + i; mesh.frustumCulled = false; mesh.visible = false;
    return mesh;
  });
  material.dispose();
  return {
    meshes,
    update(amount, light) {
      meshes.forEach((mesh, i) => {
        const { uniforms } = mesh.material, share = amount * (1 - i * 0.22);
        mesh.visible = share > 0.01;
        uniforms.amount.value = share;
        uniforms.tint.value.copy(light.fog).lerp(light.sky, 0.25);
        uniforms.lit.value.copy(light.glow);
        uniforms.sun.value.copy(light.sun);
      });
    },
  };
}
