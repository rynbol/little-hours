import './forest.css';
import { travelTo } from '../../ui/place-transition.js';
import { FOREST_INPUT, createForestInput } from './forest-input.js';
import { createForestScene } from './forest-scene.js';

const BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6 8.5 12l6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function createForestUI(app) {
  let disposed = false, root = null, scene = null, building = 0, returnFocus = null, theme = null, look = null, thumb = null;
  const input = createForestInput();
  const $ = selector => root.querySelector(selector);
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function build() {
    root = document.createElement('section'); root.className = 'forest'; root.id = 'forest-page'; root.hidden = true; root.setAttribute('aria-label', 'The forest');
    root.innerHTML = `<div class="forest-stage"></div><div class="forest-vignette" aria-hidden="true"></div>
      <header class="forest-top"><button class="forest-chip" id="forest-back" type="button" aria-label="Back to the island">${BACK}<span>Island</span></button><div class="forest-title"><h1>The Forest</h1></div></header>
      <p class="forest-status" id="forest-status" role="status">Finding the path…</p>
      <p class="forest-hint" id="forest-hint"><span class="forest-hint-keys">Walk with <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or the arrow keys. Drag to look around.</span><span class="forest-hint-touch">Push the stick to walk. Drag to look around.</span></p>
      <div class="forest-stick" id="forest-stick" aria-hidden="true"><i></i></div>`;
    document.body.appendChild(root);
    $('#forest-back').addEventListener('click', close);
    const stage = $('.forest-stage'), stick = $('#forest-stick');
    stage.addEventListener('pointerdown', event => { if (look !== null) return; look = event.pointerId; stage.setPointerCapture(look); root.classList.add('is-looking'); });
    stage.addEventListener('pointermove', event => { if (event.pointerId !== look) return; input.drag(event.movementX, event.movementY); });
    const endLook = event => { if (event.pointerId !== look) return; look = null; root.classList.remove('is-looking'); };
    stage.addEventListener('pointerup', endLook); stage.addEventListener('pointercancel', endLook);
    const push = event => {
      const box = stick.getBoundingClientRect(), x = (event.clientX - box.left - box.width / 2) / FOREST_INPUT.stick, y = (event.clientY - box.top - box.height / 2) / FOREST_INPUT.stick, length = Math.max(1, Math.hypot(x, y));
      input.stick(x / length, y / length);
      stick.firstElementChild.style.transform = `translate(${x / length * FOREST_INPUT.stick}px, ${y / length * FOREST_INPUT.stick}px)`;
    };
    stick.addEventListener('pointerdown', event => { if (thumb !== null) return; thumb = event.pointerId; stick.setPointerCapture(thumb); push(event); walked(); });
    stick.addEventListener('pointermove', event => { if (event.pointerId === thumb) push(event); });
    const endPush = event => { if (event.pointerId !== thumb) return; thumb = null; input.stick(0, 0); stick.firstElementChild.style.transform = ''; };
    stick.addEventListener('pointerup', endPush); stick.addEventListener('pointercancel', endPush);
  }
  function walked() { $('#forest-hint').classList.add('is-read'); }
  function onKey(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'Escape') { event.stopImmediatePropagation(); event.preventDefault(); if (event.type === 'keydown') close(); return; }
    if (!input.handles(event.code)) return;
    event.stopImmediatePropagation(); event.preventDefault();
    input.key(event.code, event.type === 'keydown');
    if (event.type === 'keydown') walked();
  }
  const letGo = () => input.release();

  function open() {
    if (disposed || (root && !root.hidden)) return;
    travelTo('forest', openForest, () => Boolean(scene?.ready));
  }
  function openForest() {
    if (disposed) return;
    if (!root) build();
    if (!root.hidden) return;
    returnFocus = document.activeElement;
    theme = app.state.theme; root.dataset.theme = theme;
    root.hidden = false; document.body.classList.add('is-forest'); document.getElementById('app').inert = true;
    $('#forest-hint').classList.remove('is-read'); $('#forest-status').hidden = false;
    building = requestAnimationFrame(() => { building = setTimeout(() => {
      building = 0;
      if (root.hidden) return;
      scene = createForestScene($('.forest-stage'), { theme, reducedMotion: reduced(), input, onReady: () => { if (root) $('#forest-status').hidden = true; } });
    }); });
    document.addEventListener('keydown', onKey, true); document.addEventListener('keyup', onKey, true); window.addEventListener('blur', letGo);
    $('#forest-back').focus({ preventScroll: true });
  }
  function close() {
    if (!root || root.hidden) return;
    travelTo(document.body.classList.contains('is-house') ? 'island' : 'home', closeForest);
  }
  function closeForest() {
    if (!root || root.hidden) return;
    cancelAnimationFrame(building); clearTimeout(building); building = 0;
    document.removeEventListener('keydown', onKey, true); document.removeEventListener('keyup', onKey, true); window.removeEventListener('blur', letGo);
    input.release(); look = null; thumb = null;
    scene?.dispose(); scene = null;
    root.hidden = true; document.body.classList.remove('is-forest'); document.getElementById('app').inert = false;
    returnFocus?.focus?.({ preventScroll: true });
  }
  return {
    open, close,
    get isOpen() { return Boolean(root && !root.hidden); },
    render() { if (scene && app.state.theme !== theme) { theme = app.state.theme; root.dataset.theme = theme; scene.setTheme(theme); } },
    diagnostics: () => scene ? scene.diagnostics() : null,
    dispose() { disposed = true; closeForest(); root?.remove(); root = null; },
  };
}
