const active = app => app.js(`JSON.parse(localStorage.getItem('little-hours-v1') || 'null')?.house?.activeId ?? null`);
const travelling = app => app.js(`document.body.classList.contains('is-travelling')`);

async function enter(app, id, steps) {
  await steps.houseRooms(app); await app.clickSel(`#house-slot-${id}`);
  await app.waitFor(`document.querySelector('#enter-house-room') !== null`, { what: 'the Come on in button' });
  await app.clickSel('#enter-house-room');
}

export default {
  about: 'house-page travel between rooms, focus refusal, reload, and a personal room name that persists',
  async run(t) {
    const { check, steps } = t;
    const app = await t.open({ seed: 'three-rooms' });
    const studioTitle = await app.text('#room-title');
    check('the room starts in the studio', await active(app) === 'studio', await active(app));
    await steps.openHouse(app);
    await steps.houseRooms(app); await app.clickSel('#house-slot-garden');
    await app.waitFor(`document.querySelector('#house-detail h2')?.textContent === 'Garden wing'`, { what: 'the garden wing details' });
    check('picking the garden wing offers entry', (await app.text('#enter-house-room'))?.startsWith('Enter room'), await app.text('#enter-house-room'));
    await app.clickSel('#enter-house-room');
    await app.waitFor(`document.documentElement.dataset.placeTransition === 'home'`, { what: 'the room entry to begin' }).catch(() => null);
    check('room entry fades through the shared travel layer', await app.js(`document.documentElement.dataset.placeTransition === 'home' && Boolean(document.querySelector('.place-transition'))`));
    await app.settle();
    check('the travel card goes away on arrival', !await travelling(app) && await app.js(`document.getElementById('room-travel').hidden`));
    check('the garden wing is now the active room', await active(app) === 'garden' && await app.text('#room-title') === 'Garden wing', `${await active(app)} ${await app.text('#room-title')}`);
    await t.shot(app, 'garden');

    await steps.openHouse(app);
    check('the island returns with room details tucked away', !await app.visible('#house-detail'));
    await steps.backToRoom(app);
    check('Back to room stays in the same room', await active(app) === 'garden' && await app.text('#room-title') === 'Garden wing');

    await steps.openHouse(app);
    await enter(app, 'studio', steps);
    await app.waitFor(`!document.body.classList.contains('is-house')`, { what: 'the room page', timeout: 20000 });
    await app.settle();
    check('going back to the studio works the same way', await active(app) === 'studio' && await app.text('#room-title') === studioTitle && !await travelling(app), `${await active(app)} ${await app.text('#room-title')}`);

    await app.clickSel('#start-button');
    await app.waitFor(`document.body.classList.contains('is-focusing')`, { what: 'the focus session' });
    await steps.openHouse(app);
    await enter(app, 'loft', steps);
    await app.waitFor(`!document.getElementById('toast').hidden`, { what: 'the refusal message' });
    check('while focusing, entering another room is refused with a message', await app.text('#toast') === 'Pause your focus session before walking to another room.', await app.text('#toast'));
    check('and you stay where you are', await active(app) === 'studio' && !await travelling(app) && await app.js(`document.body.classList.contains('is-house')`));
    await steps.backToRoom(app);
    await app.clickSel('#start-button');
    await app.waitFor(`!document.body.classList.contains('is-focusing')`, { what: 'the pause' });
    await steps.openHouse(app);
    await enter(app, 'loft', steps);
    await app.waitFor(`!document.body.classList.contains('is-house')`, { what: 'the room page', timeout: 20000 });
    await app.settle();
    check('after pausing, the same button goes upstairs', await active(app) === 'loft' && await app.text('#room-title') === 'Upstairs hideaway', `${await active(app)} ${await app.text('#room-title')}`);

    await app.reload();
    await app.settle();
    check('a reload keeps you in the room you were in', await active(app) === 'loft' && await app.text('#room-title') === 'Upstairs hideaway', `${await active(app)} ${await app.text('#room-title')}`);

    await steps.openHouse(app);
    await enter(app, 'studio', steps);
    await app.waitFor(`!document.body.classList.contains('is-house')`, { what: 'the room page', timeout: 20000 });
    await app.settle();
    await app.clickSel('#rename-room');
    await app.send('Input.insertText', { text: 'Our Sunday corner ♡' });
    await app.clickSel('#save-room-title');
    await app.waitFor(`document.querySelector('#room-title').textContent === 'Our Sunday corner ♡'`, { what: 'the room name to save' }).catch(() => null);
    check('the inline name is saved in the heading', await app.text('#room-title') === 'Our Sunday corner ♡' && (await app.saved()).house.rooms[0].name === 'Our Sunday corner ♡');
    await steps.openHouse(app);
    await steps.houseRooms(app);
    check('the house room list uses the new name', (await app.text('#house-slot-studio')).includes('Our Sunday corner ♡'), await app.text('#house-slot-studio'));
    await steps.backToRoom(app);
    await app.reload();
    check('the renamed room stays named after reloading', (await app.saved()).house.rooms[0].name === 'Our Sunday corner ♡' && await app.text('#room-title') === 'Our Sunday corner ♡');
    await t.close(app);
  },
};
