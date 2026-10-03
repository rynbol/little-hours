import { WORLD_ATMOSPHERES } from '../world/atmosphere.js';

const sunFrom = (heading, elevation) => Object.freeze([Math.cos(elevation) * Math.sin(heading), Math.sin(elevation), -Math.cos(elevation) * Math.cos(heading)]);

const TURF = Object.freeze({
  day: Object.freeze({
    sun: sunFrom(-0.9, 0.8), sunColor: '#fff0c8', shadowStrength: 1, bloom: 0.2,
    zenith: '#3f86d6', high: '#74aee8', horizon: '#c4def0', horizonAway: '#c4def0', glow: '#f6f6e8',
    cloudLit: '#ffffff', cloudShade: '#a4b8d6', cloudRim: '#fffaf0',
    skyAmbient: '#a2c4ea', groundAmbient: '#8aa056', shadowTint: '#5a7cc0', shadowLift: 0.46,
    fogNear: '#b4cfe2', fogFar: '#86acd6', fogSun: '#eef2e2', mist: '#bcd6ea', ridgeLight: '#bcd6ea',
    leafTop: '#b6da4c', leafUnder: '#4a8c34', leafMid: '#2a6a3c', leafBack: '#daee7c', leafCrown: '#aad242', needleTop: '#3f7c3a', needleUnder: '#1e402c', bark: '#6a5640',
    rock: '#aeb0a4', rockDark: '#6e7668',
    flowerWhite: '#fbfaf0', flowerYellow: '#f4d04a',
    grass: '#5a8a36', grassLight: '#84a846', grassWarm: '#a6aa4e', grassTip: '#d6dc88', grassFar: '#94b45a', forestFloor: '#4a7a32', dirt: '#b8a274', sand: '#d8cc9a' }),
  dusk: Object.freeze({ sun: sunFrom(-0.5, 0.36), shadowStrength: 0.8, bloom: 0.3, bark: '#6c5544', grass: '#688f48', grassLight: '#93ac5c', grassWarm: '#aaa858', grassTip: '#f0d890', grassFar: '#a8b060', forestFloor: '#56703c', dirt: '#a8946a', sand: '#ccb88a' }),
  rain: Object.freeze({ shadowStrength: 0.4, bloom: 0.1, skyAmbient: '#a4b0a6', groundAmbient: '#6c7860', fogNear: '#7c887e', fogFar: '#74827c', fogSun: '#8f9a90', zenith: '#667068', high: '#7a857c', horizon: '#8f9a8e', horizonAway: '#8f9a8e', glow: '#9aa498', cloudLit: '#8a948a', cloudShade: '#666e66', cloudRim: '#9aa498', mist: '#869086', grass: '#6f8e52', grassLight: '#84a05e', grassWarm: '#8e9a58', grassTip: '#a4b47c', grassFar: '#5c7448', forestFloor: '#587244', dirt: '#8c8064', sand: '#a8a084' }),
});

export const WILDS_ATMOSPHERES = Object.freeze(Object.fromEntries(Object.entries(WORLD_ATMOSPHERES).map(([theme, air]) => [theme, Object.freeze({ ...air, ...TURF[theme] })])));

export const wildsAtmosphere = theme => WILDS_ATMOSPHERES[theme] || WILDS_ATMOSPHERES.day;
