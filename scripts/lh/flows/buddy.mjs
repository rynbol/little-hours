const MODE = `document.querySelector('.buddy')?.dataset.mode ?? null`;
const BUBBLE = `(() => { const b = document.querySelector('#buddy-bubble'); return b && !b.hidden ? b.textContent.trim() : null; })()`;
const NEAR = `(() => { const room = window.__littleHours.room; const head = room?.anchor('buddy'); const box = document.querySelector('#buddy-button').getBoundingClientRect(), canvas = document.querySelector('#room-canvas').getBoundingClientRect(); return head && { dx: Math.round(box.left + box.width / 2 - canvas.left - head.x), dy: Math.round(box.top + box.height / 2 - canvas.top - head.y) }; })()`;
const SAVED = `JSON.parse(localStorage.getItem('little-hours-v1')).buddy`;

export default {
  about: 'the buddy: Pip floats beside the avatar and follows it, hops and talks when poked, heads out exploring while a session runs, comes back holding a find, the find card and the collection show it, and a new name and colour survive a reload',
  async run(t) {
    const { check, sleep } = t;
    const app = await t.open({ seed: 'buddy-finish' });
    await app.settle();
    check('Pip floats awake beside the avatar', await app.js(MODE) === 'idle' && await app.visible('#buddy-button'), await app.js(MODE));
    const beside = await app.js(NEAR);
    check('Pip sits just beside the avatar\'s head', beside && beside.dx > 0 && beside.dx < 80 && Math.abs(beside.dy) < 60, beside);
    check('the room tools name the buddy', await app.text('#buddy-tool-label') === 'Pip');

    await app.clickSel('#buddy-button');
    const hopped = await app.waitFor(`document.querySelector('.buddy').classList.contains('do-hop')`, { what: 'the poke hop', timeout: 2000 }).catch(() => false);
    const said = await app.waitFor(BUBBLE, { what: 'a poke reply', timeout: 2000 }).catch(() => null);
    check('a poke makes Pip hop and say something', Boolean(hopped && said), { hopped, said });
    await t.shot(app, 'poke');

    await app.clickSel('#start-button');
    await app.waitFor(`${MODE} === 'away'`, { what: 'Pip to head out', timeout: 5000 });
    const gone = await app.waitFor(`getComputedStyle(document.querySelector('.buddy-float')).opacity === '0'`, { what: 'Pip to fly off', timeout: 3000 }).catch(() => false);
    check('while the session runs Pip flies off exploring', Boolean(gone) && /exploring/.test(await app.attr('#buddy-button', 'aria-label')) && await app.attr('#buddy-tool', 'data-buddy') === 'away');

    await app.waitFor(`document.querySelector('#session-celebration').open`, { what: 'the session to finish', timeout: 20000 });
    const saved = await app.js(SAVED);
    check('the finished session records one unopened find', saved.log.length === 1 && saved.log[0].opened === false && saved.minutes === 115, saved);
    check('the room tools show a find is waiting', await app.attr('#buddy-tool', 'data-buddy') === 'back');
    check('Pip comes back holding the find', await app.js(MODE) === 'back' && await app.js(`document.querySelectorAll('.buddy-held .find-art').length`) === 1);
    await app.clickSel('#session-celebration .start-button');
    const back = await app.waitFor(BUBBLE, { what: 'the return line', timeout: 4000 }).catch(() => null);
    check('after the celebration Pip says it found something', /found|brought/i.test(back || ''), back);
    await t.shot(app, 'back');

    await app.clickSel('#buddy-button');
    await app.waitFor(`document.querySelector('#buddy-card').open`, { what: 'the find card', timeout: 4000 });
    const title = await app.text('#buddy-card-title'), story = await app.text('.buddy-card-story');
    check('the find card names the find and tells the story', title.length > 2 && story.startsWith('Pip wandered to') && story.toLowerCase().includes(title.toLowerCase()), { title, story });
    check('opening it marks the find opened and Pip is free again', (await app.js(SAVED)).log[0].opened === true && await app.js(MODE) === 'idle');
    await t.shot(app, 'card');

    await app.clickSel('#buddy-card-collection');
    await app.waitFor(`document.querySelector('#buddy-album').open`, { what: 'the collection', timeout: 4000 });
    check('the collection counts the new find', /^1 of 20 found/.test(await app.text('.buddy-album header p:not(.buddy-album-eyebrow)')));
    check('the find shows by name and the rest are silhouettes', await app.js(`[...document.querySelectorAll('.buddy-find:not(.is-unfound) strong')].map(e => e.textContent).join()`) === title && await app.js(`document.querySelectorAll('.buddy-find.is-unfound').length`) === 19);

    await app.clickSel('#buddy-album [data-color="mint"]');
    await app.waitFor(`${SAVED}.color === 'mint'`, { what: 'the colour to save', timeout: 3000 });
    await app.clickSel('#buddy-name');
    await app.js(`document.querySelector('#buddy-name').select()`);
    for (const letter of 'Bean') await app.key(letter);
    await app.clickSel('.buddy-name-form button');
    await app.waitFor(`${SAVED}.name === 'Bean'`, { what: 'the name to save', timeout: 3000 });
    check('a new name and colour save', true);
    await t.shot(app, 'album');
    await app.key('Escape');
    await sleep(300);

    await app.reload();
    await app.settle();
    check('after a reload Bean keeps the name, colour and find', await app.text('#buddy-tool-label') === 'Bean' && await app.js(`getComputedStyle(document.querySelector('.buddy')).getPropertyValue('--buddy-body').trim()`) === '#bfe6cf' && Object.keys((await app.js(SAVED)).finds).length === 1);
  },
};
