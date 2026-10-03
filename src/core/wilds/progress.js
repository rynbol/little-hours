import { GEAR, POTION, SLOTS, takeGear, wornTraits } from './gear.js';

export const LEVELS = Object.freeze([0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700]);
export const GROWTH = Object.freeze({ health: 12, stamina: 8, attack: 0.08 });
export const BOSSES = Object.freeze({
  stag: Object.freeze({ xp: 240, again: 40, heartwood: 3, trophy: 'stag-antler', companion: 'wolf' }),
});
export const SECRETS = Object.freeze({
  'root-sword': Object.freeze({ xp: 40, gear: 'rootwood-sword' }),
  'stamina-seed': Object.freeze({ xp: 50, stamina: 12 }),
  'heart-seed': Object.freeze({ xp: 50, health: 15 }),
  'glide-chest': Object.freeze({ xp: 50, gear: 'windleaf-cape' }),
  'buried-find': Object.freeze({ xp: 40, find: 'brass-key' }),
  'lake-pearl': Object.freeze({ xp: 40, gear: 'lake-pearl' }),
  'kestrel-feather': Object.freeze({ xp: 40, gear: 'kestrel-feather' }),
  'spyglass': Object.freeze({ xp: 50, trophy: 'spyglass' }),
});
export const CAMPFIRES = Object.freeze(['camp', 'shrine', 'stones']);
const TROPHIES = Object.freeze([...Object.values(BOSSES).map(boss => boss.trophy), ...Object.values(SECRETS).flatMap(secret => secret.trophy ?? [])]);
const COMPANIONS = Object.freeze(Object.values(BOSSES).map(boss => boss.companion));

export const emptyWilds = () => ({ xp: 0, heartwood: 0, trophies: [], companions: [], lit: [], beaten: [], secrets: [], owned: [], wear: { sword: null, cape: null, armour: null }, potions: 0 });

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
  wilds.secrets = known(raw.secrets, Object.keys(SECRETS));
  wilds.owned = known(raw.owned, Object.keys(GEAR));
  for (const slot of SLOTS) { const id = raw.wear?.[slot]; wilds.wear[slot] = wilds.owned.includes(id) && GEAR[id].slot === slot ? id : null; }
  wilds.potions = count(raw.potions, POTION.carry);
  return wilds;
}

export function levelFor(xp) {
  let level = 1;
  while (level < LEVELS.length && xp >= LEVELS[level]) level++;
  const floor = LEVELS[level - 1], next = LEVELS[level] ?? null;
  return { level, into: xp - floor, span: next === null ? 0 : next - floor, next };
}

export function wildsStats(wilds) {
  const level = levelFor(wilds.xp).level, grown = level - 1, found = id => wilds.secrets.includes(id);
  const seeds = Object.entries(SECRETS).filter(([id]) => found(id));
  const health = 100 + GROWTH.health * grown + seeds.reduce((sum, [, secret]) => sum + (secret.health ?? 0), 0);
  const stamina = 100 + GROWTH.stamina * grown + seeds.reduce((sum, [, secret]) => sum + (secret.stamina ?? 0), 0);
  const attack = Math.round((1 + GROWTH.attack * grown) * 100) / 100, traits = wornTraits(wilds);
  traits.power = Math.round(attack * traits.power * 1000) / 1000;
  return { level, health, stamina, attack, traits };
}

export function claimSecret(wilds, id) {
  const secret = SECRETS[id];
  if (!secret || wilds.secrets.includes(id)) return null;
  const before = levelFor(wilds.xp).level;
  wilds.secrets.push(id);
  wilds.xp += secret.xp;
  if (secret.gear) takeGear(wilds, secret.gear);
  if (secret.trophy) wilds.trophies.push(secret.trophy);
  const level = levelFor(wilds.xp).level;
  return { id, ...secret, level, levelsGained: level - before };
}

export function keepPipFind(buddy, id, at) {
  const before = buddy.finds[id];
  buddy.finds[id] = { count: (before?.count ?? 0) + 1, first: before?.first ?? at };
  return !before;
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
