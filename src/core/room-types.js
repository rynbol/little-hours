import { getFurniture } from './catalog.js';
import { PRESETS, ROOM_BOUNDS, findFreePosition, validatePlacement } from './layout.js';

export const ROOM_TYPES = [
  { id: 'studio', name: 'Studio', piece: null },
  { id: 'greenhouse', name: 'Greenhouse', piece: 'seed-bed' },
  { id: 'attic', name: 'Star attic', piece: 'telescope' },
];
export const PLANT_PHASES = ['seed', 'sprout', 'youngling', 'budding', 'bloom'];
export const plantCap = minutes => minutes >= 5 ? 4 : 3;
export const plantPhase = (duration, remaining) => Math.min(plantCap(duration / 60_000), Math.floor((1 - remaining / duration) * plantCap(duration / 60_000) + 1e-9));
export const isRoomType = id => ROOM_TYPES.some(type => type.id === id);
export const roomType = id => ROOM_TYPES.find(type => type.id === id) || ROOM_TYPES[0];
export const belongsIn = (itemType, typeId) => { const room = getFurniture(itemType)?.room; return !room || room === typeId; };

const steps = (from, to) => Array.from({ length: Math.floor((to - from) / 0.25) + 1 }, (_, i) => Math.ceil(from / 0.25) * 0.25 + i * 0.25).sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
function wallSpot(items, type, style) {
  const fits = spot => validatePlacement(items, { id: type, type, ...spot }, style).valid;
  const edge = (rotation, key) => steps(key === 'z' ? ROOM_BOUNDS.minZ : ROOM_BOUNDS.minX, 0).sort((a, b) => a - b).find(value => validatePlacement([], { id: type, type, x: key === 'x' ? value : 0, z: key === 'z' ? value : 0, rotation }, style).valid);
  const back = edge(0, 'z'), side = edge(1, 'x');
  for (const x of steps(ROOM_BOUNDS.minX, ROOM_BOUNDS.maxX)) if (fits({ x, z: back, rotation: 0 })) return { id: type, type, x, z: back, rotation: 0 };
  for (const z of steps(ROOM_BOUNDS.minZ, ROOM_BOUNDS.maxZ)) if (fits({ x: side, z, rotation: 1 })) return { id: type, type, x: side, z, rotation: 1 };
  return null;
}
function takeWallSpot(items, type, style) {
  const area = item => getFurniture(item.type).footprint[0] * getFurniture(item.type).footprint[1];
  const movable = items.filter(item => !item.wall && !getFurniture(item.type).unique).sort((a, b) => area(a) - area(b));
  for (const item of movable) {
    const rest = items.filter(other => other !== item), spot = wallSpot(rest, type, style);
    if (!spot) continue;
    const moved = wallSpot([...rest, spot], item.type, style) || (area(item) <= 1 && (free => free && { ...free, rotation: 0 })(findFreePosition([...rest, spot], item.type, 0, style)));
    if (moved) return { items: rest.concat({ ...item, x: moved.x, z: moved.z, rotation: moved.rotation }), spot };
  }
  return null;
}

export function fitRoomType(layout, typeId) {
  const style = PRESETS.find(preset => preset.id === layout.presetId)?.style || 'retreat';
  let items = layout.items.filter(item => belongsIn(item.type, typeId));
  const piece = roomType(typeId).piece;
  if (piece && getFurniture(piece) && !items.some(item => item.type === piece)) {
    let candidate = wallSpot(items, piece, style);
    if (!candidate) {
      const swap = takeWallSpot(items, piece, style);
      if (swap) { items = swap.items; candidate = swap.spot; }
    }
    candidate ||= (spot => spot && { id: piece, type: piece, ...spot, rotation: 0 })(findFreePosition(items, piece, 0, style));
    const wall = items.findIndex(item => item.wall);
    if (candidate && validatePlacement(items, candidate, style).valid) items.splice(wall < 0 ? items.length : wall, 0, candidate);
  }
  return items.length === layout.items.length && items.every((item, index) => item === layout.items[index]) ? layout : { ...layout, items };
}
