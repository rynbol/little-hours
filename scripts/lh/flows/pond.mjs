import { steps } from '../steps.mjs';
import { slow } from '../chrome.mjs';

const LAKE = `(() => { const lake = window.__littleHours.lake, d = lake.diagnostics(); return { open: lake.isOpen, phase: d?.phase ?? null, ui: d?.ui ?? null, fight: d?.fight ?? null }; })()`;
const POND = `(() => { const p = window.__littleHours.state.pond; return { bait: p.bait.map(b => b.minutes), found: Object.keys(p.journal).length, caught: Object.values(p.journal).reduce((n, e) => n + e.count, 0), last: p.log.at(-1) ?? null }; })()`;
const shown = selector => `document.querySelector(${JSON.stringify(selector)}).open`;

const REEL_AT = `(() => { if (document.querySelector('#lake-bite').hidden) return null; const r = document.querySelector('#lake-reel').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`;

async function castForBite(app) {
  await app.clickSel('#lake-cast');
  await app.waitFor(`['wait', 'bite'].includes(window.__littleHours.lake.diagnostics()?.ui)`, { what: 'the cast animation to land', timeout: 30000 });
  const end = Date.now() + 6000 * slow;
  for (let at = await app.js(REEL_AT); Date.now() < end; at = await app.js(REEL_AT)) if (at) return at;
  throw new Error('Timed out waiting for a bite');
}

export default {
  about: 'the pond: the island pond tag opens the lake, bait from sessions sits in ranges with their odds, a cast gets a bite, keeping the float on the fish lands one that fills the journal and spends one bait, striking too soon spooks it, a missed bite keeps the bait, the card and journal put fish in the aquarium, Escape closes the card, then the journal, then the lake, and the catch survives a reload, and aquarium fish swim in the room tank',
  async run(t) {
    const { check } = t;
    const app = await t.open({ seed: 'pond' });
    await app.settle();
    await steps.openLake(app);
    const engines = await app.js(`window.__littleHours.counts().engines`);
    check('the pond tag opens the lake with its own scene', (await app.js(LAKE)).phase === 'idle' && await app.js(`document.body.classList.contains('is-lake')`));
    check('bait is grouped into its five ranges', await app.js(`[...document.querySelectorAll('[data-bait]')].map(b => b.dataset.bait + b.querySelector('b').textContent).join()`) === 'crumb×1,worm×1,cricket×2,firefly×1,star×1');
    check('the journal shows 3 of 22 found', await app.text('#lake-found') === '3/22');
    check('arrival leaves the bait selector and catch chances tucked away', !await app.visible('#lake-tackle') && !await app.visible('#lake-odds') && await app.text('#lake-status') === '');
    await app.clickSel('#lake-bait-toggle'); await app.clickSel('[data-bait="crumb"]');
    await app.clickSel('#lake-chances > summary');
    check('choosing bread crumb shows its odds with no rare fish', await app.attr('[data-bait="crumb"]', 'aria-checked') === 'true' && await app.js(`document.querySelectorAll('#lake-odds li:not(.is-off)').length`) === 2);
    await app.clickSel('[data-bait="star"]');
    const before = await app.js(POND);
    const reel = await castForBite(app);
    await app.js(`(() => { const raf = window.requestAnimationFrame.bind(window); window.__slowFrames = true; window.requestAnimationFrame = cb => window.__slowFrames ? raf(() => setTimeout(() => cb(performance.now()), 700)) : raf(cb); return true; })()`);
    await app.press(reel.x, reel.y);
    check('a cast gets a bite with a reel button', Boolean(reel));
    const hooked = await app.js(LAKE);
    check('pressing on the bite hooks the fish and shows the line tension', hooked.phase === 'reel' && hooked.fight?.line <= 1 && await app.visible('#lake-tension'), hooked);
    check('the journal waits until the fight is over', await app.js(`document.querySelector('#lake-journal-button').disabled`));
    await t.shot(app, 'reeling');
    let held = true, strain = 0, onFish = 0, polls = 0, fought = null;
    const began = Date.now();
    for (const end = Date.now() + 90000 * slow; Date.now() < end;) {
      fought = await app.js(LAKE);
      if (!fought.fight) break;
      polls++;
      const { tension, zone } = fought.fight;
      strain = Math.max(strain, fought.fight.strain);
      if (Math.abs(tension - zone.at) < zone.width / 2) onFish++;
      if (held && tension > zone.at) { await app.release(reel.x, reel.y); held = false; }
      else if (!held && tension < zone.at) { await app.press(reel.x, reel.y); held = true; }
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    if (held) await app.release(reel.x, reel.y);
    await app.js(`(window.__slowFrames = false, true)`);
    check('reeling while the float is under the fish and easing off above it lands it without a snap, even with 0.7 s frames', onFish > 0 && strain < 1.2 && fought.ui !== 'idle', { strain, onFish, poll: Math.round((Date.now() - began) / polls), fought });
    await app.waitFor(`document.querySelector('#lake-card').open`, { what: 'the catch card', timeout: 30000 }).catch(async error => { throw new Error(error.message + JSON.stringify(fought)); });
    const after = await app.js(POND), name = await app.text('#lake-card-name');
    check('the fish leaps out and its card names it', (await app.js(LAKE)).phase === 'shown' && Boolean(name), name);
    check('landing it spends the star lure only', JSON.stringify(after.bait) === JSON.stringify(before.bait.slice(0, -1)), after.bait);
    check('the catch is in the journal and the log', after.caught === before.caught + 1 && after.last?.minutes === 95, after);
    await app.key('Tab'); await app.key('Tab');
    check('the catch card contains keyboard focus', await app.js(`document.querySelector('#lake-card').matches(':modal') && document.querySelector('#lake-card').contains(document.activeElement)`));
    await t.shot(app, 'card');
    const caughtId = await app.js(`document.querySelector('#lake-card [data-tank]').dataset.tank`);
    await app.clickSel('#lake-card [data-tank]');
    await app.waitFor(`document.querySelector('#lake-card [data-tank]').getAttribute('aria-pressed') === 'true'`, { what: 'the aquarium button to press' });
    check('the card puts the fish in the aquarium', JSON.stringify(await app.js(`window.__littleHours.state.pond.tank`)) === JSON.stringify([caughtId]) && await app.text('#lake-card [data-tank]') === 'In your aquarium', caughtId);
    await app.key('Escape');
    await app.waitFor(`!document.querySelector('#lake-card').open`, { what: 'the card to close' });
    check('Escape puts the fish in the basket and stays at the lake', (await app.js(LAKE)).open);
    await app.clickSel('#lake-cast');
    await app.waitFor(`window.__littleHours.lake.diagnostics()?.ui === 'wait'`, { what: 'the float to settle', timeout: 30000 });
    const stage = await app.js(`(() => { const r = document.querySelector('.lake-stage').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * .4 }; })()`);
    await app.press(stage.x, stage.y); await app.release(stage.x, stage.y);
    check('striking before the bite spooks the fish and keeps the bait', (await app.js(LAKE)).ui === 'idle' && /Too soon/.test(await app.text('#lake-status')) && (await app.js(POND)).bait.length === after.bait.length);
    await castForBite(app);
    await app.waitFor(`document.querySelector('#lake-bite').hidden`, { what: 'the fish to get away', timeout: 6000 });
    check('a missed bite slips away and keeps the bait', (await app.js(POND)).bait.length === after.bait.length && /slipped/.test(await app.text('#lake-status')));
    await app.clickSel('#lake-journal-button');
    await app.waitFor(shown('#lake-journal'), { what: 'the journal' });
    check('the journal lists every species, found or not', await app.js(`document.querySelectorAll('.lake-entry').length`) === 22 && await app.js(`document.querySelectorAll('.lake-entry:not(.is-missing)').length`) === after.found);
    await app.key('Tab');
    check('the journal contains keyboard focus', await app.js(`document.querySelector('#lake-journal').matches(':modal') && document.querySelector('#lake-journal').contains(document.activeElement)`));
    check('the journal shows which fish are in the aquarium', await app.js(`[...document.querySelectorAll('#lake-journal [aria-pressed="true"]')].map(b => b.dataset.tank).join()`) === caughtId && /1 of 8 in your aquarium/.test(await app.text('#lake-journal header')));
    await t.shot(app, 'journal');
    await app.key('Escape');
    check('Escape closes the journal first', await app.js(`!document.querySelector('#lake-journal').open`) && (await app.js(LAKE)).open);
    check('closing the journal restores its button', await app.js(`document.activeElement.id === 'lake-journal-button'`));
    await app.key('Escape');
    await app.waitFor(`!window.__littleHours.lake.isOpen`, { what: 'the lake to close' });
    check('then Escape leaves the lake for the island and frees its scene', await app.js(`document.body.classList.contains('is-house') && !document.body.classList.contains('is-lake')`) && (await app.js(`window.__littleHours.counts().engines`)) === engines - 1);
    await app.reload();
    await app.settle();
    const saved = await app.js(POND);
    check('after a reload the catch and the spent bait are kept', saved.caught === after.caught && saved.bait.length === after.bait.length, saved);
    await app.close();

    const tank = await t.open({ seed: 'aquarium' });
    await tank.settle();
    const TANK = `(() => { const tank = window.__littleHours.room.diagnostics().scene.transformNodes.find(n => n.metadata?.furnitureType === 'fish-tank'); return { fish: tank.getChildren().filter(n => n.name.startsWith('tank-fish-')).map(n => n.name.slice(10) + ':' + n.isEnabled() + ':' + n.getChildMeshes().every(m => m.isEnabled() && m.isVisible && m.isInFrustum(window.__littleHours.room.diagnostics().scene.frustumPlanes))), generic: tank.getChildMeshes().find(m => m.name === 'aquarium-fish').isEnabled() }; })()`;
    const inTank = await tank.js(TANK);
    check('fish from the aquarium list swim in the room tank, drawn on screen, in place of the three fish', inTank.fish.join() === 'koi:true:true,starfish:true:true,jelly:true:true' && !inTank.generic, inTank);
    await t.shot(tank, 'aquarium');
    await tank.close();

    const empty = await t.open({ seed: 'pond-empty' });
    await empty.settle();
    await steps.openLake(empty);
    await empty.clickSel('#lake-bait-toggle');
    check('with no bait the cast waits and says how to earn some', await empty.js(`document.querySelector('#lake-cast').disabled`) && /Finish a focus session/.test(await empty.text('.lake-empty')));
    await empty.close();
  },
};
