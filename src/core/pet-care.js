export const MEAL_COST = 5;
export const MEAL_WAIT = 20 * 60_000;
export const PLAY_WAIT = 25 * 60_000;
export const PET_FOODS = Object.freeze({
  cat: [{ id: 'supper', name: 'Salmon supper', color: '#d89076' }, { id: 'crunch', name: 'Crunchy bites', color: '#bc8d51' }],
  dog: [{ id: 'supper', name: 'Chicken supper', color: '#d9ac72' }, { id: 'crunch', name: 'Little biscuits', color: '#bb8958' }],
  bunny: [{ id: 'supper', name: 'Garden greens', color: '#91ad6a' }, { id: 'crunch', name: 'Carrot bites', color: '#dc9850' }],
  fox: [{ id: 'supper', name: 'Berry bowl', color: '#bd7985' }, { id: 'crunch', name: 'Crunchy bites', color: '#c99758' }],
  panda: [{ id: 'supper', name: 'Bamboo bowl', color: '#8fa66c' }, { id: 'crunch', name: 'Apple slices', color: '#d3a96d' }],
});
export const PET_BELONGINGS = Object.freeze([
  { id: 'linen', name: 'Oat linen', color: '#e5cba4', dark: '#ae815b', price: 0 },
  { id: 'rose', name: 'Rose gingham', color: '#d8a2a0', dark: '#a86272', price: 15 },
  { id: 'sage', name: 'Sage gingham', color: '#a7b69c', dark: '#6c866c', price: 15 },
  { id: 'blue', name: 'Blue gingham', color: '#9eb5c5', dark: '#6e8b9c', price: 15 },
]);
const deadline = value => Number.isSafeInteger(value) && value >= 0 && value <= 8.64e15 ? value : 0;
export function normalizePetCare(raw) {
  const owned = PET_BELONGINGS.filter(item => item.price === 0 || Array.isArray(raw?.belongings) && raw.belongings.includes(item.id)).map(item => item.id);
  return {
    fedUntil: deadline(raw?.fedUntil), playedUntil: deadline(raw?.playedUntil),
    meals: Number.isSafeInteger(raw?.meals) && raw.meals >= 0 ? Math.min(raw.meals, 1_000_000_000) : 0,
    foods: ['supper', 'crunch'].filter(id => Array.isArray(raw?.foods) && raw.foods.includes(id)),
    food: raw?.food === 'crunch' ? 'crunch' : 'supper', belongings: owned,
    fabric: owned.includes(raw?.fabric) ? raw.fabric : 'linen',
  };
}
export function petCareStatus(bond, now) {
  const care = bond.care;
  return { full: now < care.fedUntil, mealMinutes: Math.max(0, Math.ceil((care.fedUntil - now) / 60_000)), playReady: now >= care.playedUntil, playMinutes: Math.max(0, Math.ceil((care.playedUntil - now) / 60_000)) };
}
export function mealVerdict(state, id, food, now) {
  if (!state.pets.includes(id) || !PET_FOODS[id]?.some(item => item.id === food)) return { ok: false, reason: 'Choose a meal for your pet.' };
  if (petCareStatus(state.petBonds[id], now).full) return { ok: false, reason: 'Still full.' };
  if (state.house.coins < MEAL_COST) return { ok: false, reason: `${MEAL_COST - state.house.coins} more coins` };
  return { ok: true };
}
