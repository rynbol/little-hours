const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

export const WILDS_RINGS = freeze([
  { minX: -128, maxX: 128, minZ: -128, maxZ: 128, step: 2 },
  { minX: -1024, maxX: 1024, minZ: -1024, maxZ: 1024, step: 8 },
  { minX: -1536, maxX: 1536, minZ: -1536, maxZ: 1536, step: 32 },
]);

export const WILDS_WORLD = freeze({
  id: 'wilds', version: 1, seed: 731,
  bounds: { minX: -900, maxX: 900, minZ: -950, maxZ: 850 },
  spawn: { x: 0, z: 0, yaw: 0 },
  path: { start: -20, end: 320, offset: 0, drift: 0.012, width: 1.8, waves: [{ scale: 32, phase: 0, amplitude: 3.8 }] },
  terrain: {
    base: -6,
    noise: [{ scale: 180, amplitude: 13, octaves: 3, seed: 131 }, { scale: 44, amplitude: 1.8, octaves: 2, seed: 132 }],
    hills: [
      { x: 0, z: -125, radiusX: 150, radiusZ: 155, height: 14 },
      { x: -260, z: -220, radiusX: 210, radiusZ: 145, height: 34 },
      { x: 370, z: -360, radiusX: 190, radiusZ: 175, height: 45 },
      { x: -310, z: -790, radiusX: 190, radiusZ: 200, height: 115 },
      { x: 20, z: -900, radiusX: 150, radiusZ: 150, height: 85 },
      { x: 390, z: -900, radiusX: 140, radiusZ: 155, height: 110 },
      { x: 30, z: -400, radiusX: 150, radiusZ: 110, height: -23 },
      { x: -220, z: 150, radiusX: 160, radiusZ: 200, height: 46 },
      { x: 210, z: 170, radiusX: 180, radiusZ: 180, height: 37 },
    ],
  },
  clearings: [{ x: 0, z: 0, radius: 10, blend: 68, height: 0 }],
  regions: [{ id: 'forest', exit: 90, blend: 80 }, { id: 'meadow', from: 50, to: 230, blend: 80 }],
  water: [{ id: 'mirror-fen', x: 25, z: -410, radiusX: 123, radiusZ: 87, level: -10, basin: { depth: 0.3, bank: 1.8, blend: 56, shoreline: [{ lobes: 5, amplitude: 0.055, phase: 0.8 }, { lobes: 9, amplitude: 0.024, phase: 2.3 }] } }],
  trees: {
    bounds: { minX: -420, maxX: 420, minZ: -450, maxZ: 270 }, spacing: 8, near: 70, style: 'woodland', groveScale: 38,
    opening: { minX: -29, maxX: 29, minZ: -62, maxZ: 28 }, canopyShade: .32,
    heroes: [
      { x: -15, z: 10, size: 2.15, tall: .96, kind: 2, turn: 1.15 },
      { x: -21, z: -4, size: 1.2, tall: 1.14, kind: 0, turn: 3.3 },
      { x: -14, z: -19, size: 1.45, tall: .91, kind: 2, turn: .55 },
      { x: -23, z: -27, size: 1.06, tall: 1.16, kind: 0, turn: 4.5 },
      { x: -18, z: -39, size: 1.25, tall: .93, kind: 2, turn: 2.7 },
      { x: -20, z: -53, size: 1, tall: 1.1, kind: 0, turn: 5.1 },
      { x: 18, z: -10, size: 1.68, tall: .87, kind: 2, turn: 4.1 },
      { x: 14, z: -24, size: 1.22, tall: 1.12, kind: 0, turn: 2.1 },
      { x: 22, z: -33, size: 1.34, tall: .89, kind: 2, turn: .2 },
      { x: 14, z: -46, size: 1.1, tall: 1.06, kind: 0, turn: 3.7 },
      { x: 20, z: -57, size: .96, tall: .91, kind: 2, turn: 5.5 },
    ],
  },
  rocks: [
    { x: 5.5, z: -8, size: [1.9, 1.15, 1.6], seat: true, climbable: true, turn: 0.4 },
    { x: -5.8, z: -14, size: [1.3, 0.65, 1.1], turn: 0.7 },
    { x: 8.5, z: -28, size: [1.5, 0.85, 1.1], turn: 1.1 },
    { x: -4.5, z: -36, size: [0.7, 0.45, 0.7], turn: 1.7 },
    { x: 7.6, z: -58, size: [1.6, 0.9, 1.2], turn: 2.4 },
    { x: -6.8, z: -72, size: [1.8, 1.2, 1.5], climbable: true, turn: 3 },
    { x: 8.2, z: -110, size: [2.6, 1.4, 2], climbable: true, turn: 2.2 },
  ],
  landmarks: [
    { id: 'hearth-clearing', name: 'Hearth clearing', kind: 'hearth', x: -5, z: 3, radius: 1.4, restingRadius: 3.7, restingBlend: 2 },
    { id: 'bellroot-gate', name: 'Bellroot Gate', kind: 'gate', x: 3, z: -86, width: 12, height: 15 },
    { id: 'first-vista', name: 'First vista', kind: 'vista', x: -2, z: -145 },
    { id: 'mirror-fen', name: 'Mirror Fen', kind: 'lake', x: 25, z: -410, distant: true },
    { id: 'split-glacier', name: 'Split glacier', kind: 'peak', x: -310, z: -790, summit: 248, radius: 230, snowLine: 168, warp: 0.2, summits: [[-0.27, -0.05, 1, 0.64], [0.28, 0.04, 0.96, 0.59], [-0.65, 0.2, 0.5, 0.38]], distant: true },
    { id: 'furnace-arch', name: 'Furnace arch', kind: 'arch', x: 175, z: -670, width: 70, height: 84, distant: true },
    { id: 'threadwind-islets', name: 'Threadwind islets', kind: 'islets', x: 330, z: -930, height: 235, distant: true },
    { id: 'broken-astrolabe', name: 'Broken astrolabe', kind: 'observatory', x: 20, z: -900, drum: 22, tower: 50, distant: true },
  ],
  formations: [{ id: 'old-root-outcrop', kind: 'outcrop', x: -9, z: -42, radius: 2.5, height: 5.5, climbable: true }],
  understory: { banks: [
    { from: [-13, 16], to: [-10, -14], spacing: 3.5, spread: .9, scale: .97 },
    { from: [-11, -23], to: [-15, -49], spacing: 4.2, spread: 1, scale: .88 },
    { from: [10, 16], to: [12, -13], spacing: 3.5, spread: .95, scale: .92 },
    { from: [11, -23], to: [12, -53], spacing: 4.2, spread: 1, scale: .86 },
  ] },
  grass: { height: 0.7, width: 0.42, flowers: 0.13 },
  mist: [{ reach: 300, low: -10, high: 14, from: -78, to: 78 }, { reach: 610, low: 10, high: 56, from: -83, to: 82 }, { reach: 1000, low: 35, high: 100, from: -88, to: 88 }],
});

export const WILDS_STREAM = freeze({ snap: 32, distance: 48 });
