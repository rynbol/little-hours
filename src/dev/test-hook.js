import { EngineStore } from '@babylonjs/core/Engines/engineStore.js';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector.js';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function until(test, timeout, what) {
  const end = performance.now() + timeout;
  while (!test()) {
    if (performance.now() > end) throw new Error(`Timed out after ${timeout} ms waiting for ${typeof what === 'function' ? what() : what}`);
    await wait(16);
  }
}

const AMBIENT_ANIMATIONS = '#timer-progress';
function runningAnimations() {
  return document.getAnimations().filter(animation => animation.playState === 'running' && Number.isFinite(animation.effect?.getComputedTiming().endTime) && !animation.effect.target?.matches?.(AMBIENT_ANIMATIONS));
}

function animationName(animation) {
  const target = animation.effect?.target;
  return `${animation.animationName || animation.transitionProperty || 'script'} on ${target?.id ? `#${target.id}` : target?.className || target?.tagName}`;
}

function itemId(mesh) {
  for (let node = mesh; node; node = node.parent) if (node.metadata?.itemId) return node.metadata.itemId;
  return null;
}

function matcher(target) {
  if (target.houseRoom) return { view: 'house', match: mesh => mesh.metadata?.houseSlot === target.houseRoom };
  if (target.item) return { view: 'room', match: mesh => itemId(mesh) === target.item };
  if (target.door) return { view: 'room', match: mesh => mesh.metadata?.houseLink === target.door };
  if (target.lights) return { view: 'room', match: mesh => Boolean(mesh.metadata?.lightSwitch) };
  throw new Error(`Unknown screenPoint target ${JSON.stringify(target)}`);
}

export function installTestHook(app) {
  let inputRecording = null;
  const inputTypes = ['keydown', 'keyup', 'pointerdown', 'pointerup', 'pointermove'];
  const recordInput = event => {
    inputRecording?.events.push({ type: event.type, code: event.code || null, key: event.key || null, button: event.button ?? null, buttons: event.buttons ?? null, x: event.clientX ?? null, y: event.clientY ?? null, trusted: event.isTrusted, realEpochMs: performance.timeOrigin + event.timeStamp, observedEpochMs: performance.timeOrigin + performance.now(), gameMs: app.wilds?.diagnostics().now ?? null });
  };
  function stopInputCapture() {
    for (const type of inputTypes) document.removeEventListener(type, recordInput, true);
    const recording = inputRecording;
    inputRecording = null;
    return recording;
  }
  function startInputCapture() {
    stopInputCapture();
    inputRecording = { startEpochMs: performance.timeOrigin + performance.now(), startGameMs: app.wilds?.diagnostics().now ?? null, events: [] };
    for (const type of inputTypes) document.addEventListener(type, recordInput, true);
    return { startEpochMs: inputRecording.startEpochMs, startGameMs: inputRecording.startGameMs };
  }
  const views = {
    room: () => app.room?.diagnostics(),
    house: () => app.house?.view?.diagnostics(),
    wilds: () => app.wilds?.diagnostics(),
  };
  const view = name => {
    const found = views[name]?.();
    if (!found) throw new Error(`The ${name} view is not built`);
    return found;
  };

  function busy() {
    const reasons = [];
    const body = document.body.classList;
    if (document.documentElement.dataset.placeTransition) reasons.push('place transition');
    if (body.contains('is-travelling')) reasons.push('travelling');
    if (body.contains('is-door-walking')) reasons.push('door walk');
    const room = views.room();
    if (room?.dragging) reasons.push('dragging');
    if (room?.moving) reasons.push('avatar camera');
    const house = document.body.classList.contains('is-house') ? views.house() : null;
    if (house && house.open !== (house.closed ? 0 : 1)) reasons.push('house opening');
    if (house?.activeRoomMotions) reasons.push('house room motion');
    if (house?.turning) reasons.push('house camera');
    const animations = runningAnimations();
    if (animations.length) reasons.push(`css animation: ${animations.map(animationName).join(', ')}`);
    return reasons;
  }

  function project(scene, points) {
    const engine = scene.getEngine(), canvas = engine.getRenderingCanvas(), rect = canvas.getBoundingClientRect();
    const width = engine.getRenderWidth(), height = engine.getRenderHeight();
    const viewport = scene.activeCamera.viewport.toGlobal(width, height), transform = scene.getTransformMatrix();
    return points.map(point => {
      const screen = Vector3.Project(point, Matrix.IdentityReadOnly, transform, viewport);
      return { x: screen.x / width * rect.width, y: screen.y / height * rect.height };
    });
  }

  function screenPoint(target) {
    if (target === 'pet' || target?.pet) {
      const room = view('room'), pet = room.petModel;
      if (!pet?.root.isEnabled()) return null;
      const { min, max } = pet.root.getHierarchyBoundingVectors(true);
      return scan(room.scene, min, max, (x, y) => Boolean(room.tapTarget(room.scene.createPickingRay(x, y, null, room.scene.activeCamera))?.cat));
    }
    if (Number.isInteger(target?.gardenPlot)) {
      const house = view('house'), spot = house.plots[target.gardenPlot];
      if (!spot) return null;
      const [x, z] = spot;
      return scan(house.scene, new Vector3(x - .42, -.1, z - .42), new Vector3(x + .42, .22, z + .42), (sx, sy) => {
        const hit = house.scene.pick(sx, sy);
        return hit?.pickedMesh?.metadata?.houseSlot === 'orchard' && hit.pickedPoint && Math.hypot(hit.pickedPoint.x - x, hit.pickedPoint.z - z) < .5;
      });
    }
    const { view: name, match } = matcher(target);
    const scene = view(name).scene;
    const meshes = scene.meshes.filter(mesh => mesh.isEnabled() && mesh.isVisible && match(mesh));
    if (!meshes.length) return null;
    const min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const mesh of meshes) {
      mesh.computeWorldMatrix(true);
      const box = mesh.getBoundingInfo().boundingBox;
      min.minimizeInPlace(box.minimumWorld); max.maximizeInPlace(box.maximumWorld);
    }
    return scan(scene, min, max, (x, y) => { const throughLeaves = mesh => mesh.isPickable && mesh.isEnabled() && mesh.isVisible && mesh.metadata?.effect !== 'leaf-sway', picked = scene.pick(x, y, throughLeaves)?.pickedMesh; return Boolean(picked && match(picked)); });
  }

  function scan(scene, min, max, isHit) {
    const rect = scene.getEngine().getRenderingCanvas().getBoundingClientRect();
    const corners = [];
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) corners.push(new Vector3(x, y, z));
    const flat = project(scene, corners);
    const left = Math.max(0, Math.min(...flat.map(p => p.x))), right = Math.min(rect.width, Math.max(...flat.map(p => p.x)));
    const top = Math.max(0, Math.min(...flat.map(p => p.y))), bottom = Math.min(rect.height, Math.max(...flat.map(p => p.y)));
    const miss = { x: rect.left + (left + right) / 2, y: rect.top + (top + bottom) / 2, visible: false, hits: 0 };
    if (right <= left || bottom <= top) return miss;
    const step = Math.max(3, Math.min(right - left, bottom - top) / 14), found = [];
    const canvas = scene.getEngine().getRenderingCanvas(), reachable = (x, y) => document.elementFromPoint(rect.left + x, rect.top + y) === canvas;
    for (let y = top + step / 2; y < bottom; y += step) for (let x = left + step / 2; x < right; x += step) if (isHit(x, y)) found.push({ x, y });
    if (!found.length) return miss;
    const onCanvas = found.filter(({ x, y }) => reachable(x, y)), hits = onCanvas.length ? onCanvas : found;
    const mean = hits.reduce((sum, hit) => ({ x: sum.x + hit.x / hits.length, y: sum.y + hit.y / hits.length }), { x: 0, y: 0 });
    const best = hits.reduce((a, b) => Math.hypot(a.x - mean.x, a.y - mean.y) <= Math.hypot(b.x - mean.x, b.y - mean.y) ? a : b);
    return { x: rect.left + best.x, y: rect.top + best.y, visible: true, hits: hits.length };
  }

  function gpuFrame(name = 'room', samples = 30) {
    const { engine, scene, draw = () => scene.render() } = view(name), gl = engine._gl, pixel = new Uint8Array(4);
    const once = () => {
      const start = performance.now();
      engine.beginFrame(); draw(); engine.endFrame();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return performance.now() - start;
    };
    for (let i = 0; i < 5; i++) once();
    const times = Array.from({ length: samples }, once).sort((a, b) => a - b);
    return { ms: times[samples >> 1], width: engine.getRenderWidth(), height: engine.getRenderHeight(), triangles: Math.round(scene.getActiveIndices() / 3) };
  }

  function counts() {
    const scene = diagnostics => diagnostics && { meshes: diagnostics.scene.meshes.length, materials: diagnostics.scene.materials.length, textures: diagnostics.scene.textures.length, geometries: diagnostics.scene.geometries.length };
    return { engines: EngineStore.Instances.length, canvases: document.querySelectorAll('canvas').length, room: scene(views.room()), house: scene(views.house()), wilds: scene(views.wilds()) };
  }

  function stats(name = 'room') {
    const found = view(name);
    return { drawCalls: found.drawCalls, triangles: Math.round(found.scene.getActiveIndices() / 3), renderCount: found.renderCount ?? null, pixelRatio: found.pixelRatio ?? null, quality: found.quality ?? null };
  }

  window.__littleHours = {
    version: 1,
    get room() { return app.room; },
    get petCloseup() { return app.pet.diagnostics(); },
    buddyCloseup: () => app.buddy.closeup(),
    get state() { return app.state; },
    get speech() { return app.speech; },
    get house() { return app.house; },
    get lake() { return app.lake; },
    get wilds() { return app.wilds; },
    get connected() { return app.connected; },
    ready: (timeout = 30000) => until(() => app.wilds ? app.wilds.ready() : app.room && document.getElementById('loading-note')?.hidden, timeout, 'the view to be ready').then(() => true),
    busy,
    async settled(timeout = 10000) {
      await until(() => !busy().length, timeout, () => `the page to settle (${busy().join(', ')})`);
      await wait(50);
      return true;
    },
    screenPoint,
    gpuFrame,
    counts,
    stats,
    startInputCapture,
    stopInputCapture,
  };
}
