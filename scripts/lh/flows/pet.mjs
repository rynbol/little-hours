const BUBBLE = `(() => { const b = document.querySelector('.speech-bubble[data-speaker="pet"]'); return b && !b.hidden ? b.textContent.trim() : null; })()`;
const CAT = /prr|Mrr|Mrow|Miso|blink|purr/i, DOG = /Wag|snuffle|Mochi|Boop|Arf|tail|belly/i;

async function tapPet(app, sleep) {
  for (let i = 0; i < 4; i++) {
    const spot = await app.point('pet');
    if (spot?.visible) {
      await app.click(spot.x, spot.y);
      const said = await app.waitFor(BUBBLE, { timeout: 1500 }).catch(() => null);
      if (said) return { spot, said };
    }
    await sleep(300);
  }
  return { spot: await app.point('pet'), said: null };
}

export default {
  about: 'the pet: a tap gets a bubble, the pet panel switches between the cat and the dog, and the choice survives a reload',
  async run(t) {
    const { check, sleep } = t;
    const app = await t.open({ seed: 'three-rooms' });
    await app.settle();
    check('the room starts with Miso the cat', await app.text('#pet-button-label') === 'Miso' && await app.js('window.__littleHours.room.diagnostics().petSpecies') === 'cat');
    let tap = await tapPet(app, sleep);
    check('tapping the cat shows a bubble above it', tap.said !== null, tap);
    check('the bubble is a cat line', CAT.test(tap.said || ''), tap.said);
    await t.shot(app, 'cat-bubble');
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
    tap = await tapPet(app, sleep);
    check('tapping the dog after the reload shows a dog line', DOG.test(tap.said || ''), tap);
    await t.shot(app, 'dog-bubble');
    await app.clickSel('#pet-button');
    await app.waitFor(`document.getElementById('pet-now') !== null`, { what: 'the pet panel' });
    check('the panel button offers to pet Mochi', (await app.text('#pet-now'))?.includes('Give Mochi a pet'), await app.text('#pet-now'));
    await app.clickSel('[data-pet-choice="cat"]');
    await app.waitFor(`document.querySelector('[data-pet-choice="cat"]')?.getAttribute('aria-pressed') === 'true'`, { what: 'the cat to be chosen' });
    check('switching back to the cat is saved too', (await app.saved())?.pet === 'cat' && await app.text('#pet-button-label') === 'Miso');
    await t.close(app);
  },
};
