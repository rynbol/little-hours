export const STAG = Object.freeze({
  radius: 1.3, top: 3.1, health: 1100, walk: 2.4, turn: 2.4, track: 1.7, settle: 0.25, roam: 3.4,
  wake: 1.8, stun: 3.8, stagger: 1.4, shift: 2.4, defeat: 4.5, poise: 240, steady: 30, phaseAt: 0.5, heartBonus: 1.8, edge: 1.6,
  rest: Object.freeze([Object.freeze([0.8, 1.3]), Object.freeze([0.5, 0.95])]), ambient: Object.freeze([6.5, 9]),
  retreat: Object.freeze({ every: 3, near: 4.5, speed: 11, least: 0.45, most: 1.2, distance: 7.5 }),
});

export const STAG_ATTACKS = Object.freeze({
  sweep: Object.freeze({ telegraph: 0.75, active: 0.32, recover: 0.9, damage: 16, knock: 6, reach: 4.6, arc: 1.35, near: Object.freeze([0, 5.5]), weight: 3, phase: 1 }),
  stomp: Object.freeze({ telegraph: 0.95, active: 0.7, recover: 1.2, damage: 14, knock: 7, slam: 2.4, slamDamage: 18, ring: Object.freeze([1.4, 10]), band: 0.8, clear: 0.25, near: Object.freeze([0, 7]), weight: 2, phase: 1 }),
  charge: Object.freeze({ telegraph: 0.9, active: 2.2, recover: 1.1, damage: 22, knock: 10, speed: 15, ramp: 0.2, past: 6, length: 28, near: Object.freeze([5, Infinity]), weight: 3, phase: 1 }),
  roots: Object.freeze({ telegraph: 0.8, active: 0, recover: 0.8, damage: 12, knock: 5, spacing: 1.4, length: 20, warn: 0.6, wave: 0.07, rise: 0.4, width: 0.9, near: Object.freeze([4, Infinity]), weight: 3, phase: 2 }),
});

export const AMBIENT_ROOTS = Object.freeze({ damage: 10, knock: 5, spacing: 1.4, warn: 0.9, wave: 0.05, rise: 0.4, width: 0.9 });

const SLEEPING = Object.freeze(['dormant', 'wake', 'shift', 'defeat', 'gone']);
const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const between = (rng, [lo, hi]) => lo + (hi - lo) * rng();

export function createStag(arena) {
  const { x, z } = arena, y = arena.ground(x, z);
  return {
    id: 'stag', x, z, y, facing: arena.facing ?? 0, radius: STAG.radius, bottom: y, top: y + STAG.top,
    health: STAG.health, max: STAG.health, phase: 1, state: 'dormant', time: 0, clock: 0, attack: null, last: null, repeat: 0,
    aimX: 0, aimZ: 0, side: 1, speed: 0, travelled: 0, activeFor: 0, rest: 0, poise: 0, flinch: 0, heartOpen: false,
    roots: [], ambient: 0, since: 0, prefer: null, struck: new Set(), events: [], home: { x, z, facing: arena.facing ?? 0 },
  };
}

export const stagAwake = stag => !SLEEPING.includes(stag.state);
export const stagFighting = stag => stag.state !== 'dormant' && stag.state !== 'gone';

function enter(stag, state) { stag.state = state; stag.time = 0; }

function boundBack(stag) {
  stag.since = 0; stag.prefer = 'charge';
  enter(stag, 'retreat');
  stag.events.push({ type: 'retreat' });
}

export function wakeStag(stag) {
  if (stag.state !== 'dormant') return;
  enter(stag, 'wake');
  stag.events.push({ type: 'wake' });
}

export function resetStag(stag, ground) {
  const { x, z, facing } = stag.home;
  Object.assign(stag, { x, z, facing, y: ground(x, z), health: stag.max, phase: 1, attack: null, last: null, repeat: 0, speed: 0, travelled: 0, poise: 0, flinch: 0, heartOpen: false, ambient: 0, since: 0, prefer: null });
  stag.roots.length = 0; stag.struck.clear();
  enter(stag, 'dormant');
}

function choose(stag, prey, rng) {
  const distance = Math.hypot(prey.x - stag.x, prey.z - stag.z);
  const options = Object.entries(STAG_ATTACKS).filter(([id, attack]) => attack.phase <= stag.phase && distance >= attack.near[0] && distance < attack.near[1] && !(id === stag.last && stag.repeat >= 1));
  if (!options.length) return null;
  if (options.some(([id]) => id === stag.prefer)) return stag.prefer;
  let roll = rng() * options.reduce((sum, [, attack]) => sum + attack.weight, 0);
  for (const [id, attack] of options) { roll -= attack.weight; if (roll <= 0) return id; }
  return options.at(-1)[0];
}

function turnToward(stag, x, z, rate, dt) {
  const turn = angleTo(stag.facing, Math.atan2(x - stag.x, z - stag.z));
  stag.facing += Math.sign(turn) * Math.min(Math.abs(turn), rate * dt);
}

function keepInside(stag, arena) {
  const dx = stag.x - arena.x, dz = stag.z - arena.z, distance = Math.hypot(dx, dz), limit = arena.radius - STAG.edge;
  if (distance > limit) { stag.x = arena.x + dx / distance * limit; stag.z = arena.z + dz / distance * limit; return true; }
  return false;
}

function lineOfRoots(stag, from, to, shape, ambient) {
  const dx = to[0] - from[0], dz = to[1] - from[1], length = Math.hypot(dx, dz), count = Math.max(1, Math.floor(length / shape.spacing));
  for (let i = 0; i <= count; i++) {
    const at = stag.clock + shape.warn + i * shape.wave;
    stag.roots.push({ x: from[0] + dx * i / count, z: from[1] + dz * i / count, warnAt: at - shape.warn, at, until: at + shape.rise, damage: shape.damage, knock: shape.knock, width: shape.width, ambient, hit: new Set() });
  }
  return stag.roots.at(-1).until;
}

function strikeAttack(stag) {
  const attack = STAG_ATTACKS[stag.attack];
  stag.struck.clear();
  if (stag.attack === 'charge') { stag.speed = 0; stag.travelled = 0; stag.facing = Math.atan2(stag.aimX - stag.x, stag.aimZ - stag.z); }
  if (stag.attack === 'roots') {
    const fx = Math.sin(stag.facing), fz = Math.cos(stag.facing), start = [stag.x + fx * (STAG.radius + 0.6), stag.z + fz * (STAG.radius + 0.6)];
    const end = [start[0] + fx * attack.length, start[1] + fz * attack.length];
    stag.activeFor = lineOfRoots(stag, start, end, attack, false) - stag.clock;
    stag.events.push({ type: 'roots' });
  } else stag.activeFor = attack.active;
  if (stag.attack === 'stomp') stag.events.push({ type: 'slam', x: stag.x, z: stag.z });
  stag.events.push({ type: 'strike', attack: stag.attack });
  enter(stag, 'attack');
}

function reachBody(stag, body, from, to) {
  const attack = STAG_ATTACKS[stag.attack], dx = body.x - stag.x, dz = body.z - stag.z, distance = Math.hypot(dx, dz);
  if (stag.attack === 'sweep') {
    if (distance > attack.reach + body.radius || distance < 0.3) return null;
    const off = angleTo(stag.facing, Math.atan2(dx, dz)) * stag.side, a = -attack.arc + 2 * attack.arc * from / attack.active, b = -attack.arc + 2 * attack.arc * to / attack.active;
    return off >= a - 0.05 && off <= b + 0.05 ? { damage: attack.damage, knock: attack.knock } : null;
  }
  if (stag.attack === 'stomp') {
    if (body.airborne > attack.clear) return null;
    if (from < 0.05 && distance < attack.slam + body.radius) return { damage: attack.slamDamage, knock: attack.knock + 2 };
    const r0 = attack.ring[0] + (attack.ring[1] - attack.ring[0]) * from / attack.active, r1 = attack.ring[0] + (attack.ring[1] - attack.ring[0]) * Math.min(1, to / attack.active);
    return distance >= r0 - attack.band / 2 - body.radius && distance <= r1 + attack.band / 2 + body.radius ? { damage: attack.damage, knock: attack.knock } : null;
  }
  if (stag.attack === 'charge') return stag.speed > 2 && distance < STAG.radius + body.radius ? { damage: attack.damage, knock: attack.knock } : null;
  return null;
}

function inCharge(stag, body, facing, within) {
  const fx = Math.sin(facing), fz = Math.cos(facing), dx = body.x - stag.x, dz = body.z - stag.z, along = dx * fx + dz * fz;
  return Math.abs(dx * fz - dz * fx) < STAG.radius + body.radius && along > 0 && along < STAG_ATTACKS.charge.speed * within + STAG.radius + body.radius;
}

export function threatens(stag, body, within) {
  const attack = stag.attack && STAG_ATTACKS[stag.attack];
  if (attack && stag.state === 'telegraph' && stag.attack !== 'roots') {
    const left = attack.telegraph - stag.time;
    if (left <= within) return stag.attack === 'charge' ? inCharge(stag, body, Math.atan2(stag.aimX - stag.x, stag.aimZ - stag.z), within - left) : Boolean(reachBody(stag, body, 0, within - left));
  }
  if (attack && stag.state === 'attack' && !stag.struck.has(body.id)) {
    if (stag.attack === 'charge' && inCharge(stag, body, stag.facing, within)) return true;
    if (stag.attack !== 'charge' && stag.attack !== 'roots' && stag.time < stag.activeFor && reachBody(stag, body, stag.time, Math.min(stag.activeFor, stag.time + within))) return true;
  }
  return stag.roots.some(root => !root.hit.has(body.id) && root.at - stag.clock <= within && root.until > stag.clock && Math.hypot(body.x - root.x, body.z - root.z) <= root.width + body.radius);
}

function charge(stag, dt, arena, stones) {
  const attack = STAG_ATTACKS.charge;
  stag.speed = Math.min(attack.speed, stag.speed + attack.speed / attack.ramp * dt);
  const fx = Math.sin(stag.facing), fz = Math.cos(stag.facing), step = stag.speed * dt;
  stag.x += fx * step; stag.z += fz * step; stag.travelled += step;
  const noseX = stag.x + fx * STAG.radius * 0.9, noseZ = stag.z + fz * STAG.radius * 0.9;
  const stone = stones.find(entry => Math.hypot(noseX - entry.x, noseZ - entry.z) < entry.radius + 0.5);
  if (stone) {
    const back = entryGap(stag, stone);
    stag.x -= fx * back; stag.z -= fz * back;
    stag.speed = 0; stag.heartOpen = true; enter(stag, 'stun');
    stag.events.push({ type: 'stun', stone: stone.id });
    return;
  }
  const past = (stag.aimX - stag.x) * fx + (stag.aimZ - stag.z) * fz < -attack.past;
  if (keepInside(stag, arena) || past || stag.travelled >= attack.length) { stag.speed = 0; enter(stag, 'recover'); stag.events.push({ type: 'skid' }); }
}

function entryGap(stag, stone) {
  const gap = Math.hypot(stag.x - stone.x, stag.z - stone.z) - (stone.radius + STAG.radius * 0.9 + 0.5);
  return Math.max(0, -gap);
}

function eruptions(stag, bodies) {
  const contacts = [];
  for (const root of stag.roots) {
    if (stag.clock < root.at || stag.clock > root.until) continue;
    for (const body of bodies) {
      if (root.hit.has(body.id) || Math.hypot(body.x - root.x, body.z - root.z) > root.width + body.radius) continue;
      root.hit.add(body.id);
      contacts.push({ type: 'contact', who: body.id, attack: root.ambient ? 'thicket' : 'roots', damage: root.damage, knock: root.knock, fromX: root.x, fromZ: root.z });
    }
  }
  return contacts;
}

export function stepStag(stag, { prey, bodies, arena, stones, rng }, dt) {
  stag.clock += dt; stag.time += dt;
  stag.flinch = Math.max(0, stag.flinch - dt * 4);
  stag.poise = Math.max(0, stag.poise - STAG.steady * dt);
  stag.roots = stag.roots.filter(root => root.until > stag.clock);
  if (stag.phase === 2 && stagAwake(stag)) {
    stag.ambient -= dt;
    if (stag.ambient <= 0) {
      stag.ambient = between(rng, STAG.ambient);
      const angle = rng() * Math.PI * 2, offset = (rng() - 0.5) * arena.radius, half = Math.sqrt(arena.radius ** 2 - offset ** 2) - 0.5;
      const cx = arena.x + Math.cos(angle) * offset, cz = arena.z + Math.sin(angle) * offset, ax = -Math.sin(angle), az = Math.cos(angle);
      lineOfRoots(stag, [cx - ax * half, cz - az * half], [cx + ax * half, cz + az * half], AMBIENT_ROOTS, true);
      stag.events.push({ type: 'thicket' });
    }
  }
  const state = stag.state, attack = stag.attack && STAG_ATTACKS[stag.attack];
  if (state === 'wake' && stag.time >= STAG.wake) { enter(stag, 'idle'); stag.rest = 1; }
  else if (state === 'shift' && stag.time >= STAG.shift) { enter(stag, 'idle'); stag.rest = 0.6; stag.ambient = 1.5; }
  else if (state === 'defeat' && stag.time >= STAG.defeat) { enter(stag, 'gone'); stag.roots.length = 0; stag.events.push({ type: 'gone' }); }
  else if (state === 'stun' && stag.time >= STAG.stun) { stag.heartOpen = false; enter(stag, 'recover'); stag.attack = null; stag.events.push({ type: 'rise' }); }
  else if (state === 'stagger' && stag.time >= STAG.stagger) boundBack(stag);
  else if (state === 'recover' && stag.time >= (attack?.recover ?? 0.6)) {
    stag.attack = null;
    if (++stag.since >= STAG.retreat.every && Math.hypot(prey.x - stag.x, prey.z - stag.z) < STAG.retreat.near + STAG.radius) boundBack(stag);
    else { enter(stag, 'idle'); stag.rest = between(rng, STAG.rest[stag.phase - 1]); }
  }
  else if (state === 'retreat') {
    const away = Math.atan2(stag.x - prey.x, stag.z - prey.z), pace = STAG.retreat.speed * Math.min(1, stag.time / 0.12);
    stag.x += Math.sin(away) * pace * dt; stag.z += Math.cos(away) * pace * dt;
    turnToward(stag, prey.x, prey.z, STAG.turn, dt);
    keepInside(stag, arena);
    const clear = Math.hypot(prey.x - stag.x, prey.z - stag.z) >= STAG.retreat.distance;
    if ((clear && stag.time >= STAG.retreat.least) || stag.time >= STAG.retreat.most) { enter(stag, 'idle'); stag.rest = 0.2; }
  }
  else if (state === 'idle') {
    const distance = Math.hypot(prey.x - stag.x, prey.z - stag.z);
    turnToward(stag, prey.x, prey.z, STAG.turn, dt);
    if (distance > STAG.roam + STAG.radius) {
      const fx = Math.sin(stag.facing), fz = Math.cos(stag.facing), pace = STAG.walk * Math.max(0, Math.cos(angleTo(stag.facing, Math.atan2(prey.x - stag.x, prey.z - stag.z))));
      stag.x += fx * pace * dt; stag.z += fz * pace * dt; keepInside(stag, arena);
    }
    stag.rest -= dt;
    if (stag.rest <= 0 && Math.abs(angleTo(stag.facing, Math.atan2(prey.x - stag.x, prey.z - stag.z))) < 0.6) {
      const id = choose(stag, prey, rng);
      if (id) {
        stag.repeat = id === stag.last ? stag.repeat + 1 : 0; stag.last = id; stag.attack = id; stag.side = rng() < 0.5 ? 1 : -1; stag.prefer = null;
        enter(stag, 'telegraph');
        stag.events.push({ type: 'telegraph', attack: id });
      }
    }
  } else if (state === 'telegraph') {
    if (stag.time < attack.telegraph - (stag.attack === 'sweep' ? 0 : STAG.settle)) { turnToward(stag, prey.x, prey.z, STAG.track, dt); stag.aimX = prey.x; stag.aimZ = prey.z; }
    if (stag.time >= attack.telegraph) strikeAttack(stag);
  }
  const contacts = [];
  if (stag.state === 'attack') {
    const from = Math.max(0, stag.time - dt), to = Math.min(stag.time, stag.activeFor);
    if (stag.attack === 'charge') charge(stag, dt, arena, stones);
    if (stag.state === 'attack' && from < stag.activeFor) {
      for (const body of bodies) {
        const reach = !stag.struck.has(body.id) && reachBody(stag, body, from, to);
        if (!reach) continue;
        stag.struck.add(body.id);
        contacts.push({ type: 'contact', who: body.id, attack: stag.attack, ...reach, fromX: stag.x, fromZ: stag.z });
      }
    }
    if (stag.state === 'attack' && stag.time >= stag.activeFor) { stag.speed = 0; enter(stag, 'recover'); }
  }
  contacts.push(...eruptions(stag, bodies));
  stag.y = arena.ground(stag.x, stag.z); stag.bottom = stag.y; stag.top = stag.y + STAG.top;
  stag.events.push(...contacts);
  return stag.events;
}

export function hurtStag(stag, amount) {
  if (!stagAwake(stag) || amount <= 0) return 0;
  const before = stag.health;
  stag.health = Math.max(0, stag.health - amount);
  stag.flinch = 1;
  if (stag.health === 0) {
    stag.heartOpen = false; stag.attack = null; stag.roots.length = 0;
    enter(stag, 'defeat');
    stag.events.push({ type: 'defeat' });
  } else if (stag.phase === 1 && stag.health <= stag.max * STAG.phaseAt) {
    stag.phase = 2; stag.heartOpen = false; stag.attack = null; stag.poise = 0;
    enter(stag, 'shift');
    stag.events.push({ type: 'phase' });
  } else if (stag.state !== 'stun' && !(stag.state === 'attack' && stag.attack === 'charge')) {
    stag.poise += amount;
    if (stag.poise >= STAG.poise) { stag.poise = 0; stag.attack = null; enter(stag, 'stagger'); stag.events.push({ type: 'stagger' }); }
  }
  return before - stag.health;
}
