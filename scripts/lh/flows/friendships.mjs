import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const key = (a, b) => JSON.stringify([`pet:${a}`, `pet:${b}`].sort());
const pair = async (app, a, b) => (await app.saved()).friendships.pairs[key(a, b)];

export default {
  about: 'the companion page: friendship moments, shared history, owned friend choices, next-session company, duo portraits, keyboard return and reduced-motion phone layout',
  async run(t) {
    const app = await t.open({ seed: 'pet-shop' });
    await app.clickSel('#pet-button');
    t.check('the companion page makes covered room controls inert', await app.js(`document.querySelector('#focus-card').inert && document.querySelector('#room-panel').getAttribute('aria-label') === 'Companions'`));
    t.check('the page keeps concise headings without decorative subtitles', await app.js(`!document.querySelector('.pet-page-intro p, .pet-portrait-note, .pet-loves, .pet-section-heading p, .pet-page-footer') && JSON.stringify([...document.querySelectorAll('.pet-section-heading h3')].map(node => node.textContent)) === JSON.stringify(['Time together.', 'Better together.', 'Keepsakes.']) && document.querySelector('#pet-ritual-status').textContent === ''`));
    await app.clickSel('[data-pet-tab="friends"]');
    t.check('only the other owned pet can be a friend', await app.js(`JSON.stringify([...document.querySelectorAll('[data-pet-friend]')].map(node => node.dataset.petFriend)) === JSON.stringify(['dog'])`));
    t.check('heart rewards and counts have readable accessible names', await app.js(`[...document.querySelectorAll('[data-friend-moment] small')].every(node => node.textContent === '+1 ♡' && node.getAttribute('role') === 'img' && node.getAttribute('aria-label') === 'Earn 1 friendship heart') && document.querySelector('.pet-bond-heading > span').getAttribute('aria-label') === '0 hearts' && document.querySelector('.pet-friend-progress > span').getAttribute('aria-label') === '0 friendship hearts' && document.querySelector('#pet-friend-status').textContent === ''`));
    for (const kind of ['play', 'snack', 'quiet']) {
      await app.clickSel(`[data-friend-moment="${kind}"]`);
      t.check(`${kind} stages two pets and awards a shared moment`, await app.js(`document.querySelector('#pet-friend-scene').dataset.moment === '${kind}' && document.querySelectorAll('#pet-friend-scene [data-species]').length === 2 && document.querySelector('[data-friend-moment="${kind}"] small').textContent === '✓' && document.querySelector('[data-friend-moment="${kind}"] small').getAttribute('aria-label') === 'Shared today'`) && await app.text('#pet-friend-status') === '+1 ♡');
      await app.clickSel(`[data-friend-moment="${kind}"]`);
    }
    const first = await pair(app, 'cat', 'dog');
    t.check('repeating all three moments gives no extra hearts or memories', first.affection === 3 && first.memories.length === 3, first);
    t.check('the saved friendship count stays accessible after repeated moments', await app.attr('.pet-friend-progress > span', 'aria-label') === '3 friendship hearts' && await app.text('#pet-friend-status') === '♡');
    await t.shot(app, 'shared-moments');
    await app.clickSel('[data-pet-choice="dog"]');
    await app.clickSel('[data-friend-moment="play"]');
    t.check('reversing the primary pet preserves one friendship', Object.keys((await app.saved()).friendships.pairs).length === 1 && (await pair(app, 'cat', 'dog')).affection === 3);
    await app.clickSel('[data-pet-choice="fox"]');
    await app.clickSel('#pet-adopt-button');
    await app.clickSel('[data-pet-tab="friends"]');
    t.check('adoption adds the new friend while locked pets stay out of the picker', await app.js(`JSON.stringify([...document.querySelectorAll('[data-pet-friend]')].map(node => node.dataset.petFriend).sort()) === JSON.stringify(['cat','dog'])`));
    await app.clickSel('[data-pet-friend="cat"]');
    await app.clickSel('[data-friend-moment="snack"]');
    await app.clickSel('[data-pet-friend="dog"]');
    await app.clickSel('[data-friend-moment="quiet"]');
    t.check('each of three pairs keeps its own progress', (await pair(app, 'cat', 'dog')).affection === 3 && (await pair(app, 'cat', 'fox')).affection === 1 && (await pair(app, 'dog', 'fox')).affection === 1);
    await app.clickSel('#pet-focus-pair');
    t.check('choosing a pair prepares focus without starting a timer', await app.js(`document.querySelector('#room-panel').hidden && document.activeElement.id === 'start-button'`) && !(await app.saved()).session.running && (await app.saved()).friendships.focusBuddies['pet:fox'] === 'pet:dog');
    await app.clickSel('#start-button');
    t.check('starting focus captures the pair selected in the page', JSON.stringify((await app.saved()).session.friendPair) === JSON.stringify(['pet:dog', 'pet:fox']));
    await app.clickSel('#pet-button');
    await app.clickSel('[data-pet-choice="cat"]');
    await app.clickSel('[data-pet-tab="friends"]');
    await app.clickSel('[data-pet-friend="dog"]');
    await app.clickSel('#pet-focus-pair');
    t.check('preparing another pair leaves the running session intact', JSON.stringify((await app.saved()).session.friendPair) === JSON.stringify(['pet:dog', 'pet:fox']) && await app.text('#pet-friend-status') === 'Ready' && await app.attr('#pet-friend-status', 'aria-label') === 'Miso & Mochi chosen for next focus');
    await app.clickSel('[data-pet-tab="together"]');
    t.check('the buddy preference and current company are distinct', await app.attr('#pet-focus-buddy option[value="dog"]', 'selected') === '' && (await app.text('.pet-current-company')).includes('Mochi & Hoshi'));
    await app.clickSel('[data-pet-tab="keepsakes"]');
    await app.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: t.out });
    await app.clickSel('#pet-save-duo');
    await app.waitFor(`document.querySelector('.pet-portrait-status').textContent === 'Saved'`, { what: 'the downloaded friendship portrait' });
    const path = join(t.out, 'our-little-friends.png');
    for (let i = 0; i < 20 && !existsSync(path); i++) await t.sleep(100);
    const png = existsSync(path) ? readFileSync(path) : null;
    t.check('the two-pet portrait downloads as a 1200 by 1500 PNG', Boolean(png && png.subarray(1, 4).toString() === 'PNG' && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 1500));
    await t.shot(app, 'keepsakes');
    await app.key('Escape');
    t.check('Escape returns focus and unlocks room controls', await app.js(`document.querySelector('#room-panel').hidden && document.activeElement.id === 'pet-button' && !document.querySelector('#focus-card').inert`));
    await app.reload();
    t.check('friendships and captured company survive reload', (await pair(app, 'cat', 'dog')).affection === 3 && JSON.stringify((await app.saved()).session.friendPair) === JSON.stringify(['pet:dog', 'pet:fox']));
    await t.close(app);

    const mobile = await t.open({ seed: 'pet-shop', width: 390, height: 844, reducedMotion: true });
    await mobile.clickSel('#pet-button'); await mobile.clickSel('[data-pet-tab="friends"]');
    await mobile.clickSel('[data-friend-moment="play"]');
    t.check('reduced motion keeps both pets still during a shared scene', await mobile.js(`document.querySelectorAll('#pet-friend-scene [data-species]').length === 2 && [...document.querySelectorAll('#pet-friend-scene svg *')].every(node => getComputedStyle(node).animationName === 'none')`));
    t.check('the friendship page fits the phone without horizontal scrolling', await mobile.js(`document.documentElement.scrollWidth <= innerWidth && document.querySelector('#room-panel').scrollWidth <= document.querySelector('#room-panel').clientWidth`));
    await t.shot(mobile, 'phone-friends');
    await mobile.clickSel('[data-pet-tab="keepsakes"]');
    await t.shot(mobile, 'phone-keepsakes');
    await mobile.clickSel('#close-panel');
    t.check('Back to room restores the phone opener', await mobile.js(`document.querySelector('#room-panel').hidden && document.activeElement.id === 'pet-button'`));
    await t.close(mobile);
  },
};
