import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ready = page => expect(page.locator('#focus-mode-enter')).toBeEnabled({ timeout: 30000 });
const state = page => page.evaluate(() => JSON.parse(localStorage.getItem('little-hours-v1')));
const focusing = page => page.locator('body.is-focus-mode');

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-09-28T12:00:00') });
  await page.goto('/'); await ready(page);
});

test('focus mode keeps the whole room and starts, resumes and exits without resetting a running timer', { tag: '@dev-diagnostics' }, async ({ page }) => {
  await page.locator('#focus-mode-enter').click();
  await expect(focusing(page)).toHaveCount(1);
  await expect(page.locator('#focus-mode-exit')).toBeFocused();
  await expect(page.locator('#focus-mode-timer')).toHaveText(/^(24:5\d|25:00)$/);
  expect((await state(page)).session.running).toBe(true);
  expect(await page.evaluate(() => {
    const room = window.__littleHours.room.diagnostics(), desk = room.scene.transformNodes.find(node => node.metadata?.itemId === room.layout.activeDeskId);
    return room.scene.meshes.filter(mesh => mesh.isEnabled() && !mesh.isDescendantOf(desk) && mesh.visibility > 0).length;
  })).toBeGreaterThan(40);
  await expect.poll(() => page.evaluate(() => { const room = window.__littleHours.room.diagnostics(); return room.companion.atDesk && room.companion.state === 'working'; })).toBe(true);
  await expect(page.locator('.app-header')).toBeHidden(); await expect(page.locator('#focus-card')).toBeHidden();
  const deadline = (await state(page)).session.endsAt;
  await page.keyboard.press('Escape');
  await expect(focusing(page)).toHaveCount(0); await expect(page.locator('#focus-mode-enter')).toBeFocused();
  expect((await state(page)).session.endsAt).toBe(deadline);
  await page.locator('#focus-mode-enter').click(); expect((await state(page)).session.endsAt).toBe(deadline);
  await page.locator('#focus-mode-exit').click();
  await page.clock.fastForward('05:00'); await page.locator('#start-button').click();
  await expect(page.locator('#start-button')).toHaveText(/Keep going/);
  const remaining = (await state(page)).session.remaining;
  await page.locator('#focus-mode-enter').click();
  await expect(focusing(page)).toHaveCount(1);
  expect((await state(page)).session.remaining).toBe(remaining);
  await page.keyboard.press('Escape'); expect((await state(page)).session.running).toBe(true);
});

test('entry closes pet care, and turning in the chair to find the pet lets a tap leave focus mode for care', { tag: '@dev-diagnostics' }, async ({ page }) => {
  await page.locator('#pet-button').click();
  expect(await page.evaluate(() => window.__littleHours.counts().engines)).toBe(2);
  await page.locator('#focus-toggle').click();
  await expect(page.locator('#room-panel')).toBeHidden();
  expect(await page.evaluate(() => window.__littleHours.counts().engines)).toBe(1);
  expect(await page.evaluate(() => window.__littleHours.petCloseup)).toBeNull();
  await page.locator('#focus-mode-enter').click(); await expect(focusing(page)).toHaveCount(1);
  await page.evaluate(() => window.__littleHours.settled());
  const view = page.viewportSize(), petPoint = () => page.evaluate(() => window.__littleHours.screenPoint('pet'));
  let point = await petPoint();
  for (let turns = 0; !point?.visible && turns < 16; turns++) {
    await page.mouse.move(view.width / 2, view.height / 2); await page.mouse.down();
    await page.mouse.move(view.width / 2 - 160, view.height / 2, { steps: 4 }); await page.mouse.up();
    await page.evaluate(() => new Promise(requestAnimationFrame)); point = await petPoint();
  }
  expect(point?.visible, 'turning in the chair finds the pet').toBe(true);
  await page.mouse.click(point.x, point.y);
  await expect(focusing(page)).toHaveCount(0, { timeout: 20000 }); await expect(page.locator('#pet-closeup canvas')).toBeVisible();
  expect((await state(page)).session.running).toBe(true);
});

test('focus completion delivers the captured pet gift once after changing the displayed pet', async ({ page }) => {
  await page.locator('#focus-mode-enter').click(); await expect(focusing(page)).toHaveCount(1); await page.clock.fastForward('05:00');
  await page.keyboard.press('Escape'); await page.locator('#start-button').click();
  await page.locator('#pet-button').click(); await page.locator('#pet-collection > summary').click();
  await page.locator('[data-pet-choice="dog"]').click(); await page.locator('#close-panel').click();
  await page.locator('#focus-mode-enter').click();
  await expect(focusing(page)).toHaveCount(1);
  expect((await state(page)).session.petId).toBe('cat');
  await page.clock.fastForward('20:01');
  await expect(focusing(page)).toHaveCount(0);
  await expect(page.locator('#celebration-gift')).toContainText('A daisy for you');
  await expect(page.locator('#celebration-gift')).toContainText('From Miso');
  const completed = await state(page);
  expect(completed.pet).toBe('dog'); expect(completed.petBonds.cat.gift).toBe('daisy'); expect(completed.petBonds.dog.gift).toBeNull();
  expect(completed.history).toHaveLength(1); expect(completed.house.coins).toBe(25);
  await page.reload(); await ready(page);
  await expect(focusing(page)).toHaveCount(0); await expect(page.locator('#session-celebration')).toBeHidden();
  expect((await state(page)).history).toHaveLength(1);
});

test('entry settles an overdue session without silently starting another timer', async ({ page }) => {
  await page.clock.pauseAt(new Date('2026-09-28T12:01:00'));
  await page.locator('#start-button').click();
  await expect(page.locator('#start-button')).toHaveText(/Pause/);
  await page.locator('#focus-mode-enter').focus();
  await page.clock.setSystemTime(new Date('2026-09-28T12:27:00'));
  await page.keyboard.press('Enter');
  await expect(focusing(page)).toHaveCount(0); await expect(page.locator('#session-celebration')).toBeVisible();
  const completed = await state(page);
  expect(completed.session.running).toBe(false); expect(completed.session.remaining).toBe(0);
  expect(completed.history).toHaveLength(1); expect(completed.house.coins).toBe(25);
});

test('another tab can pause the timer or replace the room without leaving focus mode stuck', async ({ page, context }) => {
  const other = await context.newPage();
  await other.emulateMedia({ reducedMotion: 'reduce' });
  await other.clock.install({ time: new Date('2026-09-28T12:00:00') });
  await other.goto('/'); await ready(other);
  await page.locator('#focus-mode-enter').click();
  await expect(other.locator('#start-button')).toHaveText(/Pause/);
  await other.locator('#start-button').click();
  await expect(focusing(page)).toHaveCount(0); expect((await state(page)).session.running).toBe(false);
  await page.locator('#focus-mode-enter').click();
  await expect(focusing(page)).toHaveCount(1);
  await other.locator('#time-toggle').click();
  await expect(focusing(page)).toHaveCount(0); expect((await state(page)).session.running).toBe(true);
  await other.close();
});

test('phone focus mode leaves mini view, fills the viewport and keeps an accessible exit', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#room-more-toggle').click(); await page.locator('#mini-button').click(); await expect(page.locator('#stage')).toHaveClass(/is-mini/);
  await page.locator('#focus-mode-enter').click();
  await expect(focusing(page)).toHaveCount(1);
  await expect(page.locator('#stage')).not.toHaveClass(/is-mini/);
  const box = await page.locator('#stage').boundingBox();
  expect(box.x).toBe(0); expect(box.y).toBe(0); expect(box.width).toBe(390); expect(box.height).toBe(844);
  const exit = await page.locator('#focus-mode-exit').boundingBox();
  expect(exit.x).toBeGreaterThanOrEqual(0); expect(exit.x + exit.width).toBeLessThanOrEqual(390); expect(exit.height).toBeGreaterThanOrEqual(44);
  expect((await new AxeBuilder({ page }).exclude('#room-canvas').withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement.getClientRects().length > 0)).toBe(true);
  await page.keyboard.press('Escape'); await expect(page.locator('#focus-mode-enter')).toBeFocused();
});
