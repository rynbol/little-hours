import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { RegisterMaterialPlugin } from '@babylonjs/core/Materials/materialPluginManager.js';

export const STORYBOOK = Object.freeze({
  bands: [0.46, 0.76, 1.0],
  shadow: [0.76, 0.7, 0.9],
  rim: [1.0, 0.76, 0.5],
});

const [low, mid, high] = STORYBOOK.bands, glsl = values => `vec3(${values.map(value => value.toFixed(3)).join(',')})`;

export const STORYBOOK_FRAGMENT = `
float storyHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float storyNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(storyHash(i), storyHash(i + vec3(1,0,0)), f.x), mix(storyHash(i + vec3(0,1,0)), storyHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(storyHash(i + vec3(0,0,1)), storyHash(i + vec3(1,0,1)), f.x), mix(storyHash(i + vec3(0,1,1)), storyHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
vec3 storySurface(float code, vec3 p) {
  if (code > 9.5) return vec3(1.0);
  if (code > 8.5) {
    float streak = storyNoise(vec3(p.x * 1.4, p.y * 34.0, p.z * 34.0)), ring = sin((p.z + p.y) * 70.0 + streak * 10.0);
    return vec3(0.9 + 0.1 * streak + 0.035 * ring * ring) * mix(vec3(1.0), vec3(1.04, 0.98, 0.93), streak);
  }
  if (code > 7.5) return vec3(0.95 + 0.07 * storyNoise(p * 90.0) + 0.03 * storyNoise(p * 23.0));
  if (code > 6.5) return vec3(0.96 + 0.1 * storyNoise(vec3(p.x * 6.0, p.y * 160.0, p.z * 6.0)));
  if (code > 5.5) return vec3(0.98 + 0.03 * storyNoise(p * 120.0));
  if (code > 4.5) return vec3(0.92 + 0.14 * storyNoise(p * 45.0));
  if (code > 3.5) return vec3(1.0 - 0.14 * step(0.86, storyNoise(p * 150.0)));
  if (code > 2.5) return vec3(0.84 + 0.22 * storyNoise(p * 11.0) + 0.06 * storyNoise(p * 47.0));
  return vec3(1.0);
}
vec3 storyLight(vec3 light, vec3 n, vec3 v, vec3 p) {
  float level = max(max(light.r, light.g), light.b);
  vec3 hue = light / max(level, 0.0001);
  float band = ${low.toFixed(3)} + smoothstep(0.14, 0.24, level) * ${(mid - low).toFixed(3)} + smoothstep(0.5, 0.62, level) * ${(high - mid).toFixed(3)} + smoothstep(1.0, 1.3, level) * 0.18;
  vec3 toon = hue * band * mix(${glsl(STORYBOOK.shadow)}, vec3(1.0), smoothstep(0.3, 0.9, band));
  float facing = 1.0 - max(dot(n, v), 0.0);
  toon += ${glsl(STORYBOOK.rim)} * pow(facing, 3.0) * 0.28 * smoothstep(0.08, 0.4, level);
  toon *= 0.95 + 0.07 * storyNoise(p * 7.0) + 0.04 * storyNoise(p * 29.0);
  return mix(light, toon, storyLook);
}
`;

const LIGHT_HOOK = /vec3 finalDiffuse=/g;
export const SURFACE_KIND = 'storySurface';

export class StorybookPlugin extends MaterialPluginBase {
  constructor(material, state) {
    super(material, 'Storybook', 150, { STORYSURFACE: false }, true, true);
    this.state = state;
  }
  getClassName() { return 'StorybookPlugin'; }
  isCompatible(shaderLanguage) { return shaderLanguage === 0; }
  prepareDefines(defines, scene, mesh) { defines.STORYSURFACE = mesh.isVerticesDataPresent(SURFACE_KIND); }
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
