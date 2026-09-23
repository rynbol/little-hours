import { getFurniture } from './catalog.js';
import { petBed, ROOM_BOUNDS } from './layout.js';
import { navigationObstacles, walkable, clearSegment, findWalkingPath, localPoint, seatsFor, reachableFloor, reaches, cellPoint } from './companion.js';

// The pet's own day: it naps in its bed, wakes with a stretch, strolls to a
// favorite spot (the fire, the window, a rug, beside you), sits a while and
// walks home to sleep. Pure logic; the room owns the model and the input.
export const PET_RADIUS = 0.25;
export const PETS = Object.freeze({
  cat: Object.freeze({ id: 'cat', name: 'Miso', speed: 0.5 }),
  dog: Object.freeze({ id: 'dog', name: 'Mochi', speed: 0.62 }),
});
export const PET_REACTION = 2.6;
// Half the room the companion takes up where it stands, for walks around it.
const COMPANION_CLEARANCE = 0.2;
const STRETCH = 2.2, SETTLE = 1.6, AFTER_DROP = [3.5, 5];
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const turnToward = (from, to, amount) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * Math.min(1, amount);
const facing = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z));

// The pet leaves its own bed out of the obstacles: it walks onto it to sleep.
export function petObstacles(layout, extra = []) { return navigationObstacles(layout, 'pet-bed', PET_RADIUS, extra); }
export function petHome(layout) {
  const bed = petBed(layout);
  // Asleep, the pet lies across its bed with its face toward the room.
  return bed ? { x: bed.x, z: bed.z, yaw: bed.rotation * Math.PI / 2 - Math.PI / 2 - 0.35, id: bed.id } : null;
}
export function insideBed(layout, point) {
  const bed = petBed(layout); if (!bed) return false;
  const [width, depth] = getFurniture('pet-bed').footprint, w = bed.rotation % 2 ? depth : width, d = bed.rotation % 2 ? width : depth;
  return Math.abs(point.x - bed.x) < w / 2 && Math.abs(point.z - bed.z) < d / 2;
}

// The closest spot to `point` that can still walk home: the point itself
// when it can, or the nearest reachable grid spot. `extra` boxes (where the
// companion stands) are kept clear.
export function landingSpot(layout, point, home, extra = []) {
  const obstacles = petObstacles(layout, extra), reached = reachableFloor(layout, home, obstacles);
  let best = null, bestDistance = Infinity;
  for (let i = 0; i < reached.length; i++) {
    if (!reached[i]) continue;
    const cell = cellPoint(i), gap = Math.hypot(cell.x - point.x, cell.z - point.z);
    if (gap < 0.43 && walkable(point, obstacles) && clearSegment(point, cell, obstacles)) return { x: point.x, z: point.z };
    if (gap < bestDistance) { best = cell; bestDistance = gap; }
  }
  return best;
}

// Favorite places, most loved first. Spots stay clear of every desk-chair
// exit and of the companion's own seat, so the pet never blocks its way.
export function petSpots(layout, { windowX = -2.7, companion = null } = {}) {
  const obstacles = petObstacles(layout), spots = [], home = petHome(layout);
  const desks = layout.items.filter(item => getFurniture(item.type)?.category === 'Study');
  const exits = [...desks.flatMap(item => seatsFor(item)).flatMap(seat => [seat.portal, seat.side]), ...(companion?.portal ? [companion.portal] : [])];
  // A spot also lies clear of the pet's own bed, so every stroll ends with a
  // walk home. A rug under the bed is no place to stroll to.
  // Nor does it sit where the companion stands or is going.
  const clear = point => walkable(point, obstacles) && exits.every(exit => distance(exit, point) > 0.65) && (!companion || (distance(companion, point) > 0.7 && (!companion.to || distance(companion.to, point) > 0.7))) && (!home || distance(home, point) > 0.85);
  const add = (point, yaw, kind) => { if (clear(point)) spots.push({ x: point.x, z: point.z, yaw, kind }); };
  for (const fire of layout.items.filter(item => item.type === 'fireplace' && !item.off)) {
    for (const x of [0, -0.6, 0.6]) add(localPoint(fire, x, getFurniture('fireplace').footprint[1] / 2 + 0.5), fire.rotation * Math.PI / 2, 'fire');
  }
  for (const dx of [0, -0.6, 0.6, -1.2, 1.2]) { const before = spots.length; add({ x: windowX + dx, z: ROOM_BOUNDS.minZ + 0.7 }, 0, 'window'); if (spots.length > before) break; }
  // Beside the active desk, keeping the companion company while it works.
  const desk = desks.find(item => item.id === layout.activeDeskId);
  if (desk) for (const side of [-1, 1]) {
    const point = localPoint(desk, side * (getFurniture(desk.type).footprint[0] / 2 + 0.35), 0.35), before = spots.length;
    add(point, facing(point, localPoint(desk, 0, 0.52)), 'desk'); if (spots.length > before) break;
  }
  for (const rug of layout.items.filter(item => getFurniture(item.type)?.category === 'Rugs')) add({ x: rug.x, z: rug.z }, rug.rotation * Math.PI / 2 + 0.6, 'rug');
  // At the companion's feet while it rests on a sofa or chair.
  if (companion?.seated) for (const side of [-0.75, 0.75]) {
    const c = companion, point = { x: c.x - Math.sin(c.yaw) * 1.05 + Math.cos(c.yaw) * side, z: c.z - Math.cos(c.yaw) * 1.05 - Math.sin(c.yaw) * side };
    add(point, facing(point, c), 'friend');
  }
  // A clear floor spot keeps a crowded room from having nowhere to go.
  for (const [x, z] of [[-3.5, 0], [3.5, 0], [0, 3], [-2, 3.2], [2, -1.5]]) add({ x, z }, x > 0 ? 1.2 : -1.2, 'floor');
  return spots;
}

export function createPetRoutine({ random = Math.random, onChange = () => {} } = {}) {
  // `to` is where a walk ends, so the companion keeps out of the way.
  const pose = { state: 'sleeping', action: 'sleep', x: 0, z: 0, yaw: 0, onBed: true, moving: false, walked: 0, petAge: Infinity, held: false, species: 'cat', to: null };
  let layout = null, editing = false, windowX = -2.7, companion = null, speed = PETS.cat.speed;
  // The floor that leads home, found once per layout.
  let homeFloor = null;
  let timer = 0, trip = null, legIndex = 0, visits = 0, target = null, waited = 0, goHome = false, stall = 0, settleFrom = 0, passed = null;
  const wait = ([low, high]) => low + random() * (high - low);
  function status(next, action = next) {
    pose.action = action;
    if (pose.state !== next) { pose.state = next; onChange({ state: next }); }
  }
  function sleepAtHome(first = false) {
    const home = petHome(layout); if (!home) return;
    Object.assign(pose, { x: home.x, z: home.z, yaw: home.yaw, onBed: true, moving: false, held: false, to: null });
    trip = null; target = null; visits = 0; goHome = false; stall = 0;
    timer = wait(first ? [14, 26] : [32, 62]); status('sleeping', 'sleep');
  }
  // Where the companion stands, or is walking to.
  function companionBoxes() {
    const boxes = [], box = spot => ({ minX: spot.x - COMPANION_CLEARANCE, maxX: spot.x + COMPANION_CLEARANCE, minZ: spot.z - COMPANION_CLEARANCE, maxZ: spot.z + COMPANION_CLEARANCE });
    if (companion && !companion.atDesk) { if (!companion.moving && !companion.seated) boxes.push(box(companion)); if (companion.to) boxes.push(box(companion.to)); }
    return boxes;
  }
  // The walk goes around the companion, unless that closes the only way.
  function walkTo(point, kind) {
    const obstacles = petObstacles(layout), start = walkable(pose, obstacles) ? { x: pose.x, z: pose.z } : null, end = { x: point.x, z: point.z }, boxes = companionBoxes();
    const path = start && ((boxes.length && findWalkingPath(layout, start, end, petObstacles(layout, boxes))) || findWalkingPath(layout, start, end, obstacles));
    if (!path) return false;
    trip = { path, kind, end: point }; legIndex = 1; waited = 0; target = point; pose.to = end;
    pose.moving = true; pose.onBed = false; status(kind === 'home' ? 'returning' : 'walking', 'walk');
    return true;
  }
  function goHomeNow() {
    const home = petHome(layout);
    if (!home) return;
    // At the edge of its bed, the pet steps to the middle before it lies down.
    if (distance(pose, home) < 0.05) { settle(); return; }
    if (!walkTo(home, 'home')) { if (insideBed(layout, pose)) settle(); else sleepAtHome(); }
  }
  // Before it lies down, the pet turns once around in its bed.
  function settle() {
    const home = petHome(layout);
    Object.assign(pose, { x: home.x, z: home.z, onBed: true, moving: false, to: null });
    trip = null; target = null; timer = SETTLE; settleFrom = pose.yaw; status('settling', 'settle');
  }
  function wander() {
    // One flood fill from home finds the spots that the pet can reach and walk
    // home from, so the path search runs for a spot that it can reach.
    if (!homeFloor) { const obstacles = petObstacles(layout); homeFloor = { obstacles, reached: reachableFloor(layout, petHome(layout), obstacles) }; }
    const { obstacles, reached } = homeFloor;
    const spots = petSpots(layout, { windowX, companion }).filter(spot => (!target || distance(spot, target) > 0.8) && reaches(reached, spot, obstacles));
    // Loved spots first, with a little chance so a visit is never the same.
    const ordered = spots.map((spot, index) => ({ spot, score: index + random() * 3 })).sort((a, b) => a.score - b.score).map(entry => entry.spot);
    for (const spot of ordered) if (walkTo(spot, spot.kind)) { visits++; return; }
    // Nowhere else to go: away from home, the pet walks back.
    if (pose.onBed) sleepAtHome(); else goHomeNow();
  }
  function arrive() {
    const end = trip.end, kind = trip.kind; trip = null; pose.moving = false; pose.to = null;
    if (kind === 'home') { settle(); return; }
    pose.x = end.x; pose.z = end.z;
    timer = wait([10, 18]); status('sitting', kind === 'fire' || kind === 'rug' ? 'loaf' : 'sit');
  }
  return {
    pose,
    setSpecies(id) { pose.species = PETS[id] ? id : 'cat'; speed = PETS[pose.species].speed; },
    setLayout(next, { windowX: nextWindow } = {}) {
      const first = !layout; layout = next; homeFloor = null; if (Number.isFinite(nextWindow)) windowX = nextWindow;
      const home = petHome(layout); if (!home) return;
      if (first) { sleepAtHome(true); return; }
      if (pose.held) return;
      // At home, the pet follows its bed, turned or moved, and keeps its nap:
      // a lamp switched elsewhere in the room does not restart the timer.
      if (editing || pose.onBed || ['sleeping', 'settling', 'waking'].includes(pose.state)) {
        const turned = pose.state !== 'settling' && Math.abs(Math.atan2(Math.sin(pose.yaw - home.yaw), Math.cos(pose.yaw - home.yaw))) > 1e-6;
        if (distance(pose, home) > 1e-6 || turned) Object.assign(pose, { x: home.x, z: home.z, yaw: home.yaw, onBed: true });
        return;
      }
      // A piece moved under a sitting or walking pet: it heads home.
      if (!walkable(pose, petObstacles(layout))) { sleepAtHome(); return; }
      if (trip) { if (!walkTo(trip.end, trip.kind)) goHomeNow(); }
    },
    setCompanion(value) { companion = value; },
    setEditing(value) { if (editing === Boolean(value)) return; editing = Boolean(value); if (editing && layout) { pose.held = false; pose.petAge = Infinity; sleepAtHome(); } },
    pet() {
      pose.petAge = 0;
      // A walking pet stops for the fuss, then carries on.
      if (trip && !pose.held) { pose.moving = false; stall = PET_REACTION; }
    },
    pickUp() {
      if (!layout || editing) return false;
      trip = null; target = null; stall = 0; pose.held = true; pose.moving = false; pose.onBed = false; pose.to = null; status('held', 'held'); return true;
    },
    moveHeld(x, z) {
      if (!pose.held) return;
      pose.x = Math.max(ROOM_BOUNDS.minX + PET_RADIUS, Math.min(ROOM_BOUNDS.maxX - PET_RADIUS, x));
      pose.z = Math.max(ROOM_BOUNDS.minZ + PET_RADIUS, Math.min(ROOM_BOUNDS.maxZ - PET_RADIUS, z));
    },
    // The pet lands on the closest clear floor near the drop, beside the
    // companion rather than on it, sits a moment to look around, then walks
    // home. Dropped on its bed, it settles there.
    drop(x = pose.x, z = pose.z) {
      if (!pose.held) return;
      this.moveHeld(x, z); pose.held = false;
      if (insideBed(layout, pose)) { goHomeNow(); return; }
      const home = petHome(layout), spot = landingSpot(layout, pose, home, companionBoxes()) || landingSpot(layout, pose, home);
      if (!spot) { sleepAtHome(); return; }
      pose.x = spot.x; pose.z = spot.z; goHome = true; timer = wait(AFTER_DROP); status('sitting', 'sit');
    },
    update(dt, reducedMotion) {
      if (!layout) return pose;
      // Frames are steady in full motion; reduced motion may pass a long gap.
      if (!reducedMotion) dt = Math.min(dt, 0.1);
      // A pet given in Decorate still ends its heart.
      if (pose.petAge < PET_REACTION) pose.petAge += dt; else pose.petAge = Infinity;
      if (editing || pose.held) return pose;
      if (reducedMotion) {
        // No strolls: the pet stays asleep at home, or snaps home after a drop.
        if (pose.state === 'sitting' && (timer -= dt) <= 0) sleepAtHome();
        else if (!['sitting', 'sleeping'].includes(pose.state)) sleepAtHome();
        return pose;
      }
      // A pet that the companion comes to pet, or is petting, stays put
      // until the fuss ends.
      const fussed = companion?.goal === 'pet' || (companion?.state === 'busy' && companion.activity === 'pet');
      if (pose.state === 'sleeping') { if ((timer -= dt) <= 0 && pose.petAge === Infinity && !fussed) { timer = STRETCH; status('waking', 'stretch'); } }
      else if (pose.state === 'waking') { if ((timer -= dt) <= 0) wander(); }
      else if (pose.state === 'settling') {
        const home = petHome(layout), progress = 1 - Math.max(0, timer -= dt) / SETTLE, turn = Math.atan2(Math.sin(home.yaw - settleFrom), Math.cos(home.yaw - settleFrom)) + Math.PI * 2;
        pose.yaw = settleFrom + turn * progress * progress * (3 - 2 * progress);
        if (timer <= 0) { timer = wait([32, 62]); pose.yaw = home.yaw; status('sleeping', 'sleep'); }
      }
      else if (pose.state === 'sitting') {
        if ((timer -= dt) <= 0 && pose.petAge === Infinity && !fussed) {
          if (!goHome && visits < 2 && random() < 0.45) wander(); else { goHome = false; goHomeNow(); }
        }
      } else if (trip) {
        if (stall > 0) { stall -= dt; pose.moving = false; return pose; }
        const a = trip.path[legIndex - 1], b = trip.path[legIndex];
        const ahead = companion && distance(companion, pose) < 0.75 && ((companion.x - pose.x) * (b.x - pose.x) + (companion.z - pose.z) * (b.z - pose.z)) > 0;
        // The pet walks around a companion that stands in its way, once for
        // each place it stands, and waits for one that walks past, but never forever.
        if (ahead && !companion.moving && !companion.atDesk && !companion.seated && !(passed && distance(passed, companion) < 0.05)) {
          passed = { x: companion.x, z: companion.z };
          if (walkTo(trip.end, trip.kind)) return pose;
        }
        if (ahead && waited < 3) { waited += dt; pose.moving = false; pose.action = 'stand'; return pose; }
        pose.action = 'walk'; pose.moving = true;
        const step = speed * dt, left = distance(pose, b);
        const move = Math.min(step, left), dx = b.x - pose.x, dz = b.z - pose.z;
        if (left > 1e-6) { pose.x += dx / left * move; pose.z += dz / left * move; pose.walked += move; }
        pose.yaw = turnToward(pose.yaw, facing(a, b), dt * 7);
        if (left <= step + 1e-6) { pose.x = b.x; pose.z = b.z; if (++legIndex >= trip.path.length) arrive(); }
      }
      if (pose.state === 'sitting' && target) pose.yaw = turnToward(pose.yaw, target.yaw ?? pose.yaw, dt * 4);
      return pose;
    },
    diagnostics() { return { ...pose, timer, target: target ? { ...target } : null, path: trip?.path.map(point => ({ ...point })) || [] }; },
  };
}
