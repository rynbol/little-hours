import { isFocusing } from '../../core/session.js';
import { nextExpansion, houseConnections, roomDisplayName } from '../../core/house.js';
import { roomDesign } from '../../core/layout.js';
import { DOOR_OPEN_SECONDS } from '../companion/index.js';
import { $ } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { coinArt } from '../../ui/ui-art.js';
import { roomDesignArt } from '../decorate/index.js';
import { createHouseView } from './house-view.js';
import { studyTrees } from '../../core/garden.js';
import './room-navigation.css';
import { travelTo } from '../../ui/place-transition.js';

export function createHouseNavigation(app) {
  let houseOpen = false, connectedView = null, connectionsKey = '', travelTimer = 0, peekFrame = 0, arrivalTimer = 0, travelling = false, doorWalking = false, preparing = false;

  function cancelDoorTravel(message) {
    if (!travelling) return false;
    doorWalking = false; travelling = false;
    clearTimeout(travelTimer); travelTimer = 0; cancelAnimationFrame(peekFrame); peekFrame = 0;
    $('#room-travel').hidden = true; document.body.classList.remove('is-travelling', 'is-door-walking');
    app.room?.setDoorActive?.(null);
    app.room?.setDoorOpen?.(null);
    app.room?.cancelDoorWalk?.({ returnToDesk: true });
    syncTravelControls();
    app.timer.render();
    if (message) app.toast(message, true);
    return true;
  }

  function setHouseOpen(open, selectedId, plantId) {
    if (travelling) return;
    const currentGarden = document.body.classList.contains('is-garden');
    const garden = selectedId ? selectedId === 'orchard' || /^plot-[0-5]$/.test(selectedId) : open && houseOpen && currentGarden;
    if (open !== houseOpen || open && garden !== currentGarden) return travelTo(open ? garden ? 'garden' : 'island' : 'home', () => showHouse(open, selectedId, plantId), () => Boolean((open ? app.houseUI : app.room)?.diagnostics()?.scene.isReady()));
    showHouse(open, selectedId, plantId);
  }
  function showHouse(open, selectedId, plantId) {
    if (travelling) return;
    if (open === houseOpen) { if (open && selectedId) app.houseUI.show(selectedId); if (open && plantId) app.houseUI.selectGardenPlant(plantId); return; }
    if (open) {
      closePicker(false);
      setConnectedView(false);
      if (app.decorate.active) app.decorate.setEditMode(false);
      app.panels.open(null);
    }
    houseOpen = open;
    document.body.classList.toggle('is-house', open);
    $('#room-section').hidden = open;
    app.room?.setSuspended(open);
    if (open) { app.houseUI.show(selectedId); (document.body.classList.contains('is-garden') ? $('#garden-back') : $('#back-to-room'))?.focus({ preventScroll: true }); }
    else { app.houseUI.hide(); $('#rooms-button').focus({ preventScroll: true }); }
    if (open && plantId) app.houseUI.selectGardenPlant(plantId);
    app.timer.syncDock();
  }
  const picker = $('#room-picker'), switcher = $('#room-switcher-toggle');

  function closePicker(restoreFocus = true) {
    if (!picker.open) return;
    picker.close();
    switcher.setAttribute('aria-expanded', 'false');
    if (restoreFocus) switcher.focus({ preventScroll: true });
  }

  function syncTravelControls() {
    const index = app.state.house.rooms.findIndex(room => room.id === app.state.house.activeId);
    document.querySelectorAll('#home-connections button, #room-picker button').forEach(button => { button.disabled = travelling; });
    $('#previous-room').disabled = travelling || index <= 0;
    $('#next-room').disabled = travelling || index >= app.state.house.rooms.length - 1;
    $('#rename-room').disabled = travelling;
  }

  function renderConnections(updateModel = true) {
    connectedView?.setFocused(isFocusing(app.state.session));
    const key = JSON.stringify([app.state.house, app.state.history, app.state.garden, app.state.theme, app.state.avatar, Boolean(connectedView), isFocusing(app.state.session)]);
    if (connectionsKey === key) return;
    connectionsKey = key;
    const focusedId = picker.contains(document.activeElement) ? document.activeElement.dataset.houseGo : null;
    const cards = picker.querySelector('.room-cards'); cards.replaceChildren();
    const rooms = app.state.house.rooms, index = rooms.findIndex(room => room.id === app.state.house.activeId);
    $('#room-picker-title').textContent = app.state.house.name;
    $('#room-route-count').textContent = `${index + 1} / ${rooms.length}`;
    switcher.setAttribute('aria-label', `Choose a room, currently ${roomDisplayName(rooms[index])}`);
    $('.room-route-map').innerHTML = rooms.map((room, i) => `<i class="${i === index ? 'is-current' : ''}"></i>`).join('');
    $('#previous-room').setAttribute('aria-label', index > 0 ? `Go to ${roomDisplayName(rooms[index - 1])}` : 'Previous room');
    $('#next-room').setAttribute('aria-label', index < rooms.length - 1 ? `Go to ${roomDisplayName(rooms[index + 1])}` : 'Next room');
    for (const entry of rooms) {
      const button = document.createElement('button'), current = entry.id === app.state.house.activeId, name = roomDisplayName(entry), design = roomDesign(entry.layout);
      button.className = 'room-card'; button.dataset.houseGo = entry.id; button.dataset.roomStyle = design.style || 'retreat';
      button.setAttribute('aria-current', current ? 'location' : 'false'); button.setAttribute('aria-label', `${name}${current ? ', you’re here' : ''}`);
      button.innerHTML = `<span class="room-card-art">${roomDesignArt(design)}</span><span class="room-card-copy"><span class="room-card-name"></span><span class="room-card-location">${current ? 'You’re here' : entry.id === 'loft' ? 'Upstairs' : 'Ground floor'}</span></span><span class="room-card-mark" aria-hidden="true">${icon(current ? 'check' : 'arrow')}</span>`;
      button.querySelector('.room-card-name').textContent = name;
      button.addEventListener('click', () => selectDestination(entry.id, true)); cards.append(button);
    }
    const next = nextExpansion(app.state.house), grow = $('#room-grow'); grow.replaceChildren();
    if (next) {
      const button = document.createElement('button'); button.className = 'room-grow-button'; button.dataset.houseGo = next.id;
      button.setAttribute('aria-label', `Plan ${next.short}, ${next.price} coins`);
      button.innerHTML = `<span class="room-grow-icon">${icon('plus')}</span><span class="room-grow-name"></span><span class="room-grow-price">${coinArt()} ${next.price}</span>`;
      button.querySelector('.room-grow-name').textContent = next.short;
      button.addEventListener('click', () => { closePicker(false); setHouseOpen(true, next.id); }); grow.append(button);
    }
    const notice = $('#room-picker-notice'); notice.hidden = !isFocusing(app.state.session);
    notice.textContent = isFocusing(app.state.session) ? 'Pause your focus session to change rooms.' : '';
    const wide = $('.home-wide'); wide.querySelector('span').textContent = connectedView ? 'Back to room' : 'Whole house'; wide.setAttribute('aria-pressed', String(Boolean(connectedView))); wide.setAttribute('aria-label', wide.querySelector('span').textContent);
    if (connectedView && updateModel) connectedView.update(withGarden(), app.state.house.activeId, app.state.theme, app.state.avatar);
    syncTravelControls();
    if (focusedId && picker.open) picker.querySelector(`[data-house-go="${focusedId}"]`)?.focus({ preventScroll: true });
  }
  const withGarden = () => ({ ...app.state.house, pet: app.state.pet, garden: studyTrees(app.state.history), plants: app.state.garden.plants });
  function setConnectedView(open) {
    if (travelling || open === Boolean(connectedView)) return;
    if (open && app.panels.current) app.panels.close();
    if (open && app.decorate.active) app.decorate.setEditMode(false);
    if (open) {
      $('#house-in-room').hidden = false;
      connectedView = createHouseView($('#house-in-room'), { house: withGarden(), selectedId: app.state.house.activeId, theme: app.state.theme, avatar: app.state.avatar, focused: isFocusing(app.state.session), onSelect: id => id === 'pond' ? app.lake?.open() : id === 'orchard' || /^plot-[0-5]$/.test(id) ? setHouseOpen(true, id) : selectDestination(id) });
    } else { connectedView.dispose(); connectedView = null; $('#house-in-room').hidden = true; }
    $('#room-canvas').hidden = open;
    document.body.classList.toggle('is-connected', open); app.roomUI.renderHeading();
    app.room?.setSuspended(open); app.timer.syncDock(); connectionsKey = ''; renderConnections(false);
  }
  function leaveNavigationViews() {
    setConnectedView(false);
    if (app.decorate.active) app.decorate.setEditMode(false);
    app.roomUI.leaveMini();
    if (app.panels.current) app.panels.close();
  }
  async function selectDestination(id, walk = false) {
    if (travelling || preparing) return;
    if (id !== app.state.house.activeId) {
      if (app.panels.current === 'avatar') app.panels.close();
      preparing = true;
      try { await app.acceptUpdate(app.store.update()); } finally { preparing = false; }
      if (isFocusing(app.state.session)) { app.toast('Pause your focus session before walking to another room.', true); return; }
    }
    closePicker(false);
    leaveNavigationViews();
    if (id !== app.state.house.activeId) { if (walk) visitDoor(id); else visitRoom(id, false); }
    else switcher.focus({ preventScroll: true });
  }
  async function visitRoom(id, decorate = app.decorate.active, fromDoor = false) {
    if (preparing || (travelling && !fromDoor)) return;
    // Closing the avatar editor resumes a timer it paused, so close it before
    // the focus check.
    if (app.panels.current === 'avatar') app.panels.close();
    if (!fromDoor && id !== app.state.house.activeId) {
      preparing = true;
      try { await app.acceptUpdate(app.store.update()); } finally { preparing = false; }
      if (isFocusing(app.state.session)) { app.toast('Pause your focus session before walking to another room.', true); return; }
    }
    const entry = app.state.house.rooms.find(room => room.id === id);
    if (!entry) { setHouseOpen(true, id); return; }
    if (!fromDoor) setConnectedView(false);
    if (app.decorate.active) app.decorate.setEditMode(false);
    const originId = app.state.house.activeId;
    const arrive = async () => {
      const wasTravelling = travelling;
      await app.acceptUpdate(app.store.update());
      if (wasTravelling && !travelling) return;
      if (isFocusing(app.state.session) || app.state.house.activeId !== originId) { cancelDoorTravel(); return; }
      const moved = id !== app.state.house.activeId;
      app.decorate.resetForArrival();
      $('#room-travel').hidden = true; document.body.classList.remove('is-travelling', 'is-door-walking'); travelling = false;
      await app.acceptUpdate(app.store.enterHouseRoom(id));
      syncTravelControls();
      // Arrival must release the travel lock before opening the room editor.
      if (decorate) app.decorate.openCollection();
      app.timer.render();
      if (moved) $('#room-title').focus({ preventScroll: true });
      $('#stage').classList.remove('room-arrival'); void $('#stage').offsetWidth; $('#stage').classList.add('room-arrival');
      clearTimeout(arrivalTimer); arrivalTimer = setTimeout(() => $('#stage').classList.remove('room-arrival'), 650);
    };
    if (houseOpen) return travelTo('home', () => { showHouse(false); arrive(); }, () => Boolean(app.room?.diagnostics().scene.isReady()));
    if (id === app.state.house.activeId || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { arrive(); return; }
    const direction = app.state.house.rooms.findIndex(room => room.id === id) < app.state.house.rooms.findIndex(room => room.id === app.state.house.activeId) ? -1 : 1;
    $('#stage').style.setProperty('--room-travel-direction', direction);
    travelling = true; syncTravelControls(); $('#travel-label').textContent = `On to ${roomDisplayName(entry)}`; $('#room-travel small').textContent = 'A different corner of home.'; $('#room-travel').hidden = false; document.body.classList.add('is-travelling'); app.timer.render();
    travelTimer = setTimeout(arrive, 240);
  }
  async function visitDoor(id) {
    if (travelling || preparing) return;
    if (app.panels.current === 'avatar') app.panels.close();
    preparing = true;
    try { await app.acceptUpdate(app.store.update()); } finally { preparing = false; }
    if (isFocusing(app.state.session)) { app.toast('Pause your focus session before walking to another room.', true); return; }
    if (id === app.state.house.activeId) { leaveNavigationViews(); return; }
    leaveNavigationViews();
    const entry = app.state.house.rooms.find(room => room.id === id);
    // A door to a room not built yet: walk over, peek through, then plan it.
    const link = entry || houseConnections(app.state.house).find(slot => slot.id === id);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { if (entry) visitRoom(id, false); else setHouseOpen(true, id); return; }
    if (!entry && !link) { setHouseOpen(true, id); return; }
    const planRoom = () => { cancelDoorTravel(); setHouseOpen(true, id); };
    closePicker(false);
    doorWalking = true; travelling = true; syncTravelControls();
    app.hideToast();
    $('#journey-progress-fill').style.transform = 'scaleX(0)';
    $('#travel-label').textContent = `Walking to ${entry ? roomDisplayName(entry) : link.name}`;
    $('#room-travel small').textContent = 'A little walk through your home.';
    $('#room-travel').hidden = false; document.body.classList.add('is-travelling', 'is-door-walking'); app.timer.render();
    app.room?.setDoorActive?.(id);
    const started = app.room?.walkToDoor?.(id, result => {
      if (result?.cancelled) { cancelDoorTravel('Your room changed. Tap the door again when you’re ready.'); return; }
      if (!doorWalking) return;
      if (!entry) { planRoom(); return; }
      doorWalking = false;
      app.room?.setDoorActive?.(null);
      document.body.classList.remove('is-door-walking');
      $('#travel-label').textContent = `On to ${roomDisplayName(entry)}`;
      $('#room-travel small').textContent = 'A different corner of home.';
      visitRoom(id, false, true);
    }, () => {
      app.room?.setDoorOpen?.(id);
      if (entry) { $('#room-travel small').textContent = 'Opening the door. Make yourself at home.'; return; }
      $('#room-travel small').textContent = 'A little peek at what could be.';
      let peeked = 0, last = performance.now();
      const peek = now => {
        if (!doorWalking) return;
        peeked += Math.min(.1, Math.max(0, now - last) / 1000); last = now;
        if (peeked < DOOR_OPEN_SECONDS) { peekFrame = requestAnimationFrame(peek); return; }
        $('#journey-progress-fill').style.transform = 'scaleX(1)'; planRoom();
      };
      peekFrame = requestAnimationFrame(peek);
    });
    if (!started) {
      cancelDoorTravel();
      if (!entry) setHouseOpen(true, id);
      else app.toast('There isn’t a clear path to that door. Move a little furniture and try again.', true);
    }
  }

  function onStateChange(previous) {
    if (!travelling) return;
    if (isFocusing(app.state.session)) cancelDoorTravel('Focusing started in another tab, so room travel stopped.');
    else if (previous.house.activeId !== app.state.house.activeId || JSON.stringify(previous.layout) !== JSON.stringify(app.state.layout)) cancelDoorTravel('Your room changed. Tap the door again when you’re ready.');
  }

  function onDoorProgress(progress) { if (doorWalking) $('#journey-progress-fill').style.transform = `scaleX(${progress})`; }

  switcher.addEventListener('click', () => {
    if (travelling) return;
    renderConnections(); picker.showModal(); switcher.setAttribute('aria-expanded', 'true');
    picker.querySelector('[aria-current="location"]')?.focus({ preventScroll: true });
  });
  $('#close-room-picker').addEventListener('click', () => closePicker());
  picker.addEventListener('cancel', event => { event.preventDefault(); closePicker(); });
  picker.addEventListener('keydown', event => {
    if (event.key === 'Escape') event.stopPropagation();
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key) || !event.target.closest('.room-card')) return;
    event.preventDefault();
    const cards = [...picker.querySelectorAll('.room-card')], index = cards.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 : (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + cards.length) % cards.length;
    cards[next]?.focus();
  });
  let backdropDown = false;
  const outsidePicker = event => { const rect = picker.getBoundingClientRect(); return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom; };
  picker.addEventListener('pointerdown', event => { backdropDown = event.target === picker && outsidePicker(event); });
  picker.addEventListener('click', event => { if (backdropDown && event.target === picker && outsidePicker(event)) closePicker(); backdropDown = false; });
  $('#room-picker-house').addEventListener('click', () => { closePicker(false); setHouseOpen(true); });
  $('.home-wide').addEventListener('click', () => setConnectedView(!connectedView));
  for (const [selector, offset] of [['#previous-room', -1], ['#next-room', 1]]) $(selector).addEventListener('click', () => {
    const index = app.state.house.rooms.findIndex(room => room.id === app.state.house.activeId), destination = app.state.house.rooms[index + offset];
    if (destination) selectDestination(destination.id);
  });
  $('#cancel-room-travel').addEventListener('click', () => { if (cancelDoorTravel()) switcher.focus({ preventScroll: true }); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && doorWalking && !event.isComposing) { event.preventDefault(); event.stopImmediatePropagation(); cancelDoorTravel(); switcher.focus({ preventScroll: true }); }
  }, { signal: app.signal });

  $('#rooms-button').addEventListener('click', () => setHouseOpen(true));
  $('#coin-wallet').addEventListener('click', () => setHouseOpen(!houseOpen));

  return {
    get houseOpen() { return houseOpen; },
    get connected() { return connectedView; },
    get travelling() { return travelling || preparing; },
    setHouseOpen, setConnectedView, renderConnections, visitRoom, visitDoor, onStateChange, onDoorProgress,
    dispose() { closePicker(false); clearTimeout(travelTimer); cancelAnimationFrame(peekFrame); clearTimeout(arrivalTimer); connectedView?.dispose(); },
  };
}
