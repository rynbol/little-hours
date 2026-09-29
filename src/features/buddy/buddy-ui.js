import { $ } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { BUDDY_COLORS, FINDS, PLACES, adventureStory, buddyStage, colorOf, findOf, nextBuddyStage, placeOf, waitingFind } from '../../core/buddy.js';
import { clockNow, clockRandom } from '../../core/test-pins.js';
import { buddyArt, findArt, signArt } from './buddy-art.js';
import './buddy.css';

const SLEEP_AFTER = 90_000;
const WELCOME_AFTER = 30 * 60_000;
const TIER_LABELS = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare' };
const LINES = {
  poke: ['Hehe!', 'Boop!', 'Hi hi!', '♡', 'Again?'],
  tickle: ['Hehehe, that tickles!', 'Okay okay, I’m awake!'],
  welcome: ['You’re back!', 'I missed you ♡', 'Yay, it’s you!'],
  back: ['I found something!', 'Look what I brought you!'],
  away: ['Off exploring until the timer ends ✦'],
};
const pick = list => list[Math.min(list.length - 1, Math.floor(clockRandom() * list.length))];
const hours = minutes => minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60 ? `${minutes % 60} min` : ''}`.trim();
const escapeText = text => String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

export function createBuddyUI(app) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.createElement('div');
  root.className = 'buddy';
  root.innerHTML = `<button class="buddy-button" id="buddy-button" type="button"><span class="buddy-hop"><span class="buddy-held" aria-hidden="true"></span><span class="buddy-figure"></span></span><span class="buddy-away">${signArt()}</span></button><p class="buddy-bubble" id="buddy-bubble" role="status" aria-live="polite" hidden></p>`;
  $('#focus-card').prepend(root);
  const button = root.querySelector('.buddy-button'), figure = root.querySelector('.buddy-figure'), held = root.querySelector('.buddy-held'), bubble = root.querySelector('.buddy-bubble');

  const card = document.createElement('dialog');
  card.className = 'buddy-card'; card.id = 'buddy-card'; card.setAttribute('aria-labelledby', 'buddy-card-title');
  const album = document.createElement('dialog');
  album.className = 'buddy-album'; album.id = 'buddy-album'; album.setAttribute('aria-labelledby', 'buddy-album-title');
  document.body.append(card, album);

  let mode = null, stage = null, albumKey = '', sleeping = false, lastActivity = clockNow(), pokes = 0, pokeAt = 0, idleTimer = 0, bubbleTimer = 0, lookFrame = 0, pointer = null, greetPending = false;
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
  const buddy = () => app.state.buddy;

  function play(action, ms) {
    if (reducedMotion.matches && action !== 'blink') return;
    root.classList.remove(`do-${action}`);
    void root.offsetWidth;
    root.classList.add(`do-${action}`);
    later(() => root.classList.remove(`do-${action}`), ms);
  }

  function say(text, ms = 3600) {
    clearTimeout(bubbleTimer);
    bubble.textContent = text; bubble.hidden = false;
    bubbleTimer = later(() => { bubble.hidden = true; }, ms);
  }

  function modeNow() {
    if (app.state.session.running) return 'away';
    if (waitingFind(buddy())) return 'back';
    return sleeping ? 'sleep' : 'idle';
  }

  function sync() {
    const state = buddy(), colors = colorOf(state.color), nextStage = buddyStage(state.minutes).id;
    root.style.setProperty('--buddy-body', colors.body); root.style.setProperty('--buddy-shade', colors.shade); root.style.setProperty('--buddy-cheek', colors.cheek);
    if (nextStage !== stage) { stage = nextStage; figure.innerHTML = buddyArt(stage); }
    const next = modeNow(), waiting = waitingFind(state);
    held.innerHTML = waiting ? findArt(waiting.find) : '';
    if (next !== mode) {
      const previous = mode; mode = next; root.dataset.mode = mode;
      if (previous === 'away' && mode === 'back') play('return', 900);
      if (mode === 'away') bubble.hidden = true;
    }
    button.setAttribute('aria-label', mode === 'away' ? `${state.name} is off exploring until your timer ends` : mode === 'back' ? `${state.name} found something. Open it` : mode === 'sleep' ? `${state.name} is napping. Wake them up` : `${state.name}, your buddy. Give them a poke`);
    const tool = document.querySelector('#buddy-tool-label');
    if (tool) tool.textContent = state.name;
    if (album.open && JSON.stringify(state) !== albumKey) renderAlbum();
  }

  function wake(greet) {
    if (!sleeping) return;
    sleeping = false; sync();
    play('hop', 700);
    if (greet) say(pick(LINES.welcome));
  }

  function activity() {
    lastActivity = clockNow();
    if (!sleeping) return;
    wake(greetPending); greetPending = false;
  }

  function idleTick() {
    idleTimer = later(idleTick, 3500 + clockRandom() * 4500);
    if (document.hidden || !root.isConnected) return;
    if (mode === 'idle' && clockNow() - lastActivity > SLEEP_AFTER) { sleeping = true; sync(); return; }
    if (mode === 'sleep') { play('breathe', 2600); return; }
    if (mode !== 'idle' && mode !== 'back') return;
    const roll = clockRandom();
    if (roll < .5) play('blink', 260);
    else if (roll < .75 && !pointer) { root.style.setProperty('--look-x', (clockRandom() * 2 - 1).toFixed(2)); root.style.setProperty('--look-y', (clockRandom() * .8 - .4).toFixed(2)); later(() => { if (!pointer) { root.style.setProperty('--look-x', 0); root.style.setProperty('--look-y', 0); } }, 1400); }
    else play(mode === 'back' ? 'hop' : 'wiggle', 700);
  }

  function look() {
    lookFrame = 0;
    if (!pointer || (mode !== 'idle' && mode !== 'back')) return;
    const box = figure.getBoundingClientRect();
    if (!box.width) return;
    const x = Math.max(-1, Math.min(1, (pointer.x - (box.left + box.width / 2)) / 320)), y = Math.max(-1, Math.min(1, (pointer.y - (box.top + box.height / 2)) / 320));
    root.style.setProperty('--look-x', x.toFixed(2)); root.style.setProperty('--look-y', y.toFixed(2));
  }

  function onPointerMove(event) {
    activity();
    pointer = { x: event.clientX, y: event.clientY };
    if (!lookFrame) lookFrame = requestAnimationFrame(look);
  }

  function poke() {
    if (mode === 'away') { say(pick(LINES.away)); return; }
    if (mode === 'back') { openFind(); return; }
    if (mode === 'sleep') { wake(true); return; }
    const now = clockNow();
    pokes = now - pokeAt < 1600 ? pokes + 1 : 1; pokeAt = now;
    if (pokes >= 4) { play('wiggle', 700); play('happy', 1200); say(pick(LINES.tickle)); pokes = 0; }
    else if (pokes % 2) { play('hop', 700); play('happy', 900); say(pick(LINES.poke), 1800); }
    else { play('spin', 800); say(pick(LINES.poke), 1800); }
  }

  function openFind() {
    const result = app.store.openBuddyFind();
    app.acceptUpdate(result);
    if (!result.opened) return;
    play('hop', 700); play('happy', 1200);
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

  function renderAlbum() {
    albumKey = JSON.stringify(buddy());
    const state = buddy(), current = buddyStage(state.minutes), next = nextBuddyStage(state.minutes), found = FINDS.filter(find => state.finds[find.id]).length;
    const progress = next ? Math.round(((state.minutes - current.minutes) / (next.minutes - current.minutes)) * 100) : 100;
    const focused = document.activeElement?.closest?.('#buddy-album') ? document.activeElement.dataset.focusKey : null;
    album.innerHTML = `<div class="buddy-album-inner">
      <header><div><p class="buddy-album-eyebrow">YOUR BUDDY</p><h2 id="buddy-album-title">${escapeText(state.name)}’s finds</h2><p>${found} of ${FINDS.length} found · Longer sessions reach farther places.</p></div><button class="buddy-close" type="button" data-focus-key="close" aria-label="Close collection">${icon('close')}</button></header>
      <section class="buddy-profile" style="--buddy-body:${colorOf(state.color).body};--buddy-shade:${colorOf(state.color).shade};--buddy-cheek:${colorOf(state.color).cheek}">
        <div class="buddy-profile-art">${buddyArt(current.id)}</div>
        <div class="buddy-profile-details">
          <form class="buddy-name-form"><label for="buddy-name">Name</label><input id="buddy-name" data-focus-key="name" maxlength="20" autocomplete="off" value="${escapeText(state.name)}"><button class="quiet-button" data-focus-key="save">Save</button></form>
          <div class="buddy-colors" role="radiogroup" aria-label="${escapeText(state.name)}’s colour">${BUDDY_COLORS.map(color => `<button type="button" role="radio" aria-checked="${color.id === state.color}" aria-label="${color.label}" data-color="${color.id}" data-focus-key="color-${color.id}" style="--swatch:${color.body}"></button>`).join('')}</div>
          <p class="buddy-growth"><strong>${current.label}</strong> · ${hours(state.minutes)} focused together${next ? ` · ${next.label} at ${hours(next.minutes)}` : ''}</p>
          <div class="buddy-growth-bar" role="progressbar" aria-label="Growth to the next stage" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><i style="width:${progress}%"></i></div>
        </div>
      </section>
      ${PLACES.map(place => `<section class="buddy-place"><h3>${escapeText(place.label.replace(/^the /, ''))}<small>${place.minutes}+ min sessions</small></h3><ul>${FINDS.filter(find => find.place === place.id).map(find => {
        const owned = state.finds[find.id];
        return `<li class="buddy-find${owned ? '' : ' is-unfound'}" data-tier="${find.tier}">${findArt(find.id, Boolean(owned))}<strong>${owned ? escapeText(find.label) : '???'}</strong><small>${owned ? `${TIER_LABELS[find.tier]} · ×${owned.count}` : TIER_LABELS[find.tier]}</small></li>`;
      }).join('')}</ul></section>`).join('')}
    </div>`;
    album.querySelector('.buddy-close').addEventListener('click', () => album.close());
    album.querySelector('.buddy-name-form').addEventListener('submit', event => { event.preventDefault(); app.acceptUpdate(app.store.renameBuddy(album.querySelector('#buddy-name').value)); });
    album.querySelectorAll('[data-color]').forEach(swatch => swatch.addEventListener('click', () => app.acceptUpdate(app.store.setBuddyColor(swatch.dataset.color))));
    if (focused) album.querySelector(`[data-focus-key="${focused}"]`)?.focus();
  }

  function openAlbum() {
    renderAlbum();
    if (!album.open) album.showModal();
  }

  function onCompletion(completion) {
    if (!completion.buddy) return;
    sleeping = false;
    const celebration = $('#session-celebration');
    const announce = () => { if (mode === 'back') { play('hop', 700); say(pick(LINES.back)); } };
    if (celebration?.open) celebration.addEventListener('close', () => later(announce, 350), { once: true });
    else later(announce, 600);
  }

  const signal = app.signal;
  button.addEventListener('click', poke, { signal });
  window.addEventListener('pointermove', onPointerMove, { passive: true, signal });
  window.addEventListener('pointerdown', activity, { passive: true, signal });
  window.addEventListener('keydown', activity, { signal });
  document.documentElement.addEventListener('pointerleave', () => { pointer = null; root.style.setProperty('--look-x', 0); root.style.setProperty('--look-y', 0); }, { signal });
  document.querySelector('#buddy-tool')?.addEventListener('click', openAlbum, { signal });
  album.addEventListener('click', event => { if (event.target === album) album.close(); }, { signal });
  card.addEventListener('click', event => { if (event.target === card) card.close(); }, { signal });

  if (app.state.seenAt && clockNow() - app.state.seenAt > WELCOME_AFTER) { sleeping = true; greetPending = true; }
  sync();
  idleTimer = later(idleTick, 2500);

  function dispose() {
    for (const id of timers) clearTimeout(id);
    timers.clear(); clearTimeout(idleTimer); clearTimeout(bubbleTimer);
    if (lookFrame) cancelAnimationFrame(lookFrame);
    root.remove(); card.remove(); album.remove();
  }

  return { sync, onCompletion, openAlbum, dispose, get mode() { return mode; } };
}
