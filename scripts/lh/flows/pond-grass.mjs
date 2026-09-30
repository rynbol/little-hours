import { steps } from '../steps.mjs';

const measure = `(() => {
  const scene = window.__littleHours.lake.diagnostics().scene, mesh = scene.getMeshByName('lake-scenery'), house = scene.getMeshByName('lake-house');
  const p = mesh.getVerticesData('position'), c = mesh.getVerticesData('color'), indices = mesh.getIndices();
  let triangles = 0, longest = 0, colorSlope = 0, steepest = null;
  for (let i = 0; i < indices.length; i += 3) {
    const ids = indices.slice(i, i + 3);
    if (!ids.every(n => { const r = Math.hypot(p[n * 3] / 8.6, (p[n * 3 + 2] + 3.2) / 7.2); return p[n * 3 + 1] >= .145 && p[n * 3 + 1] <= .151 && r > 1.2 && r < 3; })) continue;
    triangles++;
    for (let j = 0; j < 3; j++) {
      const a = ids[j], b = ids[(j + 1) % 3], distance = Math.hypot(p[a * 3] - p[b * 3], p[a * 3 + 1] - p[b * 3 + 1], p[a * 3 + 2] - p[b * 3 + 2]);
      longest = Math.max(longest, distance);
      const slope = distance > .05 ? Math.max(...[0, 1, 2].map(channel => Math.abs(c[a * 4 + channel] - c[b * 4 + channel]) / distance)) : 0;
      if (slope > colorSlope) { colorSlope = slope; steepest = [p[a * 3], p[a * 3 + 2], p[b * 3], p[b * 3 + 2]].map(v => Math.round(v * 100) / 100); }
    }
  }
  const m = scene.getTransformMatrix().m, screen = { left: 1, right: -1, top: -1, bottom: 1 };
  for (const part of [mesh, house].filter(Boolean)) {
    const q = part.getVerticesData('position');
    for (let i = 0; i < q.length; i += 3) {
      const x = q[i], y = q[i + 1], z = q[i + 2], w = x * m[3] + y * m[7] + z * m[11] + m[15];
      const sx = (x * m[0] + y * m[4] + z * m[8] + m[12]) / w, sy = (x * m[1] + y * m[5] + z * m[9] + m[13]) / w;
      screen.left = Math.min(screen.left, sx); screen.right = Math.max(screen.right, sx); screen.bottom = Math.min(screen.bottom, sy); screen.top = Math.max(screen.top, sy);
    }
  }
  let home = null;
  if (house) {
    const q = house.getVerticesData('position'); let x0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < q.length; i += 3) { x0 = Math.min(x0, q[i]); x1 = Math.max(x1, q[i]); y1 = Math.max(y1, q[i + 1]); }
    home = { width: x1 - x0, top: y1 };
  }
  return { triangles, longest, colorSlope, steepest, batches: scene.meshes.filter(m => m.name === 'lake-scenery').length, overflow: document.documentElement.scrollWidth > innerWidth, orthographic: scene.activeCamera.mode === 1, screen, rooms: window.__littleHours.state.house.rooms.length, home, meshes: scene.meshes.filter(m => m.isEnabled() && m.getTotalIndices()).map(m => [m.name, m.getTotalIndices() / 3]).sort((a, b) => b[1] - a[1]).slice(0, 8) };
})()`;

export default {
  about: "the pond diorama: smooth meadow shading, a continuous shoreline, the whole plot framed by an orthographic camera at desktop and phone sizes, and the player's own house following the save",
  async run(t) {
    const homes = {};
    for (const [seed, theme, width, height] of [['pond', 'dusk', 1440, 1000], ['pond', 'day', 390, 844], ['pond', 'rain', 1440, 1000], ['one-room', 'dusk', 390, 844]]) {
      const app = await t.open({ seed, theme, width, height, reducedMotion: true });
      await steps.openLake(app);
      const ground = await app.js(measure), { screen } = ground, label = `${seed} ${theme} ${width}x${height}`;
      t.check(`${label}: foreground grass has no stretched triangles or radial color streaks`, ground.triangles > 200 && ground.longest < 1.55 && ground.colorSlope < .05, ground);
      t.check(`${label}: meadow stays in one scenery batch without page overflow`, ground.batches === 1 && !ground.overflow, ground);
      t.check(`${label}: an orthographic camera keeps the whole plot and house on screen`, ground.orthographic && screen.left > -1 && screen.right < 1 && screen.bottom > -1 && screen.top < 1, ground);
      t.check(`${label}: the plot fills the frame`, Math.max(screen.right - screen.left, screen.top - screen.bottom) > 1.6, ground);
      homes[seed] = ground;
      await t.shot(app, `meadow-${seed}-${theme}-${width}`);
      await app.clickSel('#lake-back'); await app.settle();
      t.check(`${label}: the island path remains usable`, !await app.visible('#lake-page') && await app.visible('#house-page'));
      await t.close(app);
    }
    const [three, one] = [homes.pond, homes['one-room']];
    t.check('the pond house follows the rooms in the save', three.rooms === 3 && one.rooms === 1 && Boolean(three.home && one.home) && three.home.width > one.home.width + 4 && three.home.top > one.home.top + 2, { three: three.home, one: one.home });
  },
};
