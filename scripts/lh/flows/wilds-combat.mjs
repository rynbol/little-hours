import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { captureSequence, dispatchSequenceInput } from '../sequence.mjs';
import { views } from '../steps.mjs';
import { fightInput, movementInput, steeringKeys } from './wilds.mjs';

const D = 'window.__littleHours.wilds.diagnostics()';
const snapshot = app => app.js(`(() => { const d = ${D}; return { player: d.player, combat: d.combat, events: d.eventHistory, cameraYaw: d.cameraYaw, elapsedMs: d.elapsedMs, avatar: d.avatar, frozen: window.__lhFrozenAt != null, hud: { health: document.querySelector('.wilds-health progress')?.value, boss: document.querySelector('.wilds-boss-health')?.value, pet: document.querySelector('.wilds-pet-health')?.value, notice: document.querySelector('.wilds-notice')?.textContent, locked: !document.querySelector('.wilds-target')?.hidden } }; })()`);
async function tap(app, code) {
  try { await dispatchSequenceInput(app, { type: 'keyDown', code }); }
  finally { await dispatchSequenceInput(app, { type: 'keyUp', code }); }
}

export default {
  about: 'Recorded real-time walk from Enter Wilds to a complete Warden fight, without placement or clock control',
  async run(t) {
    const app = await t.open({ ...views.wilds.settings, seed: 'one-room', theme: process.env.LH_COMBAT_THEME || 'day', width: 960, height: 640 });
    const folder = join(t.out, 'wilds-combat');
    mkdirSync(folder, { recursive: true });
    await app.clickSel('#wilds-leave');
    const samples = [], events = new Map(), move = movementInput(app);
    let entered, end, walked = false;
    const capture = await captureSequence(app, { durationMs: 120000, events: [] }, folder, { drive: async () => {
      await app.clickSel('#wilds-enter');
      await app.waitFor('window.__littleHours.wilds.ready()');
      await app.clickSel('#wilds-canvas');
      entered = await snapshot(app);
      const began = performance.now();
      try {
        while (performance.now() - began < 120000) {
          const state = await snapshot(app);
          samples.push({ realMs: performance.now() - began, ...state });
          for (const event of state.events) events.set(JSON.stringify(event), event);
          if (state.frozen) throw new Error('Real-input combat must run on an advancing real-time clock');
          if (state.combat.boss.mode === 'defeated' || [...events.values()].some(event => event.type === 'player-defeated')) break;
          if (!walked) {
            const keys = steeringKeys(state.player.position, { x: -120, z: -200 }, state.cameraYaw);
            await move(keys);
            walked = !keys.length;
          } else {
            const input = fightInput(state);
            await move(input.keys);
            for (const code of input.actions) await tap(app, code);
          }
          await t.sleep(80);
        }
      } finally { await move([]); }
      await t.sleep(500);
      end = await snapshot(app);
      samples.push({ realMs: performance.now() - began, ...end });
      for (const event of end.events) events.set(JSON.stringify(event), event);
    } });
    writeFileSync(join(folder, 'combat.json'), JSON.stringify({ entered, end, walked, events: [...events.values()], samples }, null, 2));
    const damage = source => [...events.values()].filter(event => event.type === 'damage' && event.targetId === end.combat.boss.id && event.sourceId === source).reduce((sum, event) => sum + event.amount, 0);
    t.check('Enter Wilds begins at camp and real keys reach the arena', entered.player.position.x === -106.5 && entered.player.position.z === -180 && walked);
    t.check('the advancing-clock fight is captured from entry through the result', capture.frames.length > 100 && end.elapsedMs > entered.elapsedMs + 5000 && capture.recording?.events.some(event => event.code === 'KeyW'));
    t.check('player and companion both land attacks during actual play', damage('player') > 0 && damage(end.combat.pet.id) > 0, { player: damage('player'), pet: damage(end.combat.pet.id) });
    t.check('the whole fight reaches victory without dying', end.combat.boss.mode === 'defeated' && ![...events.values()].some(event => event.type === 'player-defeated'), { boss: end.combat.boss.health, health: end.player.health });
    t.check('HUD meters follow every sampled combat state', samples.every(sample => sample.hud.health === sample.player.health && sample.hud.boss === sample.combat.boss.health && sample.hud.pet === sample.combat.pet.health));
    console.log(`Combat recording: ${folder}`);
    await t.close(app);
  },
};
