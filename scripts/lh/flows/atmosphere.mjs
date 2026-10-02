const backdrop = app => app.js(`(() => {
  const body = getComputedStyle(document.body), stage = document.querySelector('#stage');
  return { sky: body.backgroundImage, ink: getComputedStyle(document.querySelector('#room-title')).color, layer: getComputedStyle(stage, '::before').pointerEvents, overflow: document.documentElement.scrollWidth > innerWidth, theme: document.body.dataset.theme, saved: window.__littleHours.state.theme, pressed: document.querySelector('[data-theme-choice][aria-pressed="true"]')?.dataset.themeChoice, panel: document.querySelector('#room-panel')?.dataset.panelKind, menuOpen: document.querySelector('#room-more')?.matches(':popover-open') };
})()`);

export default {
  about: 'theme-aware scenery, legible daylight controls, shared Focus atmosphere and an island that stays spacious on tablets and phones',
  async run(t) {
    const app = await t.open({ seed: 'three-rooms', reducedMotion: true });
    await app.settle();
    const dusk = await backdrop(app);
    t.check('dusk surrounds the miniature with a gradient and non-interactive atmosphere', dusk.sky.includes('gradient') && dusk.layer === 'none' && !dusk.overflow, dusk);
    await t.steps.openMore(app); await app.clickSel('[data-panel="atmosphere"]');
    const skies = [dusk.sky], views = [dusk];
    for (const theme of ['day', 'rain']) {
      await app.clickSel(`[data-theme-choice="${theme}"]`); await app.settle();
      const view = await backdrop(app); skies.push(view.sky); views.push(view);
      t.check(`${theme} has its own scenery without horizontal scrolling`, view.sky.includes('gradient') && !view.overflow, view);
      if (theme === 'day') t.check('daylight keeps the light heading ink on its glass pill', view.ink === 'rgb(243, 234, 225)', view.ink);
    }
    t.check('all three themes use different skies', new Set(skies).size === 3, views);
    await app.clickSel('[data-theme-choice="day"]'); await app.key('Escape');
    await t.steps.openFocus(app);
    const focus = await app.js(`({ sky: getComputedStyle(document.querySelector('#stage')).backgroundImage, width: document.querySelector('#stage').getBoundingClientRect().width, ink: getComputedStyle(document.querySelector('#focus-mode-timer')).color, viewport: innerWidth })`);
    t.check('Focus mode keeps the chosen daylight scenery and readable timer', focus.sky.includes('rgb(219, 229, 223)') && focus.width === focus.viewport && focus.ink === 'rgb(70, 83, 75)', focus);
    await t.steps.closeFocus(app); await t.close(app);
    for (const width of [1440, 900, 390]) {
      const view = await t.open({ seed: 'three-rooms', width, height: 900, reducedMotion: true, theme: 'day' });
      await t.steps.openHouse(view);
      const layout = await view.js(`(() => { const canvas = document.querySelector('#house-canvas').getBoundingClientRect(), detail = document.querySelector('#house-detail').getBoundingClientRect(), page = document.querySelector('#house-page').getBoundingClientRect(), workspace = document.querySelector('.workspace').getBoundingClientRect(); return { width: canvas.width, available: page.width, workspace: workspace.width, detailHidden: document.querySelector('#house-detail').hidden, overflow: document.documentElement.scrollWidth > innerWidth, theme: document.body.dataset.theme, saved: window.__littleHours.state.theme, pressed: document.querySelector('[data-theme-choice][aria-pressed="true"]')?.dataset.themeChoice, panel: document.querySelector('#room-panel')?.dataset.panelKind, menuOpen: document.querySelector('#room-more')?.matches(':popover-open') }; })()`);
      t.check(`${width}px island has room to breathe and no page overflow`, !layout.overflow && layout.available / layout.workspace > .98 && layout.width / layout.available > (width < 1200 ? .92 : .7) && layout.detailHidden, layout);
      await t.steps.houseRooms(view); await view.clickSel('#house-slot-loft');
      t.check(`${width}px room selection remains available`, await view.text('#house-detail h2') === 'Upstairs hideaway');
      await view.clickSel('#close-house-detail');
      t.check(`${width}px daylight has a sun and no moon`, await view.js(`Boolean(document.querySelector('.island-sky [data-celestial="sun"]')) && !document.querySelector('.island-sky [data-celestial="moon"]')`));
      await t.shot(view, `island-day-${width}`);
      await t.steps.backToRoom(view); await t.steps.openMore(view); await view.clickSel('#time-toggle'); await t.steps.openHouse(view);
      const moon = await view.js(`(() => { const sky = document.querySelector('.island-sky'), moon = sky.querySelector('[data-celestial="moon"] path'), box = moon?.getBoundingClientRect(); return { present: Boolean(moon), width: box?.width, left: box?.left, right: box?.right, viewport: innerWidth, pointer: getComputedStyle(sky).pointerEvents, gradient: getComputedStyle(document.body).backgroundImage, count: document.querySelectorAll('.island-sky').length }; })()`);
      t.check(`${width}px night has one non-interactive sky with a legible crescent`, moon.present && moon.width > 36 && moon.left > 0 && moon.right < moon.viewport && moon.pointer === 'none' && moon.count === 1 && moon.gradient.includes('37, 43, 80'), moon);
      await t.shot(view, `island-night-${width}`);
      await view.clickSel('#house-open-garden'); await view.settle();
      t.check(`${width}px the garden retains its own atmosphere`, await view.js(`document.querySelector('.island-sky').hidden && getComputedStyle(document.querySelector('.house-world')).backgroundImage.includes('189, 205, 182')`));
      await view.clickSel('#garden-back'); await view.settle();
      t.check(`${width}px moon returns when leaving the garden`, await view.visible('.island-sky [data-celestial="moon"]'));
      await t.steps.backToRoom(view);
      t.check(`${width}px returning home restores the room sky`, (await backdrop(view)).sky === dusk.sky);
      if (width === 390) {
        await t.steps.openMore(view); await view.clickSel('[data-panel="atmosphere"]'); await view.clickSel('[data-theme-choice="rain"]'); await view.key('Escape');
        await t.steps.openHouse(view);
        t.check('rain obscures the moon and uses its own island sky', await view.js(`!document.querySelector('.island-sky [data-celestial]') && getComputedStyle(document.body).backgroundImage.includes('52, 78, 104')`));
        await t.shot(view, 'island-rain-390');
      }
      await t.close(view);
    }
  },
};
