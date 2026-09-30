import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { RegisterMaterialPlugin } from '@babylonjs/core/Materials/materialPluginManager.js';

export const PAINTERLY_FRAGMENT = `
float plHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float plNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(plHash(i), plHash(i + vec3(1,0,0)), f.x), mix(plHash(i + vec3(0,1,0)), plHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(plHash(i + vec3(0,0,1)), plHash(i + vec3(1,0,1)), f.x), mix(plHash(i + vec3(0,1,1)), plHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float plStroke(vec3 p, vec3 n) {
  vec3 a = abs(n);
  vec2 q = a.y > max(a.x, a.z) ? p.xz : a.x > a.z ? p.zy : p.xy;
  vec2 r = vec2(q.x * 0.8 + q.y * 0.6, q.y * 0.8 - q.x * 0.6);
  return plNoise(vec3(r.x * 0.9, r.y * 4.5, 0.0)) * 0.7 + plNoise(vec3(r.x * 2.6, r.y * 12.0, 3.1)) * 0.3;
}
vec3 plLight(vec3 light, vec3 n, vec3 v, vec3 p) {
  float level = max(max(light.r, light.g), light.b);
  vec3 hue = light / max(level, 0.0001);
  float lit = smoothstep(0.2, 0.46, level + (plNoise(p * 3.0) - 0.5) * 0.08);
  vec3 tone = hue * mix(plShadow, vec3(1.0), lit) * (0.66 + 0.38 * lit + 0.1 * smoothstep(0.85, 1.3, level));
  float facing = 1.0 - max(dot(n, v), 0.0);
  tone += plRim * pow(facing, 3.0) * smoothstep(-0.3, 0.7, n.y) * (0.25 + 0.35 * lit);
  return mix(light, tone, plLook);
}
`;

const LIGHT_HOOK = /vec3 finalDiffuse=/g;

export class PainterlyPlugin extends MaterialPluginBase {
  constructor(material, state) {
    super(material, 'Painterly', 150, {}, true, true);
    this.state = state;
  }
  getClassName() { return 'PainterlyPlugin'; }
  isCompatible(shaderLanguage) { return shaderLanguage === 0; }
  getUniforms() {
    return {
      ubo: [
        { name: 'plLook', size: 1, type: 'float' }, { name: 'plShadow', size: 3, type: 'vec3' }, { name: 'plRim', size: 3, type: 'vec3' },
        { name: 'plHaze', size: 3, type: 'vec3' }, { name: 'plDepth', size: 4, type: 'vec4' },
      ],
      fragment: 'uniform float plLook; uniform vec3 plShadow, plRim, plHaze; uniform vec4 plDepth;',
    };
  }
  bindForSubMesh(uniformBuffer) {
    const { look, shadow, rim, haze, depth } = this.state;
    uniformBuffer.updateFloat('plLook', look);
    uniformBuffer.updateFloat3('plShadow', ...shadow); uniformBuffer.updateFloat3('plRim', ...rim); uniformBuffer.updateFloat3('plHaze', ...haze);
    uniformBuffer.updateFloat4('plDepth', ...depth);
  }
  getCustomCode(shaderType) {
    if (shaderType !== 'fragment') return null;
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: PAINTERLY_FRAGMENT,
      [`!${LIGHT_HOOK.source}`]: '\n#ifdef LIGHT0\ndiffuseBase=plLight(diffuseBase,normalW,viewDirectionW,vPositionW);\n#endif\nbaseColor.rgb*=mix(vec3(1.0),vec3(0.95+0.1*plStroke(vPositionW,normalW)),plLook);\nvec3 finalDiffuse=',
      CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: 'float plFar=smoothstep(plDepth.x,plDepth.y,length(vEyePosition.xyz-vPositionW)),plLow=1.0-smoothstep(plDepth.z,plDepth.w,vPositionW.y);\ncolor.rgb=mix(color.rgb,plHaze,plLook*clamp(plFar*0.3+plLow*0.55,0.0,0.7));',
    };
  }
}

export const PAINTERLY_LOOKS = Object.freeze({
  day: { shadow: [0.62, 0.7, 0.92], rim: [1, 0.96, 0.82], haze: [0.8, 0.88, 0.96] },
  dusk: { shadow: [0.56, 0.54, 0.86], rim: [1, 0.8, 0.62], haze: [0.44, 0.45, 0.66] },
  rain: { shadow: [0.62, 0.7, 0.8], rim: [0.86, 0.92, 0.96], haze: [0.58, 0.68, 0.74] },
  interior: { shadow: [0.74, 0.62, 0.8], rim: [1, 0.8, 0.56], haze: [0.3, 0.24, 0.3], depth: [900, 1000, -900, -800] },
});

const states = new WeakMap();
let registered = false;
const dress = (material, state) => material instanceof StandardMaterial && !material.disableLighting && !material.pluginManager?.getPlugin('Painterly') ? new PainterlyPlugin(material, state) : null;

export function createPainterly(scene, theme = 'day') {
  if (!registered) { RegisterMaterialPlugin('Painterly', material => { const state = states.get(material.getScene()); return state ? dress(material, state) : null; }); registered = true; }
  const state = { look: 1, depth: [26, 44, -5.5, -1.4], ...PAINTERLY_LOOKS[theme] || PAINTERLY_LOOKS.day };
  states.set(scene, state);
  scene.materials.forEach(material => dress(material, state));
  return {
    state,
    setTheme(next) { Object.assign(state, PAINTERLY_LOOKS[next] || PAINTERLY_LOOKS.day); },
    setDepth(near, far, bottom, top) { state.depth = [near, far, bottom, top]; },
    dispose() { states.delete(scene); },
  };
}
