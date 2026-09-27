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

async function petAgain(app, sleep, spot, times) {
  const ages = [];
  for (let i = 0; i < times; i++) { await app.click(spot.x, spot.y); await sleep(120); ages.push(await app.js(PET_AGE)); }
  return { ages, hearts: await app.js(HEARTS) };
}

export default {
  about: 'the pet: a tap gets two hearts one after another and no words, more taps stack a heart each without starting the lean over, the pet panel switches between the cat and the dog, and the choice survives a reload',
  async run(t) {
    const { check, sleep } = t;
    const app = await t.open({ seed: 'three-rooms' });
    await app.settle();
    check('the room starts with Miso the cat', await app.text('#pet-button-label') === 'Miso' && await app.js('window.__littleHours.room.diagnostics().petSpecies') === 'cat');
    let tap = await tapPet(app, sleep, t.slow);
    check('tapping the cat floats two hearts up one after another', oneByOne(tap.counts), tap.counts);
    check('petting shows no words', tap.said === null, tap.said);
    const again = await petAgain(app, sleep, tap.spot, 4);
    check('four more taps stack a heart each', again.hearts >= 5, again);
    check('more taps hold the lean instead of starting it over', again.ages.every(age => age >= .3 && age < 2.6), again.ages);
    await t.shot(app, 'cat-hearts');
    await app.clickSel('#pet-button');
    await app.waitFor(`document.querySelectorAll('[data-pet-choice]').length === 2`, { what: 'the pet panel' });
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
    await app.clickSel('#pet-button');
    await app.waitFor(`document.getElementById('pet-now') !== null`, { what: 'the pet panel' });
    check('the panel button offers to pet Mochi', (await app.text('#pet-now'))?.includes('Give Mochi a pet'), await app.text('#pet-now'));
    await app.clickSel('[data-pet-choice="cat"]');
    await app.waitFor(`document.querySelector('[data-pet-choice="cat"]')?.getAttribute('aria-pressed') === 'true'`, { what: 'the cat to be chosen' });
    check('switching back to the cat is saved too', (await app.saved())?.pet === 'cat' && await app.text('#pet-button-label') === 'Miso');
    await t.close(app);
  },
};
