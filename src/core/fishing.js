export const TIERS = Object.freeze([
  { id: 'common', label: 'Common', color: '#9fb187', strength: .42, stamina: 7, temper: .2 },
  { id: 'uncommon', label: 'Uncommon', color: '#7fb0c9', strength: .52, stamina: 8, temper: .3 },
  { id: 'rare', label: 'Rare', color: '#b594d6', strength: .62, stamina: 9, temper: .4 },
  { id: 'epic', label: 'Epic', color: '#e59a7a', strength: .72, stamina: 11, temper: .5 },
  { id: 'legendary', label: 'Legendary', color: '#f1c96b', strength: .82, stamina: 13, temper: .6 },
].map(Object.freeze));

export const SPECIES = Object.freeze([
  { id: 'minnow', name: 'Pebble Minnow', tier: 'common', size: [4, 9], look: { shape: 'slim', body: '#b9c3b0', belly: '#eef0e2', fin: '#98a38f' }, about: 'Darts between the stepping stones in little crowds.' },
  { id: 'perch', name: 'Reed Perch', tier: 'common', size: [12, 26], look: { shape: 'deep', body: '#a8b76b', belly: '#f0e6b8', fin: '#d98d5f', mark: 'stripes' }, about: 'Hides in the cattails and grumbles when found.' },
  { id: 'bluegill', name: 'Button Bluegill', tier: 'common', size: [8, 18], look: { shape: 'round', body: '#7e9fb0', belly: '#f2d49a', fin: '#5f7f93' }, about: 'Round as a coat button, twice as shiny.' },
  { id: 'carp', name: 'Mossy Carp', tier: 'common', size: [25, 55], look: { shape: 'deep', body: '#8c8a5a', belly: '#d8cc98', fin: '#6f6d48', whiskers: true }, about: 'Has lived under the lily pads longer than the cottage.' },
  { id: 'dace', name: 'Speckled Dace', tier: 'uncommon', size: [10, 20], look: { shape: 'slim', body: '#c9b08a', belly: '#f4ead3', fin: '#a88a64', mark: 'spots' }, about: 'Freckled all over, like it napped in the sun.' },
  { id: 'trout', name: 'Lantern Trout', tier: 'uncommon', size: [22, 45], look: { shape: 'long', body: '#9aae8a', belly: '#f2c9b8', fin: '#7c8f6c', mark: 'spots', glow: '#f6c37a' }, about: 'A pink stripe glows along its side at dusk.' },
  { id: 'bream', name: 'Honey Bream', tier: 'uncommon', size: [18, 38], look: { shape: 'deep', body: '#d6a55c', belly: '#f6e3b0', fin: '#b98640' }, about: 'Golden and slow, it smells faintly of toast.' },
  { id: 'koi', name: 'Moonlit Koi', tier: 'rare', size: [30, 60], look: { shape: 'koi', body: '#f4efe6', belly: '#fffaf1', fin: '#e9e0d2', mark: 'patches', patch: '#e2674c', whiskers: true }, about: 'Pale as the moon, with maple-red patches.' },
  { id: 'catfish', name: 'Starlight Catfish', tier: 'rare', size: [35, 80], look: { shape: 'long', body: '#4f5b73', belly: '#aeb6c8', fin: '#3d475c', mark: 'stars', whiskers: true }, about: 'Its back is dusted with tiny silver stars.' },
  { id: 'salmon', name: 'Rosy Salmon', tier: 'rare', size: [40, 75], look: { shape: 'long', body: '#d9857a', belly: '#f6d3c7', fin: '#b86a60', mark: 'spots' }, about: 'Swims upstream just to see the waterfall.' },
  { id: 'eel', name: 'Glass Eel', tier: 'epic', size: [45, 110], look: { shape: 'eel', body: '#bfe3dc', belly: '#eefaf6', fin: '#9fd0c6', glow: '#dff7f1' }, about: 'So clear you can see the pond through it.' },
  { id: 'aurora', name: 'Aurora Koi', tier: 'epic', size: [40, 70], look: { shape: 'koi', body: '#8fc7c2', belly: '#e9f3ee', fin: '#c49ad8', mark: 'patches', patch: '#c49ad8', whiskers: true, glow: '#b8f0e2' }, about: 'Shimmers teal to lilac as it turns.' },
  { id: 'sturgeon', name: 'Twilight Sturgeon', tier: 'epic', size: [80, 160], look: { shape: 'sturgeon', body: '#6c6f8e', belly: '#c7c3d6', fin: '#55587a', mark: 'plates', whiskers: true }, about: 'Ancient, patient, armoured like a knight.' },
  { id: 'whiskers', name: 'Old Golden Whiskers', tier: 'legendary', size: [90, 180], look: { shape: 'deep', body: '#e9b949', belly: '#fbe7a6', fin: '#d49a2c', whiskers: true, glow: '#ffe28a' }, about: 'The pond’s grandparent. Grants one wish, or so they say.' },
  { id: 'celestial', name: 'Celestial Koi', tier: 'legendary', size: [60, 110], look: { shape: 'koi', body: '#2f3d6b', belly: '#8b9ad0', fin: '#f1c96b', mark: 'stars', whiskers: true, glow: '#f7e3a1' }, about: 'Carries a little piece of the night sky.' },
].map(entry => Object.freeze({ ...entry, look: Object.freeze(entry.look) })));

export const BAIT_RANGES = Object.freeze([
  { id: 'crumb', label: 'Bread crumb', from: 5, to: 14, weights: [85, 15, 0, 0, 0] },
  { id: 'worm', label: 'Garden worm', from: 15, to: 29, weights: [55, 35, 10, 0, 0] },
  { id: 'cricket', label: 'Cricket', from: 30, to: 49, weights: [30, 38, 25, 7, 0] },
  { id: 'firefly', label: 'Firefly lure', from: 50, to: 89, weights: [15, 30, 32, 20, 3] },
  { id: 'star', label: 'Star lure', from: 90, to: Infinity, weights: [5, 20, 35, 28, 12] },
].map(Object.freeze));
export const MIN_BAIT_MINUTES = BAIT_RANGES[0].from;
export const BAIT_LIMIT = 30, LOG_LIMIT = 12;

export const tierOf = id => TIERS.find(tier => tier.id === id);
export const speciesOf = id => SPECIES.find(entry => entry.id === id) || null;
export const baitRange = minutes => BAIT_RANGES.find(range => minutes >= range.from && minutes <= range.to) || null;

export function rollCatch(minutes, random) {
  const range = baitRange(minutes);
  if (!range) return null;
  const total = range.weights.reduce((sum, w) => sum + w, 0);
  let pick = random() * total, tier = range.weights.findIndex(w => (pick -= w) < 0);
  if (tier < 0) tier = range.weights.findLastIndex(w => w > 0);
  const pool = SPECIES.filter(entry => entry.tier === TIERS[tier].id), species = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
  const [min, max] = species.size, size = min + (max - min) * random() ** (1 / (1 + minutes / 60));
  return { species: species.id, size: Math.round(size * 10) / 10 };
}

export function emptyPond() { return { bait: [{ minutes: 10, at: 0 }], journal: {}, log: [] }; }

const isStamp = value => Number.isSafeInteger(value) && value >= 0;
export function normalizePond(raw) {
  const pond = emptyPond();
  if (!raw || typeof raw !== 'object') return pond;
  if (Array.isArray(raw.bait)) pond.bait = raw.bait.filter(b => b && baitRange(b.minutes) && isStamp(b.at)).slice(-BAIT_LIMIT).map(({ minutes, at }) => ({ minutes, at }));
  if (raw.journal && typeof raw.journal === 'object') for (const entry of SPECIES) {
    const saved = raw.journal[entry.id];
    if (saved && Number.isSafeInteger(saved.count) && saved.count > 0 && Number.isFinite(saved.best) && saved.best > 0 && isStamp(saved.first)) pond.journal[entry.id] = { count: saved.count, best: saved.best, first: saved.first };
  }
  if (Array.isArray(raw.log)) pond.log = raw.log.filter(c => c && speciesOf(c.species) && Number.isFinite(c.size) && baitRange(c.minutes) && isStamp(c.at)).slice(-LOG_LIMIT).map(({ species, size, minutes, at }) => ({ species, size, minutes, at }));
  return pond;
}

export function addBait(pond, minutes, at) {
  if (!baitRange(minutes)) return;
  pond.bait = [...pond.bait, { minutes, at }].slice(-BAIT_LIMIT);
}

export function landCatch(pond, baitIndex, random, at, rolled = null) {
  const bait = pond.bait[baitIndex];
  if (!bait) return null;
  const caught = rolled ?? rollCatch(bait.minutes, random), before = pond.journal[caught.species];
  pond.bait = pond.bait.filter((_, i) => i !== baitIndex);
  pond.journal[caught.species] = before
    ? { count: before.count + 1, best: Math.max(before.best, caught.size), first: before.first }
    : { count: 1, best: caught.size, first: at };
  pond.log = [...pond.log, { ...caught, minutes: bait.minutes, at }].slice(-LOG_LIMIT);
  return { ...caught, minutes: bait.minutes, isNew: !before, record: Boolean(before) && caught.size > before.best, count: pond.journal[caught.species].count, best: pond.journal[caught.species].best };
}

export const FIGHT = Object.freeze({ red: .86, snapAfter: .9, slackAfter: 3.2, reelSpeed: .17 });
const MOODS = Object.freeze({ rest: { pull: .15, time: [.8, 1.8] }, tug: { pull: .55, time: [1, 2.2] }, run: { pull: 1, time: [.8, 1.5] } });

export function startFight(tierId) {
  const tier = tierOf(tierId);
  return { strength: tier.strength, stamina: tier.stamina, temper: tier.temper, line: 1, tension: .25, pull: 0, tired: 0, mood: 'tug', moodLeft: 1.2, strain: 0, slack: 0, runs: 0, time: 0, outcome: null };
}

export function stepFight(fight, dt, reeling, random) {
  if (fight.outcome) return fight;
  fight.time += dt; fight.moodLeft -= dt;
  if (fight.moodLeft <= 0) {
    const roll = random(), mood = roll < fight.temper * .5 ? 'run' : roll < .72 ? 'tug' : 'rest', [low, high] = MOODS[mood].time;
    if (mood === 'run') fight.runs++;
    fight.mood = mood; fight.moodLeft = low + (high - low) * random();
  }
  fight.tired = Math.min(1, fight.tired + dt / fight.stamina * (fight.mood === 'run' ? 1.5 : 1));
  const wobble = fight.mood === 'tug' ? Math.sin(fight.time * 9) * .08 : 0;
  const goal = fight.strength * (MOODS[fight.mood].pull + wobble) * (1 - .6 * fight.tired);
  fight.pull += (goal - fight.pull) * Math.min(1, dt * 6);
  const aim = reeling ? fight.pull * .9 + .5 : fight.pull * .55;
  fight.tension = Math.max(0, Math.min(1.1, fight.tension + (aim - fight.tension) * Math.min(1, dt * (reeling ? 2.4 : 3.2))));
  fight.line = reeling ? fight.line - dt * FIGHT.reelSpeed * (1 - fight.pull * .75) : Math.min(1, fight.line + dt * fight.pull * .14);
  fight.strain = fight.tension >= FIGHT.red ? fight.strain + dt : Math.max(0, fight.strain - dt * .6);
  fight.slack = !reeling ? fight.slack + dt : Math.max(0, fight.slack - dt * 2);
  if (fight.line <= 0) { fight.line = 0; fight.outcome = 'landed'; }
  else if (fight.strain >= FIGHT.snapAfter) fight.outcome = 'snapped';
  else if (fight.slack >= FIGHT.slackAfter) fight.outcome = 'escaped';
  return fight;
}

export function stockBait(pond, each, at) {
  for (const range of BAIT_RANGES) {
    const have = pond.bait.filter(bait => baitRange(bait.minutes) === range).length;
    for (let i = have; i < each && pond.bait.length < BAIT_LIMIT; i++) pond.bait.push({ minutes: range.from, at });
  }
}
