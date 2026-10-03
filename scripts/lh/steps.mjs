const VALLEY_VIEWS = Object.freeze({
  'wilds-camp': ['the camp clearing, bedroll, pot and merchant', { x: 1, z: 38, facing: -0.67, yaw: -0.67, pitch: 0.28, zoom: 8 }],
  'wilds-vista': ['the view down the valley from the vista rock', { x: 1, z: -39, facing: Math.PI, yaw: 3.12, pitch: 0.12, zoom: 7 }],
  'wilds-lake': ['the lake and the cliffs from the gravel beach on the east shore', { x: 46, z: -196, facing: -1.0, yaw: -1.0, pitch: 0.12, zoom: 6 }],
  'wilds-hero': ['the hero close up at the camp', { x: 2, z: 38, facing: 2.6, yaw: 2.6 + Math.PI, pitch: 0.08, zoom: 2.3 }],
  'wilds-pet': ['the pet beside the hero at the camp', { x: 2, z: 38, facing: 0, yaw: Math.PI * 0.5, pitch: 0.2, zoom: 3.4 }],
  'wilds-ring': ['the ring of stones under the lookout', { x: 8, z: -300, facing: Math.PI, yaw: Math.PI, pitch: 0.18, zoom: 7 }],
  'wilds-stag': ['the Mossheart Stag resting in the ring, from just outside it', { x: 15.45, z: -311.11, facing: -2.54, yaw: -2.04, pitch: 0.1, zoom: 4.2 }],
  'wilds-oak': ['the great oak and its swing on the knoll', { x: 44, z: -132, facing: 2.4, yaw: 2.4, pitch: 0.2, zoom: 7 }],
});

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
  async openWilds(app) { if (!await app.js(`document.body.classList.contains('is-house')`)) await steps.openHouse(app); await app.clickSel('[data-room="forest"]'); await app.waitFor(`window.__littleHours.wilds?.diagnostics()?.phase === 'menu' && !document.documentElement.dataset.placeTransition`, { what: 'the Wilds start card', timeout: 60000 }); },
  async playWilds(app) { await app.clickSel('.wilds [data-wilds="play"]'); await app.waitFor(`window.__littleHours.wilds.diagnostics()?.phase === 'playing'`, { what: 'the Wilds to start' }); },
  async closeAvatar(app) { await app.clickSel('#avatar-done'); await app.waitFor(`!document.body.classList.contains('is-avatar-editing')`, { what: 'leaving the avatar editor' }); await app.settle(); },
};

export const cycles = {
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
  wilds: { about: 'the Wilds valley, playing at the camp spawn', async go(app) { await steps.openWilds(app); await steps.playWilds(app); } },
  ...Object.fromEntries(Object.entries(VALLEY_VIEWS).map(([name, [about, place]]) => [name, { about: `the Wilds: ${about} (--hour sets the time of day)`, async go(app, options = {}) {
    await steps.openWilds(app); await steps.playWilds(app);
    await app.js(`window.__littleHours.wilds.visit(${JSON.stringify({ ...place, ...(options.hour ? { hour: Number(options.hour) } : {}) })})`);
  } }])),
};
