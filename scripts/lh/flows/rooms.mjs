const active = app => app.js(`JSON.parse(localStorage.getItem('little-hours-v1') || 'null')?.house?.activeId ?? null`);
const travelling = app => app.js(`document.body.classList.contains('is-travelling')`);

async function chooseRoom(app, id, t) {
  const probe = `(() => { const d = window.__littleHours.room.diagnostics(), hinge = d.scene.getTransformNodeByName('door-hinge-${id}'); return { active: window.__littleHours.state.house.activeId, walking: document.body.classList.contains('is-door-walking'), travelling: document.body.classList.contains('is-travelling'), house: document.body.classList.contains('is-house'), x: d.companion.x, z: d.companion.z, open: hinge ? -hinge.rotation.y : 0 }; })()`;
  const start = await app.js(probe), end = Date.now() + 25000 * t.slow;
  let moved = 0, walked = false, doorOpen = 0, last = start;
  await t.steps.openRoomPicker(app);
  await app.clickSel(`[data-house-go="${id}"]`);
  while (Date.now() < end) {
    last = await app.js(probe);
    walked ||= last.walking;
    if (last.walking) moved = Math.max(moved, Math.hypot(last.x - start.x, last.z - start.z));
    if (last.walking) doorOpen = Math.max(doorOpen, last.open);
    if (!last.travelling && (last.active === id || last.house)) break;
    await t.sleep(40 / t.slow);
  }
  return { walked, moved, doorOpen, ...last };
}

async function enter(app, id) {
  await app.clickSel(`#house-slot-${id}`);
  await app.waitFor(`document.querySelector('#enter-house-room') !== null`, { what: 'the Come on in button' });
  await app.clickSel('#enter-house-room');
}

export default {
  about: 'personal room names and the room picker, quick travel from whole-house and mini views, focus refusal, house-page travel and reload',
  async run(t) {
    const { check, steps } = t;
    const app = await t.open({ seed: 'three-rooms' });
    const studioTitle = await app.text('#room-title');
    check('the room starts in the studio', await active(app) === 'studio' && await app.attr('[data-house-go="studio"]', 'aria-current') === 'location', await active(app));
    await steps.openHouse(app);
    await app.clickSel('#house-slot-garden');
    await app.waitFor(`document.querySelector('#house-detail h2')?.textContent === 'Garden wing'`, { what: 'the garden wing details' });
    check('picking the garden wing offers Come on in', (await app.text('#enter-house-room'))?.startsWith('Come on in'), await app.text('#enter-house-room'));
    await app.clickSel('#enter-house-room');
    const overlay = await app.waitFor(`document.body.classList.contains('is-travelling') && ({ travelling: true, shown: !document.getElementById('room-travel').hidden, label: document.getElementById('travel-label').textContent, house: document.body.classList.contains('is-house') })`, { what: 'the house-page trip to start' });
    check('Come on in leaves the house page and shows the travel card', overlay.travelling && overlay.shown && overlay.label === 'On to Garden wing' && !overlay.house, overlay);
    await app.settle();
    check('the travel card goes away on arrival', !await travelling(app) && await app.js(`document.getElementById('room-travel').hidden`));
    check('the garden wing is now the active room', await active(app) === 'garden' && await app.text('#room-title') === 'Garden wing', `${await active(app)} ${await app.text('#room-title')}`);
    check('the room bar marks the garden wing as here', await app.attr('[data-house-go="garden"]', 'aria-current') === 'location' && await app.attr('[data-house-go="studio"]', 'aria-current') === 'false');
    await t.shot(app, 'garden');

    await steps.openHouse(app);
    check('the house page opens on the room you are in', await app.text('#house-detail h2') === 'Garden wing', await app.text('#house-detail h2'));
    await steps.backToRoom(app);
    check('Back to room stays in the same room', await active(app) === 'garden' && await app.text('#room-title') === 'Garden wing');

    await steps.openHouse(app);
    await enter(app, 'studio');
    await app.waitFor(`!document.body.classList.contains('is-house')`, { what: 'the room page', timeout: 20000 });
    await app.settle();
    check('going back to the studio works the same way', await active(app) === 'studio' && await app.text('#room-title') === studioTitle && !await travelling(app), `${await active(app)} ${await app.text('#room-title')}`);

    await app.clickSel('#start-button');
    await app.waitFor(`document.body.classList.contains('is-focusing')`, { what: 'the focus session' });
    await steps.openHouse(app);
    await enter(app, 'loft');
    await app.waitFor(`!document.getElementById('toast').hidden`, { what: 'the refusal message' });
    check('while focusing, entering another room is refused with a message', await app.text('#toast') === 'Pause your focus session before walking to another room.', await app.text('#toast'));
    check('and you stay where you are', await active(app) === 'studio' && !await travelling(app) && await app.js(`document.body.classList.contains('is-house')`));
    await steps.backToRoom(app);
    await app.clickSel('#start-button');
    await app.waitFor(`!document.body.classList.contains('is-focusing')`, { what: 'the pause' });
    await steps.openHouse(app);
    await enter(app, 'loft');
    await app.waitFor(`!document.body.classList.contains('is-house')`, { what: 'the room page', timeout: 20000 });
    await app.settle();
    check('after pausing, the same button goes upstairs', await active(app) === 'loft' && await app.text('#room-title') === 'Upstairs hideaway', `${await active(app)} ${await app.text('#room-title')}`);

    await app.reload();
    await app.settle();
    check('a reload keeps you in the room you were in', await active(app) === 'loft' && await app.text('#room-title') === 'Upstairs hideaway', `${await active(app)} ${await app.text('#room-title')}`);

    let walk = await chooseRoom(app, 'studio', t);
    check('a room card arrives without waiting for a door walk', !walk.walked && walk.active === 'studio' && !walk.travelling, walk);
    check('arrival moves keyboard focus to the room heading', await app.js(`document.activeElement.id === 'room-title'`));
    await app.clickSel('#rename-room');
    await app.send('Input.insertText', { text: 'Our Sunday corner ♡' });
    await app.clickSel('#save-room-title');
    check('the inline name is saved and shown on its room card', await app.text('#room-title') === 'Our Sunday corner ♡' && (await app.text('[data-house-go="studio"]')).includes('Our Sunday corner ♡') && (await app.saved()).house.rooms[0].name === 'Our Sunday corner ♡');
    await steps.openRoomPicker(app);
    await t.shot(app, 'personal-room-cards');
    await app.key('Escape');
    await app.clickSel('.home-wide');
    await app.waitFor(`document.body.classList.contains('is-connected')`, { what: 'whole-house view' });
    walk = await chooseRoom(app, 'garden', t);
    check('a room card leaves whole-house view and goes straight there', !walk.walked && walk.active === 'garden' && !await app.js(`document.body.classList.contains('is-connected')`), walk);
    await app.clickSel('#mini-button');
    walk = await chooseRoom(app, 'loft', t);
    check('choosing a room from mini view restores the room and goes upstairs', !walk.walked && walk.active === 'loft' && !await app.js(`document.getElementById('stage').classList.contains('is-mini')`), walk);
    await steps.openDecorate(app);
    walk = await chooseRoom(app, 'garden', t);
    check('room cards leave decorating and arrive at the destination', !walk.walked && walk.active === 'garden' && !await app.js(`document.body.classList.contains('is-decorating')`), walk);
    await app.reload();
    check('the renamed room stays named after traveling and reloading', (await app.saved()).house.rooms[0].name === 'Our Sunday corner ♡' && (await app.text('[data-house-go="studio"]')).includes('Our Sunday corner ♡'));
    await t.close(app);

    const growing = await t.open({ seed: 'one-room' });
    walk = await chooseRoom(growing, 'garden', t);
    check('the next-room button opens its plan without a walk', !walk.walked && walk.house && await growing.text('#house-detail h2') === 'Greenhouse' && !walk.travelling, walk);
    await t.close(growing);
  },
};
