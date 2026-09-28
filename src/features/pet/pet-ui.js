import { PETS } from './pet.js';
import { petArt } from './pet-art.js';
import { PET_LINES } from '../companion/index.js';
import { PET_PERSONALITIES, bondLevel, petName, cleanPetName } from '../../core/pet-bonds.js';
import { localDate } from '../../core/state.js';
import { $ } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { createPetPortrait } from './pet-portrait.js';
import { petPageMarkup } from './pet-page.js';
import { petEntity, FRIENDSHIP_LEVELS } from '../../core/friendships.js';
import { sessionStarted } from '../../core/session.js';

export function createPetUI(app) {
  const name = () => petName(app.state);
  let offered = null, signature = '', tab = 'together';
  const friends = new Map();
  const drafts = new Map(), portrait = { pending: false, message: '' };
  function bindDraft(input, key) {
    input.dataset.draftKey = key;
    if (drafts.has(key)) input.value = drafts.get(key);
    input.addEventListener('input', () => drafts.set(key, input.value));
  }
  function feedback({ species = app.state.pet, by = 'you' } = {}) {
    const bond = app.state.petBonds[species];
    if (by === 'you' && !app.decorate.active && !app.avatar.active && (bond.ritualDay !== localDate() || !bond.rituals.includes('cuddle'))) {
      const result = app.store.petRitual(species, 'cuddle'); app.acceptUpdate(result);
      if (result.ritual.unlocked) app.delights?.show('bond', 'pet');
    }
    if (by === 'companion') app.speech?.say('pet', (PET_LINES[species] || PET_LINES.cat).friend);
  }
  function renderName() {
    app.roomUI.renderLabel();
    $('#pet-company').textContent = `You & ${name()}`; $('#pet-button-label').textContent = name();
    $('#pet-button').setAttribute('aria-label', `${name()}: pet or choose your pet`);
  }
  function onPetCarry({ species, held }) { if (held) app.speech?.say('pet', (PET_LINES[species] || PET_LINES.cat).carry); }
  function mark() { return JSON.stringify([app.state.pet, app.state.petBonds, app.state.pets, app.state.petWish, app.state.friendships, app.state.session, app.state.house.coins, localDate()]); }
  function sync() {
    renderName();
    app.room?.setPetRibbon?.(app.state.petBonds[app.state.pet].ribbon);
    if (app.panels.current === 'pet' && signature !== mark()) renderPanelContent($('#room-panel'));
    const family = $('#pet-family');
    if (family && !drafts.has('family') && family.value !== app.state.petFamily) family.value = app.state.petFamily;
  }
  function rerender(focus) {
    renderPanelContent($('#room-panel'));
    if (focus) $(focus)?.focus({ preventScroll: true });
  }
  function receipt(selector, text, label = text) {
    const status = $(selector);
    status.setAttribute('aria-label', label);
    status.textContent = text;
  }
  function ritual(id, kind) {
    if (app.nav.travelling || app.nav.houseOpen || app.nav.connected || app.roomUI.compact || app.decorate.active || app.avatar.active) { app.toast('Return to your room first.'); return; }
    const result = app.store.petRitual(id, kind); app.acceptUpdate(result);
    if (!result.ritual.ok) return;
    if (app.state.pet === id) app.room?.petRitual(kind);
    const unlocked = result.ritual.unlocked;
    if (app.state.pet === id) app.delights?.show(unlocked ? 'bond' : kind, 'pet');
    const text = unlocked ? `${bondLevel(app.state.petBonds[id]).keepsake} unlocked` : result.ritual.earned ? `+${result.ritual.earned} ♡` : '♡';
    const label = unlocked ? text : result.ritual.earned ? `${result.ritual.earned} ${result.ritual.earned === 1 ? 'heart' : 'hearts'} with ${petName(app.state, id)}` : 'Shared today';
    rerender(`[data-pet-ritual="${kind}"]`);
    receipt('#pet-ritual-status', text, label);
    $('#pet-portrait').dataset.moment = kind === 'cuddle' ? 'quiet' : kind === 'treat' ? 'snack' : 'play';
  }
  function renderPanel(panel) { offered = null; renderPanelContent(panel); }
  function renderPanelContent(panel) {
    const previous = panel.querySelector('.pet-notebook');
    const active = previous?.contains(document.activeElement) ? document.activeElement : null;
    const focused = active ? { id: active.id, key: active.dataset.draftKey, start: active.selectionStart, end: active.selectionEnd, choice: active.dataset.petChoice, ribbon: active.dataset.petRibbon, friend: active.dataset.petFriend, detail: [...previous.querySelectorAll('summary')].indexOf(active) } : null;
    const openDetails = previous ? [...previous.querySelectorAll('details')].map(detail => detail.open) : [];
    const scroll = panel.scrollTop;
    panel.dataset.panelKind = 'pet';
    const { state } = app, pet = PETS[state.pet];
    const friendId = friends.get(state.pet) || state.friendships.focusBuddies[petEntity(state.pet)]?.slice(4) || state.pets.find(id => id !== state.pet);
    const markup = petPageMarkup(state, tab, friendId);
    if (previous) { const template = document.createElement('template'); template.innerHTML = markup; previous.replaceChildren(...template.content.firstElementChild.childNodes); }
    else panel.insertAdjacentHTML('beforeend', markup);
    panel.querySelectorAll('.pet-details').forEach((detail, index) => { detail.open = Boolean(openDetails[index]); });
    panel.scrollTop = scroll;
    signature = mark();
    panel.querySelectorAll('[data-pet-choice]').forEach(button => button.addEventListener('click', () => {
      const id = button.dataset.petChoice;
      if (!app.state.pets.includes(id)) { offered = id; offer(id); return; }
      if (app.state.pet === id) return;
      offered = null; app.acceptUpdate(app.store.update(draft => { if (draft.pets.includes(id)) draft.pet = id; }));
      rerender(`[data-pet-choice="${id}"]`);
      app.speech?.say('pet', (PET_LINES[id] || PET_LINES.cat).hello);
      app.delights?.show('hello', 'pet');
    }));
    panel.querySelectorAll('[data-pet-ritual]').forEach(button => button.addEventListener('click', () => ritual(pet.id, button.dataset.petRitual)));
    $('#pet-invite').addEventListener('click', () => {
      app.panels.close(); const ok = app.room?.invitePet();
      if (ok) app.delights?.show('hello', 'pet');
      else app.toast('Make space beside the desk.');
    });
    $('#pet-name-form').addEventListener('submit', event => {
      event.preventDefault(); const value = $('#pet-name').value; drafts.delete(`name:${pet.id}`); app.acceptUpdate(app.store.renamePet(pet.id, value)); rerender('#pet-name'); $('#pet-name-form').closest('details').open = true; $('#pet-name').focus();
    });
    bindDraft($('#pet-name'), `name:${pet.id}`); bindDraft($('#pet-family'), 'family');
    $('#pet-family').addEventListener('change', event => { const value = event.target.value; drafts.delete('family'); app.acceptUpdate(app.store.update(draft => { draft.petFamily = cleanPetName(value, ''); })); });
    panel.querySelectorAll('[data-pet-ribbon]').forEach(button => button.addEventListener('click', () => {
      app.acceptUpdate(app.store.setPetRibbon(pet.id, Number(button.dataset.petRibbon))); rerender(`[data-pet-ribbon="${button.dataset.petRibbon}"]`); $(`[data-pet-ribbon="${button.dataset.petRibbon}"]`).focus();
    }));
    panel.querySelectorAll('[data-pet-tab]').forEach(button => {
      const select = value => { tab = value; rerender(`#pet-tab-${value}`); };
      button.addEventListener('click', () => select(button.dataset.petTab));
      button.addEventListener('keydown', event => {
        const tabs = ['together', 'friends', 'keepsakes'], index = tabs.indexOf(tab);
        const target = event.key === 'ArrowRight' ? tabs[(index + 1) % 3] : event.key === 'ArrowLeft' ? tabs[(index + 2) % 3] : event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[2] : null;
        if (target) { event.preventDefault(); select(target); }
      });
    });
    $('#pet-focus-buddy').addEventListener('change', event => app.acceptUpdate(app.store.setFocusBuddy(petEntity(pet.id), event.target.value ? petEntity(event.target.value) : null)));
    panel.querySelectorAll('[data-pet-friend]').forEach(button => button.addEventListener('click', () => { friends.set(pet.id, button.dataset.petFriend); rerender(`[data-pet-friend="${button.dataset.petFriend}"]`); }));
    panel.querySelectorAll('[data-friend-moment]').forEach(button => button.addEventListener('click', () => {
      const friend = button.dataset.friendId, kind = button.dataset.friendMoment;
      const result = app.store.shareFriendshipMoment(petEntity(pet.id), petEntity(friend), kind); app.acceptUpdate(result);
      if (!result.friendship.ok) return;
      rerender(`[data-friend-moment="${kind}"]`);
      if (app.state.pet !== pet.id) return;
      $('#pet-friend-scene').dataset.moment = kind;
      const pair = `${petName(app.state, pet.id)} & ${petName(app.state, friend)}`;
      const text = result.friendship.unlocked ? `${FRIENDSHIP_LEVELS[result.friendship.level].title} · frame unlocked` : result.friendship.earned ? `+${result.friendship.earned} ♡` : '♡';
      receipt('#pet-friend-status', text, result.friendship.unlocked ? text : result.friendship.earned ? `${result.friendship.earned} friendship heart for ${pair}` : 'Shared today');
    }));
    $('#pet-focus-pair')?.addEventListener('click', event => {
      const friend = event.currentTarget.dataset.friendId;
      app.acceptUpdate(app.store.setFocusBuddy(petEntity(pet.id), petEntity(friend)));
      if (sessionStarted(app.state.session)) receipt('#pet-friend-status', 'Ready', `${petName(app.state, pet.id)} & ${petName(app.state, friend)} chosen for next focus`);
      else { app.panels.close(); app.timer.expand(); $('#start-button').focus({ preventScroll: true }); }
    });
    $('.pet-portrait-status').textContent = portrait.message;
    for (const button of panel.querySelectorAll('.pet-portrait-save')) {
      button.disabled = portrait.pending;
      button.addEventListener('click', async () => {
        portrait.pending = true; panel.querySelectorAll('.pet-portrait-save').forEach(control => { control.disabled = true; });
        const friend = button.dataset.friendId || null;
        try {
          const blob = await createPetPortrait(app.state, friend), url = URL.createObjectURL(blob), link = document.createElement('a');
          link.href = url; link.download = friend ? 'our-little-friends.png' : 'our-little-hours.png'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
          portrait.message = 'Saved';
        } catch { portrait.message = 'Couldn’t save. Try again.'; }
        finally { portrait.pending = false; if (app.panels.current === 'pet') { panel.querySelectorAll('.pet-portrait-save').forEach(control => { control.disabled = false; }); $('.pet-portrait-status').textContent = portrait.message; } }
      });
    }
    if (offered && !state.pets.includes(offered)) offer(offered, false);
    if (focused) {
      const control = focused.key ? panel.querySelector(`[data-draft-key="${focused.key}"]`) : focused.id ? panel.querySelector(`#${focused.id}`) : focused.choice ? panel.querySelector(`[data-pet-choice="${focused.choice}"]`) : focused.friend ? panel.querySelector(`[data-pet-friend="${focused.friend}"]`) : focused.ribbon ? panel.querySelector(`[data-pet-ribbon="${focused.ribbon}"]`) : previous.querySelectorAll('summary')[focused.detail];
      if (control && !control.disabled) { control.focus({ preventScroll: true }); if (focused.key && focused.start != null) control.setSelectionRange(focused.start, focused.end); }
    }
  }
  function offer(id, focus = true) {
    const pet = PETS[id], box = $('#pet-adopt'), coins = app.state.house.coins, short = Math.max(0, pet.price - coins), wished = app.state.petWish === id;
    box.hidden = false;
    box.innerHTML = `<div class="pet-adopt-art">${petArt(id)}</div><div class="pet-adopt-copy"><strong>${pet.name} the ${pet.kind}</strong><small class="pet-adopt-about">${PET_PERSONALITIES[id].trait}</small><div class="pet-adopt-bar" role="progressbar" aria-label="Coins toward adoption" aria-valuemin="0" aria-valuemax="${pet.price}" aria-valuenow="${Math.min(coins, pet.price)}"><span style="width:${Math.min(100, coins / pet.price * 100)}%"></span></div><p class="pet-adopt-note">${short ? `${short} more coins` : 'Ready'}</p><label for="pet-adopt-name">Name</label><input id="pet-adopt-name" maxlength="24" value="${pet.name}"><button class="start-button" id="pet-adopt-button" ${short ? 'disabled' : ''}>Welcome home · ${pet.price} ${icon('sun')}</button>${short ? `<button class="pet-wish" id="pet-wish" aria-pressed="${wished}">${wished ? 'Focus wish ✓' : 'Set focus wish'}</button>` : ''}</div>`;
    $('#pet-wish')?.addEventListener('click', () => { app.acceptUpdate(app.store.update(draft => { draft.petWish = wished ? null : id; })); offer(id); $('#pet-wish').focus(); });
    $('#pet-adopt-button').addEventListener('click', () => {
      const result = app.store.adoptPet(id, $('#pet-adopt-name').value); app.acceptUpdate(result);
      if (!result.adopted) { app.toast(result.reason); return; }
      drafts.delete(`adopt:${id}`); offered = null; rerender(`[data-pet-choice="${id}"]`);
      $('#pet-portrait').dataset.moment = 'play';
      receipt('#pet-ritual-status', `Welcome home, ${name()} ♡`);
      app.speech?.say('pet', (PET_LINES[id] || PET_LINES.cat).hello);
    });
    bindDraft($('#pet-adopt-name'), `adopt:${id}`);
    if (focus) { $('#pet-adopt-name').focus({ preventScroll: true }); box.scrollIntoView({ block: 'nearest', behavior: 'instant' }); }
  }
  return { name, feedback, renderName, onPetCarry, renderPanel, sync };
}
