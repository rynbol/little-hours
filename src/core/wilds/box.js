import { createPlayer, pressPlayer, stepPlayer } from './player.js';
import { ATTACKS, hitDamage } from './moves.js';
import { HILL } from './layout.js';

export const DUMMY = Object.freeze({ radius: 0.3, height: 1.65, health: 100, mend: 2.2, refill: 1.1, stiffness: 140, damping: 8, shove: 0.24 });
export const POST = Object.freeze({ radius: 0.17, height: 1.35 });
export const LOCK = Object.freeze({ range: 20, keep: 25, cone: 1.25 });

export function createBox(ground) {
  const player = createPlayer({ ...HILL.spawn, ground });
  const { x, z } = HILL.dummy, base = ground(x, z);
  const dummy = { id: 'dummy', x, z, y: base, radius: DUMMY.radius, bottom: base, top: base + DUMMY.height, health: DUMMY.health, max: DUMMY.health, tiltX: 0, tiltZ: 0, spinX: 0, spinZ: 0, hurt: 0, quiet: 0, broken: 0 };
  const posts = HILL.posts.map(([px, pz], i) => { const y = ground(px, pz); return { id: `post-${i}`, x: px, z: pz, y, radius: POST.radius, bottom: y, top: y + POST.height }; });
  const box = { player, dummy, posts, lock: null, stop: 0, events: [], world: null };
  box.world = { ground, targets: [dummy], solids: [...posts, dummy], bounds: HILL.bounds, updrafts: HILL.updrafts, lock: null };
  return box;
}

const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

export function pickTarget(box, viewYaw) {
  const { player } = box;
  let best = null, bestScore = Infinity;
  for (const target of box.world.targets) {
    const dx = target.x - player.x, dz = target.z - player.z, distance = Math.hypot(dx, dz), off = Math.abs(angleTo(viewYaw, Math.atan2(dx, dz)));
    if (distance > LOCK.range || off > LOCK.cone) continue;
    const score = distance + off * 6;
    if (score < bestScore) { best = target; bestScore = score; }
  }
  return best;
}

export function toggleLock(box, viewYaw) {
  box.lock = box.lock ? null : pickTarget(box, viewYaw)?.id ?? null;
  box.events.push({ type: box.lock ? 'lock' : 'unlock' });
  return box.lock;
}

export const press = (box, action) => pressPlayer(box.player, action);
export const lockTarget = box => box.world.targets.find(target => target.id === box.lock) ?? null;

function strike(box, event) {
  const { dummy, player } = box, attack = ATTACKS[event.attack];
  const damage = hitDamage(attack, event.charge, dummy.max);
  dummy.health = Math.max(0, dummy.health - damage);
  dummy.hurt = 1; dummy.quiet = 0;
  const dx = dummy.x - player.x, dz = dummy.z - player.z, length = Math.hypot(dx, dz) || 1, shove = DUMMY.shove * damage;
  dummy.spinX += dx / length * shove; dummy.spinZ += dz / length * shove;
  box.stop = Math.max(box.stop, attack.hitStop);
  const broke = dummy.health === 0 && !dummy.broken;
  if (broke) dummy.broken = DUMMY.refill;
  box.events.push({ ...event, damage, health: dummy.health, broke });
}

function settleDummy(dummy, dt) {
  dummy.spinX += (-DUMMY.stiffness * dummy.tiltX - DUMMY.damping * dummy.spinX) * dt;
  dummy.spinZ += (-DUMMY.stiffness * dummy.tiltZ - DUMMY.damping * dummy.spinZ) * dt;
  dummy.tiltX += dummy.spinX * dt; dummy.tiltZ += dummy.spinZ * dt;
  dummy.hurt = Math.max(0, dummy.hurt - dt * 5);
  dummy.quiet += dt;
  if (dummy.broken) {
    dummy.broken = Math.max(0, dummy.broken - dt);
    if (!dummy.broken) dummy.health = dummy.max;
  } else if (dummy.quiet > DUMMY.mend) dummy.health = Math.min(dummy.max, dummy.health + dummy.max * dt);
}

export function stepBox(box, input, dt) {
  box.events.length = 0;
  const frozen = Math.min(box.stop, dt);
  box.stop -= frozen;
  const live = dt - frozen;
  if (live <= 0) return box.events;
  const target = lockTarget(box), player = box.player;
  if (target && Math.hypot(target.x - player.x, target.z - player.z) > LOCK.keep) { box.lock = null; box.events.push({ type: 'unlock' }); }
  box.world.lock = lockTarget(box);
  player.events.length = 0;
  stepPlayer(player, input, live, box.world);
  for (const event of player.events) if (event.type === 'hit') strike(box, event); else box.events.push(event);
  settleDummy(box.dummy, live);
  return box.events;
}
