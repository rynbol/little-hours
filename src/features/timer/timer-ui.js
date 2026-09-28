import { createSession, remainingAt, formatTime, spokenTime, sessionPhase, displayedRemaining, DIAL_MINUTES, sessionStarted } from '../../core/session.js';
import { plantPhase } from '../../core/room-types.js';
import { petName, focusPetId } from '../../core/pet-bonds.js';
import { petEntry } from '../../core/pets.js';
import { localDate } from '../../core/state.js';
import { focusCoins } from '../../core/house.js';
import { $ } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { sproutArt } from '../../ui/ui-art.js';
import { petGiftArt } from '../pet/index.js';
import './focus-mode.css';

export function createTimerUI(app) {
  let lastSessionRender = '', journalSignature = '', lastDay = '', focusCollapsed = false;
  let focusMode = false, focusReturn = null, focusRoom = '';

  const focusRoomSignature = () => JSON.stringify([app.state.house.activeId, app.state.layout, app.state.theme, app.state.pet, app.state.avatar, app.state.decor]);
  const focusUnavailable = () => !app.roomReady || app.nav.travelling || app.avatar.active || app.decorate.active || app.nav.houseOpen || Boolean(app.nav.connected) || app.lake.isOpen || $('#room-picker').open || $('#session-celebration').open;

  function leaveFocusMode({ restoreFocus = true } = {}) {
    if (!focusMode) return false;
    focusMode = false; focusRoom = '';
    document.body.classList.remove('is-focus-mode');
    $('#focus-mode-hud').hidden = true;
    $('#focus-mode-enter').setAttribute('aria-expanded', 'false');
    app.room?.resize?.();
    if (restoreFocus) {
      const target = [focusReturn, $('#focus-mode-enter'), $('#start-button')].find(node => node?.isConnected && !node.disabled && node.getClientRects().length);
      target?.focus({ preventScroll: true });
    }
    focusReturn = null;
    return true;
  }

  function syncFocusMode() {
    const unavailable = focusUnavailable();
    if (focusMode && (unavailable || !app.state.session.running || focusRoom !== focusRoomSignature())) leaveFocusMode({ restoreFocus: !unavailable });
    $('#focus-mode-enter').disabled = unavailable;
  }

  function enterFocusMode() {
    if (focusMode || focusUnavailable()) return;
    const returnFocus = document.activeElement, refreshed = app.store.update(); app.acceptUpdate(refreshed);
    if (refreshed.completion || focusUnavailable()) return;
    const wasRunning = app.state.session.running, resuming = sessionStarted(app.state.session);
    if (app.panels.current) app.panels.close();
    app.roomUI.leaveMini();
    app.audio.unlock();
    if (!wasRunning) {
      const result = app.store.setRunning(true); app.acceptUpdate(result);
      if (result.completion || focusUnavailable() || !app.state.session.running) return;
      app.companion.say(resuming ? 'resume' : 'start', { force: true }); app.delights?.show('start');
      if (!resuming) app.room?.invitePet();
    }
    focusReturn = returnFocus; focusRoom = focusRoomSignature(); focusMode = true;
    document.body.classList.add('is-focus-mode');
    $('#focus-mode-hud').hidden = false;
    $('#focus-mode-enter').setAttribute('aria-expanded', 'true');
    app.room?.resize?.();
    $('#focus-mode-exit').focus({ preventScroll: true });
  }

  $('#focus-mode-enter').addEventListener('click', enterFocusMode);
  $('#focus-mode-exit').addEventListener('click', () => leaveFocusMode());
  app.signal.addEventListener('abort', () => leaveFocusMode({ restoreFocus: false }), { once: true });

  function renderFocusReward() {
    const { state } = app;
    const reward = focusCoins(state.session.duration / 60_000);
    const together = focusPetId(state);
    const wish = petEntry(state.petWish);
    const company = petName(state, together);
    const progress = wish ? (state.house.coins >= wish.price ? `${wish.name} is ready to come home` : `${wish.price - state.house.coins} coins to welcome ${wish.name}`) : reward ? `+${Math.floor(reward / 5)} ♡ · ${company}` : '♡ from 5 min';
    $('#focus-reward').innerHTML = `<span class="reward-icon">${sproutArt()}</span><span><strong>${reward ? `+${reward} coins` : 'Coins from 5 min'}</strong><small></small></span>`;
    $('#focus-reward small').textContent = progress;
  }

  function renderJournal() {
    const entries = app.state.history.filter(entry => entry.date === localDate());
    const signature = JSON.stringify(entries);
    if (signature === journalSignature) return;
    journalSignature = signature;
    const total = entries.reduce((sum, entry) => sum + entry.minutes, 0);
    $('#today-total').textContent = `${total} min`;
    const list = $('#today-sessions');
    list.replaceChildren();
    if (!entries.length) {
      const mark = document.createElement('span');
      mark.className = 'journal-sprout';
      mark.innerHTML = sproutArt();
      list.append(mark);
    } else {
      const chips = document.createElement('div');
      chips.className = 'journal-sessions';
      for (const entry of entries.slice(-12)) {
        const chip = document.createElement('span');
        chip.textContent = `✓ ${entry.minutes} min`;
        chips.append(chip);
      }
      list.append(chips);
    }
  }

  function showCelebration(completion) {
    leaveFocusMode({ restoreFocus: false });
    const modal = $('#session-celebration');
    const { minutes, coins, pet } = completion;
    $('#celebration-copy').textContent = `${minutes} minutes with ${pet.name}.`;
    $('#celebration-bond').textContent = pet.hearts ? `+${pet.hearts} ♡ · ${pet.name} · ${pet.bondTitle}` : '♡';
    $('#celebration-earned').textContent = `+${coins} coins`;
    $('#celebration-gift')?.remove();
    if (pet.gifts?.length) {
      const gift = pet.gifts.at(-1), reveal = document.createElement('div'); reveal.id = 'celebration-gift'; reveal.className = 'pet-gift-reveal';
      reveal.innerHTML = `${petGiftArt(gift.id)}<strong></strong><span></span>`;
      reveal.querySelector('strong').textContent = gift.label; reveal.querySelector('span').textContent = `From ${pet.name} ♡`;
      $('#celebration-bond').after(reveal);
    }
    if (!modal.open) modal.show();
    app.feedback.celebrate($('.celebration-flower'));
  }

  function render() {
    syncFocusMode();
    const { state } = app, travelling = app.nav.travelling, editingAvatar = app.avatar.active;
    app.moments?.refresh();
    const ms = displayedRemaining(state.session);
    const formatted = formatTime(ms);
    app.pet?.refreshCare();
    const presence = sessionPhase(state.session);
    app.companion.syncIntent();
    const today = localDate();
    if (today !== lastDay) { lastDay = today; app.pet?.sync(); }
    const minutes = state.history.filter(h => h.date === today).reduce((sum, h) => sum + h.minutes, 0);
    const renderKey = `${formatted}:${presence}:${state.session.duration}:${today}:${minutes}:${editingAvatar}:${travelling}`;
    // The clock polls for deadlines twice a second, but idle rooms and unchanged
    // displayed seconds do not need another set of DOM mutations.
    $('#start-button').disabled = travelling || editingAvatar;
    $('#avatar-button').disabled = travelling;
    $('#decorate-button').disabled = travelling || !app.room;
    $('#rooms-button').disabled = travelling || !app.room;
    $('#coin-wallet').disabled = travelling;
    $('#mini-button').disabled = travelling;
    document.querySelectorAll('[data-house-go], .home-wide').forEach(button => { button.disabled = travelling; });
    $('#rename-room').disabled = travelling;
    $('#room-title-input').disabled = travelling;
    $('#save-room-title').disabled = travelling || !$('#room-title-input').value.trim();
    if (renderKey === lastSessionRender) return;
    lastSessionRender = renderKey;
    $('#timer').textContent = formatted;
    $('#focus-mode-timer').textContent = formatted;
    $('#dock-timer').textContent = formatted;
    $('#timer').setAttribute('aria-label', `${spokenTime(ms)} remaining`);
    $('#focus-mode-timer').setAttribute('aria-label', `${spokenTime(ms)} remaining`);
    document.title = state.session.running ? `${formatted} · Little Hours` : 'Little Hours — a little place to focus';
    $('#session-label').textContent = state.session.running ? 'IN YOUR OWN TIME' : ms < state.session.duration && ms > 0 ? 'A LITTLE BREATHER' : ms === 0 ? 'YOU DID THAT' : 'SETTLE IN';
    $('#timer-caption').textContent = state.session.running ? 'one thing at a time' : ms === 0 ? 'a little progress, made' : ms < state.session.duration ? 'ready when you are' : 'a small beginning';
    const minutesSet = state.session.duration / 60_000, settable = !state.session.running && [0, state.session.duration].includes(remainingAt(state.session)) && !editingAvatar;
    $('#timer-progress').style.strokeDashoffset = String(100 * (1 - (settable ? minutesSet / 120 : ms / state.session.duration)));
    $('.timer-seed').style.transform = settable ? `rotate(${90 + minutesSet * 3}deg)` : '';
    $('#timer-dial').toggleAttribute('data-settable', settable);
    const ring = $('#timer-ring');
    ring.setAttribute('aria-valuenow', minutesSet); ring.setAttribute('aria-valuetext', `${minutesSet} minutes`);
    ring.setAttribute('aria-disabled', String(!settable)); ring.tabIndex = settable ? 0 : -1;
    app.room?.setPlantPhase(plantPhase(state.session.duration, remainingAt(state.session)));
    $('#timer-dial').dataset.phase = state.session.running ? 'focusing' : ms === 0 ? 'complete' : presence;
    const actionIcon = state.session.running ? 'pause' : 'arrow';
    if ($('#start-button').dataset.icon !== actionIcon) {
      $('#start-button svg').outerHTML = icon(actionIcon);
      $('#start-button').dataset.icon = actionIcon;
    }
    renderJournal();
    const label = state.session.running ? 'Pause a moment' : ms === 0 ? 'Begin another session' : ms < state.session.duration ? 'Keep going' : 'Start focusing';
    $('#start-button span').textContent = label;
    $('#start-button').disabled = travelling || editingAvatar;
    $('#reset-session').hidden = !state.session.running && ms === state.session.duration;
    $('#reset-session').disabled = editingAvatar;
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
      button.disabled = state.session.running || editingAvatar;
    });
    app.companion.renderNote();
  }

  function tick() {
    if (app.state.session.running && remainingAt(app.state.session) <= 0) app.acceptUpdate(app.store.update());
    else render();
  }

  function syncDock() {
    syncFocusMode();
    const visible = !app.nav.houseOpen && !app.nav.connected && !app.decorate.active && !focusCollapsed;
    $('#focus-card').hidden = !visible;
    document.body.classList.toggle('focus-collapsed', focusCollapsed);
    $('#focus-toggle').setAttribute('aria-expanded', String(visible));
    $('#focus-toggle').setAttribute('aria-label', window.matchMedia('(max-width: 999px)').matches ? 'Go to focus timer' : visible ? 'Hide focus panel' : 'Show focus panel');
  }

  function revealDock() {
    if (window.matchMedia('(min-width: 1000px)').matches) return;
    const card = $('#focus-card');
    const rect = card.getBoundingClientRect();
    if (rect.top >= 12 && rect.bottom <= window.innerHeight - 12) return;
    card.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }

  function expand() { if (app.panels.current === 'pet') app.panels.close(); focusCollapsed = false; syncDock(); revealDock(); }

  function toggleRunning() {
    const { state } = app;
    if (app.nav.travelling) { app.toast('Please wait until you arrive before starting a focus session.', true); return; }
    const resuming = !state.session.running && remainingAt(state.session) > 0 && remainingAt(state.session) < state.session.duration;
    // Starting is a gesture, which lets the chime sound when this session ends.
    if (!state.session.running) app.audio.unlock();
    // Preserve the action shown on the button if the deadline just passed.
    app.acceptUpdate(app.store.setRunning(!state.session.running));
    if (app.state.session.running) { app.companion.say(resuming ? 'resume' : 'start', { force: true }); app.delights?.show('start'); if (!resuming) app.room?.invitePet(); }
    else if (remainingAt(app.state.session) > 0) app.companion.say('pause', { force: true });
  }
  $('#start-button').addEventListener('click', toggleRunning);
  $('#reset-session').addEventListener('click', () => {
    app.acceptUpdate(app.store.update(draft => { draft.session = createSession(draft.session.duration / 60000); }));
    // Reset hides itself; keep keyboard and screen-reader focus on the timer.
    if ($('#reset-session').hidden) $('#start-button').focus();
  });
  document.querySelectorAll('[data-minutes]').forEach(button => button.addEventListener('click', () => {
    // Choosing the duration that is already selected must not erase a paused session.
    app.acceptUpdate(app.store.update(draft => {
      const minutes = Number(button.dataset.minutes);
      if (!draft.session.running && (minutes * 60_000 !== draft.session.duration || draft.session.remaining === 0)) draft.session = createSession(minutes);
    }));
  }));
  function setMinutes(minutes) {
    app.acceptUpdate(app.store.update(draft => {
      if (!draft.session.running && (minutes * 60_000 !== draft.session.duration || draft.session.remaining === 0)) draft.session = createSession(minutes);
    }));
  }
  const nearestMinutes = raw => DIAL_MINUTES.reduce((best, value) => Math.abs(value - raw) < Math.abs(best - raw) ? value : best);
  let dragging = false;
  function dragTo(event) {
    const box = $('#timer-ring').getBoundingClientRect(), turn = (Math.atan2(event.clientX - box.left - box.width / 2, box.top + box.height / 2 - event.clientY) / (Math.PI * 2) + 1) % 1;
    const current = app.state.session.duration / 60_000;
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
    const at = DIAL_MINUTES.indexOf(app.state.session.duration / 60_000);
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 3, PageDown: -3 }[event.key];
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? DIAL_MINUTES.length - 1 : step ? Math.min(DIAL_MINUTES.length - 1, Math.max(0, at + step)) : null;
    if (index === null) return;
    event.preventDefault(); setMinutes(DIAL_MINUTES[index]);
  });
  $('#task').addEventListener('input', event => {
    const task = event.target.value;
    app.acceptUpdate(app.store.update(draft => { draft.task = task; }));
  });
  $('#focus-toggle').addEventListener('click', () => {
    if (app.panels.current === 'pet') { app.panels.close(); expand(); return; }
    if (app.panels.current) app.panels.close();
    // On a phone the timer lives below the room. A tap should take you there,
    // not hide an already off-screen card and require a second tap.
    if (!$('#focus-card').hidden && window.matchMedia('(max-width: 999px)').matches) {
      revealDock();
      $('#focus-card').focus({ preventScroll: true });
      return;
    }
    if (app.nav.houseOpen || app.nav.connected) {
      if (app.nav.houseOpen) app.nav.setHouseOpen(false);
      if (app.nav.connected) app.nav.setConnectedView(false);
      expand(); return;
    }
    if (app.decorate.active) { focusCollapsed = false; app.decorate.setEditMode(false); }
    else { focusCollapsed = !focusCollapsed; syncDock(); }
    if (!focusCollapsed) revealDock();
  });
  $('.skip-link').addEventListener('click', event => {
    event.preventDefault();
    if (app.nav.houseOpen) app.nav.setHouseOpen(false);
    if (app.nav.connected) app.nav.setConnectedView(false);
    if (app.decorate.active) app.decorate.setEditMode(false);
    if (app.panels.current) app.panels.close();
    expand();
    $('#start-button').focus();
  });
  window.addEventListener('resize', syncDock, { signal: app.signal });

  return { renderFocusReward, showCelebration, render, tick, syncDock, expand, toggleRunning, enterFocusMode, leaveFocusMode, syncFocusMode };
}
