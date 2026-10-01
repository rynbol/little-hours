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

const SEAT = 'window.__littleHours.room.diagnostics()';
export async function focusTrip(app, { width, height }) {
  await app.js(`(() => { const trip = window.__lhTrip = { frames: [], marks: [] }; let last = performance.now(); let seat = ''; const tick = now => { trip.frames.push([now, now - last, performance.memory?.usedJSHeapSize ?? 0]); last = now; const state = ${SEAT}.seat.state; if (state !== seat && (state === 'entering' || state === 'leaving')) trip.marks.push([state === 'entering' ? 'flight-in' : 'flight-out', now, Object.keys(${SEAT}.engine._compiledEffects).length]); seat = state; if (window.__lhTrip === trip) requestAnimationFrame(tick); }; requestAnimationFrame(tick); return true; })()`);
  const mark = name => app.js(`window.__lhTrip.marks.push([${JSON.stringify(name)}, performance.now(), Object.keys(${SEAT}.engine._compiledEffects).length])`);
  const theme = next => app.js(`(() => { const saved = JSON.parse(localStorage.getItem('little-hours-v1')); saved.theme = '${next}'; localStorage.setItem('little-hours-v1', JSON.stringify(saved)); window.dispatchEvent(new StorageEvent('storage', { key: 'little-hours-v1' })); })()`);
  await mark('load');
  await app.waitFor(`${SEAT}.seat.world.outdoor !== false`, { what: 'the outdoor world to be built', timeout: 30000 }); await sleep(1000);
  await mark('prepare'); await app.clickSel('#focus-mode-enter');
  await app.waitFor(`${SEAT}.seat.state === 'seated'`, { what: 'the view to settle in the chair', timeout: 30000 });
  await mark('seated'); await sleep(3000);
  await mark('look-around');
  for (const step of [300, 300, -300, -300, -300, 300]) await app.drag({ x: width / 2, y: height / 2 }, { x: width / 2 + step, y: height / 2 + step / 6 }, 24);
  await sleep(800);
  const start = await app.js(`window.__littleHours.state.theme`);
  await mark('theme-switch');
  for (const next of [start === 'rain' ? 'day' : 'rain', start]) { await theme(next); await sleep(2000); }
  await mark('leave'); await app.key('Escape');
  await app.waitFor(`${SEAT}.seat.state === 'room' && !${SEAT}.moving`, { what: 'the view to fly back out to the dollhouse', timeout: 30000 });
  await mark('dollhouse'); await sleep(2500); await mark('end');
  return app.js(`(() => {
    const { frames, marks } = window.__lhTrip; window.__lhTrip = null; marks.sort((a, b) => a[1] - b[1]);
    const result = {};
    for (let k = 0; k < marks.length - 1; k++) {
      const [name, from, effectsFrom] = marks[k], [, to, effectsTo] = marks[k + 1], span = frames.filter(([at]) => at > from && at <= to), gaps = span.map(([, gap]) => gap).sort((a, b) => a - b);
      let allocated = 0, collections = 0;
      for (let i = 1; i < span.length; i++) { const grew = span[i][2] - span[i - 1][2]; if (grew > 0) allocated += grew; else if (grew < -1e6) collections++; }
      const seconds = (to - from) / 1000;
      Object.assign(result, { [name + ' maxGapMs']: gaps.at(-1) ?? 0, [name + ' gaps>20']: gaps.filter(gap => gap > 20).length, [name + ' gaps>50']: gaps.filter(gap => gap > 50).length, [name + ' fps']: span.length / seconds, [name + ' newShaders']: effectsTo - effectsFrom, [name + ' allocMBps']: allocated / 1e6 / seconds, [name + ' heapDrops']: collections, [name + ' slowAt']: span.filter(([, gap]) => gap > 20).map(([at, gap]) => Math.round(at - from) + ':' + Math.round(gap)).join(' ') });
    }
    return result;
  })()`);
}
