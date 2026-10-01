import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { leafClump, LEAF_OUTLINE, MOON_CANOPY } from './furniture.js';

test('moon tree clumps are soft rounded leaf cards, lit gold on top and cool beneath, without speckled tones', () => {
  const engine = new NullEngine(), scene = new Scene(engine), leaves = 120;
  const clump = leafClump(new TransformNode('tree', scene), [0, 2, 0], [0.25, 0.18, 0.25], 3, leaves);
  const colors = clump.getVerticesData('color'), normals = clump.getVerticesData('normal'), cardStart = colors.length / 4 - leaves * LEAF_OUTLINE.length;
  assert.ok(LEAF_OUTLINE.length >= 6, 'a leaf card has a rounded outline, not a diamond');
  const neighbours = [];
  for (let a = 0; a < leaves; a++) for (let b = a + 1; b < leaves; b++) {
    const [va, vb] = [a, b].map(card => cardStart + card * LEAF_OUTLINE.length);
    const facing = [0, 1, 2].reduce((sum, i) => sum + normals[va * 3 + i] * normals[vb * 3 + i], 0);
    if (facing > 0.995) neighbours.push(Math.max(...[0, 1, 2].map(i => Math.abs(colors[va * 4 + i] - colors[vb * 4 + i]))));
  }
  assert.ok(neighbours.length > 0 && Math.max(...neighbours) < 0.03, `neighbouring cards differ by up to ${Math.max(...neighbours).toFixed(3)}`);
  const hue = hex => Color3.FromHexString(hex).toHSV().r;
  assert.ok(hue(MOON_CANOPY.top) > 55 && hue(MOON_CANOPY.top) < 70 && hue(MOON_CANOPY.rim) < 55, 'the lit top and rim lean gold');
  assert.ok(hue(MOON_CANOPY.under) > 170, 'the underside is a cool blue-green');
  engine.dispose();
});

test('moon tree leaf cards shade by where each corner sits on the clump, so touching cards blend into one soft mass', () => {
  const engine = new NullEngine(), scene = new Scene(engine), leaves = 110;
  const clump = leafClump(new TransformNode('tree', scene), [0, 2, 0], [0.25, 0.18, 0.25], 3, leaves);
  const positions = clump.getVerticesData('position'), colors = clump.getVerticesData('color'), count = colors.length / 4, cardStart = count - leaves * LEAF_OUTLINE.length;
  const card = v => Math.floor((v - cardStart) / LEAF_OUTLINE.length), seams = [];
  for (let a = cardStart; a < count; a++) for (let b = a + 1; b < count; b++) {
    if (card(a) === card(b) || Math.hypot(...[0, 1, 2].map(i => positions[a * 3 + i] - positions[b * 3 + i])) > 0.012) continue;
    seams.push(Math.max(...[0, 1, 2].map(i => Math.abs(colors[a * 4 + i] - colors[b * 4 + i]))));
  }
  seams.sort((x, y) => x - y);
  assert.ok(seams.length > 20, `${seams.length} touching corners`);
  assert.ok(seams[Math.floor(seams.length * 0.95)] < 0.04, `touching cards differ by up to ${seams[Math.floor(seams.length * 0.95)].toFixed(3)} at the 95th percentile`);
  engine.dispose();
});
