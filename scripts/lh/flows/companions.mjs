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
export default {
  about: 'personal pet names, daily rituals, ribbons, adoption wishes, memory portraits, room celebrations, mobile and reduced motion',
  async run(t) {
    const app = await t.open({ seed: 'pet-shop' });
    await app.clickSel('#pet-button');
    await app.clickSel('[data-pet-ritual="play"]');
    t.check('play earns one heart and triggers a distinct pet animation', await app.js(`${bond('cat')}.affection === 1 && window.__littleHours.room.diagnostics().pet.ritual === 'play'`));
    t.check('a star burst is anchored over the pet', await app.js(`Boolean(document.querySelector('.room-delight[data-kind="play"][data-speaker="pet"]'))`));
    await t.shot(app, 'play'); await film(app, t, '01-play');
    await app.clickSel('[data-pet-ritual="play"]');
    t.check('repeat play stays available without farming hearts', await app.js(`${bond('cat')}.affection === 1`));
    await app.clickSel('[data-pet-ritual="cuddle"]');
    t.check('the cat’s favorite cuddle earns two hearts', await app.js(`${bond('cat')}.affection === 3`));
    await app.clickSel('[data-pet-ritual="treat"]');
    t.check('treat has its own animation', await app.js(`window.__littleHours.room.diagnostics().pet.ritual === 'treat'`));
    await app.clickSel('.pet-details summary');
    await type(app, '#pet-name', 'Maple & Me'); await app.clickSel('#pet-name-form button');
    t.check('a personal name reaches every label', await app.text('#pet-button-label') === 'Maple & Me' && await app.text('#pet-company') === 'You & Maple & Me', { label: await app.text('#pet-button-label'), saved: (await app.saved()).petBonds.cat.name });
    await type(app, '#pet-family', 'Dylan & Sam'); await app.key('Tab');
    await app.clickSel('#close-panel'); await app.reload(); await app.clickSel('#pet-button');
    t.check('names, rituals and family survive reload', await app.js(`${bond('cat')}.name === 'Maple & Me' && ${bond('cat')}.affection === 4 && window.__littleHours.state.petFamily === 'Dylan & Sam'`), { bond: (await app.saved()).petBonds.cat, family: (await app.saved()).petFamily });
    await app.clickSel('[data-pet-choice="panda"]'); await app.clickSel('#pet-wish');
    t.check('a focus wish is saved and shown on the timer', (await app.saved()).petWish === 'panda' && (await app.text('#focus-reward')).includes('Kiki'));
    await app.clickSel('[data-pet-choice="fox"]'); await type(app, '#pet-adopt-name', 'Juniper'); await app.clickSel('#pet-adopt-button');
    t.check('adoption creates a named companion and a welcome memory', await app.js(`window.__littleHours.state.pet === 'fox' && ${bond('fox')}.name === 'Juniper' && ${bond('fox')}.memories[0].kind === 'welcome' && window.__littleHours.state.house.coins === 30`));
    await t.sleep(650); await t.shot(app, 'welcome'); await film(app, t, '02-welcome');
    await app.clickSel('.pet-details:nth-of-type(2) summary');
    await app.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: t.out });
    await app.clickSel('#pet-save-portrait');
    await app.waitFor(`document.querySelector('.pet-portrait-status').textContent.includes('ready')`, { what: 'a generated portrait' });
    t.check('the pet portrait exports locally', (await app.text('.pet-portrait-status')).includes('ready'));
    await app.clickSel('#close-panel'); await app.clickSel('#start-button');
    t.check('starting focus adds a small avatar sparkle', await app.js(`Boolean(document.querySelector('.room-delight[data-kind="start"]'))`));
    await t.shot(app, 'focus-start');
    await t.close(app);

    const finish = await t.open({ seed: 'pet-finish' });
    await finish.waitFor(`document.querySelector('#session-celebration').open`, { timeout: 12000, what: 'the focus celebration' });
    t.check('finishing focus grows the starting pet’s bond', await finish.js(`${bond('cat')}.affection === 8 && ${bond('cat')}.ribbon === 1`));
    t.check('completion keeps the room interactive', await finish.js(`!document.querySelector('#session-celebration').matches(':modal')`));
    t.check('the avatar celebrates and a star appears overhead', await finish.js(`window.__littleHours.room.diagnostics().celebrationAge < 3.2 && Boolean(document.querySelector('.room-delight[data-kind="finish"]'))`));
    await film(finish, t, '03-finish');
    await t.sleep(400); await t.shot(finish, 'finish');
    await finish.clickSel('#session-celebration .start-button');
    await finish.clickSel('#pet-button');
    t.check('the unlocked ribbon is wearable in the room', await finish.js(`window.__littleHours.room.diagnostics().petModel.ribbon === 1`));
    await t.shot(finish, 'bond'); await film(finish, t, '04-bond', 2); await t.close(finish);

    const mobile = await t.open({ seed: 'pet-shop', width: 390, height: 844, reducedMotion: true });
    await mobile.clickSel('#pet-button'); await mobile.clickSel('[data-pet-ritual="play"]');
    t.check('reduced motion uses a still mark with no particle animation', await mobile.js(`document.querySelectorAll('.room-delight i').length === 0 && getComputedStyle(document.querySelector('.delight-medallion')).animationName === 'none'`));
    t.check('the notebook fits a phone without horizontal overflow', await mobile.js(`document.documentElement.scrollWidth <= innerWidth && document.querySelector('#room-panel').getBoundingClientRect().right <= innerWidth`));
    await t.shot(mobile, 'mobile');
    await mobile.key('Escape');
    t.check('Escape closes the notebook and restores keyboard focus', await mobile.js(`document.getElementById('room-panel').hidden && document.activeElement.id === 'pet-button'`));
    await t.close(mobile);
  },
};
