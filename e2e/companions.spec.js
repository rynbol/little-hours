import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('little-hours-v1')));

test('pet care preserves personal names, keyboard focus and an interactive room', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#loading-note')).toBeHidden({ timeout: 30000 });
  await page.locator('#pet-button').click();
  await page.locator('#pet-now').click();
  await expect(page.locator('#pet-ritual-status')).toHaveText('+2 ♡');
  await page.locator('#pet-edit-name').click();
  await page.locator('#pet-name').fill('<Maple & Me>');
  await page.locator('#pet-name').press('Enter');
  await expect(page.locator('#pet-button-label')).toHaveText('<Maple & Me>');
  await expect(page.locator('.pet-card-identity h2')).toHaveText('<Maple & Me>');
  await expect(page.locator('.pet-card-identity h2 *')).toHaveCount(0);
  await expect(page.locator('#pet-edit-name')).toBeFocused();
  expect(await page.locator('#room-canvas').evaluate(el => !el.closest('[inert]'))).toBe(true);
  await page.locator('#pet-belongings > summary').click();
  await page.locator('#pet-friendship > summary').click();
  const accessibility = await new AxeBuilder({ page }).include('#room-panel').analyze();
  expect(accessibility.violations).toEqual([]);
  await page.reload(); await page.locator('#pet-button').click();
  expect((await saved(page)).petBonds.cat.name).toBe('<Maple & Me>');
  await page.keyboard.press('Escape');
  await expect(page.locator('#pet-button')).toBeFocused();
  await expect(page.locator('#room-panel')).toBeHidden();
});

test('meals and belongings spend earned coins once and fullness survives reload', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('little-hours-v1')) localStorage.setItem('little-hours-v1', JSON.stringify({ house: { coins: 20 } }));
  });
  await page.goto('/'); await expect(page.locator('#loading-note')).toBeHidden({ timeout: 30000 });
  await page.locator('#pet-button').click(); await page.locator('#pet-feed').click();
  await page.locator('#pet-meal-supper').click();
  await expect(page.locator('#coin-balance')).toHaveText('15');
  await expect(page.locator('#pet-feed')).toContainText('Full');
  await page.locator('#pet-feed').click();
  await expect(page.locator('#pet-meal-supper')).toBeDisabled();
  await expect(page.locator('#pet-meal-crunch')).toBeDisabled();
  await page.locator('#pet-belongings > summary').click();
  await page.locator('#pet-fabric-rose').click();
  await expect(page.locator('#coin-balance')).toHaveText('0');
  await page.locator('#pet-fabric-linen').click(); await page.locator('#pet-fabric-rose').click();
  await expect(page.locator('#coin-balance')).toHaveText('0');
  await page.reload(); await page.locator('#pet-button').click();
  await expect(page.locator('#pet-feed')).toContainText('Full');
  const state = await saved(page);
  expect(state.petBonds.cat.care.meals).toBe(1);
  expect(state.petBonds.cat.care.fabric).toBe('rose');
  expect(state.petBonds.cat.affection).toBe(1);
});

test('the phone care card keeps the cutaway visible and the focus timer reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/'); await expect(page.locator('#loading-note')).toBeHidden({ timeout: 30000 });
  await page.locator('#pet-button').click(); await page.locator('#pet-now').click();
  const bounds = await page.evaluate(() => {
    const room = document.querySelector('#stage').getBoundingClientRect(), action = document.querySelector('#pet-now').getBoundingClientRect();
    return { room: { top: room.top, bottom: room.bottom }, action: { top: action.top, bottom: action.bottom }, fits: document.documentElement.scrollWidth <= innerWidth };
  });
  expect(bounds.fits).toBe(true); expect(bounds.room.top).toBeGreaterThanOrEqual(0); expect(bounds.room.bottom).toBeLessThan(bounds.action.top); expect(bounds.action.bottom).toBeLessThanOrEqual(844);
  expect((await new AxeBuilder({ page }).include('#room-panel').analyze()).violations).toEqual([]);
  await page.locator('#focus-toggle').click(); await expect(page.locator('#room-panel')).toBeHidden(); await expect(page.locator('#start-button')).toBeVisible();
});

test('completion awards the pet that began focusing and the room stays usable', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-27T12:00:00') });
  await page.goto('/'); await expect(page.locator('#loading-note')).toBeHidden({ timeout: 30000 });
  await page.locator('#start-button').click();
  await page.clock.fastForward('01:00');
  await page.locator('#pet-button').click(); await page.locator('#pet-collection > summary').click(); await page.locator('[data-pet-choice="dog"]').click(); await page.locator('#close-panel').click();
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

test('an open care card shows completed focus while a control has focus', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-27T12:00:00') });
  await page.goto('/'); await expect(page.locator('#loading-note')).toBeHidden({ timeout: 30000 });
  await page.locator('#start-button').click();
  await page.locator('#pet-button').click();
  await expect(page.locator('#close-panel')).toBeFocused();
  await page.clock.fastForward('25:01');
  await expect(page.locator('.pet-bond-heading')).toContainText('25 min together');
  await expect(page.locator('.pet-bond-heading')).toContainText('5');
  await page.locator('#session-celebration .start-button').click();
  await page.locator('[data-pet-ritual="cuddle"]').click();
  await page.clock.fastForward('00:12');
  await page.locator('[data-pet-ritual="play"]').click();
  const bond = page.getByRole('progressbar', { name: 'Bond with Miso' });
  await expect(bond).toHaveAttribute('aria-valuemin', '8');
  await expect(bond).toHaveAttribute('aria-valuemax', '24');
  await expect(bond).toHaveAttribute('aria-valuenow', '8');
  await expect(bond.locator('i')).toHaveAttribute('style', 'width:0%');
});

test('pet name drafts survive a selection change in another tab without renaming that pet', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/'); await expect(page.locator('#loading-note')).toBeHidden({ timeout: 30000 });
  await page.locator('#pet-button').click(); await page.locator('#pet-edit-name').click();
  await page.locator('#pet-name').fill('Maple');
  const other = await context.newPage(); await other.emulateMedia({ reducedMotion: 'reduce' }); await other.bringToFront(); await other.goto('/'); await expect(other.locator('#loading-note')).toBeHidden({ timeout: 30000 });
  await other.locator('#pet-button').click(); await other.locator('#pet-collection > summary').click(); await other.locator('[data-pet-choice="dog"]').click();
  await page.bringToFront();
  await expect(page.locator('.pet-card-identity h2')).toHaveText('Mochi');
  await expect(page.locator('#pet-name')).toHaveValue('Mochi');
  await page.locator('#pet-name').press('Enter');
  expect((await saved(page)).petBonds.dog.name).toBe('Mochi');
  await page.locator('#pet-collection > summary').click(); await page.locator('[data-pet-choice="cat"]').click();
  if (await page.locator('#pet-name-form').isHidden()) await page.locator('#pet-edit-name').click();
  await expect(page.locator('#pet-name')).toHaveValue('Maple');
  await page.locator('#pet-name').press('Enter');
  expect((await saved(page)).petBonds.cat.name).toBe('Maple');
  await other.close();
});

test('a meal requested at the focus deadline takes precedence over celebration', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-09-27T12:00:00') });
  await page.addInitScript(() => {
    if (!localStorage.getItem('little-hours-v1')) localStorage.setItem('little-hours-v1', JSON.stringify({ house: { coins: 5 } }));
  });
  await page.goto('/'); await expect(page.locator('#loading-note')).toBeHidden({ timeout: 30000 });
  await page.locator('#start-button').click(); await page.locator('#pet-button').click(); await page.locator('#pet-feed').click();
  await page.clock.pauseAt(new Date('2026-09-27T12:01:00'));
  await page.clock.setSystemTime(new Date('2026-09-27T12:26:00'));
  await page.locator('#pet-meal-supper').click();
  const state = await saved(page);
  expect(state.house.coins).toBe(25); expect(state.petBonds.cat.care.meals).toBe(1); expect(state.petBonds.cat.sessions).toBe(1);
  expect(await page.evaluate(() => window.__littleHours.room.diagnostics().pet.care?.kind)).toBe('treat');
  await page.clock.resume();
});

test('care keeps its room column with a collapsed timer and closes for room view changes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/'); await expect(page.locator('#loading-note')).toBeHidden({ timeout: 30000 });
  await page.locator('#focus-toggle').click(); await expect(page.locator('body')).toHaveClass(/focus-collapsed/);
  await page.locator('#pet-button').click();
  const bounds = await page.evaluate(() => ({ room: document.querySelector('#room-section').getBoundingClientRect().right, card: document.querySelector('#room-panel').getBoundingClientRect().left }));
  expect(bounds.card).toBeGreaterThan(bounds.room);
  await page.locator('.home-wide').click(); await expect(page.locator('#room-panel')).toBeHidden();
  await page.locator('.home-wide').click(); await page.locator('#pet-button').click(); await page.locator('#mini-button').click();
  await expect(page.locator('#room-panel')).toBeHidden(); await expect(page.locator('#stage')).toHaveClass(/is-mini/);
});

test('a cooldown tick does not replace a control during a click or discard a name draft', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-09-27T12:00:00') });
  await page.goto('/'); await expect(page.locator('#loading-note')).toBeHidden({ timeout: 30000 });
  await page.locator('#pet-button').click(); await page.locator('#pet-play').click();
  await page.locator('#pet-edit-name').click(); await page.locator('#pet-name').fill('Maple');
  const summary = page.locator('#pet-belongings > summary'); await summary.hover();
  await page.mouse.down(); await page.clock.fastForward('01:01'); await page.mouse.up();
  await expect(page.locator('#pet-belongings')).toHaveAttribute('open', '');
  await expect(page.locator('#pet-name')).toHaveValue('Maple');
  await expect(page.locator('#pet-play small')).toHaveText('24m ♡');
});
