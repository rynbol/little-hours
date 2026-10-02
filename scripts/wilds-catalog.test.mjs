import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { captureCatalog, expandCatalog } from './lh/catalog.mjs';

const plan = JSON.parse(readFileSync(new URL('../docs/openworld/m1-capture-plan.json', import.meta.url)));

function output(t) {
  const folder = mkdtempSync(join(tmpdir(), 'wilds-catalog-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  return folder;
}

function mockApp({ theme = 'day', failShots = false, frozenAt } = {}) {
  const calls = [], listeners = new Set();
  let fixture = {}, pending = false, ground = 10, rendered = 0, now = 1000, recording = null, frameId = 0;
  const clock = { frozenAt };
  function snapshot() {
    return {
      realEpochMs: 200000 + ++now, gameMs: clock.frozenAt ?? now,
      elapsedMs: 456, renderCount: rendered, theme, motion: 'normal',
      player: { position: { x: fixture.position?.x ?? 0, y: fixture.position?.y ?? ground, z: fixture.position?.z ?? 0 }, yaw: fixture.yaw ?? 0, mode: 'grounded', grounded: true, speed: 0, stamina: 100 },
      camera: { position: { x: 7, y: 8, z: 9 }, target: { x: 0, y: 2, z: 0 }, yaw: .2, pitch: .3, distance: 2.75, occluded: true, fov: .88 },
      avatar: { appearance: fixture.appearance ?? {}, clip: 'idle', clipMs: 33, cyclePhase: .011, animation: [{ name: 'idle', weight: 1, frame: 2 }] },
      terrain: { center: { x: 0, z: 0 }, pending, builds: 2, failures: 0 },
    };
  }
  function frame() {
    frameId++;
    const message = { method: 'Page.screencastFrame', params: { data: Buffer.from(`frame${frameId}`).toString('base64'), metadata: { timestamp: 200 + frameId / 60 }, sessionId: frameId } };
    for (const listener of listeners) listener(message);
  }
  const app = {
    width: 960, height: 640, scale: 1, errors: [], calls, clock,
    async js(expression) {
      calls.push({ type: 'js', expression });
      if (expression.includes('motion: matchMedia')) return snapshot();
      if (expression.startsWith('({ frozen: Object.hasOwn')) return { frozen: clock.frozenAt !== undefined, value: clock.frozenAt };
      if (expression.startsWith('window.__lhStartAt + ')) return 101000;
      if (expression.startsWith('window.__lhFrozenAt = ')) { clock.frozenAt = Number(expression.split(' = ')[1]); return; }
      if (expression === 'delete window.__lhFrozenAt') { delete clock.frozenAt; return; }
      if (expression.startsWith('window.__littleHours.wilds.place(')) {
        fixture = JSON.parse(expression.slice('window.__littleHours.wilds.place('.length, -1));
        calls.push({ type: 'place', fixture: structuredClone(fixture), ground });
        pending = true;
        return true;
      }
      if (expression.endsWith('.renderCount')) return rendered;
      if (expression === 'window.__littleHours.startInputCapture()') { recording = { startEpochMs: 200000, startGameMs: now, events: [] }; return; }
      if (expression === 'window.__littleHours.stopInputCapture()') { const result = recording; recording = null; return result; }
      if (expression.includes('realEpochMs:')) return { realEpochMs: 200000 + ++now, position: snapshot().player.position, clip: 'idle', clipMs: 33, cyclePhase: .011 };
    },
    async waitFor(expression, options) {
      calls.push({ type: 'wait', expression, what: options?.what });
      if (expression.includes('.world.pending === false')) { pending = false; ground = 20; }
      rendered += 2;
    },
    async shot(file) {
      calls.push({ type: 'shot', file, fixture: structuredClone(fixture), ground, frozenAt: clock.frozenAt });
      if (failShots) throw new Error('mock screenshot failure');
      writeFileSync(file, 'mock-jpeg');
    },
    on(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async send(method, params = {}) {
      calls.push({ type: 'send', method, params });
      if (method === 'Page.startScreencast') { frame(); frame(); }
      if (method === 'Page.stopScreencast') frame();
      if (method.startsWith('Input.')) recording?.events.push({ type: params.type, code: params.code ?? null, trusted: true, realEpochMs: 200000 + ++now, gameMs: clock.frozenAt ?? now });
    },
  };
  return app;
}

test('the still catalog expands every subject view and every profile, distance and angle', () => {
  for (const theme of ['day', 'dusk', 'rain']) {
    const jobs = expandCatalog(plan, { theme });
    assert.equal(jobs.length, 83);
    assert.equal(jobs.filter(job => job.sourceId === 'avatar').length, 36);
    for (const profile of plan.appearanceProfiles) {
      assert.deepEqual(jobs.filter(job => job.sourceId === 'avatar' && job.profileId === profile.id).map(job => job.view), ['normal-front', 'normal-side', 'normal-rear', 'close-front', 'close-side', 'close-rear']);
    }
    for (const item of plan.inventory) for (const view of item.stills || []) assert.equal(jobs.filter(job => job.sourceId === view.id).length, 1);
  }
});

test('sequence expansion covers the whole plan and alternate garments without a duplicate fixed route', () => {
  const jobs = expandCatalog(plan, { theme: 'day', mode: 'sequences' });
  assert.equal(jobs.length, 38);
  assert.equal(jobs.filter(job => job.clockMode === 'real-time').length, 29);
  assert.equal(jobs.filter(job => job.clockMode === 'fixed-game-clock').length, 9);
  assert.deepEqual([...new Set(jobs.map(job => job.sourceId))], plan.sequences.map(sequence => sequence.id));
  assert.deepEqual(jobs.filter(job => job.sourceId === 'route-clearing-vista').map(job => job.clockMode), ['real-time']);
  assert.deepEqual(jobs.filter(job => job.sourceId === 'fall-asset-fixture').map(job => job.clockMode), ['fixed-game-clock']);
  const skirt = jobs.filter(job => job.sourceId === 'locomotion-overview' && job.profileId === 'appearance-03');
  assert.equal(skirt.length, 3);
  assert.equal(skirt[0].fixture.appearance.outfit, 'overalls');
  assert.equal(skirt[0].fixture.appearance.bottomStyle, 'skirt');
  for (const sourceId of ['locomotion-overview', 'climb-outcrop']) {
    const side = jobs.find(job => job.sourceId === sourceId && job.clockMode === 'fixed-game-clock');
    assert.ok(side.view.startsWith('side'));
    assert.equal(side.sequence.events.find(event => event.type === 'keyDown').code, 'KeyD');
    assert.equal(side.sequence.fixedStepMs, 1000 / 60);
  }
});

test('catalog filters select exact captures or source IDs and sanitize path names without collisions', () => {
  const jobs = expandCatalog(plan, { theme: 'day', ids: ['appearance-06'] });
  assert.equal(jobs.length, 6);
  assert.equal(expandCatalog(plan, { theme: 'day', ids: jobs[0].id }).length, 1);
  assert.equal(expandCatalog(plan, { theme: 'day', mode: 'sequences', ids: 'route-clearing-vista,fall-asset-fixture' }).length, 2);
  assert.throws(() => expandCatalog(plan, { theme: 'day', ids: ['unknown'] }), /matched no captures/);
  const changed = structuredClone(plan);
  changed.inventory = [{ id: '../subject', type: 'landmark', stills: [{ id: '../../wide', view: 'wide', fixture: {} }, { id: '.. wide', view: 'wide', fixture: {} }] }];
  delete changed.appearanceCoverage;
  const safe = expandCatalog(changed, { theme: 'day' });
  assert.ok(safe.every(job => /^[a-z0-9-]+$/.test(job.fileName)));
  assert.notEqual(safe[0].fileName, safe[1].fileName);
});

test('batch stills ground after streaming and record observed camera, clip and position rather than requested values', async t => {
  const folder = output(t), app = mockApp({ frozenAt: 4321 });
  const result = await captureCatalog(app, plan, folder, { theme: 'day', buildId: 'test-build', ids: ['forest-wide'] });
  assert.equal(result.errors.length, 0);
  assert.equal(result.manifest.captures.length, 1);
  const phases = app.calls.filter(call => ['place', 'wait', 'shot'].includes(call.type));
  assert.deepEqual(phases.map(call => call.type), ['wait', 'place', 'wait', 'place', 'wait', 'shot']);
  assert.equal(phases[1].ground, 10);
  assert.equal(phases[3].ground, 20);
  assert.match(phases[2].expression, /world.pending === false/);
  const record = result.manifest.captures[0];
  assert.equal(record.status, 'captured');
  assert.equal(record.captured.player.position.y, 20);
  assert.equal(record.captured.camera.distance, 2.75);
  assert.equal(record.captured.camera.occluded, true);
  assert.equal(record.captured.avatar.clip, 'idle');
  assert.equal(record.captured.avatar.clipMs, 33);
  assert.equal(record.clockMode, 'fixed-game-clock');
  assert.equal(app.calls.find(call => call.type === 'shot').frozenAt, 101000);
  assert.equal(app.clock.frozenAt, 4321);
  assert.equal(readFileSync(join(result.folder, record.file), 'utf8'), 'mock-jpeg');
});

test('a complete still batch captures83 images in order without leaking plan notes, opinions or source references', async t => {
  const folder = output(t), app = mockApp();
  const changed = structuredClone(plan);
  changed.inventory[0].notes = 'BUILDER_OPINION_SENTINEL';
  changed.inventory[0].score = 10;
  changed.inventory[0].stills[0].fixture.notes = 'BUILDER_OPINION_SENTINEL';
  const result = await captureCatalog(app, changed, folder, { theme: 'day', buildId: 'build-123' });
  assert.equal(result.manifest.status, 'captured');
  assert.equal(result.manifest.captures.length, 83);
  assert.equal(app.calls.filter(call => call.type === 'shot').length, 83);
  assert.deepEqual(result.manifest.captures.map(capture => capture.id), expandCatalog(plan, { theme: 'day' }).map(job => job.id));
  const saved = readFileSync(result.manifestFile, 'utf8');
  assert.doesNotMatch(saved, /BUILDER_OPINION_SENTINEL|"notes"|"score"|"verdict"|sourceFiles|tools\/blender|\.mjs|window\.__/);
  assert.equal(JSON.parse(saved).buildId, 'build-123');
  assert.equal(app.clock.frozenAt, undefined);
});

test('catalog stills wait for a pending lighting field before capturing the placed view', async t => {
  const app = mockApp(), wait = app.waitFor, js = app.js, shot = app.shot;
  let lightingPending = true;
  app.js = async expression => {
    const result = await js(expression);
    if (result?.terrain) result.lighting = { pending: lightingPending };
    return result;
  };
  app.waitFor = async (expression, options) => {
    await wait(expression, options);
    const window = { __littleHours: { wilds: {
      diagnostics: () => ({ now: app.clock.frozenAt, renderCount: 10000, world: { pending: false, lighting: { pending: lightingPending } } }),
      ready: () => true,
    } } };
    const ready = new Function('window', `return (${expression});`);
    if (!ready(window)) lightingPending = false;
    assert.equal(ready(window), true);
  };
  app.shot = async file => { assert.equal(lightingPending, false); await shot(file); };
  const result = await captureCatalog(app, plan, output(t), { theme: 'day', buildId: 'lighting-test', ids: ['forest-wide'] });
  assert.deepEqual(result.errors, []);
  assert.equal(result.manifest.captures[0].status, 'captured');
  assert.equal(result.manifest.captures[0].captured.lighting.pending, false);
});

test('retries allocate another take and preserve both old media and its manifest', async t => {
  const folder = output(t), app = mockApp();
  const options = { theme: 'day', buildId: 'build', ids: ['forest-wide'] };
  const first = await captureCatalog(app, plan, folder, options);
  const priorManifest = readFileSync(first.manifestFile, 'utf8');
  writeFileSync(join(first.folder, first.manifest.captures[0].file), 'original evidence');
  const second = await captureCatalog(app, plan, folder, options);
  assert.notEqual(first.folder, second.folder);
  assert.match(first.folder, /take-001$/);
  assert.match(second.folder, /take-002$/);
  assert.equal(readFileSync(first.manifestFile, 'utf8'), priorManifest);
  assert.equal(readFileSync(join(first.folder, first.manifest.captures[0].file), 'utf8'), 'original evidence');
  assert.equal(readFileSync(join(second.folder, second.manifest.captures[0].file), 'utf8'), 'mock-jpeg');
});

test('failed captures remain retryable and theme mismatches fail before writing or moving the scene', async t => {
  const folder = output(t), app = mockApp({ failShots: true });
  const result = await captureCatalog(app, plan, folder, { theme: 'day', buildId: 'build', ids: ['forest-wide'] });
  assert.equal(result.manifest.status, 'partial');
  assert.equal(result.manifest.captures[0].status, 'capture-error');
  assert.equal(result.errors[0].message, 'mock screenshot failure');
  assert.equal(app.clock.frozenAt, undefined);
  const wrongTheme = mockApp({ theme: 'rain' });
  await assert.rejects(captureCatalog(wrongTheme, plan, folder, { theme: 'day', buildId: 'build' }), /does not match/);
  assert.equal(wrongTheme.calls.filter(call => call.type === 'place').length, 0);
  assert.equal(readdirSync(folder).length, 1);
});

test('sequence batches delegate real and fixed jobs to the existing complete-frame recorder', async t => {
  const folder = output(t), app = mockApp(), changed = structuredClone(plan);
  const previous = process.env.LH_FFMPEG;
  process.env.LH_FFMPEG = join(folder, 'no-encoder');
  t.after(() => { if (previous === undefined) delete process.env.LH_FFMPEG; else process.env.LH_FFMPEG = previous; });
  changed.captureDefaults.fixedStepMs = 20;
  for (const entry of changed.sequences) {
    entry.sequence.durationMs = 40;
    entry.sequence.events = entry.sequence.events.map((event, index) => ({ ...event, at: index % 20 }));
  }
  const result = await captureCatalog(app, changed, folder, { theme: 'day', buildId: 'build', mode: 'sequences', ids: ['locomotion-overview', 'fall-asset-fixture'] });
  assert.deepEqual(result.errors, []);
  assert.equal(result.manifest.captures.length, 13);
  assert.equal(result.manifest.captures.filter(capture => capture.clockMode === 'real-time').length, 8);
  assert.equal(result.manifest.captures.filter(capture => capture.clockMode === 'fixed-game-clock').length, 5);
  for (const record of result.manifest.captures) {
    const evidence = JSON.parse(readFileSync(join(result.folder, record.sequenceFile), 'utf8'));
    assert.equal(record.frames, 3);
    assert.equal(evidence.frames.length, 3);
    assert.equal(record.playbackFile, null);
    assert.equal(record.status, 'captured');
    assert.equal(evidence.sequence.fixture.appearance.style, record.setup.avatar.appearance.style);
    assert.equal(readFileSync(join(result.folder, record.frameFileRange[0])).length > 0, true);
    if (record.clockMode === 'fixed-game-clock') assert.deepEqual(record.gameTimeRange, [101000, 101040]);
    else assert.equal(evidence.sequence.fixedStepMs, undefined);
  }
  const side = result.manifest.captures.find(capture => capture.view === 'side-tracking');
  const sideEvidence = JSON.parse(readFileSync(join(result.folder, side.sequenceFile), 'utf8'));
  assert.equal(sideEvidence.sequence.events.find(event => event.type === 'keyDown').code, 'KeyD');
  assert.equal(app.clock.frozenAt, undefined);
});
