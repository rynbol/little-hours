import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retainedHeapSample, retainedWildsObjects } from './lh/wilds.mjs';

function fixture(fail = '') {
  const calls = [];
  const app = { async send(method, parameters) {
    calls.push({ method, parameters });
    if (method === fail) throw new Error('CDP unavailable');
    if (method === 'Runtime.evaluate') return { result: { objectId: parameters.expression } };
    if (method === 'Runtime.queryObjects') return { objects: { objectId: parameters.prototypeObjectId + '-instances' } };
    if (method === 'Runtime.callFunctionOn') return { result: { value: { total: parameters.objectId.startsWith('HTML') ? 3 : 2, wilds: 0, detachedWilds: 0 } } };
    return {};
  } };
  return { app, calls };
}

test('Wilds retained object audit counts all canvas and context instances without retaining remote handles', async () => {
  const f = fixture(), result = await retainedWildsObjects(f.app);
  assert.deepEqual(result, { canvases: { total: 3, wilds: 0, detachedWilds: 0 }, contexts: { total: 2, wilds: 0, detachedWilds: 0 } });
  const queries = f.calls.filter(call => call.method === 'Runtime.queryObjects');
  assert.deepEqual(queries.map(call => call.parameters.prototypeObjectId), ['HTMLCanvasElement.prototype', 'WebGL2RenderingContext.prototype']);
  assert.ok(queries.every(call => call.parameters.objectGroup === 'lh-wilds-retainers'));
  assert.deepEqual(f.calls.at(-1), { method: 'Runtime.releaseObjectGroup', parameters: { objectGroup: 'lh-wilds-retainers' } });
  assert.ok(f.calls.filter(call => call.method === 'Runtime.callFunctionOn').every(call => call.parameters.returnByValue));
});

test('Wilds retained object audit releases handles even if an instance query fails', async () => {
  const f = fixture('Runtime.queryObjects');
  await assert.rejects(retainedWildsObjects(f.app), /CDP unavailable/);
  assert.equal(f.calls.at(-1).method, 'Runtime.releaseObjectGroup');
});

test('Wilds retained object audit rejects an unavailable prototype and releases handles', async () => {
  const f = fixture();
  const send = f.app.send;
  f.app.send = async (method, parameters) => method === 'Runtime.evaluate' ? { result: {} } : send(method, parameters);
  await assert.rejects(retainedWildsObjects(f.app), /Cannot inspect HTMLCanvasElement/);
  assert.equal(f.calls.at(-1).method, 'Runtime.releaseObjectGroup');
});


test('retained heap sample reads immediately after final collection and preserves all timing readings', async () => {
  const calls = [];
  let usedSize = 1000;
  const app = { async send(method) {
    calls.push(method);
    if (method === 'Runtime.getHeapUsage') return { usedSize, totalSize: 2000, backingStorageSize: 100 };
    if (method === 'HeapProfiler.collectGarbage') usedSize -= 10;
    return {};
  } };
  const result = await retainedHeapSample(app, { wait: async ms => { calls.push(`wait:${ms}`); usedSize += 5; } });
  assert.equal(result.heap, 980);
  assert.equal(result.readings.length, 3);
  assert.deepEqual(result.readings.map(r => r.immediate), [990, 985, 980]);
  assert.deepEqual(result.readings.map(r => r.afterWait), [995, 990, undefined]);
  assert.equal(result.readings.at(-1).immediateUsage.backingStorageSize, 100);
  assert.equal(calls.filter(c => c === 'wait:150').length, 2);
  assert.deepEqual(calls.slice(-2), ['HeapProfiler.collectGarbage', 'Runtime.getHeapUsage']);
});
