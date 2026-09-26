import { getFurniture } from './catalog.js';
import { isWallPiece, wallPlacementReason, wallClearanceReason, nearestWallSpot, findFreeWallSpot } from './walls.js';
import { tintPaint } from './tints.js';
import { surfacePaint } from './surfaces.js';

export const ROOM_BOUNDS = Object.freeze({ minX: -5.5, maxX: 5.5, minZ: -4.2, maxZ: 4.2 });
export const MAX_ITEMS = 32;
const GRID = 0.25;
const EPSILON = 1e-7;
// The pet sleeps in its own movable bed. Rooms saved before the bed existed
// kept this spot clear for the cat, so the bed moves in there.
export const PET_HOME = Object.freeze({ x: 0.75, z: 1.5 });
const item = (id, type, x, z, rotation = 0, extra = {}) => ({ id, type, x, z, rotation, ...extra });
const wallItem = (id, type, wall, u, v, art) => ({ id, type, wall, u, v, ...(art ? { art } : {}) });
// Layouts saved before wall pieces existed (below `v` 2) gain their design's
// wall pieces once, and layouts saved before the wall clock (`v` 2) gain the
// design's clock once.
export const LAYOUT_VERSION = 3;
// The timber retreat's wall pieces: a picture over the hearth, a small one by
// the lanterns, the moon clock and the potion shelf above the side bookcases.
// Design wall pieces sit on the 5 cm wall grid, so a drag never nudges them.
const retreatWalls = prefix => [
  wallItem(`${prefix}-frame-mantel`, 'tall-frame', 'back', 3.25, 3.95, 'herbarium'), wallItem(`${prefix}-frame-small`, 'small-frame', 'back', 5.05, 3.65, 'herbarium'),
  wallItem(`${prefix}-clock`, 'moon-clock', 'side', 1.75, 4.15), wallItem(`${prefix}-potions`, 'apothecary-shelf', 'side', -0.95, 4.05),
];

export const PRESETS = [
  {
    id: 'ember-library', name: 'Ember library', description: 'A candlelit library, a crackling hearth and a velvet sofa for one more chapter.',
    items: [
      item('ember-desk', 'study-desk', -2, -3),
      item('ember-hearth', 'fireplace', 3.25, -3.5),
      item('ember-books-left', 'bookcase', -5, -1.25, 1),
      item('ember-books-front', 'bookcase', -5, 1, 1),
      item('ember-books-right', 'bookcase', 0.75, -3.75),
      item('ember-sofa', 'daybed', 3, -0.75),
      item('ember-chair', 'lounge-chair', -3.75, 2.25, 1),
      item('ember-tree', 'moon-tree', -4.5, -3.25),
      item('ember-tree-right', 'moon-tree', 4.5, 3.25),
      item('ember-table', 'side-table', 2.75, 0.75),
      item('ember-tea', 'side-table', -2.25, 2.5),
      item('ember-pouf', 'ottoman', 2.75, 2.5),
      item('ember-lamp', 'floor-lamp', -5, 3.5),
      item('ember-lanterns', 'lantern-cluster', 4.75, -2.25),
      item('ember-plant', 'plant', 1, -1.25),
      item('ember-records', 'low-cabinet', -0.5, 3.75),
      item('ember-moon-rug', 'moon-rug', 2.75, 1.5),
      item('ember-desk-rug', 'rug', -2.5, -2.75),
      item('ember-reading-rug', 'rug', -3, 2.25, 1),
      item('ember-cat-rug', 'rug', 0, 1.5),
      item('ember-globe', 'globe', -3.5, 0),
      item('ember-tea-cart', 'tea-cart', 4.75, 0.75, 1),
      // One moon picture, over the hearth, is enough for the library.
      ...retreatWalls('ember').filter(entry => entry.id !== 'ember-frame-small'),
    ],
  },
  {
    id: 'moonlit-greenhouse', name: 'Moonlit greenhouse', description: 'A writing nook among moonleaf trees, lanterns and soft moss-colored cushions.',
    items: [
      item('green-desk', 'writing-desk', -2, -3),
      item('green-tree-back', 'moon-tree', -4.5, -3.25),
      item('green-tree-window', 'moon-tree', 0.25, -3.25),
      item('green-tree-front', 'moon-tree', -4.5, 3.25),
      item('green-tree-right', 'moon-tree', 4.5, 3.25),
      item('green-hearth', 'fireplace', 3.25, -3.5),
      item('green-sofa', 'daybed', -4.25, 0.5, 1),
      item('green-records-side', 'low-cabinet', 5, -1.5, 3),
      item('green-chair', 'lounge-chair', 3.75, 0.5, 3),
      item('green-table', 'side-table', 2.25, 0.5),
      item('green-candles', 'lantern-cluster', -2.5, 0.75),
      item('green-fern', 'plant', -1, -1),
      item('green-fern-two', 'plant', 1, -1),
      item('green-fern-three', 'plant', -2.25, 2.75),
      item('green-pouf', 'ottoman', 2.75, 2.5),
      item('green-records', 'low-cabinet', -0.5, 3.75),
      item('green-lamp', 'floor-lamp', 1.75, -2),
      item('green-moon-rug', 'moon-rug', -2.5, 0.75),
      item('green-window-rug', 'rug', -2.5, -2.75),
      item('green-cat-rug', 'rug', 0.25, 1.5),
      item('green-reading-rug', 'rug', 3.25, 1.5, 1),
      item('green-globe', 'globe', 5, -3.5),
      ...retreatWalls('green'),
    ],
  },
  {
    id: 'writers-loft', name: "Writer's loft", description: 'Two study stations, collected records and a fire-lit corner for finding the next idea.',
    items: [
      item('loft-desk', 'study-desk', -2, -3),
      item('loft-writing-desk', 'writing-desk', -3.75, 0.25, 1),
      item('loft-hearth', 'fireplace', 3.25, -3.5),
      item('loft-bookcase', 'bookcase', -5, 2.75, 1),
      item('loft-bookcase-right', 'bookcase', 0.75, -3.75),
      item('loft-sofa', 'daybed', 3.25, 2.75, 2),
      item('loft-chair', 'lounge-chair', 2.75, -0.75),
      item('loft-tea', 'side-table', 1.25, -1),
      item('loft-sofa-table', 'side-table', 3.25, 1.25),
      item('loft-tree', 'moon-tree', -4.5, -3.25),
      item('loft-plant', 'plant', 4.75, 0),
      item('loft-plant-front', 'plant', -3.25, 3.5),
      item('loft-lanterns', 'lantern-cluster', -1.5, 2.5),
      item('loft-lamp', 'floor-lamp', 5, 1.25),
      item('loft-records', 'low-cabinet', -0.5, 3.75),
      item('loft-pouf', 'ottoman', 0, -0.5),
      item('loft-moon-rug', 'moon-rug', 3, 1.5),
      item('loft-study-rug', 'rug', -2.5, -2.75),
      item('loft-writing-rug', 'rug', -3.25, 0.5, 1),
      item('loft-cat-rug', 'rug', 0.25, 1.5),
      item('loft-easel', 'easel', -2.75, 2.5, 0, { art: 'hills' }),
      item('loft-bean-bag', 'bean-bag', -1, 1),
      ...retreatWalls('loft'),
    ],
  },
];


// Different architecture and palettes, with intentionally edited furniture lists.
// The originals remain available as the three timber-retreat arrangements.
const themedPreset = (id, name, style, description, sourceId, omit, additions = []) => {
  const source = PRESETS.find(preset => preset.id === sourceId);
  return { id, name, style, description, items: [...source.items.filter(entry => !omit.includes(entry.id) && !entry.wall).map(entry => ({ ...entry, id: `${id}-${entry.id}` })), ...additions] };
};
PRESETS.push(
  themedPreset('sakura-studio', 'Sakura studio', 'sakura', 'Shoji screens, woven tatami, paper lanterns and cherry blossoms beyond the window.', 'moonlit-greenhouse', ['green-tree-back', 'green-tree-window', 'green-tree-front', 'green-tree-right', 'green-hearth', 'green-records-side', 'green-lamp', 'green-moon-rug', 'green-window-rug', 'green-reading-rug', 'green-candles', 'green-globe'], [
    item('sakura-books', 'bookcase', 4.5, -3.75), item('sakura-plant', 'plant', -4.75, -3.5), item('sakura-lamp', 'floor-lamp', -5, 3.5),
    item('sakura-tea-cart', 'tea-cart', 1.75, -2.25), item('sakura-easel', 'easel', -4.5, -2.25, 0, { art: 'blossom' }),
    wallItem('sakura-scroll', 'wall-scroll', 'back', 2.5, 3.45), wallItem('sakura-clock', 'wall-clock', 'back', 1.25, 4.3),
  ]),
  themedPreset('cloud-loft', 'Cloud loft', 'cloud', 'A round sky window, blush checkerboard, lilac upholstery and shelves shaped like clouds.', 'ember-library', ['ember-hearth', 'ember-books-front', 'ember-books-right', 'ember-tree', 'ember-tree-right', 'ember-lanterns', 'ember-moon-rug', 'ember-tea-cart'], [
    item('cloud-books', 'bookcase', 4.5, -3.75), item('cloud-fern', 'plant', -4.75, -3.5), item('cloud-linen-rug', 'rug', 3, .5, 1),
    item('cloud-aquarium', 'fish-tank', 1.75, -3.75), item('cloud-bean-bag', 'bean-bag', 4, 2.5, 0, { tint: 'rose' }),
    wallItem('cloud-shelf-low', 'cloud-shelf', 'back', 1.75, 3.25), wallItem('cloud-shelf-high', 'small-cloud-shelf', 'back', 4.2, 4.55), wallItem('cloud-rainbow', 'felt-rainbow', 'side', 1.9, 3.75),
    wallItem('cloud-clock', 'wall-clock', 'back', 1.75, 4.4),
  ]),
  themedPreset('midnight-metro', 'Midnight metro', 'metro', 'An exposed-brick listening loft, steel windows, soft neon and a city that stays up with you.', 'writers-loft', ['loft-hearth', 'loft-tree', 'loft-lanterns', 'loft-plant-front', 'loft-bookcase-right', 'loft-moon-rug', 'loft-easel', 'loft-bean-bag'], [
    item('metro-record-wall', 'low-cabinet', 4.75, -2.75, 3), item('metro-studio-rug', 'rug', 3.25, 2),
    item('metro-monstera', 'monstera', 2.75, -2.75, 0, { tint: 'indigo' }), item('metro-easel', 'easel', -1.75, 2.5, 0, { art: 'stars' }),
    item('metro-aquarium', 'fish-tank', -5, -2.5, 1),
    wallItem('metro-neon', 'neon-orbit', 'back', 4.4, 3.65), wallItem('metro-record-lilac', 'record-sleeve', 'side', 1.5, 4.3, 'lilac'), wallItem('metro-record-coral', 'record-sleeve', 'side', 3.1, 4.3, 'coral'),
    wallItem('metro-clock', 'wall-clock', 'side', -1.6, 4.3),
  ]),
);
export function roomDesign(layout) { return PRESETS.find(preset => preset.id === layout?.presetId) || PRESETS[0]; }
const styleOf = presetId => PRESETS.find(preset => preset.id === presetId)?.style || 'retreat';

const isDesk = candidate => getFurniture(candidate?.type)?.category === 'Study';
const isPetBed = candidate => candidate?.type === 'pet-bed';
// The pet bed does not use up the room's piece budget.
export function pieceCount(items) { return items.filter(entry => !getFurniture(entry?.type)?.unique).length; }
export function petBed(layout) { return layout?.items?.find(isPetBed) || null; }
const snap = value => Math.round(value / GRID) * GRID;
export function footprintBounds(candidate) { return bounds(candidate); }
function bounds(candidate) {
  const definition = getFurniture(candidate.type);
  const [width, depth] = candidate.rotation % 2 ? [...definition.footprint].reverse() : definition.footprint;
  return { minX: candidate.x - width / 2, maxX: candidate.x + width / 2, minZ: candidate.z - depth / 2, maxZ: candidate.z + depth / 2 };
}
function overlaps(a, b) {
  return a.minX < b.maxX - EPSILON && a.maxX > b.minX + EPSILON && a.minZ < b.maxZ - EPSILON && a.maxZ > b.minZ + EPSILON;
}

// Rugs meet when their woven outlines overlap: a rounded rug is a circle,
// the others are rectangles. Touching edges do not count.
export function rugsOverlap(a, b) {
  const outline = item => { const area = bounds(item); return { x: item.x, z: item.z, hx: (area.maxX - area.minX) / 2 - 0.01, hz: (area.maxZ - area.minZ) / 2 - 0.01, round: item.type === 'moon-rug' }; };
  const p = outline(a), q = outline(b);
  if (p.round && q.round) return Math.hypot(p.x - q.x, p.z - q.z) < p.hx + q.hx;
  if (p.round || q.round) {
    const [circle, rect] = p.round ? [p, q] : [q, p];
    return Math.hypot(Math.max(Math.abs(circle.x - rect.x) - rect.hx, 0), Math.max(Math.abs(circle.z - rect.z) - rect.hz, 0)) < circle.hx;
  }
  return Math.abs(p.x - q.x) < p.hx + q.hx && Math.abs(p.z - q.z) < p.hz + q.hz;
}

// Rugs lie in the order they were put down, each 6 mm above the one before,
// and a rug that another rug covers lies flat, so the one on top keeps its
// weave. `top` is the height of a rug's highest thread. The lowest rug lies
// on `floor`: the sakura tatami stands higher than a flat rug's weave.
export const FLOOR_Y = 0.22, RUG_STEP = 0.006, FLAT_RUG = 0.0055;
const isRug = candidate => getFurniture(candidate?.type)?.category === 'Rugs';
// The woven layers of each rug as its model in furniture.js builds them:
// [x, z, half width, half depth, top] in the rug's own space, round on the
// moon rug. A piece stands on the layers and sinks into the thin motifs.
const WEAVE = {
  rug: [[0, 0, 1.62, 1.10, 0.031], [0, 0, 1.54, 1.015, 0.040], [0, 0, 1.415, 0.885, 0.046], [0, 0, 1.35, 0.82, 0.0515]],
  'moon-rug': [[0, 0, 1.67, 1.67, 0.045], [0, 0, 1.59, 1.59, 0.0535], [0, 0, 1.48, 1.48, 0.0605], [0, 0, 1.36, 1.36, 0.0675], [-0.09, -0.10, 0.47, 0.47, 0.075], [0.09, -0.16, 0.42, 0.42, 0.08]],
};
export function rugStack(items, floor = FLOOR_Y) {
  const rugs = (Array.isArray(items) ? items : []).filter(isRug);
  return rugs.map((item, index) => {
    const { height, footprint } = getFurniture(item.type), y = floor + index * RUG_STEP, angle = item.rotation * Math.PI / 2;
    const flat = rugs.slice(index + 1).some(upper => rugsOverlap(item, upper)), scale = flat ? FLAT_RUG / height : 1;
    return { item, y, flat, scale, top: y + height * scale, round: item.type === 'moon-rug', cos: Math.cos(angle), sin: Math.sin(angle),
      weave: WEAVE[item.type] || [[0, 0, footprint[0] / 2, footprint[1] / 2, height]], ...bounds(item) };
  });
}
// Whether a rug of `rugStack` reaches into an area; a point is an area whose
// edges meet.
export function rugTouches(rug, area) {
  const hx = (rug.maxX - rug.minX) / 2 - 0.01, hz = (rug.maxZ - rug.minZ) / 2 - 0.01, { x, z } = rug.item;
  const dx = Math.max(area.minX - x, x - area.maxX, 0), dz = Math.max(area.minZ - z, z - area.maxZ, 0);
  return rug.round ? Math.hypot(dx, dz) < hx : dx < hx && dz < hz;
}
// The height of the highest woven layer of `stack` over a floor point, or of the floor.
export function groundAt(stack, x, z, floor = FLOOR_Y) {
  let ground = floor;
  for (const rug of stack) {
    const dx = x - rug.item.x, dz = z - rug.item.z, u = dx * rug.cos - dz * rug.sin, v = dx * rug.sin + dz * rug.cos;
    for (const layer of rug.weave) {
      const y = rug.y + layer[4] * rug.scale, du = u - layer[0], dv = v - layer[1];
      if (y > ground && (rug.round ? Math.hypot(du, dv) < layer[2] : Math.abs(du) < layer[2] && Math.abs(dv) < layer[3])) ground = y;
    }
  }
  return ground;
}
// A floor piece stands on the rug that lies under most of it: the highest
// layer under at least 3 of 5 points, the middle of its footprint and its
// corners set in by 15 %. Otherwise it stands on the floor, and a rug's edge
// slips under its base.
export function standHeight(item, stack) {
  if (isRug(item) || getFurniture(item?.type)?.mount === 'wall') return FLOOR_Y;
  const { minX, maxX, minZ, maxZ } = bounds(item), ix = (maxX - minX) * 0.15, iz = (maxZ - minZ) * 0.15;
  const points = [[(minX + maxX) / 2, (minZ + maxZ) / 2], [minX + ix, minZ + iz], [maxX - ix, minZ + iz], [minX + ix, maxZ - iz], [maxX - ix, maxZ - iz]];
  return points.map(([x, z]) => groundAt(stack, x, z)).sort((a, b) => b - a)[2];
}

// `style` is the room shell (see walls.js): it places the walls and their fixtures.
export function validatePlacement(items, candidate, style = 'retreat') {
  const definition = getFurniture(candidate?.type);
  if (!definition) return { valid: false, reason: 'Choose a furniture item from the shop.' };
  if (definition.mount === 'wall') {
    const others = (Array.isArray(items) ? items : []).filter(existing => !candidate.id || existing.id !== candidate.id);
    if (pieceCount(others) >= MAX_ITEMS) return { valid: false, reason: `This room has space for ${MAX_ITEMS} items. Remove one to make room.` };
    const reason = wallPlacementReason(others, candidate, style);
    return { valid: !reason, reason };
  }
  if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.z)) return { valid: false, reason: 'Choose a spot on the room floor.' };
  if (!Number.isInteger(candidate.rotation) || candidate.rotation < 0 || candidate.rotation > 3) return { valid: false, reason: 'Turn furniture in quarter turns.' };
  if (Math.abs(snap(candidate.x) - candidate.x) > EPSILON || Math.abs(snap(candidate.z) - candidate.z) > EPSILON) return { valid: false, reason: 'Place furniture on the room grid.' };
  const otherItems = (Array.isArray(items) ? items : []).filter(existing => !candidate.id || existing.id !== candidate.id);
  if (!definition.unique && pieceCount(otherItems) >= MAX_ITEMS) return { valid: false, reason: `This room has space for ${MAX_ITEMS} items. Remove one to make room.` };
  const area = bounds(candidate);
  if (area.minX < ROOM_BOUNDS.minX - EPSILON || area.maxX > ROOM_BOUNDS.maxX + EPSILON || area.minZ < ROOM_BOUNDS.minZ - EPSILON || area.maxZ > ROOM_BOUNDS.maxZ + EPSILON) {
    return { valid: false, reason: 'Keep the whole piece inside the room.' };
  }
  if (definition.blocking) {
    const collision = otherItems.find(existing => getFurniture(existing.type)?.blocking && overlaps(area, bounds(existing)));
    if (collision) return { valid: false, reason: `That spot overlaps the ${getFurniture(collision.type).name.toLowerCase()}.` };
  }
  const blocked = wallClearanceReason(otherItems, candidate, style);
  return { valid: !blocked, reason: blocked };
}

// The closest free grid spot to a blocked candidate, searched in rings of
// grid steps out to `reach`, so a drop beside an obstacle lands next to it.
export function nearestValidPlacement(items, candidate, reach = 1, style = 'retreat') {
  if (isWallPiece(candidate)) {
    const others = items.filter(existing => !candidate.id || existing.id !== candidate.id);
    return pieceCount(others) >= MAX_ITEMS ? null : nearestWallSpot(others, candidate, style);
  }
  if (!getFurniture(candidate?.type) || !Number.isFinite(candidate.x) || !Number.isFinite(candidate.z)) return null;
  const x = snap(candidate.x), z = snap(candidate.z), steps = Math.floor(reach / GRID + EPSILON), spots = [];
  for (let i = -steps; i <= steps; i++) for (let j = -steps; j <= steps; j++) {
    const distance = Math.hypot(i, j) * GRID;
    if (distance <= reach + EPSILON) spots.push({ x: x + i * GRID, z: z + j * GRID, distance });
  }
  spots.sort((a, b) => a.distance - b.distance || a.z - b.z || a.x - b.x);
  for (const spot of spots) if (validatePlacement(items, { ...candidate, x: spot.x, z: spot.z }, style).valid) return { x: spot.x, z: spot.z };
  return null;
}

export function createLayout(presetId = PRESETS[0].id) {
  const preset = PRESETS.find(entry => entry.id === presetId) || PRESETS[0];
  const items = preset.items.map(entry => ({ ...entry }));
  addPetBed(items, styleOf(preset.id));
  return { presetId: preset.id, items, activeDeskId: items.find(isDesk)?.id ?? null, v: LAYOUT_VERSION };
}

// Every room has exactly one pet bed. A room without one gets it at the
// pet's old spot, or at the first free spot when that is taken. It goes
// after the floor pieces and before the wall pieces, the order a restore keeps.
function addPetBed(items, style) {
  if (items.some(isPetBed)) return;
  const bed = { id: 'pet-bed', type: 'pet-bed', x: PET_HOME.x, z: PET_HOME.z, rotation: 0 };
  if (!validatePlacement(items, bed, style).valid) Object.assign(bed, findFreePosition(items, 'pet-bed', 0, style) || {});
  const wall = items.findIndex(isWallPiece);
  if (validatePlacement(items, bed, style).valid) items.splice(wall < 0 ? items.length : wall, 0, bed);
}

export function findFreePosition(items, type, rotation = 0, style = 'retreat') {
  if (getFurniture(type)?.mount === 'wall') return pieceCount(items) >= MAX_ITEMS ? null : findFreeWallSpot(items, type, style);
  if (!getFurniture(type) || !Number.isInteger(rotation) || rotation < 0 || rotation > 3) return null;
  // Search center-out in horizontal rows, beginning at the back of the room.
  const minX = Math.ceil(ROOM_BOUNDS.minX / GRID), maxX = Math.floor(ROOM_BOUNDS.maxX / GRID);
  const xs = Array.from({ length: maxX - minX + 1 }, (_, index) => (index + minX) * GRID).sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
  for (let z = Math.ceil(ROOM_BOUNDS.minZ / GRID) * GRID; z <= ROOM_BOUNDS.maxZ; z += GRID) {
    for (const x of xs) if (validatePlacement(items, { type, x, z, rotation }, style).valid) return { x, z };
  }
  return null;
}

export function normalizeLayout(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.items)) return createLayout();
  const items = [];
  const ids = new Set();
  const presetId = PRESETS.some(preset => preset.id === raw.presetId) ? raw.presetId : null, style = styleOf(presetId);
  // Bound even malformed persisted input before doing collision checks.
  const saves = raw.items.slice(0, 100);
  for (const [index, saved] of saves.entries()) {
    if (pieceCount(items) >= MAX_ITEMS && !getFurniture(saved?.type)?.unique) continue;
    if (!saved || typeof saved !== 'object' || !getFurniture(saved.type) || isWallPiece(saved) || !Number.isFinite(saved.x) || !Number.isFinite(saved.z)) continue;
    let id = typeof saved.id === 'string' && saved.id.length > 0 && saved.id.length <= 80 ? saved.id : `restored-${index}`;
    if (ids.has(id)) id = `restored-${index}`;
    while (ids.has(id)) id += '-copy';
    const candidate = {
      id, type: saved.type, x: snap(saved.x), z: snap(saved.z),
      rotation: Number.isInteger(saved.rotation) && saved.rotation >= 0 && saved.rotation <= 3 ? saved.rotation : 0,
    };
    // A lamp, fire or record player that was switched off stays off, a piece
    // keeps the color chosen for it, and the easel its picture.
    if (saved.off === true && getFurniture(saved.type).use?.toggle) candidate.off = true;
    if (isPetBed(candidate) && items.some(isPetBed)) continue;
    const arts = getFurniture(saved.type).arts; if (arts) candidate.art = arts.includes(saved.art) ? saved.art : arts[0];
    if (tintPaint(saved.type, saved.tint)) candidate.tint = saved.tint;
    if (validatePlacement(items, candidate, style).valid) { items.push(candidate); ids.add(id); }
  }
  // Wall pieces come after the floor, so a saved piece of furniture is never
  // lost to a picture: a wall piece that no longer fits moves to the closest
  // free spot, or is left out.
  const design = presetId && raw.v !== LAYOUT_VERSION ? PRESETS.find(preset => preset.id === presetId).items.filter(isWallPiece) : [];
  const legacy = raw.v === 2 ? design.filter(entry => entry.type === 'wall-clock') : design;
  for (const [index, saved] of [...saves.map((entry, index) => [index, entry]), ...legacy.map(entry => [`design-${entry.id}`, entry])]) {
    if (pieceCount(items) >= MAX_ITEMS) break;
    if (!saved || typeof saved !== 'object' || !isWallPiece(saved) || !['back', 'side'].includes(saved.wall) || !Number.isFinite(saved.u) || !Number.isFinite(saved.v)) continue;
    let id = typeof saved.id === 'string' && saved.id.length > 0 && saved.id.length <= 80 ? saved.id : `restored-${index}`;
    if (ids.has(id)) { if (typeof index === 'string') continue; id = `restored-${index}`; }
    while (ids.has(id)) id += '-copy';
    const definition = getFurniture(saved.type), round = value => Math.round(value * 1000) / 1000;
    const candidate = { id, type: saved.type, wall: saved.wall, u: round(saved.u), v: round(saved.v) };
    if (definition.arts) candidate.art = definition.arts.includes(saved.art) ? saved.art : definition.arts[0];
    if (saved.off === true && definition.use?.toggle) candidate.off = true;
    if (!validatePlacement(items, candidate, style).valid) { const spot = nearestWallSpot(items, candidate, style); if (!spot) continue; Object.assign(candidate, spot); }
    items.push(candidate); ids.add(id);
  }
  const activeDeskId = items.find(entry => entry.id === raw.activeDeskId && isDesk(entry))?.id ?? items.find(isDesk)?.id ?? null;
  // A usable study station is the room's anchor. Recover a complete arrangement
  // when a malformed or older save has lost its last desk.
  if (!activeDeskId) return createLayout(presetId);
  addPetBed(items, style);
  const layout = { presetId, items, activeDeskId, v: LAYOUT_VERSION };
  // A room keeps its wall and floor choices when its design offers them.
  for (const kind of ['walls', 'floor']) if (surfacePaint(style, kind, raw[kind])) layout[kind] = raw[kind];
  return layout;
}
