import { steps } from '../steps.mjs';
import { collectGarbage } from '../measure.mjs';
import { GPU_LEDGER } from '../gpu-ledger.mjs';

const CYCLES = 5;
const MB = 1024 * 1024;
const THREE_KINDS = ['Scene', 'WebGLRenderer', 'Object3D', 'BufferGeometry', 'BufferAttribute', 'Material', 'Texture'];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const megabytes = bytes => Math.round(bytes / MB * 100) / 100;

async function measure(app) {
  await collectGarbage(app);
  const gpu = await app.js(`window.__gpuLedger()`);
  const heap = await app.send('Runtime.getHeapUsage');
  return { gpuMB: megabytes(gpu.bytes), objects: gpu.objects, contexts: gpu.contexts, attached: gpu.attached, heapMB: megabytes(heap.usedSize), buffersMB: megabytes(heap.backingStorageSize), jsMB: megabytes(heap.usedSize + heap.backingStorageSize) };
}

async function liveThree(app) {
  await collectGarbage(app);
  const live = {};
  for (const kind of THREE_KINDS) {
    const prototype = await app.send('Runtime.evaluate', { expression: `(async () => { const source = await (await fetch('/src/features/wilds/game.js')).text(); return (await import(source.match(/from "([^"]+\\/three\\.js[^"]*)"/)[1])).${kind}.prototype; })()`, awaitPromise: true });
    if (prototype.exceptionDetails || prototype.result.subtype === 'error') throw new Error(`Could not reach three.${kind} in the page: ${prototype.result.description}`);
    const found = await app.send('Runtime.queryObjects', { prototypeObjectId: prototype.result.objectId });
    live[kind] = (await app.send('Runtime.callFunctionOn', { objectId: found.objects.objectId, functionDeclaration: 'function () { return this.length; }', returnByValue: true })).result.value;
  }
  return live;
}

async function visit(app) {
  await steps.openWilds(app);
  await steps.playWilds(app);
  await app.move(720, 450);
  await app.down('w', 'KeyW'); await sleep(500); await app.up('w', 'KeyW');
  for (let i = 0; i < 3; i++) { await app.click(720, 450); await sleep(150); }
  await sleep(600);
  const inside = { ...await app.js(`(() => { const d = window.__littleHours.wilds.diagnostics(); return { swings: d.reactions.swings }; })()`), ...await measure(app) };
  await app.key('Escape', 'Escape');
  await app.waitFor(`document.querySelector('.wilds-menu').open`, { what: 'the pause card' });
  await app.clickSel('.wilds [data-wilds="exit"]');
  await app.waitFor(`document.querySelector('.wilds')?.hidden && Boolean(window.__littleHours.house.diagnostics()?.scene.isReady()) && !document.documentElement.dataset.placeTransition`, { what: 'the island to come back', timeout: 20000 });
  await sleep(500);
  return inside;
}

export default {
  about: 'the Wilds returns its memory: after a first visit loads three.js, five more visits with a little play each leave no extra three.js object alive, put the GPU bytes and WebGL contexts back to the island\'s own, and bring the JS heap back to where it started',
  async run(t) {
    const { check } = t;
    const app = await t.open({ seed: 'three-rooms', scale: 2, before: [GPU_LEDGER] });
    await app.settle();
    await steps.openHouse(app);
    await sleep(800);
    const cold = await measure(app);
    const warmup = await visit(app);
    const baseline = await measure(app), start = await liveThree(app), rounds = [];
    for (let i = 0; i < CYCLES; i++) {
      const inside = await visit(app);
      rounds.push({ inside, after: await measure(app) });
    }
    const live = await liveThree(app), last = rounds.at(-1).after;
    console.log('wilds memory', JSON.stringify({ cold, warmup, baseline, rounds, start, live }));
    check('every visit played: the Wilds drew and the combo swung inside', rounds.every(round => round.inside.swings >= 3 && round.inside.contexts === baseline.contexts + 1), rounds.map(round => round.inside));
    check(`after ${CYCLES} visits not one three.js scene, renderer, object, geometry, attribute, material or texture more is alive than after the first`, live.Scene === 0 && live.WebGLRenderer === 0 && THREE_KINDS.every(kind => live[kind] === start[kind]), { start, live });
    check(`after ${CYCLES} visits the live WebGL contexts are back to the island's own`, last.contexts === cold.contexts && last.attached === cold.attached, { cold, last });
    check('after every visit GPU memory is back to the island\'s own level within 1 MB', rounds.every(round => Math.abs(round.after.gpuMB - cold.gpuMB) <= 1), { cold: cold.gpuMB, after: rounds.map(round => round.after.gpuMB) });
    check('after every visit the JS heap and its array buffers come back to where they started, within the 5 MB that V8\'s warming compiled code may add', rounds.every(round => round.after.jsMB <= baseline.jsMB + 5), { cold: cold.jsMB, start: baseline.jsMB, after: rounds.map(round => round.after.jsMB) });
    await t.close(app);
  },
};
