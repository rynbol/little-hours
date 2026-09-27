import { getFurniture } from './catalog.js';
import { PRESETS, findFreePosition, validatePlacement } from './layout.js';

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

export function fitRoomType(layout, typeId) {
  const style = PRESETS.find(preset => preset.id === layout.presetId)?.style || 'retreat';
  const items = layout.items.filter(item => belongsIn(item.type, typeId));
  const piece = roomType(typeId).piece;
  if (piece && getFurniture(piece) && !items.some(item => item.type === piece)) {
    const spot = findFreePosition(items, piece, 0, style), candidate = spot && { id: piece, type: piece, ...spot, rotation: 0 };
    const wall = items.findIndex(item => item.wall);
    if (candidate && validatePlacement(items, candidate, style).valid) items.splice(wall < 0 ? items.length : wall, 0, candidate);
  }
  return items.length === layout.items.length && items.every((item, index) => item === layout.items[index]) ? layout : { ...layout, items };
}
