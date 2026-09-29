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
  const trip = { animation: null, frame: 0, wake: null, arrived: false, cancel: finish };
  active = trip;
  function enter() {
    if (trip.arrived) return;
    trip.arrived = true; changing = true;
    try { arrive(); } finally { changing = false; }
  }
  function finish() {
    trip.animation?.cancel(); cancelAnimationFrame(trip.frame); trip.wake?.();
    veil.remove(); document.removeEventListener('visibilitychange', skip); motion.removeEventListener('change', skip);
    if (active === trip) { active = null; delete document.documentElement.dataset.placeTransition; }
  }
  function skip() { if (document.hidden || motion.matches) { try { enter(); } finally { finish(); } } }
  const frame = () => new Promise(resolve => { trip.wake = resolve; trip.frame = requestAnimationFrame(() => { trip.frame = 0; trip.wake = null; resolve(); }); });
  const fade = (from, to, duration) => {
    trip.animation = veil.animate([{ opacity: from }, { opacity: to }], { duration, easing: 'ease-in-out', fill: 'forwards' });
    return trip.animation.finished;
  };
  document.addEventListener('visibilitychange', skip); motion.addEventListener('change', skip);
  async function run() {
    try {
      await fade(0, 1, 180);
      if (active !== trip) return;
      enter();
      const deadline = performance.now() + 6000;
      do { await frame(); } while (active === trip && !ready() && performance.now() < deadline);
      if (active !== trip) return;
      await frame();
      if (active !== trip) return;
      await fade(1, 0, 420);
    } catch (error) { if (error.name !== 'AbortError') console.error('Could not change places:', error); }
    finally { finish(); }
  }
  run();
}
