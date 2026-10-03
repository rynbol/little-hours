import { steps } from '../steps.mjs';

const WILDS = `window.__littleHours.wilds.diagnostics()`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function hold(app, key, code, ms) { await app.down(key, code); await sleep(ms); await app.up(key, code); }
async function until(app, expression, what, timeout = 4000) { return app.waitFor(`(() => { const d = ${WILDS}; return (${expression}) ? d : null; })()`, { what, timeout }); }
const DRAG_TURN = 0.006;
async function face(app, yaw) {
  for (let i = 0; i < 8; i++) {
    const { camera } = await app.js(WILDS), off = Math.atan2(Math.sin(yaw - camera.yaw), Math.cos(yaw - camera.yaw));
    if (Math.abs(off) < 0.05) return;
    const px = Math.max(-560, Math.min(560, -off / DRAG_TURN));
    await app.drag({ x: 720, y: 450 }, { x: 720 + px + Math.sign(px) * 7, y: 450 }, 18);
    await sleep(120);
  }
}
async function walkTo(app, x, z, near = 0.9) {
  for (let i = 0; i < 14; i++) {
    const d = await app.js(WILDS), dx = x - d.player.x, dz = z - d.player.z, far = Math.hypot(dx, dz);
    if (far < near) return d;
    await face(app, Math.atan2(dx, dz));
    await hold(app, 'w', 'KeyW', Math.max(120, Math.min(2000, far / 4.4 * 800)));
    await sleep(200);
  }
  return app.js(WILDS);
}

export default {
  about: 'the Wilds: the island Forest pin opens a three.js feel box after freeing the island, Play starts it, and real keys and clicks run, jump, roll, swing a three-hit combo, charge a heavy, lock on, climb the cliff past its ledge, glide down and leave, each answered within 100 ms, at a capped pixel ratio, 60 fps with no long frames, then the island comes back at the trailhead, and a focus session closes it and keeps it shut',
  async run(t) {
    const { check } = t;
    const app = await t.open({ seed: 'three-rooms', scale: 2 });
    await app.settle();
    await steps.openHouse(app);
    const before = await app.js(`window.__littleHours.counts()`);
    await steps.openWilds(app);
    const inside = await app.js(`window.__littleHours.counts()`);
    check('the Forest pin opens the Wilds start card with words only in the menu', await app.js(`document.querySelector('.wilds-menu').open && document.querySelector('#wilds-menu-title').textContent === 'The Wilds'`));
    check('entering frees the island: its engine and canvas are gone while the Wilds draws', before.house && !inside.house && inside.engines === before.engines - 1, { before, inside });
    const start = await app.js(WILDS);
    check('the Wilds caps the pixel ratio at 1.5 on a 2x screen', start.renderer.pixelRatio === 1.5, start.renderer);
    await t.shot(app, 'start-card');
    await steps.playWilds(app);
    await app.move(720, 450);
    await sleep(400);

    await hold(app, 'w', 'KeyW', 700);
    const ran = await app.js(WILDS);
    check('W runs away from the camera, toward the dummy', ran.player.z < 4.2 - 1.5, ran.player);
    check('the run starts within 100 ms of the key', ran.latency.move !== null && ran.latency.move < 100, ran.latency);
    await sleep(300);

    await app.key(' ', 'Space');
    const jumped = await until(app, `!d.player.grounded`, 'the jump', 1000);
    check('Space jumps within 100 ms', jumped.latency.jump < 100, jumped.latency);
    await until(app, `d.player.grounded && d.reactions.lands > 0`, 'the landing', 2000);
    await sleep(250);

    await app.key('Control', 'ControlLeft');
    const rolled = await until(app, `d.player.state === 'dodge'`, 'the dodge roll', 1000);
    check('Ctrl rolls within 100 ms and costs stamina', rolled.latency.dodge < 100 && rolled.player.stamina < 100, rolled);
    await t.shot(app, 'roll');
    await until(app, `d.player.state === 'move'`, 'the roll to end', 2000);
    await sleep(600);

    await app.key('f', 'KeyF');
    const locked = await until(app, `d.lock === 'dummy'`, 'lock-on', 1000);
    check('F locks on to the training dummy', locked.lock === 'dummy');
    await app.down('w', 'KeyW');
    await app.waitFor(`(() => { const d = ${WILDS}; return Math.hypot(d.player.x - d.dummy.x, d.player.z - d.dummy.z) < 1.9; })()`, { what: 'walking up to the dummy', timeout: 5000 });
    await app.up('w', 'KeyW');
    await sleep(400);
    const fresh = await app.js(WILDS);
    await t.shot(app, 'locked');

    for (let i = 0; i < 3; i++) { await app.click(720, 450); await sleep(150); }
    const comboed = await until(app, `d.reactions.swings >= 3 && d.player.state === 'move'`, 'the three-hit combo', 3000);
    check('three clicks swing the three-hit combo and every swing lands on the dummy', comboed.reactions.swings - fresh.reactions.swings === 3 && comboed.reactions.hits - fresh.reactions.hits === 3, { swings: comboed.reactions.swings - fresh.reactions.swings, hits: comboed.reactions.hits - fresh.reactions.hits, health: comboed.dummy.health });
    check('the first click answers within 100 ms', comboed.latency.attack < 100, comboed.latency);
    check('every hit kicks the camera and throws sparks', comboed.reactions.kicks - fresh.reactions.kicks === 3 && comboed.reactions.trail > fresh.reactions.trail, comboed.reactions);
    check('the combo takes 39 health off the dummy in three chunks', fresh.dummy.health - comboed.dummy.health === 39, { from: fresh.dummy.health, to: comboed.dummy.health });
    await sleep(2800);

    const rested = await app.js(WILDS);
    await app.press(720, 450);
    const charging = await until(app, `d.player.state === 'charge' && d.player.charge >= 1`, 'a full charge', 3000);
    check('holding the click charges a heavy', charging.player.state === 'charge');
    await t.shot(app, 'charged');
    await app.release(720, 450);
    const slammed = await until(app, `d.player.attack === 'heavy' && d.reactions.hits >= ${rested.reactions.hits + 2}`, 'the heavy to land', 2000);
    await sleep(60);
    await t.shot(app, 'heavy');
    const held = (await app.js(WILDS)).reactions.frozen - charging.reactions.frozen;
    check('releasing the charge swings the heavy, and its hit freezes the frame for about a tenth of a second', slammed.player.attack === 'heavy' && held > 0.1 && held < 0.2, { attack: slammed.player.attack, frozen: held });
    await sleep(1200);

    await app.wheel(720, 450, 240);
    await sleep(200);
    const zoomed = await app.js(WILDS);
    check('scrolling zooms the camera out', zoomed.camera.zoom > start.camera.zoom + 0.5, zoomed.camera);
    await app.key('f', 'KeyF');
    await app.drag({ x: 900, y: 450 }, { x: 600, y: 470 });
    await sleep(300);
    const turned = await app.js(WILDS);
    check('dragging orbits the camera', Math.abs(turned.camera.yaw - zoomed.camera.yaw) > 0.4, { before: zoomed.camera.yaw, after: turned.camera.yaw });
    check('the camera stays above the ground', turned.camera.clearance > 0.25, turned.camera);

    await app.down('Shift', 'ShiftLeft'); await app.down('a', 'KeyA');
    await sleep(1500);
    await app.up('a', 'KeyA'); await app.up('Shift', 'ShiftLeft');
    const sprinted = await app.js(WILDS);
    check('Shift sprints and drains stamina', sprinted.player.stamina < 80, sprinted.player);

    const foot = await walkTo(app, -11.6, -9);
    await face(app, -Math.PI / 2);
    await sleep(200);
    await app.down('w', 'KeyW');
    const grabbed = await until(app, `d.player.state === 'climb'`, 'grabbing the cliff', 4000);
    check('walking into the cliff grabs it instead of walking up it', grabbed.reactions.grabs > foot.reactions.grabs && grabbed.player.y < foot.player.y + 0.8, { foot: foot.player, grabbed: grabbed.player });
    await sleep(900);
    await t.shot(app, 'climb');
    const topped = await until(app, `d.reactions.mantles >= ${foot.reactions.mantles + 2} && d.player.state === 'move'`, 'climbing past the ledge to the top', 16000);
    await app.up('w', 'KeyW');
    check('holding W climbs the cliff slowly, mantles onto the ledge, climbs again and mantles onto the top', topped.player.y > foot.player.y + 7 && topped.reactions.grabs - foot.reactions.grabs === 2, { from: foot.player.y, to: topped.player.y, grabs: topped.reactions.grabs - foot.reactions.grabs });
    check('the climb costs stamina', topped.player.stamina < 70, topped.player);
    await sleep(500);
    await t.shot(app, 'cliff-top');

    await face(app, Math.atan2(-5 - topped.player.x, -15 - topped.player.z));
    await app.down('w', 'KeyW');
    await until(app, `!d.player.grounded`, 'stepping off the cliff top', 4000);
    await sleep(250);
    await app.key(' ', 'Space');
    let gliding = await until(app, `d.player.state === 'glide' || d.player.grounded`, 'the glider to open', 1500);
    if (gliding.player.state !== 'glide') { await app.key(' ', 'Space'); gliding = await until(app, `d.player.state === 'glide'`, 'the glider to open', 1000); }
    check('Space in the air opens the glider', gliding.player.state === 'glide' && gliding.reactions.glides > topped.reactions.glides, gliding.player);
    await sleep(700);
    const drifting = await app.js(WILDS);
    await t.shot(app, 'glide');
    check('the glider sinks slowly while you steer it forward', drifting.player.state === 'glide' && drifting.player.vy > -2.6 && Math.hypot(drifting.player.vx, drifting.player.vz) > 4, drifting.player);
    const landed = await until(app, `d.player.grounded && d.player.state === 'move'`, 'the glide to land', 12000);
    await app.up('w', 'KeyW');
    const flown = Math.hypot(landed.player.x - topped.player.x, landed.player.z - topped.player.z);
    check('the glide carries you well clear of the cliff before you land', flown > 12, { flown, at: landed.player });
    await sleep(400);

    const frames = (await app.js(WILDS)).frames;
    check('the Wilds holds 60 fps: median frame gap under 17.5 ms', frames.gap.p50 < 17.5, frames);
    check('no frame over 20 ms while playing', frames.over20 === 0, frames);
    check('the frame CPU cost stays under 6 ms at the 95th percentile', frames.cpu.p95 < 6, frames.cpu);

    await app.key('Escape', 'Escape');
    await app.waitFor(`document.querySelector('.wilds-menu').open && document.querySelector('#wilds-menu-title').textContent === 'Paused'`, { what: 'the pause card' });
    check('Esc pauses with a Resume card', (await app.js(WILDS)).paused);
    await app.clickSel('.wilds [data-wilds="exit"]');
    await app.waitFor(`!document.querySelector('.wilds') || document.querySelector('.wilds').hidden`, { what: 'leaving the Wilds', timeout: 15000 });
    await app.waitFor(`Boolean(window.__littleHours.house.diagnostics()?.scene.isReady()) && !document.documentElement.dataset.placeTransition`, { what: 'the island to come back', timeout: 20000 });
    const back = await app.js(`window.__littleHours.counts()`);
    check('leaving rebuilds the island and leaves no Wilds canvas behind', back.house && back.engines === before.engines && !await app.js(`Boolean(document.querySelector('.wilds-canvas'))`), back);
    check('the island comes back at the trailhead', await app.js(`document.activeElement?.dataset.room === 'forest'`));
    await t.shot(app, 'island-after');

    await steps.openWilds(app);
    await steps.playWilds(app);
    await app.js(`(() => {
      const key = 'little-hours-v1', saved = JSON.parse(localStorage.getItem(key)), now = window.__littleHoursTest.now(), length = 25 * 60000;
      saved.session = { ...saved.session, kind: 'focus', phase: 'running', id: 'lh-other-tab', startedAt: now, duration: length, remaining: length, endsAt: now + length, running: true };
      localStorage.setItem(key, JSON.stringify(saved));
      window.dispatchEvent(new StorageEvent('storage', { key }));
    })()`);
    await app.waitFor(`document.querySelector('.wilds').hidden && Boolean(window.__littleHours.house.diagnostics()?.scene.isReady()) && !document.documentElement.dataset.placeTransition`, { what: 'focus to close the Wilds', timeout: 20000 });
    const closed = await app.js(`window.__littleHours.counts()`);
    check('a focus session started in another tab closes the Wilds and brings the island back', closed.house && closed.engines === before.engines, closed);
    await app.clickSel('[data-room="forest"]');
    await sleep(800);
    check('while focusing, the Forest pin keeps you on the island and says why', await app.js(`document.querySelector('.wilds').hidden && !document.querySelector('#toast').hidden && document.querySelector('#toast').textContent.includes('focus')`));
    await t.close(app);
  },
};
