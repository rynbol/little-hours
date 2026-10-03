export const CAMPFIRES = Object.freeze(['camp', 'bridge', 'shoulder']);
export const STAG_REWARD = Object.freeze({ xp: 240, rematchXp: 60, heartwood: 3, rematchHeartwood: 1, trophy: 'mossheart-antler', companion: 'wolf' });

const count = value => Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 1_000_000_000) : 0;
const known = allowed => value => Array.isArray(value) ? allowed.filter(id => value.includes(id)) : [];
const DISCOVERIES = Object.freeze(['vista', 'oak', 'shrine', 'falls', 'hollow', 'bridge', 'ring', 'beach', 'meadow']);

export function normalizeWilds(raw) {
  const fires = known(CAMPFIRES)(raw?.lit);
  return {
    version: 2,
    xp: count(raw?.xp),
    heartwood: count(raw?.heartwood),
    victories: count(raw?.victories),
    trophies: known([STAG_REWARD.trophy])(raw?.trophies),
    companions: known([STAG_REWARD.companion])(raw?.companions),
    lit: fires.includes('camp') ? fires : ['camp', ...fires],
    campfire: CAMPFIRES.includes(raw?.campfire) && fires.includes(raw.campfire) ? raw.campfire : 'camp',
    found: known(DISCOVERIES)(raw?.found),
  };
}

export function wildsLevel(xp) {
  let level = 1, into = count(xp);
  while (level < 20 && into >= 80 + 40 * level) { into -= 80 + 40 * level; level++; }
  return { level, into, next: level === 20 ? null : 80 + 40 * level };
}

export function restAtFire(wilds, id) {
  if (!CAMPFIRES.includes(id)) return wilds;
  return { ...wilds, campfire: id, lit: CAMPFIRES.filter(fire => fire === id || wilds.lit.includes(fire)) };
}

export function discover(wilds, id) {
  if (!DISCOVERIES.includes(id) || wilds.found.includes(id)) return wilds;
  return { ...wilds, found: DISCOVERIES.filter(place => place === id || wilds.found.includes(place)) };
}

export function stagVictory(wilds) {
  const first = wilds.victories === 0;
  return {
    ...wilds,
    xp: wilds.xp + (first ? STAG_REWARD.xp : STAG_REWARD.rematchXp),
    heartwood: wilds.heartwood + (first ? STAG_REWARD.heartwood : STAG_REWARD.rematchHeartwood),
    victories: wilds.victories + 1,
    trophies: [STAG_REWARD.trophy],
    companions: [STAG_REWARD.companion],
  };
}
