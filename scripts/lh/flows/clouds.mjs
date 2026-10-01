import { join } from 'node:path';
import { launch, sleep, slow } from '../chrome.mjs';

const MEASURE = `(() => {
  const { engine, scene, camera } = window.__world, gl = engine._gl, clouds = scene.getMeshByName('world-clouds');
  const at = clouds.getVerticesData('position'), size = clouds.getVerticesData('color'), kind = clouds.getVerticesData('uv2'), sun = clouds.material._vectors3.sun;
  const eye = camera.position, width = engine.getRenderWidth(), height = engine.getRenderHeight(), focal = height / 2 / Math.tan(camera.fov / 2);
  const read = () => { engine.beginFrame(); scene.render(); engine.endFrame(); const pixels = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels); return pixels; };
  const luma = (p, i) => (.2126 * p[i] + .7152 * p[i + 1] + .0722 * p[i + 2]) / 255;
  const cards = [];
  for (let v = 0; v < at.length / 3; v += 4) {
    if (kind[v * 2 + 1] !== 0) continue;
    const x = at[v * 3] - eye.x, y = at[v * 3 + 1] - eye.y, z = at[v * 3 + 2] - eye.z, range = Math.hypot(x, y, z);
    if (z > 0 || size[v * 4 + 1] / range * focal < 40) continue;
    cards.push({ x: at[v * 3], y: at[v * 3 + 1], z: at[v * 3 + 2], across: size[v * 4] / range * focal, up: size[v * 4 + 1] / range * focal, toward: (x * sun.x + y * sun.y + z * sun.z) / range });
  }
  return cards.sort((a, b) => b.toward - a.toward).slice(0, 6).map(card => {
    camera.setTarget(new eye.constructor(card.x, card.y, card.z));
    clouds.setEnabled(true); const cloudy = read();
    clouds.setEnabled(false); const clear = read();
    clouds.setEnabled(true);
    const rows = [];
    for (let i = 0; i < cloudy.length; i += 4) {
      const x = (i / 4) % width, y = Math.floor(i / 4 / width);
      if (Math.abs(x - width / 2) < card.across * .5 && Math.abs(y - height / 2) < card.up && Math.abs(cloudy[i] - clear[i]) + Math.abs(cloudy[i + 1] - clear[i + 1]) + Math.abs(cloudy[i + 2] - clear[i + 2]) > 30) rows.push(i);
    }
    if (rows.length < 400) return null;
    const row = i => Math.floor(i / 4 / width), low = height / 2 - card.up * .6, high = height / 2 + card.up * .9;
    const band = (from, to) => { let n = 0, sky = 0, lit = 0, r = 0, b = 0; const lift = []; for (const i of rows) { const t = (row(i) - low) / (high - low); if (t < from || t > to) continue; n++; lit += luma(cloudy, i); sky += luma(clear, i); r += cloudy[i]; b += cloudy[i + 2]; lift.push(luma(cloudy, i) - luma(clear, i)); } lift.sort((a, b) => a - b); return { n, lit: lit / n, sky: sky / n, warmth: (r - b) / n / 255, dimmest: lift[Math.floor(lift.length * .2)] }; };
    const top = band(.55, 1), under = band(0, .15);
    return top.n < 50 || under.n < 50 ? null : { toward: Number(card.toward.toFixed(2)), pixels: rows.length, top, under };
  }).filter(Boolean);
})()`;

export default {
  about: 'clouds: from the window, cumulus near and away from the sun have lit tops brighter than the sky behind them and undersides cooler than their tops, at day and at dusk',
  async run(t) {
    const { check } = t;
    for (const theme of ['day', 'dusk']) {
      const browser = await launch({ width: 960, height: 640, scale: 1, reducedMotion: true });
      try {
        await browser.navigate(`${t.url}/checks/world.html?view=window&theme=${theme}`);
        for (let i = 0; i < 2400 * slow && !await browser.js('Boolean(window.__world?.ready())').catch(() => false); i++) await sleep(50);
        await sleep(500 * slow);
        const clouds = await browser.js(MEASURE);
        await browser.shot(join(t.out, `clouds-${theme}.jpg`));
        check(`${theme}: at least three cumulus in front of the window are measured`, clouds.length >= 3, clouds);
        check(`${theme}: every measured cumulus has lit tops clearly brighter than the sky behind them with no dark cores, even near the sun`, clouds.every(cloud => cloud.top.lit - cloud.top.sky > 0.06 && cloud.top.dimmest > 0.02), clouds);
        check(`${theme}: every measured cumulus is darker and cooler underneath than on top`, clouds.every(cloud => cloud.under.lit < cloud.top.lit - 0.08 && cloud.under.warmth < cloud.top.warmth - 0.04), clouds);
        check(`no page errors (world ${theme})`, browser.errors.length === 0, browser.errors.join(' | ').slice(0, 400));
      } finally { await browser.close(); }
    }
  },
};
