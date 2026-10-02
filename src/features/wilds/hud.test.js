import test from 'node:test';
import assert from 'node:assert/strict';
import { createWildsHud } from './hud.js';

function fixture() {
  const all = [];
  const document = { createElement(tag) {
    const element = { tag, children: [], dataset: {}, attributes: {}, textContent: '', append(...children) { this.children.push(...children); }, setAttribute(name, value) { this.attributes[name] = value; }, remove() { this.removed = true; } };
    all.push(element);
    return element;
  } };
  const container = document.createElement('main');
  container.ownerDocument = document;
  return { all, container, hud: createWildsHud(container) };
}

test('exploration HUD reports stamina and route context then removes its DOM on leave', () => {
  const { all, container, hud } = fixture();
  const player = { position: { z: 0 }, stamina: 84.5, maxStamina: 104 };
  hud.update({ player });
  assert.equal(all.find(e => e.tag === 'strong').textContent, 'Hearth Clearing');
  assert.equal(all.find(e => e.tag === 'progress').value, 84.5);
  assert.equal(all.find(e => e.tag === 'progress').max, 104);
  assert.equal(all.find(e => e.className === 'wilds-stamina-value').textContent, '85 / 104');
  assert.equal(all.find(e => e.tag === 'progress').attributes['aria-label'], 'Stamina');
  hud.update({ player: { ...player, position: { z: -150 }, stamina: 0 } });
  assert.equal(all.find(e => e.tag === 'strong').textContent, 'The Long Meadow');
  assert.equal(container.children[0].dataset.exhausted, 'true');
  hud.dispose();
  assert.equal(container.children[0].removed, true);
});
