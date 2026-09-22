import './style.css';
import { createRoom } from './room.js';
import { createSession, remainingAt, formatTime } from './session.js';
import { createStateStore, localDate, storageKey } from './state.js';
import { FURNITURE, getFurniture } from './catalog.js';
import { PRESETS, createLayout, normalizeLayout, MAX_ITEMS } from './layout.js';
import { companionIntent } from './companion.js';

const icons = {
  home: '<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-8h6v8"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  rain: '<path d="M7 15a5 5 0 1 1 2-9 5 5 0 0 1 9 3 3 3 0 1 1 0 6M8 18l-1 3m6-3-1 3m6-3-1 3"/>',
  moon: '<path d="M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11Z"/>',
  leaf: '<path d="M20 3S4 2 4 12a7 7 0 0 0 7 7c10 0 9-16 9-16Z"/><path d="M3 21 15 9"/>',
  cat: '<path d="m4 11 1-8 5 5h4l5-5 1 8v5c0 7-16 7-16 0z"/><path d="M8 13h.1M16 13h.1M11 17h2"/>',
  mini: '<rect x="3" y="4" width="18" height="16" rx="3"/><rect x="12" y="12" width="7" height="6" rx="1"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  sound: '<path d="m11 4-6 5H2v6h3l6 5zM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  build: '<path d="m14 5 5 5M4 20l4-1 12-12a2 2 0 0 0-4-4L4 15z"/>',
  rotate: '<path d="M20 10a8 8 0 1 0-1 8M20 4v6h-6"/>',
  trash: '<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  gauge: '<path d="M4 18a9 9 0 1 1 16 0M12 13l5-5M5 18h14"/><circle cx="12" cy="13" r="1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};
const icon = (name) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.home}</svg>`;
const store = createStateStore({
  getItem: key => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
});
let state = store.state;
let room;
let currentPanel = null;
let compact = false;
let audioContext, noiseNode, gainNode;
let soundEnabled = false;
let storageWarningShown = false;
let toastTimeout;
let petTimeout;
let editMode = false;
let collectionTab = 'collection';
let category = 'All';
let selectedItem = null;
let placement = null;
let undoLayout = null;
let roomLayoutSignature = '';
let quality = 'auto';
let performanceStats = null;
let focusCollapsed = false;
let lastSessionRender = '';
let draggedItemId = null;
let dragHint = '';
let companionActivity = 'idle';
const listeners = new AbortController();

document.querySelector('#app').innerHTML = `
  <div class="app-shell">
    <header class="app-header">
      <a class="brand" href="/" aria-label="Little Hours home"><span class="brand-mark">${icon('home')}</span><span>little hours<span class="brand-dot">.</span></span></a>
      <div class="header-right"><span class="room-label">A little world, all your own.</span><button class="time-toggle" id="time-toggle" aria-label="Switch to daylight" title="Switch to daylight">${icon('moon')}<span>Night</span></button><button class="focus-toggle" id="focus-toggle" aria-expanded="true" aria-controls="focus-card" aria-label="Hide focus panel">${icon('clock')}<span>Focus</span><span id="dock-timer">25:00</span></button></div>
    </header>
    <main class="workspace">
      <section class="room-section" aria-labelledby="room-title">
        <div class="room-heading"><div><p class="eyebrow">YOUR QUIET LITTLE WORLD</p><h1 id="room-title">The twilight retreat</h1><p class="room-subtitle" id="room-subtitle">The fire is warm. The night is yours.</p></div><div class="heading-actions"><button class="mode-button" id="decorate-button" aria-pressed="false" aria-controls="builder-panel">${icon('build')}<span>Decorate</span></button><button class="icon-button" id="reset-view" aria-label="Reset room view">${icon('reset')}</button></div></div>
        <div class="stage" id="stage">
          <div class="room-canvas" id="room-canvas" aria-label="Interactive 3D cutaway study room with a desk, bookshelf, plants and a ginger cat. Drag to turn the room."></div>
          <div class="loading-note" id="loading-note">Making room for you…</div>
          <div class="stage-presence" id="stage-presence" data-presence="idle" role="status" aria-live="polite" aria-atomic="true" aria-label="Your local focus status: In your room" title="Your focus status in this browser."><span id="presence-icon" aria-hidden="true">${icon('home')}</span><span id="room-status">In your room</span></div>
          <div class="companion-status" id="companion-status" data-state="idle" role="status" aria-live="polite"><span aria-hidden="true">✧</span><span id="companion-status-text">Companion · Ready at the desk</span></div>
          <div class="mini-caption" id="mini-caption" hidden>Mini view preview · inside this page</div>
          <div class="room-hint" id="room-hint">Drag to look around<span>·</span>Try petting the cat</div>
          <div class="pet-bubble" id="pet-bubble" hidden>Miso is happy you’re here.</div>
        </div>
        <div class="room-bottom">
          <div class="room-company">${icon('cat')}<span>You & Miso</span></div>
          <nav class="room-tools" aria-label="Room controls">
            <button class="tool" data-panel="atmosphere" aria-expanded="false" aria-controls="room-panel">${icon('sun')}<span>Atmosphere</span></button>
            <button class="tool" data-panel="performance" aria-expanded="false" aria-controls="room-panel">${icon('gauge')}<span>Performance</span></button>
            <button class="tool" id="pet-button">${icon('cat')}<span>Miso</span></button>
            <button class="tool" id="mini-button" aria-pressed="false">${icon('mini')}<span>Mini view</span></button>
          </nav>
        </div>
        <div class="room-panel" id="room-panel" hidden></div>
        <section class="builder-panel" id="builder-panel" aria-label="Room decorator" hidden>
          <div class="builder-heading"><div class="collection-tabs" aria-label="Decoration collections"><button data-collection-tab="collection" aria-pressed="true">Furniture</button><button data-collection-tab="presets" aria-pressed="false">Room designs</button></div><div class="builder-meta"><span id="item-count"></span><button class="quiet-button" id="undo-layout" disabled>${icon('reset')} Undo</button></div></div>
          <div class="selection-inspector" id="selection-inspector" aria-live="polite"></div>
          <div id="collection-content"></div>
          <p class="collection-footnote">The whole collection is yours. Pick a piece, then a spot in your room.</p>
          <div class="collection-return-target" id="collection-return-target" aria-hidden="true"><span>${icon('build')}</span><strong id="return-label">Return to your collection</strong><small id="return-detail">Drop here to put this piece away · Undo brings it back</small></div>
        </section>
      </section>
      <aside class="focus-card" id="focus-card" aria-labelledby="focus-title">
        <div class="card-top"><span class="eyebrow">YOUR QUIET CHAPTER</span><span class="tiny-flower" aria-hidden="true">✳</span></div>
        <h2 id="focus-title">Stay a <em>while.</em></h2>
        <label class="field-label" for="task">What are you working on?</label>
        <input id="task" maxlength="180" placeholder="One thing, for now…" autocomplete="off" />
        <div class="timer-area"><span id="session-label" class="session-label">SETTLE IN</span><div id="timer" class="timer" role="timer" aria-label="25 minutes remaining">25:00</div><div class="durations" aria-label="Focus duration"><button data-minutes="25" aria-pressed="true">25 min</button><button data-minutes="50" aria-pressed="false">50 min</button><button data-minutes="90" aria-pressed="false">90 min</button></div></div>
        <button class="start-button" id="start-button"><span>Start focusing</span>${icon('arrow')}</button>
        <button class="reset-session" id="reset-session" hidden>Reset session</button>
        <div class="sound-row"><button id="sound-button" class="sound-button" aria-pressed="false">${icon('rain')}<span>Soft rain<span class="sound-state" id="sound-state">Sound off</span></span><span class="sound-switch" aria-hidden="true"></span></button><label class="sr-only" for="volume">Rain volume</label><input type="range" id="volume" min="0" max="100" value="30" aria-label="Rain volume" /></div>
        <div class="daily-note" id="daily-note">Good things begin with a little time.</div>
      </aside>
    </main>
    <footer class="app-footer"><span>A softer place to spend your hours.</span><span>Your room is saved as you go <span aria-hidden="true">✧</span></span></footer>
  </div>
  <div id="drag-return-preview" class="drag-return-preview" aria-hidden="true" hidden></div>
  <div id="toast" class="toast" role="status" hidden></div>`;

const $ = (selector) => document.querySelector(selector);
$('#task').value = state.task;
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { $('#toast').hidden = true; }, 4200);
}
const themeCopy = {
  dusk: ['The moonlit retreat', 'The candles are lit. Stay a little longer.'],
  rain: ['Rain at the retreat', 'Raindrops, candlelight, and nowhere else to be.'],
  day: ['The sunlit retreat', 'Sunlight on the books. A fresh little chapter.'],
};
function applyState(next, force = false) {
  const previous = state;
  state = next;
  if (force || previous.theme !== state.theme) {
    document.body.dataset.theme = state.theme;
    $('#room-title').textContent = themeCopy[state.theme][0];
    $('#room-subtitle').textContent = themeCopy[state.theme][1];
    room?.setTheme(state.theme);
    const [symbol, label] = state.theme === 'day' ? ['sun', 'Daylight'] : state.theme === 'rain' ? ['rain', 'Rain'] : ['moon', 'Night'];
    const nextLabel = state.theme === 'day' ? 'Switch to night' : 'Switch to daylight';
    $('#time-toggle').innerHTML = `${icon(symbol)}<span>${label}</span>`;
    $('#time-toggle').setAttribute('aria-label', nextLabel);
    $('#time-toggle').title = nextLabel;
  }
  if ($('#task').value !== state.task) $('#task').value = state.task;
  for (const [key, visible] of Object.entries(state.decor)) {
    if (key === 'lights' && (force || previous.decor[key] !== visible)) room?.setDecor(key, visible);
  }
  const layoutSignature = JSON.stringify(state.layout);
  if (force || layoutSignature !== roomLayoutSignature) {
    roomLayoutSignature = layoutSignature;
    room?.setLayout?.(state.layout);
    if (selectedItem) selectedItem = state.layout.items.find(item => item.id === selectedItem.id) || null;
    renderInspector();
    if (editMode && collectionTab === 'presets') renderCollection();
  }
  $('#item-count').textContent = `${state.layout.items.length} / ${MAX_ITEMS} pieces`;
  room?.setActivity(companionIntent(state.session));
  document.querySelectorAll('[data-theme-choice]').forEach(button => button.setAttribute('aria-pressed', button.dataset.themeChoice === state.theme));
  document.querySelectorAll('[data-decor]').forEach(input => { input.checked = state.decor[input.dataset.decor]; });
}
function acceptUpdate(result) {
  applyState(result.state);
  if (result.completed) {
    room?.pet();
    toast('A little progress, made. Stretch, breathe, and take a break.');
  }
  if (!result.persisted && !storageWarningShown) {
    storageWarningShown = true;
    toast('Your browser couldn’t save this visit. The room still works.');
  }
  renderSession();
}
function petFeedback() {
  $('#pet-bubble').hidden = false;
  clearTimeout(petTimeout);
  petTimeout = setTimeout(() => { $('#pet-bubble').hidden = true; }, 2600);
}
try {
  $('#decorate-button').disabled = true;
  room = createRoom($('#room-canvas'), {
    onReady() {
      $('#loading-note').hidden = true;
      $('#decorate-button').disabled = false;
    },
    onPet: petFeedback,
    onCompanionState({ state: activity }) {
      companionActivity = activity;
      const labels = { idle: 'Ready at the desk', working: 'Working alongside you', walking: 'Finding a cozy spot', returning: 'Back to the desk', resting: 'Taking a breather', sleeping: 'Dozing off', 'resting-at-desk': 'Resting at the desk' };
      $('#companion-status').dataset.state = activity;
      $('#companion-status-text').textContent = `Companion · ${labels[activity] || 'In the room'}`;
      renderCompanionNote();
    },
    onLayoutChange(layout) {
      roomLayoutSignature = JSON.stringify(layout);
      commitLayout(layout);
    },
    onSelectionChange(item) { selectedItem = item; renderInspector(); },
    onPlacementState(next) { placement = next; renderInspector(); updateCatalogSelection(); },
    isCollectionDrop(x, y) {
      if (!editMode) return false;
      const rect = $('#builder-panel').getBoundingClientRect();
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    },
    onDragState: renderDragState,
    onNotice: toast,
    onStats(stats) { performanceStats = stats; renderPerformance(); },
  });
} catch (error) {
  $('#loading-note').textContent = 'The room couldn’t load. Try reloading; your focus timer is still ready.';
  console.error('Could not create the room:', error);
  $('#decorate-button').disabled = true;
}
applyState(state, true);

function renderCompanionNote() {
  const minutes = state.history.filter(h => h.date === localDate()).reduce((sum, h) => sum + h.minutes, 0);
  const notes = { idle: 'Start focusing to work alongside your companion.', working: 'Your companion is working alongside you.', walking: 'A little stretch. Your companion is finding a cozy spot.', returning: 'Your companion is on the way back to the desk.', resting: 'A soft seat and a little breather. Take your time.', sleeping: 'Your companion has drifted off. Resume whenever you’re ready.', 'resting-at-desk': 'Your companion is taking a quiet break at the desk.' };
  $('#daily-note').textContent = minutes ? `${minutes} quiet minutes made today. Look at you go.` : notes[companionActivity];
}
function renderSession() {
  const ms = remainingAt(state.session);
  const formatted = formatTime(ms);
  const presence = state.session.running ? 'focusing' : ms < state.session.duration ? 'break' : 'idle';
  const today = localDate();
  const minutes = state.history.filter(h => h.date === today).reduce((sum, h) => sum + h.minutes, 0);
  const renderKey = `${formatted}:${presence}:${state.session.duration}:${today}:${minutes}`;
  // The clock polls for deadlines twice a second, but idle rooms and unchanged
  // displayed seconds do not need another set of DOM mutations.
  if (renderKey === lastSessionRender) return;
  lastSessionRender = renderKey;
  $('#timer').textContent = formatted;
  $('#dock-timer').textContent = formatted;
  $('#timer').setAttribute('aria-label', `${formatted} remaining`);
  document.title = state.session.running ? `${formatted} · Little Hours` : 'Little Hours — a little place to focus';
  $('#session-label').textContent = state.session.running ? 'ONE LITTLE THING AT A TIME' : ms < state.session.duration && ms > 0 ? 'TAKE YOUR TIME' : ms === 0 ? 'A LITTLE PROGRESS, MADE' : 'SETTLE IN';
  const label = state.session.running ? 'Pause a moment' : ms === 0 ? 'Begin another session' : ms < state.session.duration ? 'Keep going' : 'Start focusing';
  $('#start-button span').textContent = label;
  $('#reset-session').hidden = !state.session.running && ms === state.session.duration;
  const presenceBadge = $('#stage-presence');
  if (presenceBadge.dataset.presence !== presence) {
    const [status, symbol] = presence === 'focusing' ? ['Focusing', 'clock'] : presence === 'break' ? ['On a break', 'moon'] : ['In your room', 'home'];
    presenceBadge.dataset.presence = presence;
    presenceBadge.setAttribute('aria-label', `Your local focus status: ${status}`);
    $('#room-status').textContent = status;
    $('#presence-icon').innerHTML = icon(symbol);
  }
  document.body.classList.toggle('is-focusing', state.session.running);
  document.querySelectorAll('[data-minutes]').forEach(button => {
    button.setAttribute('aria-pressed', Number(button.dataset.minutes) * 60000 === state.session.duration);
    button.disabled = state.session.running;
  });
  renderCompanionNote();
}
function tick() {
  if (state.session.running && remainingAt(state.session) <= 0) acceptUpdate(store.update());
  else renderSession();
}
$('#start-button').addEventListener('click', () => {
  // Preserve the action shown on the button if the deadline just passed.
  acceptUpdate(store.setRunning(!state.session.running));
});
$('#reset-session').addEventListener('click', () => {
  acceptUpdate(store.update(draft => { draft.session = createSession(draft.session.duration / 60000); }));
});
document.querySelectorAll('[data-minutes]').forEach(button => button.addEventListener('click', () => {
  acceptUpdate(store.update(draft => {
    if (!draft.session.running) draft.session = createSession(Number(button.dataset.minutes));
  }));
}));
$('#task').addEventListener('input', event => {
  const task = event.target.value;
  acceptUpdate(store.update(draft => { draft.task = task; }));
});
$('#time-toggle').addEventListener('click', () => {
  acceptUpdate(store.update(draft => { draft.theme = draft.theme === 'day' ? 'dusk' : 'day'; }));
});
$('#reset-view').addEventListener('click', () => room?.resetView());
$('#focus-toggle').addEventListener('click', () => {
  if (editMode) { focusCollapsed = false; setEditMode(false); }
  else { focusCollapsed = !focusCollapsed; syncFocusDock(); }
  if (!focusCollapsed) revealFocusDock();
});
$('#decorate-button').addEventListener('click', () => setEditMode(!editMode));
$('#pet-button').addEventListener('click', () => { if (room) room.pet(); else petFeedback(); });
$('#mini-button').addEventListener('click', () => {
  if (editMode) setEditMode(false);
  compact = !compact;
  $('#stage').classList.toggle('is-mini', compact);
  $('#mini-button').setAttribute('aria-pressed', compact);
  $('#mini-caption').hidden = !compact;
  $('#mini-button span').textContent = compact ? 'Full room' : 'Mini view';
});

function setEditMode(enabled) {
  editMode = enabled;
  if (enabled && compact) {
    compact = false;
    $('#stage').classList.remove('is-mini');
    $('#mini-button').setAttribute('aria-pressed', 'false');
    $('#mini-button span').textContent = 'Mini view';
    $('#mini-caption').hidden = true;
  }
  document.body.classList.toggle('is-decorating', enabled);
  $('#builder-panel').hidden = !enabled;
  syncFocusDock();
  $('#decorate-button').setAttribute('aria-pressed', enabled);
  $('#decorate-button').setAttribute('aria-label', enabled ? 'Done decorating' : 'Decorate');
  $('#decorate-button span').textContent = enabled ? 'Done decorating' : 'Decorate';
  $('#room-canvas').setAttribute('aria-label', enabled
    ? 'Room decorator. Hover to outline furniture, then drag to move it. Drop a piece over the bottom collection to put it away. Escape cancels.'
    : 'Interactive 3D cutaway study room. Drag to turn the room, or click the ginger cat.');
  currentPanel = null;
  renderPanel();
  room?.setEditMode?.(enabled);
  if (!enabled) { placement = null; selectedItem = null; }
  renderInspector();
  if (enabled) renderCollection();
}

function syncFocusDock() {
  const visible = !editMode && !focusCollapsed;
  $('#focus-card').hidden = !visible;
  document.body.classList.toggle('focus-collapsed', focusCollapsed);
  $('#focus-toggle').setAttribute('aria-expanded', String(visible));
  $('#focus-toggle').setAttribute('aria-label', visible ? 'Hide focus panel' : 'Show focus panel');
}

function revealFocusDock() {
  if (window.matchMedia('(min-width: 1000px)').matches) return;
  const card = $('#focus-card');
  const rect = card.getBoundingClientRect();
  if (rect.top >= 12 && rect.bottom <= window.innerHeight - 12) return;
  card.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}

function rememberControlFocus(container) {
  const active = document.activeElement;
  if (!container.contains(active)) return null;
  if (active.id) return { id: active.id };
  for (const key of ['category', 'furniture', 'preset', 'nudge']) {
    if (active.dataset?.[key] !== undefined) return { key, value: active.dataset[key] };
  }
  return null;
}

function restoreControlFocus(container, remembered) {
  if (!remembered) return;
  const controls = [...container.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"]')];
  const matching = controls.find(control => remembered.id ? control.id === remembered.id : control.dataset[remembered.key] === remembered.value);
  // If removal also removes its control, keep keyboard navigation in the editor.
  (matching || controls[0] || $('#decorate-button')).focus({ preventScroll: true });
}

function commitLayout(layout, remember = true) {
  const next = normalizeLayout(layout);
  if (JSON.stringify(next) === JSON.stringify(state.layout)) return;
  if (remember) undoLayout = structuredClone(state.layout);
  acceptUpdate(store.update(draft => { draft.layout = next; }));
  $('#undo-layout').disabled = !undoLayout;
  renderInspector();
}

$('#undo-layout').addEventListener('click', () => {
  if (!undoLayout) return;
  const previous = undoLayout;
  undoLayout = null;
  room?.cancelPlacement?.();
  room?.selectItem?.(null);
  commitLayout(previous, false);
  $('#undo-layout').disabled = true;
  toast('Your previous arrangement is back.');
});

document.querySelectorAll('[data-collection-tab]').forEach(button => button.addEventListener('click', () => {
  collectionTab = button.dataset.collectionTab;
  renderCollection();
}));

// Small illustrations are drawn by hand in SVG; the room uses procedural JavaScript geometry.
function furnitureArt(type) {
  const pieces = {
    'study-desk': '<path fill="#c69366" d="m17 39 35-18 31 16-35 19z"/><path fill="#9c6848" d="M17 39v6l31 17v-6zm31 17 35-19v6L48 62z"/><path stroke="#82593f" stroke-width="5" d="M23 45v25m50-27v22M48 59v20"/><path fill="#5d695c" d="m39 31 19-9 2 16-19 10z"/><path fill="#b7c4b0" d="m42 32 14-7 1 11-14 7z"/><path fill="#dfdcc7" d="m41 48 19-10 10 5-19 10z"/>',
    'writing-desk': '<path fill="#c69366" d="m15 41 39-21 31 17-39 21z"/><path fill="#9c6848" d="M15 41v6l31 17v-6zm31 17 39-21v6L46 64z"/><path stroke="#82593f" stroke-width="5" d="M22 48v25m55-28v22M46 62v18"/><path fill="#f4e9cc" d="m42 36 14-7 13 7-14 8z"/><path stroke="#657457" stroke-width="3" d="m36 31 6-12 8 5"/><path fill="#879771" d="m43 21 8-5 6 8-14 3z"/>',
    bookcase: '<path fill="#a87952" d="m25 27 35-17 18 10v55L43 92 25 82z"/><path fill="#d7ad7b" d="m31 30 31-14v54L31 84z"/><path stroke="#8b613f" stroke-width="4" d="m31 46 31-15M31 63l31-15"/><path stroke="#788864" stroke-width="7" d="M38 40V28m0 46V61"/><path stroke="#b87b65" stroke-width="7" d="M47 36V23m9 39V49"/><path stroke="#e6cb89" stroke-width="7" d="M56 31V19m-9 50V56"/>',
    'lounge-chair': '<path fill="#8a966e" d="M25 29q0-10 11-10h29q11 0 11 11v30L52 75 25 61z"/><path fill="#a7ae8a" d="m22 51 29-12 29 15-28 18z"/><path fill="#7d8963" d="M22 44q-8-4-9 5v18l39 20 34-18V52q-1-8-9-4l-4 18-21 11-25-13z"/><path stroke="#8f6448" stroke-width="5" d="M25 75v12m49-13v10"/>',
    'side-table': '<ellipse cx="50" cy="41" rx="29" ry="15" fill="#9d6a48"/><ellipse cx="50" cy="37" rx="29" ry="15" fill="#d3ac78"/><path stroke="#93613f" stroke-width="5" d="M31 47v28m38-28v28M50 51v29"/><path fill="#e8d7b7" d="M44 22h12v15q-5 7-12 0z"/><path fill="none" stroke="#e8d7b7" stroke-width="3" d="M56 26q12-1 6 9h-6"/>',
    'floor-lamp': '<ellipse cx="50" cy="82" rx="19" ry="7" fill="#807653"/><path stroke="#8c7853" stroke-width="4" d="M50 79V30"/><path fill="#dfc890" d="M32 17h36l12 28q-29 15-60 0z"/><ellipse cx="50" cy="17" rx="18" ry="6" fill="#ecdcaf"/><ellipse cx="50" cy="45" rx="30" ry="8" fill="#c5ab73"/>',
    plant: '<path fill="#b58164" d="m33 59 5 25q12 10 25 0l5-25z"/><ellipse cx="50" cy="59" rx="18" ry="7" fill="#d4a384"/><path stroke="#687c4c" stroke-width="3" d="M50 62V20m0 29L30 35m21 5 19-14"/><path fill="#829669" d="M49 38Q22 34 23 15q28-3 26 23M52 48q28 1 30-23-28-2-30 23M50 28Q34 7 50 5q19 6 0 23M46 57Q17 53 21 37q21-4 25 20"/>',
    rug: '<path fill="#c39c74" d="m11 56 43-27 37 23-43 28z"/><path fill="#dfcaa5" d="m17 56 37-22 31 18-37 23z"/><path fill="none" stroke="#b58b67" stroke-width="2" d="m24 55 30-17 24 14-30 18z"/><path stroke="#d5bb94" stroke-width="2" d="m13 60-4 3m11 1-4 3m11 1-4 3m11 1-4 3m11 1-4 3m11 1-4 3"/>',
    ottoman: '<path fill="#b98160" d="M24 43v27q25 22 53 0V43z"/><ellipse cx="50" cy="44" rx="27" ry="18" fill="#d5a17a"/><ellipse cx="50" cy="40" rx="25" ry="14" fill="#dfb18a"/><path fill="none" stroke="#bf8964" stroke-width="1.5" d="m34 36 31 8m-6-12-17 16"/><path stroke="#926549" stroke-width="4" d="M32 74v8m38-8v8"/>',
    'low-cabinet': '<path fill="#c69968" d="m16 40 42-21 26 14-42 22z"/><path fill="#b58658" d="M16 40v29l26 16V55z"/><path fill="#cba374" d="m42 55 42-22v29L42 85z"/><path fill="none" stroke="#9f744b" stroke-width="1.5" d="M63 44v29"/><path stroke="#7b6043" stroke-width="3" d="M57 56v6m11-12v6M24 74v8m52-15v8"/>',
    fireplace: '<path fill="#7c675b" d="m20 39 45-22 19 10v49L40 95 20 83z"/><path fill="#bca48b" d="m17 33 49-24 22 12-49 26z"/><path fill="#998270" d="M17 33v9l22 12v-7l49-26v9L39 54"/><path fill="#392b2c" d="M45 79V59q0-16 13-22 17-8 17 7v20z"/><path fill="#d9873d" d="M50 74q-3-10 4-20 0 7 4 7 0-12 7-19 0 14 4 14 9 12-6 16z"/><path fill="#f9cc76" d="M56 73q-4-8 6-16-1 8 4 9 0 5-10 7z"/><path stroke="#dbc58f" stroke-width="4" d="M31 29V15m45 1V5"/><path fill="#f5dca0" d="M28 14q-1-5 3-8 4 5 2 8zm45-10q-1-5 3-7 4 5 2 7z"/>',
    daybed: '<path fill="#644e56" d="m11 46 52-26 26 15-53 27z"/><path fill="#7b645f" d="M11 46v23l25 15V62zm25 16 53-27v24L36 84z"/><path fill="#ada58a" d="m18 45 45-23 20 12-47 25z"/><path fill="#d5c6a3" d="m48 33 14-7 12 7-14 7z"/><path fill="#b38367" d="m24 43 13-6 12 7-13 7z"/><path fill="#777f69" d="m55 44 17-9 12 7-28 15-13-8 12-6z"/><path stroke="#584047" stroke-width="6" d="M13 54V34m74 9V23M16 73v10m22-3v10m45-30v10"/>',
    'moon-tree': '<path fill="#b18a62" d="m32 62 6 22q12 9 24 0l6-22z"/><ellipse cx="50" cy="62" rx="18" ry="7" fill="#d0b17e"/><path stroke="#8c6b50" stroke-width="4" d="M50 63V21m0 27L27 31m23 8 20-20"/><path fill="#8d9e75" d="M48 35Q22 35 24 14q26-2 24 21m5 9q28-1 28-25-27 1-28 25M48 53Q19 50 20 31q24-2 28 22m3-29Q35 7 50 4q17 5 1 20"/><circle cx="27" cy="26" r="3" fill="#f0c27b"/><circle cx="69" cy="31" r="3" fill="#f0c27b"/><circle cx="33" cy="44" r="3" fill="#f0c27b"/><path fill="#efcf98" d="M55 10a9 9 0 1 0 9 13A9 9 0 0 1 55 10"/>',
    'lantern-cluster': '<path fill="#72543a" d="m19 47 14-7 15 8v31l-15 8-14-8zm35-18 14-7 15 8v43l-15 8-14-8z"/><path fill="#e8b96c" d="m23 49 9 5v26l-9-5zm13 5 8-4v25l-8 5zm22-22 9 5v36l-9-5zm13 5 8-4v35l-8 5z"/><path fill="#bd9157" d="m16 46 17-10 18 11-18 9zm35-18 17-11 18 12-18 10z"/><path fill="none" stroke="#a67a4a" stroke-width="3" d="M27 39v-6q6-9 12 0v6M62 22v-7q6-9 12 0v7"/><path stroke="#fff0ba" stroke-width="3" d="M28 72V60m35 3V45"/>',
    'moon-rug': '<path fill="#685971" d="m9 58 46-30 38 24-46 31z"/><path fill="none" stroke="#c6a66f" stroke-width="2" d="m16 57 39-24 31 19-39 26z"/><path fill="#ddc18a" d="M54 42q-15 1-18 13 9 12 26 3-16 3-16-6 0-6 8-10z"/><path fill="#e4cda0" d="m69 43 1 3 4 1-4 2-1 3-2-3-4-1 4-2zm-43 9 1 3 3 1-3 1-1 3-1-3-3-1 3-1z"/><path stroke="#b99971" stroke-width="2" d="m12 62-4 3m11 1-4 3m11 1-4 3m11 1-4 3m11 1-4 3m11 1-4 3"/>',
  };
  return `<svg class="furniture-art" viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="87" rx="35" ry="6" fill="#8c765714"/>${pieces[type] || pieces.plant}</svg>`;
}

function renderCollection() {
  document.querySelectorAll('[data-collection-tab]').forEach(button => button.setAttribute('aria-pressed', button.dataset.collectionTab === collectionTab));
  const content = $('#collection-content');
  const rememberedFocus = rememberControlFocus(content);
  $('.collection-footnote').textContent = collectionTab === 'presets'
    ? 'Start with a little inspiration, then make every corner your own.'
    : 'Pick a piece to add it. Drag furniture back here to put it away.';
  if (collectionTab === 'presets') {
    content.innerHTML = `<div class="preset-grid">${PRESETS.map((preset, index) => `<article class="preset-card preset-${index}"><div class="preset-art" aria-hidden="true"><span class="preset-window"></span><span class="preset-desk"></span><span class="preset-plant"></span><span class="preset-rug"></span></div><div><h3>${preset.name}</h3><p>${preset.description}</p></div><button class="quiet-button" data-preset="${preset.id}">Apply design ${icon('arrow')}</button></article>`).join('')}</div><p class="preset-note">A fresh arrangement of furniture. Your focus session stays with you, and Undo brings your room back.</p>`;
    content.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => {
      room?.cancelPlacement?.();
      room?.selectItem?.(null);
      selectedItem = null;
      commitLayout(createLayout(button.dataset.preset));
      toast(`${PRESETS.find(preset => preset.id === button.dataset.preset).name} is ready to make your own.`);
      revealRoomForPlacement();
    }));
    restoreControlFocus(content, rememberedFocus);
    return;
  }
  const categories = ['All', ...new Set(FURNITURE.map(item => item.category))];
  const items = FURNITURE.filter(item => category === 'All' || item.category === category);
  content.innerHTML = `<div class="category-list" aria-label="Furniture categories">${categories.map(name => `<button data-category="${name}" aria-pressed="${category === name}">${name}</button>`).join('')}</div><div class="furniture-grid">${items.map(item => `<button class="furniture-card" data-furniture="${item.id}" aria-pressed="${placement?.type === item.id}" aria-label="Place ${item.name}" title="${item.description}">${furnitureArt(item.id)}<span class="furniture-name">${item.name}</span><span class="furniture-detail">${item.category}<span class="furniture-add">${icon('plus')}</span></span></button>`).join('')}</div>`;
  content.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => { category = button.dataset.category; renderCollection(); }));
  content.querySelectorAll('[data-furniture]').forEach(button => button.addEventListener('click', () => {
    if (state.layout.items.length >= MAX_ITEMS) { toast(`Your room has ${MAX_ITEMS} pieces. Remove one to make a little space.`); return; }
    room?.beginPlacement?.(button.dataset.furniture);
    revealRoomForPlacement();
  }));
  restoreControlFocus(content, rememberedFocus);
}

function revealRoomForPlacement() {
  const stage = $('#stage');
  const rect = stage.getBoundingClientRect();
  if (rect.top >= 12 && rect.bottom <= $('#builder-panel').getBoundingClientRect().top) return;
  stage.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}

function updateCatalogSelection() {
  document.querySelectorAll('[data-furniture]').forEach(button => button.setAttribute('aria-pressed', button.dataset.furniture === placement?.type));
}

function renderDragState(drag) {
  const preview = $('#drag-return-preview');
  document.body.classList.toggle('is-dragging-furniture', Boolean(drag));
  document.body.classList.toggle('is-over-collection', Boolean(drag?.overCollection));
  document.body.classList.toggle('return-blocked', Boolean(drag && !drag.removable));
  preview.hidden = !drag?.overCollection || !drag.removable;
  if (!drag) {
    draggedItemId = null; dragHint = ''; renderInspector();
    return;
  }
  if (draggedItemId !== drag.id) {
    draggedItemId = drag.id;
    preview.innerHTML = furnitureArt(drag.type);
    $('#return-label').textContent = drag.removable ? 'Return to your collection' : 'Every room needs a study spot';
    $('#return-detail').textContent = drag.removable ? 'Release here to put this piece away · Undo brings it back' : 'Add another desk before putting this one away';
  }
  if (drag.overCollection) preview.style.transform = `translate3d(${drag.clientX - 44}px, ${drag.clientY - 76}px, 0)`;
  const hint = drag.overCollection ? (drag.removable ? 'Release to put it away · Undo brings it back' : drag.reason)
    : drag.valid ? 'Release to place · R to rotate · Esc to cancel' : `${drag.reason} · Esc to cancel`;
  if (hint !== dragHint) { dragHint = hint; $('#room-hint').textContent = hint; }
}

function renderInspector() {
  const inspector = $('#selection-inspector');
  if (!inspector) return;
  const selected = selectedItem && getFurniture(selectedItem.type);
  const pending = placement && getFurniture(placement.type);
  if (!editMode) {
    $('#room-hint').innerHTML = 'Drag to look around<span>·</span>Try petting the cat';
    return;
  }
  const rememberedFocus = rememberControlFocus(inspector);
  $('#room-hint').textContent = pending ? `Click the floor to place ${pending.name.toLowerCase()}` : selected ? 'Drag to move · Drop over the collection to put away' : 'Hover to discover · Drag a piece to make it yours';
  if (!pending && !selected) {
    inspector.innerHTML = `<div class="selection-copy">${icon('build')}<span><strong>A room that feels like you</strong><small>Drag furniture around your room, or back here to put it away. Pick a piece below to add something new.</small></span></div>`;
    restoreControlFocus(inspector, rememberedFocus);
    return;
  }
  const item = pending || selected;
  const currentDesk = selectedItem?.id === state.layout.activeDeskId;
  const hint = pending ? (placement.valid === false && placement.reason ? placement.reason : 'Move over the floor to find a spot. Click to place.') : 'Drag to move or put away. Arrow buttons work too.';
  inspector.innerHTML = `<div class="selection-copy">${icon(pending ? 'plus' : 'build')}<span><strong>${pending ? 'Placing ' : ''}${item.name}${!pending && currentDesk ? '<span class="active-desk-tag">Study spot</span>' : ''}</strong><small>${hint}</small></span></div><div class="selection-actions"><button class="small-button" id="rotate-item" aria-label="Rotate ${item.name}">${icon('rotate')}<span>Rotate</span></button>${!pending ? `<div class="nudge-buttons" aria-label="Move selected furniture"><button data-nudge="0,-0.25" aria-label="Move toward back wall">↑</button><button data-nudge="-0.25,0" aria-label="Move left">←</button><button data-nudge="0.25,0" aria-label="Move right">→</button><button data-nudge="0,0.25" aria-label="Move toward front">↓</button></div>${item.category === 'Study' ? `<button class="small-button study-here" id="study-here" aria-label="${currentDesk ? 'Studying here' : 'Study here'}" ${currentDesk ? 'disabled' : ''}>${icon('check')}<span>${currentDesk ? 'Studying here' : 'Study here'}</span></button>` : ''}<button class="small-button remove-item" id="remove-item" aria-label="Remove ${item.name}">${icon('trash')}</button>` : ''}<button class="small-button" id="cancel-item" aria-label="${pending ? 'Cancel placement' : 'Deselect furniture'}">${icon('close')}</button></div>`;
  $('#rotate-item').addEventListener('click', () => room?.rotateSelection?.());
  $('#remove-item')?.addEventListener('click', () => room?.removeSelection?.());
  $('#study-here')?.addEventListener('click', () => room?.setActiveDesk?.(selectedItem.id));
  $('#cancel-item').addEventListener('click', () => { room?.cancelPlacement?.(); room?.selectItem?.(null); });
  inspector.querySelectorAll('[data-nudge]').forEach(button => button.addEventListener('click', () => room?.moveSelection?.(...button.dataset.nudge.split(',').map(Number))));
  restoreControlFocus(inspector, rememberedFocus);
}

function renderPerformance() {
  if (currentPanel !== 'performance') return;
  const metrics = $('#performance-metrics');
  if (!metrics || !performanceStats) return;
  const stats = { ...performanceStats, p95: performanceStats.frameIntervalP95 ?? performanceStats.p95FrameMs, cpu: performanceStats.cpuRenderMsP95 ?? performanceStats.submitMs };
  const value = (key, digits = 0) => Number.isFinite(stats[key]) ? Number(stats[key]).toFixed(digits) : '—';
  metrics.innerHTML = `<div><dt>Rendered frames</dt><dd>${value('fps')} <small>fps</small></dd></div><div><dt>95th % frame interval</dt><dd>${value('p95', 1)} <small>ms</small></dd></div><div><dt>${Number.isFinite(stats.cpuRenderMsP95) ? '95th % CPU render' : 'CPU submission'}</dt><dd>${value('cpu', 1)} <small>ms</small></dd></div><div><dt>Draw calls</dt><dd>${value('drawCalls')}</dd></div><div><dt>Triangles</dt><dd>${Number.isFinite(stats.triangles) ? Math.round(stats.triangles).toLocaleString() : '—'}</dd></div><div><dt>Pixel ratio</dt><dd>${value('pixelRatio', 2)}<small>×</small></dd></div>`;
}

function renderPanel() {
  const panel = $('#room-panel');
  panel.hidden = !currentPanel;
  document.querySelectorAll('[data-panel]').forEach(button => button.setAttribute('aria-expanded', button.dataset.panel === currentPanel));
  if (!currentPanel) return;
  panel.innerHTML = `<div class="panel-heading"><span>${currentPanel === 'atmosphere' ? 'Find your kind of quiet' : 'A smoother little room'}</span><button class="icon-button" id="close-panel" aria-label="Close room controls">${icon('close')}</button></div>`;
  if (currentPanel === 'atmosphere') {
    panel.insertAdjacentHTML('beforeend', `<div class="theme-options">${[['day', 'sun', 'Daylight'], ['dusk', 'moon', 'Night'], ['rain', 'rain', 'Rainy afternoon']].map(([key, symbol, title]) => `<button class="theme-option ${key}" data-theme-choice="${key}" aria-pressed="${state.theme === key}">${icon(symbol)}<span>${title}</span></button>`).join('')}</div>`);
    panel.querySelectorAll('[data-theme-choice]').forEach(button => button.addEventListener('click', () => {
      acceptUpdate(store.update(draft => { draft.theme = button.dataset.themeChoice; }));
    }));
    panel.insertAdjacentHTML('beforeend', `<label class="fairy-lights"><span>Fairy lights</span><input type="checkbox" data-decor="lights" ${state.decor.lights ? 'checked' : ''}></label>`);
    panel.querySelector('[data-decor]').addEventListener('change', event => acceptUpdate(store.update(draft => { draft.decor.lights = event.target.checked; })));
  } else {
    panel.insertAdjacentHTML('beforeend', `<div class="quality-options" aria-label="Room rendering quality">${[['auto', 'Adaptive'], ['high', 'Crisp'], ['battery', 'Save energy']].map(([id, label]) => `<button data-quality="${id}" aria-pressed="${quality === id}">${label}</button>`).join('')}</div><p class="performance-note">Adaptive balances detail and motion. Save energy limits animation to 30 frames per second.</p><dl class="performance-metrics" id="performance-metrics"></dl><p class="performance-note">Babylon.js engine · live measurements while this tab is visible. CPU measurements exclude GPU time.</p>`);
    panel.querySelectorAll('[data-quality]').forEach(button => button.addEventListener('click', () => {
      quality = button.dataset.quality;
      room?.setQuality?.(quality);
      panel.querySelectorAll('[data-quality]').forEach(option => option.setAttribute('aria-pressed', option.dataset.quality === quality));
    }));
    renderPerformance();
  }
  $('#close-panel').addEventListener('click', closePanel);
}
function closePanel() {
  const previous = currentPanel; currentPanel = null; renderPanel();
  document.querySelector(`[data-panel="${previous}"]`)?.focus();
}
document.querySelectorAll('[data-panel]').forEach(button => button.addEventListener('click', () => {
  currentPanel = currentPanel === button.dataset.panel ? null : button.dataset.panel;
  renderPanel();
}));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && room?.cancelDrag?.()) { event.preventDefault(); return; }
  if (event.key === 'Escape' && currentPanel) { closePanel(); return; }
  if (!editMode || event.target.closest('input, textarea, select, [contenteditable="true"]') || event.ctrlKey || event.metaKey || event.altKey) return;
  const steps = { ArrowLeft: [-.25, 0], ArrowRight: [.25, 0], ArrowUp: [0, -.25], ArrowDown: [0, .25] };
  if (event.key === 'Escape') { room?.cancelPlacement?.(); room?.selectItem?.(null); }
  else if (event.key.toLowerCase() === 'r' && (placement || selectedItem)) { event.preventDefault(); room?.rotateSelection?.(); }
  else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedItem) { event.preventDefault(); room?.removeSelection?.(); }
  else if (steps[event.key] && selectedItem) { event.preventDefault(); room?.moveSelection?.(...steps[event.key]); }
}, { signal: listeners.signal });

async function toggleSound() {
  try {
    if (!audioContext) {
      audioContext = new AudioContext();
      const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 3, audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      let previous = 0;
      for (let i = 0; i < data.length; i++) { previous = (previous + 0.025 * (Math.random() * 2 - 1)) / 1.025; data[i] = previous * 6; }
      noiseNode = audioContext.createBufferSource(); noiseNode.buffer = buffer; noiseNode.loop = true;
      const filter = audioContext.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1400;
      gainNode = audioContext.createGain(); gainNode.gain.value = 0;
      noiseNode.connect(filter).connect(gainNode).connect(audioContext.destination); noiseNode.start();
    }
    await audioContext.resume();
    soundEnabled = !soundEnabled;
    gainNode.gain.setTargetAtTime(soundEnabled ? Number($('#volume').value) / 130 : 0, audioContext.currentTime, 0.15);
    $('#sound-button').setAttribute('aria-pressed', soundEnabled);
    $('#sound-state').textContent = soundEnabled ? 'Rain is falling' : 'Sound off';
  } catch { toast('Audio isn’t available in this browser. Your quiet room is still here.'); }
}
$('#sound-button').addEventListener('click', toggleSound);
$('#volume').addEventListener('input', event => {
  if (soundEnabled && gainNode) gainNode.gain.setTargetAtTime(Number(event.target.value) / 130, audioContext.currentTime, 0.1);
});
room?.setActivity(companionIntent(state.session));
tick();
const tickInterval = setInterval(tick, 500);
function refreshState() {
  applyState(store.refresh());
  tick();
}
window.addEventListener('storage', event => {
  if (event.key === storageKey || event.key === null) refreshState();
}, { signal: listeners.signal });
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshState(); }, { signal: listeners.signal });

if (import.meta.hot) import.meta.hot.dispose(() => {
  listeners.abort();
  clearInterval(tickInterval);
  clearTimeout(toastTimeout);
  clearTimeout(petTimeout);
  room?.dispose?.();
  noiseNode?.stop();
  audioContext?.close();
});
