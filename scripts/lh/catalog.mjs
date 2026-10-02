import { createHash } from 'node:crypto';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { captureSequence, validateSequence } from './sequence.mjs';

const D = 'window.__littleHours.wilds.diagnostics()';
const CONTACT_SEQUENCES = new Set(['locomotion-overview', 'climb-outcrop']);
const SNAPSHOT = `(() => {
  const d = ${D}, point = p => p ? { x: p.x, y: p.y, z: p.z } : null;
  return {
    realEpochMs: performance.timeOrigin + performance.now(), gameMs: d.now,
    elapsedMs: d.elapsedMs, renderCount: d.renderCount,
    theme: window.__littleHours.state?.theme ?? null,
    motion: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'normal',
    player: { position: point(d.player.position), yaw: d.player.yaw, mode: d.player.mode, grounded: d.player.grounded, speed: d.player.speed, stamina: d.player.stamina },
    camera: { position: point(d.camera.position), target: point(d.cameraState?.target), yaw: d.cameraState?.yaw, pitch: d.cameraState?.pitch, distance: d.cameraState?.distance, occluded: d.cameraState?.occluded, fov: d.camera.fov },
    avatar: { appearance: d.avatar.appearance, clip: d.avatar.action, clipMs: d.avatar.actionElapsedMs, cyclePhase: d.avatar.cyclePhase, animation: d.avatar.animation },
    terrain: { center: d.world.center, pending: d.world.pending, builds: d.world.builds, failures: d.world.failures },
    lighting: d.world.lighting ?? null
  };
})()`;

function safeName(value) {
  const original = String(value), slug = original.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 140) || 'capture';
  return slug === original ? slug : `${slug}-${createHash('sha256').update(original).digest('hex').slice(0, 8)}`;
}

function fixtureFor(fixture = {}, appearance, camera) {
  const result = {};
  for (const key of ['position', 'yaw', 'stamina', 'appearance', 'camera']) if (fixture[key] !== undefined) result[key] = structuredClone(fixture[key]);
  if (appearance) result.appearance = structuredClone(appearance);
  if (camera) result.camera = { ...result.camera, ...camera };
  return result;
}

function inTheme(themes, theme) {
  return !themes || themes.includes(theme);
}

function inputEvent(event, codeMap = {}) {
  const result = {};
  for (const key of ['at', 'type', 'code', 'x', 'y', 'button', 'buttons']) if (event[key] !== undefined) result[key] = event[key];
  if (result.code) result.code = codeMap[result.code] ?? result.code;
  return result;
}

export function expandCatalog(plan, { theme, mode = 'stills', ids = [] } = {}) {
  if (!plan.captureDefaults?.themes?.includes(theme)) throw new Error(`Unknown catalog theme ${theme}`);
  if (!['stills', 'sequences'].includes(mode)) throw new Error(`Unknown catalog mode ${mode}`);
  const profiles = new Map((plan.appearanceProfiles || []).map(profile => [profile.id, profile.appearance]));
  const defaultProfileId = plan.appearanceProfiles?.[0]?.id ?? null;
  const defaultAppearance = profiles.get(defaultProfileId);
  const jobs = [];
  if (mode === 'stills') {
    for (const item of plan.inventory || []) {
      for (const view of item.stills || []) {
        if (!inTheme(view.themes ?? item.themes, theme)) continue;
        jobs.push({ id: `${item.id}--${view.id}`, sourceId: view.id, itemIds: [item.id], itemType: item.type, view: view.view, profileId: defaultProfileId, fixture: fixtureFor(view.fixture, view.fixture?.appearance ?? defaultAppearance), kind: 'still' });
      }
    }
    const matrix = plan.appearanceCoverage?.stillMatrix;
    if (matrix && inTheme(matrix.themes, theme)) {
      for (const profileId of matrix.profiles) {
        if (!profiles.has(profileId)) throw new Error(`Missing appearance profile ${profileId}`);
        for (const distance of matrix.distances) for (const angle of matrix.angles) {
          jobs.push({ id: `avatar--${profileId}--${distance.id}--${angle.id}`, sourceId: 'avatar', itemIds: ['avatar'], itemType: 'character', view: `${distance.id}-${angle.id}`, profileId, fixture: fixtureFor(matrix.fixtureBase, profiles.get(profileId), { distance: distance.metres, yaw: angle.yaw }), kind: 'still' });
        }
      }
    }
  } else {
    const matrix = plan.appearanceCoverage?.motionMatrix;
    for (const entry of plan.sequences || []) {
      if (!inTheme(entry.themes, theme)) continue;
      const profileIds = matrix?.sequences.includes(entry.id) && inTheme(matrix.themes, theme) ? matrix.profiles : [defaultProfileId];
      const variants = entry.cameraVariants?.length ? entry.cameraVariants : [{ id: 'default', camera: {}, eventCodeMap: {} }];
      const primaryMode = entry.modes.includes('real-time') ? 'real-time' : 'fixed-game-clock';
      const contactVariant = variants.find(variant => variant.id.includes('side')) ?? variants[0];
      const requestedClipIds = (plan.clipCoverage || []).filter(clip => clip.sequenceIds.includes(entry.id)).map(clip => clip.id);
      const itemIds = (plan.inventory || []).filter(item => item.sequenceIds?.includes(entry.id)).map(item => item.id);
      for (const profileId of profileIds) {
        if (profileId && !profiles.has(profileId)) throw new Error(`Missing appearance profile ${profileId}`);
        for (const variant of variants) {
          const modes = [primaryMode];
          if (CONTACT_SEQUENCES.has(entry.id) && primaryMode === 'real-time' && variant.id === contactVariant.id && entry.modes.includes('fixed-game-clock')) modes.push('fixed-game-clock');
          for (const clockMode of modes) {
            const id = [entry.id, profileId ?? 'default', variant.id, clockMode].join('--');
            const sequence = { id, durationMs: entry.sequence.durationMs, fixture: fixtureFor(entry.sequence.fixture, profiles.get(profileId), variant.camera), events: (entry.sequence.events || []).map(event => inputEvent(event, variant.eventCodeMap)) };
            if (clockMode === 'fixed-game-clock') sequence.fixedStepMs = plan.captureDefaults.fixedStepMs ?? 1000 / 60;
            validateSequence(sequence);
            jobs.push({ id, sourceId: entry.id, itemIds, itemType: 'sequence', view: variant.id, profileId, requestedClipIds, clockMode, fixture: sequence.fixture, sequence, kind: 'sequence' });
          }
        }
      }
    }
  }
  const names = new Set();
  for (const job of jobs) {
    job.fileName = safeName(job.id);
    if (names.has(job.fileName)) throw new Error(`Duplicate catalog capture ${job.id}`);
    names.add(job.fileName);
  }
  const selected = Array.isArray(ids) ? ids : String(ids).split(',').map(id => id.trim()).filter(Boolean);
  if (!selected.length) return jobs;
  const matches = (job, id) => job.id === id || job.sourceId === id || job.profileId === id || job.itemIds.includes(id);
  for (const id of selected) if (!jobs.some(job => matches(job, id))) throw new Error(`Catalog selection matched no captures: ${id}`);
  return jobs.filter(job => selected.some(id => matches(job, id)));
}

function allocateTake(folder, theme, mode) {
  mkdirSync(folder, { recursive: true });
  for (let take = 1; ; take++) {
    const path = join(folder, `${safeName(theme)}-${mode}-take-${String(take).padStart(3, '0')}`);
    try { mkdirSync(path); return path; } catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
}

async function prepareFixture(app, fixture, frozenAt) {
  await app.js(`window.__lhFrozenAt = ${frozenAt}`);
  await app.waitFor(`${D}.now === ${frozenAt}`, { what: 'the catalog setup clock' });
  const place = () => app.js(`window.__littleHours.wilds.place(${JSON.stringify(fixture)})`);
  if (!await place()) throw new Error('Catalog fixture is outside loaded terrain');
  await app.waitFor(`${D}.world.pending === false && !${D}.world.lighting?.pending`, { what: 'the catalog terrain and lighting streams' });
  if (!await place()) throw new Error('Catalog fixture could not be grounded after terrain streaming');
  const rendered = await app.js(`${D}.renderCount`);
  await app.waitFor(`${D}.world.pending === false && !${D}.world.lighting?.pending && ${D}.renderCount >= ${rendered + 2} && window.__littleHours.wilds.ready()`, { what: 'the grounded catalog view to render' });
  const snapshot = await app.js(SNAPSHOT);
  if (snapshot.terrain.pending || snapshot.terrain.failures || snapshot.lighting?.pending) throw new Error('Catalog terrain or lighting did not finish loading');
  return snapshot;
}

function saveManifest(path, manifest) {
  const pending = `${path}.tmp`;
  writeFileSync(pending, JSON.stringify(manifest, null, 2) + '\n');
  renameSync(pending, path);
}

async function releasePointer(app, events) {
  const buttons = new Map(events.filter(event => event.type === 'mousePressed').map(event => [event.button || 'left', event]));
  for (const [button, event] of buttons) await app.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: event.x, y: event.y, button, buttons: 0, clickCount: 1 });
}

export async function captureCatalog(app, plan, folder, { theme, buildId, mode = 'stills', ids = [] } = {}) {
  if (typeof buildId !== 'string' || !buildId.trim()) throw new Error('Catalog captures require a buildId');
  const jobs = expandCatalog(plan, { theme, mode, ids });
  const initial = await app.js(SNAPSHOT);
  if (initial.theme !== theme) throw new Error(`Loaded theme ${initial.theme} does not match catalog theme ${theme}`);
  const previousClock = await app.js('({ frozen: Object.hasOwn(window, "__lhFrozenAt"), value: window.__lhFrozenAt })');
  const frozenAt = await app.js(`window.__lhStartAt + ${plan.captureDefaults.stillGameClockOffsetMs ?? 100000}`);
  const takeFolder = allocateTake(folder, theme, mode), manifestFile = join(takeFolder, 'manifest.json');
  const manifest = {
    version: 1, milestone: plan.milestone, buildId, theme, mode,
    viewport: { width: app.width, height: app.height, scale: app.scale }, motion: initial.motion,
    randomSeed: plan.captureDefaults.randomSeed, worldSeed: plan.captureDefaults.worldSeed,
    inventory: (plan.inventory || []).map(item => ({ id: item.id, type: item.type, milestone: item.milestone })),
    requestedCaptureIds: jobs.map(job => job.id), captures: [], status: 'recording',
  };
  const errors = [];
  saveManifest(manifestFile, manifest);
  try {
    for (const job of jobs) {
      const record = { id: job.id, sourceId: job.sourceId, itemIds: job.itemIds, itemType: job.itemType, view: job.view, appearanceFixtureId: job.profileId, kind: job.kind, status: 'recording' };
      manifest.captures.push(record);
      saveManifest(manifestFile, manifest);
      try {
        record.setup = await prepareFixture(app, job.fixture, frozenAt);
        if (job.kind === 'still') {
          record.file = `${job.fileName}.jpg`;
          await app.shot(join(takeFolder, record.file));
          record.captured = await app.js(SNAPSHOT);
          record.clockMode = 'fixed-game-clock';
          record.captureEpochBounds = [record.setup.realEpochMs, record.captured.realEpochMs];
        } else {
          if (job.clockMode === 'real-time') await app.js('delete window.__lhFrozenAt');
          const evidence = await captureSequence(app, job.sequence, join(takeFolder, job.fileName));
          record.clockMode = evidence.mode;
          record.requestedClipIds = job.requestedClipIds;
          record.sequenceFile = `${job.fileName}/sequence.json`;
          record.playbackFile = evidence.playback.file ? `${job.fileName}/${evidence.playback.file}` : null;
          record.frames = evidence.frames.length;
          record.frameFileRange = [evidence.frames[0].file, evidence.frames.at(-1).file].map(file => `${job.fileName}/${file}`);
          record.realEpochRange = [evidence.frames[0].realEpochMs, evidence.frames.at(-1).realEpochMs];
          record.gameTimeRange = evidence.mode === 'fixed-game-clock' ? [evidence.frames[0].gameMs, evidence.frames.at(-1).gameMs] : null;
          record.inputTrack = { file: record.sequenceFile, field: 'recording.events', count: evidence.recording?.events.length ?? 0, allTrusted: evidence.recording?.events.every(event => event.trusted === true) ?? null };
          record.timing = evidence.timing;
          record.captured = await app.js(SNAPSHOT);
          if (evidence.pageErrors.length) throw new Error('Browser page errors occurred during the catalog sequence');
        }
        record.status = 'captured';
      } catch (error) {
        record.status = 'capture-error';
        errors.push({ id: job.id, message: error.message });
      } finally {
        if (job.sequence) await releasePointer(app, job.sequence.events).catch(error => errors.push({ id: job.id, message: error.message }));
        saveManifest(manifestFile, manifest);
      }
    }
  } finally {
    await app.js(previousClock.frozen ? `window.__lhFrozenAt = ${previousClock.value}` : 'delete window.__lhFrozenAt');
    manifest.status = errors.length ? 'partial' : 'captured';
    saveManifest(manifestFile, manifest);
  }
  return { folder: takeFolder, manifestFile, manifest, errors };
}
