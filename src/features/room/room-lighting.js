import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { STORYBOOK } from '../../models/storybook.js';

export const ROOM_LIGHTS = Object.freeze({
  day: { haze: STORYBOOK.haze, spill: ['#fff1d0', 0.1], screen: 1, leaves: ['#ffffff', 0], bloom: [.18, .45], pool: [.06, .22], sun: 1.6, sunColor: '#fff1d2', seatedSun: [2.6, '#e3ebff'], ambient: .9, seated: .69, lamp: [.22, 6], seatedLamp: [.3, 1.8], sky: '#edf4e8', ground: '#a48b6b', darkness: 0, beam: .45, glow: 0, direction: [3, -8, 7], position: [-4, 10, -8] },
  dusk: { haze: STORYBOOK.haze, spill: ['#ffc478', 0.09], screen: .58, leaves: ['#c8bca0', .5], bloom: [.4, 1.3], pool: [.3, .8], glow: .85, sun: .62, sunColor: '#c5ccec', seatedSun: [.5, '#c5ccec'], ambient: .44, seated: .5, lamp: [2.1, 3.4], seatedLamp: [2.8, 1.9], sky: '#e1d3ed', ground: '#645441', darkness: 0, beam: 0, direction: [3, -8, -5], position: [-5, 10, 6] },
  rain: { haze: { color: [0.395, 0.353, 0.311], amount: 0.6 }, spill: ['#ffffff', 0], screen: .65, leaves: ['#b8c0c4', .25], bloom: [.26, 1], pool: [.2, .66], glow: .45, sun: .82, sunColor: '#d5dfeb', seatedSun: [.5, '#d5dfeb'], ambient: .7, seated: .38, lamp: [.65, 6], seatedLamp: [2.2, 1.9], sky: '#e0e7ed', ground: '#645441', darkness: 0, beam: 0, direction: [3, -8, -5], position: [-5, 10, 6] },
});

export const seatedDim = (theme, blend) => 1 - blend * (1 - ROOM_LIGHTS[theme].seated);

const SUN_TINTS = Object.fromEntries(Object.entries(ROOM_LIGHTS).map(([theme, { sunColor, seatedSun }]) => [theme, [Color3.FromHexString(sunColor), Color3.FromHexString(seatedSun[1])]]));
export function windowSun(theme, blend, color) {
  const { sun, seatedSun } = ROOM_LIGHTS[theme], [room, seated] = SUN_TINTS[theme];
  Color3.LerpToRef(room, seated, blend, color);
  return sun + (seatedSun[0] - sun) * blend;
}

const towardSeat = (theme, key, blend) => { const [room, seated] = ROOM_LIGHTS[theme][key]; return room + (seated - room) * blend; };
export const roomBloom = (theme, blend) => towardSeat(theme, 'bloom', blend);
export const lampPool = (theme, blend) => towardSeat(theme, 'pool', blend);

export const SEATED_PAINT_BLOOM = 0.3;
export function bloomEmission(material, blend, result) {
  const share = material.name.startsWith('detail-glow') ? 1 - (1 - SEATED_PAINT_BLOOM) * blend : 1, { r, g, b } = material.emissiveColor;
  return result.set(r * share, g * share, b * share, material.alpha);
}

export const LAMP_AT = Object.freeze({ room: [0.85, 2.08, -0.35], seated: [0.96, 1.98, -0.69] });

export function deskLamp(theme, blend) {
  const { lamp, seatedLamp } = ROOM_LIGHTS[theme], mix = (from, to) => from + (to - from) * blend;
  return { intensity: mix(lamp[0], seatedLamp[0]), range: mix(lamp[1], seatedLamp[1]), offset: LAMP_AT.room.map((at, i) => mix(at, LAMP_AT.seated[i])) };
}

export const FOCUS_GRADE = Object.freeze({ globalHue: 70, globalDensity: 40, midtonesSaturation: 15, highlightsSaturation: -10, shadowsExposure: 80, highlightsExposure: -50 });

export function gradeFocus(curves, blend) {
  for (const [key, value] of Object.entries(FOCUS_GRADE)) curves[key] = key === 'globalHue' ? value : value * blend;
  return curves;
}
