import { getFurniture } from './catalog.js';
import { ROOM_BOUNDS, CAT_BOUNDS } from './layout.js';
import { sessionPhase } from './session.js';

export const COMPANION_RADIUS = 0.24;
export const DOZE_AFTER = 30;
const STEP = 0.2;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const ease = t => t * t * (3 - 2 * t);
export function companionIntent(session, now = Date.now()) {
  return { focusing: 'working', break: 'break', idle: 'idle' }[sessionPhase(session, now)];
}
export function localPoint(item, x, z) {
  const angle = item.rotation * Math.PI / 2, c = Math.cos(angle), s = Math.sin(angle);
  return { x: item.x + x * c + z * s, z: item.z - x * s + z * c };
}
export function navigationObstacles(layout, ignoredId) {
  const boxes = [CAT_BOUNDS];
  for (const item of layout.items) {
    const definition = getFurniture(item.type);
    if (!definition?.blocking || item.id === ignoredId) continue;
    const [w, d] = item.rotation % 2 ? [...definition.footprint].reverse() : definition.footprint;
    boxes.push({ minX: item.x - w / 2, maxX: item.x + w / 2, minZ: item.z - d / 2, maxZ: item.z + d / 2 });
  }
  return boxes.map(box => ({ minX: box.minX - COMPANION_RADIUS, maxX: box.maxX + COMPANION_RADIUS, minZ: box.minZ - COMPANION_RADIUS, maxZ: box.maxZ + COMPANION_RADIUS }));
}
export function walkable(point, obstacles) {
  return point.x >= ROOM_BOUNDS.minX + COMPANION_RADIUS && point.x <= ROOM_BOUNDS.maxX - COMPANION_RADIUS
    && point.z >= ROOM_BOUNDS.minZ + COMPANION_RADIUS && point.z <= ROOM_BOUNDS.maxZ - COMPANION_RADIUS
    && !obstacles.some(box => point.x > box.minX && point.x < box.maxX && point.z > box.minZ && point.z < box.maxZ);
}
export function clearSegment(a, b, obstacles) {
  if (!walkable(a, obstacles) || !walkable(b, obstacles)) return false;
  for (const box of obstacles) {
    let first = 0, last = 1;
    for (const [axis, low, high] of [['x', 'minX', 'maxX'], ['z', 'minZ', 'maxZ']]) {
      const delta = b[axis] - a[axis];
      if (Math.abs(delta) < 1e-9) { if (a[axis] <= box[low] || a[axis] >= box[high]) { first = 2; break; } }
      else {
        const t1 = (box[low] + 1e-7 - a[axis]) / delta, t2 = (box[high] - 1e-7 - a[axis]) / delta;
        first = Math.max(first, Math.min(t1, t2)); last = Math.min(last, Math.max(t1, t2));
      }
    }
    if (first <= last) return false;
  }
  return true;
}
// Small floor grid, searched only when a trip begins or its destination changes.
// Every diagonal and shortcut is checked with the companion's clearance radius.
export function findWalkingPath(layout, start, end) {
  const obstacles = navigationObstacles(layout);
  if (!walkable(start, obstacles) || !walkable(end, obstacles)) return null;
  if (clearSegment(start, end, obstacles)) return [start, end];
  const width = 56, height = 43, total = width * height;
  const point = index => ({ x: -5.5 + index % width * STEP, z: -4.2 + Math.floor(index / width) * STEP });
  const open = [], costs = new Float32Array(total).fill(Infinity), parent = new Int32Array(total).fill(-1), closed = new Uint8Array(total), allowed = new Uint8Array(total);
  for (let i = 0; i < total; i++) allowed[i] = walkable(point(i), obstacles) ? 1 : 0;
  for (let i = 0; i < total; i++) if (allowed[i] && distance(start, point(i)) < .43 && clearSegment(start, point(i), obstacles)) { costs[i] = distance(start, point(i)); open.push(i); }
  let found = -1;
  while (open.length) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (costs[open[i]] + distance(point(open[i]), end) < costs[open[best]] + distance(point(open[best]), end)) best = i;
    const current = open.splice(best, 1)[0];
    if (closed[current]) continue;
    closed[current] = 1;
    const here = point(current);
    if (distance(here, end) < .43 && clearSegment(here, end, obstacles)) { found = current; break; }
    const x = current % width, z = Math.floor(current / width);
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      if (x + dx < 0 || x + dx >= width || z + dz < 0 || z + dz >= height) continue;
      const next = current + dx + dz * width;
      if (!allowed[next] || closed[next] || !clearSegment(here, point(next), obstacles)) continue;
      const cost = costs[current] + Math.hypot(dx, dz) * STEP;
      if (cost < costs[next]) { costs[next] = cost; parent[next] = current; open.push(next); }
    }
  }
  if (found < 0) return null;
  const chain = [end];
  for (let node = found; node >= 0; node = parent[node]) chain.push(point(node));
  chain.push(start); chain.reverse();
  const result = [start]; let index = 0;
  while (index < chain.length - 1) {
    let next = chain.length - 1;
    while (next > index + 1 && !clearSegment(chain[index], chain[next], obstacles)) next--;
    result.push(chain[next]); index = next;
  }
  return result;
}
export function seatsFor(item) {
  if (!item) return [];
  const desk = getFurniture(item.type)?.category === 'Study';
  if (desk) return [-1, 1].map(side => ({ itemId: item.id, desk: true, seat: localPoint(item, 0, .52), side: localPoint(item, side * .8, .52), portal: localPoint(item, side * .8, 1.5), yaw: item.rotation * Math.PI / 2 }));
  if (!['daybed', 'lounge-chair', 'ottoman'].includes(item.type)) return [];
  return (item.type === 'daybed' ? [-.8, .8, 0] : [0]).map(x => ({ itemId: item.id, desk: false, seat: localPoint(item, x, .17), portal: localPoint(item, x, getFurniture(item.type).footprint[1] / 2 + .45), yaw: item.rotation * Math.PI / 2 + Math.PI, seatHeight: item.type === 'ottoman' ? .57 : .80 }));
}
function usableSeat(layout, seat) {
  const obstacles = navigationObstacles(layout, seat.itemId);
  return clearSegment(seat.seat, seat.side || seat.portal, obstacles) && (!seat.side || clearSegment(seat.side, seat.portal, obstacles));
}
export function planCompanionTrip(layout, source, toDesk) {
  const desk = layout.items.find(item => item.id === layout.activeDeskId);
  const targets = toDesk ? [desk] : layout.items.filter(item => ['daybed', 'lounge-chair', 'ottoman'].includes(item.type)).sort((a, b) => ['daybed', 'lounge-chair', 'ottoman'].indexOf(a.type) - ['daybed', 'lounge-chair', 'ottoman'].indexOf(b.type));
  const starts = source?.seat ? [source] : source?.x != null ? [{ portal: source }] : seatsFor(desk);
  for (const target of targets) {
    if (!target) continue;
    let best = null;
    for (const start of starts) for (const end of seatsFor(target)) {
      if ((start.seat && !usableSeat(layout, start)) || !usableSeat(layout, end)) continue;
      const path = findWalkingPath(layout, start.portal, end.portal);
      if (!path) continue;
      const length = path.reduce((sum, point, i) => sum + (i ? distance(path[i - 1], point) : 0), 0);
      if (!best || length < best.length) best = { start, end, path, length };
    }
    if (best) return best;
  }
  return null;
}

export function createCompanionRoutine(onChange = () => {}) {
  const pose = { state: 'idle', atDesk: true, x: 0, z: 0, yaw: 0, sit: 1, seatHeight: .80, doze: 0, step: 0, moving: false };
  let layout, intent = 'idle', editing = false, anchor = null, trip = null, legs = [], legIndex = 0, elapsed = 0, restTime = 0;
  function status(state) { if (pose.state !== state) { pose.state = state; onChange({ state, atDesk: pose.atDesk }); } }
  function deskPose() {
    const desk = layout?.items.find(item => item.id === layout.activeDeskId);
    if (!desk) return;
    const seat = seatsFor(desk)[0];
    Object.assign(pose, { x: seat.seat.x, z: seat.seat.z, yaw: seat.yaw, atDesk: true, sit: 1, seatHeight: .80, doze: 0, moving: false });
    anchor = null; trip = null; legs = []; restTime = 0;
    status(intent === 'working' ? 'working' : intent === 'break' ? 'resting-at-desk' : 'idle');
  }
  function startTrip(from, toDesk) {
    const planned = planCompanionTrip(layout, from, toDesk);
    if (!planned) return false;
    trip = planned; legs = []; legIndex = 0; elapsed = 0; restTime = 0;
    const add = (a, b, kind, sitFrom = 0, sitTo = 0, yaw = null) => legs.push({ a, b, kind, sitFrom, sitTo, yaw, duration: kind === 'walk' ? distance(a, b) / 1.15 : .85 });
    if (planned.start.seat) {
      add(planned.start.seat, planned.start.side || planned.start.portal, 'rise', 1, 0, planned.start.yaw);
      if (planned.start.side) add(planned.start.side, planned.start.portal, 'walk');
    }
    for (let i = 1; i < planned.path.length; i++) add(planned.path[i - 1], planned.path[i], 'walk');
    if (planned.end.side) add(planned.end.portal, planned.end.side, 'walk');
    add(planned.end.side || planned.end.portal, planned.end.seat, 'sit', 0, 1, planned.end.yaw);
    pose.atDesk = false; pose.doze = 0; pose.moving = true;
    status(toDesk ? 'returning' : 'walking');
    return true;
  }
  function reconcile() {
    if (!layout || editing) return;
    const toDesk = intent !== 'break';
    if (trip) {
      if (trip.end.desk !== toDesk && legs[legIndex]?.kind === 'walk') {
        // Re-plan from the current clear floor position when focus resumes.
        const current = { x: pose.x, z: pose.z };
        if (walkable(current, navigationObstacles(layout))) startTrip(current, toDesk);
      }
      return;
    }
    if (toDesk && !pose.atDesk) { if (!startTrip(anchor, true)) deskPose(); }
    else if (!toDesk && pose.atDesk) { if (!startTrip(null, false)) status('resting-at-desk'); }
    else if (pose.atDesk) status(intent === 'working' ? 'working' : 'idle');
  }
  return {
    pose,
    setLayout(next) {
      layout = next;
      // A resting companion stays put when its seat is unchanged and still
      // clear, e.g. when another tab moves an unrelated plant.
      if (!trip && !pose.atDesk && anchor && !editing) {
        const seat = seatsFor(next.items.find(item => item.id === anchor.itemId)).find(candidate => distance(candidate.seat, anchor.seat) < 1e-6);
        if (seat && usableSeat(next, seat)) { anchor = seat; reconcile(); return; }
      }
      deskPose(); reconcile();
    },
    setIntent(next) { if (!['idle', 'working', 'break'].includes(next) || next === intent) return; intent = next; reconcile(); },
    setEditing(value) { if (editing === value) return; editing = value; if (editing) deskPose(); else reconcile(); },
    update(dt, reducedMotion) {
      if (!layout || editing) return pose;
      if (trip && reducedMotion) {
        const end = trip.end;
        Object.assign(pose, { x: end.seat.x, z: end.seat.z, yaw: end.yaw, sit: 1, seatHeight: end.seatHeight || .80, atDesk: end.desk, moving: false });
        anchor = end; trip = null; legs = []; status(end.desk ? intent === 'working' ? 'working' : 'idle' : 'resting'); reconcile();
      } else if (trip) {
        const leg = legs[legIndex]; elapsed += Math.min(dt, .1);
        const t = Math.min(1, elapsed / Math.max(.001, leg.duration)), amount = leg.kind === 'walk' ? t : ease(t);
        const x = leg.a.x + (leg.b.x - leg.a.x) * amount, z = leg.a.z + (leg.b.z - leg.a.z) * amount;
        if (leg.kind === 'walk') pose.step += Math.hypot(x - pose.x, z - pose.z) * 8;
        pose.x = x; pose.z = z; pose.sit = leg.sitFrom + (leg.sitTo - leg.sitFrom) * amount;
        pose.seatHeight = leg.kind === 'sit' ? trip.end.seatHeight || .80 : trip.start.seatHeight || .80;
        const yaw = leg.yaw ?? Math.atan2(-(leg.b.x - leg.a.x), -(leg.b.z - leg.a.z));
        const turn = Math.atan2(Math.sin(yaw - pose.yaw), Math.cos(yaw - pose.yaw));
        pose.yaw += turn * Math.min(1, dt * 10); pose.moving = leg.kind === 'walk';
        if (t === 1) {
          elapsed = 0; legIndex++;
          if (legIndex === legs.length) {
            const end = trip.end; anchor = end; trip = null; pose.atDesk = end.desk; pose.moving = false; pose.yaw = end.yaw;
            status(end.desk ? intent === 'working' ? 'working' : 'idle' : 'resting'); reconcile();
          } else reconcile();
        }
      } else if (!pose.atDesk && !reducedMotion) {
        restTime += dt;
        if (restTime >= DOZE_AFTER) { status('sleeping'); pose.doze = Math.min(1, (restTime - DOZE_AFTER) / 2); }
      }
      return pose;
    },
    diagnostics() { return { ...pose, intent, destination: trip?.end.itemId || anchor?.itemId || layout?.activeDeskId, path: trip?.path.map(p => ({ ...p })) || [] }; },
  };
}
