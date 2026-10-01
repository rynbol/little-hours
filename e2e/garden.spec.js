import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const plantSeed = async page => { if (!await page.locator('#garden-plant-seed').isVisible()) await page.locator('#garden-spot-0').click(); await page.locator('#garden-plant-seed').click(); };
const selectSpot = async (page, index) => { if (await page.locator('#garden-card-close').isVisible()) await page.locator('#garden-card-close').click(); await page.locator(`#garden-spot-${index}`).click(); };
const ready = page => expect(page.locator('#loading-note')).toBeHidden({ timeout: 30000 });
const openGarden = async page => { await page.locator('#rooms-button').click(); await expect(page.locator('html')).not.toHaveAttribute('data-place-transition', { timeout: 30000 }); await page.locator('#house-open-garden').click(); await expect(page.locator('#house-detail h2')).toHaveText('Your garden'); await expect(page.locator('html')).not.toHaveAttribute('data-place-transition', { timeout: 30000 }); };

test('a free seed grows across real study sessions and blooms once with the other rewards', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-09-28T12:00:00') });
  await page.goto('/'); await ready(page); await openGarden(page);
  await plantSeed(page);
  await expect(page.locator('#coin-balance')).toHaveText('0');
  await page.locator('#garden-rename').click(); await page.locator('#garden-name-input').fill('Sunday <3'); await page.locator('#garden-name-form').getByRole('button', { name: 'Save', exact: true }).click();
  for (let i = 0; i < 2; i++) {
    await page.locator('#garden-study').click(); await page.locator('#start-button').click(); await expect(page.locator('#start-button')).toHaveText(/Pause/);
    await page.clock.fastForward('25:01');
    await expect(page.locator('#celebration-garden')).toContainText(i ? 'Sunday <3 bloomed' : 'Sunday <3 is growing');
    await expect(page.locator('#celebration-earned')).toContainText('+25 coins');
    await expect(page.locator('#celebration-bond')).toContainText('+5 ♡');
    expect(await page.locator('#celebration-garden').evaluate(node => !node.closest('.celebration-coins'))).toBe(true);
    expect((await page.locator('#celebration-garden > svg').boundingBox()).width).toBeGreaterThanOrEqual(69);
    const popup = await page.locator('#session-celebration').boundingBox();
    expect(popup.x).toBeGreaterThanOrEqual(0); expect(popup.y).toBeGreaterThanOrEqual(0); expect(popup.x + popup.width).toBeLessThanOrEqual(390);
    await page.screenshot({ path: `.lh/evidence/study-plant-${i}.png` });
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
  await page.goto('/'); await ready(page); await openGarden(page); await plantSeed(page);
  await selectSpot(page, 1); await page.locator('#seed-lavender').click(); await plantSeed(page);
  await expect(page.locator('#coin-balance')).toHaveText('10');
  await page.locator('#garden-rename').click(); await page.locator('#garden-name-input').fill('Unsaved name');
  await selectSpot(page, 0); await expect(page.locator('#garden-card-title')).toHaveText('Blush cosmos');
  await expect(page.locator('#garden-name-form')).toBeHidden();
  await selectSpot(page, 0); await page.locator('#garden-collection-open').click(); await page.locator('#garden-collection-plant-2').click(); await page.locator('#garden-place').click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('little-hours-v1')).garden.plants.map(p => p.slot))).toEqual([1, 0]);
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
  await plantSeed(page);
  expect(await page.evaluate(() => window.__littleHours.counts().engines)).toBe(initial.engines);
  expect(await page.evaluate(() => window.__littleHours.house.diagnostics().scene.meshes.find(m => m.metadata?.houseSlot === 'studio')?.uniqueId)).toBe(initial.room);
  await page.waitForTimeout(1700); const before = await page.evaluate(() => window.__littleHours.house.diagnostics().renderCount);
  await page.waitForTimeout(700); expect(await page.evaluate(() => window.__littleHours.house.diagnostics().renderCount)).toBe(before);
  expect(await page.evaluate(() => window.__littleHours.house.diagnostics().scene.getMeshByName('house-retreat-grounds').isEnabled())).toBe(true);
  expect(await page.evaluate(() => window.__littleHours.house.diagnostics().scene.getMeshByName('garden-butterfly-wings').isEnabled())).toBe(false);
  await page.locator('#garden-back').click();
  expect(await page.evaluate(() => window.__littleHours.house.diagnostics().scene.getMeshByName('house-retreat-grounds').isEnabled())).toBe(false);
  await page.locator('#back-to-room').click();
  expect(await page.evaluate(() => window.__littleHours.state.house.activeId)).toBe('studio');
});

test('garden butterflies animate and the selected bed follows real input without changing progress @dev-diagnostics', async ({ page }) => {
  await page.goto('/'); await ready(page); await openGarden(page);
  const before = await page.evaluate(() => window.__littleHours.state.garden);
  const wings = () => page.evaluate(() => {
    const mesh = window.__littleHours.house.diagnostics().scene.getMeshByName('garden-butterfly-wings');
    return { visible: mesh.isEnabled(), position: Array.from(mesh._thinInstanceDataStorage.matrixData.slice(0, 16)) };
  });
  await expect.poll(async () => (await wings()).visible).toBe(true);
  const first = (await wings()).position;
  await expect.poll(async () => JSON.stringify((await wings()).position)).not.toBe(JSON.stringify(first));
  await selectSpot(page, 4);
  expect(await page.evaluate(() => {
    const d = window.__littleHours.house.diagnostics(), ring = d.scene.getMeshByName('garden-selected-bed');
    return [ring.position.x, ring.position.z];
  })).toEqual([-2.25, 2.35]);
  expect(await page.evaluate(() => window.__littleHours.state.garden)).toEqual(before);
  await page.locator('#garden-back').click();
  await expect.poll(async () => (await wings()).visible).toBe(false);
  expect(await page.evaluate(() => window.__littleHours.house.diagnostics().scene.getMeshByName('garden-selected-bed').isEnabled())).toBe(false);
});

test('a name draft stays with its plant when another tab replaces that garden spot', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/'); await ready(page); await openGarden(page); await plantSeed(page);
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
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('little-hours-v1')).garden.plants.map(p => p.name))).toEqual(['My first bloom', 'Lavender']);
});

test('a garden postcard exports locally without spending coins or changing progress', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/'); await ready(page); await openGarden(page); await plantSeed(page);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('little-hours-v1'))?.garden?.plants.length)).toBe(1);
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
  await plantSeed(page);
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
  await expect(page.locator('#garden-card')).toBeHidden();
  await expect(page.locator('#garden-spot-0')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#house-open-garden')).toBeVisible();
  await expect(page.locator('#house-open-garden')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#room-section')).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/is-garden/);
});

test('your avatar and selected pet walk in the garden and rest together during focus @dev-diagnostics', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('little-hours-v1', JSON.stringify({ pet: 'dog' })));
  await page.goto('/'); await ready(page); await openGarden(page);
  const pair = () => page.evaluate(() => {
    const d = window.__littleHours.house.diagnostics(), root = d.scene.getTransformNodeByName('house-stroll');
    return { visible: root.isEnabled(), scale: root.scaling.x, avatar: root.getDescendants().filter(n => n.name === 'Walking companion').length, dog: root.getDescendants().some(n => n.name === 'pet-dog'), pose: d.stroll, pet: d.strollPet, home: d.scene.getMeshByName('house-retreat-exit').isEnabled() };
  });
  await expect.poll(async () => (await pair()).visible).toBe(true);
  expect(await pair()).toMatchObject({ scale: .76, avatar: 1, dog: true, home: true, pose: { sit: 0 } });
  const start = (await pair()).pose;
  await expect.poll(async () => Math.hypot((await pair()).pose.x - start.x, (await pair()).pose.z - start.z), { timeout: 10000 }).toBeGreaterThan(.5);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(async () => (await pair()).pose.z).toBe(2.1 / .76);
  expect(await pair()).toMatchObject({ visible: true, pose: { x: 0, moving: false }, pet: { moving: false } });
  expect((await pair()).pet.x).toBeCloseTo(-.35 / .76 - .25);
  await page.getByRole('button', { name: 'Back to island', exact: true }).click();
  await expect(page.locator('#house-open-garden')).toBeVisible();
  await page.locator('#back-to-room').click(); await page.locator('#start-button').click(); await openGarden(page);
  await expect.poll(async () => (await pair()).pose.sit).toBe(1);
  expect(await pair()).toMatchObject({ visible: true, avatar: 1, dog: true, pet: { moving: false } });
  const before = await page.evaluate(() => ({ session: window.__littleHours.state.session, garden: window.__littleHours.state.garden, coins: window.__littleHours.state.house.coins }));
  await page.getByRole('button', { name: 'Back to island', exact: true }).click();
  await expect(page.locator('#house-open-garden')).toBeVisible();
  expect(await page.evaluate(() => ({ session: window.__littleHours.state.session, garden: window.__littleHours.state.garden, coins: window.__littleHours.state.house.coins }))).toEqual(before);
});

for (const width of [1440, 390]) {
  test(`${width}px garden arrives clear and opens one card on demand`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto('/'); await ready(page); await openGarden(page);
    await expect(page.locator('#garden-card')).toBeHidden();
    await expect(page.locator('#garden-spots')).toBeHidden();
    await page.screenshot({ path: `.lh/evidence/garden-arrival-${width}.png` });
    await page.locator('#garden-spot-0').click();
    await expect(page.locator('#garden-card')).toBeVisible();
    await expect(page.locator('#garden-card-title')).toBeFocused();
    await expect(page.locator('#garden-card-title')).toHaveText('Choose a seed');
    await page.screenshot({ path: `.lh/evidence/garden-seeds-${width}.png` });
    await page.locator('#garden-plant-seed').click();
    await expect(page.locator('#garden-study')).toBeFocused();
    expect((await page.locator('#garden-card').boundingBox()).height).toBeLessThan(240);
    await page.screenshot({ path: `.lh/evidence/garden-plant-${width}.png` });
    await page.locator('#garden-card-close').click();
    await expect(page.locator('#garden-card')).toBeHidden();
    await expect(page.locator('#garden-spot-0')).toBeFocused();
    const bed = await page.locator('#garden-spot-0').boundingBox();
    await page.mouse.click(bed.x + .3, bed.y + bed.height / 2);
    await expect(page.locator('#garden-card-title')).toHaveText('Blush cosmos');
    await expect(page.locator('#garden-card')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#garden-card')).toBeHidden();
    await expect(page.locator('#garden-back')).toBeVisible();
  });
}
