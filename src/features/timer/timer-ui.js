import { createSession, remainingAt, formatTime, spokenTime, sessionPhase, displayedRemaining, DIAL_MINUTES } from '../../core/session.js';
import { plantPhase } from '../../core/room-types.js';
import { localDate } from '../../core/state.js';
import { focusCoins, nextExpansion } from '../../core/house.js';
import { $ } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { sproutArt } from '../../ui/ui-art.js';

export function createTimerUI(app) {
  let lastSessionRender = '', journalSignature = '', focusCollapsed = false;

  function renderFocusReward() {
    const { state } = app;
    const reward = focusCoins(state.session.duration / 60_000), next = nextExpansion(state.house);
    const name = next?.id === 'garden' ? 'garden wing' : 'upstairs hideaway';
    const progress = !next ? 'A little more saved for your home' : state.house.coins >= next.price ? `Your ${name} is ready to build` : `${next.price - state.house.coins} coins to your ${name}`;
    $('#focus-reward').innerHTML = `<span class="reward-icon">${sproutArt()}</span><span><strong>${reward ? `+${reward} coins` : 'Coins from 5 min'}</strong><small>${progress}</small></span>`;
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

  function showCelebration(earned) {
    const modal = $('#session-celebration');
    $('#celebration-copy').textContent = `${earned} quiet minutes, just for you. Small beginnings add up to something good.`;
    $('#celebration-earned').textContent = `+${earned} coins`;
    if (!modal.open) modal.showModal();
    app.feedback.celebrate($('.celebration-flower'));
  }

  function render() {
    const { state } = app, travelling = app.nav.travelling, editingAvatar = app.avatar.active;
    app.moments?.refresh();
    const ms = displayedRemaining(state.session);
    const formatted = formatTime(ms);
    const presence = sessionPhase(state.session);
    app.companion.syncIntent();
    const today = localDate();
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
    if (renderKey === lastSessionRender) return;
    lastSessionRender = renderKey;
    $('#timer').textContent = formatted;
    $('#dock-timer').textContent = formatted;
    $('#timer').setAttribute('aria-label', `${spokenTime(ms)} remaining`);
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

  function expand() { focusCollapsed = false; syncDock(); revealDock(); }

  $('#start-button').addEventListener('click', () => {
    const { state } = app;
    if (app.nav.travelling) { app.toast('Please wait until you arrive before starting a focus session.', true); return; }
    const resuming = !state.session.running && remainingAt(state.session) > 0 && remainingAt(state.session) < state.session.duration;
    // Starting is a gesture, which lets the chime sound when this session ends.
    if (!state.session.running) app.audio.unlock();
    // Preserve the action shown on the button if the deadline just passed.
    app.acceptUpdate(app.store.setRunning(!state.session.running));
    if (app.state.session.running) app.companion.say(resuming ? 'resume' : 'start', { force: true });
    else if (remainingAt(app.state.session) > 0) app.companion.say('pause', { force: true });
  });
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

  return { renderFocusReward, showCelebration, render, tick, syncDock, expand };
}
