// Run with Node 22.15+ (or 23.5+) from any directory:
//   node scripts/verify-room.mjs
// This imports the production room unchanged. Only WebGLRenderer is replaced;
// geometry, cameras, raycasting and OrbitControls use the installed Three.js.
// DOM stubs exercise the logic, not browser/GPU drawing or native touch scrolling.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from 'three';

class EventSurface {
  listeners = new Map();
  addEventListener(name, listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(listener);
  }
  removeEventListener(name, listener) { this.listeners.get(name)?.delete(listener); }
  emit(name, event = {}) {
    for (const listener of [...(this.listeners.get(name) || [])]) listener({ type: name, ...event });
  }
  get listenerCount() { return [...this.listeners.values()].reduce((total, set) => total + set.size, 0); }
}

const drawingContext = new Proxy({}, {
  get: (_, key) => key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {},
});
const documentSurface = new EventSurface();
documentSurface.hidden = false;
documentSurface.createElement = () => new CanvasSurface();

class CanvasSurface extends EventSurface {
  style = {};
  ownerDocument = documentSurface;
  clientWidth = 800;
  clientHeight = 600;
  removed = false;
  setAttribute() {}
  getRootNode() { return this.ownerDocument; }
  getContext() { return drawingContext; }
  setPointerCapture() {}
  releasePointerCapture() {}
  remove() { this.removed = true; }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; }
}

const frameCallbacks = new Map();
let nextFrame = 0;
let now = 0;
let observer;
let renderer;
const motionPreference = new EventSurface();
motionPreference.matches = false;

globalThis.document = documentSurface;
globalThis.window = { devicePixelRatio: 2, matchMedia: () => motionPreference };
globalThis.requestAnimationFrame = callback => { frameCallbacks.set(++nextFrame, callback); return nextFrame; };
globalThis.cancelAnimationFrame = id => frameCallbacks.delete(id);
globalThis.ResizeObserver = class {
  disconnected = false;
  constructor(callback) { this.callback = callback; observer = this; }
  observe() {}
  disconnect() { this.disconnected = true; }
};

class RendererStub {
  domElement = new CanvasSurface();
  shadowMap = {};
  disposed = false;
  renderCount = 0;
  constructor() { renderer = this; }
  setPixelRatio(value) { this.pixelRatio = value; }
  setClearColor() {}
  setSize(width, height) { this.domElement.clientWidth = width; this.domElement.clientHeight = height; }
  render(scene, camera) {
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    this.scene = scene;
    this.camera = camera;
    this.renderCount++;
  }
  dispose() { this.disposed = true; }
}

// Intercept only room.js's Three import. Addon modules use the real package.
const roomUrl = new URL('../src/room.js', import.meta.url).href;
const realThreeUrl = import.meta.resolve('three');
const shimUrl = 'little-hours-test:renderer-shim';
globalThis.__littleHoursRendererStub = RendererStub;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'three' && context.parentURL === roomUrl) return { url: shimUrl, shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === shimUrl) return {
      format: 'module', shortCircuit: true,
      source: `export * from ${JSON.stringify(realThreeUrl)}; export const WebGLRenderer = globalThis.__littleHoursRendererStub;`,
    };
    return nextLoad(url, context);
  },
});
let createRoom;
try { ({ createRoom } = await import(roomUrl)); }
finally { hooks.deregister(); delete globalThis.__littleHoursRendererStub; }

const container = { clientWidth: 800, clientHeight: 600, appendChild(canvas) { this.canvas = canvas; } };
const room = createRoom(container);
const canvas = container.canvas;
const home = renderer.camera.position.clone();

function advance(count = 1) {
  for (let i = 0; i < count; i++) {
    assert.equal(frameCallbacks.size, 1, 'exactly one animation loop should be scheduled');
    const [id, callback] = frameCallbacks.entries().next().value;
    frameCallbacks.delete(id);
    now += 100;
    callback(now);
  }
}

function drag(dx, dy, pointerType = 'mouse') {
  const event = (x, y) => ({
    pointerId: 1, pointerType, button: 0, clientX: x, clientY: y, pageX: x, pageY: y,
    preventDefault() {}, ctrlKey: false, metaKey: false, shiftKey: false,
  });
  canvas.emit('pointerdown', event(200, 160));
  documentSurface.emit('pointermove', event(200 + dx, 160 + dy));
  canvas.emit('pointerup', event(200 + dx, 160 + dy));
  documentSurface.emit('pointerup', event(200 + dx, 160 + dy));
}

function assertHome() {
  assert.ok(renderer.camera.position.distanceTo(home) < 1e-10, 'reset must land exactly at home with no residual velocity');
}

try {
  assert.equal(canvas.style.touchAction, 'pan-y');
  assert.ok(renderer.pixelRatio <= 1.5);
  drag(120, 0, 'touch');
  advance(2);
  assert.ok(renderer.camera.position.distanceTo(home) > 0.1, 'horizontal touch input must still rotate the room');
  room.resetView();
  console.log('PASS mobile input: pan-y survives OrbitControls setup; actual touch events still rotate.');

  drag(120, 80);
  room.resetView();
  assertHome();
  advance(90);
  assertHome();
  console.log('PASS reset: home remains exact after mouse-drag inertia and 90 subsequent frames.');

  // Test actual generated geometry bounds, rather than duplicating fitRoom().
  const bounds = new THREE.Box3().setFromObject(renderer.scene);
  const corners = [];
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) corners.push(new THREE.Vector3(x, y, z));
  let furthest = 0;
  for (const aspect of [0.45, 0.75, 1, 1.5, 2.5]) {
    container.clientWidth = 600 * aspect;
    observer.callback();
    for (const horizontal of [-1, 1]) for (const vertical of [-1, 1]) {
      room.resetView();
      drag(horizontal * 10000, vertical * 10000);
      advance(2);
      for (const corner of corners) {
        const projected = corner.clone().project(renderer.camera);
        furthest = Math.max(furthest, Math.abs(projected.x), Math.abs(projected.y));
        assert.ok(Math.abs(projected.x) <= 0.880001 && Math.abs(projected.y) <= 0.880001, 'whole room must retain 6% margins at every aspect/orbit extreme');
      }
    }
  }
  console.log(`PASS framing: real geometry stays within 6% margins at five aspects × four orbit extrema (maximum NDC ${furthest.toFixed(4)}).`);

  room.resetView();
  room.setTheme('rain');
  let rain;
  renderer.scene.traverse(object => { if (object.isLineSegments) rain = object; });
  assert.ok(rain?.visible, 'rain theme must show its streak geometry');
  assert.ok(rain.geometry.boundingSphere, 'dynamic rain must have explicit bounds before rendering');
  for (let frame = 0; frame < 120; frame++) {
    advance();
    const positions = rain.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) assert.ok(rain.geometry.boundingSphere.containsPoint(new THREE.Vector3().fromBufferAttribute(positions, i)), 'rain vertices must stay inside their culling bounds');
  }
  console.log('PASS rain: all animated vertices stay inside explicit bounds across 120 frames.');

  motionPreference.matches = true;
  motionPreference.emit('change', { matches: true });
  advance();
  const stillRain = Array.from(rain.geometry.attributes.position.array);
  const transformSnapshot = () => {
    const result = [];
    renderer.scene.traverse(object => result.push([...object.position, ...object.quaternion, ...object.scale]));
    return result;
  };
  const stillScene = transformSnapshot();
  advance(30);
  assert.deepEqual(Array.from(rain.geometry.attributes.position.array), stillRain);
  assert.deepEqual(transformSnapshot(), stillScene);
  console.log('PASS reduced motion: ambient scene transforms and rain remain still.');

  documentSurface.hidden = true;
  documentSurface.emit('visibilitychange');
  assert.equal(frameCallbacks.size, 0);
  documentSurface.hidden = false;
  documentSurface.emit('visibilitychange');
  assert.equal(frameCallbacks.size, 1);
  advance();
  room.dispose();
  assert.equal(frameCallbacks.size, 0);
  assert.equal(documentSurface.listenerCount, 0);
  assert.equal(motionPreference.listenerCount, 0);
  assert.equal(canvas.listenerCount, 0);
  assert.ok(observer.disconnected && renderer.disposed && canvas.removed);
  console.log('PASS lifecycle: hide suspends; show creates one loop; dispose removes frame, observers, listeners and canvas.');
  console.log('Room verification passed. GPU appearance and native scrolling still require browser checks.');
} catch (error) {
  room.dispose();
  throw error;
}
