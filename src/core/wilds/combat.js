import { createMovementState, stepMovement, obstacleRadiusBetween } from './movement.js';
import { normalizeWilds, wildsStats } from './progression.js';
import { ATTACKS, DODGE, SWORD_COMBO } from './attacks.js';
export { SWORD_COMBO } from './attacks.js';

export const WARDEN_ARENA = Object.freeze({
  center: Object.freeze({ x: -132, y: -30.999003887176514, z: -215 }),
  radius: 18,
  triggerRadius: 22,
  resetRadius: 40,
  stones: Object.freeze([[-8, -8], [8, -8], [-8, 8], [8, 8]].map(([x, z], index) => Object.freeze({ id: `warden-stone-${index}`, x: -132 + x, z: -215 + z, radius: 1.1, height: 3.8 }))),
});

const BOSS_ID = 'mossback-warden';
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const directionTo = (a, b) => { const length = distance(a, b) || 1; return { x: (b.x - a.x) / length, z: (b.z - a.z) / length }; };
const yawOf = direction => Math.atan2(-direction.x, -direction.z);
const groundPosition = (position, world) => ({ ...position, y: world.surfaceAt(position.x, position.z)?.height ?? position.y ?? 0 });
const segmentDistance = (point, a, b) => {
  const dx = b.x - a.x, dz = b.z - a.z, length = dx * dx + dz * dz;
  const t = length ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / length)) : 0;
  return distance(point, { x: a.x + t * dx, z: a.z + t * dz });
};

function contactReaches(from, to, spec, world) {
  if (distance(from, to) > spec.range || Math.abs(from.y - to.y) > spec.heightRange) return false;
  const low = Math.min(from.y, to.y) + .7, high = Math.max(from.y, to.y) + 1.2;
  return !(world.obstacles || []).some(obstacle => {
    const baseY = obstacle.baseY ?? world.surfaceAt(obstacle.x, obstacle.z)?.height ?? 0;
    if (baseY > high || baseY + obstacle.height < low) return false;
    return segmentDistance(obstacle, from, to) < obstacleRadiusBetween({ ...obstacle, baseY }, low, high);
  });
}

function newBoss(arena, defeated = false) {
  return {
    id: BOSS_ID, name: 'Mossback Warden', position: { ...arena.center }, yaw: 0,
    health: defeated ? 0 : 420, maxHealth: 420, phase: 1,
    mode: defeated ? 'defeated' : 'idle', action: defeated ? 'defeat' : 'idle', actionStartedAt: 0,
    move: null, engaged: false, exposedUntil: 0, telegraph: null,
    nextActionAt: 0, patternIndex: 0, chargeHit: false,
  };
}

export function createCombatState({ player, progress, petId = 'cat', bondIndex = 0, arena = WARDEN_ARENA }) {
  progress = normalizeWilds(progress);
  const stats = wildsStats(progress.totalXp), bond = Math.max(0, Math.min(3, Math.floor(bondIndex) || 0));
  const maxHealth = Math.round(70 * (1 + .15 * bond));
  return {
    player: { ...player, health: stats.maxHealth, maxHealth: stats.maxHealth, maxStamina: stats.maxStamina, stamina: Math.min(player.stamina, stats.maxStamina), attack: stats.attack, invulnerableUntil: 0 },
    playerAction: null,
    pet: {
      id: petId || 'cat', position: { ...player.position, x: player.position.x + 1.5, z: player.position.z + 1.5 }, yaw: player.yaw,
      health: maxHealth, maxHealth, damage: Math.round(7 * (1 + .2 * bond)), skillDamage: Math.round(24 * (1 + .2 * bond)),
      cooldownMs: Math.round(14000 * (1 - .08 * bond)), skillReadyAt: 0, recoverAt: 0, nextAttackAt: 0,
      mode: 'follow', action: 'idle', actionStartedAt: 0, targetId: null, skillQueued: false, contact: null,
    },
    boss: newBoss(arena, Boolean(progress.bossVictories[BOSS_ID])),
    targetId: null, progress, arena, now: 0,
  };
}

function beginAttack(state, now, comboIndex, events) {
  if (state.player.stamina < 6 || !state.player.grounded) return;
  const move = SWORD_COMBO[comboIndex];
  state.player.stamina -= 6;
  state.player.lastSpentAt = now;
  state.playerAction = { kind: 'attack', startedAt: now, durationMs: move.durationMs, comboIndex, hitAt: now + move.hitMs, hitDone: false, buffered: false };
  events.push({ type: 'attack', comboIndex, at: now });
}

function beginDodge(state, input, now, events) {
  if (state.playerAction || !state.player.grounded || state.player.stamina < 24) return;
  const yaw = input.cameraYaw ?? state.player.yaw, forward = input.forward || 0, strafe = input.strafe || 0;
  const length = Math.hypot(forward, strafe);
  const direction = length ? { x: (-Math.sin(yaw) * forward + Math.cos(yaw) * strafe) / length, z: (-Math.cos(yaw) * forward - Math.sin(yaw) * strafe) / length }
    : { x: -Math.sin(state.player.yaw), z: -Math.cos(state.player.yaw) };
  state.player.stamina -= 24;
  state.player.lastSpentAt = now;
  state.playerAction = { kind: 'dodge', startedAt: now, durationMs: DODGE.durationMs, direction };
  events.push({ type: 'dodge', at: now });
}

function defeatBoss(state, now, events) {
  const boss = state.boss;
  boss.health = 0;
  boss.mode = 'defeated'; boss.action = 'defeat'; boss.actionStartedAt = now;
  boss.engaged = false; boss.telegraph = null; boss.move = null;
  state.targetId = null;
  state.pet.targetId = null; state.pet.mode = state.pet.health ? 'follow' : 'knockout';
  state.pet.contact = null; state.pet.skillQueued = false;
  const reward = state.progress.bossVictories[boss.id] ? null : { xp: 260, materials: { heartwood: 1 }, trophy: boss.id };
  events.push({ type: 'boss-defeated', bossId: boss.id, reward, at: now });
  if (state.progress.bossVictories[boss.id]) return;
  const before = wildsStats(state.progress.totalXp);
  state.progress = normalizeWilds({
    ...state.progress,
    totalXp: state.progress.totalXp + 260,
    materials: { ...state.progress.materials, heartwood: (state.progress.materials.heartwood || 0) + 1 },
    bossVictories: { ...state.progress.bossVictories, [boss.id]: 1 },
    trophies: [...state.progress.trophies, boss.id],
  });
  const after = wildsStats(state.progress.totalXp);
  state.player.maxHealth = after.maxHealth; state.player.maxStamina = after.maxStamina; state.player.attack = after.attack;
  if (after.level > before.level) {
    state.player.health = after.maxHealth; state.player.stamina = after.maxStamina;
    events.push({ type: 'level-up', level: after.level, previousLevel: before.level, at: now });
  }
  events.push({ type: 'progress-changed', progress: state.progress, at: now });
}

function hitBoss(state, amount, sourceId, now, events, attackId) {
  const boss = state.boss;
  if (boss.mode === 'defeated' || boss.mode === 'phase') return;
  const exposed = boss.mode === 'exposed' && now <= boss.exposedUntil;
  const damage = Math.max(1, Math.round(amount * (exposed ? 1.8 : 1) * (exposed && sourceId !== 'player' ? 1.1 : 1)));
  boss.health = Math.max(0, boss.health - damage);
  events.push({ type: 'damage', targetId: boss.id, sourceId, amount: damage, exposed, at: now });
  events.push({ type: 'hit-stop', durationMs: ATTACKS[attackId].hitStopMs, attackId, at: now });
  if (!boss.health) defeatBoss(state, now, events);
}

function hitPlayer(state, amount, now, events) {
  const dodge = state.playerAction?.kind === 'dodge' ? now - state.playerAction.startedAt : -1;
  if (now < state.player.invulnerableUntil || (dodge >= DODGE.invulnerableFromMs && dodge <= DODGE.invulnerableToMs)) {
    events.push({ type: 'evade', targetId: 'player', at: now });
    return;
  }
  state.player.health = Math.max(0, state.player.health - amount);
  state.player.invulnerableUntil = now + 500;
  events.push({ type: 'damage', targetId: 'player', sourceId: BOSS_ID, amount, at: now });
  events.push({ type: 'hit-stop', durationMs: ATTACKS[`warden-${state.boss.move}`].hitStopMs, attackId: `warden-${state.boss.move}`, at: now });
}

function hitPet(state, amount, now, events) {
  const pet = state.pet;
  if (!pet.health) return;
  pet.health = Math.max(0, pet.health - amount);
  events.push({ type: 'damage', targetId: pet.id, sourceId: BOSS_ID, amount, at: now });
  events.push({ type: 'hit-stop', durationMs: ATTACKS[`warden-${state.boss.move}`].hitStopMs, attackId: `warden-${state.boss.move}`, at: now });
  if (!pet.health) {
    pet.mode = 'knockout'; pet.action = 'knockout'; pet.actionStartedAt = now;
    pet.targetId = null; pet.recoverAt = now + 30000;
    pet.contact = null; pet.skillQueued = false;
    events.push({ type: 'pet-knockout', petId: pet.id, at: now });
  }
}

function usePetSkill(state, now, events) {
  const pet = state.pet;
  if (!pet.health || now < pet.skillReadyAt || state.boss.mode === 'defeated' || state.boss.mode === 'phase') return;
  if (state.targetId !== BOSS_ID && pet.targetId !== BOSS_ID) return;
  if (distance(pet.position, state.boss.position) > ATTACKS['pet-skill'].commandRange) return;
  pet.mode = 'fight'; pet.targetId = BOSS_ID;
  pet.skillQueued = true;
}

function commands(state, input, now, events) {
  const actions = new Set(input.actions || []), boss = state.boss;
  if (actions.has('lock')) {
    state.targetId = state.targetId ? null : boss.health > 0 && distance(state.player.position, boss.position) <= 70 ? BOSS_ID : null;
    if (state.pet.mode !== 'recall' && state.pet.health) { state.pet.targetId = state.targetId; state.pet.mode = state.targetId ? 'fight' : 'follow'; }
    if (!state.pet.targetId) { state.pet.contact = null; state.pet.skillQueued = false; }
    events.push({ type: 'lock-changed', targetId: state.targetId, at: now });
  }
  if (actions.has('recall') && state.pet.health) {
    state.pet.mode = 'recall'; state.pet.targetId = null; state.pet.skillQueued = false; state.pet.contact = null; state.pet.action = 'move';
    events.push({ type: 'pet-recall', at: now });
  }
  if (actions.has('command') && state.pet.health && boss.health && distance(state.player.position, boss.position) <= 70) {
    state.pet.mode = 'fight'; state.pet.targetId = BOSS_ID;
    events.push({ type: 'pet-command', targetId: BOSS_ID, at: now });
  }
  if (actions.has('skill')) usePetSkill(state, now, events);
  if (actions.has('dodge')) beginDodge(state, input, now, events);
  if (actions.has('attack')) {
    if (!state.playerAction) beginAttack(state, now, 0, events);
    else if (state.playerAction.kind === 'attack' && state.playerAction.comboIndex < 2) state.playerAction.buffered = true;
  }
}

function playerAction(state, world, now, events) {
  const action = state.playerAction;
  if (!action) return;
  if (action.kind === 'attack' && !action.hitDone && now >= action.hitAt) {
    action.hitDone = true;
    const direction = directionTo(state.player.position, state.boss.position);
    const facing = -Math.sin(state.player.yaw) * direction.x - Math.cos(state.player.yaw) * direction.z;
    const spec = SWORD_COMBO[action.comboIndex];
    if (contactReaches(state.player.position, state.boss.position, spec, world) && facing > spec.facingCosine) {
      hitBoss(state, state.player.attack * spec.multiplier, 'player', now, events, spec.id);
    }
  }
  if (now >= action.startedAt + action.durationMs) {
    state.playerAction = null;
    if (action.kind === 'attack' && action.buffered && action.comboIndex < 2) beginAttack(state, action.startedAt + action.durationMs, action.comboIndex + 1, events);
  }
}

function beginBossMove(state, now, events) {
  const boss = state.boss, pattern = boss.phase === 1 ? ['charge', 'sweep', 'slam'] : ['charge', 'roots', 'sweep', 'slam', 'roots'];
  const move = pattern[boss.patternIndex++ % pattern.length], spec = ATTACKS[`warden-${move}`];
  const direction = directionTo(boss.position, state.player.position);
  boss.mode = 'telegraph'; boss.action = spec.clip; boss.actionStartedAt = now;
  boss.move = move; boss.yaw = yawOf(direction); boss.nextActionAt = now + spec.hitMs;
  boss.telegraph = { kind: move, origin: { ...boss.position }, direction, radius: spec.radius, length: spec.length, width: spec.width };
  events.push({ type: 'boss-telegraph', move, at: now });
}

function attackContains(telegraph, position) {
  const dx = position.x - telegraph.origin.x, dz = position.z - telegraph.origin.z;
  if (telegraph.kind === 'roots') {
    const along = dx * telegraph.direction.x + dz * telegraph.direction.z;
    const across = Math.abs(dx * telegraph.direction.z - dz * telegraph.direction.x);
    return along >= -.5 && along <= telegraph.length && across <= telegraph.width / 2 + .34;
  }
  return Math.hypot(dx, dz) <= telegraph.radius + .34;
}

function bossStep(state, world, deltaMs, now, events) {
  const boss = state.boss;
  boss.position = groundPosition(boss.position, world);
  if (boss.mode === 'defeated') return;
  const fromCenter = distance(state.player.position, state.arena.center);
  if (boss.engaged && fromCenter > (state.arena.resetRadius ?? 40)) {
    state.boss = newBoss(state.arena); state.boss.position = groundPosition(state.boss.position, world);
    state.targetId = null; state.pet.targetId = null;
    state.pet.contact = null; state.pet.skillQueued = false;
    if (state.pet.health) state.pet.mode = 'follow';
    events.push({ type: 'boss-reset', at: now });
    return;
  }
  if (!boss.engaged) {
    if (fromCenter > (state.arena.triggerRadius ?? 22) && boss.health === boss.maxHealth) return;
    boss.engaged = true; boss.nextActionAt = now + 1000;
    events.push({ type: 'boss-engaged', at: now });
  }
  if (boss.phase === 1 && boss.health <= boss.maxHealth / 2 && boss.mode !== 'exposed') {
    boss.phase = 2; boss.mode = 'phase'; boss.action = 'phase'; boss.actionStartedAt = now;
    boss.nextActionAt = now + 1500; boss.telegraph = null; boss.patternIndex = 0;
    events.push({ type: 'boss-phase', phase: 2, at: now });
    return;
  }
  if (boss.mode === 'charge') {
    const before = boss.position, direction = boss.telegraph.direction, travel = ATTACKS['warden-charge'].speed * deltaMs / 1000;
    const next = groundPosition({ x: before.x + direction.x * travel, y: before.y, z: before.z + direction.z * travel }, world);
    const stone = state.arena.stones.find(item => segmentDistance(item, before, next) <= item.radius + 1.25);
    boss.position = next;
    if (stone) {
      const away = directionTo(stone, before);
      boss.position = groundPosition({ x: stone.x + away.x * (stone.radius + 1.25), z: stone.z + away.z * (stone.radius + 1.25), y: next.y }, world);
      boss.mode = 'exposed'; boss.action = 'stagger'; boss.actionStartedAt = now;
      boss.exposedUntil = now + 4500; boss.nextActionAt = boss.exposedUntil; boss.telegraph = null;
      events.push({ type: 'boss-exposed', until: boss.exposedUntil, stoneId: stone.id, at: now });
      return;
    }
    if (!boss.chargeHit && segmentDistance(state.player.position, before, next) <= ATTACKS['warden-charge'].contactRadius) {
      hitPlayer(state, ATTACKS['warden-charge'].damage, now, events); boss.chargeHit = true;
    }
    if (!boss.petChargeHit && segmentDistance(state.pet.position, before, next) <= ATTACKS['warden-charge'].contactRadius) {
      hitPet(state, ATTACKS['warden-charge'].damage, now, events); boss.petChargeHit = true;
    }
    if (now >= boss.nextActionAt || distance(boss.position, state.arena.center) >= state.arena.radius + 5) {
      boss.mode = 'recovery'; boss.action = 'idle'; boss.actionStartedAt = now; boss.nextActionAt = now + ATTACKS['warden-charge'].recoveryMs; boss.telegraph = null;
    }
    return;
  }
  if (now < boss.nextActionAt) return;
  if (boss.mode === 'telegraph') {
    if (boss.move === 'charge') {
      boss.mode = 'charge'; boss.nextActionAt = now + ATTACKS['warden-charge'].durationMs; boss.chargeHit = false; boss.petChargeHit = false;
      return;
    }
    if (attackContains(boss.telegraph, state.player.position)) hitPlayer(state, ATTACKS[`warden-${boss.move}`].damage, now, events);
    if (attackContains(boss.telegraph, state.pet.position)) hitPet(state, ATTACKS[`warden-${boss.move}`].damage, now, events);
    events.push({ type: 'boss-strike', move: boss.move, at: now });
    boss.mode = 'recovery'; boss.action = 'idle'; boss.actionStartedAt = now;
    boss.nextActionAt = now + ATTACKS[`warden-${boss.move}`].recoveryMs; boss.telegraph = null;
    return;
  }
  beginBossMove(state, now, events);
}

function petStep(state, world, deltaMs, now, events) {
  const pet = state.pet;
  if (!pet.health) {
    if (now < pet.recoverAt) return;
    pet.health = pet.maxHealth; pet.mode = state.targetId ? 'fight' : 'follow'; pet.targetId = state.targetId;
    pet.action = 'recover'; pet.actionStartedAt = now;
    pet.position = { ...state.player.position, x: state.player.position.x + 1 };
    events.push({ type: 'pet-recovered', petId: pet.id, at: now });
  }
  const fighting = pet.mode === 'fight' && pet.targetId === BOSS_ID && state.boss.health > 0;
  if (pet.contact) {
    const contact = pet.contact, spec = ATTACKS[contact.attackId];
    if (!contact.hitDone && now >= contact.startedAt + spec.hitMs) {
      contact.hitDone = true;
      if (fighting && contactReaches(pet.position, state.boss.position, spec, world)) {
        hitBoss(state, contact.attackId === 'pet-skill' ? pet.skillDamage : pet.damage, pet.id, now, events, spec.id);
      }
    }
    if (now < contact.startedAt + spec.durationMs) return;
    pet.contact = null;
  }
  const target = fighting ? state.boss.position : { x: state.player.position.x + Math.sin(state.player.yaw) * 2, z: state.player.position.z + Math.cos(state.player.yaw) * 2 };
  const gap = distance(pet.position, target), stop = fighting ? 2.1 : 1;
  if (gap > stop) {
    const direction = directionTo(pet.position, target), travel = Math.min(gap - stop, (fighting ? 7 : 8.5) * deltaMs / 1000);
    const moved = stepMovement(createMovementState({ position: pet.position }), {}, world, deltaMs, now, { forcedVelocity: { x: direction.x * travel * 1000 / deltaMs, z: direction.z * travel * 1000 / deltaMs } });
    pet.position = moved.state.position; pet.yaw = yawOf(direction);
    if (now - pet.actionStartedAt >= 450) pet.action = 'move';
  } else if (now - pet.actionStartedAt >= 650) pet.action = 'idle';
  const spec = ATTACKS[pet.skillQueued ? 'pet-skill' : 'pet-strike'];
  if (fighting && contactReaches(pet.position, state.boss.position, spec, world) && (pet.skillQueued || now >= pet.nextAttackAt) && now - pet.actionStartedAt >= 450) {
    pet.action = pet.skillQueued ? 'skill' : 'attack'; pet.actionStartedAt = now;
    pet.contact = { attackId: spec.id, startedAt: now, hitDone: false };
    pet.nextAttackAt = now + ATTACKS['pet-strike'].recoveryMs;
    if (pet.skillQueued) {
      pet.skillQueued = false; pet.skillReadyAt = now + pet.cooldownMs;
      events.push({ type: 'pet-skill', petId: pet.id, at: now });
    } else events.push({ type: 'pet-attack', petId: pet.id, at: now });
  }
}

function respawn(state, world, now, events) {
  const spawn = world.spawn || state.player.safePosition;
  state.player = { ...state.player, ...createMovementState({ position: groundPosition(spawn, world), yaw: spawn.yaw || 0, stamina: state.player.maxStamina, maxStamina: state.player.maxStamina }), health: state.player.maxHealth, invulnerableUntil: now + 2000 };
  state.playerAction = null; state.targetId = null;
  state.boss = newBoss(state.arena, Boolean(state.progress.bossVictories[BOSS_ID]));
  state.pet.health = state.pet.maxHealth; state.pet.mode = 'follow'; state.pet.targetId = null;
  state.pet.position = { ...state.player.position, x: state.player.position.x + 1 }; state.pet.action = 'recover'; state.pet.actionStartedAt = now;
  state.pet.contact = null; state.pet.skillQueued = false;
  events.push({ type: 'player-defeated', at: now });
}

export function stepCombat(previous, input, world, deltaMs, now) {
  const state = {
    ...previous, now, player: { ...previous.player }, playerAction: previous.playerAction ? { ...previous.playerAction } : null,
    boss: { ...previous.boss, position: { ...previous.boss.position } }, pet: { ...previous.pet, position: { ...previous.pet.position }, contact: previous.pet.contact ? { ...previous.pet.contact } : null },
  };
  const events = [], duration = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0;
  if (!duration) return { state, events };
  const stones = state.arena.stones.map(stone => ({ ...stone, baseY: world.surfaceAt(stone.x, stone.z)?.height ?? stone.baseY ?? 0 }));
  const collisionWorld = { ...world, obstacles: [...(world.obstacles || []), ...stones.filter(stone => !(world.obstacles || []).some(existing => existing.id === stone.id))] };
  let at = now - duration;
  state.boss.position = groundPosition(state.boss.position, world);
  commands(state, input, at, events);
  while (at < now - .000001) {
    const milliseconds = Math.min(25, now - at), action = state.playerAction;
    const movementInput = action ? { ...input, forward: 0, strafe: 0, sprint: false, climb: false, jump: false } : input;
    const forcedVelocity = action?.kind === 'dodge' ? { x: action.direction.x * DODGE.speed, z: action.direction.z * DODGE.speed } : null;
    const playerWorld = state.boss.health > 0 ? { ...collisionWorld, obstacles: [...collisionWorld.obstacles, { x: state.boss.position.x, z: state.boss.position.z, baseY: state.boss.position.y, height: 3.5, radius: 1.25 }] } : collisionWorld;
    const movement = stepMovement(state.player, movementInput, playerWorld, milliseconds, at + milliseconds, { forcedVelocity });
    state.player = movement.state; events.push(...movement.events);
    if (state.targetId && state.boss.health > 0) state.player.yaw = yawOf(directionTo(state.player.position, state.boss.position));
    at += milliseconds;
    playerAction(state, collisionWorld, at, events);
    bossStep(state, world, milliseconds, at, events);
    if (!state.player.health) { respawn(state, world, at, events); break; }
    petStep(state, collisionWorld, milliseconds, at, events);
    if (state.targetId && (state.boss.health <= 0 || distance(state.player.position, state.boss.position) > 75)) state.targetId = null;
  }
  return { state, events };
}
