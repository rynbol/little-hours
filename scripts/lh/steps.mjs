import { sleep } from './chrome.mjs';
import { dispatchSequenceInput } from './sequence.mjs';
import { wildsShotView } from './wilds-shots.mjs';

export const steps = {
  async houseRooms(app) { if (await app.js(`Boolean(document.getElementById('house-room-menu') && !document.getElementById('house-room-menu').matches(':popover-open'))`)) await app.clickSel('#house-rooms-toggle'); },
  async openMore(app) { if (await app.js(`Boolean(document.getElementById('room-more') && !document.getElementById('room-more').matches(':popover-open'))`)) await app.clickSel('#room-more-toggle'); },
  async openTimer(app) { if (await app.js(`Boolean(document.getElementById('timer-sheet-toggle') && !document.getElementById('focus-card').matches(':popover-open'))`)) await app.clickSel('#timer-sheet-toggle'); },
  async openFocus(app) { await steps.openTimer(app); await app.clickSel('#focus-mode-enter'); await app.waitFor(`document.body.classList.contains('is-focus-mode')`, { what: 'Focus mode' }); await app.settle(); },
  async closeFocus(app) { await app.clickSel('#focus-mode-exit'); await app.waitFor(`!document.body.classList.contains('is-focus-mode')`, { what: 'leaving Focus mode', timeout: 20000 }); await app.settle(); },
  async openHouse(app) { await app.clickSel('#rooms-button'); await app.waitFor(`document.body.classList.contains('is-house') && Boolean(!window.__littleHours?.house || window.__littleHours.house.diagnostics())`, { what: 'the house page', timeout: 10000 }); await app.settle(); },
  async backToRoom(app) { if (await app.visible('#garden-back')) { await app.clickSel('#garden-back'); await app.settle(); } await app.clickSel('#back-to-room'); await app.waitFor(`!document.body.classList.contains('is-house')`, { what: 'the room page', timeout: 20000 }); await app.settle(); },
  async toggleHouse(app) { await app.clickSel('[data-house-open]'); await app.settle(); },
  async openDecorate(app) { await app.clickSel('#decorate-button'); await app.waitFor(`document.body.classList.contains('is-decorating')`, { what: 'Decorate' }); await app.settle(); },
  async closeDecorate(app) { await app.clickSel('#decorate-button'); await app.waitFor(`!document.body.classList.contains('is-decorating')`, { what: 'leaving Decorate' }); await app.settle(); },
  async openAvatar(app) { await steps.openMore(app); await app.clickSel('#avatar-button'); await app.waitFor(`document.body.classList.contains('is-avatar-editing')`, { what: 'the avatar editor' }); await app.settle(); },
  async openLake(app) { await steps.openHouse(app); await app.clickSel('[data-room="pond"]'); await app.waitFor(`Boolean(window.__littleHours.lake.isOpen && window.__littleHours.lake.diagnostics())`, { what: 'the lake', timeout: 10000 }); await app.settle(); },
  async closeAvatar(app) { await app.clickSel('#avatar-done'); await app.waitFor(`!document.body.classList.contains('is-avatar-editing')`, { what: 'leaving the avatar editor' }); await app.settle(); },
};

export const cycles = {
  'wilds-traversal': {
    about: 'hold forward and sprint through the Wilds for twenty seconds',
    settings: { path: '/checks/wilds.html', storageKey: 'little-hours-wilds-check-v1' },
    async setup(app) {
      await app.waitFor('window.__littleHours.wilds.ready()', { what: 'the Wilds to render', timeout: 30000 });
      await app.waitFor('!window.__littleHours.wilds.diagnostics().world.pending && !window.__littleHours.wilds.diagnostics().world.lighting?.pending', { what: 'the Wilds terrain and lighting to settle', timeout: 30000 });
      const placed = await app.js('window.__littleHours.wilds.place({position:{x:-106.5,z:-180},yaw:.6,stamina:100,camera:{yaw:.6}})');
      if (!placed) throw new Error('The Forest start is outside loaded terrain');
      await app.js("document.getElementById('wilds-canvas').focus()");
    },
    async run(app) {
      try {
        await dispatchSequenceInput(app, { type: 'keyDown', code: 'ShiftLeft' });
        await dispatchSequenceInput(app, { type: 'keyDown', code: 'KeyW' });
        await sleep(20000);
      } finally {
        try { await dispatchSequenceInput(app, { type: 'keyUp', code: 'KeyW' }); }
        finally { await dispatchSequenceInput(app, { type: 'keyUp', code: 'ShiftLeft' }); }
      }
    },
  },
  garden: { about: 'visit the living garden and return to the room', async run(app) { await steps.openHouse(app); if (await app.visible('#house-open-garden')) await app.clickSel('#house-open-garden'); await app.settle(); await steps.backToRoom(app); } },
  focus: { about: 'enter and leave whole-room Focus mode without pausing', async run(app) { await steps.openFocus(app); await steps.closeFocus(app); } },
  rooms: { about: 'visit the garden and studio through the house page', async run(app) { for (const id of ['garden', 'studio']) { await steps.openHouse(app); await steps.houseRooms(app); await app.clickSel(`#house-slot-${id}`); await app.waitFor(`document.querySelector('#enter-house-room') !== null`, { what: 'the Come on in button' }); await app.clickSel('#enter-house-room'); await app.waitFor(`window.__littleHours.state.house.activeId === '${id}' && !document.body.classList.contains('is-house')`, { what: `arrival in ${id}`, timeout: 30000 }); await app.settle(); } } },
  pet: { about: 'choose the cat and puppy, open and close pet care', async run(app) { await app.clickSel('#pet-button'); if (await app.js(`Boolean(document.querySelector('#pet-collection'))`)) await app.clickSel('#pet-collection > summary'); await app.clickSel('[data-pet-choice="dog"]'); await app.clickSel('[data-pet-choice="cat"]'); await app.clickSel('#close-panel'); await app.settle(); } },
  house: { about: 'open the house page, then go back to the room', async run(app) { await steps.openHouse(app); await steps.backToRoom(app); } },
  decorate: { about: 'open Decorate, then leave it', async run(app) { await steps.openDecorate(app); await steps.closeDecorate(app); } },
  avatar: { about: 'open the avatar editor, then press Done', async run(app) { await steps.openAvatar(app); await steps.closeAvatar(app); } },
  sit: { about: 'with the outdoor world built, fly into the Focus chair and back out', async setup(app) { await app.waitFor(`(window.__littleHours.room.diagnostics().seat.world.outdoor !== false || window.__littleHours.room.diagnostics().seat.world.buildsAhead === false)`, { what: 'the outdoor world to be built, where the renderer builds it ahead', timeout: 30000 }); await app.settle(); }, async run(app) { await steps.openTimer(app); await app.clickSel('#focus-mode-enter'); await app.waitFor(`window.__littleHours.room.diagnostics().seat.state === 'seated'`, { what: 'the view to settle in the chair', timeout: 30000 }); await app.key('Escape'); await app.waitFor(`window.__littleHours.room.diagnostics().seat.state === 'room' && !window.__littleHours.room.diagnostics().moving`, { what: 'the view to fly back out', timeout: 30000 }); } },
  seated: { about: 'sit in the Focus chair for five seconds', async setup(app) { await cycles.sit.setup(app); await steps.openTimer(app); await app.clickSel('#focus-mode-enter'); await app.waitFor(`window.__littleHours.room.diagnostics().seat.state === 'seated'`, { what: 'the view to settle in the chair', timeout: 30000 }); }, async run() { await new Promise(resolve => setTimeout(resolve, 5000)); } },
  'house-toggle': { about: 'on the house page, close the house and open it again', async setup(app) { await steps.openHouse(app); }, async run(app) { await steps.toggleHouse(app); await steps.toggleHouse(app); } },
};

export const views = {
  'wilds-player': wildsShotView('player'),
  'wilds-grass': wildsShotView('grass'),
  'wilds-meadow': wildsShotView('meadow'),
  'wilds-vista': wildsShotView('vista'),
  'wilds-wind': wildsShotView('wind'),
  'wilds-ranger': wildsShotView('ranger'),
  wilds: { about: 'the Wilds forest and exploration view', settings: { path: '/checks/wilds.html', storageKey: 'little-hours-wilds-check-v1' }, async go(app) { await app.waitFor('window.__littleHours.wilds.ready()', { what: 'the Wilds to render' }); } },
  garden: { about: 'the personal garden, or the whole house on older refs', async go(app) { await steps.openHouse(app); if (await app.visible('#house-open-garden')) await app.clickSel('#house-open-garden'); await app.settle(); } },
  focus: { about: 'the seated Focus view, or the room on older refs', async go(app) {
    const enter = await app.waitFor(`Boolean(document.getElementById('focus-mode-enter'))`, { what: 'the Focus button', timeout: 8000 }).then(() => true, () => false);
    if (!enter) return;
    await steps.openFocus(app);
    if (await app.js(`Boolean(window.__littleHours.room.diagnostics().seat)`)) await app.waitFor(`window.__littleHours.room.diagnostics().seat.state === 'seated'`, { what: 'the view to settle in the chair', timeout: 30000 });
    if (await app.js(`Boolean(window.__littleHours.room.diagnostics().seat?.world?.outdoorScene)`)) await app.waitFor(`window.__littleHours.room.diagnostics().seat.world.outdoor`, { what: 'the outdoor world behind the window', timeout: 30000 });
  } },
  pet: { about: 'your pet care card', async go(app) { await app.clickSel('#pet-button'); await app.settle(); } },
  room: { about: 'the room at rest', async go() {} },
  timer: { about: 'the room with the focus timer sheet open, or the room on older refs', async go(app) { await steps.openTimer(app); await app.settle(); } },
  house: { about: 'the house page, open', async go(app) { await steps.openHouse(app); } },
  'house-closed': { about: 'the house page, closed', async go(app) { await steps.openHouse(app); await steps.toggleHouse(app); } },
  decorate: { about: 'Decorate mode', async go(app) { await steps.openDecorate(app); } },
  avatar: { about: 'the avatar editor', async go(app) { await steps.openAvatar(app); } },
  lake: { about: 'fishing at Willow Pond, idle', async go(app) { await steps.openLake(app); } },
  forest: { about: 'the walk-in forest, at the start of the path', scene: 'forest', async go(app) { await steps.openHouse(app); await app.clickSel('[data-room="forest"]'); await app.waitFor(`Boolean(window.__littleHours.forest.isOpen && window.__littleHours.forest.diagnostics()?.ready)`, { what: 'the forest', timeout: 90000 }); await app.settle(); } },
};
