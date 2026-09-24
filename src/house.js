import { createLayout, normalizeLayout, PRESETS } from './layout.js';

// Three authored positions make a small, coherent cottage. A design is a
// decorating style; a house room is a permanent space with its own layout.
export const HOUSE_SLOTS = [
  { id: 'studio', label: 'Your studio', short: 'Studio', price: 0 },
  { id: 'garden', label: 'Garden wing', short: 'Garden wing', price: 25 },
  { id: 'loft', label: 'Upstairs hideaway', short: 'Upstairs', price: 75 },
];
export const HOUSE_NAME = 'Littlewood cottage';
const validDesign = id => PRESETS.some(preset => preset.id === id);
export const cleanName = (value, fallback) => typeof value === 'string' && value.trim() ? value.trim().slice(0, 40) : fallback;
export const focusCoins = minutes => [25, 50, 90].includes(minutes) ? minutes : 0;

export function createHouse(layout = createLayout(), history = []) {
  return {
    version: 1, name: HOUSE_NAME, coins: history.reduce((sum, entry) => sum + focusCoins(entry.minutes), 0),
    activeId: 'studio', rooms: [{ id: 'studio', name: 'Your studio', layout: structuredClone(layout) }],
  };
}

export function normalizeHouse(raw, layout, history = []) {
  if (!raw || typeof raw !== 'object') return createHouse(layout, history);
  const house = createHouse(layout);
  house.name = cleanName(raw.name, HOUSE_NAME);
  house.coins = Number.isSafeInteger(raw.coins) && raw.coins >= 0 ? Math.min(raw.coins, 1_000_000_000) : 0;
  for (const slot of HOUSE_SLOTS) {
    const saved = Array.isArray(raw.rooms) && raw.rooms.find(room => room?.id === slot.id);
    if (!saved || !saved.layout || !validDesign(saved.layout.presetId)) break;
    const entry = { id: slot.id, name: cleanName(saved.name, slot.label), layout: normalizeLayout(saved.layout) };
    if (slot.id === 'studio') house.rooms[0] = entry;
    else house.rooms.push(entry);
  }
  if (house.rooms.some(room => room.id === raw.activeId)) house.activeId = raw.activeId;
  return house;
}

export const activeHouseRoom = house => house.rooms.find(room => room.id === house.activeId) || house.rooms[0];
export const nextExpansion = house => HOUSE_SLOTS[house.rooms.length] || null;
export function expansionVerdict(house, slotId, presetId) {
  const slot = nextExpansion(house);
  if (!slot || slot.id !== slotId) return { ok: false, reason: 'That space is already built or is not the next extension.' };
  if (!validDesign(presetId)) return { ok: false, reason: 'Choose a room design first.' };
  if (house.coins < slot.price) return { ok: false, reason: `${slot.price - house.coins} more coins to build this room.` };
  return { ok: true, slot };
}
