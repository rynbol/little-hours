import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { wildsShotView, captureWildsCrop } from './lh/wilds-shots.mjs';

test('piece views pin seed, time, player and camera independently of gameplay camera changes', async () => {
  for (const piece of ['player', 'grass', 'meadow', 'vista', 'wind']) {
    const calls = [], view = wildsShotView(piece);
    await view.go({ async waitFor() {}, async js(code) { calls.push(code); } });
    assert.equal(view.settings.randomSeed, 7);
    assert.equal(view.settings.reducedMotion, piece !== 'wind');
    assert.match(calls[0], /__lhStartAt \+ 4000/);
    assert.match(calls[1], /wilds.place/);
    assert.match(calls[2], /camera.position.set/);
    assert.match(calls[2], /camera.setTarget/);
    assert.equal(view.scene, 'wilds');
  }
});

test('piece crops capture the chosen region at twice its screen resolution', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'wilds-crop-'));
  try {
    let command;
    const file = join(folder, 'crop.png');
    await captureWildsCrop({ async send(method, options) { command = { method, options }; return { data: Buffer.from('pixels').toString('base64') }; } }, file, [.25, .2, .5, .6], { width: 1200, height: 800 });
    assert.equal(command.method, 'Page.captureScreenshot');
    assert.deepEqual(command.options.clip, { x: 300, y: 160, width: 600, height: 480, scale: 2 });
    assert.equal(readFileSync(file, 'utf8'), 'pixels');
  } finally { rmSync(folder, { recursive: true }); }
});
