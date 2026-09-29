import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ready = page => expect(page.locator('#loading-note')).toBeHidden({ timeout: 30000 });
const openGarden = async page => { await page.locator('#focus-garden').click(); await expect(page.locator('#house-detail h2')).toHaveText('Your garden'); };

test('a free seed grows across real study sessions and blooms once with the other rewards', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-09-28T12:00:00') });
  await page.goto('/'); await ready(page); await openGarden(page);
  await page.locator('#garden-plant-seed').click();
  await expect(page.locator('#coin-balance')).toHaveText('0');
  await page.locator('#garden-rename').click(); await page.locator('#garden-name-input').fill('Sunday <3'); await page.locator('#garden-name-form').getByRole('button', { name: 'Save', exact: true }).click();
  for (let i = 0; i < 2; i++) {
    await page.locator('#garden-study').click(); await page.locator('#start-button').click();
    await page.clock.fastForward('25:01');
    await expect(page.locator('#celebration-garden')).toContainText(i ? 'Sunday <3 bloomed' : 'Sunday <3 is growing');
    await expect(page.locator('#celebration-earned')).toContainText('+25 coins');
    await expect(page.locator('#celebration-bond')).toContainText('+5 ♡');
    await page.locator('#celebration-garden button').click();
    await expect(page.locator('.garden-growth [role="progressbar"]')).toHaveAttribute('aria-valuenow', String((i + 1) * 25));
  }
  await expect(page.locator('.garden-bloom-note')).toBeVisible();
  await page.reload(); await ready(page); await expect(page.locator('#session-celebration')).toBeHidden(); await openGarden(page);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('little-hours-v1')).garden.plants[0])).toMatchObject({ name: 'Sunday <3', minutes: 50 });
  await expect(page.locator('#coin-balance')).toHaveText('50');
});

test('seeds, saved names, placement and the garden controls work on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => { if (!sessionStorage.seeded) { localStorage.setItem('little-hours-v1', JSON.stringify({ house: { coins: 20 } })); sessionStorage.seeded = '1'; } });
  await page.goto('/'); await ready(page); await openGarden(page); await page.locator('#garden-plant-seed').click();
  await page.locator('#garden-spot-1').click(); await page.locator('#seed-lavender').click(); await page.locator('#garden-plant-seed').click();
  await expect(page.locator('#coin-balance')).toHaveText('10');
  await page.locator('#garden-spot-0').click(); await page.locator('#garden-collection-open').click(); await page.locator('#garden-collection-plant-2').click(); await page.locator('#garden-place').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('little-hours-v1')).garden.plants.map(p => p.slot))).toEqual([1, 0]);
  await expect(page.locator('#garden-spot-0')).toHaveAttribute('aria-label', 'Spot 1, Lavender');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const scan = await new AxeBuilder({ page }).include('#house-detail').withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  expect(scan.violations).toEqual([]);
  await page.locator('#garden-new-seeds').click();
  expect((await new AxeBuilder({ page }).include('#house-detail').withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()).violations).toEqual([]);
});

test('the garden reuses the house engine, keeps room batches and stops drawing with reduced motion @dev-diagnostics', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/'); await ready(page); await openGarden(page);
  await expect.poll(() => page.evaluate(() => Boolean(window.__littleHours.house.diagnostics()?.scene.isReady()))).toBe(true);
  const initial = await page.evaluate(() => { const d = window.__littleHours.house.diagnostics(); return { engines: window.__littleHours.counts().engines, room: d.scene.meshes.find(m => m.metadata?.houseSlot === 'studio')?.uniqueId }; });
  await page.locator('#garden-plant-seed').click();
  expect(await page.evaluate(() => window.__littleHours.counts().engines)).toBe(initial.engines);
  expect(await page.evaluate(() => window.__littleHours.house.diagnostics().scene.meshes.find(m => m.metadata?.houseSlot === 'studio')?.uniqueId)).toBe(initial.room);
  await page.waitForTimeout(1700); const before = await page.evaluate(() => window.__littleHours.house.diagnostics().renderCount);
  await page.waitForTimeout(700); expect(await page.evaluate(() => window.__littleHours.house.diagnostics().renderCount)).toBe(before);
  await page.locator('#garden-back').click(); await page.locator('#back-to-room').click();
  await page.locator('.home-wide').click(); await page.locator('#house-in-room [data-room="orchard"]').click();
  await expect(page.locator('#house-detail h2')).toHaveText('Your garden');
  expect(await page.evaluate(() => window.__littleHours.state.house.activeId)).toBe('studio');
});

test('a name draft stays with its plant when another tab replaces that garden spot', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/'); await ready(page); await openGarden(page); await page.locator('#garden-plant-seed').click();
  await page.locator('#garden-rename').click(); await page.locator('#garden-name-input').fill('My first bloom');
  const other = await context.newPage(); await other.goto('/'); await ready(other);
  await other.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('little-hours-v1')); save.garden.plants[0].slot = null;
    save.garden.plants.push({ id: 'plant-2', species: 'lavender', name: 'Lavender', minutes: 0, slot: 0 }); save.garden.nextId = 3;
    localStorage.setItem('little-hours-v1', JSON.stringify(save));
  });
  await expect(page.locator('#garden-name-input')).toHaveValue('My first bloom');
  await expect(page.locator('#garden-spot-0')).toHaveAttribute('aria-label', 'Spot 1, Lavender');
  await page.locator('#garden-name-form').getByRole('button', { name: 'Save', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('little-hours-v1')).garden.plants.map(p => p.name))).toEqual(['My first bloom', 'Lavender']);
});

test('a garden postcard exports locally without spending coins or changing progress', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/'); await ready(page); await openGarden(page); await page.locator('#garden-plant-seed').click();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('little-hours-v1')).garden);
  await page.locator('#house-postcard').click(); await expect(page.locator('#house-postcard-dialog')).toBeVisible();
  const download = page.waitForEvent('download'); await page.locator('#download-postcard').click();
  expect((await download).suggestedFilename()).toBe('little-hours-garden.png');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('little-hours-v1')).garden)).toEqual(before);
  await expect(page.locator('#coin-balance')).toHaveText('0');
});

test('the immersive garden keeps its overlays, keyboard exits and name editor in order', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/'); await ready(page); await openGarden(page);
  const viewport = page.viewportSize();
  expect(await page.locator('#house-page').boundingBox()).toMatchObject({ x: 0, y: 0, ...viewport });
  await page.locator('#garden-plant-seed').click();
  await page.locator('#garden-rename').click();
  await page.locator('#garden-name-input').click();
  await page.locator('#garden-name-input').fill('A little sunshine');
  await page.locator('#garden-name-input').press('Escape');
  await expect(page.locator('#garden-name-form')).toBeHidden();
  await expect(page.locator('#garden-rename')).toBeFocused();
  await page.locator('#garden-collection-open').click();
  await expect(page.locator('#garden-collection-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#garden-collection-dialog')).toBeHidden();
  await expect(page.locator('#garden-collection-open')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#house-open-garden')).toBeVisible();
  await expect(page.locator('#house-open-garden')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#room-section')).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/is-garden/);
});
