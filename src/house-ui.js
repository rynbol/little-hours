import './house.css';
import { createHouseView } from './house-view.js';
import { HOUSE_SLOTS, nextExpansion } from './house.js';
import { PRESETS, roomDesign, createLayout } from './layout.js';

const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const moods = {
  'ember-library': ['One more chapter', '#dcc4a1'],
  'moonlit-greenhouse': ['For growing things', '#c6d2b6'],
  'writers-loft': ['Room for two ideas', '#d0c2d7'],
  'sakura-studio': ['A softer kind of day', '#eac6c4'],
  'cloud-loft': ['Head in the clouds', '#c9dce0'],
  'midnight-metro': ['After-hours magic', '#c5c3dd'],
};

export function createHouseUI(root, { store, acceptUpdate, onEnter, onClose, onFocus, art, icon, notice }) {
  let view, firstBuild = 0, shown = false, selectedId = store.state.house.activeId, signature = '', modelSignature = '';
  let preview = true, celebration = null, celebrationTimer, exporting = false, postcardUrl = null;
  const plans = new Map();
  const $ = selector => root.querySelector(selector);
  const planFor = id => {
    if (!plans.has(id)) plans.set(id, { design: id === 'loft' ? 'cloud-loft' : 'sakura-studio', name: '' });
    return plans.get(id);
  };
  root.innerHTML = `
    <div class="house-heading"><div><p class="eyebrow">LITTLE BY LITTLE, A PLACE TO CALL YOURS</p><div class="house-title-row"><h1 id="house-title"></h1><button class="icon-button" id="rename-house" aria-label="Name your house">${icon('build')}</button></div><p class="room-subtitle">Make room for slow mornings. And all your little daydreams.</p></div><button class="mode-button" id="back-to-room">${icon('arrow')} Back to room</button></div>
    <form id="house-name-form" class="house-name-form" hidden><label for="house-name-input">House name</label><input id="house-name-input" maxlength="40" required><button class="mode-button" type="submit">Save name</button><button class="quiet-button" type="button" id="cancel-house-name">Cancel</button></form>
    <div class="house-layout"><div class="house-left"><div class="house-world"><div class="house-world-caption"><span class="house-address">${icon('home')} YOUR LITTLE PATCH OF THE WORLD</span><span id="house-count"></span></div>
      <div class="house-scene"><div class="house-sky-mark" aria-hidden="true">✧</div><div id="house-canvas" class="house-canvas"></div><div id="house-celebration" class="house-celebration" role="status" hidden></div><div class="house-view-tools"><button id="house-turn-left" aria-label="Turn house left">↶</button><button id="house-reset-view" aria-label="Reset house view">${icon('home')}</button><button id="house-turn-right" aria-label="Turn house right">↷</button></div><span class="house-scene-caption">a little life, well spent.</span></div>
      <div class="house-preview-bar"><span class="house-map-hint" aria-live="polite"></span><button id="house-preview-toggle" aria-pressed="true" hidden>Show before</button></div>
      <nav id="house-rooms" class="house-rooms" aria-label="Rooms in your house"></nav></div>
      <div class="house-underworld"><p>${icon('leaf')} <span>Good things take a little time.<small>1 finished focus minute = 1 coin for your home.</small></span></p><button class="mode-button" id="house-postcard">${icon('mini')} Make a postcard</button></div>
      </div>
      <aside id="house-detail" class="house-detail" aria-label="Selected house room"></aside></div>
    <dialog id="house-postcard-dialog" class="house-postcard-dialog" aria-labelledby="postcard-title"><div class="house-postcard-heading"><div><p class="eyebrow">FROM MY LITTLE CORNER OF THE WORLD</p><h2 id="postcard-title">Wish you were here.</h2></div><button class="icon-button" id="close-postcard" aria-label="Close postcard">${icon('close')}</button></div><img id="house-postcard-image" alt="A postcard of your miniature house"><div class="house-postcard-actions"><p>A little piece of home to send to someone.<small>A PNG to share wherever you like.</small></p><a id="download-postcard" download="little-hours-postcard.png">Save image ${icon('arrow')}</a></div></dialog>`;
  $('#back-to-room').addEventListener('click', onClose);
  $('#rename-house').addEventListener('click', () => {
    $('#house-name-form').hidden = false; $('#house-name-input').value = store.state.house.name; $('#house-name-input').focus(); $('#house-name-input').select();
  });
  const closeName = () => { $('#house-name-form').hidden = true; $('#rename-house').focus(); };
  $('#cancel-house-name').addEventListener('click', closeName);
  $('#house-name-form').addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); closeName(); } });
  $('#house-name-form').addEventListener('submit', event => { event.preventDefault(); acceptUpdate(store.renameHouse($('#house-name-input').value)); closeName(); });
  $('#house-turn-left').addEventListener('click', () => view?.turn(-1));
  $('#house-turn-right').addEventListener('click', () => view?.turn(1));
  $('#house-reset-view').addEventListener('click', () => view?.turn(0));
  $('#house-preview-toggle').addEventListener('click', () => { preview = !preview; render(); });
  const postcardDialog = $('#house-postcard-dialog');
  $('#close-postcard').addEventListener('click', () => postcardDialog.close());
  postcardDialog.addEventListener('keydown', event => { if (event.key === 'Escape') event.stopPropagation(); });
  postcardDialog.addEventListener('click', event => { if (event.target === postcardDialog) { const rect = postcardDialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) postcardDialog.close(); } });
  postcardDialog.addEventListener('close', () => { if (shown) $('#house-postcard').focus({ preventScroll: true }); });
  $('#house-postcard').addEventListener('click', async () => {
    if (!view || exporting) return;
    exporting = true; $('#house-postcard').disabled = true;
    try {
      const isPreview = preview && !store.state.house.rooms.some(room => room.id === selectedId) && nextExpansion(store.state.house)?.id === selectedId;
      const url = await view.createPostcard(store.state.house.name, isPreview ? 'A little daydream for my next room.' : `${store.state.house.rooms.length} cozy ${store.state.house.rooms.length === 1 ? 'room' : 'rooms'}. Grown with a little time.`);
      if (!shown) { URL.revokeObjectURL(url); return; }
      if (postcardUrl) URL.revokeObjectURL(postcardUrl);
      postcardUrl = url; $('#house-postcard-image').src = url; $('#download-postcard').href = url;
      postcardDialog.showModal();
    } catch (error) { console.error('Postcard export failed:', error); notice('The postcard couldn’t be saved. Please try again.'); }
    finally { exporting = false; $('#house-postcard').disabled = false; }
  });

  function select(id) {
    selectedId = id; preview = true; celebration = null; clearTimeout(celebrationTimer);
    $('#house-celebration').hidden = true; root.classList.remove('house-just-built');
    signature = ''; render();
    $('#house-detail h2')?.focus({ preventScroll: true });
  }
  function celebrate(entry) {
    const badge = $('#house-celebration');
    badge.innerHTML = `<span aria-hidden="true">✧</span><strong>Welcome home, ${escape(entry.name)}.</strong><small>A little dream, made real.</small>`;
    badge.hidden = false; root.classList.add('house-just-built');
    clearTimeout(celebrationTimer);
    celebrationTimer = setTimeout(() => { badge.hidden = true; root.classList.remove('house-just-built'); }, 6500);
    view?.celebrate(entry.id);
  }
  function render() {
    if (!shown) return;
    view?.setFocused(store.state.session.running);
    const house = store.state.house, next = nextExpansion(house), plan = planFor(selectedId);
    const key = JSON.stringify([house, selectedId, plan.design, preview, celebration, store.state.theme, store.state.avatar]);
    if (key === signature) return;
    signature = key;
    const activeControl = root.contains(document.activeElement) ? document.activeElement : null;
    const focusId = activeControl?.id, focusDesign = activeControl?.dataset.houseDesign;
    const draftName = ['room-name-input', 'new-room-name'].includes(focusId) ? { value: activeControl.value, start: activeControl.selectionStart, end: activeControl.selectionEnd } : null;
    $('#house-title').textContent = house.name;
    $('#house-count').innerHTML = `<span class="house-growth-dots" aria-hidden="true">${HOUSE_SLOTS.map((_, i) => `<i class="${i < house.rooms.length ? 'is-grown' : ''}"></i>`).join('')}</span>${house.rooms.length} / 3 rooms`;
    $('#house-rooms').innerHTML = HOUSE_SLOTS.map((slot, i) => {
      const owned = house.rooms.find(room => room.id === slot.id), ready = next?.id === slot.id && house.coins >= slot.price;
      return `<button id="house-slot-${slot.id}" data-house-slot="${slot.id}" class="house-room-link ${owned ? 'is-owned' : 'is-site'}" aria-pressed="${selectedId === slot.id}"><span class="house-room-number">${owned ? icon('home') : icon('plus')}</span><span><small class="house-slot-label">${owned ? `ROOM 0${i + 1}` : next?.id === slot.id ? 'ROOM TO GROW' : 'NEXT CHAPTER'}</small><strong>${escape(owned?.name || slot.label)}</strong><small>${owned ? (house.activeId === slot.id ? '● You’re here' : 'Come on in') : ready ? 'Ready to make yours ✧' : next?.id === slot.id ? `${house.coins} / ${slot.price} coins` : 'After your garden wing'}</small></span></button>`;
    }).join('');
    root.querySelectorAll('[data-house-slot]').forEach(button => button.addEventListener('click', () => select(button.dataset.houseSlot)));
    const entry = house.rooms.find(room => room.id === selectedId), slot = HOUSE_SLOTS.find(slot => slot.id === selectedId) || HOUSE_SLOTS[0];
    if (entry) {
      const design = roomDesign(entry.layout), newlyBuilt = celebration === entry.id;
      $('#house-detail').innerHTML = `<div class="house-paper-top"><p class="eyebrow">${newlyBuilt ? 'A LITTLE DREAM, MADE REAL' : 'THE PLACES WE MAKE OUR OWN'}</p><span aria-hidden="true">${newlyBuilt ? '✧' : '♡'}</span></div><h2 tabindex="-1">${escape(entry.name)}</h2><p class="house-description">${newlyBuilt ? 'You made time. You made space. Now make yourself at home.' : moods[design.id][0] + '. A little corner that feels like you.'}</p><div class="house-owned-art" style="--room-tint:${moods[design.id][1]}"><div aria-hidden="true">${art(design)}</div><span>${escape(design.name)}</span><small>${entry.layout.items.length} little comforts · ${entry.id === 'loft' ? 'Upstairs' : 'Ground floor'}</small></div><button class="start-button" id="enter-house-room">${newlyBuilt ? 'Step into your new room' : 'Come on in'} ${icon('arrow')}</button><button class="house-secondary" id="decorate-house-room">${icon('build')} Make it yours</button><form id="room-name-form" class="room-name-form"><label for="room-name-input">A name that feels like home</label><div><input id="room-name-input" maxlength="40" required value="${escape(entry.name)}"><button class="quiet-button" type="submit">Save</button></div></form><div class="house-next-note">${next ? `${icon('leaf')}<p><strong>There’s a little more to dream about.</strong>${next.label} · ${next.price} coins<button class="text-link" id="show-next-room">Dream up your next room ${icon('arrow')}</button></p>` : `${icon('home')}<p><strong>Every room has a little of you in it.</strong>Your cottage is complete. Keep rearranging, keep dreaming, keep making memories.</p>`}</div>`;
      $('#enter-house-room').addEventListener('click', () => onEnter(entry.id, false));
      $('#decorate-house-room').addEventListener('click', () => onEnter(entry.id, true));
      $('#room-name-form').addEventListener('submit', event => { event.preventDefault(); acceptUpdate(store.renameRoom(entry.id, $('#room-name-input').value)); notice('A lovely name. Saved to your house.'); });
      $('#show-next-room')?.addEventListener('click', () => select(next.id));
    } else {
      const available = next?.id === slot.id, missing = Math.max(0, slot.price - house.coins), enough = available && missing === 0;
      const chosen = PRESETS.find(p => p.id === plan.design);
      $('#house-detail').innerHTML = `<div class="house-paper-top"><p class="eyebrow">${available ? 'LET’S MAKE A LITTLE ROOM' : 'SOMETHING TO LOOK FORWARD TO'}</p><span aria-hidden="true">✧</span></div><h2 tabindex="-1">${slot.label}</h2><p class="house-description">${slot.id === 'garden' ? 'For slow mornings, big ideas, or just the two of you. What will this little corner become?' : 'Above the everyday, a cozy hideaway. A whole new place to get a little lost.'}</p>${available ? `
      <div class="house-choice-heading"><p class="house-choice-label"><b>01</b> Pick a feeling</p><button class="text-link" id="house-surprise">Surprise me ✧</button></div><div class="house-designs" role="group" aria-label="Extension design">${PRESETS.map(preset => `<button data-house-design="${preset.id}" aria-pressed="${plan.design === preset.id}" style="--room-tint:${moods[preset.id][1]}"><span class="house-design-check" aria-hidden="true">✓</span><span class="house-design-thumb" aria-hidden="true">${art(preset)}</span><strong>${escape(preset.name)}</strong></button>`).join('')}</div><p class="house-design-copy"><strong>${moods[chosen.id][0]}.</strong> ${escape(chosen.description)}<button class="house-see-preview text-link" type="button" id="see-house-preview">See it in your house ↑</button></p>
      <form id="build-room-form"><label class="house-choice-label" for="new-room-name"><b>02</b> Give it a little name <small>optional</small></label><input class="house-new-name" id="new-room-name" maxlength="40" placeholder="${slot.id === 'garden' ? 'e.g. Our Sunday corner' : 'e.g. Head in the clouds'}" value="${escape(plan.name)}" autocomplete="off">
      <div class="house-build-budget"><div class="house-cost"><span>${icon('sun')} ${slot.price} <small>coins to grow</small></span><small>${house.coins} in your pocket</small></div><div class="house-progress" role="progressbar" aria-label="Coins saved for ${slot.label}" aria-valuemin="0" aria-valuemax="${slot.price}" aria-valuenow="${Math.min(house.coins, slot.price)}"><span style="width:${Math.min(100, house.coins / slot.price * 100)}%"></span></div><p class="house-progress-copy">${enough ? 'All saved up. Your next chapter is ready.' : `${missing} more coins to go. ${missing <= 25 ? 'One 25-minute focus session will do it.' : 'A little focus brings it closer.'}`}</p></div><button class="start-button" id="build-house-room" type="submit" ${enough ? '' : 'disabled'}>Make room · ${slot.price} coins ${icon('plus')}</button></form>${!enough ? '<button class="house-secondary" id="focus-for-house">A little focus, a little closer →</button>' : ''}<p class="house-fine-print">Fully furnished, all yours. Redecorate whenever you like.</p>` : `<div class="house-future-art" aria-hidden="true">${art(PRESETS.find(p => p.id === 'cloud-loft'))}<span>one day, up here…</span></div><p class="house-progress-copy">Your upstairs chapter opens after the garden wing. One lovely thing at a time.</p><button class="house-secondary" id="show-garden">Dream up your garden wing ${icon('arrow')}</button>`}`;
      root.querySelectorAll('[data-house-design]').forEach(button => button.addEventListener('click', () => { plan.design = button.dataset.houseDesign; preview = true; render(); }));
      $('#house-surprise')?.addEventListener('click', () => { const options = PRESETS.filter(p => p.id !== plan.design); plan.design = options[Math.floor(Math.random() * options.length)].id; preview = true; render(); });
      $('#see-house-preview')?.addEventListener('click', () => $('#house-canvas').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' }));
      $('#new-room-name')?.addEventListener('input', event => { plan.name = event.target.value; });
      $('#build-room-form')?.addEventListener('submit', event => {
        event.preventDefault();
        // The store refreshes the latest save and settles expired focus sessions
        // before validating/spending. Keep name + room creation in one write.
        const result = store.buildRoom(slot.id, plan.design, plan.name);
        if (result.built) celebration = slot.id;
        acceptUpdate(result); signature = ''; render();
        if (result.built) { celebrate(result.state.house.rooms.find(room => room.id === slot.id)); $('#enter-house-room')?.focus({ preventScroll: true }); }
        else notice(result.reason);
      });
      $('#focus-for-house')?.addEventListener('click', onFocus);
      $('#show-garden')?.addEventListener('click', () => select('garden'));
    }
    const canPreview = !entry && next?.id === selectedId, previewing = canPreview && preview;
    const previewLayout = previewing ? createLayout(plan.design) : null;
    const modelHouse = previewing ? { ...house, rooms: [...house.rooms, { id: selectedId, name: slot.label, layout: previewLayout }] } : house;
    $('#house-canvas').setAttribute('aria-label', previewing ? `Preview of ${roomDesign(previewLayout).name} in your new ${slot.label}` : 'Your connected rooms');
    $('.house-map-hint').textContent = previewing ? `✧ Dreaming of ${roomDesign(previewLayout).name}` : canPreview ? 'Your home, before its next little chapter' : 'Tap a room to see what’s inside';
    $('#house-preview-toggle').hidden = !canPreview;
    $('#house-preview-toggle').textContent = preview ? 'Show before' : 'Show my dream';
    $('#house-preview-toggle').setAttribute('aria-pressed', String(preview));
    const nextModel = JSON.stringify([modelHouse.rooms, house.activeId, selectedId, store.state.theme, store.state.avatar]);
    if (modelSignature !== nextModel) {
      modelSignature = nextModel;
      const options = { house: modelHouse, selectedId, theme: store.state.theme, avatar: store.state.avatar, focused: store.state.session.running, onSelect: select };
      const build = () => {
        try {
          if (view) view.update(options.house, options.selectedId, options.theme, options.avatar);
          else view = createHouseView($('#house-canvas'), options);
        } catch (error) {
          console.error('Could not show the cottage:', error);
          $('#house-canvas').textContent = 'Your rooms are safe. Use the room buttons below to enter or expand your house.';
        }
      };
      // The first build takes a moment: show the page first, then build the house.
      cancelAnimationFrame(firstBuild); clearTimeout(firstBuild);
      if (view) build();
      else firstBuild = requestAnimationFrame(() => { firstBuild = setTimeout(() => { firstBuild = 0; if (shown && !view) build(); }); });
    }
    if (draftName && $(`#${focusId}`)) { $(`#${focusId}`).value = draftName.value; $(`#${focusId}`).setSelectionRange(draftName.start, draftName.end); }
    if (focusId && !$(`#${focusId}`)?.disabled) $(`#${focusId}`)?.focus({ preventScroll: true });
    else if (focusDesign) root.querySelector(`[data-house-design="${focusDesign}"]`)?.focus({ preventScroll: true });
  }
  return {
    show(id = store.state.house.activeId) { shown = true; root.hidden = false; selectedId = id; preview = true; signature = ''; view?.setSuspended(false); render(); },
    // The house stays built while away, so coming back is instant.
    hide() { shown = false; postcardDialog.close(); root.hidden = true; view?.setSuspended(true); if (!view) modelSignature = ''; signature = ''; celebration = null; clearTimeout(celebrationTimer); $('#house-celebration').hidden = true; root.classList.remove('house-just-built'); $('#house-name-form').hidden = true; },
    render,
    diagnostics: () => view?.diagnostics(),
    get view() { return view; },
    dispose() { cancelAnimationFrame(firstBuild); clearTimeout(firstBuild); clearTimeout(celebrationTimer); postcardDialog.close(); if (postcardUrl) URL.revokeObjectURL(postcardUrl); view?.dispose(); },
  };
}
