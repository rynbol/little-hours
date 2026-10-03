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
  const shared = { rimColor: { value: new Color(rim) }, rimStrength: { value: rimStrength }, rimPower: { value: rimPower }, sunView: { value: new Vector3(0, 1, 0) } };
  const materials = new Set();

  function patch(shader, { glow, rim }) {
    Object.assign(shader.uniforms, shared, { glow: glow ?? { value: 0 }, rimOn: { value: rim ? 1 : 0 } });
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;\nuniform float rimStrength;\nuniform float rimPower;\nuniform vec3 sunView;\nuniform float glow;\nuniform float rimOn;')
      .replace('#include <opaque_fragment>', `float facing = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
float toward = clamp(dot(normalize(normal), sunView) * 0.5 + 0.6, 0.0, 1.0);
outgoingLight += rimColor * pow(facing, rimPower) * rimStrength * toward * rimOn;
outgoingLight += diffuseColor.rgb * glow;
#include <opaque_fragment>`);
  }

  return {
    shared, gradient,
    material(color, { vertexColors = false, glow, rim = true, side, transparent = false, opacity = 1 } = {}) {
      const material = new MeshToonMaterial({ color, gradientMap: gradient, vertexColors, transparent, opacity });
      if (side !== undefined) material.side = side;
      material.onBeforeCompile = shader => patch(shader, { glow, rim });
      material.customProgramCacheKey = () => 'wilds-painterly';
      materials.add(material);
      return material;
    },
    setSun(direction, camera) { shared.sunView.value.copy(direction).transformDirection(camera.matrixWorldInverse); },
    dispose() { for (const material of materials) material.dispose(); materials.clear(); gradient.dispose(); },
  };
}
