import { sleep } from './chrome.mjs';

export const wildsState = app => app.js('window.__littleHours.forest.diagnostics()');

export async function enterWilds(app, { entry = 'pin' } = {}) {
  await app.clickSel(entry === 'button' ? '#house-open-forest' : '[data-room="forest"]');
  await app.waitFor('window.__littleHours.forest.isOpen && window.__littleHours.forest.diagnostics()?.ready', { what: 'the Wilds first frame', timeout: 90000 });
}

export async function leaveWilds(app) {
  await app.key('Escape');
  await app.clickSel('#wilds-leave');
  await app.waitFor('!window.__littleHours.forest.isOpen && Boolean(window.__littleHours.house.diagnostics())', { what: 'the restored island', timeout: 30000 });
  await app.settle();
}

export async function holdKeys(app, keys, ms) {
  for (const [key, code] of keys) await app.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code });
  await sleep(ms);
  for (const [key, code] of keys.toReversed()) await app.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
}

export async function retainedHeapSample(app, { wait = sleep } = {}) {
  await app.send('HeapProfiler.enable');
  const readings = [];
  for (let i = 0; i < 3; i++) {
    const beforeUsage = await app.send('Runtime.getHeapUsage');
    const before = beforeUsage.usedSize;
    await app.send('HeapProfiler.collectGarbage');
    const immediateUsage = await app.send('Runtime.getHeapUsage');
    const immediate = immediateUsage.usedSize;
    const reading = { before, immediate, beforeUsage, immediateUsage };
    readings.push(reading);
    if (i < 2) { await wait(150); reading.afterWaitUsage = await app.send('Runtime.getHeapUsage'); reading.afterWait = reading.afterWaitUsage.usedSize; }
  }
  return { heap: readings.at(-1).immediate, readings };
}

export async function resourceSample(app, { retained = true } = {}) {
  const collection = await retainedHeapSample(app);
  return { heap: collection.heap, collection, counts: await app.js('window.__littleHours.counts()'), retained: retained ? await retainedWildsObjects(app) : null, forest: await wildsState(app), house: await app.house() };
}

export async function wildsFrameSample(app, seconds = 5) {
  await app.js(`(() => { window.__lhWildsFrames = []; window.__lhWildsMeasuring = true; let last = 0; const frame = now => { if (last) window.__lhWildsFrames.push(now - last); last = now; if (window.__lhWildsMeasuring) requestAnimationFrame(frame); }; requestAnimationFrame(frame); return true; })()`);
  await app.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'w', code: 'KeyW' });
  try {
    await sleep(seconds * 1000);
    return await app.js(`(() => { window.__lhWildsMeasuring = false; const frames = window.__lhWildsFrames, sorted = frames.toSorted((a,b) => a-b); return { frames: frames.length, fps: frames.length / ${seconds}, maxMs: Math.max(...frames), p95Ms: sorted[Math.ceil(sorted.length * .95)-1], over20: frames.filter(ms => ms > 20).length, game: window.__littleHours.forest.diagnostics().game }; })()`);
  } finally { await app.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'w', code: 'KeyW' }); }
}

export async function retainedWildsObjects(app) {
  const objectGroup = 'lh-wilds-retainers';
  const query = async (prototype, functionDeclaration) => {
    const found = await app.send('Runtime.evaluate', { expression: `${prototype}.prototype`, objectGroup });
    if (found.exceptionDetails || !found.result.objectId) throw new Error(`Cannot inspect ${prototype} instances`);
    const { objects } = await app.send('Runtime.queryObjects', { prototypeObjectId: found.result.objectId, objectGroup });
    const result = await app.send('Runtime.callFunctionOn', { objectId: objects.objectId, functionDeclaration, returnByValue: true });
    if (result.exceptionDetails) throw new Error(`Cannot count retained ${prototype} instances`);
    return result.result.value;
  };
  try {
    const canvases = await query('HTMLCanvasElement', 'function() { return { total: this.length, wilds: this.filter(canvas => canvas.id === "wilds-canvas").length, detachedWilds: this.filter(canvas => canvas.id === "wilds-canvas" && !canvas.isConnected).length }; }');
    const contexts = await query('WebGL2RenderingContext', 'function() { return { total: this.length, wilds: this.filter(context => context.canvas?.id === "wilds-canvas").length, detachedWilds: this.filter(context => context.canvas?.id === "wilds-canvas" && !context.canvas.isConnected).length }; }');
    return { canvases, contexts };
  } finally { await app.send('Runtime.releaseObjectGroup', { objectGroup }); }
}
