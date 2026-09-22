// Real Babylon scene/math/picking with a NullEngine, not a GPU benchmark.
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector.js';
import { Camera } from '@babylonjs/core/Cameras/camera.js';
import { createLayout } from '../src/layout.js';

class Surface {
  listeners = new Map();
  addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(fn); }
  removeEventListener(name, fn) { this.listeners.get(name)?.delete(fn); }
  emit(name, event = {}) { for (const fn of [...(this.listeners.get(name) || [])]) fn({ type: name, target: this, preventDefault() {}, ...event }); }
  get listenerCount() { return [...this.listeners.values()].reduce((n, set) => n + set.size, 0); }
}
const context = new Proxy({}, { get: (_, key) => key.includes('Gradient') ? () => ({ addColorStop() {} }) : key === 'measureText' ? () => ({ width: 20 }) : () => {} });
const doc = new Surface(), win = new Surface(), motion = new Surface();
doc.hidden = false; doc.defaultView = win; doc.documentElement = { style: {} };
win.devicePixelRatio = 1.5; win.innerWidth = 1280; win.innerHeight = 900; win.PointerEvent = class {};
motion.matches = false; win.matchMedia = () => motion;
class Canvas extends Surface {
  style = {}; ownerDocument = doc; width = 800; height = 600; clientWidth = 800; clientHeight = 600; removed = false; attributes = new Map();
  setAttribute(k, v) { this.attributes.set(k, v); }
  getAttribute(k) { return this.attributes.get(k) ?? null; }
  getRootNode() { return doc; }
  getContext() { return context; }
  setPointerCapture() {} releasePointerCapture() {} focus() {}
  remove() { this.removed = true; }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight, right: this.clientWidth, bottom: this.clientHeight }; }
}
doc.createElement = () => new Canvas();
const frames = new Map(); let frameId = 0, time = 0, observer;
// RAF and animation start times use the same deterministic clock.
const originalClockDescriptor = Object.getOwnPropertyDescriptor(performance, 'now');
Object.defineProperty(performance, 'now', { configurable: true, value: () => time });
globalThis.document = doc; globalThis.window = win;
globalThis.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
globalThis.cancelAnimationFrame = id => frames.delete(id);
win.requestAnimationFrame = globalThis.requestAnimationFrame; win.cancelAnimationFrame = globalThis.cancelAnimationFrame;
globalThis.ResizeObserver = class {
  disconnected = false;
  constructor(callback) { this.callback = callback; observer = this; }
  observe() {} disconnect() { this.disconnected = true; }
};
const { createRoom } = await import('../src/room.js');
let engine;
const container = { clientWidth: 800, clientHeight: 600, appendChild(canvas) { this.canvas = canvas; } };
const changes = [], notices = [], stats = [];
const room = createRoom(container, {
  engineFactory(canvas) {
    engine = new NullEngine({ renderWidth: 800, renderHeight: 600, textureSize: 512, deterministicLockstep: true, lockstepMaxSteps: 1 });
    // NullEngine has no DOM or resizing surface; supply just that plumbing.
    engine._renderingCanvas = canvas;
    const setSize = engine.setSize.bind(engine);
    engine.setSize = (w, h, force) => { engine._options.renderWidth = w; engine._options.renderHeight = h; return setSize(w, h, force); };
    return engine;
  },
  onLayoutChange: value => changes.push(structuredClone(value)),
  onNotice: value => notices.push(value),
  onStats: value => stats.push(value),
});
const canvas = container.canvas;
function advance(count = 1) {
  for (let i = 0; i < count && frames.size; i++) {
    assert.equal(frames.size, 1, 'one scheduled animation callback');
    const [id, callback] = frames.entries().next().value; frames.delete(id); time += 1000 / 60; callback(time);
  }
}
const diagnostics = () => room.diagnostics();
try {
  advance(5);
  const { scene, camera } = diagnostics();
  // NullEngine does not compile GPU effect-layer shaders. Simulate completed
  // warmup for render-scheduler checks; browser verification covers readiness.
  scene.isReady = () => true; advance(2);
  assert.equal(camera.mode, Camera.ORTHOGRAPHIC_CAMERA);
  assert.ok(scene.meshes.length > 20);
  assert.equal(canvas.style.touchAction, 'pan-y');
  console.log(`PASS engine: native Babylon scene, orthographic camera, ${scene.meshes.length} meshes, mobile pan-y.`);
  const nativePick = scene.pickWithRay; let hoverPicks = 0;
  scene.pickWithRay = function (...args) { hoverPicks++; return nativePick.apply(this, args); };
  for (let i = 0; i < 40; i++) canvas.emit('pointermove', { clientX: 150 + i, clientY: 180, pointerType: 'mouse' });
  assert.equal(hoverPicks, 0, 'raw pointer events only queue their latest coordinates');
  advance(); assert.equal(hoverPicks, 1, 'hover events coalesce into one pick per rendered frame');
  canvas.emit('pointerdown', { clientX: 200, clientY: 180, pointerType: 'mouse' });
  canvas.emit('pointermove', { clientX: 250, clientY: 180, pointerType: 'mouse' }); advance();
  canvas.emit('pointerup', { clientX: 250, clientY: 180, pointerType: 'mouse' });
  assert.equal(hoverPicks, 1, 'orbit dragging skips hover raycasts');
  room.beginPlacement('plant'); canvas.emit('pointermove', { clientX: 330, clientY: 230, pointerType: 'mouse' }); advance();
  assert.equal(hoverPicks, 1, 'a placement preview only intersects the mathematical floor');
  room.cancelPlacement(); room.setEditMode(false); scene.pickWithRay = nativePick;
  const effects = scene.meshes.filter(mesh => mesh.metadata?.effect && mesh.isEnabled());
  const steam = effects.find(mesh => mesh.metadata.effect === 'tea-steam'), flames = effects.find(mesh => mesh.metadata.effect === 'hearth-flames');
  assert.ok(steam && flames, 'the furnished room contains tea and hearth effects');
  const oldSteam = Array.from(steam.getVerticesData('position')), oldFlames = Array.from(flames.getVerticesData('position')); advance(20);
  assert.notDeepEqual(Array.from(steam.getVerticesData('position')), oldSteam, 'placed cup animation is updated by the room');
  assert.notDeepEqual(Array.from(flames.getVerticesData('position')), oldFlames, 'placed fireplace animation is updated by the room');
  const shadowCasters = scene.getLightByName('window-sun').getShadowGenerator().getShadowMap().renderList;
  const glowMeshes = scene.effectLayers.find(layer => layer.name === 'candlelight-bloom').mainTexture.renderList;
  for (const mesh of effects) if (mesh.metadata.effect === 'tea-steam') { assert.equal(mesh.isPickable, false); assert.ok(!shadowCasters.includes(mesh) && !glowMeshes.includes(mesh)); }
  console.log('PASS animation cost: hover picks coalesce; orbit/placement skip mesh picking; steam stays out of shadows and bloom.');
  const home = { alpha: camera.alpha, beta: camera.beta };
  camera.alpha += 0.2; camera.beta += 0.1; camera.inertialAlphaOffset = 0.1;
  room.resetView(); advance(90);
  assert.ok(Math.abs(camera.alpha - home.alpha) < 1e-8 && Math.abs(camera.beta - home.beta) < 1e-8);
  assert.equal(camera.inertialAlphaOffset, 0);
  console.log('PASS camera: reset clears inertia and keeps the home composition.');
  // Derive bounds from the actual visible assets, so bigger architecture and
  // overhanging decor cannot silently escape the framing check.
  let minimum = new Vector3(Infinity, Infinity, Infinity), maximum = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const mesh of scene.meshes.filter(mesh => mesh.isEnabled() && mesh.getTotalVertices())) {
    mesh.computeWorldMatrix(true);
    const bounds = mesh.getBoundingInfo().boundingBox;
    minimum = Vector3.Minimize(minimum, bounds.minimumWorld); maximum = Vector3.Maximize(maximum, bounds.maximumWorld);
  }
  const corners = [];
  for (const x of [minimum.x, maximum.x]) for (const y of [minimum.y, maximum.y]) for (const z of [minimum.z, maximum.z]) corners.push(new Vector3(x, y, z));
  let largest = 0;
  for (const aspect of [0.45, 0.75, 1, 1.5, 2.5]) {
    container.clientWidth = 600 * aspect; container.clientHeight = 600;
    canvas.clientWidth = container.clientWidth; canvas.clientHeight = 600; observer.callback();
    for (const a of [camera.lowerAlphaLimit, camera.upperAlphaLimit]) for (const b of [camera.lowerBetaLimit, camera.upperBetaLimit]) {
      camera.alpha = a; camera.beta = b; advance(2); scene.render();
      for (const corner of corners) {
        const point = Vector3.TransformCoordinates(corner, camera.getTransformationMatrix());
        largest = Math.max(largest, Math.abs(point.x), Math.abs(point.y));
        assert.ok(Math.abs(point.x) <= 0.95 && Math.abs(point.y) <= 0.95, 'whole room fits every aspect/camera limit');
      }
    }
  }
  room.resetView(); console.log(`PASS framing: five aspects × four camera limits, maximum NDC ${largest.toFixed(3)}.`);
  const desk = createLayout().items.find(item => item.type === 'study-desk');
  room.setLayout({ presetId: null, items: [desk, { id: 'test-plant', type: 'plant', x: 2, z: 0, rotation: 0 }], activeDeskId: desk.id });
  assert.equal(changes.length, 0, 'setLayout must not recursively persist');
  room.setEditMode(true); room.selectItem('test-plant'); room.moveSelection(-0.25, 0);
  assert.equal(changes.at(-1).items.find(item => item.id === 'test-plant').x, 1.75);
  const beforeInvalid = JSON.stringify(diagnostics().layout); room.moveSelection(20, 0);
  assert.equal(JSON.stringify(diagnostics().layout), beforeInvalid); assert.ok(notices.length);
  room.rotateSelection(); assert.equal(changes.at(-1).items.find(item => item.id === 'test-plant').rotation, 1);
  room.removeSelection(); assert.equal(diagnostics().layout.items.length, 1);
  room.selectItem(desk.id); room.removeSelection(); assert.equal(diagnostics().layout.items.length, 1, 'last study station stays');
  function clickFloor(x, z) {
    advance(2); scene.render();
    const pixel = Vector3.Project(new Vector3(x, 0.22, z), Matrix.Identity(), scene.getTransformMatrix(), { x: 0, y: 0, width: canvas.clientWidth, height: canvas.clientHeight });
    const event = { clientX: pixel.x, clientY: pixel.y, pointerId: 1, pointerType: 'mouse', button: 0 };
    canvas.emit('pointerdown', event); canvas.emit('pointerup', event);
  }
  room.beginPlacement('plant'); clickFloor(2, -2);
  assert.equal(diagnostics().layout.items.length, 2, 'clicking the visible floor preview should commit a piece');
  const placed = diagnostics().layout.items.find(item => item.id !== desk.id);
  assert.equal(placed.x, 2); assert.equal(placed.z, -2);
  const placedNode = scene.transformNodes.find(node => node.metadata?.itemId === placed.id);
  const savedAfterPlacement = JSON.stringify(diagnostics().layout);
  assert.equal(placedNode.scaling.x, 0.92, 'a new piece begins its small settling transition');
  advance(12);
  assert.ok(placedNode.scaling.x > 0.92 && placedNode.scaling.x < 1, 'settling should ease toward final size over time');
  assert.equal(JSON.stringify(diagnostics().layout), savedAfterPlacement, 'visual settling must not alter stored coordinates');
  advance(20);
  assert.deepEqual(placedNode.scaling.asArray(), [1, 1, 1], 'settling finishes at exact catalog size');
  room.beginPlacement('plant'); clickFloor(desk.x, desk.z);
  assert.equal(diagnostics().layout.items.length, 2, 'a pointer click on occupied floor must not place furniture');
  room.cancelPlacement(); assert.equal(diagnostics().placement, null);
  console.log('PASS editing: pointer placement/picking, collision rejection, move/rotate/remove, last desk guard and cancellation.');
  const torso = scene.getTransformNodeByName('miso-breathing'), catHead = scene.getTransformNodeByName('miso-head'), catTail = scene.getTransformNodeByName('miso-tail'), heart = scene.getTransformNodeByName('pet-heart');
  const originalBreath = torso.scaling.y; advance(24);
  assert.ok(Math.abs(torso.scaling.y - originalBreath) > 0.001, 'Miso breathes while resting');
  room.pet(); advance(30);
  assert.ok(catHead.position.y > 0.28 && Math.abs(catTail.rotation.y) > 0.01, 'petting lifts Miso’s head and swishes its tail');
  assert.ok(heart.isEnabled(), 'pet feedback remains visible during the reaction');
  advance(75);
  assert.ok(!heart.isEnabled() && Math.abs(catHead.position.y - 0.26) < 0.012, 'pet reaction returns to the resting pose');
  room.beginPlacement('side-table'); clickFloor(3, 0);
  const pendingSettle = diagnostics().layout.items.find(item => item.type === 'side-table');
  const pendingNode = scene.transformNodes.find(node => node.metadata?.itemId === pendingSettle.id);
  assert.ok(pendingNode.scaling.x < 1);
  motion.matches = true; motion.emit('change', { matches: true }); advance(2);
  assert.deepEqual(pendingNode.scaling.asArray(), [1, 1, 1], 'reduced motion immediately completes settling');
  assert.deepEqual(torso.scaling.asArray(), [1, 1, 1]);
  assert.equal(catHead.position.y, 0.26); assert.equal(catTail.rotation.y, 0);
  room.selectItem(pendingSettle.id); room.removeSelection();
  console.log('PASS animations: timed settling preserves saved layout; pet reaction ends; reduced motion restores neutral poses.');
  room.setEditMode(false); room.setTheme('rain'); motion.matches = true; motion.emit('change', { matches: true }); advance(10);
  const snapshot = () => scene.transformNodes.concat(scene.meshes).map(n => [...n.position.asArray(), ...n.rotation.asArray(), ...n.scaling.asArray()]);
  const still = snapshot(); advance(120); assert.deepEqual(snapshot(), still);
  assert.equal(frames.size, 0, 'a ready reduced-motion scene stops requesting frames');
  room.setFocused(false); advance(3); assert.equal(frames.size, 0, 'one reduced-motion state change renders and returns to idle');
  console.log('PASS reduced motion: transforms stay still.');
  // Deliberately idle on-demand frames are not evidence of a slow renderer.
  // Hold CPU time still here so this isolates the FPS adaptation rule.
  const clockDescriptor = Object.getOwnPropertyDescriptor(performance, 'now');
  Object.defineProperty(performance, 'now', { configurable: true, value: () => time });
  try {
    room.setQuality('auto'); time += 2100; advance();
    const idleRatio = diagnostics().pixelRatio;
    for (let i = 0; i < 6; i++) { time += 2100; room.setFocused(Boolean(i % 2)); advance(); }
    assert.equal(diagnostics().pixelRatio, idleRatio, 'reduced-motion idle gaps must not lower pixel ratio');
    // A real gap during continuous animation must remain in the frame metric.
    motion.matches = false; motion.emit('change', { matches: false }); stats.length = 0;
    time += 750; advance(); time += 750; advance();
    assert.ok(stats.at(-1)?.p95FrameMs >= 750, 'visible frame stalls must not be filtered out of p95');
  } finally {
    if (clockDescriptor) Object.defineProperty(performance, 'now', clockDescriptor);
    else delete performance.now;
  }
  console.log('PASS adaptive quality: intentional idle keeps resolution; visible stalls remain in frame metrics.');
  doc.hidden = true; doc.emit('visibilitychange'); assert.equal(frames.size, 0);
  doc.hidden = false; doc.emit('visibilitychange'); assert.ok(frames.size <= 1);
  room.dispose(); assert.equal(frames.size, 0); assert.equal(motion.listenerCount, 0); assert.equal(doc.listenerCount, 0); assert.equal(canvas.listenerCount, 0);
  assert.ok(observer.disconnected && canvas.removed && scene.isDisposed);
  console.log('PASS lifecycle: hidden suspension; scene, frames, observers and listeners disposed.');
  console.log('Babylon room checks passed. GPU appearance and native gestures require browser checks.');
} catch (error) { room.dispose(); throw error; }
finally { if (originalClockDescriptor) Object.defineProperty(performance, 'now', originalClockDescriptor); else delete performance.now; }
