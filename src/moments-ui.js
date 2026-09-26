import './moments.css';
import { interactionFor } from './item-interactions.js';

const paths = {
  tea: '<path d="M4 9h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z"/><path d="M16 10h2a3 3 0 0 1 0 6h-2M8 3v3m5-3v3"/>',
  book: '<path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14"/>',
  leaf: '<path d="M5 18C1 7 12 3 20 4c1 9-4 15-11 14M5 21 16 9"/>',
  seat: '<path d="M5 12V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v5M5 19v2m14-2v2M3 11h3v4h12v-4h3v8H3Z"/>',
};
const icon = kind => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[kind]}</svg>`;
const captions = { tea: 'Warm hands. No hurry.', water: 'A little care for your green friends.', read: 'Just one more page.', rest: 'Your favorite kind of doing nothing.' };

// A small keyboard/touch alternative to tapping the furniture itself. It
// mounts independently of the main panels so the room UI can evolve freely.
export function createMomentsUI(host, { room, getState, signal }) {
  const element = document.createElement('div'); element.className = 'little-moments';
  element.innerHTML = `<button type="button" class="moments-trigger" aria-expanded="false" aria-controls="moments-panel">${icon('tea')}<span>Little moments</span></button>
    <section class="moments-panel" id="moments-panel" aria-label="Little moments" hidden>
      <div class="moments-heading"><div><span>MAKE YOURSELF AT HOME</span><h3>A little pause.</h3></div><button type="button" class="moments-close" aria-label="Close little moments">×</button></div>
      <p class="moments-note"></p><div class="moments-choices"></div>
      <p class="moments-footnote">You can tap these pieces in your room, too.</p>
    </section>`;
  host.appendChild(element);
  const trigger = element.querySelector('.moments-trigger'), panel = element.querySelector('.moments-panel'), choices = element.querySelector('.moments-choices'), note = element.querySelector('.moments-note');
  let signature = '';
  function close(returnFocus = false) { panel.hidden = true; trigger.setAttribute('aria-expanded', 'false'); if (returnFocus) trigger.focus(); }
  function refresh() {
    const state = getState();
    element.hidden = state.unavailable;
    if (state.unavailable) close();
    if (panel.hidden) return;
    const key = JSON.stringify([state.focusing, state.items.map(item => [item.id, item.type])]);
    if (key === signature) return;
    signature = key; choices.replaceChildren();
    note.textContent = state.focusing ? 'Your companion is focusing with you. Pause the timer for a little moment.' : 'Nothing to finish. Just something nice.';
    // Offer only moments supported by the furniture currently in this room.
    const offered = new Set();
    for (const item of state.items) {
      const action = interactionFor(item.type);
      if (!action || offered.has(action.kind)) continue;
      offered.add(action.kind);
      const button = document.createElement('button'); button.type = 'button'; button.className = 'moment-choice'; button.disabled = state.focusing;
      button.innerHTML = `${icon(action.symbol)}<span><strong></strong><small></small></span><span aria-hidden="true">↗</span>`;
      button.querySelector('strong').textContent = action.label;
      button.querySelector('small').textContent = captions[action.kind];
      button.addEventListener('click', () => { if (room.interactWithKind(action.kind).ok) close(true); });
      choices.appendChild(button);
    }
    if (!offered.size) note.textContent = 'Add a tea table, bookcase, plant, or cozy seat to make a little moment here.';
  }
  trigger.addEventListener('click', () => { if (!panel.hidden) return close(); panel.hidden = false; trigger.setAttribute('aria-expanded', 'true'); signature = ''; refresh(); }, { signal });
  element.querySelector('.moments-close').addEventListener('click', () => close(true), { signal });
  document.addEventListener('pointerdown', event => { if (!element.contains(event.target)) close(); }, { signal });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) { event.stopPropagation(); close(true); } }, { signal });
  element.addEventListener('focusout', event => { if (event.relatedTarget && !element.contains(event.relatedTarget)) close(); }, { signal });
  return { refresh, dispose() { element.remove(); } };
}
