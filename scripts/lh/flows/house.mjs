export default {
  about: 'the house page: the dollhouse arrives closed, opens, closes on the toggle, picks a room from the 3D view, and comes back fast',
  async run(t) {
    const { check, steps, sleep } = t;
    let app = await t.open({ seed: 'three-rooms' });
    await app.clickSel('#rooms-button');
    await sleep(250);
    const early = await app.house();
    check('the house arrives closed', !early || early.open < .2, early);
    await app.settle();
    check('then it opens by itself', (await app.house()).open === 1);
    check('the toggle offers to close it', await app.text('[data-house-open]') === 'Close the house' && await app.attr('[data-house-open]', 'aria-pressed') === 'true');
    await steps.toggleHouse(app);
    check('a click closes the house', (await app.house()).open === 0);
    check('the toggle then offers to open it', await app.text('[data-house-open]') === 'Open the house' && await app.attr('[data-house-open]', 'aria-pressed') === 'false');
    await t.shot(app, 'closed');
    await steps.toggleHouse(app);
    check('a second click opens it again', (await app.house()).open === 1);
    await t.shot(app, 'open');
    for (const [id, name] of [['garden', 'Garden wing'], ['loft', 'Upstairs hideaway'], ['studio', 'Your studio']]) {
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
    await app.clickSel('#rooms-button'); await sleep(150);
    const again = await app.house();
    check('coming back keeps the built house', again && again.renderCount >= count && again.builds === builds, `renders ${count} → ${again?.renderCount}, builds ${builds} → ${again?.builds}`);
    check('and it arrives closed again', again && again.open < .2, again);
    await app.settle();
    check('then opens', (await app.house()).open === 1);
    for (const selector of ['#back-to-room', '#rooms-button', '#back-to-room', '#rooms-button']) { await app.clickSel(selector); await sleep(40); }
    await app.settle();
    check('quick back and forth still ends open', (await app.house()).open === 1);
    await t.close(app);

    app = await t.open({ seed: 'one-room', label: 'one room' });
    await app.clickSel('#rooms-button'); await sleep(10); await app.clickSel('#back-to-room'); await sleep(500);
    await app.clickSel('#rooms-button');
    await app.waitFor('window.__littleHours.house.diagnostics()?.open === 1', { timeout: 6000, what: 'the house to open' }).catch(() => {});
    check('leaving before the first build still builds the house later', (await app.house())?.open === 1, await app.house());
    const site = await app.point({ houseRoom: 'garden' });
    check('the unbuilt garden wing shows on screen', site?.visible, site);
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
  },
};
