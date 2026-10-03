import { Color, DataTexture, LinearFilter, MeshToonMaterial, RedFormat, Vector2, Vector3 } from 'three';

export const BANDS = Object.freeze([[0, 0.3], [0.43, 0.3], [0.49, 0.66], [0.67, 0.66], [0.73, 1], [1, 1]]);

export function bandAt(coord) {
  for (let i = 1; i < BANDS.length; i++) {
    const [x1, y1] = BANDS[i], [x0, y0] = BANDS[i - 1];
    if (coord <= x1) { const t = (coord - x0) / Math.max(1e-6, x1 - x0), s = t * t * (3 - 2 * t); return y0 + (y1 - y0) * s; }
  }
  return 1;
}

export const SHADE = Object.freeze({ fill: 0.55, tint: '#6f9be8', cool: 0.75, low: 1.05, high: 0.55 });
const COOL = new Color(SHADE.tint);
export const FIGURE = Object.freeze({ glint: 1.25, warm: [1.2, 0.98, 0.86], glow: [0.16, 0.05, 0.0], cloth: 0.5, lift: 1.15 });
const vec = list => `vec3(${list.map(v => v.toFixed(3)).join(', ')})`;

export function createPainterly({ rim = '#fff0d2', rimStrength = 0.55, rimPower = 2.8 } = {}) {
  const width = 128, data = new Uint8Array(width);
  for (let i = 0; i < width; i++) data[i] = Math.round(bandAt(i / (width - 1)) * 255);
  const gradient = new DataTexture(data, width, 1, RedFormat);
  gradient.magFilter = LinearFilter; gradient.minFilter = LinearFilter; gradient.generateMipmaps = false; gradient.needsUpdate = true;
  const shared = { rimColor: { value: new Color(rim) }, rimStrength: { value: rimStrength }, rimPower: { value: rimPower }, sunView: { value: new Vector3(0, 1, 0) }, wet: { value: 0 }, shadowFill: { value: new Color(0, 0, 0) }, shadowBand: { value: new Vector2(1, 2) } };
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

  function figureParts(shader) {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float part;\nvarying float vPart;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPart = part;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vPart;')
      .replace('#include <opaque_fragment>', `float figureShade = 1.0 - smoothstep(shadowBand.x, shadowBand.y, lightLevel), skinPart = step(2.5, vPart), fillLevel = dot(shadowFill, vec3(0.3333));
outgoingLight += diffuseColor.rgb * (mix(mix(shadowFill, vec3(fillLevel), ${FIGURE.cloth.toFixed(2)}), fillLevel * ${vec(FIGURE.warm)}, skinPart) * ${FIGURE.lift.toFixed(2)} - shadowFill + fillLevel * ${vec(FIGURE.glow)} * skinPart) * figureShade;
outgoingLight = mix(outgoingLight, diffuseColor.rgb * max(lightLevel, shadowBand.y) * mix(1.0, ${FIGURE.glint.toFixed(2)}, step(1.5, vPart)), step(0.5, vPart) * (1.0 - skinPart));
#include <opaque_fragment>`);
  }

  function patch(shader, { glow, rim, dissolve, figure }) {
    Object.assign(shader.uniforms, shared, { glow: glow ?? { value: 0 }, rimOn: { value: rim ? 1 : 0 } });
    if (dissolve) crumble(shader, dissolve);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;\nuniform float rimStrength;\nuniform float rimPower;\nuniform vec3 sunView;\nuniform float glow;\nuniform float rimOn;\nuniform float wet;\nuniform vec3 shadowFill;\nuniform vec2 shadowBand;')
      .replace('#include <opaque_fragment>', `float lightLevel = dot(outgoingLight / max(diffuseColor.rgb, vec3(0.03)), vec3(0.3333));
outgoingLight += diffuseColor.rgb * shadowFill * (1.0 - smoothstep(shadowBand.x, shadowBand.y, lightLevel));
float facing = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
float toward = clamp(dot(normalize(normal), sunView) * 0.5 + 0.6, 0.0, 1.0);
outgoingLight += rimColor * pow(facing, rimPower) * rimStrength * toward * rimOn;
outgoingLight += diffuseColor.rgb * glow;
float upward = clamp(dot(normalize(normal), normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz)), 0.0, 1.0);
outgoingLight = outgoingLight * (1.0 - wet * 0.26) + rimColor * wet * upward * pow(facing, 2.0) * 0.1;
#include <opaque_fragment>`);
    if (figure) figureParts(shader);
  }

  return {
    shared, gradient,
    material(color, { vertexColors = false, glow, rim = true, side, transparent = false, opacity = 1, dissolve, figure = false } = {}) {
      const material = new MeshToonMaterial({ color, gradientMap: gradient, vertexColors, transparent, opacity });
      if (side !== undefined) material.side = side;
      material.onBeforeCompile = shader => patch(shader, { glow, rim, dissolve, figure });
      material.customProgramCacheKey = () => `${dissolve ? 'wilds-painterly-dissolve' : 'wilds-painterly'}${figure ? '-figure' : ''}`;
      materials.add(material);
      return material;
    },
    shade(light) {
      shared.shadowFill.value.copy(light.sky).lerp(COOL, SHADE.cool).multiplyScalar(SHADE.fill * (1 - light.night));
      shared.shadowBand.value.set(light.fill * SHADE.low, light.fill + light.strength * SHADE.high);
    },
    setSun(direction, camera) { shared.sunView.value.copy(direction).transformDirection(camera.matrixWorldInverse); },
    dispose() { for (const material of materials) material.dispose(); materials.clear(); gradient.dispose(); },
  };
}
