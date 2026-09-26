// A few intentional moments with pieces already in the room. These are
// temporary activities; they never change focus time, coins, or furniture.
const WATER = Object.freeze({ kind: 'water', label: 'Water the leaves', symbol: 'leaf' });
const TEA = Object.freeze({ kind: 'tea', label: 'Have a little tea', symbol: 'tea' });
const READ = Object.freeze({ kind: 'read', label: 'Read a few pages', symbol: 'book' });
const REST = Object.freeze({ kind: 'rest', label: 'Get comfortable', symbol: 'seat' });
const INTERACTIONS = Object.freeze({
  plant: WATER, monstera: WATER, 'moon-tree': WATER,
  'side-table': TEA, 'tea-cart': TEA,
  bookcase: READ, 'lounge-chair': READ,
  daybed: REST, ottoman: REST,
});

export function interactionFor(type) { return INTERACTIONS[type] || null; }

export const INTERACTION_NOTICES = Object.freeze({
  focusing: 'A little moment after focus. Pause your timer when you’re ready.',
  editing: 'Finish decorating or choosing your look first.',
  travelling: 'Let’s get to the next room first.',
  moving: 'Just getting comfortable. Try again in a moment.',
  blocked: 'I can’t reach that spot yet. Leave a little space around it.',
  already: 'Already enjoying this little moment.',
});
