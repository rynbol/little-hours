export const TREE_FULL_MINUTES = 60;
export const GARDEN_TREES = 30;

export function studyTrees(history = []) {
  const days = new Map();
  for (const entry of history) days.set(entry.date, (days.get(entry.date) || 0) + entry.minutes);
  return [...days].sort(([a], [b]) => a < b ? -1 : 1).slice(-GARDEN_TREES)
    .map(([date, minutes]) => ({ date, minutes, growth: Math.min(1, minutes / TREE_FULL_MINUTES) }));
}
