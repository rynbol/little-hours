import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('little-hours-v1')));
async function openPond(page, bait = [10, 20, 35, 60, 95]) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(minutes => {
    window.__littleHoursTest = { random: () => .5 };
    localStorage.setItem('little-hours-v1', JSON.stringify({ pond: { bait: minutes.map(minutes => ({ minutes, at: 1 })), journal: {}, log: [] } }));
  }, bait);
  await page.goto('/'); await expect(page.locator('#loading-note')).toBeHidden({ timeout: 30000 });
  await page.locator('#rooms-button').click(); await page.locator('#house-canvas [data-room="pond"]').click();
  await expect(page.locator('#lake-page')).toBeVisible();
  await expect(page.locator('html')).not.toHaveAttribute('data-place-transition', { timeout: 30000 });
}

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`the pond leaves room for scenery and discloses bait choices at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport); await openPond(page);
    const before = (await saved(page)).pond;
    await expect(page.locator('#lake-tackle')).toBeHidden(); await expect(page.locator('#lake-status')).toBeEmpty();
    expect((await page.locator('#lake-tray').boundingBox()).height).toBeLessThan(80);
    expect(await page.locator('.lake-title').evaluate(node => getComputedStyle(node).backgroundImage)).toBe('none');
    await page.screenshot({ path: `.lh/evidence/calm-pond-${viewport.width}.png` });
    await page.locator('#lake-bait-toggle').click(); await expect(page.locator('#lake-tackle')).toBeVisible();
    await page.keyboard.press('Escape'); await expect(page.locator('#lake-tackle')).toBeHidden();
    await expect(page.locator('#lake-page')).toBeVisible(); await expect(page.locator('#lake-bait-toggle')).toBeFocused();
    await page.locator('#lake-bait-toggle').click(); await page.locator('[data-bait="crumb"]').click();
    await expect(page.locator('#lake-bait-toggle')).toHaveAccessibleName('Choose bait, Bread crumb, 1 left');
    await page.keyboard.press('ArrowDown'); await expect(page.locator('[data-bait="worm"]')).toBeFocused();
    await expect(page.locator('[data-bait="worm"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#lake-odds')).toBeHidden(); await page.locator('#lake-chances > summary').click();
    await expect(page.locator('#lake-odds')).toBeVisible();
    const menu = await page.locator('#lake-tackle').boundingBox();
    expect(menu.x).toBeGreaterThanOrEqual(0); expect(menu.y).toBeGreaterThanOrEqual(0);
    expect(menu.x + menu.width).toBeLessThanOrEqual(viewport.width); expect(menu.y + menu.height).toBeLessThan(viewport.height - 75);
    expect((await new AxeBuilder({ page }).include('#lake-tackle').withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()).violations).toEqual([]);
    expect((await saved(page)).pond).toEqual(before);
    await page.screenshot({ path: `.lh/evidence/calm-pond-bait-${viewport.width}.png` });
    await page.getByRole('button', { name: 'Close bait selector' }).click();
    await page.locator('#lake-journal-button').click(); await expect(page.locator('#lake-journal')).toBeVisible();
    await page.keyboard.press('Escape'); await expect(page.locator('#lake-journal')).toBeHidden();
    await page.keyboard.press('Escape'); await expect(page.locator('#lake-page')).toBeHidden();
  });
}

test('an empty tackle box explains earning bait and remains free to leave', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await openPond(page, []);
  await expect(page.locator('#lake-cast')).toBeDisabled();
  await expect(page.locator('#lake-bait-toggle')).toHaveAccessibleName('How to earn bait');
  await page.locator('#lake-bait-toggle').click(); await expect(page.locator('.lake-empty')).toContainText('5+ minutes');
  await expect(page.locator('#lake-chances')).toBeHidden();
  await page.locator('#lake-back').click(); await expect(page.locator('#lake-page')).toBeHidden();
  await expect(page.locator('#lake-tackle')).toBeHidden();
  expect((await saved(page)).pond.bait).toHaveLength(0);
});

for (const width of [1440, 390]) {
  test(`journal contains focus, restores its invoker and dismisses after an inside click at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await openPond(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('#lake-journal-button').click();
    const journal = page.locator('#lake-journal');
    await expect(journal).toBeVisible();
    expect(await journal.evaluate(node => node.matches(':modal'))).toBe(true);
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      expect(await journal.evaluate(node => node.contains(document.activeElement) || document.activeElement === document.body)).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(journal).toBeHidden();
    await expect(page.locator('#lake-journal-button')).toBeFocused();
    await page.locator('#lake-journal-button').click();
    await page.locator('.lake-bait-guide > summary').click();
    expect((await new AxeBuilder({ page }).include('#lake-journal').withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `.lh/evidence/journal-motion-${width}.png` });
    await page.mouse.click(3, 3);
    await expect(journal).toBeHidden();
    await expect(page.locator('#lake-journal-button')).toBeFocused();
    await expect(page.locator('#lake-page')).toBeVisible();
  });
}
