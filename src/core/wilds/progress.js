export const LEVELS = Object.freeze([0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700]);
export const GROWTH = Object.freeze({ health: 12, stamina: 8, attack: 0.08 });
export const BOSSES = Object.freeze({
  stag: Object.freeze({ xp: 240, again: 40, heartwood: 3, trophy: 'stag-antler', companion: 'wolf' }),
});
export const CAMPFIRES = Object.freeze(['camp', 'stones']);
const TROPHIES = Object.freeze(Object.values(BOSSES).map(boss => boss.trophy));
const COMPANIONS = Object.freeze(Object.values(BOSSES).map(boss => boss.companion));

export const emptyWilds = () => ({ xp: 0, heartwood: 0, trophies: [], companions: [], lit: [], beaten: [] });

const known = (value, allowed) => Array.isArray(value) ? [...new Set(value.filter(entry => allowed.includes(entry)))] : [];
const count = (value, most) => Number.isSafeInteger(value) && value >= 0 ? Math.min(value, most) : 0;

export function normalizeWilds(raw) {
  const wilds = emptyWilds();
  if (!raw || typeof raw !== 'object') return wilds;
  wilds.xp = count(raw.xp, 1_000_000);
  wilds.heartwood = count(raw.heartwood, 10_000);
  wilds.trophies = known(raw.trophies, TROPHIES);
  wilds.companions = known(raw.companions, COMPANIONS);
  wilds.lit = known(raw.lit, CAMPFIRES);
  wilds.beaten = known(raw.beaten, Object.keys(BOSSES));
  return wilds;
}

export function levelFor(xp) {
  let level = 1;
  while (level < LEVELS.length && xp >= LEVELS[level]) level++;
  const floor = LEVELS[level - 1], next = LEVELS[level] ?? null;
  return { level, into: xp - floor, span: next === null ? 0 : next - floor, next };
}

export function wildsStats(wilds) {
  const grown = levelFor(wilds.xp).level - 1;
  return { health: 100 + GROWTH.health * grown, stamina: 100 + GROWTH.stamina * grown, attack: Math.round((1 + GROWTH.attack * grown) * 100) / 100 };
}

export function kindleFire(wilds, id) {
  if (!CAMPFIRES.includes(id) || wilds.lit.includes(id)) return false;
  wilds.lit.push(id);
  return true;
}

export function recordVictory(wilds, id) {
  const boss = BOSSES[id], first = !wilds.beaten.includes(id), before = levelFor(wilds.xp).level;
  const award = { boss: id, first, xp: first ? boss.xp : boss.again, heartwood: first ? boss.heartwood : 0, trophy: first ? boss.trophy : null, companion: first ? boss.companion : null };
  wilds.xp += award.xp; wilds.heartwood += award.heartwood;
  if (first) { wilds.beaten.push(id); wilds.trophies.push(boss.trophy); wilds.companions.push(boss.companion); }
  return { ...award, level: levelFor(wilds.xp).level, levelsGained: levelFor(wilds.xp).level - before };
}
