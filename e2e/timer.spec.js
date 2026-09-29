import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const coins = page => page.locator('#coin-balance');
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('little-hours-v1')));

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-25T10:00:00') });
  await page.goto('/');
});

test('a focus session survives pausing and a reload, then completes exactly once', async ({ page }) => {
  const start = page.locator('#start-button');
  await expect(page.locator('#timer')).toHaveText('25:00');
  await expect(page.locator('#timer')).toHaveAttribute('aria-label', '25 minutes remaining');
  await expect(coins(page)).toHaveText('0');

  await start.click();
  await expect(start).toHaveText(/Pause a moment/);
  await page.clock.fastForward('05:00');
  await expect(page.locator('#timer')).toHaveText(/^(19:5\d|20:00)$/);
  await start.click();
  await expect(start).toHaveText(/Keep going/);
  const pausedAt = await page.locator('#timer').textContent();

  await page.reload();
  await expect(page.locator('#timer')).toHaveText(pausedAt);
  await expect(page.locator('#start-button')).toHaveText(/Keep going/);
  await expect(page.locator('#stage-presence')).toHaveAttribute('data-presence', 'break');

  await page.locator('#start-button').click();
  await expect(page.locator('#start-button')).toHaveText(/Pause a moment/);
  await page.clock.fastForward('21:00');
  await expect(page.locator('#session-celebration')).toBeVisible();
  await expect(page.locator('#celebration-earned')).toHaveText('+25 coins');
  await expect(coins(page)).toHaveText('25');
  await page.locator('#session-celebration .start-button').click();

  // Later ticks, a reload and another hour never pay the same session again.
  await page.clock.fastForward('01:00:00');
  await page.reload();
  await expect(coins(page)).toHaveText('25');
  const state = await saved(page);
  expect(state.history).toEqual([expect.objectContaining({ id: state.session.id, date: '2026-09-25', minutes: 25, task: '' })]);
  await expect(page.locator('#timer')).toHaveText('00:00');
  await expect(page.locator('#session-result')).toContainText('25 minutes completed');
  expect(state.house.coins).toBe(25);
});

test('a running session keeps counting while the page is closed', async ({ page }) => {
  await page.locator('#start-button').click();
  await expect(page.locator('#start-button')).toHaveText(/Pause/);
  await page.reload();
  await expect(page.locator('#start-button')).toHaveText(/Pause a moment/);
  await page.clock.fastForward('25:00');
  await expect(page.locator('#session-celebration')).toBeVisible();
  await expect(coins(page)).toHaveText('25');
});

test('the chime preference is remembered', async ({ page }) => {
  const chime = page.locator('#chime-toggle');
  await expect(chime).toBeChecked();
  await chime.uncheck();
  await page.reload();
  await expect(page.locator('#chime-toggle')).not.toBeChecked();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('little-hours-sound')))).toEqual({ volume: 30, chime: false });
});

test('a named completion stays visible after reload and optional breaks never pay focus rewards', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const start = page.locator('#start-button');
  await page.locator('#task').fill('Read <chapter one> & reflect');
  await start.click(); await expect(start).toHaveText(/Pause/);
  const id = (await saved(page)).session.id;
  await page.locator('#task').fill('Tomorrow’s task');
  await page.locator('#timer').click();
  await page.clock.fastForward('25:01');
  await expect(page.locator('#session-celebration')).toBeVisible();
  await page.locator('#session-celebration .start-button').click();
  await expect(page.locator('#session-result')).toContainText('Read <chapter one> & reflect');
  await page.reload();
  await expect(page.locator('#session-celebration')).toBeHidden();
  await expect(page.locator('#session-result')).toContainText('Read <chapter one> & reflect');
  expect((await saved(page)).history[0]).toMatchObject({ id, task: 'Read <chapter one> & reflect' });
  await page.locator('.session-journal > summary').click();
  await expect(page.locator('#week-history ul li')).toHaveCount(7);
  await expect(page.locator('.recent-sessions')).toContainText('Read <chapter one> & reflect');
  expect((await new AxeBuilder({ page }).exclude('#room-canvas').withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  const before = await saved(page);
  await page.locator('[data-break-minutes="5"]').click();
  await expect(start).toHaveText(/End break/);
  await expect(page.locator('#focus-reward')).toBeHidden();
  await expect(page.locator('body')).not.toHaveClass(/is-focusing/);
  await page.locator('#pet-button').click();
  await expect(page.locator('#pet-study')).toHaveText('End break');
  await page.locator('#close-panel').click();
  await page.locator('#avatar-button').click();
  await expect(page.locator('#avatar-done')).toBeVisible();
  expect((await saved(page)).session.running).toBe(true);
  await page.locator('#avatar-done').click();
  await page.reload(); await expect(start).toHaveText(/End break/);
  await page.clock.fastForward('05:01');
  await expect(page.locator('#session-kind')).toHaveText('Break complete');
  await expect(page.locator('#timer')).toHaveText('00:00');
  await expect(page.locator('#session-celebration')).toBeHidden();
  const after = await saved(page);
  expect(after.house.coins).toBe(before.house.coins);
  expect(after.history).toEqual(before.history);
  expect(after.house.sessions).toEqual(before.house.sessions);
  expect(after.pond.bait).toEqual(before.pond.bait);
  expect(after.petBonds.cat.minutes).toBe(before.petBonds.cat.minutes);
  await start.click(); await expect(start).toHaveText(/Pause/);
  expect((await saved(page)).session.kind).toBe('focus');
  expect((await saved(page)).session.taskSnapshot).toBe('Tomorrow’s task');
});

test('changing a paused duration asks first and ending a long break returns to focus ready', async ({ page }) => {
  const start = page.locator('#start-button');
  await start.click(); await expect(start).toHaveText(/Pause/);
  await page.clock.fastForward('01:00');
  await start.click(); await expect(start).toHaveText(/Keep going/);
  const paused = (await saved(page)).session;
  await page.locator('[data-minutes="50"]').click();
  await expect(page.locator('#replace-session')).toBeVisible();
  await page.locator('#keep-session').click();
  expect((await saved(page)).session).toEqual(paused);
  await page.locator('[data-minutes="50"]').click();
  await page.locator('#replace-session-confirm').click();
  await expect(page.locator('#timer')).toHaveText('50:00');
  expect((await saved(page)).history).toHaveLength(0);
  await start.click(); await expect(start).toHaveText(/Pause/);
  await page.clock.fastForward('50:01');
  await expect(page.locator('#session-celebration')).toBeVisible();
  await page.locator('#session-celebration .start-button').click();
  await page.locator('[data-break-minutes="15"]').click();
  await expect(start).toHaveText(/End break/);
  await start.click(); await expect(start).toHaveText(/Start focusing/);
  await expect(page.locator('#timer')).toHaveText('50:00');
  expect((await saved(page)).house.coins).toBe(50);
  expect((await saved(page)).session.phase).toBe('ready');
});

test('two tabs racing an expired session and an ordinary edit keep one reward and both changes', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const other = await context.newPage();
  await other.emulateMedia({ reducedMotion: 'reduce' });
  await other.clock.install({ time: new Date('2026-09-25T10:00:00') });
  await other.goto('/');
  await expect(other.locator('#loading-note')).toBeHidden();
  const start = page.locator('#start-button');
  await start.click(); await expect(start).toHaveText(/Pause/);
  await expect(other.locator('#start-button')).toHaveText(/Pause/);
  const before = await saved(page), deadline = before.session.endsAt;
  await Promise.all([page.clock.setSystemTime(new Date(deadline + 1000)), other.clock.setSystemTime(new Date(deadline + 1000))]);
  await Promise.all([start.click(), other.locator('#time-toggle').click()]);
  await expect(coins(page)).toHaveText('25'); await expect(coins(other)).toHaveText('25');
  const state = await saved(page);
  expect(state.history).toHaveLength(1);
  expect(state.history[0].id).toBe(before.session.id);
  expect(state.house.sessions).toHaveLength(1);
  expect(state.pond.bait).toHaveLength(before.pond.bait.length + 1);
  expect(state.petBonds.cat.minutes).toBe(25);
  expect(state.theme).not.toBe(before.theme);
  expect(Number(await page.locator('#session-celebration').isVisible()) + Number(await other.locator('#session-celebration').isVisible())).toBe(1);
  await Promise.all([page.reload(), other.reload()]);
  await expect(page.locator('#session-celebration')).toBeHidden();
  await expect(other.locator('#session-celebration')).toBeHidden();
  await expect(coins(page)).toHaveText('25');
  await other.close();
});
