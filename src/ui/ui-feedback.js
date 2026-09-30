import './ui-motion.css';

// One motion vocabulary for the app, including controls rebuilt by render().
// Short, cancellable effects; no timer loop, layout animation, or avatar changes.
const BEAT = [{ scale: '1' }, { scale: '1.3', offset: .3 }, { scale: '.94', offset: .55 }, { scale: '1.12', offset: .75 }, { scale: '1' }];
const SPIN = [{ rotate: '0deg' }, { rotate: '360deg' }];
const HOP = [{ translate: '0 0' }, { translate: '0 -6px', offset: .35 }, { translate: '0 0', offset: .65 }, { translate: '0 -2px', offset: .82 }, { translate: '0 0' }];
const WIGGLE = [{ rotate: '0deg' }, { rotate: '-12deg', offset: .25 }, { rotate: '10deg', offset: .55 }, { rotate: '-4deg', offset: .8 }, { rotate: '0deg' }];
const SQUISH = [{ scale: '1' }, { scale: '.9', offset: .25 }, { scale: '1.06', offset: .6 }, { scale: '1' }];
const TILES = '[data-pet-fabric], [data-pet-ribbon], [data-pet-gift], [data-pet-meal], [data-pet-choice], [data-color]';
const REACTIONS = [
  ['#pet-now', 'svg', BEAT, 560],
  ['#pet-play', 'svg', SPIN, 640],
  ['#pet-feed', 'svg', HOP, 480],
  ['#pet-invite, #pet-nap, #pet-edit-name, #buddy-edit-name, #buddy-card-collection', 'svg', WIGGLE, 460],
  ['#pet-study, #pet-dance, .buddy-card .start-button', null, SQUISH, 380],
  ['.pet-details > summary', '.pet-row-icon, .pet-row-swatch, .pet-gift-art, svg', HOP, 460],
  [TILES, null, SQUISH, 380],
];
const PIP_DIALOGS = '#buddy-album, #buddy-card';

export function createUIFeedback(root, { signal, saving = () => false } = {}) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Set(), particles = new Set(), keyed = new WeakMap();
  const app = root.querySelector('#app');
  let disposed = false, pressed = null, lastBurst = 0, houseState = '', petState = null, opening = null;
  const allowed = () => !disposed && !reducedMotion.matches && !document.hidden;
  const excluded = element => element?.closest('.is-avatar-editing, [data-panel="avatar"], .avatar-customizer, .wardrobe-panel');
  document.body.classList.add('ui-motion-enabled');
  document.body.classList.toggle('ui-reduced-motion', reducedMotion.matches);

  function animate(element, frames, options = {}, key = 'reaction', done) {
    if (!element || !allowed() || excluded(element)) { done?.(); return; }
    let slots = keyed.get(element);
    if (!slots) { slots = new Map(); keyed.set(element, slots); }
    slots.get(key)?.cancel();
    const animation = element.animate(frames, { duration: 220, easing: 'cubic-bezier(.2,.75,.25,1)', ...options });
    animations.add(animation); slots.set(key, animation);
    const cleanup = () => { animations.delete(animation); if (slots.get(key) === animation) slots.delete(key); done?.(); };
    // A held press keeps its fill until release. Keep it cancellable even
    // after its 100ms timeline ends, otherwise its scale would stick around.
    animation.onfinish = options.fill === 'forwards' ? null : cleanup;
    animation.oncancel = cleanup;
    return animation;
  }
  const reactionTarget = element => element?.matches('.house-room-tag') ? element.querySelector('.house-pin') : element;
  const pop = (element, strong = false) => animate(reactionTarget(element), [{ scale: strong ? '.94' : '.98' }, { scale: '1' }], { duration: strong ? 240 : 180 }, 'press');
  function enter(element, delay = 0, distance = 8) {
    animate(element, [{ opacity: 0, translate: `0 ${Math.min(distance, 10)}px` }, { opacity: 1, translate: '0 0' }], { duration: 220, delay, fill: 'backwards' }, 'entrance');
  }
  function stagger(elements, distance = 8) {
    [...elements].filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.width && rect.height && rect.right > 0 && rect.left < innerWidth && rect.bottom > 0 && rect.top < innerHeight;
    }).slice(0, 12).forEach((element, i) => enter(element, i * 18, distance));
  }
  function celebrate(target, heart = false, large = false) {
    if (!target || !allowed() || particles.size >= 36) return;
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > innerHeight) return;
    const parent = target.closest('dialog') || document.body;
    const parentRect = parent === document.body ? { left: 0, top: 0 } : parent.getBoundingClientRect();
    const count = Math.min(large ? 16 : 7, 36 - particles.size);
    for (let i = 0; i < count; i++) {
      const bit = document.createElement('span');
      bit.className = `ui-spark motion-spark${heart ? ' is-heart' : ''}`;
      bit.setAttribute('aria-hidden', 'true');
      bit.textContent = heart ? '♡' : i % 3 ? '✦' : '✿';
      bit.style.position = parent === document.body ? 'fixed' : 'absolute';
      bit.style.left = `${rect.left + rect.width / 2 - parentRect.left}px`;
      bit.style.top = `${rect.top + rect.height / 2 - parentRect.top}px`;
      bit.style.color = ['#e3a8b7', '#e2c284', '#aabf91'][i % 3];
      parent.append(bit); particles.add(bit);
      const angle = Math.PI * 2 * i / count, distance = (large ? 80 : 26) + (i % 4) * (large ? 24 : 12);
      animate(bit, [
        { transform: 'translate(-50%, -50%) scale(.15)', opacity: 0 },
        { opacity: 1, offset: .12 },
        { transform: `translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${Math.sin(angle) * distance - 30}px)) rotate(${i % 2 ? 90 : -90}deg) scale(1)`, opacity: 0 },
      ], { duration: large ? 1150 : 680, delay: i % 3 * 30 }, 'particle', () => { bit.remove(); particles.delete(bit); });
    }
  }
  const usable = element => element && (app.contains(element) || element.closest(PIP_DIALOGS)) && !element.disabled && !excluded(element) ? element : null;
  const pressable = event => event.target.closest?.('button, summary, input[type="checkbox"], input[type="range"], a[download]');
  const control = event => usable(pressable(event));
  function locateAgain(element) {
    if (element.isConnected) return element;
    if (element.id) return document.getElementById(element.id);
    const scope = element.closest('.buddy-album-inner') ? root.querySelector('#buddy-album') : app;
    for (const name of ['data-house-slot', 'data-house-design', 'data-category', 'data-furniture', 'data-preset', 'data-pet-choice', 'data-room', 'data-art', 'data-tint', 'data-walls', 'data-floor', 'data-nudge', 'data-reset-design', 'data-quality', 'data-theme-choice', 'data-pet-fabric', 'data-pet-ribbon', 'data-pet-gift', 'data-pet-meal', 'data-color']) {
      if (element.hasAttribute(name)) return scope.querySelector(`[${name}="${CSS.escape(element.getAttribute(name))}"]`);
    }
    return null;
  }
  function onDown(event) {
    const element = control(event);
    if (!element || !allowed() || event.button !== 0) return;
    pressed = element;
    animate(reactionTarget(element), [{ scale: '1' }, { scale: '.98' }], { duration: 100, fill: 'forwards' }, 'press');
  }
  function release() {
    if (!pressed) return;
    const element = pressed; pressed = null;
    if (element.isConnected) pop(element);
  }
  function onClick(event) {
    const element = control(event);
    if (!element || !allowed()) return;
    // Native handlers may replace a selected tile. Animate its replacement.
    queueMicrotask(() => {
      if (!allowed()) return;
      const target = locateAgain(element);
      pop(target, element.matches('[data-house-design], [data-furniture], #build-house-room'));
      if (element.matches('[data-preset], [data-reset-design]')) {
        animate(app.querySelector('#room-canvas'), [{ opacity: .6 }, { opacity: 1 }], { duration: 220 });
      }
      if (element.matches('#house-preview-toggle')) {
        animate(app.querySelector('#house-canvas'), [{ opacity: .6 }, { opacity: 1 }], { duration: 220 });
      }
      if (element.matches('#start-button, [data-minutes]')) pop(app.querySelector('#timer-dial'));
      if (element.matches('#house-surprise')) {
        stagger(app.querySelectorAll('.house-designs button'), 12);
        celebrate(app.querySelector('[data-house-design][aria-pressed="true"]'));
      }
      if (performance.now() - lastBurst > 180 && element.matches('#start-button, #pet-now, [data-pet-choice]')) {
        lastBurst = performance.now(); celebrate(target, element.matches('#pet-now, [data-pet-choice]'));
      }
    });
  }
  function react(event) {
    const element = pressable(event);
    if (!element || !allowed()) return;
    const target = usable(locateAgain(element));
    if (!target) return;
    const [, part, frames, duration] = REACTIONS.find(([selector]) => element.matches(selector)) || [];
    const play = next => {
      if (next !== element && (!frames || part)) pop(next);
      if (frames) animate(part ? next.querySelector(part) : next, frames, { duration, easing: 'cubic-bezier(.3,.7,.3,1.2)' }, part ? 'reaction' : 'press');
    };
    play(target);
    const until = performance.now() + 500;
    const replaced = () => {
      if (!allowed()) return;
      if (!target.isConnected) { const next = usable(locateAgain(element)); if (next) play(next); return; }
      if (performance.now() < until || saving()) requestAnimationFrame(replaced);
    };
    requestAnimationFrame(replaced);
    if (element.matches('summary') && !element.parentElement.open) opening = element.parentElement;
    if (element.matches('#pet-feed')) requestAnimationFrame(() => stagger(root.querySelectorAll('#pet-meals:not([hidden]) > button'), 10));
    if (element.matches('#pet-edit-name, #buddy-edit-name')) requestAnimationFrame(() => enter(root.querySelector('#pet-name-form:not([hidden]), .buddy-name-form:not([hidden])'), 0, 6));
    if (element.matches('#pet-dance') && performance.now() - lastBurst > 180) { lastBurst = performance.now(); celebrate(target, true, true); }
  }
  function reveal(event) {
    const details = event.target;
    if (details !== opening || !details.open) return;
    opening = null;
    stagger([...details.children].filter(child => child.tagName !== 'SUMMARY').flatMap(child => child.matches('ol, .pet-options, .pet-gift-options, .pet-fabrics, .pet-ribbons') ? [...child.children] : [child]), 8);
  }
  function petReaction() {
    const card = app.querySelector('#room-panel[data-panel-kind="pet"]:not([hidden]) .pet-card');
    if (!card) { petState = null; return; }
    const hearts = card.querySelectorAll('.pet-hearts i'), receipt = card.querySelector('#pet-ritual-status');
    const next = { pet: card.dataset.petId, fills: [...hearts].map(heart => Number(heart.style.getPropertyValue('--fill'))), receipt: receipt?.textContent || '', title: card.querySelector('.pet-bond-title')?.textContent };
    const previous = petState; petState = next;
    if (!previous || previous.pet !== next.pet || !allowed()) return;
    const grown = [...hearts].filter((heart, i) => next.fills[i] > (previous.fills[i] || 0));
    grown.forEach((heart, i) => animate(heart, [{ scale: '.4' }, { scale: '1.35', offset: .55 }, { scale: '1' }], { duration: 520, delay: i * 60, easing: 'cubic-bezier(.3,.7,.3,1.2)' }, 'entrance'));
    if (grown.length) celebrate(grown.at(-1), true);
    if (next.receipt && next.receipt !== previous.receipt) animate(receipt, [{ opacity: 0, translate: '0 8px', scale: '.9' }, { opacity: 1, translate: '0 -2px', scale: '1.04', offset: .6 }, { opacity: 1, translate: '0 0', scale: '1' }], { duration: 420 }, 'entrance');
    if (next.title !== previous.title) animate(card.querySelector('.pet-bond-title'), SQUISH, { duration: 420 }, 'entrance');
  }
  function pipOpened(records) {
    if (!allowed()) return;
    for (const { target } of records) {
      if (!target.matches?.(PIP_DIALOGS) || !target.open) continue;
      animate(target.firstElementChild, [{ opacity: 0, translate: '0 14px', scale: '.96' }, { opacity: 1, translate: '0 0', scale: '1' }], { duration: 300, easing: 'cubic-bezier(.2,.8,.3,1.1)' }, 'entrance');
      if (target.id === 'buddy-card') animate(target.querySelector('.buddy-card-art .find-art'), [{ scale: '.3', rotate: '-20deg' }, { scale: '1.15', rotate: '6deg', offset: .6 }, { scale: '1', rotate: '0deg' }], { duration: 560, delay: 120, fill: 'backwards', easing: 'cubic-bezier(.3,.7,.3,1.2)' }, 'entrance');
      else {
        requestAnimationFrame(() => stagger(target.querySelectorAll('.buddy-find'), 10));
        animate(target.querySelector('.buddy-growth-bar i'), [{ scale: '0 1' }, { scale: '1 1' }], { duration: 700, delay: 160, fill: 'backwards', easing: 'cubic-bezier(.2,.8,.3,1)' }, 'entrance');
      }
    }
  }
  const pipObserver = new MutationObserver(pipOpened);
  pipObserver.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
  function houseReaction() {
    const page = app.querySelector('#house-page');
    if (!page || page.hidden) { houseState = ''; return; }
    const slot = page.querySelector('[data-house-slot][aria-pressed="true"]')?.dataset.houseSlot || '';
    const design = page.querySelector('[data-house-design][aria-pressed="true"]')?.dataset.houseDesign || '';
    const preview = page.querySelector('#house-preview-toggle')?.getAttribute('aria-pressed');
    const built = page.classList.contains('house-just-built');
    const state = JSON.stringify([slot, design, preview, built]);
    if (state === houseState) return;
    const previous = houseState ? JSON.parse(houseState) : null; houseState = state;
    if (!allowed()) return;
    const detail = page.querySelector('#house-detail');
    if (!previous || previous[0] !== slot || previous[3] !== built) {
      if (!detail.hidden && !page.classList.contains('is-living-garden')) animate(detail, [{ opacity: 0, translate: '0 8px' }, { opacity: 1, translate: '0 0' }], { duration: 220 }, 'paper');
    } else if (previous[1] !== design) {
      pop(page.querySelector('[data-house-design][aria-pressed="true"]'), true);
      enter(page.querySelector('.house-design-copy'), 0, 12);
      pop(page.querySelector('.house-design-check'));
    }
    if (built && !previous?.[3]) {
      const badge = page.querySelector('#house-celebration');
      pop(badge, true); celebrate(badge, false, true);
      stagger(page.querySelectorAll('.house-growth-dots i'), 10);
    }
    if (previous && previous[2] !== preview) enter(page.querySelector('.house-map-hint'), 0, 10);
  }
  const watchedPanels = '#builder-panel, #room-panel, #focus-card, #house-name-form, #session-celebration';
  const observer = new MutationObserver(records => {
    let houseDirty = false, collectionDirty = false, inspectorDirty = false, petDirty = false;
    const panels = new Set();
    for (const record of records) {
      const target = record.target;
      if (!(target instanceof Element)) continue;
      if (target.closest('#house-page')) houseDirty = true;
      if (target.closest('#room-panel')) petDirty = true;
      if (record.type === 'childList') {
        if (target.id === 'collection-content') collectionDirty = true;
        if (target.id === 'selection-inspector') inspectorDirty = true;
        if (target.id === 'room-panel' && target.dataset.panelKind !== 'pet') panels.add(target);
        if (target.id === 'coin-balance') pop(target);
      } else if (target.matches(watchedPanels) && !target.hidden && (!target.matches('dialog') || target.open)) panels.add(target);
    }
    if (houseDirty) houseReaction();
    if (petDirty) petReaction();
    if (!allowed() || document.body.classList.contains('is-avatar-editing')) return;
    for (const panel of panels) {
      if (panel.hidden) continue;
      enter(panel, 0, panel.id === 'builder-panel' ? 38 : 20);
      stagger(panel.querySelectorAll('.theme-option, .pet-option, .quality-options button'), 14);
    }
    if (collectionDirty) stagger(app.querySelectorAll('.furniture-card, .preset-card'), 24);
    if (inspectorDirty) enter(app.querySelector('.selection-copy'), 0, 8);
  });
  observer.observe(app, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'open', 'class'] });
  function stop() {
    document.body.classList.toggle('ui-reduced-motion', reducedMotion.matches);
    pressed = null;
    for (const animation of [...animations]) animation.cancel();
    for (const particle of particles) particle.remove();
    particles.clear();
  }
  root.addEventListener('pointerdown', onDown, { capture: true, signal });
  root.addEventListener('pointerup', release, { capture: true, signal });
  root.addEventListener('pointercancel', release, { capture: true, signal });
  root.addEventListener('click', onClick, { capture: true, signal });
  window.addEventListener('click', react, { signal });
  root.addEventListener('toggle', reveal, { capture: true, signal });
  window.addEventListener('blur', stop, { signal });
  reducedMotion.addEventListener('change', stop, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); }, { signal });
  return { celebrate, dispose() { disposed = true; observer.disconnect(); pipObserver.disconnect(); stop(); document.body.classList.remove('ui-motion-enabled', 'ui-reduced-motion'); } };
}
