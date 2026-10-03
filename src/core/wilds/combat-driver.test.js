import test from 'node:test';
import assert from 'node:assert/strict';
import { enterFight } from '../../../scripts/lh/wilds-fight.mjs';

test('performance can enter and walk to combat using only buttons and key events', async () => {
  const calls = [], keys = [], buttons = [];
  let position = { x: -106.5, y: 0, z: -180 }, targetId = null;
  const app = {
    async clickSel(button) { buttons.push(button); },
    async waitFor() {},
    async js(source) { calls.push(source); return { player: { position }, cameraYaw: 0, frozen: false, combat: { targetId } }; },
    async send(method, input) {
      assert.equal(method, 'Input.dispatchKeyEvent');
      keys.push([input.type, input.code]);
      if (input.type === 'keyDown' && input.code === 'KeyW') position = { x: -120, y: 0, z: -200 };
      if (input.type === 'keyDown' && input.code === 'Tab') targetId = 'mossback-warden';
    },
  };
  const result = await enterFight(app);
  assert.deepEqual(buttons, ['#wilds-leave', '#wilds-enter']);
  assert.ok(keys.some(([type, code]) => type === 'keyDown' && code === 'KeyW'));
  assert.ok(keys.some(([type, code]) => type === 'keyUp' && code === 'KeyW'));
  assert.equal(result.combat.targetId, 'mossback-warden');
  assert.ok(calls.every(source => !source.includes('.place(') && !source.includes('delete ') && !source.includes('__lhFrozenAt =')));
});

test('the real-input player reacts sideways to roots even outside melee range', async () => {
  const { fightInput } = await import('../../../scripts/lh/flows/wilds.mjs');
  const input = fightInput({ elapsedMs: 1000, cameraYaw: 0, player: { position: { x: 0, z: 12 }, stamina: 100 }, combat: { targetId: 'mossback-warden', playerAction: null, pet: { health: 0 }, boss: { health: 100, position: { x: 0, z: 0 }, mode: 'telegraph', move: 'roots', nextActionAt: 1500 } } });
  assert.deepEqual(input.keys, ['KeyD']);
});
