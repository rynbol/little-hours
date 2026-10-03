import { AdditiveBlending, CatmullRomCurve3, CircleGeometry, Color, TubeGeometry, ConeGeometry, CylinderGeometry, DodecahedronGeometry, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, RingGeometry, SphereGeometry, Vector3, CapsuleGeometry, Euler } from 'three';
import { STAG, STAG_ATTACKS } from '../../core/wilds/stag.js';
import { part, merge } from './shapes.js';

const HIDE = Object.freeze({ coat: '#8b5d3f', belly: '#cfa77d', dark: '#4f3527', hoof: '#3b2a22', bone: '#ece2c8', moss: '#7fa253', eye: '#1d1715', stone: '#a49b8c', lichen: '#9bb071', heart: '#ffd37a', warn: '#ff9a5c', roots: '#6e4b33', rootTip: '#9bc463' });
const HIPS = Object.freeze([0, 1.35, -0.85]), SHOULDER = Object.freeze([0, 1.62, 0.95]);
const ROOT_MAX = 128;
const SPIRAL = Object.freeze({ dark: new Color('#5c554b'), lit: new Color('#c9ffa0'), rise: 1.4 });
const ease = s => { const t = Math.min(1, Math.max(0, s)); return t * t * (3 - 2 * t); };
const coatShade = (x, y, z) => 0.86 + (y < 1.25 ? 0.12 : 0) + Math.sin(z * 9 + x * 4) * 0.03;

function legs(at, length) {
  return at.map(([x, z]) => [
    part(new CylinderGeometry(0.11, 0.075, length, 7), HIDE.coat, { position: [x, length / 2 + 0.12, z], shade: coatShade }),
    part(new CylinderGeometry(0.085, 0.1, 0.14, 7), HIDE.hoof, { position: [x, 0.07, z] }),
  ]).flat();
}

function hindGeometry() {
  return merge([
    ...legs([[-0.3, -0.85], [0.3, -0.85]], 1.15),
    part(new SphereGeometry(0.42, 12, 8), HIDE.coat, { position: [0, 1.32, -0.92], scale: [1.05, 1, 1.1], shade: coatShade }),
  ]);
}

function bodyGeometry() {
  return merge([
    part(new CapsuleGeometry(0.6, 1.5, 8, 18), HIDE.coat, { position: [0, 1.42, 0.05], rotation: [Math.PI / 2, 0, 0], scale: [0.95, 1, 1.05], shade: coatShade }),
    part(new SphereGeometry(0.5, 12, 8), HIDE.belly, { position: [0, 1.18, 0.25], scale: [0.9, 0.55, 1.6] }),
    part(new SphereGeometry(0.3, 10, 6), HIDE.belly, { position: [0, 1.5, 1.05], scale: [1, 1.2, 0.8] }),
    ...legs([[-0.3, 0.85], [0.3, 0.85]], 1.15),
    part(new ConeGeometry(0.16, 0.36, 7), HIDE.belly, { position: [0, 1.62, -1.25], rotation: [-2.2, 0, 0] }),
  ].map(geometry => geometry.translate(-HIPS[0], -HIPS[1], -HIPS[2])));
}

function headGeometry() {
  return merge([
    part(new CylinderGeometry(0.22, 0.32, 0.95, 9), HIDE.coat, { position: [0, 0.38, 0.12], rotation: [0.55, 0, 0], shade: coatShade }),
    part(new SphereGeometry(0.27, 12, 9), HIDE.coat, { position: [0, 0.82, 0.38], scale: [0.85, 0.9, 1.05], shade: coatShade }),
    part(new ConeGeometry(0.18, 0.5, 9), HIDE.coat, { position: [0, 0.74, 0.74], rotation: [Math.PI / 2 + 0.25, 0, 0], shade: coatShade }),
    part(new SphereGeometry(0.075, 8, 6), HIDE.dark, { position: [0, 0.66, 0.97] }),
    ...[-1, 1].flatMap(side => [
      part(new SphereGeometry(0.045, 8, 6), HIDE.eye, { position: [side * 0.19, 0.88, 0.55] }),
      part(new ConeGeometry(0.08, 0.28, 6), HIDE.belly, { position: [side * 0.28, 1.0, 0.28], rotation: [0, 0, -side * 1.15] }),
    ]),
  ]);
}

function antlerGeometry() {
  const tines = [];
  for (const side of [-1, 1]) {
    const beam = [[0.12, 1.02, 0.3], [0.38, 1.42, 0.22], [0.62, 1.86, 0.08], [0.72, 2.3, -0.08]];
    for (let i = 1; i < beam.length; i++) {
      const [ax, ay, az] = beam[i - 1], [bx, by, bz] = beam[i], dx = (bx - ax) * side, dy = by - ay, dz = bz - az, length = Math.hypot(dx, dy, dz);
      const tilt = new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(dx, dy, dz).normalize()));
      tines.push(part(new CylinderGeometry(0.035 + (3 - i) * 0.012, 0.05 + (3 - i) * 0.014, length, 6), HIDE.bone, { position: [(ax + bx) / 2 * side, (ay + by) / 2, (az + bz) / 2], rotation: [tilt.x, tilt.y, tilt.z] }));
      tines.push(part(new ConeGeometry(0.04, 0.42, 5), HIDE.bone, { position: [bx * side + side * 0.06, by + 0.12, bz + 0.16], rotation: [0.6, 0, -side * 0.35] }));
    }
    tines.push(part(new SphereGeometry(0.09, 7, 5), HIDE.moss, { position: [0.4 * side, 1.46, 0.22], scale: [1.4, 0.7, 1.2] }));
    tines.push(part(new SphereGeometry(0.07, 7, 5), HIDE.moss, { position: [0.64 * side, 1.9, 0.08], scale: [1.3, 0.6, 1.2] }));
  }
  return merge(tines);
}

function stoneGeometry(places, stone, ground) {
  return merge(places.flatMap(([x, z], i) => {
    const y = ground(x, z), lean = Math.sin(i * 2.3) * 0.06, spin = i * 0.9;
    return [
      part(new CylinderGeometry(stone.radius * 0.62, stone.radius, stone.height, 6, 3), HIDE.stone, { position: [x, y + stone.height / 2 - 0.15, z], rotation: [lean, spin, Math.cos(i * 1.7) * 0.06], shade: (px, py, pz) => 0.82 + 0.18 * Math.sin(px * 3.1 + py * 2.3 + pz * 1.7) }),
      part(new SphereGeometry(stone.radius * 0.62, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), HIDE.lichen, { position: [x, y + stone.height - 0.17, z], rotation: [lean, spin, 0], scale: [1, 0.4, 1] }),
      part(new DodecahedronGeometry(0.32, 0), HIDE.stone, { position: [x + 0.7, y + 0.05, z - 0.3], rotation: [i, spin, 0], scale: [1.2, 0.5, 1] }),
    ];
  }));
}

function spiralGeometry(places, centre, stone, ground) {
  const coil = Array.from({ length: 40 }, (_, k) => { const t = k / 39, a = t * Math.PI * 5, r = 0.04 + t * 0.28; return new Vector3(Math.cos(a) * r, Math.sin(a) * r, 0); });
  const shape = new TubeGeometry(new CatmullRomCurve3(coil), 80, 0.035, 5);
  return merge(places.map(([x, z]) => {
    const inward = Math.atan2(centre.x - x, centre.z - z), geometry = shape.clone();
    geometry.translate(0, 0, 0.56).rotateY(inward).translate(x, ground(x, z) + stone.height * 0.52, z);
    return part(geometry, '#ffffff');
  }));
}

function rootGeometry() {
  return merge([
    part(new ConeGeometry(0.22, 1.5, 6), HIDE.roots, { position: [0, 0.75, 0], shade: (_, y) => 0.75 + y * 0.25 }),
    part(new ConeGeometry(0.13, 0.95, 5), HIDE.roots, { position: [0.24, 0.42, 0.08], rotation: [0.2, 0, -0.45], shade: (_, y) => 0.75 + y * 0.3 }),
    part(new ConeGeometry(0.11, 0.8, 5), HIDE.roots, { position: [-0.2, 0.36, -0.1], rotation: [-0.25, 0, 0.5], shade: (_, y) => 0.75 + y * 0.3 }),
    part(new SphereGeometry(0.06, 6, 4), HIDE.rootTip, { position: [0, 1.48, 0] }),
  ]);
}

function decal(geometry, colour, opacity) {
  const mesh = new Mesh(geometry, new MeshBasicMaterial({ color: colour, transparent: true, opacity, depthWrite: false, side: DoubleSide, blending: AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2 }));
  mesh.rotation.x = -Math.PI / 2; mesh.visible = false; mesh.renderOrder = 5;
  return mesh;
}

const matrix = new Matrix4(), place = new Vector3(), size = new Vector3(), spin = new Quaternion(), upright = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2), axisY = new Vector3(0, 1, 0);

export function buildRing(sim, painterly) {
  const { layout, ground } = sim, root = new Group();
  root.name = 'wilds-ring';
  const stones = new Mesh(stoneGeometry(layout.ring.places, layout.stone, ground), painterly.material('#ffffff', { vertexColors: true }));
  stones.castShadow = true; stones.receiveShadow = true; stones.name = 'wilds-stones';
  const carving = new Mesh(spiralGeometry(layout.ring.places, layout.ring, layout.stone, ground), new MeshBasicMaterial({ color: SPIRAL.dark, toneMapped: false }));
  carving.name = 'wilds-spirals';

  const flinch = { value: 0 }, glow = { value: 0 };
  const stag = new Group(), body = new Group(), neck = new Group();
  const coat = painterly.material('#ffffff', { vertexColors: true, glow: flinch });
  const hind = new Mesh(hindGeometry(), coat), torso = new Mesh(bodyGeometry(), coat), head = new Mesh(headGeometry(), coat);
  const antlers = new Mesh(antlerGeometry(), painterly.material('#ffffff', { vertexColors: true, glow }));
  const heart = new Mesh(new SphereGeometry(0.2, 12, 8), new MeshBasicMaterial({ color: HIDE.heart }));
  const heartHalo = new Mesh(new SphereGeometry(0.34, 12, 8), new MeshBasicMaterial({ color: HIDE.heart, transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false }));
  heart.position.set(0, 1.42 - HIPS[1], 1.15 - HIPS[2]); heartHalo.position.copy(heart.position);
  for (const mesh of [hind, torso, head, antlers]) { mesh.castShadow = true; mesh.receiveShadow = true; }
  body.position.set(...HIPS); neck.position.set(SHOULDER[0] - HIPS[0], SHOULDER[1] - HIPS[1], SHOULDER[2] - HIPS[2]);
  neck.add(head, antlers); body.add(torso, neck, heart, heartHalo); stag.add(hind, body);
  stag.name = 'wilds-stag';

  const slam = decal(new RingGeometry(0.86, 1, 48), HIDE.warn, 0.5);
  const wave = decal(new RingGeometry(0.8, 1, 64), '#ffe2b0', 0.7);
  const lane = decal(new PlaneGeometry(1, 1), HIDE.warn, 0.35);
  const arc = decal(new CircleGeometry(1, 24, 0, STAG_ATTACKS.sweep.arc * 2), HIDE.warn, 0.32);
  const spikes = new InstancedMesh(rootGeometry(), painterly.material('#ffffff', { vertexColors: true }), ROOT_MAX);
  const marks = new InstancedMesh(new CircleGeometry(1, 16), new MeshBasicMaterial({ color: HIDE.warn, transparent: true, opacity: 0.45, depthWrite: false, blending: AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2 }), ROOT_MAX);
  spikes.castShadow = true; spikes.count = 0; marks.count = 0; marks.renderOrder = 5; spikes.frustumCulled = false; marks.frustumCulled = false;
  root.add(stones, carving, stag, slam, wave, lane, arc, spikes, marks);

  let stride = 0, lastX = sim.stag.x, lastZ = sim.stag.z, fade = 1, kindled = 0, clock = 0;

  function pose(state, dt, still) {
    const attack = state.attack && STAG_ATTACKS[state.attack], t = state.time;
    let rear = 0, nod = 0, turn = 0, roll = 0, sink = 0, lift = 0, warm = 0, heartShow = state.heartOpen;
    const moved = Math.hypot(state.x - lastX, state.z - lastZ);
    lastX = state.x; lastZ = state.z;
    stride += moved * 2.4;
    if (state.state === 'dormant') nod = 0.75 + (still ? 0 : Math.sin(sim.stag.clock * 0.8) * 0.05);
    else if (state.state === 'wake') { const s = ease(t / STAG.wake); nod = 0.75 * (1 - s); rear = Math.sin(Math.PI * s) * 0.35; }
    else if (state.state === 'telegraph') {
      const s = ease(t / attack.telegraph);
      warm = s;
      if (state.attack === 'sweep') { turn = -state.side * 0.95 * s; nod = 0.35 * s; }
      else if (state.attack === 'stomp') rear = 0.62 * s;
      else if (state.attack === 'charge') { nod = 0.8 * s; rear = -0.08 * s; lift = still ? 0 : Math.abs(Math.sin(t * 9)) * 0.12 * s; }
      else if (state.attack === 'roots') { nod = -0.6 * s; rear = 0.18 * s; }
    } else if (state.state === 'attack') {
      warm = 0.5;
      if (state.attack === 'sweep') { const s = ease(t / attack.active); turn = state.side * (-0.95 + 1.9 * s); nod = 0.35; }
      else if (state.attack === 'stomp') rear = 0.62 * (1 - ease(t / 0.08));
      else if (state.attack === 'charge') { nod = 0.8; stride += moved * 1.2; }
      else nod = -0.6 * (1 - ease(t / 0.5));
    } else if (state.state === 'recover') nod = 0.25 * (1 - ease(t / 0.6));
    else if (state.state === 'stun') { roll = 0.32; nod = 0.55; sink = 0.25; heartShow = true; }
    else if (state.state === 'retreat') { const s = Math.min(1, t / 0.15); rear = 0.3 * s; lift = still ? 0 : Math.abs(Math.sin(t * 9)) * 0.45; nod = -0.2 * s; }
    else if (state.state === 'stagger') roll = Math.sin(t * 10) * 0.18 * (1 - t / STAG.stagger);
    else if (state.state === 'shift') { const s = Math.sin(Math.PI * Math.min(1, t / STAG.shift)); rear = 0.7 * s; nod = -0.5 * s; warm = s; }
    else if (state.state === 'defeat') { const s = ease(t / 1.2); sink = 0.55 * s; roll = 0.9 * s; nod = 0.6 * s; }
    if (still) { stride = 0; lift = 0; }
    const swing = Math.sin(stride) * Math.min(0.5, moved * 30);
    body.rotation.set(-rear, 0, 0);
    hind.rotation.x = swing * 0.3;
    neck.rotation.set(nod, turn, 0);
    stag.rotation.set(0, state.facing, roll);
    stag.position.set(state.x, state.y - sink + lift, state.z);
    flinch.value = Math.max(state.flinch * 0.45, warm * 0.15);
    glow.value = warm * (state.attack === 'roots' || state.state === 'shift' ? 1.1 : 0.8);
    heart.visible = heartShow; heartHalo.visible = heartShow;
    if (heartShow) heartHalo.scale.setScalar(still ? 1 : 1 + Math.sin(sim.stag.clock * 9) * 0.15);
    if (state.state === 'gone') fade = Math.max(0, fade - dt * 2); else if (state.state !== 'defeat') fade = 1;
    if (state.state === 'defeat') fade = 1 - ease((t - 2.4) / (STAG.defeat - 2.4));
    stag.visible = fade > 0.01;
    stag.scale.setScalar(0.6 + fade * 0.4);
  }

  function marksFor(state) {
    const attack = state.attack && STAG_ATTACKS[state.attack], ground0 = state.y + 0.04;
    slam.visible = false; wave.visible = false; lane.visible = false; arc.visible = false;
    if (!attack) return;
    if (state.state === 'telegraph') {
      const s = ease(state.time / attack.telegraph);
      if (state.attack === 'stomp') { slam.visible = true; slam.position.set(state.x, ground0, state.z); slam.scale.setScalar(attack.slam * (0.6 + 0.4 * s)); slam.material.opacity = 0.2 + s * 0.45; }
      if (state.attack === 'charge') {
        const dx = state.aimX - state.x, dz = state.aimZ - state.z, angle = Math.atan2(dx, dz), length = attack.length * 0.6;
        lane.visible = true; lane.position.set(state.x + Math.sin(angle) * length / 2, ground0, state.z + Math.cos(angle) * length / 2);
        lane.rotation.set(-Math.PI / 2, 0, angle); lane.scale.set(STAG.radius * 2, length, 1); lane.material.opacity = 0.1 + s * 0.3;
      }
      if (state.attack === 'sweep') {
        arc.visible = true; arc.position.set(state.x, ground0, state.z); arc.scale.setScalar(attack.reach);
        arc.rotation.set(-Math.PI / 2, 0, state.facing - Math.PI / 2 - attack.arc); arc.material.opacity = 0.08 + s * 0.24;
      }
    } else if (state.state === 'attack' && state.attack === 'stomp' && state.time < attack.active) {
      const s = state.time / attack.active, radius = attack.ring[0] + (attack.ring[1] - attack.ring[0]) * s;
      wave.visible = true; wave.position.set(state.x, ground0, state.z); wave.scale.setScalar(radius); wave.material.opacity = 0.75 * (1 - s);
    }
  }

  function rootsFor(state) {
    let spikesCount = 0, marksCount = 0;
    for (const entry of state.roots) {
      if (state.clock < entry.at) {
        if (marksCount >= ROOT_MAX) continue;
        const s = ease((state.clock - entry.warnAt) / Math.max(0.01, entry.at - entry.warnAt));
        place.set(entry.x, ground(entry.x, entry.z) + 0.05, entry.z); size.setScalar(entry.width * (0.5 + 0.5 * s));
        marks.setMatrixAt(marksCount++, matrix.compose(place, upright, size));
      } else if (spikesCount < ROOT_MAX) {
        const up = (state.clock - entry.at) / Math.max(0.01, entry.until - entry.at), height = Math.sin(Math.PI * Math.min(1, up * 0.5 + 0.5 * Math.min(1, up * 4))) * 1.1;
        place.set(entry.x, ground(entry.x, entry.z) - 0.2, entry.z); size.set(entry.width * 0.9, Math.max(0.05, height), entry.width * 0.9);
        spin.setFromAxisAngle(axisY, entry.x * 3.1 + entry.z * 1.7);
        spikes.setMatrixAt(spikesCount++, matrix.compose(place, spin, size));
      }
    }
    spikes.count = spikesCount; marks.count = marksCount;
    if (spikesCount) spikes.instanceMatrix.needsUpdate = true;
    if (marksCount) marks.instanceMatrix.needsUpdate = true;
  }

  return {
    root,
    get kindled() { return kindled; },
    update(dt, still) {
      const state = sim.stag, wanted = sim.encounter === 'fight' ? 1 : sim.encounter === 'won' ? 0.3 : 0;
      kindled += Math.sign(wanted - kindled) * Math.min(Math.abs(wanted - kindled), dt * SPIRAL.rise);
      clock += still ? 0 : dt;
      carving.material.color.copy(SPIRAL.dark).lerp(SPIRAL.lit, kindled * (still ? 1 : 0.85 + Math.sin(clock * 3) * 0.15));
      pose(state, dt, still);
      marksFor(state);
      rootsFor(state);
    },
  };
}
