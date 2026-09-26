import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restoreSoundPrefs, createAudio, soundKey } from './audio.js';

test('sound preferences restore safely from anything', () => {
  assert.deepEqual(restoreSoundPrefs(null), { volume: 30, chime: true });
  assert.deepEqual(restoreSoundPrefs('{bad'), { volume: 30, chime: true });
  assert.deepEqual(restoreSoundPrefs(JSON.stringify({ volume: 250, chime: false })), { volume: 100, chime: false });
  assert.deepEqual(restoreSoundPrefs(JSON.stringify({ volume: -3.4, chime: 'yes' })), { volume: 0, chime: true });
});

test('choices are remembered without creating any audio', () => {
  const saved = new Map();
  const audio = createAudio({ getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) });
  audio.setVolume(55);
  audio.setChime(false);
  assert.deepEqual(JSON.parse(saved.get(soundKey)), { volume: 55, chime: false });
  assert.deepEqual(createAudio({ getItem: key => saved.get(key) ?? null, setItem() {} }).prefs, { volume: 55, chime: false });
});

test('a chime before any gesture stays silent instead of failing', async () => {
  const audio = createAudio({ getItem: () => null, setItem() {} });
  await audio.chime();
  assert.equal(audio.raining, false);
});

test('blocked storage keeps the defaults', () => {
  const audio = createAudio({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } });
  audio.setVolume(10);
  assert.equal(audio.prefs.volume, 10);
});
