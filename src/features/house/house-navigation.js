import { nextExpansion, houseConnections, roomDisplayName } from '../../core/house.js';
import { roomDesign } from '../../core/layout.js';
import { DOOR_OPEN_SECONDS } from '../companion/index.js';
import { $ } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { roomDesignArt } from '../decorate/index.js';
import { createHouseView } from './house-view.js';
import { studyTrees } from '../../core/garden.js';
import './room-navigation.css';

export function createHouseNavigation(app) {
  let houseOpen = false, connectedView = null, connectionsKey = '', travelTimer = 0, peekFrame = 0, arrivalTimer = 0, travelling = false, doorWalking = false;

  function cancelDoorTravel(message) {
    if (!doorWalking) return false;
    doorWalking = false; travelling = false;
    clearTimeout(travelTimer); travelTimer = 0; cancelAnimationFrame(peekFrame); peekFrame = 0;
    $('#room-travel').hidden = true; document.body.classList.remove('is-travelling', 'is-door-walking');
    app.room?.setDoorActive?.(null);
    app.room?.setDoorOpen?.(null);
    app.room?.cancelDoorWalk?.({ returnToDesk: true });
    app.timer.render();
    if (message) app.toast(message, true);
    return true;
  }

  function setHouseOpen(open, selectedId) {
    if (travelling || open === houseOpen) return;
    if (open) {
      setConnectedView(false);
      if (app.decorate.active) app.decorate.setEditMode(false);
      app.panels.open(null);
    }
    houseOpen = open;
    document.body.classList.toggle('is-house', open);
    $('#room-section').hidden = open;
    app.room?.setSuspended(open);
    if (open) { app.houseUI.show(selectedId); $('#back-to-room').focus({ preventScroll: true }); }
    else { app.houseUI.hide(); $('#rooms-button').focus({ preventScroll: true }); }
    app.timer.syncDock();
  }
  function renderConnections(updateModel = true) {
    connectedView?.setFocused(app.state.session.running);
    const key = JSON.stringify([app.state.house, app.state.history.length, app.state.theme, app.state.avatar, Boolean(connectedView)]);
    if (connectionsKey === key) return;
    connectionsKey = key;
    const nav = $('#home-connections'), focused = nav.contains(document.activeElement) ? document.activeElement : null;
    const focusId = focused?.dataset.houseGo, focusWide = focused?.classList.contains('home-wide');
    nav.replaceChildren();
    const cards = document.createElement('div'); cards.className = 'room-cards'; nav.append(cards);
    for (const entry of app.state.house.rooms) {
      const button = document.createElement('button'), current = entry.id === app.state.house.activeId && !connectedView, name = roomDisplayName(entry);
      button.className = 'room-card'; button.dataset.houseGo = entry.id; button.disabled = travelling;
      button.setAttribute('aria-current', current ? 'location' : 'false'); button.setAttribute('aria-label', name); button.title = name;
      button.innerHTML = `<span class="room-card-art">${roomDesignArt(roomDesign(entry.layout))}</span><span class="room-card-name"></span><span class="room-card-mark">${icon(current ? 'check' : 'arrow')}</span>`;
      button.querySelector('.room-card-name').textContent = name;
      button.addEventListener('click', () => selectDestination(entry.id)); cards.append(button);
    }
    const next = nextExpansion(app.state.house);
    if (next) {
      const button = document.createElement('button'); button.className = 'room-card home-next'; button.dataset.houseGo = next.id; button.disabled = travelling;
      button.setAttribute('aria-current', 'false'); button.setAttribute('aria-label', `Plan ${next.short}, ${next.price} coins`);
      button.innerHTML = `<span class="room-card-art">${roomDesignArt(roomDesign({ presetId: next.id === 'loft' ? 'cloud-loft' : 'sakura-studio' }))}</span><span class="room-card-name"></span><span class="room-card-price">${icon('sun')} ${Math.min(app.state.house.coins, next.price)}/${next.price}</span><span class="room-card-mark">${icon('plus')}</span>`;
      button.querySelector('.room-card-name').textContent = next.short;
      button.addEventListener('click', () => selectDestination(next.id)); cards.append(button);
    }
    const wide = document.createElement('button'); wide.className = 'home-wide'; wide.disabled = travelling; wide.innerHTML = `${icon('home')}<span>${connectedView ? 'Back to room' : 'Whole house'}</span>`; wide.setAttribute('aria-pressed', String(Boolean(connectedView)));
    wide.addEventListener('click', () => setConnectedView(!connectedView)); nav.append(wide);
    if (connectedView && updateModel) connectedView.update(withGarden(), app.state.house.activeId, app.state.theme, app.state.avatar);
    const restored = focusId ? cards.querySelector(`[data-house-go="${focusId}"]`) : focusWide ? wide : null;
    if (restored && !restored.disabled) restored.focus({ preventScroll: true });
  }
  const withGarden = () => ({ ...app.state.house, pet: app.state.pet, garden: studyTrees(app.state.history) });
  function setConnectedView(open) {
    if (travelling || open === Boolean(connectedView)) return;
    if (open && app.panels.current === 'avatar') app.panels.close();
    if (open && app.decorate.active) app.decorate.setEditMode(false);
    if (open) {
      $('#house-in-room').hidden = false;
      connectedView = createHouseView($('#house-in-room'), { house: withGarden(), selectedId: app.state.house.activeId, theme: app.state.theme, avatar: app.state.avatar, focused: app.state.session.running, onSelect: id => id === 'pond' ? app.lake?.open() : selectDestination(id) });
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
  function selectDestination(id) {
    if (travelling) return;
    if (id !== app.state.house.activeId) { visitDoor(id); return; }
    leaveNavigationViews();
  }
  function visitRoom(id, decorate = app.decorate.active, fromDoor = false) {
    if (travelling && !fromDoor) return;
    // Closing the avatar editor resumes a timer it paused, so close it before
    // the focus check.
    if (app.panels.current === 'avatar') app.panels.close();
    if (!fromDoor && id !== app.state.house.activeId) {
      app.acceptUpdate(app.store.update());
      if (app.state.session.running) { app.toast('Pause your focus session before walking to another room.', true); return; }
    }
    const entry = app.state.house.rooms.find(room => room.id === id);
    if (!entry) { setHouseOpen(true, id); return; }
    if (!fromDoor) setConnectedView(false);
    if (houseOpen) setHouseOpen(false);
    if (app.decorate.active) app.decorate.setEditMode(false);
    const arrive = () => {
      const moved = id !== app.state.house.activeId;
      app.decorate.resetForArrival();
      app.acceptUpdate(app.store.enterHouseRoom(id));
      $('#room-travel').hidden = true; document.body.classList.remove('is-travelling', 'is-door-walking'); travelling = false;
      // Arrival must release the travel lock before opening the room editor.
      if (decorate) app.decorate.openCollection();
      app.timer.render();
      if (moved) $('#room-title').focus({ preventScroll: true });
      $('#stage').classList.remove('room-arrival'); void $('#stage').offsetWidth; $('#stage').classList.add('room-arrival');
      clearTimeout(arrivalTimer); arrivalTimer = setTimeout(() => $('#stage').classList.remove('room-arrival'), 650);
    };
    if (id === app.state.house.activeId || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { arrive(); return; }
    travelling = true; $('#travel-label').textContent = `On to ${roomDisplayName(entry)}`; $('#room-travel small').textContent = 'A different corner of home.'; $('#room-travel').hidden = false; document.body.classList.add('is-travelling'); app.timer.render();
    travelTimer = setTimeout(arrive, 220);
  }
  function visitDoor(id) {
    if (travelling) return;
    if (app.panels.current === 'avatar') app.panels.close();
    app.acceptUpdate(app.store.update());
    if (app.state.session.running) { app.toast('Pause your focus session before walking to another room.', true); return; }
    if (id === app.state.house.activeId) { leaveNavigationViews(); return; }
    leaveNavigationViews();
    const entry = app.state.house.rooms.find(room => room.id === id);
    // A door to a room not built yet: walk over, peek through, then plan it.
    const link = entry || houseConnections(app.state.house).find(slot => slot.id === id);
    if (!entry && (!link || window.matchMedia('(prefers-reduced-motion: reduce)').matches)) { setHouseOpen(true, id); return; }
    const planRoom = () => { cancelDoorTravel(); setHouseOpen(true, id); };
    doorWalking = true; travelling = true;
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
    if (!doorWalking) return;
    if (app.state.session.running) cancelDoorTravel('Focusing started in another tab, so the walk to the door stopped.');
    else if (previous.house.activeId !== app.state.house.activeId || JSON.stringify(previous.layout) !== JSON.stringify(app.state.layout)) cancelDoorTravel('Your room changed. Tap the door again when you’re ready.');
  }

  function onDoorProgress(progress) { if (doorWalking) $('#journey-progress-fill').style.transform = `scaleX(${progress})`; }

  $('#rooms-button').addEventListener('click', () => setHouseOpen(true));
  $('#coin-wallet').addEventListener('click', () => setHouseOpen(!houseOpen));

  return {
    get houseOpen() { return houseOpen; },
    get connected() { return connectedView; },
    get travelling() { return travelling; },
    setHouseOpen, setConnectedView, renderConnections, visitRoom, visitDoor, onStateChange, onDoorProgress,
    dispose() { clearTimeout(travelTimer); cancelAnimationFrame(peekFrame); clearTimeout(arrivalTimer); connectedView?.dispose(); },
  };
}
