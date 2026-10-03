import { Color, Vector3 } from 'three';
import { createWeather, weather } from '../../core/wilds/weather.js';

const key = (hour, look) => Object.freeze({ hour, ...look });
const KEYS = Object.freeze([
  key(4.6, { haze: 1.15, light: '#9fb6ec', strength: 0.85, zenith: '#0f1b38', middle: '#22345a', horizon: '#42577f', sky: '#8094c8', earth: '#323c52', fill: 1.05, fog: '#2e3c5c', exposure: 1.2, night: 1, glow: '#b4c8f4' }),
  key(5.7, { haze: 1.5, light: '#c79a9a', strength: 0.8, zenith: '#2a3a66', middle: '#6f6a8a', horizon: '#d99a84', sky: '#9a96b8', earth: '#454538', fill: 1.0, fog: '#8c7f92', exposure: 1.12, night: 0.6, glow: '#ffb48a' }),
  key(6.8, { haze: 1.35, light: '#ffb98a', strength: 1.5, zenith: '#7f9cc8', middle: '#e3b9a6', horizon: '#ffd4ac', sky: '#d2bfcc', earth: '#6b6a50', fill: 0.95, fog: '#e6cdb8', exposure: 1.04, night: 0.05, glow: '#ffd2a0' }),
  key(9, { haze: 1.0, light: '#fff0d6', strength: 2.6, zenith: '#5f97d6', middle: '#a9cbe6', horizon: '#dde8e6', sky: '#bcd4ea', earth: '#6f8a4c', fill: 1.35, fog: '#d3e1e6', exposure: 1.05, night: 0, glow: '#fff1d0' }),
  key(13, { haze: 0.85, light: '#fff6e6', strength: 2.9, zenith: '#4c8bd6', middle: '#9cc4e8', horizon: '#d6e5ea', sky: '#bcd6ee', earth: '#6f8a4c', fill: 1.35, fog: '#d0e0e8', exposure: 1.03, night: 0, glow: '#fff4dc' }),
  key(17.4, { haze: 1.0, light: '#ffe4b6', strength: 2.7, zenith: '#5a8fd0', middle: '#b2c8e0', horizon: '#ecdcc8', sky: '#cdd2dc', earth: '#748a4a', fill: 1.25, fog: '#e2dcd0', exposure: 1.05, night: 0, glow: '#ffe6b8' }),
  key(19.2, { haze: 1.4, light: '#ffad66', strength: 2.5, zenith: '#6a8cc4', middle: '#eebf98', horizon: '#ffc98c', sky: '#f0c8a2', earth: '#6d6040', fill: 1.1, fog: '#efc49c', exposure: 1.1, night: 0, glow: '#ffbf7a' }),
  key(20.4, { haze: 1.3, light: '#ff8358', strength: 1.1, zenith: '#3c5088', middle: '#b48aa2', horizon: '#f39a7a', sky: '#a99bc0', earth: '#4e4a40', fill: 1.0, fog: '#b0949e', exposure: 1.12, night: 0.35, glow: '#ff9c70' }),
  key(21.6, { haze: 1.1, light: '#9fb6ec', strength: 0.85, zenith: '#111d3a', middle: '#24375c', horizon: '#45597f', sky: '#8094c8', earth: '#323c52', fill: 1.05, fog: '#2f3d5c', exposure: 1.2, night: 1, glow: '#b4c8f4' }),
]);
const COLOURS = Object.freeze(['light', 'zenith', 'middle', 'horizon', 'sky', 'earth', 'fog', 'glow']);
const PARSED = KEYS.map(entry => Object.fromEntries(COLOURS.map(name => [name, new Color(entry[name])])));
const OVERCAST = Object.fromEntries(Object.entries({ light: '#c4c8d0', zenith: '#66727f', middle: '#8a939c', horizon: '#a6abac', sky: '#9ea6b0', earth: '#4c5544', fog: '#9aa1a6', glow: '#e4e0d8' }).map(([name, colour]) => [name, new Color(colour)]));
const GREY = Object.freeze({ blend: 0.85, sun: 0.72, fill: 0.12, exposure: 0.08, haze: 0.9 });
export const DAWN = 6.1, DUSK = 20.6;

export function createDaylight() {
  const out = { sun: new Vector3(), moon: new Vector3(), toward: new Vector3(), strength: 1, fill: 1, exposure: 1, night: 0, haze: 1, ...createWeather() };
  for (const name of COLOURS) out[name] = new Color();
  return out;
}

export function daylight(hour, out = createDaylight()) {
  const h = ((hour % 24) + 24) % 24;
  let i = KEYS.findIndex(entry => entry.hour > h);
  if (i < 0) i = 0;
  const a = (i + KEYS.length - 1) % KEYS.length, b = i, from = KEYS[a].hour, span = ((KEYS[b].hour - from) + 24) % 24 || 24, t = (((h - from) + 24) % 24) / span;
  for (const name of COLOURS) out[name].copy(PARSED[a][name]).lerp(PARSED[b][name], t);
  for (const name of ['strength', 'fill', 'exposure', 'night', 'haze']) out[name] = KEYS[a][name] + (KEYS[b][name] - KEYS[a][name]) * t;
  weather(h, out);
  for (const name of COLOURS) if (OVERCAST[name]) out[name].lerp(OVERCAST[name], out.cloud * GREY.blend);
  out.strength *= 1 - out.cloud * GREY.sun; out.fill *= 1 + out.cloud * GREY.fill; out.exposure += out.cloud * GREY.exposure; out.haze *= 1 + out.cloud * GREY.haze;
  const arc = (h - DAWN) / (DUSK - DAWN) * Math.PI;
  out.sun.set(Math.cos(arc), Math.sin(arc) * 0.86, 0.3 + Math.sin(arc) * 0.2).normalize();
  const moonArc = (((h - DUSK + 24) % 24) / (24 - DUSK + DAWN)) * Math.PI;
  out.moon.set(Math.cos(moonArc) * 0.7, 0.35 + Math.sin(moonArc) * 0.55, -0.45).normalize();
  out.toward.copy(out.sun).setY(Math.max(0.1, out.sun.y)).normalize().lerp(out.moon, out.night).normalize();
  return out;
}
