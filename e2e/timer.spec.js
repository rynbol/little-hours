import { test, expect } from '@playwright/test';

const coins = page => page.locator('#coin-balance');
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('little-hours-v1')));

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-25T10:00:00') });
  await page.goto('/');
});

test('a focus session survives pausing and a reload, then completes exactly once', async ({ page }) => {
  const start = page.locator('#start-button');
  await expect(page.locator('#timer')).toHaveText('25:00');
  await expect(page.locator('#timer')).toHaveAttribute('aria-label', '25 minutes remaining');
  await expect(coins(page)).toHaveText('0');

  await start.click();
  await expect(start).toHaveText(/Pause a moment/);
  await page.clock.fastForward('05:00');
  await expect(page.locator('#timer')).toHaveText(/^(19:5\d|20:00)$/);
  await start.click();
  await expect(start).toHaveText(/Keep going/);
  const pausedAt = await page.locator('#timer').textContent();

  await page.reload();
  await expect(page.locator('#timer')).toHaveText(pausedAt);
  await expect(page.locator('#start-button')).toHaveText(/Keep going/);
  await expect(page.locator('#stage-presence')).toHaveAttribute('data-presence', 'break');

  await page.locator('#start-button').click();
  await page.clock.fastForward('21:00');
  await expect(page.locator('#session-celebration')).toBeVisible();
  await expect(page.locator('#celebration-earned')).toHaveText('+25 coins');
  await expect(coins(page)).toHaveText('25');
  await page.locator('#session-celebration .start-button').click();

  // Later ticks, a reload and another hour never pay the same session again.
  await page.clock.fastForward('01:00:00');
  await page.reload();
  await expect(coins(page)).toHaveText('25');
  const state = await saved(page);
  expect(state.history).toEqual([{ date: '2026-09-25', minutes: 25 }]);
  expect(state.house.coins).toBe(25);
});

test('a running session keeps counting while the page is closed', async ({ page }) => {
  await page.locator('#start-button').click();
  await page.reload();
  await expect(page.locator('#start-button')).toHaveText(/Pause a moment/);
  await page.clock.fastForward('25:00');
  await expect(page.locator('#session-celebration')).toBeVisible();
  await expect(coins(page)).toHaveText('25');
});

test('the chime preference is remembered', async ({ page }) => {
  const chime = page.locator('#chime-toggle');
  await expect(chime).toBeChecked();
  await chime.uncheck();
  await page.reload();
  await expect(page.locator('#chime-toggle')).not.toBeChecked();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('little-hours-sound')))).toEqual({ volume: 30, chime: false });
});
