import { steps } from '../steps.mjs';

export default {
  about: 'smooth pond meadow shading, compact foreground triangles and a continuous shoreline across themes and phone sizes',
  async run(t) {
    for (const [theme, width, height] of [['dusk', 1012, 1044], ['day', 390, 844], ['rain', 1012, 1044]]) {
      const app = await t.open({ seed: 'pond', theme, width, height, reducedMotion: true });
      await steps.openLake(app);
      const ground = await app.js(`(() => {
        const scene = window.__littleHours.lake.diagnostics().scene, mesh = scene.getMeshByName('lake-scenery');
        const p = mesh.getVerticesData('position'), c = mesh.getVerticesData('color'), indices = mesh.getIndices();
        let triangles = 0, longest = 0, colorSlope = 0;
        for (let i = 0; i < indices.length; i += 3) {
          const ids = indices.slice(i, i + 3);
          if (!ids.every(n => { const r = Math.hypot(p[n * 3] / 8.6, (p[n * 3 + 2] + 3.2) / 7.2); return p[n * 3 + 1] >= .12 && p[n * 3 + 1] <= .151 && r > 1.2 && r < 3; })) continue;
          triangles++;
          for (let j = 0; j < 3; j++) {
            const a = ids[j], b = ids[(j + 1) % 3], distance = Math.hypot(p[a * 3] - p[b * 3], p[a * 3 + 1] - p[b * 3 + 1], p[a * 3 + 2] - p[b * 3 + 2]);
            longest = Math.max(longest, distance);
            if (distance > .05) colorSlope = Math.max(colorSlope, ...[0, 1, 2].map(channel => Math.abs(c[a * 4 + channel] - c[b * 4 + channel]) / distance));
          }
        }
        return { triangles, longest, colorSlope, batches: scene.meshes.filter(m => m.name === 'lake-scenery').length, overflow: document.documentElement.scrollWidth > innerWidth };
      })()`);
      t.check(`${theme}: foreground grass has no stretched triangles or radial color streaks`, ground.triangles > 200 && ground.longest < 1.55 && ground.colorSlope < .05, ground);
      t.check(`${theme}: meadow stays in one scenery batch without page overflow`, ground.batches === 1 && !ground.overflow, ground);
      await t.shot(app, `meadow-${theme}-${width}`);
      await app.clickSel('#lake-back'); await app.settle();
      t.check(`${theme}: the island path remains usable`, !await app.visible('#lake-page') && await app.visible('#house-page'));
      await t.close(app);
    }
  },
};
