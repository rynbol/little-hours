import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ready = page => expect(page.locator('#loading-note')).toBeHidden({ timeout: 30000 });

test('the live close-up survives care updates and releases its renderer on close', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('little-hours-v1', JSON.stringify({ pets: ['cat', 'dog', 'bunny', 'fox', 'panda'] })));
  await page.goto('/'); await ready(page); await page.locator('#pet-button').click();
  await expect(page.locator('#pet-closeup canvas')).toBeVisible();
  const counts = () => page.evaluate(() => window.__littleHours.counts());
  expect((await counts()).engines).toBe(2);
  await page.locator('#pet-closeup').click();
  await expect(page.locator('#pet-ritual-status')).toHaveText('+2 ♡');
  await expect(page.locator('#pet-closeup')).toBeFocused();
  expect((await counts()).engines).toBe(2);
  await page.locator('#pet-collection > summary').click();
  for (const id of ['dog', 'bunny', 'fox', 'panda', 'cat']) {
    await page.locator(`[data-pet-choice="${id}"]`).click();
    await expect(page.locator('#pet-closeup')).toHaveAttribute('data-species', id);
    expect(await page.evaluate(() => window.__littleHours.petCloseup.species)).toBe(id);
    expect((await counts()).engines).toBe(2);
  }
  await page.locator('#close-panel').click();
  expect((await counts()).engines).toBe(1); expect(await page.evaluate(() => window.__littleHours.petCloseup)).toBeNull();
  await page.locator('#pet-button').click(); expect((await counts()).engines).toBe(2);
});

test('studying from the pet card delivers a physical gift once and keeps it after reload', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-09-28T12:00:00') });
  await page.goto('/'); await ready(page); await page.locator('#pet-button').click();
  await expect(page.locator('#pet-gifts')).toContainText('25 min to go');
  await page.locator('#pet-study').click();
  await expect(page.locator('#pet-closeup')).toHaveAttribute('data-mode', 'studying');
  await page.clock.fastForward('25:01');
  await expect(page.locator('#celebration-gift')).toContainText('A daisy for you');
  await expect(page.locator('#celebration-gift')).toContainText('From Miso ♡');
  expect(await page.evaluate(() => window.__littleHours.room.diagnostics().petBelongings.gift.selected)).toBe('daisy');
  await page.locator('#session-celebration .start-button').click();
  await page.locator('#pet-gifts > summary').click();
  await expect(page.locator('#pet-gift-daisy')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#pet-gift-star')).toBeDisabled();
  await page.reload(); await ready(page); await page.locator('#pet-button').click();
  await expect(page.locator('#session-celebration')).toBeHidden();
  expect(await page.evaluate(() => window.__littleHours.state.petBonds.cat.gift)).toBe('daisy');
  expect(await page.evaluate(() => window.__littleHours.state.petBonds.cat.sessions)).toBe(1);
});

test('earned gifts can be displayed without spending coins and the card remains accessible', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('little-hours-v1', JSON.stringify({ petBonds: { cat: { minutes: 150, affection: 60, gift: 'moon' } } })));
  await page.goto('/'); await ready(page); await page.locator('#pet-button').click(); await page.locator('#pet-gifts > summary').click();
  for (const id of ['daisy', 'star', 'moon']) {
    await page.locator(`#pet-gift-${id}`).click();
    await expect(page.locator(`#pet-gift-${id}`)).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => window.__littleHours.room.diagnostics().petBelongings.gift.selected)).toBe(id);
    await expect(page.locator('#coin-balance')).toHaveText('0');
  }
  expect((await new AxeBuilder({ page }).include('#room-panel').analyze()).violations).toEqual([]);
});

test('the close-up starts and stops rendering when the motion preference changes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/'); await ready(page); await page.locator('#pet-button').click();
  await expect.poll(() => page.evaluate(() => { const scene = window.__littleHours.petCloseup.scene; return scene.isReady() && scene.getActiveMeshes().length > 0; })).toBe(true);
  await page.waitForTimeout(200);
  const first = await page.evaluate(() => window.__littleHours.petCloseup.frames);
  await page.waitForTimeout(600); expect(await page.evaluate(() => window.__littleHours.petCloseup.frames)).toBe(first);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(() => page.evaluate(() => window.__littleHours.petCloseup.frames)).toBeGreaterThan(first + 2);
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(100);
  const stopped = await page.evaluate(() => window.__littleHours.petCloseup.frames);
  await page.waitForTimeout(600); expect(await page.evaluate(() => window.__littleHours.petCloseup.frames)).toBe(stopped);
});


test('an immediate pause keeps the study invitation attached to the original pet', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-09-28T12:00:00') });
  await page.goto('/'); await ready(page); await page.locator('#pet-button').click();
  await page.clock.pauseAt(new Date('2026-09-28T12:01:00'));
  await page.locator('#pet-study').click(); await page.locator('#pet-study').click();
  await page.locator('#pet-collection > summary').click(); await page.locator('[data-pet-choice="dog"]').click();
  await expect(page.locator('#pet-study')).toHaveText('Continue with Miso');
  await page.locator('#pet-study').click();
  expect(await page.evaluate(() => window.__littleHours.state.session.petId)).toBe('cat');
  await expect(page.locator('#pet-closeup')).toHaveAttribute('data-mode', 'awake');
});

test('switching pets clears the previous pet’s meal reaction in the close-up', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('little-hours-v1', JSON.stringify({ house: { coins: 5 } })));
  await page.goto('/'); await ready(page); await page.locator('#pet-button').click();
  await page.locator('#pet-feed').click(); await page.locator('#pet-meal-supper').click();
  await expect(page.locator('#pet-closeup')).toHaveAttribute('data-reaction', 'treat');
  await page.locator('#pet-collection > summary').click(); await page.locator('[data-pet-choice="dog"]').click();
  await expect(page.locator('#pet-closeup')).not.toHaveAttribute('data-reaction');
  expect(await page.evaluate(() => window.__littleHours.state.petBonds.dog.care.meals)).toBe(0);
});

test('the close-up stops drawing after it scrolls out of the phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/'); await ready(page); await page.locator('#pet-button').click();
  await page.locator('#pet-belongings > summary').click(); await page.locator('#pet-friendship > summary').click();
  await page.locator('#pet-gifts > summary').click(); await page.locator('#pet-collection > summary').click();
  await page.locator('#pet-choice-panda').hover(); await page.mouse.wheel(0, 1500);
  await expect.poll(() => page.locator('#pet-closeup').evaluate(el => el.getBoundingClientRect().bottom <= 0)).toBe(true);
  await page.waitForTimeout(100);
  const frames = await page.evaluate(() => window.__littleHours.petCloseup.frames);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__littleHours.petCloseup.frames)).toBe(frames);
  await page.locator('#pet-closeup').scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => window.__littleHours.petCloseup.frames)).toBeGreaterThan(frames);
});
