import { steps } from '../steps.mjs';
import { gpuFlag } from '../chrome.mjs';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SEAT = 'window.__littleHours.room.diagnostics()';
const SOFT = gpuFlag === 'swiftshader', BRIGHT = SOFT ? 0.25 : 0.6;
const INSTALL = `(() => {
  const luma = (p, i) => (.2126 * p[i] + .7152 * p[i + 1] + .0722 * p[i + 2]) / 255;
  window.__stormFrame = picture => {
    const d = ${SEAT}, { engine, scene } = d, gl = engine._gl, outdoor = d.seat.world.outdoorScene, width = engine.getRenderWidth(), height = engine.getRenderHeight();
    engine.beginFrame(); d.draw();
    const pixels = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const shot = picture ? engine.getRenderingCanvas().toDataURL('image/jpeg', 0.9) : null;
    engine.clear(new scene.clearColor.constructor(0, 0, 0, 0), true, true, true);
    const autoClear = scene.autoClear; scene.autoClear = false; scene.render(); scene.autoClear = autoClear;
    const cover = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, cover);
    engine.endFrame();
    let sky = 0, skyN = 0, room = 0, roomN = 0, whole = 0, wholeN = 0;
    const bright = [];
    for (let y = 0; y < height; y += 3) for (let x = 0; x < width; x += 3) {
      const i = (y * width + x) * 4, value = luma(pixels, i), inside = cover[i + 3] < 255;
      whole += value; wholeN++;
      if (inside) { sky += value; skyN++; } else { room += value; roomN++; }
      bright.push([value, pixels[i] - pixels[i + 2]]);
    }
    bright.sort((a, b) => b[0] - a[0]);
    const top = bright.slice(0, Math.max(1, Math.round(bright.length * 0.002)));
    const lit = outdoor.meshes.filter(mesh => mesh.metadata?.effect === 'lightning' && mesh.isEnabled()).length;
    return { level: window.__littleHours.room.lightning.level, windowShare: skyN / wholeN, sky: sky / Math.max(1, skyN), room: room / Math.max(1, roomN), whole: whole / wholeN, brightestWarmth: top.reduce((sum, [, warm]) => sum + warm, 0) / top.length / 255, lit, shot };
  };
  window.__boltFrame = () => {
    const d = ${SEAT}, { engine, scene } = d, gl = engine._gl, width = engine.getRenderWidth(), height = engine.getRenderHeight();
    const outdoor = d.seat.world.outdoorScene, bolt = outdoor.meshes.find(mesh => mesh.name.startsWith('world-lightning-bolt') && mesh.isEnabled());
    if (!bolt) return null;
    bolt.computeWorldMatrix(true);
    const corners = bolt.getBoundingInfo().boundingBox.vectorsWorld, toScreen = outdoor.activeCamera.getTransformationMatrix(), Point = corners[0].constructor;
    let boxLeft = width, boxRight = 0, boxLow = height, boxHigh = 0;
    for (const corner of corners) {
      const p = Point.TransformCoordinates(corner, toScreen), x = (p.x + 1) / 2 * width, y = (p.y + 1) / 2 * height;
      boxLeft = Math.min(boxLeft, x); boxRight = Math.max(boxRight, x); boxLow = Math.min(boxLow, y); boxHigh = Math.max(boxHigh, y);
    }
    boxLeft = Math.max(0, Math.floor(boxLeft) - 4); boxRight = Math.min(width - 1, Math.ceil(boxRight) + 4); boxLow = Math.max(0, Math.floor(boxLow) - 4); boxHigh = Math.min(height - 1, Math.ceil(boxHigh) + 4);
    let shot = null;
    const grab = picture => { engine.beginFrame(); d.draw(); const pixels = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels); if (picture) shot = engine.getRenderingCanvas().toDataURL('image/jpeg', 0.9); engine.endFrame(); return pixels; };
    const lit = grab(true); bolt.setEnabled(false); const dark = grab(); bolt.setEnabled(true);
    const depth = bolt.material.depthFunction; bolt.material.depthFunction = 519; const bare = grab(); bolt.material.depthFunction = depth;
    engine.beginFrame(); engine.clear(new scene.clearColor.constructor(0, 0, 0, 0), true, true, true);
    const autoClear = scene.autoClear; scene.autoClear = false; scene.render(); scene.autoClear = autoClear;
    const cover = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, cover); engine.endFrame();
    const seen = [], hidden = [], across = [], middle = new Map();
    let left = width, right = -1, low = height, high = -1;
    for (let row = boxLow; row <= boxHigh; row++) {
      let count = 0, behind = false, sum = 0;
      for (let x = boxLeft; x <= boxRight; x++) {
        const i = (row * width + x) * 4, shown = luma(lit, i) - luma(dark, i) > 0.06, drawn = luma(bare, i) - luma(dark, i) > 0.06 || shown;
        if (drawn) { left = Math.min(left, x); right = Math.max(right, x); low = Math.min(low, row); high = Math.max(high, row); }
        if (cover[i + 3] === 255) continue;
        if (shown) { count++; sum += x; } else if (drawn) behind = true;
      }
      if (count) { seen.push(height - 1 - row); across.push(count); middle.set(height - 1 - row, sum / count); }
      if (behind && !count) hidden.push(height - 1 - row);
    }
    let barred = 0;
    for (let row = low; row <= high; row++) for (let x = left; x <= right; x++) if (cover[(row * width + x) * 4 + 3] === 255) barred++;
    seen.sort((a, b) => a - b); across.sort((a, b) => a - b);
    const top = seen[0], foot = seen.at(-1), below = hidden.filter(row => row > foot).sort((a, b) => a - b);
    const shade = (row, x) => luma(dark, ((height - 1 - row) * width + Math.round(x)) * 4), half = Math.round(boxRight - boxLeft) / 2 + 6, mid = seen[seen.length >> 1];
    let ground = 0, sky = 0;
    for (let step = 3; step <= 8; step++) ground += shade(foot + step, middle.get(foot)) / 6;
    for (let step = -2; step <= 2; step++) sky += (shade(mid + step, middle.get(mid) - half) + shade(mid + step, middle.get(mid) + half)) / 10;
    return { top, foot, rows: seen.length, span: foot - top + 1, width: across[across.length >> 1], hiddenBelow: below.length, ridgeGap: below.length ? below[0] - foot : null, ridgeContrast: sky - ground, barred: barred / Math.max(1, (right - left + 1) * (high - low + 1)), height, level: window.__littleHours.room.lightning.level, shot };
  };
  window.__stormPeak = () => { const storm = window.__littleHours.room.lightning; if (${SOFT} && storm.lightning.active) storm.update(storm.lightning.shape.start + 0.05, true, false); };
  window.__stormStrike = () => new Promise(resolve => {
    const storm = window.__littleHours.room.lightning, live = storm.lightning, outdoor = ${SEAT}.seat.world.outdoorScene, samples = [], giveUp = performance.now() + 180000;
    let was = live.shape.start, begun = false, peak = null;
    const step = () => {
      if (!begun) {
        if (performance.now() > giveUp) return resolve({ peak, after: window.__stormFrame(false), samples });
        if (live.active && live.shape.start !== was) begun = true; else storm.strike();
      }
      if (begun) {
        if (!peak) window.__stormPeak();
        samples.push({ level: storm.level, lit: outdoor.meshes.filter(mesh => mesh.metadata?.effect === 'lightning' && mesh.isEnabled()).length });
        if (!peak && storm.level > ${BRIGHT}) peak = window.__stormFrame(true);
        if (!live.active) {
          if (peak || performance.now() > giveUp) return resolve({ peak, after: window.__stormFrame(false), samples });
          was = live.shape.start; begun = false; samples.length = 0;
        }
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  window.__stormWatch = (ms, { spam = false, frames = false } = {}) => new Promise(resolve => {
    const samples = [], end = performance.now() + ms, storm = window.__littleHours.room.lightning;
    const step = () => {
      if (spam) storm.strike();
      samples.push(frames ? { t: performance.now(), ...window.__stormFrame(false) } : { t: performance.now(), level: storm.level, strike: storm.lightning.active ? storm.lightning.shape.start : null, pulses: storm.lightning.shape.pulses });
      if (performance.now() < end) requestAnimationFrame(step); else resolve(samples);
    };
    requestAnimationFrame(step);
  });
  return true;
})()`;

const peaksOf = samples => samples.filter((sample, i) => i > 0 && i < samples.length - 1 && sample.level > 0.15 && sample.level >= samples[i - 1].level && sample.level > samples[i + 1].level).map(sample => sample.t);
const round = value => Number(value.toFixed(4));

async function seat(app) {
  await app.settle();
  await app.waitFor(`(${SEAT}.seat.world.outdoor !== false || ${SEAT}.seat.world.buildsAhead === false)`, { what: 'the outdoor world to be built, where the renderer builds it ahead', timeout: 30000 });
  await steps.openTimer(app); await app.clickSel('#focus-mode-enter');
  await app.waitFor(`${SEAT}.seat.state === 'seated' && ${SEAT}.seat.world.outdoor`, { what: 'the chair view with the outdoor world', timeout: 60000 });
  await app.js(INSTALL);
}

export default {
  about: 'In the rain, a distant lightning strike seen from the chair brightens the far sky and the window wall in cool light and fades, the warm lamp stays the brightest thing, flashes never come faster than three a second, and reduced motion shows none',
  async run(t) {
    const { check } = t;
    const app = await t.open({ seed: 'three-rooms', theme: 'rain', width: 960, height: 640 });
    await seat(app);
    const save = (label, frame) => { if (frame.shot) writeFileSync(join(t.out, `lightning-${label}.jpg`), Buffer.from(frame.shot.split(',')[1], 'base64')); frame.shot = undefined; return frame; };
    await t.sleep(2500);
    await app.waitFor(`(() => { const live = window.__littleHours.room.lightning.lightning; return !live.active && live.nextAt !== null && live.nextAt - performance.now() / 1000 > 8; })()`, { what: 'a quiet spell with no strike due for eight seconds', timeout: 150000 });
    save('calm', await app.js(`window.__stormFrame(true)`));
    const before = await app.js(`window.__stormWatch(800, { frames: true })`), calm = before.at(-1);
    check('before a strike nothing of the lightning draws', before.every(sample => sample.lit === 0 && sample.level === 0), before.map(sample => sample.lit).join(''));
    check('the calm view is steady before the strike', Math.max(...before.map(sample => sample.sky)) - Math.min(...before.map(sample => sample.sky)) < 0.005, before.map(sample => round(sample.sky)));
    const { peak, after, samples: strike } = await app.js(`window.__stormStrike()`);
    check(`a requested strike draws a frame brighter than ${BRIGHT} of full strength`, Boolean(peak), strike.map(sample => round(sample.level)));
    if (!peak) return;
    save('peak', peak);
    const summary = sample => ({ level: round(sample.level), windowShare: round(sample.windowShare), sky: round(sample.sky), room: round(sample.room), whole: round(sample.whole), brightestWarmth: round(sample.brightestWarmth), lit: sample.lit });
    console.log(`calm ${JSON.stringify(summary(calm))} peak ${JSON.stringify(summary(peak))} after ${JSON.stringify(summary(after))}`);
    check('a strike brightens the sky in the window', calm.windowShare > 0.05 && peak.sky - calm.sky > 0.045 * peak.level, { calm: summary(calm), peak: summary(peak) });
    check('the flash is moderate, never a white-out of the frame', peak.whole - calm.whole < 0.12 && peak.sky < 0.8, { calm: summary(calm), peak: summary(peak) });
    check('the warm lamp stays the brightest thing in the frame at the flash peak', peak.brightestWarmth > 0.05, summary(peak));
    check('the lightning adds at most two draws while it shows', strike.every(sample => sample.lit <= 2) && strike.some(sample => sample.lit >= 1), strike.map(sample => sample.lit).join(''));
    check('the flash fades back to the calm sky and stops drawing', after.level === 0 && after.lit === 0 && Math.abs(after.sky - calm.sky) < 0.01, { calm: summary(calm), after: summary(after) });
    await app.js(`window.__littleHours.room.lightning.strike()`);
    const bolt = save('bolt', await app.js(`new Promise(resolve => { const storm = window.__littleHours.room.lightning, step = () => { if (!storm.lightning.active) storm.strike(); else { Object.assign(storm.lightning.shape, { bolt: 1, bearing: -0.084, distance: 4250 }); window.__stormPeak(); } if (storm.level > ${BRIGHT} && storm.sky.bolts.some(mesh => mesh.isEnabled())) resolve(window.__boltFrame()); else requestAnimationFrame(step); }; requestAnimationFrame(step); })`));
    console.log(`bolt ${JSON.stringify(bolt)}`);
    check('a bolt reads as one continuous channel at least two pixels wide, not a dotted line', bolt.rows > 40 * bolt.height / 640 && bolt.rows / bolt.span > 0.97 && bolt.width >= 2, bolt);
    check('the bolt comes down to a ridge you can see, which hides its foot', (bolt.hiddenBelow >= 1 ? bolt.ridgeGap <= 4 : SOFT) && bolt.ridgeContrast > 0.04, bolt);
    check('the bolt falls in clear window glass, away from the window bars', bolt.barred < 0.03, bolt);
    await app.drag({ x: 480, y: 320 }, { x: 480 + Math.round(35 * Math.PI / 180 / 0.0042), y: 320 });
    await app.settle(); await t.sleep(5000);
    await app.waitFor('!(window.__littleHours.room.rainbow?.presence > 0)', { what: 'a clearing spell to pass, since lightning keeps away from a rainbow', timeout: 120000 });
    const wallCalm = save('wall-calm', await app.js(`window.__stormFrame(true)`));
    const wallPeak = (await app.js(`window.__stormStrike()`)).peak;
    if (wallPeak) save('wall-peak', wallPeak);
    check('turned toward the side wall, cool light from the flash reaches the room by the window', wallPeak?.level > BRIGHT && wallPeak.room - wallCalm.room > 0.005 * wallPeak.level && wallPeak.room - wallCalm.room < 0.05, { calm: summary(wallCalm), peak: wallPeak && summary(wallPeak) });

    const spammed = await app.js(`window.__stormWatch(14000, { spam: true })`), peaks = peaksOf(spammed);
    const busiest = peaks.reduce((most, time) => Math.max(most, peaks.filter(other => other >= time && other < time + 1000).length), 0);
    const strikes = [...new Map(spammed.filter(sample => sample.strike !== null).map(sample => [sample.strike, sample.pulses])).entries()].sort((a, b) => a[0] - b[0]);
    const closest = strikes.slice(1).reduce((least, [start], i) => Math.min(least, start - strikes[i][0]), Infinity);
    check('asked for a strike every frame for fourteen seconds, strikes still rest four seconds apart and flashes stay at three a second or fewer', strikes.length >= 2 && closest >= 4 && strikes.every(([, pulses]) => pulses <= 3) && busiest <= 3, { strikes, closest, flashes: peaks.length, busiest });

    const still = await t.open({ seed: 'three-rooms', theme: 'rain', width: 960, height: 640, reducedMotion: true, label: 'reduced motion' });
    await seat(still);
    const levels = [];
    for (let i = 0; i < 6; i++) {
      await still.js(`window.__littleHours.room.lightning.strike()`);
      await still.drag({ x: 480, y: 320 }, { x: 480 + (i % 2 ? -40 : 40), y: 320 }, 4);
      levels.push(...(await still.js(`window.__stormWatch(300, { frames: true })`)).map(sample => sample.level + sample.lit));
    }
    check('under reduced motion a requested strike shows nothing while the view redraws', levels.length > 0 && Math.max(...levels) === 0, { samples: levels.length, max: Math.max(...levels) });
  },
};
