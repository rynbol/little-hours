import './style.css';
import { createRoom } from './room.js';
import { createSession, remainingAt, formatTime } from './session.js';
import { createStateStore, localDate, storageKey } from './state.js';

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

document.querySelector('#app').innerHTML = `
  <div class="app-shell">
    <header class="app-header">
      <a class="brand" href="/" aria-label="Little Hours home"><span class="brand-mark">${icon('home')}</span><span>little hours<span class="brand-dot">.</span></span></a>
      <div class="header-right"><span class="room-label">Your little corner of the world</span><span class="prototype-tag">First sketch</span></div>
    </header>
    <main class="workspace">
      <section class="room-section" aria-labelledby="room-title">
        <div class="room-heading"><div><p class="eyebrow">A PLACE TO COME BACK TO</p><h1 id="room-title">The evening room</h1><p class="room-subtitle" id="room-subtitle">Warm light. A quiet desk. A little company.</p></div><button class="icon-button" id="reset-view" aria-label="Reset room view">${icon('reset')}</button></div>
        <div class="stage" id="stage">
          <div class="room-canvas" id="room-canvas" aria-label="Interactive 3D cutaway study room with a desk, bookshelf, plants and a ginger cat. Drag to turn the room."></div>
          <div class="loading-note" id="loading-note">Making room for you…</div>
          <div class="mini-caption" id="mini-caption" hidden>Mini view preview · inside this page</div>
          <div class="room-hint">Drag to look around<span>·</span>Try petting the cat</div>
          <div class="pet-bubble" id="pet-bubble" hidden>Miso is happy you’re here.</div>
        </div>
        <div class="room-bottom">
          <div class="room-status"><span class="status-dot"></span><span id="room-status">Just you & Miso</span></div>
          <nav class="room-tools" aria-label="Room controls">
            <button class="tool" data-panel="atmosphere" aria-expanded="false" aria-controls="room-panel">${icon('sun')}<span>Atmosphere</span></button>
            <button class="tool" data-panel="decorate" aria-expanded="false" aria-controls="room-panel">${icon('leaf')}<span>Decorate</span></button>
            <button class="tool" id="pet-button">${icon('cat')}<span>Miso</span></button>
            <button class="tool" id="mini-button" aria-pressed="false">${icon('mini')}<span>Mini view</span></button>
          </nav>
        </div>
        <div class="room-panel" id="room-panel" hidden></div>
      </section>
      <aside class="focus-card" aria-labelledby="focus-title">
        <div class="card-top"><span class="eyebrow">A LITTLE TIME FOR YOU</span><span class="tiny-flower" aria-hidden="true">✳</span></div>
        <h2 id="focus-title">Make a little<br><em>space.</em></h2>
        <p class="focus-intro">You don’t have to do it all.<br>Just the next little thing.</p>
        <label class="field-label" for="task">What are you working on?</label>
        <input id="task" maxlength="180" placeholder="One thing, for now…" autocomplete="off" />
        <div class="timer-area"><span id="session-label" class="session-label">SETTLE IN</span><div id="timer" class="timer" role="timer" aria-label="25 minutes remaining">25:00</div><div class="durations" aria-label="Focus duration"><button data-minutes="25" aria-pressed="true">25 min</button><button data-minutes="50" aria-pressed="false">50 min</button><button data-minutes="90" aria-pressed="false">90 min</button></div></div>
        <button class="start-button" id="start-button"><span>Start focusing</span>${icon('arrow')}</button>
        <button class="reset-session" id="reset-session" hidden>Reset session</button>
        <div class="sound-row"><button id="sound-button" class="sound-button" aria-pressed="false">${icon('rain')}<span>Soft rain<span class="sound-state" id="sound-state">Sound off</span></span><span class="sound-switch" aria-hidden="true"></span></button><label class="sr-only" for="volume">Rain volume</label><input type="range" id="volume" min="0" max="100" value="30" aria-label="Rain volume" /></div>
        <div class="daily-note" id="daily-note">Good things begin with a little time.</div>
      </aside>
    </main>
    <footer class="app-footer"><span>A small space. A softer pace.</span><span>Made for your next little thing <span aria-hidden="true">✧</span></span></footer>
  </div>
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
  dusk: ['The evening room', 'Warm light. A quiet desk. A little company.'],
  rain: ['A rainy afternoon', 'Rain at the window. Nowhere else to be.'],
  day: ['A slow morning', 'A little sunlight for a fresh start.'],
};
function applyState(next, force = false) {
  const previous = state;
  state = next;
  if (force || previous.theme !== state.theme) {
    document.body.dataset.theme = state.theme;
    $('#room-title').textContent = themeCopy[state.theme][0];
    $('#room-subtitle').textContent = themeCopy[state.theme][1];
    room?.setTheme(state.theme);
  }
  if ($('#task').value !== state.task) $('#task').value = state.task;
  for (const [key, visible] of Object.entries(state.decor)) {
    if (force || previous.decor[key] !== visible) room?.setDecor(key, visible);
  }
  room?.setFocused(state.session.running);
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
  room = createRoom($('#room-canvas'), { onPet: petFeedback });
  $('#loading-note').hidden = true;
} catch (error) {
  $('#loading-note').textContent = 'The 3D room needs WebGL. Your focus timer is still ready.';
  console.error('Could not create the room:', error);
}
applyState(state, true);

function renderSession() {
  const ms = remainingAt(state.session);
  const formatted = formatTime(ms);
  $('#timer').textContent = formatted;
  $('#timer').setAttribute('aria-label', `${formatted} remaining`);
  document.title = state.session.running ? `${formatted} · Little Hours` : 'Little Hours — a little place to focus';
  $('#session-label').textContent = state.session.running ? 'ONE LITTLE THING AT A TIME' : ms < state.session.duration && ms > 0 ? 'TAKE YOUR TIME' : ms === 0 ? 'A LITTLE PROGRESS, MADE' : 'SETTLE IN';
  const label = state.session.running ? 'Pause a moment' : ms === 0 ? 'Begin another session' : ms < state.session.duration ? 'Keep going' : 'Start focusing';
  $('#start-button span').textContent = label;
  $('#reset-session').hidden = !state.session.running && ms === state.session.duration;
  $('#room-status').textContent = state.session.running ? 'You & Miso, settling in' : 'Just you & Miso';
  document.body.classList.toggle('is-focusing', state.session.running);
  document.querySelectorAll('[data-minutes]').forEach(button => {
    button.setAttribute('aria-pressed', Number(button.dataset.minutes) * 60000 === state.session.duration);
    button.disabled = state.session.running;
  });
  const today = localDate();
  const minutes = state.history.filter(h => h.date === today).reduce((sum, h) => sum + h.minutes, 0);
  $('#daily-note').textContent = minutes ? `${minutes} quiet minutes made today. Look at you go.` : 'Good things begin with a little time.';
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
$('#reset-view').addEventListener('click', () => room?.resetView());
$('#pet-button').addEventListener('click', () => { if (room) room.pet(); else petFeedback(); });
$('#mini-button').addEventListener('click', () => {
  compact = !compact;
  $('#stage').classList.toggle('is-mini', compact);
  $('#mini-button').setAttribute('aria-pressed', compact);
  $('#mini-caption').hidden = !compact;
  $('#mini-button span').textContent = compact ? 'Full room' : 'Mini view';
});

function renderPanel() {
  const panel = $('#room-panel');
  panel.hidden = !currentPanel;
  document.querySelectorAll('[data-panel]').forEach(button => button.setAttribute('aria-expanded', button.dataset.panel === currentPanel));
  if (!currentPanel) return;
  panel.innerHTML = `<div class="panel-heading"><span>${currentPanel === 'atmosphere' ? 'Find your kind of quiet' : 'Make yourself at home'}</span><button class="icon-button" id="close-panel" aria-label="Close room controls">${icon('close')}</button></div>`;
  if (currentPanel === 'atmosphere') {
    panel.insertAdjacentHTML('beforeend', `<div class="theme-options">${[['dusk', 'moon', 'Golden evening'], ['rain', 'rain', 'Rainy afternoon'], ['day', 'sun', 'Slow morning']].map(([key, symbol, title]) => `<button class="theme-option ${key}" data-theme-choice="${key}" aria-pressed="${state.theme === key}">${icon(symbol)}<span>${title}</span></button>`).join('')}</div>`);
    panel.querySelectorAll('[data-theme-choice]').forEach(button => button.addEventListener('click', () => {
      acceptUpdate(store.update(draft => { draft.theme = button.dataset.themeChoice; }));
    }));
  } else {
    panel.insertAdjacentHTML('beforeend', `<div class="decor-options">${[['plants', 'A little greenery'], ['lights', 'Fairy lights'], ['rug', 'Something soft']].map(([key, title]) => `<label><span>${title}</span><input type="checkbox" data-decor="${key}" ${state.decor[key] ? 'checked' : ''}></label>`).join('')}</div>`);
    panel.querySelectorAll('[data-decor]').forEach(input => input.addEventListener('change', () => {
      acceptUpdate(store.update(draft => { draft.decor[input.dataset.decor] = input.checked; }));
    }));
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
document.addEventListener('keydown', event => { if (event.key === 'Escape' && currentPanel) closePanel(); });

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
room?.setFocused(state.session.running);
tick();
setInterval(tick, 500);
function refreshState() {
  applyState(store.refresh());
  tick();
}
window.addEventListener('storage', event => {
  if (event.key === storageKey || event.key === null) refreshState();
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshState(); });
