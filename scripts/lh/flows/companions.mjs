import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const bond = id => `window.__littleHours.state.petBonds.${id}`;
const type = async (app, selector, value) => {
  await app.clickSel(selector);
  await app.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', modifiers: process.platform === 'darwin' ? 4 : 2, windowsVirtualKeyCode: 65, commands: ['selectAll'] });
  await app.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', modifiers: process.platform === 'darwin' ? 4 : 2 });
  await app.send('Input.insertText', { text: value });
};
async function film(app, t, label, seconds = 3) {
  if (!process.env.LH_FILM) return;
  const folder = join(t.out, label); mkdirSync(folder, { recursive: true });
  for (let i = 0; i < seconds * 12; i++) {
    const began = performance.now();
    await app.shot(join(folder, `${String(i).padStart(4, '0')}.jpg`));
    await t.sleep(Math.max(0, 1000 / 12 - (performance.now() - began)));
  }
}
const diagnostics = 'window.__littleHours.room.diagnostics()';
const idleCare = app => app.waitFor(`!${diagnostics}.pet.care`, { timeout: 45000, what: 'the room care animation to finish' });
export default {
  about: 'coin meals in the room, free play, belongings, personal names, friendship unlocks, adoption and phone care',
  async run(t) {
    const app = await t.open({ seed: 'pet-shop' });
    await app.clickSel('#pet-button');
    t.check('care sits beside the live room without a modal or inert canvas', await app.js(`document.body.classList.contains('is-pet-care') && !document.querySelector('#room-canvas').closest('[inert]') && document.querySelector('#room-panel').parentElement.classList.contains('workspace')`));
    await t.shot(app, 'care');
    await app.clickSel('#pet-feed'); await t.shot(app, 'meals'); await app.clickSel('#pet-meal-supper');
    t.check('supper spends five coins and earns one heart together', await app.js(`window.__littleHours.state.house.coins === 115 && ${bond('cat')}.affection === 1 && ${bond('cat')}.care.meals === 1`));
    const approach = await app.js(`(() => { const p = ${diagnostics}.pet; return { phase: p.care?.phase, state: p.state, prop: p.care?.prop }; })()`);
    t.check('the cat walks toward a real meal placed in the room', approach.phase === 'approach' && approach.state === 'walking', approach);
    await app.waitFor(`${diagnostics}.pet.care?.phase === 'active'`, { timeout: 30000, what: 'the cat reaching its supper' });
    t.check('the meal stays at the bowl while the pet eats', await app.js(`(() => { const d = ${diagnostics}, b = d.petBelongings; return d.pet.action === 'eat' && b.food.isEnabled() && b.bowl.isEnabled() && Math.abs(b.bowl.position.x - ${approach.prop.x}) < .01 && Math.abs(b.bowl.position.z - ${approach.prop.z}) < .01; })()`));
    await t.shot(app, 'supper'); await film(app, t, '01-supper');
    await app.clickSel('#pet-now');
    t.check('petting remains available during a meal', await app.js(`${bond('cat')}.affection === 3 && ${diagnostics}.pet.care?.kind === 'treat'`));
    await app.clickSel('#pet-feed');
    t.check('fullness prevents a second charge', await app.js(`document.querySelector('#pet-meal-supper').disabled && document.querySelector('#pet-meal-crunch').disabled && window.__littleHours.state.house.coins === 115`));
    await app.clickSel('#pet-feed'); await idleCare(app);
    await app.clickSel('#pet-play');
    t.check('play is free and earns one heart', await app.js(`${bond('cat')}.affection === 4 && window.__littleHours.state.house.coins === 115`));
    await app.waitFor(`${diagnostics}.pet.care?.phase === 'active'`, { timeout: 30000, what: 'play to begin' });
    t.check('play has a visible room toy', await app.js(`${diagnostics}.petBelongings.toy.isEnabled() && !${diagnostics}.petBelongings.food.isEnabled()`));
    await t.shot(app, 'play'); await film(app, t, '02-play'); await idleCare(app);
    await app.clickSel('#pet-play');
    t.check('playing again is available without farming hearts', await app.js(`${bond('cat')}.affection === 4 && ${diagnostics}.pet.care?.kind === 'play'`));
    await app.clickSel('#pet-belongings > summary'); await app.clickSel('#pet-fabric-rose');
    t.check('rose belongings cost fifteen coins and change the actual room blanket', await app.js(`window.__littleHours.state.house.coins === 100 && ${bond('cat')}.care.fabric === 'rose' && ${diagnostics}.petBelongings.fabric === 'rose' && ${diagnostics}.petBelongings.blanket.isEnabled()`));
    await app.clickSel('#pet-fabric-linen'); await app.clickSel('#pet-fabric-rose');
    t.check('owned belongings can be changed freely', await app.js(`window.__littleHours.state.house.coins === 100`));
    await t.shot(app, 'belongings');
    await app.clickSel('#pet-edit-name'); await type(app, '#pet-name', 'Maple & Me'); await app.clickSel('#pet-name-form button');
    t.check('a personal name reaches the room and card', await app.text('#pet-button-label') === 'Maple & Me' && await app.text('.pet-card-identity h2') === 'Maple & Me', { label: await app.text('#pet-button-label'), saved: (await app.saved()).petBonds.cat.name });
    await app.reload(); await app.clickSel('#pet-button');
    t.check('coins, name, hearts, meal cooldown and belongings survive reload', await app.js(`${bond('cat')}.name === 'Maple & Me' && ${bond('cat')}.affection === 4 && ${bond('cat')}.care.fabric === 'rose' && ${bond('cat')}.care.meals === 1 && document.querySelector('#pet-feed').textContent.includes('Full') && window.__littleHours.state.house.coins === 100`));
    await app.clickSel('#pet-collection > summary'); await app.clickSel('[data-pet-choice="panda"]'); await app.clickSel('#pet-wish');
    t.check('a saving target survives and reaches the timer', (await app.saved()).petWish === 'panda' && (await app.text('#focus-reward')).includes('Kiki'));
    await app.clickSel('[data-pet-choice="fox"]'); await type(app, '#pet-adopt-name', 'Juniper'); await app.clickSel('#pet-adopt-button');
    t.check('welcoming a named fox spends its price once', await app.js(`window.__littleHours.state.pet === 'fox' && ${bond('fox')}.name === 'Juniper' && window.__littleHours.state.house.coins === 10`));
    await t.shot(app, 'welcome');
    await app.clickSel('#close-panel'); await app.clickSel('#start-button');
    t.check('starting focus adds an avatar sparkle', await app.js(`Boolean(document.querySelector('.room-delight[data-kind="start"]'))`));
    await t.close(app);

    const finish = await t.open({ seed: 'pet-finish' });
    await finish.clickSel('#start-button');
    await finish.waitFor(`document.querySelector('#session-celebration').open`, { timeout: 12000, what: 'the focus celebration' });
    t.check('focus grows the starting pet’s bond and unlocks its ribbon', await finish.js(`${bond('cat')}.affection === 8 && ${bond('cat')}.ribbon === 1`));
    t.check('completion keeps the room interactive and celebrates overhead', await finish.js(`!document.querySelector('#session-celebration').matches(':modal') && ${diagnostics}.celebrationAge < 3.2 && Boolean(document.querySelector('.room-delight[data-kind="finish"]'))`));
    t.check('completed study gives a daisy to the pet and displays its physical gift', await finish.js(`document.querySelector('#celebration-gift')?.textContent.includes('A daisy for you') && ${bond('cat')}.gift === 'daisy' && ${diagnostics}.petBelongings.gift.selected === 'daisy'`));
    await t.shot(finish, 'finish'); await finish.clickSel('#session-celebration .start-button'); await finish.clickSel('#pet-button');
    t.check('the unlocked ribbon is visible on the room pet', await finish.js(`${diagnostics}.petModel.ribbon === 1`));
    await t.shot(finish, 'bond'); await t.close(finish);

    const bonded = await t.open({ seed: 'pet-bonded', reducedMotion: true });
    await bonded.waitFor(`${diagnostics}.pet.state === 'sitting'`, { timeout: 10000, what: 'a bonded pet welcoming its returning player' });
    t.check('a returning player gets a pet welcome without losing hearts', await bonded.js(`${bond('cat')}.affection === 60 && ${diagnostics}.pet.action !== 'sleep'`));
    await bonded.clickSel('#pet-button'); await bonded.clickSel('#pet-nap');
    t.check('friendship unlocks a nap near the player, away from the pet bed', await bonded.js(`${diagnostics}.pet.action === 'sleep' && !${diagnostics}.pet.onBed`));
    await bonded.clickSel('#pet-friendship > summary'); await bonded.clickSel('#pet-dance');
    t.check('the final friendship unlock performs its room dance', await bonded.js(`${diagnostics}.pet.care?.kind === 'dance' && document.querySelectorAll('.pet-milestones .is-unlocked').length === 3`));
    await t.shot(bonded, 'friendship'); await t.close(bonded);

    const family = await t.open({ seed: 'pet-family', reducedMotion: true });
    await family.clickSel('#pet-button'); await family.clickSel('#pet-collection > summary');
    for (const id of ['cat', 'dog', 'bunny', 'fox', 'panda']) {
      await family.clickSel(`[data-pet-choice="${id}"]`);
      t.check(`${id} uses a live close-up without accumulating renderers`, await family.js(`window.__littleHours.petCloseup.species === '${id}' && window.__littleHours.counts().engines === 2`));
      await family.clickSel('#pet-collection > summary'); await t.shot(family, `closeup-${id}`); await family.clickSel('#pet-collection > summary');
    }
    await family.clickSel('[data-pet-choice="cat"]'); await family.clickSel('#pet-collection > summary'); await family.clickSel('#pet-gifts > summary');
    for (const gift of ['daisy', 'star', 'moon']) {
      await family.clickSel(`#pet-gift-${gift}`);
      t.check(`${gift} can be displayed freely in the room`, await family.js(`${diagnostics}.petBelongings.gift.selected === '${gift}' && window.__littleHours.state.house.coins === 0`));
      await t.shot(family, `gift-${gift}`);
    }
    await family.clickSel('#pet-gifts > summary'); await family.clickSel('#pet-closeup');
    t.check('touching the live face gives immediate affection', await family.js(`document.querySelector('#pet-closeup').dataset.reaction === 'cuddle' && ${bond('cat')}.affection === 62`));
    await family.clickSel('#pet-study');
    t.check('study together starts focus and settles the close-up to sleep', await family.js(`window.__littleHours.state.session.running && window.__littleHours.petCloseup.studying`));
    await t.shot(family, 'study-together'); await family.clickSel('#pet-study'); await family.clickSel('#close-panel');
    t.check('closing care releases its renderer', await family.js(`window.__littleHours.counts().engines === 1 && window.__littleHours.petCloseup === null`));
    await t.close(family);

    const mobile = await t.open({ seed: 'pet-shop', width: 390, height: 844, reducedMotion: true });
    await mobile.clickSel('#pet-button'); await mobile.clickSel('#pet-play');
    t.check('reduced motion shows play without particles or a walk', await mobile.js(`document.querySelectorAll('.room-delight i').length === 0 && ${diagnostics}.pet.care?.phase === 'active' && !${diagnostics}.pet.moving`));
    t.check('room and care actions are both visible on a phone', await mobile.js(`(() => { const room = document.querySelector('#stage').getBoundingClientRect(), action = document.querySelector('#pet-play').getBoundingClientRect(); return document.documentElement.scrollWidth <= innerWidth && room.top >= 0 && room.bottom <= action.top && action.bottom <= innerHeight; })()`));
    await t.shot(mobile, 'mobile');
    await idleCare(mobile);
    t.check('reduced motion care settles without getting stuck', await mobile.js(`${diagnostics}.pet.ritual === null`));
    await mobile.key('Escape');
    t.check('Escape restores the room and keyboard focus', await mobile.js(`document.getElementById('room-panel').hidden && document.activeElement.id === 'pet-button'`));
    await t.close(mobile);
  },
};
