import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARENA, STONES, BOSS_ATTACKS, createEncounter } from './encounter.js';
import { createFeelSimulation } from './feel.js';
import { heightAt } from '../world-terrain.js';
const setup = bond => {
  const encounter = createEncounter({ bond });
  const simulation = createFeelSimulation({ target: encounter.target, obstacles: STONES });
  Object.assign(simulation.state.player, { x: 0, z: -20, y: heightAt(0, -20) });
  encounter.step(1 / 120, simulation.state);
  return { encounter, simulation };
};
const advance = (encounter, simulation, seconds, input = {}) => {
  for (let t = 0; t < seconds - 1e-8; t += 1 / 120) encounter.step(Math.min(1 / 120, seconds - t), simulation.state, input);
};
const bossAction = (encounter, kind, elapsed = 0) => {
  const boss = encounter.state.boss, row = BOSS_ATTACKS[kind];
  boss.action = { kind, elapsed, duration: row?.duration ?? 1, serial: boss.action.serial + 1, impactIn: (row?.telegraph ?? 0) - elapsed, originX: boss.x, originZ: boss.z };
};

test('arena entry activates dynamic target; camp reset is repeatable and does not mutate simulation', () => {
  const encounter = createEncounter(), simulation = createFeelSimulation();
  assert.equal(encounter.target().id, 'dummy');
  assert.equal(STONES.length, 9);
  assert.ok(STONES.every(stone => Math.abs(Math.hypot(stone.x - ARENA.x, stone.z - ARENA.z) - 9) < 1e-8));
  const { encounter: active } = setup();
  assert.equal(active.state.status, 'fighting');
  assert.equal(active.target().id, 'mossheart');
  const before = structuredClone(simulation.state);
  active.step(1 / 60, simulation.state, { interact: true });
  assert.equal(active.state.status, 'dormant');
  assert.deepEqual(simulation.state, before);
  const serial = active.state.respawn.serial;
  active.step(1 / 60, simulation.state, { interact: true });
  assert.equal(active.state.respawn.serial, serial + 1);
});

test('all boss attacks telegraph at least .6 seconds and cannot hurt during the pose', () => {
  for (const [kind, row] of Object.entries(BOSS_ATTACKS)) {
    assert.ok(row.telegraph >= 0.6);
    assert.ok(row.damage <= 120 / 3);
    const { encounter, simulation } = setup();
    bossAction(encounter, kind);
    Object.assign(simulation.state.player, { x: 0, z: -23, y: heightAt(0, -23) });
    advance(encounter, simulation, row.telegraph - 0.02);
    assert.equal(encounter.state.player.health, 120, kind);
    assert.equal(encounter.state.boss.action.stage, 'telegraph');
  }
});

test('charge heading locks late and a standing stone opens a punish window', () => {
  const { encounter, simulation } = setup();
  const boss = encounter.state.boss, stone = STONES[0];
  Object.assign(boss, { x: 0, z: -18, heading: Math.PI });
  Object.assign(simulation.state.player, { x: 0, z: -13 });
  bossAction(encounter, 'charge', 0.84);
  advance(encounter, simulation, 0.1);
  assert.equal(boss.heading, Math.PI);
  simulation.state.player.x = 5;
  advance(encounter, simulation, 0.35);
  assert.equal(boss.action.kind, 'stunned');
  assert.equal(encounter.state.counts.stoneStuns, 1);
  assert.ok(Math.hypot(boss.x - stone.x, boss.z - stone.z) < 2);
  const health = boss.health;
  simulation.state.lastHit = { serial: 1, targetId: 'mossheart', kind: 'heavy', damage: 35 };
  encounter.step(1 / 120, simulation.state);
  assert.equal(boss.health, health - 49);
});

test('hits consume serial once, ignore training targets, and wake roots at half health', () => {
  const { encounter, simulation } = setup();
  simulation.state.lastHit = { serial: 1, targetId: 'dummy', damage: 100 };
  encounter.step(1 / 120, simulation.state);
  assert.equal(encounter.state.boss.health, 360);
  simulation.state.lastHit = { serial: 2, targetId: 'mossheart', damage: 181 };
  encounter.step(1 / 120, simulation.state);
  assert.equal(encounter.state.boss.health, 179);
  assert.equal(encounter.state.boss.phase, 2);
  assert.equal(encounter.state.boss.action.kind, 'phase');
  advance(encounter, simulation, 0.2);
  assert.equal(encounter.state.boss.health, 179);
});

test('late protected dodge triggers one slow motion flurry, early dodge does not', () => {
  for (const late of [true, false]) {
    const { encounter, simulation } = setup();
    bossAction(encounter, 'sweep', BOSS_ATTACKS.sweep.telegraph - (late ? 0.15 : 0.4));
    simulation.state.action = { kind: 'dodge', serial: 100, elapsed: 0.07 };
    simulation.state.player.invulnerable = true;
    Object.assign(simulation.state.player, { x: 0, z: -22 });
    encounter.step(1 / 120, simulation.state);
    assert.equal(encounter.state.counts.perfectDodges, late ? 1 : 0);
    if (late) { assert.ok(encounter.state.flurry > 0 && encounter.state.flurry < 1.5); encounter.step(1 / 120, simulation.state); assert.equal(encounter.state.slowMotion, 0.32); }
    advance(encounter, simulation, 0.5);
    assert.equal(encounter.state.player.health, 120);
    assert.equal(encounter.state.counts.perfectDodges, late ? 1 : 0);
  }
});

test('unprotected sweep hurts once per attack and defeat requests a lossless camp respawn', () => {
  const { encounter, simulation } = setup();
  Object.assign(simulation.state.player, { x: 0, z: -22, y: heightAt(0, -22) });
  encounter.state.boss.heading = Math.PI;
  bossAction(encounter, 'sweep', 0.85);
  advance(encounter, simulation, 0.2);
  assert.equal(encounter.state.player.health, 98);
  encounter.state.player.health = 1;
  encounter.state.player.damageFlash = 0;
  bossAction(encounter, 'sweep', 0.85);
  encounter.step(1 / 120, simulation.state);
  assert.equal(encounter.state.status, 'recovering');
  const position = simulation.state.player.z;
  while (!encounter.state.respawn) encounter.step(1 / 120, simulation.state);
  assert.equal(encounter.state.status, 'dormant');
  assert.equal(encounter.state.player.health, 120);
  assert.equal(encounter.state.respawn.z, 2);
  assert.equal(simulation.state.player.z, position);
});

test('pet acts independently, scales read-only bond, taunts on cooldown and recovers at camp', () => {
  const damages = [];
  for (const bond of [0, 5]) {
    const { encounter, simulation } = setup(bond);
    Object.assign(encounter.state.pet, { x: 0, z: -22, attackCooldown: 0 });
    advance(encounter, simulation, 0.5);
    assert.ok(encounter.state.counts.petHits > 0);
    damages.push(360 - encounter.state.boss.health);
    encounter.step(1 / 120, simulation.state, { petSkill: true });
    assert.equal(encounter.state.pet.action.kind, 'dash');
    assert.ok(encounter.state.pet.skillCooldown > 11);
    encounter.step(1 / 120, simulation.state, { petSkill: true });
    assert.equal(encounter.state.counts.petSkills, 1);
    encounter.state.pet.health = 0;
    encounter.state.status = 'won';
    Object.assign(simulation.state.player, ARENA.camp);
    encounter.step(1 / 120, simulation.state);
    assert.equal(encounter.state.pet.health, 100);
    assert.equal(bond, bond === 0 ? 0 : 5);
  }
  assert.ok(damages[1] > damages[0]);
});

test('player strike can win and victory is emitted once without any persistence effects', () => {
  const { encounter, simulation } = setup();
  simulation.state.lastHit = { serial: 1, targetId: 'mossheart', damage: 360 };
  encounter.step(1 / 120, simulation.state);
  assert.equal(encounter.state.status, 'won');
  assert.equal(encounter.state.boss.action.kind, 'defeat');
  assert.equal(encounter.state.counts.wins, 1);
  advance(encounter, simulation, 1);
  assert.equal(encounter.state.victory, 1);
  assert.equal(encounter.state.counts.wins, 1);
});

test('expanding stomp ring reaches a distant player once and a jump clears it', () => {
  for (const airborne of [false, true]) {
    const { encounter, simulation } = setup();
    Object.assign(simulation.state.player, { x: 5, z: -24, y: heightAt(5, -24) + (airborne ? 1 : 0) });
    bossAction(encounter, 'stomp', 1.1);
    advance(encounter, simulation, 0.3);
    assert.equal(encounter.state.player.health, 120);
    advance(encounter, simulation, 0.4);
    assert.equal(encounter.state.player.health, airborne ? 120 : 100);
    assert.ok(encounter.state.boss.ringRadius > 5);
  }
});

test('roots expand along the locked line and spare players outside its width', () => {
  for (const outside of [false, true]) {
    const { encounter, simulation } = setup();
    encounter.state.boss.phase = 2;
    encounter.state.boss.heading = 0;
    Object.assign(simulation.state.player, { x: outside ? 3 : 0, z: -30, y: heightAt(outside ? 3 : 0, -30) });
    bossAction(encounter, 'roots', 1.2);
    advance(encounter, simulation, 0.3);
    assert.equal(encounter.state.player.health, 120);
    advance(encounter, simulation, 0.3);
    assert.equal(encounter.state.player.health, outside ? 120 : 98);
    assert.ok(encounter.state.boss.rootLength > 6);
  }
});

test('pet knocked out by an attack stays down through combat and player cannot win by standing idle', () => {
  const { encounter, simulation } = setup();
  Object.assign(encounter.state.pet, { x: 0, z: -22, health: 1 });
  encounter.state.boss.heading = Math.PI;
  bossAction(encounter, 'sweep', 0.85);
  encounter.step(1 / 120, simulation.state);
  assert.equal(encounter.state.pet.health, 0);
  assert.equal(encounter.state.pet.action.kind, 'knockedOut');
  const hits = encounter.state.counts.petHits;
  advance(encounter, simulation, 0.8, { petSkill: true });
  assert.equal(encounter.state.pet.health, 0);
  assert.equal(encounter.state.counts.petHits, hits);
  assert.equal(encounter.state.counts.petSkills, 0);
  const idle = setup();
  advance(idle.encounter, idle.simulation, 60);
  assert.equal(idle.encounter.state.counts.wins, 0);
  assert.ok(idle.encounter.state.counts.defeats > 0);
});

test('flurry expires within 1.5 wall seconds even while simulation is slowed', () => {
  const { encounter, simulation } = setup();
  bossAction(encounter, 'sweep', 0.7);
  Object.assign(simulation.state.player, { x: 0, z: -22 });
  simulation.state.action = { kind: 'dodge', serial: 100, elapsed: 0.05 };
  encounter.step(1 / 120, simulation.state);
  assert.ok(encounter.state.flurry > 0);
  for (let t = 0; t < 1.4; t += 1 / 120) encounter.step(1 / 120 * encounter.state.slowMotion, simulation.state);
  assert.equal(encounter.state.flurry, 0);
  assert.equal(encounter.state.slowMotion, 1);
});

test('perfect charge dodge judges travel to the player instead of only telegraph ending', () => {
  for (const close of [false, true]) {
    const { encounter, simulation } = setup();
    encounter.state.boss.heading = Math.PI;
    bossAction(encounter, 'charge', 1.1);
    Object.assign(simulation.state.player, { x: 0, z: close ? -21 : -17 });
    simulation.state.action = { kind: 'dodge', serial: 100, elapsed: 0.05 };
    encounter.step(1 / 120, simulation.state);
    assert.equal(encounter.state.counts.perfectDodges, close ? 1 : 0);
  }
});

test('dodging behind a sweep or outside root and stomp bounds never awards a perfect dodge', () => {
  for (const [kind, x, z, airborne] of [['sweep', 0, -26, false], ['roots', 1.5, -30, false], ['roots', 0, -40, false], ['stomp', 0, -10, false], ['stomp', 0, -21, true]]) {
    const { encounter, simulation } = setup();
    encounter.state.boss.heading = kind === 'sweep' ? Math.PI : 0;
    const elapsed = kind === 'stomp' ? BOSS_ATTACKS.stomp.telegraph + Math.hypot(x, z + 24) / BOSS_ATTACKS.stomp.speed - 0.15 : kind === 'roots' ? BOSS_ATTACKS.roots.telegraph + Math.abs(z + 24) / BOSS_ATTACKS.roots.speed - 0.15 : BOSS_ATTACKS.sweep.telegraph - 0.15;
    bossAction(encounter, kind, elapsed);
    Object.assign(simulation.state.player, { x, z, y: heightAt(x, z) + (airborne ? 1 : 0) });
    simulation.state.action = { kind: 'dodge', serial: 100, elapsed: 0.05 };
    encounter.step(1 / 120, simulation.state);
    assert.equal(encounter.state.counts.perfectDodges, 0, kind);
  }
});

test('charge checks the full movement segment on a capped frame to catch grazing contact', () => {
  const { encounter, simulation } = setup();
  encounter.state.boss.heading = 0;
  bossAction(encounter, 'charge', BOSS_ATTACKS.charge.telegraph);
  Object.assign(simulation.state.player, { x: 1.895, z: -24.275, y: heightAt(1.895, -24.275) });
  assert.ok(Math.hypot(1.895, 0.275) > 1.9);
  encounter.step(0.05, simulation.state);
  assert.equal(encounter.state.player.health, 96);
});

test('idle pursuit respects standing stone collision and remains grounded', () => {
  const { encounter, simulation } = setup();
  const boss = encounter.state.boss, stone = STONES[0];
  Object.assign(boss, { x: 0, z: stone.z - boss.radius - stone.radius });
  Object.assign(simulation.state.player, { x: 0, z: -11 });
  boss.action.duration = 5;
  advance(encounter, simulation, 1);
  assert.ok(Math.hypot(boss.x - stone.x, boss.z - stone.z) >= boss.radius + stone.radius - 1e-8);
  assert.equal(boss.y, heightAt(boss.x, boss.z));
});

test('hit-stop freezes charging boss and moving pet while a fresh strike applies once immediately', () => {
  const { encounter, simulation } = setup();
  const boss = encounter.state.boss, pet = encounter.state.pet;
  boss.heading = 0;
  bossAction(encounter, 'charge', BOSS_ATTACKS.charge.telegraph + 0.1);
  Object.assign(pet, { x: -6, z: -20, skillCooldown: 5 });
  pet.action = { kind: 'pounce', elapsed: 0.15, duration: 0.8, serial: 100, progress: 0.15 / 0.8 };
  const bossBefore = { x: boss.x, y: boss.y, z: boss.z, heading: boss.heading, action: structuredClone(boss.action) };
  const petBefore = structuredClone(pet);
  simulation.state.hitStop = 0.075;
  simulation.state.lastHit = { serial: 1, targetId: 'mossheart', damage: 12, kind: 'light1' };
  for (let frame = 0; frame < 8; frame++) encounter.step(1 / 120, simulation.state, { petSkill: true });
  assert.equal(boss.health, 348);
  assert.ok(boss.flash > 0);
  assert.equal(encounter.state.counts.hits, 1);
  assert.deepEqual({ x: boss.x, y: boss.y, z: boss.z, heading: boss.heading, action: boss.action }, bossBefore);
  assert.deepEqual(pet, petBefore);
  simulation.state.hitStop = 0;
  encounter.step(1 / 120, simulation.state);
  assert.ok(boss.z < bossBefore.z);
  assert.ok(pet.action.elapsed > petBefore.action.elapsed);
  assert.notEqual(pet.x, petBefore.x);
});

test('a lethal frozen strike emits victory immediately without advancing its defeat action', () => {
  const { encounter, simulation } = setup();
  simulation.state.hitStop = 0.075;
  simulation.state.lastHit = { serial: 1, targetId: 'mossheart', damage: 360, kind: 'heavy' };
  encounter.step(1 / 120, simulation.state);
  assert.equal(encounter.state.status, 'won');
  assert.equal(encounter.state.victory, 1);
  assert.equal(encounter.state.boss.action.kind, 'defeat');
  assert.equal(encounter.state.boss.action.elapsed, 0);
  encounter.step(1 / 120, simulation.state);
  assert.equal(encounter.state.counts.wins, 1);
  assert.equal(encounter.state.boss.action.elapsed, 0);
});

test('hit-stop keeps real-time slow motion and flurry expiration running', () => {
  const { encounter, simulation } = setup();
  bossAction(encounter, 'sweep', 0.7);
  Object.assign(simulation.state.player, { x: 0, z: -22 });
  simulation.state.action = { kind: 'dodge', serial: 100, elapsed: 0.05 };
  encounter.step(1 / 120, simulation.state);
  simulation.state.hitStop = 0.075;
  const elapsed = encounter.state.boss.action.elapsed;
  for (let wallTime = 0; wallTime < 1.4; wallTime += 1 / 120) encounter.step(1 / 120 * encounter.state.slowMotion, simulation.state);
  assert.equal(encounter.state.flurry, 0);
  assert.equal(encounter.state.slowMotion, 1);
  assert.equal(encounter.state.boss.action.elapsed, elapsed);
});

test('every partner attack misses outside visible contact range', () => {
  for (const kind of ['pounce', 'swipe', 'spin', 'dash']) {
    const { encounter, simulation } = setup();
    bossAction(encounter, 'stunned'); encounter.state.boss.action.duration = 10;
    const boss = encounter.state.boss, pet = encounter.state.pet;
    Object.assign(pet, { x: boss.x + 1.35, z: boss.z, attackCooldown: 2 });
    pet.action = { kind, elapsed: .35, duration: .8, serial: 100, progress: .35 / .8 };
    encounter.step(.001, simulation.state);
    assert.ok(Math.hypot(pet.x - boss.x, pet.z - boss.z) > 1.3);
    assert.equal(boss.health, 360, kind);
    assert.equal(encounter.state.counts.petHits, 0, kind);
    assert.equal(encounter.state.impacts.some(event => event.kind === 'petAttack'), false, kind);
  }
});

test('partner approaches contact without overshooting, hits once per attack and emits its impact at the touching muzzle', () => {
  for (const kind of ['pounce', 'swipe', 'spin', 'dash']) {
    const { encounter, simulation } = setup();
    bossAction(encounter, 'stunned'); encounter.state.boss.action.duration = 10;
    const boss = encounter.state.boss, pet = encounter.state.pet;
    Object.assign(pet, { x: boss.x + 2.5, z: boss.z, attackCooldown: 2 });
    pet.action = { kind, elapsed: 0, duration: .8, serial: 100, progress: 0 };
    let contact = null;
    for (let frame = 0; frame < 90; frame++) {
      const beforeHits = encounter.state.counts.petHits;
      encounter.step(1 / 120, simulation.state);
      const distance = Math.hypot(pet.x - boss.x, pet.z - boss.z);
      assert.ok(distance >= 1.2 - 1e-8, `${kind} does not overshoot its stopping distance`);
      if (encounter.state.counts.petHits > beforeHits) {
        assert.ok(distance <= 1.3, kind);
        const event = encounter.state.impacts.find(event => event.kind === 'petAttack');
        contact = { event, x: pet.x, y: pet.y, z: pet.z, heading: pet.heading };
      }
    }
    assert.equal(encounter.state.counts.petHits, 1, kind);
    assert.equal(boss.health, kind === 'spin' ? 350 : 353, kind);
    assert.ok(contact, kind);
    assert.ok(Math.abs(contact.event.x - contact.x - Math.sin(contact.heading) * .55) < 1e-8);
    assert.ok(Math.abs(contact.event.z - contact.z + Math.cos(contact.heading) * .55) < 1e-8);
    assert.ok(Math.abs(contact.event.y - contact.y - .45) < 1e-8);
    assert.ok(Math.hypot(contact.event.x - boss.x, contact.event.z - boss.z) > .6);
  }
});

test('following partner steers around a standing stone and reaches the far side without penetration', () => {
  const encounter = createEncounter(), simulation = createFeelSimulation(), stone = STONES[0], pet = encounter.state.pet;
  encounter.state.status = 'won';
  Object.assign(pet, { x: stone.x, z: stone.z + 3, y: heightAt(stone.x, stone.z + 3) });
  Object.assign(simulation.state.player, { x: stone.x + .9, z: stone.z - 3.8 });
  for (let frame = 0; frame < 360; frame++) {
    encounter.step(1 / 120, simulation.state);
    for (const obstacle of STONES) assert.ok(Math.hypot(pet.x - obstacle.x, pet.z - obstacle.z) >= obstacle.radius + .22 - 1e-8);
    assert.equal(pet.y, heightAt(pet.x, pet.z));
  }
  assert.ok(pet.z < stone.z - 2.7);
  assert.ok(Math.hypot(pet.x - stone.x, pet.z - (stone.z - 3)) <= .2);
});

test('capped-frame partner dash and pounce avoid tunneling through stones and continue toward contact', () => {
  for (const kind of ['dash', 'pounce']) {
    const { encounter, simulation } = setup(), stone = STONES[0], boss = encounter.state.boss, pet = encounter.state.pet;
    Object.assign(boss, { x: stone.x, z: stone.z - 3, y: heightAt(stone.x, stone.z - 3) });
    bossAction(encounter, 'stunned'); boss.action.duration = 10;
    Object.assign(pet, { x: stone.x, z: stone.z + 3, y: heightAt(stone.x, stone.z + 3) });
    if (kind === 'pounce') pet.action = { kind, elapsed: 0, duration: .8, serial: 100, progress: 0 };
    for (let frame = 0; frame < 40; frame++) {
      encounter.step(.05, simulation.state, { petSkill: kind === 'dash' && frame === 0 });
      for (const obstacle of STONES) assert.ok(Math.hypot(pet.x - obstacle.x, pet.z - obstacle.z) >= obstacle.radius + .22 - 1e-8, kind);
      const jump = pet.action.kind === 'pounce' ? Math.sin(pet.action.progress * Math.PI) * .65 : 0;
      assert.ok(Math.abs(pet.y - heightAt(pet.x, pet.z) - jump) < .00001, kind);
    }
    assert.ok(pet.z < stone.z, kind);
    assert.ok(Math.hypot(pet.x - boss.x, pet.z - boss.z) <= 1.3, kind);
  }
});

test('defeat wakes both actors at the last checkpoint with current level health', () => {
  const stats={health:180},checkpoint={x:-72,z:-180};
  const encounter=createEncounter({stats,checkpoint:()=>checkpoint}),simulation=createFeelSimulation();
  Object.assign(simulation.state.player,{x:0,z:-20,y:heightAt(0,-20)});encounter.step(.016,simulation.state);
  encounter.state.player.health=0;encounter.step(.016,simulation.state);
  for(let i=0;i<240 && !encounter.state.respawn;i++)encounter.step(1/120,simulation.state);
  assert.equal(encounter.state.status,'dormant');assert.equal(encounter.state.respawn.x,checkpoint.x);assert.equal(encounter.state.respawn.z,checkpoint.z);
  assert.equal(encounter.state.player.health,180);assert.equal(encounter.state.pet.health,100);
  assert.ok(Math.hypot(encounter.state.pet.x-checkpoint.x,encounter.state.pet.z-checkpoint.z)<2);
});
test('level health increases preserve damage, herbs heal partly and camp heals partner',()=>{
  const stats={health:120},encounter=createEncounter({stats}),simulation=createFeelSimulation();
  encounter.state.player.health=60;stats.health=140;encounter.step(.016,simulation.state);assert.equal(encounter.state.player.health,80);
  encounter.heal(18);assert.equal(encounter.state.player.health,98);
  encounter.state.pet.health=0;encounter.heal();assert.equal(encounter.state.player.health,140);assert.equal(encounter.state.pet.health,100);
});

test('the exploring partner follows onto the same climbable ledge and keeps its paws supported',async()=>{
  const {createValleyWorld,SOLIDS}=await import('./world.js');const world=createValleyWorld(),ledge=SOLIDS.find(s=>s.id==='practice-ledge');
  const encounter=createEncounter({world}),simulation=createFeelSimulation({world,bounds:null,posts:[]});
  Object.assign(simulation.state.player,{x:ledge.x,z:ledge.z,y:ledge.top});
  Object.assign(encounter.state.pet,{x:ledge.x,z:ledge.z+ledge.halfZ+.33,y:heightAt(ledge.x,ledge.z+ledge.halfZ+.33)});
  let climbing=false;
  for(let i=0;i<600;i++){encounter.step(1/120,simulation.state);climbing ||= encounter.state.pet.climbing;}
  assert.equal(climbing,true);assert.ok(Math.abs(encounter.state.pet.y-ledge.top)<.01);assert.ok(Math.hypot(encounter.state.pet.x-simulation.state.player.x,encounter.state.pet.z-simulation.state.player.z)<2);
});
test('leaving the ring ends combat without taking possessions or sending the player back',async()=>{
  const {createValleyWorld}=await import('./world.js');const encounter=createEncounter({world:createValleyWorld()}),simulation=createFeelSimulation();
  Object.assign(simulation.state.player,{x:0,z:-20,y:heightAt(0,-20)});encounter.step(.016,simulation.state);assert.equal(encounter.state.status,'fighting');
  encounter.state.player.health=80;Object.assign(simulation.state.player,{x:-20,z:-65,y:heightAt(-20,-65)});encounter.step(.016,simulation.state);
  assert.equal(encounter.state.status,'dormant');assert.equal(encounter.state.player.health,80);assert.equal(encounter.state.respawn,null);assert.equal(encounter.state.boss.health,360);
});


test('the exploring pet wades through shallow lake water, paddles at the deep surface and walks back ashore continuously',async()=>{
  const {createValleyWorld,LAKE}=await import('./world.js'),world=createValleyWorld();
  const bond=Object.freeze({level:4}),encounter=createEncounter({world,bond:bond.level}),simulation=createFeelSimulation({world,bounds:null,posts:[],target:()=>null});
  simulation.reset({x:-160,z:-374});
  Object.assign(encounter.state.pet,{x:-160.9,z:-373.2,y:world.floorAt(-160.9,-373.2)});
  const pet=encounter.state.pet,initialHealth=pet.health;
  let shallow=false,deep=false;
  const frame=input=>{
    const previous={x:pet.x,y:pet.y,z:pet.z};
    simulation.step(1/120,input);encounter.step(1/120,simulation.state);
    const water=world.waterAt(pet.x,pet.z),floor=world.floorAt(pet.x,pet.z,pet.y+.5);
    assert.ok(pet.y>=floor-1e-8);
    assert.ok(Math.abs(pet.y-previous.y)<.03,'entering and leaving the water does not snap vertically');
    assert.ok(Math.hypot(pet.x-previous.x,pet.z-previous.z)<=5.5/120+1e-8,'following uses physical movement');
    if(water && water.depth>0 && water.depth<=.22 && !pet.swimming){shallow=true;assert.equal(pet.y,floor);}
    if(water && water.depth>1 && pet.swimming){deep=true;assert.equal(pet.action.kind,'swim');assert.ok(Math.abs(pet.y-(LAKE.height-.22))<1e-8);assert.equal(pet.ground,pet.y);}
  };
  for(let i=0;i<3000&&simulation.state.player.z>-390;i++)frame({moveZ:-1});
  for(let i=0;i<600;i++)frame({});
  assert.equal(shallow,true);assert.equal(deep,true);assert.equal(pet.swimming,true);
  assert.ok(Math.hypot(pet.x-(simulation.state.player.x-.9),pet.z-(simulation.state.player.z+.8))<=.2);
  for(let i=0;i<3000&&simulation.state.player.z<-374;i++)frame({moveZ:1});
  for(let i=0;i<600;i++)frame({});
  assert.equal(pet.swimming,false);assert.equal(world.waterAt(pet.x,pet.z),null);
  assert.equal(pet.y,world.floorAt(pet.x,pet.z,pet.y+.5));assert.notEqual(pet.action.kind,'swim');
  assert.equal(encounter.state.status,'dormant');assert.equal(pet.health,initialHealth);
  assert.equal(encounter.state.counts.petHits,0);assert.deepEqual(bond,{level:4});
});

test('a supported bridge over water keeps the pet walking above it rather than pulling it down to swim',()=>{
  const world={floorAt:()=>2,climbContact:()=>null,resolve:()=>{},waterAt:()=>({id:'lake',height:1,depth:4}),solids:[],trees:[]};
  const encounter=createEncounter({world}),simulation=createFeelSimulation();
  Object.assign(simulation.state.player,{x:60,z:2,y:2});Object.assign(encounter.state.pet,{x:57,z:2,y:2});
  advance(encounter,simulation,1);
  assert.equal(encounter.state.pet.swimming,false);assert.equal(encounter.state.pet.y,2);assert.notEqual(encounter.state.pet.action.kind,'swim');
});


test('initialization and reset place the partner on the checkpoint support before the first tick',async()=>{
  const {createValleyWorld,CAMPS}=await import('./world.js'),world=createValleyWorld();
  let checkpoint=CAMPS.find(camp=>camp.id==='meadow');
  const encounter=createEncounter({world,checkpoint:()=>checkpoint});
  for(const camp of [checkpoint,CAMPS.find(camp=>camp.id==='shore')]) {
    checkpoint=camp;if(camp.id==='shore')encounter.reset();
    const pet=encounter.state.pet;
    assert.equal(pet.x,camp.x-.9);assert.equal(pet.z,camp.z+.8);
    assert.equal(pet.y,world.floorAt(pet.x,pet.z));assert.equal(pet.ground,pet.y);
    assert.equal(pet.swimming,false);assert.equal(pet.health,pet.maxHealth);
  }
});
