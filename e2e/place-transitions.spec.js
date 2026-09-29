import { test, expect } from '@playwright/test';

const openGarden = async page => { if (await page.locator('#focus-progress').getAttribute('open') === null) await page.locator('#focus-progress > summary').click(); await page.locator('#focus-garden').click(); };

const ready = page => expect(page.locator('#loading-note')).toBeHidden({ timeout: 30000 });
const settled = page => expect(page.locator('html')).not.toHaveAttribute('data-place-transition', { timeout: 30000 });
async function transition(page, click, destination) {
  await page.evaluate(() => {
    window.__placeTransitionEvidence = null;
    const observer = new MutationObserver(() => {
      const veil = document.querySelector('.place-transition');
      if (!veil) return;
      const rect = veil.getBoundingClientRect();
      window.__placeTransitionEvidence = {
        destination: document.documentElement.dataset.placeTransition,
        coversPage: rect.width === innerWidth && rect.height === innerHeight && getComputedStyle(veil).display !== 'none',
        animates: veil.getAnimations().some(animation => animation.effect.getKeyframes().some(frame => frame.opacity === '1')),
      };
      observer.disconnect();
    });
    observer.observe(document.body, { childList: true });
  });
  await click();
  await expect.poll(() => page.evaluate(() => window.__placeTransitionEvidence)).toEqual({ destination, coversPage: true, animates: true });
  await settled(page);
}

test('garden and pond entrances and exits fade, including the path home and study exit', async ({ page }) => {
  await page.goto('/'); await ready(page);
  await transition(page, () => openGarden(page), 'garden');
  await expect(page.getByRole('button', { name: 'Back home', exact: true })).toBeVisible();
  await transition(page, () => page.locator('#garden-back').click(), 'island');
  await transition(page, () => page.locator('#house-open-garden').click(), 'garden');
  await transition(page, () => page.getByRole('button', { name: 'Back home', exact: true }).click(), 'home');
  await expect(page.locator('#room-section')).toBeVisible();
  await transition(page, () => openGarden(page), 'garden');
  await page.locator('#garden-plant-seed').click();
  await transition(page, () => page.locator('#garden-study').click(), 'home');
  await expect(page.locator('#start-button')).toBeFocused();
  await page.locator('#rooms-button').click();
  await transition(page, () => page.locator('#house-canvas [data-room="pond"]').click(), 'pond');
  await expect(page.locator('#lake-page')).toBeVisible();
  await transition(page, () => page.locator('#lake-back').click(), 'island');
  await expect(page.locator('#lake-page')).toBeHidden();
  await expect(page.locator('#house-canvas [data-room="pond"]')).toBeFocused();
});

test('reduced motion skips place transitions and repeated keyboard exits leave no overlay', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/'); await ready(page);
  await openGarden(page);
  await expect(page.locator('#garden-back')).toBeVisible(); await settled(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#house-open-garden')).toBeFocused(); await settled(page);
  await page.locator('#house-canvas [data-room="pond"]').click();
  await expect(page.locator('#lake-page')).toBeVisible(); await settled(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#lake-page')).toBeHidden(); await settled(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('#house-open-garden').click(); await settled(page);
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await settled(page);
  await expect(page.locator('body')).not.toHaveClass(/is-garden/);
  if (await page.locator('#back-to-room').isVisible()) await page.locator('#back-to-room').click();
  await expect(page.locator('#room-section')).toBeVisible();
  await expect(page.locator('#start-button')).toBeEnabled();
  await openGarden(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('#garden-back')).toBeVisible(); await settled(page);
  await expect(page.locator('.place-transition')).toHaveCount(0);
});
