import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ready = page => expect(page.locator('#loading-note')).toBeHidden({ timeout: 30000 });
const sheet = page => page.locator('#focus-card');
const toggle = page => page.locator('#timer-sheet-toggle');

async function open(page, viewport) {
  await page.setViewportSize(viewport); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-09-30T12:00:00') });
  await page.goto('/'); await ready(page);
}

const box = locator => locator.evaluate(element => { const rect = element.getBoundingClientRect(); return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }; });

for (const viewport of [{ width: 1440, height: 900 }, { width: 430, height: 932 }, { width: 390, height: 844 }, { width: 360, height: 740 }]) {
  test(`the timer pill sits at the bottom of a ${viewport.width}px room and opens the sheet above it`, async ({ page }, testInfo) => {
    await open(page, viewport);
    await expect(page.locator('#focus-quickbar')).toBeVisible(); await expect(sheet(page)).toBeHidden();
    await expect(toggle(page).locator('time')).toHaveText('25:00');
    await expect(toggle(page)).toHaveAccessibleName('Focus timer, 25 minutes remaining');
    await expect(page.locator('#start-button')).toHaveText('Start'); await expect(page.locator('#start-button')).toHaveAccessibleName('Start focusing');
    const pill = await box(page.locator('#focus-quickbar')), tools = await box(page.locator('.room-tools'));
    expect(pill.bottom).toBeLessThanOrEqual(viewport.height); expect(pill.top).toBeGreaterThan(viewport.height * 2 / 3);
    expect(pill.left).toBeGreaterThanOrEqual(0); expect(pill.right).toBeLessThanOrEqual(viewport.width);
    expect(pill.left >= tools.right || pill.bottom <= tools.top).toBe(true);
    for (const button of ['#timer-sheet-toggle', '#start-button', '#pet-button', '#buddy-tool']) {
      const target = await box(page.locator(button)); expect(target.width).toBeGreaterThanOrEqual(44); expect(target.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: testInfo.outputPath(`timer-pill-${viewport.width}.png`) });
    await toggle(page).click();
    await expect(sheet(page)).toBeVisible();
    const card = await box(sheet(page));
    expect(card.bottom).toBeLessThanOrEqual(pill.top); expect(card.top).toBeGreaterThanOrEqual(0);
    expect(card.left).toBeGreaterThanOrEqual(0); expect(card.right).toBeLessThanOrEqual(viewport.width);
    if (viewport.width <= 720) { expect(card.left).toBe(8); expect(card.right).toBe(viewport.width - 8); }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`timer-sheet-${viewport.width}.png`) });
  });
}

test('the sheet holds the timer settings and closes with Escape, an outside tap or its close button', async ({ page }) => {
  await open(page, { width: 390, height: 844 });
  await toggle(page).focus(); await page.keyboard.press('Enter');
  await expect(sheet(page)).toBeVisible(); await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true');
  for (const control of ['#timer-ring', '[data-minutes="25"]', '[data-minutes="50"]', '[data-minutes="90"]', '#task', '#sound-button', '#chime-toggle', '#focus-mode-enter']) await expect(sheet(page).locator(control)).toBeVisible();
  await expect(sheet(page).locator('.card-top, .focus-intro, .timer-caption, #session-label, #daily-note, #start-button')).toHaveCount(0);
  expect((await new AxeBuilder({ page }).include('#focus-card').include('#focus-quickbar').withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await page.locator('#task').focus(); await page.keyboard.press('Escape');
  await expect(sheet(page)).toBeHidden(); await expect(toggle(page)).toBeFocused(); await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');
  await toggle(page).click(); await page.locator('[data-minutes="50"]').click();
  await expect(toggle(page).locator('time')).toHaveText('50:00');
  const above = await box(sheet(page)); expect(above.top).toBeGreaterThan(90);
  await page.mouse.click(195, above.top - 20);
  await expect(sheet(page)).toBeHidden();
  await toggle(page).click(); await page.locator('#close-timer-sheet').click();
  await expect(sheet(page)).toBeHidden(); await expect(toggle(page)).toBeFocused();
});

test('the pill runs the session while the sheet stays reachable and follows it', async ({ page }) => {
  await open(page, { width: 1440, height: 900 });
  const start = page.locator('#start-button');
  await start.click();
  await expect(start).toHaveAccessibleName('Pause a moment'); await expect(start).toHaveText('Pause'); await expect(start).toHaveAttribute('data-running', 'true');
  await page.clock.fastForward('05:00');
  await expect(toggle(page).locator('time')).toHaveText(/^(19:5\d|20:00)$/);
  await toggle(page).click(); await expect(sheet(page)).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.getElementById('timer').textContent === document.querySelector('#timer-sheet-toggle time').textContent)).toBe(true);
  await expect(page.locator('#timer')).toHaveAttribute('role', 'timer');
  await expect(page.locator('[data-minutes="50"]')).toBeDisabled();
  await start.click();
  await expect(start).toHaveAccessibleName('Keep going'); await expect(start).toHaveText('Keep going');
  await toggle(page).click(); await expect(page.locator('#reset-session')).toBeVisible();
  await page.locator('#reset-session').click();
  await expect(start).toHaveAccessibleName('Start focusing'); await expect(toggle(page).locator('time')).toHaveText('25:00');
});

test('the sheet steps aside for the house page and for decorating', async ({ page }) => {
  await open(page, { width: 1440, height: 900 });
  await toggle(page).click(); await expect(sheet(page)).toBeVisible();
  await page.locator('#decorate-button').click();
  await expect(page.locator('body')).toHaveClass(/is-decorating/);
  await expect(sheet(page)).toBeHidden(); await expect(page.locator('#focus-quickbar')).toBeHidden();
  await page.locator('#decorate-button').click();
  await expect(page.locator('#focus-quickbar')).toBeVisible(); await expect(sheet(page)).toBeHidden();
  await toggle(page).click(); await page.locator('#rooms-button').click();
  await expect(page.locator('#house-page')).toBeVisible();
  await expect(sheet(page)).toBeHidden(); await expect(page.locator('#focus-quickbar')).toBeHidden();
});
