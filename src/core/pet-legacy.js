const MOMENTS = ['play', 'snack', 'quiet'];
const MAX_COUNT = 1_000_000_000;
const count = value => Number.isSafeInteger(value) && value >= 0 ? Math.min(value, MAX_COUNT) : 0;
const timestamp = value => Number.isSafeInteger(value) && value >= 0 && value <= 8.64e15;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const emptyProgress = () => ({ affection: 0, minutes: 0, sessions: 0, rewardDay: '', rewardedMoments: [], memories: [] });
const entitySet = entities => entities instanceof Set ? entities : new Set(entities);

function validDay(value) {
  const parts = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!parts) return false;
  const [, year, month, day] = parts.map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

function orderedPair(a, b) {
  return typeof a === 'string' && a.length && typeof b === 'string' && b.length && a !== b ? [a, b].sort() : null;
}

function pairMembers(a, b, allowedEntities) {
  const members = orderedPair(a, b), allowed = entitySet(allowedEntities);
  return members && members.every(id => allowed.has(id)) ? members : null;
}

function normalizeProgress(raw) {
  const progress = emptyProgress();
  for (const key of ['affection', 'minutes', 'sessions']) progress[key] = count(raw[key]);
  if (validDay(raw.rewardDay)) {
    progress.rewardDay = raw.rewardDay;
    progress.rewardedMoments = MOMENTS.filter(kind => Array.isArray(raw.rewardedMoments) && raw.rewardedMoments.includes(kind));
  }
  if (Array.isArray(raw.memories)) progress.memories = raw.memories
    .filter(memory => object(memory) && (MOMENTS.includes(memory.kind) || ['focus', 'level'].includes(memory.kind)) && timestamp(memory.at))
    .slice(-12).map(memory => ({ kind: memory.kind, at: memory.at, value: memory.kind === 'level' ? Math.min(count(memory.value), 3) : count(memory.value) }));
  return progress;
}

export function archivePetFriendships(raw, allowedEntities) {
  const allowed = entitySet(allowedEntities), pairs = {};
  if (object(raw?.pairs)) for (const sourceKey of Object.keys(raw.pairs).sort()) {
    let source;
    try { source = JSON.parse(sourceKey); } catch { continue; }
    if (!Array.isArray(source) || source.length !== 2 || !object(raw.pairs[sourceKey])) continue;
    const members = pairMembers(source[0], source[1], allowed);
    if (!members) continue;
    const key = JSON.stringify(members);
    if (Object.hasOwn(pairs, key) && sourceKey !== key) continue;
    pairs[key] = normalizeProgress(raw.pairs[sourceKey]);
  }
  const focusBuddies = Object.fromEntries(Object.entries(object(raw?.focusBuddies) ? raw.focusBuddies : {})
    .filter(([owner, buddy]) => pairMembers(owner, buddy, allowed)));
  return { pairs, focusBuddies };
}
