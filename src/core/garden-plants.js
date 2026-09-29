import { sessionStarted } from './session.js';

export const GARDEN_SPECIES = [
  { id: 'cosmos', name: 'Blush cosmos', minutes: 50, color: '#d99ba7', center: '#ddb76e', leaf: '#78966b' },
  { id: 'lavender', name: 'Lavender', minutes: 75, color: '#a99cc5', center: '#d5c4e9', leaf: '#869888' },
  { id: 'sunflower', name: 'Sunflower', minutes: 100, color: '#e5ba62', center: '#866045', leaf: '#7c9765' },
  { id: 'moonflower', name: 'Moonflower', minutes: 125, color: '#e8e6ee', center: '#bcb1d3', leaf: '#7e9f96' },
];
export const GARDEN_PLOTS = 6;
export const GARDEN_CAPACITY = 100;
export const SEED_PRICE = 10;
export const gardenSpecies = id => GARDEN_SPECIES.find(plant => plant.id === id);
export const emptyGarden = () => ({ plants: [], activeId: null, nextId: 1 });
export const gardenPlantName = plant => plant?.name || gardenSpecies(plant?.species)?.name || 'Your plant';
export const gardenGrowth = plant => plant ? Math.min(1, plant.minutes / gardenSpecies(plant.species).minutes) : 0;
export const gardenStage = plant => ['Seed', 'Sprout', 'Growing', 'Budding', 'In bloom'][Math.min(4, Math.floor(gardenGrowth(plant) * 4))];
const validPlot = slot => Number.isInteger(slot) && slot >= 0 && slot < GARDEN_PLOTS;

export function normalizeGarden(raw) {
  const garden = emptyGarden(), ids = new Set(), slots = new Set();
  for (const item of Array.isArray(raw?.plants) ? raw.plants.slice(0, GARDEN_CAPACITY) : []) {
    const species = gardenSpecies(item?.species);
    if (!species || !/^plant-[1-9]\d{0,8}$/.test(item?.id) || ids.has(item.id)) continue;
    ids.add(item.id);
    const slot = validPlot(item.slot) && !slots.has(item.slot) ? item.slot : null;
    if (slot !== null) slots.add(slot);
    garden.plants.push({ id: item.id, species: species.id, name: typeof item.name === 'string' ? item.name.trim().slice(0, 28) : '', minutes: Number.isFinite(item.minutes) ? Math.max(0, Math.min(species.minutes, item.minutes)) : 0, slot });
    garden.nextId = Math.max(garden.nextId, Number(item.id.slice(6)) + 1);
  }
  garden.nextId = Math.max(garden.nextId, Number.isSafeInteger(raw?.nextId) && raw.nextId > 0 && raw.nextId <= 1_000_000_000 ? raw.nextId : 1);
  garden.activeId = garden.plants.some(plant => plant.id === raw?.activeId && gardenGrowth(plant) < 1) ? raw.activeId : null;
  return garden;
}

export function focusGardenPlantId(state) {
  const id = sessionStarted(state.session) && Object.hasOwn(state.session, 'plantId') ? state.session.plantId : state.garden.activeId;
  return state.garden.plants.some(plant => plant.id === id) ? id : null;
}

export function plantGardenSeed(state, speciesId, slot, expectedId) {
  const species = gardenSpecies(speciesId), garden = state.garden;
  if (!species || !validPlot(slot)) return { ok: false, reason: 'Choose a seed and a garden spot.' };
  if (garden.plants.length >= GARDEN_CAPACITY || garden.nextId >= 1_000_000_000) return { ok: false, reason: 'Your collection is full.' };
  const previous = garden.plants.find(plant => plant.slot === slot);
  if (expectedId !== undefined && (previous?.id ?? null) !== expectedId) return { ok: false, reason: 'This spot changed. Choose again.' };
  const price = garden.plants.length ? SEED_PRICE : 0;
  if (state.house.coins < price) return { ok: false, reason: `${price} coins for these seeds.` };
  state.house.coins -= price;
  if (previous) previous.slot = null;
  const plant = { id: `plant-${garden.nextId++}`, species: species.id, name: '', minutes: 0, slot };
  garden.plants.push(plant); garden.activeId = plant.id;
  return { ok: true, id: plant.id, price };
}

export function placeGardenPlant(garden, id, slot) {
  const plant = garden.plants.find(item => item.id === id);
  if (!plant || !validPlot(slot)) return false;
  const previous = garden.plants.find(item => item.slot === slot && item !== plant);
  if (previous) previous.slot = plant.slot;
  plant.slot = slot;
  return true;
}

export function growGarden(state, minutes) {
  const id = state.session.plantId;
  const plant = state.garden.plants.find(item => item.id === id);
  if (!plant || minutes < 5 || gardenGrowth(plant) >= 1) return null;
  const before = plant.minutes, species = gardenSpecies(plant.species);
  plant.minutes = Math.min(species.minutes, before + minutes);
  const bloomed = gardenGrowth(plant) === 1;
  if (bloomed && state.garden.activeId === id) state.garden.activeId = null;
  return { id, name: gardenPlantName(plant), species: plant.species, before, after: plant.minutes, total: species.minutes, bloomed };
}
