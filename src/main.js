import './style.css';
import { createRoom } from './room.js';
import { createSession, remainingAt, formatTime, sessionPhase, displayedRemaining } from './session.js';
import { createStateStore, localDate, storageKey } from './state.js';
import { FURNITURE, getFurniture } from './catalog.js';
import { PRESETS, normalizeLayout, MAX_ITEMS, pieceCount, roomDesign } from './layout.js';
import { companionIntent } from './companion.js';
import { PETS } from './pet.js';
import { createSpeech, PET_LINES, AVATAR_LINES } from './speech.js';
import { ARTWORKS, SLEEVES, artName } from './art.js';
import { tintsFor } from './tints.js';
import { surfaceChoices } from './surfaces.js';
import { designPaint } from './architecture.js';
import { createHouseUI } from './house-ui.js';
import { activeHouseRoom, nextExpansion, focusCoins } from './house.js';
import { createHouseView } from './house-view.js';

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
const store = createStateStore((import.meta.env.DEV && window.__littleHoursTest?.storage) || {
  getItem: key => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
});
let state = store.state;
let room;
let houseUI;
let houseOpen = false;
let connectedView = null, connectionsKey = '', travelTimer = 0, arrivalTimer = 0, travelling = false, doorWalking = false;
let currentPanel = null;
let compact = false;
let audioContext, noiseNode, gainNode;
let soundEnabled = false;
let storageWarningShown = false;
let toastTimeout;
let speech = null;
let lastAvatarLine = 0;
let hiddenSince = 0;
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
let lastCompanionIntent = null;
let draggedItemId = null;
let dragHint = '';
let companionActivity = 'idle';
const listeners = new AbortController();

document.querySelector('#app').innerHTML = `
  <div class="app-shell">
    <header class="app-header">
      <a class="brand" href="/" aria-label="Little Hours home"><span class="brand-mark">${icon('home')}</span><span>little hours<span class="brand-dot">.</span></span></a>
      <div class="header-right"><button class="coin-wallet" id="coin-wallet" aria-label="Your house and coins">${icon('sun')}<span id="coin-balance">0</span><span>coins</span></button><button class="time-toggle" id="time-toggle" aria-label="Switch to daylight" title="Switch to daylight">${icon('moon')}<span>Night</span></button><button class="focus-toggle" id="focus-toggle" aria-expanded="true" aria-controls="focus-card" aria-label="Hide focus panel">${icon('clock')}<span>Focus</span><span id="dock-timer">25:00</span></button></div>
    </header>
    <main class="workspace">
      <section id="room-section" class="room-section" aria-labelledby="room-title">
        <div class="room-heading"><div><p class="eyebrow">YOUR QUIET LITTLE WORLD</p><h1 id="room-title">The twilight retreat</h1><p class="room-subtitle" id="room-subtitle">The fire is warm. The night is yours.</p></div><div class="heading-actions"><button class="mode-button" id="rooms-button" aria-label="Visit your house" aria-controls="house-page">${icon('home')}<span>House</span></button><button class="mode-button" id="decorate-button" aria-pressed="false" aria-controls="builder-panel">${icon('build')}<span>Decorate</span></button><button class="icon-button" id="reset-view" aria-label="Reset room view">${icon('reset')}</button></div></div>
        <nav id="home-connections" class="home-connections" aria-label="Move around your house"></nav>
        <div class="stage" id="stage">
          <div class="room-canvas" id="room-canvas" aria-label="Interactive 3D cutaway study room with a desk, bookshelf, plants and a pet. Drag to turn the room."></div>
          <div id="house-in-room" class="house-in-room" hidden></div>
          <div id="room-travel" class="room-travel" role="status" hidden><span>✧</span><strong id="travel-label"></strong><small>A different corner of home.</small></div>
          <div class="loading-note" id="loading-note">Making room for you…</div>
          <div class="stage-presence" id="stage-presence" data-presence="idle" role="status" aria-live="polite" aria-atomic="true" aria-label="Your local focus status: In your room" title="Your focus status in this browser."><span id="presence-icon" aria-hidden="true">${icon('home')}</span><span id="room-status">In your room</span></div>
          <div class="companion-status" id="companion-status" data-state="idle" role="status" aria-live="polite"><span aria-hidden="true">✧</span><span id="companion-status-text">Companion · Ready at the desk</span></div>
          <div class="mini-caption" id="mini-caption" hidden>Mini view preview · inside this page</div>
          <div class="room-hint" id="room-hint">Drag to look around<span>·</span>Tap a lamp, the fire or the cat</div>
        </div>
        <div class="room-bottom">
          <div class="room-company">${icon('cat')}<span id="pet-company">You & Miso</span></div>
          <nav class="room-tools" aria-label="Room controls">
            <button class="tool" data-panel="atmosphere" aria-expanded="false" aria-controls="room-panel">${icon('sun')}<span>Atmosphere</span></button>
            <button class="tool" data-panel="performance" aria-expanded="false" aria-controls="room-panel">${icon('gauge')}<span>Performance</span></button>
            <button class="tool" id="pet-button" data-panel="pet" aria-expanded="false" aria-controls="room-panel">${icon('cat')}<span id="pet-button-label">Miso</span></button>
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
      <section id="house-page" class="house-page" aria-label="Your growing house" hidden></section>
      <aside class="focus-card" id="focus-card" aria-labelledby="focus-title">
        <div class="card-top"><span class="eyebrow">YOUR QUIET CHAPTER</span><span class="tiny-flower" aria-hidden="true">✳</span></div>
        <h2 id="focus-title">Stay a <em>while.</em></h2>
        <label class="field-label" for="task">What are you working on?</label>
        <input id="task" maxlength="180" placeholder="One thing, for now…" autocomplete="off" />
        <div class="timer-area"><span id="session-label" class="session-label">SETTLE IN</span><div id="timer" class="timer" role="timer" aria-label="25 minutes remaining">25:00</div><div class="durations" aria-label="Focus duration"><button data-minutes="25" aria-pressed="true">25 min</button><button data-minutes="50" aria-pressed="false">50 min</button><button data-minutes="90" aria-pressed="false">90 min</button></div></div>
        <button class="start-button" id="start-button"><span>Start focusing</span>${icon('arrow')}</button>
        <button class="reset-session" id="reset-session" hidden>Reset session</button>
        <div class="sound-row"><button id="sound-button" class="sound-button" aria-pressed="false">${icon('rain')}<span>Soft rain<span class="sound-state" id="sound-state">Sound off</span></span><span class="sound-switch" aria-hidden="true"></span></button><label class="sr-only" for="volume">Rain volume</label><input type="range" id="volume" min="0" max="100" value="30" aria-label="Rain volume" /></div>
        <div id="focus-reward" class="focus-reward"></div>
        <div class="daily-note" id="daily-note">Good things begin with a little time.</div>
      </aside>
    </main>
    <footer class="app-footer"><span>A softer place to spend your hours.</span><span>Your room is saved as you go <span aria-hidden="true">✧</span></span></footer>
  </div>
  <div id="drag-return-preview" class="drag-return-preview" aria-hidden="true" hidden></div>
  <div id="toast" class="toast" role="status" hidden></div>`;

const $ = (selector) => document.querySelector(selector);
$('#task').value = state.task;
function toast(message, warning = false) {
  $('#toast').textContent = message;
  $('#toast').classList.toggle('is-warning', warning);
  $('#toast').setAttribute('role', warning ? 'alert' : 'status');
  $('#toast').hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { $('#toast').hidden = true; }, 4200);
}
function cancelDoorTravel(message) {
  if (!doorWalking) return false;
  doorWalking = false; travelling = false;
  clearTimeout(travelTimer); travelTimer = 0;
  $('#room-travel').hidden = true; document.body.classList.remove('is-travelling', 'is-door-walking');
  room?.setDoorActive?.(null);
  room?.setDoorOpen?.(null);
  room?.cancelDoorWalk?.({ returnToDesk: true });
  renderSession();
  if (message) toast(message, true);
  return true;
}
const themeCopy = {
  dusk: 'The candles are lit. Stay a little longer.',
  rain: 'Raindrops, candlelight, and nowhere else to be.',
  day: 'Sunlight on the books. A fresh little chapter.',
};
function renderRoomHeading() {
  const design = roomDesign(state.layout), entry = activeHouseRoom(state.house);
  $('#room-title').textContent = connectedView ? state.house.name : entry.name === 'Your studio' ? design.name : entry.name;
  $('#room-subtitle').textContent = connectedView ? 'Your rooms, together. Choose a corner to step inside.' : design.style ? ({ sakura: 'Soft light. Cherry blossoms. Room to breathe.', cloud: 'Head in the clouds. Feet on a soft little rug.', metro: 'The city hums. Your little corner is quiet.' })[design.style] : themeCopy[state.theme];
}
function applyState(next, force = false) {
  const previous = state;
  state = next;
  if (doorWalking) {
    if (state.session.running) cancelDoorTravel('Focusing started in another tab, so the walk to the door stopped.');
    else if (previous.house.activeId !== state.house.activeId || JSON.stringify(previous.layout) !== JSON.stringify(state.layout)) cancelDoorTravel('Your room changed. Tap the door again when you’re ready.');
  }
  const design = roomDesign(state.layout);
  document.body.dataset.design = design.style || 'retreat';

  $('#coin-balance').textContent = state.house.coins;
  $('#coin-wallet').setAttribute('aria-label', `${state.house.coins} coins · Visit your house`);
  renderFocusReward();
  houseUI?.render();
  room?.setHouse(state.house);
  renderConnections();
  // An open Atmosphere panel keeps its lights label in step with the room.
  const lightsLabel = $('#room-panel .fairy-lights span');
  if (lightsLabel) lightsLabel.textContent = design.style ? 'Accent lights' : 'Fairy lights';
  renderRoomHeading();
  if (force || previous.theme !== state.theme) {
    document.body.dataset.theme = state.theme;
    room?.setTheme(state.theme);
    const [symbol, label] = state.theme === 'day' ? ['sun', 'Daylight'] : state.theme === 'rain' ? ['rain', 'Rain'] : ['moon', 'Night'];
    const nextLabel = state.theme === 'day' ? 'Switch to night' : 'Switch to daylight';
    $('#time-toggle').innerHTML = `${icon(symbol)}<span>${label}</span>`;
    $('#time-toggle').setAttribute('aria-label', nextLabel);
    $('#time-toggle').title = nextLabel;
  }
  if ($('#task').value !== state.task) $('#task').value = state.task;
  if (force || previous.pet !== state.pet) { room?.setPet?.(state.pet); renderPetName(); renderInspector(); }
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
  $('#item-count').textContent = `${pieceCount(state.layout.items)} / ${MAX_ITEMS} pieces`;
  syncCompanionIntent();
  document.querySelectorAll('[data-theme-choice]').forEach(button => button.setAttribute('aria-pressed', button.dataset.themeChoice === state.theme));
  document.querySelectorAll('[data-decor]').forEach(input => { input.checked = state.decor[input.dataset.decor]; });
}
// The companion speaks at the edges of focus and when tapped, never while
// you focus, in Decorate or in the mini view, and not more than once every
// twelve seconds on its own. An activity line may follow the pause line
// sooner (`gap`), since it marks a new thing to see.
function avatarSay(kind, { force = false, gap = 12_000 } = {}) {
  if (!speech || editMode || compact || (!force && Date.now() - lastAvatarLine < gap)) return;
  if (speech.say('avatar', Array.isArray(kind) ? kind : AVATAR_LINES[kind])) lastAvatarLine = Date.now();
}
function acceptUpdate(result) {
  applyState(result.state);
  if (result.completed) {
    room?.pet(); avatarSay('finish', { force: true });
    toast(`+${result.earned} coins for your house. A little progress, made.`);
  }
  if (!result.persisted && !storageWarningShown) {
    storageWarningShown = true;
    toast('Your browser couldn’t save this visit. The room still works.');
  }
  renderSession();
}
// A pet gets a cute line in a bubble just above its head.
function petFeedback({ species = state.pet, state: mood, by = 'you' } = {}) {
  const lines = PET_LINES[species] || PET_LINES.cat;
  if (speech) speech.say('pet', by === 'companion' ? lines.friend : mood === 'sleeping' ? lines.sleepy : lines.pet);
  else toast(`${PETS[species]?.name || 'Miso'} is happy you’re here.`);
}
// The room's accessible name says how to use it, with the current pet.
function renderRoomLabel() {
  const pet = state.pet === 'dog' ? 'Mochi the puppy' : 'Miso the ginger cat';
  $('#room-canvas').setAttribute('aria-label', editMode
    ? 'Room decorator. Hover to outline furniture, then drag to move it. Drop a piece over the bottom collection to put it away. Drag empty space to turn the room. Escape cancels.'
    : `Interactive 3D cutaway study room. Drag to turn the room. Tap a lamp, the fire or the record player to switch it, tap your companion or ${pet}, or tap a built doorway to walk to another room while your focus timer is paused.`);
}
function renderPetName() {
  const name = PETS[state.pet]?.name || PETS.cat.name; renderRoomLabel();
  $('#pet-company').textContent = `You & ${name}`; $('#pet-button-label').textContent = name;
  $('#pet-button').setAttribute('aria-label', `${name}: pet or choose your pet`);
}
// The decorator needs a ready room: both entry buttons wait for it.
const setDecorEntry = enabled => { $('#decorate-button').disabled = !enabled; $('#rooms-button').disabled = !enabled; };
try {
  setDecorEntry(false);
  room = createRoom($('#room-canvas'), {
    onReady() {
      $('#loading-note').hidden = true;
      setDecorEntry(true);
      // Back after half an hour or more: a small hello.
      if (state.seenAt && Date.now() - state.seenAt > 30 * 60_000) setTimeout(welcome, 1200);
    },
    onCompanionTap({ state: activity, activity: doing }) {
      const lines = (activity === 'busy' || (activity === 'resting' && doing === 'read')) ? AVATAR_LINES.activity[doing] : AVATAR_LINES.tap[activity];
      if (speech && speech.say('avatar', lines || AVATAR_LINES.tap.idle)) lastAvatarLine = Date.now();
    },
    pet: state.pet,
    onPet: petFeedback,
    onPetCarry({ species, held }) { if (held) speech?.say('pet', (PET_LINES[species] || PET_LINES.cat).carry); },
    onFrame() { speech?.update(); },
    onCompanionState({ state: activity, activity: doing }) {
      companionActivity = activity;
      const labels = { idle: 'Ready at the desk', working: 'Working alongside you', walking: 'Finding a cozy spot', returning: 'Back to the desk', resting: 'Taking a breather', sleeping: 'Dozing off', 'resting-at-desk': 'Resting at the desk', busy: 'Taking a little break', 'at-door': 'At the doorway' };
      const pet = PETS[state.pet]?.name || PETS.cat.name;
      const tasks = { warm: 'Warming up by the fire', window: 'Looking out of the window', water: 'Watering the plants', record: 'Putting on a record', pet: `Petting ${pet}`, lamp: 'Switching on a lamp', read: 'Reading in the armchair' };
      const task = (activity === 'busy' || (activity === 'resting' && doing === 'read')) && tasks[doing];
      $('#companion-status').dataset.state = activity;
      $('#companion-status-text').textContent = `Companion · ${task || labels[activity] || 'In the room'}`;
      renderCompanionNote();
      if (activity === 'busy' && AVATAR_LINES.activity[doing]) avatarSay(AVATAR_LINES.activity[doing], { gap: 4000 });
      else if (activity === 'resting') avatarSay(doing === 'read' ? AVATAR_LINES.activity.read : 'rest');
      else if (activity === 'sleeping') avatarSay('doze');
    },
    // A switched lamp or fire saves with the room, but it is not an Undo step.
    onLayoutChange(layout, { remember = true } = {}) {
      roomLayoutSignature = JSON.stringify(layout);
      commitLayout(layout, remember);
    },
    onToggleLights() { acceptUpdate(store.update(draft => { draft.decor.lights = !draft.decor.lights; })); },
    onSelectionChange(item) { selectedItem = item; renderInspector(); },
    onPlacementState(next) { placement = next; renderInspector(); updateCatalogSelection(); },
    isCollectionDrop(x, y) {
      if (!editMode) return false;
      const rect = $('#builder-panel').getBoundingClientRect();
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    },
    onDragState: renderDragState,
    onHouseNavigate: visitDoor,
    onHouseHover(id) {
      document.querySelectorAll('[data-house-go]').forEach(button => button.classList.toggle('door-hover', button.dataset.houseGo === id));
    },
    onNotice: toast,
    onStats(stats) { performanceStats = stats; renderPerformance(); },
  });
  const speechLayer = document.createElement('div'); speechLayer.className = 'speech-layer';
  $('#room-canvas').appendChild(speechLayer);
  speech = createSpeech(speechLayer, { anchor: who => room?.anchor(who), reducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches });
} catch (error) {
  $('#loading-note').textContent = 'The room couldn’t load. Try reloading; your focus timer is still ready.';
  console.error('Could not create the room:', error);
  setDecorEntry(false);
}
applyState(state, true);
houseUI = createHouseUI($('#house-page'), {
  store, acceptUpdate, art: roomDesignArt, icon, notice: toast,
  onClose: () => setHouseOpen(false),
  onEnter: visitRoom,
  onFocus: () => { setHouseOpen(false); focusCollapsed = false; syncFocusDock(); revealFocusDock(); $('#start-button').focus(); },
});
function setHouseOpen(open, selectedId) {
  if (travelling || open === houseOpen) return;
  if (open) {
    setConnectedView(false);
    if (editMode) setEditMode(false);
    currentPanel = null; renderPanel();
  }
  houseOpen = open;
  document.body.classList.toggle('is-house', open);
  $('#room-section').hidden = open;
  room?.setSuspended(open);
  if (open) { houseUI.show(selectedId); $('#back-to-room').focus({ preventScroll: true }); }
  else { houseUI.hide(); $('#rooms-button').focus({ preventScroll: true }); }
  syncFocusDock();
}
function renderConnections(updateModel = true) {
  connectedView?.setFocused(state.session.running);
  const key = JSON.stringify([state.house, state.theme, Boolean(connectedView)]);
  if (connectionsKey === key) return;
  connectionsKey = key;
  const nav = $('#home-connections'); nav.replaceChildren();
  const caption = document.createElement('span'); caption.className = 'home-address'; caption.textContent = state.house.name; nav.append(caption);
  for (const entry of state.house.rooms) {
    const button = document.createElement('button'); button.dataset.houseGo = entry.id;
    button.textContent = entry.name; button.setAttribute('aria-current', entry.id === state.house.activeId && !connectedView ? 'location' : 'false');
    button.addEventListener('click', () => visitRoom(entry.id)); nav.append(button);
  }
  const next = nextExpansion(state.house);
  if (next) {
    const button = document.createElement('button'); button.className = 'home-next'; button.dataset.houseGo = next.id;
    button.textContent = state.house.coins >= next.price ? `＋ Build ${next.short}` : `＋ ${next.short} · ${state.house.coins}/${next.price}`;
    button.addEventListener('click', () => visitRoom(next.id)); nav.append(button);
  }
  const wide = document.createElement('button'); wide.className = 'home-wide'; wide.textContent = connectedView ? 'Back to my room' : 'See connected house'; wide.setAttribute('aria-pressed', String(Boolean(connectedView)));
  wide.addEventListener('click', () => setConnectedView(!connectedView)); nav.append(wide);
  if (connectedView && updateModel) connectedView.update(state.house, state.house.activeId, state.theme);
}
function setConnectedView(open) {
  if (travelling || open === Boolean(connectedView)) return;
  if (open && editMode) setEditMode(false);
  if (open) {
    $('#house-in-room').hidden = false;
    connectedView = createHouseView($('#house-in-room'), { house: state.house, selectedId: state.house.activeId, theme: state.theme, focused: state.session.running, onSelect: visitRoom });
  } else { connectedView.dispose(); connectedView = null; $('#house-in-room').hidden = true; }
  $('#room-canvas').hidden = open;
  document.body.classList.toggle('is-connected', open); renderRoomHeading();
  room?.setSuspended(open); syncFocusDock(); connectionsKey = ''; renderConnections(false);
}
function visitRoom(id, decorate = editMode, fromDoor = false) {
  if (travelling && !fromDoor) return;
  if (!fromDoor && id !== state.house.activeId) {
    acceptUpdate(store.update());
    if (state.session.running) { toast('Pause your focus session before walking to another room.', true); return; }
  }
  const entry = state.house.rooms.find(room => room.id === id);
  if (!entry) { setHouseOpen(true, id); return; }
  if (!fromDoor) setConnectedView(false);
  if (houseOpen) setHouseOpen(false);
  if (editMode) setEditMode(false);
  const arrive = () => {
    room?.cancelPlacement(); room?.selectItem(null); selectedItem = null; undoLayout = null; $('#undo-layout').disabled = true;
    acceptUpdate(store.enterHouseRoom(id));
    if (decorate) { collectionTab = 'collection'; setEditMode(true); }
    $('#room-travel').hidden = true; document.body.classList.remove('is-travelling', 'is-door-walking'); travelling = false; renderSession();
    $('#stage').classList.remove('room-arrival'); void $('#stage').offsetWidth; $('#stage').classList.add('room-arrival');
    clearTimeout(arrivalTimer); arrivalTimer = setTimeout(() => $('#stage').classList.remove('room-arrival'), 650);
  };
  if (id === state.house.activeId || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { arrive(); return; }
  travelling = true; $('#travel-label').textContent = `On to ${entry.name}`; $('#room-travel small').textContent = 'A different corner of home.'; $('#room-travel').hidden = false; document.body.classList.add('is-travelling'); renderSession();
  travelTimer = setTimeout(arrive, 220);
}
function visitDoor(id) {
  if (travelling) return;
  acceptUpdate(store.update());
  if (state.session.running) { toast('Pause your focus session before walking to another room.', true); return; }
  const entry = state.house.rooms.find(room => room.id === id);
  if (!entry) { setHouseOpen(true, id); return; }
  doorWalking = true; travelling = true;
  $('#travel-label').textContent = `Walking to ${entry.name}`;
  $('#room-travel small').textContent = 'A little walk through your home.';
  $('#room-travel').hidden = false; document.body.classList.add('is-travelling', 'is-door-walking'); renderSession();
  room?.setDoorActive?.(id);
  const started = room?.walkToDoor?.(id, result => {
    if (result?.cancelled) { cancelDoorTravel('Your room changed. Tap the door again when you’re ready.'); return; }
    if (!doorWalking) return;
    doorWalking = false;
    room?.setDoorActive?.(null);
    document.body.classList.remove('is-door-walking');
    $('#travel-label').textContent = `On to ${entry.name}`;
    $('#room-travel small').textContent = 'A different corner of home.';
    visitRoom(id, false, true);
  }, () => room?.setDoorOpen?.(id));
  if (!started) {
    cancelDoorTravel();
    toast('There isn’t a clear path to that door. Move a little furniture and try again.', true);
  }
}
function renderFocusReward() {
  const reward = focusCoins(state.session.duration / 60_000), next = nextExpansion(state.house);
  const name = next?.id === 'garden' ? 'garden wing' : 'upstairs hideaway';
  const progress = !next ? 'A little more saved for your home' : state.house.coins >= next.price ? `Your ${name} is ready to build` : `${next.price - state.house.coins} coins to your ${name}`;
  $('#focus-reward').innerHTML = `${icon('sun')}<span><strong>+${reward} coins when you finish</strong>${progress}</span>`;
}


// Tell the room only when the companion's intent changes, not on every key
// press, storage refresh or timer tick; each call also requests a frame.
function syncCompanionIntent() {
  const intent = companionIntent(state.session);
  if (!room || intent === lastCompanionIntent) return;
  lastCompanionIntent = intent; room?.setActivity(intent);
}
function renderCompanionNote() {
  const minutes = state.history.filter(h => h.date === localDate()).reduce((sum, h) => sum + h.minutes, 0);
  const notes = { idle: 'Start focusing to work alongside your companion.', working: 'Your companion is working alongside you.', walking: 'A little stretch. Your companion is finding a cozy spot.', returning: 'Your companion is on the way back to the desk.', resting: 'A soft seat and a little breather. Take your time.', sleeping: 'Your companion has drifted off. Resume whenever you’re ready.', 'resting-at-desk': 'Your companion is taking a quiet break at the desk.', busy: 'Your companion is tending to the room.', 'at-door': 'Your companion is ready at the doorway.' };
  $('#daily-note').textContent = minutes ? `${minutes} quiet minutes made today. Look at you go.` : notes[companionActivity];
}
function renderSession() {
  const ms = displayedRemaining(state.session);
  const formatted = formatTime(ms);
  const presence = sessionPhase(state.session);
  syncCompanionIntent();
  const today = localDate();
  const minutes = state.history.filter(h => h.date === today).reduce((sum, h) => sum + h.minutes, 0);
  const renderKey = `${formatted}:${presence}:${state.session.duration}:${today}:${minutes}:${travelling}`;
  // The clock polls for deadlines twice a second, but idle rooms and unchanged
  // displayed seconds do not need another set of DOM mutations.
  $('#start-button').disabled = travelling;
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
  if (travelling) { toast('Please wait until you arrive before starting a focus session.', true); return; }
  const resuming = !state.session.running && remainingAt(state.session) > 0 && remainingAt(state.session) < state.session.duration;
  // Preserve the action shown on the button if the deadline just passed.
  acceptUpdate(store.setRunning(!state.session.running));
  if (state.session.running) avatarSay(resuming ? 'resume' : 'start', { force: true });
  else if (remainingAt(state.session) > 0) avatarSay('pause', { force: true });
});
$('#reset-session').addEventListener('click', () => {
  acceptUpdate(store.update(draft => { draft.session = createSession(draft.session.duration / 60000); }));
  // Reset hides itself; keep keyboard and screen-reader focus on the timer.
  if ($('#reset-session').hidden) $('#start-button').focus();
});
document.querySelectorAll('[data-minutes]').forEach(button => button.addEventListener('click', () => {
  // Choosing the duration that is already selected must not erase a paused session.
  acceptUpdate(store.update(draft => {
    const minutes = Number(button.dataset.minutes);
    if (!draft.session.running && (minutes * 60_000 !== draft.session.duration || draft.session.remaining === 0)) draft.session = createSession(minutes);
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
  if (houseOpen || connectedView) {
    if (houseOpen) setHouseOpen(false);
    if (connectedView) setConnectedView(false);
    focusCollapsed = false; syncFocusDock(); revealFocusDock(); return;
  }
  if (editMode) { focusCollapsed = false; setEditMode(false); }
  else { focusCollapsed = !focusCollapsed; syncFocusDock(); }
  if (!focusCollapsed) revealFocusDock();
});
$('#rooms-button').addEventListener('click', () => setHouseOpen(true));
$('#coin-wallet').addEventListener('click', () => setHouseOpen(!houseOpen));
$('#decorate-button').addEventListener('click', () => setEditMode(!editMode));
$('#mini-button').addEventListener('click', () => {
  if (editMode) setEditMode(false);
  compact = !compact;
  $('#stage').classList.toggle('is-mini', compact);
  $('#mini-button').setAttribute('aria-pressed', compact);
  $('#mini-caption').hidden = !compact;
  $('#mini-button span').textContent = compact ? 'Full room' : 'Mini view';
});

function setEditMode(enabled) {
  if (travelling) return;
  if (enabled && !room) return;
  if (enabled && connectedView) setConnectedView(false);
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
  renderRoomLabel();
  currentPanel = null;
  renderPanel();
  room?.setEditMode?.(enabled);
  if (!enabled) { placement = null; selectedItem = null; }
  renderInspector();
  if (enabled) { renderCollection(); revealRoomForPlacement(); }
}

function syncFocusDock() {
  const visible = !houseOpen && !connectedView && !editMode && !focusCollapsed;
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
  for (const key of ['category', 'furniture', 'preset', 'resetDesign', 'nudge', 'art', 'tint', 'walls', 'floor']) {
    if (active.dataset?.[key] !== undefined) return { key, value: active.dataset[key] };
  }
  return null;
}

function restoreControlFocus(container, remembered) {
  if (!remembered) return;
  const controls = [...container.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"]')];
  const matching = controls.find(control => remembered.id ? control.id === remembered.id : control.dataset[remembered.key] === remembered.value)
    || (remembered.key === 'preset' && controls.find(control => control.dataset.resetDesign === remembered.value));
  // If removal also removes its control, keep keyboard navigation in the editor.
  (matching || controls[0] || $('#decorate-button')).focus({ preventScroll: true });
}

function commitLayout(layout, remember = true) {
  const next = normalizeLayout(layout);
  if (JSON.stringify(next) === JSON.stringify(state.layout)) return;
  if (remember) undoLayout = structuredClone(state.layout);
  acceptUpdate(store.saveLayout(next, state.house.activeId));
  $('#undo-layout').disabled = !undoLayout;
  renderInspector();
}

$('#undo-layout').addEventListener('click', () => {
  if (!undoLayout) return;
  const previous = undoLayout;
  undoLayout = null;
  room?.cancelPlacement?.();
  room?.selectItem?.(null);
  const hadFocus = document.activeElement === $('#undo-layout');
  commitLayout(previous, false);
  $('#undo-layout').disabled = true;
  // A disabled button drops focus to the page; keep it in the collection tabs.
  if (hadFocus) document.querySelector('[data-collection-tab][aria-pressed="true"]')?.focus();
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
    // Wall pieces are drawn face on, with a soft shadow on the wall behind them.
    'tall-frame': '<rect class="art-shadow" x="34" y="17" width="36" height="52" rx="2" fill="#8c765722"/><rect x="31" y="14" width="36" height="52" rx="2" fill="#6b4b3b"/><rect x="35.5" y="18.5" width="27" height="43" fill="#e9d9b7"/><circle cx="49" cy="31" r="7" fill="#9b784d"/><circle cx="51.5" cy="29.5" r="6" fill="#e9d9b7"/><path fill="none" stroke="#6e815b" stroke-width="1.6" d="M47 57q5-7-1-13"/><path fill="#899872" d="M46 54q-6-1-6 3 5 1 6-3m1-4q6-2 7 2-5 2-7-2m-2-4q-6-1-6 3 5 1 6-3"/>',
    'small-frame': '<rect class="art-shadow" x="39" y="25" width="26" height="36" rx="2" fill="#8c765722"/><rect x="36" y="22" width="26" height="36" rx="2" fill="#ac8357"/><rect x="39.5" y="25.5" width="19" height="29" fill="#e9d9b7"/><circle cx="48" cy="33" r="4.5" fill="#9b784d"/><circle cx="49.8" cy="32" r="3.8" fill="#e9d9b7"/><path fill="none" stroke="#6e815b" stroke-width="1.3" d="M47.5 52q3-4-1-9"/><path fill="#899872" d="M47 50q-4 0-4 2 3 1 4-2m.5-3q4-1 4.5 1.5-3.5 1-4.5-1.5"/>',
    'wide-frame': '<rect class="art-shadow" x="23" y="27" width="58" height="38" rx="2" fill="#8c765722"/><rect x="20" y="24" width="58" height="38" rx="2" fill="#6b4b3b"/><rect x="24.5" y="28.5" width="49" height="29" fill="#efcfb2"/><circle cx="61" cy="36" r="3.5" fill="#fbeed2"/><path fill="#b79bc6" d="M24.5 50q10-9 20-3t29-2v12.5h-49z"/><path fill="#879771" d="M24.5 54q14-7 26-2t23 1v4.5h-49z"/>',
    'moon-clock': '<path class="art-shadow" fill="#8c765722" d="M44 45h18v36q-9 6-18 0zm25-12a16 16 0 1 1-32 0 16 16 0 0 1 32 0"/><path fill="#7a5a3e" d="M41 42h18v36q-9 6-18 0z"/><circle cx="50" cy="30" r="16" fill="#bf9762"/><circle cx="50" cy="30" r="12.5" fill="#f4e9cc"/><path fill="#d9b978" d="M45 25a6.5 6.5 0 1 0 9 8 5.5 5.5 0 0 1-9-8"/><path stroke="#5a4636" stroke-width="1.6" stroke-linecap="round" d="M50 30v-8m0 8 5 3"/><path stroke="#c49a5c" stroke-width="1.4" d="M50 46v21"/><circle cx="50" cy="70" r="4" fill="#d9b370"/>',
    'wall-clock': '<circle class="art-shadow" cx="53" cy="46" r="23" fill="#8c765722"/><circle cx="50" cy="43" r="23" fill="#bea0c6"/><circle cx="50" cy="43" r="19" fill="#f6efe2"/><path stroke="#50453d" stroke-width="2.4" stroke-linecap="round" d="M50 27v3m0 26v3M34 43h3m26 0h3"/><path fill="none" stroke="#50453d" stroke-width="2.6" stroke-linecap="round" d="M50 43v-12m0 12 7 4"/><path stroke="#c8674f" stroke-width="1.2" stroke-linecap="round" d="M50 47v-16"/><circle cx="50" cy="43" r="2" fill="#50453d"/>',
    'apothecary-shelf': '<rect class="art-shadow" x="20" y="62" width="64" height="7" rx="1.5" fill="#8c765722"/><rect x="17" y="59" width="64" height="7" rx="1.5" fill="#926747"/><path fill="#7a5539" d="M23 66h7l-7 9zm45 0h7v9z"/><path fill="#879771" d="M27 40h5v5a7 7 0 1 1-5 0z"/><path fill="#e0b56e" d="M41 38h7v4q3 1 3 4v13H38V46q0-3 3-4z"/><path fill="#8a5a7a" d="M58 44h4v2.5a6.5 6.5 0 1 1-4 0z"/><path fill="#6d8f8a" d="M69 42h6v17h-6z"/><path fill="#c8a27a" d="M26.5 37h6v3h-6zm14-2.5h7v3.5h-7zm17 7h5v3h-5zm11-2.5h7v3h-7z"/>',
    'wall-shelf': '<rect class="art-shadow" x="18" y="61" width="68" height="6" rx="1.5" fill="#8c765722"/><rect x="15" y="58" width="68" height="6" rx="1.5" fill="#aa7954"/><path fill="#788864" d="M22 36h6v22h-6z"/><path fill="#b87b65" d="M28.5 39h6v19h-6z"/><path fill="#e6cb89" d="m35 41 5.5-1.5 5 17.5-5.5 1.5z"/><path fill="#f4e9cc" d="M52 47h6v11h-6z"/><path fill="#f9cc76" d="M55 45q-2-3 0-6 2 3 0 6"/><path fill="#b58164" d="M64 50h14l-2 8H66z"/><path fill="#829669" d="M66 50q-4-8 4-9-1 6-4 9m6 0q3-9 9-6-5 3-9 6m-4 12q-5 7-2 13 4-6 2-13m8 1q2 8-3 12 0-7 3-12"/>',
    'hanging-plant': '<path fill="none" stroke="#b08a52" stroke-width="2.5" stroke-linecap="round" d="M30 16v8h24m-2 0v6"/><path class="art-shadow" fill="#8c765722" d="M43 33h24l-3 16H47z"/><path fill="#b58164" d="M40 30h24l-3 16H44z"/><path fill="#9a6a50" d="M40 30h24v3H40z"/><path fill="#829669" d="M42 31q-6-7 1-11 2 6-1 11m8-2q-1-9 6-10-1 7-6 10m8 2q4-8 10-5-4 4-10 5M45 45q-7 8-4 18 5-8 4-18m7 1q-1 12 3 19 3-10-3-19m8-1q6 8 4 16-5-7-4-16"/>',
    'cloud-shelf': `<path class="art-shadow" fill="#8c765722" d="M17 58h72v5${'q-4.5 6-9 0'.repeat(8)}z"/><path fill="#f5e6d9" d="M14 55h72v5${'q-4.5 6-9 0'.repeat(8)}z"/><path fill="#b79bc6" d="M21 35h6v20h-6z"/><path fill="#8fa7a6" d="M27.5 38h6v17h-6z"/><path fill="#e6cb89" d="M34 37h5v18h-5z"/><path fill="#f6d5c9" d="M46 55q-3-8 4-9 2-5 7-3 6-1 6 5 4 2 2 7z"/><path fill="#d68f88" d="M74 55q-7 0-7-7 0-5 5-7v-4h4v4q5 2 5 7 0 7-7 7z"/>`,
    'small-cloud-shelf': `<path class="art-shadow" fill="#8c765722" d="M26 58h54v5${'q-4.5 6-9 0'.repeat(6)}z"/><path fill="#f5e6d9" d="M23 55h54v5${'q-4.5 6-9 0'.repeat(6)}z"/><path fill="#8fa7a6" d="M30 37h6v18h-6z"/><path fill="#e6cb89" d="M36.5 40h5v15h-5z"/><path fill="#e8a7ae" d="M60 55q-6 0-6-6 0-4 4-6v-5h4v5q4 2 4 6 0 6-6 6z"/>`,
    'wall-scroll': '<path fill="none" stroke="#6b4b3b" stroke-width="1.2" d="M34 15 49 6l15 9"/><rect class="art-shadow" x="36" y="18" width="30" height="58" fill="#8c765722"/><rect x="34" y="16" width="30" height="58" fill="#faf0da"/><rect x="31" y="13" width="36" height="4" rx="2" fill="#503d30"/><rect x="31" y="72" width="36" height="4" rx="2" fill="#503d30"/><path fill="none" stroke="#3f3634" stroke-width="1.6" stroke-linecap="round" d="M40 64q8-9 10-20t9-15m-12 20q-5-3-6-8"/><path fill="#f0b9c5" d="M60 30a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 0 1 4.4 0m-5 6a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 0 1 4.4 0m-5 10a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 0 1 4.4 0m-7-5a2 2 0 1 1-4 0 2 2 0 0 1 4 0m15.8 0a1.8 1.8 0 1 1-3.6 0 1.8 1.8 0 0 1 3.6 0"/>',
    'neon-orbit': '<rect class="art-shadow" x="33" y="13" width="38" height="58" rx="2" fill="#8c765722"/><rect x="30" y="10" width="38" height="58" rx="2" fill="#282d43"/><circle cx="49" cy="36" r="13" fill="none" stroke="#a997ff" stroke-width="5" stroke-opacity=".3"/><circle cx="49" cy="36" r="13" fill="none" stroke="#cbc1ff" stroke-width="2"/><path stroke="#ef8bab" stroke-width="5" stroke-opacity=".3" stroke-linecap="round" d="m34.5 44.5 29.5-17.5"/><path stroke="#ffc3d4" stroke-width="2.2" stroke-linecap="round" d="m34.5 44.5 29.5-17.5"/><path stroke="#c6b5d8" stroke-width="1.6" d="M37 59h6m3 0h6m3 0h6"/>',
    'record-sleeve': '<rect class="art-shadow" x="30" y="20" width="44" height="44" rx="1.5" fill="#8c765722"/><rect x="27" y="17" width="44" height="44" rx="1.5" fill="#303447"/><rect x="30" y="20" width="38" height="38" fill="#b4aecb"/><circle cx="49" cy="39" r="12.5" fill="none" stroke="#343c52" stroke-width="4.5"/>',
    'felt-rainbow': '<path class="art-shadow" fill="none" stroke="#8c765722" stroke-width="7" stroke-linecap="round" d="M23 67a30 30 0 0 1 60 0m-52 0a22 22 0 0 1 44 0m-36 0a14 14 0 0 1 28 0"/><path fill="none" stroke="#eabfa1" stroke-width="7" stroke-linecap="round" d="M20 64a30 30 0 0 1 60 0"/><path fill="none" stroke="#f5d6bf" stroke-width="7" stroke-linecap="round" d="M28 64a22 22 0 0 1 44 0"/><path fill="none" stroke="#b79bc6" stroke-width="7" stroke-linecap="round" d="M36 64a14 14 0 0 1 28 0"/>',
    // Windows show a little sky and hills through their panes.
    'cottage-window': '<rect class="art-shadow" x="30" y="16" width="44" height="52" rx="2" fill="#8c765722"/><rect x="27" y="13" width="44" height="52" rx="2" fill="#aa7954"/><rect x="31" y="17" width="36" height="44" fill="#a9cfe0"/><path fill="#8fb39d" d="M31 50q9-7 18-2t18-3v16H31z"/><circle cx="58" cy="26" r="3.5" fill="#fff3c4"/><path fill="none" stroke="#bc9169" stroke-width="2.4" d="M49 17v44M31 38h36"/><rect x="24" y="63" width="50" height="5" rx="1.5" fill="#73533d"/><path fill="#bd8469" d="M58 55h7l-1 8h-5z"/><path fill="#809362" d="M61.5 55q-4-6 0-8 3 3 0 8m0 0q2-6 5-5-1 4-5 5"/>',
    'arched-window': '<path class="art-shadow" fill="#8c765722" d="M38 80V38a14 14 0 0 1 28 0v42z"/><path fill="#aa7954" d="M35 77V35a14 14 0 0 1 28 0v42z"/><path fill="#a9cfe0" d="M39 73V35a10 10 0 0 1 20 0v38z"/><path fill="#8fb39d" d="M39 62q5-5 10-2t10-2v15H39z"/><path fill="none" stroke="#bc9169" stroke-width="2" d="M49 25v48M39 43h20M39 58h20"/><rect x="32" y="75" width="34" height="5" rx="1.5" fill="#73533d"/>',
    'round-window': '<rect class="art-shadow" x="30" y="23" width="44" height="44" rx="3" fill="#8c765722"/><rect x="27" y="20" width="44" height="44" rx="3" fill="#bc9169"/><circle cx="49" cy="42" r="17" fill="#a9cfe0"/><path fill="#8fb39d" d="M34 49q8-6 15-2t14-2a17 17 0 0 1-29 4z"/><circle cx="49" cy="42" r="17" fill="none" stroke="#aa7954" stroke-width="3.5"/><path fill="none" stroke="#aa7954" stroke-width="2" d="M49 25v34M32 42h34"/>',
    'fish-tank': '<path fill="#9c6848" d="M18 62 48 76v14L18 76z"/><path fill="#b58862" d="M48 76 82 60v14L48 90z"/><path fill="#c69366" d="m18 62 34-16 30 14-34 16z"/><path fill="#a9d4cc" d="M22 37 48 50v24L22 61z"/><path fill="#bfe0da" d="M48 50 78 36v24L48 74z"/><path fill="none" stroke="#6f8d58" stroke-width="2" d="M29 66q-3-8 1-14m36 5q3-8-1-13"/><path fill="#ec8a4e" d="M54 56q6-5 12 0-6 5-12 0m0 0-4-3v6z"/><path fill="#e9bd57" d="M31 58q5-4 10 0-5 4-10 0m10 0 4-3v6z"/><path fill="#73533d" d="m20 35 32-15 28 13-32 15z"/>',
    globe: '<ellipse cx="50" cy="84" rx="16" ry="5" fill="#734f3a"/><path stroke="#a87952" stroke-width="5" d="M50 82V62"/><circle cx="50" cy="40" r="22" fill="#6f96ae"/><path fill="#a9b887" d="M37 31q6-8 14-4 2 7-6 10-6-1-8-6m17 15q8-2 12 5-6 7-12 3m-18 1q4-2 7 2-3 4-7 1"/><path fill="none" stroke="#bf9762" stroke-width="3" d="M33 19a27 27 0 0 1 32 45"/><circle cx="50" cy="62" r="3" fill="#bf9762"/>',
    easel: '<path stroke="#a87952" stroke-width="4" d="M33 89 46 13m21 76L54 13M50 22l13 64"/><path fill="#f1e6cf" d="m28 22 44-4 2 40-44 4z"/><path fill="#a9cfe0" d="m33 28 34-3 1 27-34 3z"/><path fill="#8fb39d" d="M34 46q9-7 17-3t17-4l1 13-34 3z"/><circle cx="58" cy="33" r="3.5" fill="#fff3c4"/><path fill="#73533d" d="m26 62 50-5v4l-50 5z"/>',
    'bean-bag': '<path fill="#c9a27e" d="M17 70q-4-22 21-28 10-14 28-8 22 8 18 36-14 16-38 14-23-2-29-14z"/><ellipse cx="50" cy="57" rx="19" ry="7" fill="#b58f6c"/><path fill="#d3ae8a" d="M41 36q13-9 27 0-9 6-27 0"/>',
    monstera: '<path fill="#ded4c1" d="m36 66 4 20q10 7 20 0l4-20z"/><ellipse cx="50" cy="66" rx="14" ry="5" fill="#ece5d6"/><path fill="none" stroke="#617853" stroke-width="2.5" d="M50 66V38m0 10L34 30m17 14 16-18"/><path fill="#5f7d4f" d="M50 38q-18-4-18-20 16-4 18 20M34 30q-16 4-22-10 14-8 22 10m33-4q4-16 20-12-2 16-20 12"/><path fill="none" stroke="#efe4ca" stroke-width="1.5" d="m40 23 4 6m-22-8 6 4m48-4-4 6"/>',
    'tea-cart': '<path stroke="#bf9762" stroke-width="3" d="M20 47v27m28-13v25m32-18v22m0-26 4-6"/><path fill="#b58862" d="m18 66 34-14 30 13-34 15z"/><path fill="#c69366" d="m18 46 34-14 30 13-34 15z"/><circle cx="20" cy="77" r="4" fill="#50564c"/><circle cx="48" cy="89" r="4" fill="#50564c"/><circle cx="80" cy="73" r="4" fill="#50564c"/><ellipse cx="42" cy="38" rx="9" ry="7" fill="#e7dec7"/><path fill="none" stroke="#e7dec7" stroke-width="3" d="m50 36 6-5"/><rect x="58" y="36" width="7" height="5" rx="1" fill="#e7dec7"/><rect x="30" y="58" width="12" height="4" rx="1" fill="#788e84"/>',
  };
  const floorShadow = getFurniture(type)?.mount === 'wall' ? '' : '<ellipse cx="50" cy="87" rx="35" ry="6" fill="#8c765714"/>';
  return `<svg class="furniture-art" viewBox="0 0 100 100" aria-hidden="true">${floorShadow}${pieces[type] || pieces.plant}</svg>`;
}

// Picture choices are painted by the same code as the pictures in the room.
const artThumbs = new Map();
function artThumb(art, wide) {
  const key = `${art}:${wide}`;
  if (!artThumbs.has(key)) {
    const canvas = document.createElement('canvas'); [canvas.width, canvas.height] = wide ? [120, 84] : [96, 120];
    ARTWORKS[art].draw(canvas.getContext('2d'), canvas.width, canvas.height);
    artThumbs.set(key, canvas.toDataURL());
  }
  return artThumbs.get(key);
}

// Hand-drawn pet portraits for the pet panel.
function petArt(species) {
  const art = species === 'dog'
    ? '<ellipse cx="50" cy="56" rx="30" ry="27" fill="#efddbd"/><path d="M22 38q-12 4-9 26 3 12 12 8 5-14 5-28z" fill="#a9683f"/><path d="M78 38q12 4 9 26-3 12-12 8-5-14-5-28z" fill="#a9683f"/><ellipse cx="50" cy="67" rx="15" ry="11" fill="#fcf6ea"/><ellipse cx="50" cy="61" rx="6" ry="4.5" fill="#352a26"/><path d="M44 71q3 3 6 0 3 3 6 0" fill="none" stroke="#6d4632" stroke-width="1.8" stroke-linecap="round"/><circle cx="38" cy="50" r="4.5" fill="#33241d"/><circle cx="62" cy="50" r="4.5" fill="#33241d"/><circle cx="36.6" cy="48.4" r="1.4" fill="#fffaf0"/><circle cx="60.6" cy="48.4" r="1.4" fill="#fffaf0"/><ellipse cx="30" cy="60" rx="4.5" ry="2.5" fill="#f3a698"/><ellipse cx="70" cy="60" rx="4.5" ry="2.5" fill="#f3a698"/><path d="M36 82q14 6 28 0" fill="none" stroke="#c8674f" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="86" r="3" fill="#e3bb5f"/>'
    : '<path d="M24 44 28 16l17 16zM76 44 72 16 55 32z" fill="#d4904f"/><path d="M29 36 31 22l8 9zM71 36l-2-14-8 9z" fill="#eba99c"/><ellipse cx="50" cy="55" rx="30" ry="26" fill="#d4904f"/><path d="M43 32q7-4 14 0M45 38h10" fill="none" stroke="#b5703b" stroke-width="3" stroke-linecap="round"/><ellipse cx="44" cy="66" rx="9" ry="7" fill="#f5e6cb"/><ellipse cx="56" cy="66" rx="9" ry="7" fill="#f5e6cb"/><path d="M47 61h6l-3 3.5z" fill="#dc8a8a"/><path d="M44 69q3 3 6 0 3 3 6 0" fill="none" stroke="#7a4a36" stroke-width="1.8" stroke-linecap="round"/><circle cx="38" cy="52" r="4.5" fill="#3a2a22"/><circle cx="62" cy="52" r="4.5" fill="#3a2a22"/><circle cx="36.6" cy="50.4" r="1.4" fill="#fffaf0"/><circle cx="60.6" cy="50.4" r="1.4" fill="#fffaf0"/><ellipse cx="29" cy="62" rx="4.5" ry="2.5" fill="#f2a092"/><ellipse cx="71" cy="62" rx="4.5" ry="2.5" fill="#f2a092"/>';
  return `<svg class="pet-art" viewBox="0 0 100 100" aria-hidden="true">${art}</svg>`;
}

function roomDesignArt(preset) {
  const style = preset.style || 'retreat';
  const [wall, side, floor, trim, sky, sofa] = ({ sakura: ['#ece1c9', '#f8ecd1', '#cbbb84', '#967650', '#eacbd0', '#a6b393'], cloud: ['#b8afd2', '#dec1d2', '#eeded7', '#f7e7db', '#becae3', '#b6a5cd'], metro: ['#424c65', '#956a6c', '#727b8c', '#293449', '#676080', '#8496ae'], retreat: ['#718572', '#c4b797', '#a77e57', '#674e3b', '#a1b6bd', '#876a79'] })[style];
  const window = style === 'cloud' ? `<ellipse cx="111" cy="40" rx="15" ry="21" fill="${sky}" stroke="${trim}" stroke-width="4" transform="rotate(-22 111 40)"/>` : `<path d="M85 24 139 45V77L85 56Z" fill="${sky}" stroke="${trim}" stroke-width="3"/><path d="m103 31v31m18-24v31M85 41l54 21" stroke="${trim}" stroke-width="2"/>`;
  const details = style === 'sakura' ? '<path d="M17 40v35m12-41v46m12-52v45m12-50v43M12 53l51-27M12 65l51-27" stroke="#b09066" stroke-width="1.4"/><circle cx="120" cy="50" r="3" fill="#f7d7dc"/><circle cx="114" cy="54" r="4" fill="#f0b9c5"/>' : style === 'cloud' ? '<path d="M16 54q8-18 16-8 8-17 16-6 8-10 12-5v6L16 65Z" fill="#faeadf"/><path d="m55 83 44 17m-26-26 45 17m-34-18-30 27m49-22-30 27" stroke="#d5b9bc" stroke-width="6"/>' : style === 'metro' ? '<path d="m87 54 10 4V44l8 3v14l10 4V44l8 3v21l13 5" fill="#2b3654"/><path d="m14 46 47-23m-47 32 47-23m-47 32 47-23m-47 32 47-23" stroke="#765767" stroke-width="1"/><path d="m90 27 46 18" stroke="#a7d6e4" stroke-width="2"/>' : '<path d="m14 39 46-24m22 6 56 23" stroke="#a7b79d" stroke-width="3"/><circle cx="32" cy="69" r="9" fill="#93a77d"/>';
  return `<svg viewBox="0 0 160 130" aria-hidden="true"><path d="m10 82 60-34 80 34-59 37Z" fill="${floor}"/><path d="M10 82V36L70 6v45Z" fill="${side}"/><path d="M70 6 150 37v45L70 51Z" fill="${wall}"/>${window}${details}<path d="m20 71 39-19 23 10-39 20Z" fill="${trim}"/><path d="M24 75v15m48-21v15M43 82v15" stroke="${trim}" stroke-width="3"/><path d="m38 65 14-7 8 4-14 7Z" fill="#faf0dd"/><path d="m105 75 28 12v15l-28-12-19 10V85Z" fill="${sofa}"/><path d="m90 86 15-8 24 10-15 9Z" fill="#ded3c7"/><path d="m10 82 81 37 59-37v5l-59 37-81-37Z" fill="${trim}"/></svg>`;
}

function renderCollection() {
  $('#builder-panel').dataset.collection = collectionTab;
  document.querySelectorAll('[data-collection-tab]').forEach(button => button.setAttribute('aria-pressed', button.dataset.collectionTab === collectionTab));
  const content = $('#collection-content');
  const rememberedFocus = rememberControlFocus(content);
  $('.collection-footnote').textContent = collectionTab === 'presets'
    ? 'Choose a style for this room. Your other house rooms stay just as you left them.'
    : 'Pick a piece to add it. Drag furniture back here to put it away.';
  if (collectionTab === 'presets') {
    const designs = [...PRESETS.filter(preset => preset.style), ...PRESETS.filter(preset => !preset.style)];
    content.innerHTML = `<div class="preset-grid">${designs.map(preset => {
      const active = state.layout.presetId === preset.id, saved = Boolean(state.rooms[preset.id]);
      return `<article class="preset-card" data-design="${preset.style || 'retreat'}" data-active="${active}"><div class="preset-art" aria-hidden="true">${roomDesignArt(preset)}</div><div><span class="preset-label">${active ? 'CURRENT STYLE' : saved ? 'SAVED DESIGN' : preset.style ? 'A DIFFERENT LITTLE WORLD' : 'TIMBER RETREAT'}</span><h3>${preset.name}</h3><p>${preset.description}</p></div><button class="quiet-button" data-preset="${preset.id}" ${active ? 'disabled' : ''} aria-label="${saved ? 'Use saved' : 'Use'} ${preset.name} design">${active ? "Current design" : saved ? 'Use saved design' : 'Use this design'} ${icon('arrow')}</button>${active ? `<button class="preset-reset" data-reset-design="${preset.id}">Reset layout</button>` : ''}</article>`;
    }).join('')}</div><p class="preset-note">Six furnished designs for this space. Build additional rooms from your House to keep more spaces side by side.</p>`;
    const useDesign = (presetId, reset = false) => {
      room?.cancelPlacement?.(); room?.selectItem?.(null); selectedItem = null;
      undoLayout = structuredClone(state.layout);
      acceptUpdate(store.useRoom(presetId, reset)); $('#undo-layout').disabled = false;
      toast(reset ? 'The original layout is back. Undo restores your decorations.' : `${roomDesign(state.layout).name}. Make yourself at home.`);
      content.querySelector('.preset-card[data-active="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
      revealRoomForPlacement();
    };
    content.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => useDesign(button.dataset.preset)));
    content.querySelectorAll('[data-reset-design]').forEach(button => button.addEventListener('click', () => useDesign(button.dataset.resetDesign, true)));
    restoreControlFocus(content, rememberedFocus);
    return;
  }
  const collection = FURNITURE.filter(item => !item.unique);
  const categories = ['All', ...new Set(collection.map(item => item.category))];
  const items = collection.filter(item => category === 'All' || item.category === category);
  content.innerHTML = `<div class="category-list" aria-label="Furniture categories">${categories.map(name => `<button data-category="${name}" aria-pressed="${category === name}">${name}</button>`).join('')}</div><div class="furniture-grid">${items.map(item => `<button class="furniture-card" data-furniture="${item.id}" aria-pressed="${placement?.type === item.id}" aria-label="Place ${item.name}" title="${item.description}">${furnitureArt(item.id)}<span class="furniture-name">${item.name}</span><span class="furniture-detail">${item.category}<span class="furniture-add">${icon('plus')}</span></span></button>`).join('')}</div>`;
  content.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => { category = button.dataset.category; renderCollection(); }));
  content.querySelectorAll('[data-furniture]').forEach(button => button.addEventListener('click', () => {
    if (pieceCount(state.layout.items) >= MAX_ITEMS) { toast(`Your room has ${MAX_ITEMS} pieces. Remove one to make a little space.`); return; }
    room?.beginPlacement?.(button.dataset.furniture);
    revealRoomForPlacement();
  }));
  restoreControlFocus(content, rememberedFocus);
}

function revealRoomForPlacement() {
  const stage = $('#stage');
  const rect = stage.getBoundingClientRect();
  if (rect.top >= 12 && rect.bottom <= Math.min(window.innerHeight, $('#builder-panel').getBoundingClientRect().top)) return;
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
    const bed = getFurniture(drag.type)?.unique, petName = PETS[state.pet]?.name || PETS.cat.name;
    $('#return-label').textContent = drag.removable ? 'Return to your collection' : bed ? `${petName}’s bed stays` : 'Every room needs a study spot';
    $('#return-detail').textContent = drag.removable ? 'Release here to put this piece away · Undo brings it back' : bed ? 'Drop it anywhere in the room instead' : 'Add another desk before putting this one away';
  }
  if (drag.overCollection) preview.style.transform = `translate3d(${drag.clientX - 44}px, ${drag.clientY - 76}px, 0)`;
  const hint = drag.overCollection ? (drag.removable ? 'Release to put it away · Undo brings it back' : drag.reason)
    : drag.valid ? (getFurniture(drag.type)?.mount === 'wall' ? 'Release to place · Esc to cancel' : 'Release to place · R to rotate · Esc to cancel') : `${drag.reason} · Esc to cancel`;
  if (hint !== dragHint) { dragHint = hint; $('#room-hint').textContent = hint; }
}

function renderInspector() {
  const inspector = $('#selection-inspector');
  if (!inspector) return;
  const selected = selectedItem && getFurniture(selectedItem.type);
  const pending = placement && getFurniture(placement.type);
  if (!editMode) {
    $('#room-hint').innerHTML = `Drag to look around<span>·</span>Tap a lamp, the fire or ${PETS[state.pet]?.name || PETS.cat.name}`;
    return;
  }
  const rememberedFocus = rememberControlFocus(inspector);
  $('#room-hint').textContent = pending ? `Click ${pending.mount === 'wall' ? 'a wall' : 'the floor'} to place ${pending.name.toLowerCase()}` : selected ? 'Drag to move · Drop over the collection to put away' : 'Drag a piece to move it · Drag empty space to look around';
  if (!pending && !selected) {
    // With nothing selected, the room itself offers its walls and floors.
    const style = roomDesign(state.layout).style || 'retreat';
    const surfaces = ['walls', 'floor'].map(kind => `<div class="art-picker" role="group" aria-label="Choose the ${kind}"><span class="picker-label">${kind === 'walls' ? 'Walls' : 'Floor'}</span>${surfaceChoices(style, kind).map(entry => `<button data-${kind}="${entry.id}" aria-pressed="${(state.layout[kind] || '') === entry.id}" aria-label="${entry.name}" title="${entry.name}"><span class="tint-swatch" style="--tint: ${entry.swatch[0]}; --tint-2: ${entry.swatch[1]}"></span></button>`).join('')}</div>`).join('');
    inspector.innerHTML = `<div class="selection-copy">${icon('build')}<span><strong>A room that feels like you</strong><small>Drag furniture around your room, or back here to put it away. Pick a piece below to add something new.</small></span></div><div class="selection-actions room-surfaces">${surfaces}</div>`;
    for (const kind of ['walls', 'floor']) inspector.querySelectorAll(`[data-${kind}]`).forEach(button => button.addEventListener('click', () => { room?.setSurface?.(kind, button.dataset[kind] || null); renderInspector(); }));
    restoreControlFocus(inspector, rememberedFocus);
    return;
  }
  const item = pending || selected, wall = item.mount === 'wall';
  const currentDesk = selectedItem?.id === state.layout.activeDeskId;
  const hint = pending ? (placement.valid === false && placement.reason ? placement.reason : `Move over ${wall ? 'a wall' : 'the floor'} to find a spot. Click to place.`) : item.unique ? `Drag to move. ${PETS[state.pet]?.name || PETS.cat.name} will find it.` : 'Drag to move or put away. Arrow buttons work too.';
  // Wall pieces always face the room: they move up, down and along the wall
  // instead of turning. Frames and records offer their pictures.
  const nudges = [['0,-0.25', wall ? 'Move up' : 'Move toward back wall', '↑'], ['-0.25,0', 'Move left', '←'], ['0.25,0', 'Move right', '→'], ['0,0.25', wall ? 'Move down' : 'Move toward front', '↓']];
  const arts = !pending && item.arts ? `<div class="art-picker" role="group" aria-label="${item.id === 'record-sleeve' ? 'Choose the sleeve' : 'Choose the picture'}">${item.arts.map(art => `<button data-art="${art}" aria-pressed="${selectedItem.art === art}" aria-label="${artName(art)}" title="${artName(art)}">${SLEEVES[art] ? `<span class="sleeve-swatch" style="--sleeve: ${SLEEVES[art].color}"></span>` : `<img src="${artThumb(art, item.id === 'wide-frame')}" alt="">`}</button>`).join('')}</div>` : '';
  // Pieces with color choices list them after the room's own colors.
  const tints = !pending && tintsFor(item.id), roomTint = tints && Object.keys(tints[0].paint)[0];
  const colors = tints ? `<div class="art-picker" role="group" aria-label="Choose the color">${[{ id: '', name: 'Room colors', swatch: designPaint(roomDesign(state.layout).style).find(([hex]) => hex === roomTint)?.[1] || roomTint }, ...tints].map(tint => `<button data-tint="${tint.id}" aria-pressed="${(selectedItem.tint || '') === tint.id}" aria-label="${tint.name}" title="${tint.name}"><span class="tint-swatch" style="--tint: ${tint.swatch}"></span></button>`).join('')}</div>` : '';
  inspector.innerHTML = `<div class="selection-copy">${icon(pending ? 'plus' : 'build')}<span><strong>${pending ? 'Placing ' : ''}${item.name}${!pending && currentDesk ? '<span class="active-desk-tag">Study spot</span>' : ''}</strong><small>${hint}</small></span></div><div class="selection-actions">${arts}${colors}${wall ? '' : `<button class="small-button" id="rotate-item" aria-label="Rotate ${item.name}">${icon('rotate')}<span>Rotate</span></button>`}${!pending ? `<div class="nudge-buttons" aria-label="Move selected ${wall ? 'wall piece' : 'furniture'}">${nudges.map(([step, label, arrow]) => `<button data-nudge="${step}" aria-label="${label}">${arrow}</button>`).join('')}</div>${item.category === 'Study' ? `<button class="small-button study-here" id="study-here" aria-label="${currentDesk ? 'Studying here' : 'Study here'}" ${currentDesk ? 'disabled' : ''}>${icon('check')}<span>${currentDesk ? 'Studying here' : 'Study here'}</span></button>` : ''}${item.unique ? '' : `<button class="small-button remove-item" id="remove-item" aria-label="Remove ${item.name}">${icon('trash')}</button>`}` : ''}<button class="small-button" id="cancel-item" aria-label="${pending ? 'Cancel placement' : 'Deselect furniture'}">${icon('close')}</button></div>`;
  $('#rotate-item')?.addEventListener('click', () => room?.rotateSelection?.());
  inspector.querySelectorAll('[data-art]').forEach(button => button.addEventListener('click', () => room?.setArt?.(button.dataset.art)));
  inspector.querySelectorAll('[data-tint]').forEach(button => button.addEventListener('click', () => room?.setTint?.(button.dataset.tint || null)));
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
  panel.innerHTML = `<div class="panel-heading"><span>${({ atmosphere: 'Find your kind of quiet', pet: 'Your little companion' })[currentPanel] || 'A smoother little room'}</span><button class="icon-button" id="close-panel" aria-label="Close room controls">${icon('close')}</button></div>`;
  if (currentPanel === 'atmosphere') {
    panel.insertAdjacentHTML('beforeend', `<div class="theme-options">${[['day', 'sun', 'Daylight'], ['dusk', 'moon', 'Night'], ['rain', 'rain', 'Rainy afternoon']].map(([key, symbol, title]) => `<button class="theme-option ${key}" data-theme-choice="${key}" aria-pressed="${state.theme === key}">${icon(symbol)}<span>${title}</span></button>`).join('')}</div>`);
    panel.querySelectorAll('[data-theme-choice]').forEach(button => button.addEventListener('click', () => {
      acceptUpdate(store.update(draft => { draft.theme = button.dataset.themeChoice; }));
    }));
    panel.insertAdjacentHTML('beforeend', `<label class="fairy-lights"><span>${roomDesign(state.layout).style ? 'Accent lights' : 'Fairy lights'}</span><input type="checkbox" data-decor="lights" ${state.decor.lights ? 'checked' : ''}></label>`);
    panel.querySelector('[data-decor]').addEventListener('change', event => acceptUpdate(store.update(draft => { draft.decor.lights = event.target.checked; })));
  } else if (currentPanel === 'pet') {
    // Choose the pet; the bed, its spot and the room stay as they are.
    const name = PETS[state.pet]?.name || PETS.cat.name;
    panel.insertAdjacentHTML('beforeend', `<div class="pet-options">${Object.values(PETS).map(pet => `<button class="pet-option" data-pet-choice="${pet.id}" aria-pressed="${state.pet === pet.id}">${petArt(pet.id)}<span><strong>${pet.name}</strong><small>${pet.id === 'cat' ? 'A ginger tabby who loves the fire' : 'A floppy-eared puppy with a happy tail'}</small></span></button>`).join('')}</div><div class="pet-actions"><button class="quiet-button" id="pet-now">${icon('cat')} Give ${name} a pet</button><p class="performance-note">Tap ${name} in the room for a pet, or drag to carry ${name} somewhere new. Decorate moves the bed.</p></div>`);
    panel.querySelectorAll('[data-pet-choice]').forEach(button => button.addEventListener('click', () => {
      if (state.pet === button.dataset.petChoice) return;
      acceptUpdate(store.update(draft => { draft.pet = button.dataset.petChoice; }));
      renderPanel(); $(`[data-pet-choice="${state.pet}"]`)?.focus();
      speech?.say('pet', (PET_LINES[state.pet] || PET_LINES.cat).hello);
    }));
    $('#pet-now').addEventListener('click', () => { if (room) room.pet(); else petFeedback(); });
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
  if (event.key === 'Escape' && houseOpen && !event.target.closest('input')) { setHouseOpen(false); return; }
  if (event.key === 'Escape' && room?.cancelDrag?.()) { event.preventDefault(); return; }
  // Escape while typing (or composing) belongs to the text field, not the panel.
  const typing = event.isComposing || event.target.closest('textarea, [contenteditable="true"], input:not([type="range"], [type="checkbox"], [type="radio"], [type="button"])');
  if (event.key === 'Escape' && currentPanel && !typing) { closePanel(); return; }
  if (!editMode || event.target.closest('input, textarea, select, [contenteditable="true"]') || event.ctrlKey || event.metaKey || event.altKey) return;
  const steps = { ArrowLeft: [-.25, 0], ArrowRight: [.25, 0], ArrowUp: [0, -.25], ArrowDown: [0, .25] };
  if (event.key === 'Escape') { room?.cancelPlacement?.(); room?.selectItem?.(null); }
  // Enter drops a new piece at its preview spot; preventDefault stops the
  // focused collection card from starting another placement.
  else if (event.key === 'Enter' && placement) { event.preventDefault(); room?.confirmPlacement?.(); }
  else if (event.key.toLowerCase() === 'r' && (placement || selectedItem)) { event.preventDefault(); room?.rotateSelection?.(); }
  else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedItem) { event.preventDefault(); room?.removeSelection?.(); }
  else if (steps[event.key] && (placement || selectedItem)) { event.preventDefault(); room?.moveSelection?.(...steps[event.key]); }
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
    // After the fade-out, suspend the context so the audio device can sleep.
    if (!soundEnabled) setTimeout(() => { if (!soundEnabled) audioContext.suspend().catch(() => {}); }, 800);
    $('#sound-button').setAttribute('aria-pressed', soundEnabled);
    $('#sound-state').textContent = soundEnabled ? 'Rain is falling' : 'Sound off';
  } catch { toast('Audio isn’t available in this browser. Your quiet room is still here.'); }
}
$('#sound-button').addEventListener('click', toggleSound);
$('#volume').addEventListener('input', event => {
  if (soundEnabled && gainNode) gainNode.gain.setTargetAtTime(Number(event.target.value) / 130, audioContext.currentTime, 0.1);
});
syncCompanionIntent();
tick();
const tickInterval = setInterval(tick, 500);
function refreshState() {
  const before = JSON.stringify(state.layout);
  applyState(store.refresh());
  // Another tab changed the room: this tab's Undo snapshot is now stale and
  // would overwrite that work, so drop it.
  if (JSON.stringify(state.layout) !== before && undoLayout) { undoLayout = null; $('#undo-layout').disabled = true; }
  tick();
}
window.addEventListener('storage', event => {
  if (event.key === storageKey || event.key === null) refreshState();
}, { signal: listeners.signal });
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshState(); }, { signal: listeners.signal });
// Remember the last visit, for a hello after a long time away.
function markSeen() { store.update(draft => { draft.seenAt = Date.now(); }); }
// A hello after a long time away, but never in the middle of focus.
function welcome() { if (!state.session.running) avatarSay('welcome', { force: true }); }
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenSince = Date.now(); markSeen(); }
  else if (hiddenSince && Date.now() - hiddenSince > 10 * 60_000) { hiddenSince = 0; setTimeout(welcome, 600); }
}, { signal: listeners.signal });
window.addEventListener('pagehide', markSeen, { signal: listeners.signal });

// Development builds expose the room to end-to-end checks; production strips it.
if (import.meta.env.DEV) window.__littleHours = { get room() { return room; }, get state() { return state; }, get speech() { return speech; }, get house() { return houseUI; }, get connected() { return connectedView; } };
if (import.meta.hot) import.meta.hot.dispose(() => {
  listeners.abort();
  document.body.classList.remove('is-connected', 'is-travelling', 'is-door-walking');
  clearInterval(tickInterval);
  clearTimeout(toastTimeout);
  clearTimeout(travelTimer); clearTimeout(arrivalTimer); connectedView?.dispose();
  houseUI?.dispose();
  room?.dispose?.();
  noiseNode?.stop();
  audioContext?.close();
});
