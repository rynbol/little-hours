import { roomDesign } from '../../core/layout.js';
import { activeHouseRoom } from '../../core/house.js';
import { $ } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';

const themeCopy = {
  dusk: 'The candles are lit. Stay a little longer.',
  rain: 'Raindrops, candlelight, and nowhere else to be.',
  day: 'Sunlight on the books. A fresh little chapter.',
};

export function createRoomUI(app) {
  let compact = false, quality = 'auto', performanceStats = null;

  function renderHeading() {
    const { state } = app, connected = app.nav.connected;
    const design = roomDesign(state.layout), entry = activeHouseRoom(state.house);
    $('#room-title').textContent = connected ? state.house.name : entry.name === 'Your studio' ? design.name : entry.name;
    $('#room-subtitle').textContent = connected ? 'Your rooms, together. Choose a corner to step inside.' : design.style ? ({ sakura: 'Soft light. Cherry blossoms. Room to breathe.', cloud: 'Head in the clouds. Feet on a soft little rug.', metro: 'The city hums. Your little corner is quiet.' })[design.style] : themeCopy[state.theme];
  }

  // The room's accessible name says how to use it, with the current pet.
  function renderLabel() {
    const pet = app.state.pet === 'dog' ? 'Mochi the puppy' : 'Miso the ginger cat';
    const label = app.avatar.active
      ? 'Avatar preview. Drag left or right over the character to turn them. Your focus timer is paused while editing.'
      : app.decorate.active
      ? 'Room decorator. Hover to outline furniture, then drag to move it. Drop a piece over the bottom collection to put it away. Drag empty space to turn the room. Escape cancels.'
      : `Interactive 3D cutaway study room. Drag to turn the room. Tap a plant to water it, a bookcase to read, a tea table for tea, or a seat to get comfortable. Little moments offers the same actions with buttons. Tap a lamp, the fire or the record player to switch it, tap your companion or ${pet}, or tap a doorway to walk to another room, or to plan a new one, while your focus timer is paused.`;
    $('#room-canvas').setAttribute('aria-label', label);
    $('#room-canvas canvas')?.setAttribute('aria-label', label);
  }

  function applyTheme(previous, force) {
    const { state } = app;
    // An open Atmosphere panel keeps its lights label in step with the room.
    const lightsLabel = $('#room-panel .fairy-lights span');
    if (lightsLabel) lightsLabel.textContent = roomDesign(state.layout).style ? 'Accent lights' : 'Fairy lights';
    renderHeading();
    if (force || previous.theme !== state.theme) {
      document.body.dataset.theme = state.theme;
      app.room?.setTheme(state.theme);
      const [symbol, label] = state.theme === 'day' ? ['sun', 'Daylight'] : state.theme === 'rain' ? ['rain', 'Rain'] : ['moon', 'Night'];
      const nextLabel = state.theme === 'day' ? 'Switch to night' : 'Switch to daylight';
      $('#time-toggle').innerHTML = `${icon(symbol)}<span>${label}</span>`;
      $('#time-toggle').setAttribute('aria-label', nextLabel);
      $('#time-toggle').title = nextLabel;
    }
  }

  function syncControls() {
    document.querySelectorAll('[data-theme-choice]').forEach(button => button.setAttribute('aria-pressed', button.dataset.themeChoice === app.state.theme));
    document.querySelectorAll('[data-decor]').forEach(input => { input.checked = app.state.decor[input.dataset.decor]; });
  }

  function leaveMini() {
    if (!compact) return;
    compact = false; $('#stage').classList.remove('is-mini'); $('#mini-caption').hidden = true;
    $('#mini-button').setAttribute('aria-pressed', 'false'); $('#mini-button span').textContent = 'Mini view';
  }

  function renderAtmosphere(panel) {
    const { state } = app;
    panel.insertAdjacentHTML('beforeend', `<div class="theme-options">${[['day', 'sun', 'Daylight'], ['dusk', 'moon', 'Night'], ['rain', 'rain', 'Rainy afternoon']].map(([key, symbol, title]) => `<button class="theme-option ${key}" data-theme-choice="${key}" aria-pressed="${state.theme === key}">${icon(symbol)}<span>${title}</span></button>`).join('')}</div>`);
    panel.querySelectorAll('[data-theme-choice]').forEach(button => button.addEventListener('click', () => {
      app.acceptUpdate(app.store.update(draft => { draft.theme = button.dataset.themeChoice; }));
    }));
    panel.insertAdjacentHTML('beforeend', `<label class="fairy-lights"><span>${roomDesign(state.layout).style ? 'Accent lights' : 'Fairy lights'}</span><input type="checkbox" data-decor="lights" ${state.decor.lights ? 'checked' : ''}></label>`);
    panel.querySelector('[data-decor]').addEventListener('change', event => app.acceptUpdate(app.store.update(draft => { draft.decor.lights = event.target.checked; })));
  }

  function renderQuality(panel) {
    panel.insertAdjacentHTML('beforeend', `<div class="quality-options" aria-label="Room rendering quality">${[['auto', 'Adaptive'], ['high', 'Crisp'], ['battery', 'Save energy']].map(([id, label]) => `<button data-quality="${id}" aria-pressed="${quality === id}">${label}</button>`).join('')}</div><p class="performance-note">Adaptive balances detail and motion. Save energy limits animation to 30 frames per second.</p><dl class="performance-metrics" id="performance-metrics"></dl><p class="performance-note">Babylon.js engine · live measurements while this tab is visible. CPU measurements exclude GPU time.</p>`);
    panel.querySelectorAll('[data-quality]').forEach(button => button.addEventListener('click', () => {
      quality = button.dataset.quality;
      app.room?.setQuality?.(quality);
      panel.querySelectorAll('[data-quality]').forEach(option => option.setAttribute('aria-pressed', option.dataset.quality === quality));
    }));
    renderPerformance();
  }

  function renderPerformance() {
    if (app.panels.current !== 'performance') return;
    const metrics = $('#performance-metrics');
    if (!metrics || !performanceStats) return;
    const stats = { ...performanceStats, p95: performanceStats.frameIntervalP95 ?? performanceStats.p95FrameMs, cpu: performanceStats.cpuRenderMsP95 ?? performanceStats.submitMs };
    const value = (key, digits = 0) => Number.isFinite(stats[key]) ? Number(stats[key]).toFixed(digits) : '—';
    metrics.innerHTML = `<div><dt>Rendered frames</dt><dd>${value('fps')} <small>fps</small></dd></div><div><dt>95th % frame interval</dt><dd>${value('p95', 1)} <small>ms</small></dd></div><div><dt>${Number.isFinite(stats.cpuRenderMsP95) ? '95th % CPU render' : 'CPU submission'}</dt><dd>${value('cpu', 1)} <small>ms</small></dd></div><div><dt>Draw calls</dt><dd>${value('drawCalls')}</dd></div><div><dt>Triangles</dt><dd>${Number.isFinite(stats.triangles) ? Math.round(stats.triangles).toLocaleString() : '—'}</dd></div><div><dt>Pixel ratio</dt><dd>${value('pixelRatio', 2)}<small>×</small></dd></div>`;
  }

  function onStats(stats) { performanceStats = stats; renderPerformance(); }

  $('#time-toggle').addEventListener('click', () => {
    app.acceptUpdate(app.store.update(draft => { draft.theme = draft.theme === 'day' ? 'dusk' : 'day'; }));
  });
  $('#reset-view').addEventListener('click', () => app.room?.resetView());
  $('#mini-button').addEventListener('click', () => {
    if (app.panels.current === 'avatar') app.panels.close();
    if (app.decorate.active) app.decorate.setEditMode(false);
    compact = !compact;
    $('#stage').classList.toggle('is-mini', compact);
    $('#mini-button').setAttribute('aria-pressed', compact);
    $('#mini-caption').hidden = !compact;
    $('#mini-button span').textContent = compact ? 'Full room' : 'Mini view';
  });

  return { get compact() { return compact; }, renderHeading, renderLabel, applyTheme, syncControls, leaveMini, renderAtmosphere, renderQuality, onStats };
}
