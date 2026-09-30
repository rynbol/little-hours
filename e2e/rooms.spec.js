import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedState } from '../scripts/lh/seeds.mjs';

const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('little-hours-v1')));
const openRooms = async page => {
  await page.addInitScript(seed => {
    if (!localStorage.getItem('little-hours-v1')) localStorage.setItem('little-hours-v1', JSON.stringify(seed));
  }, seedState('three-rooms'));
  await page.goto('/');
  await expect(page.locator('#loading-note')).toBeHidden({ timeout: 60000 });
};

test('the room heading edits its own saved name without losing drafts or literal names', async ({ page }) => {
  test.slow();
  await openRooms(page);
  await expect(page.locator('#room-title')).toHaveText('Ember library');
  await page.locator('#rename-room').click();
  const input = page.locator('#room-title-input');
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('Ember library');
  await input.fill('  Our Sunday corner ♡  ');
  await page.locator('#room-more-toggle').click(); await page.locator('#time-toggle').click();
  await expect(input).toHaveValue('  Our Sunday corner ♡  ');
  await input.press('Enter');
  await expect(page.locator('#room-title')).toHaveText('Our Sunday corner ♡');
  await expect(page.locator('#rename-room')).toBeFocused();
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
  const axe = await new AxeBuilder({ page }).include('.room-heading').analyze();
  expect(axe.violations).toEqual([]);
  await input.press('Enter');
  await page.reload();
  await expect(page.locator('#loading-note')).toBeHidden({ timeout: 60000 });
  await expect(page.locator('#room-title')).toHaveText('Your studio');
  await page.locator('#rooms-button').click();
  await expect(page.locator('#house-detail')).toBeHidden();
  await page.locator('#house-rooms-toggle').click();
  await page.locator('#house-slot-studio').click();
  await expect(page.locator('#house-detail h2')).toHaveText('Your studio');
  await page.locator('#room-name-details > summary').click();
  await expect(page.locator('#room-name-input')).toHaveValue('Your studio');
});

test('a long room name keeps the phone heading readable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openRooms(page);
  await page.locator('#rename-room').click();
  await page.locator('#room-title-input').fill('A very long name for our cozy room ♡♡♡♡♡♡');
  await page.locator('#room-title-input').press('Enter');
  await expect(page.locator('#room-title')).toHaveText(/^A very long name for our cozy room/);
  const controls = await page.locator('.room-heading button:visible').evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect();
    return { width: rect.width, height: rect.height, right: rect.right, left: rect.left };
  }));
  for (const control of controls) {
    expect(control.width).toBeGreaterThanOrEqual(40);
    expect(control.height).toBeGreaterThanOrEqual(44);
    expect(control.left).toBeGreaterThanOrEqual(0);
    expect(control.right).toBeLessThanOrEqual(390);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).include('.room-heading').analyze()).violations).toEqual([]);
});

test('a room change in another tab cancels the old heading draft', async ({ page, context }) => {
  test.slow();
  await openRooms(page);
  await page.locator('#rename-room').click();
  await page.locator('#room-title-input').fill('Unsubmitted studio name');
  const other = await context.newPage();
  await other.emulateMedia({ reducedMotion: 'reduce' });
  await other.goto('/');
  await expect(other.locator('#loading-note')).toBeHidden({ timeout: 60000 });
  await other.locator('#rooms-button').click();
  await other.locator('#house-rooms-toggle').click();
  await other.locator('#house-slot-garden').click();
  await other.locator('#enter-house-room').click();
  await expect(other.locator('#room-title')).toHaveText('Garden wing');
  await expect(page.locator('#room-title')).toHaveText('Garden wing');
  await expect(page.locator('#room-title-form')).toBeHidden();
  const rooms = (await saved(page)).house.rooms;
  expect(rooms[0].name).toBeNull();
  expect(rooms[1].name).toBe('Garden wing');
  await other.close();
});

test('phone decorating keeps Done, Undo and collection uncovered', async ({ page }, testInfo) => {
  await page.addInitScript(seed => localStorage.setItem('little-hours-v1', JSON.stringify(seed)), seedState('three-rooms'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#loading-note')).toBeHidden({ timeout: 60000 });
  await page.locator('#decorate-button').click();
  await expect(page.locator('body')).toHaveClass(/is-decorating/);
  await page.waitForFunction(() => ['#builder-panel', '#stage', '#room-canvas'].every(selector => !document.querySelector(selector).getAnimations({ subtree: true }).some(animation => animation.playState === 'running')));
  const geometry = await page.evaluate(() => Object.fromEntries(['#decorate-button', '#undo-layout', '[data-furniture]'].map(selector => {
    const r = document.querySelector(selector).getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return [selector, { rect: r.toJSON(), hit: hit?.outerHTML.slice(0, 400), clear: Boolean(hit?.closest(selector)), scrollY }];
  })));
  await testInfo.attach('controls', { body: JSON.stringify(geometry, null, 2), contentType: 'application/json' });
  await page.screenshot({ path: testInfo.outputPath('phone-decorating.png') });
  expect(geometry['#decorate-button'].clear).toBe(true);
  expect(geometry['#undo-layout'].clear).toBe(true);
  expect(geometry['[data-furniture]'].clear).toBe(true);
});

test('focus started in another tab cancels a pending house-page entry', async ({ page, context }, testInfo) => {
  await page.addInitScript(seed => {
    if (!localStorage.getItem('little-hours-v1')) localStorage.setItem('little-hours-v1', JSON.stringify(seed));
  }, seedState('three-rooms'));
  await page.goto('/');
  await expect(page.locator('#loading-note')).toBeHidden({ timeout: 60000 });
  const other = await context.newPage();
  await other.goto('/');
  await expect(other.locator('#loading-note')).toBeHidden({ timeout: 60000 });
  await page.locator('#rooms-button').click();
  await page.locator('#house-rooms-toggle').click();
  await page.locator('#house-slot-garden').click();
  await page.evaluate(() => {
    const observer = new MutationObserver(() => {
      const animation = document.querySelector('.place-transition')?.getAnimations()[0];
      if (animation) { animation.pause(); observer.disconnect(); }
    });
    observer.observe(document.body, { childList: true });
  });
  await page.locator('#enter-house-room').press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-place-transition', 'home');
  await other.locator('#start-button').click();
  await expect(other.locator('body')).toHaveClass(/is-focusing/);
  await expect(page.locator('body')).toHaveClass(/is-focusing/);
  await page.locator('.place-transition').evaluate(node => node.getAnimations().forEach(animation => animation.play()));
  await expect(page.locator('html')).not.toHaveAttribute('data-place-transition');
  const actual = await page.evaluate(() => ({ save: JSON.parse(localStorage.getItem('little-hours-v1')), heading: document.querySelector('#room-title').textContent, body: document.body.className }));
  await testInfo.attach('arrival-state', { body: JSON.stringify(actual, null, 2), contentType: 'application/json' });
  expect(actual.save.session.running).toBe(true);
  expect(actual.save.house.activeId).toBe('studio');
  await other.close();
});
