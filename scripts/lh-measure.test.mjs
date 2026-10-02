import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { trace } from './lh/measure.mjs';

test('trace reports renderer main-thread work without adding worker, browser or GPU tasks', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'lh-measure-'));
  const events = [
    { name: 'thread_name', ph: 'M', pid: 1, tid: 4, args: { name: 'CrRendererMain' } },
    { name: 'thread_name', ph: 'M', pid: 1, tid: 5, args: { name: 'DedicatedWorker thread' } },
    { name: 'thread_name', ph: 'M', pid: 2, tid: 4, args: { name: 'CrGpuMain' } },
    { name: 'thread_name', ph: 'M', pid: 3, tid: 4, args: { name: 'CrBrowserMain' } },
    { name: 'RunTask', ph: 'X', pid: 1, tid: 4, dur: 60000 },
    { name: 'RunTask', ph: 'X', pid: 1, tid: 4, dur: 12000 },
    { name: 'RunTask', ph: 'X', pid: 1, tid: 5, dur: 90000 },
    { name: 'RunTask', ph: 'X', pid: 2, tid: 4, dur: 270000 },
    { name: 'RunTask', ph: 'X', pid: 3, tid: 4, dur: 80000 },
  ];
  let listener;
  const app = {
    on(callback) { listener = callback; return () => { listener = null; }; },
    async send(method) {
      if (method === 'Tracing.end') {
        listener({ method: 'Tracing.dataCollected', params: { value: events } });
        listener({ method: 'Tracing.tracingComplete' });
      }
    },
  };
  try {
    const file = join(folder, 'trace.json');
    assert.deepEqual(await trace(app, file, async () => {}), { events: 9, longTasks: 1, longestTasksMs: [60], busyMs: 72 });
    assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { traceEvents: events });
    assert.equal(listener, null);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
