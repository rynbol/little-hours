import { AdditiveBlending, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Group, Mesh, MeshBasicMaterial, PointLight, SphereGeometry } from 'three';
import { part, merge } from './shapes.js';

const EMBER = Object.freeze({ stone: '#9d958a', log: '#6e4a31', bark: '#4f3524', ash: '#5d5550', flame: '#ffb347', core: '#fff0b8', light: '#ffb565' });
const LIGHT = Object.freeze({ intensity: 14, distance: 11, reach: 26 });

function hearthGeometry(fires) {
  return merge(fires.flatMap(({ x, y, z }, f) => [
    ...Array.from({ length: 9 }, (_, i) => { const a = i / 9 * Math.PI * 2 + f; return part(new DodecahedronGeometry(0.15, 0), EMBER.stone, { position: [x + Math.sin(a) * 0.5, y + 0.05, z + Math.cos(a) * 0.5], rotation: [a, i, 0], scale: [1.2, 0.7, 1], shade: () => 0.85 + (i % 3) * 0.07 }); }),
    ...[0, 1, 2].map(i => { const a = i / 3 * Math.PI + f; return part(new CylinderGeometry(0.06, 0.07, 0.75, 6), i % 2 ? EMBER.log : EMBER.bark, { position: [x, y + 0.12, z], rotation: [Math.PI / 2 - 0.25, a, 0] }); }),
    part(new CylinderGeometry(0.32, 0.36, 0.04, 10), EMBER.ash, { position: [x, y + 0.02, z] }),
  ]));
}

export function buildCamp(campfires, painterly) {
  const root = new Group();
  root.name = 'wilds-camp';
  const hearths = new Mesh(hearthGeometry(campfires), painterly.material('#ffffff', { vertexColors: true }));
  hearths.receiveShadow = true; hearths.castShadow = true;
  const flameMaterial = new MeshBasicMaterial({ color: EMBER.flame, transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false });
  const coreMaterial = new MeshBasicMaterial({ color: EMBER.core, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false });
  const flames = campfires.map(fire => {
    const group = new Group(), outer = new Mesh(new ConeGeometry(0.24, 0.75, 8, 1, true), flameMaterial), inner = new Mesh(new ConeGeometry(0.12, 0.45, 8, 1, true), coreMaterial), glow = new Mesh(new SphereGeometry(0.28, 10, 6), coreMaterial);
    outer.position.y = 0.42; inner.position.y = 0.32; glow.position.y = 0.18; glow.scale.set(1, 0.5, 1);
    group.add(outer, inner, glow); group.position.set(fire.x, fire.y, fire.z); group.visible = false;
    return { group, outer, inner };
  });
  const light = new PointLight(EMBER.light, 0, LIGHT.distance, 1.6);
  root.add(hearths, light, ...flames.map(entry => entry.group));
  let clock = 0;
  return {
    root,
    update(fires, player, dt, still) {
      clock += still ? 0 : dt;
      let near = null, best = LIGHT.reach;
      fires.forEach((fire, i) => {
        const view = flames[i];
        view.group.visible = fire.lit;
        if (!fire.lit) return;
        const flicker = still ? 1 : 1 + Math.sin(clock * 13 + i) * 0.08 + Math.sin(clock * 21.7 + i * 2) * 0.05;
        view.outer.scale.set(1, flicker, 1); view.inner.scale.set(1, 2 - flicker, 1);
        view.outer.rotation.y = still ? 0 : clock * 1.3;
        const distance = Math.hypot(fire.x - player.x, fire.z - player.z);
        if (distance < best) { best = distance; near = fire; }
      });
      light.intensity = near ? LIGHT.intensity * (still ? 1 : 0.9 + Math.sin(clock * 17) * 0.1) : 0;
      if (near) light.position.set(near.x, near.y + 0.9, near.z);
    },
  };
}
