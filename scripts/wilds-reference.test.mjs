import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the four provisional visual targets are usable landscape PNGs with recorded prompts', () => {
  const root = new URL('../docs/openworld/reference/', import.meta.url);
  const names = ['player-day.png', 'sword-fight-dusk.png', 'running-grass-rain.png', 'wide-vista.png'];
  for (const name of names) {
    const bytes = readFileSync(new URL(name, root));
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.ok(bytes.readUInt32BE(16) >= 1200);
    assert.ok(bytes.readUInt32BE(20) >= 800);
    assert.ok(bytes.readUInt32BE(16) > bytes.readUInt32BE(20));
  }
  const prompts = JSON.parse(readFileSync(new URL('prompts.json', root)));
  assert.deepEqual(Object.keys(prompts), ['day', 'dusk', 'rain', 'vista']);
  assert.match(readFileSync(new URL('README.md', root), 'utf8'), /Owner approval is pending/);
});
