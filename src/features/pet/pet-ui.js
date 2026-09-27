import { PETS } from './pet.js';
import { petArt } from './pet-art.js';
import { PET_LINES } from '../companion/index.js';
import { PET_PERSONALITIES, PET_RITUALS, BOND_LEVELS, bondLevel, petName, cleanPetName } from '../../core/pet-bonds.js';
import { localDate } from '../../core/state.js';
import { $ } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { createPetPortrait } from './pet-portrait.js';

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const minutesLabel = minutes => minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`;

export function createPetUI(app) {
  const name = () => petName(app.state);
  let offered = null, signature = '';
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
  function mark() { return JSON.stringify([app.state.pet, app.state.petBonds, app.state.pets, app.state.petWish, app.state.petFamily, app.state.house.coins, localDate()]); }
  function sync() {
    renderName();
    app.room?.setPetRibbon?.(app.state.petBonds[app.state.pet].ribbon);
    if (app.panels.current === 'pet' && signature !== mark()) renderPanelContent($('#room-panel'));
  }
  function rerender(focus) {
    renderPanelContent($('#room-panel'));
    if (focus) $(focus)?.focus({ preventScroll: true });
  }
  function ritual(id, kind) {
    if (app.nav.travelling || app.nav.houseOpen || app.nav.connected || app.roomUI.compact || app.decorate.active || app.avatar.active) { app.toast('Settle into your room for a little moment together.'); return; }
    const result = app.store.petRitual(id, kind); app.acceptUpdate(result);
    if (!result.ritual.ok) return;
    if (app.state.pet === id) app.room?.petRitual(kind);
    const unlocked = result.ritual.unlocked;
    if (app.state.pet === id) app.delights?.show(unlocked ? 'bond' : kind, 'pet');
    const text = unlocked ? `${petName(app.state, id)} · ${bondLevel(app.state.petBonds[id]).title}. A new ribbon is yours.` : result.ritual.earned ? `A little closer. +${result.ritual.earned} ${result.ritual.earned === 1 ? 'heart' : 'hearts'}` : `${petName(app.state, id)} is always happy to spend time with you.`;
    rerender(`[data-pet-ritual="${kind}"]`);
    $('#pet-ritual-status').textContent = text;
    $('#pet-portrait').dataset.reaction = kind;
  }
  function renderPanel(panel) { offered = null; renderPanelContent(panel); }
  function renderPanelContent(panel) {
    const previous = panel.querySelector('.pet-notebook');
    const active = previous?.contains(document.activeElement) ? document.activeElement : null;
    const focused = active ? { id: active.id, key: active.dataset.draftKey, start: active.selectionStart, end: active.selectionEnd, choice: active.dataset.petChoice, ribbon: active.dataset.petRibbon, detail: [...previous.querySelectorAll('summary')].indexOf(active) } : null;
    const openDetails = previous ? [...previous.querySelectorAll('details')].map(detail => detail.open) : [];
    const scroll = panel.scrollTop;
    panel.dataset.panelKind = 'pet';
    const { state } = app, pet = PETS[state.pet], bond = state.petBonds[state.pet], level = bondLevel(bond), personality = PET_PERSONALITIES[state.pet];
    const today = bond.ritualDay === localDate() ? bond.rituals : [];
    const options = Object.values(PETS).map(p => {
      const home = state.pets.includes(p.id), chosen = state.pet === p.id;
      return `<button class="pet-option ${home ? '' : 'is-locked'}" data-pet-choice="${p.id}" aria-pressed="${chosen}" aria-label="${home ? `Choose ${escape(petName(state, p.id))}` : `Meet ${p.name}, ${p.price} coins`}">${petArt(p.id)}<strong>${escape(petName(state, p.id))}</strong><em class="pet-tag ${home ? chosen ? 'is-here' : '' : 'is-price'}">${home ? chosen ? 'With you' : 'At home' : `${icon('sun')} ${p.price}`}</em></button>`;
    }).join('');
    const memory = [...bond.memories].reverse().slice(0, 4).map(m => `<li><span aria-hidden="true">${m.kind === 'focus' ? '✦' : m.kind === 'bond' ? '♡' : '⌂'}</span><span>${m.kind === 'focus' ? `${m.value} quiet minutes together` : m.kind === 'bond' ? escape(BOND_LEVELS[Math.min(3, m.value)].title) : 'The day you came home'}</span></li>`).join('');
    const markup = `<div class="pet-notebook">
      <div class="pet-hero" style="--pet-tone:${personality.color}"><div class="pet-portrait" id="pet-portrait"><span class="pet-orbit orbit-one">✧</span><span class="pet-orbit orbit-two">✦</span><span class="pet-portrait-floor"></span>${petArt(pet.id)}<span class="portrait-ribbon" style="--ribbon:${BOND_LEVELS[bond.ribbon].color}">♡</span></div><div class="pet-identity"><span class="pet-trait">${personality.trait}</span><h2>${escape(bond.name)}</h2><span class="pet-loves">${personality.loves}</span></div></div>
      <div class="pet-bond"><div class="pet-bond-heading"><strong>${level.title}</strong><span>${icon('heart')} ${bond.affection}</span></div><div class="pet-bond-track" role="progressbar" aria-label="Bond with ${escape(name())}" aria-valuemin="0" aria-valuemax="${level.next?.at || 60}" aria-valuenow="${Math.min(bond.affection, level.next?.at || 60)}"><i style="width:${level.progress * 100}%"></i></div><div class="pet-bond-detail"><span>${minutesLabel(bond.minutes)} together</span><span>${level.next ? `${level.next.at - level.points} hearts to ${level.next.keepsake.toLowerCase()}` : 'Your forever little friend'}</span></div></div>
      <div class="pet-rituals">${Object.entries(PET_RITUALS).map(([kind, item]) => `<button data-pet-ritual="${kind}" id="${kind === 'cuddle' ? 'pet-now' : `pet-${kind}`}" aria-label="${kind === 'cuddle' ? `Give ${escape(name())} a pet` : `${item.label} with ${escape(name())}`}" class="pet-ritual ${today.includes(kind) ? 'is-shared' : ''}">${icon(item.symbol)}<strong>${item.label}</strong><small>${today.includes(kind) ? 'Shared today ✓' : personality.ritual === kind ? 'Favorite · +2 ♡' : '+1 ♡ today'}</small><span class="sr-only">${kind === 'cuddle' ? `Give ${escape(name())} a pet` : ''}</span></button>`).join('')}</div>
      <p class="pet-ritual-status" id="pet-ritual-status" role="status">A heart for every 5 focus minutes. Little rituals count, too.</p>
      <button class="pet-invite" id="pet-invite">${icon('cat')} Come sit with me <span aria-hidden="true">↗</span></button>
      <details class="pet-details"><summary>Make it personal <span aria-hidden="true">＋</span></summary><form id="pet-name-form" class="pet-name-form"><label for="pet-name">Their name</label><div><input id="pet-name" maxlength="24" value="${escape(bond.name)}" autocomplete="off"><button type="submit">Save</button></div></form><label class="pet-family-label" for="pet-family">Loved by <span>(for your portrait)</span></label><input id="pet-family" maxlength="24" value="${escape(state.petFamily)}" placeholder="You, or both of your names" autocomplete="off"><div class="pet-ribbons" aria-label="Keepsake ribbons">${BOND_LEVELS.map((l, i) => `<button data-pet-ribbon="${i}" style="--ribbon:${l.color}" aria-label="${l.keepsake}${i > level.index ? `, ${l.at} hearts to unlock` : ''}" aria-pressed="${bond.ribbon === i}" ${i > level.index ? 'disabled' : ''}><span aria-hidden="true">୨୧</span><small>${i > level.index ? `${l.at} ♡` : l.keepsake.split(' ')[0]}</small></button>`).join('')}</div></details>
      <details class="pet-details"><summary>Our little memories <span aria-hidden="true">${bond.sessions || '♡'}</span></summary>${memory ? `<ol class="pet-memories">${memory}</ol>` : '<p class="pet-empty-memory">Your first focus together starts the story.</p>'}<button class="pet-portrait-save" id="pet-save-portrait">${icon('heart')} Save our portrait</button><p class="pet-portrait-status" role="status"></p></details>
      <div class="pet-collection-heading"><h3>Your little world</h3><span>${icon('sun')} ${state.house.coins}</span></div><div class="pet-options">${options}</div><div class="pet-adopt" id="pet-adopt" hidden></div>
      <p class="pet-gentle-note">Always happy to see you. No streaks to keep.</p></div>`;
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
      const ok = app.room?.invitePet();
      $('#pet-ritual-status').textContent = ok ? `${name()} is coming to keep you company.` : `${name()} is cozy here. Make a little space beside the desk.`;
      if (ok) { app.delights?.show('hello', 'pet'); app.panels.close(); }
    });
    $('#pet-name-form').addEventListener('submit', event => {
      event.preventDefault(); const value = $('#pet-name').value; drafts.delete(`name:${pet.id}`); app.acceptUpdate(app.store.renamePet(pet.id, value)); rerender('#pet-name'); $('#pet-name-form').closest('details').open = true; $('#pet-name').focus();
    });
    bindDraft($('#pet-name'), `name:${pet.id}`); bindDraft($('#pet-family'), 'family');
    $('#pet-family').addEventListener('change', event => { const value = event.target.value; drafts.delete('family'); app.acceptUpdate(app.store.update(draft => { draft.petFamily = cleanPetName(value, ''); })); });
    panel.querySelectorAll('[data-pet-ribbon]').forEach(button => button.addEventListener('click', () => {
      app.acceptUpdate(app.store.setPetRibbon(pet.id, Number(button.dataset.petRibbon))); rerender(`[data-pet-ribbon="${button.dataset.petRibbon}"]`); $('.pet-ribbons').closest('details').open = true; $(`[data-pet-ribbon="${button.dataset.petRibbon}"]`).focus();
    }));
    $('#pet-save-portrait').disabled = portrait.pending; $('.pet-portrait-status').textContent = portrait.message;
    $('#pet-save-portrait').addEventListener('click', async event => {
      event.currentTarget.disabled = true; portrait.pending = true;
      try {
        const blob = await createPetPortrait(app.state), url = URL.createObjectURL(blob), link = document.createElement('a');
        link.href = url; link.download = 'our-little-hours.png'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        portrait.message = 'Your portrait is ready to keep or send.';
      } catch { portrait.message = 'The portrait couldn’t save. Please try again.'; }
      finally { portrait.pending = false; if (app.panels.current === 'pet') { $('#pet-save-portrait').disabled = false; $('.pet-portrait-status').textContent = portrait.message; } }
    });
    if (offered && !state.pets.includes(offered)) offer(offered, false);
    if (focused) {
      const control = focused.key ? panel.querySelector(`[data-draft-key="${focused.key}"]`) : focused.id ? panel.querySelector(`#${focused.id}`) : focused.choice ? panel.querySelector(`[data-pet-choice="${focused.choice}"]`) : focused.ribbon ? panel.querySelector(`[data-pet-ribbon="${focused.ribbon}"]`) : previous.querySelectorAll('summary')[focused.detail];
      if (control && !control.disabled) { control.focus({ preventScroll: true }); if (focused.key && focused.start != null) control.setSelectionRange(focused.start, focused.end); }
    }
  }
  function offer(id, focus = true) {
    const pet = PETS[id], box = $('#pet-adopt'), coins = app.state.house.coins, short = Math.max(0, pet.price - coins), wished = app.state.petWish === id;
    box.hidden = false;
    box.innerHTML = `<div class="pet-adopt-art">${petArt(id)}</div><div class="pet-adopt-copy"><strong>${pet.name} the ${pet.kind}</strong><small class="pet-adopt-about">${PET_PERSONALITIES[id].trait}. ${PET_PERSONALITIES[id].loves}.</small><div class="pet-adopt-bar" role="progressbar" aria-label="Coins toward adoption" aria-valuemin="0" aria-valuemax="${pet.price}" aria-valuenow="${Math.min(coins, pet.price)}"><span style="width:${Math.min(100, coins / pet.price * 100)}%"></span></div><p class="pet-adopt-note">${short ? `${short} more coins · ${Math.ceil(short / 25)} quiet 25-minute ${short > 25 ? 'sessions' : 'session'}` : 'A little place in your home is ready.'}</p><label for="pet-adopt-name">A name for your friend</label><input id="pet-adopt-name" maxlength="24" value="${pet.name}"><button class="start-button" id="pet-adopt-button" ${short ? 'disabled' : ''}>Welcome home · ${pet.price} ${icon('sun')}</button>${short ? `<button class="pet-wish" id="pet-wish" aria-pressed="${wished}">${wished ? 'Your focus wish ✓' : 'Make this my focus wish'}</button>` : ''}</div>`;
    $('#pet-wish')?.addEventListener('click', () => { app.acceptUpdate(app.store.update(draft => { draft.petWish = wished ? null : id; })); offer(id); $('#pet-wish').focus(); });
    $('#pet-adopt-button').addEventListener('click', () => {
      const result = app.store.adoptPet(id, $('#pet-adopt-name').value); app.acceptUpdate(result);
      if (!result.adopted) { app.toast(result.reason); return; }
      drafts.delete(`adopt:${id}`); offered = null; rerender(`[data-pet-choice="${id}"]`);
      app.room?.petRitual('play'); app.delights?.show('adopt', 'pet');
      $('#pet-ritual-status').textContent = `Welcome home, ${name()}. Your little story starts here.`;
      app.speech?.say('pet', (PET_LINES[id] || PET_LINES.cat).hello);
    });
    bindDraft($('#pet-adopt-name'), `adopt:${id}`);
    if (focus) { $('#pet-adopt-name').focus({ preventScroll: true }); box.scrollIntoView({ block: 'nearest', behavior: 'instant' }); }
  }
  return { name, feedback, renderName, onPetCarry, renderPanel, sync };
}
