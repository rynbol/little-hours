import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedState } from '../scripts/lh/seeds.mjs';
import { restoreState } from '../src/core/state.js';

const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('little-hours-v1')));
async function arrive(page, seed = 'three-rooms') {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(state => localStorage.setItem('little-hours-v1', JSON.stringify(state)), seedState(seed));
  await page.goto('/');
  await expect(page.locator('#loading-note')).toBeHidden({ timeout: 30000 });
  await page.locator('#rooms-button').click();
  await expect(page.locator('#house-canvas canvas')).toBeVisible({ timeout: 30000 });
}

for (const width of [1440, 900, 390]) {
  test(`${width}px island starts clear and discloses room details with keyboard return`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await arrive(page);
    await expect(page.locator('#house-detail')).toBeHidden();
    await expect(page.locator('#house-room-menu')).toBeHidden();
    const before = (await saved(page)).house;
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await page.locator('#house-canvas').boundingBox()).width).toBeGreaterThan(width * .85);
    await page.screenshot({ path: `.lh/evidence/island-arrival-${width}.png` });
    await page.locator('#house-rooms-toggle').click();
    await expect(page.getByRole('dialog', { name: 'Rooms in your house' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#house-rooms-toggle')).toBeFocused();
    await expect(page.locator('#house-page')).toBeVisible();
    await page.locator('#house-rooms-toggle').click();
    await page.locator('#house-slot-loft').click();
    await expect(page.locator('#house-detail h2')).toHaveText('Upstairs hideaway');
    await expect(page.locator('#house-detail h2')).toBeFocused();
    await expect(page.locator('#house-room-menu')).toBeHidden();
    await expect(page.locator('#room-name-form')).toBeHidden();
    await expect(page.locator('#enter-house-room')).toBeVisible();
    const card = await page.locator('#house-detail').boundingBox();
    expect(card.x).toBeGreaterThanOrEqual(0);
    expect(card.x + card.width).toBeLessThanOrEqual(width);
    expect(card.height).toBeLessThan(360);
    expect((await new AxeBuilder({ page }).include('#house-detail').analyze()).violations).toEqual([]);
    await page.screenshot({ path: `.lh/evidence/island-room-${width}.png` });
    await page.keyboard.press('Escape');
    await expect(page.locator('#house-detail')).toBeHidden();
    await expect(page.locator('#house-rooms-toggle')).toBeFocused();
    expect((await saved(page)).house).toEqual(before);
    await page.locator('#house-open-pond').click();
    await expect(page.locator('#lake-page')).toBeVisible();
    await page.locator('#lake-back').click();
    await expect(page.locator('#house-open-pond')).toBeFocused();
    await expect(page.locator('#house-detail')).toBeHidden();
    await page.locator('#house-open-garden').click();
    await expect(page.locator('#garden-back')).toBeVisible();
    await page.locator('#garden-back').click();
    await expect(page.locator('#house-open-garden')).toBeFocused();
    await expect(page.locator('#house-detail')).toBeHidden();
    await page.locator('#back-to-room').click();
    await expect(page.locator('#room-section')).toBeVisible();
  });
}

test('room planning keeps previews free and builds the named design once', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await arrive(page, 'one-room-rich');
  const before = (await saved(page)).house;
  await page.locator('#house-rooms-toggle').click();
  await page.locator('#house-slot-garden').click();
  await expect(page.locator('#house-detail h2')).toHaveText('Greenhouse');
  await expect(page.locator('.house-designs')).toBeHidden();
  await page.locator('#house-design-options > summary').click();
  await expect.poll(() => page.locator('.house-design-thumb img').evaluateAll(images => images.length === 6 && images.every(image => image.complete && image.naturalWidth === 720))).toBe(true);
  await page.locator('[data-house-design="cloud-loft"]').click();
  await expect(page.locator('#house-canvas')).toHaveAttribute('aria-label', /Cloud loft/);
  await page.locator('#new-room-name').fill('Our Sunday corner ♡');
  await page.locator('#house-design-options > summary').click();
  expect((await saved(page)).house).toEqual(before);
  expect((await new AxeBuilder({ page }).include('#house-detail').analyze()).violations).toEqual([]);
  expect((await page.locator('#house-detail').boundingBox()).width).toBeGreaterThan(350);
  await page.screenshot({ path: '.lh/evidence/island-plan-390.png' });
  await page.locator('#build-house-room').click();
  await expect(page.locator('#house-detail h2')).toHaveText('Our Sunday corner ♡');
  const built = (await saved(page)).house;
  expect(built.rooms).toHaveLength(2);
  expect(built.coins).toBe(before.coins - 25);
  expect(built.rooms[1].layout.presetId).toBe('cloud-loft');
  await page.locator('#room-name-details > summary').click();
  await page.locator('#room-name-input').fill('A room for us');
  await page.locator('#room-name-input').press('Enter');
  await expect(page.locator('#house-detail h2')).toHaveText('A room for us');
  expect((await saved(page)).house.rooms[1].name).toBe('A room for us');
  await page.locator('#enter-house-room').click();
  await expect(page.locator('#room-title')).toHaveText('A room for us');
  await expect(page.locator('#room-title')).toBeFocused();
  expect((await saved(page)).house.coins).toBe(before.coins - 25);
});

test('island postcards preserve the rendered house and include only the chosen sky', async ({ page }) => {
  await arrive(page);
  const before = restoreState(await saved(page)).house;
  for (const night of [true, false]) {
    if (!night) await page.locator('#time-toggle').click();
    await expect(page.locator('.island-sky [data-celestial="moon"]')).toHaveCount(night ? 1 : 0);
    await page.locator('#house-postcard').click();
    await expect(page.locator('#house-postcard-dialog')).toBeVisible();
    const pixels = await page.locator('#house-postcard-dialog img').evaluate(async image => {
      await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let moon = 0, house = 0;
      for (let y = 339; y < 449; y++) for (let x = 220; x < 325; x++) { const p = (y * canvas.width + x) * 4; if (data[p] > 245 && data[p + 1] > 230 && data[p + 2] < 220) moon++; }
      for (let y = 330; y < 800; y++) for (let x = 380; x < 1200; x++) { const p = (y * canvas.width + x) * 4; if (data[p] > data[p + 2] * 1.15 && data[p + 1] > data[p + 2] * 1.08 && data[p] < 200) house++; }
      return { moon, house, width: canvas.width, height: canvas.height };
    });
    expect(pixels).toMatchObject({ width: 1600, height: 1200 });
    expect(pixels.house).toBeGreaterThan(2000);
    if (night) expect(pixels.moon).toBeGreaterThan(1200);
    else expect(pixels.moon).toBeLessThan(100);
    await page.locator('#house-postcard-dialog').screenshot({ path: `.lh/evidence/island-postcard-${night ? 'night' : 'day'}.png` });
    const download = page.waitForEvent('download'); await page.locator('#download-postcard').click();
    expect((await download).suggestedFilename()).toBe('little-hours-postcard.png');
    await page.keyboard.press('Escape');
    await expect(page.locator('#house-postcard')).toBeFocused();
  }
  expect(restoreState(await saved(page)).house).toEqual(before);
});
