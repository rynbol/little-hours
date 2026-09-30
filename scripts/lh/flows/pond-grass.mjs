import { steps } from '../steps.mjs';

const measure = `(() => {
  const scene = window.__littleHours.lake.diagnostics().scene, mesh = scene.getMeshByName('lake-scenery');
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
  const m = scene.getTransformMatrix().m;
  const bounds = parts => {
    const box = { left: 1, right: -1, top: -1, bottom: 1 };
    for (const part of parts.filter(Boolean)) {
      const q = part.getVerticesData('position');
      for (let i = 0; i < q.length; i += 3) {
        const x = q[i], y = q[i + 1], z = q[i + 2], w = x * m[3] + y * m[7] + z * m[11] + m[15];
        const sx = (x * m[0] + y * m[4] + z * m[8] + m[12]) / w, sy = (x * m[1] + y * m[5] + z * m[9] + m[13]) / w;
        box.left = Math.min(box.left, sx); box.right = Math.max(box.right, sx); box.bottom = Math.min(box.bottom, sy); box.top = Math.max(box.top, sy);
      }
    }
    return box;
  };
  const arch = scene.getMeshByName('lake-exit'), screen = bounds([mesh, arch]), core = bounds([scene.getMeshByName('lake-water')]), exit = bounds([arch]);
  const tag = document.getElementById('lake-exit'), rect = tag.getBoundingClientRect();
  return { triangles, longest, colorSlope, steepest, batches: scene.meshes.filter(m => m.name === 'lake-scenery').length, overflow: document.documentElement.scrollWidth > innerWidth, orthographic: scene.activeCamera.mode === 1, screen, core, exit: arch ? exit : null, house: Boolean(scene.getMeshByName('lake-house')), tag: { hidden: tag.hidden, left: parseFloat(tag.style.left), top: parseFloat(tag.style.top), rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }, label: tag.textContent.trim() }, view: { width: innerWidth, height: innerHeight }, meshes: scene.meshes.filter(m => m.isEnabled() && m.getTotalIndices()).map(m => [m.name, m.getTotalIndices() / 3]).sort((a, b) => b[1] - a[1]).slice(0, 8) };
})()`;

export default {
  about: "the pond diorama: smooth meadow shading, a continuous shoreline, the whole plot framed by an orthographic camera on desktop and the pond framed large on a phone, no house, and a rose-arch exit whose label walks back to the island like the back button",
  async run(t) {
    for (const [seed, theme, width, height] of [['pond', 'dusk', 1440, 1000], ['pond', 'day', 390, 844], ['pond', 'rain', 1440, 1000], ['one-room', 'dusk', 390, 844]]) {
      const app = await t.open({ seed, theme, width, height, reducedMotion: true });
      await steps.openLake(app);
      const ground = await app.js(measure), { screen, core, exit, tag, view } = ground, label = `${seed} ${theme} ${width}x${height}`;
      t.check(`${label}: foreground grass has no stretched triangles or radial color streaks`, ground.triangles > 200 && ground.longest < 1.55 && ground.colorSlope < .05, ground);
      t.check(`${label}: meadow stays in one scenery batch without page overflow`, ground.batches === 1 && !ground.overflow, ground);
      const inside = box => box.left > -1 && box.right < 1 && box.bottom > -1 && box.top < 1, portrait = height > width;
      t.check(`${label}: an orthographic camera keeps the ${portrait ? 'pond and the exit arch' : 'whole plot and the exit arch'} on screen`, ground.orthographic && Boolean(exit) && inside(exit) && inside(portrait ? core : screen), ground);
      t.check(`${label}: the ${portrait ? 'pond fills' : 'plot fills'} the frame`, portrait ? core.right - core.left > 1.7 : Math.max(screen.right - screen.left, screen.top - screen.bottom) > 1.6, ground);
      t.check(`${label}: the pond has no house, only the rose arch out`, !ground.house && Boolean(exit), ground);
      const archX = ((exit?.left + exit?.right) / 2 + 1) * view.width / 2, archTop = (1 - exit?.top) * view.height / 2;
      t.check(`${label}: an Island label stands on the arch, inside the page`, !tag.hidden && tag.label === 'Island' && Math.abs(tag.left - archX) < 40 && tag.top > archTop - 90 && tag.top < archTop + 20 && tag.rect.left >= 0 && tag.rect.right <= view.width && tag.rect.top >= 0, { tag, archX, archTop });
      await t.shot(app, `meadow-${seed}-${theme}-${width}`);
      await app.clickSel('#lake-exit'); await app.settle();
      const home = { lake: await app.visible('#lake-page'), island: await app.visible('#house-page'), focus: await app.js(`document.activeElement?.dataset.room ?? document.activeElement?.id ?? null`) };
      t.check(`${label}: the arch walks back to the island, landing where the back button does`, !home.lake && home.island && home.focus === 'pond', home);
      await t.close(app);
    }
  },
};
