const room = (id, presetId, name) => ({ id, name, layout: { presetId, items: [] } });
const rooms = [room('studio', 'ember-library', 'Your studio'), room('garden', 'sakura-studio', 'Garden wing'), room('loft', 'cloud-loft', 'Upstairs hideaway')];

const house = (count, coins = 0) => ({
  theme: 'dusk',
  layout: { presetId: 'ember-library', items: [] },
  house: { version: 1, name: 'Littlewood cottage', coins, activeId: 'studio', rooms: rooms.slice(0, count) },
});

const starLog = Array.from({ length: 60 }, (_, i) => ({ at: 1_780_000_000_000 + i * 97_531_111, minutes: i % 6 === 0 ? 50 : 25, roomId: 'loft' }));
const studyDays = [10, 25, 60, 45, 90, 5, 30, 75, 50, 15, 60, 40, 120, 20].map((minutes, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, minutes }));
const growing = (phase, minutes = 25) => ({ duration: minutes * 60_000, remaining: phase === 4 ? 0 : Math.round(minutes * 60_000 * (1 - (phase + 0.5) / 4)), endsAt: null, running: false });

export const SEEDS = {
  fresh: null,
  'one-room': house(1),
  'one-room-rich': house(1, 300),
  'two-rooms': house(2),
  'three-rooms': house(3),
  greenhouse: { ...house(3), layout: undefined, house: { ...house(3).house, activeId: 'garden' } },
  ...Object.fromEntries(['seed', 'sprout', 'youngling', 'budding', 'bloom'].map((name, phase) => [`greenhouse-${name}`, { ...house(3), layout: undefined, session: growing(phase), house: { ...house(3).house, activeId: 'garden' } }])),
  ...Object.fromEntries(['cloud-loft', 'ember-library'].map(presetId => [`greenhouse-${presetId}`, { ...house(3), layout: undefined, house: { ...house(3).house, activeId: 'garden', rooms: rooms.map(entry => entry.id === 'garden' ? room('garden', presetId, 'Garden wing') : entry) } }])),
  'attic-stars': { ...house(3), layout: undefined, house: { ...house(3).house, activeId: 'loft', sessions: starLog } },
  'garden-days': { ...house(3), history: studyDays },
  attic: { ...house(3), layout: undefined, house: { ...house(3).house, activeId: 'loft' } },
  ...Object.fromEntries(['bunny', 'fox', 'panda'].map(pet => [`pet-${pet}`, { ...house(1), pet, pets: ['cat', 'dog', pet] }])),
  'pet-shop': house(1, 120),
  'pet-bonded': { ...house(1, 25), seenAt: new Date('2026-01-10T15:50:00').getTime(), petBonds: { cat: { affection: 60, minutes: 300, ribbon: 3, care: { fabric: 'rose', belongings: ['linen', 'rose'] } } } },
  'pet-finish': { ...house(1), petBonds: { cat: { affection: 3 } }, session: { duration: 1500000, remaining: 1500000, running: true, endsAt: new Date('2026-01-10T16:30:00').getTime() + 6000, petId: 'cat' } },
  pond: { ...house(3), history: studyDays, pond: { bait: [{ minutes: 10, at: 1 }, { minutes: 20, at: 2 }, { minutes: 35, at: 3 }, { minutes: 35, at: 4 }, { minutes: 60, at: 5 }, { minutes: 95, at: 6 }], journal: { minnow: { count: 3, best: 7.4, first: 1 }, perch: { count: 1, best: 18.2, first: 2 }, koi: { count: 1, best: 41, first: 3 } }, log: [] } },
  'pond-empty': { ...house(3), pond: { bait: [], journal: {}, log: [] } },
};

export function seedState(name, { theme } = {}) {
  if (!(name in SEEDS)) throw new Error(`Unknown seed "${name}". Seeds: ${Object.keys(SEEDS).join(', ')}`);
  const state = SEEDS[name] && structuredClone(SEEDS[name]);
  if (state && theme) state.theme = theme;
  return state;
}
