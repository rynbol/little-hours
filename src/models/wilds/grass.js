import { Color, Group, InstancedMesh, Matrix4, Quaternion, Sphere, Vector3 } from 'three';
import { fbm, noise2, smooth } from '../../core/world-terrain.js';
import { groundColour, swayTufts, tuftGeometry } from './terrain.js';

export const GRASS = Object.freeze({ chunk: 16, reach: 2, spacing: 0.55, outer: 0.45, fills: 2 });

const rank = (x, z) => ((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1 + 1) % 1;

export function grassSpots(cx, cz, keep) {
  const { chunk, spacing } = GRASS, x0 = cx * chunk, z0 = cz * chunk, spots = [];
  for (let x = x0; x < x0 + chunk; x += spacing) for (let z = z0; z < z0 + chunk; z += spacing) {
    const jx = x + (noise2(x * 3.1, z * 3.1, 81) - 0.5) * spacing * 1.6, jz = z + (noise2(x * 2.7, z * 2.9, 82) - 0.5) * spacing * 1.6;
    if (noise2(jx * 1.7, jz * 1.7, 83) < 0.5 + 0.45 * smooth(-0.2, 0.3, fbm(jx / 9, jz / 9, 2, 84)) && keep(jx, jz)) spots.push([jx, jz, rank(jx, jz)]);
  }
  return Float32Array.from(spots.sort((a, b) => a[2] - b[2]).flatMap(([x, z]) => [x, z]));
}

export function buildGrass(ground, material, { keep, wind }) {
  const { chunk, reach } = GRASS, side = reach * 2 + 1, capacity = Math.ceil(chunk / GRASS.spacing) ** 2;
  swayTufts(material, wind, (reach + 0.5) * chunk);
  const geometry = tuftGeometry(), root = new Group(), cache = new Map(), queue = [];
  const matrix = new Matrix4(), turn = new Quaternion(), up = new Vector3(0, 1, 0), at = new Vector3(), size = new Vector3(), colour = new Color();
  root.name = 'wilds-grass';
  const slots = Array.from({ length: side * side }, (_, i) => {
    const mesh = new InstancedMesh(geometry, material, capacity);
    mesh.count = 0; mesh.receiveShadow = true; mesh.name = `wilds-grass-${i}`;
    mesh.setColorAt(0, colour.set(1, 1, 1));
    mesh.boundingSphere = new Sphere(new Vector3(), chunk * 0.75);
    root.add(mesh);
    return { mesh, key: null, size: 0, share: 1 };
  });
  let centre = null;

  function fill(slot, cx, cz) {
    const key = `${cx},${cz}`, spots = cache.get(key) ?? grassSpots(cx, cz, keep);
    cache.set(key, spots);
    const { mesh } = slot, count = spots.length / 2;
    for (let i = 0; i < count; i++) {
      const x = spots[i * 2], z = spots[i * 2 + 1], s = 0.75 + noise2(x * 5.3, z * 5.3, 85) * 0.7;
      turn.setFromAxisAngle(up, noise2(x * 4.1, z * 4.7, 86) * Math.PI * 2);
      mesh.setMatrixAt(i, matrix.compose(at.set(x, ground(x, z) - 0.02, z), turn, size.set(s, s * (0.8 + noise2(x * 6.1, z * 6.3, 87) * 0.6), s)));
      mesh.setColorAt(i, groundColour(x, z, 0, 0, colour));
    }
    mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
    const mx = (cx + 0.5) * chunk, mz = (cz + 0.5) * chunk;
    mesh.boundingSphere.center.set(mx, ground(mx, mz), mz);
    slot.key = key; slot.size = count;
    mesh.count = Math.floor(count * slot.share);
  }

  return {
    root,
    get chunks() { return slots.filter(slot => slot.key).length; },
    get tufts() { return slots.reduce((sum, slot) => sum + slot.mesh.count, 0); },
    update(x, z, budget = GRASS.fills) {
      const cx = Math.floor(x / chunk), cz = Math.floor(z / chunk), key = `${cx},${cz}`;
      if (key !== centre) {
        centre = key;
        const wanted = new Map();
        for (let dx = -reach; dx <= reach; dx++) for (let dz = -reach; dz <= reach; dz++) wanted.set(`${cx + dx},${cz + dz}`, [cx + dx, cz + dz, Math.max(Math.abs(dx), Math.abs(dz))]);
        for (const slot of slots) {
          const want = slot.key && wanted.get(slot.key);
          if (!want) { slot.key = null; slot.mesh.count = 0; continue; }
          slot.share = want[2] < reach ? 1 : GRASS.outer;
          slot.mesh.count = Math.floor(slot.size * slot.share);
          wanted.delete(slot.key);
        }
        queue.length = 0;
        queue.push(...[...wanted.values()].sort((a, b) => a[2] - b[2]));
      }
      for (let done = 0; queue.length && done < budget; done++) {
        const [qx, qz, ring] = queue.shift(), slot = slots.find(entry => !entry.key);
        slot.share = ring < reach ? 1 : GRASS.outer;
        fill(slot, qx, qz);
      }
    },
  };
}
