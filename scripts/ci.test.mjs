import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

test('CI runs every lh flow', () => {
  const flows = readdirSync(new URL('./lh/flows/', import.meta.url)).filter(file => file.endsWith('.mjs')).map(file => file.slice(0, -4)).sort();
  const listed = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8').match(/flow: \[([^\]]*)\]/)?.[1].split(',').map(name => name.trim()).sort();
  assert.deepEqual(listed, flows);
});
