export const PET_SHOP = Object.freeze([
  { id: 'cat', name: 'Miso', kind: 'ginger cat', price: 0, speed: 0.5, about: 'A ginger tabby who loves the fire' },
  { id: 'dog', name: 'Mochi', kind: 'puppy', price: 0, speed: 0.62, about: 'A floppy-eared puppy with a happy tail' },
  { id: 'bunny', name: 'Dango', kind: 'bunny', price: 40, speed: 0.46, about: 'A soft cloud of a bunny with a twitchy nose' },
  { id: 'fox', name: 'Hoshi', kind: 'fox kit', price: 90, speed: 0.6, about: 'A little fox with a snow-tipped tail' },
  { id: 'panda', name: 'Kiki', kind: 'red panda', price: 160, speed: 0.44, about: 'A red panda with a ringed tail who naps anywhere' },
].map(Object.freeze));
export const petEntry = id => PET_SHOP.find(pet => pet.id === id) || null;
export const FREE_PETS = PET_SHOP.filter(pet => pet.price === 0).map(pet => pet.id);

export function normalizeOwnedPets(raw) {
  const saved = Array.isArray(raw) ? raw : [];
  return PET_SHOP.filter(pet => pet.price === 0 || saved.includes(pet.id)).map(pet => pet.id);
}

export function adoptionVerdict(state, id) {
  const pet = petEntry(id);
  if (!pet) return { ok: false, reason: 'That little one isn’t here yet.' };
  if (state.pets.includes(id)) return { ok: false, reason: `${pet.name} already lives with you.` };
  if (state.house.coins < pet.price) return { ok: false, reason: `${pet.price - state.house.coins} more coins to welcome ${pet.name} home.` };
  return { ok: true, pet };
}
