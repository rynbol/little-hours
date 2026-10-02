import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { gpuFlag } from '../chrome.mjs';

const WATCH = `(() => {
  if (window.__trips) return true;
  const trips = window.__trips = [];
  let last = performance.now();
  const tick = now => { const trip = trips.at(-1); if (trip && !trip.end) trip.frames.push([Math.round((now - last) * 10) / 10, trip.veil.dataset.phase]); last = now; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  new MutationObserver(records => {
    for (const record of records) {
      for (const veil of record.addedNodes) if (veil.classList?.contains('place-transition')) {
        const trip = { veil, place: veil.dataset.place, style: veil.dataset.style, phases: [veil.dataset.phase], clouds: Boolean(veil.querySelector('canvas')), frames: [], start: performance.now() };
        trips.push(trip);
        const hold = window.__holdTrip;
        const seek = () => {
          if (!hold || hold.phase !== veil.dataset.phase || hold.taken) return;
          hold.taken = true;
          const animation = veil.getAnimations().at(-1);
          animation.pause(); animation.currentTime = hold.progress * animation.effect.getTiming().duration;
          requestAnimationFrame(() => requestAnimationFrame(() => { hold.ready = true; }));
        };
        seek();
        new MutationObserver(() => { if (trip.phases.at(-1) !== veil.dataset.phase) trip.phases.push(veil.dataset.phase); seek(); }).observe(veil, { attributes: true, attributeFilter: ['data-phase'] });
      }
      for (const veil of record.removedNodes) { const trip = trips.find(item => item.veil === veil); if (trip) trip.end = performance.now(); }
    }
  }).observe(document.body, { childList: true });
  return true;
})()`;

const LAST = `(() => { const trip = window.__trips.at(-1); if (!trip) return null; const gaps = phase => trip.frames.filter(([, at]) => at === phase).map(([gap]) => gap); const worst = list => list.length ? Math.max(...list) : 0; return { place: trip.place, style: trip.style, phases: trip.phases, clouds: trip.clouds, ms: trip.end ? Math.round(trip.end - trip.start) : null, moving: trip.end ? Math.round(trip.end - trip.start - trip.frames.filter(([, at]) => at === 'closed').reduce((sum, [gap]) => sum + gap, 0)) : null, closingWorst: worst(gaps('closing')), closedWorst: worst(gaps('closed')), partingWorst: worst(gaps('parting')), closingSlow: gaps('closing').filter(gap => gap > 34).length, partingSlow: gaps('parting').filter(gap => gap > 34).length, frames: trip.frames.length }; })()`;

const settled = `!document.querySelector('.place-transition') && !document.documentElement.dataset.placeTransition`;

const ISLAND = `document.body.classList.contains('is-house') && !document.body.classList.contains('is-garden') && !window.__littleHours.lake.isOpen`;
const ROUTES = [
  { from: 'room', to: 'island', selector: '#rooms-button', arrived: ISLAND },
  { from: 'island', to: 'garden', selector: '#house-open-garden', arrived: `document.body.classList.contains('is-garden')` },
  { from: 'garden', to: 'island', selector: '#garden-back', arrived: ISLAND },
  { from: 'island', to: 'pond', selector: '[data-room="pond"]', arrived: `Boolean(window.__littleHours.lake.isOpen)` },
  { from: 'pond', to: 'island', selector: '#lake-back', arrived: ISLAND },
  { from: 'island', to: 'room', selector: '#back-to-room', arrived: `!document.body.classList.contains('is-house')` },
];
const CAPTURES = [['closing', .55], ['closing', 1], ['parting', .3], ['parting', .6]];
const FRAMED = { day: ['room-island', 'island-pond'], dusk: ['room-island', 'island-garden'], rain: ['island-room', 'pond-island'] };

async function travel(app, route, t) {
  await app.waitFor(settled, { what: 'the previous trip to end', timeout: 15000 });
  const before = await app.js(`window.__trips.length`);
  await app.clickSel(route.selector, { timeout: 10000 });
  await app.waitFor(`window.__trips.length > ${before}`, { what: `the ${route.from} to ${route.to} trip to start` });
  await app.waitFor(`${settled} && ${route.arrived}`, { what: `arrival at the ${route.to}`, timeout: 20000 });
  await t.sleep(80);
  return app.js(LAST);
}

async function captureFrames(app, route, theme, t, folder) {
  const files = [];
  for (const [phase, progress] of CAPTURES) {
    await app.waitFor(settled, { what: 'the previous trip to end', timeout: 15000 });
    if (!await app.js(route.back.arrived)) { await app.clickSel(route.back.selector, { timeout: 10000 }); await app.waitFor(`${settled} && ${route.back.arrived}`, { what: 'the way back', timeout: 20000 }); await app.settle(); }
    await app.js(`(window.__holdTrip = { phase: '${phase}', progress: ${progress} }, true)`);
    await app.clickSel(route.selector, { timeout: 10000 });
    await app.waitFor(`window.__holdTrip.ready === true`, { what: `the ${phase} hold`, timeout: 20000 });
    const name = `${theme}-${route.from}-${route.to}-${phase === 'closing' && progress === 1 ? 'closed' : `${phase}-${Math.round(progress * 100)}`}.png`;
    const file = await app.shot(join(t.out, `transitions-${name}`));
    files.push(file);
    if (folder) copyFileSync(file, join(folder, name));
    await app.js(`(() => { const hold = window.__holdTrip; window.__holdTrip = null; document.querySelector('.place-transition')?.getAnimations().forEach(animation => animation.play()); return Boolean(hold); })()`);
    await app.waitFor(`${settled} && ${route.arrived}`, { what: `arrival at the ${route.to}`, timeout: 20000 });
  }
  return files;
}

export default {
  about: 'cloud transitions: every screen change (room, island, garden, pond and back) closes soft clouds over the view, swaps behind them and parts them with no slow frames while they move; the overlay goes and input works after each; day, dusk and rain frames are captured; reduced motion cross-fades with no clouds',
  async run(t) {
    const { check } = t, folder = process.env.LH_TRANSITION_FRAMES, timed = gpuFlag !== 'swiftshader';
    if (folder) mkdirSync(folder, { recursive: true });
    for (const theme of (process.env.LH_TRANSITION_THEMES || (timed ? 'dusk,day,rain' : 'dusk')).split(',')) {
      const app = await t.open({ seed: 'three-rooms', theme, label: `transitions ${theme}` });
      await app.settle(); await app.js(WATCH);
      for (const route of ROUTES) {
        const trip = await travel(app, route, t);
        const name = `${theme}: ${route.from} to ${route.to}`;
        check(`${name} runs the cloud transition`, trip?.style === 'clouds' && trip.clouds && trip.phases.join() === 'closing,closed,parting', trip);
        if (timed) check(`${name} moves the clouds for about a second, plus the swap held behind them`, trip?.moving > 700 && trip.moving < 1300, trip);
        if (timed && theme === 'dusk') check(`${name} moves the clouds without slow frames`, trip?.closingSlow === 0 && trip.partingSlow === 0, trip);
        check(`${name} leaves no overlay and keys reach the page`, await app.js(`${settled} && getComputedStyle(document.body).pointerEvents !== 'none'`));
      }
      const focusBefore = await app.js(`document.activeElement?.id || document.activeElement?.tagName`);
      await app.key('Tab');
      check(`${theme}: Tab moves focus after the last trip`, await app.js(`document.activeElement?.id || document.activeElement?.tagName`) !== focusBefore);
      for (const key of FRAMED[theme]) {
        const index = ROUTES.findIndex(route => `${route.from}-${route.to}` === key), route = ROUTES[index];
        const back = ROUTES.find(item => item.from === route.to && item.to === route.from);
        const start = ROUTES.find(item => item.to === route.from);
        if (!await app.js(start.arrived)) { await app.clickSel(start.selector); await app.waitFor(`${settled} && ${start.arrived}`, { what: `the ${route.from}`, timeout: 20000 }); }
        const shots = await captureFrames(app, { ...route, back: { selector: back.selector, arrived: start.arrived } }, theme, t, folder);
        check(`${theme}: ${key} frames captured at closing, closed and parting`, shots.length === CAPTURES.length);
        await app.clickSel(back.selector); await app.waitFor(`${settled} && ${start.arrived}`, { what: `back at the ${route.from}`, timeout: 20000 });
      }
      await t.close(app);
    }

    const still = await t.open({ seed: 'three-rooms', reducedMotion: true, label: 'transitions reduced motion' });
    await still.settle(); await still.js(WATCH);
    for (const route of [ROUTES[0], ROUTES[3], ROUTES[4], ROUTES[5]]) {
      const trip = await travel(still, route, t);
      check(`reduced motion: ${route.from} to ${route.to} cross-fades with no clouds`, trip?.style === 'fade' && !trip.clouds && (!timed || trip.moving < 500), trip);
    }
    check('reduced motion: no overlay is left behind', await still.js(settled));
    await t.close(still);
  },
};
