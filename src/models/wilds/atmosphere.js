import { WORLD_ATMOSPHERES } from '../world/atmosphere.js';

const sunFrom = (heading, elevation) => Object.freeze([Math.cos(elevation) * Math.sin(heading), Math.sin(elevation), -Math.cos(elevation) * Math.cos(heading)]);

const TURF = Object.freeze({
  day: Object.freeze({ sun: sunFrom(-0.9, 0.8), shadowStrength: 1, bloom: 0.2, grass: '#5c9a3a', grassLight: '#7fb748', grassWarm: '#96b34a', grassTip: '#c9e27a', grassFar: '#9cc65c', forestFloor: '#4c8636', dirt: '#b3a273', sand: '#d8cc9a' }),
  dusk: Object.freeze({ sun: sunFrom(-0.5, 0.36), shadowStrength: 0.8, bloom: 0.3, grass: '#688f48', grassLight: '#93ac5c', grassWarm: '#aaa858', grassTip: '#f0d890', grassFar: '#a8b060', forestFloor: '#56703c', dirt: '#a8946a', sand: '#ccb88a' }),
  rain: Object.freeze({ shadowStrength: 0.4, bloom: 0.1, skyAmbient: '#a4b0a6', groundAmbient: '#6c7860', fogNear: '#7c887e', fogFar: '#74827c', fogSun: '#8f9a90', zenith: '#667068', high: '#7a857c', horizon: '#8f9a8e', horizonAway: '#8f9a8e', glow: '#9aa498', cloudLit: '#8a948a', cloudShade: '#666e66', cloudRim: '#9aa498', mist: '#869086', grass: '#6f8e52', grassLight: '#84a05e', grassWarm: '#8e9a58', grassTip: '#a4b47c', grassFar: '#5c7448', forestFloor: '#587244', dirt: '#8c8064', sand: '#a8a084' }),
});

export const WILDS_ATMOSPHERES = Object.freeze(Object.fromEntries(Object.entries(WORLD_ATMOSPHERES).map(([theme, air]) => [theme, Object.freeze({ ...air, ...TURF[theme] })])));

export const wildsAtmosphere = theme => WILDS_ATMOSPHERES[theme] || WILDS_ATMOSPHERES.day;
