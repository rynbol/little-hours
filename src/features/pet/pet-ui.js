import { PETS } from './pet.js';
import { PET_LINES } from '../companion/index.js';
import { bondLevel, petName, focusPetId } from '../../core/pet-bonds.js';
import { petCareStatus, MEAL_COST } from '../../core/pet-care.js';
import { clockNow } from '../../core/test-pins.js';
import { localDate } from '../../core/state.js';
import { $ } from '../../ui/dom.js';
import { petCardMarkup, escapePetText } from './pet-card.js';
import { createPetCloseup } from './pet-closeup.js';
import { remainingAt, formatTime, sessionStarted } from '../../core/session.js';

export function createPetUI(app) {
  const name = () => petName(app.state), drafts = new Map();
  let offered = null, signature = '', careSignature = '', closeup = null, closeupHost = null;
  const available = () => !app.nav.travelling && !app.nav.houseOpen && !app.nav.connected && !app.roomUI.compact && !app.decorate.active && !app.avatar.active;
  function feedback({ species = app.state.pet, by = 'you' } = {}) {
    const bond = app.state.petBonds[species];
    if (by === 'you' && available()) {
      if (bond.ritualDay !== localDate() || !bond.rituals.includes('cuddle')) {
        const result = app.store.petRitual(species, 'cuddle'); app.acceptUpdate(result);
        if (result.ritual.unlocked) app.delights?.show('bond', 'pet');
      }
      if (app.panels.current !== 'pet') app.panels.open('pet');
    }
    if (by === 'companion') app.speech?.say('pet', (PET_LINES[species] || PET_LINES.cat).friend);
  }
  function renderName() {
    app.roomUI.renderLabel();
    $('#pet-company').textContent = `You & ${name()}`; $('#pet-button-label').textContent = name();
    $('#pet-button').setAttribute('aria-label', `${name()}: open pet care`);
  }
  function onPetCarry({ species, held }) { if (held) app.speech?.say('pet', (PET_LINES[species] || PET_LINES.cat).carry); }
  function mark() { return JSON.stringify([app.state.pet, app.state.petBonds, app.state.pets, app.state.petWish, app.state.house.coins]); }
  function sync() {
    renderName();
    const bond = app.state.petBonds[app.state.pet];
    app.room?.setPetRibbon?.(bond.ribbon);
    app.room?.setPetCare?.(bond.care, bondLevel(bond).index, bond.gift);
    if (app.panels.current === 'pet' && signature !== mark()) renderPanelContent($('#room-panel'));
    refreshStudy();
  }
  function refreshStudy() {
    if (app.panels?.current !== 'pet' || !closeup) return;
    const state = app.state, id = state.pet, bond = state.petBonds[id], together = focusPetId(state);
    closeup.update({ id, name: name(), ribbon: bond.ribbon, care: bond.care, gift: bond.gift, focusing: state.session.running && together === id });
    const button = $('#pet-study'), remaining = remainingAt(state.session);
    if (button) { button.textContent = state.session.running ? `Pause · ${formatTime(remaining)}` : sessionStarted(state.session) ? `Continue with ${petName(state, together)}` : `Study with ${name()}`; button.disabled = app.nav.travelling || app.avatar.active; }
  }
  function close() { closeup?.dispose(); closeup = null; closeupHost?.remove(); closeupHost = null; }
  app.signal.addEventListener('abort', close, { once: true });
  function refreshCare() {
    if (app.panels?.current !== 'pet') return;
    refreshStudy();
    const care = petCareStatus(app.state.petBonds[app.state.pet], clockNow()), next = JSON.stringify(care);
    if (careSignature === next) return;
    careSignature = next;
    const play = $('#pet-play'), feed = $('#pet-feed');
    if (!play || !feed) return;
    play.querySelector('small').textContent = care.playReady ? '+1 ♡' : `${care.playMinutes}m ♡`;
    play.setAttribute('aria-label', `Play with ${name()}${care.playReady ? ', earn one heart' : `, heart in ${care.playMinutes} minutes`}`);
    feed.querySelector('small').textContent = care.full ? 'Full ♡' : `${MEAL_COST} ◉`;
    document.querySelectorAll('[data-pet-meal]').forEach(button => {
      button.disabled = care.full || app.state.house.coins < MEAL_COST;
      button.querySelector('small').textContent = care.full ? `${care.mealMinutes}m` : `${MEAL_COST} ◉ · +1 ♡`;
    });
    $('.pet-meal-note').textContent = care.full ? `Full for ${care.mealMinutes} min` : app.state.house.coins < MEAL_COST ? `${MEAL_COST - app.state.house.coins} more coins` : `${app.state.house.coins} ◉`;
  }
  function receipt(text) { const node = $('#pet-ritual-status'); if (node) node.textContent = text; }
  function ready() {
    if (!available()) { app.toast('Return to your room first.'); return false; }
    if (app.room?.petCareBusy?.()) { receipt('One little moment…'); return false; }
    return true;
  }
  function ritual(id, kind) {
    if (kind === 'cuddle' ? !available() : !ready()) return;
    if (kind === 'play' && !app.room?.canPetCare()) { receipt('Make a little space to play.'); return; }
    const result = app.store.petRitual(id, kind); app.acceptUpdate(result);
    if (!result.ritual.ok) return;
    if (app.state.pet === id) { app.room?.petRitual(kind); closeup?.react(kind); }
    app.delights?.show(result.ritual.unlocked ? 'bond' : kind, 'pet');
    receipt(result.ritual.earned ? `+${result.ritual.earned} ♡` : '♡');
  }
  function renderPanel(panel) { offered = null; renderPanelContent(panel); }
  function renderPanelContent(panel) {
    const previous = panel.querySelector('.pet-card'), active = previous?.contains(document.activeElement) ? document.activeElement : null;
    const focusId = active?.id, focusedSummary = active?.tagName === 'SUMMARY' ? active.parentElement.id : null;
    const selection = active?.tagName === 'INPUT' ? [active.selectionStart, active.selectionEnd] : null;
    const details = new Set([...panel.querySelectorAll('details[open]')].map(node => node.id));
    const naming = previous && !$('#pet-name-form').hidden, meals = previous && !$('#pet-meals').hidden, scroll = panel.scrollTop;
    const { state } = app, id = state.pet;
    const markup = petCardMarkup(state, clockNow());
    closeupHost?.remove();
    if (previous) previous.outerHTML = markup; else panel.insertAdjacentHTML('beforeend', markup);
    const slot = $('#pet-closeup');
    if (closeupHost) slot.replaceWith(closeupHost);
    else { closeupHost = slot; closeup = createPetCloseup(closeupHost, { onPet: chosen => ritual(chosen, 'cuddle') }); }
    refreshStudy();
    for (const key of details) panel.querySelector(`#${key}`)?.setAttribute('open', '');
    $('#pet-name-form').hidden = !naming; $('#pet-meals').hidden = !meals; $('#pet-feed').setAttribute('aria-expanded', String(Boolean(meals)));
    signature = mark(); careSignature = JSON.stringify(petCareStatus(state.petBonds[id], clockNow()));
    const input = $('#pet-name');
    if (drafts.has(id)) input.value = drafts.get(id);
    input.addEventListener('input', () => drafts.set(id, input.value));
    $('#pet-edit-name').addEventListener('click', () => { $('#pet-name-form').hidden = !$('#pet-name-form').hidden; if (!$('#pet-name-form').hidden) { input.focus(); input.select(); } });
    $('#pet-name-form').addEventListener('submit', event => {
      event.preventDefault(); if (!input.value.trim()) return;
      const value = input.value; drafts.delete(id); app.acceptUpdate(app.store.renamePet(id, value));
      $('#pet-name-form').hidden = true; $('#pet-edit-name').focus({ preventScroll: true });
    });
    input.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); drafts.delete(id); $('#pet-name-form').hidden = true; $('#pet-edit-name').focus(); } });
    panel.querySelectorAll('[data-pet-ritual]').forEach(button => button.addEventListener('click', () => ritual(id, button.dataset.petRitual)));
    $('#pet-feed').addEventListener('click', () => { const box = $('#pet-meals'); box.hidden = !box.hidden; $('#pet-feed').setAttribute('aria-expanded', String(!box.hidden)); });
    panel.querySelectorAll('[data-pet-meal]').forEach(button => button.addEventListener('click', () => {
      if (!ready()) return;
      if (!app.room?.canPetCare()) { receipt('Make a little space for the bowl.'); return; }
      const food = button.dataset.petMeal, result = app.store.feedPet(id, food); app.acceptUpdate(result);
      if (!result.meal.ok) { receipt(result.meal.reason); return; }
      if (app.state.pet === id) { app.room?.petRitual('treat', food); closeup?.react('treat'); }
      $('#pet-meals').hidden = true; $('#pet-feed').setAttribute('aria-expanded', 'false'); $('#pet-feed').focus({ preventScroll: true });
      receipt('+1 ♡');
    }));
    $('#pet-invite').addEventListener('click', () => { if (ready() && !app.room?.invitePet()) receipt('Make a little space beside your seat.'); });
    $('#pet-study').addEventListener('click', () => app.timer.toggleRunning());
    $('#pet-nap')?.addEventListener('click', () => { if (ready() && !app.room?.invitePet('nap')) receipt('Make a little space beside your seat.'); });
    $('#pet-dance')?.addEventListener('click', () => { if (ready()) { app.room?.petRitual('dance'); closeup?.react('dance'); } });
    panel.querySelectorAll('[data-pet-fabric]').forEach(button => button.addEventListener('click', () => {
      const result = app.store.choosePetFabric(id, button.dataset.petFabric); app.acceptUpdate(result);
      if (!result.fabric.ok) receipt(result.fabric.reason);
    }));
    panel.querySelectorAll('[data-pet-ribbon]').forEach(button => button.addEventListener('click', () => app.acceptUpdate(app.store.setPetRibbon(id, Number(button.dataset.petRibbon)))));
    panel.querySelectorAll('[data-pet-gift]').forEach(button => button.addEventListener('click', () => { app.acceptUpdate(app.store.selectPetGift(id, button.dataset.petGift)); if (app.state.pet === id) closeup?.react('cuddle'); }));
    panel.querySelectorAll('[data-pet-choice]').forEach(button => button.addEventListener('click', () => {
      const chosen = button.dataset.petChoice;
      if (!app.state.pets.includes(chosen)) { offered = chosen; offer(chosen); return; }
      if (app.state.pet === chosen) return;
      offered = null; app.acceptUpdate(app.store.update(draft => { if (draft.pets.includes(chosen)) draft.pet = chosen; }));
      app.delights?.show('hello', 'pet'); app.speech?.say('pet', (PET_LINES[chosen] || PET_LINES.cat).hello);
    }));
    if (offered && !state.pets.includes(offered)) offer(offered, false);
    panel.scrollTop = scroll;
    const focus = focusId ? panel.querySelector(`#${focusId}`) : focusedSummary ? panel.querySelector(`#${focusedSummary} > summary`) : null;
    if (focus && !focus.disabled) { focus.focus({ preventScroll: true }); if (selection) focus.setSelectionRange(...selection); }
  }
  function offer(id, focus = true) {
    const pet = PETS[id], box = $('#pet-adopt'), short = Math.max(0, pet.price - app.state.house.coins), wished = app.state.petWish === id;
    box.hidden = false;
    box.innerHTML = `<h3>${pet.name}</h3><p>${pet.kind}</p><label for="pet-adopt-name">Name</label><input id="pet-adopt-name" maxlength="24" value="${escapePetText(drafts.get(`adopt:${id}`) || pet.name)}"><button id="pet-adopt-button" ${short ? 'disabled' : ''}>Welcome home · ${pet.price} ◉</button>${short ? `<p class="pet-adopt-note">${short} more coins</p><button id="pet-wish" aria-pressed="${wished}">${wished ? 'Saving for you ✓' : 'Save up for me'}</button>` : ''}`;
    $('#pet-adopt-name').addEventListener('input', event => drafts.set(`adopt:${id}`, event.target.value));
    $('#pet-wish')?.addEventListener('click', () => { app.acceptUpdate(app.store.update(draft => { draft.petWish = wished ? null : id; })); });
    $('#pet-adopt-button').addEventListener('click', () => {
      const result = app.store.adoptPet(id, $('#pet-adopt-name').value); offered = null; app.acceptUpdate(result);
      if (!result.adopted) { receipt(result.reason); return; }
      drafts.delete(`adopt:${id}`); $('#pet-collection').open = false; app.room?.invitePet(); app.delights?.show('hello', 'pet');
      receipt(`Welcome home, ${name()} ♡`);
    });
    if (focus) { $('#pet-adopt-name').focus({ preventScroll: true }); box.scrollIntoView({ block: 'nearest', behavior: 'instant' }); }
  }
  function welcome() { if (bondLevel(app.state.petBonds[app.state.pet]).index >= 1 && available()) app.room?.invitePet(); }
  function previewAdoption(id) {
    if (!available() || !PETS[id] || app.state.pets.includes(id)) return;
    app.panels.open('pet'); offered = id; $('#pet-collection').open = true; offer(id);
  }
  return { name, feedback, renderName, onPetCarry, renderPanel, sync, refreshCare, welcome, previewAdoption, close, diagnostics: () => closeup?.diagnostics() || null };
}
