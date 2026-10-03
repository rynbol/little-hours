import { isFocusing } from '../../core/session.js';
import './house.css';
import './island-ui.css';
import { coinArt } from '../../ui/ui-art.js';
import { travelTo } from '../../ui/place-transition.js';
import { createGardenUI } from './garden-ui.js';
import { createHouseView } from './house-view.js';
import { HOUSE_SLOTS, nextExpansion, roomDisplayName } from '../../core/house.js';
import { PRESETS, roomDesign, createLayout } from '../../core/layout.js';
import { clockRandom } from '../../core/test-pins.js';
import { studyTrees } from '../../core/garden.js';

const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const roomTints = {
  'ember-library': '#dcc4a1',
  'moonlit-greenhouse': '#c6d2b6',
  'writers-loft': '#d0c2d7',
  'sakura-studio': '#eac6c4',
  'cloud-loft': '#c9dce0',
  'midnight-metro': '#c5c3dd',
};

export function createHouseUI(root, { store, acceptUpdate, onEnter, onClose, onFocus, onPond, onForest, art, icon, notice }) {
  let view, firstBuild = 0, shown = false, strollPlace = 'island', selectedId = store.state.house.activeId, signature = '', modelSignature = '';
  let detailOpen = false, detailReturn = '#house-rooms-toggle', renaming = false;
  let preview = true, celebration = null, celebrationTimer, exporting = false, postcardUrl = null;
  const plans = new Map();
  const $ = selector => root.querySelector(selector);
  const planFor = id => {
    if (!plans.has(id)) plans.set(id, { design: id === 'loft' ? 'cloud-loft' : 'sakura-studio', name: '' });
    return plans.get(id);
  };
  root.innerHTML = `
    <div class="house-heading"><div class="house-title-row"><h1 id="house-title"></h1><button class="icon-button" id="rename-house" aria-label="Name your house">${icon('build')}</button></div><button class="mode-button" id="back-to-room">${icon('arrow')} Back to room</button></div>
    <form id="house-name-form" class="house-name-form" hidden><label for="house-name-input">House name</label><input id="house-name-input" maxlength="40" required><button class="mode-button" type="submit">Save</button><button class="quiet-button" type="button" id="cancel-house-name">Cancel</button></form>
    <div class="house-layout"><div class="house-left"><div class="house-world">
      <div class="house-scene"><div id="house-canvas" class="house-canvas"></div><div id="house-celebration" class="house-celebration" role="status" hidden></div><div class="house-view-tools"><button id="house-turn-left" aria-label="Turn house left">↶</button><button id="house-reset-view" aria-label="Reset house view">${icon('home')}</button><button id="house-turn-right" aria-label="Turn house right">↷</button></div></div>
      <div class="house-preview-bar"><button id="house-preview-toggle" aria-pressed="true" hidden>Show before</button></div>
      <nav class="island-dock" aria-label="Island destinations"><button id="house-rooms-toggle" popovertarget="house-room-menu">${icon('home')} Rooms</button><button id="house-open-garden">${icon('leaf')} Garden</button><button id="house-open-pond"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 12c-4-7-11-7-14 0 3 7 10 7 14 0Zm0 0 6-5v10Z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="6" cy="11" r="1" fill="currentColor"/></svg> Pond</button><button id="house-open-forest"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 6.5 10.5h3L5 17h14l-4.5-6.5h3ZM12 17v4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg> Forest</button></nav>
      <div id="house-room-menu" popover role="dialog" aria-label="Rooms in your house"><header><h2>Rooms</h2><span id="house-count"></span></header><nav id="house-rooms" class="house-rooms" aria-label="Rooms in your house"></nav></div></div>
      <div class="house-underworld"><button class="mode-button" id="house-postcard">${icon('mini')} Postcard</button></div>
      </div>
      <aside id="house-detail" class="house-detail" aria-label="Selected house room" hidden></aside></div>
    <dialog id="house-postcard-dialog" class="house-postcard-dialog" aria-labelledby="postcard-title"><div class="house-postcard-heading"><div><h2 id="postcard-title">Your postcard</h2></div><button class="icon-button" id="close-postcard" aria-label="Close postcard">${icon('close')}</button></div><img id="house-postcard-image" alt="A postcard of your miniature house"><div class="house-postcard-actions"><a id="download-postcard" download="little-hours-postcard.png">Save image ${icon('arrow')}</a></div></dialog>`;
  const gardenUI = createGardenUI($('#house-detail'), { store, acceptUpdate, onFocus, onBack: () => select(store.state.house.activeId, false), notice, onPlot: index => view?.selectGardenPlot(index), celebrate: () => view?.celebrate('orchard') });
  $('#house-open-garden').addEventListener('click', () => select('orchard'));
  $('#house-open-pond').addEventListener('click', () => { $('#house-room-menu').hidePopover(); onPond?.(); });
  $('#house-open-forest').addEventListener('click', () => { $('#house-room-menu').hidePopover(); onForest?.(); });
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
      const url = await view.createPostcard(store.state.house.name, selectedId === 'orchard' ? 'My Little Hours garden.' : isPreview ? 'A little daydream for my next room.' : `${store.state.house.rooms.length} cozy ${store.state.house.rooms.length === 1 ? 'room' : 'rooms'}. Grown with a little time.`);
      if (!shown) { URL.revokeObjectURL(url); return; }
      if (postcardUrl) URL.revokeObjectURL(postcardUrl);
      $('#download-postcard').download = selectedId === 'orchard' ? 'little-hours-garden.png' : 'little-hours-postcard.png';
      postcardUrl = url; $('#house-postcard-image').src = url; $('#download-postcard').href = url;
      postcardDialog.showModal();
    } catch (error) { console.error('Postcard export failed:', error); notice('The postcard couldn’t be saved. Please try again.'); }
    finally { exporting = false; $('#house-postcard').disabled = false; }
  });

  root.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || postcardDialog.open || event.isComposing) return;
    if ($('#house-room-menu').matches(':popover-open')) { event.stopPropagation(); event.preventDefault(); $('#house-room-menu').hidePopover(); $('#house-rooms-toggle').focus({ preventScroll: true }); }
    else if (selectedId === 'orchard') { event.stopPropagation(); event.preventDefault(); if (!gardenUI.dismiss()) select(store.state.house.activeId, false); }
    else if (detailOpen) { event.stopPropagation(); event.preventDefault(); closeDetail(); }
  });

  function closeDetail() {
    detailOpen = false; renaming = false; selectedId = store.state.house.activeId; preview = false; signature = ''; render();
    ($(detailReturn) || $('#house-rooms-toggle')).focus({ preventScroll: true });
  }
  function select(id, open = true) {
    const trigger = document.activeElement;
    if (trigger?.closest('#house-room-menu')) detailReturn = '#house-rooms-toggle';
    else detailReturn = trigger?.dataset.room ? `[data-room="${trigger.dataset.room}"]` : '#house-rooms-toggle';
    $('#house-room-menu').hidePopover();
    const garden = id === 'orchard' || /^plot-[0-5]$/.test(id);
    if (garden !== (selectedId === 'orchard')) return travelTo(garden ? 'garden' : 'island', () => applySelection(id, open), () => Boolean(view?.diagnostics().scene.isReady()));
    applySelection(id, open);
  }
  function applySelection(id, open = true) {
    const leavingGarden = selectedId === 'orchard';
    const plot = /^plot-[0-5]$/.test(id) ? Number(id.slice(5)) : null;
    if (id !== 'orchard' && plot === null) gardenUI.close();
    selectedId = plot === null ? id : 'orchard'; detailOpen = open; renaming = false; preview = true; celebration = null; clearTimeout(celebrationTimer);
    $('#house-celebration').hidden = true; root.classList.remove('house-just-built');
    signature = ''; render();
    if (plot !== null) gardenUI.selectSlot(plot);
    (plot !== null ? $('#garden-card-title') : leavingGarden && selectedId !== 'orchard' ? $('#house-open-garden') : $('#house-detail h2'))?.focus({ preventScroll: true });
  }
  function celebrate(entry) {
    const badge = $('#house-celebration');
    badge.innerHTML = `<span aria-hidden="true">✧</span><strong>Welcome home, ${escape(roomDisplayName(entry))}.</strong>`;
    badge.hidden = false; root.classList.add('house-just-built');
    clearTimeout(celebrationTimer);
    celebrationTimer = setTimeout(() => { badge.hidden = true; root.classList.remove('house-just-built'); }, 6500);
    view?.celebrate(entry.id);
  }
  function render() {
    if (!shown) return;
    view?.setFocused(isFocusing(store.state.session));
    const house = store.state.house, next = nextExpansion(house), plan = planFor(selectedId);
    const key = JSON.stringify([house, selectedId, detailOpen, plan.design, preview, celebration, store.state.theme, store.state.avatar, store.state.garden, store.state.session, store.state.pet, store.state.history]);
    if (key === signature) return;
    signature = key;
    const designsOpen = Boolean($('#house-design-options')?.open);
    const activeControl = root.contains(document.activeElement) ? document.activeElement : null;
    const focusId = activeControl?.id, focusDesign = activeControl?.dataset.houseDesign;
    const draftName = ['room-name-input', 'new-room-name'].includes(focusId) ? { value: activeControl.value, start: activeControl.selectionStart, end: activeControl.selectionEnd } : null;
    $('#house-title').textContent = house.name;
    $('#house-count').innerHTML = `<span class="house-growth-dots" aria-hidden="true">${HOUSE_SLOTS.map((_, i) => `<i class="${i < house.rooms.length ? 'is-grown' : ''}"></i>`).join('')}</span>${house.rooms.length} / 3 rooms`;
    $('#house-rooms').innerHTML = HOUSE_SLOTS.map(slot => {
      const owned = house.rooms.find(room => room.id === slot.id);
      return `<button id="house-slot-${slot.id}" data-house-slot="${slot.id}" class="house-room-link ${owned ? 'is-owned' : 'is-site'}" aria-pressed="${detailOpen && selectedId === slot.id}"><span class="house-room-number">${icon(owned ? 'home' : 'plus')}</span><span><strong>${escape(owned ? roomDisplayName(owned) : slot.label)}</strong><small>${owned ? (house.activeId === slot.id ? 'You’re here' : slot.id === 'loft' ? 'Upstairs' : 'Ground floor') : next?.id === slot.id ? `${slot.price} coins` : 'Build the Greenhouse first'}</small></span>${icon('arrow')}</button>`;
    }).join('');
    root.querySelectorAll('[data-house-slot]').forEach(button => button.addEventListener('click', () => select(button.dataset.houseSlot)));
    const entry = house.rooms.find(room => room.id === selectedId), slot = HOUSE_SLOTS.find(slot => slot.id === selectedId) || HOUSE_SLOTS[0];
    root.classList.toggle('is-living-garden', selectedId === 'orchard');
    document.body.classList.toggle('is-garden', selectedId === 'orchard');
    for (const [id, label] of [['house-turn-left', 'Turn'], ['house-turn-right', 'Turn'], ['house-reset-view', 'Reset']]) $(`#${id}`).setAttribute('aria-label', `${label} ${selectedId === 'orchard' ? 'garden' : 'house'}${id.endsWith('left') ? ' left' : id.endsWith('right') ? ' right' : ' view'}`);
    $('#house-open-garden').setAttribute('aria-pressed', String(selectedId === 'orchard'));
    $('#house-detail').hidden = selectedId !== 'orchard' && !detailOpen;
    $('#house-detail').setAttribute('aria-label', selectedId === 'orchard' ? 'Your garden' : 'Selected house room');
    if (selectedId === 'orchard') gardenUI.render();
    else if (entry) {
      const design = roomDesign(entry.layout), newlyBuilt = celebration === entry.id;
      $('#house-detail').innerHTML = `<button class="house-detail-close" id="close-house-detail" aria-label="Close room details">${icon('close')}</button><div class="house-room-summary"><div class="house-owned-art" aria-hidden="true">${art(design)}</div><h2 tabindex="-1">${escape(roomDisplayName(entry))}</h2></div><div class="house-room-actions"><button class="start-button" id="enter-house-room">${newlyBuilt ? 'Enter your new room' : 'Enter room'} ${icon('arrow')}</button><button class="house-secondary" id="decorate-house-room">${icon('build')} Decorate</button></div><details id="room-name-details"${renaming ? ' open' : ''}><summary>Rename room</summary><form id="room-name-form" class="room-name-form"><label for="room-name-input">Room name</label><div><input id="room-name-input" maxlength="40" required value="${escape(roomDisplayName(entry))}"><button class="quiet-button" type="submit">Save</button></div></form></details>`;
      $('#enter-house-room').addEventListener('click', () => onEnter(entry.id, false));
      $('#decorate-house-room').addEventListener('click', () => onEnter(entry.id, true));
      $('#room-name-details').addEventListener('toggle', event => { if (event.target.isConnected) renaming = event.target.open; });
      $('#room-name-form').addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); renaming = false; $('#room-name-details').open = false; $('#room-name-details > summary').focus({ preventScroll: true }); } });
      $('#room-name-form').addEventListener('submit', event => { event.preventDefault(); acceptUpdate(store.renameRoom(entry.id, $('#room-name-input').value)); notice('Name saved'); });
    } else {
      const available = next?.id === slot.id, missing = Math.max(0, slot.price - house.coins), enough = available && missing === 0;
      const chosen = PRESETS.find(p => p.id === plan.design);
      $('#house-detail').innerHTML = `<button class="house-detail-close" id="close-house-detail" aria-label="Close room details">${icon('close')}</button><h2 tabindex="-1">${slot.label}</h2>${available ? `
      <details id="house-design-options"${designsOpen ? ' open' : ''}><summary><span class="house-selected-art">${art(chosen)}</span><strong>${escape(chosen.name)}</strong><span>Change</span></summary><div class="house-designs" role="group" aria-label="Extension design">${PRESETS.map(preset => `<button data-house-design="${preset.id}" aria-pressed="${plan.design === preset.id}" style="--room-tint:${roomTints[preset.id]}"><span class="house-design-check" aria-hidden="true">✓</span><span class="house-design-thumb" aria-hidden="true">${art(preset)}</span><strong>${escape(preset.name)}</strong></button>`).join('')}</div><button class="text-link" id="house-surprise">Surprise me</button></details>
      <form id="build-room-form"><label class="house-choice-label" for="new-room-name">Room name <small>optional</small></label><input class="house-new-name" id="new-room-name" maxlength="40" placeholder="${slot.label}" value="${escape(plan.name)}" autocomplete="off">
      <div class="house-build-budget"><div class="house-cost"><span>${coinArt()} ${slot.price}</span><small>${house.coins} coins saved</small></div><div class="house-progress" role="progressbar" aria-label="Coins saved for ${slot.label}" aria-valuemin="0" aria-valuemax="${slot.price}" aria-valuenow="${Math.min(house.coins, slot.price)}"><span style="width:${Math.min(100, house.coins / slot.price * 100)}%"></span></div>${missing ? `<p class="house-progress-copy">${missing} more coins</p>` : ''}</div><button class="start-button" id="build-house-room" type="submit" ${enough ? '' : 'disabled'}>Build room · ${slot.price} coins ${icon('plus')}</button></form>${!enough ? '<button class="house-secondary" id="focus-for-house">Study to earn coins</button>' : ''}` : `<div class="house-future-art" aria-hidden="true">${art(PRESETS.find(p => p.id === 'cloud-loft'))}</div><p class="house-progress-copy">Build the Greenhouse first.</p><button class="house-secondary" id="show-garden">View Greenhouse ${icon('arrow')}</button>`}`;
      root.querySelectorAll('[data-house-design]').forEach(button => button.addEventListener('click', () => { plan.design = button.dataset.houseDesign; preview = true; render(); }));
      $('#house-surprise')?.addEventListener('click', () => { const options = PRESETS.filter(p => p.id !== plan.design); plan.design = options[Math.floor(clockRandom() * options.length)].id; preview = true; render(); });
      $('#new-room-name')?.addEventListener('input', event => { plan.name = event.target.value; });
      $('#build-room-form')?.addEventListener('submit', async event => {
        event.preventDefault();
        // The store refreshes the latest save and settles expired focus sessions
        // before validating/spending. Keep name + room creation in one write.
        const result = await store.buildRoom(slot.id, plan.design, plan.name);
        if (result.built) celebration = slot.id;
        await acceptUpdate(result); signature = ''; render();
        if (result.built) { celebrate(result.state.house.rooms.find(room => room.id === slot.id)); $('#enter-house-room')?.focus({ preventScroll: true }); }
        else notice(result.reason);
      });
      $('#focus-for-house')?.addEventListener('click', onFocus);
      $('#show-garden')?.addEventListener('click', () => select('garden'));
    }
    $('#close-house-detail')?.addEventListener('click', closeDetail);
    const canPreview = detailOpen && !entry && next?.id === selectedId, previewing = canPreview && preview;
    const previewLayout = previewing ? createLayout(plan.design) : null;
    const modelHouse = { ...house, pet: store.state.pet, garden: studyTrees(store.state.history), plants: store.state.garden.plants, rooms: previewing ? [...house.rooms, { id: selectedId, name: slot.label, layout: previewLayout }] : house.rooms };
    $('#house-canvas').setAttribute('aria-label', previewing ? `Preview of ${roomDesign(previewLayout).name} in your new ${slot.label}` : selectedId === 'orchard' ? 'Your garden' : 'Your connected rooms');
    $('#house-preview-toggle').hidden = !canPreview;
    $('#house-preview-toggle').textContent = preview ? 'Before' : 'Preview';
    $('#house-preview-toggle').setAttribute('aria-pressed', String(preview));
    const nextModel = JSON.stringify([modelHouse.rooms, modelHouse.garden, modelHouse.plants, house.activeId, selectedId, store.state.theme, store.state.avatar, store.state.pet, strollPlace]);
    if (modelSignature !== nextModel) {
      modelSignature = nextModel;
      const options = { house: modelHouse, selectedId, strollPlace, theme: store.state.theme, avatar: store.state.avatar, focused: isFocusing(store.state.session), onSelect: id => id === 'garden-exit' ? select(store.state.house.activeId, false) : id === 'pond' ? onPond?.() : id === 'forest' ? onForest?.() : select(id) };
      const build = () => {
        try {
          if (view) view.update(options.house, options.selectedId, options.theme, options.avatar, options.strollPlace);
          else view = createHouseView($('#house-canvas'), options);
          if (selectedId === 'orchard') view.selectGardenPlot(gardenUI.selectedSlot);
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
    show(id, place = 'island') { strollPlace = place; detailOpen = Boolean(id); id ||= store.state.house.activeId; renaming = false; shown = true; root.hidden = false; selectedId = /^plot-[0-5]$/.test(id) ? 'orchard' : id; preview = true; signature = ''; view?.setSuspended(false); render(); if (selectedId !== id) gardenUI.selectSlot(Number(id.slice(5))); },
    // The house stays built while away, so coming back is instant.
    hide() { $('#house-room-menu').hidePopover(); gardenUI.close(); document.body.classList.remove('is-garden'); shown = false; postcardDialog.close(); root.hidden = true; view?.setSuspended(true); if (!view) modelSignature = ''; signature = ''; celebration = null; clearTimeout(celebrationTimer); $('#house-celebration').hidden = true; root.classList.remove('house-just-built'); $('#house-name-form').hidden = true; },
    releaseView() { this.hide(); cancelAnimationFrame(firstBuild); clearTimeout(firstBuild); firstBuild = 0; view?.dispose(); view = null; modelSignature = ''; signature = ''; },
    restoreAtTrailhead() { this.show(store.state.house.activeId, 'forest-return'); },
    render,
    selectGardenPlant(id) { if (shown && selectedId === 'orchard') { gardenUI.selectPlant(id); $('#garden-card-title')?.focus({ preventScroll: true }); } },
    diagnostics: () => view?.diagnostics(),
    get view() { return view; },
    dispose() { gardenUI.close(); document.body.classList.remove('is-garden'); cancelAnimationFrame(firstBuild); clearTimeout(firstBuild); clearTimeout(celebrationTimer); postcardDialog.close(); if (postcardUrl) URL.revokeObjectURL(postcardUrl); view?.dispose(); },
  };
}
