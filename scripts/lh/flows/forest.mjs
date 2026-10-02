import { steps } from '../steps.mjs';
import { drawnRatio, ratioCeiling } from '../chrome.mjs';

const FOREST = `(() => { const forest = window.__littleHours.forest, d = forest.diagnostics(); return { open: forest.isOpen, ready: Boolean(d?.ready), walker: d?.walker ?? null, trees: d?.trees ?? 0, raining: d?.raining ?? null, drawn: d?.drawn ?? 0, start: d?.start ?? null, eye: d ? [d.camera.position.x, d.camera.position.y, d.camera.position.z] : null }; })()`;
const ENGINES = `window.__littleHours.counts().engines`;
const hold = (app, key, code, down) => app.send('Input.dispatchKeyEvent', { type: down ? 'keyDown' : 'keyUp', key, code });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const arrive = app => app.waitFor(`(() => { const f = window.__littleHours.forest; return f.isOpen && Boolean(f.diagnostics()?.ready) && document.querySelector('#forest-status').hidden; })()`, { what: 'the forest to be built', timeout: 90000 });
const leave = app => app.waitFor(`!window.__littleHours.forest.isOpen && !document.body.classList.contains('is-forest')`, { what: 'the island after the forest', timeout: 20000 });

const frames = async (app, count) => { const from = (await app.js(FOREST)).drawn; await app.waitFor(`window.__littleHours.forest.diagnostics().drawn >= ${from + count}`, { what: `${count} more forest frames`, timeout: 30000 }); };
const STOPPED = `window.__littleHours.forest.diagnostics().walker.speed === 0`;

async function walk(app, key, code, ms, least) {
  const from = (await app.js(FOREST)).walker;
  await hold(app, key, code, true); await pause(ms);
  await app.waitFor(`(() => { const w = window.__littleHours.forest.diagnostics().walker; return Math.hypot(w.x - ${from.x}, w.z - ${from.z}) > ${least}; })()`, { what: `the walker to cover ${least} m`, timeout: 60000 });
  await hold(app, key, code, false);
  await app.waitFor(STOPPED, { what: 'the walker to coast to a stop', timeout: 30000 });
  const to = (await app.js(FOREST)).walker;
  return { from, to, east: to.x - from.x, south: to.z - from.z, far: Math.hypot(to.x - from.x, to.z - from.z) };
}

export default {
  about: 'the forest: the island trailhead pin and the dock both open a walk-in forest with its own scene, W walks the way you face, a drag turns the view, the eye rides the ground, it draws at the capped pixel ratio, Escape and the Island chip return to the island and free the engine, and reduced motion draws only when the view changes',
  async run(t) {
    const { check } = t;
    const app = await t.open({ seed: 'three-rooms' });
    await app.settle();
    await steps.openHouse(app);
    const engines = await app.js(ENGINES);
    await app.clickSel('[data-room="forest"]');
    await arrive(app);
    const start = await app.js(FOREST);
    check('the trailhead pin opens the forest with its own scene and the island set aside', start.open && await app.js(`document.body.classList.contains('is-forest') && document.getElementById('app').inert`) && await app.js(ENGINES) === engines + 1, { engines, now: await app.js(ENGINES) });
    check('the walk starts on the valley path among more than a thousand trees', start.walker.x === start.start.x && start.walker.z === start.start.z && Math.hypot(start.start.x, start.start.z) > 150 && start.trees > 1000, start);
    check('the camera sits at the walker’s eye', Math.hypot(start.eye[0] - start.walker.x, start.eye[1] - start.walker.y, start.eye[2] - start.walker.z) < 1e-3, start);
    const ratio = await app.js(drawnRatio('forest'));
    check('the forest draws at the screen pixel ratio, capped at 2, or at 0.6 on a software renderer', Math.abs(ratio.drawn - ratioCeiling(ratio)) < 0.01, ratio);
    check('the hint names the keys, and the thumb stick stays away from mouse users', await app.visible('#forest-hint') && !await app.visible('#forest-stick'));
    await frames(app, 2);
    const idle = await app.js(FOREST);
    check('the forest keeps moving while the walker stands still', idle.drawn > start.drawn && idle.walker.x === start.walker.x, { before: start.drawn, after: idle.drawn });

    const ahead = await walk(app, 'w', 'KeyW', 1500, 2), facing = [Math.sin(ahead.from.yaw), -Math.cos(ahead.from.yaw)];
    const along = (ahead.east * facing[0] + ahead.south * facing[1]) / ahead.far;
    check('holding W walks the way the walker faces, at a walking pace, and letting go stops', ahead.far > 1.5 && ahead.far < 17 && along > 0.9, { far: ahead.far, along });
    check('the first step tucks the hint away', await app.js(`document.querySelector('#forest-hint').classList.contains('is-read')`));
    const back = await walk(app, 's', 'KeyS', 800, 0.8);
    check('S backs away', (back.east * facing[0] + back.south * facing[1]) < -0.5, back);

    const before = (await app.js(FOREST)).walker, middle = { x: app.width / 2, y: app.height / 2 };
    await app.drag(middle, { x: middle.x + 200, y: middle.y });
    await frames(app, 2);
    const turned = (await app.js(FOREST)).walker;
    check('dragging across the view turns the walker without moving them', Math.abs(Math.abs(turned.yaw - before.yaw) - 0.84) < 0.15 && turned.x === before.x && turned.z === before.z, { before: before.yaw, after: turned.yaw });

    await app.key('Escape');
    await leave(app);
    await app.settle();
    check('Escape returns to the island, frees the forest engine and puts focus back on the trailhead', await app.js(`document.body.classList.contains('is-house') && !document.getElementById('app').inert`) && await app.js(ENGINES) === engines && await app.js(`document.activeElement?.dataset?.room === 'forest'`), { engines: await app.js(ENGINES), focus: await app.js(`document.activeElement?.outerHTML.slice(0, 80)`) });

    await app.clickSel('#house-open-forest');
    await arrive(app);
    check('the dock’s Forest button opens it too, back at the start of the path', await app.js(`(() => { const d = window.__littleHours.forest.diagnostics(); return d.walker.x === d.start.x && d.walker.z === d.start.z; })()`));
    await app.clickSel('#forest-back');
    await leave(app);
    check('the Island chip leaves the forest', await app.js(ENGINES) === engines);
    check('no errors were logged', app.errors.length === 0, app.errors);
    await app.close();

    const still = await t.open({ seed: 'three-rooms', reducedMotion: true, theme: 'rain' });
    await still.settle();
    await steps.openHouse(still);
    await still.clickSel('[data-room="forest"]');
    await arrive(still);
    await pause(500);
    const rest = await still.js(FOREST);
    await pause(600);
    const later = await still.js(FOREST);
    check('reduced motion: a still forest draws no further frames', later.drawn === rest.drawn, { rest: rest.drawn, later: later.drawn });
    const stepped = await walk(still, 'w', 'KeyW', 800, 0.8);
    check('reduced motion: walking still moves the view and draws it', stepped.far > 0.5 && (await still.js(FOREST)).drawn > later.drawn, stepped);
    check('rain falls in the forest in the rain theme and in no other', rest.raining === true && start.raining === false, { rain: rest.raining, fair: start.raining });
    await still.close();
  },
};
