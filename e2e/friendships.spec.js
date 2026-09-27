import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('little-hours-v1')));
const pairKey = (a, b) => JSON.stringify([`pet:${a}`, `pet:${b}`].sort());
const openCompanions = async page => {
  await page.goto('/');
  await expect(page.locator('#loading-note')).toBeHidden();
  await page.locator('#pet-button').click();
};
const accessiblePage = async page => {
  const result = await new AxeBuilder({ page }).include('#room-panel').analyze();
  expect(result.violations).toEqual([]);
};
const concisePage = async page => {
  await expect(page.locator('.pet-page-intro p, .pet-portrait-note, .pet-loves, .pet-section-heading p, .pet-page-footer')).toHaveCount(0);
  await expect(page.locator('.pet-section-heading h3')).toHaveText(['Time together.', 'Better together.', 'Keepsakes.']);
};

test('friendship moments belong to a pair, refresh daily, and export both pets', async ({ page }, testInfo) => {
  await page.clock.install({ time: new Date('2026-09-27T12:00:00') });
  await openCompanions(page);
  await expect(page.getByRole('region', { name: 'Companions' })).toBeVisible();
  await concisePage(page);
  await expect(page.locator('#pet-ritual-status')).toBeEmpty();
  await expect(page.locator('[data-pet-ritual="cuddle"] small')).toHaveText('+2 ♡');
  await expect(page.locator('[data-pet-ritual="cuddle"]')).toHaveAccessibleName('Give Miso a pet, Earn 2 hearts');
  await expect(page.locator('.pet-bond-heading > span')).toHaveAccessibleName('0 hearts');
  expect(await page.locator('#focus-card').evaluate(node => node.inert)).toBe(true);
  await page.locator('[data-pet-tab="together"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-pet-tab="friends"]')).toBeFocused();
  await expect(page.locator('[data-pet-tab="friends"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-pet-friend]')).toHaveCount(1);
  await expect(page.locator('[data-pet-friend="dog"]')).toBeVisible();
  await expect(page.locator('#pet-friend-status')).toBeEmpty();
  await expect(page.locator('.pet-friend-progress > span').first()).toHaveAccessibleName('0 friendship hearts');
  expect(await page.locator('#pet-friend-scene [data-species]').evaluateAll(nodes => nodes.map(node => node.dataset.species))).toEqual(['cat', 'dog']);
  for (const kind of ['play', 'snack', 'quiet']) {
    const moment = page.locator(`[data-friend-moment="${kind}"]`);
    await expect(moment.locator('small')).toHaveText('+1 ♡');
    await expect(moment).toHaveAccessibleName(/Earn 1 friendship heart/);
    await moment.click();
    await expect(page.locator('#pet-friend-status')).toHaveText('+1 ♡');
    await expect(page.locator('#pet-friend-status')).toHaveAccessibleName('1 friendship heart for Miso & Mochi');
    await expect(page.locator('#pet-friend-scene')).toHaveAttribute('data-moment', kind);
    await expect(moment.locator('small')).toHaveText('✓');
    await expect(moment).toHaveAccessibleName(/Shared today/);
    await moment.click();
    await expect(page.locator('#pet-friend-status')).toHaveText('♡');
    await expect(page.locator('#pet-friend-status')).toHaveAccessibleName('Shared today');
  }
  const key = pairKey('cat', 'dog');
  const first = (await saved(page)).friendships.pairs[key];
  expect(first.affection).toBe(3);
  expect(first.memories).toHaveLength(3);
  expect(first.rewardedMoments).toEqual(['play', 'snack', 'quiet']);
  await expect(page.locator('.pet-friend-progress > span').first()).toHaveAccessibleName('3 friendship hearts');
  await page.locator('[data-pet-choice="dog"]').click();
  await expect(page.locator('#pet-friend-scene h4')).toHaveText('Mochi & Miso');
  await page.locator('[data-friend-moment="play"]').click();
  expect(Object.keys((await saved(page)).friendships.pairs)).toEqual([key]);
  expect((await saved(page)).friendships.pairs[key].affection).toBe(3);
  await accessiblePage(page);
  await page.clock.fastForward('24:00:00');
  await expect(page.locator('[data-friend-moment] small')).toHaveText(['+1 ♡', '+1 ♡', '+1 ♡']);
  await expect(page.locator('[data-friend-moment="play"]')).toHaveAccessibleName(/Earn 1 friendship heart/);
  await page.locator('[data-friend-moment="play"]').click();
  expect((await saved(page)).friendships.pairs[key].affection).toBe(4);
  await page.locator('[data-friend-moment="snack"]').click();
  await page.locator('[data-friend-moment="quiet"]').click();
  expect((await saved(page)).friendships.pairs[key].affection).toBe(6);
  await expect(page.locator('#pet-friend-scene > p')).toHaveText('Finding a rhythm');
  await expect(page.locator('#pet-friend-status')).toHaveText('Finding a rhythm · frame unlocked');
  await page.locator('[data-pet-choice="cat"]').click();
  await page.locator('[data-pet-tab="friends"]').focus();
  await page.keyboard.press('End');
  await expect(page.locator('[data-pet-tab="keepsakes"]')).toBeFocused();
  await accessiblePage(page);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#pet-save-duo').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('our-little-friends.png');
  const path = testInfo.outputPath('miso-and-mochi.png');
  await download.saveAs(path);
  const stream = await download.createReadStream(), chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const png = Buffer.concat(chunks);
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(1500);
  const artwork = await page.evaluate(async source => {
    const image = new Image(); image.src = source; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const countColor = (x, y, width, height, color) => {
      const pixels = context.getImageData(x, y, width, height).data;
      let count = 0;
      for (let i = 0; i < pixels.length; i += 4) if (color.every((value, j) => Math.abs(pixels[i + j] - value) <= 3)) count++;
      return count;
    };
    return {
      cat: countColor(220, 390, 330, 430, [212, 144, 79]),
      dog: countColor(650, 390, 330, 430, [239, 221, 189]),
      roseFrame: countColor(40, 200, 10, 1000, [190, 144, 154]),
    };
  }, `data:image/png;base64,${png.toString('base64')}`);
  expect(artwork.cat, 'the left illustration contains the ginger cat').toBeGreaterThan(800);
  expect(artwork.dog, 'the right illustration contains the cream puppy').toBeGreaterThan(800);
  expect(artwork.roseFrame, 'the first friendship milestone appears as a rose portrait frame').toBeGreaterThan(1500);
  await testInfo.attach('Miso and Mochi portrait', { path, contentType: 'image/png' });
  await page.keyboard.press('Escape');
  await expect(page.locator('#room-panel')).toBeHidden();
  await expect(page.locator('#pet-button')).toBeFocused();
  expect(await page.locator('#focus-card').evaluate(node => node.inert)).toBe(false);
  await page.reload();
  expect((await saved(page)).friendships.pairs[key].affection).toBe(6);
});

test('focus company survives changed preferences, primary pet, pause and reload', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-27T12:00:00') });
  await openCompanions(page);
  await page.locator('#pet-focus-buddy').selectOption('dog');
  await page.locator('#close-panel').click();
  await expect(page.locator('#focus-reward')).toContainText('Miso & Mochi');
  await page.locator('#start-button').click();
  await page.clock.fastForward('01:00');
  await page.locator('#start-button').click();
  await page.locator('#pet-button').click();
  await page.locator('[data-pet-choice="dog"]').click();
  await page.locator('[data-pet-tab="friends"]').click();
  await page.locator('#pet-focus-pair').click();
  await expect(page.locator('#room-panel')).toBeVisible();
  await expect(page.locator('#pet-friend-status')).toHaveText('Ready');
  await expect(page.locator('#pet-friend-status')).toHaveAccessibleName('Mochi & Miso chosen for next focus');
  expect((await saved(page)).session.friendPair).toEqual(['pet:cat', 'pet:dog']);
  await page.locator('[data-pet-tab="together"]').click();
  await page.locator('#pet-focus-buddy').selectOption('');
  await expect(page.locator('.pet-current-company')).toContainText('Miso & Mochi');
  expect((await saved(page)).friendships.focusBuddies['pet:dog']).toBeUndefined();
  await page.locator('#close-panel').click();
  await expect(page.locator('#pet-button')).toBeFocused();
  await page.reload();
  await expect(page.locator('#loading-note')).toBeHidden();
  await page.locator('#start-button').click();
  await page.clock.fastForward('24:01');
  await expect(page.locator('#celebration-copy')).toContainText('Miso & Mochi');
  await expect(page.locator('#celebration-friendship')).toContainText('+5 ♡ · Miso & Mochi');
  await expect(page.locator('#celebration-bond')).toContainText('+5 ♡ · Miso');
  const first = await saved(page), key = pairKey('cat', 'dog');
  expect(first.friendships.pairs[key]).toMatchObject({ affection: 5, minutes: 25, sessions: 1 });
  expect(first.petBonds.cat.minutes).toBe(25);
  expect(first.petBonds.dog.minutes).toBe(0);
  expect(first.house.coins).toBe(25);
  await page.locator('#session-celebration .start-button').click();
  await page.reload();
  expect((await saved(page)).friendships.pairs[key].sessions).toBe(1);
  await page.locator('#start-button').click();
  expect((await saved(page)).session.friendPair).toBeNull();
  await page.clock.fastForward('25:01');
  await expect(page.locator('#celebration-friendship')).toBeHidden();
  expect((await saved(page)).friendships.pairs[key].sessions).toBe(1);
  expect((await saved(page)).petBonds.dog.minutes).toBe(25);
});

test('the phone page keeps friendship, keepsakes and adoption readable and accessible', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openCompanions(page);
  await page.locator('[data-pet-tab="friends"]').click();
  await concisePage(page);
  await page.locator('[data-friend-moment="play"]').click();
  const animations = await page.locator('#pet-friend-scene svg *').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).animationName));
  expect(animations.every(name => name === 'none')).toBe(true);
  const controls = await page.locator('.pet-shared-moments button').evaluateAll(nodes => nodes.map(node => {
    const bounds = node.getBoundingClientRect(), label = node.querySelector('strong');
    return { width: bounds.width, height: bounds.height, fontSize: parseFloat(getComputedStyle(label).fontSize), fits: label.scrollWidth <= label.clientWidth };
  }));
  for (const control of controls) {
    expect(control.width).toBeGreaterThanOrEqual(44);
    expect(control.height).toBeGreaterThanOrEqual(44);
    expect(control.fontSize).toBeGreaterThanOrEqual(12);
    expect(control.fits).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.getElementById('room-panel').scrollWidth <= document.getElementById('room-panel').clientWidth)).toBe(true);
  await accessiblePage(page);
  await page.screenshot({ path: testInfo.outputPath('friends-phone.png') });
  await page.locator('[data-pet-tab="keepsakes"]').click();
  await accessiblePage(page);
  await page.locator('[data-pet-choice="panda"]').click();
  await expect(page.locator('#pet-adopt')).toBeVisible();
  await expect(page.locator('#pet-adopt-name')).toBeFocused();
  await expect(page.locator('#pet-adopt-button')).toBeDisabled();
  await expect(page.locator('#pet-wish')).toBeVisible();
  await accessiblePage(page);
  await page.screenshot({ path: testInfo.outputPath('adoption-phone.png') });
  await page.locator('#close-panel').click();
  await expect(page.locator('#pet-button')).toBeFocused();
});
