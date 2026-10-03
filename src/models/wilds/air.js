import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { RegisterMaterialPlugin } from '@babylonjs/core/Materials/materialPluginManager.js';

export const AIR_GLSL = `
vec3 airLight(vec3 view, vec4 sun, vec3 sunColor, vec3 far) {
  float facing = max(dot(view, sun.xyz), 0.);
  return far + sunColor * (pow(facing, 12.) * .7 + pow(facing, 3.) * .22) * sun.w;
}
float airLayer(float eyeY, float pointY, float rise, float density, float falloff) {
  float lift = abs(rise) > .01 ? (exp(-falloff * eyeY) - exp(-falloff * pointY)) / (falloff * rise) : exp(-falloff * eyeY);
  return density * lift;
}
float airAmount(vec3 eye, vec3 point, vec4 density, vec4 mist) {
  vec3 ray = point - eye;
  float d = length(ray);
  float haze = airLayer(max(eye.y, 0.), max(point.y, 0.), ray.y, density.x, density.y);
  float low = airLayer(max(eye.y - mist.z, 0.), max(point.y - mist.z, 0.), ray.y, mist.x, mist.y);
  float drift = .65 + .35 * sin(point.x * .021 + mist.w * .05) * sin(point.z * .017 - mist.w * .04);
  return 1. - exp(-d * (haze + low * drift));
}
`;

const toLinear = color => color.map(value => value ** 2.2);

class AirPlugin extends MaterialPluginBase {
  constructor(material, state) {
    super(material, 'WildsAir', 320, {}, true, true);
    this.state = state;
  }
  getClassName() { return 'WildsAirPlugin'; }
  isCompatible(language) { return language === 0; }
  getUniforms() {
    return {
      ubo: [{ name: 'airSun', size: 4, type: 'vec4' }, { name: 'airSunColor', size: 3, type: 'vec3' }, { name: 'airFar', size: 3, type: 'vec3' }, { name: 'airDensity', size: 4, type: 'vec4' }, { name: 'airMist', size: 4, type: 'vec4' }],
      fragment: 'uniform vec4 airSun; uniform vec3 airSunColor; uniform vec3 airFar; uniform vec4 airDensity; uniform vec4 airMist;',
    };
  }
  bindForSubMesh(ubo) {
    const { sun, glow, sunColor, far, density, mist } = this.state;
    ubo.updateFloat4('airSun', sun[0], sun[1], sun[2], glow);
    ubo.updateFloat3('airSunColor', ...sunColor);
    ubo.updateFloat3('airFar', ...far);
    ubo.updateFloat4('airDensity', ...density);
    ubo.updateFloat4('airMist', ...mist);
  }
  getCustomCode(shaderType) {
    if (shaderType !== 'fragment') return null;
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: AIR_GLSL,
      CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: 'color.rgb = mix(color.rgb, airLight(normalize(vPositionW - vEyePosition.xyz), airSun, airSunColor, airFar), airAmount(vEyePosition.xyz, vPositionW, airDensity, airMist));',
    };
  }
}

const states = new WeakMap();
let registered = false;
const dress = (material, state) => material instanceof StandardMaterial && !material.pluginManager?.getPlugin('WildsAir') ? new AirPlugin(material, state) : null;

export function createAir(scene) {
  if (!registered) { RegisterMaterialPlugin('WildsAir', material => { const state = states.get(material.getScene()); return state ? dress(material, state) : null; }); registered = true; }
  const state = { sun: [0, 1, 0], glow: 1, sunColor: [1, 1, 1], far: [.6, .7, .8], density: [.0003, 1 / 550, 0, 0], mist: [0, 1 / 7, 2, 0] };
  states.set(scene, state);
  scene.materials.forEach(material => dress(material, state));
  return {
    state,
    update(sky, seconds) {
      state.sun = sky.key.direction;
      state.glow = sky.keyFrom === 'sun' ? 1 - sky.shower * .7 : .25;
      state.sunColor = toLinear(sky.key.color).map(value => value * Math.min(1.3, sky.key.intensity * .55));
      state.far = toLinear(sky.far);
      state.density = [.00016 + sky.haze * .00026 + sky.shower * .0009, 1 / 550, 0, 0];
      state.mist = [sky.mist * .012, 1 / 7, 2, seconds];
    },
    dispose() { states.delete(scene); },
  };
}
