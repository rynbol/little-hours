import { getFurniture } from './catalog.js';

export const ROOM_BOUNDS = Object.freeze({ minX: -5.5, maxX: 5.5, minZ: -4.2, maxZ: 4.2 });
export const MAX_ITEMS = 32;
const GRID = 0.25;
const EPSILON = 1e-7;
// The resident cat has a little permanent spot. A rug can sit underneath it.
export const CAT_BOUNDS = Object.freeze({ minX: 0.15, maxX: 1.5, minZ: 1.1, maxZ: 2.15 });
const item = (id, type, x, z, rotation = 0) => ({ id, type, x, z, rotation });

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
    ],
  },
];


// Different architecture and palettes, with intentionally edited furniture lists.
// The originals remain available as the three timber-retreat arrangements.
const themedPreset = (id, name, style, description, sourceId, omit, additions = []) => {
  const source = PRESETS.find(preset => preset.id === sourceId);
  return { id, name, style, description, items: [...source.items.filter(entry => !omit.includes(entry.id)).map(entry => ({ ...entry, id: `${id}-${entry.id}` })), ...additions] };
};
PRESETS.push(
  themedPreset('sakura-studio', 'Sakura studio', 'sakura', 'Shoji screens, woven tatami, paper lanterns and cherry blossoms beyond the window.', 'moonlit-greenhouse', ['green-tree-back', 'green-tree-window', 'green-tree-front', 'green-tree-right', 'green-hearth', 'green-records-side', 'green-lamp', 'green-moon-rug', 'green-window-rug', 'green-reading-rug', 'green-candles'], [
    item('sakura-books', 'bookcase', 3.25, -3.75), item('sakura-plant', 'plant', -4.75, -3.5), item('sakura-lamp', 'floor-lamp', -5, 3.5),
  ]),
  themedPreset('cloud-loft', 'Cloud loft', 'cloud', 'A round sky window, blush checkerboard, lilac upholstery and shelves shaped like clouds.', 'ember-library', ['ember-hearth', 'ember-books-front', 'ember-books-right', 'ember-tree', 'ember-tree-right', 'ember-lanterns', 'ember-moon-rug'], [
    item('cloud-books', 'bookcase', 3.25, -3.75), item('cloud-fern', 'plant', -4.75, -3.5), item('cloud-linen-rug', 'rug', 3, .5, 1),
  ]),
  themedPreset('midnight-metro', 'Midnight metro', 'metro', 'An exposed-brick listening loft, steel windows, soft neon and a city that stays up with you.', 'writers-loft', ['loft-hearth', 'loft-tree', 'loft-lanterns', 'loft-plant-front', 'loft-bookcase-right', 'loft-moon-rug'], [
    item('metro-record-wall', 'low-cabinet', 4.75, -2.75, 3), item('metro-studio-rug', 'rug', 3.25, 2),
  ]),
);
export function roomDesign(layout) { return PRESETS.find(preset => preset.id === layout?.presetId) || PRESETS[0]; }

const isDesk = candidate => getFurniture(candidate?.type)?.category === 'Study';
const snap = value => Math.round(value / GRID) * GRID;
function bounds(candidate) {
  const definition = getFurniture(candidate.type);
  const [width, depth] = candidate.rotation % 2 ? [...definition.footprint].reverse() : definition.footprint;
  return { minX: candidate.x - width / 2, maxX: candidate.x + width / 2, minZ: candidate.z - depth / 2, maxZ: candidate.z + depth / 2 };
}
function overlaps(a, b) {
  return a.minX < b.maxX - EPSILON && a.maxX > b.minX + EPSILON && a.minZ < b.maxZ - EPSILON && a.maxZ > b.minZ + EPSILON;
}

export function validatePlacement(items, candidate) {
  const definition = getFurniture(candidate?.type);
  if (!definition) return { valid: false, reason: 'Choose a furniture item from the shop.' };
  if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.z)) return { valid: false, reason: 'Choose a spot on the room floor.' };
  if (!Number.isInteger(candidate.rotation) || candidate.rotation < 0 || candidate.rotation > 3) return { valid: false, reason: 'Turn furniture in quarter turns.' };
  if (Math.abs(snap(candidate.x) - candidate.x) > EPSILON || Math.abs(snap(candidate.z) - candidate.z) > EPSILON) return { valid: false, reason: 'Place furniture on the room grid.' };
  const otherItems = (Array.isArray(items) ? items : []).filter(existing => !candidate.id || existing.id !== candidate.id);
  if (otherItems.length >= MAX_ITEMS) return { valid: false, reason: `This room has space for ${MAX_ITEMS} items. Remove one to make room.` };
  const area = bounds(candidate);
  if (area.minX < ROOM_BOUNDS.minX - EPSILON || area.maxX > ROOM_BOUNDS.maxX + EPSILON || area.minZ < ROOM_BOUNDS.minZ - EPSILON || area.maxZ > ROOM_BOUNDS.maxZ + EPSILON) {
    return { valid: false, reason: 'Keep the whole piece inside the room.' };
  }
  if (definition.blocking && overlaps(area, CAT_BOUNDS)) return { valid: false, reason: 'Leave a little room for the sleeping cat.' };
  if (definition.blocking) {
    const collision = otherItems.find(existing => getFurniture(existing.type)?.blocking && overlaps(area, bounds(existing)));
    if (collision) return { valid: false, reason: `That spot overlaps the ${getFurniture(collision.type).name.toLowerCase()}.` };
  }
  return { valid: true, reason: '' };
}

export function createLayout(presetId = PRESETS[0].id) {
  const preset = PRESETS.find(entry => entry.id === presetId) || PRESETS[0];
  const items = preset.items.map(entry => ({ ...entry }));
  return { presetId: preset.id, items, activeDeskId: items.find(isDesk)?.id ?? null };
}

export function findFreePosition(items, type, rotation = 0) {
  if (!getFurniture(type) || !Number.isInteger(rotation) || rotation < 0 || rotation > 3) return null;
  // Search center-out in horizontal rows, beginning at the back of the room.
  const minX = Math.ceil(ROOM_BOUNDS.minX / GRID), maxX = Math.floor(ROOM_BOUNDS.maxX / GRID);
  const xs = Array.from({ length: maxX - minX + 1 }, (_, index) => (index + minX) * GRID).sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
  for (let z = Math.ceil(ROOM_BOUNDS.minZ / GRID) * GRID; z <= ROOM_BOUNDS.maxZ; z += GRID) {
    for (const x of xs) if (validatePlacement(items, { type, x, z, rotation }).valid) return { x, z };
  }
  return null;
}

export function normalizeLayout(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.items)) return createLayout();
  const items = [];
  const ids = new Set();
  // Bound even malformed persisted input before doing collision checks.
  for (const [index, saved] of raw.items.slice(0, 100).entries()) {
    if (items.length >= MAX_ITEMS) break;
    if (!saved || typeof saved !== 'object' || !getFurniture(saved.type) || !Number.isFinite(saved.x) || !Number.isFinite(saved.z)) continue;
    let id = typeof saved.id === 'string' && saved.id.length > 0 && saved.id.length <= 80 ? saved.id : `restored-${index}`;
    if (ids.has(id)) id = `restored-${index}`;
    while (ids.has(id)) id += '-copy';
    const candidate = {
      id, type: saved.type, x: snap(saved.x), z: snap(saved.z),
      rotation: Number.isInteger(saved.rotation) && saved.rotation >= 0 && saved.rotation <= 3 ? saved.rotation : 0,
    };
    if (validatePlacement(items, candidate).valid) { items.push(candidate); ids.add(id); }
  }
  const presetId = PRESETS.some(preset => preset.id === raw.presetId) ? raw.presetId : null;
  const activeDeskId = items.find(entry => entry.id === raw.activeDeskId && isDesk(entry))?.id ?? items.find(isDesk)?.id ?? null;
  // A usable study station is the room's anchor. Recover a complete arrangement
  // when a malformed or older save has lost its last desk.
  if (!activeDeskId) return createLayout(presetId);
  return { presetId, items, activeDeskId };
}
