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
  capturedPointer = null;
  setPointerCapture(id) { this.capturedPointer = id; }
  releasePointerCapture(id) { if (this.capturedPointer === id) this.capturedPointer = null; }
  focus() {}
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
const changes = [], notices = [], stats = [], dragStates = [];
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
  isCollectionDrop: (x, y) => x >= 0 && x <= canvas.clientWidth && y > canvas.clientHeight && y < canvas.clientHeight + 200,
  onDragState: value => dragStates.push(value),
});
const canvas = container.canvas;
const particleNames = ['floating-fireflies', 'window-drifting-stars'];
// Babylon drops its public buffer CPU reference after a direct upload. Retain
// the original arrays now, so later assertions check the same live buffers.
const particleBuffers = particleNames.map(name => room.diagnostics().scene.getMeshByName(name).getVertexBuffer('world0').getData());
const particleRestMatrices = particleBuffers.map(buffer => Array.from(buffer));
const restingMothPositions = Array.from(room.diagnostics().scene.getMeshByName('window-moths').getVerticesData('position'));
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
  const catMeshes = scene.meshes.filter(mesh => mesh.metadata?.cat);
  assert.ok(catMeshes.length > 0);
  for (const mesh of catMeshes) {
    assert.equal(mesh.receiveShadows, false, 'moving cat fur must not sample a stale cached shadow pose');
    assert.ok(shadowCasters.includes(mesh), 'the cat still casts its grounding shadow onto the floor');
  }
  console.log('PASS animation cost: hover picks coalesce; orbit/placement skip mesh picking; steam stays out of shadows and bloom.');
  const particles = particleNames.map(name => scene.getMeshByName(name));
  assert.deepEqual(particles.map(mesh => mesh.thinInstanceCount), [48, 20], 'ambient particles stay in two instanced batches');
  const beforeParticleDrift = particleBuffers.map(buffer => Array.from(buffer)); advance(30);
  for (let i = 0; i < particles.length; i++) {
    const mesh = particles[i];
    assert.notDeepEqual(Array.from(particleBuffers[i]), beforeParticleDrift[i], 'particles drift using their original persistent buffers');
    assert.equal(mesh.isPickable, false); assert.equal(mesh.receiveShadows, false);
    assert.ok(!shadowCasters.includes(mesh) && glowMeshes.includes(mesh), 'dust glows without casting shadows or blocking the editor');
  }
  const starPositions = particleBuffers[1];
  for (let i = 0; i < 20; i++) {
    const offset = i * 16, x = starPositions[offset + 12], y = starPositions[offset + 13], z = starPositions[offset + 14], extent = starPositions[offset] * 0.06;
    assert.ok(y - extent > 3.15 && (Math.abs(x + 2.7) + extent) ** 2 + (y - 3.15 + extent) ** 2 < 2.1 ** 2, 'star corners stay inside the upper window arch');
    assert.ok(z > -4.64 && z < -4.43, 'stars sit in front of the artwork and behind the window frame');
  }
  console.log(`PASS particles: 48 fireflies + 20 window stars, two batches, ${particles.reduce((sum, mesh) => sum + mesh.getTotalIndices() / 3 * mesh.thinInstanceCount, 0)} instanced triangles, reusable buffers and window confinement.`);
  assert.notEqual(particleBuffers[0][0], beforeParticleDrift[0][0], 'motes gently twinkle through their existing matrix scale');
  const moths = scene.getMeshByName('window-moths'), shootingStar = scene.getMeshByName('window-shooting-star');
  assert.equal(moths.metadata.count, 3); assert.ok(moths.getTotalIndices() / 3 <= 40, 'three fluttering moths share a small mesh');
  const mothBuffer = moths.getVerticesData('position'), mothBefore = Array.from(mothBuffer); advance(17);
  assert.equal(moths.getVerticesData('position'), mothBuffer, 'moth flight reuses its original position buffer');
  assert.notDeepEqual(Array.from(mothBuffer), mothBefore, 'moths move along their calm flight paths');
  const spanBefore = Math.abs(mothBefore[6] - mothBefore[24]), spanAfter = Math.abs(mothBuffer[6] - mothBuffer[24]);
  assert.ok(Math.abs(spanBefore - spanAfter) > 0.005, 'wing span changes independently of translation during flutter');
  for (const mesh of [moths, shootingStar]) {
    assert.equal(mesh.isPickable, false); assert.equal(mesh.receiveShadows, false);
    assert.ok(!shadowCasters.includes(mesh) && glowMeshes.includes(mesh), 'window motion retains glow membership without cached shadows');
  }
  const meteor = shootingStar.metadata, nextMeteorStart = (Math.ceil(Math.max(0, (time / 1000 - meteor.delaySeconds) / meteor.periodSeconds)) * meteor.periodSeconds + meteor.delaySeconds) * 1000;
  time = nextMeteorStart + 400 - 1000 / 60; advance();
  assert.ok(shootingStar.isEnabled() && shootingStar.material.alpha > 0.5, 'the short shooting star becomes visible at its scheduled time');
  const firstMeteorX = shootingStar.position.x; advance(30);
  assert.ok(shootingStar.position.x > firstMeteorX && shootingStar.isEnabled(), 'the shooting star travels across the sky');
  for (let i = 0; i < shootingStar.getVerticesData('position').length; i += 3) {
    const points = shootingStar.getVerticesData('position'), x = points[i] + shootingStar.position.x, y = points[i + 1] + shootingStar.position.y;
    assert.ok(y > 3.15 && (x + 2.7) ** 2 + (y - 3.15) ** 2 < 2.1 ** 2, 'the entire short streak remains within the upper window arch');
  }
  assert.ok(shootingStar.position.z > -4.64 && shootingStar.position.z < -4.43);
  time = nextMeteorStart + meteor.durationSeconds * 1000 + 100 - 1000 / 60; advance();
  assert.equal(shootingStar.isEnabled(), false); assert.equal(shootingStar.material.alpha, 0);
  time = nextMeteorStart + meteor.periodSeconds * 1000 + 300 - 1000 / 60; advance();
  assert.equal(shootingStar.isEnabled(), true, 'the occasional shooting star returns on its next cycle');
  console.log('PASS lively ambience: motes twinkle, three moths flap in one 36-triangle mesh, and a 2-triangle shooting star follows its bounded timing.');
  const embers = effects.find(mesh => mesh.metadata.effect === 'hearth-embers');
  assert.ok(embers, 'the furnished room contains hearth embers');
  motion.matches = true; motion.emit('change', { matches: true }); advance(3);
  assert.equal(embers.isEnabled(), false, 'reduced motion hides embers');
  assert.equal(moths.isEnabled(), false); assert.equal(shootingStar.isEnabled(), false);
  assert.deepEqual(Array.from(mothBuffer), restingMothPositions, 'reduced motion resets hidden moth geometry exactly');
  assert.deepEqual(shootingStar.position.asArray(), [-3.52, 4.63, -4.57]); assert.equal(shootingStar.material.alpha, 0);
  assert.equal(scene.getLightByName('hearth-lamplight').intensity, 1, 'reduced motion restores steady hearth light');
  room.setDecor('lights', false); advance(3);
  assert.ok(scene.effectLayers.find(layer => layer.name === 'candlelight-bloom').mainTexture.renderList.includes(embers), 'temporary motion suppression does not remove a live emitter from the glow list');
  assert.ok(scene.effectLayers.find(layer => layer.name === 'candlelight-bloom').mainTexture.renderList.includes(shootingStar), 'hidden shooting stars also retain bloom membership after decoration edits');
  motion.matches = false; motion.emit('change', { matches: false }); advance(3);
  assert.ok(embers.isEnabled(), 'embers return when motion resumes');
  assert.ok(scene.effectLayers.find(layer => layer.name === 'candlelight-bloom').mainTexture.renderList.includes(embers), 'resumed embers retain their glow after decoration edits');
  room.setDecor('lights', true); advance(2);
  console.log('PASS glow lifecycle: hidden motion effects retain glow membership across decoration changes.');
  const lanterns = scene.transformNodes.filter(node => node.name.startsWith('swaying-lantern-'));
  assert.equal(lanterns.length, 3);
  for (const lantern of lanterns) assert.equal(lantern.getChildMeshes().length, 2, 'each moving lantern stays within two meshes');
  const mounts = lanterns.map(lantern => lantern.getAbsolutePosition().asArray());
  const lampAngles = lanterns.map(lantern => lantern.rotation.z);
  const secondHand = scene.getTransformNodeByName('clock-second-hand'), pendulum = scene.getTransformNodeByName('clock-pendulum');
  const secondAngle = secondHand.rotation.z, pendulumAngle = pendulum.rotation.z;
  advance(75);
  assert.ok(lanterns.some((lantern, i) => Math.abs(lantern.rotation.z - lampAngles[i]) > 0.01), 'lanterns visibly sway over time');
  assert.deepEqual(lanterns.map(lantern => lantern.getAbsolutePosition().asArray()), mounts, 'lantern mounting points remain fixed');
  assert.notEqual(secondHand.rotation.z, secondAngle, 'the wall clock ticks once per second');
  assert.ok(Math.abs(pendulum.rotation.z - pendulumAngle) > 0.01, 'the clock pendulum swings');
  console.log('PASS decorative motion: fixed lantern mounts, two meshes per lantern, ticking clock and swinging pendulum.');
  // Switch time of day through the real runtime, including a glow-list rebuild
  // while stars are hidden. Switching must not allocate another scene or layout.
  const lightingMeshCount = scene.meshes.length, lightingMaterialCount = scene.materials.length;
  const timeOfDayLayout = JSON.stringify(diagnostics().layout);
  const keyLight = scene.getLightByName('window-sun'), ambientLight = scene.getLightByName('warm-ambient');
  const nightKeyIntensity = keyLight.intensity, nightAmbientIntensity = ambientLight.intensity;
  const stars = scene.getMeshByName('window-drifting-stars'), rainMesh = scene.getMeshByName('window-rain');
  room.setTheme('day'); advance(3);
  assert.ok(keyLight.intensity > nightKeyIntensity * 2 && ambientLight.intensity > nightAmbientIntensity * 2, 'daylight brightens real scene lighting');
  assert.ok(keyLight.direction.z > 0, 'daylight enters from the window side');
  assert.equal(stars.isEnabled(), false); assert.equal(shootingStar.isEnabled(), false); assert.equal(rainMesh.isEnabled(), false);
  room.setDecor('lights', false); advance(2);
  assert.ok(scene.effectLayers.find(layer => layer.name === 'candlelight-bloom').mainTexture.renderList.includes(stars), 'editing daylight keeps night stars in the cached glow list');
  const daylightMeteorStart = (Math.ceil(Math.max(0, (time / 1000 - meteor.delaySeconds) / meteor.periodSeconds)) * meteor.periodSeconds + meteor.delaySeconds) * 1000;
  time = daylightMeteorStart + 400; advance();
  assert.equal(shootingStar.isEnabled(), false, 'scheduled shooting stars stay hidden in daylight');
  room.setTheme('rain'); advance(2);
  assert.equal(rainMesh.isEnabled(), true); assert.equal(stars.isEnabled(), false); assert.equal(shootingStar.isEnabled(), false);
  room.setTheme('dusk'); advance(2);
  assert.equal(stars.isEnabled(), true); assert.equal(shootingStar.isEnabled(), true); assert.equal(rainMesh.isEnabled(), false);
  assert.equal(scene.getTransformNodeByName('fairy-lights').isEnabled(), false, 'changing time of day preserves the fairy-light preference');
  room.setDecor('lights', true); advance(2);
  assert.equal(keyLight.intensity, nightKeyIntensity); assert.equal(ambientLight.intensity, nightAmbientIntensity);
  assert.equal(keyLight.getShadowGenerator().getShadowMap().refreshRate, 0, 'lighting changes retain the cached shadow-map policy');
  assert.equal(scene.meshes.length, lightingMeshCount); assert.equal(scene.materials.length, lightingMaterialCount);
  assert.equal(JSON.stringify(diagnostics().layout), timeOfDayLayout, 'changing lighting preserves furniture and the active desk');
  console.log('PASS time of day: distinct daylight/night lighting, night-only stars, rain, saved decor, retained glow and no extra meshes.');
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
    for (const a of [camera.lowerAlphaLimit, home.alpha, camera.upperAlphaLimit]) for (const b of [camera.lowerBetaLimit, home.beta, camera.upperBetaLimit]) {
      camera.alpha = a; camera.beta = b; advance(2); scene.render();
      for (const corner of corners) {
        const point = Vector3.TransformCoordinates(corner, camera.getTransformationMatrix());
        largest = Math.max(largest, Math.abs(point.x), Math.abs(point.y));
        assert.ok(Math.abs(point.x) <= 0.95 && Math.abs(point.y) <= 0.95, 'whole room fits every aspect/camera limit');
      }
    }
  }
  room.resetView(); console.log(`PASS framing: five aspects × nine camera angles, maximum NDC ${largest.toFixed(3)}.`);
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
  const layoutBeforeDragChecks = structuredClone(diagnostics().layout);
  const dragPlant = { id: 'drag-plant', type: 'plant', x: 2, z: 0, rotation: 0 };
  const dragLayout = { presetId: null, items: [desk, dragPlant], activeDeskId: desk.id };
  function pointerAt(x, y, z) {
    advance(2); scene.render();
    const pixel = Vector3.Project(new Vector3(x, y, z), Matrix.Identity(), scene.getTransformMatrix(), { x: 0, y: 0, width: canvas.clientWidth, height: canvas.clientHeight });
    return { clientX: pixel.x, clientY: pixel.y, pointerId: 7, pointerType: 'mouse', button: 0 };
  }
  function beginPlantDrag(x = 3, z = 0) {
    const source = pointerAt(2, .45, 0), target = pointerAt(x, .45, z);
    canvas.emit('pointerdown', source); canvas.emit('pointermove', target); advance(2);
    assert.equal(diagnostics().dragging?.id, dragPlant.id);
    return target;
  }
  room.setLayout(dragLayout); room.selectItem(null);
  const dragNode = scene.transformNodes.find(node => node.metadata?.itemId === dragPlant.id);
  // The baked floor shade travels with the piece but is never outlined or picked.
  const plantMeshes = dragNode.getChildMeshes().filter(mesh => mesh.metadata?.effect !== 'contact-shadow'), originalMaterials = plantMeshes.map(mesh => mesh.material);
  canvas.emit('pointermove', pointerAt(2, .45, 0)); advance(2);
  assert.equal(diagnostics().hoveredId, dragPlant.id);
  assert.ok(plantMeshes.every(mesh => mesh.renderOutline), 'outline covers pot and animated foliage');
  assert.ok(scene.meshes.filter(mesh => mesh.renderOutline).every(mesh => plantMeshes.includes(mesh)), 'only hovered furniture is outlined');
  canvas.emit('pointerleave'); assert.equal(diagnostics().hoveredId, null);
  assert.ok(plantMeshes.every(mesh => !mesh.renderOutline));
  const originalDragLayout = JSON.stringify(diagnostics().layout), writesBeforeDrag = changes.length;
  const movedPointer = beginPlantDrag();
  assert.equal(canvas.capturedPointer, 7, 'capture keeps the gesture alive outside the canvas');
  assert.equal(canvas.style.touchAction, 'none', 'touch drags do not scroll the page');
  assert.equal(dragNode.position.x, 3);
  assert.equal(JSON.stringify(diagnostics().layout), originalDragLayout, 'preview never edits the saved layout');
  assert.equal(changes.length, writesBeforeDrag, 'no persistence while dragging');
  assert.ok(plantMeshes.every(mesh => !scene.getLightByName('window-sun').getShadowGenerator().getShadowMap().renderList.includes(mesh)), 'moving furniture leaves the cached shadow map');
  const meshCountDuringDrag = scene.meshes.length, materialCountDuringDrag = scene.materials.length;
  hoverPicks = 0; scene.pickWithRay = function (...args) { hoverPicks++; return nativePick.apply(this, args); };
  for (let i = 0; i < 30; i++) { canvas.emit('pointermove', movedPointer); advance(); }
  scene.pickWithRay = nativePick;
  assert.equal(hoverPicks, 0, 'dragging uses floor math, without mesh raycasts');
  assert.equal(scene.meshes.length, meshCountDuringDrag); assert.equal(scene.materials.length, materialCountDuringDrag);
  assert.deepEqual(plantMeshes.map(mesh => mesh.material), originalMaterials, 'outline and preview leave shared materials untouched');
  canvas.emit('pointerup', movedPointer);
  assert.equal(diagnostics().layout.items.find(item => item.id === dragPlant.id).x, 3);
  assert.equal(changes.length, writesBeforeDrag + 1, 'a complete drag is exactly one undoable edit');
  assert.equal(canvas.capturedPointer, null); assert.equal(diagnostics().dragging, null);
  room.setLayout(dragLayout);
  const invalidPointer = beginPlantDrag(desk.x, desk.z);
  assert.equal(diagnostics().dragging.valid, false);
  canvas.emit('pointerup', invalidPointer);
  assert.equal(JSON.stringify(diagnostics().layout), originalDragLayout, 'occupied drops snap back');
  assert.equal(dragNode.position.x, 2); assert.equal(dragNode.position.z, 0);
  const trayPointer = { clientX: 80, clientY: canvas.clientHeight + 50, pointerId: 7, pointerType: 'mouse' };
  beginPlantDrag(); canvas.emit('pointermove', trayPointer); advance(2);
  assert.equal(dragStates.at(-1).overCollection, true);
  assert.ok(plantMeshes.every(mesh => mesh.visibility === .13 && !mesh.renderOutline), 'return preview fades without transparent GPU outlines');
  room.cancelDrag(); assert.equal(dragStates.at(-1), null);
  assert.ok(plantMeshes.every(mesh => mesh.visibility === 1)); assert.equal(dragNode.position.x, 2);
  assert.ok(plantMeshes.filter(mesh => !mesh.metadata?.effect).every(mesh => scene.getLightByName('window-sun').getShadowGenerator().getShadowMap().renderList.includes(mesh)), 'cancel restores cached shadow casters');
  for (const cancelEvent of ['pointercancel', 'lostpointercapture', 'blur']) {
    beginPlantDrag(); (cancelEvent === 'blur' ? win : canvas).emit(cancelEvent, { pointerId: 7 });
    assert.equal(diagnostics().dragging, null); assert.equal(dragNode.position.x, 2);
  }
  beginPlantDrag(); room.rotateSelection();
  assert.equal(diagnostics().dragging.candidate.rotation, 1);
  canvas.emit('pointerup', { ...movedPointer, clientX: -20 });
  assert.equal(dragNode.rotation.y, 0, 'out-of-canvas drops also restore preview rotation');
  motion.matches = true; motion.emit('change', { matches: true }); advance(3);
  const touchSource = { ...pointerAt(2, .45, 0), pointerType: 'touch' };
  canvas.emit('pointerdown', touchSource); canvas.emit('pointermove', { ...movedPointer, pointerType: 'touch' }); advance(2);
  assert.equal(dragNode.position.x, 3, 'touch dragging remains responsive with reduced motion');
  canvas.emit('pointercancel', { pointerId: 99 });
  assert.equal(diagnostics().dragging.id, dragPlant.id, 'another touch cannot cancel the active drag');
  room.cancelDrag(); advance(4); assert.equal(frames.size, 0, 'cancel returns reduced motion to idle');
  motion.matches = false; motion.emit('change', { matches: false });
  beginPlantDrag(); room.setLayout(dragLayout); assert.equal(diagnostics().dragging, null);
  beginPlantDrag(); doc.hidden = true; doc.emit('visibilitychange');
  assert.equal(diagnostics().dragging, null); assert.equal(frames.size, 0);
  doc.hidden = false; doc.emit('visibilitychange');
  beginPlantDrag(); room.setEditMode(false); assert.equal(diagnostics().dragging, null);
  assert.equal(canvas.style.touchAction, 'pan-y'); assert.ok(plantMeshes.every(mesh => !mesh.renderOutline));
  room.setEditMode(true);
  beginPlantDrag(); canvas.emit('pointerup', trayPointer);
  assert.equal(diagnostics().layout.items.length, 1); assert.equal(dragStates.at(-1), null);
  assert.equal(changes.length, writesBeforeDrag + 2, 'cancelled drags do not overwrite Undo');
  const deskPointer = pointerAt(desk.x, 1.8, desk.z);
  canvas.emit('pointerdown', deskPointer); canvas.emit('pointermove', trayPointer); advance(2);
  assert.equal(diagnostics().dragging?.id, desk.id); assert.equal(dragStates.at(-1).removable, false);
  canvas.emit('pointerup', trayPointer);
  assert.equal(diagnostics().layout.items.length, 1, 'last study desk cannot be returned');
  assert.equal(changes.length, writesBeforeDrag + 2);
  room.setLayout(layoutBeforeDragChecks); room.selectItem(null);
  console.log('PASS drag editor: hover outlines, captured gestures, one-save drops, invalid snapback, faded returns, last desk guard, cancellation and no per-frame meshes/materials/picks.');
  const torso = scene.getTransformNodeByName('miso-breathing'), catHead = scene.getTransformNodeByName('miso-head'), catTail = scene.getTransformNodeByName('miso-tail'), catTailTip = scene.getTransformNodeByName('miso-tail-tip'), catPaw = scene.getMeshByName('miso-resting-paw'), heart = scene.getTransformNodeByName('pet-heart');
  const headPosition = catHead.getAbsolutePosition().asArray(), pawPosition = catPaw.getAbsolutePosition().asArray(), tailPosition = catTail.getAbsolutePosition().asArray();
  let smallestBreath = Infinity, largestBreath = -Infinity;
  for (let i = 0; i < 300; i++) {
    advance(); smallestBreath = Math.min(smallestBreath, torso.scaling.y); largestBreath = Math.max(largestBreath, torso.scaling.y);
    assert.deepEqual(catHead.getAbsolutePosition().asArray(), headPosition, 'sleeping head stays grounded instead of bobbing');
    assert.deepEqual(catHead.rotation.asArray(), [0, 0, 0], 'resting head never rocks repetitively');
    assert.deepEqual(catPaw.getAbsolutePosition().asArray(), pawPosition, 'paws stay planted while the flank breathes');
    assert.deepEqual(catTail.getAbsolutePosition().asArray(), tailPosition);
    assert.deepEqual(catTail.rotation.asArray(), [0, 0, 0], 'the curled tail base never wags');
    assert.ok(Math.abs(-0.03 * torso.scaling.y + torso.position.y + 0.03) < 1e-10, 'breathing anchors the lower torso');
    assert.ok(Math.abs(catTailTip.rotation.y) <= 0.111, 'tail movement stays confined to a small tip flex');
  }
  assert.ok(largestBreath - smallestBreath > 0.07, 'Miso has a visible inhale and exhale across a full breath');
  assert.ok(smallestBreath >= 1 && largestBreath <= 1.076, 'breathing stays within the authored flank expansion');
  room.pet(); advance(30);
  assert.deepEqual(catHead.getAbsolutePosition().asArray(), headPosition, 'petting does not lift the head');
  assert.deepEqual(catPaw.getAbsolutePosition().asArray(), pawPosition, 'petting keeps paws planted');
  assert.deepEqual(catTail.rotation.asArray(), [0, 0, 0]);
  assert.ok(Math.abs(catHead.rotation.z) < 0.026 && catTailTip.rotation.y > 0, 'pet response is a restrained lean and tail-tip flex');
  assert.ok(heart.isEnabled(), 'pet feedback remains visible during the reaction');
  advance(75);
  assert.ok(!heart.isEnabled(), 'pet feedback ends');
  assert.deepEqual(catHead.rotation.asArray(), [0, 0, 0], 'pet reaction returns exactly to the resting head pose');
  room.beginPlacement('side-table'); clickFloor(3, 0);
  const pendingSettle = diagnostics().layout.items.find(item => item.type === 'side-table');
  const pendingNode = scene.transformNodes.find(node => node.metadata?.itemId === pendingSettle.id);
  assert.ok(pendingNode.scaling.x < 1);
  motion.matches = true; motion.emit('change', { matches: true }); advance(2);
  assert.deepEqual(pendingNode.scaling.asArray(), [1, 1, 1], 'reduced motion immediately completes settling');
  assert.deepEqual(torso.scaling.asArray(), [1, 1, 1]);
  assert.equal(torso.position.y, 0); assert.equal(catHead.position.y, 0.26); assert.equal(catTail.rotation.y, 0); assert.equal(catTailTip.rotation.y, 0);
  assert.deepEqual(catHead.rotation.asArray(), [0, 0, 0]);
  assert.deepEqual(scene.getMeshByName('miso-ear-left').rotation.asArray(), [0.12, 0.15, 0.16]);
  assert.deepEqual(scene.getMeshByName('miso-ear-right').rotation.asArray(), [0.12, -0.15, -0.16]);
  assert.deepEqual(particleBuffers.map(buffer => Array.from(buffer)), particleRestMatrices, 'reduced motion restores every particle to its exact authored position');
  assert.equal(moths.isEnabled(), false); assert.equal(shootingStar.isEnabled(), false);
  assert.deepEqual(Array.from(mothBuffer), restingMothPositions);
  room.selectItem(pendingSettle.id); room.removeSelection();
  console.log('PASS animations: timed settling preserves saved layout; pet reaction ends; reduced motion restores neutral poses.');
  const savedRoutineLayout = diagnostics().layout;
  motion.matches = false; motion.emit('change', { matches: false });
  room.setEditMode(false); room.setLayout(createLayout('writers-loft')); room.setActivity('working'); advance(3);
  const roaming = scene.getTransformNodeByName('Walking companion'), contactShadow = scene.getMeshByName('companion-contact-shadow');
  const visibleCompanions = () => scene.transformNodes.filter(node => (node.name === 'Study companion' || node === roaming) && node.isEnabled()).length;
  assert.equal(visibleCompanions(), 1); assert.equal(roaming.isEnabled(), false);
  const routineMeshes = scene.meshes.length, routineMaterials = scene.materials.length;
  room.setActivity('break'); advance(120);
  assert.equal(diagnostics().companion.state, 'walking'); assert.equal(visibleCompanions(), 1); assert.equal(roaming.isEnabled(), true);
  const walkPosition = roaming.position.asArray();
  doc.hidden = true; doc.emit('visibilitychange'); time += 60000;
  assert.equal(frames.size, 0); assert.deepEqual(roaming.position.asArray(), walkPosition);
  doc.hidden = false; doc.emit('visibilitychange'); advance();
  assert.deepEqual(roaming.position.asArray(), walkPosition, 'returning from a hidden tab never jumps along the path');
  advance(800); assert.equal(diagnostics().companion.state, 'resting'); assert.equal(visibleCompanions(), 1);
  advance(1900); assert.equal(diagnostics().companion.state, 'sleeping');
  assert.equal(scene.getMeshByName('companion-sleep-letters').isEnabled(), true);
  assert.equal(scene.meshes.length, routineMeshes); assert.equal(scene.materials.length, routineMaterials, 'a complete routine allocates no new scene assets');
  room.setActivity('working'); advance(1000);
  assert.equal(diagnostics().companion.state, 'working'); assert.equal(visibleCompanions(), 1); assert.equal(contactShadow.isEnabled(), false);
  room.setActivity('break'); advance(100); room.setEditMode(true);
  assert.equal(diagnostics().companion.atDesk, true); assert.equal(visibleCompanions(), 1);
  room.setEditMode(false); motion.matches = true; motion.emit('change', { matches: true }); advance(5);
  assert.equal(diagnostics().companion.state, 'resting'); assert.equal(frames.size, 0);
  assert.equal(scene.getMeshByName('companion-sleep-letters').isEnabled(), false);
  room.setActivity('working'); advance(5); assert.equal(diagnostics().companion.state, 'working'); assert.equal(frames.size, 0);
  room.setLayout(savedRoutineLayout); room.setActivity('idle');
  console.log('PASS companion routine: exactly one avatar, working/walking/resting/sleeping/returning, hidden-tab continuity, editing, static reduced motion and retained scene assets.');
  room.setEditMode(false); room.setTheme('rain'); motion.matches = true; motion.emit('change', { matches: true }); advance(10);
  const snapshot = () => scene.transformNodes.concat(scene.meshes).map(n => [...n.position.asArray(), ...n.rotation.asArray(), ...n.scaling.asArray()]);
  const still = snapshot(); advance(120); assert.deepEqual(snapshot(), still);
  assert.deepEqual(particleBuffers.map(buffer => Array.from(buffer)), particleRestMatrices, 'particle buffers stay still while reduced motion is idle');
  assert.equal(frames.size, 0, 'a ready reduced-motion scene stops requesting frames');
  room.setFocused(false); advance(3); assert.equal(frames.size, 0, 'one reduced-motion state change renders and returns to idle');
  for (const lantern of lanterns) assert.deepEqual(lantern.rotation.asArray(), [0, 0, 0], 'reduced motion restores lanterns to neutral');
  assert.equal(secondHand.rotation.z, 0); assert.equal(pendulum.rotation.z, 0);
  camera.inertialAlphaOffset = 0.025; room.setFocused(false); advance(80);
  assert.equal(camera.inertialAlphaOffset, 0, 'reduced motion lets camera inertia finish instead of deferring a later drift');
  assert.equal(frames.size, 0, 'camera inertia returns the reduced-motion scheduler to idle');
  room.resetView(); advance(3);
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
  motion.matches = true; motion.emit('change', { matches: true });
  const beforeDesignLayout = diagnostics().layout;
  const designCounts = new Map();
  for (let cycle = 0; cycle < 3; cycle++) for (const [id, style] of [['sakura-studio', 'sakura'], ['cloud-loft', 'cloud'], ['midnight-metro', 'metro'], ['writers-loft', 'retreat']]) {
    room.setEditMode(false); room.setLayout(createLayout(id)); advance(3);
    assert.equal(diagnostics().architectureStyle, style);
    const shell = scene.getTransformNodeByName(`architecture-${style}`); assert.ok(shell?.isEnabled());
    assert.equal(scene.getTransformNodeByName('architecture-retreat').isEnabled(), style === 'retreat');
    if (style !== 'retreat') {
      assert.ok(shell.getChildMeshes().length <= 6, 'architecture is batched into at most six meshes');
      for (const mesh of shell.getChildMeshes()) { assert.equal(mesh.isPickable, false); for (const value of mesh.getVerticesData('position')) assert.ok(Number.isFinite(value)); }
      assert.equal(scene.getTransformNodeByName('fairy-lights').isEnabled(), false, 'the original decor stays inside the retreat');
      room.setDecor('lights', false); assert.ok(shell.getChildMeshes().filter(mesh => mesh.name.endsWith('-accent')).every(mesh => !mesh.isEnabled()));
      room.setTheme('day'); room.setTheme('rain'); room.setTheme('dusk'); room.setDecor('lights', true); advance(2);
      room.setActivity('break'); advance(2); assert.equal(diagnostics().companion.state, 'resting', 'reduced motion still reaches a seat');
      room.setActivity('idle'); advance(2);
    }
    const counts = [scene.meshes.length, scene.materials.length, scene.textures.length, scene.geometries.length];
    if (cycle === 1) designCounts.set(id, counts);
    if (cycle === 2) assert.deepEqual(counts, designCounts.get(id), 'repeated visits release old architecture and recolored geometry');
  }
  room.setLayout(beforeDesignLayout); advance(3);
  console.log('PASS designs: four distinct shells, all new rooms usable, batched geometry, preserved decor, day/night/rain and stable assets across repeated visits.');
  doc.hidden = true; doc.emit('visibilitychange'); assert.equal(frames.size, 0);
  doc.hidden = false; doc.emit('visibilitychange'); assert.ok(frames.size <= 1);
  room.dispose(); assert.equal(frames.size, 0); assert.equal(motion.listenerCount, 0); assert.equal(doc.listenerCount, 0); assert.equal(canvas.listenerCount, 0); assert.equal(win.listenerCount, 0);
  assert.ok(observer.disconnected && canvas.removed && scene.isDisposed);
  console.log('PASS lifecycle: hidden suspension; scene, frames, observers and listeners disposed.');
  console.log('Babylon room checks passed. GPU appearance and native gestures require browser checks.');
} catch (error) { room.dispose(); throw error; }
finally { if (originalClockDescriptor) Object.defineProperty(performance, 'now', originalClockDescriptor); else delete performance.now; }
