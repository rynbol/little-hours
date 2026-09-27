import { createLayout, normalizeLayout, PRESETS } from './layout.js';
import { fitRoomType, isRoomType } from './room-types.js';
import { isDuration } from './session.js';

// Three authored positions make a small, coherent cottage. A design is a
// decorating style; a house room is a permanent space with its own layout.
export const HOUSE_SLOTS = [
  { id: 'studio', type: 'studio', label: 'Your studio', short: 'Studio', price: 0 },
  { id: 'garden', type: 'greenhouse', label: 'Greenhouse', short: 'Greenhouse', price: 25 },
  { id: 'loft', type: 'attic', label: 'Star attic', short: 'Star attic', price: 75 },
];
export const HOUSE_NAME = 'Littlewood cottage';
const validDesign = id => PRESETS.some(preset => preset.id === id);
export const cleanName = (value, fallback) => typeof value === 'string' && value.trim() ? value.trim().slice(0, 40) : fallback;
export const focusCoins = minutes => isDuration(minutes) && minutes >= 5 ? minutes : 0;

export const MAX_SESSIONS = 1000;
function cleanSessions(raw, roomIds) {
  return (Array.isArray(raw) ? raw : []).filter(entry => Number.isSafeInteger(entry?.at) && isDuration(entry.minutes) && roomIds.includes(entry.roomId))
    .map(({ at, minutes, roomId }) => ({ at, minutes, roomId })).slice(-MAX_SESSIONS);
}
export function recordSession(house, { at, minutes }) {
  house.sessions = [...house.sessions, { at, minutes, roomId: activeHouseRoom(house).id }].slice(-MAX_SESSIONS);
}

export function createHouse(layout = createLayout(), history = []) {
  return {
    version: 2, name: HOUSE_NAME, coins: history.reduce((sum, entry) => sum + focusCoins(entry.minutes), 0),
    activeId: 'studio', sessions: [],
    rooms: [{ id: 'studio', type: 'studio', name: 'Your studio', layout: structuredClone(layout) }],
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
    const type = isRoomType(saved.type) ? saved.type : slot.type;
    const entry = { id: slot.id, type, name: cleanName(saved.name, slot.label), layout: fitRoomType(normalizeLayout(saved.layout), type) };
    if (slot.id === 'studio') house.rooms[0] = entry;
    else house.rooms.push(entry);
  }
  if (house.rooms.some(room => room.id === raw.activeId)) house.activeId = raw.activeId;
  house.sessions = cleanSessions(raw.sessions, house.rooms.map(room => room.id));
  return house;
}

export const activeHouseRoom = house => house.rooms.find(room => room.id === house.activeId) || house.rooms[0];
export const nextExpansion = house => HOUSE_SLOTS[house.rooms.length] || null;
export function houseConnections(house) {
  const next = nextExpansion(house);
  return HOUSE_SLOTS.filter(slot => slot.id !== house.activeId).map(slot => {
    const room = house.rooms.find(entry => entry.id === slot.id);
    return { id: slot.id, name: room?.name || slot.label, built: Boolean(room), upstairs: slot.id === 'loft', price: slot.price, ready: !room && next?.id === slot.id && house.coins >= slot.price, next: next?.id === slot.id };
  });
}
export function expansionVerdict(house, slotId, presetId) {
  const slot = nextExpansion(house);
  if (!slot || slot.id !== slotId) return { ok: false, reason: 'That space is already built or is not the next extension.' };
  if (!validDesign(presetId)) return { ok: false, reason: 'Choose a room design first.' };
  if (house.coins < slot.price) return { ok: false, reason: `${slot.price - house.coins} more coins to build this room.` };
  return { ok: true, slot };
}
