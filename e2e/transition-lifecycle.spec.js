import { test, expect } from '@playwright/test';

async function ready(page) {
  await page.goto('/');
  await expect(page.locator('#loading-note')).toBeHidden({ timeout: 30000 });
  await page.evaluate(async () => {
    window.travelForTest = (await import('/src/ui/place-transition.js')).travelTo;
    window.arrivals = [];
    window.destinationReady = false;
  });
}
const settled = page => expect(page.locator('html')).not.toHaveAttribute('data-place-transition');

test('travel gates keyboard input and replacement releases it @dev-diagnostics', async ({ page }) => {
  await ready(page);
  await page.locator('#start-button').focus();
  await page.evaluate(() => {
    window.travelForTest('garden', () => window.arrivals.push('garden'), () => window.destinationReady);
    document.querySelector('.place-transition').getAnimations()[0].pause();
  });
  for (const key of ['Enter', 'Space', 'Tab', 'Escape']) await page.keyboard.press(key);
  await expect(page.locator('#start-button')).toBeFocused();
  await expect(page.locator('#start-button')).toContainText('Start');
  await expect(page.locator('html')).toHaveAttribute('data-place-transition', 'garden');
  await page.evaluate(async () => {
    const fade = document.querySelector('.place-transition').getAnimations()[0];
    fade.finish(); await fade.finished;
    window.travelForTest('home', () => window.arrivals.push('home'));
  });
  await settled(page);
  expect(await page.evaluate(() => window.arrivals)).toEqual(['garden', 'home']);
  await page.keyboard.press('Enter');
  await expect(page.locator('#start-button')).toContainText('Pause');
  await expect(page.locator('.place-transition')).toHaveCount(0);
});

test('replacement, reduced motion and hidden-page events clean up travel @dev-diagnostics', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    window.travelForTest('garden', () => window.arrivals.push('cancelled'));
    window.travelForTest('island', () => window.arrivals.push('island'), () => false);
  });
  await expect.poll(() => page.evaluate(() => window.arrivals)).toEqual(['island']);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await settled(page);
  await page.evaluate(() => { window.travelForTest('home', () => window.arrivals.push('home')); });
  expect(await page.evaluate(() => window.arrivals)).toEqual(['island', 'home']);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => {
    window.travelForTest('pond', () => window.arrivals.push('pond'), () => false);
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await settled(page);
  await expect(page.locator('.place-transition')).toHaveCount(0);
  expect(await page.evaluate(() => window.arrivals)).toEqual(['island', 'home', 'pond']);
});
