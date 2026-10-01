import { join } from 'node:path';
import { launch, sleep, slow } from '../chrome.mjs';

const SITES = JSON.stringify({
  observatory: { at: [643, 557, -3035], reach: 115, fov: 0.12 },
  butte: { at: [-611, -23, -590], reach: 63, fov: 0.3 },
  plume: { at: [-580, 6, -560], reach: 36, fov: 0.3 },
  ribbon: { at: [-587, 16, -567], reach: 10, fov: 0.3 },
});

const measure = name => `(() => {
  const { engine, scene, camera } = window.__world, gl = engine._gl, site = ${SITES}[${JSON.stringify(name)}];
  const width = engine.getRenderWidth(), height = engine.getRenderHeight(), V = camera.position.constructor;
  camera.fov = site.fov; camera.setTarget(new V(...site.at));
  const read = () => { engine.beginFrame(); scene.render(); engine.endFrame(); const pixels = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels); return pixels; };
  const solid = scene.getMeshByName('world-landmarks'), veil = scene.getMeshByName('world-landmark-veils');
  read(); const full = read(); veil.isVisible = false; const solidOnly = read(); solid.isVisible = false; const bare = read(); solid.isVisible = true; veil.isVisible = true;
  const transform = scene.getTransformMatrix(), identity = transform.constructor.Identity(), screen = camera.viewport.toGlobal(width, height);
  const project = ([x, y, z]) => { const p = V.Project(new V(x, y, z), identity, transform, screen); return [p.x, p.y]; };
  const luma = (pixels, i) => (0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]) / 255;
  const differs = (a, b, i) => Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) >= 18;
  const [cx, cy] = project(site.at), [ex] = project([site.at[0] + site.reach, site.at[1], site.at[2]]), [, ey] = project([site.at[0], site.at[1] + site.reach, site.at[2]]);
  const rx = Math.ceil(Math.hypot(ex - cx, 1)), ry = Math.ceil(Math.abs(ey - cy)) + 2, rows = [];
  for (let y = Math.max(0, Math.round(cy - ry)); y < Math.min(height, Math.round(cy + ry)); y++) rows.push(Array.from({ length: 2 * rx }, (_, k) => Math.round(cx - rx) + k).filter(x => x >= 0 && x < width).map(x => ((height - 1 - y) * width + x) * 4));
  const ordered = list => [...list].sort((a, b) => a - b), quantile = (list, q) => list[Math.floor((list.length - 1) * q)] ?? 0, mean = list => list.reduce((sum, value) => sum + value, 0) / Math.max(list.length, 1);
  const round = value => Number(value.toFixed(4));
  if (${JSON.stringify(name)} === 'observatory') {
    const stone = rows.map(row => row.filter(i => differs(solidOnly, bare, i))), lowest = stone.findLastIndex(row => row.length > 0);
    const ridge = rows.slice(lowest + 3, lowest + 12).flat().map(i => luma(bare, i)), tones = ordered(stone.flat().map(i => luma(solidOnly, i)));
    return { pixels: tones.length, ridge: round(mean(ridge)), light: round(quantile(tones, 0.9)), dark: round(quantile(tones, 0.1)) };
  }
  if (${JSON.stringify(name)} === 'butte') {
    const counts = [], width2 = rows[0].length;
    for (let column = Math.round(width2 * 0.2); column < width2 * 0.8; column += 3) {
      const tones = rows.map(row => row[column]).filter(i => differs(solidOnly, bare, i)).map(i => luma(solidOnly, i));
      const soft = tones.map((_, k) => mean(tones.slice(Math.max(0, k - 1), k + 2)));
      let seams = 0;
      for (let k = 4; k + 4 < soft.length; k++) if (soft[k] <= Math.min(...soft.slice(k - 4, k + 5)) && soft[k] < soft[k - 1] && Math.max(...soft.slice(Math.max(0, k - 12), k + 13)) - soft[k] > 0.05) seams++;
      if (tones.length > 40) counts.push(seams);
    }
    return { columns: counts.length, seams: ordered(counts)[counts.length >> 1] ?? 0 };
  }
  const area = rows.flat();
  if (${JSON.stringify(name)} === 'plume') return { pixels: area.length, misted: round(area.filter(i => differs(full, solidOnly, i) && luma(full, i) > luma(solidOnly, i)).length / Math.max(area.length, 1)) };
  return { pixels: area.length, tones: area.map(i => Math.round(luma(full, i) * 255)) };
})()`;

async function openWorld(t, theme, reducedMotion) {
  const browser = await launch({ width: 960, height: 640, scale: 1, reducedMotion });
  await browser.navigate(`${t.url}/checks/world.html?view=window&theme=${theme}`);
  for (let i = 0; i < 2400 * slow && !await browser.js('Boolean(window.__world?.ready())').catch(() => false); i++) await sleep(50);
  await sleep(500 * slow);
  return browser;
}

const changed = (a, b) => a.tones.filter((tone, k) => Math.abs(tone - b.tones[k]) > 3).length / Math.max(a.tones.length, 1);

export default {
  about: 'landmarks: the observatory parts from its ridge with a pale drum under a dark dome, the waterfall butte shows rock strata, plunge mist billows at the foot, and the falls run only with motion allowed',
  async run(t) {
    const { check } = t;
    for (const theme of ['day', 'dusk']) {
      const browser = await openWorld(t, theme, true);
      try {
        const dome = await browser.js(measure('observatory'));
        await browser.shot(join(t.out, `landmarks-observatory-${theme}.jpg`));
        const butte = await browser.js(measure('butte'));
        const plume = await browser.js(measure('plume'));
        await browser.shot(join(t.out, `landmarks-butte-${theme}.jpg`));
        console.log(theme, JSON.stringify({ dome, butte, plume }));
        check(`${theme}: the observatory parts from its ridge, a pale drum under a dome darker than the ridge`, dome.pixels > 2000 && dome.light - dome.dark > 0.1 && dome.dark < dome.ridge - 0.06, dome);
        check(`${theme}: the butte face shows stacked rock strata, not one flat wall`, butte.columns > 20 && butte.seams >= 2, butte);
        check(`${theme}: plunge mist billows over the waterfall's foot`, plume.misted > 0.25, plume);
        check(`no page errors (landmarks ${theme})`, browser.errors.length === 0, browser.errors.join(' | ').slice(0, 400));
      } finally { await browser.close(); }
    }
    for (const reducedMotion of [false, true]) {
      const browser = await openWorld(t, 'day', reducedMotion);
      try {
        const before = await browser.js(measure('ribbon'));
        await sleep(1200);
        const after = await browser.js(measure('ribbon'));
        console.log('falls', JSON.stringify({ reducedMotion, pixels: before.pixels, changed: changed(before, after) }));
        if (reducedMotion) check('reduced motion: the waterfall holds still', before.pixels > 200 && changed(before, after) === 0, { pixels: before.pixels, changed: changed(before, after) });
        else check('the waterfall streams down when motion is allowed', before.pixels > 200 && changed(before, after) > 0.1, { pixels: before.pixels, changed: changed(before, after) });
      } finally { await browser.close(); }
    }
  },
};
