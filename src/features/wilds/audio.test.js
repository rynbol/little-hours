import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWildsAudio } from './audio.js';

test('sound waits for input, emits a cue once, mutes, suspends and releases its context', t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window'), contexts = [];
  const parameter = () => ({ value: 0, setValueAtTime(value) { this.value = value; }, exponentialRampToValueAtTime() {}, setTargetAtTime(value) { this.value = value; } });
  class Audio {
    constructor() { this.currentTime = 0; this.state = 'running'; this.oscillators = []; this.gains = []; contexts.push(this); }
    createGain() { const gain = { gain: parameter(), connect() {}, disconnect() {} }; this.gains.push(gain); return gain; }
    createOscillator() { const oscillator = { frequency: parameter(), connect() {}, disconnect() {}, start() {}, stop() {} }; this.oscillators.push(oscillator); return oscillator; }
    async suspend() { this.state = 'suspended'; }
    async resume() { this.state = 'running'; }
    async close() { this.state = 'closed'; }
  }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { AudioContext: Audio } });
  t.after(() => { if (original) Object.defineProperty(globalThis, 'window', original); else delete globalThis.window; });
  const sound = createWildsAudio(), state = { boss: { action: { kind: 'charge', serial: 1 } } };
  sound.update(state, {}); assert.equal(contexts.length, 0);
  sound.unlock(); state.boss.action.serial++;
  sound.update(state, {}); sound.update(state, {});
  assert.equal(contexts[0].oscillators.length, 2);
  sound.setMuted(true); assert.equal(contexts[0].gains[0].gain.value, 0);
  sound.suspend(); assert.equal(contexts[0].state, 'suspended');
  sound.unlock(); assert.equal(contexts[0].state, 'running');
  sound.dispose(); assert.equal(contexts[0].state, 'closed');
  sound.unlock(); assert.equal(contexts.length, 1);
});

function audioFixture(t, options = {}) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window'), contexts = [];
  const parameter = () => ({ value: 0, setValueAtTime(value) { this.value = value; }, exponentialRampToValueAtTime(value) { this.end = value; }, setTargetAtTime(value) { this.value = value; } });
  class Audio {
    constructor() { if (options.denied) throw new Error('unavailable'); this.currentTime = 0; this.state = 'running'; this.oscillators = []; this.gains = []; this.closed = 0; contexts.push(this); }
    createGain() { const gain = { gain: parameter(), disconnected: 0, connect() {}, disconnect() { this.disconnected++; } }; this.gains.push(gain); return gain; }
    createOscillator() { const oscillator = { frequency: parameter(), disconnected: 0, stops: 0, connect() {}, disconnect() { this.disconnected++; }, start() {}, stop(at) { this.stops++; this.stopAt = at; } }; this.oscillators.push(oscillator); return oscillator; }
    async suspend() { this.state = 'suspended'; }
    async resume() { if (options.resumeDenied) throw new Error('gesture required'); this.state = 'running'; }
    async close() { this.state = 'closed'; this.closed++; }
  }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: options.unsupported ? {} : { AudioContext: Audio } });
  const sound = createWildsAudio();
  t.after(() => { sound.dispose(); if (original) Object.defineProperty(globalThis, 'window', original); else delete globalThis.window; });
  return { sound, contexts, state: { boss: { action: { kind: 'charge', serial: 1 } } } };
}

test('all four boss telegraphs have distinct sustained sound cues emitted once per action', t => {
  const { sound, contexts, state } = audioFixture(t);
  sound.unlock();
  const signatures = new Set();
  for (const kind of ['charge', 'sweep', 'stomp', 'roots']) {
    state.boss.action = { kind, serial: state.boss.action.serial + 1 };
    const before = contexts[0].oscillators.length;
    sound.update(state, {}); sound.update(state, {});
    const added = contexts[0].oscillators.slice(before);
    assert.equal(added.length, 2);
    for (const voice of added) assert.ok(voice.stopAt >= .62);
    signatures.add(added.map(voice => voice.frequency.value).join(','));
  }
  assert.equal(signatures.size, 4);
});

test('suspend and disposal explicitly stop and disconnect active voices without reviving or replaying them', t => {
  const { sound, contexts, state } = audioFixture(t);
  sound.unlock(); sound.update(state, {});
  const context = contexts[0], voices = context.oscillators.slice();
  sound.suspend();
  for (const voice of voices) { assert.equal(voice.stops, 2); assert.equal(voice.disconnected, 1); assert.equal(voice.onended, null); }
  sound.unlock(); sound.update(state, {});
  assert.equal(context.oscillators.length, 2);
  state.boss.action.serial++; sound.update(state, {});
  const active = context.oscillators.slice(2);
  sound.dispose(); sound.dispose(); sound.unlock(); sound.update(state, {}); sound.setMuted(false);
  assert.equal(context.closed, 1);
  assert.equal(context.gains[0].disconnected, 1);
  for (const voice of active) { assert.equal(voice.stops, 2); assert.equal(voice.disconnected, 1); }
  assert.equal(contexts.length, 1);
});

test('muted actions do not allocate voices or queue stale cues for unmute', t => {
  const { sound, contexts, state } = audioFixture(t);
  sound.setMuted(true); sound.unlock(); sound.update(state, {});
  assert.equal(contexts[0].gains[0].gain.value, 0);
  assert.equal(contexts[0].oscillators.length, 0);
  sound.setMuted(false); sound.update(state, {});
  assert.equal(contexts[0].oscillators.length, 0);
  state.boss.action.serial++; sound.update(state, {});
  assert.equal(contexts[0].oscillators.length, 2);
});

test('unsupported audio leaves input functional', t => {
  const { sound, state } = audioFixture(t, { unsupported: true });
  assert.doesNotThrow(() => { sound.unlock(); sound.update(state, {}); sound.suspend(); sound.dispose(); });
});

test('denied context creation leaves input functional', t => {
  const { sound, state } = audioFixture(t, { denied: true });
  assert.doesNotThrow(() => { sound.unlock(); sound.update(state, {}); sound.suspend(); sound.dispose(); });
});

test('failed resume is handled and disposed contexts cannot start new audio', async t => {
  const { sound, contexts } = audioFixture(t, { resumeDenied: true });
  sound.unlock(); sound.suspend(); sound.unlock();
  await Promise.resolve();
  assert.equal(contexts[0].state, 'suspended');
  sound.dispose(); sound.unlock();
  assert.equal(contexts.length, 1);
});
