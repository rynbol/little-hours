import { AdditiveBlending, BoxGeometry, CapsuleGeometry, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Euler, Group, IcosahedronGeometry, Mesh, MeshBasicMaterial, PointLight, Quaternion, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { part, merge } from './shapes.js';

const C = Object.freeze({
  wood: '#8a5f3c', woodDark: '#5e3f2a', plank: '#b0814f', canvas: '#e9dcc0', wool: '#b65a42', woolLight: '#e2b46a', iron: '#4b4744', brass: '#d6a94a',
  stone: '#b9ab96', stoneDark: '#8e826f', stoneWarm: '#c9ad8a', moss: '#6f9a45', mossDark: '#4f7a35', bark: '#5f4532', barkLight: '#7a5a40',
  leaf: '#4e7f33', leafLight: '#7fab47', stripeA: '#d9644a', stripeB: '#f3e2bf', skin: '#e7b892', coat: '#5e7a9b', hat: '#7b4b2e', petal: '#f2a3b8', petalB: '#f6d36b', petalC: '#c9a6f0',
  dome: '#d8cdb8', glass: '#9cc9d6', pearl: '#f6f1e6', shell: '#d9b6a0', feather: '#b9764a', featherTip: '#3d2f28', soil: '#6b4a32',
});

const up = new Vector3(0, 1, 0);
const tiltFor = (dx, dy, dz) => new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(up, new Vector3(dx, dy, dz).normalize()));

function rod(from, to, radius, colour, sides = 6, shade) {
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2], tilt = tiltFor(dx, dy, dz);
  return part(new CylinderGeometry(radius, radius, Math.hypot(dx, dy, dz), sides), colour, { position: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2], rotation: [tilt.x, tilt.y, tilt.z], shade });
}

function place(parts, x, y, z, turn = 0) {
  const spin = new Euler(0, turn, 0), quat = new Quaternion().setFromEuler(spin);
  for (const geometry of parts) { geometry.applyQuaternion(quat); geometry.translate(x, y, z); }
  return parts;
}

const rough = seed => (x, y, z) => 0.86 + 0.14 * Math.sin(x * 3.1 + y * 2.3 + z * 1.7 + seed);

function camp(layout, ground) {
  const fire = layout.campfires[0], fx = fire.x, fz = fire.z, fy = ground(fx, fz);
  const parts = [
    ...[0, 1, 2].map(i => { const a = i / 3 * Math.PI * 2 + 0.4; return rod([fx + Math.sin(a) * 0.85, fy, fz + Math.cos(a) * 0.85], [fx, fy + 1.55, fz], 0.035, C.woodDark); }),
    rod([fx, fy + 1.55, fz], [fx, fy + 0.95, fz], 0.01, C.iron, 4),
    part(new SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65), C.iron, { position: [fx, fy + 1.05, fz], shade: (_, y) => 0.7 + (y - fy - 0.8) * 0.8 }),
    part(new TorusGeometry(0.2, 0.025, 6, 16), C.iron, { position: [fx, fy + 1.12, fz], rotation: [Math.PI / 2, 0, 0] }),
  ];
  const bx = fx + 2.6, bz = fz + 1.6, by = ground(bx, bz);
  parts.push(...place([
    part(new BoxGeometry(0.95, 0.09, 2), C.wool, { position: [0, 0.05, 0], shade: (_, __, z) => (Math.abs(Math.sin(z * 6)) > 0.8 ? 1.15 : 0.95) }),
    part(new CapsuleGeometry(0.17, 0.75, 4, 10), C.woolLight, { position: [0, 0.2, -0.9], rotation: [0, 0, Math.PI / 2] }),
    part(new BoxGeometry(0.8, 0.07, 0.9), C.canvas, { position: [0, 0.11, 0.45] }),
  ], bx, by, bz, 0.5));
  const lx = fx - 2.4, lz = fz + 0.8, ly = ground(lx, lz);
  parts.push(rod([lx, ly - 0.2, lz], [lx, ly + 1.7, lz], 0.04, C.woodDark), rod([lx, ly + 1.65, lz], [lx + 0.35, ly + 1.75, lz], 0.025, C.woodDark));
  const lantern = [lx + 0.35, ly + 1.45, lz];
  parts.push(
    part(new CylinderGeometry(0.1, 0.12, 0.05, 8), C.iron, { position: [lantern[0], lantern[1] - 0.14, lantern[2]] }),
    part(new ConeGeometry(0.13, 0.12, 8), C.iron, { position: [lantern[0], lantern[1] + 0.16, lantern[2]] }),
    ...[0, 1, 2, 3].map(i => rod([lantern[0] + Math.sin(i * 1.57) * 0.1, lantern[1] - 0.12, lantern[2] + Math.cos(i * 1.57) * 0.1], [lantern[0] + Math.sin(i * 1.57) * 0.1, lantern[1] + 0.12, lantern[2] + Math.cos(i * 1.57) * 0.1], 0.012, C.iron, 4)),
  );
  const sx = fx - 0.6, sz = fz - 2.2, sy = ground(sx, sz);
  parts.push(rod([sx - 1.1, sy + 0.25, sz], [sx + 1.1, sy + 0.25, sz + 0.2], 0.25, C.bark, 8), part(new CylinderGeometry(0.25, 0.25, 0.02, 8), C.plank, { position: [sx + 1.1, sy + 0.25, sz + 0.2], rotation: [0, 0, Math.PI / 2] }));
  const px = fx + 1.8, pz = fz - 1.5, py = ground(px, pz);
  parts.push(...place([
    part(new BoxGeometry(0.5, 0.6, 0.32), C.canvas, { position: [0, 0.3, 0], shade: (_, y) => 0.85 + y * 0.3 }),
    part(new CapsuleGeometry(0.14, 0.3, 4, 8), C.wool, { position: [0, 0.68, 0], rotation: [0, 0, Math.PI / 2] }),
    part(new BoxGeometry(0.36, 0.22, 0.08), C.wood, { position: [0, 0.25, 0.19] }),
  ], px, py, pz, -0.7));
  return { parts, lantern };
}

function merchant(layout, ground) {
  const { x, z, facing } = layout.merchant, y = ground(x, z), parts = [];
  parts.push(...place([
    part(new BoxGeometry(2.2, 0.12, 1.3), C.plank, { position: [0, 0.75, 0] }),
    part(new BoxGeometry(2.2, 0.55, 0.08), C.wood, { position: [0, 1.05, 0.62] }), part(new BoxGeometry(2.2, 0.55, 0.08), C.wood, { position: [0, 1.05, -0.62] }),
    part(new BoxGeometry(0.08, 0.55, 1.3), C.wood, { position: [1.08, 1.05, 0] }),
    ...[-1, 1].map(side => part(new TorusGeometry(0.42, 0.06, 6, 14), C.woodDark, { position: [0.2, 0.45, side * 0.72] })),
    ...[-1, 1].map(side => part(new CylinderGeometry(0.06, 0.06, 0.1, 6), C.iron, { position: [0.2, 0.45, side * 0.72], rotation: [Math.PI / 2, 0, 0] })),
    rod([-1.1, 0.8, 0.4], [-2.3, 0.4, 0.45], 0.04, C.woodDark), rod([-1.1, 0.8, -0.4], [-2.3, 0.4, -0.45], 0.04, C.woodDark),
    ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz]) => rod([sx * 1.02, 0.8, sz * 0.58], [sx * 1.02, 2.5, sz * 0.58], 0.035, C.woodDark)),
    ...Array.from({ length: 8 }, (_, i) => part(new BoxGeometry(0.29, 0.05, 1.6), i % 2 ? C.stripeA : C.stripeB, { position: [-1.02 + i * 0.29, 2.55 + Math.sin(i / 7 * Math.PI) * 0.12, 0], rotation: [0, 0, 0] })),
    part(new BoxGeometry(0.5, 0.4, 0.45), C.wood, { position: [0.6, 1.02, 0.1] }), part(new BoxGeometry(0.4, 0.3, 0.4), C.plank, { position: [0.1, 0.98, -0.2] }),
    ...[[-0.5, 0.25], [-0.2, 0.3], [-0.6, -0.25]].map(([px, pz], i) => part(new SphereGeometry(0.12, 8, 6), [C.petal, C.petalB, C.glass][i], { position: [px, 0.95, pz], scale: [1, 1.3, 1] })),
    part(new BoxGeometry(0.7, 0.5, 0.6), C.wood, { position: [1.6, 0.25, 0.9] }), part(new BoxGeometry(0.5, 0.4, 0.5), C.plank, { position: [1.7, 0.7, 0.85], rotation: [0, 0.4, 0] }),
    ...place([
      part(new CapsuleGeometry(0.3, 0.45, 4, 10), C.coat, { position: [0, 0.6, 0] }),
      part(new SphereGeometry(0.24, 12, 9), C.skin, { position: [0, 1.25, 0] }),
      part(new CylinderGeometry(0.42, 0.42, 0.04, 14), C.hat, { position: [0, 1.42, 0] }),
      part(new CylinderGeometry(0.2, 0.24, 0.26, 12), C.hat, { position: [0, 1.56, 0] }),
      part(new SphereGeometry(0.18, 8, 6), '#f0e6d6', { position: [0, 1.12, 0.14], scale: [1.1, 0.8, 0.6] }),
    ], 1.4, 0, -0.9),
  ], x, y, z, facing));
  return parts;
}

function greatOak(layout, ground) {
  const { oak, swing } = layout, base = ground(oak.x + oak.flare + 0.6, oak.z), parts = [];
  parts.push(part(new CylinderGeometry(oak.trunk + 0.15, oak.trunk + 0.55, oak.fork - base + 0.3, 14, 6), C.bark, { position: [oak.x, (oak.fork + base) / 2 - 0.15, oak.z], shade: (x, y, z) => 0.8 + 0.25 * Math.abs(Math.sin(Math.atan2(x - oak.x, z - oak.z) * 7 + y * 0.15)) }));
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2 + 0.3;
    parts.push(rod([oak.x + Math.sin(a) * 0.8, base + 2.4, oak.z + Math.cos(a) * 0.8], [oak.x + Math.sin(a) * (oak.flare + 0.9), base - 0.4, oak.z + Math.cos(a) * (oak.flare + 0.9)], 0.45, C.bark, 7));
  }
  const toward = Math.atan2(swing.x - oak.x, swing.z - oak.z), arm = [oak.x + Math.sin(toward) * 9.2, ground(swing.x, swing.z) + swing.height + 0.25, oak.z + Math.cos(toward) * 9.2];
  parts.push(rod([oak.x + Math.sin(toward) * 1.2, oak.fork - 9, oak.z + Math.cos(toward) * 1.2], arm, 0.42, C.barkLight, 8));
  const limbs = [[0.4, 31, 9], [2.2, 30, 10], [3.9, 31, 9], [5.3, 30.5, 8.5]].map(([a, top, reach]) => [oak.x + Math.sin(a) * reach, top, oak.z + Math.cos(a) * reach]);
  for (const limb of limbs) parts.push(rod([oak.x, oak.fork - 0.5, oak.z], limb, 0.55, C.bark, 8));
  const crown = [[0, 33.5, 0, 7.5], [7.5, 31.5, 2, 5.6], [-6.5, 32, 3, 5.8], [2, 32.5, -7.5, 5.8], [-3, 31.5, -6, 5.2], [4, 36, 3, 5], [-3, 36.5, 1.5, 5], [6.8, 30, -5.5, 4.4], [-7, 30.5, -3, 4.2], [0.5, 30, 7.8, 4.6]];
  parts.push(...crown.map(([dx, y, dz, r], i) => part(new IcosahedronGeometry(r, 2), i % 3 === 1 ? C.leafLight : C.leaf, { position: [oak.x + dx, y, oak.z + dz], scale: [1, 0.72, 1], rotation: [i, i * 2, 0], shade: (_, yy) => 0.76 + Math.min(1, Math.max(0, (yy - 26) / 14)) * 0.4 })));
  const sy = ground(swing.x, swing.z), seatY = sy + 0.55;
  const ropes = [-0.32, 0.32].map(offset => [Math.cos(swing.facing) * offset, Math.sin(swing.facing) * -offset]);
  const swingParts = [
    ...ropes.map(([ox, oz]) => rod([ox, 0, oz], [ox, -(arm[1] - seatY), oz], 0.018, C.canvas, 4)),
    part(new BoxGeometry(0.8, 0.06, 0.32), C.plank, { position: [0, -(arm[1] - seatY), 0], rotation: [0, -swing.facing + Math.PI / 2, 0] }),
  ];
  return { parts, swing: { at: arm, geometry: merge(swingParts) } };
}

function hollowLog(layout) {
  const { hollow } = layout, dx = hollow.crown.x - hollow.root.x, dz = hollow.crown.z - hollow.root.z, length = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
  const mid = [(hollow.root.x + hollow.crown.x) / 2, (hollow.floor[0] + hollow.floor[1]) / 2 + 1.25, (hollow.root.z + hollow.crown.z) / 2];
  const pitch = Math.atan2(hollow.floor[0] - hollow.floor[1], length);
  const shell = new CylinderGeometry(hollow.radius + 0.38, hollow.radius + 0.38, length, 20, 8, true, 0.55, Math.PI * 2 - 1.1);
  const inner = new CylinderGeometry(hollow.radius, hollow.radius, length, 20, 8, true, 0.55, Math.PI * 2 - 1.1);
  inner.scale(-1, 1, 1);
  const lay = geometry => geometry.rotateX(-Math.PI / 2), orient = geometry => geometry.rotateX(pitch).rotateY(yaw).translate(...mid);
  const parts = [
    orient(lay(part(shell, C.bark, { shade: (x, _, z) => 0.8 + 0.2 * Math.abs(Math.sin(x * 2.1 + z * 1.3)) }))),
    orient(lay(part(inner, '#7d5a3e', { shade: () => 0.75 }))),
    orient(part(new BoxGeometry(hollow.radius * 1.7, 0.25, length), '#6e4c33', { position: [0, -1.38, 0] })),
    ...Array.from({ length: 9 }, (_, i) => orient(part(new SphereGeometry(0.6 + (i % 3) * 0.2, 8, 6), i % 2 ? C.moss : C.mossDark, { position: [Math.sin(i * 2.1) * 1.2, 1.9, -length / 2 + 1 + i * (length - 2) / 8], scale: [1.4, 0.45, 1.6] }))),
  ];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    parts.push(rod([hollow.root.x, mid[1] + Math.cos(a) * 1.5, hollow.root.z], [hollow.root.x - Math.sin(yaw) * 1.4 + Math.sin(a + yaw) * 2.6, mid[1] - 1.8 + Math.cos(a) * 2.8, hollow.root.z - Math.cos(yaw) * 1.4 + Math.cos(a + yaw) * 2.6], 0.32, C.barkLight, 6));
  }
  parts.push(rod([hollow.crown.x, mid[1] - 0.2, hollow.crown.z], [hollow.crown.x + 2.2, mid[1] + 2.6, hollow.crown.z - 2.5], 0.35, C.bark), rod([hollow.crown.x, mid[1] - 0.4, hollow.crown.z], [hollow.crown.x - 2.6, mid[1] + 1.4, hollow.crown.z - 2], 0.28, C.bark));
  return parts;
}

function stoneBridge(layout, ground) {
  const { bridge } = layout, parts = [], slab = (from, to, fromY, toY) => {
    const length = Math.abs(to - from), pitch = Math.atan2(toY - fromY, from - to);
    parts.push(part(new BoxGeometry(bridge.width + 0.5, 0.55, length), C.stone, { position: [bridge.x, (fromY + toY) / 2 - 0.28, (from + to) / 2], rotation: [pitch, 0, 0], shade: rough(1) }));
    for (const side of [-1, 1]) parts.push(part(new BoxGeometry(0.34, bridge.rail + 0.1, length), C.stoneDark, { position: [bridge.x + side * (bridge.width / 2 + 0.12), (fromY + toY) / 2 + bridge.rail / 2, (from + to) / 2], rotation: [pitch, 0, 0], shade: rough(2) }));
  };
  slab(bridge.from, bridge.gap[0], 5.45, bridge.deck);
  slab(bridge.gap[1], bridge.end, bridge.deck, bridge.deck);
  slab(bridge.end, bridge.to, bridge.deck, bridge.foot);
  for (const pier of [bridge.from + 3.5, bridge.gap[0] - 0.2, bridge.gap[1] + 0.2]) {
    const bed = ground(bridge.x, pier) - 0.6;
    parts.push(part(new BoxGeometry(bridge.width + 0.7, bridge.deck - bed, 1.1), C.stoneWarm, { position: [bridge.x, (bridge.deck + bed) / 2 - 0.5, pier], shade: rough(3) }));
  }
  for (const [z, s] of [[bridge.gap[0] + 0.3, 1], [bridge.gap[1] - 0.3, -1]]) for (let i = 0; i < 4; i++) parts.push(part(new DodecahedronGeometry(0.28 + (i % 2) * 0.1, 0), C.stone, { position: [bridge.x + (i - 1.5) * 0.55, bridge.deck - 0.2 - i * 0.05, z + s * 0.1 * i], rotation: [i, i * 2, 0] }));
  for (let i = 0; i < 6; i++) { const rz = (bridge.gap[0] + bridge.gap[1]) / 2 + (i - 2.5) * 0.8; parts.push(part(new DodecahedronGeometry(0.35, 0), C.stoneDark, { position: [bridge.x + Math.sin(i * 1.9) * 1.1, ground(bridge.x, rz) + 0.1, rz], rotation: [i, i, 0] })); }
  const [ax, az, bx, bz] = bridge.log, logTop = bridge.deck + 0.15;
  parts.push(rod([ax, logTop - 0.36, az - 0.6], [bx, logTop - 0.36, bz + 0.6], 0.36, C.bark, 9, (_, __, z) => 0.8 + 0.2 * Math.abs(Math.sin(z * 3.3))));
  return parts;
}

function shrine(layout, ground) {
  const { x, z } = layout.shrine, y = ground(x, z), parts = [];
  const stack = [[0.9, 0.42], [0.72, 0.38], [0.58, 0.34], [0.44, 0.3], [0.3, 0.26]];
  let top = y;
  stack.forEach(([r, h], i) => { parts.push(part(new SphereGeometry(r, 10, 7), i % 2 ? C.stoneWarm : C.stone, { position: [x + Math.sin(i * 1.3) * 0.06, top + h / 2, z], scale: [1, h / r * 0.62, 0.92], rotation: [0, i, 0], shade: rough(i) })); top += h * 0.82; });
  parts.push(part(new SphereGeometry(0.42, 10, 7), C.moss, { position: [x, y + 0.15, z], scale: [2.2, 0.35, 2.2] }));
  const flowers = [C.petal, C.petalB, C.petalC, C.stripeB];
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + 0.2, r = 1.05 + (i % 2) * 0.25, fx = x + Math.sin(a) * r, fz = z + Math.cos(a) * r, fy = ground(fx, fz);
    parts.push(rod([fx, fy, fz], [fx, fy + 0.28, fz], 0.012, C.leaf, 3), part(new SphereGeometry(0.07, 6, 4), flowers[i % 4], { position: [fx, fy + 0.3, fz], scale: [1.3, 0.6, 1.3] }));
  }
  parts.push(part(new CylinderGeometry(0.16, 0.18, 0.12, 10), C.canvas, { position: [x + 0.6, y + 0.06, z + 0.75] }), part(new SphereGeometry(0.1, 8, 6), C.petalB, { position: [x + 0.6, y + 0.18, z + 0.75] }));
  return parts;
}

function tower(layout, ground) {
  const { tower } = layout, base = ground(tower.x + tower.radius + 1.5, tower.z), top = ground(tower.x, tower.z), parts = [];
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, height = 0.6 + (i % 3 === 0 ? 1.4 : 0) + Math.abs(Math.sin(i * 2.7)) * 0.9;
    if (i === 7 || i === 8) continue;
    parts.push(part(new BoxGeometry(1.5, height, 0.55), C.stone, { position: [tower.x + Math.sin(a) * (tower.radius - 0.2), top + height / 2, tower.z + Math.cos(a) * (tower.radius - 0.2)], rotation: [0, a, 0], shade: rough(i) }));
  }
  const door = Math.atan2(-tower.x, -tower.z - 140);
  parts.push(part(new BoxGeometry(1.6, 2.4, 0.4), '#3d342c', { position: [tower.x + Math.sin(door) * (tower.radius + 0.05), base + 1.2, tower.z + Math.cos(door) * (tower.radius + 0.05)], rotation: [0, door, 0] }));
  parts.push(part(new TorusGeometry(0.8, 0.2, 6, 12, Math.PI), C.stoneDark, { position: [tower.x + Math.sin(door) * (tower.radius + 0.1), base + 2.4, tower.z + Math.cos(door) * (tower.radius + 0.1)], rotation: [0, door, 0] }));
  for (let i = 0; i < 14; i++) { const a = i * 0.9; parts.push(part(new SphereGeometry(0.5, 6, 5), i % 2 ? C.moss : C.mossDark, { position: [tower.x + Math.sin(a) * (tower.radius + 0.15), base + 1 + (i * 0.73) % 9, tower.z + Math.cos(a) * (tower.radius + 0.15)], scale: [1, 1.6, 0.4], rotation: [0, a, 0] })); }
  return parts;
}

function observatory(layout, ground) {
  const { observatory: ob } = layout, y = ground(ob.x, ob.z) - 2, r = ob.radius, parts = [];
  parts.push(part(new CylinderGeometry(r, r * 1.08, r * 0.9, 24, 1), C.stone, { position: [ob.x, y + r * 0.45, ob.z], shade: rough(5) }));
  parts.push(part(new SphereGeometry(r * 0.98, 24, 12, 0.6, Math.PI * 2 - 1.3, 0, Math.PI / 2), C.dome, { position: [ob.x, y + r * 0.9, ob.z] }));
  parts.push(part(new BoxGeometry(r * 0.3, r * 1.4, r * 0.3), C.stoneDark, { position: [ob.x + r * 0.9, y + r * 0.7, ob.z + r * 0.3], shade: rough(6) }));
  parts.push(rod([ob.x, y + r * 1.2, ob.z], [ob.x + r * 0.5, y + r * 1.9, ob.z + r * 0.2], r * 0.12, C.brass, 10));
  return parts;
}

function lakeside(layout, ground) {
  const { islet, rocks } = layout, parts = [], iy = ground(islet.x, islet.z);
  parts.push(part(new DodecahedronGeometry(1.1, 0), C.stoneDark, { position: [islet.x - 1.6, iy + 0.2, islet.z + 1.2], scale: [1.3, 0.6, 1], rotation: [1, 2, 0] }));
  for (let i = 0; i < 14; i++) { const a = i * 0.8, rx = islet.x + Math.sin(a) * 2.6, rz = islet.z + Math.cos(a) * 2.6; parts.push(rod([rx, ground(rx, rz) - 0.2, rz], [rx + 0.1, ground(rx, rz) + 1.1 + (i % 3) * 0.3, rz], 0.03, '#8aa451', 3)); }
  const tor = rocks[1], ty = ground(tor.x, tor.z);
  parts.push(rod([tor.x + 0.5, ty, tor.z], [tor.x + 0.5, ty + 1.4, tor.z], 0.05, C.woodDark), ...[0, 1, 2].map(i => part(new DodecahedronGeometry(0.35 - i * 0.08, 0), C.stone, { position: [tor.x + 0.5, ty + 0.15 + i * 0.32, tor.z], rotation: [i, i, 0] })));
  return parts;
}

export function buildLandmarks(layout, ground, painterly) {
  const root = new Group(), material = painterly.material('#ffffff', { vertexColors: true });
  root.name = 'wilds-landmarks';
  const campParts = camp(layout, ground), oak = greatOak(layout, ground);
  const statics = new Mesh(merge([...campParts.parts, ...merchant(layout, ground), ...oak.parts, ...hollowLog(layout), ...stoneBridge(layout, ground), ...shrine(layout, ground), ...tower(layout, ground), ...lakeside(layout, ground)]), material);
  statics.castShadow = true; statics.receiveShadow = true; statics.name = 'wilds-landmark-statics';
  const far = new Mesh(merge(observatory(layout, ground)), material);
  far.name = 'wilds-observatory';
  const swing = new Mesh(oak.swing.geometry, material);
  swing.position.set(...oak.swing.at); swing.castShadow = true; swing.name = 'wilds-swing';
  const glass = new Mesh(new SphereGeometry(0.09, 10, 8), new MeshBasicMaterial({ color: '#ffd18a' }));
  glass.position.set(...campParts.lantern);
  const halo = new Mesh(new SphereGeometry(0.32, 12, 8), new MeshBasicMaterial({ color: '#ffb565', transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false }));
  halo.position.copy(glass.position);
  const lamp = new PointLight('#ffb565', 0, 9, 1.8);
  lamp.position.copy(glass.position);
  root.add(statics, far, swing, glass, halo, lamp);
  return {
    root,
    update(seconds, night, still) {
      swing.rotation.set(still ? 0 : Math.sin(seconds * 0.9) * 0.05, 0, 0);
      halo.material.opacity = 0.15 + night * 0.35;
      lamp.intensity = night * 6;
      halo.visible = night > 0.05;
    },
  };
}

export function buildSecrets(sim, painterly) {
  const root = new Group(), material = painterly.material('#ffffff', { vertexColors: true }), views = new Map();
  root.name = 'wilds-secrets';
  const glowMaterial = colour => new MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.4, blending: AdditiveBlending, depthWrite: false });
  const make = (id, parts, glow) => {
    const spot = sim.secrets.find(entry => entry.id === id), group = new Group(), mesh = new Mesh(merge(parts), material);
    mesh.castShadow = true; group.add(mesh);
    let halo = null;
    if (glow) { halo = new Mesh(new SphereGeometry(glow.size, 12, 8), glowMaterial(glow.colour)); halo.position.set(0, glow.y, 0); group.add(halo); }
    group.position.set(spot.x, spot.y, spot.z); group.name = `wilds-secret-${id}`;
    root.add(group); views.set(id, { group, halo, spot, mesh });
  };
  make('root-sword', [
    part(new BoxGeometry(0.07, 0.9, 0.02), '#cfd6d4', { position: [0, 0.55, 0], rotation: [0.2, 0.4, 0.15] }),
    part(new BoxGeometry(0.32, 0.05, 0.06), C.brass, { position: [0.02, 1.02, -0.08], rotation: [0.2, 0.4, 0.15] }),
    part(new CylinderGeometry(0.03, 0.03, 0.24, 6), C.woodDark, { position: [0.03, 1.15, -0.11], rotation: [0.2, 0.4, 0.15] }),
    ...[0, 1, 2].map(i => rod([Math.sin(i * 2) * 0.5, 0.05, Math.cos(i * 2) * 0.5], [0, 0.45, 0], 0.07, C.barkLight, 5)),
  ], { colour: '#bfe7ff', size: 0.35, y: 0.7 });
  const seed = (colour, leaf) => [part(new SphereGeometry(0.16, 12, 9), colour, { position: [0, 0.5, 0], scale: [1, 1.25, 1] }), part(new ConeGeometry(0.06, 0.16, 6), leaf, { position: [0, 0.73, 0] }), part(new SphereGeometry(0.4, 8, 6), C.moss, { position: [0, 0.08, 0], scale: [1.2, 0.35, 1.2] })];
  make('stamina-seed', seed('#c9e86a', C.leafLight), { colour: '#d7ff7a', size: 0.5, y: 0.52 });
  make('heart-seed', seed('#ff7f8e', C.leaf), { colour: '#ff9aa8', size: 0.5, y: 0.52 });
  make('glide-chest', [
    part(new BoxGeometry(0.9, 0.5, 0.6), C.wood, { position: [0, 0.25, 0] }), part(new CylinderGeometry(0.3, 0.3, 0.9, 10, 1, false, 0, Math.PI), C.plank, { position: [0, 0.5, 0], rotation: [0, 0, Math.PI / 2] }),
    ...[-0.3, 0.3].map(x => part(new BoxGeometry(0.06, 0.82, 0.64), C.brass, { position: [x, 0.4, 0] })), part(new BoxGeometry(0.12, 0.14, 0.04), C.brass, { position: [0, 0.48, 0.31] }),
  ], { colour: '#ffe2a0', size: 0.6, y: 0.5 });
  make('buried-find', [part(new SphereGeometry(0.55, 10, 7), C.moss, { position: [0, 0.02, 0], scale: [1.3, 0.3, 1.1] }), ...[0, 1, 2, 3].map(i => part(new SphereGeometry(0.06, 6, 4), C.petalC, { position: [Math.sin(i * 1.6) * 0.45, 0.12, Math.cos(i * 1.6) * 0.4] }))]);
  make('lake-pearl', [part(new SphereGeometry(0.28, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), C.shell, { position: [0, 0.05, 0], scale: [1, 0.5, 1] }), part(new SphereGeometry(0.28, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), C.shell, { position: [0, 0.12, -0.18], rotation: [-1.1, 0, 0], scale: [1, 0.5, 1] }), part(new SphereGeometry(0.09, 10, 8), C.pearl, { position: [0, 0.14, 0.02] })], { colour: '#fff6ee', size: 0.3, y: 0.18 });
  make('kestrel-feather', [part(new CylinderGeometry(0.008, 0.012, 0.5, 4), C.canvas, { position: [0.5, 1.6, 0], rotation: [0, 0, 0.3] }), part(new SphereGeometry(0.1, 8, 6), C.feather, { position: [0.45, 1.75, 0], scale: [0.35, 2.2, 0.08], rotation: [0, 0, 0.3] }), part(new SphereGeometry(0.05, 6, 4), C.featherTip, { position: [0.39, 1.95, 0], scale: [0.5, 1.4, 0.2], rotation: [0, 0, 0.3] })], { colour: '#ffd8a8', size: 0.32, y: 1.75 });
  make('spyglass', [rod([0, 0, -0.2], [0, 1, 0], 0.03, C.woodDark), rod([0, 0, 0.2], [0, 1, 0], 0.03, C.woodDark), rod([0.2, 0, 0], [0, 1, 0], 0.03, C.woodDark), rod([-0.3, 1.05, -0.2], [0.35, 1.25, 0.25], 0.06, C.brass, 10), part(new CylinderGeometry(0.08, 0.08, 0.05, 10), C.glass, { position: [0.36, 1.26, 0.26], rotation: [1.2, 0.9, 0] })], { colour: '#ffe9b0', size: 0.35, y: 1.15 });
  const hole = new Mesh(merge([part(new CylinderGeometry(0.45, 0.3, 0.1, 12), C.soil, { position: [0, 0.02, 0] }), ...[0, 1, 2, 3, 4].map(i => part(new SphereGeometry(0.15, 6, 4), C.soil, { position: [Math.sin(i * 1.3) * 0.62, 0.05, Math.cos(i * 1.3) * 0.62], scale: [1, 0.5, 1] })), part(new TorusGeometry(0.06, 0.018, 5, 10), C.brass, { position: [0.05, 0.12, 0], rotation: [1.2, 0, 0] }), part(new BoxGeometry(0.03, 0.03, 0.2), C.brass, { position: [0.05, 0.12, 0.13] })]), material);
  const buried = views.get('buried-find');
  hole.visible = false; buried.group.add(hole);
  return {
    root,
    update(seconds, still) {
      for (const [id, view] of views) {
        const { spot } = view;
        view.group.visible = !spot.found;
        if (id === 'buried-find') { view.mesh.visible = !spot.dug; hole.visible = spot.dug; }
        if (view.halo) { const pulse = still ? 1 : 1 + Math.sin(seconds * 2.4 + spot.x) * 0.12; view.halo.scale.setScalar(pulse); }
        if ((id === 'stamina-seed' || id === 'heart-seed') && !still) view.mesh.rotation.y = seconds * 0.6;
      }
    },
  };
}

