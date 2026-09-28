export const FRIENDSHIP_MOMENTS = Object.freeze(Object.fromEntries(Object.entries({
  play: { label: 'Play together' },
  snack: { label: 'Share a treat' },
  quiet: { label: 'Curl up together' },
}).map(([kind, moment]) => [kind, Object.freeze(moment)])));

export const FRIENDSHIP_LEVELS = Object.freeze([
  { at: 0, title: 'New little friends' },
  { at: 6, title: 'Finding a rhythm' },
  { at: 20, title: 'Two peas in a pod' },
  { at: 50, title: 'Inseparable' },
].map(Object.freeze));

const MAX_COUNT = 1_000_000_000;
const count = value => Number.isSafeInteger(value) && value >= 0 ? Math.min(value, MAX_COUNT) : 0;
const timestamp = value => Number.isSafeInteger(value) && value >= 0 && value <= 8.64e15;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const emptyProgress = () => ({ affection: 0, minutes: 0, sessions: 0, rewardDay: '', rewardedMoments: [], memories: [] });
const entitySet = entities => entities instanceof Set ? entities : new Set(entities);
export const petEntity = id => `pet:${id}`;

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

export function pairMembers(a, b, allowedEntities) {
  const members = orderedPair(a, b), allowed = entitySet(allowedEntities);
  return members && members.every(id => allowed.has(id)) ? members : null;
}

function friendshipLevel(affection) {
  const points = count(affection), index = FRIENDSHIP_LEVELS.findLastIndex(level => points >= level.at);
  const level = FRIENDSHIP_LEVELS[index], next = FRIENDSHIP_LEVELS[index + 1];
  return { index, title: level.title, next, progress: next ? (points - level.at) / (next.at - level.at) : 1 };
}

function normalizeProgress(raw) {
  const progress = emptyProgress();
  for (const key of ['affection', 'minutes', 'sessions']) progress[key] = count(raw[key]);
  if (validDay(raw.rewardDay)) {
    progress.rewardDay = raw.rewardDay;
    progress.rewardedMoments = Object.keys(FRIENDSHIP_MOMENTS).filter(kind => Array.isArray(raw.rewardedMoments) && raw.rewardedMoments.includes(kind));
  }
  if (Array.isArray(raw.memories)) progress.memories = raw.memories
    .filter(memory => object(memory) && (Object.hasOwn(FRIENDSHIP_MOMENTS, memory.kind) || ['focus', 'level'].includes(memory.kind)) && timestamp(memory.at))
    .slice(-12).map(memory => ({ kind: memory.kind, at: memory.at, value: memory.kind === 'level' ? Math.min(count(memory.value), FRIENDSHIP_LEVELS.length - 1) : count(memory.value) }));
  return progress;
}

export function normalizeFriendships(raw, allowedEntities) {
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

export function friendshipBetween(friendships, a, b) {
  const members = orderedPair(a, b), progress = members && friendships.pairs[JSON.stringify(members)] || emptyProgress();
  return { ...progress, members, level: friendshipLevel(progress.affection) };
}

function remember(progress, kind, at, value) {
  progress.memories.push({ kind, at, value });
  progress.memories = progress.memories.slice(-12);
}

function reward(progress, members, amount, at) {
  const before = friendshipLevel(progress.affection).index;
  const earned = Math.min(amount, MAX_COUNT - progress.affection);
  progress.affection += earned;
  const level = friendshipLevel(progress.affection).index, unlocked = level > before;
  if (unlocked) remember(progress, 'level', at, level);
  return { ok: true, members, earned, unlocked, level };
}

export function shareFriendshipMoment(friendships, a, b, kind, day, at, allowedEntities) {
  const members = pairMembers(a, b, allowedEntities);
  if (!members || !Object.hasOwn(FRIENDSHIP_MOMENTS, kind) || !validDay(day) || !timestamp(at)) return { ok: false, members: null, earned: 0, unlocked: false, level: 0 };
  const key = JSON.stringify(members), progress = friendships.pairs[key] ||= emptyProgress();
  if (day > progress.rewardDay) { progress.rewardDay = day; progress.rewardedMoments = []; }
  const fresh = day === progress.rewardDay && !progress.rewardedMoments.includes(kind);
  if (fresh) { progress.rewardedMoments.push(kind); remember(progress, kind, at, 1); }
  return reward(progress, members, fresh ? 1 : 0, at);
}

export function recordFriendshipFocus(friendships, pair, minutes, at, allowedEntities) {
  if (!Array.isArray(pair) || pair.length !== 2 || !Number.isSafeInteger(minutes) || minutes < 5 || !timestamp(at)) return null;
  const members = pairMembers(pair[0], pair[1], allowedEntities);
  if (!members) return null;
  const key = JSON.stringify(members), progress = friendships.pairs[key] ||= emptyProgress();
  progress.minutes = Math.min(MAX_COUNT, progress.minutes + minutes);
  progress.sessions = Math.min(MAX_COUNT, progress.sessions + 1);
  remember(progress, 'focus', at, count(minutes));
  return reward(progress, members, Math.floor(minutes / 5), at);
}
