import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { createMobileCompanion } from '../../models/furniture.js';
import { createPetModel } from '../pet/index.js';
import { DOCK } from './house-pond.js';

const SCALE = .43, GROUND = -.175, DOCK_TOP = -.04, SPEED = .36, PET_LAG = 1.2;
const ROUTE = [
  { at: [5.6, 3.3], rest: 3, yaw: -1.2 }, { at: [7, 3.3] }, { at: [8.2, 3.25] }, { at: [9.25, 3.1] }, { at: [9.55, 2.6] },
  { at: [9.55, 1.6], rest: 5, yaw: 0 }, { at: [9.55, 2.6] }, { at: [9.2, 3.15] }, { at: [8.5, 3.1] }, { at: [8.1, 2.4] },
  { at: [7.85, 1.75], rest: 4, yaw: 2.4 }, { at: [8.25, 2.45] }, { at: [7.6, 3.3] }, { at: [6.35, 3.2], rest: 2.5, yaw: .4 },
];

export const STROLL = ROUTE.map(stop => stop.at);

function timeline() {
  const legs = [];
  let t = 0, walked = 0;
  ROUTE.forEach((stop, i) => {
    const next = ROUTE[(i + 1) % ROUTE.length], length = Math.hypot(next.at[0] - stop.at[0], next.at[1] - stop.at[1]);
    if (stop.rest) { legs.push({ from: stop.at, to: stop.at, start: t, time: stop.rest, walked, yaw: stop.yaw }); t += stop.rest; }
    legs.push({ from: stop.at, to: next.at, start: t, time: length / SPEED, walked, yaw: Math.atan2(-(next.at[0] - stop.at[0]), -(next.at[1] - stop.at[1])) });
    t += length / SPEED; walked += length;
  });
  return { legs, total: t };
}
const { legs, total } = timeline();

export function strollAt(seconds) {
  const t = ((seconds % total) + total) % total, leg = legs.findLast(entry => entry.start <= t);
  const k = Math.min(1, (t - leg.start) / leg.time), x = leg.from[0] + (leg.to[0] - leg.from[0]) * k, z = leg.from[1] + (leg.to[1] - leg.from[1]) * k;
  const moving = leg.from !== leg.to, onDock = Math.abs(x - DOCK.x) < DOCK.width / 2 && z > DOCK.to - .05 && z < DOCK.from;
  return { x, z, y: onDock ? DOCK_TOP : GROUND, yaw: leg.yaw, moving, walked: leg.walked + (moving ? Math.hypot(x - leg.from[0], z - leg.from[1]) : 0) };
}

export function createStroll(scene, avatar, pet) {
  const node = new TransformNode('house-stroll', scene); node.scaling.setAll(SCALE);
  const companion = createMobileCompanion(scene, avatar); companion.root.parent = node; companion.contact.parent = node;
  let petModel = null;
  try { petModel = createPetModel(scene, pet); petModel.root.parent = node; petModel.contact.parent = node; } catch { petModel = null; }
  for (const mesh of node.getChildMeshes()) { mesh.isPickable = false; mesh.material?.freeze(); }
  const pose = { x: 0, z: 0, yaw: 0, step: 0, moving: false, sit: 0, seatHeight: .5, doze: 0, activity: null, activityTime: 0, atDesk: false, preview: null, reach: null };
  const petPose = { action: 'sit', moving: false, petAge: Infinity, walked: 0, x: 0, z: 0, yaw: 0, hearts: [] };
  let last = null, drawn = -1;
  return {
    node,
    get pose() { return { ...pose }; },
    get pet() { return petModel && { ...petPose }; },
    setVisible(visible) { node.setEnabled(visible); if (!visible) last = null; },
    animate(seconds, reducedMotion) {
      const me = strollAt(seconds), pal = strollAt(seconds - PET_LAG);
      if (!me.moving && !pal.moving && last !== null && seconds - drawn < .1) return;
      drawn = seconds;
      const dt = last === null ? 0 : Math.min(.1, Math.max(0, seconds - last)); last = seconds;
      Object.assign(pose, { x: me.x / SCALE, z: me.z / SCALE, yaw: me.yaw, moving: me.moving && !reducedMotion, step: me.walked / SCALE * 8 });
      companion.animate(pose, seconds, reducedMotion, me.y / SCALE);
      companion.contact.position.y = me.y / SCALE + .01;
      if (!petModel) return;
      Object.assign(petPose, { x: pal.x / SCALE + .35, z: pal.z / SCALE + .25, yaw: pal.yaw, moving: pal.moving && !reducedMotion, walked: pal.walked / SCALE, action: pal.moving ? 'walk' : 'sit' });
      petModel.root.position.set(petPose.x, pal.y / SCALE, petPose.z); petModel.root.rotation.y = petPose.yaw;
      petModel.contact.position.set(petPose.x, pal.y / SCALE + .01, petPose.z);
      petModel.animate(petPose, dt, seconds, reducedMotion);
    },
    dispose() { companion.dispose(); petModel?.dispose(); node.dispose(); },
  };
}
