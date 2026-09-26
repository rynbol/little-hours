const room = (id, presetId, name) => ({ id, name, layout: { presetId, items: [] } });
const rooms = [room('studio', 'ember-library', 'Your studio'), room('garden', 'sakura-studio', 'Garden wing'), room('loft', 'cloud-loft', 'Upstairs hideaway')];

const house = (count, coins = 0) => ({
  theme: 'dusk',
  layout: { presetId: 'ember-library', items: [] },
  house: { version: 1, name: 'Littlewood cottage', coins, activeId: 'studio', rooms: rooms.slice(0, count) },
});

export const SEEDS = {
  fresh: null,
  'one-room': house(1),
  'one-room-rich': house(1, 300),
  'two-rooms': house(2),
  'three-rooms': house(3),
};

export function seedState(name, { theme } = {}) {
  if (!(name in SEEDS)) throw new Error(`Unknown seed "${name}". Seeds: ${Object.keys(SEEDS).join(', ')}`);
  const state = SEEDS[name] && structuredClone(SEEDS[name]);
  if (state && theme) state.theme = theme;
  return state;
}
