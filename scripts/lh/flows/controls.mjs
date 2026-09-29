const itemOf = (room, id) => room.layout.items.find(item => item.id === id) || null;
const where = item => item && `${item.x},${item.z}`;

export default {
  about: 'the room controls: ambience, quality, sound, mini view, the focus toggle, Start over, the skip link and arrow keys in Decorate',
  async run(t) {
    const { check, steps, sleep } = t;
    const app = await t.open({ seed: 'three-rooms' });
    await app.settle();
    const copy = ['.brand-tagline', '.room-subtitle', '.focus-intro', '.timer-caption', '.daily-note'];
    const shown = []; for (const selector of copy) if (await app.visible(selector)) shown.push(selector);
    check('the room page shows no decorative copy', shown.length === 0, shown);

    check('room activities stay in the room without a Little moments menu', await app.js(`!document.querySelector('.little-moments') && !document.querySelector('#room-canvas').getAttribute('aria-label').includes('Little moments')`));
    const tea = (await app.room()).layout.items.find(item => item.type === 'side-table');
    const teaPoint = await app.point({ item: tea.id });
    check('the tea table is visible and tappable', teaPoint?.visible);
    await app.click(teaPoint.x, teaPoint.y);
    await app.waitFor(`window.__littleHours.room.diagnostics().companion.requestedItemId === ${JSON.stringify(tea.id)}`, { what: 'a tap inviting the avatar for tea' });
    check('tapping furniture still starts the companion interaction', await app.js(`window.__littleHours.room.diagnostics().companion.requestedItemId === ${JSON.stringify(tea.id)}`));

    await app.clickSel('[data-panel="atmosphere"]');
    await app.waitFor(`document.querySelectorAll('[data-theme-choice]').length === 3`, { what: 'the ambience panel' });
    await app.clickSel('[data-theme-choice="rain"]');
    await app.waitFor(`document.body.dataset.theme === 'rain'`, { what: 'the rain theme' });
    check('Ambience switches the room to rain', await app.attr('[data-theme-choice="rain"]', 'aria-pressed') === 'true' && (await app.saved()).theme === 'rain');
    check('the header toggle follows the theme', /Rain/.test(await app.text('#time-toggle')));
    const lights = (await app.saved()).decor.lights;
    await app.settle();
    await app.clickSel('.fairy-lights input');
    check('the lights switch saves', await app.waitFor(`JSON.parse(localStorage.getItem('little-hours-v1')).decor.lights === ${!lights}`, { what: 'the lights to save' }).catch(() => false));
    await app.key('Escape');
    await app.waitFor(`document.getElementById('room-panel').hidden`, { what: 'Escape to close the panel' });
    check('Escape closes the panel and returns focus to its button', await app.js(`document.activeElement?.dataset.panel === 'atmosphere'`));

    await t.steps.openMore(app); await app.clickSel('[data-panel="performance"]');
    await app.waitFor(`document.querySelectorAll('[data-quality]').length === 3`, { what: 'the quality panel' });
    const metrics = await app.waitFor(`document.querySelector('#performance-metrics')?.children.length || 0`, { what: 'live measurements', timeout: 8000 }).catch(() => 0);
    check('the quality panel shows live measurements', metrics === 6, metrics);
    await app.clickSel('[data-quality="battery"]');
    await app.settle();
    check('Save energy sets the room quality', (await app.room()).quality === 'battery' && await app.attr('[data-quality="battery"]', 'aria-pressed') === 'true', (await app.room()).quality);
    await app.clickSel('#close-panel');

    await app.clickSel('#focus-options > summary'); await app.clickSel('#sound-button');
    await sleep(500);
    const sound = { pressed: await app.attr('#sound-button', 'aria-pressed'), toast: await app.text('#toast') };
    check('the rain button turns sound on, or says audio is missing', (sound.pressed === 'true' && !await app.js(`document.getElementById('volume').disabled`)) || /Audio isn’t available/.test(sound.toast || ''), sound);

    await t.steps.openMore(app); await app.clickSel('#mini-button');
    check('Mini view shrinks the room', await app.js(`document.getElementById('stage').classList.contains('is-mini')`) && await app.text('#mini-button span') === 'Full room');
    await steps.openAvatar(app);
    check('opening the avatar editor leaves the mini view', !await app.js(`document.getElementById('stage').classList.contains('is-mini')`) && await app.text('#mini-button span') === 'Mini view');
    await steps.closeAvatar(app);

    await app.clickSel('#focus-toggle');
    check('the focus toggle hides the timer card', !await app.visible('#focus-card') && await app.attr('#focus-toggle', 'aria-expanded') === 'false');
    await app.clickSel('#focus-toggle');
    check('and shows it again', await app.visible('#focus-card') && await app.attr('#focus-toggle', 'aria-expanded') === 'true');

    await app.clickSel('#start-button');
    await sleep(1600);
    await app.clickSel('#start-button');
    check('a paused session offers Start over', await app.visible('#reset-session'));
    await app.clickSel('#reset-session');
    check('Start over resets to 25:00 and keeps focus on the timer', await app.text('#timer') === '25:00' && !await app.visible('#reset-session') && await app.js(`document.activeElement?.id === 'start-button'`), await app.text('#timer'));

    await steps.openHouse(app);
    await app.js(`document.querySelector('.skip-link').focus()`);
    await app.key('Enter');
    await app.waitFor(`!document.body.classList.contains('is-house')`, { what: 'the skip link to leave the house page' });
    check('the skip link leaves the house page and focuses the timer', await app.js(`document.activeElement?.id === 'start-button'`) && await app.visible('#focus-card'));
    await app.settle();

    await steps.openDecorate(app);
    const start = await app.room();
    let moved = null;
    for (const item of start.layout.items) {
      const spot = await app.point({ item: item.id });
      if (!spot?.visible) continue;
      await app.click(spot.x, spot.y); await app.settle();
      if ((await app.room()).selectedId !== item.id) continue;
      for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp']) {
        await app.key(key); await app.settle();
        const now = itemOf(await app.room(), item.id);
        if (where(now) !== where(item)) { moved = { id: item.id, key, from: where(item), to: where(now) }; break; }
      }
      if (moved) break;
    }
    check('an arrow key moves the selected piece', Boolean(moved), moved);
    check('the arrow move can be undone', !await app.js(`document.getElementById('undo-layout').disabled`));
    await app.key('Escape'); await app.settle();
    check('Escape deselects the piece', (await app.room()).selectedId === null);
    await steps.closeDecorate(app);
  },
};
