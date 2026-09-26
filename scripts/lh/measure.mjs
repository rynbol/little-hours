import { createWriteStream, writeFileSync } from 'node:fs';
import { sleep } from './chrome.mjs';

export async function watchEvents(app) {
  await app.js(`(() => { window.__lhEvents = []; new PerformanceObserver(list => { for (const e of list.getEntries()) if (['click', 'pointerup', 'pointerdown', 'keydown'].includes(e.name)) window.__lhEvents.push(Math.round(e.duration)); }).observe({ type: 'event', durationThreshold: 16, buffered: false }); return true; })()`);
}

export async function takeEvents(app, wait = 1500) {
  await sleep(wait);
  const list = await app.js(`(() => { const list = window.__lhEvents; window.__lhEvents = []; return list; })()`);
  return list.length ? Math.max(...list) : 16;
}

export async function taskMs(app) {
  const { metrics } = await app.send('Performance.getMetrics');
  return metrics.find(metric => metric.name === 'TaskDuration').value * 1000;
}

export async function idle(app, seconds = 5) {
  await app.send('Performance.enable');
  await app.js(`(() => { window.__lhGaps = []; let last = performance.now(); window.__lhRaf = true; const tick = now => { window.__lhGaps.push(now - last); last = now; if (window.__lhRaf) requestAnimationFrame(tick); }; requestAnimationFrame(tick); return true; })()`);
  const before = await taskMs(app);
  await sleep(seconds * 1000);
  const after = await taskMs(app);
  const gaps = await app.js(`(() => { window.__lhRaf = false; return window.__lhGaps.slice(1); })()`);
  const sorted = gaps.slice().sort((a, b) => a - b);
  return {
    idleMsPerSecond: (after - before) / seconds,
    rafPerSecond: gaps.length / seconds,
    p95GapMs: sorted[Math.max(0, Math.ceil(sorted.length * .95) - 1)] || 0,
    slowGaps: gaps.filter(gap => gap > 50).length,
  };
}

export async function collectGarbage(app) {
  await app.send('HeapProfiler.enable');
  for (let i = 0; i < 3; i++) { await app.send('HeapProfiler.collectGarbage'); await sleep(150); }
}

export async function heapUsed(app) {
  return (await app.send('Runtime.getHeapUsage')).usedSize;
}

export async function heapSnapshot(app, path) {
  const file = createWriteStream(path);
  const off = app.on(message => { if (message.method === 'HeapProfiler.addHeapSnapshotChunk') file.write(message.params.chunk); });
  await app.send('HeapProfiler.enable');
  await app.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false, captureNumericValue: false });
  off();
  await new Promise(resolve => file.end(resolve));
  return path;
}

const TRACE_CATEGORIES = [
  '-*', 'devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame',
  'disabled-by-default-devtools.timeline.stack', 'toplevel', 'blink.console', 'blink.user_timing', 'latencyInfo',
  'v8.execute', 'disabled-by-default-v8.cpu_profiler', 'disabled-by-default-devtools.screenshot',
];

export async function trace(app, path, action) {
  const events = [];
  let done;
  const finished = new Promise(resolve => { done = resolve; });
  const off = app.on(message => {
    if (message.method === 'Tracing.dataCollected') events.push(...message.params.value);
    if (message.method === 'Tracing.tracingComplete') done();
  });
  await app.send('Tracing.start', { traceConfig: { includedCategories: TRACE_CATEGORIES }, transferMode: 'ReportEvents' });
  await action();
  await app.send('Tracing.end');
  await finished;
  off();
  writeFileSync(path, JSON.stringify({ traceEvents: events }));
  const main = events.filter(event => event.name === 'RunTask' && event.ph === 'X' && event.dur);
  const long = main.filter(event => event.dur > 50000).map(event => Math.round(event.dur / 1000)).sort((a, b) => b - a);
  return { events: events.length, longTasks: long.length, longestTasksMs: long.slice(0, 5), busyMs: Math.round(main.reduce((sum, event) => sum + event.dur, 0) / 1000) };
}
