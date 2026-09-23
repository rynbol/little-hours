import { getFurniture } from './catalog.js';
import { ROOM_BOUNDS } from './layout.js';
import { sessionPhase } from './session.js';

export const COMPANION_RADIUS = 0.24;
export const DOZE_AFTER = 30;
const STEP = 0.2;
const SEATS = ['daybed', 'lounge-chair', 'ottoman'];
// On a break the companion first does one small thing in the room, then
// sits down. Each lasts `seconds`; `useAt` is when it uses its piece.
export const ACTIVITIES = Object.freeze({
  warm: { seconds: 11 }, window: { seconds: 11 }, water: { seconds: 8, useAt: 2.6 },
  record: { seconds: 7, useAt: 2.2 }, pet: { seconds: 8, useAt: 1.4 }, lamp: { seconds: 4.5, useAt: 1.6 },
});
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const ease = t => t * t * (3 - 2 * t);
// The companion faces -z at yaw 0.
const facing = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z));
export function companionIntent(session, now = Date.now()) {
  return { focusing: 'working', break: 'break', idle: 'idle' }[sessionPhase(session, now)];
}
export function localPoint(item, x, z) {
  const angle = item.rotation * Math.PI / 2, c = Math.cos(angle), s = Math.sin(angle);
  return { x: item.x + x * c + z * s, z: item.z - x * s + z * c };
}
// Solid furniture, grown by the walker's clearance. The pet bed is solid
// like any piece; the pet leaves out its own bed (`ignored` by type or id),
// and `extra` boxes (for example, where the pet sits) join them.
export function navigationObstacles(layout, ignoredId, radius = COMPANION_RADIUS, extra = []) {
  const boxes = [...extra];
  for (const item of layout.items) {
    const definition = getFurniture(item.type);
    if (!definition?.blocking || item.id === ignoredId || item.type === ignoredId) continue;
    const [w, d] = item.rotation % 2 ? [...definition.footprint].reverse() : definition.footprint;
    boxes.push({ minX: item.x - w / 2, maxX: item.x + w / 2, minZ: item.z - d / 2, maxZ: item.z + d / 2 });
  }
  const grown = boxes.map(box => ({ minX: box.minX - radius, maxX: box.maxX + radius, minZ: box.minZ - radius, maxZ: box.maxZ + radius }));
  grown.radius = radius;
  return grown;
}
export function walkable(point, obstacles) {
  const radius = obstacles.radius ?? COMPANION_RADIUS;
  return point.x >= ROOM_BOUNDS.minX + radius && point.x <= ROOM_BOUNDS.maxX - radius
    && point.z >= ROOM_BOUNDS.minZ + radius && point.z <= ROOM_BOUNDS.maxZ - radius
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
export function findWalkingPath(layout, start, end, obstacles = navigationObstacles(layout)) {
  if (!walkable(start, obstacles) || !walkable(end, obstacles)) return null;
  if (clearSegment(start, end, obstacles)) return [start, end];
  const width = 56, height = 43, total = width * height;
  const point = index => ({ x: -5.5 + index % width * STEP, z: -4.2 + Math.floor(index / width) * STEP });
  const costs = new Float32Array(total).fill(Infinity), parent = new Int32Array(total).fill(-1), closed = new Uint8Array(total), allowed = new Uint8Array(total);
  // The open set is a binary heap on cost plus distance to go, so each step
  // is logarithmic instead of a scan of every open cell.
  const heap = [], rank = [];
  const push = index => {
    let i = heap.length; heap.push(index); rank.push(costs[index] + distance(point(index), end));
    while (i > 0) { const up = (i - 1) >> 1; if (rank[up] <= rank[i]) break; [heap[up], heap[i], rank[up], rank[i]] = [heap[i], heap[up], rank[i], rank[up]]; i = up; }
  };
  const pop = () => {
    const top = heap[0], lastIndex = heap.pop(), lastRank = rank.pop();
    if (heap.length) {
      heap[0] = lastIndex; rank[0] = lastRank;
      for (let i = 0; ;) {
        const left = i * 2 + 1, right = left + 1; let low = i;
        if (left < heap.length && rank[left] < rank[low]) low = left;
        if (right < heap.length && rank[right] < rank[low]) low = right;
        if (low === i) break;
        [heap[low], heap[i], rank[low], rank[i]] = [heap[i], heap[low], rank[i], rank[low]]; i = low;
      }
    }
    return top;
  };
  for (let i = 0; i < total; i++) allowed[i] = walkable(point(i), obstacles) ? 1 : 0;
  for (let i = 0; i < total; i++) if (allowed[i] && distance(start, point(i)) < .43 && clearSegment(start, point(i), obstacles)) { costs[i] = distance(start, point(i)); push(i); }
  let found = -1;
  while (heap.length) {
    const current = pop();
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
      if (cost < costs[next]) { costs[next] = cost; parent[next] = current; push(next); }
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
  // A single seat also takes a diagonal approach, e.g. past a tea table.
  const approaches = item.type === 'daybed' ? [[-.8, -.8], [.8, .8], [0, 0]] : [[0, 0], [0, -1.25], [0, 1.25]];
  return approaches.map(([x, from]) => ({ itemId: item.id, desk: false, seat: localPoint(item, x, .17), portal: localPoint(item, from, getFurniture(item.type).footprint[1] / 2 + (from === x ? .45 : .2)), yaw: item.rotation * Math.PI / 2 + Math.PI, seatHeight: item.type === 'ottoman' ? .57 : .80 }));
}
function usableSeat(layout, seat) {
  const obstacles = navigationObstacles(layout, seat.itemId);
  return clearSegment(seat.seat, seat.side || seat.portal, obstacles) && (!seat.side || clearSegment(seat.side, seat.portal, obstacles));
}
// The shortest walk from any of `starts` to any of `ends`.
function bestRoute(layout, starts, ends) {
  let best = null;
  for (const start of starts) for (const end of ends) {
    if ((start.seat && !usableSeat(layout, start)) || !usableSeat(layout, end)) continue;
    const path = findWalkingPath(layout, start.portal, end.portal);
    if (!path) continue;
    const length = path.reduce((sum, point, i) => sum + (i ? distance(path[i - 1], point) : 0), 0);
    if (!best || length < best.length) best = { start, end, path, length };
  }
  return best;
}
const routeStarts = (layout, source) => source?.seat ? [source] : source?.x != null ? [{ portal: source }] : seatsFor(layout.items.find(item => item.id === layout.activeDeskId));
export function planCompanionTrip(layout, source, toDesk, seatTypes = SEATS) {
  const desk = layout.items.find(item => item.id === layout.activeDeskId);
  const targets = toDesk ? [desk] : layout.items.filter(item => seatTypes.includes(item.type)).sort((a, b) => SEATS.indexOf(a.type) - SEATS.indexOf(b.type));
  const starts = routeStarts(layout, source);
  for (const target of targets) {
    const best = target && bestRoute(layout, starts, seatsFor(target));
    if (best) return best;
  }
  return null;
}
// A walk to stand at an activity spot, facing its piece.
export function planActivityTrip(layout, source, spot) {
  return bestRoute(layout, routeStarts(layout, source), [{ itemId: spot.itemId, desk: false, activity: spot.kind, seat: spot, portal: spot, yaw: spot.yaw, reach: spot.reach }]);
}
// Where the companion can stand for each activity: before a lit fire, beside
// a plant, at the record player, at the window, beside a still pet, and at
// night beside an unlit floor lamp. `reach` is where its hand goes (y above
// the floor), for the pieces it touches.
export function activitySpots(layout, { night = false, windowX = -2.7, pet = null } = {}) {
  const obstacles = navigationObstacles(layout), spots = [];
  const add = (kind, point, look, itemId = null, reach = null) => {
    if (!walkable(point, obstacles)) return false;
    spots.push({ kind, itemId, x: point.x, z: point.z, yaw: facing(point, look), reach: typeof reach === 'function' ? reach(point) : reach }); return true;
  };
  // In front of a piece first, then beside it, then behind it.
  const around = (item, kind, gap, reach) => {
    const [w, d] = getFurniture(item.type).footprint;
    [[0, d / 2 + gap], [w / 2 + gap, 0], [-w / 2 - gap, 0], [0, -d / 2 - gap]].some(([x, z]) => add(kind, localPoint(item, x, z), item, item.id, reach));
  };
  // A point `by` from `from` toward `to`, at height `y`.
  const toward = (from, to, by, y) => { const d = Math.max(distance(from, to), 1e-6); return { x: from.x + (to.x - from.x) / d * by, z: from.z + (to.z - from.z) / d * by, y }; };
  for (const item of layout.items) {
    const depth = getFurniture(item.type)?.footprint[1] ?? 0;
    if (item.type === 'fireplace' && !item.off) add('warm', localPoint(item, 0, depth / 2 + 0.75), item, item.id);
    else if (item.type === 'plant' || item.type === 'moon-tree') around(item, 'water', 0.45);
    else if (item.type === 'low-cabinet') add('record', localPoint(item, -0.25, depth / 2 + 0.26), localPoint(item, -0.25, 0), item.id, { ...localPoint(item, -0.25, 0.14), y: 1.05 });
    else if (item.type === 'floor-lamp' && item.off && night) around(item, 'lamp', 0.27, spot => toward(item, spot, 0.07, 1.5));
  }
  [0.85, 1.3].some(gap => [0, -0.6, 0.6, -1.2, 1.2].some(dx => add('window', { x: windowX + dx, z: ROOM_BOUNDS.minZ + gap }, { x: windowX + dx, z: ROOM_BOUNDS.minZ - 1 })));
  // Beside the pet while it naps or sits, never while it walks or is carried.
  if (pet && !pet.moving && !pet.held && ['sleeping', 'sitting'].includes(pet.state)) {
    [0.75, 0.95].some(gap => [0, 1, -1, 2, -2, 3, -3, 4].some(k => add('pet', { x: pet.x - Math.sin(pet.yaw + k * Math.PI / 4) * gap, z: pet.z - Math.cos(pet.yaw + k * Math.PI / 4) * gap }, pet, null, spot => toward(pet, spot, 0.2, 0.4))));
  }
  return spots;
}

export function createCompanionRoutine(onChange = () => {}, { onUse = () => {}, random = Math.random } = {}) {
  const pose = { state: 'idle', atDesk: true, x: 0, z: 0, yaw: 0, sit: 1, seatHeight: .80, doze: 0, step: 0, moving: false, activity: null, activityTime: 0, reach: null, useAt: null };
  let layout, intent = 'idle', editing = false, anchor = null, trip = null, legs = [], legIndex = 0, elapsed = 0, restTime = 0;
  // One activity per break; `reduced` is the last reduced-motion setting,
  // which skips standing activities.
  let context = { night: false, windowX: -2.7, pet: null }, breakUsed = false, lastKind = null, used = false, reduced = false;
  function status(state) { if (pose.state !== state) { pose.state = state; onChange({ state, atDesk: pose.atDesk, activity: pose.activity }); } }
  const seatType = end => layout.items.find(item => item.id === end.itemId)?.type;
  function deskPose() {
    const desk = layout?.items.find(item => item.id === layout.activeDeskId);
    if (!desk) return;
    const seat = seatsFor(desk)[0];
    Object.assign(pose, { x: seat.seat.x, z: seat.seat.z, yaw: seat.yaw, atDesk: true, sit: 1, seatHeight: .80, doze: 0, moving: false, activity: null });
    anchor = null; trip = null; legs = []; restTime = 0;
    status(intent === 'working' ? 'working' : intent === 'break' ? 'resting-at-desk' : 'idle');
  }
  function startTrip(from, toDesk, planned = planCompanionTrip(layout, from, toDesk)) {
    if (!planned) return false;
    trip = planned; legs = []; legIndex = 0; elapsed = 0; restTime = 0;
    const add = (a, b, kind, sitFrom = 0, sitTo = 0, yaw = null) => legs.push({ a, b, kind, sitFrom, sitTo, yaw, duration: kind === 'walk' ? distance(a, b) / 1.15 : .85 });
    // An activity spot is stood at, so leaving it needs no rise.
    if (planned.start.seat && !planned.start.activity) {
      add(planned.start.seat, planned.start.side || planned.start.portal, 'rise', 1, 0, planned.start.yaw);
      if (planned.start.side) add(planned.start.side, planned.start.portal, 'walk');
    }
    for (let i = 1; i < planned.path.length; i++) add(planned.path[i - 1], planned.path[i], 'walk');
    if (planned.end.activity) add(planned.end.seat, planned.end.seat, 'turn', 0, 0, planned.end.yaw);
    else {
      if (planned.end.side) add(planned.end.portal, planned.end.side, 'walk');
      add(planned.end.side || planned.end.portal, planned.end.seat, 'sit', 0, 1, planned.end.yaw);
    }
    pose.atDesk = false; pose.doze = 0; pose.moving = true; pose.activity = null;
    status(toDesk ? 'returning' : 'walking');
    return true;
  }
  // A break starts with one activity when one can be reached: at night an
  // unlit lamp comes first, then a new thing each break, reading in the
  // armchair among them. Otherwise the companion goes straight to a seat.
  function startBreak() {
    if (!breakUsed) {
      breakUsed = true;
      const spots = reduced ? [] : activitySpots(layout, context), lamp = spots.find(spot => spot.kind === 'lamp');
      const choices = [...spots.filter(spot => spot.kind !== 'lamp'), ...(layout.items.some(item => item.type === 'lounge-chair') ? [{ kind: 'read' }] : [])]
        .map(choice => ({ choice, score: random() + (choice.kind === lastKind ? 2 : 0) })).sort((a, b) => a.score - b.score).map(entry => entry.choice);
      for (const choice of lamp ? [lamp, ...choices] : choices) {
        const planned = choice.kind === 'read' ? planCompanionTrip(layout, null, false, ['lounge-chair']) : planActivityTrip(layout, null, choice);
        if (planned && startTrip(null, false, planned)) { lastKind = choice.kind; return true; }
      }
    }
    return startTrip(null, false);
  }
  // Done here: on to a seat, or back to the desk when none is free.
  function leaveActivity() {
    const here = { x: pose.x, z: pose.z };
    pose.activity = null;
    if (!startTrip(here, false) && !startTrip(here, true)) deskPose();
  }
  function arrive(end) {
    anchor = end; trip = null; legs = []; pose.atDesk = end.desk; pose.moving = false; pose.yaw = end.yaw;
    pose.activity = end.activity || (!end.desk && seatType(end) === 'lounge-chair' ? 'read' : null); pose.activityTime = 0; pose.reach = end.reach || null; pose.useAt = ACTIVITIES[end.activity]?.useAt ?? null; used = false;
    status(end.desk ? intent === 'working' ? 'working' : 'idle' : end.activity ? 'busy' : 'resting'); reconcile();
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
    else if (!toDesk && pose.atDesk) { if (!startBreak()) status('resting-at-desk'); }
    else if (pose.atDesk) status(intent === 'working' ? 'working' : 'idle');
  }
  return {
    pose,
    setLayout(next) {
      layout = next;
      // A resting or busy companion stays put when its seat or spot is
      // unchanged and still clear, e.g. when another tab moves an unrelated
      // plant. A busy companion whose piece moved walks on from where it is.
      if (!trip && !pose.atDesk && anchor && !editing) {
        if (anchor.activity) {
          const same = spot => spot.kind === anchor.activity && spot.itemId === anchor.itemId && distance(spot, anchor.seat) < 1e-6;
          if (anchor.activity === 'pet' ? walkable(anchor.seat, navigationObstacles(next)) : activitySpots(next, context).some(same)) reconcile();
          else leaveActivity();
          return;
        }
        const seat = seatsFor(next.items.find(item => item.id === anchor.itemId)).find(candidate => distance(candidate.seat, anchor.seat) < 1e-6 && distance(candidate.portal, anchor.portal) < 1e-6);
        if (seat && usableSeat(next, seat)) { anchor = seat; reconcile(); return; }
      }
      deskPose(); reconcile();
    },
    setIntent(next) {
      if (!['idle', 'working', 'break'].includes(next) || next === intent) return;
      intent = next; if (next !== 'break') breakUsed = false; reconcile();
    },
    setEditing(value) { if (editing === value) return; editing = value; if (editing) deskPose(); else reconcile(); },
    // Night, the window and the pet decide which activities there are.
    setContext(next) { context = { ...context, ...next }; },
    update(dt, reducedMotion) {
      reduced = reducedMotion;
      if (!layout || editing) return pose;
      if (trip && reducedMotion) {
        const end = trip.end;
        Object.assign(pose, { x: end.seat.x, z: end.seat.z, yaw: end.yaw, sit: end.activity ? 0 : 1, seatHeight: end.seatHeight || .80, atDesk: end.desk, moving: false });
        arrive(end);
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
          if (legIndex === legs.length) arrive(trip.end);
          else reconcile();
        }
      } else if (pose.state === 'busy') {
        // Reduced motion skips a standing activity; a pet that gets up, or a
        // fire switched off, ends it early.
        const plan = ACTIVITIES[pose.activity], pet = context.pet;
        pose.activityTime += Math.min(dt, .1);
        if (!used && plan.useAt != null && pose.activityTime >= plan.useAt && !reducedMotion) { used = true; onUse({ kind: pose.activity, itemId: anchor.itemId }); }
        const petGone = pose.activity === 'pet' && (!pet || pet.moving || pet.held || distance(pet, anchor.seat) > 1.3);
        const cold = pose.activity === 'warm' && layout.items.find(item => item.id === anchor.itemId)?.off;
        if (reducedMotion || pose.activityTime >= plan.seconds || petGone || cold) leaveActivity();
      } else if (!pose.atDesk && !reducedMotion) {
        restTime += dt; pose.activityTime += Math.min(dt, .1);
        if (restTime >= DOZE_AFTER) { status('sleeping'); pose.doze = Math.min(1, (restTime - DOZE_AFTER) / 2); }
      }
      return pose;
    },
    diagnostics() { return { ...pose, intent, destination: trip?.end.itemId || anchor?.itemId || layout?.activeDeskId, path: trip?.path.map(p => ({ ...p })) || [] }; },
  };
}
