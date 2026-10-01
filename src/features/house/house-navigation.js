import { isFocusing } from '../../core/session.js';
import { houseConnections, roomDisplayName } from '../../core/house.js';
import { DOOR_OPEN_SECONDS } from '../companion/index.js';
import { $ } from '../../ui/dom.js';
import './room-navigation.css';
import { travelTo } from '../../ui/place-transition.js';

export function createHouseNavigation(app) {
  let houseOpen = false, travelTimer = 0, peekFrame = 0, arrivalTimer = 0, travelling = false, doorWalking = false, preparing = false;

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

  function syncTravelControls() {
    $('#rename-room').disabled = travelling;
  }

  function leaveNavigationViews() {
    if (app.decorate.active) app.decorate.setEditMode(false);
    app.roomUI.leaveMini();
    if (app.panels.current) app.panels.close();
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

  $('#cancel-room-travel').addEventListener('click', () => { if (cancelDoorTravel()) $('#rooms-button').focus({ preventScroll: true }); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && doorWalking && !event.isComposing) { event.preventDefault(); event.stopImmediatePropagation(); cancelDoorTravel(); $('#rooms-button').focus({ preventScroll: true }); }
  }, { signal: app.signal });

  $('#rooms-button').addEventListener('click', () => setHouseOpen(true));

  return {
    get houseOpen() { return houseOpen; },
    get travelling() { return travelling || preparing; },
    setHouseOpen, visitRoom, visitDoor, onStateChange, onDoorProgress,
    dispose() { clearTimeout(travelTimer); cancelAnimationFrame(peekFrame); clearTimeout(arrivalTimer); },
  };
}
