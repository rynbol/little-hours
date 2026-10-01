export const ROOM_LIGHTS = Object.freeze({
  day: { sun: 1.6, sunColor: '#fff1d2', ambient: .9, seated: 1, sky: '#edf4e8', ground: '#a48b6b', darkness: 0, beam: .45, glow: 0, direction: [3, -8, 7], position: [-4, 10, -8] },
  dusk: { glow: .85, sun: .62, sunColor: '#c5ccec', ambient: .44, seated: .5, sky: '#e1d3ed', ground: '#645441', darkness: 0, beam: 0, direction: [3, -8, -5], position: [-5, 10, 6] },
  rain: { glow: .45, sun: .82, sunColor: '#d5dfeb', ambient: .7, seated: .62, sky: '#e0e7ed', ground: '#645441', darkness: 0, beam: 0, direction: [3, -8, -5], position: [-5, 10, 6] },
});

export const seatedDim = (theme, blend) => 1 - blend * (1 - ROOM_LIGHTS[theme].seated);
