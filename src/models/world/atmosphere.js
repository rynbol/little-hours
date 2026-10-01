const sunFrom = (heading, elevation) => Object.freeze([Math.cos(elevation) * Math.sin(heading), Math.sin(elevation), -Math.cos(elevation) * Math.cos(heading)]);

export const WORLD_ATMOSPHERES = Object.freeze({
  day: Object.freeze({
    sun: sunFrom(-0.62, 0.52), sunColor: '#fff1d6', sunStrength: 1.08,
    zenith: '#5d93c8', horizon: '#c9dde0', glow: '#fff6dc',
    skyAmbient: '#a9c4d6', groundAmbient: '#7d8a5a', shadowTint: '#6f86a8', shadowLift: 0.42,
    fogNear: '#b9cfd2', fogFar: '#a9c3d4', fogSun: '#f2ead0', fogDensity: 0.00042, fogHeight: 260,
    mist: '#d6e2d8', mistStrength: 0.35,
    grass: '#6fa53c', grassLight: '#a8c94e', grassWarm: '#c9c25a', forestFloor: '#4c6a2c', rock: '#8a8c86', rockDark: '#6b6f72', dirt: '#9c8a5e', sand: '#cfc08e', snow: '#f4f6f4',
  }),
  dusk: Object.freeze({
    sun: sunFrom(-0.42, 0.07), sunColor: '#ffb86a', sunStrength: 0.95,
    zenith: '#4a6488', horizon: '#f0b67c', glow: '#ffd59a',
    skyAmbient: '#8a8fb0', groundAmbient: '#6a5a48', shadowTint: '#6c6898', shadowLift: 0.38,
    fogNear: '#c8a68a', fogFar: '#9a96a8', fogSun: '#ffc88a', fogDensity: 0.00048, fogHeight: 200,
    mist: '#c8a898', mistStrength: 0.45,
    grass: '#6a8a3a', grassLight: '#b8a850', grassWarm: '#d8a050', forestFloor: '#43552c', rock: '#8a7a74', rockDark: '#5e5862', dirt: '#8f7458', sand: '#c8a882', snow: '#ffd8c0',
  }),
  rain: Object.freeze({
    sun: sunFrom(-0.62, 0.6), sunColor: '#c8ccc0', sunStrength: 0.45,
    zenith: '#5e6862', horizon: '#8e9890', glow: '#a8aea2',
    skyAmbient: '#8a948e', groundAmbient: '#5a6250', shadowTint: '#6a7478', shadowLift: 0.62,
    fogNear: '#828c86', fogFar: '#8a948e', fogSun: '#9aa098', fogDensity: 0.0011, fogHeight: 160,
    mist: '#9aa49c', mistStrength: 0.6,
    grass: '#55803a', grassLight: '#78964a', grassWarm: '#8c9050', forestFloor: '#3a5028', rock: '#6e726e', rockDark: '#545a5c', dirt: '#6e6450', sand: '#9a9478', snow: '#e0e4e2',
  }),
});

export const worldAtmosphere = theme => WORLD_ATMOSPHERES[theme] || WORLD_ATMOSPHERES.day;
