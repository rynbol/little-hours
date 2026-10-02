import './place-transition.css';
import { clockRandom } from '../core/test-pins.js';
import { cloudFrame, planTrip } from './cloud-trip.js';
import { createCloudPainter } from './cloud-veil.js';

let active = null, changing = false, here = 'home', painter;
const SMOOTH_FRAME_MS = 34, SETTLE_LIMIT_MS = 700, READY_LIMIT_MS = 6000;

function cloudPainter() {
  if (painter === undefined) { try { painter = createCloudPainter(); painter?.warm(planTrip({ from: 'home', to: 'island', theme: document.body.dataset.theme, seed: 0 })); } catch { painter = null; } }
  return painter?.usable ? painter : null;
}
if (typeof requestIdleCallback === 'function') requestIdleCallback(cloudPainter, { timeout: 5000 });

export function travelTo(place, arrive, ready = () => true) {
  if (changing) { here = place; return arrive(); }
  active?.cancel();
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (document.hidden) { here = place; return arrive(); }
  const plan = planTrip({ from: here, to: place, theme: document.body.dataset.theme, still: motion.matches, seed: clockRandom() });
  const clouds = plan.kind === 'clouds' ? cloudPainter() : null;
  const veil = document.createElement('div');
  veil.className = 'place-transition'; veil.dataset.place = place; veil.dataset.style = clouds ? 'clouds' : 'fade'; veil.dataset.phase = 'closing';
  veil.setAttribute('aria-hidden', 'true');
  veil.style.setProperty('--veil-sky', plan.sky.sky); veil.style.setProperty('--veil-lit', plan.sky.lit); veil.style.setProperty('--veil-shade', plan.sky.shade);
  if (clouds) { veil.append(clouds.canvas); clouds.paint(plan, cloudFrame(plan, 'closing', 0)); }
  document.body.appendChild(veil); document.documentElement.dataset.placeTransition = place;
  const listeners = new AbortController(), keys = new AbortController();
  const trip = { animation: null, frame: 0, wake: null, arrived: false, finished: false, cancel: finish };
  active = trip;
  function enter() {
    if (trip.arrived) return;
    trip.arrived = true; changing = true; here = place;
    try { arrive(); } finally { changing = false; }
  }
  function finish() {
    if (trip.finished) return;
    trip.finished = true; listeners.abort(); keys.abort();
    trip.animation?.cancel(); cancelAnimationFrame(trip.frame); trip.wake?.();
    if (clouds) clouds.paint(plan, cloudFrame(plan, 'parting', 1));
    veil.remove();
    if (active === trip) { active = null; delete document.documentElement.dataset.placeTransition; }
  }
  function skip() { if (document.hidden || motion.matches) { try { enter(); } finally { finish(); } } }
  const frame = () => new Promise(resolve => { trip.wake = resolve; trip.frame = requestAnimationFrame(now => { trip.frame = 0; trip.wake = null; resolve(now); }); });
  const play = (phase, keyframes, duration) => {
    veil.dataset.phase = phase;
    const animation = trip.animation = veil.animate(keyframes, { duration, easing: 'linear', fill: 'forwards' });
    if (clouds) {
      const draw = () => {
        if (trip.animation !== animation || trip.finished) return;
        clouds.paint(plan, cloudFrame(plan, phase, (animation.currentTime ?? 0) / duration));
        if (animation.playState !== 'finished') trip.frame = requestAnimationFrame(draw);
      };
      trip.frame = requestAnimationFrame(draw);
    }
    return animation.finished;
  };
  const blockNavigation = event => {
    if (!event.metaKey && !event.ctrlKey && !event.altKey && ['Tab', 'Enter', ' ', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) { event.preventDefault(); event.stopImmediatePropagation(); }
  };
  for (const type of ['keydown', 'keyup']) window.addEventListener(type, blockNavigation, { capture: true, signal: keys.signal });
  document.addEventListener('visibilitychange', skip, { signal: listeners.signal }); motion.addEventListener('change', skip, { signal: listeners.signal });
  async function settle() {
    const deadline = performance.now() + READY_LIMIT_MS;
    do { await frame(); } while (active === trip && !ready() && performance.now() < deadline);
    let last = await frame(), calm = 0;
    const limit = performance.now() + SETTLE_LIMIT_MS;
    while (active === trip && calm < 2 && last < limit) { const now = await frame(); calm = now - last < SMOOTH_FRAME_MS ? calm + 1 : 0; last = now; }
  }
  async function run() {
    try {
      await play('closing', [{ opacity: 0 }, { opacity: 1, offset: clouds ? .3 : 1 }, { opacity: 1 }], plan.close);
      if (active !== trip) return;
      veil.dataset.phase = 'closed';
      if (clouds) clouds.paint(plan, cloudFrame(plan, 'closed', 0));
      enter();
      await settle();
      if (active !== trip) return;
      keys.abort(); veil.style.pointerEvents = 'none';
      await play('parting', [{ opacity: 1 }, { opacity: 1, offset: clouds ? .82 : 0 }, { opacity: 0 }], plan.part);
    } catch (error) { if (error.name !== 'AbortError') console.error('Could not change places:', error); }
    finally { finish(); }
  }
  return run();
}
