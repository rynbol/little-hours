export const steps = {
  async openHouse(app) { await app.clickSel('#rooms-button'); await app.waitFor(`document.body.classList.contains('is-house') && Boolean(!window.__littleHours?.house || window.__littleHours.house.diagnostics())`, { what: 'the house page', timeout: 10000 }); await app.settle(); },
  async backToRoom(app) { await app.clickSel('#back-to-room'); await app.waitFor(`!document.body.classList.contains('is-house')`, { what: 'the room page' }); await app.settle(); },
  async toggleHouse(app) { await app.clickSel('[data-house-open]'); await app.settle(); },
  async openDecorate(app) { await app.clickSel('#decorate-button'); await app.waitFor(`document.body.classList.contains('is-decorating')`, { what: 'Decorate' }); await app.settle(); },
  async closeDecorate(app) { await app.clickSel('#decorate-button'); await app.waitFor(`!document.body.classList.contains('is-decorating')`, { what: 'leaving Decorate' }); await app.settle(); },
  async openAvatar(app) { await app.clickSel('#avatar-button'); await app.waitFor(`document.body.classList.contains('is-avatar-editing')`, { what: 'the avatar editor' }); await app.settle(); },
  async closeAvatar(app) { await app.clickSel('#avatar-done'); await app.waitFor(`!document.body.classList.contains('is-avatar-editing')`, { what: 'leaving the avatar editor' }); await app.settle(); },
  async openFocusMode(app) {
    if (!await app.js(`Boolean(document.querySelector('#focus-mode-enter'))`)) return;
    await app.clickSel('#focus-mode-enter');
    await app.waitFor(`document.body.classList.contains('is-focus-mode')`, { what: 'Focus mode' });
    await app.waitFor(`window.__littleHours.room.diagnostics().focusCameraApplied`, { what: 'the companion to reach the active desk', timeout: 20000 });
  },
};

export const cycles = {
  house: { about: 'open the house page, then go back to the room', async run(app) { await steps.openHouse(app); await steps.backToRoom(app); } },
  decorate: { about: 'open Decorate, then leave it', async run(app) { await steps.openDecorate(app); await steps.closeDecorate(app); } },
  avatar: { about: 'open the avatar editor, then press Done', async run(app) { await steps.openAvatar(app); await steps.closeAvatar(app); } },
  'house-toggle': { about: 'on the house page, close the house and open it again', async setup(app) { await steps.openHouse(app); }, async run(app) { await steps.toggleHouse(app); await steps.toggleHouse(app); } },
};

export const views = {
  room: { about: 'the room at rest', async go() {} },
  house: { about: 'the house page, open', async go(app) { await steps.openHouse(app); } },
  'house-closed': { about: 'the house page, closed', async go(app) { await steps.openHouse(app); await steps.toggleHouse(app); } },
  decorate: { about: 'Decorate mode', async go(app) { await steps.openDecorate(app); } },
  avatar: { about: 'the avatar editor', async go(app) { await steps.openAvatar(app); } },
  focus: { about: 'Focus mode with the avatar at the active desk and its quiet timer', async go(app) { await steps.openFocusMode(app); } },
};
