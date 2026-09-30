import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { createSeatWorld, spiritsAloft, moonRise, vistaPalette, windowsLit, FLOCK_SECONDS, VISTA_THEMES } from './seat-world.js';

const setup = () => { const engine = new NullEngine(), scene = new Scene(engine); return { engine, scene, world: createSeatWorld(scene, new TransformNode('room', scene)) }; };
const litWindows = world => {
  const land = world.meshes.find(mesh => mesh.name === 'seat-world-land'), { shape } = land.metadata, colors = land.getVerticesData('color');
  let lit = 0;
  for (let i = 0; i < shape.roles.length; i++) if (shape.roles[i] === 'window' && colors[i * 4] > 0.6) lit++;
  return lit;
};

test('the valley lights up and the moon climbs as a focus session goes on', () => {
  assert.equal(windowsLit('dusk', 0), 0.35);
  assert.equal(windowsLit('dusk', 1), 1);
  assert.equal(windowsLit('day', 1), 0);
  assert.equal(spiritsAloft('dusk', 0), 4);
  assert.equal(spiritsAloft('dusk', 1), 34);
  assert.equal(spiritsAloft('day', 1), 0);
  assert.ok(moonRise(1) > moonRise(0));
  assert.equal(vistaPalette('dusk', 0).zenith.toLowerCase(), VISTA_THEMES.dusk.zenith);
  assert.equal(vistaPalette('dusk', 1).zenith.toLowerCase(), '#070b24');
  assert.equal(vistaPalette('rain', 1).zenith, '#3f4a5e');

  const { engine, world } = setup();
  world.setTheme('dusk'); world.setEnabled(true);
  const early = litWindows(world);
  world.setProgress(1);
  const late = litWindows(world);
  assert.ok(early > 20 && late > early * 2, `${early} windows lit at the start, ${late} at the end`);
  world.setTheme('day');
  assert.equal(litWindows(world), 0);
  engine.dispose();
});

test('the seated room closes its open sides, with a door for every passage, and casts no shadows', () => {
  const { engine, world } = setup();
  world.setShell('retreat', {}, []);
  const bare = world.meshes.find(mesh => mesh.name === 'seat-world-shell').getTotalVertices();
  world.setShell('retreat', { '#c9bba2': '#aabbcc' }, [2.35, -2.05]);
  const shells = world.meshes.filter(mesh => mesh.name === 'seat-world-shell');
  assert.equal(shells.length, 1);
  const [shell] = shells, colors = shell.getVerticesData('color'), roles = shell.metadata.shape.roles;
  assert.ok(shell.getTotalVertices() > bare);
  const wall = roles.indexOf('wall');
  assert.deepEqual([...colors.slice(wall * 4, wall * 4 + 3)].map(v => Math.round(v * 255)), [0xaa, 0xbb, 0xcc]);
  assert.ok(world.meshes.every(mesh => mesh.metadata.castShadow === false));
  engine.dispose();
});

test('the vista is built ahead of the first sit but shown only when the chair asks for it, and holds still for reduced motion', () => {
  const { engine, world } = setup();
  assert.equal(world.root.isEnabled(false), false);
  assert.equal(world.meshes.length, 0, 'nothing is built before the first sit');
  world.prepare();
  assert.ok(world.meshes.length >= 7 && !world.root.isEnabled(false), 'preparing builds the vista without showing it');
  world.setEnabled(true);
  const flock = world.meshes.find(mesh => mesh.name === 'seat-world-flock').parent;
  world.animate(FLOCK_SECONDS * 0.2, false);
  const moving = flock.rotation.y;
  world.animate(1, false);
  assert.notEqual(flock.rotation.y, moving);
  const still = flock.rotation.y;
  world.animate(5, true);
  assert.equal(flock.rotation.y, still);
  assert.ok(world.meshes.length <= 9, `${world.meshes.length} vista meshes`);
  engine.dispose();
});

test('the castle, the volcano and the watchtower all stand inside the view from the chair', () => {
  const { engine, world } = setup();
  world.prepare();
  const { shape } = world.meshes.find(mesh => mesh.name === 'seat-world-land').metadata;
  for (const role of ['castle', 'rock', 'rune']) {
    let x = 0, z = 0, count = 0;
    shape.roles.forEach((each, i) => { if (each === role) { x += shape.positions[i * 3]; z += shape.positions[i * 3 + 2]; count++; } });
    const bearing = Math.atan2(x / count, -z / count);
    assert.ok(count > 0 && bearing > -0.95 && bearing < 0.45, `${role} sits ${bearing.toFixed(2)} rad off the window`);
  }
  engine.dispose();
});
