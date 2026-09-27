export const steps = {
  async openHouse(app) { await app.clickSel('#rooms-button'); await app.waitFor(`document.body.classList.contains('is-house') && Boolean(!window.__littleHours?.house || window.__littleHours.house.diagnostics())`, { what: 'the house page', timeout: 10000 }); await app.settle(); },
  async backToRoom(app) { await app.clickSel('#back-to-room'); await app.waitFor(`!document.body.classList.contains('is-house')`, { what: 'the room page' }); await app.settle(); },
  async toggleHouse(app) { await app.clickSel('[data-house-open]'); await app.settle(); },
  async openDecorate(app) { await app.clickSel('#decorate-button'); await app.waitFor(`document.body.classList.contains('is-decorating')`, { what: 'Decorate' }); await app.settle(); },
  async closeDecorate(app) { await app.clickSel('#decorate-button'); await app.waitFor(`!document.body.classList.contains('is-decorating')`, { what: 'leaving Decorate' }); await app.settle(); },
  async openAvatar(app) { await app.clickSel('#avatar-button'); await app.waitFor(`document.body.classList.contains('is-avatar-editing')`, { what: 'the avatar editor' }); await app.settle(); },
  async openLake(app) { await steps.openHouse(app); await app.clickSel('[data-room="pond"]'); await app.waitFor(`Boolean(window.__littleHours.lake.isOpen && window.__littleHours.lake.diagnostics())`, { what: 'the lake', timeout: 10000 }); },
  async closeAvatar(app) { await app.clickSel('#avatar-done'); await app.waitFor(`!document.body.classList.contains('is-avatar-editing')`, { what: 'leaving the avatar editor' }); await app.settle(); },
};

export const cycles = {
  pet: { about: 'choose the cat and puppy, open and close the pet notebook', async run(app) { await app.clickSel('#pet-button'); await app.clickSel('[data-pet-choice="dog"]'); await app.clickSel('[data-pet-choice="cat"]'); await app.clickSel('#close-panel'); await app.settle(); } },
  house: { about: 'open the house page, then go back to the room', async run(app) { await steps.openHouse(app); await steps.backToRoom(app); } },
  decorate: { about: 'open Decorate, then leave it', async run(app) { await steps.openDecorate(app); await steps.closeDecorate(app); } },
  avatar: { about: 'open the avatar editor, then press Done', async run(app) { await steps.openAvatar(app); await steps.closeAvatar(app); } },
  'house-toggle': { about: 'on the house page, close the house and open it again', async setup(app) { await steps.openHouse(app); }, async run(app) { await steps.toggleHouse(app); await steps.toggleHouse(app); } },
};

export const views = {
  pet: { about: 'your pet notebook', async go(app) { await app.clickSel('#pet-button'); await app.settle(); } },
  room: { about: 'the room at rest', async go() {} },
  house: { about: 'the house page, open', async go(app) { await steps.openHouse(app); } },
  'house-closed': { about: 'the house page, closed', async go(app) { await steps.openHouse(app); await steps.toggleHouse(app); } },
  decorate: { about: 'Decorate mode', async go(app) { await steps.openDecorate(app); } },
  avatar: { about: 'the avatar editor', async go(app) { await steps.openAvatar(app); } },
  lake: { about: 'fishing at Willow Pond, idle', async go(app) { await steps.openLake(app); } },
};
