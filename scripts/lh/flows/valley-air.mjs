import { join } from 'node:path';
import { launch, sleep, slow } from '../chrome.mjs';

const RAIN_RIDGES = `(() => {
  const { engine, scene, camera } = window.__world, gl = engine._gl;
  const width = engine.getRenderWidth(), height = engine.getRenderHeight();
  engine.beginFrame(); scene.render(); engine.endFrame();
  const pixels = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const luma = (x, y) => { const i = ((height - 1 - y) * width + x) * 4; return (.299 * pixels[i] + .587 * pixels[i + 1] + .114 * pixels[i + 2]) / 255; };
  const V = camera.position.constructor, transform = scene.getTransformMatrix(), screen = camera.viewport.toGlobal(width, height), identity = transform.constructor.Identity(), rows = [];
  const rowOf = e => V.Project(camera.position.add(new V(0, Math.sin(e * Math.PI / 180), -Math.cos(e * Math.PI / 180)).scale(1000)), identity, transform, screen).y;
  for (let e = 16; e > 0.5; e -= 0.05) { const y = Math.round(rowOf(e)); if (!rows.length || rows[rows.length - 1].y !== y) rows.push({ y, e }); }
  const median = list => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
  const steps = [], body = [], sky = [];
  for (let x = Math.round(width * 0.1); x < width * 0.9; x += 8) {
    const profile = rows.map(({ y }) => median([0, 1, 2, 3, 4].map(k => luma(Math.min(width - 1, x + k), y))));
    let step = 0;
    for (let k = 0; k + 6 < rows.length; k++) if (rows[k].e < 12) step = Math.max(step, profile[k + 6] - profile[k]);
    steps.push(step);
    rows.forEach(({ e }, k) => { if (e > 1 && e < 3) body.push(profile[k]); if (e > 13.5) sky.push(profile[k]); });
  }
  const mean = list => list.reduce((sum, value) => sum + value, 0) / list.length;
  return { topStep: Number(median(steps).toFixed(4)), worstStep: Number(Math.max(...steps).toFixed(4)), body: Number(mean(body).toFixed(4)), sky: Number(mean(sky).toFixed(4)), columns: steps.length };
})()`;

const TREES = `(() => {
  const { engine, scene, camera } = window.__world, gl = engine._gl;
  const width = engine.getRenderWidth(), height = engine.getRenderHeight(), trees = scene.meshes.filter(mesh => mesh.name.startsWith('world-trees-') && mesh.isEnabled());
  const read = () => { engine.beginFrame(); scene.render(); engine.endFrame(); const pixels = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels); return pixels; };
  const full = read();
  for (const mesh of trees) mesh.setEnabled(false);
  const bare = read();
  for (const mesh of trees) mesh.setEnabled(true);
  const V = camera.position.constructor, transform = scene.getTransformMatrix(), identity = transform.constructor.Identity();
  const nearRow = V.Project(camera.position.add(new V(0, -Math.sin(3 * Math.PI / 180), -Math.cos(3 * Math.PI / 180)).scale(1000)), identity, transform, camera.viewport.toGlobal(width, height)).y;
  const near = [], nearSum = [0, 0, 0]; let pixels = 0, gold = 0;
  for (let i = 0; i < full.length; i += 4) {
    if (Math.abs(full[i] - bare[i]) + Math.abs(full[i + 1] - bare[i + 1]) + Math.abs(full[i + 2] - bare[i + 2]) < 24) continue;
    const r = full[i] / 255, g = full[i + 1] / 255, b = full[i + 2] / 255, max = Math.max(r, g, b), min = Math.min(r, g, b), saturation = max ? (max - min) / max : 0;
    const hue = max === min ? 0 : ((max === r ? (g - b) / (max - min) : max === g ? 2 + (b - r) / (max - min) : 4 + (r - g) / (max - min)) * 60 + 360) % 360;
    pixels++;
    if (height - 1 - Math.floor(i / 4 / width) > nearRow) { near.push(saturation); nearSum[0] += r; nearSum[1] += g; nearSum[2] += b; }
    if (hue >= 28 && hue <= 62 && saturation > 0.4 && max > 0.4) gold++;
  }
  near.sort((a, b) => a - b);
  const [r, g, b] = nearSum, max = Math.max(r, g, b), min = Math.min(r, g, b), nearHue = Math.round(((max === r ? (g - b) / (max - min) : max === g ? 2 + (b - r) / (max - min) : 4 + (r - g) / (max - min)) * 60 + 360) % 360);
  return { pixels, near: near.length, nearSaturation: Number(near[Math.floor(near.length / 2)].toFixed(4)), nearHue, gold: Number((gold / pixels).toFixed(4)) };
})()`;

async function openWorld(t, theme) {
  const browser = await launch({ width: 960, height: 640, scale: 1, reducedMotion: true });
  await browser.navigate(`${t.url}/checks/world.html?view=window&theme=${theme}`);
  for (let i = 0; i < 2400 * slow && !await browser.js('Boolean(window.__world?.ready())').catch(() => false); i++) await sleep(50);
  await sleep(500 * slow);
  return browser;
}

export default {
  about: 'valley air: valley trees stay green by day and turn olive with a gold rim at dusk; in rain the far ridge layers stand lighter than the sky in their bodies but their tops melt into it with no hard step',
  async run(t) {
    const { check } = t;
    for (const theme of ['day', 'dusk']) {
      const browser = await openWorld(t, theme);
      try {
        const trees = await browser.js(TREES);
        await browser.shot(join(t.out, `valley-air-${theme}.jpg`));
        if (theme === 'day') check('day: trees in the near valley, more than 3 degrees below the horizon, keep their green instead of fading into haze', trees.near > 5000 && trees.nearSaturation > 0.455, trees);
        if (theme === 'dusk') check('dusk: the sun-facing edges of the trees catch a gold rim', trees.pixels > 5000 && trees.gold > 0.055, trees);
        if (theme === 'dusk') check('dusk: the near trees read olive under the warm light, not blue-green', trees.near > 5000 && trees.nearHue <= 86, trees);
        check(`no page errors (world ${theme})`, browser.errors.length === 0, browser.errors.join(' | ').slice(0, 400));
      } finally { await browser.close(); }
    }
    const browser = await openWorld(t, 'rain');
    try {
      const ridges = await browser.js(RAIN_RIDGES);
      await browser.shot(join(t.out, 'valley-air-rain.jpg'));
      check('rain: the ridge bodies stand lighter than the clouds above them', ridges.body > ridges.sky + 0.03, ridges);
      check('rain: the ridge tops melt into the sky with no hard brightening step', ridges.topStep < 0.03, ridges);
      check('no page errors (world rain)', browser.errors.length === 0, browser.errors.join(' | ').slice(0, 400));
    } finally { await browser.close(); }
  },
};
