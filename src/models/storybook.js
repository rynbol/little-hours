import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { RegisterMaterialPlugin } from '@babylonjs/core/Materials/materialPluginManager.js';

export const STORYBOOK = Object.freeze({
  floor: [0.62, 0.54, 0.46],
  lift: 1.0,
  shadow: [0.94, 0.92, 0.96],
  rim: [1.0, 0.93, 0.8],
  haze: Object.freeze({ color: [0.68, 0.56, 0.34], amount: 0.3, near: 0.8, far: 5.0 }),
});

const glsl = values => `vec3(${values.map(value => value.toFixed(3)).join(',')})`;

export const STORYBOOK_FRAGMENT = `
float storyHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float storyNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(storyHash(i), storyHash(i + vec3(1,0,0)), f.x), mix(storyHash(i + vec3(0,1,0)), storyHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(storyHash(i + vec3(0,0,1)), storyHash(i + vec3(1,0,1)), f.x), mix(storyHash(i + vec3(0,1,1)), storyHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
vec3 storySurface(float code, vec3 p) {
  if (code > 9.5) return vec3(1.0);
  if (code > 8.5) return vec3(0.94 + 0.1 * storyNoise(vec3(p.x * 1.5, p.y * 8.0, p.z * 8.0)));
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
const { haze } = STORYBOOK;
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
  getUniforms() { return { ubo: [{ name: 'storyLook', size: 1, type: 'float' }], fragment: 'uniform float storyLook;' }; }
  bindForSubMesh(uniformBuffer) { uniformBuffer.updateFloat('storyLook', this.state.amount); }
  getCustomCode(shaderType) {
    if (shaderType === 'vertex') return {
      CUSTOM_VERTEX_DEFINITIONS: `#ifdef STORYSURFACE\nattribute float ${SURFACE_KIND};\nvarying float vStorySurface;\n#endif`,
      CUSTOM_VERTEX_MAIN_END: `#ifdef STORYSURFACE\nvStorySurface=${SURFACE_KIND};\n#endif`,
    };
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: `#ifdef STORYSURFACE\nvarying float vStorySurface;\n#endif\n${STORYBOOK_FRAGMENT}`,
      [`!${LIGHT_HOOK.source}`]: '\n#ifdef LIGHT0\ndiffuseBase=storyLight(diffuseBase,normalW,viewDirectionW,vPositionW);\n#endif\n#ifdef STORYSURFACE\nbaseColor.rgb*=mix(vec3(1.0),storySurface(vStorySurface,vPositionW),storyLook);\n#endif\nvec3 finalDiffuse=',
      CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: `#ifdef STORYHAZE\ncolor.rgb=mix(color.rgb,${glsl(haze.color)},storyLook*${haze.amount.toFixed(3)}*smoothstep(${haze.near.toFixed(3)},${haze.far.toFixed(3)},length(vEyePosition.xyz-vPositionW)));\n#endif`,
    };
  }
}

const looks = new WeakMap();
let registered = false;
const dress = (material, state) => material instanceof StandardMaterial && !material.disableLighting && !material.pluginManager?.getPlugin('Storybook') ? new StorybookPlugin(material, state) : null;

export function createStorybook(scene) {
  if (!registered) { RegisterMaterialPlugin('Storybook', material => { const state = looks.get(material.getScene()); return state ? dress(material, state) : null; }); registered = true; }
  const state = { amount: 0 };
  looks.set(scene, state);
  scene.materials.forEach(material => dress(material, state));
  return {
    get amount() { return state.amount; },
    set amount(value) { state.amount = Math.min(1, Math.max(0, value)); },
    dispose() { looks.delete(scene); },
  };
}
