import test from 'node:test';
import assert from 'node:assert/strict';
import { createWildsHud } from '../../features/wilds/hud.js';
import { createMovementState } from './movement.js';
import { createCombatState } from './combat.js';

test('C2 the HUD acknowledges a queued pet skill before contact and clears it on recall', () => {
  const nodes = [];
  const document = { createElement() { const node = { className: '', textContent: '', dataset: {}, style: {}, setAttribute() {}, append() {}, prepend() {}, remove() {} }; nodes.push(node); return node; } };
  const hud = createWildsHud({ ownerDocument: document, append() {} });
  const combat = createCombatState({ player: createMovementState({ position: { x: 0, y: 0, z: 0 } }) });
  combat.pet.skillQueued = true;
  hud.update({ combat, player: combat.player });
  const skill = nodes.find(node => node.className === 'wilds-pet-skill'), companion = nodes.find(node => node.className === 'wilds-companion');
  assert.match(skill.textContent, /Closing in/);
  assert.equal(companion.dataset.ready, 'false');
  combat.pet.skillQueued = false; combat.pet.mode = 'recall';
  hud.update({ combat, player: combat.player });
  assert.match(skill.textContent, /ready/);
  assert.equal(companion.dataset.ready, 'true');
});
