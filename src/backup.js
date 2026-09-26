// A home you can keep: a versioned JSON copy of this browser's save, and a
// careful way to bring one back.
import { restoreState } from './state.js';
import { remainingAt } from './session.js';

export const BACKUP_FORMAT = 1;
export const MAX_BACKUP_BYTES = 2_000_000;

export function createBackup(state, now = Date.now()) {
  return JSON.stringify({ app: 'little-hours', format: BACKUP_FORMAT, exportedAt: new Date(now).toISOString(), save: state }, null, 2);
}

export function backupFilename(now = Date.now()) {
  const date = new Date(now);
  return `little-hours-home-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}.json`;
}

export function readBackup(text) {
  if (typeof text !== 'string' || text.length > MAX_BACKUP_BYTES) return { ok: false, reason: 'That file is too large to be a Little Hours home.' };
  let data;
  try { data = JSON.parse(text); } catch { return { ok: false, reason: 'That file isn’t a Little Hours home we can read.' }; }
  if (!data || data.app !== 'little-hours' || !Number.isSafeInteger(data.format)) return { ok: false, reason: 'That file isn’t a Little Hours home we can read.' };
  if (data.format > BACKUP_FORMAT) return { ok: false, reason: 'This home was saved by a newer Little Hours. Update the app, then try again.' };
  const save = data.save;
  if (!save || typeof save !== 'object' || !save.house || !Array.isArray(save.house.rooms)) return { ok: false, reason: 'That file is missing its house, so nothing was changed.' };
  const state = restoreState(JSON.stringify(save));
  const exportedAt = Date.parse(data.exportedAt);
  // A session that was running when the copy was made comes back paused at
  // that moment, so restoring an old copy cannot complete it a second time.
  if (state.session.running) {
    const remaining = Number.isFinite(exportedAt) ? remainingAt(state.session, exportedAt) : state.session.remaining;
    state.session = { duration: state.session.duration, remaining: remaining > 0 ? remaining : state.session.duration, endsAt: null, running: false };
  }
  return {
    ok: true,
    state,
    summary: {
      exportedAt: Number.isFinite(exportedAt) ? exportedAt : null,
      houseName: state.house.name,
      rooms: state.house.rooms.length,
      pieces: state.house.rooms.reduce((sum, room) => sum + room.layout.items.length, 0),
      coins: state.house.coins,
      sessions: state.history.length,
    },
  };
}
