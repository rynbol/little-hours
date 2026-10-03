import { BoxGeometry, CapsuleGeometry, CylinderGeometry, Group, Matrix4, Mesh, Quaternion, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { BLADE } from '../../core/wilds/moves.js';
import { DODGE } from '../../core/wilds/player.js';
import { part, merge } from './shapes.js';

const LOOK = Object.freeze({ body: '#b9b1a7', belly: '#cfc8bd', visor: '#2e3546', glint: '#8fa6c9', steel: '#e3e6ea', edge: '#f7f3e8', guard: '#b48a45', grip: '#5b3d2a', hand: '#a59d93' });
const CENTRE = 0.75, BLADE_LENGTH = BLADE.reach - BLADE.inner;

function bodyGeometry() {
  return merge([
    part(new CapsuleGeometry(0.3, 0.9, 10, 28), LOOK.body, { shade: (_, y, z) => 0.92 + (z > 0.12 && y < 0.1 ? 0.1 : 0) + y * 0.05 }),
    part(new SphereGeometry(0.22, 16, 8, Math.PI / 2 - 0.95, 1.9, 1.2, 0.62), LOOK.visor, { position: [0, 0.38, 0.085], scale: [1.18, 1, 1] }),
    part(new SphereGeometry(0.035, 6, 4), LOOK.glint, { position: [-0.08, 0.41, 0.3] }),
    part(new TorusGeometry(0.305, 0.03, 5, 18), LOOK.grip, { position: [0, -0.12, 0], rotation: [Math.PI / 2, 0, 0] }),
    part(new BoxGeometry(0.1, 0.08, 0.04), LOOK.guard, { position: [0.12, -0.12, 0.29], rotation: [0, 0.4, 0] }),
  ]);
}

function bladeGeometry() {
  return merge([
    part(new CylinderGeometry(0.006, 0.042, BLADE_LENGTH, 4), LOOK.steel, { position: [0, BLADE_LENGTH / 2, 0], scale: [1, 1, 0.24], shade: (x) => 0.9 + Math.abs(x) * 2.5 }),
    part(new BoxGeometry(0.24, 0.035, 0.06), LOOK.guard, {}),
    part(new CylinderGeometry(0.022, 0.026, 0.2, 6), LOOK.grip, { position: [0, -0.11, 0] }),
    part(new SphereGeometry(0.035, 6, 4), LOOK.guard, { position: [0, -0.22, 0] }),
  ]);
}

const up = new Vector3(0, 1, 0), basis = new Matrix4(), turn = new Quaternion(), axis = new Vector3(), along = new Vector3(), normal = new Vector3(), sweep = new Vector3();

export function buildStandin(painterly) {
  const root = new Group(), tilt = new Group(), glow = { value: 0 };
  const body = new Mesh(bodyGeometry(), painterly.material('#ffffff', { vertexColors: true }));
  const blade = new Mesh(bladeGeometry(), painterly.material('#ffffff', { vertexColors: true, glow }));
  const hand = new Mesh(new SphereGeometry(0.075, 8, 6), painterly.material(LOOK.hand));
  for (const mesh of [body, blade, hand]) { mesh.castShadow = true; mesh.receiveShadow = true; }
  tilt.position.y = CENTRE; tilt.add(body); root.add(tilt);
  root.name = 'wilds-standin';
  const edge = new Vector3(1, 0, 0), lastTip = new Vector3(), squash = { value: 1, speed: 0 };
  let lean = 0, twist = 0, primed = false;

  function placeBlade(segment, dt) {
    along.set(segment.tip[0] - segment.root[0], segment.tip[1] - segment.root[1], segment.tip[2] - segment.root[2]).normalize();
    sweep.set(...segment.tip).sub(lastTip);
    const speed = primed && dt > 0 ? sweep.length() / dt : 0;
    lastTip.set(...segment.tip); primed = true;
    sweep.addScaledVector(along, -sweep.dot(along));
    if (speed > 1.5 && sweep.lengthSq() > 1e-8) edge.lerp(sweep.normalize(), Math.min(1, dt * 30));
    edge.addScaledVector(along, -edge.dot(along));
    if (edge.lengthSq() < 1e-6) edge.crossVectors(along, up);
    edge.normalize();
    normal.crossVectors(edge, along);
    blade.quaternion.setFromRotationMatrix(basis.makeBasis(edge, along, normal));
    blade.position.set(...segment.root);
    hand.position.set(...segment.root).addScaledVector(along, -0.1);
  }

  return {
    root, blade, hand,
    land(speed) { squash.speed -= Math.min(6, speed * 0.55); },
    jump() { squash.speed += 3.2; },
    update(player, segment, dt, still) {
      root.position.set(player.x, player.y, player.z);
      root.rotation.y = player.facing;
      squash.speed += (-170 * (squash.value - 1) - 15 * squash.speed) * dt;
      squash.value += squash.speed * dt;
      if (still) { squash.value = 1; squash.speed = 0; }
      const stretch = Math.min(1.25, Math.max(0.72, squash.value)), wide = 1 / Math.sqrt(stretch);
      const speed = Math.hypot(player.vx, player.vz), charging = player.state === 'charge';
      lean += ((still ? 0 : Math.min(0.2, speed * 0.03) + (charging ? 0.12 : 0) + (player.tired ? 0.14 : 0)) - lean) * Math.min(1, dt * 10);
      const swingTwist = player.state === 'attack' && !still ? (segment.yaw - BLADE.rest[0]) * Math.PI / 180 * 0.22 : 0;
      twist += (swingTwist - twist) * Math.min(1, dt * 24);
      tilt.quaternion.setFromAxisAngle(axis.set(1, 0, 0), lean);
      tilt.quaternion.premultiply(turn.setFromAxisAngle(up, twist));
      let tuck = 0;
      if (player.state === 'dodge') {
        const s = Math.min(1, player.time / DODGE.time), roll = still ? 0 : (s * s * (3 - 2 * s)) * Math.PI * 2;
        const face = player.facing, lx = player.dodgeX * Math.cos(face) - player.dodgeZ * Math.sin(face), lz = player.dodgeX * Math.sin(face) + player.dodgeZ * Math.cos(face);
        tilt.quaternion.premultiply(turn.setFromAxisAngle(axis.set(lz, 0, -lx).normalize(), roll));
        tuck = Math.sin(Math.PI * s) * (still ? 0.2 : 1);
      }
      tilt.position.y = CENTRE - tuck * 0.28;
      tilt.scale.set(wide * (1 + tuck * 0.05), stretch * (1 - tuck * 0.3), wide * (1 + tuck * 0.05));
      placeBlade(segment, dt);
      glow.value = charging ? (player.charge >= 1 ? 0.5 + (still ? 0 : 0.25 * Math.sin(player.time * 22)) : player.charge * 0.4) : 0;
    },
  };
}
