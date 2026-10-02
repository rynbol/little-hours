import { dispatchSequenceInput } from './sequence.mjs';
import { fightInput, movementInput } from './flows/wilds.mjs';

const D = 'window.__littleHours.wilds.diagnostics()';
const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyT', 'KeyQ', 'ControlLeft', 'Tab'];
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const snapshot = app => app.js(`(() => { const d = ${D}; return { player: d.player, combat: d.combat, events: d.eventHistory, cameraYaw: d.cameraYaw, elapsedMs: d.elapsedMs, phase: d.phase, frozen: window.__lhFrozenAt != null }; })()`);

async function tap(app, code) {
  try { await dispatchSequenceInput(app, { type: 'keyDown', code }); }
  finally { await dispatchSequenceInput(app, { type: 'keyUp', code }); }
}

export async function prepareFight(app) {
  await app.waitFor('window.__littleHours.wilds.ready()', { what: 'the Wilds to render before the fight measurement' });
  const before = await snapshot(app);
  if (before.combat.boss.health <= 0) throw new Error('Fight measurement needs a fresh undefeated Warden encounter');
  const position = { x: -120, z: -200 }, boss = before.combat.boss.position;
  const yaw = Math.atan2(position.x - boss.x, position.z - boss.z);
  const placed = await app.js(`(() => { delete window.__lhFrozenAt; const placed = window.__littleHours.wilds.place(${JSON.stringify({ position, yaw, camera: { yaw } })}); document.getElementById('wilds-canvas').focus(); return placed; })()`);
  if (!placed) throw new Error('Fight fixture is outside loaded terrain');
  await tap(app, 'Tab');
  await app.waitFor(`${D}.combat.targetId === 'mossback-warden'`, { what: 'actual Tab input to lock the Warden' });
  return snapshot(app);
}

export async function driveFight(app, { durationMs = 15000 } = {}) {
  if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 120000) throw new Error('Fight duration must be 1–120000 ms');
  const move = movementInput(app), seen = new Set(), events = [];
  let failed = false;
  try {
    const before = await snapshot(app), started = performance.now();
    if (before.frozen || before.phase !== 'running') throw new Error('Fight measurement requires a running, unfrozen Wilds clock');
    for (const event of before.events || []) seen.add(JSON.stringify(event));
    let state = before;
    do {
      if (state.frozen || state.phase !== 'running') throw new Error('The Wilds clock stopped during the fight measurement');
      const input = state.combat.boss.health > 0 ? fightInput(state) : { keys: [], actions: [] };
      await move(input.keys);
      for (const code of input.actions) await tap(app, code);
      const remaining = durationMs - (performance.now() - started);
      if (remaining > 0) await sleep(Math.min(100, remaining));
      state = await snapshot(app);
      for (const event of state.events || []) {
        const key = JSON.stringify(event);
        if (!seen.has(key)) { seen.add(key); events.push(event); }
      }
    } while (performance.now() - started < durationMs);
    if (state.frozen || state.phase !== 'running' || state.elapsedMs <= before.elapsedMs) throw new Error('The Wilds clock did not advance during the fight measurement');
    const damage = source => events.filter(event => event.type === 'damage' && event.targetId === state.combat.boss.id && event.sourceId === source).reduce((sum, event) => sum + event.amount, 0);
    const playerDamage = damage('player'), petDamage = damage(state.combat.pet.id);
    return {
      bossHealthBefore: before.combat.boss.health, bossHealthAfter: state.combat.boss.health,
      playerDamage, petDamage, phaseBefore: before.combat.boss.phase, phaseAfter: state.combat.boss.phase,
      elapsedMs: state.elapsedMs - before.elapsedMs, durationMs: performance.now() - started,
      active: playerDamage + petDamage > 0 && state.combat.boss.health < before.combat.boss.health,
      defeated: state.combat.boss.health <= 0, events,
    };
  } catch (error) { failed = true; throw error; }
  finally {
    const released = await Promise.allSettled(KEYS.map(code => dispatchSequenceInput(app, { type: 'keyUp', code })));
    const errors = released.filter(result => result.status === 'rejected').map(result => result.reason);
    if (errors.length && !failed) throw new AggregateError(errors, 'Could not release every fight input');
  }
}
