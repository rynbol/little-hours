import { AdditiveBlending, CatmullRomCurve3, CircleGeometry, Color, TubeGeometry, ConeGeometry, CylinderGeometry, DodecahedronGeometry, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, RingGeometry, SphereGeometry, Vector3 } from 'three';
import { STAG, STAG_ATTACKS } from '../../core/wilds/stag.js';
import { part, merge } from './shapes.js';

const HIDE = Object.freeze({ stone: '#a49b8c', lichen: '#9bb071', warn: '#ff9a5c', roots: '#6e4b33', rootTip: '#9bc463' });
const ROOT_MAX = 128;
const SPIRAL = Object.freeze({ dark: new Color('#5c554b'), lit: new Color('#c9ffa0'), rise: 1.4, night: 0.32 });
const ease = s => { const t = Math.min(1, Math.max(0, s)); return t * t * (3 - 2 * t); };

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

  const slam = decal(new RingGeometry(0.86, 1, 48), HIDE.warn, 0.5);
  const wave = decal(new RingGeometry(0.8, 1, 64), '#ffe2b0', 0.7);
  const lane = decal(new PlaneGeometry(1, 1), HIDE.warn, 0.35);
  const arc = decal(new CircleGeometry(1, 24, 0, STAG_ATTACKS.sweep.arc * 2), HIDE.warn, 0.32);
  const spikes = new InstancedMesh(rootGeometry(), painterly.material('#ffffff', { vertexColors: true }), ROOT_MAX);
  const marks = new InstancedMesh(new CircleGeometry(1, 16), new MeshBasicMaterial({ color: HIDE.warn, transparent: true, opacity: 0.45, depthWrite: false, blending: AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2 }), ROOT_MAX);
  spikes.castShadow = true; spikes.count = 0; marks.count = 0; marks.renderOrder = 5; spikes.frustumCulled = false; marks.frustumCulled = false;
  root.add(stones, carving, slam, wave, lane, arc, spikes, marks);

  let kindled = 0, clock = 0;

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
    update(dt, still, night = 0) {
      const state = sim.stag, wanted = sim.encounter === 'fight' ? 1 : sim.encounter === 'won' ? 0.3 : 0;
      kindled += Math.sign(wanted - kindled) * Math.min(Math.abs(wanted - kindled), dt * SPIRAL.rise);
      clock += still ? 0 : dt;
      carving.material.color.copy(SPIRAL.dark).lerp(SPIRAL.lit, Math.max(kindled, night * SPIRAL.night) * (still ? 1 : 0.85 + Math.sin(clock * 3) * 0.15));
      marksFor(state);
      rootsFor(state);
    },
  };
}
