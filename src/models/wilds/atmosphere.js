import { WORLD_ATMOSPHERES } from '../world/atmosphere.js';

const TURF = Object.freeze({
  day: Object.freeze({ grass: '#5c9a3a', grassLight: '#7fb748', grassWarm: '#96b34a', grassTip: '#c9e27a', grassFar: '#9cc65c', forestFloor: '#4c8636', dirt: '#b3a273', sand: '#d8cc9a' }),
  dusk: Object.freeze({ grass: '#688f48', grassLight: '#93ac5c', grassWarm: '#aaa858', grassTip: '#f0d890', grassFar: '#a8b060', forestFloor: '#56703c', dirt: '#a8946a', sand: '#ccb88a' }),
  rain: Object.freeze({ grass: '#6f8e52', grassLight: '#84a05e', grassWarm: '#8e9a58', grassTip: '#a4b47c', grassFar: '#5c7448', forestFloor: '#587244', dirt: '#8c8064', sand: '#a8a084' }),
});

export const WILDS_ATMOSPHERES = Object.freeze(Object.fromEntries(Object.entries(WORLD_ATMOSPHERES).map(([theme, air]) => [theme, Object.freeze({ ...air, ...TURF[theme] })])));

export const wildsAtmosphere = theme => WILDS_ATMOSPHERES[theme] || WILDS_ATMOSPHERES.day;
