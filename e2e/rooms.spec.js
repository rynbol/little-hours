import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedState } from '../scripts/lh/seeds.mjs';

const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('little-hours-v1')));
const openRooms = async page => {
  await page.addInitScript(seed => {
    if (!localStorage.getItem('little-hours-v1')) localStorage.setItem('little-hours-v1', JSON.stringify(seed));
  }, seedState('three-rooms'));
  await page.goto('/');
  await expect(page.locator('#loading-note')).toBeHidden({ timeout: 30000 });
};

test('the room heading edits its own saved name without losing drafts or literal names', async ({ page }) => {
  await openRooms(page);
  await expect(page.locator('#room-title')).toHaveText('Ember library');
  await expect(page.locator('[data-house-go="studio"]')).toContainText('Ember library');
  await page.locator('#rename-room').click();
  const input = page.locator('#room-title-input');
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('Ember library');
  await input.fill('  Our Sunday corner ♡  ');
  await page.locator('#time-toggle').click();
  await expect(input).toHaveValue('  Our Sunday corner ♡  ');
  await input.press('Enter');
  await expect(page.locator('#room-title')).toHaveText('Our Sunday corner ♡');
  await expect(page.locator('#rename-room')).toBeFocused();
  await expect(page.locator('[data-house-go="studio"]')).toContainText('Our Sunday corner ♡');
  expect((await saved(page)).house.rooms[0].name).toBe('Our Sunday corner ♡');
  await page.locator('#rename-room').click();
  await input.fill('Discard this');
  await input.press('Escape');
  await expect(page.locator('#room-title-form')).toBeHidden();
  await expect(page.locator('#rename-room')).toBeFocused();
  expect((await saved(page)).house.rooms[0].name).toBe('Our Sunday corner ♡');
  await page.locator('#rename-room').click();
  await input.fill('   ');
  await input.press('Enter');
  expect((await saved(page)).house.rooms[0].name).toBe('Our Sunday corner ♡');
  await input.fill('Your studio');
  const axe = await new AxeBuilder({ page }).include('.room-heading').include('#home-connections').analyze();
  expect(axe.violations).toEqual([]);
  await input.press('Enter');
  await page.reload();
  await expect(page.locator('#loading-note')).toBeHidden({ timeout: 30000 });
  await expect(page.locator('#room-title')).toHaveText('Your studio');
  await page.locator('#rooms-button').click();
  await expect(page.locator('#house-detail h2')).toHaveText('Your studio');
  await expect(page.locator('#room-name-input')).toHaveValue('Your studio');
});

test('room cards respect focus and reduced motion, with readable phone controls', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openRooms(page);
  await page.locator('#rename-room').click();
  await page.locator('#room-title-input').fill('A very long name for our cozy room ♡♡♡♡♡♡');
  await page.locator('#room-title-input').press('Enter');
  await page.locator('#start-button').click();
  await page.locator('[data-house-go="garden"]').click();
  await expect(page.locator('#toast')).toHaveText('Pause your focus session before walking to another room.');
  expect((await saved(page)).house.activeId).toBe('studio');
  await page.locator('#start-button').click();
  await page.locator('[data-house-go="garden"]').click();
  await expect(page.locator('#room-title')).toHaveText('Garden wing');
  await expect(page.locator('#room-travel')).toBeHidden();
  await expect(page.locator('[data-house-go="garden"]')).toHaveAttribute('aria-current', 'location');
  const controls = await page.locator('[data-house-go], #rename-room').evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect();
    return { width: rect.width, height: rect.height, right: rect.right, left: rect.left };
  }));
  for (const control of controls) {
    expect(control.width).toBeGreaterThanOrEqual(44);
    expect(control.height).toBeGreaterThanOrEqual(44);
    expect(control.left).toBeGreaterThanOrEqual(0);
    expect(control.right).toBeLessThanOrEqual(390);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).include('.room-heading').include('#home-connections').analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('room-cards-phone.png') });
  await page.locator('.home-wide').click();
  await expect(page.locator('#rename-room')).toBeHidden();
  await page.locator('[data-house-go="loft"]').click();
  await expect(page.locator('#room-title')).toHaveText('Upstairs hideaway');
  await expect(page.locator('body')).not.toHaveClass(/is-connected|is-travelling/);
});

test('a room change in another tab cancels the old heading draft', async ({ page, context }) => {
  await openRooms(page);
  await page.locator('#rename-room').click();
  await page.locator('#room-title-input').fill('Unsubmitted studio name');
  const other = await context.newPage();
  await other.emulateMedia({ reducedMotion: 'reduce' });
  await other.goto('/');
  await expect(other.locator('#loading-note')).toBeHidden({ timeout: 30000 });
  await other.locator('[data-house-go="garden"]').click();
  await expect(other.locator('#room-title')).toHaveText('Garden wing');
  await expect(page.locator('#room-title')).toHaveText('Garden wing');
  await expect(page.locator('#room-title-form')).toBeHidden();
  const rooms = (await saved(page)).house.rooms;
  expect(rooms[0].name).toBeNull();
  expect(rooms[1].name).toBe('Garden wing');
  await other.close();
});
