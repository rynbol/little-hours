import { Color, DataTexture, LinearFilter, MeshToonMaterial, RedFormat, Vector3 } from 'three';

export const BANDS = Object.freeze([[0, 0.3], [0.43, 0.3], [0.49, 0.66], [0.67, 0.66], [0.73, 1], [1, 1]]);

export function bandAt(coord) {
  for (let i = 1; i < BANDS.length; i++) {
    const [x1, y1] = BANDS[i], [x0, y0] = BANDS[i - 1];
    if (coord <= x1) { const t = (coord - x0) / Math.max(1e-6, x1 - x0), s = t * t * (3 - 2 * t); return y0 + (y1 - y0) * s; }
  }
  return 1;
}

export function createPainterly({ rim = '#fff0d2', rimStrength = 0.55, rimPower = 2.8 } = {}) {
  const width = 128, data = new Uint8Array(width);
  for (let i = 0; i < width; i++) data[i] = Math.round(bandAt(i / (width - 1)) * 255);
  const gradient = new DataTexture(data, width, 1, RedFormat);
  gradient.magFilter = LinearFilter; gradient.minFilter = LinearFilter; gradient.generateMipmaps = false; gradient.needsUpdate = true;
  const shared = { rimColor: { value: new Color(rim) }, rimStrength: { value: rimStrength }, rimPower: { value: rimPower }, sunView: { value: new Vector3(0, 1, 0) }, wet: { value: 0 } };
  const materials = new Set();

  function crumble(shader, dissolve) {
    shader.uniforms.dissolve = dissolve;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRest;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float dissolve;\nvarying vec3 vRest;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
float grain = fract(sin(dot(floor(vRest * 7.0), vec3(12.9898, 78.233, 45.164))) * 43758.5453) * 0.75 + clamp(vRest.y / 4.6, 0.0, 1.0) * 0.25;
if (grain < dissolve) discard;`)
      .replace('#include <opaque_fragment>', `outgoingLight += vec3(1.0, 0.8, 0.55) * smoothstep(0.07, 0.0, grain - dissolve) * step(0.0001, dissolve) * 1.6;
#include <opaque_fragment>`);
  }

  function patch(shader, { glow, rim, dissolve }) {
    Object.assign(shader.uniforms, shared, { glow: glow ?? { value: 0 }, rimOn: { value: rim ? 1 : 0 } });
    if (dissolve) crumble(shader, dissolve);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;\nuniform float rimStrength;\nuniform float rimPower;\nuniform vec3 sunView;\nuniform float glow;\nuniform float rimOn;\nuniform float wet;')
      .replace('#include <opaque_fragment>', `float facing = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
float toward = clamp(dot(normalize(normal), sunView) * 0.5 + 0.6, 0.0, 1.0);
outgoingLight += rimColor * pow(facing, rimPower) * rimStrength * toward * rimOn;
outgoingLight += diffuseColor.rgb * glow;
float upward = clamp(dot(normalize(normal), normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz)), 0.0, 1.0);
outgoingLight = outgoingLight * (1.0 - wet * 0.26) + rimColor * wet * upward * pow(facing, 2.0) * 0.1;
#include <opaque_fragment>`);
  }

  return {
    shared, gradient,
    material(color, { vertexColors = false, glow, rim = true, side, transparent = false, opacity = 1, dissolve } = {}) {
      const material = new MeshToonMaterial({ color, gradientMap: gradient, vertexColors, transparent, opacity });
      if (side !== undefined) material.side = side;
      material.onBeforeCompile = shader => patch(shader, { glow, rim, dissolve });
      material.customProgramCacheKey = () => dissolve ? 'wilds-painterly-dissolve' : 'wilds-painterly';
      materials.add(material);
      return material;
    },
    setSun(direction, camera) { shared.sunView.value.copy(direction).transformDirection(camera.matrixWorldInverse); },
    dispose() { for (const material of materials) material.dispose(); materials.clear(); gradient.dispose(); },
  };
}
