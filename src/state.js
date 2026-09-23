import { createSession, remainingAt, startSession, pauseSession } from './session.js';
import { createLayout, normalizeLayout, PRESETS } from './layout.js';

export const storageKey = 'little-hours-v1';
const durations = [25, 50, 90];

export function freshState() {
  return { theme: 'dusk', pet: 'cat', seenAt: 0, task: '', decor: { plants: true, lights: true, rug: true }, layout: createLayout(), rooms: {}, session: createSession(), history: [] };
}

export function localDate(timestamp = Date.now()) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function restoreState(raw) {
  const initial = freshState();
  let saved;
  try { saved = JSON.parse(raw); } catch { return initial; }
  if (!saved || typeof saved !== 'object') return initial;
  if (['dusk', 'rain', 'day'].includes(saved.theme)) initial.theme = saved.theme;
  if (typeof saved.task === 'string') initial.task = saved.task.slice(0, 180);
  if (['cat', 'dog'].includes(saved.pet)) initial.pet = saved.pet;
  if (Number.isSafeInteger(saved.seenAt) && saved.seenAt > 0) initial.seenAt = saved.seenAt;
  for (const key of Object.keys(initial.decor)) {
    if (typeof saved.decor?.[key] === 'boolean') initial.decor[key] = saved.decor[key];
  }
  if (saved.layout !== undefined) initial.layout = normalizeLayout(saved.layout);
  for (const preset of PRESETS) {
    const room = saved.rooms?.[preset.id];
    if (room && room.presetId === preset.id) initial.rooms[preset.id] = normalizeLayout(room);
  }
  if (initial.layout.presetId) initial.rooms[initial.layout.presetId] = structuredClone(initial.layout);
  const session = saved.session;
  if (session && Number.isFinite(session.duration) && durations.includes(session.duration / 60_000)
    && Number.isFinite(session.remaining) && session.remaining >= 0
    && typeof session.running === 'boolean'
    && (!session.running || (Number.isSafeInteger(session.endsAt) && session.endsAt >= 0 && session.endsAt <= 8.64e15))) {
    // A clock moved backwards can leave more time than the duration; keep the
    // session and cap it rather than discarding the user's progress.
    initial.session = {
      duration: session.duration, remaining: Math.min(session.remaining, session.duration), running: session.running,
      endsAt: session.running ? session.endsAt : null,
    };
    if (!session.running && session.remaining === 0 && Number.isSafeInteger(session.completedAt) && session.completedAt >= 0) initial.session.completedAt = session.completedAt;
  }
  if (Array.isArray(saved.history)) {
    initial.history = saved.history.filter(entry => entry && typeof entry === 'object'
      && typeof entry.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.date) && durations.includes(entry.minutes))
      .slice(-365).map(({ date, minutes }) => ({ date, minutes }));
  }
  return initial;
}

function completeDueSession(state, now) {
  if (!state.session.running || remainingAt(state.session, now) > 0) return false;
  // A browser reopened tomorrow still credits the day this session ended.
  const { endsAt, duration } = state.session;
  state.session = { ...state.session, remaining: 0, running: false, endsAt: null, completedAt: endsAt };
  state.history.push({ date: localDate(endsAt), minutes: duration / 60_000 });
  state.history = state.history.slice(-365);
  return true;
}

export function createStateStore(storage, now = () => Date.now()) {
  let state = freshState();
  let lastPersisted = null;

  function readLatest() {
    try {
      const raw = storage.getItem(storageKey);
      // Preserve this visit's state if writes are blocked or storage is full.
      // A genuinely newer value from another tab still takes precedence.
      if (raw === lastPersisted) return state;
      lastPersisted = raw;
      return restoreState(raw);
    } catch { return state; }
  }
  state = readLatest();

  function update(mutate = () => {}) {
    const timestamp = now();
    const next = structuredClone(readLatest());
    const completed = completeDueSession(next, timestamp);
    next.rooms ||= {};
    if (next.layout.presetId) next.rooms[next.layout.presetId] = structuredClone(next.layout);
    mutate(next, { now: timestamp });
    if (next.layout.presetId) next.rooms[next.layout.presetId] = structuredClone(next.layout);
    state = next;
    let persisted = false;
    try {
      const raw = JSON.stringify(state);
      storage.setItem(storageKey, raw);
      lastPersisted = raw;
      persisted = true;
    } catch { /* The current visit remains usable without storage. */ }
    return { state, completed, persisted };
  }

  return {
    get state() { return state; },
    refresh() { state = readLatest(); return state; },
    update,
    useRoom(presetId, reset = false) {
      if (!PRESETS.some(preset => preset.id === presetId)) return update();
      return update(draft => { draft.layout = structuredClone(!reset && draft.rooms[presetId] || createLayout(presetId)); });
    },
    setRunning(running) {
      return update((draft, { now: timestamp }) => {
        draft.session = running ? startSession(draft.session, timestamp) : pauseSession(draft.session, timestamp);
      });
    },
  };
}
