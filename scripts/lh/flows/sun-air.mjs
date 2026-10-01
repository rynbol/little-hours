import { join } from 'node:path';
import { launch, sleep, slow } from '../chrome.mjs';

const MEASURE = `(() => {
  const { engine, scene, camera } = window.__world, gl = engine._gl, sun = scene.getMeshByName('world-sky').material._vectors3.sun;
  camera.setTarget(camera.position.add(new camera.position.constructor(sun.x, 0, sun.z)));
  const flat = Math.hypot(sun.x, sun.z), ahead = [sun.x / flat, sun.z / flat], width = engine.getRenderWidth(), height = engine.getRenderHeight(), focal = height / 2 / Math.tan(camera.fov / 2), shown = scene.meshes.filter(mesh => mesh.isEnabled());
  const read = () => { engine.beginFrame(); scene.render(); engine.endFrame(); const pixels = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels); return pixels; };
  for (const mesh of shown) if (mesh.name === 'world-clouds') mesh.setEnabled(false);
  const full = read();
  for (const mesh of shown) mesh.setEnabled(mesh.name === 'world-sky');
  const sky = read();
  for (const mesh of shown) mesh.setEnabled(true);
  const groups = { groundAway: [], groundNear: [], skyHigh: [], skyNearSun: [], skyFar: [] };
  for (let y = 4; y < height; y += 6) for (let x = 4; x < width; x += 6) {
    const i = ((height - 1 - y) * width + x) * 4, across = (x - width / 2) / focal, rise = (height / 2 - y) / focal, length = Math.hypot(1, across, rise), ray = { x: (ahead[0] - ahead[1] * across) / length, y: rise / length, z: (ahead[1] + ahead[0] * across) / length };
    const angle = Math.acos(Math.min(1, ray.x * sun.x + ray.y * sun.y + ray.z * sun.z)) * 180 / Math.PI, elevation = Math.asin(ray.y) * 180 / Math.PI;
    const ground = Math.abs(full[i] - sky[i]) + Math.abs(full[i + 1] - sky[i + 1]) + Math.abs(full[i + 2] - sky[i + 2]) > 24, color = [full[i], full[i + 1], full[i + 2]];
    if (ground && angle > 12 && elevation > -5) groups.groundAway.push(color);
    if (ground && elevation < -15) groups.groundNear.push(color);
    if (!ground && elevation > 12 && angle > 30) groups.skyHigh.push(color);
    if (!ground && angle < 8) groups.skyNearSun.push(color);
    if (!ground && angle > 40) groups.skyFar.push(color);
  }
  const mean = list => { const sum = list.reduce((total, c) => [total[0] + c[0], total[1] + c[1], total[2] + c[2]], [0, 0, 0]); return sum.map(v => v / Math.max(1, list.length) / 255); };
  return Object.fromEntries(Object.entries(groups).map(([name, list]) => {
    const [r, g, b] = mean(list), max = Math.max(r, g, b), min = Math.min(r, g, b);
    const hue = max === min ? 0 : ((max === r ? (g - b) / (max - min) : max === g ? 2 + (b - r) / (max - min) : 4 + (r - g) / (max - min)) * 60 + 360) % 360;
    return [name, { n: list.length, hue: Math.round(hue), r: +r.toFixed(3), g: +g.toFixed(3), b: +b.toFixed(3), warmth: +(r - b).toFixed(3), saturation: +(max ? (max - min) / max : 0).toFixed(3) }];
  }));
})()`;

export default {
  about: 'sun air: at dusk the amber stays in a narrow glow around the sun while far land and the upper sky stay cool, and the day sun has a warm glow in a blue sky',
  async run(t) {
    const { check } = t;
    for (const theme of ['day', 'dusk', 'rain']) {
      const browser = await launch({ width: 960, height: 640, scale: 1, reducedMotion: true });
      try {
        await browser.navigate(`${t.url}/checks/world.html?view=window&theme=${theme}`);
        for (let i = 0; i < 600 && !await browser.js('Boolean(window.__world?.ready())').catch(() => false); i++) await sleep(50);
        await sleep(500 * slow);
        const air = await browser.js(MEASURE);
        await browser.shot(join(t.out, `sun-air-${theme}.jpg`));
        check(`${theme}: every sampled region has pixels`, Object.values(air).every(group => group.n > 20) || theme === 'rain', air);
        if (theme === 'dusk') {
          check('dusk: far land more than 12 degrees from the sun is cool or neutral, not amber', air.groundAway.warmth < 0.03, air.groundAway);
          check('dusk: the upper sky away from the sun is a calm grey-green', air.skyHigh.saturation < 0.12 && air.skyHigh.g >= air.skyHigh.r, air.skyHigh);
          check('dusk: the sky right around the sun stays gold', air.skyNearSun.warmth > 0.15, air.skyNearSun);
          check('dusk: the meadow below the window stays grass-coloured, not straw-brown', air.groundNear.hue >= 50, air.groundNear);
        }
        if (theme === 'day') {
          check('day: the sky right around the sun is warm, not a cold cyan halo', air.skyNearSun.r > air.skyNearSun.b, air.skyNearSun);
          check('day: the sky away from the sun stays blue', air.skyFar.b > air.skyFar.r + 0.08, air.skyFar);
        }
        if (theme === 'rain') check('rain: the upper sky stays a dim olive grey', air.skyHigh.g > air.skyHigh.r && air.skyHigh.r > air.skyHigh.b && air.skyHigh.g < 0.4, air.skyHigh);
        check(`no page errors (world ${theme})`, browser.errors.length === 0, browser.errors.join(' | ').slice(0, 400));
      } finally { await browser.close(); }
    }
  },
};
