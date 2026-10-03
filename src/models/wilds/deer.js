import { CapsuleGeometry, ConeGeometry, CylinderGeometry, Euler, InstancedMesh, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three';
import { merge, part } from './shapes.js';

const COAT = Object.freeze({ back: '#9a6a43', flank: '#b07e52', belly: '#efe2c8', dark: '#3a2a20', ear: '#c99a70', hoof: '#2e2520' });
export const DEER_VIEW = Object.freeze({ hip: Object.freeze([[0.17, 0.95, 0.42], [-0.17, 0.95, 0.42], [0.16, 0.95, -0.42], [-0.16, 0.95, -0.42]]), neck: Object.freeze([0, 1.12, 0.48]), gallop: 0.95, swing: 0.75, graze: 1.25, far: 420 });

function bodyGeometry() {
  return merge([
    part(new CapsuleGeometry(0.27, 0.72, 4, 10), COAT.flank, { position: [0, 1.06, 0], rotation: [Math.PI / 2, 0, 0], scale: [1, 1, 1.05], shade: (x, y) => (y > 1.12 ? 0.86 : 1) }),
    part(new SphereGeometry(0.22, 8, 6), COAT.belly, { position: [0, 0.92, 0.05], scale: [1, 0.55, 2.1] }),
    part(new SphereGeometry(0.1, 6, 5), COAT.belly, { position: [0, 1.16, -0.56], scale: [1, 1.3, 0.7] }),
    part(new ConeGeometry(0.06, 0.16, 5), COAT.back, { position: [0, 1.24, -0.6], rotation: [-2.3, 0, 0] }),
  ]);
}

function headGeometry() {
  return merge([
    part(new CylinderGeometry(0.075, 0.12, 0.6, 7), COAT.flank, { position: [0, 0.24, 0.1], rotation: [0.42, 0, 0] }),
    part(new SphereGeometry(0.12, 8, 6), COAT.flank, { position: [0, 0.52, 0.24], scale: [0.9, 0.9, 1.3] }),
    part(new ConeGeometry(0.075, 0.22, 7), COAT.flank, { position: [0, 0.48, 0.41], rotation: [Math.PI / 2 + 0.35, 0, 0] }),
    part(new SphereGeometry(0.035, 6, 4), COAT.dark, { position: [0, 0.445, 0.515] }),
    ...[-1, 1].flatMap(side => [
      part(new SphereGeometry(0.06, 6, 4), COAT.ear, { position: [side * 0.1, 0.66, 0.18], scale: [0.55, 1.5, 0.35], rotation: [-0.3, 0, side * -0.7] }),
      part(new SphereGeometry(0.022, 5, 4), COAT.dark, { position: [side * 0.075, 0.55, 0.33] }),
    ]),
  ]);
}

function legGeometry() {
  return merge([
    part(new CylinderGeometry(0.055, 0.035, 0.5, 6), COAT.flank, { position: [0, -0.25, 0] }),
    part(new CylinderGeometry(0.03, 0.025, 0.42, 5), COAT.back, { position: [0, -0.7, 0] }),
    part(new CylinderGeometry(0.03, 0.035, 0.07, 5), COAT.hoof, { position: [0, -0.92, 0] }),
  ]);
}

export function buildDeer(count, painterly) {
  const material = painterly.material('#ffffff', { vertexColors: true });
  const make = (geometry, n, name) => { const mesh = new InstancedMesh(geometry, material, n); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.name = name; return mesh; };
  const bodies = make(bodyGeometry(), count, 'wilds-deer'), heads = make(headGeometry(), count, 'wilds-deer-heads'), legs = make(legGeometry(), count * 4, 'wilds-deer-legs');
  const base = new Matrix4(), local = new Matrix4(), out = new Matrix4(), turn = new Quaternion(), euler = new Euler(), at = new Vector3(), one = new Vector3(1, 1, 1), stride = new Array(count).fill(0);
  return {
    meshes: [bodies, heads, legs],
    update(herd, ground, eye, dt, still) {
      herd.forEach((deer, i) => {
        const running = Math.min(1, deer.speed / 4);
        if (!still) stride[i] = (stride[i] + deer.speed * dt / DEER_VIEW.gallop) % 1;
        const swing = Math.sin(stride[i] * Math.PI * 2), bob = running * Math.abs(Math.cos(stride[i] * Math.PI * 2)) * 0.16;
        const hidden = Math.hypot(deer.x - eye.x, deer.z - eye.z) > DEER_VIEW.far;
        base.compose(at.set(deer.x, ground(deer.x, deer.z) + bob, deer.z), turn.setFromEuler(euler.set(-swing * running * 0.08, deer.facing, 0)), hidden ? at.set(0, 0, 0) : one);
        bodies.setMatrixAt(i, base);
        local.compose(at.set(...DEER_VIEW.neck), turn.setFromEuler(euler.set(deer.head * DEER_VIEW.graze - running * 0.25, 0, 0)), one);
        heads.setMatrixAt(i, out.multiplyMatrices(base, local));
        DEER_VIEW.hip.forEach((hip, leg) => {
          const front = leg < 2, phase = front ? swing : -swing, rest = deer.head > 0.5 && front ? -0.08 : 0;
          local.compose(at.set(...hip), turn.setFromEuler(euler.set(phase * DEER_VIEW.swing * running + rest + (leg % 2) * 0.12 * swing * running, 0, 0)), one);
          legs.setMatrixAt(i * 4 + leg, out.multiplyMatrices(base, local));
        });
      });
      for (const mesh of [bodies, heads, legs]) mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
