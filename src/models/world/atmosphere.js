const sunFrom = (heading, elevation) => Object.freeze([Math.cos(elevation) * Math.sin(heading), Math.sin(elevation), -Math.cos(elevation) * Math.cos(heading)]);

export const WORLD_ATMOSPHERES = Object.freeze({
  day: Object.freeze({
    sun: sunFrom(0.2, 0.22), sunColor: '#fff4dc', sunStrength: 1,
    zenith: '#8fb3c4', high: '#a5c2c8', horizon: '#cfdcd2', horizonAway: '#cfdcd2', glow: '#f4f2dc', glowStrength: 0.7,
    skyAmbient: '#a9c4d6', groundAmbient: '#8a9a5c', shadowTint: '#6f86a8', shadowLift: 0.42,
    fogNear: '#bcd0cc', fogFar: '#7a9eae', fogSun: '#dfe8d0', fogDensity: 0.0005, fogHeight: 300,
    mist: '#bcd0cc', mistStrength: 0.35,
    cloudLit: '#f2f2e8', cloudShade: '#90afc1', cloudRim: '#fffbea', cloudCover: 0.55,
    water: '#4f8f96', waterShallow: '#3e5a44',
    grass: '#679a46', grassLight: '#8bb556', grassWarm: '#a0ae52', grassTip: '#c6dba0', forestFloor: '#4f8a3a', rock: '#8d9ea3', rockDark: '#61747e', dirt: '#a89e74', sand: '#d4cc9c', snow: '#f4f6f4',
  }),
  dusk: Object.freeze({
    sun: sunFrom(-0.2, 0.19), sunColor: '#ffb46a', sunStrength: 0.8,
    zenith: '#7e8a8c', high: '#8e978c', horizon: '#fcbe74', horizonAway: '#a9a496', glow: '#ffe6a8', glowStrength: 0.9,
    skyAmbient: '#8c8a9c', groundAmbient: '#7a5c3c', shadowTint: '#5f6e80', shadowLift: 0.38,
    fogNear: '#91928c', fogFar: '#5f7284', fogSun: '#fcbe74', fogDensity: 0.00042, fogHeight: 220,
    mist: '#91928c', mistStrength: 0.45,
    cloudLit: '#ffe2b0', cloudShade: '#868892', cloudRim: '#fff1c3', cloudCover: 0.5,
    water: '#56707a', waterShallow: '#3a3e38',
    grass: '#74a060', grassLight: '#98b264', grassWarm: '#b0ae5c', grassTip: '#dcd394', forestFloor: '#4c7448', rock: '#8c949a', rockDark: '#5f6874', dirt: '#9a8c6a', sand: '#c8b88e', snow: '#ffe2cc',
  }),
  rain: Object.freeze({
    sun: sunFrom(0.5, 0.6), sunColor: '#c8ccc0', sunStrength: 0.4,
    zenith: '#3e443c', high: '#474d42', horizon: '#555c4c', horizonAway: '#555c4c', glow: '#6a6e5e', glowStrength: 0.15,
    skyAmbient: '#7a8272', groundAmbient: '#4e5642', shadowTint: '#5e665c', shadowLift: 0.7,
    fogNear: '#5c6252', fogFar: '#4a5045', fogSun: '#6a6e5e', fogDensity: 0.00105, fogHeight: 200,
    mist: '#5c6252', mistStrength: 0.6,
    cloudLit: '#4c5246', cloudShade: '#3e443a', cloudRim: '#6a6e5e', cloudCover: 0.95,
    water: '#4a5448', waterShallow: '#32382e',
    grass: '#7f9a5a', grassLight: '#93a865', grassWarm: '#9ea05e', grassTip: '#94a274', forestFloor: '#5a7445', rock: '#8a9088', rockDark: '#6c7470', dirt: '#8a8064', sand: '#a8a084', snow: '#e0e4e2',
  }),
});

export const worldAtmosphere = theme => WORLD_ATMOSPHERES[theme] || WORLD_ATMOSPHERES.day;
