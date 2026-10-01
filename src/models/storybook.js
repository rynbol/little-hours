import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { RegisterMaterialPlugin } from '@babylonjs/core/Materials/materialPluginManager.js';

export const STORYBOOK = Object.freeze({
  floor: [0.62, 0.54, 0.46],
  lift: 1.0,
  shadow: [0.94, 0.92, 0.96],
  rim: [1.0, 0.93, 0.8],
  haze: Object.freeze({ color: [0.52, 0.45, 0.36], amount: 0.42, near: 0.5, far: 4.0 }),
  falloff: Object.freeze({ color: [0.78, 0.8, 0.86], near: 1.5, far: 5.0 }),
  grain: Object.freeze({ along: 2.4, across: 60, depth: 0.17, tone: 0.14, waver: 0.03 }),
});

const glsl = values => `vec3(${values.map(value => value.toFixed(3)).join(',')})`;
const { grain } = STORYBOOK;

export const STORYBOOK_FRAGMENT = `
float storyHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float storyNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(storyHash(i), storyHash(i + vec3(1,0,0)), f.x), mix(storyHash(i + vec3(0,1,0)), storyHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(storyHash(i + vec3(0,0,1)), storyHash(i + vec3(1,0,1)), f.x), mix(storyHash(i + vec3(0,1,1)), storyHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
vec3 storyWood(vec3 p, vec3 n) {
  vec3 q = abs(n.x) > 0.7 ? p.yxz : p;
  float across = q.y + q.z;
  float bent = across + ${grain.waver.toFixed(3)} * (storyNoise(vec3(q.x * 0.9, across * 3.0, 4.1)) - 0.5);
  float fibre = 0.65 * storyNoise(vec3(q.x * ${grain.along.toFixed(3)}, bent * ${grain.across.toFixed(3)}, 0.5)) + 0.35 * storyNoise(vec3(q.x * ${(grain.along * 2.3).toFixed(3)}, bent * ${(grain.across * 2.7).toFixed(3)}, 7.3));
  float figure = storyNoise(vec3(q.x * 0.7, across * 6.0, 2.3));
  return vec3(1.0 + ${grain.tone.toFixed(3)} * (figure - 0.5)) - ${grain.depth.toFixed(3)} * smoothstep(0.48, 0.72, fibre) * vec3(0.9, 1.0, 1.08);
}
vec3 storySurface(float code, vec3 p, vec3 n) {
  if (code > 9.5) return vec3(1.0);
  if (code > 8.5) return storyWood(p, n);
  if (code > 7.5) return vec3(0.97 + 0.05 * storyNoise(p * 18.0));
  if (code > 6.5) return vec3(0.98 + 0.04 * storyNoise(vec3(p.x * 4.0, p.y * 40.0, p.z * 4.0)));
  if (code > 5.5) return vec3(0.99 + 0.02 * storyNoise(p * 30.0));
  if (code > 4.5) return vec3(0.94 + 0.1 * storyNoise(p * 12.0));
  if (code > 3.5) return vec3(1.0 - 0.06 * step(0.9, storyNoise(p * 60.0)));
  if (code > 2.5) return vec3(0.88 + 0.16 * storyNoise(p * 6.0) + 0.04 * storyNoise(p * 20.0));
  return vec3(1.0);
}
vec3 storyLight(vec3 light, vec3 n, vec3 v, vec3 p) {
  float level = max(max(light.r, light.g), light.b);
  vec3 lifted = light + ${glsl(STORYBOOK.floor)} * (1.0 - smoothstep(0.0, ${STORYBOOK.lift.toFixed(3)}, level));
  vec3 soft = lifted * mix(${glsl(STORYBOOK.shadow)}, vec3(1.0), smoothstep(0.08, 0.7, level));
  float facing = 1.0 - max(dot(n, v), 0.0);
  soft += ${glsl(STORYBOOK.rim)} * pow(facing, 4.0) * 0.12 * smoothstep(0.08, 0.5, level);
  soft *= 0.97 + 0.05 * storyNoise(p * 2.5);
  return mix(light, soft, storyLook);
}
`;

const LIGHT_HOOK = /vec3 finalDiffuse=/g;
const OUTDOOR_PREFIX = 'seat-world';
const { haze, falloff } = STORYBOOK;
export const SURFACE_KIND = 'storySurface';

export class StorybookPlugin extends MaterialPluginBase {
  constructor(material, state) {
    super(material, 'Storybook', 150, { STORYSURFACE: false, STORYHAZE: false }, true, true);
    this.state = state;
  }
  getClassName() { return 'StorybookPlugin'; }
  isCompatible(shaderLanguage) { return shaderLanguage === 0; }
  prepareDefines(defines, scene, mesh) { defines.STORYSURFACE = mesh.isVerticesDataPresent(SURFACE_KIND); defines.STORYHAZE = !this._material.name.startsWith(OUTDOOR_PREFIX); }
  getAttributes(attributes, scene, mesh) { if (mesh.isVerticesDataPresent(SURFACE_KIND)) attributes.push(SURFACE_KIND); }
  getUniforms() { return { ubo: [{ name: 'storyLook', size: 1, type: 'float' }, { name: 'storyHaze', size: 4, type: 'vec4' }], fragment: 'uniform float storyLook;\nuniform vec4 storyHaze;' }; }
  bindForSubMesh(uniformBuffer) {
    const { color, amount } = this.state.haze;
    uniformBuffer.updateFloat('storyLook', this.state.amount);
    uniformBuffer.updateFloat4('storyHaze', color[0], color[1], color[2], amount);
  }
  getCustomCode(shaderType) {
    if (shaderType === 'vertex') return {
      CUSTOM_VERTEX_DEFINITIONS: `#ifdef STORYSURFACE\nattribute float ${SURFACE_KIND};\nvarying float vStorySurface;\n#endif`,
      CUSTOM_VERTEX_MAIN_END: `#ifdef STORYSURFACE\nvStorySurface=${SURFACE_KIND};\n#endif`,
    };
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: `#ifdef STORYSURFACE\nvarying float vStorySurface;\n#endif\n${STORYBOOK_FRAGMENT}`,
      [`!${LIGHT_HOOK.source}`]: '\n#ifdef LIGHT0\ndiffuseBase=storyLight(diffuseBase,normalW,viewDirectionW,vPositionW);\n#endif\n#ifdef STORYSURFACE\nbaseColor.rgb*=mix(vec3(1.0),storySurface(vStorySurface,vPositionW,normalW),storyLook);\n#endif\nvec3 finalDiffuse=',
      CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: `#ifdef STORYHAZE\nfloat storyDistance=length(vEyePosition.xyz-vPositionW);\ncolor.rgb*=mix(vec3(1.0),${glsl(falloff.color)},storyLook*smoothstep(${falloff.near.toFixed(3)},${falloff.far.toFixed(3)},storyDistance));\ncolor.rgb=mix(color.rgb,storyHaze.rgb,storyLook*storyHaze.a*smoothstep(${haze.near.toFixed(3)},${haze.far.toFixed(3)},storyDistance));\n#endif`,
    };
  }
}

const looks = new WeakMap();
let registered = false;
const dress = (material, state) => material instanceof StandardMaterial && !material.disableLighting && !material.pluginManager?.getPlugin('Storybook') ? new StorybookPlugin(material, state) : null;

export function createStorybook(scene) {
  if (!registered) { RegisterMaterialPlugin('Storybook', material => { const state = looks.get(material.getScene()); return state ? dress(material, state) : null; }); registered = true; }
  const state = { amount: 0, haze: STORYBOOK.haze };
  looks.set(scene, state);
  scene.materials.forEach(material => dress(material, state));
  return {
    get amount() { return state.amount; },
    set amount(value) { state.amount = Math.min(1, Math.max(0, value)); },
    set haze(value) { state.haze = value; },
    dispose() { looks.delete(scene); },
  };
}
