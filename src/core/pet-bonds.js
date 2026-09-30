import { PET_SHOP, petEntry } from './pets.js';
import { sessionStarted } from './session.js';
import { normalizePetCare, mealVerdict, MEAL_COST, MEAL_WAIT, PLAY_WAIT, PET_BELONGINGS } from './pet-care.js';
import { petGifts } from './pet-gifts.js';

export const PET_PERSONALITIES = Object.freeze({
  cat: { trait: 'Quiet company', loves: 'Warm windows & slow mornings', favorite: 'window', ritual: 'cuddle', color: '#cf966a' },
  dog: { trait: 'Your little shadow', loves: 'Play breaks & being near you', favorite: 'desk', ritual: 'play', color: '#c39472' },
  bunny: { trait: 'A gentle soul', loves: 'Soft rugs & tiny treats', favorite: 'rug', ritual: 'treat', color: '#bbac95' },
  fox: { trait: 'A curious spark', loves: 'Window watching & little games', favorite: 'window', ritual: 'play', color: '#d48960' },
  panda: { trait: 'Professional daydreamer', loves: 'Fireside naps & snack breaks', favorite: 'fire', ritual: 'treat', color: '#ad745c' },
});
export const PET_RITUALS = Object.freeze({ cuddle: { label: 'Cuddle', symbol: 'heart' }, play: { label: 'Play', symbol: 'sun' }, treat: { label: 'Treat', symbol: 'leaf' } });
export const BOND_LEVELS = Object.freeze([
  { at: 0, title: 'Getting to know you', keepsake: 'Honey ribbon', color: '#d9af65' },
  { at: 8, title: 'Little friends', keepsake: 'Rose ribbon', color: '#cb8796' },
  { at: 24, title: 'Favorite company', keepsake: 'Sage ribbon', color: '#91aa84' },
  { at: 60, title: 'Home is you', keepsake: 'Starlight ribbon', color: '#b2a0ce' },
]);
const count = value => Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 1_000_000_000) : 0;
export const petName = (state, id = state.pet) => state.petBonds?.[id]?.name || petEntry(id)?.name || 'Miso';
export const focusPetId = state => sessionStarted(state.session) ? state.session.petId || state.pet : state.pet;
export const cleanPetName = (value, fallback) => typeof value === 'string' && value.trim() ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24) || fallback : fallback;
export function bondLevel(bond) {
  const points = count(bond?.affection);
  const index = BOND_LEVELS.findLastIndex(level => points >= level.at);
  const level = BOND_LEVELS[index], next = BOND_LEVELS[index + 1];
  return { ...level, index, next, progress: next ? (points - level.at) / (next.at - level.at) : 1, points };
}
export const HEART_POINTS = 4;
export const MAX_HEARTS = BOND_LEVELS.at(-1).at / HEART_POINTS;
export const bondHearts = bond => Math.min(MAX_HEARTS, count(bond?.affection) / HEART_POINTS);
export function newPetBond(id) {
  return { name: petEntry(id)?.name || 'Miso', affection: 0, minutes: 0, sessions: 0, ribbon: 0, gift: null, ritualDay: '', rituals: [], memories: [], care: normalizePetCare(null) };
}
export function normalizePetBonds(raw, owned) {
  return Object.fromEntries(owned.map(id => {
    const value = raw?.[id], bond = newPetBond(id);
    if (value && typeof value === 'object') {
      bond.name = cleanPetName(value.name, bond.name);
      for (const key of ['affection', 'minutes', 'sessions']) bond[key] = count(value[key]);
      bond.ribbon = Math.min(count(value.ribbon), bondLevel(bond).index);
      bond.gift = petGifts({ minutes: bond.minutes, gift: value.gift }).selected?.id || null;
      bond.care = normalizePetCare(value.care);
      bond.ritualDay = typeof value.ritualDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.ritualDay) ? value.ritualDay : '';
      bond.rituals = Object.keys(PET_RITUALS).filter(key => Array.isArray(value.rituals) && value.rituals.includes(key));
      bond.memories = Array.isArray(value.memories) ? value.memories.filter(m => m && ['welcome', 'focus', 'bond'].includes(m.kind) && Number.isSafeInteger(m.at) && m.at >= 0 && m.at <= 8.64e15).slice(-12).map(m => ({ kind: m.kind, at: m.at, value: count(m.value) })) : [];
    }
    return [id, bond];
  }));
}
function memory(bond, kind, at, value = 0) { bond.memories.push({ kind, at, value }); bond.memories = bond.memories.slice(-12); }
function growBond(bond, amount, at) {
  const before = bondLevel(bond).index;
  bond.affection = Math.min(1_000_000_000, bond.affection + amount);
  const after = bondLevel(bond).index;
  if (after > before) { bond.ribbon = after; memory(bond, 'bond', at, after); }
  return after > before;
}
export function shareRitual(state, id, kind, day, at) {
  if (!['cuddle', 'play'].includes(kind) || !state.pets.includes(id)) return { id, ok: false, earned: 0 };
  const bond = state.petBonds[id];
  if (kind === 'play') {
    const earned = at >= bond.care.playedUntil ? 1 : 0;
    if (earned) bond.care.playedUntil = at + PLAY_WAIT;
    return { id, ok: true, earned, unlocked: growBond(bond, earned, at) };
  }
  if (day > bond.ritualDay) { bond.ritualDay = day; bond.rituals = []; }
  const fresh = day === bond.ritualDay && !bond.rituals.includes(kind);
  const earned = fresh ? (PET_PERSONALITIES[id].ritual === kind ? 2 : 1) : 0;
  if (fresh) bond.rituals.push(kind);
  const unlocked = growBond(bond, earned, at);
  return { id, ok: true, earned, unlocked };
}
export function feedPet(state, id, food, at) {
  const verdict = mealVerdict(state, id, food, at);
  if (!verdict.ok) return { ...verdict, id, earned: 0 };
  const bond = state.petBonds[id], care = bond.care;
  state.house.coins -= MEAL_COST;
  care.fedUntil = at + MEAL_WAIT; care.food = food; care.meals = Math.min(1_000_000_000, care.meals + 1);
  const discovered = !care.foods.includes(food);
  if (discovered) care.foods.push(food);
  return { ok: true, id, food, earned: 1, discovered, unlocked: growBond(bond, 1, at) };
}
export function choosePetFabric(state, id, fabric) {
  const item = PET_BELONGINGS.find(entry => entry.id === fabric);
  if (!state.pets.includes(id) || !item) return { ok: false, reason: 'Choose a pet blanket.' };
  const care = state.petBonds[id].care, price = care.belongings.includes(fabric) ? 0 : item.price;
  if (state.house.coins < price) return { ok: false, reason: `${price - state.house.coins} more coins` };
  state.house.coins -= price;
  if (!care.belongings.includes(fabric)) care.belongings.push(fabric);
  care.fabric = fabric;
  return { ok: true, price };
}
export const focusHearts = minutes => minutes >= 5 ? Math.floor(minutes / 5) : 0;

export function recordPetFocus(state, minutes, at) {
  if (minutes < 5) return { earned: 0, gifts: [] };
  const id = state.pets.includes(state.session.petId) ? state.session.petId : state.pet;
  const bond = state.petBonds[id], earned = focusHearts(minutes), previousGifts = petGifts(bond).earned.length;
  bond.minutes = Math.min(1_000_000_000, bond.minutes + minutes); bond.sessions = Math.min(1_000_000_000, bond.sessions + 1);
  const gifts = petGifts(bond).earned.slice(previousGifts);
  if (gifts.length) bond.gift = gifts.at(-1).id;
  memory(bond, 'focus', at, minutes);
  const unlocked = growBond(bond, earned, at);
  return { id, earned, unlocked, gifts };
}
export function welcomePet(state, id, name, at) {
  state.petBonds[id] = newPetBond(id);
  state.petBonds[id].name = cleanPetName(name, petEntry(id).name);
  memory(state.petBonds[id], 'welcome', at);
  if (state.petWish === id) state.petWish = null;
}
export const normalizePetWish = (wish, owned) => PET_SHOP.some(p => p.id === wish && !owned.includes(p.id)) ? wish : null;
