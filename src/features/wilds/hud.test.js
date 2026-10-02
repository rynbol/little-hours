import test from 'node:test';
import assert from 'node:assert/strict';
import { createWildsHud } from './hud.js';

function fixture() {
  const document = { createElement: tagName => ({
    tagName, className: '', children: [], attributes: {}, style: {}, dataset: {}, textContent: '', hidden: false,
    setAttribute(key, value) { this.attributes[key] = value; },
    append(...children) { this.children.push(...children); for (const child of children) child.parent = this; },
    prepend(...children) { this.children.unshift(...children); for (const child of children) child.parent = this; },
    remove() { this.parent.children = this.parent.children.filter(child => child !== this); },
  }) };
  const container = document.createElement('div');
  container.ownerDocument = document;
  const hud = createWildsHud(container);
  const find = (predicate, node = container) => predicate(node) ? node : node.children.map(child => find(predicate, child)).find(Boolean);
  const combat = {
    progress: { totalXp: 0 },
    pet: { id: 'cat', health: 42, maxHealth: 60, skillReadyAt: 6500, recoverAt: 0, mode: 'follow' },
    boss: { id: 'mossback-warden', name: 'The Mossback Warden', health: 300, maxHealth: 420, phase: 1, mode: 'idle', engaged: false, move: null },
    targetId: null,
  };
  const player = { health: 87, maxHealth: 100, stamina: 61.2, maxStamina: 100, position: { x: 0, y: 0, z: 0 } };
  return { hud, container, combat, player, className: name => find(node => node.className.split(' ').includes(name)), meter: name => find(node => node.attributes['aria-label'] === name), update(extra = {}) { hud.update({ player, combat, elapsedMs: 1500, world: { location: 'Bellroot Forest' }, ...extra }); } };
}

test('the HUD shows actual health, level progress and companion cooldown', () => {
  const f = fixture();
  f.combat.progress.totalXp = 260;
  f.update();
  assert.equal(f.className('wilds-region').textContent, 'Bellroot Forest');
  assert.equal(f.className('wilds-level').textContent, 'Level 3');
  assert.deepEqual([f.meter('Health').value, f.meter('Health').max], [87, 100]);
  assert.deepEqual([f.meter('Stamina').value, f.meter('Stamina').max], [61.2, 100]);
  assert.deepEqual([f.meter('Experience').value, f.meter('Experience').max], [20, 180]);
  assert.equal(f.className('wilds-pet-name').textContent, 'Miso · 42 / 60');
  assert.equal(f.className('wilds-pet-skill').textContent, 'Pet skill · 5s');
  f.update({ elapsedMs: 6500 });
  assert.equal(f.className('wilds-pet-skill').textContent, 'Q · Pet skill ready');
  f.combat.pet.mode = 'knockout';
  f.combat.pet.recoverAt = 13000;
  f.update({ elapsedMs: 9000 });
  assert.equal(f.className('wilds-pet-skill').textContent, 'Resting · 4s');
  f.hud.dispose();
  assert.equal(f.container.children.length, 0);
});

test('boss telegraphs and projected lock marker track the live combat target', () => {
  const f = fixture();
  f.update();
  assert.equal(f.className('wilds-boss').hidden, true);
  f.combat.boss.engaged = true;
  f.combat.boss.mode = 'telegraph';
  f.combat.boss.move = 'charge';
  f.combat.targetId = 'mossback-warden';
  f.update({ targetScreen: { x: 47, y: 39, visible: true } });
  assert.equal(f.className('wilds-boss').hidden, false);
  assert.deepEqual([f.meter('Boss health').value, f.meter('Boss health').max], [300, 420]);
  assert.equal(f.className('wilds-boss-hint').textContent, 'Lead the charge into a standing stone');
  assert.deepEqual([f.className('wilds-target').hidden, f.className('wilds-target').style.left, f.className('wilds-target').style.top], [false, '47%', '39%']);
  f.combat.boss.mode = 'exposed';
  f.update({ targetScreen: { x: 120, y: 39, visible: false } });
  assert.equal(f.className('wilds-boss-hint').textContent, 'Heartwood exposed');
  assert.equal(f.className('wilds-target').hidden, true);
});

test('reward and level-up notice survives following frames then expires on game time', () => {
  const f = fixture();
  f.combat.boss.mode = 'defeated';
  f.update({ events: [{ type: 'boss-defeated', reward: { xp: 260, materials: { heartwood: 1 }, trophy: 'mossback-warden' } }, { type: 'level-up', level: 3 }] });
  assert.equal(f.className('wilds-notice').hidden, false);
  assert.match(f.className('wilds-notice').textContent, /Mossback Warden calmed/);
  assert.equal(f.className('wilds-notice').textContent, 'Mossback Warden calmed · +260 XP · Heartwood +1 · Warden trophy · Level 3');
  f.update({ elapsedMs: 5000 });
  assert.equal(f.className('wilds-notice').hidden, false);
  f.update({ elapsedMs: 7000 });
  assert.equal(f.className('wilds-notice').hidden, true);
});
