import { heightAt } from '../world-terrain.js';
import { DUMMY } from './feel.js';

export const ARENA = Object.freeze({ x: 0, z: -24, radius: 9, triggerRadius: 12, camp: Object.freeze({ x: 0, z: 2 }) });
export const STONES = Object.freeze(Array.from({ length: 9 }, (_, index) => Object.freeze({ index, x: Math.sin(index * Math.PI * 2 / 9) * 9, z: -24 + Math.cos(index * Math.PI * 2 / 9) * 9, radius: 0.65, height: 3 })));
export const BOSS_ATTACKS = Object.freeze(Object.fromEntries(Object.entries({
  charge: { telegraph: 1.05, active: 1.05, recovery: 1.5, damage: 24, range: 14, speed: 11, lockAt: 0.82 },
  sweep: { telegraph: 0.85, active: 0.3, recovery: 1.4, damage: 22, range: 3.8, arc: 2.9 },
  stomp: { telegraph: 1.1, active: 1.4, recovery: 1.5, damage: 20, range: 13, speed: 9.3 },
  roots: { telegraph: 1.2, active: 1.1, recovery: 1.4, damage: 22, range: 15, speed: 13.7, width: 1.1 },
}).map(([kind, row]) => [kind, Object.freeze({ ...row, duration: row.telegraph + row.active + row.recovery })])));
const PET_CONTACT_RANGE = 1.3, PET_APPROACH_STOP = 1.2, PET_RADIUS = .22, PET_SWIM_DEPTH = .22;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const segmentDistance = (point, from, to) => {
  const dx = to.x - from.x, dz = to.z - from.z;
  const t = clamp(((point.x - from.x) * dx + (point.z - from.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return Math.hypot(point.x - from.x - dx * t, point.z - from.z - dz * t);
};
const facing = (a, b) => Math.atan2(b.x - a.x, a.z - b.z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const turnDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export function createEncounter({ bond = 0, checkpoint = () => ARENA.camp, stats = { health: 120 }, world = null, exploration = () => null } = {}) {
  const strength = 1 + clamp(Number(bond) || 0, 0, 10) * 0.07;
  const state = {};
  let respawnSerial = 0, victorySerial = 0;
  let serial = 0, impactSerial = 0, lastHit = 0, lastDodge = 0, attackIndex = 0, hurtAction = -1, petHurtAction = -1, petHitAction = -1, petIndex = 0, slowTime = 0, tauntTime = 0;
  const action = (actor, kind, duration = 0) => {
    actor.action = { kind, elapsed: 0, duration, serial: ++serial, progress: 0, stage: 'telegraph', telegraph: BOSS_ATTACKS[kind]?.telegraph ?? 0, impactIn: BOSS_ATTACKS[kind]?.telegraph ?? 0, originX: actor.x, originZ: actor.z };
  };
  function reset() {
    const spawn=checkpoint(),petX=spawn.x-.9,petZ=spawn.z+.8,petY=world ? world.floorAt(petX,petZ) : heightAt(petX,petZ);
    serial = 0; impactSerial = 0; lastHit = 0; lastDodge = 0; attackIndex = 0; hurtAction = -1; petHurtAction = -1; petHitAction = -1; petIndex = 0; slowTime = 0; tauntTime = 0;
    Object.assign(state, {
      status: 'dormant', elapsed: 0, slowMotion: 1, flurry: 0, recovery: 0, respawn: null, victory: 0,
      boss: { id: 'mossheart', x: 0, y: heightAt(0, -24), z: -24, heading: Math.PI, radius: 1.3, height: 4.5, health: 360, maxHealth: 360, phase: 1, flash: 0, ringRadius: 0, rootLength: 0, targetX: 0, targetZ: 2 },
      pet: { x: petX, y: petY, ground: petY, z: petZ, heading: 0, health: 100, maxHealth: 100, flash: 0, skillCooldown: 0, taunt: false, attackCooldown: 1.5, swimming: false },
      player: { health: stats.health || 120, maxHealth: stats.health || 120, invulnerable: false, damageFlash: 0 },
      counts: { starts: 0, attacks: 0, hits: 0, perfectDodges: 0, stoneStuns: 0, petHits: 0, petSkills: 0, defeats: 0, wins: 0 }, impacts: [],
    });
    action(state.boss, 'idle', 1.2); action(state.pet, 'follow');
    return state;
  }
  const impact = (kind, actor, height = .8) => state.impacts.push({ serial: ++impactSerial, kind, x: actor.x, y: actor.y + height, z: actor.z, elapsed: 0 });
  const target = () => state.status === 'fighting' ? state.boss : DUMMY;
  function start(sim) {
    state.status = 'fighting'; state.counts.starts++; lastHit = sim.lastHit?.serial ?? 0;
    action(state.boss, 'idle', 0.9);
  }
  function recover(sim) {
    state.status = 'recovering'; state.recovery = 1.6; state.counts.defeats++;
    action(state.boss, 'idle', 1); action(state.pet, state.pet.health === 0 ? 'knockedOut' : 'idle');
  }
  function campReset(sim) {
    const counts = { ...state.counts }, nextRespawn = ++respawnSerial;
    reset(); state.counts = counts; state.respawn = { serial: nextRespawn, ...checkpoint() };
    state.pet.x = state.respawn.x - .9; state.pet.z = state.respawn.z + .8; state.pet.y = world ? world.floorAt(state.pet.x,state.pet.z) : heightAt(state.pet.x,state.pet.z);
    lastHit = sim.lastHit?.serial ?? 0; lastDodge = sim.action.serial;
  }
  function perfect(sim) {
    if (sim.action.kind !== 'dodge' || sim.action.serial === lastDodge) return;
    lastDodge = sim.action.serial;
    const boss = state.boss, row = BOSS_ATTACKS[boss.action.kind];
    if (!row) return;
    const position = sim.player, a = boss.action;
    const d = distance(boss, position), bearing = Math.abs(turnDifference(facing(boss, position), boss.heading));
    const dx = position.x - a.originX, dz = position.z - a.originZ;
    const along = dx * Math.sin(boss.heading) - dz * Math.cos(boss.heading), side = Math.abs(dx * Math.cos(boss.heading) + dz * Math.sin(boss.heading));
    const eta = a.kind === 'stomp' ? row.telegraph + d / row.speed - a.elapsed : a.kind === 'charge' ? Math.max(0, a.impactIn) + Math.max(0, d - 1.9) / row.speed : a.kind === 'roots' ? row.telegraph + along / row.speed - a.elapsed : a.impactIn;
    if (eta < 0 || eta > 0.2 || a.elapsed > row.telegraph + row.active) return;
    if (a.kind === 'sweep' && (d >= row.range || bearing >= row.arc / 2)) return;
    if (a.kind === 'stomp' && (d > row.range || position.y - heightAt(position.x, position.z) >= 0.55)) return;
    if (a.kind === 'charge' && (d > row.range || bearing > 0.35)) return;
    if (a.kind === 'roots' && (along <= 0 || along > row.range || side >= row.width)) return;
    slowTime = 0.5; state.slowMotion = 0.32; state.flurry = 1.2; state.counts.perfectDodges++; impact('perfect', sim.player);
  }
  function damage(actor, sim, row) {
    const isPlayer = actor === state.player, key = state.boss.action.serial;
    if (isPlayer ? hurtAction === key || actor.invulnerable : petHurtAction === key || actor.health <= 0) return;
    if (isPlayer) hurtAction = key; else petHurtAction = key;
    actor.health = Math.max(0, actor.health - row.damage);
    if (isPlayer) { actor.damageFlash = 0.45; actor.invulnerable = true; impact('playerHit', sim.player); }
    else { actor.flash = 0.4; impact('petHit', actor); if (!actor.health) action(actor, 'knockedOut'); }
  }
  function bossStep(dt, sim) {
    const boss = state.boss, a = boss.action, row = BOSS_ATTACKS[a.kind], victim = tauntTime > 0 && state.pet.health > 0 ? state.pet : sim.player;
    const previousPosition = { x: boss.x, z: boss.z };
    a.elapsed += dt; a.progress = a.duration ? clamp(a.elapsed / a.duration, 0, 1) : 0;
    if (row) {
      a.impactIn = row.telegraph - a.elapsed;
      a.stage = a.elapsed < row.telegraph ? 'telegraph' : a.elapsed < row.telegraph + row.active ? 'active' : 'recovery';
      if (a.elapsed < (row.lockAt ?? row.telegraph - 0.2)) { boss.heading = facing(boss, victim); boss.targetX = victim.x; boss.targetZ = victim.z; }
      if (a.stage === 'active') {
        if (a.kind === 'charge') {
          boss.x += Math.sin(boss.heading) * row.speed * dt; boss.z -= Math.cos(boss.heading) * row.speed * dt;
          const stone = STONES.find(stone => segmentDistance(stone, previousPosition, boss) < boss.radius + stone.radius);
          if (stone) { const d = distance(boss, stone) || 1; const gap = boss.radius + stone.radius; boss.x = stone.x + (boss.x - stone.x) / d * gap; boss.z = stone.z + (boss.z - stone.z) / d * gap; boss.y = heightAt(boss.x, boss.z); state.counts.stoneStuns++; impact('stone', boss); action(boss, 'stunned', 2.8); boss.ringRadius = 0; return; }
        }
        boss.ringRadius = a.kind === 'stomp' ? (a.elapsed - row.telegraph) * row.speed : 0;
        boss.rootLength = a.kind === 'roots' ? (a.elapsed - row.telegraph) * row.speed : 0;
        for (const [actor, position] of [[state.player, sim.player], [state.pet, state.pet]]) {
          const d = distance(boss, position), bearing = Math.abs(turnDifference(facing(boss, position), boss.heading));
          const dx = position.x - a.originX, dz = position.z - a.originZ;
          const along = dx * Math.sin(boss.heading) - dz * Math.cos(boss.heading), side = Math.abs(dx * Math.cos(boss.heading) + dz * Math.sin(boss.heading));
          const hit = a.kind === 'charge' ? segmentDistance(position, previousPosition, boss) < 1.9 : a.kind === 'sweep' ? d < row.range && bearing < row.arc / 2 : a.kind === 'stomp' ? Math.abs(d - boss.ringRadius) < 0.65 && (position.y - heightAt(position.x, position.z) < 0.55) : along > 0 && along < boss.rootLength && side < row.width;
          if (hit) damage(actor, sim, row);
        }
      }
    }
    boss.y = heightAt(boss.x, boss.z);
    if (a.duration && a.elapsed >= a.duration) {
      boss.ringRadius = 0; boss.rootLength = 0;
      if (a.kind !== 'idle') action(boss, 'idle', 0.7);
      else { const sequence = boss.phase === 2 ? ['charge', 'roots', 'sweep', 'stomp'] : ['charge', 'sweep', 'stomp']; const kind = sequence[attackIndex++ % sequence.length]; action(boss, kind, BOSS_ATTACKS[kind].duration); state.counts.attacks++; }
    }
    if (boss.action.kind === 'idle') {
      const d = distance(boss, victim); boss.heading = facing(boss, victim);
      if (d > 3.1) { boss.x += Math.sin(boss.heading) * 1.4 * dt; boss.z -= Math.cos(boss.heading) * 1.4 * dt; }
      const fromCenter = distance(boss, ARENA);
      if (fromCenter > 8) { const ratio = 8 / fromCenter; boss.x = ARENA.x + (boss.x - ARENA.x) * ratio; boss.z = ARENA.z + (boss.z - ARENA.z) * ratio; }
    }
    if (boss.action.kind === 'idle') {
      for (const stone of STONES) {
        const d = distance(boss, stone), radius = boss.radius + stone.radius;
        if (d < radius) { const nx = d > 1e-8 ? (boss.x - stone.x) / d : 1; const nz = d > 1e-8 ? (boss.z - stone.z) / d : 0; boss.x = stone.x + nx * radius; boss.z = stone.z + nz * radius; }
      }
    }
    boss.y = heightAt(boss.x, boss.z);
  }
  function petStep(dt, sim, input) {
    const pet = state.pet;
    pet.skillCooldown = Math.max(0, pet.skillCooldown - dt); pet.attackCooldown = Math.max(0, pet.attackCooldown - dt);
    if (pet.health <= 0) return;
    if (input.petSkill && state.status === 'fighting' && pet.skillCooldown === 0) { action(pet, 'dash', 0.7); pet.skillCooldown = 12; tauntTime = 2.4; state.counts.petSkills++; impact('skill', pet); }
    const a = pet.action; a.elapsed += dt; a.progress = a.duration ? clamp(a.elapsed / a.duration, 0, 1) : 0;
    const details = exploration(), fighting = state.status === 'fighting', sniffing = !fighting && !details?.whistle && details?.sniff && Math.hypot(sim.player.vx,sim.player.vz)<.5;
    const aim = fighting ? state.boss : sniffing ? {x:sim.player.x+(details.sniff.x-sim.player.x)*.25,z:sim.player.z+(details.sniff.z-sim.player.z)*.25} : { x: sim.player.x - 0.9, z: sim.player.z + 0.8 };
    const previousPet = {x:pet.x,y:pet.y,z:pet.z}, wasSwimming=Boolean(pet.swimming);
    const d = distance(pet, aim); pet.heading = facing(pet, aim);
    const attacking = ['pounce', 'swipe', 'spin', 'dash'].includes(a.kind);
    const wasClimbing=pet.climbing;pet.climbing=false;
    if(world && !fighting && d>.2) {
      const wall=world.climbContact(pet,(aim.x-pet.x)/d,(aim.z-pet.z)/d);
      if(wall && (wasClimbing || sim.player.y>pet.y+.5) && sim.player.y>=wall.top-.6) {
        pet.climbing=true;pet.swimming=false;pet.x=wall.x;pet.z=wall.z;pet.y=Math.min(wall.top,pet.y+3*dt);pet.ground=pet.y;a.kind='climb';
        if(pet.y>=wall.top-.01){pet.x-=wall.normal[0]*.7;pet.z-=wall.normal[2]*.7;pet.y=world.floorAt(pet.x,pet.z,wall.top+.2);pet.climbing=false;pet.ground=pet.y;}
        return;
      }
    }
    if (d > (fighting ? PET_APPROACH_STOP : 0.2)) {
      let blockingStone = null, blockingDistance = Infinity;
      for (const stone of STONES) {
        const gap = distance(pet, stone), ahead = (stone.x - pet.x) * (aim.x - pet.x) + (stone.z - pet.z) * (aim.z - pet.z);
        if (ahead > 0 && gap < 3 && gap < blockingDistance && segmentDistance(stone, pet, aim) < stone.radius + PET_RADIUS + .08) { blockingStone = stone; blockingDistance = gap; }
      }
      if(world && !fighting) for(const tree of world.trees || []) {
        const gap=distance(pet,tree),ahead=(tree.x-pet.x)*(aim.x-pet.x)+(tree.z-pet.z)*(aim.z-pet.z);
        if(ahead>0 && gap<4 && gap<blockingDistance && segmentDistance(tree,pet,aim)<tree.radius+.4){blockingStone=tree;blockingDistance=gap;}
      }
      if(world && !fighting) for(const box of world.solids || []) {
        if(pet.y>=box.top || sim.player.y>=box.top-.5)continue;
        const radius=Math.hypot(box.halfX,box.halfZ),gap=distance(pet,box),ahead=(box.x-pet.x)*(aim.x-pet.x)+(box.z-pet.z)*(aim.z-pet.z);
        if(ahead>0 && gap<radius+3 && gap<blockingDistance && segmentDistance(box,pet,aim)<radius+.4){blockingStone={...box,radius};blockingDistance=gap;}
      }
      if (blockingStone) pet.heading = facing(pet, blockingStone) + Math.asin(Math.min(1, (blockingStone.radius + PET_RADIUS + .08) / blockingDistance));
      const travel = Math.min(d - (fighting ? PET_APPROACH_STOP : 0), dt * (!fighting && wasSwimming ? 2.8 : a.kind === 'dash' ? 14 : a.kind === 'pounce' ? 8 : details?.whistle ? 9 : 5.5));
      const fromX = pet.x, fromZ = pet.z;
      pet.x += Math.sin(pet.heading) * travel; pet.z -= Math.cos(pet.heading) * travel;
      for (const stone of STONES) {
        const dx = pet.x - fromX, dz = pet.z - fromZ, ox = fromX - stone.x, oz = fromZ - stone.z, radius = stone.radius + PET_RADIUS;
        const length = dx * dx + dz * dz, projection = 2 * (ox * dx + oz * dz), outside = ox * ox + oz * oz - radius * radius;
        const discriminant = projection * projection - 4 * length * outside;
        if (outside > 0 && length > 1e-10 && discriminant >= 0) {
          const hit = (-projection - Math.sqrt(discriminant)) / (2 * length);
          if (hit >= 0 && hit <= 1) { const fraction = Math.max(0, hit - .0001); pet.x = fromX + dx * fraction; pet.z = fromZ + dz * fraction; }
        }
      }
    }
    for (const stone of STONES) {
      const gap = distance(pet, stone), radius = stone.radius + PET_RADIUS;
      if (gap < radius) { const nx = gap > 1e-8 ? (pet.x - stone.x) / gap : 1, nz = gap > 1e-8 ? (pet.z - stone.z) / gap : 0; pet.x = stone.x + nx * radius; pet.z = stone.z + nz * radius; }
    }
    if (world) { pet.vx=(pet.x-previousPet.x)/Math.max(dt,.001);pet.vz=(pet.z-previousPet.z)/Math.max(dt,.001);world.resolve(pet,previousPet); }
    if(world) {
      const floor=world.floorAt(pet.x,pet.z,previousPet.y+.5),water=!fighting ? world.waterAt(pet.x,pet.z) : null;
      pet.swimming=Boolean(water && water.depth>PET_SWIM_DEPTH && floor<water.height-PET_SWIM_DEPTH);
      const support=pet.swimming ? water.height-PET_SWIM_DEPTH : floor;
      pet.ground=pet.swimming || wasSwimming ? Math.max(floor,previousPet.y+clamp(support-previousPet.y,-3*dt,3*dt)) : floor;
    }
    pet.y = (world ? pet.ground : heightAt(pet.x, pet.z)) + (a.kind === 'pounce' ? Math.sin(a.progress * Math.PI) * 0.65 : 0);
    pet.sniffing = Boolean(sniffing); pet.petting = !fighting && details?.petting>0;
    pet.taunt = tauntTime > 0;
    if (fighting && attacking && a.elapsed >= (a.kind === 'dash' ? 0.22 : 0.3) && distance(pet, aim) <= PET_CONTACT_RANGE && petHitAction !== a.serial) { petHitAction = a.serial; state.boss.health = Math.max(0, state.boss.health - (a.kind === 'spin' ? 10 : 7) * strength); state.boss.flash = 0.18; state.counts.petHits++; impact('petAttack', { x: pet.x + Math.sin(pet.heading) * .55, y: pet.y, z: pet.z - Math.cos(pet.heading) * .55 }, .45); }
    if (a.duration && a.elapsed >= a.duration) { action(pet, 'follow'); pet.attackCooldown = 2; }
    else if (!attacking && fighting && d < 2.6 && pet.attackCooldown === 0) action(pet, ['pounce', 'swipe', 'spin'][petIndex++ % 3], 0.8);
    else if (!attacking) a.kind = pet.swimming ? 'swim' : pet.petting ? 'pet' : d > 0.3 ? 'follow' : sniffing ? 'sniff' : 'idle';
  }
  function step(dt, sim, input = {}) {
    dt = Number.isFinite(dt) ? clamp(dt, 0, 0.05) : 0;
    if (!dt || !sim?.player) return state;
    const maxHealth = stats.health || 120;
    if (maxHealth>state.player.maxHealth)state.player.health+=maxHealth-state.player.maxHealth;
    state.player.maxHealth=maxHealth;
    const frozen = sim.hitStop > 0 || sim.hitStopped;
    const realDt = dt / state.slowMotion;
    state.elapsed += dt; state.flurry = Math.max(0, state.flurry - realDt); slowTime = Math.max(0, slowTime - realDt); state.slowMotion = slowTime > 0 ? 0.32 : 1; tauntTime = Math.max(0, tauntTime - (frozen ? 0 : dt));
    state.boss.flash = Math.max(0, state.boss.flash - dt); state.pet.flash = Math.max(0, state.pet.flash - dt); state.player.damageFlash = Math.max(0, state.player.damageFlash - dt);
    state.player.invulnerable = sim.player.invulnerable || state.player.damageFlash > 0;
    for (const event of state.impacts) event.elapsed += dt;
    state.impacts = state.impacts.filter(event => event.elapsed < 1);
    if (state.status === 'recovering') { state.recovery -= frozen ? 0 : dt; if (state.recovery <= 0) campReset(sim); return state; }
    if (input.interact && !world && distance(sim.player, checkpoint()) < 4) { campReset(sim); return state; }
    if (world && state.status==='fighting' && distance(sim.player,ARENA)>28) {
      state.status='dormant';state.boss.health=state.boss.maxHealth;state.boss.phase=1;state.boss.x=ARENA.x;state.boss.z=ARENA.z;state.boss.y=heightAt(ARENA.x,ARENA.z);action(state.boss,'idle',1.2);action(state.pet,'follow');tauntTime=0;
    }
    if (state.status === 'dormant' && distance(sim.player, ARENA) < ARENA.triggerRadius) start(sim);
    if (state.status === 'fighting') {
      perfect(sim);
      if (sim.lastHit && sim.lastHit.serial !== lastHit) {
        lastHit = sim.lastHit.serial;
        if (sim.lastHit.targetId === 'mossheart') { const multiplier = state.flurry > 0 ? 1.5 : state.boss.action.kind === 'stunned' ? 1.4 : 1; state.boss.health = Math.max(0, state.boss.health - sim.lastHit.damage * multiplier); state.boss.flash = 0.2; state.counts.hits++; impact('bossHit', state.boss); }
      }
      if (!frozen && state.boss.phase === 1 && state.boss.health <= state.boss.maxHealth / 2 && state.boss.health > 0) { state.boss.phase = 2; action(state.boss, 'phase', 1.7); impact('phase', state.boss); }
      if (!frozen) bossStep(dt, sim);
    }
    if (!frozen) petStep(dt, sim, input);
    if (state.status === 'fighting' && state.boss.health <= 0) { state.status = 'won'; state.counts.wins++; state.victory = ++victorySerial; action(state.boss, 'defeat', 3); impact('victory', state.boss); }
    else if (state.status === 'fighting' && state.player.health <= 0) recover(sim);
    if (!frozen && state.status === 'won') { state.boss.action.elapsed = Math.min(3, state.boss.action.elapsed + dt); state.boss.action.progress = state.boss.action.elapsed / 3; }
    if (state.status !== 'fighting' && state.pet.health <= 0 && distance(sim.player, checkpoint()) < 4) { state.pet.health = state.pet.maxHealth; action(state.pet, 'follow'); }
    return state;
  }
  reset();
  return { state, target, step, reset, rest: campReset, heal(amount = Infinity) { state.player.health=Math.min(state.player.maxHealth,state.player.health+amount); if(amount===Infinity){state.pet.health=state.pet.maxHealth;action(state.pet,'follow');} } };
}
