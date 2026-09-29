import { test, expect } from '@playwright/test';

test('live timing updates keep the quality button under a held pointer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('#loading-note')).toBeHidden({ timeout: 30000 });
  await page.locator('#room-more-toggle').click(); await page.locator('[data-panel="performance"]').click();
  await expect(page.locator('#performance-metrics dd')).toHaveCount(6, { timeout: 30000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    const metrics = document.querySelector('#performance-metrics');
    const fixture = { milliseconds: '16.7' };
    fixture.apply = () => {
      const readout = metrics.querySelectorAll('dd')[1];
      const value = `${fixture.milliseconds} <small>ms</small>`;
      if (readout && readout.innerHTML !== value) readout.innerHTML = value;
    };
    new MutationObserver(fixture.apply).observe(metrics, { childList: true, subtree: true });
    fixture.apply();
    window.qualityReadoutFixture = fixture;
  });
  const button = page.locator('[data-quality="battery"]');
  const before = await button.boundingBox();
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.evaluate(() => {
    window.qualityReadoutFixture.milliseconds = '1000.0';
    window.qualityReadoutFixture.apply();
  });
  const held = await button.boundingBox();
  await page.mouse.up();
  expect(held.y).toBeCloseTo(before.y, 1);
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.__littleHours.room.diagnostics().quality)).toBe('battery');
});
