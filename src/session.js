export function createSession(minutes = 25) {
  return { duration: minutes * 60_000, remaining: minutes * 60_000, endsAt: null, running: false };
}

// Capped at the duration, so a clock moved backwards cannot add time.
export function remainingAt(session, now = Date.now()) {
  return Math.min(session.duration, Math.max(0, session.running ? session.endsAt - now : session.remaining));
}

// A finished session reads as a short break, then as a fresh session, so
// yesterday's 00:00 and "On a break" never linger.
export const BREAK_AFTER_FINISH = 15 * 60_000;
export function sessionPhase(session, now = Date.now()) {
  if (session.running) return 'focusing';
  const remaining = remainingAt(session, now);
  if (remaining > 0) return remaining < session.duration ? 'break' : 'idle';
  return Number.isFinite(session.completedAt) && now - session.completedAt < BREAK_AFTER_FINISH ? 'break' : 'idle';
}
// What the timer shows: a finished session past its break reads as fresh.
export function displayedRemaining(session, now = Date.now()) {
  const remaining = remainingAt(session, now);
  return !session.running && remaining === 0 && sessionPhase(session, now) === 'idle' ? session.duration : remaining;
}

export function startSession(session, now = Date.now()) {
  if (session.running) return session;
  const remaining = session.remaining > 0 ? session.remaining : session.duration;
  return { duration: session.duration, remaining, endsAt: now + remaining, running: true };
}

export function pauseSession(session, now = Date.now()) {
  return { ...session, remaining: remainingAt(session, now), endsAt: null, running: false };
}

export function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
