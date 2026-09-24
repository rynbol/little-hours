import { createHouseView } from './house-view.js';
import { HOUSE_SLOTS, nextExpansion, expansionVerdict } from './house.js';
import { PRESETS, roomDesign, createLayout } from './layout.js';

const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export function createHouseUI(root, { store, acceptUpdate, onEnter, onClose, onFocus, art, icon, notice }) {
  let view, shown = false, selectedId = store.state.house.activeId, chosenDesign = 'moonlit-greenhouse', signature = '', modelSignature = '';
  const $ = selector => root.querySelector(selector);
  root.innerHTML = `
    <div class="house-heading"><div><p class="eyebrow">A LITTLE HOME, GROWN WITH YOUR TIME</p><div class="house-title-row"><h1 id="house-title"></h1><button class="icon-button" id="rename-house" aria-label="Name your house">${icon('build')}</button></div><p class="room-subtitle">A room for today. A little dream for tomorrow.</p></div><button class="mode-button" id="back-to-room">${icon('arrow')} Back to room</button></div>
    <form id="house-name-form" class="house-name-form" hidden><label for="house-name-input">House name</label><input id="house-name-input" maxlength="40" required><button class="mode-button" type="submit">Save name</button><button class="quiet-button" type="button" id="cancel-house-name">Cancel</button></form>
    <div class="house-layout"><div class="house-world"><div class="house-world-caption"><span class="house-address">EST. IN LITTLE HOURS</span><span id="house-count"></span></div><div id="house-canvas" class="house-canvas"></div><div class="house-map-hint">Choose a room or a little place to grow.</div><nav id="house-rooms" class="house-rooms" aria-label="Rooms in your house"></nav></div><aside id="house-detail" class="house-detail" aria-label="Selected house room"></aside></div>
    <div class="house-reward-note">${icon('leaf')} <span><strong>Quiet time makes room for good things.</strong> Complete a focus session to earn 1 coin per minute. Your furniture collection is always yours.</span></div>`;
  $('#back-to-room').addEventListener('click', onClose);
  $('#rename-house').addEventListener('click', () => {
    $('#house-name-form').hidden = false; $('#house-name-input').value = store.state.house.name; $('#house-name-input').focus(); $('#house-name-input').select();
  });
  const closeName = () => { $('#house-name-form').hidden = true; $('#rename-house').focus(); };
  $('#cancel-house-name').addEventListener('click', closeName);
  $('#house-name-form').addEventListener('submit', event => { event.preventDefault(); acceptUpdate(store.renameHouse($('#house-name-input').value)); closeName(); });

  function select(id) {
    selectedId = id; signature = ''; render();
    $('#house-detail').scrollTop = 0;
    $('#house-detail h2')?.focus({ preventScroll: true });
  }
  function render() {
    if (!shown) return;
    view?.setFocused(store.state.session.running);
    const house = store.state.house, next = nextExpansion(house);
    const key = JSON.stringify([house, selectedId, chosenDesign, store.state.theme]);
    if (key === signature) return;
    signature = key;
    const activeControl = root.contains(document.activeElement) ? document.activeElement : null;
    const focusId = activeControl?.id;
    const focusDesign = activeControl?.dataset.houseDesign;
    const draftName = focusId === 'room-name-input' ? { value: activeControl.value, start: activeControl.selectionStart, end: activeControl.selectionEnd } : null;
    $('#house-title').textContent = house.name;
    $('#house-count').textContent = `${house.rooms.length} of 3 rooms · ${house.coins} coins`;
    $('#house-rooms').innerHTML = HOUSE_SLOTS.map((slot, i) => {
      const owned = house.rooms.find(room => room.id === slot.id);
      return `<button id="house-slot-${slot.id}" data-house-slot="${slot.id}" class="house-room-link" aria-pressed="${selectedId === slot.id}"><span class="house-room-number">${owned ? `0${i + 1}` : '+'}</span><span><strong>${escape(owned?.name || slot.label)}</strong><small>${owned ? (house.activeId === slot.id ? 'You’re here' : roomDesign(owned.layout).name) : next?.id === slot.id ? `${slot.price} coins to build` : 'Build the garden wing first'}</small></span></button>`;
    }).join('');
    root.querySelectorAll('[data-house-slot]').forEach(button => button.addEventListener('click', () => select(button.dataset.houseSlot)));
    const entry = house.rooms.find(room => room.id === selectedId), slot = HOUSE_SLOTS.find(slot => slot.id === selectedId) || HOUSE_SLOTS[0];
    if (entry) {
      const design = roomDesign(entry.layout);
      $('#house-detail').innerHTML = `<p class="eyebrow">${entry.id === 'loft' ? 'UPSTAIRS' : 'GROUND FLOOR'} · MADE YOURS</p><h2 tabindex="-1">${escape(entry.name)}</h2><div class="house-design-art" aria-hidden="true">${art(design)}</div><p class="house-description">${escape(design.name)}. ${escape(design.description)}</p><button class="start-button" id="enter-house-room">Enter room ${icon('arrow')}</button><button class="house-secondary" id="decorate-house-room">${icon('build')} Decorate this room</button><form id="room-name-form" class="room-name-form"><label for="room-name-input">Give this room a name</label><div><input id="room-name-input" maxlength="40" required value="${escape(entry.name)}"><button class="quiet-button" type="submit">Save</button></div></form><div class="house-next-note">${next ? `${icon('leaf')}<p><strong>Your next little chapter</strong>${next.label} · ${next.price} coins<button class="text-link" id="show-next-room">See the possibilities ${icon('arrow')}</button></p>` : `${icon('home')}<p><strong>Three rooms. Entirely yours.</strong>Wander between them, change their styles, and keep making yourself at home.</p>`}</div>`;
      $('#enter-house-room').addEventListener('click', () => onEnter(entry.id, false));
      $('#decorate-house-room').addEventListener('click', () => onEnter(entry.id, true));
      $('#room-name-form').addEventListener('submit', event => { event.preventDefault(); acceptUpdate(store.renameRoom(entry.id, $('#room-name-input').value)); notice('A lovely name. Saved to your house.'); });
      $('#show-next-room')?.addEventListener('click', () => select(next.id));
    } else {
      const available = next?.id === slot.id, missing = Math.max(0, slot.price - house.coins), enough = available && missing === 0;
      const chosen = PRESETS.find(p => p.id === chosenDesign);
      $('#house-detail').innerHTML = `<p class="eyebrow">${available ? 'YOUR NEXT LITTLE CHAPTER' : 'A DREAM FOR LATER'}</p><h2 tabindex="-1">${slot.label}</h2><p class="house-description">${slot.id === 'garden' ? 'A little more room to be you. Add a furnished wing beside your studio, then make it your own.' : 'A hideaway above the studio. One more cozy corner, with a whole new point of view.'}</p><div class="house-cost"><span>${icon('sun')} ${slot.price} coins</span><small>${house.coins} saved</small></div><div class="house-progress" role="progressbar" aria-label="Coins saved for ${slot.label}" aria-valuemin="0" aria-valuemax="${slot.price}" aria-valuenow="${Math.min(house.coins, slot.price)}"><span style="width:${Math.min(100, house.coins / slot.price * 100)}%"></span></div>${available ? `<p class="house-progress-copy">${enough ? 'You’ve made the time. Let’s make some room.' : `${missing} more coins · ${missing <= 25 ? 'one 25-minute session will get you there' : 'each completed minute earns a coin'}.`}</p><p class="house-choice-label">CHOOSE YOUR FIRST LOOK</p><div class="house-designs" role="group" aria-label="Extension design">${PRESETS.map(preset => `<button data-house-design="${preset.id}" aria-pressed="${chosenDesign === preset.id}"><span aria-hidden="true">${art(preset)}</span><strong>${escape(preset.name)}</strong></button>`).join('')}</div><p class="house-design-copy">${escape(chosen.description)}</p><button class="start-button" id="build-house-room" ${enough ? '' : 'disabled'}>Build for ${slot.price} coins ${icon('plus')}</button>${!enough ? '<button class="house-secondary" id="focus-for-house">Settle in & earn coins →</button>' : ''}<p class="house-fine-print">Comes furnished. All designs and furniture remain free to change afterward.</p>` : '<p class="house-progress-copy">Build your garden wing first. This upstairs space will be ready when you are.</p><button class="house-secondary" id="show-garden">Visit the garden building site →</button>'}`;
      root.querySelectorAll('[data-house-design]').forEach(button => button.addEventListener('click', () => { chosenDesign = button.dataset.houseDesign; render(); }));
      $('#build-house-room')?.addEventListener('click', () => {
        const verdict = expansionVerdict(store.state.house, slot.id, chosenDesign);
        if (!verdict.ok) { notice(verdict.reason); render(); return; }
        const result = store.buildRoom(slot.id, chosenDesign); acceptUpdate(result);
        if (result.built) { notice(`${slot.label} is ready. Welcome to your new room.`); $('#enter-house-room')?.focus(); }
        else notice(result.reason);
      });
      $('#focus-for-house')?.addEventListener('click', onFocus);
      $('#show-garden')?.addEventListener('click', () => select('garden'));
    }
    const previewing = !entry && next?.id === selectedId;
    const previewLayout = previewing ? createLayout(chosenDesign) : null;
    const modelHouse = previewing ? { ...house, rooms: [...house.rooms, { id: selectedId, name: slot.label, layout: previewLayout }] } : house;
    $('#house-canvas').setAttribute('aria-label', previewing ? `Preview of ${roomDesign(previewLayout).name} in your new ${slot.label}` : 'Your connected rooms');
    $('.house-map-hint').textContent = previewing ? `Previewing ${roomDesign(previewLayout).name} · build this room to keep it` : 'Your rooms, together. Choose one to step inside.';
    const nextModel = JSON.stringify([modelHouse.rooms, house.activeId, selectedId, store.state.theme]);
    if (modelSignature !== nextModel) {
      modelSignature = nextModel;
      try {
        if (view) view.update(modelHouse, selectedId, store.state.theme);
        else view = createHouseView($('#house-canvas'), { house: modelHouse, selectedId, theme: store.state.theme, focused: store.state.session.running, onSelect: select });
      } catch (error) {
        console.error('Could not show the cottage:', error);
        $('#house-canvas').textContent = 'Your rooms are safe. Use the room buttons below to enter or expand your house.';
      }
    }
    if (draftName && $('#room-name-input')) {
      $('#room-name-input').value = draftName.value;
      $('#room-name-input').setSelectionRange(draftName.start, draftName.end);
    }
    if (focusId && !document.getElementById(focusId)?.disabled) document.getElementById(focusId)?.focus({ preventScroll: true });
    else if (focusDesign) root.querySelector(`[data-house-design="${focusDesign}"]`)?.focus({ preventScroll: true });
  }
  return {
    show(id = store.state.house.activeId) { shown = true; root.hidden = false; selectedId = id; signature = ''; render(); $('#house-detail').scrollTop = 0; },
    hide() { shown = false; root.hidden = true; view?.dispose(); view = null; signature = ''; modelSignature = ''; $('#house-name-form').hidden = true; },
    render,
    diagnostics: () => view?.diagnostics(),
    dispose() { view?.dispose(); },
  };
}
