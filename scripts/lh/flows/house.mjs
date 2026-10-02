export default {
  about: 'the house page: the dollhouse arrives closed, opens, closes on the toggle, picks a room from the 3D view, comes back fast, grows a tree per study day, lets you stroll the garden when you are not focusing, and turns freely',
  async run(t) {
    const { check, steps, sleep } = t;
    let app = await t.open({ seed: 'three-rooms' });
    await app.clickSel('#rooms-button');
    await sleep(250);
    const early = await app.house();
    check('the house arrives closed', !early || early.open < .2, early);
    await app.settle();
    check('then it opens by itself', (await app.house()).open === 1);
    const copy = ['.house-address', '.house-scene-caption', '.house-map-hint', '.house-description', '.house-paper-top', '.house-underworld p', '.house-room-link .house-slot-label'];
    const shown = []; for (const selector of copy) if (await app.visible(selector)) shown.push(selector);
    check('the house page shows no decorative copy', shown.length === 0, shown);
    check('the toggle offers to close it', await app.text('[data-house-open]') === 'Close the house' && await app.attr('[data-house-open]', 'aria-pressed') === 'true');
    await steps.toggleHouse(app);
    check('a click closes the house', (await app.house()).open === 0);
    check('the toggle then offers to open it', await app.text('[data-house-open]') === 'Open the house' && await app.attr('[data-house-open]', 'aria-pressed') === 'false');
    await t.shot(app, 'closed');
    await steps.toggleHouse(app);
    check('a second click opens it again', (await app.house()).open === 1);
    await t.shot(app, 'open');
    for (const [id, name] of [['garden', 'Garden wing'], ['loft', 'Upstairs hideaway'], ['studio', 'Ember library']]) {
      const spot = await app.point({ houseRoom: id });
      check(`the ${id} is on screen in the open house`, spot?.visible, spot);
      if (!spot?.visible) continue;
      await app.move(spot.x, spot.y); await sleep(120);
      check(`hovering the ${id} names it`, await app.js(`document.querySelector('#house-canvas canvas').title`) === name);
      await app.click(spot.x, spot.y); await sleep(400);
      check(`clicking the ${id} selects it`, await app.text('#house-detail h2') === name, await app.text('#house-detail h2'));
    }
    const { renderCount: count, builds } = await app.house();
    await steps.backToRoom(app);
    await app.clickSel('#rooms-button');
    await app.waitFor(`document.body.classList.contains('is-house')`, { what: 'the island arrival' });
    const again = await app.house();
    check('coming back keeps the built house', again && again.renderCount >= count && again.builds === builds, `renders ${count} → ${again?.renderCount}, builds ${builds} → ${again?.builds}`);
    check('and it arrives closed again', again && again.open < .2, again);
    await app.settle();
    check('then opens', (await app.house()).open === 1);
    for (const selector of ['#back-to-room', '#rooms-button', '#back-to-room', '#rooms-button']) { await app.clickSel(selector); await app.settle(); }
    await app.settle();
    check('return trips still end open', (await app.house()).open === 1);
    await t.close(app);

    app = await t.open({ seed: 'one-room', reducedMotion: true, label: 'one room, immediate travel' });
    await app.clickSel('#rooms-button'); await sleep(10); await app.clickSel('#back-to-room'); await sleep(500);
    await app.clickSel('#rooms-button');
    await app.waitFor('window.__littleHours.house.diagnostics()?.open === 1', { timeout: 6000, what: 'the house to open' }).catch(() => {});
    check('leaving before the first build still builds the house later', (await app.house())?.open === 1, await app.house());
    await app.waitFor(`window.__littleHours.screenPoint({ houseRoom: 'garden' })?.visible`, { timeout: 10000, what: 'the unbuilt garden wing to render' });
    const site = await app.point({ houseRoom: 'garden' });
    check('the unbuilt garden wing shows on screen', site?.visible, site);
    await t.close(app);

    app = await t.open({ seed: 'garden-days', label: 'garden' });
    await steps.openHouse(app);
    const garden = await app.house();
    check('the garden has one tree per study day, full grown at an hour', garden.trees?.length === 14 && garden.trees[2] === 1 && Math.abs(garden.trees[0] - 10 / 60) < 1e-9, garden.trees);
    check('the garden is named on screen', await app.visible('.house-room-tag.is-garden') && await app.text('.house-room-tag.is-garden') === 'Garden');
    const STROLL = `(() => { const d = window.__littleHours.house.diagnostics(); return { me: d.stroll && [d.stroll.x, d.stroll.z], pet: d.strollPet && [d.strollPet.x, d.strollPet.z], shown: d.scene.getTransformNodeByName('house-stroll')?.isEnabled() ?? null }; })()`;
    const walk = [await app.js(STROLL)];
    for (let i = 0; i < 8; i++) { await sleep(500 * t.slow); walk.push(await app.js(STROLL)); }
    const farthest = key => Math.max(...walk.map(w => Math.hypot(w[key][0] - walk[0][key][0], w[key][1] - walk[0][key][1])));
    check('when you are not focusing, you stroll the garden and your pet follows', walk[0].shown && farthest('me') > .5 && farthest('pet') > .5, { me: farthest('me'), pet: farthest('pet') });
    await steps.backToRoom(app);
    await app.clickSel('#start-button');
    await steps.openHouse(app);
    const focusing = await app.js(STROLL);
    check('while focusing, the stroll stops and you are back at your desk', focusing.shown === false && focusing.me === null, focusing);
    const hinged = await app.js(`window.__littleHours.house.diagnostics().scene.transformNodes.filter(node => node.name.startsWith('house-hinge-')).map(node => node.name.slice(12))`);
    check('only fronts and roof lids open; side walls stay shut', hinged.length > 0 && hinged.every(name => /-(front|lid)$/.test(name)), hinged);
    const box = await app.box('#house-canvas canvas');
    const left = { x: box.x - box.width / 3, y: box.y - 60 }, right = { x: box.x + box.width / 3, y: box.y + 60 };
    await app.drag(left, { x: left.x + 420, y: left.y + 150 }, 24); await app.settle();
    const turned = await app.house();
    check('dragging turns the house well past the old limit and tilts it', turned.angle < .5 && turned.tilt < .9, { angle: turned.angle, tilt: turned.tilt });
    await t.shot(app, 'garden-turned');
    for (let i = 0; i < 2; i++) { await app.drag(right, { x: right.x - 450, y: right.y - 150 }, 24); await app.settle(); }
    const far = await app.house();
    check('the other way it stops at a view that still shows the house', far.angle > 2 && far.angle <= 2.45 + 1e-6 && far.tilt <= 1.3 + 1e-6, { angle: far.angle, tilt: far.tilt });
    await t.shot(app, 'garden-back');
    await app.clickSel('#house-reset-view'); await app.settle();
    const home = await app.house();
    check('the home button puts the camera back', Math.abs(home.angle - Math.PI / 2.8) < .01 && Math.abs(home.tilt - 1.02) < .01, { angle: home.angle, tilt: home.tilt });
    await t.close(app);

    app = await t.open({ seed: 'three-rooms', reducedMotion: true, label: 'reduced motion' });
    await app.clickSel('#rooms-button');
    await app.waitFor('Boolean(window.__littleHours.house.diagnostics())', { what: 'the house' });
    check('reduced motion: the house is open at once', (await app.house()).open === 1);
    await sleep(1500); const c0 = (await app.house()).renderCount; await sleep(1500); const c1 = (await app.house()).renderCount;
    check('reduced motion: nothing keeps drawing', c1 === c0, `${c0} → ${c1}`);
    await app.clickSel('[data-house-open]'); await sleep(150);
    check('reduced motion: closing is instant', (await app.house()).open === 0);
    await t.close(app);

    app = await t.open({ seed: 'three-rooms', width: 390, height: 844, scale: 2, label: 'phone' });
    await steps.openHouse(app);
    const phone = await app.js(`(() => { const c = document.querySelector('#house-canvas').getBoundingClientRect(), t = document.querySelector('[data-house-open]').getBoundingClientRect(); return { canvas: [Math.round(c.width), Math.round(c.height)], toggle: t.width > 0 && t.right <= innerWidth, scroll: document.documentElement.scrollWidth <= innerWidth }; })()`);
    check('phone: the house, the toggle and no sideways scroll', phone.canvas[0] > 300 && phone.canvas[1] > 200 && phone.toggle && phone.scroll, phone);
    check('phone: it opens', (await app.house()).open === 1);
    await t.shot(app, 'phone');
    await t.close(app);

    const RAINING = `window.__littleHours.house.diagnostics().scene.getMeshByName('island-rain')?.isEnabled() ?? null`;
    for (const theme of ['rain', 'day']) {
      app = await t.open({ seed: 'three-rooms', theme, label: `weather ${theme}` });
      await t.steps.openHouse(app);
      check(`${theme}: rain falls on the island only in the rain`, await app.js(RAINING) === (theme === 'rain'));
      if (theme === 'rain') await t.shot(app, 'island-rain');
      await t.close(app);
    }
  },
};
