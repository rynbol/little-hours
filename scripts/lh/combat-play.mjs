import { mkdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { repoRoot } from './state.mjs';
import { captureSequence, dispatchSequenceInput } from './sequence.mjs';
import { views } from './steps.mjs';
import { fightInput, movementInput, steeringKeys } from './flows/wilds.mjs';

const D = 'window.__littleHours.wilds.diagnostics()';
const snapshot = app => app.js(`(() => { const d = ${D}; return { player: d.player, combat: d.combat, events: d.eventHistory, cameraYaw: d.cameraYaw, elapsedMs: d.elapsedMs, avatar: d.avatar, frozen: window.__lhFrozenAt != null, hud: { health: document.querySelector('.wilds-health progress')?.value, boss: document.querySelector('.wilds-boss-health')?.value, pet: document.querySelector('.wilds-pet-health')?.value, notice: document.querySelector('.wilds-notice')?.textContent, locked: !document.querySelector('.wilds-target')?.hidden } }; })()`);
async function tap(app, code) {
  try { await dispatchSequenceInput(app, { type: 'keyDown', code }); }
  finally { await dispatchSequenceInput(app, { type: 'keyUp', code }); }
}

export default {
  about: 'Recorded real-time walk from Enter Wilds to a complete Warden fight, without placement or clock control',
  async run(t, style = 'balanced') {
    const app = await t.open({ ...views.wilds.settings, seed: 'one-room', theme: process.env.LH_COMBAT_THEME || 'day', width: 960, height: 640 });
    const folder = join(repoRoot, '..', 'wilds-assets', 'progress-shots', basename(t.out), `wilds-combat-${style}`);
    mkdirSync(folder, { recursive: true });
    await app.clickSel('#wilds-leave');
    const samples = [], events = new Map(), move = movementInput(app);
    let entered, end, walked = false, firstWalked = false, fightBegan = null, retried = false, returned = false, resetClean = null;
    const capture = await captureSequence(app, { durationMs: 120000, events: [] }, folder, { drive: async () => {
      await app.clickSel('#wilds-enter');
      await app.waitFor('window.__littleHours.wilds.ready()');
      entered = await snapshot(app);
      const began = performance.now();
      try {
        while (performance.now() - began < 120000) {
          const state = await snapshot(app);
          const { events: recentEvents, ...sample } = state;
          samples.push({ realMs: performance.now() - began, ...sample });
          for (const event of state.events) events.set(JSON.stringify(event), event);
          if (state.frozen) throw new Error('Real-input combat must run on an advancing real-time clock');
          if (state.combat.boss.mode === 'defeated') break;
          const died = [...events.values()].some(event => event.type === 'player-defeated');
          if (died && !retried) {
            if (style !== 'death-retry') break;
            retried = true; walked = false; fightBegan = null;
            resetClean = !state.combat.targetId && state.combat.boss.health === 420 && state.player.health === state.player.maxHealth && !state.combat.playerAction;
          }
          if (!walked) {
            const keys = steeringKeys(state.player.position, { x: -120, z: -200 }, state.cameraYaw);
            await move(keys);
            walked = !keys.length; firstWalked ||= walked;
          } else {
            fightBegan ??= performance.now();
            const styleMs = performance.now() - fightBegan;
            if (style === 'leave-return' && !returned && styleMs > 4500) {
              await move([]); await app.clickSel('#wilds-leave'); await t.sleep(250); await app.clickSel('#wilds-enter');
              await app.waitFor('window.__littleHours.wilds.ready()');
              const reset = await snapshot(app);
              resetClean = !reset.combat.targetId && reset.combat.boss.health === 420 && reset.player.health === reset.player.maxHealth && !reset.combat.playerAction;
              walked = false; returned = true; fightBegan = null;
              continue;
            }
            const input = fightInput(state);
            const boss = state.combat.boss, player = state.player, gap = Math.hypot(player.position.x - boss.position.x, player.position.z - boss.position.z);
            if ((style === 'rush' && styleMs < 9000) || style === 'mash' || (style === 'late-dodge' && styleMs < 12000)) {
              input.keys = steeringKeys(player.position, boss.position, state.cameraYaw, 2.4);
              input.actions = [...(state.combat.targetId ? [] : ['Tab']), 'KeyF', 'KeyQ'];
              if (style === 'late-dodge' && boss.mode === 'telegraph' && boss.nextActionAt - state.elapsedMs < 90) input.actions.push('ControlLeft');
            }
            if (style === 'back-off' && styleMs < 8000) input.keys = ['KeyS'];
            if (style === 'circle' && styleMs < 12000) input.keys = ['KeyD'];
            if (style === 'idle' && styleMs < 14000) { input.keys = []; input.actions = styleMs < 200 ? ['KeyR'] : []; }
            if (style === 'pet-alone') { input.actions = input.actions.filter(code => code !== 'KeyF'); if (gap > 9 && boss.mode !== 'charge') input.keys = []; }
            if (style === 'death-retry' && !retried) { input.keys = steeringKeys(player.position, boss.position, state.cameraYaw, 2); input.actions = ['KeyR']; }
            if (style === 'pointer' && input.actions.includes('KeyF')) {
              input.actions = input.actions.filter(code => code !== 'KeyF');
              await dispatchSequenceInput(app, { type: 'mousePressed', x: 480, y: 320, button: 'left', buttons: 1 });
              await dispatchSequenceInput(app, { type: 'mouseReleased', x: 480, y: 320, button: 'left' });
            }
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
    writeFileSync(join(folder, 'combat.json'), JSON.stringify({ style, entered, end, walked: firstWalked, retried, returned, resetClean, events: [...events.values()], samples }, null, 2));
    const damage = source => [...events.values()].filter(event => event.type === 'damage' && event.targetId === end.combat.boss.id && event.sourceId === source).reduce((sum, event) => sum + event.amount, 0);
    t.check('Enter Wilds begins at camp and real keys reach the arena', Math.hypot(entered.player.position.x + 106.5, entered.player.position.z + 180) < .1 && firstWalked);
    t.check('the advancing-clock fight is captured from entry through the result', capture.frames.length > 100 && end.elapsedMs > entered.elapsedMs + 5000 && capture.recording?.events.some(event => event.code === 'KeyW'));
    t.check('player and companion both land attacks during actual play', (style === 'pet-alone' || damage('player') > 0) && damage(end.combat.pet.id) > 0, { player: damage('player'), pet: damage(end.combat.pet.id) });
    t.check('the whole fight reaches victory with only the intended retry', end.combat.boss.mode === 'defeated' && (style === 'death-retry' ? retried && resetClean : ![...events.values()].some(event => event.type === 'player-defeated')), { boss: end.combat.boss.health, health: end.player.health });
    t.check('HUD meters follow every sampled combat state', samples.every(sample => sample.hud.health === sample.player.health && sample.hud.boss === sample.combat.boss.health && sample.hud.pet === sample.combat.pet.health));
    if (style === 'leave-return') t.check('leaving mid-fight and entering resets the encounter', returned && resetClean);
    console.log(`Combat recording: ${folder}`);
    await t.close(app);
  },
};
