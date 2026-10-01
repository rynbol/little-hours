import { join } from 'node:path';
import { launch, sleep, slow } from '../chrome.mjs';

const MEASURE = `(() => {
  const { engine, scene, camera } = window.__world, gl = engine._gl, clouds = scene.getMeshByName('world-clouds');
  const at = clouds.getVerticesData('position'), size = clouds.getVerticesData('color'), kind = clouds.getVerticesData('uv2'), sun = clouds.material._vectors3.sun, everyCard = [...clouds.getIndices()];
  const eye = camera.position, width = engine.getRenderWidth(), height = engine.getRenderHeight(), focal = height / 2 / Math.tan(camera.fov / 2);
  const read = () => { engine.beginFrame(); scene.render(); engine.endFrame(); const pixels = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels); return pixels; };
  const luma = (p, i) => (.2126 * p[i] + .7152 * p[i + 1] + .0722 * p[i + 2]) / 255;
  const others = scene.meshes.filter(mesh => mesh !== clouds && mesh.isEnabled());
  const alone = shade => { const keep = scene.clearColor.clone(); others.forEach(mesh => mesh.setEnabled(false)); scene.clearColor.set(shade, shade, shade, 1); const pixels = read(); scene.clearColor.copyFrom(keep); others.forEach(mesh => mesh.setEnabled(true)); return pixels; };
  const quantile = (list, q) => [...list].sort((a, b) => a - b)[Math.min(list.length - 1, Math.floor(list.length * q))];
  const cards = [], widths = [];
  for (let v = 0; v < at.length / 3; v += 4) {
    if (kind[v * 2 + 1] !== 0) continue;
    const x = at[v * 3] - eye.x, y = at[v * 3 + 1] - eye.y, z = at[v * 3 + 2] - eye.z, range = Math.hypot(x, y, z);
    if (z > 0 || Math.abs(Math.atan2(x, -z)) > 0.6) continue;
    widths.push(size[v * 4] / range * focal);
    if (size[v * 4 + 1] / range * focal < 40) continue;
    cards.push({ v, x: at[v * 3], y: at[v * 3 + 1], z: at[v * 3 + 2], across: size[v * 4] / range * focal, toward: (x * sun.x + y * sun.y + z * sun.z) / range });
  }
  const sorted = cards.sort((a, b) => b.toward - a.toward), measured = [...new Set([...sorted.slice(0, 3), ...sorted.slice(-3)])].map(card => {
    camera.setTarget(new eye.constructor(card.x, card.y, card.z));
    clouds.setIndices([0, 1, 2, 0, 2, 3].map(k => card.v + k));
    clouds.setEnabled(false); const clear = read(); clouds.setEnabled(true);
    const sunRight = eye.constructor.TransformNormal(sun, camera.getViewMatrix(true)).x;
    const black = alone(0), white = alone(1), covered = [], alpha = new Float32Array(width * height), paint = new Float32Array(width * height * 3);
    for (let p = 0; p < width * height; p++) {
      const i = p * 4, a = 1 - (white[i] - black[i] + white[i + 1] - black[i + 1] + white[i + 2] - black[i + 2]) / 765;
      alpha[p] = a;
      if (a < 0.3) continue;
      covered.push(p);
      for (let c = 0; c < 3; c++) paint[p * 3 + c] = Math.min(255, black[i + c] / a);
    }
    if (covered.length < 400) return null;
    const row = p => Math.floor(p / width), column = p => p % width, lowest = new Map();
    for (const p of covered) lowest.set(column(p), Math.min(lowest.get(column(p)) ?? Infinity, row(p)));
    const floor = quantile([...lowest.values()], 0.05), ceiling = Math.max(...covered.map(row)), tall = Math.max(ceiling - floor, 1), core = covered.filter(p => alpha[p] > 0.7);
    const shade = p => (.2126 * paint[p * 3] + .7152 * paint[p * 3 + 1] + .0722 * paint[p * 3 + 2]) / 255;
    const band = (from, to, list = core) => { let n = 0, sky = 0, lit = 0, r = 0, g = 0, b = 0; const lift = []; for (const p of list) { const t = (row(p) - floor) / tall; if (t < from || t > to) continue; n++; lit += shade(p); sky += luma(clear, p * 4); r += paint[p * 3]; g += paint[p * 3 + 1]; b += paint[p * 3 + 2]; lift.push(shade(p) - luma(clear, p * 4)); } return { n, lit: lit / n, sky: sky / n, warmth: (r - b) / n / 255, dimmest: quantile(lift, 0.2), hex: '#' + [r, g, b].map(c => Math.round(c / n).toString(16).padStart(2, '0')).join('') }; };
    const steps = [0, 1, 2, 3, 4, 5].map(k => band(k / 6, (k + 1) / 6)).filter(step => step.n >= 20).map(step => Number(step.lit.toFixed(3)));
    const columns = [...lowest.keys()].sort((a, b) => a - b), inner = columns.slice(Math.floor(columns.length * 0.2), Math.ceil(columns.length * 0.8)), reach = Math.max(5, Math.round(columns.length * 0.06));
    const bottom = inner.map(c => lowest.get(c)), offsets = bottom.map((b, k) => { const near = bottom.slice(Math.max(0, k - reach), k + reach + 1); return Math.abs(b - near.reduce((sum, value) => sum + value, 0) / near.length); });
    const gap = Math.max(2, Math.round(tall * 0.05)), solid = p => alpha[p] > 0.7;
    let probed = 0, valleys = 0;
    for (const p of core) {
      const up = p + gap * width, down = p - gap * width, left = p - gap, right = p + gap;
      if (column(p) < gap || column(p) >= width - gap || !(solid(up) && solid(down) && solid(left) && solid(right))) continue;
      probed++;
      if (shade(p) < (shade(up) + shade(down)) / 2 - 0.015 || shade(p) < (shade(left) + shade(right)) / 2 - 0.015) valleys++;
    }
    const sunward = band(0.3, 1, core.filter(p => (column(p) - width / 2) * sunRight > 0)), away = band(0.3, 1, core.filter(p => (column(p) - width / 2) * sunRight < 0));
    const peak = quantile(covered.map(shade), 0.995);
    const top = band(0.6, 1), under = band(0, 0.25), body = band(0.35, 0.65), fringe = band(0.4, 1, covered.filter(p => alpha[p] <= 0.7 && (alpha[p + width * 3] ?? 0) < 0.3));
    return top.n < 50 || under.n < 50 ? null : { toward: Number(card.toward.toFixed(3)), sunRight: Number(sunRight.toFixed(3)), pixels: covered.length, top, under, body, fringe, steps, peak: Number(peak.toFixed(3)), creased: Number((valleys / Math.max(probed, 1)).toFixed(4)), sideWarmth: sunward.n > 50 && away.n > 50 ? Number((sunward.warmth - away.warmth).toFixed(3)) : null, ragged: Number((offsets.reduce((sum, value) => sum + value, 0) / offsets.length / tall).toFixed(4)) };
  }).filter(Boolean);
  clouds.setIndices(everyCard);
  return { spread: Math.max(...widths) / Math.min(...widths), clouds: measured };
})()`;

const BANKS = `(() => {
  const { engine, scene, camera } = window.__world, gl = engine._gl, clouds = scene.getMeshByName('world-clouds'), keepTarget = camera.getTarget().clone();
  const at = clouds.getVerticesData('position'), size = clouds.getVerticesData('color'), kind = clouds.getVerticesData('uv2'), everyCard = [...clouds.getIndices()], eye = camera.position;
  const width = engine.getRenderWidth(), height = engine.getRenderHeight();
  const read = () => { engine.beginFrame(); scene.render(); engine.endFrame(); const pixels = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels); return pixels; };
  const others = scene.meshes.filter(mesh => mesh !== clouds && mesh.isEnabled());
  const alone = shade => { const keep = scene.clearColor.clone(); others.forEach(mesh => mesh.setEnabled(false)); scene.clearColor.set(shade, shade, shade, 1); const pixels = read(); scene.clearColor.copyFrom(keep); others.forEach(mesh => mesh.setEnabled(true)); return pixels; };
  const quantile = (list, q) => [...list].sort((a, b) => a - b)[Math.min(list.length - 1, Math.floor(list.length * q))];
  const banks = [];
  for (let v = 0; v < at.length / 3; v += 4) {
    if (kind[v * 2 + 1] !== 0 || size[v * 4 + 3] <= 1) continue;
    const x = at[v * 3] - eye.x, z = at[v * 3 + 2] - eye.z;
    if (z > 0 || Math.abs(Math.atan2(x, -z)) > 1.1) continue;
    camera.setTarget(new eye.constructor(at[v * 3], at[v * 3 + 1], at[v * 3 + 2]));
    clouds.setIndices([0, 1, 2, 0, 2, 3].map(k => v + k));
    clouds.setEnabled(false); const clear = read(); clouds.setEnabled(true);
    const black = alone(0), white = alone(1), alpha = new Float32Array(width * height), covered = [];
    for (let p = 0; p < width * height; p++) { const i = p * 4; alpha[p] = 1 - (white[i] - black[i] + white[i + 1] - black[i + 1] + white[i + 2] - black[i + 2]) / 765; if (alpha[p] > 0.1) covered.push(p); }
    if (covered.length < 400) continue;
    const row = p => Math.floor(p / width), column = p => p % width, lowest = new Map(), highest = new Map();
    for (const p of covered) { lowest.set(column(p), Math.min(lowest.get(column(p)) ?? Infinity, row(p))); highest.set(column(p), Math.max(highest.get(column(p)) ?? -Infinity, row(p))); }
    const floor = quantile([...lowest.values()], 0.05), ceiling = quantile([...highest.values()], 0.95), tall = Math.max(ceiling - floor, 1);
    const paint = (p, c) => black[p * 4 + c] / 255 / Math.max(alpha[p], 1e-3), luma = p => .2126 * paint(p, 0) + .7152 * paint(p, 1) + .0722 * paint(p, 2);
    const sky = p => { const i = p * 4; return (.2126 * clear[i] + .7152 * clear[i + 1] + .0722 * clear[i + 2]) / 255; };
    const solid = covered.filter(p => alpha[p] > 0.25);
    const under = solid.filter(p => (row(p) - floor) / tall < 0.25), seen = p => luma(p) * alpha[p] + sky(p) * (1 - alpha[p]);
    banks.push({ stretch: Number(size[v * 4 + 3].toFixed(2)), underStep: under.length ? Number((under.reduce((sum, p) => sum + seen(p) - sky(p), 0) / under.length).toFixed(3)) : null });
  }
  clouds.setIndices(everyCard); camera.setTarget(keepTarget);
  return banks;
})()`;

const SKY = `(() => {
  const { engine, scene, camera } = window.__world, gl = engine._gl, sky = scene.getMeshByName('world-sky'), sun = sky.material._vectors3.sun, keepTarget = camera.getTarget().clone(), eye = camera.position;
  const width = engine.getRenderWidth(), height = engine.getRenderHeight(), others = scene.meshes.filter(mesh => mesh !== sky && mesh.isEnabled());
  const heading = Math.atan2(sun.x, -sun.z);
  const look = (turn, up) => {
    camera.setTarget(new eye.constructor(eye.x + Math.cos(up) * Math.sin(heading + turn), eye.y + Math.sin(up), eye.z - Math.cos(up) * Math.cos(heading + turn)));
    engine.beginFrame(); scene.render(); engine.endFrame();
    const pixel = new Uint8Array(4); gl.readPixels(width >> 1, height >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); return '#' + [...pixel.slice(0, 3)].map(c => c.toString(16).padStart(2, '0')).join('');
  };
  others.forEach(mesh => mesh.setEnabled(false));
  const result = { aboveSun: look(0, 0.37), awayTop: look(-0.5, 0.37), awayMid: look(0.5, 0.2), horizon: look(0.5, 0.1), besideSun: look(0.06, Math.asin(sun.y)) };
  others.forEach(mesh => mesh.setEnabled(true)); camera.setTarget(keepTarget);
  return result;
})()`;

const SLIVERS = `(() => {
  const d = window.__littleHours.room.diagnostics(), engine = d.engine, outdoor = d.seat.world.outdoorScene, clouds = outdoor.getMeshByName('world-clouds'), view = outdoor.activeCamera.getTransformationMatrix().m, place = clouds.getWorldMatrix().m;
  const at = clouds.getVerticesData('position'), size = clouds.getVerticesData('color'), kind = clouds.getVerticesData('uv2');
  const screen = (x, y, z) => { const w = [0, 1, 2].map(k => place[k] * x + place[4 + k] * y + place[8 + k] * z + place[12 + k]), clip = [0, 1, 3].map(k => view[k] * w[0] + view[4 + k] * w[1] + view[8 + k] * w[2] + view[12 + k]); return clip[2] > 0 ? [clip[0] / clip[2], clip[1] / clip[2]] : null; };
  const cut = [];
  for (let v = 0; v < at.length / 3; v += 4) {
    if (kind[v * 2 + 1] !== 0) continue;
    const top = screen(at[v * 3], at[v * 3 + 1] + size[v * 4 + 1] * 0.8, at[v * 3 + 2]), bottom = screen(at[v * 3], at[v * 3 + 1] - size[v * 4 + 1] * 0.62, at[v * 3 + 2]);
    if (!top || !bottom || Math.abs(top[0]) > 1 || top[1] <= 1 || bottom[1] >= 1) continue;
    cut.push({ seed: Number(kind[v * 2].toFixed(2)), shown: Number(((1 - bottom[1]) / 2).toFixed(3)) });
  }
  return cut;
})()`;

const RIM = Math.cos(25 * Math.PI / 180), UNDERSIDE = (0.2126 * 0x90 + 0.7152 * 0xaf + 0.0722 * 0xc1) / 255;

export default {
  about: 'clouds: from the window, cumulus banks vary in size, are soft cards clearly brighter than the sky with a smooth grade from lit tops to cooler undersides, no creases, no clipped rims, ragged bottoms, and warmth on the side facing a sun within 25 degrees, at day and at dusk, with no rim under the veiled rain sun',
  async run(t) {
    const { check } = t;
    for (const theme of ['day', 'dusk', 'rain']) {
      const browser = await launch({ width: 960, height: 640, scale: 1, reducedMotion: true });
      try {
        await browser.navigate(`${t.url}/checks/world.html?view=window&theme=${theme}`);
        for (let i = 0; i < 2400 * slow && !await browser.js('Boolean(window.__world?.ready())').catch(() => false); i++) await sleep(50);
        await sleep(500 * slow);
        const { spread, clouds } = await browser.js(MEASURE), banks = await browser.js(BANKS);
        if (theme === 'rain') check('rain: no flat bank shows as a dark slab, its underside never more than 0.02 darker than the sky behind it', banks.length >= 4 && banks.every(({ underStep }) => underStep > -0.02), banks.map(({ stretch, underStep }) => [stretch, underStep]));
        await browser.shot(join(t.out, `clouds-${theme}.jpg`));
        const near = clouds.filter(cloud => cloud.toward > RIM);
        if (theme === 'day') {
          const sky = await browser.js(SKY), rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255), luma = hex => { const [r, g, b] = rgb(hex); return .2126 * r + .7152 * g + .0722 * b; }, near = (hex, target) => Math.max(...rgb(hex).map((c, i) => Math.abs(c - rgb(target)[i]))) < 0.04;
          check('day: the window top is the zenith blue near #8fb3c4 even right above the sun, over a sky that pales to #a5c2c8 halfway down', near(sky.aboveSun, '#8fb3c4') && near(sky.awayTop, '#8fb3c4') && near(sky.awayMid, '#a5c2c8'), sky);
          check('day: the horizon stays pale and the sun keeps its glow', luma(sky.horizon) > luma(sky.awayTop) + 0.1 && luma(sky.besideSun) > 0.85, sky);
        }
        if (theme === 'rain') {
          check('rain: no cumulus in front of the window carries a bright rim under the veiled sun, every fringe no brighter than its top', clouds.length >= 3 && clouds.every(({ top, fringe }) => fringe.lit < top.lit + 0.01), clouds.map(({ toward, sunRight, top, fringe }) => [toward, sunRight, fringe.hex, top.hex]));
          check('no page errors (world rain)', browser.errors.length === 0, browser.errors.join(' | ').slice(0, 400));
          continue;
        }
        check(`${theme}: at least three cumulus in front of the window are measured`, clouds.length >= 3, clouds.map(({ toward, sunRight, under, body, top, fringe, steps, ragged, peak, creased, sideWarmth }) => ({ toward, sunRight, under: under.hex, body: body.hex, top: top.hex, fringe: fringe.hex, lift: Number((body.lit - body.sky).toFixed(3)), peak, creased, sideWarmth, ragged, steps })));
        check(`${theme}: the banks in front of the window span at least three times in apparent width`, spread >= 3, spread);
        check(`${theme}: every measured cumulus has lit tops clearly brighter than the sky behind them with no dark cores, even near the sun`, clouds.every(cloud => cloud.top.lit - cloud.top.sky > 0.1 && cloud.top.dimmest > 0.02), clouds.map(cloud => [cloud.top.lit, cloud.top.sky, cloud.top.dimmest]));
        check(`${theme}: every measured cumulus is darker and cooler underneath than on top`, clouds.every(cloud => cloud.under.lit < cloud.top.lit - 0.08 && cloud.under.warmth < cloud.top.warmth - 0.04), clouds.map(cloud => [cloud.under.hex, cloud.top.hex, cloud.toward]));
        if (theme === 'day') check('day: the undersides sit at the blue-grey of #90afc1, a median luma within 0.04 of it', Math.abs(clouds.map(cloud => cloud.under.lit).sort((a, b) => a - b)[Math.floor(clouds.length / 2)] - UNDERSIDE) < 0.04, clouds.map(cloud => [cloud.under.hex, Number(cloud.under.lit.toFixed(3))]));
        check(`${theme}: every measured cumulus brightens steadily from just above its feathered fringe to its top, with no step between sixths`, clouds.every(({ steps }) => steps.every((lit, k) => k < 2 || (lit > steps[k - 1] - 0.03 && lit - steps[k - 1] < (Math.max(...steps) - steps[1]) * 0.5))), clouds.map(cloud => cloud.steps));
        check(`${theme}: every measured cumulus has a ragged bottom edge, not a straight skirt`, clouds.every(cloud => cloud.ragged > 0.012), clouds.map(cloud => cloud.ragged));
        check(`${theme}: the middle of every measured cumulus is clearly brighter than the sky behind it`, clouds.every(cloud => cloud.body.lit - cloud.body.sky > 0.06), clouds.map(cloud => [cloud.body.hex, Number((cloud.body.lit - cloud.body.sky).toFixed(3))]));
        check(`${theme}: every measured cumulus is a soft grade with no dark creases inside its body`, clouds.every(cloud => cloud.creased < 0.01), clouds.map(cloud => cloud.creased));
        check(`${theme}: no cumulus has a clipped rim, its brightest half percent below luma 0.98 even beside the sun`, clouds.every(cloud => cloud.peak < 0.98), clouds.map(cloud => [cloud.toward, cloud.peak]));
        const beside = near.filter(cloud => Math.abs(cloud.sunRight) > 0.05 && cloud.sideWarmth !== null);
        check(`${theme}: cumulus within 25 degrees of the sun are warmer on the side that faces it`, beside.length > 0 && beside.every(cloud => cloud.sideWarmth > 0.015), beside.map(({ toward, sunRight, sideWarmth }) => [toward, sunRight, sideWarmth]));
        check(`no page errors (world ${theme})`, browser.errors.length === 0, browser.errors.join(' | ').slice(0, 400));
      } finally { await browser.close(); }
    }
    const app = await t.open({ seed: 'three-rooms', theme: 'day', width: 960, height: 640, reducedMotion: true });
    await app.waitFor(`window.__littleHours.room.diagnostics().seat.world.outdoor !== false`, { what: 'the outdoor world to be built', timeout: 30000 });
    await app.clickSel('#focus-mode-enter');
    await app.waitFor(`window.__littleHours.room.diagnostics().seat.state === 'seated'`, { what: 'the view to settle in the chair', timeout: 30000 });
    const box = await app.box('#room-canvas'), slivers = [];
    for (const turn of [0, -30, 30, 35]) {
      const step = (turn - (slivers.at(-1)?.turn ?? 0)) * Math.PI / 180 / 0.0042;
      if (step) await app.drag({ x: box.x - step / 2, y: box.y }, { x: box.x + step / 2, y: box.y });
      await app.settle();
      slivers.push({ turn, cut: await app.js(SLIVERS) });
    }
    check('day, from the chair: no cumulus is cut by the top of the view down to a grey sliver of underside, each one either clears the top or shows at least a tenth of the view', slivers.every(({ cut }) => cut.every(({ shown }) => shown >= 0.1)), slivers);
    await t.close(app);
  },
};
