export const ADVENTURE_MINUTES = 5;
export const BUDDY_LOG_LIMIT = 12;

export const BUDDY_COLORS = Object.freeze([
  { id: 'peach', label: 'Peach', body: '#f6c7a8', shade: '#e39a82', cheek: '#ef8f8a' },
  { id: 'mint', label: 'Mint', body: '#bfe6cf', shade: '#8cc3a6', cheek: '#f0a0a0' },
  { id: 'lilac', label: 'Lilac', body: '#d9c8f0', shade: '#ae96d6', cheek: '#f09ab8' },
  { id: 'sky', label: 'Sky', body: '#bcdcf3', shade: '#86b4dc', cheek: '#f3a3ae' },
  { id: 'butter', label: 'Butter', body: '#f7e3a0', shade: '#e0bd62', cheek: '#f09a86' },
  { id: 'cocoa', label: 'Cocoa', body: '#c9a28a', shade: '#9d765f', cheek: '#e98f86' },
].map(Object.freeze));

export const BUDDY_STAGES = Object.freeze([
  { id: 'seed', label: 'Little seed', minutes: 0 },
  { id: 'sprout', label: 'Sprout', minutes: 60 },
  { id: 'leafy', label: 'Leafy', minutes: 300 },
  { id: 'budding', label: 'Budding', minutes: 900 },
  { id: 'blooming', label: 'Blooming', minutes: 2400 },
].map(Object.freeze));

export const PLACES = Object.freeze([
  { id: 'garden', label: 'the garden', minutes: 5 },
  { id: 'pond', label: 'the pond shore', minutes: 15 },
  { id: 'woods', label: 'the pine woods', minutes: 25 },
  { id: 'falls', label: 'the waterfall cliffs', minutes: 45 },
  { id: 'clouds', label: 'the cloud islands', minutes: 90 },
].map(Object.freeze));

export const FINDS = Object.freeze([
  { id: 'clover', place: 'garden', tier: 'common', label: 'Four-leaf clover', where: 'between the tulips' },
  { id: 'snail-shell', place: 'garden', tier: 'common', label: 'Snail shell', where: 'on the garden path, empty and swirly' },
  { id: 'seed-pouch', place: 'garden', tier: 'uncommon', label: 'Seed pouch', where: 'hanging from the fence post' },
  { id: 'fairy-cap', place: 'garden', tier: 'rare', label: 'Fairy mushroom', where: 'in a ring of tiny mushrooms' },
  { id: 'pebble', place: 'pond', tier: 'common', label: 'Skipping pebble', where: 'at the water’s edge' },
  { id: 'duck-feather', place: 'pond', tier: 'common', label: 'Duck feather', where: 'floating by the reeds' },
  { id: 'sea-glass', place: 'pond', tier: 'uncommon', label: 'Sea glass', where: 'glinting under the dock' },
  { id: 'pond-pearl', place: 'pond', tier: 'rare', label: 'Pond pearl', where: 'inside a sleepy mussel' },
  { id: 'acorn', place: 'woods', tier: 'common', label: 'Acorn cap', where: 'under the oldest pine' },
  { id: 'pinecone', place: 'woods', tier: 'common', label: 'Pinecone', where: 'rolling down the hill' },
  { id: 'owl-feather', place: 'woods', tier: 'uncommon', label: 'Owl feather', where: 'below a hollow in a tree' },
  { id: 'brass-key', place: 'woods', tier: 'rare', label: 'Old brass key', where: 'buried in soft moss' },
  { id: 'fern', place: 'falls', tier: 'common', label: 'Fern curl', where: 'in the spray of the falls' },
  { id: 'striped-stone', place: 'falls', tier: 'common', label: 'Striped stone', where: 'on a sunny ledge' },
  { id: 'crystal', place: 'falls', tier: 'uncommon', label: 'Little crystal', where: 'in a crack behind the water' },
  { id: 'rainbow-drop', place: 'falls', tier: 'rare', label: 'Rainbow drop', where: 'where the mist makes rainbows' },
  { id: 'cloud-puff', place: 'clouds', tier: 'common', label: 'Cloud puff', where: 'drifting past the ridge' },
  { id: 'star-shard', place: 'clouds', tier: 'uncommon', label: 'Star shard', where: 'still warm from falling' },
  { id: 'moon-button', place: 'clouds', tier: 'uncommon', label: 'Moon button', where: 'on the softest cloud' },
  { id: 'comet-ribbon', place: 'clouds', tier: 'rare', label: 'Comet ribbon', where: 'tangled on a sky island' },
].map(Object.freeze));

export const findOf = id => FINDS.find(find => find.id === id) || null;
export const placeOf = id => PLACES.find(place => place.id === id) || null;
export const colorOf = id => BUDDY_COLORS.find(color => color.id === id) || BUDDY_COLORS[0];
export const buddyStage = minutes => BUDDY_STAGES.findLast(stage => minutes >= stage.minutes);
export const nextBuddyStage = minutes => BUDDY_STAGES.find(stage => minutes < stage.minutes) || null;
export const reachablePlaces = minutes => PLACES.filter(place => minutes >= place.minutes);

export function tierWeights(minutes) {
  const rare = Math.min(.24, .03 + minutes / 450);
  return { common: 1 - .3 - rare, uncommon: .3, rare };
}

export function rollAdventure(minutes, random) {
  const places = reachablePlaces(minutes);
  if (!places.length) return null;
  const total = places.reduce((sum, _, i) => sum + i + 1, 0);
  let pick = random() * total, place = places.find((_, i) => (pick -= i + 1) < 0) || places.at(-1);
  const weights = tierWeights(minutes);
  let roll = random(), tier = roll < weights.rare ? 'rare' : roll < weights.rare + weights.uncommon ? 'uncommon' : 'common';
  const pool = FINDS.filter(find => find.place === place.id && find.tier === tier);
  const find = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
  return { place: place.id, find: find.id };
}

export function emptyBuddy() { return { name: 'Pip', color: BUDDY_COLORS[0].id, minutes: 0, finds: {}, log: [] }; }

const isStamp = value => Number.isSafeInteger(value) && value >= 0;
export function normalizeBuddy(raw) {
  const buddy = emptyBuddy();
  if (!raw || typeof raw !== 'object') return buddy;
  if (typeof raw.name === 'string' && raw.name.trim()) buddy.name = raw.name.trim().slice(0, 20);
  if (BUDDY_COLORS.some(color => color.id === raw.color)) buddy.color = raw.color;
  if (Number.isSafeInteger(raw.minutes) && raw.minutes > 0) buddy.minutes = raw.minutes;
  if (raw.finds && typeof raw.finds === 'object') for (const find of FINDS) {
    const saved = raw.finds[find.id];
    if (saved && Number.isSafeInteger(saved.count) && saved.count > 0 && isStamp(saved.first)) buddy.finds[find.id] = { count: saved.count, first: saved.first };
  }
  if (Array.isArray(raw.log)) buddy.log = raw.log.filter(entry => entry && findOf(entry.find)?.place === entry.place && Number.isSafeInteger(entry.minutes) && isStamp(entry.at))
    .slice(-BUDDY_LOG_LIMIT).map(({ find, place, minutes, at, opened }) => ({ find, place, minutes, at, opened: opened === true }));
  return buddy;
}

export function recordAdventure(buddy, minutes, at, random) {
  buddy.minutes += minutes;
  const rolled = rollAdventure(minutes, random);
  if (!rolled) return null;
  const before = buddy.finds[rolled.find];
  buddy.finds[rolled.find] = { count: (before?.count || 0) + 1, first: before?.first ?? at };
  buddy.log = [...buddy.log, { ...rolled, minutes, at, opened: false }].slice(-BUDDY_LOG_LIMIT);
  return { ...rolled, isNew: !before };
}

export const waitingFind = buddy => buddy.log.findLast(entry => !entry.opened) || null;

export function adventureStory(name, entry) {
  const find = findOf(entry.find), place = placeOf(entry.place);
  const label = find.label.toLowerCase();
  return `${name} wandered to ${place.label} and found ${/^[aeiou]/.test(label) ? 'an' : 'a'} ${label} ${find.where}.`;
}
