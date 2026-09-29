const backdrop = app => app.js(`(() => {
  const body = getComputedStyle(document.body), stage = document.querySelector('#stage');
  return { sky: body.backgroundImage, ink: getComputedStyle(document.querySelector('#room-title')).color, layer: getComputedStyle(stage, '::before').pointerEvents, overflow: document.documentElement.scrollWidth > innerWidth };
})()`);

export default {
  about: 'theme-aware scenery, legible daylight controls, shared Focus atmosphere and an island that stays spacious on tablets and phones',
  async run(t) {
    const app = await t.open({ seed: 'three-rooms', reducedMotion: true });
    await app.settle();
    const dusk = await backdrop(app);
    t.check('dusk surrounds the miniature with a gradient and non-interactive atmosphere', dusk.sky.includes('gradient') && dusk.layer === 'none' && !dusk.overflow, dusk);
    await app.clickSel('[data-panel="atmosphere"]');
    const skies = [dusk.sky];
    for (const theme of ['day', 'rain']) {
      await app.clickSel(`[data-theme-choice="${theme}"]`); await app.settle();
      const view = await backdrop(app); skies.push(view.sky);
      t.check(`${theme} has its own scenery without horizontal scrolling`, view.sky.includes('gradient') && !view.overflow, view);
      if (theme === 'day') t.check('daylight uses dark, readable heading text', view.ink === 'rgb(70, 83, 75)', view.ink);
    }
    t.check('all three themes use different skies', new Set(skies).size === 3);
    await app.clickSel('[data-theme-choice="day"]'); await app.key('Escape');
    await t.steps.openFocus(app);
    const focus = await app.js(`({ sky: getComputedStyle(document.querySelector('#stage')).backgroundImage, width: document.querySelector('#stage').getBoundingClientRect().width, ink: getComputedStyle(document.querySelector('#focus-mode-timer')).color, viewport: innerWidth })`);
    t.check('Focus mode keeps the chosen daylight scenery and readable timer', focus.sky.includes('rgb(219, 229, 223)') && focus.width === focus.viewport && focus.ink === 'rgb(70, 83, 75)', focus);
    await t.steps.closeFocus(app); await t.close(app);
    for (const width of [1440, 900, 390]) {
      const view = await t.open({ seed: 'three-rooms', width, height: 900, reducedMotion: true, theme: 'day' });
      await t.steps.openHouse(view);
      const layout = await view.js(`(() => { const canvas = document.querySelector('#house-canvas').getBoundingClientRect(), detail = document.querySelector('#house-detail').getBoundingClientRect(), page = document.querySelector('#house-page').getBoundingClientRect(), workspace = document.querySelector('.workspace').getBoundingClientRect(); return { width: canvas.width, available: page.width, workspace: workspace.width, detailHidden: document.querySelector('#house-detail').hidden, overflow: document.documentElement.scrollWidth > innerWidth }; })()`);
      t.check(`${width}px island has room to breathe and no page overflow`, !layout.overflow && layout.available / layout.workspace > .98 && layout.width / layout.available > (width < 1200 ? .92 : .7) && layout.detailHidden, layout);
      await t.steps.houseRooms(view); await view.clickSel('#house-slot-loft');
      t.check(`${width}px room selection remains available`, await view.text('#house-detail h2') === 'Upstairs hideaway');
      await t.shot(view, `island-${width}`); await t.close(view);
    }
  },
};
