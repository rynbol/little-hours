import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { createMobileCompanion } from '../../models/furniture.js';
import { createPetModel } from '../pet/index.js';
import { FOREST_TRAILHEAD } from './island-forest.js';
import { DOCK } from './house-pond.js';

const SCALE = .43, GROUND = -.175, DOCK_TOP = -.04, SPEED = .36, PET_LAG = 1.2;
const ROUTE = [
  { at: [5.6, 3.3], rest: 3, yaw: -1.2 }, { at: [7, 3.3] }, { at: [8.2, 3.25] }, { at: [9.25, 3.1] }, { at: [9.55, 2.6] },
  { at: [9.55, 1.6], rest: 5, yaw: 0 }, { at: [9.55, 2.6] }, { at: [9.2, 3.15] }, { at: [8.5, 3.1] }, { at: [8.1, 2.4] },
  { at: [7.85, 1.75], rest: 4, yaw: 2.4 }, { at: [8.25, 2.45] }, { at: [7.6, 3.3] }, { at: [6.35, 3.2], rest: 2.5, yaw: .4 },
];

export const STROLL = ROUTE.map(stop => stop.at);

function timeline(route, speed) {
  const legs = [];
  let t = 0, walked = 0;
  route.forEach((stop, i) => {
    const next = route[(i + 1) % route.length], length = Math.hypot(next.at[0] - stop.at[0], next.at[1] - stop.at[1]);
    if (stop.rest) { legs.push({ from: stop.at, to: stop.at, start: t, time: stop.rest, walked, yaw: stop.yaw }); t += stop.rest; }
    if (!length) return;
    legs.push({ from: stop.at, to: next.at, start: t, time: length / speed, walked, yaw: Math.atan2(-(next.at[0] - stop.at[0]), -(next.at[1] - stop.at[1])) });
    t += length / speed; walked += length;
  });
  return { legs, total: t };
}
const GARDEN_ROUTE = [
  { at: [0, 2.1], rest: 3, yaw: Math.PI + .25 }, { at: [.18, 1.5] }, { at: [.2, 1] }, { at: [0, .1], rest: 4, yaw: 1.2 },
  { at: [-.3, -.6] }, { at: [-.25, -1.15], rest: 3, yaw: 1.6 }, { at: [.45, -1.5] }, { at: [.95, -1.95] },
  { at: [1, -2.4] }, { at: [.6, -2.95] }, { at: [0, -3.08], rest: 5, yaw: Math.PI },
  { at: [.6, -2.95] }, { at: [1, -2.4] }, { at: [.95, -1.95] }, { at: [.45, -1.5] }, { at: [-.25, -1.15] },
  { at: [-.3, -.6] }, { at: [0, .1] }, { at: [.2, 1] }, { at: [.18, 2] },
];
const PLACES = {
  'forest-return': { ...timeline([{ at: [FOREST_TRAILHEAD.position[0], FOREST_TRAILHEAD.position[2]], rest: 1, yaw: Math.atan2(-FOREST_TRAILHEAD.facing[0], -FOREST_TRAILHEAD.facing[2]) }], SPEED), scale: SCALE, ground: FOREST_TRAILHEAD.position[1], sit: 0, seatHeight: .5 },
  island: { ...timeline(ROUTE, SPEED), scale: SCALE, ground: GROUND, sit: 0, seatHeight: .5 },
  garden: { ...timeline(GARDEN_ROUTE, .4), scale: .76, ground: .035, sit: 0, seatHeight: .5 },
  'garden-rest': { ...timeline([{ at: [-.55, -3.55], rest: 1, yaw: Math.PI }], .4), scale: .76, ground: .035, sit: 1, seatHeight: .68 / .76 },
};

export function strollAt(seconds, place = 'island') {
  const { legs, total, ground, sit, seatHeight } = PLACES[place];
  const t = ((seconds % total) + total) % total, leg = legs.findLast(entry => entry.start <= t);
  const k = Math.min(1, (t - leg.start) / leg.time), x = leg.from[0] + (leg.to[0] - leg.from[0]) * k, z = leg.from[1] + (leg.to[1] - leg.from[1]) * k;
  const moving = leg.from !== leg.to, onDock = place === 'island' && Math.abs(x - DOCK.x) < DOCK.width / 2 && z > DOCK.to - .05 && z < DOCK.from;
  return { x, z, y: onDock ? DOCK_TOP : ground, yaw: leg.yaw, moving, sit, seatHeight, walked: leg.walked + (moving ? Math.hypot(x - leg.from[0], z - leg.from[1]) : 0) };
}

export function createStroll(scene, avatar, pet) {
  const node = new TransformNode('house-stroll', scene); node.scaling.setAll(SCALE);
  const companion = createMobileCompanion(scene, avatar); companion.root.parent = node; companion.contact.parent = node;
  let petModel = null;
  try { petModel = createPetModel(scene, pet); petModel.root.parent = node; petModel.contact.parent = node; } catch { petModel = null; }
  for (const mesh of node.getChildMeshes()) { mesh.isPickable = false; mesh.material?.freeze(); }
  const pose = { x: 0, z: 0, yaw: 0, step: 0, moving: false, sit: 0, seatHeight: .5, doze: 0, activity: null, activityTime: 0, atDesk: false, preview: null, reach: null };
  const petPose = { action: 'sit', moving: false, petAge: Infinity, walked: 0, x: 0, z: 0, yaw: 0, hearts: [] };
  let last = null, drawn = -1, location = 'island', arrived = 0, still = false, ground = GROUND;
  return {
    node,
    get pose() { return { ...pose }; },
    get world() { return { x: pose.x * node.scaling.x, y: ground, z: pose.z * node.scaling.z }; },
    get pet() { return petModel && { ...petPose }; },
    setVisible(visible) { node.setEnabled(visible); if (!visible) last = null; },
    animate(seconds, reducedMotion, place = 'island') {
      if (place !== location || reducedMotion !== still) { location = place; still = reducedMotion; arrived = seconds; last = null; }
      const scale = PLACES[place].scale; node.scaling.setAll(scale);
      const elapsed = seconds - arrived, me = strollAt(elapsed, place), pal = strollAt(elapsed - PET_LAG, place);
      ground = me.y;
      if (reducedMotion && place === 'garden') Object.assign(pal, { x: me.x - .35, z: me.z - .15, yaw: me.yaw });
      if (place === 'garden-rest') Object.assign(pal, { x: .55, z: -3.1, yaw: Math.PI - .3 });
      if (!me.moving && !pal.moving && last !== null && seconds - drawn < .1) return;
      drawn = seconds;
      const dt = last === null ? 0 : Math.min(.1, Math.max(0, seconds - last)); last = seconds;
      Object.assign(pose, { x: me.x / scale, z: me.z / scale, sit: me.sit, seatHeight: me.seatHeight, yaw: me.yaw, moving: me.moving && !reducedMotion, step: me.walked / scale * 8 });
      companion.animate(pose, seconds, reducedMotion, me.y / scale);
      companion.contact.position.y = me.y / scale + .01;
      if (!petModel) return;
      Object.assign(petPose, { x: pal.x / scale + (place === 'island' ? .35 : -.25), z: pal.z / scale + .25, yaw: pal.yaw, moving: pal.moving && !reducedMotion, walked: pal.walked / scale, action: pal.moving ? 'walk' : 'sit' });
      petModel.root.position.set(petPose.x, pal.y / scale, petPose.z); petModel.root.rotation.y = petPose.yaw;
      petModel.contact.position.set(petPose.x, pal.y / scale + .01, petPose.z);
      petModel.animate(petPose, dt, seconds, reducedMotion);
    },
    dispose() { companion.dispose(); petModel?.dispose(); node.dispose(); },
  };
}
