import { travelTo } from './ui/place-transition.js';
import './ui/style.css';
import './ui/ui.css';
import { createUIFeedback } from './ui/ui-feedback.js';
import { $ } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { createToast } from './ui/toast.js';
import { shellMarkup } from './app/shell.js';
import { createPanels } from './app/panels.js';
import { storageKey } from './core/state.js';
import { createSharedStateStore } from './core/shared-store.js';
import { roomDesign } from './core/layout.js';
import { clockNow, isPinned, pinnedStorage } from './core/test-pins.js';
import { createRoom, createRoomUI } from './features/room/index.js';
import { createAudio, wireSoundControls } from './features/audio/index.js';
import { createSavesPanel } from './features/backup/index.js';
import { createSpeech, createCompanionUI } from './features/companion/index.js';
import { createDelights } from './features/moments/index.js';
import { createPetUI } from './features/pet/index.js';
import { createHouseUI, createHouseNavigation } from './features/house/index.js';
import { createAvatarPanel } from './features/avatar/index.js';
import './features/avatar/wardrobe.css';
import './features/pet/pet.css';
import './ui/atmosphere.css';
import './ui/calm-ui.css';
import { createDecorateUI, roomDesignArt } from './features/decorate/index.js';
import { createTimerUI } from './features/timer/index.js';
import { createFishingUI } from './features/fishing/index.js';
import { createBuddyUI } from './features/buddy/index.js';
import { installTestHook } from './dev/test-hook.js';
import { stockBait } from './core/fishing.js';

const deviceStorage = pinnedStorage || {
  getItem: key => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
};
const store = createSharedStateStore(deviceStorage);
const audio = createAudio(deviceStorage);
const listeners = new AbortController();
let hiddenSince = 0, updating = 0;

document.querySelector('#app').innerHTML = shellMarkup(audio.prefs);
$('#task').value = store.state.task;

const toast = createToast();
const app = {
  state: store.state, store, audio, room: null, roomReady: false, speech: null, houseUI: null,
  signal: listeners.signal, storageWarningShown: false,
  feedback: createUIFeedback(document, { signal: listeners.signal, saving: () => updating > 0 }),
  toast: toast.show, hideToast: toast.hide, acceptUpdate,
};
app.timer = createTimerUI(app);
app.companion = createCompanionUI(app);
app.pet = createPetUI(app);
app.avatar = createAvatarPanel(app);
app.backup = createSavesPanel(app);
app.decorate = createDecorateUI(app);
app.nav = createHouseNavigation(app);
app.roomUI = createRoomUI(app);
app.panels = createPanels(app);
app.lake = createFishingUI(app);
app.buddy = createBuddyUI(app);
wireSoundControls(app);

function applyState(next, force = false) {
  const previous = app.state;
  const state = app.state = next;
  app.timer.syncFocusMode();
  app.nav.onStateChange(previous);
  const design = roomDesign(state.layout);
  document.body.dataset.design = design.style || 'retreat';

  $('#coin-balance').textContent = state.house.coins;
  $('#coin-wallet').setAttribute('aria-label', `${state.house.coins} coins · Visit your house`);
  app.timer.renderFocusReward();
  app.houseUI?.render();
  app.lake.render();
  app.room?.setHouse(state.house);
  app.nav.renderConnections();
  app.roomUI.applyTheme(previous, force);
  if (document.activeElement !== $('#task') && !app.timer.taskPending && $('#task').value !== state.task) $('#task').value = state.task;
  if (force || previous.pet !== state.pet) { app.room?.setPet?.(state.pet); app.pet.renderName(); app.decorate.renderInspector(); }
  app.pet.sync();
  app.room?.setAvatarAppearance?.(state.avatar);
  for (const [key, visible] of Object.entries(state.decor)) {
    if (key === 'lights' && (force || previous.decor[key] !== visible)) app.room?.setDecor(key, visible);
  }
  app.decorate.syncLayout(force);
  app.companion.syncIntent();
  app.roomUI.syncControls();
  app.buddy?.sync();
}
async function acceptUpdate(update) {
  updating++;
  const result = await Promise.resolve(update).finally(() => updating--);
  if (listeners.signal.aborted) return result;
  applyState(store.refresh());
  if (result.completion) {
    if (result.completion.kind === 'focus') {
      app.room?.celebrate(); app.room?.petRitual('cuddle'); app.delights?.show('finish'); app.delights?.show('bond', 'pet');
      app.timer.showCelebration(result.completion);
    } else app.timer.announce('Your break is over. Start focusing when you are ready.');
    // Ring for a session that just ended, not one found finished long ago.
    if (clockNow() - result.completion.at < 90_000) audio.chime();
  }
  app.backup.setSaveStatus(result.persisted);
  if (!result.persisted && !app.storageWarningShown) {
    app.storageWarningShown = true;
    app.toast('Your browser couldn’t save this visit. The room still works.');
  }
  app.timer.render();
  return result;
}
// The decorator needs a ready room: both entry buttons wait for it.
const setDecorEntry = enabled => { $('#decorate-button').disabled = !enabled; $('#rooms-button').disabled = !enabled; };
try {
  setDecorEntry(false);
  app.room = createRoom($('#room-canvas'), {
    onReady() {
      app.roomReady = true; app.timer.render();
      $('#loading-note').hidden = true;
      setDecorEntry(true);
      app.buddy?.start();
      // Back after half an hour or more: a small hello.
      if (app.state.seenAt && clockNow() - app.state.seenAt > 30 * 60_000) setTimeout(() => { app.companion.welcome(); app.pet.welcome(); }, 1200);
    },
    onItemInteraction: app.companion.onItemInteraction,
    onCompanionTap: app.companion.onCompanionTap,
    pet: app.state.pet,
    onPet: app.pet.feedback,
    onPetCarry: app.pet.onPetCarry,
    onFrame() { app.speech?.update(); app.delights?.update(); },
    onBuddy: event => app.buddy?.onRoom(event),
    onDoorProgress: app.nav.onDoorProgress,
    onCompanionState: app.companion.onCompanionState,
    ...app.decorate.roomEvents,
    onToggleLights() { acceptUpdate(store.update(draft => { draft.decor.lights = !draft.decor.lights; })); },
    onHouseNavigate: app.nav.visitDoor,
    onHouseHover(id) {
      document.querySelectorAll('[data-house-go]').forEach(button => button.classList.toggle('door-hover', button.dataset.houseGo === id));
    },
    onNotice: app.toast,
    onStats: app.roomUI.onStats,
  });
  const speechLayer = document.createElement('div'); speechLayer.className = 'speech-layer';
  $('#room-canvas').appendChild(speechLayer);
  app.speech = createSpeech(speechLayer, { anchor: who => app.room?.anchor(who), reducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches });
  app.delights = createDelights($('#room-canvas'), { room: app.room, signal: listeners.signal, unavailable: () => app.decorate.active || app.avatar.active || app.nav.houseOpen || Boolean(app.nav.connected) || app.nav.travelling || app.roomUI.compact });
} catch (error) {
  $('#loading-note').textContent = 'The room couldn’t load. Try reloading; your focus timer is still ready.';
  console.error('Could not create the room:', error);
  setDecorEntry(false);
}
applyState(app.state, true);
app.houseUI = createHouseUI($('#house-page'), {
  store, acceptUpdate, art: roomDesignArt, icon, notice: app.toast,
  onClose: () => app.nav.setHouseOpen(false),
  onEnter: app.nav.visitRoom,
  onFocus: () => travelTo('home', () => { app.nav.setHouseOpen(false); app.timer.expand(); $('#start-button').focus(); }),
  onPond: () => app.lake.open(),
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !event.isComposing && app.timer.leaveFocusMode()) { event.preventDefault(); return; }
  if (event.key === 'Escape' && app.nav.houseOpen && !event.target.closest('input')) { app.nav.setHouseOpen(false); return; }
  if (event.key === 'Escape' && app.room?.cancelDrag?.()) { event.preventDefault(); return; }
  // Escape while typing (or composing) belongs to the text field, not the panel.
  const typing = event.isComposing || event.target.closest('textarea, [contenteditable="true"], input:not([type="range"], [type="checkbox"], [type="radio"], [type="button"])');
  if (event.key === 'Escape' && app.panels.current && !typing) { app.panels.close(); return; }
  app.decorate.handleKey(event);
}, { signal: listeners.signal });

app.timer.syncDock();
app.companion.syncIntent();
app.timer.tick();
if (import.meta.env.DEV && !isPinned) app.acceptUpdate(store.update((draft, { now }) => stockBait(draft.pond, 3, now)));
const tickInterval = setInterval(app.timer.tick, 500);
function refreshState() {
  const before = JSON.stringify(app.state.layout);
  applyState(store.refresh());
  // Another tab changed the room: this tab's Undo snapshot is now stale and
  // would overwrite that work, so drop it.
  if (JSON.stringify(app.state.layout) !== before) app.decorate.clearUndo();
  app.timer.tick();
}
window.addEventListener('storage', event => {
  if (event.key === storageKey || event.key === null) refreshState();
}, { signal: listeners.signal });
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshState(); }, { signal: listeners.signal });
// Remember the last visit, for a hello after a long time away.
function markSeen() { app.timer.flushTask(); acceptUpdate(store.update(draft => { draft.seenAt = clockNow(); })); }
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenSince = clockNow(); markSeen(); }
  else if (hiddenSince && clockNow() - hiddenSince > 10 * 60_000) { hiddenSince = 0; setTimeout(app.companion.welcome, 600); }
}, { signal: listeners.signal });
window.addEventListener('pagehide', markSeen, { signal: listeners.signal });

if (import.meta.env.DEV) installTestHook({ get pet() { return app.pet; }, get buddy() { return app.buddy; }, get room() { return app.room; }, get state() { return app.state; }, get speech() { return app.speech; }, get house() { return app.houseUI; }, get lake() { return app.lake; }, get connected() { return app.nav.connected; } });
if (import.meta.hot) import.meta.hot.dispose(() => {
  listeners.abort();
  document.body.classList.remove('is-connected', 'is-travelling', 'is-door-walking', 'is-avatar-editing', 'is-decorating');
  clearInterval(tickInterval);
  toast.dispose();
  app.feedback.dispose();
  $('#session-celebration')?.close();
  app.nav.dispose(); app.decorate.dispose();
  app.houseUI?.dispose();
  app.lake.dispose();
  app.buddy.dispose();
  app.delights?.dispose();
  app.room?.dispose?.();
  audio.dispose();
});
