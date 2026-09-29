const PIP = `window.__littleHours.room.buddyState()`;
const LINE = who => `(() => { const b = document.querySelector('.speech-bubble[data-speaker="${who}"]'); return window.__littleHours.speech.showing('${who}') && b ? b.textContent.trim() : null; })()`;
const APART = `(() => { const room = window.__littleHours.room, b = room.anchor('buddy'), pip = b && { x: b.x, y: b.y }, a = room.anchor('avatar'); return pip && a ? Math.round(Math.hypot(pip.x - a.x, pip.y - a.y)) : null; })()`;
const SAVED = `JSON.parse(localStorage.getItem('little-hours-v1')).buddy`;

export default {
  about: 'the buddy: Pip is a 3D sprite in the room beside the avatar, stays with it as the camera turns, goes about the room on its own with no clicking, twirls off exploring while a session runs, swoops back holding a find, the Pip tool opens the find card and the collection, and a new name and colour survive a reload',
  async run(t) {
    const { check, sleep, steps } = t;
    const app = await t.open({ seed: 'buddy-finish' });
    await app.settle();
    await app.waitFor(`${PIP}.mode === 'here' && ${PIP}.visible`, { what: 'Pip in the room', timeout: 5000 });
    const apart = await app.js(APART);
    check('Pip floats in the room right beside the avatar', apart !== null && apart < 140, apart);
    check('Pip is part of the scene, with no button to click', await app.js(`document.querySelector('#buddy-button, .buddy') === null && window.__littleHours.room.diagnostics().scene.getMeshByName('buddy-body')?.isEnabled() === true`));
    check('the room tools name the buddy', await app.text('#buddy-tool-label') === 'Pip');

    const before = await app.js(`window.__littleHours.room.diagnostics().camera.alpha`);
    const canvas = await app.js(`(() => { const r = document.querySelector('#room-canvas').getBoundingClientRect(); return { x: r.left + r.width * .3, y: r.top + r.height * .75 }; })()`);
    await app.drag(canvas, { x: canvas.x + 260, y: canvas.y }, 16);
    await sleep(900);
    const turned = Math.abs(await app.js(`window.__littleHours.room.diagnostics().camera.alpha`) - before), still = await app.js(APART);
    check('when the room turns, Pip stays with the avatar', turned > 0.2 && still !== null && still < 160, { turned, still });
    await t.shot(app, 'turned');

    const plan = await app.waitFor(`${PIP}.plan`, { what: 'Pip to choose something to do', timeout: 9000 }).catch(() => null);
    const doing = plan && await app.waitFor(`${PIP}.arrived && ${PIP}.activity`, { what: 'Pip to get there and do it', timeout: 8000 }).catch(() => null);
    check('on its own, Pip picks something to do and goes to do it', Boolean(plan && doing), { plan, doing });
    await t.shot(app, 'busy');

    await app.clickSel('#start-button');
    const leaving = await app.waitFor(LINE('buddy'), { what: 'the goodbye line', timeout: 3000 }).catch(() => null);
    const toolAway = await app.attr('#buddy-tool', 'data-buddy') === 'away';
    const twirl = await app.waitFor(`${PIP}.mode === 'leaving'`, { what: 'Pip to take off', timeout: 3000 }).catch(() => false);
    await sleep(700);
    await t.shot(app, 'leaving');
    const gone = await app.waitFor(`${PIP}.mode === 'away' && !${PIP}.visible`, { what: 'Pip to fly out', timeout: 6000 }).catch(() => false);
    check('starting a session, Pip says goodbye, twirls and flies out', Boolean(leaving && twirl && gone && toolAway), { leaving, twirl, gone, toolAway });

    await app.waitFor(`document.querySelector('#session-celebration').open`, { what: 'the session to finish', timeout: 20000 });
    const saved = await app.js(SAVED);
    check('the finished session records one unopened find', saved.log.length === 1 && saved.log[0].opened === false && saved.minutes === 115, saved);
    check('the room tools show a find is waiting', await app.attr('#buddy-tool', 'data-buddy') === 'back');
    check('Pip waits for the celebration to close before coming home', await app.js(`${PIP}.mode`) === 'away');
    await app.clickSel('#session-celebration .start-button');
    const arriving = await app.waitFor(`${PIP}.mode === 'arriving'`, { what: 'Pip to swoop in', timeout: 3000 }).catch(() => false);
    await sleep(900);
    await t.shot(app, 'arriving');
    const back = await app.waitFor(LINE('buddy'), { what: 'the found-something line', timeout: 6000 }).catch(() => null);
    const holding = await app.js(`${PIP}.holding && ${PIP}.mode === 'here'`);
    const reply = await app.waitFor(LINE('avatar'), { what: 'the avatar to answer', timeout: 4000 }).catch(() => null);
    check('Pip swoops back in holding the find, says so, and the avatar answers', Boolean(arriving && holding && /found|brought/i.test(back || '') && reply), { arriving, holding, back, reply });
    await t.shot(app, 'back');

    await app.clickSel('#buddy-tool');
    await app.waitFor(`document.querySelector('#buddy-card').open`, { what: 'the find card', timeout: 4000 });
    const title = await app.text('#buddy-card-title'), story = await app.text('.buddy-card-story');
    check('the Pip tool opens the find card, which names the find and tells the story', title.length > 2 && story.startsWith('Pip wandered to') && story.toLowerCase().includes(title.toLowerCase()), { title, story });
    check('opening it marks the find opened and Pip puts it down', (await app.js(SAVED)).log[0].opened === true && await app.js(`${PIP}.holding`) === false);
    await t.shot(app, 'card');

    await app.clickSel('#buddy-card-collection');
    await app.waitFor(`document.querySelector('#buddy-album').open`, { what: 'the collection', timeout: 4000 });
    check('the collection counts the new find', /^1 of 20 found/.test(await app.text('.buddy-album header p:not(.buddy-album-eyebrow)')));
    check('the find shows by name and the rest are silhouettes', await app.js(`[...document.querySelectorAll('.buddy-find:not(.is-unfound) strong')].map(e => e.textContent).join()`) === title && await app.js(`document.querySelectorAll('.buddy-find.is-unfound').length`) === 19);

    const drawn = await app.waitFor(`document.querySelector('#buddy-closeup canvas')?.width > 0 && window.__littleHours.buddyCloseup?.().frames > 2`, { what: 'the 3D Pip in the album', timeout: 4000 }).catch(() => false);
    check('the album shows Pip as a live 3D model', Boolean(drawn));
    await app.clickSel('#buddy-album [data-color="mint"]');
    await app.waitFor(`${SAVED}.color === 'mint'`, { what: 'the colour to save', timeout: 3000 });
    check('picking a colour makes the album Pip twirl', await app.waitFor(`window.__littleHours.buddyCloseup?.().twirling`, { what: 'the album Pip to twirl', timeout: 1500 }).catch(() => false));
    await app.clickSel('#buddy-name');
    await app.js(`document.querySelector('#buddy-name').select()`);
    for (const letter of 'Bean') await app.key(letter);
    await app.clickSel('.buddy-name-form button');
    await app.waitFor(`${SAVED}.name === 'Bean'`, { what: 'the name to save', timeout: 3000 });
    check('a new name and colour save', true);
    await t.shot(app, 'album');
    await app.key('Escape');
    await sleep(300);

    const FADE = `window.__littleHours.room.diagnostics().scene.getMeshByName('buddy-body').visibility`;
    await app.js(`window.__littleHours.room.buddyDo({ kind: 'spot', target: 'head', offset: [0, -0.3], pose: 'hover', seconds: 6 })`);
    const ghosted = await app.waitFor(`${FADE} < 0.5`, { what: 'Pip to fade inside the avatar', timeout: 4000 }).catch(() => false);
    await app.js(`window.__littleHours.room.buddyDo({ kind: 'shoulder', target: 'head', offset: [0.34, 0.06], pose: 'hover', seconds: 6 })`);
    const solid = await app.waitFor(`${FADE} === 1`, { what: 'Pip to turn solid again beside the avatar', timeout: 4000 }).catch(() => false);
    check('Pip passes through the avatar as a see-through ghost', Boolean(ghosted && solid), { ghosted, solid });

    await steps.openDecorate(app);
    const hidden = await app.waitFor(`!${PIP}.visible`, { what: 'Pip to step aside', timeout: 3000 }).catch(() => false);
    await steps.closeDecorate(app);
    const shown = await app.waitFor(`${PIP}.visible`, { what: 'Pip to come back', timeout: 3000 }).catch(() => false);
    check('Pip steps out of the way while decorating', Boolean(hidden && shown));

    await app.reload();
    await app.settle();
    check('after a reload Bean keeps the name, colour and find', await app.text('#buddy-tool-label') === 'Bean' && (await app.js(SAVED)).color === 'mint' && Object.keys((await app.js(SAVED)).finds).length === 1);
  },
};
