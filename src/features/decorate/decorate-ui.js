import { FURNITURE, getFurniture } from '../../core/catalog.js';
import { PRESETS, normalizeLayout, MAX_ITEMS, pieceCount, roomDesign } from '../../core/layout.js';
import { ARTWORKS, SLEEVES, artName } from '../../core/art.js';
import { tintsFor } from '../../core/tints.js';
import { surfaceChoices } from '../../core/surfaces.js';
import { designPaint } from '../../models/architecture.js';
import { $ } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { furnitureArt } from './furniture-art.js';
import { roomDesignArt } from './room-design-art.js';

export function createDecorateUI(app) {
  let editMode = false, collectionTab = 'collection', category = 'All', selectedItem = null, placement = null, undoLayout = null;
  let layoutSignature = '', draggedItemId = null, dragHint = '', reframeTimer = 0;

  function setEditMode(enabled) {
    if (app.nav.travelling) return;
    if (enabled && !app.room) return;
    if (enabled && app.nav.connected) app.nav.setConnectedView(false);
    editMode = enabled;
    if (enabled) app.roomUI.leaveMini();
    document.body.classList.toggle('is-decorating', enabled);
    $('#builder-panel').hidden = !enabled;
    reframeRoom();
    app.timer.syncDock();
    $('#decorate-button').setAttribute('aria-pressed', enabled);
    $('#decorate-button').setAttribute('aria-label', enabled ? 'Done decorating' : 'Decorate');
    $('#decorate-button span').textContent = enabled ? 'Done decorating' : 'Decorate';
    app.roomUI.renderLabel();
    app.panels.open(null);
    app.room?.setEditMode?.(enabled);
    if (!enabled) { placement = null; selectedItem = null; }
    renderInspector();
    if (enabled) { renderCollection(); revealRoomForPlacement(); }
  }

  // The room settles into its new frame when the layout around it changes.
  function reframeRoom() {
    const stage = $('#stage');
    stage.classList.remove('room-reframe'); void stage.offsetWidth; stage.classList.add('room-reframe');
    clearTimeout(reframeTimer); reframeTimer = setTimeout(() => stage.classList.remove('room-reframe'), 550);
  }

  function rememberControlFocus(container) {
    const active = document.activeElement;
    if (!container.contains(active)) return null;
    if (active.id) return { id: active.id };
    for (const key of ['category', 'furniture', 'preset', 'resetDesign', 'nudge', 'art', 'tint', 'walls', 'floor']) {
      if (active.dataset?.[key] !== undefined) return { key, value: active.dataset[key] };
    }
    return null;
  }

  function restoreControlFocus(container, remembered) {
    if (!remembered) return;
    const controls = [...container.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"]')];
    const matching = controls.find(control => remembered.id ? control.id === remembered.id : control.dataset[remembered.key] === remembered.value)
      || (remembered.key === 'preset' && controls.find(control => control.dataset.resetDesign === remembered.value));
    // If removal also removes its control, keep keyboard navigation in the editor.
    (matching || controls[0] || $('#decorate-button')).focus({ preventScroll: true });
  }

  function commitLayout(layout, remember = true) {
    const next = normalizeLayout(layout);
    if (JSON.stringify(next) === JSON.stringify(app.state.layout)) return;
    if (remember) undoLayout = structuredClone(app.state.layout);
    app.acceptUpdate(app.store.saveLayout(next, app.state.house.activeId));
    $('#undo-layout').disabled = !undoLayout;
    renderInspector();
  }

  $('#undo-layout').addEventListener('click', () => {
    if (!undoLayout) return;
    const previous = undoLayout;
    undoLayout = null;
    app.room?.cancelPlacement?.();
    app.room?.selectItem?.(null);
    const hadFocus = document.activeElement === $('#undo-layout');
    commitLayout(previous, false);
    $('#undo-layout').disabled = true;
    // A disabled button drops focus to the page; keep it in the collection tabs.
    if (hadFocus) document.querySelector('[data-collection-tab][aria-pressed="true"]')?.focus();
    app.toast('Your previous arrangement is back.');
  });

  document.querySelectorAll('[data-collection-tab]').forEach(button => button.addEventListener('click', () => {
    collectionTab = button.dataset.collectionTab;
    renderCollection();
  }));

  // Picture choices are painted by the same code as the pictures in the room.
  const artThumbs = new Map();
  function artThumb(art, wide) {
    const key = `${art}:${wide}`;
    if (!artThumbs.has(key)) {
      const canvas = document.createElement('canvas'); [canvas.width, canvas.height] = wide ? [120, 84] : [96, 120];
      ARTWORKS[art].draw(canvas.getContext('2d'), canvas.width, canvas.height);
      artThumbs.set(key, canvas.toDataURL());
    }
    return artThumbs.get(key);
  }

  function renderCollection() {
    $('#builder-panel').dataset.collection = collectionTab;
    document.querySelectorAll('[data-collection-tab]').forEach(button => button.setAttribute('aria-pressed', button.dataset.collectionTab === collectionTab));
    const content = $('#collection-content');
    const rememberedFocus = rememberControlFocus(content);
    $('.collection-footnote').textContent = collectionTab === 'presets'
      ? 'Choose a style for this room. Your other house rooms stay just as you left them.'
      : 'Pick a piece to add it. Drag furniture back here to put it away.';
    if (collectionTab === 'presets') {
      const designs = [...PRESETS.filter(preset => preset.style), ...PRESETS.filter(preset => !preset.style)];
      content.innerHTML = `<div class="preset-grid">${designs.map(preset => {
        const active = app.state.layout.presetId === preset.id, saved = Boolean(app.state.rooms[preset.id]);
        return `<article class="preset-card" data-design="${preset.style || 'retreat'}" data-active="${active}"><div class="preset-art" aria-hidden="true">${roomDesignArt(preset)}</div><div><span class="preset-label">${active ? 'CURRENT STYLE' : saved ? 'SAVED DESIGN' : preset.style ? 'A DIFFERENT LITTLE WORLD' : 'TIMBER RETREAT'}</span><h3>${preset.name}</h3><p>${preset.description}</p></div><button class="quiet-button" data-preset="${preset.id}" ${active ? 'disabled' : ''} aria-label="${saved ? 'Use saved' : 'Use'} ${preset.name} design">${active ? "Current design" : saved ? 'Use saved design' : 'Use this design'} ${icon('arrow')}</button>${active ? `<button class="preset-reset" data-reset-design="${preset.id}">Reset layout</button>` : ''}</article>`;
      }).join('')}</div><p class="preset-note">Six furnished designs for this space. Build additional rooms from your House to keep more spaces side by side.</p>`;
      const useDesign = (presetId, reset = false) => {
        app.room?.cancelPlacement?.(); app.room?.selectItem?.(null); selectedItem = null;
        undoLayout = structuredClone(app.state.layout);
        app.acceptUpdate(app.store.useRoom(presetId, reset)); $('#undo-layout').disabled = false;
        app.toast(reset ? 'The original layout is back. Undo restores your decorations.' : `${roomDesign(app.state.layout).name}. Make yourself at home.`);
        content.querySelector('.preset-card[data-active="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
        revealRoomForPlacement();
      };
      content.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => useDesign(button.dataset.preset)));
      content.querySelectorAll('[data-reset-design]').forEach(button => button.addEventListener('click', () => useDesign(button.dataset.resetDesign, true)));
      restoreControlFocus(content, rememberedFocus);
      return;
    }
    const collection = FURNITURE.filter(item => !item.unique);
    const categories = ['All', ...new Set(collection.map(item => item.category))];
    const items = collection.filter(item => category === 'All' || item.category === category);
    content.innerHTML = `<div class="category-list" aria-label="Furniture categories">${categories.map(name => `<button data-category="${name}" aria-pressed="${category === name}">${name}</button>`).join('')}</div><div class="furniture-grid">${items.map(item => `<button class="furniture-card" data-furniture="${item.id}" aria-pressed="${placement?.type === item.id}" aria-label="Place ${item.name}" title="${item.description}">${furnitureArt(item.id)}<span class="furniture-name">${item.name}</span><span class="furniture-detail">${item.category}<span class="furniture-add">${icon('plus')}</span></span></button>`).join('')}</div>`;
    content.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => { category = button.dataset.category; renderCollection(); }));
    content.querySelectorAll('[data-furniture]').forEach(button => button.addEventListener('click', () => {
      if (pieceCount(app.state.layout.items) >= MAX_ITEMS) { app.toast(`Your room has ${MAX_ITEMS} pieces. Remove one to make a little space.`); return; }
      app.room?.beginPlacement?.(button.dataset.furniture);
      revealRoomForPlacement();
    }));
    restoreControlFocus(content, rememberedFocus);
  }

  function revealRoomForPlacement() {
    const stage = $('#stage');
    const rect = stage.getBoundingClientRect();
    if (rect.top >= 12 && rect.bottom <= Math.min(window.innerHeight, $('#builder-panel').getBoundingClientRect().top)) return;
    stage.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }

  function updateCatalogSelection() {
    document.querySelectorAll('[data-furniture]').forEach(button => button.setAttribute('aria-pressed', button.dataset.furniture === placement?.type));
  }

  function renderDragState(drag) {
    const preview = $('#drag-return-preview');
    document.body.classList.toggle('is-dragging-furniture', Boolean(drag));
    document.body.classList.toggle('is-over-collection', Boolean(drag?.overCollection));
    document.body.classList.toggle('return-blocked', Boolean(drag && !drag.removable));
    preview.hidden = !drag?.overCollection || !drag.removable;
    if (!drag) {
      draggedItemId = null; dragHint = ''; renderInspector();
      return;
    }
    if (draggedItemId !== drag.id) {
      draggedItemId = drag.id;
      preview.innerHTML = furnitureArt(drag.type);
      const bed = getFurniture(drag.type)?.unique, petName = app.pet.name();
      $('#return-label').textContent = drag.removable ? 'Return to your collection' : bed ? `${petName}’s bed stays` : 'Every room needs a study spot';
      $('#return-detail').textContent = drag.removable ? 'Release here to put this piece away · Undo brings it back' : bed ? 'Drop it anywhere in the room instead' : 'Add another desk before putting this one away';
    }
    if (drag.overCollection) preview.style.transform = `translate3d(${drag.clientX - 44}px, ${drag.clientY - 76}px, 0)`;
    const hint = drag.overCollection ? (drag.removable ? 'Release to put it away · Undo brings it back' : drag.reason)
      : drag.valid ? (getFurniture(drag.type)?.mount === 'wall' ? 'Release to place · Esc to cancel' : 'Release to place · R to rotate · Esc to cancel') : `${drag.reason} · Esc to cancel`;
    if (hint !== dragHint) { dragHint = hint; $('#room-hint').textContent = hint; }
  }

  function renderInspector() {
    const inspector = $('#selection-inspector');
    if (!inspector) return;
    const selected = selectedItem && getFurniture(selectedItem.type);
    const pending = placement && getFurniture(placement.type);
    if (!editMode) {
      $('#room-hint').innerHTML = `Drag to look around<span>·</span>Tap a plant, bookcase or tea table`;
      return;
    }
    const rememberedFocus = rememberControlFocus(inspector);
    $('#room-hint').textContent = pending ? `Click ${pending.mount === 'wall' ? 'a wall' : 'the floor'} to place ${pending.name.toLowerCase()}` : selected ? 'Drag to move · Drop over the collection to put away' : 'Drag a piece to move it · Drag empty space to look around';
    if (!pending && !selected) {
      // With nothing selected, the room itself offers its walls and floors.
      const style = roomDesign(app.state.layout).style || 'retreat';
      const surfaces = ['walls', 'floor'].map(kind => `<div class="art-picker" role="group" aria-label="Choose the ${kind}"><span class="picker-label">${kind === 'walls' ? 'Walls' : 'Floor'}</span>${surfaceChoices(style, kind).map(entry => `<button data-${kind}="${entry.id}" aria-pressed="${(app.state.layout[kind] || '') === entry.id}" aria-label="${entry.name}" title="${entry.name}"><span class="tint-swatch" style="--tint: ${entry.swatch[0]}; --tint-2: ${entry.swatch[1]}"></span></button>`).join('')}</div>`).join('');
      inspector.innerHTML = `<div class="selection-copy">${icon('build')}<span><strong>A room that feels like you</strong><small>Drag furniture around your room, or back here to put it away. Pick a piece below to add something new.</small></span></div><div class="selection-actions room-surfaces">${surfaces}</div>`;
      for (const kind of ['walls', 'floor']) inspector.querySelectorAll(`[data-${kind}]`).forEach(button => button.addEventListener('click', () => { app.room?.setSurface?.(kind, button.dataset[kind] || null); renderInspector(); }));
      restoreControlFocus(inspector, rememberedFocus);
      return;
    }
    const item = pending || selected, wall = item.mount === 'wall';
    const currentDesk = selectedItem?.id === app.state.layout.activeDeskId;
    const hint = pending ? (placement.valid === false && placement.reason ? placement.reason : `Move over ${wall ? 'a wall' : 'the floor'} to find a spot. Click to place.`) : item.unique ? `Drag to move. ${app.pet.name()} will find it.` : 'Drag to move or put away. Arrow buttons work too.';
    // Wall pieces always face the room: they move up, down and along the wall
    // instead of turning. Frames and records offer their pictures.
    const nudges = [['0,-0.25', wall ? 'Move up' : 'Move toward back wall', '↑'], ['-0.25,0', 'Move left', '←'], ['0.25,0', 'Move right', '→'], ['0,0.25', wall ? 'Move down' : 'Move toward front', '↓']];
    const arts = !pending && item.arts ? `<div class="art-picker" role="group" aria-label="${item.id === 'record-sleeve' ? 'Choose the sleeve' : 'Choose the picture'}">${item.arts.map(art => `<button data-art="${art}" aria-pressed="${selectedItem.art === art}" aria-label="${artName(art)}" title="${artName(art)}">${SLEEVES[art] ? `<span class="sleeve-swatch" style="--sleeve: ${SLEEVES[art].color}"></span>` : `<img src="${artThumb(art, item.id === 'wide-frame')}" alt="">`}</button>`).join('')}</div>` : '';
    // Pieces with color choices list them after the room's own colors.
    const tints = !pending && tintsFor(item.id), roomTint = tints && Object.keys(tints[0].paint)[0];
    const colors = tints ? `<div class="art-picker" role="group" aria-label="Choose the color">${[{ id: '', name: 'Room colors', swatch: designPaint(roomDesign(app.state.layout).style).find(([hex]) => hex === roomTint)?.[1] || roomTint }, ...tints].map(tint => `<button data-tint="${tint.id}" aria-pressed="${(selectedItem.tint || '') === tint.id}" aria-label="${tint.name}" title="${tint.name}"><span class="tint-swatch" style="--tint: ${tint.swatch}"></span></button>`).join('')}</div>` : '';
    inspector.innerHTML = `<div class="selection-copy">${icon(pending ? 'plus' : 'build')}<span><strong>${pending ? 'Placing ' : ''}${item.name}${!pending && currentDesk ? '<span class="active-desk-tag">Study spot</span>' : ''}</strong><small>${hint}</small></span></div><div class="selection-actions">${arts}${colors}${wall ? '' : `<button class="small-button" id="rotate-item" aria-label="Rotate ${item.name}">${icon('rotate')}<span>Rotate</span></button>`}${!pending ? `<div class="nudge-buttons" aria-label="Move selected ${wall ? 'wall piece' : 'furniture'}">${nudges.map(([step, label, arrow]) => `<button data-nudge="${step}" aria-label="${label}">${arrow}</button>`).join('')}</div>${item.category === 'Study' ? `<button class="small-button study-here" id="study-here" aria-label="${currentDesk ? 'Studying here' : 'Study here'}" ${currentDesk ? 'disabled' : ''}>${icon('check')}<span>${currentDesk ? 'Studying here' : 'Study here'}</span></button>` : ''}${item.unique ? '' : `<button class="small-button remove-item" id="remove-item" aria-label="Remove ${item.name}">${icon('trash')}</button>`}` : ''}<button class="small-button" id="cancel-item" aria-label="${pending ? 'Cancel placement' : 'Deselect furniture'}">${icon('close')}</button></div>`;
    $('#rotate-item')?.addEventListener('click', () => app.room?.rotateSelection?.());
    inspector.querySelectorAll('[data-art]').forEach(button => button.addEventListener('click', () => app.room?.setArt?.(button.dataset.art)));
    inspector.querySelectorAll('[data-tint]').forEach(button => button.addEventListener('click', () => app.room?.setTint?.(button.dataset.tint || null)));
    $('#remove-item')?.addEventListener('click', () => app.room?.removeSelection?.());
    $('#study-here')?.addEventListener('click', () => app.room?.setActiveDesk?.(selectedItem.id));
    $('#cancel-item').addEventListener('click', () => { app.room?.cancelPlacement?.(); app.room?.selectItem?.(null); });
    inspector.querySelectorAll('[data-nudge]').forEach(button => button.addEventListener('click', () => app.room?.moveSelection?.(...button.dataset.nudge.split(',').map(Number))));
    restoreControlFocus(inspector, rememberedFocus);
  }

  function clearUndo() { undoLayout = null; $('#undo-layout').disabled = true; }

  function syncLayout(force) {
    const signature = JSON.stringify(app.state.layout);
    if (force || signature !== layoutSignature) {
      layoutSignature = signature;
      app.room?.setLayout?.(app.state.layout);
      if (selectedItem) selectedItem = app.state.layout.items.find(item => item.id === selectedItem.id) || null;
      renderInspector();
      if (editMode && collectionTab === 'presets') renderCollection();
    }
    $('#item-count').textContent = `${pieceCount(app.state.layout.items)} / ${MAX_ITEMS} pieces`;
  }

  function resetForArrival() {
    app.room?.cancelPlacement(); app.room?.selectItem(null); selectedItem = null; clearUndo();
  }

  function openCollection() { collectionTab = 'collection'; setEditMode(true); }

  function handleKey(event) {
    if (!editMode || event.target.closest('input, textarea, select, [contenteditable="true"]') || event.ctrlKey || event.metaKey || event.altKey) return;
    const steps = { ArrowLeft: [-.25, 0], ArrowRight: [.25, 0], ArrowUp: [0, -.25], ArrowDown: [0, .25] };
    if (event.key === 'Escape') { app.room?.cancelPlacement?.(); app.room?.selectItem?.(null); }
    // Enter drops a new piece at its preview spot; preventDefault stops the
    // focused collection card from starting another placement.
    else if (event.key === 'Enter' && placement) { event.preventDefault(); app.room?.confirmPlacement?.(); }
    else if (event.key.toLowerCase() === 'r' && (placement || selectedItem)) { event.preventDefault(); app.room?.rotateSelection?.(); }
    else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedItem) { event.preventDefault(); app.room?.removeSelection?.(); }
    else if (steps[event.key] && (placement || selectedItem)) { event.preventDefault(); app.room?.moveSelection?.(...steps[event.key]); }
  }

  const roomEvents = {
    // A switched lamp or fire saves with the room, but it is not an Undo step.
    onLayoutChange(layout, { remember = true } = {}) {
      layoutSignature = JSON.stringify(layout);
      commitLayout(layout, remember);
    },
    onSelectionChange(item) { selectedItem = item; renderInspector(); },
    onPlacementState(next) { placement = next; renderInspector(); updateCatalogSelection(); },
    isCollectionDrop(x, y) {
      if (!editMode) return false;
      const rect = $('#builder-panel').getBoundingClientRect();
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    },
    onDragState: renderDragState,
  };

  $('#decorate-button').addEventListener('click', () => setEditMode(!editMode));

  return {
    get active() { return editMode; },
    roomEvents, setEditMode, openCollection, renderInspector, syncLayout, resetForArrival, clearUndo, handleKey,
    dispose() { clearTimeout(reframeTimer); },
  };
}
