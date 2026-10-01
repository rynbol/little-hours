import { launch, sleep, slow } from './chrome.mjs';
import { seedState } from './seeds.mjs';

const START = Date.parse('2026-01-10T16:30:00');

function pinScript({ state, seed, startAt }) {
  return `(() => {
    const realNow = Date.now.bind(Date), began = realNow();
    let a = ${seed} >>> 0;
    const random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    window.__littleHoursTest = { now: () => window.__lhFrozenAt ?? ${startAt} + (realNow() - began), random }; window.__lhStartAt = ${startAt};
    try {
      if (location.protocol.startsWith('http') && !sessionStorage.getItem('lh-seeded')) {
        localStorage.clear();
        ${state ? `localStorage.setItem('little-hours-v1', ${JSON.stringify(JSON.stringify(state))});` : ''}
        sessionStorage.setItem('lh-seeded', '1');
      }
    } catch {}
  })();`;
}

export async function openApp(url, { seed = 'three-rooms', theme, reducedMotion = false, width = 1440, height = 1000, scale = 2, headed = false, randomSeed = 7, startAt = START, pins = true } = {}) {
  const browser = await launch({ width, height, scale, headed, reducedMotion });
  try {
    if (pins) await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: pinScript({ state: seedState(seed, { theme }), seed: randomSeed, startAt }) });
    const began = performance.now();
    await browser.navigate(url + '/');
    let hook = false;
    for (let i = 0; i < 600; i++) {
      const status = await browser.js(`({ hook: typeof window.__littleHours?.ready === 'function', ready: document.getElementById('loading-note')?.hidden === true })`).catch(() => ({}));
      hook = status.hook;
      if (status.ready) break;
      if (i === 599) throw new Error('The room never reported ready');
      await sleep(50);
    }
    const readyMs = performance.now() - began;
    const app = Object.assign(browser, {
      url, hook, readyMs,
      async settle(timeout = 10000) {
        if (hook) await browser.js(`window.__littleHours.settled(${timeout * slow})`);
        else await sleep(1500);
      },
      async point(target) {
        if (!hook) throw new Error('This build has no test hook, so it cannot find things in the 3D view');
        return browser.js(`window.__littleHours.screenPoint(${JSON.stringify(target)})`);
      },
      async clickTarget(target) {
        const spot = await app.point(target);
        if (!spot?.visible) throw new Error(`Not visible on screen: ${JSON.stringify(target)} ${JSON.stringify(spot)}`);
        await browser.click(spot.x, spot.y);
        return spot;
      },
      text: selector => browser.js(`document.querySelector(${JSON.stringify(selector)})?.textContent?.trim() ?? null`),
      attr: (selector, name) => browser.js(`document.querySelector(${JSON.stringify(selector)})?.getAttribute(${JSON.stringify(name)}) ?? null`),
      visible: async selector => Boolean(await browser.box(selector)),
      house: () => browser.js(`(() => { const d = window.__littleHours.house.diagnostics(); return d ? { open: d.open, closed: d.closed ?? null, builds: d.builds, renderCount: d.renderCount, activeRoomMotions: d.activeRoomMotions, drawCalls: d.drawCalls, angle: d.angle, tilt: d.tilt, trees: d.trees } : null; })()`),
      room: () => browser.js(`(() => { const d = window.__littleHours.room.diagnostics(); return { selectedId: d.selectedId, editing: d.editing, avatarEditing: d.avatarEditing, placement: d.placement, layout: d.layout, dragging: d.dragging, pixelRatio: d.pixelRatio, quality: d.quality, plantPhase: d.plantPhase }; })()`),
      saved: () => browser.js(`JSON.parse(localStorage.getItem('little-hours-v1') || 'null')`),
      async waitFor(expression, { timeout = 5000, what = expression } = {}) {
        const end = Date.now() + timeout * slow;
        let value;
        while (!(value = await browser.js(expression).catch(error => { if (/reference chain/.test(error.message)) throw new Error(`waitFor needs an expression that returns plain data: ${expression}`); return null; }))) {
          if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`);
          await sleep(50);
        }
        return value;
      },
      async reload() {
        await browser.navigate(url + '/');
        await browser.waitFor(`document.getElementById('loading-note')?.hidden === true`, { timeout: 30000, what: 'the room after reload' });
      },
    });
    return app;
  } catch (error) {
    await browser.close();
    throw error;
  }
}
