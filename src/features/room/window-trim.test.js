import test from 'node:test';
import assert from 'node:assert/strict';
import { moulding, sillNosing, MULLION } from './window-trim.js';

test('the window mullion is a moulded post with a raised face, lit edge beads and fine grain, not a flat bar', () => {
  const parts = moulding(3.7, 'y'), by = tone => parts.filter(part => part.tone === tone);
  const [core] = by('core'), [face] = by('face'), front = MULLION.depth / 2;
  assert.ok(core.bevel >= 0.015, `core bevel ${core.bevel} catches light on its arrises`);
  assert.ok(face.at[2] > front && face.size[0] < core.size[0], 'a narrower face stands proud on the room side');
  const beads = by('lit');
  assert.deepEqual(beads.map(bead => Math.sign(bead.at[0])).sort(), [-1, 1], 'a lit bead runs down each edge of the face');
  for (const bead of beads) assert.ok(bead.at[2] > face.at[2] && bead.size[1] <= core.size[1], 'beads sit on the face, within the post');
  const grain = by('grain');
  assert.ok(grain.length >= 2 && grain.every(line => Math.abs(line.at[0]) < face.size[0] / 2 && line.size[0] < 0.005), 'hairline grain runs within the face');
  const across = moulding(4.12, 'x');
  assert.ok(across.every((part, i) => Math.abs(part.size[0] - parts[i].size[1] - 0.42) < 1e-9), 'the transom is the same profile laid along x');
  assert.ok(across.every((part, i) => part.size[1] === parts[i].size[0] && part.at[1] === parts[i].at[0]));
});

test('the sill has a lit bullnose along its front edge and a shadow groove beneath', () => {
  const parts = sillNosing(4.62, { height: 0.18, depth: 0.68 }), [nose] = parts.filter(part => part.tone === 'lit'), [groove] = parts.filter(part => part.tone === 'shadow');
  const [[x0, y, z], [x1]] = nose.rod;
  assert.ok(x1 - x0 === 4.62 && y > 0 && z > 0.3, 'the nose runs the full front-top edge');
  assert.ok(groove.at[1] < -0.09 && groove.at[2] > 0.25, 'the drip groove sits under the front');
});
