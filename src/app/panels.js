import { $ } from '../ui/dom.js';
import { icon } from '../ui/icons.js';

export function createPanels(app) {
  let current = null;
  let petPage = false;

  function render() {
    const panel = $('#room-panel');
    const leavingAvatar = app.avatar.syncEditing(current);
    panel.hidden = !current;
    panel.dataset.panelKind = current || '';
    const nextPetPage = current === 'pet';
    if (petPage !== nextPetPage) {
      petPage = nextPetPage; document.body.classList.toggle('is-pet-page', petPage);
      document.querySelectorAll('.app-header, .app-footer, .skip-link, #focus-card, #room-section > :not(#room-panel)').forEach(node => { node.inert = petPage; });
      app.room?.setSuspended(petPage || app.nav.houseOpen || Boolean(app.nav.connected));
    }
    if (petPage) { panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', 'Companions'); }
    else { panel.removeAttribute('role'); panel.removeAttribute('aria-label'); }
    document.querySelectorAll('[data-panel]').forEach(button => button.setAttribute('aria-expanded', button.dataset.panel === current));
    // Reconcile the new canvas bounds before the next frame, not one frame
    // later when ResizeObserver runs after the portrait layout disappears.
    if (leavingAvatar) app.room?.resize?.();
    if (!current) return;
    panel.innerHTML = `<div class="panel-heading"><span>${({ atmosphere: 'Find your kind of quiet', pet: 'Your little companion', avatar: 'Meet your avatar', saves: 'Keep your home safe' })[current] || 'A smoother little room'}</span><button class="icon-button" id="close-panel" aria-label="Close room controls">${icon('close')}</button></div>`;
    if (petPage) {
      panel.querySelector('.panel-heading > span').textContent = 'little hours.';
      panel.querySelector('.panel-heading').insertAdjacentHTML('beforeend', `<span class="pet-page-timer">${icon('clock')}<span id="pet-page-clock"></span></span>`);
      const closeButton = $('#close-panel'); closeButton.innerHTML = '<span aria-hidden="true">←</span> Back to room'; closeButton.setAttribute('aria-label', 'Back to room'); closeButton.before($('.pet-page-timer'));
    }
    if (current === 'atmosphere') app.roomUI.renderAtmosphere(panel);
    else if (current === 'pet') app.pet.renderPanel(panel);
    else if (current === 'avatar') app.avatar.renderPanel(panel);
    else if (current === 'saves') app.backup.renderPanel(panel);
    else app.roomUI.renderQuality(panel);
    $('#close-panel').addEventListener('click', close);
    if (current !== 'avatar') $('#close-panel').focus({ preventScroll: true });
    if (petPage) app.timer.render();
  }

  function open(name) { current = name; render(); }

  function close() {
    const previous = current; current = null; render();
    document.querySelector(`[data-panel="${previous}"]`)?.focus();
  }

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
