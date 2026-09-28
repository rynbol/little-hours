const BUBBLE = `(() => { const b = document.querySelector('.speech-bubble[data-speaker="pet"]'); return b && !b.hidden ? b.textContent.trim() : null; })()`;
const CAT = /prr|Mrr|Mew/i, DOG = /Arf|Wuff|Yip|Snff/i;
const HEARTS = `window.__littleHours.room.diagnostics().petModel.hearts.filter(heart => heart.isEnabled()).length`;

async function tapPet(app, sleep, slow) {
  for (let i = 0; i < 4; i++) {
    const spot = await app.point('pet');
    if (spot?.visible) {
      await app.click(spot.x, spot.y);
      const counts = [];
      for (let k = 0; k < 42 * slow && !counts.includes(2); k++) { counts.push(await app.js(HEARTS)); await sleep(100 / slow); }
      if (counts.some(Boolean)) return { spot, counts, said: await app.js(BUBBLE) };
    }
    await sleep(300);
  }
  return { spot: await app.point('pet'), counts: [], said: null };
}
const oneByOne = counts => counts.indexOf(1) >= 0 && counts.indexOf(1) < counts.indexOf(2);
const PET_AGE = `window.__littleHours.room.diagnostics().pet.petAge`;

async function petAgain(app, sleep, spot, times, slow) {
  const ages = [];
  for (let i = 0; i < times; i++) { await app.click(spot.x, spot.y); await sleep(120 / slow); ages.push(await app.js(PET_AGE)); }
  return { ages, hearts: await app.js(HEARTS) };
}

export default {
  about: 'the pet: a tap gets two hearts one after another and no words, more taps stack a heart each without starting the lean over, the pet panel switches between the cat and the dog, the choice survives a reload, and coins adopt a fox while the red panda stays locked',
  async run(t) {
    const { check, sleep } = t;
    const app = await t.open({ seed: 'three-rooms' });
    await app.settle();
    check('the room starts with Miso the cat', await app.text('#pet-button-label') === 'Miso' && await app.js('window.__littleHours.room.diagnostics().petSpecies') === 'cat');
    let tap = await tapPet(app, sleep, t.slow);
    check('tapping the cat floats two hearts up one after another', oneByOne(tap.counts), tap.counts);
    check('petting shows no words', tap.said === null, tap.said);
    check('a room cuddle grows the saved bond once', await app.js('window.__littleHours.state.petBonds.cat.affection === 2'));
    const again = await petAgain(app, sleep, await app.point('pet'), 4, t.slow);
    check('four more taps stack a heart each', again.hearts >= 5, again);
    check('more taps hold the lean instead of starting it over', again.ages.every(age => age >= .3 && age < 2.6), again.ages);
    await t.shot(app, 'cat-hearts');
    if (await app.js(`document.getElementById('room-panel').hidden`)) await app.clickSel('#pet-button');
    await app.clickSel('#pet-collection > summary');
    await app.waitFor(`document.querySelectorAll('[data-pet-choice]').length === 5`, { what: 'the pet panel' });
    check('the bunny, fox and red panda wait behind prices', (await app.js(`[...document.querySelectorAll('[data-pet-choice]')].filter(b => ['bunny', 'fox', 'panda'].includes(b.dataset.petChoice)).map(b => b.dataset.petChoice + ':' + b.querySelector('small').textContent.trim()).join()`)) === 'bunny:40 ◉,fox:90 ◉,panda:160 ◉');
    check('the pet panel offers the cat and the dog, with the cat chosen', await app.attr('[data-pet-choice="cat"]', 'aria-pressed') === 'true' && await app.attr('[data-pet-choice="dog"]', 'aria-pressed') === 'false');
    await app.clickSel('[data-pet-choice="dog"]');
    await app.waitFor(`document.querySelector('[data-pet-choice="dog"]')?.getAttribute('aria-pressed') === 'true'`, { what: 'the dog to be chosen' });
    check('choosing the dog names Mochi everywhere', await app.text('#pet-button-label') === 'Mochi' && await app.text('#pet-company') === 'You & Mochi', await app.text('#pet-company'));
    check('the dog is in the room', await app.js('window.__littleHours.room.diagnostics().petSpecies') === 'dog');
    const hello = await app.waitFor(BUBBLE, { timeout: 3000 }).catch(() => null);
    check('Mochi says hello on arrival', DOG.test(hello || ''), hello);
    check('the choice is saved', (await app.saved())?.pet === 'dog');
    await app.clickSel('#close-panel');
    await app.waitFor(`document.getElementById('room-panel').hidden`, { what: 'the panel to close' });
    await app.reload();
    await app.settle();
    check('after a reload the dog is still your pet', await app.text('#pet-button-label') === 'Mochi' && await app.js('window.__littleHours.room.diagnostics().petSpecies') === 'dog');
    tap = await tapPet(app, sleep, t.slow);
    check('tapping the dog after the reload gets hearts too, without words', oneByOne(tap.counts) && tap.said === null, tap);
    await t.shot(app, 'dog-hearts');
    if (await app.js(`document.getElementById('room-panel').hidden`)) await app.clickSel('#pet-button');
    await app.clickSel('#pet-collection > summary');
    await app.waitFor(`document.getElementById('pet-now') !== null`, { what: 'the pet panel' });
    check('the panel button offers to pet Mochi', (await app.attr('#pet-now', 'aria-label')).startsWith('Pet Mochi'), await app.attr('#pet-now', 'aria-label'));
    await app.clickSel('[data-pet-choice="cat"]');
    await app.waitFor(`document.querySelector('[data-pet-choice="cat"]')?.getAttribute('aria-pressed') === 'true'`, { what: 'the cat to be chosen' });
    check('switching back to the cat is saved too', (await app.saved())?.pet === 'cat' && await app.text('#pet-button-label') === 'Miso');
    await t.close(app);

    const shop = await t.open({ seed: 'pet-shop' });
    await shop.settle();
    await shop.clickSel('#pet-button'); await shop.clickSel('#pet-collection > summary');
    await shop.waitFor(`document.querySelectorAll('[data-pet-choice]').length === 5`, { what: 'the pet panel' });
    await shop.clickSel('[data-pet-choice="panda"]');
    await shop.waitFor(`!document.getElementById('pet-adopt').hidden`, { what: 'the adoption card' });
    check('the red panda card says how many coins are missing and cannot be bought yet', (await shop.text('.pet-adopt-note'))?.startsWith('40 more coins') && await shop.js(`document.getElementById('pet-adopt-button').disabled`), await shop.text('.pet-adopt-note'));
    check('looking at a pet you cannot afford changes nothing', (await shop.saved())?.pet !== 'panda' && await shop.text('#coin-balance') === '120');
    await shop.clickSel('[data-pet-choice="fox"]');
    await shop.waitFor(`document.querySelector('.pet-adopt h3')?.textContent.includes('Hoshi')`, { what: 'the fox card' });
    await t.shot(shop, 'fox-offer');
    await shop.clickSel('#pet-adopt-button');
    await shop.waitFor(`document.querySelector('[data-pet-choice="fox"]')?.getAttribute('aria-pressed') === 'true'`, { what: 'the fox to come home' });
    check('adopting Hoshi spends 90 coins', await shop.text('#coin-balance') === '30', await shop.text('#coin-balance'));
    check('the fox is in the room and named', await shop.js('window.__littleHours.room.diagnostics().petSpecies') === 'fox' && await shop.text('#pet-button-label') === 'Hoshi');
    check('the fox now lives with you and the save knows it', JSON.stringify((await shop.saved())?.pets) === '["cat","dog","fox"]' && !(await shop.js(`document.querySelector('[data-pet-choice="fox"]').classList.contains('is-locked')`)));
    await shop.clickSel('#close-panel');
    await shop.waitFor(`(() => { const pet = window.__littleHours.room.diagnostics().pet; return pet.petAge === Infinity && pet.hearts.length === 0 && pet.ritual === null; })()`, { what: 'the welcome play to finish' });
    const foxTap = await tapPet(shop, sleep, t.slow);
    check('tapping the fox gets hearts too', oneByOne(foxTap.counts), foxTap.counts);
    check('the fox remembers the cuddle after welcome play', (await shop.saved())?.petBonds.fox.affection === 1);
    await t.shot(shop, 'fox-hearts');
    await t.close(shop);
  },
};
