const active = app => app.js(`JSON.parse(localStorage.getItem('little-hours-v1') || 'null')?.house?.activeId ?? null`);
const travelling = app => app.js(`document.body.classList.contains('is-travelling')`);

async function enter(app, id) {
  await app.clickSel(`#house-slot-${id}`);
  await app.waitFor(`document.querySelector('#enter-house-room') !== null`, { what: 'the Come on in button' });
  await app.clickSel('#enter-house-room');
}

export default {
  about: 'moving between rooms: enter a room from the house page, travel ends, come back, no travel while focusing, reload keeps the room',
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
    const overlay = await app.js(`({ travelling: document.body.classList.contains('is-travelling'), shown: !document.getElementById('room-travel').hidden, label: document.getElementById('travel-label').textContent, house: document.body.classList.contains('is-house') })`);
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
    await app.waitFor(`!document.body.classList.contains('is-house')`, { what: 'the room page' });
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
    await app.waitFor(`!document.body.classList.contains('is-house')`, { what: 'the room page' });
    await app.settle();
    check('after pausing, the same button goes upstairs', await active(app) === 'loft' && await app.text('#room-title') === 'Upstairs hideaway', `${await active(app)} ${await app.text('#room-title')}`);

    await app.reload();
    await app.settle();
    check('a reload keeps you in the room you were in', await active(app) === 'loft' && await app.text('#room-title') === 'Upstairs hideaway', `${await active(app)} ${await app.text('#room-title')}`);
    await t.close(app);
  },
};
