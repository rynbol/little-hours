import './place-transition.css';

let active = null, changing = false;

export function travelTo(place, arrive, ready = () => true) {
  if (changing) return arrive();
  active?.cancel();
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (document.hidden || motion.matches) return arrive();
  const veil = document.createElement('div');
  veil.className = 'place-transition'; veil.dataset.place = place; veil.setAttribute('aria-hidden', 'true');
  document.body.appendChild(veil); document.documentElement.dataset.placeTransition = place;
  const listeners = new AbortController();
  const trip = { animation: null, frame: 0, wake: null, arrived: false, finished: false, cancel: finish };
  active = trip;
  function enter() {
    if (trip.arrived) return;
    trip.arrived = true; changing = true;
    try { arrive(); } finally { changing = false; }
  }
  function finish() {
    if (trip.finished) return;
    trip.finished = true; listeners.abort();
    trip.animation?.cancel(); cancelAnimationFrame(trip.frame); trip.wake?.();
    veil.remove();
    if (active === trip) { active = null; delete document.documentElement.dataset.placeTransition; }
  }
  function skip() { if (document.hidden || motion.matches) { try { enter(); } finally { finish(); } } }
  const frame = () => new Promise(resolve => { trip.wake = resolve; trip.frame = requestAnimationFrame(() => { trip.frame = 0; trip.wake = null; resolve(); }); });
  const fade = (from, to, duration) => {
    trip.animation = veil.animate([{ opacity: from }, { opacity: to }], { duration, easing: 'ease-in-out', fill: 'forwards' });
    return trip.animation.finished;
  };
  const blockNavigation = event => {
    if (!event.metaKey && !event.ctrlKey && !event.altKey && ['Tab', 'Enter', ' ', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) { event.preventDefault(); event.stopImmediatePropagation(); }
  };
  for (const type of ['keydown', 'keyup']) window.addEventListener(type, blockNavigation, { capture: true, signal: listeners.signal });
  document.addEventListener('visibilitychange', skip, { signal: listeners.signal }); motion.addEventListener('change', skip, { signal: listeners.signal });
  async function run() {
    try {
      await fade(0, 1, 160);
      if (active !== trip) return;
      enter();
      const deadline = performance.now() + 6000;
      do { await frame(); } while (active === trip && !ready() && performance.now() < deadline);
      if (active !== trip) return;
      await frame();
      if (active !== trip) return;
      await fade(1, 0, 280);
    } catch (error) { if (error.name !== 'AbortError') console.error('Could not change places:', error); }
    finally { finish(); }
  }
  return run();
}
