import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('little-hours-v1')));

async function openSaves(page) {
  await page.locator('#save-status').click();
  await expect(page.locator('#room-panel')).toContainText('Keep your home safe');
}

test('download a copy, bring back an edited one, then swap back', async ({ page }) => {
  await page.goto('/');
  const before = await saved(page);
  await openSaves(page);
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#download-backup').click()]);
  expect(download.suggestedFilename()).toMatch(/^little-hours-home-\d{4}-\d{2}-\d{2}\.json$/);
  const backup = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(backup).toMatchObject({ app: 'little-hours', format: 1 });
  const originalName = backup.save.house.name;

  backup.save.house.name = 'Pebble Cottage';
  backup.save.house.coins = 40;
  backup.save.theme = 'rain';
  await page.locator('#backup-file').setInputFiles({ name: 'home.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.locator('.restore-preview')).toContainText('Pebble Cottage');
  await expect(page.locator('.restore-preview')).toContainText('40 coins');
  // Nothing changes until the replacement is confirmed.
  expect(await saved(page)).toEqual(before);

  await page.locator('#confirm-restore').click();
  await expect(page.locator('#coin-balance')).toHaveText('40');
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'rain');
  expect((await saved(page)).house.name).toBe('Pebble Cottage');

  await page.locator('#undo-restore').click();
  await expect(page.locator('#coin-balance')).toHaveText('0');
  expect((await saved(page)).house.name).toBe(originalName);
});

test('a file from a newer version is refused without touching the home', async ({ page }) => {
  await page.goto('/');
  const before = await saved(page);
  await openSaves(page);
  const newer = { app: 'little-hours', format: 99, save: { house: { rooms: [] } } };
  await page.locator('#backup-file').setInputFiles({ name: 'newer.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(newer)) });
  await expect(page.locator('#toast')).toContainText('newer Little Hours');
  await expect(page.locator('#confirm-restore')).toHaveCount(0);
  expect(await saved(page)).toEqual(before);
});

test('bringing back a copy waits until focus is paused', async ({ page }) => {
  await page.goto('/');
  await page.locator('#start-button').click();
  await openSaves(page);
  await expect(page.locator('#choose-backup')).toBeDisabled();
  await expect(page.locator('#room-panel')).toContainText('Pause your focus session');
});
