export default {
  about: 'plant a seed, choose study growth, buy another, keep replaced plants, and visit a mature garden on desktop and phone',
  async run(t) {
    const { check, sleep } = t;
    const app = await t.open({ seed: 'one-room-rich' });
    await app.clickSel('#focus-garden'); await app.settle();
    check('the focus invitation opens the garden', await app.text('#house-detail h2') === 'Your garden');
    await app.clickSel('#seed-moonflower'); await sleep(400); await t.shot(app, 'seeds');
    await app.clickSel('#garden-plant-seed');
    let saved = await app.saved();
    check('the first seed is free and planted in spot one', saved.garden.plants[0]?.species === 'moonflower' && saved.garden.plants[0]?.slot === 0 && saved.house.coins === 300, saved.garden);
    await app.clickSel('#garden-study'); await app.clickSel('#start-button');
    check('focus captures this plant', (await app.saved()).session.plantId === 'plant-1');
    await app.clickSel('#focus-garden'); await app.settle();
    check('a focused garden visit keeps you on the bench with your pet', await app.js(`(() => { const d = window.__littleHours.house.diagnostics(); return d.stroll?.sit === 1 && Boolean(d.strollPet) && d.scene.getTransformNodeByName('house-stroll').isEnabled(); })()`));
    await t.shot(app, 'focused-bench');
    await app.clickSel('#house-canvas [data-room="garden-home"]'); await app.settle();
    await app.clickSel('#start-button'); await app.clickSel('#focus-garden'); await app.settle();
    await app.clickSel('#garden-spot-1'); await app.clickSel('#seed-cosmos'); await app.clickSel('#garden-plant-seed');
    saved = await app.saved();
    check('later seeds cost ten coins and keep the paused target', saved.house.coins === 290 && saved.garden.plants.length === 2 && saved.session.plantId === 'plant-1', saved.garden);
    await app.clickSel('#garden-new-seeds'); await app.clickSel('#seed-lavender'); await app.clickSel('#garden-plant-seed');
    saved = await app.saved();
    check('replanting keeps the previous plant in the collection', saved.garden.plants.length === 3 && saved.garden.plants[1].slot === null && saved.garden.plants[2].slot === 1);
    await app.reload(); await app.clickSel('#focus-garden'); await app.settle();
    check('the planted collection survives reload', (await app.saved()).garden.plants.length === 3);
    await t.close(app);
    for (const phone of [false, true]) {
      const garden = await t.open({ seed: 'garden-grown', ...(phone ? { width: 390, height: 844, scale: 2, reducedMotion: true } : {}), label: phone ? 'phone' : 'bloom' });
      await garden.clickSel('#focus-garden'); await garden.settle();
      check(`${phone ? 'phone' : 'desktop'}: mature plants stay in the garden`, await garden.visible('.garden-bloom-note'));
      check(`${phone ? 'phone' : 'desktop'}: no horizontal overflow`, await garden.js('document.documentElement.scrollWidth <= innerWidth'));
      {
        for (let slot = 0; slot < 6; slot++) {
          const point = await garden.point({ gardenPlot: slot });
          check(`${phone ? 'phone' : 'desktop'}: spot ${slot + 1} is visible in the 3D garden`, point?.visible, point);
          if (point?.visible) { await garden.click(point.x, point.y); check(`${phone ? 'phone' : 'desktop'}: tapping pot ${slot + 1} selects its plant`, await garden.attr(`#garden-spot-${slot}`, 'aria-pressed') === 'true'); }
        }
        await garden.clickSel('#garden-spot-0');
      }
      const pair = await garden.js(`(() => { const d = window.__littleHours.house.diagnostics(); return { visible: d.scene.getTransformNodeByName('house-stroll').isEnabled(), avatar: Boolean(d.stroll), pet: Boolean(d.strollPet), home: d.scene.getMeshByName('house-retreat-home').isEnabled() }; })()`);
      check(`${phone ? 'phone' : 'desktop'}: the garden includes you, your pet and home`, pair.visible && pair.avatar && pair.pet && pair.home, pair);
      await sleep(400); await t.shot(garden, phone ? 'phone-bloom' : 'bloom');
      if (phone) {
        await sleep(1600); const before = (await garden.house()).renderCount; await sleep(700);
        check('reduced motion leaves the garden still', (await garden.house()).renderCount === before);
      }
      const beforeHome = await garden.saved();
      if (phone) await garden.clickSel('#house-canvas [data-room="garden-home"]');
      else await garden.clickTarget({ houseRoom: 'garden-home' });
      await garden.waitFor(`!document.body.classList.contains('is-house') && !document.documentElement.dataset.placeTransition`, { what: 'the path home' });
      const afterHome = await garden.saved();
      check(`${phone ? 'phone' : 'desktop'}: the path home returns to the room without spending or changing plants`, await garden.visible('#room-section') && JSON.stringify(beforeHome.garden) === JSON.stringify(afterHome.garden) && beforeHome.house.coins === afterHome.house.coins);
      await t.close(garden);
    }
  },
};
