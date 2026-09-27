import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromePath, closeAll, gpuFlag, killAllNow, launch, sleep, slow } from './lh/chrome.mjs';
import { openApp } from './lh/app.mjs';
import { serve } from './lh/server.mjs';
import { SEEDS } from './lh/seeds.mjs';
import { cycles, steps, views } from './lh/steps.mjs';
import { collectGarbage, heapSnapshot, heapUsed, idle, takeEvents, trace, watchEvents } from './lh/measure.mjs';
import { commandOf, lhDir, outDir, repoRoot, stopTracked, tracked } from './lh/state.mjs';

const HELP = `lh: drive the real Little Hours app in Chrome and collect evidence.

  lh doctor                         check this machine can run trustworthy checks
  lh serve [--ref <git ref>]        start a dev server and keep it running (Ctrl-C stops it)
  lh flows                          list the flows
  lh run <flow...|all>              run flows with real input; exits 1 on any failure
  lh shot <view...>                 screenshots; views: ${Object.keys(views).join(', ')}
  lh perf [--view house|room|decorate]
                                    idle cost, frame gaps, click-to-paint, GPU time, draw calls
  lh trace <cycle>                  Chrome performance trace of one cycle
  lh heap <cycle> [--repeat 30]     leak check: heap growth and Babylon object counts over repeated cycles
                                    (--snapshots also saves .heapsnapshot files, about 500 MB each)
  lh cleanup [--all]                stop anything lh started and delete its temporary files

  cycles: ${Object.keys(cycles).join(', ')}
  seeds:  ${Object.keys(SEEDS).join(', ')}

Options:
  --ref <ref>        test a git ref (branch, tag, sha) instead of the working tree
  --against <ref>    also run on <ref> and compare (perf, heap, shot); rounds alternate the order
  --url <url>        use an already running server instead of starting one
  --seed <name>      starting save (default three-rooms)
  --theme <name>     dusk, day or rain
  --size <WxH>       viewport in CSS pixels (default 1440x1000)
  --scale <n>        device pixel ratio (default 2 for perf, 1 for shots)
  --still            prefers-reduced-motion: reduce
  --headed           show the browser window
  --rounds <n>       perf rounds per side (default 1, or 2 with --against)
  --timeout <s>      hard time limit for the whole command (default 600, or 600 per flow for run)
Evidence goes to .lh/out/<time>-<command>/.`;

function parse(argv) {
  const positional = [], options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { positional.push(arg); continue; }
    const [key, inline] = arg.slice(2).split('=');
    if (inline !== undefined) options[key] = inline;
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) options[key] = argv[++i];
    else options[key] = true;
  }
  return { positional, options };
}

const [command = 'help', ...rest] = process.argv.slice(2);
const { positional, options } = parse(rest);
const servers = [];
const size = String(options.size || '1440x1000').split('x').map(Number);
const viewport = { width: size[0], height: size[1], headed: Boolean(options.headed), reducedMotion: Boolean(options.still) };

async function shutdown(code) {
  await closeAll().catch(() => {});
  await Promise.all(servers.map(server => server.close().catch(() => {})));
  process.exit(code);
}
process.on('exit', killAllNow);
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => { console.error(`lh: stopped by ${signal}`); shutdown(130); });
let onTimeLimit = () => {};
function armTimeLimit(seconds) {
  setTimeout(() => { console.error(`lh: time limit of ${seconds} s reached`); onTimeLimit(); shutdown(124); }, seconds * 1000).unref();
}

async function start(ref) {
  if (options.url && !ref) return { url: String(options.url).replace(/\/$/, ''), label: options.url, close: async () => {} };
  const server = await serve(ref);
  servers.push(server);
  return server;
}

async function sides() {
  const list = [await start(options.ref)];
  if (options.against) list.push(await start(options.against));
  return list;
}

function orderFor(round, list) { return round % 2 ? [...list].reverse() : list; }

const median = values => { const sorted = values.filter(Number.isFinite).sort((a, b) => a - b), mid = sorted.length >> 1; return !sorted.length ? null : sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2; };
const fixed = value => value === null || value === undefined ? '—' : Number.isInteger(value) ? String(value) : value.toFixed(value < 10 ? 2 : 1);

function table(rows, columns) {
  const widths = columns.map((column, i) => Math.max(column.length, ...rows.map(row => String(row[i]).length)));
  const line = row => row.map((cell, i) => String(cell).padEnd(widths[i])).join('  ');
  return [line(columns), line(widths.map(width => '-'.repeat(width))), ...rows.map(line)].join('\n');
}

async function flowNames() {
  return readdirSync(join(repoRoot, 'scripts/lh/flows')).filter(file => file.endsWith('.mjs')).map(file => file.replace(/\.mjs$/, '')).sort();
}

async function loadFlow(name) {
  const file = join(repoRoot, 'scripts/lh/flows', `${name}.mjs`);
  if (!existsSync(file)) throw new Error(`No flow "${name}". Flows: ${(await flowNames()).join(', ')}`);
  return (await import(file)).default;
}

async function runFlows(names) {
  const server = await start(options.ref);
  const out = outDir('run'), results = [];
  const report = () => writeFileSync(join(out, 'report.json'), JSON.stringify({ server: server.label, results }, null, 2));
  onTimeLimit = () => { report(); console.error(`lh: stopped after ${results.length} checks, ${results.filter(result => !result.ok).length} failed; partial report in ${out}`); };
  console.log(`lh run on ${server.label} at ${server.url}\nevidence: ${out}`);
  for (const name of names) {
    const flow = await loadFlow(name), apps = [];
    console.log(`\n# ${name}: ${flow.about}`);
    const check = (label, ok, detail = '') => {
      results.push({ flow: name, check: label, ok: Boolean(ok), detail: typeof detail === 'string' ? detail : JSON.stringify(detail) });
      console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail && !ok ? `  (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : ''}`);
      return Boolean(ok);
    };
    const t = {
      url: server.url, out, check, steps, slow, sleep: ms => sleep(ms * slow),
      async open(settings = {}) { const app = await openApp(server.url, { ...viewport, scale: 1, ...settings }); apps.push({ app, label: settings.label || `${settings.seed || 'three-rooms'} ${settings.width || viewport.width}x${settings.height || viewport.height}` }); return app; },
      async close(app) { const entry = apps.find(item => item.app === app); if (entry) { check(`no page errors (${entry.label})`, app.errors.length === 0, app.errors.join(' | ').slice(0, 400)); apps.splice(apps.indexOf(entry), 1); } await app.close(); },
      shot: (app, label) => app.shot(join(out, `${name}-${label}.jpg`)),
    };
    try { await flow.run(t); }
    catch (error) { check('the flow ran to the end', false, error.message.split('\n')[0]); }
    finally { for (const { app } of [...apps]) await t.close(app); }
    report();
  }
  const failed = results.filter(result => !result.ok);
  console.log(`\n${results.length - failed.length} / ${results.length} passed${failed.length ? `; failed: ${failed.map(result => `${result.flow}: ${result.check}`).join('; ')}` : ''}`);
  return failed.length ? 1 : 0;
}

async function perfOnce(url, view) {
  const app = await openApp(url, { ...viewport, scale: Number(options.scale || 2), seed: options.seed || 'three-rooms', theme: options.theme });
  try {
    await sleep(2500);
    const result = { readyMs: app.readyMs };
    await watchEvents(app);
    if (view === 'house') { await app.clickSel('#rooms-button'); result.openMs = await takeEvents(app, 4000); }
    if (view === 'decorate') { await app.clickSel('#decorate-button'); result.openMs = await takeEvents(app, 3000); }
    Object.assign(result, await idle(app, Number(options.seconds || 5)));
    if (view === 'house') {
      const tags = await app.js(`[...document.querySelectorAll('button.house-room-tag:not(.is-site)')].map(tag => tag.dataset.room)`);
      for (const id of tags) { await app.clickSel(`.house-room-tag[data-room="${id}"]`); result[`tapMs ${id}`] = await takeEvents(app, 1500); }
    }
    if (app.hook && await app.js(`typeof window.__littleHours.gpuFrame === 'function'`)) {
      const which = view === 'house' ? 'house' : 'room';
      const gpu = await app.js(`window.__littleHours.gpuFrame('${which}')`), stats = await app.js(`window.__littleHours.stats('${which}')`);
      Object.assign(result, { gpuFrameMs: gpu.ms, drawCalls: stats.drawCalls, triangles: stats.triangles, renderPixels: gpu.width * gpu.height });
    }
    result.pageErrors = app.errors.length;
    return result;
  } finally { await app.close(); }
}

async function perf() {
  const view = options.view || 'house', list = await sides(), out = outDir('perf');
  const rounds = Number(options.rounds || (list.length > 1 ? 2 : 1)), runs = list.map(() => []);
  console.log(`lh perf, view ${view}, ${rounds} round(s), Chrome ${gpuFlag}\n${list.map((side, i) => `  side ${i + 1}: ${side.label}`).join('\n')}`);
  for (let round = 0; round < rounds; round++) for (const side of orderFor(round, list)) {
    const result = await perfOnce(side.url, view);
    runs[list.indexOf(side)].push(result);
    console.log(`  round ${round + 1} ${side.label}: idle ${fixed(result.idleMsPerSecond)} ms/s${result.openMs ? `, open ${result.openMs} ms` : ''}${result.gpuFrameMs ? `, gpu ${fixed(result.gpuFrameMs)} ms` : ''}`);
  }
  const keys = [...new Set(runs.flat().flatMap(Object.keys))];
  const rows = keys.map(key => [key, ...runs.map(side => fixed(median(side.map(result => result[key]))))]);
  if (list.length > 1) rows.forEach((row, i) => { const [a, b] = runs.map(side => median(side.map(result => result[keys[i]]))); row.push(a !== null && b !== null ? (a - b >= 0 ? '+' : '') + fixed(a - b) : '—'); });
  console.log('\n' + table(rows, ['metric (median)', ...list.map(side => side.label), ...(list.length > 1 ? ['difference'] : [])]));
  console.log(`\nClick and open times are Event Timing durations; 16 means "16 ms or less". Lower is better everywhere except rafPerSecond.`);
  writeFileSync(join(out, 'perf.json'), JSON.stringify({ view, sides: list.map(side => side.label), runs }, null, 2));
  console.log(`evidence: ${join(out, 'perf.json')}`);
  return runs.flat().some(result => result.pageErrors) ? 1 : 0;
}

async function shots() {
  const names = positional.length ? positional : ['room', 'house'], list = await sides(), out = outDir('shot');
  for (const side of list) for (const name of names) {
    if (!views[name]) throw new Error(`Unknown view "${name}". Views: ${Object.keys(views).join(', ')}`);
    const app = await openApp(side.url, { ...viewport, scale: Number(options.scale || 1), seed: options.seed || 'three-rooms', theme: options.theme });
    try {
      await sleep(800); await app.settle(); await views[name].go(app); await sleep(Number(options.wait || 600));
      const file = await app.shot(join(out, `${name}-${list.length > 1 ? (side === list[0] ? 'this' : String(options.against).replace(/[^\w.-]+/g, '_')) : 'this'}.jpg`));
      console.log(`${side.label} ${name}: ${file}${app.errors.length ? `  page errors: ${app.errors.join(' | ').slice(0, 200)}` : ''}`);
    } finally { await app.close(); }
  }
  return 0;
}

function cycleFor(name) {
  const cycle = cycles[name];
  if (!cycle) throw new Error(`Unknown cycle "${name}". Cycles: ${Object.keys(cycles).join(', ')}`);
  return cycle;
}

async function traceCommand() {
  const name = positional[0] || 'house', cycle = cycleFor(name), out = outDir('trace');
  const server = await start(options.ref);
  const app = await openApp(server.url, { ...viewport, scale: Number(options.scale || 2), seed: options.seed || 'three-rooms', theme: options.theme });
  try {
    await sleep(1500); await app.settle(); await cycle.setup?.(app); await cycle.run(app);
    const file = join(out, `trace-${name}.json`);
    const summary = await trace(app, file, () => cycle.run(app));
    console.log(`lh trace ${name} (${cycle.about}) on ${server.label}\n  main-thread busy ${summary.busyMs} ms, long tasks (>50 ms): ${summary.longTasks}${summary.longTasks ? ` [${summary.longestTasksMs.join(', ')} ms]` : ''}\n  trace: ${file}\n  Open it in Chrome DevTools > Performance > Load profile.`);
    return app.errors.length ? 1 : 0;
  } finally { await app.close(); }
}

async function heapOnce(side, cycle, repeat, out, tag) {
  const app = await openApp(side.url, { ...viewport, scale: 1, seed: options.seed || 'three-rooms', theme: options.theme });
  try {
    await sleep(1000); await app.settle(); await cycle.setup?.(app);
    for (let i = 0; i < 3; i++) await cycle.run(app);
    const counts = () => app.hook ? app.js('window.__littleHours.counts?.() ?? null') : null;
    const sample = async () => { await collectGarbage(app); return { heap: await heapUsed(app), counts: await counts() }; };
    const snapshots = [];
    const before = await sample();
    if (options.snapshots) snapshots.push(await heapSnapshot(app, join(out, `${tag}-before.heapsnapshot`)));
    const half = Math.ceil(repeat / 2);
    for (let i = 0; i < half; i++) await cycle.run(app);
    const middle = await sample();
    for (let i = half; i < repeat; i++) await cycle.run(app);
    const after = await sample();
    if (options.snapshots) snapshots.push(await heapSnapshot(app, join(out, `${tag}-after.heapsnapshot`)));
    return { before, middle, after, firstHalfKb: (middle.heap - before.heap) / half / 1024, secondHalfKb: (after.heap - middle.heap) / (repeat - half) / 1024, snapshots, pageErrors: app.errors };
  } finally { await app.close(); }
}

const flatCounts = counts => counts ? Object.fromEntries(Object.entries(counts).flatMap(([key, value]) => value && typeof value === 'object' ? Object.entries(value).map(([inner, count]) => [`${key}.${inner}`, count]) : [[key, value]])) : {};

async function heap() {
  const name = positional[0] || 'house', cycle = cycleFor(name), repeat = Math.max(2, Number(options.repeat || 30)), list = await sides(), out = outDir('heap');
  const limitKb = Number(options['limit-kb'] || 64);
  let failed = false;
  for (const side of list) {
    const tag = side === list[0] ? 'this' : 'against';
    const result = await heapOnce(side, cycle, repeat, out, tag);
    const a = flatCounts(result.before.counts), b = flatCounts(result.after.counts);
    const grew = Object.keys(b).filter(key => (b[key] ?? 0) > (a[key] ?? 0));
    const ok = result.secondHalfKb <= limitKb && !grew.length && !result.pageErrors.length;
    failed ||= !ok;
    console.log(`\n${ok ? 'PASS' : 'FAIL'} ${side.label}: ${repeat} × ${cycle.about}`);
    console.log(`  JS heap ${(result.before.heap / 1048576).toFixed(1)} → ${(result.middle.heap / 1048576).toFixed(1)} → ${(result.after.heap / 1048576).toFixed(1)} MB; per cycle ${result.firstHalfKb.toFixed(1)} KB in the first half, ${result.secondHalfKb.toFixed(1)} KB in the second (limit ${limitKb})`);
    console.log(`  Babylon objects: ${Object.keys(b).length ? Object.keys(b).map(key => `${key} ${a[key] ?? 0}→${b[key]}`).join(', ') : 'no test hook on this build'}${grew.length ? `\n  grew: ${grew.join(', ')}` : ''}`);
    if (result.pageErrors.length) console.log(`  page errors: ${result.pageErrors.join(' | ').slice(0, 300)}`);
    if (result.snapshots.length) console.log(`  snapshots: ${result.snapshots.join('  ')}\n  Compare them in Chrome DevTools > Memory > Load, then "Comparison".`);
    writeFileSync(join(out, `${tag}.json`), JSON.stringify({ side: side.label, cycle: name, repeat, ...result }, null, 2));
  }
  return failed ? 1 : 0;
}

async function doctor() {
  const rows = [];
  const add = (label, ok, detail) => { rows.push({ label, ok, detail }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? `: ${detail}` : ''}`); };
  add('Node 24 or newer', Number(process.versions.node.split('.')[0]) >= 24, process.version);
  add('packages installed', existsSync(join(repoRoot, 'node_modules/@babylonjs/core')) && existsSync(join(repoRoot, 'node_modules/vite')), existsSync(join(repoRoot, 'node_modules')) ? '' : 'run npm ci');
  add('Chrome found', existsSync(chromePath), chromePath);
  const stale = tracked().filter(entry => commandOf(entry.pid).includes(entry.marker));
  add('no browsers left over from earlier runs', !stale.length, stale.length ? `${stale.length} running; run lh cleanup` : '');
  const browser = await launch({ width: 800, height: 600, scale: 1 });
  try {
    await browser.navigate('data:text/html,<body style="height:3000px;margin:0">tall</body>');
    const probe = await browser.js(`(() => { const gl = document.createElement('canvas').getContext('webgl2'); const info = gl?.getExtension('WEBGL_debug_renderer_info'); return { renderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl ? gl.getParameter(gl.RENDERER) : null, scrollbar: innerWidth - document.documentElement.clientWidth }; })()`);
    const software = /swiftshader|llvmpipe|software/i.test(probe.renderer || '');
    add('WebGL2 on the real GPU', probe.renderer && (!software || gpuFlag === 'swiftshader'), `${probe.renderer || 'no WebGL2'}${software && process.platform === 'darwin' ? ' (software rendering: perf numbers would be meaningless)' : ''}`);
    add('scroll bars take no space', probe.scrollbar === 0, `${probe.scrollbar} px`);
  } finally { await browser.close(); }
  const server = await start(options.ref);
  const app = await openApp(server.url, { width: 1000, height: 800, scale: 1 });
  try {
    add('the app reaches ready', true, `${Math.round(app.readyMs)} ms on ${server.label}`);
    add('the test hook is present', app.hook, app.hook ? '' : 'this build predates window.__littleHours.ready; lh can only click DOM controls');
    add('no page errors on load', !app.errors.length, app.errors.join(' | ').slice(0, 200));
  } finally { await app.close(); }
  const tmp = join(lhDir, 'tmp');
  const leftovers = existsSync(tmp) ? readdirSync(tmp).length : 0;
  add('no leftover temporary profiles', !leftovers, leftovers ? `${leftovers} in ${tmp}; run lh cleanup` : '');
  return rows.every(row => row.ok) ? 0 : 1;
}

async function cleanup() {
  const stopped = stopTracked();
  rmSync(join(lhDir, 'tmp'), { recursive: true, force: true });
  console.log(`stopped ${stopped.length} browser(s)${stopped.length ? `: ${stopped.join(', ')}` : ''}; removed .lh/tmp`);
  if (options.all) {
    const refs = join(lhDir, 'refs');
    if (existsSync(refs)) for (const entry of readdirSync(refs)) execFileSync('git', ['worktree', 'remove', '--force', join(refs, entry)], { cwd: repoRoot, stdio: 'inherit' });
    for (const dir of ['refs', 'vite-cache', 'out']) rmSync(join(lhDir, dir), { recursive: true, force: true });
    console.log('removed .lh/refs worktrees, .lh/vite-cache and .lh/out');
  }
  return 0;
}

async function serveForever() {
  const server = await start(options.ref);
  console.log(`${server.label} at ${server.url} (Ctrl-C to stop)`);
  await new Promise(() => {});
}

const commands = {
  help: async () => { console.log(HELP); return 0; },
  flows: async () => { for (const name of await flowNames()) console.log(`${name.padEnd(12)} ${(await loadFlow(name)).about}`); return 0; },
  run: async () => runFlows(!positional.length || positional[0] === 'all' ? await flowNames() : positional),
  shot: shots, perf, trace: traceCommand, heap, doctor, cleanup, serve: serveForever,
};

if (!commands[command]) { console.error(`Unknown command "${command}".\n\n${HELP}`); process.exit(2); }
const flowCount = command === 'run' ? (!positional.length || positional[0] === 'all' ? (await flowNames()).length : positional.length) : 1;
if (command !== 'serve') armTimeLimit(Number(options.timeout || 600 * flowCount));
try { await shutdown(await commands[command]()); }
catch (error) { console.error(`lh ${command}: ${error.message}`); await shutdown(1); }
