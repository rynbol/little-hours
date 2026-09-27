import { steps } from '../steps.mjs';

const LAKE = `(() => { const lake = window.__littleHours.lake, d = lake.diagnostics(); return { open: lake.isOpen, phase: d?.phase ?? null, ui: d?.ui ?? null, need: d?.need ?? 0 }; })()`;
const POND = `(() => { const p = window.__littleHours.state.pond; return { bait: p.bait.map(b => b.minutes), found: Object.keys(p.journal).length, caught: Object.values(p.journal).reduce((n, e) => n + e.count, 0), last: p.log.at(-1) ?? null }; })()`;
const shown = selector => `!document.querySelector(${JSON.stringify(selector)}).hidden`;

async function castForBite(app) {
  await app.clickSel('#lake-cast');
  await app.waitFor(`['wait', 'bite'].includes(window.__littleHours.lake.diagnostics()?.ui)`, { what: 'the cast animation to land', timeout: 30000 });
  await app.waitFor(shown('#lake-bite'), { what: 'a bite', timeout: 6000 });
}

export default {
  about: 'the pond: the island pond tag opens the lake, bait from sessions sits in ranges with their odds, a cast gets a bite, reeling lands a fish that fills the journal and spends one bait, a missed bite keeps the bait, Escape closes the card, then the journal, then the lake, and the catch survives a reload',
  async run(t) {
    const { check } = t;
    const app = await t.open({ seed: 'pond' });
    await app.settle();
    await steps.openLake(app);
    const engines = await app.js(`window.__littleHours.counts().engines`);
    check('the pond tag opens the lake with its own scene', (await app.js(LAKE)).phase === 'idle' && await app.js(`document.body.classList.contains('is-lake')`));
    check('bait is grouped into its five ranges', await app.js(`[...document.querySelectorAll('[data-bait]')].map(b => b.dataset.bait + b.querySelector('b').textContent).join()`) === 'crumb×1,worm×1,cricket×2,firefly×1,star×1');
    check('the journal shows 3 of 15 found', await app.text('#lake-found') === '3/15');
    await app.clickSel('[data-bait="crumb"]');
    check('choosing bread crumb shows its odds with no rare fish', await app.attr('[data-bait="crumb"]', 'aria-checked') === 'true' && await app.js(`document.querySelectorAll('#lake-odds li:not(.is-off)').length`) === 2);
    await app.clickSel('[data-bait="star"]');
    const before = await app.js(POND);
    await castForBite(app);
    check('a cast gets a bite with a reel button', (await app.js(LAKE)).phase === 'bite');
    await app.clickSel('#lake-reel');
    const hooked = await app.js(LAKE);
    check('reeling on the bite hooks the fish and asks for pulls', hooked.phase === 'reel' && hooked.need >= 4, hooked);
    await t.shot(app, 'hooked');
    for (let i = 0; i < hooked.need; i++) {
      await app.clickSel('#lake-reel');
      await app.waitFor(`window.__littleHours.lake.diagnostics().taps === ${i + 1}`, { what: `reel pull ${i + 1}` });
    }
    await app.waitFor(`document.querySelector('#lake-card.is-shown') !== null`, { what: 'the catch card', timeout: 8000 }).catch(async error => { throw new Error(error.message + JSON.stringify(await app.js(LAKE))); });
    const after = await app.js(POND), name = await app.text('#lake-card-name');
    check('the fish leaps out and its card names it', (await app.js(LAKE)).phase === 'shown' && Boolean(name), name);
    check('landing it spends the star lure only', JSON.stringify(after.bait) === JSON.stringify(before.bait.slice(0, -1)), after.bait);
    check('the catch is in the journal and the log', after.caught === before.caught + 1 && after.last?.minutes === 95, after);
    await t.shot(app, 'card');
    await app.key('Escape');
    await app.waitFor(`document.querySelector('#lake-card').hidden`, { what: 'the card to close' });
    check('Escape puts the fish in the basket and stays at the lake', (await app.js(LAKE)).open);
    await castForBite(app);
    await app.waitFor(`document.querySelector('#lake-bite').hidden`, { what: 'the fish to get away', timeout: 6000 });
    check('a missed bite slips away and keeps the bait', (await app.js(POND)).bait.length === after.bait.length && /slipped/.test(await app.text('#lake-status')));
    await app.clickSel('#lake-journal-button');
    await app.waitFor(shown('#lake-journal'), { what: 'the journal' });
    check('the journal lists every species, found or not', await app.js(`document.querySelectorAll('.lake-entry').length`) === 15 && await app.js(`document.querySelectorAll('.lake-entry:not(.is-missing)').length`) === after.found);
    await t.shot(app, 'journal');
    await app.key('Escape');
    check('Escape closes the journal first', await app.js(`document.querySelector('#lake-journal').hidden`) && (await app.js(LAKE)).open);
    await app.key('Escape');
    await app.waitFor(`!window.__littleHours.lake.isOpen`, { what: 'the lake to close' });
    check('then Escape leaves the lake for the island and frees its scene', await app.js(`document.body.classList.contains('is-house') && !document.body.classList.contains('is-lake')`) && (await app.js(`window.__littleHours.counts().engines`)) === engines - 1);
    await app.reload();
    await app.settle();
    const saved = await app.js(POND);
    check('after a reload the catch and the spent bait are kept', saved.caught === after.caught && saved.bait.length === after.bait.length, saved);
    await app.close();

    const empty = await t.open({ seed: 'pond-empty' });
    await empty.settle();
    await steps.openLake(empty);
    check('with no bait the cast waits and says how to earn some', await empty.js(`document.querySelector('#lake-cast').disabled`) && /Finish a focus session/.test(await empty.text('.lake-empty')));
    await empty.close();
  },
};
