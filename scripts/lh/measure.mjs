import { steps } from './steps.mjs';
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
  await app.waitFor(`(${SEAT}.seat.world.outdoor !== false || ${SEAT}.seat.world.buildsAhead === false)`, { what: 'the outdoor world to be built, where the renderer builds it ahead', timeout: 30000 }); await sleep(1000);
  await mark('prepare'); await steps.openTimer(app); await app.clickSel('#focus-mode-enter');
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

export async function allocations(app, action, { top = 15 } = {}) {
  await app.send('HeapProfiler.enable');
  await app.send('HeapProfiler.startSampling', { samplingInterval: 8192, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
  const began = Date.now();
  await action();
  const seconds = (Date.now() - began) / 1000, { profile } = await app.send('HeapProfiler.stopSampling');
  const bytes = new Map();
  const walk = node => {
    const { functionName, url, lineNumber } = node.callFrame, here = `${functionName || '(anonymous)'} ${url.split('/').pop().split('?')[0]}:${lineNumber + 1}`;
    if (node.selfSize) bytes.set(here, (bytes.get(here) ?? 0) + node.selfSize);
    for (const child of node.children) walk(child);
  };
  walk(profile.head);
  const total = [...bytes.values()].reduce((sum, size) => sum + size, 0);
  return { seconds, mbPerSecond: total / 1e6 / seconds, top: [...bytes].sort((a, b) => b[1] - a[1]).slice(0, top).map(([where, size]) => ({ where, kbPerSecond: Math.round(size / 1e3 / seconds) })) };
}

export async function gpuCosts(app, pairs = 40) {
  return app.js(`(() => {
    const view = ${SEAT}, engine = view.engine, gl = engine._gl, pixel = new Uint8Array(4), outdoor = view.seat?.world?.outdoorScene, room = view.scene, draw = view.draw ?? (() => room.render());
    const frame = () => { const start = performance.now(); engine.beginFrame(); draw(); engine.endFrame(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); return performance.now() - start; };
    const middle = values => values.sort((a, b) => a - b)[values.length >> 1];
    const cost = (hide, show) => { const deltas = []; for (let i = 0; i < ${pairs}; i++) { const shown = frame(); hide(); const hidden = frame(); show(); deltas.push(shown - hidden); } return Number(middle(deltas).toFixed(2)); };
    const visible = meshes => meshes.filter(mesh => mesh.isVisible && mesh.isEnabled());
    const toggle = meshes => [() => meshes.forEach(mesh => { mesh.isVisible = false; }), () => meshes.forEach(mesh => { mesh.isVisible = true; })];
    for (let i = 0; i < 10; i++) frame();
    const result = {}, outdoorMeshes = outdoor ? visible(outdoor.meshes) : [], roomMeshes = visible(room.meshes);
    if (outdoor) result['outdoor all'] = cost(...toggle(outdoorMeshes));
    result['room all'] = cost(...toggle(roomMeshes));
    const [hideAll, showAll] = toggle([...outdoorMeshes, ...roomMeshes]);
    hideAll(); room.effectLayers.forEach(layer => { layer.isEnabled = false; }); result['bare frame'] = Number(middle(Array.from({ length: ${pairs} }, frame)).toFixed(2)); room.effectLayers.forEach(layer => { layer.isEnabled = true; }); showAll();
    for (const layer of room.effectLayers) result['room ' + layer.name] = cost(() => { layer.isEnabled = false; }, () => { layer.isEnabled = true; });
    for (const mesh of outdoorMeshes) result['outdoor ' + mesh.name] = cost(...toggle([mesh]));
    const byMaterial = new Map();
    for (const mesh of roomMeshes) { const key = mesh.material?.name ?? 'none'; byMaterial.set(key, [...(byMaterial.get(key) ?? []), mesh]); }
    for (const [name, meshes] of byMaterial) result['room ' + name + ' x' + meshes.length] = cost(...toggle(meshes));
    return { gpuOutdoorMs: result['outdoor all'] ?? null, gpuRoomMs: result['room all'], passes: Object.fromEntries(Object.entries(result).sort((a, b) => b[1] - a[1])) };
  })()`);
}

const PLACE_TRIPS = ['#rooms-button', '#house-open-garden', '#garden-back', '[data-room="pond"]', '#lake-back', '#back-to-room'];

export async function placeTrips(app) {
  await app.js(`(() => {
    const record = window.__lhPlaceTrips = { frames: [], trips: 0 };
    let last = performance.now(), seen = null, closed = false;
    const tick = now => {
      const veil = document.querySelector('.place-transition');
      if (veil !== seen) { seen = veil; closed = false; if (veil) record.trips++; }
      if (veil) {
        const opacity = Number(getComputedStyle(veil).opacity);
        if (opacity >= 0.999) closed = true;
        const phase = veil.dataset.phase || (opacity >= 0.999 ? 'closed' : closed ? 'parting' : 'closing');
        record.frames.push([now - last, phase, record.trips]);
      }
      last = now;
      if (window.__lhPlaceTrips === record) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return true;
  })()`);
  for (const selector of PLACE_TRIPS) {
    await app.waitFor(`!document.querySelector('.place-transition')`, { what: 'the previous trip to end', timeout: 20000 });
    await app.clickSel(selector, { timeout: 10000 });
    await app.waitFor(`Boolean(document.querySelector('.place-transition'))`, { what: `the trip from ${selector} to start`, timeout: 5000 }).catch(() => null);
    await app.waitFor(`!document.querySelector('.place-transition')`, { what: `the trip from ${selector} to end`, timeout: 20000 });
    await app.settle();
  }
  return app.js(`(() => {
    const { frames, trips } = window.__lhPlaceTrips; window.__lhPlaceTrips = null;
    const pick = test => frames.filter(test).map(([gap]) => gap).sort((a, b) => a - b);
    const p95 = list => list.length ? list[Math.min(list.length - 1, Math.floor(list.length * 0.95))] : 0;
    const moving = pick(([, phase]) => phase !== 'closed'), closed = pick(([, phase]) => phase === 'closed'), all = pick(() => true);
    const span = phase => { const per = {}; for (const [gap, at, trip] of frames) if (!phase || phase(at)) per[trip] = (per[trip] || 0) + gap; const list = Object.values(per).sort((a, b) => a - b); return list[list.length >> 1] || 0; };
    return {
      trips, 'trip p95 gap ms': p95(all), 'moving p95 gap ms': p95(moving), 'moving worst gap ms': moving.at(-1) || 0,
      'moving gaps>20': moving.filter(gap => gap > 20).length, 'moving gaps>34': moving.filter(gap => gap > 34).length,
      'closed worst gap ms': closed.at(-1) || 0, 'trip ms (median)': span(), 'moving ms (median)': span(phase => phase !== 'closed'),
    };
  })()`);
}
