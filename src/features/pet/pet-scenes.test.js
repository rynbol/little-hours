import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PET_SHOP } from '../../core/pets.js';
import { petScene, friendshipScene } from './pet-scenes.js';

function assertScene(markup, pets) {
  assert.match(markup, /^<svg[^>]*viewBox="0 0 \d+ \d+"[^>]*aria-hidden="true"[^>]*focusable="false">/);
  assert.equal((markup.match(/<svg\b/g) || []).length, 1);
  assert.equal((markup.match(/<\/svg>/g) || []).length, 1);
  assert.deepEqual([...markup.matchAll(/data-species="([a-z]+)"/g)].map(match => match[1]), pets);
  assert.doesNotMatch(markup, /NaN|Infinity|undefined|<image|<script|\bid=|\bhref=|url\(|onload=/i);
  for (const match of markup.matchAll(/class="([^"]+)"/g)) assert.ok(match[1].split(' ').every(name => name.startsWith('pet-scene')), match[1]);
  const opens = (markup.match(/<g(?:\s|>)/g) || []).length;
  assert.equal((markup.match(/<\/g>/g) || []).length, opens);
}

test('every owned species has a self-contained vector portrait with its chosen ribbon', () => {
  for (const { id } of PET_SHOP) {
    const markup = petScene(id, '#cb8796');
    assertScene(markup, [id]);
    assert.match(markup, /class="pet-scene-ribbon" fill="#cb8796"/);
    assert.match(markup, /pet-scene-tail/);
    assert.match(markup, /pet-scene-head/);
  }
  assert.equal(new Set(PET_SHOP.map(({ id }) => petScene(id))).size, PET_SHOP.length);
});

test('each distinct friendship renders both actual species and shared moment props', () => {
  for (const first of PET_SHOP) for (const second of PET_SHOP) {
    if (first.id === second.id) continue;
    const markup = friendshipScene(first.id, second.id);
    assertScene(markup, [first.id, second.id]);
    assert.match(markup, /pet-scene-character-left/);
    assert.match(markup, /pet-scene-character-right/);
    for (const prop of ['play', 'snack', 'quiet']) assert.match(markup, new RegExp(`pet-scene-${prop}-prop`));
    assert.notEqual(markup, friendshipScene(first.id, first.id));
  }
});

test('invalid scene input cannot add executable markup or broken SVG values', () => {
  assertScene(petScene('"><script>alert(1)</script>', 'red" onload="alert(1)'), ['cat']);
  assertScene(friendshipScene('__proto__', null), ['cat', 'cat']);
  assert.match(petScene('dog', '#fff'), /class="pet-scene-ribbon" fill="#d9af65"/);
});
