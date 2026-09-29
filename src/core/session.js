import { clockNow, clockRandom } from './test-pins.js';
export const DIAL_MINUTES = [...Array.from({ length: 10 }, (_, i) => i + 1), ...Array.from({ length: 22 }, (_, i) => 15 + i * 5)];
export const isDuration = minutes => DIAL_MINUTES.includes(minutes);
export function createSession(minutes = 25, kind = 'focus') {
  return { kind, phase: 'ready', id: null, duration: minutes * 60_000, remaining: minutes * 60_000, endsAt: null, running: false };
}
export const isFocusing = session => session.kind !== 'break' && session.running;
export const sessionStarted = session => session.kind !== 'break' && (session.running || (session.remaining > 0 && (Boolean(session.id) || Boolean(session.petId) || session.remaining < session.duration)));
export const sessionLifecycle = session => session.running ? 'running' : session.remaining === 0 ? 'completed' : session.id || session.petId || session.remaining < session.duration ? 'paused' : 'ready';
const sessionId = now => `${now.toString(36)}-${clockRandom().toString(36).slice(2)}-${clockRandom().toString(36).slice(2)}`;

// Capped at the duration, so a clock moved backwards cannot add time.
export function remainingAt(session, now = clockNow()) {
  return Math.min(session.duration, Math.max(0, session.running ? session.endsAt - now : session.remaining));
}

export function sessionPhase(session) {
  if (isFocusing(session)) return 'focusing';
  if (session.kind === 'break' && sessionLifecycle(session) !== 'completed') return 'break';
  return sessionLifecycle(session) === 'paused' ? 'break' : 'idle';
}
export function displayedRemaining(session, now = clockNow()) {
  return remainingAt(session, now);
}

export function startSession(session, now = clockNow()) {
  if (session.running) return session;
  const base = session.remaining === 0 ? createSession(session.duration / 60_000, session.kind) : session;
  return { ...base, id: base.id || sessionId(now), phase: 'running', startedAt: base.startedAt ?? now, remaining: base.remaining, endsAt: now + base.remaining, running: true };
}

export function pauseSession(session, now = clockNow()) {
  if (!session.running) return session;
  const remaining = remainingAt(session, now);
  return { ...session, phase: remaining > 0 ? 'paused' : 'completed', remaining, endsAt: null, running: false };
}

export function normalizeSession(saved) {
  const kind = saved?.kind === 'break' ? 'break' : 'focus';
  if (!saved || typeof saved.duration !== 'number' || !isDuration(saved.duration / 60_000) || !Number.isFinite(saved.remaining) || saved.remaining < 0
    || typeof saved.running !== 'boolean' || (saved.running && (!Number.isSafeInteger(saved.endsAt) || saved.endsAt < 0 || saved.endsAt > 8.64e15))) return createSession();
  const session = { ...createSession(saved.duration / 60_000, kind), remaining: Math.min(saved.remaining, saved.duration), running: saved.running, endsAt: saved.running ? saved.endsAt : null };
  if (typeof saved.id === 'string' && saved.id.length <= 160) session.id = saved.id || null;
  if (typeof saved.petId === 'string') session.petId = saved.petId;
  session.phase = sessionLifecycle(session);
  if (!session.id && session.phase !== 'ready') session.id = `legacy-${kind}-${saved.duration}-${saved.endsAt ?? saved.completedAt ?? saved.remaining}`;
  for (const field of ['startedAt', 'completedAt']) if (Number.isSafeInteger(saved[field]) && saved[field] >= 0 && saved[field] <= 8.64e15) session[field] = saved[field];
  if (typeof saved.taskSnapshot === 'string') session.taskSnapshot = saved.taskSnapshot.slice(0, 180);
  if (typeof saved.timeZone === 'string') {
    try { new Intl.DateTimeFormat('en', { timeZone: saved.timeZone }); session.timeZone = saved.timeZone; } catch {}
  }
  if (kind === 'break') session.focusMinutes = isDuration(saved.focusMinutes) ? saved.focusMinutes : 25;
  return session;
}

export function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

// The timer's accessible name, read as words rather than "24:59".
export function spokenTime(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60), rest = seconds % 60;
  const parts = [];
  if (minutes) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  if (rest || !minutes) parts.push(`${rest} ${rest === 1 ? 'second' : 'seconds'}`);
  return parts.join(', ');
}
