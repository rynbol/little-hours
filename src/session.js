export function createSession(minutes = 25) {
  return { duration: minutes * 60_000, remaining: minutes * 60_000, endsAt: null, running: false };
}

export function remainingAt(session, now = Date.now()) {
  return Math.max(0, session.running ? session.endsAt - now : session.remaining);
}

export function startSession(session, now = Date.now()) {
  if (session.running) return session;
  const remaining = session.remaining > 0 ? session.remaining : session.duration;
  return { ...session, remaining, endsAt: now + remaining, running: true };
}

export function pauseSession(session, now = Date.now()) {
  return { ...session, remaining: remainingAt(session, now), endsAt: null, running: false };
}

export function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
