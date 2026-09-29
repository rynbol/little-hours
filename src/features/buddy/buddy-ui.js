import { $ } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { BUDDY_COLORS, FINDS, PLACES, adventureStory, buddyStage, colorOf, findOf, nextBuddyStage, placeOf, waitingFind } from '../../core/buddy.js';
import { clockNow, clockRandom } from '../../core/test-pins.js';
import { findArt } from './buddy-art.js';
import { createBuddyCloseup } from './buddy-closeup.js';
import { planActivity, SPOT_TYPES, LEAVE_LINES, RETURN_LINES, WELCOME_LINES, GREET_REPLIES } from './buddy-plan.js';
import './buddy.css';

const WELCOME_AFTER = 30 * 60_000;
const TIER_LABELS = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare' };
const pick = list => list[Math.min(list.length - 1, Math.floor(clockRandom() * list.length))];
const hours = minutes => minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60 ? `${minutes % 60} min` : ''}`.trim();
const escapeText = text => String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

export function createBuddyUI(app) {
  const card = document.createElement('dialog');
  card.className = 'buddy-card'; card.id = 'buddy-card'; card.setAttribute('aria-labelledby', 'buddy-card-title');
  const album = document.createElement('dialog');
  album.className = 'buddy-album'; album.id = 'buddy-album'; album.setAttribute('aria-labelledby', 'buddy-album-title');
  document.body.append(card, album);

  let mode = null, albumKey = '', started = false, last = null, nextTimer = 0, replyTimer = 0, welcome = Boolean(app.state.seenAt && clockNow() - app.state.seenAt > WELCOME_AFTER);
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
  const buddy = () => app.state.buddy;
  const say = (who, lines) => app.speech?.say(who, lines);

  function modeNow() {
    if (app.state.session.running) return 'away';
    return waitingFind(buddy()) ? 'back' : 'idle';
  }

  function sync() {
    const state = buddy(), waiting = waitingFind(state);
    app.room?.setBuddy?.({ colors: colorOf(state.color), stage: buddyStage(state.minutes).id, holding: Boolean(waiting) });
    const next = modeNow(), previous = mode;
    mode = next;
    const tool = document.querySelector('#buddy-tool-label');
    if (tool) { tool.textContent = state.name; tool.parentElement.dataset.buddy = mode; tool.parentElement.setAttribute('aria-label', mode === 'away' ? `${state.name} is off exploring until your timer ends` : mode === 'back' ? `${state.name} found something. Open it` : `${state.name}’s collection`); }
    if (album.open && albumState() !== albumKey) renderAlbum();
    if (!started || previous === next) return;
    if (next === 'away') leave();
    else if (previous === 'away') comeHome();
  }

  function start() {
    if (started || !app.room?.buddyPlace) return;
    started = true; sync();
    if (mode === 'away') return;
    app.room.buddyPlace();
    if (welcome) later(() => say('buddy', WELCOME_LINES), 1800);
    schedule(3000);
  }

  function schedule(ms) {
    clearTimeout(nextTimer);
    nextTimer = later(act, ms);
  }

  function act() {
    if (mode === 'away') return;
    if (document.hidden || app.room?.buddyState?.().mode !== 'here') { schedule(4000); return; }
    const context = app.room.buddyContext(SPOT_TYPES);
    const plan = planActivity({ ...context, holding: mode === 'back', last }, clockRandom);
    last = plan.kind;
    app.room.buddyDo(plan);
    schedule((plan.seconds + 1.5) * 1000);
  }

  function leave() {
    clearTimeout(nextTimer); clearTimeout(replyTimer);
    app.speech?.hide('buddy');
    say('buddy', LEAVE_LINES);
    later(() => { if (mode === 'away') app.room?.buddyLeave(); }, 900);
  }

  function comeHome() {
    const arrive = () => { if (mode !== 'away') app.room?.buddyArrive(); };
    later(() => {
      const celebration = $('#session-celebration');
      if (celebration?.open) celebration.addEventListener('close', () => later(arrive, 400), { once: true });
      else arrive();
    }, 300);
  }

  function onRoom(event) {
    if (event.type === 'landed') {
      if (mode === 'back') { say('buddy', RETURN_LINES); replyTimer = later(() => say('avatar', GREET_REPLIES), 1700); }
      schedule(4200);
    }
    if (event.type === 'arrived') {
      const plan = event.plan;
      if (plan.line) say('buddy', plan.line);
      if (plan.reply) { clearTimeout(replyTimer); replyTimer = later(() => say('avatar', plan.reply), plan.line ? 1800 : 300); }
    }
  }

  function openTool() {
    if (waitingFind(buddy()) && mode !== 'away') openFind();
    else openAlbum();
  }

  function openFind() {
    const result = app.store.openBuddyFind();
    app.acceptUpdate(result);
    if (!result.opened) return;
    showCard(result.opened);
  }

  function showCard(entry) {
    const find = findOf(entry.find), place = placeOf(entry.place), state = buddy(), owned = state.finds[entry.find];
    const isNew = owned?.count === 1 && owned.first === entry.at;
    card.innerHTML = `<form method="dialog" class="buddy-card-inner">
      <button class="buddy-close" value="close" aria-label="Close">${icon('close')}</button>
      <p class="buddy-card-eyebrow">From ${escapeText(place.label)}</p>
      <div class="buddy-card-art">${findArt(find.id)}${isNew ? '<span class="buddy-card-new">New!</span>' : ''}</div>
      <h2 id="buddy-card-title">${escapeText(find.label)}</h2>
      <p class="buddy-card-story">${escapeText(adventureStory(state.name, entry))}</p>
      <p class="buddy-card-meta"><span class="buddy-tier" data-tier="${find.tier}">${TIER_LABELS[find.tier]}</span><span>Found ${owned?.count || 1}×</span><span>${entry.minutes} min trip</span></p>
      <div class="buddy-card-actions"><button type="button" class="quiet-button" id="buddy-card-collection">Collection</button><button class="start-button" value="keep" autofocus>Keep it ${icon('heart')}</button></div>
    </form>`;
    card.querySelector('#buddy-card-collection').addEventListener('click', () => { card.close(); openAlbum(); });
    if (!card.open) card.showModal();
    app.feedback?.celebrate?.(card.querySelector('.buddy-card-art'));
  }

  let closeup = null, closeupHost = null;
  const albumState = () => JSON.stringify([buddy(), app.state.session.running]);

  function renderAlbum() {
    albumKey = albumState();
    const state = buddy(), current = buddyStage(state.minutes), next = nextBuddyStage(state.minutes), found = FINDS.filter(find => state.finds[find.id]).length;
    const progress = next ? Math.round(((state.minutes - current.minutes) / (next.minutes - current.minutes)) * 100) : 100;
    const focused = document.activeElement?.closest?.('#buddy-album') ? document.activeElement.dataset.focusKey : null;
    album.innerHTML = `<div class="buddy-album-inner">
      <header><div><h2 id="buddy-album-title">${escapeText(state.name)}’s finds</h2><p>${found} of ${FINDS.length} found</p>${app.state.session.running ? `<p class="buddy-album-status">${escapeText(state.name)} is off exploring until your timer ends ✦</p>` : ''}</div><button class="buddy-close" type="button" data-focus-key="close" aria-label="Close collection">${icon('close')}</button></header>
      <section class="buddy-profile" style="--buddy-body:${colorOf(state.color).body};--buddy-shade:${colorOf(state.color).shade};--buddy-cheek:${colorOf(state.color).cheek}">
        <div class="buddy-profile-art" id="buddy-closeup"></div>
        <div class="buddy-profile-details">
          <div class="buddy-name"><h3>${escapeText(state.name)}</h3><button type="button" id="buddy-edit-name" data-focus-key="edit" aria-label="Rename ${escapeText(state.name)}">${icon('build')}</button></div>
          <form class="buddy-name-form" hidden><label class="sr-only" for="buddy-name">Name</label><input id="buddy-name" data-focus-key="name" maxlength="20" autocomplete="off" value="${escapeText(state.name)}"><button class="quiet-button" data-focus-key="save">Save</button></form>
          <div class="buddy-colors" role="radiogroup" aria-label="${escapeText(state.name)}’s colour">${BUDDY_COLORS.map(color => `<button type="button" role="radio" aria-checked="${color.id === state.color}" aria-label="${color.label}" data-color="${color.id}" data-focus-key="color-${color.id}" style="--swatch:${color.body}"></button>`).join('')}</div>
          <p class="buddy-growth"><strong>${current.label}</strong>${next ? `<span>${next.label} in ${hours(next.minutes - state.minutes)}</span>` : ''}</p>
          <div class="buddy-growth-bar" role="progressbar" aria-label="Growth to the next stage" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><i style="width:${progress}%"></i></div>
        </div>
      </section>
      ${PLACES.map(place => `<section class="buddy-place"><h3>${escapeText(place.label.replace(/^the /, '').replace(/^./, letter => letter.toUpperCase()))}<small>${place.minutes}+ min</small></h3><ul>${FINDS.filter(find => find.place === place.id).map(find => {
        const owned = state.finds[find.id];
        return owned ? `<li class="buddy-find" data-tier="${find.tier}" aria-label="${escapeText(find.label)}, ${TIER_LABELS[find.tier]}, found ${owned.count} times">${findArt(find.id, true)}<strong>${escapeText(find.label)}</strong><small>×${owned.count}</small></li>` : `<li class="buddy-find is-unfound" data-tier="${find.tier}" aria-label="Not found yet, ${TIER_LABELS[find.tier]}">${findArt(find.id, false)}</li>`;
      }).join('')}</ul></section>`).join('')}
    </div>`;
    const slot = album.querySelector('#buddy-closeup');
    if (closeupHost) slot.replaceWith(closeupHost); else { closeupHost = slot; closeup = createBuddyCloseup(closeupHost); }
    closeup.update({ colors: colorOf(state.color), stage: current.id, name: state.name });
    album.querySelector('.buddy-close').addEventListener('click', () => album.close());
    const form = album.querySelector('.buddy-name-form'), input = album.querySelector('#buddy-name');
    album.querySelector('#buddy-edit-name').addEventListener('click', () => { form.hidden = !form.hidden; if (!form.hidden) { input.focus(); input.select(); } });
    form.addEventListener('submit', event => { event.preventDefault(); app.acceptUpdate(app.store.renameBuddy(input.value)); });
    if (focused === 'name' || focused === 'save') form.hidden = false;
    album.querySelectorAll('[data-color]').forEach(swatch => swatch.addEventListener('click', () => app.acceptUpdate(app.store.setBuddyColor(swatch.dataset.color))));
    if (focused) album.querySelector(`[data-focus-key="${focused}"]`)?.focus();
  }

  function openAlbum() {
    renderAlbum();
    if (!album.open) album.showModal();
  }

  const signal = app.signal;
  document.querySelector('#buddy-tool')?.addEventListener('click', openTool, { signal });
  album.addEventListener('click', event => { if (event.target === album) album.close(); }, { signal });
  card.addEventListener('click', event => { if (event.target === card) card.close(); }, { signal });

  function dispose() {
    for (const id of timers) clearTimeout(id);
    timers.clear();
    closeup?.dispose(); card.remove(); album.remove();
  }

  return { sync, start, onRoom, openAlbum, dispose, closeup: () => closeup?.diagnostics() ?? null, get mode() { return mode; } };
}
