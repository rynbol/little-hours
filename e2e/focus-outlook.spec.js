import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ready = page => expect(page.locator('#loading-note')).toBeHidden({ timeout: 30000 });
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('little-hours-v1')));

test('phone focus stays within reach and survives pause, reload and resume', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-09-29T12:00:00') });
  await page.goto('/'); await ready(page);
  const bar = page.locator('#focus-quickbar'), start = page.locator('#start-button');
  await expect(bar).toBeVisible(); await expect(bar.locator('time')).toHaveText('25:00');
  await page.screenshot({ path: '.lh/evidence/calm-phone-arrival.png' });
  await start.click(); await expect(start).toHaveText(/Pause/); await page.clock.fastForward('05:00'); await start.click();
  await expect(start).toHaveAccessibleName('Keep going');
  const remaining = await bar.locator('time').textContent();
  await page.reload(); await ready(page);
  await expect(bar.locator('time')).toHaveText(remaining); await start.click(); await expect(start).toHaveAccessibleName('Pause a moment');
  await start.click(); await page.locator('#timer-sheet-toggle').click();
  await expect(page.locator('#focus-card')).toBeVisible(); await expect(bar).toBeVisible();
  await page.screenshot({ path: '.lh/evidence/calm-phone-timer.png' });
  expect((await new AxeBuilder({ page }).include('#focus-card').withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await page.locator('#rooms-button').click(); await expect(bar).toBeHidden();
  expect((await saved(page)).house.coins).toBe(0);
  await page.screenshot({ path: '.lh/evidence/study-phone-house.png' });
});

test('secondary room tools are tucked away and keyboard focus returns when they close', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/'); await ready(page);
  await expect(page.locator('#avatar-button')).toBeHidden();
  await page.locator('#room-more-toggle').click(); await expect(page.locator('#avatar-button')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.locator('#avatar-button')).toBeHidden();
  await expect(page.locator('#room-more-toggle')).toBeFocused();
  await page.locator('#room-more-toggle').click(); await page.locator('[data-panel="performance"]').click();
  await expect(page.locator('#room-more')).toBeHidden(); await page.locator('#close-panel').click();
  await expect(page.locator('#room-more-toggle')).toBeFocused();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()).violations).toEqual([]);
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 1024, height: 768 }, { width: 832, height: 1044 }, { width: 390, height: 844 }]) {
  test(`room tools and the More menu fit at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport); await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/'); await ready(page);
    await expect(page.locator('.app-header, .app-footer, #home-connections')).toHaveCount(0);
    const tools = await page.locator('.room-tools').boundingBox(), pill = await page.locator('#focus-quickbar').boundingBox();
    expect(tools.y + tools.height).toBeLessThanOrEqual(viewport.height); expect(tools.x + tools.width).toBeLessThanOrEqual(pill.x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await page.locator('#room-more-toggle').click();
    const menu = await page.locator('#room-more').boundingBox();
    expect(menu.y).toBeGreaterThanOrEqual(0); expect(menu.y + menu.height).toBeLessThan(viewport.height);
    await page.getByRole('button', { name: 'Reset room view', exact: true }).click();
    await expect(page.locator('#room-more')).toBeHidden(); await expect(page.locator('#room-more-toggle')).toBeFocused();
    await page.screenshot({ path: `.lh/evidence/calm-room-${viewport.width}.png` });
  });
}
