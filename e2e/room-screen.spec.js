import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ready = page => expect(page.locator('#loading-note')).toBeHidden({ timeout: 30000 });
const chrome = '.room-title-row, .heading-actions, .room-tools, #focus-quickbar';

async function open(page, viewport, theme = 'dusk') {
  await page.setViewportSize(viewport); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(value => { if (!sessionStorage.seeded) { localStorage.setItem('little-hours-v1', JSON.stringify({ theme: value })); sessionStorage.seeded = '1'; } }, theme);
  await page.goto('/'); await ready(page);
}

const geometry = page => page.evaluate(selector => {
  const box = element => { const rect = element.getBoundingClientRect(); return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }; };
  const centre = { left: innerWidth / 3, right: innerWidth * 2 / 3, top: innerHeight / 3, bottom: innerHeight * 2 / 3 };
  const overlaps = rect => rect.left < centre.right && rect.right > centre.left && rect.top < centre.bottom && rect.bottom > centre.top;
  const buttons = [...document.querySelectorAll('.room-heading button, .room-tools button, #focus-quickbar button')].filter(button => button.getClientRects().length).map(box);
  return {
    stage: box(document.getElementById('stage')),
    scrolls: document.documentElement.scrollWidth > innerWidth,
    buttons,
    coveringCentre: [...document.querySelectorAll(selector)].filter(element => overlaps(box(element))).map(element => element.className),
    ink: [document.getElementById('room-title'), document.querySelector('#pet-button svg'), document.querySelector('#rooms-button svg')].map(element => getComputedStyle(element).color),
  };
}, chrome);

for (const viewport of [{ width: 1440, height: 900 }, { width: 430, height: 932 }, { width: 390, height: 844 }, { width: 360, height: 740 }]) {
  test(`the room fills a ${viewport.width}px screen with floating chrome clear of its centre`, async ({ page }, testInfo) => {
    await open(page, viewport);
    const layout = await geometry(page);
    expect(layout.stage).toMatchObject({ left: 0, top: 0, width: viewport.width, height: viewport.height });
    expect(layout.scrolls).toBe(false);
    expect(layout.coveringCentre).toEqual([]);
    for (const button of layout.buttons) {
      expect(button.width).toBeGreaterThanOrEqual(44); expect(button.height).toBeGreaterThanOrEqual(44);
      expect(button.left).toBeGreaterThanOrEqual(0); expect(button.right).toBeLessThanOrEqual(viewport.width);
    }
    await expect(page.locator('#room-more-toggle')).toBeVisible(); await expect(page.locator('#pet-button')).toBeVisible(); await expect(page.locator('#buddy-tool')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`room-screen-${viewport.width}.png`) });
  });
}

test('the More menu drops below its button and holds the secondary room tools', async ({ page }) => {
  await open(page, { width: 390, height: 844 });
  await page.locator('#room-more-toggle').click();
  const toggle = await page.locator('#room-more-toggle').boundingBox(), menu = await page.locator('#room-more').boundingBox();
  expect(menu.y).toBeGreaterThanOrEqual(toggle.y + toggle.height);
  expect(menu.x).toBeGreaterThanOrEqual(0); expect(menu.x + menu.width).toBeLessThanOrEqual(390); expect(menu.y + menu.height).toBeLessThanOrEqual(844);
  for (const id of ['#time-toggle', '#avatar-button', '#mini-button', '#reset-view', '[data-panel="performance"]', '#save-status']) await expect(page.locator(`#room-more ${id}`)).toBeVisible();
  await expect(page.locator('#save-status')).toHaveText('Saved on this device');
  expect((await new AxeBuilder({ page }).include('.room-heading').withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.locator('#room-more')).toBeHidden(); await expect(page.locator('#room-more-toggle')).toBeFocused();
});

for (const theme of ['day', 'dusk', 'rain']) {
  test(`the floating chrome keeps its light-on-glass ink in the ${theme} theme`, async ({ page }, testInfo) => {
    await open(page, { width: 1440, height: 900 }, theme);
    await expect(page.locator('body')).toHaveAttribute('data-theme', theme);
    expect((await geometry(page)).ink).toEqual(Array(3).fill('rgb(243, 234, 225)'));
    await page.screenshot({ path: testInfo.outputPath(`room-screen-${theme}.png`) });
  });
}

test('decorating returns to its own framed layout without the floating More button', async ({ page }) => {
  await open(page, { width: 1440, height: 900 });
  await page.locator('#decorate-button').click();
  await expect(page.locator('body')).toHaveClass(/is-decorating/);
  await expect(page.locator('#room-more-toggle')).toBeHidden();
  expect(await page.locator('#stage').evaluate(stage => getComputedStyle(stage).position)).toBe('relative');
  await page.locator('#decorate-button').click();
  await expect(page.locator('#room-more-toggle')).toBeVisible();
  expect(await page.locator('#stage').evaluate(stage => getComputedStyle(stage).position)).toBe('fixed');
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`the house page keeps its own padded layout at ${viewport.width}px`, async ({ page }) => {
    await open(page, viewport);
    await page.locator('#rooms-button').click();
    await expect(page.locator('#house-page')).toBeVisible();
    const house = await page.locator('#house-page').boundingBox();
    expect(house.y).toBeLessThan(viewport.height / 4); expect(house.x).toBeGreaterThan(0);
  });
}

const roomWidthShown = page => page.evaluate(() => {
  const { camera, passages } = window.__littleHours.room.diagnostics(), view = camera.getViewMatrix(true);
  const xs = [];
  for (const x of [-6.19, passages ? 8.25 : 6.19]) for (const y of [-0.32, 6.02]) for (const z of [-4.78, 4.78]) {
    const m = view.m; xs.push(m[0] * x + m[4] * y + m[8] * z + m[12]);
  }
  return (camera.orthoRight - camera.orthoLeft) / (Math.max(...xs) - Math.min(...xs));
});

test('a phone crops the room sides so it fills more of the tall screen, while a desktop shows the whole room', async ({ page }) => {
  await open(page, { width: 390, height: 844 });
  expect(await roomWidthShown(page)).toBeCloseTo(0.8 / 0.94, 2);
  await open(page, { width: 1440, height: 900 });
  expect(await roomWidthShown(page)).toBeGreaterThanOrEqual(1 / 0.94 - 0.01);
});

test('the floating chrome and the open timer sheet never blur the live room behind them', async ({ page }) => {
  await open(page, { width: 1440, height: 900 });
  await page.locator('#timer-sheet-toggle').click(); await expect(page.locator('#focus-card')).toBeVisible();
  const blurred = await page.evaluate(selector => [...document.querySelectorAll(`${selector}, #focus-card, #room-more`)].filter(element => getComputedStyle(element).backdropFilter !== 'none').map(element => element.id || element.className), chrome);
  expect(blurred).toEqual([]);
});

test('a software renderer draws the full-screen room at a reduced density so frames keep up', async ({ page }) => {
  await open(page, { width: 1440, height: 1000 });
  const room = await page.evaluate(() => {
    const { engine, pixelRatio } = window.__littleHours.room.diagnostics();
    return { renderer: engine.getGlInfo().renderer, pixelRatio, scale: engine.getRenderWidth() / engine.getRenderingCanvas().clientWidth };
  });
  expect(room.renderer).toMatch(/swiftshader/i);
  expect(room.pixelRatio).toBe(0.6);
  expect(room.scale).toBeCloseTo(0.6, 2);
});

test('the room keeps no hidden copy of the old room navigation, picker or in-room house view', async ({ page }) => {
  await open(page, { width: 1440, height: 1000 });
  await expect(page.locator('.retired-navigation, #coin-wallet, #previous-room, #next-room, #room-switcher-toggle, .home-wide, #room-picker, #house-in-room')).toHaveCount(0);
  await page.locator('#rooms-button').click();
  await expect(page.locator('body')).toHaveClass(/is-house/);
});
