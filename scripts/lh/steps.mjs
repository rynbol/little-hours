export const steps = {
  async openFocus(app) { await app.clickSel('#focus-mode-enter'); await app.waitFor(`document.body.classList.contains('is-focus-mode')`, { what: 'Focus mode' }); await app.settle(); },
  async closeFocus(app) { await app.clickSel('#focus-mode-exit'); await app.waitFor(`!document.body.classList.contains('is-focus-mode')`, { what: 'leaving Focus mode' }); await app.settle(); },
  async openRoomPicker(app) { if (await app.visible('#room-switcher-toggle')) { await app.clickSel('#room-switcher-toggle'); await app.waitFor(`document.getElementById('room-picker').open`, { what: 'the room picker' }); await app.waitFor(`!document.getElementById('room-picker').getAnimations().some(animation => animation.playState === 'running')`, { what: 'the room picker animation' }); } },
  async openHouse(app) { await app.clickSel('#rooms-button'); await app.waitFor(`document.body.classList.contains('is-house') && Boolean(!window.__littleHours?.house || window.__littleHours.house.diagnostics())`, { what: 'the house page', timeout: 10000 }); await app.settle(); },
  async backToRoom(app) { await app.clickSel('#back-to-room'); await app.waitFor(`!document.body.classList.contains('is-house')`, { what: 'the room page', timeout: 20000 }); await app.settle(); },
  async toggleHouse(app) { await app.clickSel('[data-house-open]'); await app.settle(); },
  async openDecorate(app) { await app.clickSel('#decorate-button'); await app.waitFor(`document.body.classList.contains('is-decorating')`, { what: 'Decorate' }); await app.settle(); },
  async closeDecorate(app) { await app.clickSel('#decorate-button'); await app.waitFor(`!document.body.classList.contains('is-decorating')`, { what: 'leaving Decorate' }); await app.settle(); },
  async openAvatar(app) { await app.clickSel('#avatar-button'); await app.waitFor(`document.body.classList.contains('is-avatar-editing')`, { what: 'the avatar editor' }); await app.settle(); },
  async openLake(app) { await steps.openHouse(app); await app.clickSel('[data-room="pond"]'); await app.waitFor(`Boolean(window.__littleHours.lake.isOpen && window.__littleHours.lake.diagnostics())`, { what: 'the lake', timeout: 10000 }); },
  async closeAvatar(app) { await app.clickSel('#avatar-done'); await app.waitFor(`!document.body.classList.contains('is-avatar-editing')`, { what: 'leaving the avatar editor' }); await app.settle(); },
};

export const cycles = {
  focus: { about: 'enter and leave whole-room Focus mode without pausing', async run(app) { await steps.openFocus(app); await steps.closeFocus(app); } },
  rooms: { about: 'visit the garden and studio using their room cards', async run(app) { for (const id of ['garden', 'studio']) { await steps.openRoomPicker(app); await app.clickSel(`[data-house-go="${id}"]`); await app.waitFor(`window.__littleHours.state.house.activeId === '${id}' && !document.body.classList.contains('is-travelling')`, { what: `arrival in ${id}`, timeout: 30000 }); await app.settle(); } } },
  pet: { about: 'choose the cat and puppy, open and close pet care', async run(app) { await app.clickSel('#pet-button'); if (await app.js(`Boolean(document.querySelector('#pet-collection'))`)) await app.clickSel('#pet-collection > summary'); await app.clickSel('[data-pet-choice="dog"]'); await app.clickSel('[data-pet-choice="cat"]'); await app.clickSel('#close-panel'); await app.settle(); } },
  house: { about: 'open the house page, then go back to the room', async run(app) { await steps.openHouse(app); await steps.backToRoom(app); } },
  decorate: { about: 'open Decorate, then leave it', async run(app) { await steps.openDecorate(app); await steps.closeDecorate(app); } },
  avatar: { about: 'open the avatar editor, then press Done', async run(app) { await steps.openAvatar(app); await steps.closeAvatar(app); } },
  'house-toggle': { about: 'on the house page, close the house and open it again', async setup(app) { await steps.openHouse(app); }, async run(app) { await steps.toggleHouse(app); await steps.toggleHouse(app); } },
};

export const views = {
  focus: { about: 'the whole room in Focus mode, or the room on older refs', async go(app) { if (await app.js(`Boolean(document.getElementById('focus-mode-enter'))`)) await steps.openFocus(app); } },
  'room-picker': { about: 'the illustrated room picker', async go(app) { await steps.openRoomPicker(app); } },
  pet: { about: 'your pet care card', async go(app) { await app.clickSel('#pet-button'); await app.settle(); } },
  room: { about: 'the room at rest', async go() {} },
  house: { about: 'the house page, open', async go(app) { await steps.openHouse(app); } },
  'house-closed': { about: 'the house page, closed', async go(app) { await steps.openHouse(app); await steps.toggleHouse(app); } },
  decorate: { about: 'Decorate mode', async go(app) { await steps.openDecorate(app); } },
  avatar: { about: 'the avatar editor', async go(app) { await steps.openAvatar(app); } },
  lake: { about: 'fishing at Willow Pond, idle', async go(app) { await steps.openLake(app); } },
};
