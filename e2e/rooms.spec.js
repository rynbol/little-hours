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

test('room cards respect focus and reduced motion, with readable phone controls', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openRooms(page);
  await page.locator('#rename-room').click();
  await page.locator('#room-title-input').fill('A very long name for our cozy room ♡♡♡♡♡♡');
  await page.locator('#room-title-input').press('Enter');
  await page.locator('#start-button').click();
  await page.locator('#room-switcher-toggle').click();
  await page.locator('[data-house-go="garden"]').click();
  await expect(page.locator('#toast')).toHaveText('Pause your focus session before walking to another room.');
  expect((await saved(page)).house.activeId).toBe('studio');
  await page.locator('#close-room-picker').click();
  await page.locator('#start-button').click();
  await page.locator('#room-switcher-toggle').click();
  await page.locator('[data-house-go="garden"]').click();
  await expect(page.locator('#room-title')).toHaveText('Garden wing');
  await expect(page.locator('#room-travel')).toBeHidden();
  await expect(page.locator('[data-house-go="garden"]')).toHaveAttribute('aria-current', 'location');
  await page.locator('#room-switcher-toggle').click();
  const controls = await page.locator('[data-house-go], #close-room-picker').evaluateAll(nodes => nodes.map(node => {
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
  expect((await new AxeBuilder({ page }).include('#room-picker').analyze()).violations).toEqual([]);
  await expect.poll(() => page.locator('.room-card-art img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth === 720))).toBe(true);
  expect(await page.locator('.room-card-art img').count()).toBe(3);
  await page.screenshot({ path: testInfo.outputPath('room-cards-phone.png') });
  await page.locator('#close-room-picker').click();
  await page.locator('.home-wide').click();
  await expect(page.locator('#rename-room')).toBeHidden();
  await page.locator('#room-switcher-toggle').click();
  await page.locator('[data-house-go="loft"]').click();
  await expect(page.locator('#room-title')).toHaveText('Upstairs hideaway');
  await expect(page.locator('body')).not.toHaveClass(/is-connected|is-travelling/);
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
  await other.locator('#room-switcher-toggle').click();
  await other.locator('[data-house-go="garden"]').click();
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

for (const route of ['card', 'arrow', 'house']) {
  test(`${route}: focus started in another tab cancels pending travel`, async ({ page, context }, testInfo) => {
    await page.addInitScript(seed => {
      if (!localStorage.getItem('little-hours-v1')) localStorage.setItem('little-hours-v1', JSON.stringify(seed));
    }, seedState('three-rooms'));
    await page.goto('/');
    await expect(page.locator('#loading-note')).toBeHidden({ timeout: 60000 });
    const other = await context.newPage();
    await other.goto('/');
    await expect(other.locator('#loading-note')).toBeHidden({ timeout: 60000 });
    let destination;
    if (route === 'house') {
      await page.locator('#rooms-button').click();
      await page.locator('#house-rooms-toggle').click();
      await page.locator('#house-slot-garden').click();
      destination = page.locator('#enter-house-room');
    } else if (route === 'arrow') {
      destination = page.locator('#next-room');
    } else {
      if (await page.locator('#room-switcher-toggle').count()) await page.locator('#room-switcher-toggle').click();
      destination = page.locator('[data-house-go="garden"]');
    }
    if (route === 'house') {
      await page.evaluate(() => {
        const observer = new MutationObserver(() => {
          const animation = document.querySelector('.place-transition')?.getAnimations()[0];
          if (animation) { animation.pause(); observer.disconnect(); }
        });
        observer.observe(document.body, { childList: true });
      });
    } else {
      await page.clock.install();
      await page.clock.pauseAt(new Date(Date.now() + 60_000));
    }
    await destination.press('Enter');
    if (route === 'house') await expect(page.locator('html')).toHaveAttribute('data-place-transition', 'home');
    else await expect(page.locator('body')).toHaveClass(/is-travelling/);
    await other.locator('#start-button').click();
    await expect(other.locator('body')).toHaveClass(/is-focusing/);
    await expect(page.locator('body')).toHaveClass(/is-focusing/);
    if (route === 'house') {
      await page.locator('.place-transition').evaluate(node => node.getAnimations().forEach(animation => animation.play()));
      await expect(page.locator('html')).not.toHaveAttribute('data-place-transition');
    } else await page.clock.runFor(300);
    const actual = await page.evaluate(() => ({ save: JSON.parse(localStorage.getItem('little-hours-v1')), heading: document.querySelector('#room-title').textContent, body: document.body.className }));
    await testInfo.attach('arrival-state', { body: JSON.stringify(actual, null, 2), contentType: 'application/json' });
    await page.screenshot({ path: testInfo.outputPath(`${route}-focus-race.png`) });
    expect(actual.save.session.running).toBe(true);
    expect(actual.save.house.activeId).toBe('studio');
    await other.close();
  });
}

for (const motion of ['no-preference', 'reduce']) {
  test(`room picker opens and closes cleanly with ${motion} motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: motion });
    await openRooms(page);
    const picker = page.locator('#room-picker');
    await page.locator('#room-switcher-toggle').click();
    await expect(picker).toBeVisible();
    await expect(page.locator('[aria-current="location"]')).toBeFocused();
    await page.waitForFunction(() => !document.querySelector('#room-picker').getAnimations().some(animation => animation.playState === 'running'));
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[data-house-go="garden"]')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(picker).not.toHaveAttribute('open');
    await expect(page.locator('#room-switcher-toggle')).toBeFocused();
    await page.locator('#room-switcher-toggle').press('Enter');
    await expect(picker).toBeVisible();
    await expect(page.locator('[aria-current="location"]')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(picker).toBeHidden();
    expect(await page.evaluate(() => document.getAnimations().filter(animation => animation.effect?.target?.closest?.('#room-picker')).length)).toBe(0);
  });
}
