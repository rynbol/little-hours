import { focusCoins, nextExpansion } from './house.js';
import { focusHearts, focusPetId, petName } from './pet-bonds.js';
import { petEntry } from './pets.js';
import { focusGardenPlantId, gardenPlantName, gardenSpecies } from './garden-plants.js';

export function focusOutlook(state) {
  const minutes = state.session.duration / 60_000;
  const coins = focusCoins(minutes), petId = focusPetId(state);
  const planted = state.garden.plants.find(plant => plant.id === focusGardenPlantId(state));
  let plant = null;
  if (planted) {
    const total = gardenSpecies(planted.species).minutes;
    const after = Math.min(total, planted.minutes + (minutes >= 5 ? minutes : 0));
    plant = { id: planted.id, name: gardenPlantName(planted), species: planted.species, before: planted.minutes, after, total, blooms: planted.minutes < total && after === total };
  }
  const wish = petEntry(state.petWish), room = nextExpansion(state.house);
  const target = wish && !state.pets.includes(wish.id) ? { kind: 'pet', id: wish.id, name: wish.name, price: wish.price } : room ? { kind: 'room', id: room.id, name: room.label, price: room.price } : null;
  const goal = target && { ...target, saved: state.house.coins, after: Math.min(target.price, state.house.coins + coins), ready: state.house.coins >= target.price, reachable: state.house.coins + coins >= target.price };
  return { coins, hearts: focusHearts(minutes), pet: { id: petId, name: petName(state, petId) }, plant, goal };
}
