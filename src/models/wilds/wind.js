import { noise2 } from '../../core/wilds/noise.js';

export const WIND_GLSL = `
float windGust(sampler2D noiseMap, vec2 p, vec4 wind) {
  vec2 across = vec2(-wind.y, wind.x);
  vec2 q = vec2(dot(p, wind.xy), dot(p, across));
  float swell = texture(noiseMap, vec2(q.x * .0115 - wind.z * .052, q.y * .0072)).r;
  float ripple = texture(noiseMap, vec2(q.x * .043 - wind.z * .16, q.y * .031 + .37)).g;
  return clamp((swell - .36) * 2.3, 0., 1.) * .78 + ripple * .22;
}
`;

export function createWind() {
  const state = { x: .86, z: .51, time: 0, strength: .55, gust: 0 };
  return {
    state,
    update(seconds, { shower = 0, still = false } = {}) {
      const veer = noise2(seconds * .011, 3.7, 811) * .55, angle = 1.03 + veer;
      state.x = Math.sin(angle); state.z = Math.cos(angle);
      state.time = still ? 0 : seconds;
      state.gust = Math.max(0, noise2(seconds * .07, 9.1, 812)) * 1.4;
      state.strength = still ? .08 : .42 + state.gust * .28 + shower * .55;
    },
    uniform: () => [state.x, state.z, state.time, state.strength],
  };
}
