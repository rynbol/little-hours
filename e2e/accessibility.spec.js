import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Automated checks catch detectable DOM problems only; they do not certify
// the 3D room or replace testing with a screen reader.
const scan = page => new AxeBuilder({ page }).exclude('#room-canvas').withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
const serious = results => results.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`);

test('the focus card has no serious automated accessibility issues', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#timer')).toBeVisible();
  expect(serious(await scan(page))).toEqual([]);
});

test('the saves panel has no serious automated accessibility issues', async ({ page }) => {
  await page.goto('/');
  await page.locator('#save-status').click();
  await expect(page.locator('#download-backup')).toBeVisible();
  expect(serious(await scan(page))).toEqual([]);
});
