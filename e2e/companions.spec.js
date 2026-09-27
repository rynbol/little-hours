import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('little-hours-v1')));

test('a personal pet notebook works with keyboard input and exports a real portrait', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#loading-note')).toBeHidden();
  await page.locator('#pet-button').click();
  await page.locator('[data-pet-ritual="cuddle"]').click();
  await expect(page.locator('#pet-ritual-status')).toHaveText('+2 ♡');
  await page.locator('.pet-details summary').first().click();
  await page.locator('#pet-name').fill('<Maple & Me>');
  await page.locator('#pet-name').press('Enter');
  await expect(page.locator('#pet-button-label')).toHaveText('<Maple & Me>');
  await expect(page.locator('.pet-identity h2')).toHaveText('<Maple & Me>');
  await expect(page.locator('.pet-identity h2 *')).toHaveCount(0);
  await page.locator('#pet-family').fill('Dylan & Sam');
  await page.locator('[data-pet-tab="keepsakes"]').click();
  await expect(page.locator('[data-pet-tab="keepsakes"]')).toHaveAttribute('aria-selected', 'true');
  expect((await saved(page)).petFamily).toBe('Dylan & Sam');
  await page.locator('.pet-details summary').last().click();
  const download = page.waitForEvent('download');
  await page.locator('#pet-save-portrait').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('our-little-hours.png');
  const stream = await file.createReadStream(), chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const png = Buffer.concat(chunks);
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(1500);
  const accessibility = await new AxeBuilder({ page }).include('#room-panel').analyze();
  expect(accessibility.violations).toEqual([]);
  await page.reload(); await page.locator('#pet-button').click();
  expect((await saved(page)).petBonds.cat.name).toBe('<Maple & Me>');
  expect((await saved(page)).petFamily).toBe('Dylan & Sam');
  await page.locator('#close-panel').click();
  await expect(page.locator('#pet-button')).toBeFocused();
});

test('completion awards the pet that began focusing and the room stays usable', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-27T12:00:00') });
  await page.goto('/'); await expect(page.locator('#loading-note')).toBeHidden();
  await page.locator('#start-button').click();
  await page.clock.fastForward('01:00');
  await page.locator('#pet-button').click(); await page.locator('[data-pet-choice="dog"]').click(); await page.locator('#close-panel').click();
  await page.clock.fastForward('24:01');
  await expect(page.locator('#session-celebration')).toBeVisible();
  await expect(page.locator('#celebration-bond')).toContainText('+5 ♡ · Miso');
  const accessibility = await new AxeBuilder({ page }).include('#session-celebration').analyze();
  expect(accessibility.violations).toEqual([]);
  expect(await page.locator('#session-celebration').evaluate(el => el.matches(':modal'))).toBe(false);
  await page.locator('#session-celebration .start-button').click();
  await expect(page.locator('#focus-reward')).toContainText('+5 ♡ · Mochi');
  const state = await saved(page);
  expect(state.petBonds.cat.minutes).toBe(25); expect(state.petBonds.dog.minutes).toBe(0);
  await page.reload();
  expect((await saved(page)).petBonds.cat.sessions).toBe(1);
});

test('an open notebook shows completed focus while a control has focus', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-27T12:00:00') });
  await page.goto('/'); await expect(page.locator('#loading-note')).toBeHidden();
  await page.locator('#start-button').click();
  await page.locator('#pet-button').click();
  await expect(page.locator('#close-panel')).toBeFocused();
  await page.clock.fastForward('25:01');
  await expect(page.locator('.pet-bond-detail')).toContainText('25 min together');
  await expect(page.locator('.pet-bond-heading')).toContainText('5');
  await page.locator('#session-celebration .start-button').click();
  await page.locator('[data-pet-ritual="cuddle"]').click();
  await page.locator('[data-pet-ritual="play"]').click();
  const bond = page.getByRole('progressbar', { name: 'Bond with Miso' });
  await expect(bond).toHaveAttribute('aria-valuemin', '8');
  await expect(bond).toHaveAttribute('aria-valuemax', '24');
  await expect(bond).toHaveAttribute('aria-valuenow', '8');
  await expect(bond.locator('i')).toHaveAttribute('style', 'width:0%');
});

test('pet name drafts survive a selection change in another tab without renaming that pet', async ({ page, context }) => {
  await page.goto('/'); await expect(page.locator('#loading-note')).toBeHidden();
  await page.locator('#pet-button').click(); await page.locator('.pet-details summary').first().click();
  await page.locator('#pet-name').fill('Maple');
  const other = await context.newPage(); await other.bringToFront(); await other.goto('/'); await expect(other.locator('#loading-note')).toBeHidden({ timeout: 15000 });
  await other.locator('#pet-button').click(); await other.locator('[data-pet-choice="dog"]').click();
  await page.bringToFront();
  await expect(page.locator('.pet-identity h2')).toHaveText('Mochi');
  await expect(page.locator('#pet-name')).toHaveValue('Mochi');
  await page.locator('#pet-name').press('Enter');
  expect((await saved(page)).petBonds.dog.name).toBe('Mochi');
  await page.locator('[data-pet-choice="cat"]').click();
  await expect(page.locator('#pet-name')).toHaveValue('Maple');
  await page.locator('#pet-name').press('Enter');
  expect((await saved(page)).petBonds.cat.name).toBe('Maple');
  await other.close();
});
