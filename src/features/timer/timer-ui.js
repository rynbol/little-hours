import { remainingAt, formatTime, spokenTime, sessionPhase, displayedRemaining, DIAL_MINUTES, sessionStarted, isFocusing, sessionLifecycle } from '../../core/session.js';
import { gardenPlantArt } from '../house/index.js';
import { plantPhase } from '../../core/room-types.js';
import { localDate } from '../../core/state.js';
import { focusCoins } from '../../core/house.js';
import { $ } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { petGiftArt } from '../pet/index.js';
import { createFocusQuickbar } from './focus-quickbar.js';
import './focus-mode.css';
import './session.css';

export function createTimerUI(app) {
  let lastSessionRender = '', lastDay = '';
  let focusMode = 'off', focusReturn = null, focusRestore = true, focusRoom = '';
  let pending = false, taskTimer = 0, taskPending = false, taskDraft = app.state.task, pendingDuration = null, ticking = false, dialMinutes = null;
  const announce = message => { $('#timer-status').textContent = message; };
  function flushTask() {
    clearTimeout(taskTimer);
    if (!taskPending) return Promise.resolve();
    const task = taskDraft; taskPending = false;
    return app.acceptUpdate(app.store.update(draft => { draft.task = task; }));
  }
  async function action(command, message) {
    if (pending) return;
    pending = true; render();
    try {
      await flushTask();
      const result = await app.acceptUpdate(command());
      if (!result.completion) {
        if (sessionLifecycle(app.state.session) !== 'completed') $('#session-celebration').close();
        if (message) announce(message);
      }
      return result;
    } finally { pending = false; render(); }
  }

  const focusRoomSignature = () => JSON.stringify([app.state.house.activeId, app.state.layout, app.state.theme, app.state.pet, app.state.avatar, app.state.decor]);
  const focusUnavailable = () => !app.roomReady || app.nav.travelling || app.avatar.active || app.decorate.active || app.nav.houseOpen || Boolean(app.nav.connected) || app.lake.isOpen || $('#session-celebration').open;

  function finishLeavingFocus() {
    if (focusMode !== 'leaving') return;
    focusMode = 'off';
    document.body.classList.remove('is-focus-mode');
    app.room?.resize?.();
    if (focusRestore) {
      const target = [focusReturn, $('#focus-mode-enter'), $('#start-button')].find(node => node?.isConnected && !node.disabled && node.getClientRects().length);
      target?.focus({ preventScroll: true });
    }
    focusReturn = null;
  }
  function leaveFocusMode({ restoreFocus = true, animate = false } = {}) {
    if (focusMode === 'off') return false;
    focusRestore = restoreFocus;
    if (focusMode === 'on') {
      focusMode = 'leaving'; focusRoom = '';
      $('#focus-mode-hud').hidden = true;
      $('#focus-mode-enter').setAttribute('aria-expanded', 'false');
    }
    const seat = app.room?.leaveSeat?.({ animate });
    if (!seat || seat === 'room') finishLeavingFocus();
    return true;
  }
  const onSeatChange = ({ state }) => { if (state === 'room') finishLeavingFocus(); };

  function syncFocusMode() {
    const unavailable = focusUnavailable();
    const leave = focusMode === 'on' ? unavailable || !isFocusing(app.state.session) || focusRoom !== focusRoomSignature() : focusMode === 'leaving' && unavailable;
    if (leave) leaveFocusMode({ restoreFocus: !unavailable });
    $('#focus-mode-enter').disabled = unavailable || app.state.session.kind === 'break' || pending;
  }

  async function enterFocusMode() {
    if (focusMode !== 'off' || focusUnavailable() || app.state.session.kind === 'break' || pending) return;
    const returnFocus = document.activeElement;
    app.audio.unlock();
    await flushTask();
    const refreshed = await app.acceptUpdate(app.store.update());
    if (refreshed.completion || focusUnavailable() || app.state.session.kind === 'break') return;
    const wasRunning = app.state.session.running, resuming = sessionStarted(app.state.session);
    if (app.panels.current) app.panels.close();
    app.roomUI.leaveMini();
    app.audio.unlock();
    if (!wasRunning) {
      const result = await app.acceptUpdate(app.store.setRunning(true, app.state.session.id));
      if (result.completion || focusUnavailable() || !app.state.session.running) return;
      app.companion.say(resuming ? 'resume' : 'start', { force: true }); app.delights?.show('start');
      if (!resuming) app.room?.invitePet();
    }
    focusReturn = returnFocus; focusRoom = focusRoomSignature(); focusMode = 'on';
    document.body.classList.add('is-focus-mode');
    $('#focus-mode-hud').hidden = false;
    $('#focus-mode-enter').setAttribute('aria-expanded', 'true');
    app.room?.resize?.();
    app.room?.enterSeat?.();
    $('#focus-mode-exit').focus({ preventScroll: true });
  }

  $('#focus-mode-enter').addEventListener('click', enterFocusMode);
  $('#focus-mode-exit').addEventListener('click', () => leaveFocusMode({ animate: true }));
  app.signal.addEventListener('abort', () => leaveFocusMode({ restoreFocus: false }), { once: true });

  const openGarden = plantId => {
    if (app.nav.travelling || app.avatar.active) return;
    if (app.panels.current) app.panels.close();
    app.roomUI.leaveMini(); app.nav.setHouseOpen(true, 'orchard', plantId);
  };
  const quickbar = createFocusQuickbar({ signal: app.signal, onToggle: toggleRunning, onSettings: () => { expand(); $('#focus-card').focus({ preventScroll: true }); } });

  function showCelebration(completion) {
    if (completion.kind !== 'focus') return;
    leaveFocusMode({ restoreFocus: false });
    const modal = $('#session-celebration');
    const { minutes, coins, pet } = completion;
    $('#celebration-copy').textContent = `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} with ${pet.name}.`;
    $('#celebration-bond').textContent = pet.hearts ? `+${pet.hearts} ♡ · ${pet.name} · ${pet.bondTitle}` : '♡';
    $('#celebration-earned').textContent = `+${coins} coins`;
    $('#celebration-gift')?.remove();
    if (pet.gifts?.length) {
      const gift = pet.gifts.at(-1), reveal = document.createElement('div'); reveal.id = 'celebration-gift'; reveal.className = 'pet-gift-reveal';
      reveal.innerHTML = `${petGiftArt(gift.id)}<strong></strong><span></span>`;
      reveal.querySelector('strong').textContent = gift.label; reveal.querySelector('span').textContent = `From ${pet.name} ♡`;
      $('#celebration-bond').after(reveal);
    }
    $('#celebration-garden')?.remove();
    if (completion.garden) {
      const growth = completion.garden, reveal = document.createElement('div'); reveal.id = 'celebration-garden'; reveal.className = 'garden-reveal';
      reveal.innerHTML = `${gardenPlantArt({ species: growth.species, minutes: growth.after })}<div><strong></strong><small></small><button type="button">Visit garden ↗</button></div>`;
      reveal.querySelector('strong').textContent = growth.bloomed ? `${growth.name} bloomed` : `${growth.name} is growing`;
      reveal.querySelector('small').textContent = growth.bloomed ? 'Grown by you ♡' : `${growth.after} / ${growth.total} min`;
      reveal.querySelector('button').addEventListener('click', () => { modal.close(); openGarden(growth.id); });
      $('.celebration-coins').after(reveal);
    }
    if (!modal.open) modal.show();
    app.feedback.celebrate($('.celebration-flower'));
    announce(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'} completed. ${coins} coins earned.`);
  }

  function render() {
    syncFocusMode();
    const { state } = app, travelling = app.nav.travelling, editingAvatar = app.avatar.active;
    const isBreak = state.session.kind === 'break', phase = sessionLifecycle(state.session), focusing = isFocusing(state.session);
    const ms = displayedRemaining(state.session);
    const formatted = formatTime(ms);
    app.pet?.refreshCare();
    const presence = sessionPhase(state.session);
    app.companion.syncIntent();
    const today = localDate();
    if (today !== lastDay) { lastDay = today; app.pet?.sync(); }
    const minutes = state.history.filter(h => h.date === today).reduce((sum, h) => sum + h.minutes, 0);
    const renderKey = `${state.session.id}:${isBreak}:${phase}:${formatted}:${presence}:${state.session.duration}:${today}:${minutes}:${editingAvatar}:${travelling}:${pending}:${state.history.length}`;
    // The clock polls for deadlines twice a second, but idle rooms and unchanged
    // displayed seconds do not need another set of DOM mutations.
    $('#start-button').disabled = travelling || editingAvatar || pending;
    $('#avatar-button').disabled = travelling;
    $('#decorate-button').disabled = travelling || !app.room;
    $('#rooms-button').disabled = travelling || !app.room;
    $('#mini-button').disabled = travelling;
    $('#rename-room').disabled = travelling;
    $('#room-title-input').disabled = travelling;
    $('#save-room-title').disabled = travelling || !$('#room-title-input').value.trim();
    if (renderKey === lastSessionRender) return;
    lastSessionRender = renderKey;
    $('#timer').textContent = formatted;
    $('#focus-mode-timer').textContent = formatted;
    $('#timer').setAttribute('aria-label', `${spokenTime(ms)} remaining`);
    $('#focus-mode-timer').setAttribute('aria-label', `${spokenTime(ms)} remaining`);
    document.title = state.session.running ? `${formatted} · Little Hours` : 'Little Hours — a little place to focus';
    $('#session-label').textContent = state.session.running ? 'IN YOUR OWN TIME' : ms < state.session.duration && ms > 0 ? 'A LITTLE BREATHER' : ms === 0 ? 'YOU DID THAT' : 'SETTLE IN';
    $('#timer-caption').textContent = state.session.running ? 'one thing at a time' : ms === 0 ? 'a little progress, made' : ms < state.session.duration ? 'ready when you are' : 'a small beginning';
    const minutesSet = state.session.duration / 60_000, settable = !isBreak && !pending && !state.session.running && [0, state.session.duration].includes(remainingAt(state.session)) && !editingAvatar;
    $('#timer-progress').style.strokeDashoffset = String(100 * (1 - (settable ? minutesSet / 120 : ms / state.session.duration)));
    $('.timer-seed').style.transform = settable ? `rotate(${90 + minutesSet * 3}deg)` : '';
    $('#timer-dial').toggleAttribute('data-settable', settable);
    const ring = $('#timer-ring');
    ring.setAttribute('aria-valuenow', minutesSet); ring.setAttribute('aria-valuetext', `${minutesSet} minutes`);
    ring.setAttribute('aria-disabled', String(!settable)); ring.tabIndex = settable ? 0 : -1;
    if (!isBreak) app.room?.setPlantPhase(plantPhase(state.session.duration, remainingAt(state.session)));
    if (!isBreak) app.room?.setFocusProgress?.(1 - remainingAt(state.session) / state.session.duration);
    $('#timer-dial').dataset.phase = isBreak ? 'break' : state.session.running ? 'focusing' : ms === 0 ? 'complete' : presence;
    const actionIcon = focusing ? 'pause' : 'arrow';
    if ($('#start-button').dataset.icon !== actionIcon) {
      $('#start-button svg').outerHTML = icon(actionIcon);
      $('#start-button').dataset.icon = actionIcon;
    }
    const label = isBreak ? phase === 'completed' ? 'Start focusing' : 'End break' : focusing ? 'Pause a moment' : phase === 'completed' ? 'Begin another session' : phase === 'paused' ? 'Keep going' : 'Start focusing';
    quickbar.render({ time: formatted, remaining: spokenTime(ms), label, running: focusing, paused: phase === 'paused', completed: phase === 'completed', disabled: travelling || editingAvatar || pending });
    $('#start-button span').textContent = label;
    $('#start-button').disabled = travelling || editingAvatar || pending;
    $('#reset-session').hidden = isBreak || phase === 'ready' || phase === 'completed';
    $('#reset-session').disabled = editingAvatar || pending;
    $('#session-kind').hidden = phase === 'ready' || focusing;
    $('#session-kind').textContent = isBreak ? phase === 'completed' ? 'Break complete' : phase === 'paused' ? 'Break paused' : 'Taking a break' : phase === 'completed' ? 'Focus complete' : 'Focus paused';
    $('#session-result').hidden = isBreak || phase !== 'completed';
    const record = state.history.find(entry => entry.id === state.session.id);
    $('#session-result-copy').textContent = record ? `${record.minutes} ${record.minutes === 1 ? 'minute' : 'minutes'} completed${record.task ? ` · ${record.task}` : ''}. +${focusCoins(record.minutes)} coins.` : 'Session complete. Ready when you are.';
    document.querySelectorAll('[data-break-minutes]').forEach(button => { button.disabled = pending || editingAvatar || travelling; });
    if (isBreak) {
      $('#session-label').textContent = 'TAKE YOUR TIME';
      $('#timer-caption').textContent = phase === 'completed' ? 'ready when you are' : 'a little room to breathe';
    }
    const presenceBadge = $('#stage-presence');
    if (presenceBadge.dataset.presence !== presence) {
      const [status, symbol] = presence === 'focusing' ? ['Focusing', 'clock'] : presence === 'break' ? ['On a break', 'moon'] : ['In your room', 'home'];
      presenceBadge.dataset.presence = presence;
      presenceBadge.setAttribute('aria-label', `Your local focus status: ${status}`);
      $('#room-status').textContent = status;
      $('#presence-icon').innerHTML = icon(symbol);
    }
    document.body.classList.toggle('is-focusing', focusing);
    document.querySelectorAll('[data-minutes]').forEach(button => {
      button.setAttribute('aria-pressed', Number(button.dataset.minutes) * 60000 === state.session.duration);
      button.disabled = state.session.running || editingAvatar || isBreak || pending;
    });
    app.companion.renderNote();
  }

  async function tick() {
    if (app.state.session.running && remainingAt(app.state.session) <= 0 && !ticking) {
      ticking = true;
      try { await app.acceptUpdate(app.store.update()); } finally { ticking = false; }
    }
    else render();
  }

  function syncDock() {
    syncFocusMode();
    $('#focus-card').hidden = app.nav.houseOpen || Boolean(app.nav.connected) || app.decorate.active;
  }

  function revealDock() {
    if (window.matchMedia('(min-width: 1000px)').matches) return;
    const card = $('#focus-card');
    const rect = card.getBoundingClientRect();
    if (rect.top >= 12 && rect.bottom <= window.innerHeight - 12) return;
    card.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }

  function expand() { if (app.panels.current === 'pet') app.panels.close(); syncDock(); revealDock(); }

  async function toggleRunning() {
    const { state } = app;
    if (pending || app.avatar.active) return;
    if (app.nav.travelling) { app.toast('Please wait until you arrive before starting a focus session.', true); return; }
    if (state.session.kind === 'break') {
      app.audio.unlock();
      if (state.session.remaining > 0) await action(() => app.store.endBreak(state.session.id), 'Break ended. Start focusing when you are ready.');
      else await action(() => app.store.setRunning(true, state.session.id), 'Focus started.');
      return;
    }
    const resuming = !state.session.running && remainingAt(state.session) > 0 && remainingAt(state.session) < state.session.duration;
    // Starting is a gesture, which lets the chime sound when this session ends.
    if (!state.session.running) app.audio.unlock();
    // Preserve the action shown on the button if the deadline just passed.
    await action(() => app.store.setRunning(!state.session.running, state.session.id), state.session.running ? 'Focus paused.' : resuming ? 'Focus resumed.' : 'Focus started.');
    if (app.state.session.running) { app.companion.say(resuming ? 'resume' : 'start', { force: true }); app.delights?.show('start'); if (!resuming) app.room?.invitePet(); }
    else if (remainingAt(app.state.session) > 0) app.companion.say('pause', { force: true });
  }
  $('#start-button').addEventListener('click', toggleRunning);
  $('#reset-session').addEventListener('click', async () => {
    await action(() => app.store.resetSession(undefined, app.state.session.id), 'Ready for a new focus session.');
    // Reset hides itself; keep keyboard and screen-reader focus on the timer.
    if ($('#reset-session').hidden) $('#start-button').focus();
  });
  document.querySelectorAll('[data-minutes]').forEach(button => button.addEventListener('click', () => setMinutes(Number(button.dataset.minutes))));
  async function setMinutes(minutes) {
    const session = app.state.session;
    if (session.running || session.kind === 'break' || pending || (minutes * 60_000 === session.duration && session.remaining > 0)) return;
    if (sessionStarted(session)) {
      pendingDuration = { minutes, id: session.id };
      $('#replace-session-copy').textContent = `Your paused session has ${spokenTime(session.remaining)} left. Starting ${minutes} minutes will replace it without focus rewards.`;
      $('#replace-session').showModal(); $('#keep-session').focus();
      return;
    }
    dialMinutes = minutes;
    try { return await app.acceptUpdate(app.store.resetSession(minutes, session.id)); }
    finally { if (dialMinutes === minutes) dialMinutes = null; }
  }
  $('#keep-session').addEventListener('click', () => { pendingDuration = null; $('#replace-session').close(); $('#start-button').focus(); });
  $('#replace-session').addEventListener('cancel', () => { pendingDuration = null; });
  $('#replace-session-confirm').addEventListener('click', async () => {
    const replacement = pendingDuration; pendingDuration = null; $('#replace-session').close();
    if (replacement) await action(() => app.store.resetSession(replacement.minutes, replacement.id), 'Ready for a new focus session.');
    $('#start-button').focus();
  });
  document.querySelectorAll('[data-break-minutes]').forEach(button => button.addEventListener('click', async () => {
    app.audio.unlock();
    const id = app.state.session.id, minutes = Number(button.dataset.breakMinutes);
    await action(() => app.store.startBreak(minutes, id), `${minutes} minute break started.`);
    $('#start-button').focus();
  }));
  const nearestMinutes = raw => DIAL_MINUTES.reduce((best, value) => Math.abs(value - raw) < Math.abs(best - raw) ? value : best);
  let dragging = false;
  function dragTo(event) {
    const box = $('#timer-ring').getBoundingClientRect(), turn = (Math.atan2(event.clientX - box.left - box.width / 2, box.top + box.height / 2 - event.clientY) / (Math.PI * 2) + 1) % 1;
    const current = dialMinutes ?? app.state.session.duration / 60_000;
    let minutes = nearestMinutes(Math.max(1, turn * 120));
    if (Math.abs(minutes - current) > 60) minutes = current > 60 ? 120 : 1;
    if (minutes !== current) setMinutes(minutes);
  }
  $('#timer-ring').addEventListener('pointerdown', event => {
    if (!$('#timer-dial').hasAttribute('data-settable')) return;
    dragging = true; $('#timer-ring').setPointerCapture(event.pointerId); dragTo(event);
  });
  $('#timer-ring').addEventListener('pointermove', event => { if (dragging) dragTo(event); });
  for (const type of ['pointerup', 'pointercancel']) $('#timer-ring').addEventListener(type, () => { dragging = false; });
  $('#timer-ring').addEventListener('keydown', event => {
    if (!$('#timer-dial').hasAttribute('data-settable')) return;
    const at = DIAL_MINUTES.indexOf(dialMinutes ?? app.state.session.duration / 60_000);
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 3, PageDown: -3 }[event.key];
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? DIAL_MINUTES.length - 1 : step ? Math.min(DIAL_MINUTES.length - 1, Math.max(0, at + step)) : null;
    if (index === null) return;
    event.preventDefault(); setMinutes(DIAL_MINUTES[index]);
  });
  $('#task').addEventListener('input', event => {
    taskDraft = event.target.value; taskPending = true;
    clearTimeout(taskTimer); taskTimer = setTimeout(flushTask, 300);
  });
  $('#task').addEventListener('change', flushTask);
  $('#session-celebration').addEventListener('close', () => $('#start-button').focus({ preventScroll: true }));
  app.signal.addEventListener('abort', () => { clearTimeout(taskTimer); $('#replace-session')?.close(); }, { once: true });
  $('.skip-link').addEventListener('click', async event => {
    event.preventDefault();
    if (app.nav.houseOpen) await app.nav.setHouseOpen(false);
    if (app.nav.connected) app.nav.setConnectedView(false);
    if (app.decorate.active) app.decorate.setEditMode(false);
    if (app.panels.current) app.panels.close();
    expand();
    $('#start-button').focus();
  });

  return { renderFocusReward() {}, showCelebration, render, tick, syncDock, expand, toggleRunning, enterFocusMode, leaveFocusMode, onSeatChange, syncFocusMode, announce, flushTask, get taskPending() { return taskPending; } };
}
