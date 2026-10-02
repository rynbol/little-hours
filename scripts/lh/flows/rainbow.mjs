import { steps } from '../steps.mjs';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SEAT = 'window.__littleHours.room.diagnostics()';
const MEASURE = `(() => {
  const d = ${SEAT}, { engine } = d, gl = engine._gl, outdoor = d.seat.world.outdoorScene, bow = outdoor.getMeshByName('world-rainbow');
  if (!bow) return { lit: 0, presence: window.__littleHours.room.rainbow?.presence ?? 0 };
  const width = engine.getRenderWidth(), height = engine.getRenderHeight();
  const read = picture => { engine.beginFrame(); d.draw(); const pixels = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels); const shot = picture ? engine.getRenderingCanvas().toDataURL('image/jpeg', 0.92) : null; engine.endFrame(); return { pixels, shot }; };
  const drawn = () => outdoor.meshes.filter(mesh => mesh.metadata?.effect === 'rainbow' && mesh.isEnabled()).length;
  const lit = drawn(), on = read(true); bow.setEnabled(false); const off = read(false); bow.setEnabled(true);
  const camera = outdoor.activeCamera, viewProjection = camera.getViewMatrix().multiply(camera.getProjectionMatrix()), m = viewProjection.m, eye = camera.position;
  const s = window.__littleHours.room.rainbow.sky.sun, length = Math.hypot(...s), axis = s.map(v => -v / length);
  const lift = [-axis[1] * axis[0], 1 - axis[1] * axis[1], -axis[1] * axis[2]], liftLength = Math.hypot(...lift), up = lift.map(v => v / liftLength);
  const side = [axis[1] * up[2] - axis[2] * up[1], axis[2] * up[0] - axis[0] * up[2], axis[0] * up[1] - axis[1] * up[0]];
  const direction = (radius, turn) => { const r = radius * Math.PI / 180; return [0, 1, 2].map(k => axis[k] * Math.cos(r) + (up[k] * Math.cos(turn) + side[k] * Math.sin(turn)) * Math.sin(r)); };
  const project = ([x, y, z]) => { const p = [eye.x + x * 1000, eye.y + y * 1000, eye.z + z * 1000], w = p[0] * m[3] + p[1] * m[7] + p[2] * m[11] + m[15]; if (w <= 0) return null; return [Math.round(((p[0] * m[0] + p[1] * m[4] + p[2] * m[8] + m[12]) / w + 1) / 2 * width), Math.round((1 - (p[0] * m[1] + p[1] * m[5] + p[2] * m[9] + m[13]) / w) / 2 * height)]; };
  const at = (x, y) => (Math.max(0, height - 1 - y) * width + x) * 4;
  const change = (x, y) => { const i = at(x, y), a = on.pixels, b = off.pixels; return [(a[i] - b[i]) / 255, (a[i + 1] - b[i + 1]) / 255, (a[i + 2] - b[i + 2]) / 255]; };
  const luma = ([r, g, b]) => .2126 * r + .7152 * g + .0722 * b;
  const column = (x, from, to) => { const rows = []; for (let y = Math.max(0, from); y <= Math.min(height - 1, to); y++) { const sum = [0, 0, 0]; for (let dx = -3; dx <= 3; dx++) change(Math.min(width - 1, Math.max(0, x + dx)), y).forEach((v, k) => sum[k] += v / 7); rows.push({ y, change: sum }); } return rows; };
  const crown = project(direction(41.4, 0)), outer = project(direction(44.5, 0)), inner = project(direction(38.5, 0));
  const rows = column(crown[0], outer[1], inner[1]);
  const reddest = rows.reduce((best, row) => row.change[0] - row.change[2] > best.change[0] - best.change[2] ? row : best), bluest = rows.reduce((best, row) => row.change[2] - row.change[0] > best.change[2] - best.change[0] ? row : best);
  const strongest = (point, reach) => point ? Math.max(...column(point[0], point[1] - reach, point[1] + reach).map(row => luma(row.change))) : null;
  const inFrame = point => point && point[0] >= 12 && point[0] < width - 12 && point[1] >= 12 && point[1] < height - 12;
  const down = (rise, sign) => { for (let turn = 0; turn < 1.4; turn += 0.002) { const dir = direction(41.4, sign * turn); if (dir[1] <= rise) return project(dir); } return null; };
  const sign = inFrame(down(0.005, -1)) ? -1 : 1, leg = { point: down(0.005, sign) }, middle = down(0.16, sign);
  let clipped = 0, touched = 0;
  for (let i = 0; i < on.pixels.length; i += 4) {
    if (Math.abs(on.pixels[i] - off.pixels[i]) + Math.abs(on.pixels[i + 1] - off.pixels[i + 1]) + Math.abs(on.pixels[i + 2] - off.pixels[i + 2]) < 6) continue;
    touched++;
    if (Math.max(on.pixels[i], on.pixels[i + 1], on.pixels[i + 2]) >= 247) clipped++;
  }
  const round = value => Number(value.toFixed(4));
  return { lit, presence: window.__littleHours.room.rainbow.presence, width, height, crown, reddestRow: reddest.y, bluestRow: bluest.y, redShift: round(reddest.change[0] - reddest.change[2]), blueShift: round(bluest.change[2] - bluest.change[0]), crownLift: round(strongest(crown, 12)), middle, middleLift: round(strongest(middle, 12)), leg: leg && leg.point, legLift: leg && round(strongest(leg.point, 12)), touched, clipped, shot: on.shot };
})()`;

async function seat(app) {
  await app.settle();
  await app.waitFor(`(${SEAT}.seat.world.outdoor !== false || ${SEAT}.seat.world.buildsAhead === false)`, { what: 'the outdoor world to be built, where the renderer builds it ahead', timeout: 30000 });
  await steps.openTimer(app); await app.clickSel('#focus-mode-enter');
  await app.waitFor(`${SEAT}.seat.state === 'seated' && ${SEAT}.seat.world.outdoor`, { what: 'the chair view with the outdoor world', timeout: 30000 });
}

const watch = (app, ms, strike) => app.js(`new Promise(resolve => { const room = window.__littleHours.room, samples = [], end = performance.now() + ${ms}; const step = () => { ${strike ? 'room.lightning.strike();' : ''} const outdoor = room.diagnostics().seat.world.outdoorScene; samples.push({ presence: room.rainbow?.presence ?? 0, lightning: room.lightning.level, lit: outdoor.meshes.filter(mesh => mesh.metadata?.effect === 'rainbow' && mesh.isEnabled()).length }); if (performance.now() < end) requestAnimationFrame(step); else resolve(samples); }; requestAnimationFrame(step); })`);

export default {
  about: 'In the rain, a sun break behind the room raises a soft rainbow in the window: red outside violet at its crown, fading into the land at its feet, no clipped colour, one draw, no lightning while it shows, and none under reduced motion or outside the rain',
  async run(t) {
    const { check } = t;
    const app = await t.open({ seed: 'three-rooms', theme: 'rain', width: 960, height: 640 });
    await seat(app);
    await t.sleep(1500);
    const calm = await watch(app, 600, false);
    check('the bow draws exactly while the sun break is up', calm.every(sample => sample.lit === (sample.presence > 0.002 ? 1 : 0)), calm.map(sample => `${sample.presence.toFixed(2)}:${sample.lit}`).slice(0, 20).join(' '));
    await app.js(`window.__littleHours.room.rainbow?.show(600)`);
    await t.sleep(1200);
    const bow = await app.js(MEASURE), shot = bow.shot;
    if (!bow.crown) { check('a sun break draws the bow', false, bow); return; }
    if (shot) writeFileSync(join(t.out, 'rainbow-rain.jpg'), Buffer.from(shot.split(',')[1], 'base64'));
    bow.shot = undefined;
    console.log(JSON.stringify(bow));
    check('a sun break draws the bow as one extra draw at full strength', bow.lit === 1 && bow.presence === 1, { lit: bow.lit, presence: bow.presence });
    check('the crown of the bow shows in the window, a soft lift of 0.03 to 0.2 in luma', bow.crown && bow.crown[1] > 0 && bow.crownLift >= 0.03 && bow.crownLift <= 0.2, { crown: bow.crown, lift: bow.crownLift });
    check('red runs on the outside of the crown and violet-blue inside, as in a real primary bow', bow.reddestRow < bow.bluestRow && bow.redShift > 0.01 && bow.blueShift > 0.005, { red: bow.reddestRow, blue: bow.bluestRow, redShift: bow.redShift, blueShift: bow.blueShift });
    check('the bow fades into the haze toward the land, its foot under 40 percent of its crown', bow.leg && bow.legLift < bow.crownLift * 0.4 && bow.middleLift < bow.crownLift, { crown: bow.crownLift, middle: bow.middleLift, leg: bow.legLift, at: bow.leg });
    check('no colour of the bow clips', bow.touched > 500 && bow.clipped / bow.touched < 0.001, { touched: bow.touched, clipped: bow.clipped });
    const during = await watch(app, 3000, true);
    check('asked for lightning every frame while the bow shows, none strikes', during.every(sample => sample.presence > 0.5 && sample.lightning === 0), { frames: during.length, lowest: Math.min(...during.map(sample => sample.presence)), brightest: Math.max(...during.map(sample => sample.lightning)) });

    const still = await t.open({ seed: 'three-rooms', theme: 'rain', width: 960, height: 640, reducedMotion: true, label: 'reduced motion' });
    await seat(still);
    await still.js(`window.__littleHours.room.rainbow?.show(600)`);
    const samples = [];
    for (let i = 0; i < 4; i++) {
      await still.drag({ x: 480, y: 320 }, { x: 480 + (i % 2 ? -40 : 40), y: 320 }, 4);
      samples.push(...await watch(still, 300, false));
    }
    check('under reduced motion a requested sun break shows no bow while the view redraws', samples.length > 0 && samples.every(sample => sample.presence === 0 && sample.lit === 0), { samples: samples.length });

    for (const theme of ['day', 'dusk']) {
      const dry = await t.open({ seed: 'three-rooms', theme, width: 960, height: 640, label: theme });
      await seat(dry);
      await dry.js(`window.__littleHours.room.rainbow?.show(600)`);
      await t.sleep(800);
      const clear = await watch(dry, 600, false);
      check(`in the ${theme} theme a requested sun break shows no bow`, clear.length > 0 && clear.every(sample => sample.presence === 0 && sample.lit === 0), { samples: clear.length });
    }
  },
};
