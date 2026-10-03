import { CylinderGeometry, Group, LatheGeometry, Mesh, SphereGeometry, TorusGeometry, ConeGeometry, Vector2 } from 'three';
import { DUMMY, POST } from '../../core/wilds/sim.js';
import { part, merge } from './shapes.js';

const WOOD = Object.freeze({ post: '#8a6444', cap: '#6d4d34', rope: '#cdb486', stone: '#9c968a', straw: '#e2bf6a', strawDeep: '#bf9446', burlap: '#c9a77a', stake: '#6b4b31' });
const grain = (x, y, z) => 0.86 + 0.14 * Math.sin(Math.atan2(z, x) * 7 + y * 2.3) * Math.sin(y * 9.1 + x * 3);
const strands = (x, y, z) => 0.8 + 0.22 * Math.abs(Math.sin(Math.atan2(z, x) * 13 + y * 4.1)) + 0.06 * Math.sin(y * 37);

function post(x, y, z, spin) {
  const r = POST.radius, h = POST.height, flat = [Math.PI / 2, 0, 0];
  return [
    part(new CylinderGeometry(r * 0.92, r, h - 0.05, 9, 3), WOOD.post, { position: [x, y + (h - 0.05) / 2 - 0.04, z], rotation: [0, spin, 0], shade: grain }),
    part(new ConeGeometry(r * 0.92, 0.12, 9), WOOD.cap, { position: [x, y + h - 0.03, z], rotation: [0, spin, 0], shade: grain }),
    part(new TorusGeometry(r * 1.02, 0.028, 5, 12), WOOD.rope, { position: [x, y + h * 0.72, z], rotation: flat }),
    part(new TorusGeometry(r * 1.02, 0.028, 5, 12), WOOD.rope, { position: [x, y + h * 0.64, z], rotation: flat }),
    part(new SphereGeometry(0.22, 7, 4), WOOD.stone, { position: [x + 0.2, y + 0.02, z + 0.1], rotation: [0, spin, 0], scale: [1.2, 0.45, 0.9], shade: (_, py) => 0.85 + (py - y) * 0.4 }),
  ];
}

export function buildPosts(posts, material) {
  const parts = posts.flatMap((spot, i) => post(spot.x, spot.y, spot.z, i * 1.3));
  const mesh = new Mesh(merge(parts), material);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'wilds-posts';
  return mesh;
}

function dummyGeometry() {
  const body = [[0.04, 0.42], [0.2, 0.46], [0.28, 0.6], [0.3, 0.82], [0.27, 1.04], [0.2, 1.2], [0.06, 1.27]].map(([r, y]) => new Vector2(r, y));
  const arm = { position: [0, 1.12, 0], rotation: [0, 0, Math.PI / 2] };
  return merge([
    part(new CylinderGeometry(0.05, 0.065, 0.62, 7), WOOD.stake, { position: [0, 0.27, 0], shade: grain }),
    part(new LatheGeometry(body, 14), WOOD.straw, { shade: strands }),
    part(new TorusGeometry(0.29, 0.03, 5, 16), WOOD.rope, { position: [0, 0.66, 0], rotation: [Math.PI / 2, 0, 0] }),
    part(new TorusGeometry(0.27, 0.03, 5, 16), WOOD.rope, { position: [0, 1.02, 0], rotation: [Math.PI / 2, 0, 0] }),
    part(new CylinderGeometry(0.04, 0.04, 1.12, 6), WOOD.stake, { ...arm, shade: grain }),
    part(new ConeGeometry(0.1, 0.24, 8), WOOD.strawDeep, { position: [0.62, 1.12, 0], rotation: [0, 0, -Math.PI / 2], shade: strands }),
    part(new ConeGeometry(0.1, 0.24, 8), WOOD.strawDeep, { position: [-0.62, 1.12, 0], rotation: [0, 0, Math.PI / 2], shade: strands }),
    part(new TorusGeometry(0.055, 0.02, 4, 8), WOOD.rope, { position: [0.5, 1.12, 0], rotation: [0, Math.PI / 2, 0] }),
    part(new TorusGeometry(0.055, 0.02, 4, 8), WOOD.rope, { position: [-0.5, 1.12, 0], rotation: [0, Math.PI / 2, 0] }),
    part(new CylinderGeometry(0.07, 0.09, 0.1, 8), WOOD.rope, { position: [0, 1.29, 0] }),
    part(new SphereGeometry(0.19, 12, 9), WOOD.burlap, { position: [0, 1.45, 0], scale: [1, 1.08, 0.95], shade: (x, y, z) => 0.88 + 0.12 * Math.sin(x * 60) * Math.sin(y * 60) + (z > 0 ? 0.04 : 0) }),
    part(new ConeGeometry(0.07, 0.12, 6), WOOD.straw, { position: [0, 1.66, 0], shade: strands }),
  ]);
}

export function buildDummy(dummy, painterly) {
  const glow = { value: 0 }, root = new Group(), material = painterly.material('#ffffff', { vertexColors: true, glow });
  const mesh = new Mesh(dummyGeometry(), material);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.rotation.y = 0.35;
  root.add(mesh);
  root.position.set(dummy.x, dummy.y - 0.04, dummy.z);
  root.name = 'wilds-dummy';
  return {
    root, height: DUMMY.height,
    update(state, still) {
      root.rotation.x = state.tiltZ; root.rotation.z = -state.tiltX;
      glow.value = still ? Math.min(0.25, state.hurt * 0.25) : state.hurt * 0.55;
      const broken = state.broken > 0;
      mesh.scale.setScalar(broken ? 0.94 : 1);
    },
  };
}
