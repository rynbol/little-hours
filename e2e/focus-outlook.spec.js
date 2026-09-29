import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ready = page => expect(page.locator('#loading-note')).toBeHidden({ timeout: 30000 });
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('little-hours-v1')));

test('phone focus stays within reach and survives pause, reload and resume', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-09-29T12:00:00') });
  await page.goto('/'); await ready(page);
  const bar = page.locator('#focus-quickbar'), start = page.locator('#quick-focus-start');
  await expect(bar).toBeVisible(); await expect(bar.locator('time')).toHaveText('25:00');
  await page.screenshot({ path: '.lh/evidence/calm-phone-arrival.png' });
  await start.click(); await page.clock.fastForward('05:00'); await start.click();
  await expect(start).toHaveAccessibleName('Keep going');
  const remaining = await bar.locator('time').textContent();
  await page.reload(); await ready(page);
  await expect(bar.locator('time')).toHaveText(remaining); await start.click(); await expect(start).toHaveAccessibleName('Pause a moment');
  await start.click(); await page.locator('#quick-focus-settings').click();
  await expect(page.locator('#focus-card')).toBeFocused(); await expect(bar).toBeHidden();
  await page.screenshot({ path: '.lh/evidence/calm-phone-timer.png' });
  await expect(page.locator('#focus-goal')).toBeHidden(); await page.locator('#focus-progress > summary').click();
  await expect(page.locator('.focus-hearts')).toHaveText('+5 ♡Miso');
  await expect(page.locator('#focus-goal')).toContainText('Within reach after this session');
  expect((await new AxeBuilder({ page }).include('#focus-card').withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await page.locator('#rooms-button').click(); await expect(bar).toBeHidden();
  expect((await saved(page)).house.coins).toBe(0);
  await page.screenshot({ path: '.lh/evidence/study-phone-house.png' });
});

test('secondary room tools are tucked away and keyboard focus returns when they close', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/'); await ready(page);
  await expect(page.locator('#focus-options')).not.toHaveAttribute('open');
  await expect(page.locator('#focus-progress')).not.toHaveAttribute('open');
  await expect(page.locator('#task')).toBeHidden(); await expect(page.locator('#avatar-button')).toBeHidden();
  await page.locator('#room-more-toggle').click(); await expect(page.locator('#avatar-button')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.locator('#avatar-button')).toBeHidden();
  await expect(page.locator('#room-more-toggle')).toBeFocused();
  await page.locator('#room-more-toggle').click(); await page.locator('[data-panel="performance"]').click();
  await expect(page.locator('#room-more')).toBeHidden(); await page.locator('#close-panel').click();
  await expect(page.locator('#room-more-toggle')).toBeFocused();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()).violations).toEqual([]);
});

test('progress opens the newly affordable room without spending the reward', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.clock.install({ time: new Date('2026-09-29T12:00:00') });
  await page.goto('/'); await ready(page);
  await expect(page.locator('#focus-goal')).toBeHidden(); await page.locator('#focus-progress > summary').click();
  await expect(page.locator('#focus-goal')).toHaveAccessibleName('Greenhouse, 0 of 25 coins saved, available after this session');
  await page.locator('#start-button').click(); await page.clock.fastForward('25:01');
  await page.locator('#session-celebration .start-button').click(); await page.locator('#focus-goal').click();
  await expect(page.locator('#house-detail h2')).toHaveText('Greenhouse');
  expect((await saved(page)).house.coins).toBe(25); expect((await saved(page)).house.rooms).toHaveLength(1);
});

test('a wished-for pet leads to the adoption preview, then welcomes it only after a purchase', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.clock.install({ time: new Date('2026-09-29T12:00:00') });
  await page.addInitScript(() => { if (!sessionStorage.seeded) { localStorage.setItem('little-hours-v1', JSON.stringify({ petWish: 'bunny', house: { coins: 15 } })); sessionStorage.seeded = '1'; } });
  await page.goto('/'); await ready(page); await page.locator('#focus-progress > summary').click(); await page.locator('#focus-goal').click();
  await expect(page.locator('#pet-adopt-name')).toHaveValue('Dango'); await expect(page.locator('#pet-adopt-button')).toBeDisabled();
  await page.locator('#close-panel').click(); await page.locator('#start-button').click(); await page.clock.fastForward('25:01');
  await page.locator('#session-celebration .start-button').click(); await page.locator('#focus-goal').click();
  expect((await saved(page)).house.coins).toBe(40); expect((await saved(page)).pets).not.toContain('bunny');
  await page.locator('#pet-adopt-name').fill('Clover'); await page.locator('#pet-adopt-button').click();
  expect((await saved(page)).house.coins).toBe(0); expect((await saved(page)).pets).toContain('bunny');
  await expect(page.locator('#pet-ritual-status')).toHaveText('Welcome home, Clover ♡');
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 1024, height: 768 }, { width: 832, height: 1044 }, { width: 390, height: 844 }]) {
  test(`room navigation blends into the scene and controls fit at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport); await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/'); await ready(page);
    await expect(page.getByRole('button', { name: 'Little moments', exact: true })).toHaveCount(0);
    const header = await page.locator('.app-header').evaluate(el => {
      const css = getComputedStyle(el);
      return { background: css.backgroundColor, border: css.borderBottomWidth, position: css.position, height: el.getBoundingClientRect().height };
    });
    expect(header).toEqual({ background: 'rgba(0, 0, 0, 0)', border: '0px', position: 'relative', height: 58 });
    const tools = await page.locator('.room-tools').boundingBox();
    expect(tools.y + tools.height).toBeLessThan(viewport.height - (viewport.width < 1000 ? 76 : 0));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await page.locator('#room-more-toggle').click();
    const menu = await page.locator('#room-more').boundingBox();
    expect(menu.y).toBeGreaterThanOrEqual(0); expect(menu.y + menu.height).toBeLessThan(viewport.height);
    await page.getByRole('button', { name: 'Reset room view', exact: true }).click();
    await expect(page.locator('#room-more')).toBeHidden(); await expect(page.locator('#room-more-toggle')).toBeFocused();
    await page.screenshot({ path: `.lh/evidence/calm-room-${viewport.width}.png` });
  });
}
