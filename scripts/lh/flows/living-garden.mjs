export default {
  about: 'plant a seed, choose study growth, buy another, keep replaced plants, and visit a mature garden on desktop and phone',
  async run(t) {
    const { check, sleep } = t;
    const app = await t.open({ seed: 'one-room-rich' });
    await t.steps.openHouse(app); await app.clickSel('#house-open-garden'); await app.settle();
    check('the house page opens the garden', await app.text('#house-detail h2') === 'Your garden');
    check('an empty garden arrives without a seed card or a spots shelf', !await app.visible('#garden-card') && !await app.visible('#garden-spots'));
    const bare = await app.js(`(() => { const scene = window.__littleHours.house.diagnostics().scene, markers = scene.getMeshByName('house-retreat-markers'), flora = scene.getMeshByName('garden-flora'); return { markers: markers?.isEnabled() ? markers.getTotalVertices() : 0, flora: Boolean(flora?.isEnabled()) }; })()`);
    check('every empty bed shows a seed marker and no plant', bare.markers === 6 * 90 && !bare.flora, bare);
    const pinShown = () => app.js(`getComputedStyle(document.querySelector('#garden-spot-0 .house-pin')).opacity`);
    await app.move(4, 4); await sleep(350);
    const resting = await pinShown(), bed = await app.point({ gardenPlot: 0 });
    await app.move(bed.x, bed.y); await sleep(350);
    check('the plus on a bed stays hidden until the pointer reaches the bed', resting === '0' && await pinShown() === '1', { resting, bed });
    await app.clickSel('#garden-spot-0'); await app.clickSel('#seed-moonflower'); await sleep(400); await t.shot(app, 'seeds');
    await app.clickSel('#garden-plant-seed');
    await app.waitFor(`(JSON.parse(localStorage.getItem('little-hours-v1') || 'null')?.garden?.plants.length === 1)`, { what: 'the first seed to save' }).catch(() => null);
    let saved = await app.saved();
    check('the first seed is free and planted in spot one', saved.garden.plants[0]?.species === 'moonflower' && saved.garden.plants[0]?.slot === 0 && saved.house.coins === 300, saved.garden);
    await app.clickSel('#garden-study'); await app.clickSel('#start-button');
    await app.waitFor(`(JSON.parse(localStorage.getItem('little-hours-v1') || 'null')?.session?.running)`, { what: 'focus to start' }).catch(() => null);
    check('focus captures this plant', (await app.saved()).session.plantId === 'plant-1');
    await t.steps.openHouse(app); await app.clickSel('#house-open-garden'); await app.settle();
    check('a focused garden visit keeps you on the bench with your pet', await app.js(`(() => { const d = window.__littleHours.house.diagnostics(); return d.stroll?.sit === 1 && Boolean(d.strollPet) && d.scene.getTransformNodeByName('house-stroll').isEnabled(); })()`));
    await t.shot(app, 'focused-bench');
    await app.clickSel('#house-canvas [data-room="garden-exit"]'); await app.settle();
    await app.clickSel('#back-to-room'); await app.clickSel('#start-button'); await t.steps.openHouse(app); await app.clickSel('#house-open-garden'); await app.settle();
    if (await app.visible('#garden-card-close')) await app.clickSel('#garden-card-close'); await app.clickSel('#garden-spot-1'); await app.clickSel('#seed-cosmos'); await app.clickSel('#garden-plant-seed');
    await app.waitFor(`(JSON.parse(localStorage.getItem('little-hours-v1') || 'null')?.garden?.plants.length === 2)`, { what: 'the second seed to save' }).catch(() => null);
    saved = await app.saved();
    check('later seeds cost ten coins and keep the paused target', saved.house.coins === 290 && saved.garden.plants.length === 2 && saved.session.plantId === 'plant-1', saved.garden);
    await app.clickSel('#garden-new-seeds'); await app.clickSel('#seed-lavender'); await app.clickSel('#garden-plant-seed');
    await app.waitFor(`(JSON.parse(localStorage.getItem('little-hours-v1') || 'null')?.garden?.plants.length === 3)`, { what: 'the replanted seed to save' }).catch(() => null);
    saved = await app.saved();
    check('replanting keeps the previous plant in the collection', saved.garden.plants.length === 3 && saved.garden.plants[1].slot === null && saved.garden.plants[2].slot === 1);
    await app.reload(); await t.steps.openHouse(app); await app.clickSel('#house-open-garden'); await app.settle();
    check('the planted collection survives reload', (await app.saved()).garden.plants.length === 3);
    await t.close(app);
    for (const phone of [false, true]) {
      const garden = await t.open({ seed: 'garden-grown', ...(phone ? { width: 390, height: 844, scale: 2, reducedMotion: true } : {}), label: phone ? 'phone' : 'bloom' });
      await t.steps.openHouse(garden); await garden.clickSel('#house-open-garden'); await garden.settle();
      await garden.clickSel('#garden-spot-0');
      check(`${phone ? 'phone' : 'desktop'}: mature plants stay in the garden`, await garden.visible('.garden-bloom-note'));
      check(`${phone ? 'phone' : 'desktop'}: no horizontal overflow`, await garden.js('document.documentElement.scrollWidth <= innerWidth'));
      {
        for (let slot = 0; slot < 6; slot++) {
          if (await garden.js(`!document.getElementById('garden-card').hidden`)) await garden.clickSel('#garden-card-close');
          await garden.settle();
          const point = await garden.point({ gardenPlot: slot });
          check(`${phone ? 'phone' : 'desktop'}: spot ${slot + 1} is visible in the 3D garden`, point?.visible, point);
          if (point?.visible) { const target = await garden.js(`document.elementFromPoint(${point.x}, ${point.y})?.outerHTML?.slice(0, 220)`); await garden.click(point.x, point.y); await garden.settle(); const selected = await garden.attr(`#garden-spot-${slot}`, 'aria-pressed') === 'true'; check(`${phone ? 'phone' : 'desktop'}: tapping pot ${slot + 1} selects its plant`, selected, { target, title: await garden.text('#garden-card-title'), pressed: await garden.js(`Array.from(document.querySelectorAll('.garden-bed-pin')).map(node => node.getAttribute('aria-pressed'))`) }); if (!selected) await t.shot(garden, `missed-bed-${slot}`); }
        }
        await garden.clickSel('#garden-card-close'); await garden.clickSel('#garden-spot-0');
      }
      const pair = await garden.js(`(() => { const d = window.__littleHours.house.diagnostics(); return { visible: d.scene.getTransformNodeByName('house-stroll').isEnabled(), avatar: Boolean(d.stroll), pet: Boolean(d.strollPet), home: d.scene.getMeshByName('house-retreat-exit').isEnabled() }; })()`);
      check(`${phone ? 'phone' : 'desktop'}: the garden includes you, your pet and the island gate`, pair.visible && pair.avatar && pair.pet && pair.home, pair);
      const look = await garden.js(`(() => { const scene = window.__littleHours.house.diagnostics().scene, grass = scene.getMeshByName('garden-grass'), sky = document.querySelector('.island-sky'); return { blades: grass?.isEnabled() ? grass.getTotalVertices() / 3 : 0, sky: Boolean(sky?.querySelector('svg')) && !sky.hidden && getComputedStyle(sky).display !== 'none' }; })()`);
      check(`${phone ? 'phone' : 'desktop'}: the garden floats under the island sky on a lawn of wind grass`, look.blades > 8000 && look.sky, look);
      const beds = await garden.js(`(() => { const scene = window.__littleHours.house.diagnostics().scene, flora = scene.getMeshByName('garden-flora'); return { plants: flora?.isEnabled() ? flora.getTotalVertices() : 0, wind: Boolean(flora?.isVerticesDataPresent('grassBlade')), markers: Boolean(scene.getMeshByName('house-retreat-markers')) }; })()`);
      check(`${phone ? 'phone' : 'desktop'}: six blooming plants stand in the beds, sway with the wind and leave no seed markers`, beds.plants > 12000 && beds.wind && !beds.markers, beds);
      await garden.move(4, 4);
      const shown = await garden.waitFor(`getComputedStyle(document.querySelector('#garden-spot-0 .house-pin')).opacity === '1' && getComputedStyle(document.querySelector('#garden-spot-1 .house-pin')).opacity === (matchMedia('(hover: hover)').matches ? '0' : '1')`, { what: 'the selected pin to show alone' }).catch(() => false);
      check(`${phone ? 'phone' : 'desktop'}: the selected bed keeps its pin showing while the pointer is away`, shown);
      await sleep(400); await t.shot(garden, phone ? 'phone-bloom' : 'bloom');
      if (phone) {
        await sleep(1600); const before = (await garden.house()).renderCount; await sleep(700);
        check('reduced motion leaves the garden still', (await garden.house()).renderCount === before);
      }
      const beforeHome = await garden.saved();
      if (phone) await garden.clickSel('#house-canvas [data-room="garden-exit"]');
      else await garden.clickTarget({ houseRoom: 'garden-exit' });
      await garden.waitFor(`document.body.classList.contains('is-house') && !document.body.classList.contains('is-garden') && !document.documentElement.dataset.placeTransition`, { what: 'the path home' });
      const afterHome = await garden.saved();
      check(`${phone ? 'phone' : 'desktop'}: the garden gate returns to the island without spending or changing plants`, await garden.visible('#house-open-garden') && JSON.stringify(beforeHome.garden) === JSON.stringify(afterHome.garden) && beforeHome.house.coins === afterHome.house.coins);
      await t.close(garden);
    }
  },
};
