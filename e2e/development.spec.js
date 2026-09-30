import { test, expect } from '@playwright/test';
import { BAIT_RANGES, baitRange } from '../src/core/fishing.js';

const ready = page => expect(page.locator('#loading-note')).toBeHidden({ timeout: 60000 });
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('little-hours-v1')));

test('development bait preserves the starter and never ships in production', async ({ page }, testInfo) => {
  await page.goto('/'); await ready(page);
  await page.locator('#task').fill('A quiet afternoon');
  const production = Boolean(testInfo.project.metadata.production);
  await expect.poll(async () => (await saved(page))?.pond.bait.length).toBe(production ? 1 : 15);
  const state = await saved(page);
  expect(state.pond.bait[0]).toEqual({ minutes: 10, at: 0 });
  if (!production) for (const range of BAIT_RANGES) expect(state.pond.bait.filter(bait => baitRange(bait.minutes).id === range.id)).toHaveLength(3);
  expect(state.house.coins).toBe(0);
  await page.reload(); await ready(page);
  expect((await saved(page)).pond.bait).toEqual(state.pond.bait);
  if (production) expect(await page.evaluate(() => window.__littleHours)).toBeUndefined();
});

for (const pin of ['clock', 'random']) {
  test(`${pin}-pinned sessions keep an empty bait inventory`, async ({ page }) => {
    await page.addInitScript(kind => {
      window.__littleHoursTest = kind === 'clock' ? { now: () => 1_790_000_000_000 } : { random: () => .5 };
      localStorage.setItem('little-hours-v1', JSON.stringify({ pond: { bait: [], journal: {}, log: [] } }));
    }, pin);
    await page.goto('/'); await ready(page);
    await page.locator('#task').fill('One little thing');
    expect((await saved(page)).pond.bait).toEqual([]);
  });
}

test('stocking development bait preserves an overdue session reveal and rewards it once', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('little-hours-v1')) localStorage.setItem('little-hours-v1', JSON.stringify({
      session: { duration: 25 * 60_000, remaining: 25 * 60_000, running: true, endsAt: Date.now() - 1000, petId: 'cat' },
    }));
  });
  await page.goto('/'); await ready(page);
  await expect(page.locator('#session-celebration')).toBeVisible();
  await expect(page.locator('#celebration-gift')).toContainText('A daisy for you');
  await expect(page.locator('#celebration-earned')).toHaveText('+25 coins');
  const completed = await saved(page);
  expect(completed.session.running).toBe(false);
  expect(completed.history).toHaveLength(1);
  expect(completed.petBonds.cat.gift).toBe('daisy');
  expect(completed.house.coins).toBe(25);
  await page.reload(); await ready(page);
  await expect(page.locator('#session-celebration')).toBeHidden();
  expect((await saved(page)).history).toEqual(completed.history);
  expect((await saved(page)).house.coins).toBe(25);
});
