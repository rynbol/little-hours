import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sleep } from './chrome.mjs';

export const fightState = app => app.js('window.__littleHours.forest.diagnostics().game');

export async function inputResponse(app, trigger, predicate) {
  await app.js(`(() => {
    const listeners = new AbortController(); let at = null;
    window.__lhInputResponse = { done: false };
    const observe = () => { at ??= performance.now(); };
    for (const event of ['keydown','pointerdown','wheel']) window.addEventListener(event, observe, { capture: true, signal: listeners.signal });
    const frame = () => {
      const elapsed = at === null ? 0 : performance.now() - at;
      const game = window.__littleHours.forest.diagnostics().game;
      if (at !== null && ((${predicate}) || elapsed > 1000)) { window.__lhInputResponse = { done: true, ms: elapsed, responded: Boolean(${predicate}) }; listeners.abort(); }
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame); return true;
  })()`);
  await trigger();
  return app.waitFor('window.__lhInputResponse.done && window.__lhInputResponse', {what:'a rendered input response',timeout:2000});
}

export function movement(app) {
  const held = new Map();
  const set = async wanted => {
    for (const [code, key] of held) if (!wanted.has(code)) { await app.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code }); held.delete(code); }
    for (const [code, key] of wanted) if (!held.has(code)) { await app.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code }); held.set(code, key); }
  };
  return {
    async toward(game, x, z, sprint = false) {
      const dx = x - game.position.x, dz = z - game.position.z, length = Math.hypot(dx, dz), yaw = game.camera.yaw;
      const horizontal = (Math.cos(yaw) * dx + Math.sin(yaw) * dz) / Math.max(.001, length);
      const forward = (Math.sin(yaw) * dx - Math.cos(yaw) * dz) / Math.max(.001, length), wanted = new Map();
      if (length > .15) {
        if (forward > .38) wanted.set('KeyW', 'w'); else if (forward < -.38) wanted.set('KeyS', 's');
        if (horizontal > .38) wanted.set('KeyD', 'd'); else if (horizontal < -.38) wanted.set('KeyA', 'a');
        if (sprint) wanted.set('ShiftLeft', 'Shift');
      }
      await set(wanted);
    },
    stop: () => set(new Map()),
  };
}

export async function walkTo(app, x, z, { tolerance = .5, sprint = false, timeout = 15000 } = {}) {
  const controls = movement(app), end = Date.now() + timeout;
  try {
    while (Date.now() < end) {
      const game = await fightState(app);
      if (Math.hypot(game.position.x - x, game.position.z - z) <= tolerance) return game;
      await controls.toward(game, x, z, sprint); await sleep(80);
    }
    throw new Error(`Walk did not reach ${x}, ${z}`);
  } finally { await controls.stop(); }
}

export async function recordFight(app, out) {
  mkdirSync(out, {recursive:true});
  const frames = [];
  const off = app.on(message => {
    if (message.method !== 'Page.screencastFrame') return;
    const index = frames.length, file = `play-${String(index).padStart(5, '0')}.jpg`;
    writeFileSync(join(out, file), Buffer.from(message.params.data, 'base64'));
    frames.push({ file, timestamp: message.params.metadata.timestamp });
    app.send('Page.screencastFrameAck', { sessionId: message.params.sessionId }).catch(() => {});
  });
  await app.send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: 960, maxHeight: 640, everyNthFrame: 6 });
  return async () => { await app.send('Page.stopScreencast'); off(); writeFileSync(join(out, 'play-frames.json'), JSON.stringify(frames, null, 2)); return frames; };
}

export async function playFight(app, { out, limit = 110000, onState = () => {} } = {}) {
  const controls = movement(app), canvas = await app.box('#wilds-canvas'), stopRecording = out ? await recordFight(app, out) : async () => [];
  let attackHeld = false, attackAt = 0, nextClick = 0, nextDodge = 0, nextSkill = 0, actionSerial = -1, clipped = false;
  const events = [], seenKinds = new Set(), started = Date.now();
  try {
    while (Date.now() - started < limit) {
      const game = await fightState(app), fight = game.encounter, b = fight.boss, a = b.action, now = Date.now();
      onState(game);
      seenKinds.add(a.kind);
      if (a.serial !== actionSerial || game.camera.clipped !== clipped) {
        events.push({at:now-started,event:'state',boss:structuredClone(b),player:game.position,camera:game.camera,action:game.action});
        actionSerial = a.serial; clipped = game.camera.clipped;
      }
      if (fight.status === 'won' || fight.status === 'recovering') return { game, events, frames: await stopRecording() };
      if (!game.locked) await app.key('f', 'KeyF');
      if (!fight.pet.skillCooldown && now > nextSkill && a.kind !== 'charge') { await app.key('q', 'KeyQ'); nextSkill = now + 2000; }
      const d = Math.hypot(game.position.x - b.x, game.position.z - b.z);
      const awaitingRoots = b.phase === 2 && !seenKinds.has('roots');
      if (attackHeld && now - attackAt > 440) { await app.release(canvas.x, canvas.y); attackHeld = false; nextClick = now + 850; }
      const danger = a.stage === 'telegraph' && a.impactIn < .17 && a.impactIn > 0 || a.stage === 'active' && a.kind === 'charge' && d < 3.6 || a.kind === 'stomp' && a.stage === 'active' && Math.abs(d - b.ringRadius) < 1.6;
      if (danger && now > nextDodge && game.stamina >= 22) {
        if (attackHeld) { await app.release(canvas.x, canvas.y); attackHeld = false; }
        const sideways = a.kind === 'charge' || a.kind === 'roots';
        await controls.toward(game, game.position.x + (sideways ? Math.cos(b.heading) * 3 : -Math.sin(b.heading) * 2), game.position.z + (sideways ? Math.sin(b.heading) * 3 : Math.cos(b.heading) * 2));
        await app.key('Control', 'ControlLeft'); events.push({ at: now - started, event: 'dodge', attack: a.kind, impactIn: a.impactIn }); nextDodge = now + 650;
      } else if (game.action.kind !== 'dodge') {
        if (awaitingRoots && d < 7) await controls.toward(game, game.position.x + (game.position.x - b.x), game.position.z + (game.position.z - b.z));
        else if (awaitingRoots) await controls.stop();
        else if (d > 2.5) await controls.toward(game, b.x, b.z);
        else {
          await controls.stop();
          if (!attackHeld && now > nextClick && ['idle', 'run', 'charge', 'land'].includes(game.action.kind) && game.stamina >= 12) {
            if (a.kind === 'stunned' && game.stamina >= 24) { await app.press(canvas.x, canvas.y); attackAt = now; attackHeld = true; }
            else if (a.stage === 'recovery' || a.kind === 'idle' || a.kind === 'phase' || fight.flurry > 0) { await app.click(canvas.x, canvas.y); nextClick = now + 340; }
          }
        }
      }
      await sleep(60);
    }
    return { game: await fightState(app), events, frames: await stopRecording() };
  } finally {
    await controls.stop(); if (attackHeld) await app.release(canvas.x, canvas.y);
    await app.send('Page.stopScreencast').catch(() => {});
  }
}
