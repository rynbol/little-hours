import './wilds.css';
import { travelTo } from '../../ui/place-transition.js';
import { normalizeWilds } from '../../core/wilds/progress.js';
import { bondLevel, petName } from '../../core/pet-bonds.js';

const BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6 8.5 12l6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const CONTROLS = [
  ['W A S D', 'Walk'], ['Shift', 'Sprint'], ['Space', 'Jump'], ['Ctrl or right-click', 'Dodge roll'],
  ['Click', 'Sword'], ['Hold click', 'Charged swing'], ['F', 'Lock on'], ['E', 'Rest, light, pet'],
  ['Q', 'Partner skill'], ['Drag', 'Look around'], ['Scroll', 'Zoom'], ['M', 'Mute'], ['Esc', 'This menu'],
];

export function createWildsUI(app) {
  let root = null, game = null, loading = null, disposed = false, returnFocus = null;
  const $ = selector => root.querySelector(selector);

  function build() {
    root = document.createElement('section');
    root.className = 'wilds'; root.id = 'wilds-page'; root.hidden = true; root.setAttribute('aria-label', 'The Wilds');
    root.innerHTML = `<canvas id="wilds-canvas" class="wilds-canvas" tabindex="0" aria-label="The valley. Use the keyboard and mouse to explore."></canvas>
      <div class="wilds-hud" id="wilds-hud" aria-hidden="true"></div>
      <button class="wilds-chip" id="wilds-menu-open" type="button" aria-label="Menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
      <dialog class="wilds-menu" id="wilds-menu" aria-labelledby="wilds-menu-title">
        <header><h2 id="wilds-menu-title">The Wilds</h2><p id="wilds-menu-note"></p></header>
        <div class="wilds-menu-actions">
          <button type="button" id="wilds-resume" class="is-primary">Keep exploring</button>
          <button type="button" id="wilds-mute" aria-pressed="false">Sound on</button>
          <button type="button" id="wilds-leave">${BACK}<span>Back to the island</span></button>
        </div>
        <dl class="wilds-controls">${CONTROLS.map(([key, what]) => `<div><dt>${key}</dt><dd>${what}</dd></div>`).join('')}</dl>
      </dialog>
      <div class="wilds-loading" id="wilds-loading" aria-live="polite"><span></span></div>`;
    document.body.appendChild(root);
    $('#wilds-menu-open').addEventListener('click', openMenu);
    $('#wilds-resume').addEventListener('click', closeMenu);
    $('#wilds-leave').addEventListener('click', close);
    $('#wilds-mute').addEventListener('click', () => game?.toggleMute());
    $('#wilds-menu').addEventListener('close', () => { game?.setPaused(false); $('#wilds-canvas').focus({ preventScroll: true }); });
  }

  const wilds = () => normalizeWilds(app.state.wilds);
  const petBond = () => bondLevel(app.state.petBonds?.[app.state.pet]).index;

  function save(change) {
    app.acceptUpdate(app.store.update(draft => { draft.wilds = change(normalizeWilds(draft.wilds)); }));
  }

  function openMenu() {
    if (!root || root.hidden || $('#wilds-menu').open) return;
    game?.setPaused(true);
    const progress = wilds();
    $('#wilds-menu-note').textContent = progress.victories ? `The Mossheart Stag rests. Heartwood ${progress.heartwood}.` : 'A valley at the edge of the island.';
    $('#wilds-mute').textContent = game?.muted ? 'Sound off' : 'Sound on';
    $('#wilds-mute').setAttribute('aria-pressed', String(Boolean(game?.muted)));
    $('#wilds-menu').showModal();
  }
  function closeMenu() { $('#wilds-menu').close(); }

  function onKey(event) {
    if (!root || root.hidden || event.key !== 'Escape') return;
    event.preventDefault(); event.stopImmediatePropagation();
    if ($('#wilds-menu').open) closeMenu(); else if (!game?.cancel()) openMenu();
  }

  function open() {
    if (disposed || (root && !root.hidden)) return;
    loading ??= import('./game.js');
    travelTo('forest', enter, () => Boolean(game?.ready()));
  }

  async function enter() {
    if (disposed) return;
    if (!root) build();
    if (!root.hidden) return;
    returnFocus = document.activeElement;
    root.hidden = false; document.body.classList.add('is-wilds'); document.getElementById('app').inert = true;
    document.addEventListener('keydown', onKey, true);
    const { createWildsGame } = await loading;
    if (root.hidden || game) return;
    game = createWildsGame($('#wilds-canvas'), {
      hud: $('#wilds-hud'),
      avatar: app.state.avatar,
      pet: { id: app.state.pet, name: petName(app.state, app.state.pet), bond: petBond() },
      progress: wilds(),
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)'),
      save,
      leave: close,
      loading: $('#wilds-loading'),
    });
    $('#wilds-canvas').focus({ preventScroll: true });
  }

  function close() {
    if (!root || root.hidden) return;
    travelTo(document.body.classList.contains('is-house') ? 'island' : 'home', leave);
  }

  function leave() {
    if (!root || root.hidden) return;
    if ($('#wilds-menu').open) $('#wilds-menu').close();
    document.removeEventListener('keydown', onKey, true);
    game?.dispose(); game = null;
    root.hidden = true; document.body.classList.remove('is-wilds'); document.getElementById('app').inert = false;
    returnFocus?.focus?.({ preventScroll: true });
  }

  return {
    open, close,
    get isOpen() { return Boolean(root && !root.hidden); },
    ready: () => Boolean(game?.ready()),
    diagnostics: () => game?.diagnostics() ?? null,
    get game() { return game; },
    render() { game?.setProgress(wilds()); },
    dispose() { disposed = true; leave(); root?.remove(); root = null; },
  };
}
