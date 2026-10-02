const count = value => Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 1_000_000_000) : 0;
const identifier = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(value);
const identifiers = value => Array.isArray(value) ? [...new Set(value.filter(identifier))].slice(0, 256) : [];
const counts = value => Object.fromEntries(value && typeof value === 'object' && !Array.isArray(value)
  ? Object.entries(value).filter(([key, amount]) => identifier(key) && count(amount) > 0).slice(0, 256).map(([key, amount]) => [key, count(amount)]) : []);

export function normalizeWilds(raw) {
  return {
    version: 1,
    totalXp: count(raw?.totalXp),
    discoveries: identifiers(raw?.discoveries),
    materials: counts(raw?.materials),
    bossVictories: counts(raw?.bossVictories),
    trophies: identifiers(raw?.trophies),
  };
}

export function wildsStats(totalXp = 0) {
  totalXp = count(totalXp);
  let level = 1, levelXp = totalXp;
  while (level < 20 && levelXp >= 100 + 40 * (level - 1)) {
    levelXp -= 100 + 40 * (level - 1);
    level++;
  }
  return {
    level,
    maxHealth: 100 + 12 * (level - 1),
    maxStamina: 100 + 4 * (level - 1),
    attack: 10 + 2 * (level - 1),
    levelXp: level === 20 ? 0 : levelXp,
    nextLevelXp: level === 20 ? null : 100 + 40 * (level - 1),
    totalXp,
  };
}
