const sunFrom = (heading, elevation) => Object.freeze([Math.cos(elevation) * Math.sin(heading), Math.sin(elevation), -Math.cos(elevation) * Math.cos(heading)]);

export const WORLD_ATMOSPHERES = Object.freeze({
  day: Object.freeze({
    sun: sunFrom(-0.02, 0.23), sunColor: '#fff4dc', sunStrength: 1,
    zenith: '#8fb3c4', high: '#a5c2c8', horizon: '#cfdcd2', horizonAway: '#cfdcd2', glow: '#f4f2dc', glowStrength: 0.7, sunGlow: '#ffe2bc', sunGlowStrength: 0.6, goldenHour: 0,
    skyAmbient: '#a9c4d6', groundAmbient: '#8a9a5c', shadowTint: '#6f86a8', shadowLift: 0.42,
    fogNear: '#bcd0cc', fogFar: '#7a9eae', fogSun: '#dfe8d0', fogDensity: 0.0005, fogHeight: 300, sunFocus: 10, sunScatter: 0,
    mist: '#bcd0cc', mistStrength: 0.42, ridgeLift: 0, ridgeLight: '#bcd0cc',
    cloudLit: '#fdfaf0', cloudShade: '#7092a9', cloudRim: '#ffe4a6', cloudCover: 0.55,
    water: '#4f8f96', waterShallow: '#3e5a44',
    leafTop: '#9ccc3c', leafUnder: '#2f5a32', leafBack: '#d8ea78', leafCrown: '#8fc04a', needleTop: '#4f8a3c', needleUnder: '#24452e', bark: '#76825a',
    grass: '#679a46', grassLight: '#8bb556', grassWarm: '#a0ae52', grassTip: '#c6dba0', grassFar: '#e6f848', flowerWhite: '#f6f4ea', flowerYellow: '#f4dc7a', flowerLilac: '#b8a4dc', forestFloor: '#4f8a3a', rock: '#8d9ea3', rockDark: '#61747e', dirt: '#a89e74', sand: '#d4cc9c', snow: '#f4f6f4', crestGlow: 0.15,
  }),
  dusk: Object.freeze({
    sun: sunFrom(-0.2, 0.19), sunColor: '#ffd49c', sunStrength: 1,
    zenith: '#7e8a8c', high: '#84918a', horizon: '#fcbe74', horizonAway: '#9aa4a8', glow: '#ffe6a8', glowStrength: 0.9, sunGlow: '#fff1c3', sunGlowStrength: 0.8, goldenHour: 1,
    skyAmbient: '#8c8a9c', groundAmbient: '#5f6248', shadowTint: '#5f6e80', shadowLift: 0.38,
    fogNear: '#91928c', fogFar: '#5f7284', fogSun: '#fcbe74', fogDensity: 0.00042, fogHeight: 220, sunFocus: 36, sunScatter: 0.6,
    mist: '#91928c', mistStrength: 0.45, ridgeLift: 0, ridgeLight: '#91928c',
    cloudLit: '#ffe2b0', cloudShade: '#74768a', cloudRim: '#fff1c3', cloudCover: 0.5,
    water: '#56707a', waterShallow: '#3a3e38',
    leafTop: '#a8bc4a', leafUnder: '#2f5a56', leafBack: '#ffcf6a', leafCrown: '#98ac4c', needleTop: '#5e8040', needleUnder: '#2a4442', bark: '#544c3c',
    grass: '#6e9450', grassLight: '#a0b468', grassWarm: '#b4b060', grassTip: '#fae6b0', grassFar: '#c0c050', flowerWhite: '#f2e2cc', flowerYellow: '#f0d488', flowerLilac: '#b49ccc', forestFloor: '#56683c', rock: '#8c949a', rockDark: '#5f6874', dirt: '#9a8c6a', sand: '#c8b88e', snow: '#ffe2cc', crestGlow: 0.9,
  }),
  rain: Object.freeze({
    sun: sunFrom(0.5, 0.6), sunColor: '#c8ccc0', sunStrength: 0.4,
    zenith: '#3e443c', high: '#474d42', horizon: '#555c4c', horizonAway: '#555c4c', glow: '#6a6e5e', glowStrength: 0.15, sunGlow: '#6a6e5e', sunGlowStrength: 0, goldenHour: 0,
    skyAmbient: '#7a8272', groundAmbient: '#4e5642', shadowTint: '#5e665c', shadowLift: 0.7,
    fogNear: '#5c6252', fogFar: '#4a5045', fogSun: '#6a6e5e', fogDensity: 0.00105, fogHeight: 200, sunFocus: 10, sunScatter: 0,
    mist: '#5c6252', mistStrength: 0.6, ridgeLift: 0.45, ridgeLight: '#666e5e',
    cloudLit: '#4c5246', cloudShade: '#3e443a', cloudRim: '#6a6e5e', cloudCover: 0.95,
    water: '#4a5448', waterShallow: '#32382e',
    leafTop: '#64804a', leafUnder: '#3c4c36', leafBack: '#7a8458', leafCrown: '#62784a', needleTop: '#4a6040', needleUnder: '#33402f', bark: '#4a5038',
    grass: '#7f9a5a', grassLight: '#93a865', grassWarm: '#9ea05e', grassTip: '#94a274', grassFar: '#7a9050', flowerWhite: '#c8ccc4', flowerYellow: '#c8bc78', flowerLilac: '#9c94b0', forestFloor: '#5a7445', rock: '#8a9088', rockDark: '#6c7470', dirt: '#8a8064', sand: '#a8a084', snow: '#e0e4e2', crestGlow: 0,
  }),
});

export const worldAtmosphere = theme => WORLD_ATMOSPHERES[theme] || WORLD_ATMOSPHERES.day;
