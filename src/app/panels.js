import { $ } from '../ui/dom.js';
import { icon } from '../ui/icons.js';

export function createPanels(app) {
  let current = null;
  let petCard = false;

  function render() {
    const panel = $('#room-panel');
    const leavingAvatar = app.avatar.syncEditing(current);
    panel.hidden = !current;
    panel.dataset.panelKind = current || '';
    const nextPetCard = current === 'pet';
    if (petCard !== nextPetCard) {
      if (!nextPetCard) app.pet.close();
      petCard = nextPetCard; document.body.classList.toggle('is-pet-care', petCard);
      if (petCard) $('#focus-card').before(panel);
      else $('#room-section').append(panel);
      app.room?.resize?.();
    }
    if (petCard) { panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', 'Pet care'); }
    else { panel.removeAttribute('role'); panel.removeAttribute('aria-label'); }
    document.querySelectorAll('[data-panel]').forEach(button => button.setAttribute('aria-expanded', button.dataset.panel === current));
    // Reconcile the new canvas bounds before the next frame, not one frame
    // later when ResizeObserver runs after the portrait layout disappears.
    if (leavingAvatar) app.room?.resize?.();
    if (!current) return;
    panel.innerHTML = `<div class="panel-heading"><span>${({ atmosphere: 'Find your kind of quiet', pet: 'Your little companion', avatar: 'Meet your avatar', saves: 'Keep your home safe' })[current] || 'A smoother little room'}</span><button class="icon-button" id="close-panel" aria-label="Close room controls">${icon('close')}</button></div>`;
    if (current === 'atmosphere') app.roomUI.renderAtmosphere(panel);
    else if (current === 'pet') app.pet.renderPanel(panel);
    else if (current === 'avatar') app.avatar.renderPanel(panel);
    else if (current === 'saves') app.backup.renderPanel(panel);
    else app.roomUI.renderQuality(panel);
    $('#close-panel').addEventListener('click', close);
    if (current !== 'avatar') $('#close-panel').focus({ preventScroll: true });
    if (petCard) app.timer.render();
  }

  function open(name) { if (name) app.timer.leaveFocusMode({ restoreFocus: false }); current = name; render(); }

  function close() {
    const previous = current; current = null; render();
    const trigger = document.querySelector(`[data-panel="${previous}"]`);
    (trigger?.closest('#room-more') ? $('#room-more-toggle') : trigger)?.focus();
  }

  $('#room-more').addEventListener('beforetoggle', event => {
    if (event.newState !== 'open') return;
    const box = $('#room-more-toggle').getBoundingClientRect(), menu = $('#room-more');
    menu.style.left = `${Math.max(16, Math.min(innerWidth - 226, box.right - 210))}px`;
    menu.style.bottom = `${Math.max(16, Math.min(innerHeight - 240, innerHeight - box.top + 8))}px`;
  }, { signal: app.signal });
  $('#room-more').addEventListener('click', event => {
    if (event.target.closest('button')) { $('#room-more').hidePopover(); if (event.target.closest('#mini-button, #reset-view')) $('#room-more-toggle').focus(); }
  }, { signal: app.signal });

  document.querySelectorAll('[data-panel]').forEach(button => button.addEventListener('click', () => {
    // Like Decorate, the avatar editor waits until a walk or a room change ends.
    if (app.nav.travelling && ['avatar', 'pet'].includes(button.dataset.panel) && current !== button.dataset.panel) return;
    if (['avatar', 'pet'].includes(button.dataset.panel) && current !== button.dataset.panel) {
      if (app.decorate.active) app.decorate.setEditMode(false);
      if (app.nav.connected) app.nav.setConnectedView(false);
      app.roomUI.leaveMini();
    }
    open(current === button.dataset.panel ? null : button.dataset.panel);
  }));

  return { get current() { return current; }, render, open, close };
}
