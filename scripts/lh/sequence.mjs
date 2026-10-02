import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { sleep } from './chrome.mjs';

export function validateSequence(sequence) {
  if (!Number.isFinite(sequence.durationMs) || sequence.durationMs <= 0 || sequence.durationMs > 120000) throw new Error('Sequence duration must be 1–120000 ms');
  if (sequence.fixedStepMs !== undefined && (!Number.isFinite(sequence.fixedStepMs) || sequence.fixedStepMs < 8 || sequence.fixedStepMs > 50)) throw new Error('Fixed frames must be 8–50 ms apart');
  for (const event of sequence.events || []) {
    if (!Number.isFinite(event.at) || event.at < 0 || event.at > sequence.durationMs) throw new Error('Input event is outside the sequence');
    if (!['keyDown', 'keyUp', 'mouseMoved', 'mousePressed', 'mouseReleased'].includes(event.type)) throw new Error(`Unsupported input ${event.type}`);
    if (event.type.startsWith('key') && !/^(Key[A-Z]|Digit[0-9]|ShiftLeft|ControlLeft|Space|Escape|Tab|Enter)$/.test(event.code)) throw new Error(`Unsupported key ${event.code}`);
  }
  return { ...sequence, events: [...(sequence.events || [])].sort((a, b) => a.at - b.at) };
}

export async function dispatchSequenceInput(app, event) {
  if (event.type.startsWith('key')) {
    const keys = { ShiftLeft: 'Shift', ControlLeft: 'Control', Space: ' ', Escape: 'Escape', Tab: 'Tab', Enter: 'Enter' };
    const key = keys[event.code] || event.code.replace(/^Key/, '').replace(/^Digit/, '').toLowerCase();
    return app.send('Input.dispatchKeyEvent', { type: event.type, key, code: event.code, windowsVirtualKeyCode: event.code === 'Space' ? 32 : event.code === 'Tab' ? 9 : event.code === 'Escape' ? 27 : undefined });
  }
  return app.send('Input.dispatchMouseEvent', { type: event.type, x: event.x, y: event.y, button: event.button || (event.type === 'mouseMoved' && !event.buttons ? 'none' : 'left'), buttons: event.buttons || 0, clickCount: 1 });
}

export function frameGaps(frames) {
  return frames.slice(1).map((frame, index) => frame.realEpochMs - frames[index].realEpochMs);
}

export function encodeSequence(folder, frames, { executable = process.env.LH_FFMPEG || 'ffmpeg' } = {}) {
  if (frames.length < 2) return { file: null, reason: 'Fewer than two captured frames' };
  const origin = frames[0].gameMs === undefined ? 'realEpochMs' : 'gameMs';
  const timestamps = frames.map(frame => Math.round((frame[origin] - frames[0][origin]) * 1000));
  if (timestamps.some((at, i) => !Number.isFinite(at) || (i > 0 && at <= timestamps[i - 1]))) return { file: null, reason: 'Captured timestamps must be distinct at microsecond precision; original frames are complete' };
  const lines = ['ffconcat version 1.0'];
  for (let i = 0; i < frames.length; i++) {
    lines.push(`file '${basename(frames[i].file)}'`, 'option framerate 1000000');
    if (i + 1 < frames.length) lines.push(`duration ${((timestamps[i + 1] - timestamps[i]) / 1000000).toFixed(6)}`);
  }
  writeFileSync(join(folder, 'frames.ffconcat'), lines.join('\n') + '\n');
  try {
    execFileSync(executable, ['-hide_banner', '-loglevel', 'error', '-y', '-safe', '0', '-f', 'concat', '-i', 'frames.ffconcat', '-fps_mode', 'vfr', '-enc_time_base', '1:1000000', '-video_track_timescale', '1000000', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', 'playback.mp4'], { cwd: folder, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
    return { file: 'playback.mp4', timing: origin, timeBase: '1/1000000', frames: frames.length };
  } catch (error) {
    return { file: null, reason: error.code === 'ENOENT' ? 'Set LH_FFMPEG to encode playback; original frames are complete' : String(error.stderr || error.message).slice(0, 300) };
  }
}

export async function captureSequence(app, rawSequence, folder) {
  const sequence = validateSequence(rawSequence);
  mkdirSync(folder, { recursive: true });
  await app.js(`document.getElementById('wilds-canvas').focus()`);
  if (sequence.fixture) {
    const placed = await app.js(`window.__littleHours.wilds.place(${JSON.stringify(sequence.fixture)})`);
    if (!placed) throw new Error('The sequence fixture is outside loaded terrain');
  }
  const frames = [], acknowledgements = [], inputs = sequence.events;
  const heldKeys = new Set(), heldButtons = new Set();
  const buttonBits = { left: 1, right: 2, middle: 4, back: 8, forward: 16 };
  let off = () => {}, recording = null, next = 0, pointer = null, screencasting = false;
  async function dispatch(event) {
    await dispatchSequenceInput(app, event);
    if (event.type === 'keyDown') heldKeys.add(event.code);
    if (event.type === 'keyUp') heldKeys.delete(event.code);
    if (event.type.startsWith('mouse')) pointer = { x: event.x, y: event.y };
    if (event.type === 'mousePressed') heldButtons.add(event.button || 'left');
    if (event.type === 'mouseReleased') heldButtons.delete(event.button || 'left');
  }
  await app.js('window.__littleHours.startInputCapture()');
  try {
    if (sequence.fixedStepMs) {
      const start = await app.js('window.__lhStartAt + 100000');
      await app.js(`window.__lhFrozenAt = ${start}`);
      await app.waitFor(`window.__littleHours.wilds.diagnostics().now === ${start}`);
      if (sequence.fixture) await app.js(`window.__littleHours.wilds.place(${JSON.stringify(sequence.fixture)})`);
      let clockAt = start;
      async function advance(gameMs) {
        if (gameMs === clockAt) return;
        await app.js(`window.__lhFrozenAt = ${gameMs}`);
        await app.waitFor(`window.__littleHours.wilds.diagnostics().now === ${gameMs}`);
        clockAt = gameMs;
      }
      for (let index = 0; index <= Math.ceil(sequence.durationMs / sequence.fixedStepMs); index++) {
        const at = Math.min(sequence.durationMs, index * sequence.fixedStepMs);
        while (next < inputs.length && inputs[next].at <= at) {
          await advance(start + inputs[next].at);
          await dispatch(inputs[next++]);
        }
        const gameMs = start + at;
        await advance(gameMs);
        const file = `frame-${String(frames.length).padStart(5, '0')}.jpg`;
        await app.shot(join(folder, file));
        const snapshot = await app.js('(() => { const d = window.__littleHours.wilds.diagnostics(); return { realEpochMs: performance.timeOrigin + performance.now(), position: d.player.position, clip: d.avatar.action, clipMs: d.avatar.actionElapsedMs, cyclePhase: d.avatar.cyclePhase, animation: d.avatar.animation }; })()');
        frames.push({ file, gameMs, ...snapshot });
      }
    } else {
      off = app.on(message => {
        if (message.method !== 'Page.screencastFrame') return;
        const { data, metadata, sessionId } = message.params;
        const file = `frame-${String(frames.length).padStart(5, '0')}.jpg`;
        writeFileSync(join(folder, file), Buffer.from(data, 'base64'));
        frames.push({ file, realEpochMs: metadata.timestamp * 1000 });
        acknowledgements.push(app.send('Page.screencastFrameAck', { sessionId }));
      });
      await app.send('Page.startScreencast', { format: 'jpeg', quality: 78, maxWidth: app.width, maxHeight: app.height, everyNthFrame: 1, maxFramesInFlight: 1 });
      screencasting = true;
      const began = performance.now();
      while (performance.now() - began < sequence.durationMs) {
        while (next < inputs.length && inputs[next].at <= performance.now() - began) await dispatch(inputs[next++]);
        await sleep(5);
      }
      while (next < inputs.length) await dispatch(inputs[next++]);
    }
  } finally {
    try {
      if (screencasting) await app.send('Page.stopScreencast');
      await Promise.all(acknowledgements);
    } finally {
      off();
      try { recording = await app.js('window.__littleHours.stopInputCapture()'); }
      finally {
        try {
          for (const code of heldKeys) await dispatchSequenceInput(app, { type: 'keyUp', code });
          for (const button of [...heldButtons]) {
            heldButtons.delete(button);
            await dispatchSequenceInput(app, { type: 'mouseReleased', ...pointer, button, buttons: [...heldButtons].reduce((bits, held) => bits | buttonBits[held], 0) });
          }
        } finally { if (sequence.fixedStepMs) await app.js('delete window.__lhFrozenAt'); }
      }
    }
  }
  if (frames.length < 2) throw new Error('The sequence did not capture motion frames');
  const gaps = frameGaps(frames);
  const origin = sequence.fixedStepMs ? 'gameMs' : 'realEpochMs', lastInputAt = recording?.events.at(-1)?.[origin];
  const framesAfterLastInput = Number.isFinite(lastInputAt) ? frames.filter(frame => frame[origin] > lastInputAt).length : null;
  const lastInputToLastFrameMs = Number.isFinite(lastInputAt) ? frames.at(-1)[origin] - lastInputAt : null;
  const evidence = { sequence, mode: sequence.fixedStepMs ? 'fixed-game-clock' : 'real-time', viewport: { width: app.width, height: app.height, scale: app.scale }, frames, recording, timing: { frames: frames.length, maxRealGapMs: Math.max(0, ...gaps), realGapsOver50Ms: gaps.filter(value => value > 50).length, framesAfterLastInput, lastInputToLastFrameMs }, playback: encodeSequence(folder, frames), pageErrors: app.errors };
  writeFileSync(join(folder, 'sequence.json'), JSON.stringify(evidence, null, 2));
  return evidence;
}
