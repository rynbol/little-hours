import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromePath, closeAll, gpuFlag, killAllNow, launch, sleep, slow } from './lh/chrome.mjs';
import { captureSequence, dispatchSequenceInput, validateSequence } from './lh/sequence.mjs';
import { openApp } from './lh/app.mjs';
import { prepareFight, driveFight } from './lh/wilds-fight.mjs';
import { captureWildsCrop } from './lh/wilds-shots.mjs';
import { serve } from './lh/server.mjs';
import { SEEDS } from './lh/seeds.mjs';
import { cycles, steps, views } from './lh/steps.mjs';
import { allocations, collectGarbage, focusTrip, placeTrips, gpuCosts, heapSnapshot, heapUsed, idle, takeEvents, trace, watchEvents } from './lh/measure.mjs';
import { commandOf, lhDir, outDir, repoRoot, stopTracked, tracked } from './lh/state.mjs';

const HELP = `lh: drive the real Little Hours app in Chrome and collect evidence.

  lh doctor                         check this machine can run trustworthy checks
  lh serve [--ref <git ref>]        start a dev server and keep it running (Ctrl-C stops it)
  lh art                            render room preview assets from the actual game scenes
  lh asset <name...>                close-up of Blender assets under the house lighting (--theme, --turn)
  lh world [view...]                shots of the outdoor world explorer from named views (--theme, --size, --wait,
                                    --at x,y,z with --yaw/--pitch radians for a custom camera; y is above ground); prints gpu ms
  lh flows                          list the flows
  lh run <flow...|all>              run flows with real input; exits 1 on any failure
  lh shot <view...>                 screenshots; views: ${Object.keys(views).join(', ')}
  lh perf [--view house|garden|lake|room|decorate|pet|focus|focus-trip|trips|wilds]
                                    idle cost, frame gaps, click-to-paint, GPU time, draw calls
  lh trace <cycle>                  Chrome performance trace of one cycle (--cold: the first run, without a warm-up run)
  lh alloc <cycle>                  sampled allocations during one cycle, by allocating function (--cold as for trace)
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
  --turn <n>         house shots: press the turn buttons n times first (negative turns left)
  --closed           house shots: close the house first
  --look <degrees>   focus shots: drag the view round by this many degrees first
  --pitch <degrees>  focus shots: drag the view up (positive) or down by this many degrees first
  --backdrop         focus shots: show the painted fallback valley the window falls back to when the outdoor world cannot build
  --probe "<expr>"   shots: print an expression evaluated with the live Babylon scene bound to scene
  --before "<expr>"  shots, world and perf: evaluate an expression with scene bound before the picture is taken
  --pick "x,y;x,y"   shots: also name the room mesh and material under each CSS pixel
  --freeze <ms>      shots: stop the game clock at this many ms after the start, so two shots can be compared pixel for pixel
  --sequence <json>  wilds shots: capture a complete input/frame sequence and timed playback
  --still            prefers-reduced-motion: reduce
  --headed           show the browser window
  --hold <codes>     wilds perf: hold real keys during measurement, e.g. KeyW,ShiftLeft
  --fight            wilds perf: fight the Warden with real sword, dodge and pet input
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

async function roomArt() {
  const server = await start(), browser = await launch({ width: 900, height: 750, scale: 2, reducedMotion: true });
  const folder = join(repoRoot, 'public', 'rooms'); mkdirSync(folder, { recursive: true });
  try {
    await browser.navigate(`${server.url}/checks/room-art.html`);
    for (let attempt = 0; attempt < 200 && !await browser.js(`Boolean(document.querySelector('[data-design]'))`); attempt++) await sleep(50);
    const designs = await browser.js(`[...document.querySelectorAll('button[data-design]')].map(button => button.dataset.design)`);
    if (designs.length !== 6) throw new Error('The room artwork controls did not load');
    for (const design of designs) {
      await browser.clickSel(`[data-design="${design}"]`);
      let data;
      for (let attempt = 0; attempt < 600; attempt++) {
        data = await browser.js(`document.querySelector('#preview').dataset.design === ${JSON.stringify(design)} ? document.querySelector('#preview').src : null`);
        if (data) break;
        await sleep(50);
      }
      if (!data?.startsWith('data:image/webp;base64,')) throw new Error(`No rendered artwork for ${design}`);
      const bytes = Buffer.from(data.split(',')[1], 'base64');
      if (bytes.length < 10000) throw new Error(`Empty artwork for ${design}`);
      writeFileSync(join(folder, `${design}.webp`), bytes);
      console.log(`${design}: ${Math.round(bytes.length / 1024)} KB`);
    }
  } finally { await browser.close(); }
}

async function assetShots() {
  const server = await start(), out = outDir('asset'), [width, height] = String(options.size || '1200x900').split('x').map(Number);
  const browser = await launch({ width, height, scale: Number(options.scale || 1), reducedMotion: true });
  try {
    const query = new URLSearchParams({ assets: (positional.length ? positional : ['tree-round-a']).join(','), theme: options.theme || 'day', turn: String(options.turn || 0) });
    await browser.navigate(`${server.url}/checks/asset.html?${query}`);
    for (let attempt = 0; attempt < 400 && !await browser.js(`document.body.dataset.ready === 'true'`); attempt++) await sleep(50);
    if (!await browser.js(`document.body.dataset.ready === 'true'`)) throw new Error('The asset close-up did not render');
    console.log(await browser.shot(join(out, `${positional.join('+') || 'tree-round-a'}-${options.theme || 'day'}.jpg`)));
  } finally { await browser.close(); }
  return 0;
}

async function worldShots() {
  const server = await start(options.ref), out = outDir('world'), [width, height] = String(options.size || '1440x1000').split('x').map(Number), theme = options.theme || 'day';
  const browser = await launch({ width, height, scale: Number(options.scale || 1), reducedMotion: false });
  try {
    for (const view of positional.length ? positional : ['window']) {
      await browser.navigate(`${server.url}/checks/world.html?${new URLSearchParams({ view, theme, ...(options.at ? { at: options.at, yaw: options.yaw || 0, pitch: options.pitch || 0 } : {}) })}`);
      for (let attempt = 0; attempt < 600 && !await browser.js(`Boolean(window.__world?.ready())`).catch(() => false); attempt++) await sleep(50);
      if (!await browser.js(`Boolean(window.__world?.ready())`)) throw new Error(`The world view ${view} did not render`);
      if (options.before) await browser.js(`(() => { const { scene } = window.__world; ${options.before}; })()`);
      await sleep(Number(options.wait || 1500));
      const stats = await browser.js(`(() => {
        const { engine, scene } = window.__world, gl = engine._gl, pixel = new Uint8Array(4), times = [];
        for (let i = 0; i < 35; i++) { engine._drawCalls.fetchNewFrame(); const start = performance.now(); engine.beginFrame(); scene.render(); engine.endFrame(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); if (i >= 5) times.push(performance.now() - start); }
        times.sort((a, b) => a - b);
        return { gpuFrameMs: Number(times[15].toFixed(2)), drawCalls: engine._drawCalls.current, triangles: Math.round(scene.getActiveIndices() / 3), buildMs: window.__world.buildMs };
      })()`);
      console.log(`${view} ${theme}: ${JSON.stringify(stats)} ${await browser.shot(join(out, `${view}-${theme}.jpg`))}`);
    }
  } finally { await browser.close(); }
  return 0;
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
  if (options.fight && (view !== 'wilds' || options.hold)) throw new Error('--fight requires --view wilds without --hold');
  const app = await openApp(url, { ...viewport, ...views[view]?.settings, scale: Number(options.scale || 2), seed: options.seed || 'three-rooms', theme: options.theme });
  try {
    await sleep(2500);
    const result = { readyMs: app.readyMs };
    await watchEvents(app);
    if (view === 'house') { await app.clickSel('#rooms-button'); result.openMs = await takeEvents(app, 4000); }
    if (view === 'garden') { await views.garden.go(app); result.openMs = await takeEvents(app, 2000); }
    if (view === 'lake') { await views.lake.go(app); result.openMs = await takeEvents(app, 2000); }
    if (view === 'pet') { await views.pet.go(app); result.openMs = await takeEvents(app, 1500); }
    if (view === 'focus') { await views.focus.go(app); result.openMs = await takeEvents(app, 1500); }
    if (view === 'focus-trip') { Object.assign(result, await focusTrip(app, viewport)); result.pageErrors = app.errors.length; return result; }
    if (view === 'trips') { await app.settle(); Object.assign(result, await placeTrips(app)); result.pageErrors = app.errors.length; return result; }
    if (view === 'decorate') { await app.clickSel('#decorate-button'); result.openMs = await takeEvents(app, 3000); }
    const sceneView = view === 'wilds' ? 'wilds' : 'room';
    if (options.before) await app.js(`(() => { const scene = window.__littleHours.${sceneView}.diagnostics().scene; ${options.before}; })()`);
    const worldBefore = view === 'wilds' ? await app.js('window.__littleHours.wilds.diagnostics().world') : null;
    const held = options.hold ? String(options.hold).split(',') : [];
    if (held.length) {
      if (view !== 'wilds') throw new Error('--hold currently requires the wilds view');
      validateSequence({ durationMs: 1, events: held.map(code => ({ at: 0, type: 'keyDown', code })) });
      await app.js(`document.getElementById('wilds-canvas').focus()`);
      for (const code of held) await dispatchSequenceInput(app, { type: 'keyDown', code });
    }
    try {
      const seconds = Number(options.seconds || (options.fight ? 15 : 5));
      if (options.fight) {
        await prepareFight(app);
        const [sample, fight] = await Promise.all([idle(app, seconds, { view }), driveFight(app, { durationMs: seconds * 1000 })]);
        Object.assign(result, sample, { fight });
      } else Object.assign(result, await idle(app, seconds, view === 'wilds' ? { view } : {}));
    }
    finally { for (const code of held) await dispatchSequenceInput(app, { type: 'keyUp', code }); }
    if (view === 'wilds') result.world = { ...await app.js('window.__littleHours.wilds.diagnostics().world'), before: worldBefore };

    if (view === 'house') {
      const tags = await app.js(`[...document.querySelectorAll('button.house-room-tag:not(.is-site):not(.is-garden):not(.is-pond)')].map(tag => tag.dataset.room)`);
      for (const id of tags) { await app.clickSel(`.house-room-tag[data-room="${id}"]`); result[`tapMs ${id}`] = await takeEvents(app, 1500); }
    }
    if (view === 'lake') {
      const gpu = await app.js(`(() => {
        const { engine, scene } = window.__littleHours.lake.diagnostics(), gl = engine._gl, pixel = new Uint8Array(4), times = [];
        for (let i = 0; i < 35; i++) { engine._drawCalls.fetchNewFrame(); const start = performance.now(); engine.beginFrame(); scene.render(); engine.endFrame(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); if (i >= 5) times.push(performance.now() - start); }
        times.sort((a, b) => a - b);
        return { gpuFrameMs: times[15], drawCalls: engine._drawCalls.current, triangles: Math.round(scene.getActiveIndices() / 3), renderPixels: engine.getRenderWidth() * engine.getRenderHeight() };
      })()`);
      Object.assign(result, gpu);
    } else if (app.hook && await app.js(`typeof window.__littleHours.gpuFrame === 'function'`)) {
      const which = view === 'wilds' ? 'wilds' : view === 'house' || view === 'garden' ? 'house' : 'room';
      const gpu = await app.js(`window.__littleHours.gpuFrame('${which}')`), stats = await app.js(`window.__littleHours.stats('${which}')`);
      Object.assign(result, { gpuFrameMs: gpu.ms, drawCalls: stats.drawCalls, triangles: stats.triangles, renderPixels: gpu.width * gpu.height });
      if (view === 'focus') Object.assign(result, await gpuCosts(app));
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
  const keys = [...new Set(runs.flat().flatMap(Object.keys))].filter(key => key !== 'passes' && key !== 'world');
  const rows = keys.map(key => [key, ...runs.map(side => fixed(median(side.map(result => result[key]))))]);
  if (list.length > 1) rows.forEach((row, i) => { const [a, b] = runs.map(side => median(side.map(result => result[keys[i]]))); row.push(a !== null && b !== null ? (a - b >= 0 ? '+' : '') + fixed(a - b) : '—'); });
  console.log('\n' + table(rows, ['metric (median)', ...list.map(side => side.label), ...(list.length > 1 ? ['difference'] : [])]));
  runs.forEach((side, i) => { const passes = side.find(result => result.passes)?.passes; if (passes) console.log(`\nGPU cost of each part (frame ms saved when hidden), ${list[i].label}:\n${table(Object.entries(passes).slice(0, 24).map(([label, ms]) => [label, fixed(ms)]), ['pass', 'ms'])}`); });
  console.log(`\nClick and open times are Event Timing durations; 16 means "16 ms or less". Lower is better everywhere except rafPerSecond.`);
  writeFileSync(join(out, 'perf.json'), JSON.stringify({ view, sides: list.map(side => side.label), runs }, null, 2));
  console.log(`evidence: ${join(out, 'perf.json')}`);
  if (options.fight) for (const result of runs.flat()) console.log(`Fight: player ${result.fight.playerDamage} damage, pet ${result.fight.petDamage} damage, Warden ${result.fight.bossHealthBefore} → ${result.fight.bossHealthAfter} health.`);
  return runs.flat().some(result => result.pageErrors || (options.fight && !result.fight.active)) ? 1 : 0;
}

async function shots() {
  const names = positional.length ? positional : ['room', 'house'], list = await sides(), out = outDir('shot');
  for (const side of list) for (const name of names) {
    if (!views[name]) throw new Error(`Unknown view "${name}". Views: ${Object.keys(views).join(', ')}`);
    const app = await openApp(side.url, { ...viewport, ...views[name].settings, scale: Number(options.scale || 1), seed: options.seed || 'three-rooms', theme: options.theme });
    try {
      await sleep(800); await app.settle(); await views[name].go(app);
      for (let i = 0; i < Math.abs(Number(options.turn || 0)); i++) { await app.clickSel(Number(options.turn) < 0 ? '#house-turn-left' : '#house-turn-right'); await sleep(60); }
      if (options.closed) await app.clickSel('[data-house-open]');
      for (let left = Number(options.look || 0) * Math.PI / 180 / 0.0042; Math.abs(left) > 1; left -= Math.sign(left) * Math.min(Math.abs(left), 300)) {
        const step = Math.sign(left) * Math.min(Math.abs(left), 300), y = viewport.height / 2;
        await app.drag({ x: viewport.width / 2, y }, { x: viewport.width / 2 + step, y });
      }
      for (let up = Number(options.pitch || 0) * Math.PI / 180 / 0.0042; Math.abs(up) > 1; up -= Math.sign(up) * Math.min(Math.abs(up), 300)) {
        const step = Math.sign(up) * Math.min(Math.abs(up), 300), x = viewport.width / 2;
        await app.drag({ x, y: viewport.height / 2 - step / 2 }, { x, y: viewport.height / 2 + step / 2 });
      }
      if (options.turn || options.closed || options.look || options.pitch) await app.settle();
      if (options.backdrop) await app.js(`window.__littleHours.room.diagnostics().seat.world.setBackdrop(true)`);
      const sceneView = views[name].scene || (name === 'wilds' ? 'wilds' : 'room');
      if (options.before) await app.js(`(() => { const scene = window.__littleHours.${sceneView}.diagnostics().scene; ${options.before}; })()`);
      if (options.freeze) await app.js(`window.__lhFrozenAt = window.__lhStartAt + ${Number(options.freeze)}`);
      await sleep(Number(options.wait || 600));
      if (options.sequence) {
        if (name !== 'wilds' || options.freeze) throw new Error('Sequences require the wilds view; use fixedStepMs in the sequence instead of --freeze');
        const sequence = JSON.parse(readFileSync(String(options.sequence), 'utf8'));
        const folder = join(out, `${name}-sequence`);
        const result = await captureSequence(app, sequence, folder);
        if (result.pageErrors.length) throw new Error(`Sequence page errors: ${result.pageErrors.join(' | ')}`);
        console.log(`${side.label} ${name}: ${folder} (${result.frames.length} frames, max real gap ${result.timing.maxRealGapMs.toFixed(1)} ms)`);
      }
      const file = await app.shot(join(out, `${name}-${list.length > 1 ? (side === list[0] ? 'this' : String(options.against).replace(/[^\w.-]+/g, '_')) : 'this'}.jpg`));
      console.log(`${side.label} ${name}: ${file}${app.errors.length ? `  page errors: ${app.errors.join(' | ').slice(0, 200)}` : ''}`);
      if (views[name].crop) console.log(`2x crop: ${await captureWildsCrop(app, file.replace('.jpg', '-2x.png'), views[name].crop, viewport)}`);
      if (options.pick) for (const point of String(options.pick).split(';')) {
        const [x, y] = point.split(',').map(Number);
        const hit = await app.js(`(() => { const scene = window.__littleHours.${sceneView}.diagnostics().scene, hit = scene.pick(${x}, ${y}, mesh => mesh.isEnabled() && mesh.isVisible); const mesh = hit?.pickedMesh; return mesh ? [mesh.name, mesh.material?.name, mesh.parent?.name].join(' | ') : 'nothing'; })()`);
        console.log(`  pick ${x},${y}: ${hit}`);
      }
      if (options.probe) console.log(`  probe: ${await app.js(`(async () => { const scene = window.__littleHours.${sceneView}.diagnostics().scene; return JSON.stringify(await (${options.probe})); })()`)}`);
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
  const app = await openApp(server.url, { ...viewport, ...cycle.settings, scale: Number(options.scale || 2), seed: options.seed || 'three-rooms', theme: options.theme });
  try {
    await sleep(1500); await app.settle(); await cycle.setup?.(app); if (!options.cold) await cycle.run(app);
    const file = join(out, `trace-${name}.json`);
    const summary = await trace(app, file, () => cycle.run(app));
    console.log(`lh trace ${name} (${cycle.about}) on ${server.label}\n  main-thread busy ${summary.busyMs} ms, long tasks (>50 ms): ${summary.longTasks}${summary.longTasks ? ` [${summary.longestTasksMs.join(', ')} ms]` : ''}\n  trace: ${file}\n  Open it in Chrome DevTools > Performance > Load profile.`);
    return app.errors.length ? 1 : 0;
  } finally { await app.close(); }
}

async function allocCommand() {
  const name = positional[0] || 'house', cycle = cycleFor(name), server = await start(options.ref);
  const app = await openApp(server.url, { ...viewport, ...cycle.settings, scale: Number(options.scale || 2), seed: options.seed || 'three-rooms', theme: options.theme });
  try {
    await sleep(1500); await app.settle(); await cycle.setup?.(app); if (!options.cold) await cycle.run(app);
    const result = await allocations(app, () => cycle.run(app));
    console.log(`lh alloc ${name} (${cycle.about}) on ${server.label}\n  ${result.mbPerSecond.toFixed(2)} MB/s allocated over ${result.seconds.toFixed(1)} s, including objects already collected`);
    for (const { where, kbPerSecond } of result.top) console.log(`  ${String(kbPerSecond).padStart(6)} KB/s  ${where}`);
    return app.errors.length ? 1 : 0;
  } finally { await app.close(); }
}

async function heapOnce(side, cycle, repeat, out, tag) {
  const app = await openApp(side.url, { ...viewport, ...cycle.settings, scale: 1, seed: options.seed || 'three-rooms', theme: options.theme });
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
  art: roomArt, asset: assetShots, world: worldShots, shot: shots, perf, trace: traceCommand, alloc: allocCommand, heap, doctor, cleanup, serve: serveForever,
};

if (!commands[command]) { console.error(`Unknown command "${command}".\n\n${HELP}`); process.exit(2); }
const flowCount = command === 'run' ? (!positional.length || positional[0] === 'all' ? (await flowNames()).length : positional.length) : 1;
if (command !== 'serve') armTimeLimit(Number(options.timeout || 600 * flowCount));
try { await shutdown(await commands[command]()); }
catch (error) { console.error(`lh ${command}: ${error.message}`); await shutdown(1); }
