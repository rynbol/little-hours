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

test('the audio device opens while the room loads, so the Start or Focus gesture only resumes it', async () => {
  const opened = [], resumed = [], node = () => ({ connect: next => next, start() {}, stop() {}, frequency: { value: 0 }, gain: { value: 0, setTargetAtTime() {} } });
  globalThis.AudioContext = class { constructor() { opened.push(this); this.sampleRate = 8; this.currentTime = 0; this.destination = {}; } createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; } createBufferSource() { return node(); } createBiquadFilter() { return node(); } createGain() { return node(); } resume() { resumed.push(this); return Promise.resolve(); } suspend() { return Promise.resolve(); } close() {} };
  try {
    const audio = createAudio({ getItem: () => null, setItem() {} });
    audio.warm();
    assert.equal(opened.length, 1);
    audio.unlock();
    assert.deepEqual([opened.length, resumed.length], [1, 1]);
    audio.dispose();
    const quiet = createAudio({ getItem: () => JSON.stringify({ chime: false }), setItem() {} });
    quiet.warm();
    assert.equal(opened.length, 1);
  } finally { delete globalThis.AudioContext; }
});

test('a distant rumble follows a flash only while the rain is playing, low and after the delay', async () => {
  const played = [];
  const param = () => ({ value: 1, steps: [], setValueAtTime(v, t) { this.steps.push([v, t]); }, exponentialRampToValueAtTime(v, t) { this.steps.push([v, t]); }, setTargetAtTime(v) { this.value = v; } });
  const node = () => ({ connect: next => next, start(at) { this.startAt = at; played.push(this); }, stop() {}, frequency: param(), gain: param(), playbackRate: param() });
  globalThis.AudioContext = class { constructor() { this.sampleRate = 8; this.currentTime = 10; this.destination = {}; } createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; } createBufferSource() { return node(); } createBiquadFilter() { return node(); } createGain() { return node(); } resume() { return Promise.resolve(); } suspend() { return Promise.resolve(); } close() {} };
  try {
    const audio = createAudio({ getItem: () => JSON.stringify({ volume: 65 }), setItem() {} });
    audio.rumble(17);
    assert.equal(played.length, 0, 'no sound before any gesture');
    await audio.setRain(true);
    audio.rumble(17);
    assert.equal(played.length, 2, 'the rain loop and one rumble');
    assert.equal(played[1].startAt, 27);
    assert.ok(played[1].playbackRate.value < 1, 'the rumble is the rain noise slowed down');
    await audio.setRain(false);
    audio.rumble(17);
    assert.equal(played.length, 2, 'no rumble once the rain sound is off');
    audio.dispose();
  } finally { delete globalThis.AudioContext; }
});
