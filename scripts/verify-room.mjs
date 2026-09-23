// Real Babylon scene/math/picking with a NullEngine, not a GPU benchmark.
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector.js';
import { Camera } from '@babylonjs/core/Cameras/camera.js';
import { Ray } from '@babylonjs/core/Culling/ray.js';
import { createLayout, footprintBounds, pieceCount } from '../src/layout.js';
import { SURFACES } from '../src/surfaces.js';

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
let intersection;
globalThis.IntersectionObserver = class {
  disconnected = false;
  constructor(callback) { this.callback = callback; intersection = this; }
  observe() {} disconnect() { this.disconnected = true; }
};
const { createRoom } = await import('../src/room.js');
let engine;
const container = { clientWidth: 800, clientHeight: 600, appendChild(canvas) { this.canvas = canvas; } };
const changes = [], notices = [], stats = [], dragStates = [], lightTaps = [], companionTaps = [];
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
  onCompanionTap: value => companionTaps.push(value),
  // Break activities are chosen in a fixed order here.
  random: () => 0.5,
  onToggleLights: () => lightTaps.push(time),
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
  scene.isReady = () => true; scene.getOutlineRenderer().isReady = () => true; advance(2);
  assert.equal(camera.mode, Camera.ORTHOGRAPHIC_CAMERA);
  assert.ok(scene.meshes.length > 20);
  assert.equal(canvas.style.touchAction, 'pan-y');
  console.log(`PASS engine: native Babylon scene, orthographic camera, ${scene.meshes.length} meshes, mobile pan-y.`);
  // Outside Decorate a hover picks once and tests the pet's three soft
  // spheres once; the sphere test is plain math, counted apart.
  const nativePick = scene.pickWithRay, petModel = diagnostics().petModel, nativeHitTest = petModel.hitTest; let hoverPicks = 0, petTests = 0;
  scene.pickWithRay = function (...args) { hoverPicks++; return nativePick.apply(this, args); };
  petModel.hitTest = (...args) => { petTests++; return nativeHitTest(...args); };
  for (let i = 0; i < 40; i++) canvas.emit('pointermove', { clientX: 150 + i, clientY: 180, pointerType: 'mouse' });
  assert.equal(hoverPicks, 0, 'raw pointer events only queue their latest coordinates');
  advance(); assert.equal(hoverPicks, 1, 'hover events coalesce into one pick per rendered frame');
  canvas.emit('pointerdown', { clientX: 200, clientY: 180, pointerType: 'mouse' });
  canvas.emit('pointermove', { clientX: 250, clientY: 180, pointerType: 'mouse' }); advance();
  canvas.emit('pointerup', { clientX: 250, clientY: 180, pointerType: 'mouse' });
  assert.equal(hoverPicks, 2, 'orbit dragging skips hover raycasts; the press asks once what it landed on'); assert.equal(petTests, 2);
  room.beginPlacement('plant'); canvas.emit('pointermove', { clientX: 330, clientY: 230, pointerType: 'mouse' }); advance();
  assert.equal(hoverPicks, 2, 'a placement preview only intersects the mathematical floor');
  room.cancelPlacement(); room.setEditMode(false); scene.pickWithRay = nativePick; petModel.hitTest = nativeHitTest;
  const effects = scene.meshes.filter(mesh => mesh.metadata?.effect && mesh.isEnabled());
  const steam = effects.find(mesh => mesh.metadata.effect === 'tea-steam'), flames = effects.find(mesh => mesh.metadata.effect === 'hearth-flames');
  assert.ok(steam && flames, 'the furnished room contains tea and hearth effects');
  const oldSteam = Array.from(steam.getVerticesData('position')), oldFlames = Array.from(flames.getVerticesData('position')); advance(20);
  assert.notDeepEqual(Array.from(steam.getVerticesData('position')), oldSteam, 'placed cup animation is updated by the room');
  assert.notDeepEqual(Array.from(flames.getVerticesData('position')), oldFlames, 'placed fireplace animation is updated by the room');
  const shadowCasters = scene.getLightByName('window-sun').getShadowGenerator().getShadowMap().renderList;
  const glowMeshes = scene.effectLayers.find(layer => layer.name === 'candlelight-bloom').mainTexture.renderList;
  for (const mesh of effects) if (mesh.metadata.effect === 'tea-steam') { assert.equal(mesh.isPickable, false); assert.ok(!shadowCasters.includes(mesh) && !glowMeshes.includes(mesh)); }
  assert.equal(petModel.body.receiveShadows, false, 'moving fur must not sample a stale cached shadow pose');
  assert.ok(shadowCasters.includes(petModel.body), 'the napping pet casts its grounding shadow onto the floor');
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
  // Switched-off fairy lights stay on the wall, dark, like the accent lights of the other rooms.
  const fairy = scene.getTransformNodeByName('fairy-lights'), dark = mesh => !mesh.isEnabled() || mesh.material.emissiveColor.r + mesh.material.emissiveColor.g + mesh.material.emissiveColor.b === 0;
  assert.ok(fairy.isEnabled() && fairy.getChildMeshes().every(dark), 'changing time of day keeps switched-off fairy lights in place and dark');
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
  room.removeSelection(); assert.equal(pieceCount(diagnostics().layout.items), 1);
  room.selectItem(desk.id); room.removeSelection(); assert.equal(pieceCount(diagnostics().layout.items), 1, 'last study station stays');
  function clickFloor(x, z) {
    advance(2); scene.render();
    const pixel = Vector3.Project(new Vector3(x, 0.22, z), Matrix.Identity(), scene.getTransformMatrix(), { x: 0, y: 0, width: canvas.clientWidth, height: canvas.clientHeight });
    const event = { clientX: pixel.x, clientY: pixel.y, pointerId: 1, pointerType: 'mouse', button: 0 };
    canvas.emit('pointerdown', event); canvas.emit('pointerup', event);
  }
  room.beginPlacement('plant'); clickFloor(2, -2);
  assert.equal(pieceCount(diagnostics().layout.items), 2, 'clicking the visible floor preview should commit a piece');
  const placed = diagnostics().layout.items.find(item => item.id !== desk.id && item.type !== 'pet-bed');
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
  assert.equal(pieceCount(diagnostics().layout.items), 2, 'a pointer click on occupied floor must not place furniture');
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
  const plantShade = dragNode.metadata.shade;
  assert.equal(plantShade.isEnabled(false), false, 'a held piece shows no floor shade either');
  const meshCountDuringDrag = scene.meshes.length, materialCountDuringDrag = scene.materials.length;
  hoverPicks = 0; scene.pickWithRay = function (...args) { hoverPicks++; return nativePick.apply(this, args); };
  for (let i = 0; i < 30; i++) { canvas.emit('pointermove', movedPointer); advance(); }
  scene.pickWithRay = nativePick;
  assert.equal(hoverPicks, 0, 'dragging uses floor math, without mesh raycasts');
  assert.equal(scene.meshes.length, meshCountDuringDrag); assert.equal(scene.materials.length, materialCountDuringDrag);
  assert.deepEqual(plantMeshes.map(mesh => mesh.material), originalMaterials, 'outline and preview leave shared materials untouched');
  canvas.emit('pointerup', movedPointer);
  assert.equal(diagnostics().layout.items.find(item => item.id === dragPlant.id).x, 3);
  assert.ok(plantShade.isEnabled(false) && scene.getLightByName('window-sun').getShadowGenerator().getShadowMap().renderList.some(mesh => plantMeshes.includes(mesh)), 'both shadows return once the piece is placed');
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
  assert.equal(plantShade.isEnabled(false), true, 'a cancelled drag brings the shade back');
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
  assert.equal(pieceCount(diagnostics().layout.items), 1); assert.equal(dragStates.at(-1), null);
  assert.equal(changes.length, writesBeforeDrag + 2, 'cancelled drags do not overwrite Undo');
  const deskPointer = pointerAt(desk.x, 1.8, desk.z);
  canvas.emit('pointerdown', deskPointer); canvas.emit('pointermove', trayPointer); advance(2);
  assert.equal(diagnostics().dragging?.id, desk.id); assert.equal(dragStates.at(-1).removable, false);
  canvas.emit('pointerup', trayPointer);
  assert.equal(pieceCount(diagnostics().layout.items), 1, 'last study desk cannot be returned');
  assert.equal(changes.length, writesBeforeDrag + 2);
  room.setLayout(layoutBeforeDragChecks); room.selectItem(null);
  console.log('PASS drag editor: hover outlines, captured gestures, one-save drops, invalid snapback, faded returns, last desk guard, cancellation and no per-frame meshes/materials/picks.');
  // The pet naps in its bed and breathes; a pet brings a heart that ends;
  // a drag carries it, and set down it sits, then walks home to nap again.
  room.setEditMode(true); room.setEditMode(false); advance(3);
  const bed = diagnostics().layout.items.find(item => item.type === 'pet-bed');
  const petBone = name => petModel.body.skeleton.bones.find(bone => bone.name === name).getLocalMatrix();
  const petRig = () => diagnostics().petModel.body.skeleton.bones.map(bone => Array.from(bone.getLocalMatrix().m));
  const petCasts = () => scene.getLightByName('window-sun').getShadowGenerator().getShadowMap().renderList.includes(petModel.body);
  assert.deepEqual([petModel.root.position.x, petModel.root.position.z], [bed.x, bed.z], 'the pet naps in its bed');
  assert.ok(Math.abs(petModel.root.position.y - (0.22 + 0.095)) < 1e-6, 'on its cushion');
  let smallestBreath = Infinity, largestBreath = -Infinity;
  for (let i = 0; i < 300; i++) {
    advance(); const m = petBone('chest').m, breath = Math.hypot(m[4], m[5], m[6]);
    smallestBreath = Math.min(smallestBreath, breath); largestBreath = Math.max(largestBreath, breath);
    assert.deepEqual([petModel.root.position.x, petModel.root.position.z], [bed.x, bed.z], 'a napping pet stays in its bed');
  }
  assert.ok(largestBreath - smallestBreath > 0.03 && smallestBreath >= 0.999 && largestBreath <= 1.05, 'a visible, gentle breath');
  assert.ok(petModel.sleepLetters.isEnabled() && !petModel.heart.isEnabled() && petCasts(), 'nap letters float; a still pet casts its shadow');
  room.pet(); advance(30);
  assert.ok(petModel.heart.isEnabled() && !petModel.sleepLetters.isEnabled(), 'a pet brings a heart');
  advance(150); assert.ok(!petModel.heart.isEnabled() && diagnostics().pet.petAge === Infinity, 'the reaction ends');
  const petPoint = () => { advance(2); scene.render(); const head = petModel.headPoint(new Vector3()); const pixel = Vector3.Project(head, Matrix.Identity(), scene.getTransformMatrix(), { x: 0, y: 0, width: canvas.clientWidth, height: canvas.clientHeight }); return { clientX: pixel.x, clientY: pixel.y, pointerId: 3, pointerType: 'mouse', button: 0 }; };
  const grab = petPoint(), carry = { ...grab, clientX: grab.clientX - 90, clientY: grab.clientY + 30 };
  canvas.emit('pointerdown', grab); canvas.emit('pointermove', carry); advance(12);
  assert.equal(diagnostics().pet.state, 'held'); assert.equal(canvas.capturedPointer, 3, 'the carry keeps the pointer');
  assert.ok(!petCasts() && petModel.root.position.y > 0.4, 'a carried pet is lifted and casts no stale shadow');
  assert.equal(camera.inertialAlphaOffset, 0, 'carrying the pet never turns the room');
  canvas.emit('pointerup', carry); advance(2);
  assert.equal(diagnostics().pet.state, 'sitting', 'set down, it sits a moment');
  // Escape (or a hidden tab) during a carry sets the pet down too.
  {
    const again = petPoint(), away = { ...again, clientX: again.clientX + 40, clientY: again.clientY + 20 };
    canvas.emit('pointerdown', again); canvas.emit('pointermove', away); advance(6);
    assert.equal(diagnostics().pet.state, 'held');
    assert.equal(room.cancelDrag(), true, 'Escape is used up by the carry'); advance(2);
    assert.ok(!diagnostics().pet.held && diagnostics().pet.state === 'sitting' && canvas.capturedPointer == null, 'a cancelled carry sets the pet down and frees the pointer');
  }
  for (let i = 0; i < 60 * 40 && diagnostics().pet.state !== 'sleeping'; i++) advance();
  assert.equal(diagnostics().pet.state, 'sleeping', 'then it walks home and naps');
  assert.deepEqual([petModel.root.position.x, petModel.root.position.z], [bed.x, bed.z]);
  const writesBeforeTap = changes.length; canvas.emit('pointerdown', petPoint()); canvas.emit('pointerup', petPoint()); advance(2);
  assert.ok(petModel.heart.isEnabled() && changes.length === writesBeforeTap, 'a tap pets it and saves nothing');
  // A tap on the companion at its desk asks it to speak: it never switches
  // the desk lamp or saves anything.
  {
    const deskItem = diagnostics().layout.items.find(item => item.id === diagnostics().layout.activeDeskId);
    const head = scene.transformNodes.find(node => node.metadata?.itemId === deskItem.id).metadata.avatarHead;
    advance(2); scene.render(); const pixel = Vector3.Project(head.getAbsolutePosition(), Matrix.Identity(), scene.getTransformMatrix(), { x: 0, y: 0, width: canvas.clientWidth, height: canvas.clientHeight });
    const tap = { clientX: pixel.x, clientY: pixel.y, pointerId: 5, pointerType: 'mouse', button: 0 }, writes = changes.length;
    canvas.emit('pointerdown', tap); canvas.emit('pointerup', tap); advance(2);
    assert.equal(companionTaps.length, 1, 'the companion answers a tap'); assert.ok(companionTaps[0].state);
    assert.equal(changes.length, writes, 'a tap on the companion saves nothing'); assert.ok(!diagnostics().layout.items.find(item => item.id === deskItem.id).off, 'and leaves the desk lamp on');
  }
  // Choosing the other pet swaps the model in place and leaks nothing.
  const petAssets = () => [scene.meshes.length, scene.materials.length, scene.skeletons.length, scene.textures.length];
  const assetsBefore = petAssets();
  room.setPet('dog'); advance(2);
  assert.ok(diagnostics().petSpecies === 'dog' && scene.getMeshByName('pet-dog-body') && !scene.getMeshByName('pet-cat-body'), 'the dog takes the bed');
  room.setPet('cat'); advance(2); room.setPet('dog'); advance(2); room.setPet('cat'); advance(2);
  assert.deepEqual(petAssets(), assetsBefore, 'switching pets keeps meshes, materials, skeletons and textures stable');
  room.beginPlacement('side-table'); clickFloor(3, 0);
  const pendingSettle = diagnostics().layout.items.find(item => item.type === 'side-table');
  const pendingNode = scene.transformNodes.find(node => node.metadata?.itemId === pendingSettle.id);
  assert.ok(pendingNode.scaling.x < 1);
  motion.matches = true; motion.emit('change', { matches: true }); advance(2);
  assert.deepEqual(pendingNode.scaling.asArray(), [1, 1, 1], 'reduced motion immediately completes settling');
  advance(200); const restingRig = petRig(); room.resetView(); advance(40);
  assert.deepEqual(petRig(), restingRig, 'reduced motion holds the pet perfectly still');
  assert.deepEqual(particleBuffers.map(buffer => Array.from(buffer)), particleRestMatrices, 'reduced motion restores every particle to its exact authored position');
  assert.equal(moths.isEnabled(), false); assert.equal(shootingStar.isEnabled(), false);
  assert.deepEqual(Array.from(mothBuffer), restingMothPositions);
  room.selectItem(pendingSettle.id); room.removeSelection();
  // Outside Decorate, so the pet can be carried.
  const decorating = diagnostics().editing; room.setEditMode(false); advance(3);
  // With reduced motion, a dropped pet sits while the room is idle; one timed
  // frame then puts it back in its bed, and the cached shadow redraws there.
  {
    // The pet switch above built a new model: read the live one.
    const model = diagnostics().petModel, shadowMap = scene.getLightByName('window-sun').getShadowGenerator().getShadowMap(), realTimeout = globalThis.setTimeout, timers = [];
    const grab = petPoint(), carry = { ...grab, clientX: grab.clientX - 90, clientY: grab.clientY + 30 };
    globalThis.setTimeout = (callback, ms) => { timers.push({ callback, ms }); return 0; };
    try { canvas.emit('pointerdown', grab); canvas.emit('pointermove', carry); advance(12); canvas.emit('pointerup', carry); advance(12); }
    finally { globalThis.setTimeout = realTimeout; }
    const wake = timers.find(timer => timer.ms > 3000);
    assert.ok(diagnostics().pet.state === 'sitting' && frames.size === 0 && wake && wake.ms <= 5050, 'reduced motion: set down, it sits and the room goes idle');
    // NullEngine never compiles shaders, so Babylon keeps resetting the
    // shadow counter itself; a new caster list is the room's own redraw.
    time += wake.ms; const casters = shadowMap.renderList; wake.callback(); advance(12);
    const home = diagnostics().layout.items.find(item => item.type === 'pet-bed');
    assert.equal(diagnostics().pet.state, 'sleeping', 'reduced motion: the timed frame sends it home');
    assert.deepEqual([model.root.position.x, model.root.position.z], [home.x, home.z], 'reduced motion: it naps in its bed again, with no walk');
    assert.ok(shadowMap.renderList !== casters && shadowMap.renderList.includes(model.body) && frames.size === 0, 'its shadow redraws at the bed, then the room is idle');
  }
  room.setEditMode(decorating); advance(3);
  console.log('PASS animations: the pet naps in its bed and breathes, a pet brings a heart that ends, a carry sets it down and it walks home; settling keeps the saved layout; reduced motion holds still and sends a dropped pet home.');
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
  const advanceUntil = (state, frames) => { for (let i = 0; i < frames && diagnostics().companion.state !== state; i++) advance(); return diagnostics().companion.state; };
  assert.equal(advanceUntil('busy', 1200), 'busy', 'a break starts with one small activity');
  assert.ok(['warm', 'window', 'water', 'record', 'pet', 'lamp'].includes(diagnostics().companion.activity)); assert.equal(visibleCompanions(), 1);
  assert.equal(advanceUntil('resting', 2400), 'resting'); assert.equal(visibleCompanions(), 1);
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
  // At night the companion switches on an unlit lamp before it sits down:
  // one saved change, the lamp lit, and no new scene assets.
  {
    motion.matches = false; motion.emit('change', { matches: false });
    const night = createLayout('moonlit-greenhouse'), lamp = night.items.find(item => item.type === 'floor-lamp'); lamp.off = true;
    room.setTheme('dusk'); room.setLayout(night); room.setActivity('working'); advance(3);
    const writes = changes.length, assets = [scene.meshes.length, scene.materials.length];
    room.setActivity('break');
    assert.equal(advanceUntil('busy', 1200), 'busy'); assert.equal(diagnostics().companion.activity, 'lamp', 'an unlit lamp comes first at night');
    advance(150);
    assert.ok(!diagnostics().layout.items.find(item => item.id === lamp.id).off, 'the companion switched the lamp on');
    assert.equal(changes.length, writes + 1, 'one saved change'); assert.ok(!changes.at(-1).items.find(item => item.id === lamp.id).off);
    assert.equal(advanceUntil('resting', 2400), 'resting');
    assert.deepEqual([scene.meshes.length, scene.materials.length], assets, 'activities add no scene assets');
    room.setActivity('working'); advance(1000); assert.equal(diagnostics().companion.state, 'working');
  }
  room.setLayout(savedRoutineLayout); room.setActivity('idle');
  console.log('PASS companion routine: exactly one avatar, working/walking/busy/resting/sleeping/returning, a lamp switched on at night, hidden-tab continuity, editing, static reduced motion and retained scene assets.');
  room.setEditMode(false); room.setTheme('rain'); motion.matches = true; motion.emit('change', { matches: true }); advance(10);
  const snapshot = () => scene.transformNodes.concat(scene.meshes).map(n => [...n.position.asArray(), ...n.rotation.asArray(), ...n.scaling.asArray()]);
  const still = snapshot(); advance(120); assert.deepEqual(snapshot(), still);
  assert.deepEqual(particleBuffers.map(buffer => Array.from(buffer)), particleRestMatrices, 'particle buffers stay still while reduced motion is idle');
  assert.equal(frames.size, 0, 'a ready reduced-motion scene stops requesting frames');
  room.setFocused(false); advance(3); assert.equal(frames.size, 0, 'one reduced-motion state change renders and returns to idle');
  for (const lantern of lanterns) assert.deepEqual(lantern.rotation.asArray(), [0, 0, 0], 'reduced motion restores lanterns to neutral');
  // The clock is a wall piece now: check the one in this layout, if it has one.
  for (const name of ['clock-second-hand', 'clock-pendulum']) { const node = scene.getTransformNodeByName(name); if (node) assert.equal(node.rotation.z, 0, `${name} rests with reduced motion`); }
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
    // Slow frames step down; steady frames bring the detail back. A step up
    // that stalls again becomes the ceiling for the rest of the visit.
    const run = (seconds, frameMs) => { for (let elapsed = 0; elapsed < seconds * 1000; elapsed += frameMs) { time += frameMs - 1000 / 60; advance(); } };
    room.setQuality('auto'); const fullRatio = diagnostics().pixelRatio;
    run(4, 50); assert.equal(diagnostics().pixelRatio, fullRatio - 0.25, 'sustained slow frames lower resolution one step');
    run(9, 1000 / 60); assert.equal(diagnostics().pixelRatio, fullRatio, 'eight steady seconds restore full resolution');
    run(4, 50); assert.equal(diagnostics().pixelRatio, fullRatio - 0.25, 'a step up that stalls again steps back down');
    run(12, 1000 / 60); assert.equal(diagnostics().pixelRatio, fullRatio - 0.25, 'the level that stalled stays out of reach for this visit');
    room.setQuality('auto'); assert.equal(diagnostics().pixelRatio, fullRatio, 'choosing a quality again resets the ceiling');
    // One long slow period after a step up lowers the ceiling one level only.
    run(4, 50); run(9, 1000 / 60); assert.equal(diagnostics().pixelRatio, fullRatio);
    run(12, 50); assert.equal(diagnostics().pixelRatio, 0.75, 'a long stall still steps all the way down');
    run(40, 1000 / 60); assert.equal(diagnostics().pixelRatio, fullRatio - 0.25, 'steady frames climb back to one level below the failed one');
    room.setQuality('auto');
    // Moving the window to a screen with another density follows the display.
    win.devicePixelRatio = 2; motion.emit('change', { matches: motion.matches }); assert.equal(diagnostics().pixelRatio, 2, 'a 2x screen renders at 2x');
    win.devicePixelRatio = 1.5; motion.emit('change', { matches: motion.matches }); assert.equal(diagnostics().pixelRatio, 1.5, 'back on the original screen');
  } finally {
    if (clockDescriptor) Object.defineProperty(performance, 'now', clockDescriptor);
    else delete performance.now;
  }
  console.log('PASS adaptive quality: intentional idle keeps resolution; visible stalls remain in frame metrics; steady frames restore detail below a learned ceiling.');
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
      for (const mesh of shell.getChildMeshes()) { assert.equal(mesh.isPickable, Boolean(mesh.metadata.lightSwitch), 'only accent lights take taps'); for (const value of mesh.getVerticesData('position')) assert.ok(Number.isFinite(value)); }
      assert.equal(scene.getTransformNodeByName('fairy-lights').isEnabled(), false, 'the original decor stays inside the retreat');
      // Accent lights switch off in place: fixtures stay, glow goes, so cords never hang empty.
      const accents = shell.getChildMeshes().filter(mesh => mesh.name.endsWith('-accent')), bloomList = () => scene.effectLayers.find(layer => layer.name === 'candlelight-bloom').mainTexture.renderList;
      const glow = mesh => mesh.material.emissiveColor.r + mesh.material.emissiveColor.g + mesh.material.emissiveColor.b;
      room.setDecor('lights', false);
      assert.ok(accents.length && accents.every(mesh => mesh.isEnabled() && glow(mesh) === 0 && !bloomList().includes(mesh)), 'switched-off accents stay visible without glow');
      room.setTheme('day'); room.setTheme('rain'); room.setTheme('dusk');
      assert.ok(accents.every(mesh => glow(mesh) === 0), 'a theme change keeps switched-off accents dark');
      room.setDecor('lights', true); advance(2);
      assert.ok(accents.every(mesh => glow(mesh) > 0.1 && bloomList().includes(mesh)), 'accents glow again when switched on');
      room.setActivity('break'); advance(2); assert.equal(diagnostics().companion.state, 'resting', 'reduced motion still reaches a seat');
      room.setActivity('idle'); advance(2);
    }
    const counts = [scene.meshes.length, scene.materials.length, scene.textures.length, scene.geometries.length];
    if (cycle === 1) designCounts.set(id, counts);
    if (cycle === 2) assert.deepEqual(counts, designCounts.get(id), 'repeated visits release old architecture and recolored geometry');
  }
  room.setLayout(beforeDesignLayout); advance(3);
  console.log('PASS designs: four distinct shells, all new rooms usable, batched geometry, preserved decor, day/night/rain and stable assets across repeated visits.');
  {
    // Contact shade sits 2 mm above the highest rug under each piece, or the floor.
    for (const id of ['ember-library', 'moonlit-greenhouse', 'sakura-studio']) {
      room.setLayout(createLayout(id)); advance(3);
      const floor = id === 'sakura-studio' ? .2275 : .219, items = diagnostics().layout.items;
      const nodes = new Map(scene.transformNodes.filter(node => node.metadata?.itemId).map(node => [node.metadata.itemId, node]));
      const rugs = items.filter(item => ['rug', 'moon-rug'].includes(item.type)).map(item => ({ area: footprintBounds(item), top: nodes.get(item.id).getHierarchyBoundingVectors(true).max.y }));
      let onRug = 0;
      for (const item of items) {
        const shade = nodes.get(item.id)?.metadata.shade; if (!shade) continue;
        const a = footprintBounds(item), under = rugs.filter(r => a.minX < r.area.maxX && a.maxX > r.area.minX && a.minZ < r.area.maxZ && a.maxZ > r.area.minZ);
        const top = Math.max(floor, ...under.map(r => r.top)), y = shade.getAbsolutePosition().y; onRug += under.length > 0;
        assert.ok(Math.abs(y - (top + .002)) < 1e-4, `${id} ${item.id}: shade ${y.toFixed(4)} sits 2 mm above ${top.toFixed(4)}`);
      }
      assert.ok(onRug > 0, `${id} has pieces standing on rugs`);
    }
    // The walking companion's shade follows the same rule.
    room.setLayout(createLayout('ember-library')); advance(3); room.setActivity('break'); advance(90);
    const contact = scene.getMeshByName('companion-contact-shadow');
    assert.ok(contact.isEnabled() && contact.position.y >= .221 - 1e-6, 'the walking companion keeps a grounded shade');
    room.setActivity('idle'); advance(90);
    // Moths stay out of the Midnight metro window, even after animation frames.
    const motionWas = motion.matches; motion.matches = false; motion.emit('change', { matches: false });
    room.setLayout(createLayout('midnight-metro')); advance(5);
    assert.equal(scene.getMeshByName('window-moths').isEnabled(), false, 'no moths in the city window, even with motion on');
    motion.matches = motionWas; motion.emit('change', { matches: motionWas });
    // Stars keep their shape although the effects stretch to the wide window.
    const stars = scene.getMeshByName('window-drifting-stars'), star = particleBuffers[1];
    assert.ok(Math.abs(star[0] * stars.parent.scaling.x - star[5]) < 1e-6 && stars.parent.scaling.x > 1.5, 'metro stars are not stretched');
    assert.ok(Math.abs(scene.getMeshByName('window-shooting-star').scaling.x * stars.parent.scaling.x - 1) < 1e-6, 'the shooting star is not stretched');
    room.setLayout(beforeDesignLayout); advance(3);
    assert.ok(Math.abs(star[0] - star[5]) < 1e-6, 'retreat stars keep their original shape');
    // Scrolled out of view, the loop stops; back in view, it resumes.
    intersection.callback([{ isIntersecting: false }]); assert.equal(frames.size, 0, 'no frames while scrolled away');
    room.setFocused(true); assert.equal(frames.size, 0, 'state changes wait until the room is visible');
    intersection.callback([{ isIntersecting: true }]); assert.equal(frames.size, 1, 'the room draws again when visible');
    room.setFocused(false); advance(3);
    // Enter-key placement: the preview spot becomes a real piece.
    room.setEditMode(true); const count = pieceCount(diagnostics().layout.items);
    room.beginPlacement('plant'); assert.equal(room.confirmPlacement(), true); advance(2);
    assert.equal(pieceCount(diagnostics().layout.items), count + 1, 'confirming a placement adds the piece');
    assert.equal(room.confirmPlacement(), false, 'nothing to confirm afterwards');
    room.setEditMode(false); room.setLayout(beforeDesignLayout); advance(3);
    console.log('PASS review fixes: shade 2 mm above rugs and floor, grounded companion, no metro moths, unstretched stars, off-screen pause, keyboard placement.');
  }
  {
    // The room alone sets the cursor: Babylon's reset on every move made it flicker.
    assert.equal(scene.doNotHandleCursors, true, 'Babylon never resets the room cursor');
    room.setLayout(dragLayout); room.setEditMode(true); advance(3);
    const still = () => { camera.inertialAlphaOffset = 0; camera.inertialBetaOffset = 0; advance(2); };
    still();
    const empty = pointerAt(-4, .22, 3), turned = { ...empty, clientX: empty.clientX + 60, clientY: empty.clientY + 20 };
    canvas.emit('pointermove', empty); advance(2);
    assert.equal(diagnostics().hoveredId, null);
    assert.equal(canvas.style.cursor, 'grab', 'empty space in Decorate shows grab, not a plus');
    // Decorate mode: a drag from empty space turns the room and moves no furniture.
    const alpha = camera.alpha, beta = camera.beta, saved = JSON.stringify(diagnostics().layout), writes = changes.length;
    canvas.emit('pointerdown', empty); canvas.emit('pointermove', turned);
    assert.equal(canvas.style.cursor, 'grabbing');
    assert.ok(camera.inertialAlphaOffset < 0 && camera.inertialBetaOffset < 0, 'an empty-space drag turns the room like the camera input');
    assert.equal(diagnostics().dragging, null);
    advance(6); assert.ok(camera.alpha !== alpha && camera.beta !== beta, 'the view turns');
    canvas.emit('pointerup', turned); advance(2);
    assert.equal(canvas.style.cursor, 'grab', 'grabbing ends with the gesture');
    assert.equal(JSON.stringify(diagnostics().layout), saved); assert.equal(changes.length, writes, 'turning the room saves nothing');
    // A drag that starts on a piece still moves only the piece.
    still();
    const dropped = beginPlantDrag();
    assert.equal(camera.inertialAlphaOffset, 0, 'a piece drag never turns the room');
    canvas.emit('pointerup', dropped); advance(2);
    assert.equal(diagnostics().layout.items.find(item => item.id === dragPlant.id).x, 3);
    // Placement keeps its plus cursor, and a drag turns the room without a placement.
    still(); room.beginPlacement('plant');
    const place = pointerAt(-4, .22, 3); canvas.emit('pointermove', place); advance(2);
    assert.equal(canvas.style.cursor, 'crosshair');
    const count = pieceCount(diagnostics().layout.items);
    canvas.emit('pointerdown', place); canvas.emit('pointermove', { ...place, clientX: place.clientX - 50 });
    assert.ok(camera.inertialAlphaOffset > 0, 'placement mode can turn the room too');
    canvas.emit('pointerup', { ...place, clientX: place.clientX - 50 }); advance(2);
    assert.equal(pieceCount(diagnostics().layout.items), count, 'a drag never places the preview');
    assert.equal(canvas.style.cursor, 'crosshair');
    room.cancelPlacement(); room.setEditMode(false); room.resetView(); room.setLayout(beforeDesignLayout); advance(3);
    console.log('PASS decorate fixes: room-owned cursor, grab over empty space, empty-space drags turn the room, piece drags stay piece drags.');
  }
  {
    const node = id => scene.transformNodes.find(item => item.metadata?.itemId === id && item.metadata.body);
    // Rugs stack in the order they are put down. A covered rug flattens, so
    // its raised weave never shows through the rug on top.
    const under = { id: 'rug-under', type: 'rug', x: -2, z: 1.5, rotation: 0 }, over = { id: 'rug-over', type: 'rug', x: -0.5, z: 1.75, rotation: 0 };
    room.setLayout({ presetId: null, items: [desk, under, over], activeDeskId: desk.id }); room.setEditMode(true); advance(3);
    assert.ok(node('rug-under').metadata.body.scaling.y < 0.2 && node('rug-over').metadata.body.scaling.y === 1, 'the earlier rug flattens under the later one');
    assert.ok(node('rug-under').getHierarchyBoundingVectors(true).max.y < node('rug-over').getHierarchyBoundingVectors(true).min.y, 'the flat rug stays below the rug on top');
    const from = pointerAt(-3.2, .23, 1.5), to = pointerAt(-2.95, .23, 1.5);
    canvas.emit('pointerdown', from); canvas.emit('pointermove', to); advance(2);
    assert.equal(diagnostics().dragging?.id, 'rug-under'); canvas.emit('pointerup', to); advance(2);
    assert.equal(diagnostics().layout.items.at(-1).id, 'rug-under', 'the rug put down last goes to the top of the stack');
    assert.ok(node('rug-over').metadata.body.scaling.y < 0.2 && node('rug-under').metadata.body.scaling.y === 1, 'the stack follows the new order');
    // The pet stands on what is under it: its bed's cushion, then a rug top
    // that sinks when a later rug flattens it.
    const pet = diagnostics().petModel.root, soloRug = { id: 'solo-rug', type: 'rug', x: 3, z: 2, rotation: 0 };
    room.setEditMode(false); room.setLayout({ presetId: null, items: [desk, soloRug], activeDeskId: desk.id }); advance(3);
    assert.ok(Math.abs(pet.position.y - (0.22 + 0.095)) < 1e-6, 'in its bed, the pet lies on the cushion');
    const lift = () => { advance(2); scene.render(); const head = diagnostics().petModel.headPoint(new Vector3()); return Vector3.Project(head, Matrix.Identity(), scene.getTransformMatrix(), { x: 0, y: 0, width: canvas.clientWidth, height: canvas.clientHeight }); };
    const above = Vector3.Project(new Vector3(3, 0.22 + 0.95, 2), Matrix.Identity(), scene.getTransformMatrix(), { x: 0, y: 0, width: canvas.clientWidth, height: canvas.clientHeight });
    const start = lift(), press = { clientX: start.x, clientY: start.y, pointerId: 4, pointerType: 'mouse', button: 0 };
    canvas.emit('pointerdown', press); canvas.emit('pointermove', { ...press, clientX: above.x, clientY: above.y }); advance(2); canvas.emit('pointerup', { ...press, clientX: above.x, clientY: above.y }); advance(40);
    assert.equal(diagnostics().pet.state, 'sitting'); assert.ok(Math.hypot(pet.position.x - 3, pet.position.z - 2) < 0.05, 'set down on the rug');
    assert.ok(Math.abs(pet.position.y - (0.22 + 0.056)) < 1e-3, `on the rug top (${pet.position.y.toFixed(4)})`);
    room.setLayout({ presetId: null, items: [desk, soloRug, { id: 'cover-rug', type: 'rug', x: 0, z: 2, rotation: 0 }], activeDeskId: desk.id }); advance(40);
    assert.ok(Math.abs(pet.position.y - (0.22 + 0.0055)) < 1e-3, 'a flattened rug lowers the pet with it');
    room.setEditMode(true);
    // A drop that overlaps a neighbor lands on the closest free spot.
    room.setLayout(dragLayout); advance(3);
    const slide = beginPlantDrag(-0.25, -2.5);
    assert.equal(diagnostics().dragging.valid, true, 'a free spot beside the desk replaces the refusal');
    assert.deepEqual([diagnostics().dragging.candidate.x, diagnostics().dragging.candidate.z], [0, -2.5]);
    assert.deepEqual([node(dragPlant.id).position.x, node(dragPlant.id).position.z], [0, -2.5], 'the piece shows where it will land');
    canvas.emit('pointerup', slide); advance(2);
    const slid = diagnostics().layout.items.find(item => item.id === dragPlant.id);
    assert.deepEqual([slid.x, slid.z], [0, -2.5]);
    // A click on empty floor deselects and never moves the selected piece.
    room.selectItem(dragPlant.id); const beforeClick = JSON.stringify(diagnostics().layout), writes = changes.length;
    clickFloor(-4, 3); advance(2);
    assert.equal(diagnostics().selectedId, null, 'empty floor deselects');
    assert.equal(JSON.stringify(diagnostics().layout), beforeClick); assert.equal(changes.length, writes, 'a click on the floor saves nothing');
    // A turn that would cross the wall slides the piece clear.
    const sofa = { id: 'wall-sofa', type: 'daybed', x: 3.75, z: -3.25, rotation: 0 };
    room.setLayout({ presetId: null, items: [desk, sofa], activeDeskId: desk.id }); advance(3);
    room.selectItem('wall-sofa'); room.rotateSelection();
    const turned = diagnostics().layout.items.find(item => item.id === 'wall-sofa');
    assert.deepEqual([turned.x, turned.z, turned.rotation], [3.75, -2.5, 1], 'the sofa turns and steps off the wall');
    room.setEditMode(false); room.setLayout(beforeDesignLayout); advance(3);
    console.log('PASS placement fixes: rugs stack in drop order, covered rugs flatten, the pet stands on its bed or rug, blocked drops and turns find a free spot, floor clicks only deselect.');
  }
  {
    // Outside Decorate, a tap uses a piece: lamps, candles, fire and records
    // switch and save; plants, books, cushions and tea play a short reaction.
    const motionBefore = motion.matches; motion.matches = false; motion.emit('change', { matches: false });
    room.setEditMode(false); room.setLayout(createLayout('ember-library')); advance(3);
    const node = id => scene.transformNodes.find(item => item.metadata?.itemId === id && item.metadata.body);
    const bloom = () => scene.effectLayers.find(layer => layer.name === 'candlelight-bloom').mainTexture.renderList;
    const glow = mesh => mesh.material.emissiveColor.r + mesh.material.emissiveColor.g + mesh.material.emissiveColor.b;
    // The first sample point on a piece that a tap would reach.
    function tapPoint(id) {
      const target = node(id); target.getChildMeshes().forEach(mesh => mesh.computeWorldMatrix(true));
      const { min, max } = target.getHierarchyBoundingVectors(true, mesh => !mesh.metadata?.effect || mesh.metadata.effect === 'leaf-sway');
      for (const fy of [0.75, 0.5, 0.9, 0.3]) for (const fx of [0.5, 0.3, 0.7]) for (const fz of [0.5, 0.7, 0.3, 0.9]) {
        const pointer = pointerAt(min.x + (max.x - min.x) * fx, min.y + (max.y - min.y) * fy, min.z + (max.z - min.z) * fz);
        canvas.emit('pointermove', pointer); advance(2);
        if (diagnostics().playHover === id) return pointer;
      }
      assert.fail(`no tap point on ${id}`);
    }
    const tap = pointer => { canvas.emit('pointerdown', pointer); canvas.emit('pointerup', pointer); advance(2); };
    const saved = id => diagnostics().layout.items.find(item => item.id === id);
    // Hover shows what a tap will use.
    const lampPoint = tapPoint('ember-lamp'), lamp = node('ember-lamp');
    assert.equal(canvas.style.cursor, 'pointer');
    assert.ok(lamp.getChildMeshes().filter(mesh => mesh.metadata?.effect !== 'contact-shadow').every(mesh => mesh.renderOutline), 'a hovered lamp is outlined');
    canvas.emit('pointerleave'); assert.equal(diagnostics().playHover, null);
    assert.ok(lamp.getChildMeshes().every(mesh => !mesh.renderOutline));
    // Floor lamp: the shade stays, its glow goes, and the state saves without an Undo step.
    const shade = lamp.getChildMeshes().find(mesh => !mesh.metadata?.effect && glow(mesh) > 0.1), litShade = shade.material, writes = changes.length;
    tap(lampPoint);
    assert.equal(saved('ember-lamp').off, true); assert.equal(changes.length, writes + 1, 'one save per switch');
    assert.ok(shade.isEnabled() && glow(shade) === 0 && !bloom().includes(shade), 'a switched-off lamp keeps its shade without glow');
    tap(lampPoint);
    assert.equal(saved('ember-lamp').off, undefined); assert.equal(shade.material, litShade);
    assert.ok(bloom().includes(shade), 'the lamp glows again');
    // Fire: flames, embers, mantel candles and the hearth light all go out.
    const hearthPoint = tapPoint('ember-hearth'), hearth = node('ember-hearth'), hearthLight = scene.getLightByName('hearth-lamplight');
    const effect = kind => hearth.getChildMeshes().find(mesh => mesh.metadata?.effect === kind);
    tap(hearthPoint); advance(3);
    assert.ok(saved('ember-hearth').off && !effect('hearth-flames').isEnabled() && !effect('hearth-embers').isEnabled() && !hearthLight.isEnabled(), 'the fire goes out with its light');
    tap(hearthPoint); advance(3);
    assert.ok(effect('hearth-flames').isEnabled() && effect('hearth-embers').isEnabled() && hearthLight.isEnabled(), 'the fire lights again');
    // Desk: the lamp and its warm light switch together.
    const deskPoint = tapPoint('ember-desk'), deskLight = scene.getLightByName('window-lamplight');
    tap(deskPoint); assert.ok(saved('ember-desk').off && !deskLight.isEnabled(), 'the desk lamp takes its light along');
    tap(deskPoint); assert.ok(!saved('ember-desk').off && deskLight.isEnabled());
    // Records: a stopped player keeps its record still.
    const recordPoint = tapPoint('ember-records'), disc = node('ember-records').getChildren().find(child => child.metadata?.effect === 'record-spin');
    tap(recordPoint); const stopped = disc.rotation.y; advance(20);
    assert.equal(disc.rotation.y, stopped, 'the record stops while the player is off');
    tap(recordPoint); advance(20); assert.notEqual(disc.rotation.y, stopped, 'the record turns again');
    // Lanterns: the flames go out, the lanterns stay.
    const lanternPoint = tapPoint('ember-lanterns'), flames = node('ember-lanterns').getChildMeshes().filter(mesh => !mesh.metadata?.effect && glow(mesh) > 0.1);
    tap(lanternPoint); assert.ok(flames.length && flames.every(mesh => !mesh.isEnabled()), 'candle flames go out');
    tap(lanternPoint); assert.ok(flames.every(mesh => mesh.isEnabled()));
    // Reactions end exactly at the rest pose.
    const plantPoint = tapPoint('ember-plant'); tap(plantPoint);
    assert.ok(node('ember-plant').metadata.rustle > 0.5, 'leaves rustle after a tap'); advance(80);
    assert.equal(node('ember-plant').metadata.rustle, 0, 'the rustle fades out');
    const booksPoint = tapPoint('ember-books-right'), hinge = node('ember-books-right').metadata.book; tap(booksPoint); advance(15);
    assert.ok(hinge.rotation.x > 0.2 && hinge.position.z > 0.225, 'a book tips out of the shelf'); advance(90);
    assert.deepEqual([hinge.rotation.x, hinge.position.z], [0, 0.225], 'and slides back');
    const sofaPoint = tapPoint('ember-sofa'), body = node('ember-sofa').metadata.body; tap(sofaPoint); advance(4);
    assert.ok(body.scaling.y < 0.99, 'the cushions squash'); advance(60);
    assert.deepEqual(body.scaling.asArray(), [1, 1, 1], 'and spring back');
    const teaPoint = tapPoint('ember-table'); tap(teaPoint); advance(30);
    assert.ok(node('ember-table').metadata.puff > 0.5, 'the tea puffs steam'); advance(80);
    assert.equal(node('ember-table').metadata.puff, 0);
    assert.equal(JSON.stringify(diagnostics().layout), JSON.stringify(createLayout('ember-library')), 'reactions save nothing');
    // The fairy lights and lanterns switch through the room lights.
    const lantern = scene.getTransformNodeByName('swaying-lantern-2').getChildMeshes()[0]; lantern.computeWorldMatrix(true);
    const center = lantern.getBoundingInfo().boundingBox.centerWorld, lightsPoint = pointerAt(center.x, center.y, center.z);
    canvas.emit('pointermove', lightsPoint); advance(2); assert.equal(diagnostics().playHover, 'room-lights');
    const taps = lightTaps.length; tap(lightsPoint); assert.equal(lightTaps.length, taps + 1, 'a tap on the lights switches them');
    // Reduced motion keeps switches working and skips reactions.
    motion.matches = true; motion.emit('change', { matches: true }); advance(2);
    tap(plantPoint); assert.equal(node('ember-plant').metadata.rustle ?? 0, 0, 'no rustle with reduced motion');
    tap(lampPoint); assert.equal(saved('ember-lamp').off, true, 'switches still work with reduced motion'); tap(lampPoint);
    motion.matches = false; motion.emit('change', { matches: false }); advance(2);
    // Decorate mode: a tap selects the piece instead of switching it.
    room.setEditMode(true); advance(2); tap(lampPoint);
    assert.equal(diagnostics().selectedId, 'ember-lamp'); assert.equal(saved('ember-lamp').off, undefined, 'Decorate taps never switch');
    room.setEditMode(false); room.setLayout(beforeDesignLayout); motion.matches = motionBefore; motion.emit('change', { matches: motionBefore }); advance(3);
    console.log('PASS tap to use: hover outlines, saved switches for lamps, desk lamp, fire, records and candles, room lights, four reactions that end at rest, reduced motion and Decorate taps.');
  }
  {
    // Wall pieces hang on the back and side walls. They slide along a wall and
    // across the corner, refuse fixtures, keep floor furniture clear, show the
    // chosen picture and a band instead of an outline.
    room.setEditMode(true); room.setLayout(createLayout('ember-library')); advance(3);
    const node = id => scene.transformNodes.find(item => item.metadata?.itemId === id);
    const saved = id => diagnostics().layout.items.find(item => item.id === id);
    // A pointer on the wall face itself, so its wall coordinates are exact.
    const on = spot => spot.wall === 'back' ? pointerAt(spot.u, spot.v, -4.49) : pointerAt(-5.83, spot.v, spot.u);
    const move = (from, to) => { canvas.emit('pointerdown', on(from)); canvas.emit('pointermove', on(to)); advance(2); canvas.emit('pointerup', on(to)); advance(2); };
    const frame = saved('ember-frame-mantel');
    assert.deepEqual(node('ember-frame-mantel').position.asArray(), [frame.u, frame.v, -4.49], 'a picture hangs on the back wall face');
    assert.equal(node('ember-clock').rotation.y, Math.PI / 2, 'side wall pieces face the room');
    canvas.emit('pointermove', on(frame)); advance(2);
    const band = scene.getMeshByName('wall-highlight');
    assert.ok(band?.isEnabled() && band.parent === node('ember-frame-mantel'), 'a hovered wall piece shows its band');
    assert.ok(node('ember-frame-mantel').getChildMeshes().every(mesh => !mesh.renderOutline), 'no outline paints over the picture');
    const writes = changes.length;
    move(frame, { ...frame, u: frame.u - 0.6 });
    assert.equal(changes.length, writes + 1, 'one save per drop');
    assert.deepEqual(['wall', 'u', 'v'].map(key => saved('ember-frame-mantel')[key]), ['back', 2.65, frame.v], 'a drag slides the picture along the wall');
    move(saved('ember-frame-mantel'), { wall: 'side', u: -2.9, v: 4.15 });
    assert.deepEqual(['wall', 'u', 'v'].map(key => saved('ember-frame-mantel')[key]), ['side', -2.9, 4.15], 'a drag across the corner hangs it on the side wall');
    assert.deepEqual([node('ember-frame-mantel').position.asArray(), node('ember-frame-mantel').rotation.y], [[-5.83, 4.15, -2.9], Math.PI / 2]);
    const beforeWindow = JSON.stringify(diagnostics().layout);
    move(saved('ember-frame-mantel'), { wall: 'back', u: -2.7, v: 3.4 });
    assert.equal(JSON.stringify(diagnostics().layout), beforeWindow); assert.match(notices.at(-1), /window/, 'the window refuses the picture');
    assert.deepEqual(node('ember-frame-mantel').position.asArray(), [-5.83, 4.15, -2.9], 'and it returns to its spot');
    // Arrows move a wall piece along its wall; R leaves it as it is.
    room.selectItem('ember-frame-mantel'); room.moveSelection(0, -0.25); room.rotateSelection();
    assert.deepEqual(['wall', 'u', 'v'].map(key => saved('ember-frame-mantel')[key]), ['side', -2.9, 4.25]);
    room.setArt('hills'); room.setArt('not-a-picture');
    assert.equal(saved('ember-frame-mantel').art, 'hills'); assert.match(node('ember-frame-mantel').metadata.picture.material.name, /hills/, 'the frame shows the chosen picture');
    // A bookcase stops short of standing in front of the Sakura scroll.
    room.setLayout(createLayout('sakura-studio')); advance(3); room.selectItem('sakura-books');
    for (let i = 0; i < 4; i++) room.moveSelection(-0.25, 0);
    assert.equal(saved('sakura-books').x, 4.25); assert.match(notices.at(-1), /in front of the blossom scroll/);
    // A room saved before wall pieces gains its design's pieces.
    const legacy = createLayout('ember-library'); legacy.items = legacy.items.filter(item => !item.wall); delete legacy.v;
    room.setLayout(legacy); advance(3);
    assert.deepEqual(diagnostics().layout.items.filter(item => item.wall).map(item => item.id).sort(), ['ember-clock', 'ember-frame-mantel', 'ember-frame-small', 'ember-potions']);
    // The neon sign follows the time of day and switches with a tap.
    room.setEditMode(false); room.setLayout(createLayout('midnight-metro')); advance(3);
    const neon = node('metro-neon').getChildMeshes().filter(mesh => mesh.material?.metadata?.accent), base = neon.map(mesh => mesh.material.metadata.accent);
    room.setTheme('day'); assert.ok(neon.every((mesh, i) => mesh.material.emissiveColor.equalsWithEpsilon(base[i].scale(0.355), 1e-6)), 'the neon is soft by day');
    room.setTheme('dusk'); assert.ok(neon.every((mesh, i) => mesh.material.emissiveColor.equalsWithEpsilon(base[i], 1e-6)), 'and bright at night');
    const sign = on({ wall: 'back', u: 4.4, v: 3.79 }); canvas.emit('pointermove', sign); advance(2);
    assert.equal(diagnostics().playHover, 'metro-neon'); canvas.emit('pointerdown', sign); canvas.emit('pointerup', sign); advance(2);
    assert.equal(saved('metro-neon').off, true); assert.ok(neon.every(mesh => mesh.material.emissiveColor.r + mesh.material.emissiveColor.g + mesh.material.emissiveColor.b === 0), 'a tap switches the neon off');
    room.setLayout(beforeDesignLayout); advance(3);
    console.log('PASS wall layer: back and side walls, drags along and across the corner, refused fixtures, arrows, pictures, floor clearance, old saves, neon glow and switch, a band instead of outlines.');
  }
  {
    // A window cuts a real opening: a ray passes through it, its view hangs
    // behind it, a dragged window closes it, and it opens again where it lands.
    const deskOnly = { presetId: 'ember-library', items: [desk], activeDeskId: desk.id, v: 2 };
    room.setEditMode(true); room.setLayout(deskOnly); advance(3);
    const node = id => scene.transformNodes.find(item => item.metadata?.itemId === id);
    const saved = id => diagnostics().layout.items.find(item => item.id === id);
    const on = spot => spot.wall === 'back' ? pointerAt(spot.u, spot.v, -4.49) : pointerAt(-5.83, spot.v, spot.u);
    // Is a shell's wall solid at a wall spot? A ray from the room meets it or passes.
    const wallMesh = (style, wall) => scene.getMeshByName(style === 'retreat' ? `retreat-${wall}-wall` : `${style}-walls`);
    const solid = (style, spot) => {
      const origin = spot.wall === 'back' ? new Vector3(spot.u, spot.v, -3) : new Vector3(-4.5, spot.v, spot.u), direction = spot.wall === 'back' ? new Vector3(0, 0, -1) : new Vector3(-1, 0, 0);
      return Boolean(wallMesh(style, spot.wall).intersects(new Ray(origin, direction, 3), false).hit);
    };
    assert.ok(solid('retreat', { wall: 'side', u: 2, v: 3 }), 'the side wall starts solid');
    room.beginPlacement('cottage-window'); const spot = on({ wall: 'side', u: 2, v: 3 });
    canvas.emit('pointermove', spot); advance(2); canvas.emit('pointerdown', spot); canvas.emit('pointerup', spot); advance(2);
    const win = diagnostics().layout.items.find(item => item.type === 'cottage-window');
    assert.deepEqual([win.wall, win.u, win.v], ['side', 2, 3], 'a click on the wall hangs the window');
    assert.ok(!solid('retreat', win) && solid('retreat', { wall: 'side', u: 3.5, v: 3 }), 'the window cuts its opening, and only there');
    const view = node(win.id).metadata.view, sun = scene.getLightByName('window-sun').getShadowGenerator().getShadowMap().renderList;
    assert.equal(view.position.z, -0.27); assert.match(view.material.emissiveTexture.name, /enchanted-forest/, 'the view is the room view');
    assert.ok(sun.includes(wallMesh('retreat', 'side')) && !sun.includes(view) && !sun.some(mesh => mesh.isDisposed()), 'the walls cast shadows; the view never does');
    // A dragged window closes its opening; the drop opens it where it lands.
    canvas.emit('pointerdown', on(win)); canvas.emit('pointermove', on({ ...win, u: 3 })); advance(2);
    assert.ok(solid('retreat', win) && view.position.z === 0.012, 'while held, the opening closes and the view comes forward');
    canvas.emit('pointerup', on({ ...win, u: 3 })); advance(2);
    assert.equal(saved(win.id).u, 3);
    assert.ok(!solid('retreat', { wall: 'side', u: 3, v: 3 }) && solid('retreat', win) && view.position.z === -0.27, 'the opening moves with the window');
    canvas.emit('pointerdown', on(saved(win.id))); canvas.emit('pointermove', on({ ...win, u: 1.8 })); advance(2); room.cancelDrag(); advance(2);
    assert.ok(!solid('retreat', { wall: 'side', u: 3, v: 3 }), 'a cancelled drag opens it again');
    // A refused drop reopens the window where it was, and the new walls cast shadows.
    const refusedAt = on({ wall: 'back', u: -2.7, v: 3.3 });
    canvas.emit('pointerdown', on(saved(win.id))); canvas.emit('pointermove', refusedAt); advance(2); canvas.emit('pointerup', refusedAt); advance(2);
    const casters = () => scene.getLightByName('window-sun').getShadowGenerator().getShadowMap().renderList;
    assert.equal(saved(win.id).u, 3); assert.ok(!solid('retreat', { wall: 'side', u: 3, v: 3 }), 'a refused drop reopens the window where it was');
    assert.ok(casters().includes(wallMesh('retreat', 'side')) && casters().includes(wallMesh('retreat', 'back')) && !casters().some(mesh => mesh.isDisposed()), 'the rebuilt walls are in the shadow map');
    room.selectItem(win.id); room.removeSelection(); advance(2);
    assert.ok(solid('retreat', { wall: 'side', u: 3, v: 3 }), 'a removed window leaves solid wall');
    // The other shells cut their facings too: Sakura's shoji and the metro bricks.
    for (const [presetId, style, wall] of [['sakura-studio', 'sakura', 'side'], ['midnight-metro', 'metro', 'side'], ['cloud-loft', 'cloud', 'back']]) {
      const round = { id: `round-${presetId}`, type: 'round-window', wall, u: wall === 'side' ? 2 : 1.4, v: 3 };
      room.setLayout({ presetId, items: [desk, round], activeDeskId: desk.id, v: 2 }); advance(3);
      // Every room also keeps its pet bed.
      assert.equal(diagnostics().layout.items.filter(item => item.type !== 'pet-bed').length, 2, `${presetId} takes the window`);
      assert.ok(!solid(style, round) && solid(style, { ...round, u: round.u + 1.2 }), `${presetId} cuts its wall and facing for a window`);
    }
    room.setEditMode(false); room.setLayout(beforeDesignLayout); advance(3);
    console.log('PASS windows: real openings in walls and facings, the room view behind, closed while dragged, moved on drop, reopened on cancel, closed on removal, walls cast shadows and views never.');
  }
  {
    // A chosen color builds only its own piece again: the piece wears the new
    // paint, while other pieces and its other parts keep theirs. The room
    // colors, a loaded layout and a room design follow the same rules.
    room.setEditMode(true); room.setLayout(createLayout('ember-library')); advance(3);
    const node = id => scene.transformNodes.find(item => item.metadata?.itemId === id);
    const saved = id => diagnostics().layout.items.find(item => item.id === id);
    const paint = id => {
      const found = new Set();
      for (const mesh of node(id).getChildMeshes()) {
        if (mesh.metadata?.effect || mesh.metadata?.dynamic) continue;
        const colors = mesh.getVerticesData('color') || [];
        for (let i = 0; i < colors.length; i += 4) found.add([0, 1, 2].map(c => Math.round(colors[i + c] * 255).toString(16).padStart(2, '0')).join(''));
      }
      return found;
    };
    room.selectItem('ember-sofa'); const first = node('ember-sofa'), saves = changes.length;
    const meshCount = scene.meshes.length, materialCount = scene.materials.length;
    room.setTint('moss'); advance(2);
    assert.equal(saved('ember-sofa').tint, 'moss'); assert.equal(changes.length, saves + 1, 'a color is one save');
    assert.ok(first.isDisposed() && node('ember-sofa') !== first, 'the daybed is built again');
    assert.ok(paint('ember-sofa').has('667a5f') && !paint('ember-sofa').has('785965') && paint('ember-sofa').has('654939'), 'the daybed wears moss velvet on walnut legs');
    assert.ok(paint('ember-chair').has('83968a'), 'the lounge chair keeps its sage');
    assert.equal(diagnostics().selectedId, 'ember-sofa', 'the daybed stays selected');
    assert.equal(scene.meshes.length, meshCount); assert.equal(scene.materials.length, materialCount, 'no new meshes or materials');
    const casters = () => scene.getLightByName('window-sun').getShadowGenerator().getShadowMap().renderList;
    assert.ok(node('ember-sofa').getChildMeshes().filter(mesh => mesh.metadata?.castShadow !== false && !mesh.metadata?.effect).every(mesh => casters().includes(mesh)) && !casters().some(mesh => mesh.isDisposed()), 'the new daybed casts shadows');
    // The same color again, an unknown color, and a piece without choices change nothing.
    const moss = node('ember-sofa'), mossSaves = changes.length;
    room.setTint('moss'); room.setTint('teal'); room.selectItem('ember-hearth'); room.setTint('moss'); advance(2);
    assert.equal(changes.length, mossSaves); assert.equal(node('ember-sofa'), moss); assert.ok(!('tint' in saved('ember-hearth')));
    // Room colors give the model paint back; a loaded layout builds its colors.
    room.selectItem('ember-sofa'); room.setTint(null); advance(2);
    assert.ok(!('tint' in saved('ember-sofa')) && paint('ember-sofa').has('785965'), 'room colors');
    const loaded = createLayout('ember-library'); loaded.items.find(item => item.id === 'ember-sofa').tint = 'rose'; loaded.items.find(item => item.id === 'ember-lamp').tint = 'navy';
    room.setLayout(loaded); advance(2);
    assert.ok(paint('ember-sofa').has('a87478') && paint('ember-lamp').has('636c89'), 'a loaded layout wears its colors');
    // A room design repaints the rest; the chosen color stays the same.
    room.setLayout(createLayout('sakura-studio')); advance(3);
    room.selectItem('sakura-studio-green-sofa'); room.setTint('moss'); advance(2);
    const sakura = paint('sakura-studio-green-sofa');
    assert.ok(sakura.has('667a5f') && sakura.has('9e8772') && !sakura.has('ba9595'), 'moss velvet in Sakura, on Sakura legs');
    room.setTint(null); advance(2); assert.ok(paint('sakura-studio-green-sofa').has('ba9595'), 'Sakura velvet again');
    room.setEditMode(false); room.setLayout(beforeDesignLayout); advance(3);
    console.log('PASS colors: a chosen color rebuilds only its piece, keeps selection, shadows and asset counts, ignores repeats and unknown colors, and follows loaded layouts and room designs.');
  }
  {
    // A room's walls and floor wear its choices. The retreat repaints its paint
    // materials; a shell builds its walls again in the new paint and repaints
    // only the floor's part of its baked paint. Every choice names paint that
    // its design uses, windows still cut painted walls, and each room keeps its own.
    const counts = mesh => { const colors = mesh.getVerticesData('color') || [], found = new Map(); for (let i = 0; i < colors.length; i += 4) { const hex = '#' + [0, 1, 2].map(c => Math.round(colors[i + c] * 255).toString(16).padStart(2, '0')).join(''); found.set(hex, (found.get(hex) || 0) + 1); } return found; };
    const hexOf = mat => mat.diffuseColor.toHexString().toLowerCase(), paintOf = hex => scene.getMaterialByName(`paint-${hex}:{}`);
    const casters = () => scene.getLightByName('window-sun').getShadowGenerator().getShadowMap().renderList;
    const through = (mesh, spot) => { const origin = spot.wall === 'back' ? new Vector3(spot.u, spot.v, -3) : new Vector3(-4.5, spot.v, spot.u), direction = spot.wall === 'back' ? new Vector3(0, 0, -1) : new Vector3(-1, 0, 0); return !mesh.intersects(new Ray(origin, direction, 3), false).hit; };
    const choice = (style, kind, id) => SURFACES[style][kind].find(entry => entry.id === id).paint;
    room.setEditMode(true); room.setLayout(createLayout('ember-library')); advance(3);
    const back = () => scene.getMeshByName('retreat-back-wall'), side = () => scene.getMeshByName('retreat-side-wall');
    for (const kind of ['walls', 'floor']) for (const entry of SURFACES.retreat[kind].slice(1)) for (const hex of Object.keys(entry.paint)) assert.ok(paintOf(hex), `the retreat paints with ${hex}`);
    const assets = [scene.meshes.length, scene.materials.length], saves = changes.length;
    room.setSurface('walls', 'rose'); room.setSurface('floor', 'walnut'); advance(2);
    assert.equal(changes.length, saves + 2, 'each choice is one save'); assert.equal(diagnostics().layout.walls, 'rose'); assert.equal(diagnostics().layout.floor, 'walnut');
    assert.ok(hexOf(back().material) === '#b28e88' && hexOf(side().material) === '#ddcdb9', 'rose and linen walls');
    for (const kind of ['walls', 'floor']) for (const [from, to] of Object.entries(choice('retreat', kind, kind === 'walls' ? 'rose' : 'walnut'))) assert.equal(hexOf(paintOf(from)), to, `${from} is ${to}`);
    assert.deepEqual([scene.meshes.length, scene.materials.length], assets, 'no new meshes or materials');
    room.setSurface('walls', 'teal'); room.setSurface('floor', 'walnut'); room.setSurface('carpet', 'walnut'); advance(2);
    assert.equal(changes.length, saves + 2, 'repeats and unknown choices change nothing');
    // A window cuts the painted wall, and the rebuilt wall keeps its paint.
    const win = { id: 'paint-window', type: 'cottage-window', wall: 'side', u: 2, v: 3 };
    room.setLayout({ presetId: 'ember-library', items: [desk, win], activeDeskId: desk.id, v: 2, walls: 'rose', floor: 'walnut' }); advance(3);
    assert.ok(through(side(), win) && hexOf(side().material) === '#ddcdb9' && casters().includes(side()), 'the window cuts the linen wall');
    room.setSurface('walls', null); room.setSurface('floor', null); advance(2);
    assert.ok(hexOf(back().material) === '#80917d' && hexOf(paintOf('#855b43')) === '#855b43' && !('walls' in diagnostics().layout), 'back to sage and honey oak');
    for (const [presetId, style, walls, floor] of [['sakura-studio', 'sakura', 'matcha', 'fresh'], ['cloud-loft', 'cloud', 'mint', 'butter'], ['midnight-metro', 'metro', 'painted', 'clay']]) {
      room.setLayout(createLayout(presetId)); advance(3);
      const wallsMesh = () => scene.getMeshByName(`${style}-walls`), body = () => scene.getMeshByName(`${style}-architecture`);
      const designWalls = counts(wallsMesh()), designBody = counts(body()), shellAssets = [scene.meshes.length, scene.materials.length];
      for (const entry of SURFACES[style].walls.slice(1)) for (const hex of Object.keys(entry.paint)) assert.ok(designWalls.has(hex), `${style} walls use ${hex}`);
      for (const entry of SURFACES[style].floor.slice(1)) for (const hex of Object.keys(entry.paint)) assert.ok(designBody.has(hex), `${style} floor uses ${hex}`);
      room.setSurface('walls', walls); room.setSurface('floor', floor); advance(2);
      const paintedWalls = counts(wallsMesh()), paintedBody = counts(body());
      for (const [from, to] of Object.entries(choice(style, 'walls', walls))) assert.ok(paintedWalls.get(to) === designWalls.get(from) && !paintedWalls.has(from), `${style} walls: ${from} → ${to}`);
      // A floor color moves to its new paint; any other part in that color keeps it.
      for (const [from, to] of Object.entries(choice(style, 'floor', floor))) assert.ok(paintedBody.get(to) > 0 && (paintedBody.get(from) || 0) + paintedBody.get(to) === designBody.get(from) + (designBody.get(to) || 0), `${style} floor: ${from} → ${to}`);
      for (const [hex, count] of designBody) if (!(hex in choice(style, 'floor', floor)) && !Object.values(choice(style, 'floor', floor)).includes(hex)) assert.equal(paintedBody.get(hex), count, `${style} keeps ${hex}`);
      assert.ok(casters().includes(wallsMesh()) && !casters().some(mesh => mesh.isDisposed()), `${style} walls cast shadows`);
      assert.deepEqual([scene.meshes.length, scene.materials.length], shellAssets, `${style} adds no meshes or materials`);
      // A window cuts the painted walls, which keep their paint.
      const round = { id: `paint-${style}`, type: 'round-window', wall: style === 'cloud' ? 'back' : 'side', u: style === 'cloud' ? 1.4 : 2, v: 3 };
      room.setLayout({ presetId, items: [desk, round], activeDeskId: desk.id, v: 2, walls, floor }); advance(3);
      assert.ok(through(wallsMesh(), round) && [...Object.values(choice(style, 'walls', walls))].some(hex => counts(wallsMesh()).has(hex)), `${style} cuts its painted walls`);
      room.setSurface('walls', null); room.setSurface('floor', null); advance(2);
      assert.ok(counts(wallsMesh()).has(Object.keys(choice(style, 'walls', walls))[0]) && counts(body()).get(Object.keys(choice(style, 'floor', floor))[0]) === designBody.get(Object.keys(choice(style, 'floor', floor))[0]), `${style} as designed again`);
    }
    // Another room keeps its own: the retreat after a painted Sakura is as designed.
    room.setLayout({ ...createLayout('sakura-studio'), walls: 'matcha', floor: 'fresh' }); advance(3);
    room.setLayout(createLayout('ember-library')); advance(3);
    assert.ok(hexOf(back().material) === '#80917d' && hexOf(paintOf('#92654a')) === '#92654a', 'the retreat keeps its design');
    room.setEditMode(false); room.setLayout(beforeDesignLayout); advance(3);
    console.log('PASS walls and floors: retreat paint materials, shell walls built again and floor paint in place, real design colors, windows through painted walls, shadows, asset counts and rooms that keep their own.');
  }
  doc.hidden = true; doc.emit('visibilitychange'); assert.equal(frames.size, 0);
  doc.hidden = false; doc.emit('visibilitychange'); assert.ok(frames.size <= 1);
  room.dispose(); assert.equal(frames.size, 0); assert.equal(motion.listenerCount, 0); assert.equal(doc.listenerCount, 0); assert.equal(canvas.listenerCount, 0); assert.equal(win.listenerCount, 0);
  assert.ok(observer.disconnected && intersection.disconnected && canvas.removed && scene.isDisposed);
  console.log('PASS lifecycle: hidden suspension; scene, frames, observers and listeners disposed.');
  {
    // A 30 Hz display (a phone low-power mode) is not a slow GPU: resolution stays.
    motion.matches = false;
    const container30 = { clientWidth: 800, clientHeight: 600, appendChild(child) { this.canvas = child; } };
    const room30 = createRoom(container30, { engineFactory(surface) {
      const capped = new NullEngine({ renderWidth: 800, renderHeight: 600, textureSize: 512, deterministicLockstep: true, lockstepMaxSteps: 1 });
      capped._renderingCanvas = surface; const setSize = capped.setSize.bind(capped);
      capped.setSize = (w, h, force) => { capped._options.renderWidth = w; capped._options.renderHeight = h; return setSize(w, h, force); };
      return capped;
    } });
    room30.diagnostics().scene.isReady = () => true;
    for (let i = 0; i < 30 * 15; i++) { time += 1000 / 30 - 1000 / 60; advance(); }
    assert.equal(room30.diagnostics().pixelRatio, 1.5, 'a 30 Hz screen keeps full resolution');
    room30.dispose(); assert.equal(frames.size, 0);
    console.log('PASS capped displays: a 30 Hz screen keeps full resolution instead of reading as a slow GPU.');
  }
  console.log('Babylon room checks passed. GPU appearance and native gestures require browser checks.');
} catch (error) { room.dispose(); throw error; }
finally { if (originalClockDescriptor) Object.defineProperty(performance, 'now', originalClockDescriptor); else delete performance.now; }
