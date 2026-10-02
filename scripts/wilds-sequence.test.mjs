import test from 'node:test';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateSequence, dispatchSequenceInput, frameGaps, encodeSequence, captureSequence } from './lh/sequence.mjs';

test('capture scripts reject unsupported actions and order the real input events', () => {
  const result = validateSequence({ durationMs: 1000, events: [{ at: 800, type: 'keyUp', code: 'KeyW' }, { at: 200, type: 'keyDown', code: 'KeyW' }] });
  assert.deepEqual(result.events.map(event => event.at), [200, 800]);
  assert.throws(() => validateSequence({ durationMs: 0 }), /duration/);
  for (const fixedStepMs of [100, 0, '16', Infinity, NaN]) assert.throws(() => validateSequence({ durationMs: 1000, fixedStepMs }), /8–50/);
  assert.throws(() => validateSequence({ durationMs: 1000, events: [{ at: 20, type: 'teleport' }] }), /Unsupported/);
  assert.throws(() => validateSequence({ durationMs: 1000, events: [{ at: 1001, type: 'keyUp' }] }), /outside/);
});

test('movement captures send held-key and pointer events through CDP input rather than game mutation', async () => {
  const sent = [], app = { send: async (method, params) => sent.push({ method, params }) };
  await dispatchSequenceInput(app, { type: 'keyDown', code: 'KeyW' });
  await dispatchSequenceInput(app, { type: 'keyUp', code: 'KeyW' });
  await dispatchSequenceInput(app, { type: 'keyDown', code: 'Space' });
  await dispatchSequenceInput(app, { type: 'mouseMoved', x: 220, y: 300, buttons: 1 });
  assert.deepEqual(sent.map(event => event.method), ['Input.dispatchKeyEvent', 'Input.dispatchKeyEvent', 'Input.dispatchKeyEvent', 'Input.dispatchMouseEvent']);
  assert.equal(sent[0].params.key, 'w');
  assert.equal(sent[1].params.type, 'keyUp');
  assert.equal(sent[2].params.windowsVirtualKeyCode, 32);
  assert.equal(sent[3].params.buttons, 1);
});

test('sequence timing keeps every captured frame and reports capture gaps honestly', () => {
  const frames = [{ file: 'frame-00000.jpg', realEpochMs: 1000 }, { file: 'frame-00001.jpg', realEpochMs: 1033 }, { file: 'frame-00002.jpg', realEpochMs: 1116 }];
  assert.deepEqual(frameGaps(frames), [33, 83]);
  const folder = mkdtempSync(join(tmpdir(), 'wilds-sequence-'));
  try {
    const result = encodeSequence(folder, frames, { executable: join(folder, 'missing-encoder') });
    assert.equal(result.file, null);
    assert.match(result.reason, /original frames are complete/);
    assert.equal(readFileSync(join(folder, 'frames.ffconcat'), 'utf8'), "ffconcat version 1.0\nfile 'frame-00000.jpg'\noption framerate 1000000\nduration 0.033000\nfile 'frame-00001.jpg'\noption framerate 1000000\nduration 0.083000\nfile 'frame-00002.jpg'\noption framerate 1000000\n");
    encodeSequence(folder, frames.map((frame, index) => ({ ...frame, gameMs: [1000, 1020, 1050][index] })), { executable: join(folder, 'missing-encoder') });
    assert.deepEqual(readFileSync(join(folder, 'frames.ffconcat'), 'utf8').split('\n').filter(line => line.startsWith('duration ')), ['duration 0.020000', 'duration 0.030000']);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

test('playback rejects backward compositor timestamps without reordering the captured frames', () => {
  const folder = mkdtempSync(join(tmpdir(), 'wilds-backward-sequence-'));
  const frames = [{ file: 'frame-00000.jpg', realEpochMs: 21033 }, { file: 'frame-00001.jpg', realEpochMs: 21000 }];
  try {
    const result = encodeSequence(folder, frames, { executable: join(folder, 'missing-encoder') });
    assert.deepEqual(result, { file: null, reason: 'Captured timestamps must be distinct at microsecond precision; original frames are complete' });
    assert.deepEqual(frames, [{ file: 'frame-00000.jpg', realEpochMs: 21033 }, { file: 'frame-00001.jpg', realEpochMs: 21000 }]);
    assert.equal(existsSync(join(folder, 'frames.ffconcat')), false);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});


function fixedFixture(t) {
  const folder = mkdtempSync(join(tmpdir(), 'wilds-fixed-sequence-'));
  const previousEncoder = process.env.LH_FFMPEG;
  process.env.LH_FFMPEG = join(folder, 'missing-encoder');
  t.after(() => {
    if (previousEncoder === undefined) delete process.env.LH_FFMPEG;
    else process.env.LH_FFMPEG = previousEncoder;
    rmSync(folder, { recursive: true, force: true });
  });
  const sent = [], screenshots = [], events = [], held = new Set();
  let at = 1000, heldMs = 0, recording = false;
  const app = {
    width: 960, height: 640, scale: 1, errors: [],
    async js(expression) {
      if (expression === 'window.__lhStartAt + 100000') return 1000;
      if (expression.startsWith('window.__lhFrozenAt = ')) {
        const next = Number(expression.split(' = ')[1]);
        if (held.has('KeyW')) heldMs += next - at;
        at = next;
      }
      if (expression.includes('realEpochMs:')) return { realEpochMs: at + 20000, position: { x: heldMs, y: 0, z: 0 } };
      if (expression === 'window.__littleHours.startInputCapture()') recording = true;
      if (expression === 'window.__littleHours.stopInputCapture()') { recording = false; return { events: [...events] }; }
    },
    async waitFor() {},
    async shot(file) { screenshots.push({ file, at }); },
    async send(method, params) {
      sent.push({ method, params, at });
      if (params.type === 'keyDown') held.add(params.code);
      if (params.type === 'keyUp') held.delete(params.code);
      if (recording) events.push({ type: params.type, code: params.code, gameMs: at, realEpochMs: at + 20000 });
    },
  };
  return { folder, app, sent, screenshots, get heldMs() { return heldMs; } };
}

test('fixed capture includes a non-divisible endpoint and timestamps its final input without advancing the response', async t => {
  const f = fixedFixture(t);
  const result = await captureSequence(f.app, { durationMs: 100, fixedStepMs: 33, events: [{ at: 100, type: 'keyDown', code: 'KeyW' }] }, f.folder);
  assert.deepEqual(result.frames.map(frame => frame.gameMs), [1000, 1033, 1066, 1099, 1100]);
  assert.equal(f.screenshots.length, 5);
  assert.deepEqual(f.sent.filter(event => event.params.type === 'keyDown').map(event => [event.params.code, event.at]), [['KeyW', 1100]]);
  assert.equal(f.heldMs, 0);
  assert.equal(result.mode, 'fixed-game-clock');
  assert.equal(result.timing.framesAfterLastInput, 0);
  assert.equal(result.timing.lastInputToLastFrameMs, 0);
  assert.deepEqual(result.recording.events.map(event => [event.code, event.gameMs]), [['KeyW', 1100]]);
});

test('fixed capture integrates a ten millisecond hold between frames and records both exact event times', async t => {
  const f = fixedFixture(t);
  const result = await captureSequence(f.app, { durationMs: 100, fixedStepMs: 50, events: [{ at: 10, type: 'keyDown', code: 'KeyW' }, { at: 20, type: 'keyUp', code: 'KeyW' }] }, f.folder);
  assert.equal(f.heldMs, 10);
  assert.deepEqual(f.sent.map(event => [event.params.type, event.at]), [['keyDown', 1010], ['keyUp', 1020]]);
  assert.deepEqual(result.recording.events.map(event => event.gameMs), [1010, 1020]);
  assert.deepEqual(result.frames.map(frame => [frame.gameMs, frame.position.x]), [[1000, 0], [1050, 10], [1100, 10]]);
  assert.equal(result.timing.framesAfterLastInput, 2);
  assert.equal(result.timing.lastInputToLastFrameMs, 80);
});

test('sequence cleanup releases only keys and buttons still held and keeps those releases outside recorded input', async t => {
  const f = fixedFixture(t);
  const events = [
    { at: 10, type: 'keyDown', code: 'KeyW' },
    { at: 20, type: 'keyUp', code: 'KeyW' },
    { at: 30, type: 'mousePressed', x: 10, y: 20, button: 'left', buttons: 1 },
    { at: 40, type: 'mouseReleased', x: 10, y: 20, button: 'left', buttons: 0 },
    { at: 60, type: 'mousePressed', x: 30, y: 40, button: 'right', buttons: 2 },
    { at: 70, type: 'mouseMoved', x: 90, y: 95, buttons: 2 },
    { at: 80, type: 'keyDown', code: 'ShiftLeft' },
  ];
  const result = await captureSequence(f.app, { durationMs: 100, fixedStepMs: 50, events }, f.folder);
  assert.equal(result.recording.events.length, 7);
  assert.deepEqual(f.sent.slice(7).map(event => event.params), [
    { type: 'keyUp', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: undefined },
    { type: 'mouseReleased', x: 90, y: 95, button: 'right', buttons: 0, clickCount: 1 },
  ]);
  assert.equal(f.sent.filter(event => event.params.type === 'keyUp' && event.params.code === 'KeyW').length, 1);
  assert.equal(f.sent.filter(event => event.params.type === 'mouseReleased' && event.params.button === 'left').length, 1);
});

test('realtime captures use compositor timestamps and disclose when the final input has no later captured frame', async t => {
  const f = fixedFixture(t), calls = [], expressions = [];
  const send = f.app.send, js = f.app.js;
  let listener, removed = false;
  f.app.on = callback => { listener = callback; return () => { removed = true; }; };
  f.app.js = async expression => {
    expressions.push(expression);
    const result = await js(expression);
    if (expression === 'window.__littleHours.stopInputCapture()') return { events: result.events.map(event => ({ ...event, realEpochMs: 21040 })) };
    return result;
  };
  f.app.send = async (method, params) => {
    calls.push(method);
    if (method === 'Page.startScreencast') for (const [sessionId, timestamp] of [[1, 21], [2, 21.033]]) listener({ method: 'Page.screencastFrame', params: { data: '', metadata: { timestamp }, sessionId } });
    if (method.startsWith('Input.')) return send(method, params);
  };
  const result = await captureSequence(f.app, { durationMs: 1, events: [{ at: 1, type: 'keyDown', code: 'KeyW' }] }, f.folder);
  assert.equal(result.mode, 'real-time');
  assert.deepEqual(result.frames.map(frame => frame.realEpochMs), [21000, 21033]);
  assert.equal(result.timing.maxRealGapMs, 33);
  assert.equal(result.timing.framesAfterLastInput, 0);
  assert.equal(result.timing.lastInputToLastFrameMs, -7);
  assert.equal(result.recording.events.length, 1);
  assert.equal(removed, true);
  assert.deepEqual(calls.filter(method => method.startsWith('Page.')), ['Page.startScreencast', 'Page.screencastFrameAck', 'Page.screencastFrameAck', 'Page.stopScreencast']);
  assert.equal(expressions.some(expression => expression.includes('__lhFrozenAt')), false);
});

test('realtime capture serializes asynchronous JPEG delivery until each frame is acknowledged', async t => {
  const f = fixedFixture(t), encoders = [], delivered = [];
  const sourceFrames = [
    { timestamp: 21, encodingTurns: 4, data: 'first' },
    { timestamp: 21.033, encodingTurns: 1, data: 'second' },
    { timestamp: 21.066, encodingTurns: 1, data: 'third' },
  ];
  let listener, next = 0, inFlight = 0, limit;
  function captureAvailableFrames() {
    while (inFlight < limit && next < sourceFrames.length) {
      const frame = sourceFrames[next++];
      inFlight++;
      encoders.push((async () => {
        for (let turn = 0; turn < frame.encodingTurns; turn++) await Promise.resolve();
        delivered.push(frame.timestamp * 1000);
        listener({ method: 'Page.screencastFrame', params: { data: Buffer.from(frame.data).toString('base64'), metadata: { timestamp: frame.timestamp }, sessionId: 1 } });
      })());
    }
  }
  f.app.on = callback => { listener = callback; return () => { listener = null; }; };
  f.app.send = async (method, params) => {
    if (method === 'Page.startScreencast') {
      limit = params.maxFramesInFlight ?? 3;
      captureAvailableFrames();
    }
    if (method === 'Page.screencastFrameAck') {
      await Promise.resolve();
      inFlight--;
      captureAvailableFrames();
    }
    if (method === 'Page.stopScreencast') for (let index = 0; index < encoders.length; index++) await encoders[index];
  };
  const result = await captureSequence(f.app, { durationMs: 1, events: [] }, f.folder);
  assert.deepEqual(delivered, [21000, 21033, 21066]);
  assert.deepEqual(result.frames, [
    { file: 'frame-00000.jpg', realEpochMs: 21000 },
    { file: 'frame-00001.jpg', realEpochMs: 21033 },
    { file: 'frame-00002.jpg', realEpochMs: 21066 },
  ]);
  assert.deepEqual(result.frames.map(frame => readFileSync(join(f.folder, frame.file), 'utf8')), ['first', 'second', 'third']);
  assert.equal(inFlight, 0);
  assert.match(result.playback.reason, /Set LH_FFMPEG to encode playback/);
  assert.deepEqual(readFileSync(join(f.folder, 'frames.ffconcat'), 'utf8').split('\n').filter(line => line.startsWith('duration ')), ['duration 0.033000', 'duration 0.033000']);
});

test('playback preserves sub-millisecond captures without cumulative duration drift', () => {
  const folder = mkdtempSync(join(tmpdir(), 'wilds-submillisecond-'));
  try {
    const frames = [1000000, 1000016.6667, 1000017.071, 1000033.3334].map((realEpochMs, i) => ({ file: `frame-${i}.jpg`, realEpochMs }));
    encodeSequence(folder, frames, { executable: join(folder, 'missing-encoder') });
    const durations = readFileSync(join(folder, 'frames.ffconcat'), 'utf8').split('\n').filter(line => line.startsWith('duration '));
    assert.deepEqual(durations, ['duration 0.016667', 'duration 0.000404', 'duration 0.016262']);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

test('fixed capture preserves the actual authored blend members for every frame', async t => {
  const f = fixedFixture(t), original = f.app.js;
  const animation = [{ name: 'stop-right', weight: .7, frame: 8, speedRatio: 1 }, { name: 'stop-right-back', weight: .3, frame: 8, speedRatio: 1 }];
  f.app.js = async expression => {
    if (!expression.includes('realEpochMs:')) return original(expression);
    const context = { performance: { timeOrigin: 20000, now: () => 1000 }, window: { __littleHours: { wilds: { diagnostics: () => ({ player: { position: { x: 1, y: 2, z: 3 } }, avatar: { action: 'stop', actionElapsedMs: 400 / 3, cyclePhase: 1 / 3, animation } }) } } } };
    return JSON.parse(JSON.stringify(runInNewContext(expression, context)));
  };
  const result = await captureSequence(f.app, { durationMs: 50, fixedStepMs: 25, events: [] }, f.folder);
  assert.equal(result.frames.length, 3);
  for (const frame of result.frames) {
    assert.equal(frame.clip, 'stop');
    assert.deepEqual(frame.animation, animation);
  }
});
