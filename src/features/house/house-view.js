import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { Camera } from '@babylonjs/core/Cameras/camera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation.js';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js';
import '@babylonjs/core/Meshes/thinInstanceMesh.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import '@babylonjs/core/Culling/ray.js';
import { createHouseModel, HOUSE_POSITIONS } from './house-model.js';
import { gardenPlantName } from '../../core/garden-plants.js';
import { PLANT_SPOTS, gardenPlotAt } from './garden-model.js';
import { RETREAT_SPOTS, RETREAT_BOUNDS, GARDEN_EXIT_TAG, RETREAT_LIGHT } from './garden-retreat.js';
import { createGardenButterflies } from './garden-butterflies.js';
import { GARDEN_TAG } from './house-garden.js';
import { POND_TAG } from './house-pond.js';
import { createStroll } from './house-stroll.js';
import { createHousePostcard } from './house-postcard.js';
import { houseFrame } from './house-framing.js';
import { createHouseMotion } from './house-motion.js';
import { createIslandWater } from './house-water.js';
import { createIslandGrass } from './house-grass.js';
import { createIslandForest } from './island-forest.js';
import { createChimneySmoke } from './house-smoke.js';
import { createIslandRain } from './house-rain.js';
import { createPainterly } from '../../models/painterly.js';
import { ISLAND_ATMOSPHERES, ISLAND_SUN, islandSkyArt } from './island-atmosphere.js';
import { nextExpansion, roomDisplayName } from '../../core/house.js';
import { renderRatioCeiling } from '../../core/render-scale.js';
import './whole-house.css';

const PIN_ICONS = {
  island: '<path d="M16 5 7 12l9 7M7 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  room: '<path d="M5 20V10.5L12 5l7 5.5V20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 20v-5.5h4V20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  loft: '<path d="M5 19h4v-4h4v-4h4V7h2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  garden: '<path d="M12 20v-8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 13c0-4 2.5-6.5 6.5-6.5 0 4-2.5 6.5-6.5 6.5ZM12 15.5c0-3-2-5-5.5-5 0 3 2 5 5.5 5Z" fill="currentColor"/>',
  pond: '<path d="M4.5 12c2.2-3.2 5.3-4.6 8.6-4.6 2.3 0 4.4 1.3 5.4 3.1L21 8.4v7.2l-2.5-2.1c-1 1.8-3.1 3.1-5.4 3.1-3.3 0-6.4-1.4-8.6-4.6Z" fill="currentColor"/><circle cx="8.7" cy="11.2" r="1.1" fill="var(--pin-bg, #fff)"/>',
  site: '<path d="M12 6v12M6 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
};

export function createHouseView(container, { house, selectedId, theme, avatar, onSelect, focused = false }) {
  const backdrop = document.createElement('div'); backdrop.className = 'island-sky'; backdrop.setAttribute('aria-hidden', 'true');
  if (container.id === 'house-canvas') container.appendChild(backdrop);
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Your miniature cottage. Choose a room or building site. Use the room navigation to choose with a keyboard.');
  container.appendChild(canvas);
  const engine = new Engine(canvas, true, { alpha: true, stencil: false, powerPreference: 'low-power' });
  engine.setHardwareScalingLevel(1 / renderRatioCeiling(window.devicePixelRatio, engine.getGlInfo?.()?.renderer));
  const scene = new Scene(engine); scene.useRightHandedSystem = true; scene.clearColor = new Color4(0, 0, 0, 0);
  const painterly = createPainterly(scene, theme);
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType = 1;
  scene.imageProcessingConfiguration.exposure = 1.12;
  scene.imageProcessingConfiguration.contrast = 1.12;
  scene.skipPointerMovePicking = true; scene.skipPointerDownPicking = true; scene.skipPointerUpPicking = true;
  const camera = new ArcRotateCamera('cottage-camera', Math.PI / 2.8, 1.02, 32, new Vector3(0, 1.3, 0), scene);
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA; camera.minZ = .1; camera.maxZ = 100;
  scene.doNotHandleCursors = true;
  const sky = new HemisphericLight('soft-sky', new Vector3(0, 1, 0), scene);
  sky.groundColor = Color3.FromHexString('#a0a7a4');
  const sun = new DirectionalLight('afternoon', Vector3.FromArray(ISLAND_SUN.direction).normalize(), scene);
  sun.position.copyFrom(sun.direction.scale(-16));
  const shadows = new ShadowGenerator(2048, sun); shadows.usePercentageCloserFiltering = true; shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM; shadows.bias = .002; shadows.normalBias = .02; shadows.darkness = ISLAND_SUN.darkness;
  shadows.getShadowMap().refreshRate = 0;
  const gardenRing = MeshBuilder.CreateTorus('garden-selected-bed', { diameter: 2.27, thickness: .04, tessellation: 64 }, scene);
  const ringPaint = new StandardMaterial('garden-selected-bed-paint', scene); ringPaint.diffuseColor = Color3.FromHexString('#e7d6a1'); ringPaint.emissiveColor = Color3.FromHexString('#7e7d43'); ringPaint.specularColor.setAll(0); gardenRing.material = ringPaint; gardenRing.scaling.z = .82; gardenRing.isPickable = false; gardenRing.setEnabled(false);
  let gardenPlot = null;
  const instrumentation = new SceneInstrumentation(scene);
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const roomMotion = createHouseMotion(HOUSE_POSITIONS);
  let layoutKeys = new Map();
  const motes = MeshBuilder.CreateSphere('cottage-fireflies', { diameter: .045, segments: 3 }, scene);
  const motePaint = new StandardMaterial('cottage-firefly-light', scene); motePaint.disableLighting = true; motePaint.emissiveColor = Color3.FromHexString('#efd6a5'); motes.material = motePaint; motes.isPickable = false;
  const smoke = createChimneySmoke(scene, theme), smokeAt = new Vector3(), smokeLocal = new Vector3();
  const rain = createIslandRain(scene, theme);
  const water = createIslandWater(scene, theme);
  const grass = createIslandGrass(scene, theme);
  const forest = createIslandForest(scene, theme);
  const butterflies = createGardenButterflies(scene);
  const moteMatrices = new Float32Array(24 * 16);
  for (let i = 0; i < 24; i++) { const n = i * 16; moteMatrices[n] = moteMatrices[n + 5] = moteMatrices[n + 10] = moteMatrices[n + 15] = 1; }
  motes.thinInstanceSetBuffer('matrix', moteMatrices, 16, false); motes.alwaysSelectAsActiveMesh = true;
  const sparkles = MeshBuilder.CreateSphere('homecoming-petals', { diameter: .11, segments: 3 }, scene);
  const petalPaint = new StandardMaterial('homecoming-petal-paint', scene);
  petalPaint.diffuseColor = Color3.FromHexString('#f2c8b3'); petalPaint.emissiveColor = Color3.FromHexString('#815c54');
  sparkles.material = petalPaint; sparkles.isPickable = false; sparkles.alwaysSelectAsActiveMesh = true;
  const petals = new Float32Array(36 * 16);
  for (let i = 0; i < 36; i++) petals[i * 16 + 15] = 1;
  sparkles.thinInstanceSetBuffer('matrix', petals, 16, false); sparkles.setEnabled(false);
  const controls = document.createElement('div'); controls.className = 'house-camera-controls';
  controls.innerHTML = `<div class="house-camera-group"><button type="button" data-house-open aria-pressed="true">Close the house</button></div>`;
  container.appendChild(controls);
  const tags = document.createElement('div'); tags.className = 'house-room-tags'; container.appendChild(tags);
  const note = document.createElement('span'); note.className = 'house-camera-note'; container.appendChild(note);
  const tagPoint = new Vector3(), tagProjection = new Vector3();
  let dragging = null;
  const homeAngle = Math.PI / 2.8;
  const turnTo = angle => Math.max(-.3, Math.min(2.45, angle)), tiltTo = beta => Math.max(.72, Math.min(1.3, beta));
  let targetAngle = homeAngle, targetTilt = 1.02, lastPick = 0, hovering = null, burst = null;
  let stroll = null, strollKey = '';
  let model, frame = 0, disposed = false, suspended = false, renderCount = 0, builds = 0, lastDraw = 0;
  // The whole house opens like a dollhouse front. It arrives closed, unless motion is reduced.
  const arrival = () => motion.matches ? 0 : performance.now() + 650;
  let closed = false, openAt = arrival(), lastOpenStep = 0;
  function stepOpen(now) {
    const dt = lastOpenStep ? Math.min(.1, (now - lastOpenStep) / 1000) : 0; lastOpenStep = now;
    const target = !closed && now >= openAt ? 1 : 0, amount = model.openAmount;
    if (amount === target) return !closed && now < openAt;
    model.setOpen(motion.matches ? target : amount < target ? Math.min(target, amount + dt / 1.1) : Math.max(target, amount - dt / .7));
    shadows.getShadowMap().resetRefreshCounter(); fitCamera();
    return true;
  }
  function render(now = 0) {
    frame = 0;
    if (disposed || suspended || document.hidden) return;
    const dt = lastDraw ? Math.min(.1, (now - lastDraw) / 1000) : 0;
    // Motion you cause runs at 60 fps; the idle drift stays at 30.
    const lively = dragging?.moved || Math.abs(targetAngle - camera.alpha) > .001 || Math.abs(targetTilt - camera.beta) > .001 || roomMotion.activeCount > 0 || model.openAmount !== (!closed && now >= openAt ? 1 : 0);
    if (!motion.matches && now - lastDraw < 1000 / (lively ? 60 : 30) - 1) { requestRender(); return; }
    lastDraw = now;
    const seconds = motion.matches ? 0 : now / 1000;
    const wasReacting = roomMotion.activeCount > 0;
    roomMotion.restore();
    model.animate(seconds, focused, motion.matches); water.animate(seconds, camera); grass.animate(seconds); forest.animate(seconds); butterflies.animate(seconds, selectedId === 'orchard' && !motion.matches);
    for (const root of model.live) root.metadata.avatar?.setEnabled(focused);
    stroll.setVisible(!focused || selectedId === 'orchard');
    if (!focused || selectedId === 'orchard') stroll.animate(seconds, motion.matches, selectedId === 'orchard' ? focused ? 'garden-rest' : 'garden' : 'island');
    const turning = Math.abs(targetAngle - camera.alpha) > .001 || Math.abs(targetTilt - camera.beta) > .001;
    if (turning) {
      const ease = motion.matches || dragging?.moved ? 0 : Math.exp(-dt * 11);
      camera.alpha = targetAngle + (camera.alpha - targetAngle) * ease; camera.beta = targetTilt + (camera.beta - targetTilt) * ease; fitCamera();
    }
    const reacting = roomMotion.update(now, motion.matches);
    const swinging = stepOpen(now);
    if (reacting || wasReacting) { shadows.getShadowMap().resetRefreshCounter(); positionTags(); }
    const age = burst ? (now - burst.start) / 1000 : 5;
    sparkles.setEnabled(Boolean(burst) && age < 2.8 && !motion.matches);
    if (sparkles.isEnabled()) {
      for (let i = 0; i < 36; i++) {
        const n = i * 16, a = i * 2.399, spread = .5 + age * (.7 + i % 4 * .17), scale = Math.max(0, 1 - age / 2.8);
        petals[n] = .6 * scale; petals[n + 5] = 1.4 * scale; petals[n + 10] = scale;
        petals[n + 12] = burst.origin[0] + Math.cos(a) * spread;
        petals[n + 13] = burst.origin[1] + 2 + age * (2 + i % 3 * .3) - 1.35 * age * age;
        petals[n + 14] = burst.origin[2] + Math.sin(a) * spread;
      }
      sparkles.thinInstanceBufferUpdated('matrix');
    } else if (burst) burst = null;
    motes.setEnabled(!motion.matches);
    for (let i = 0; i < 24; i++) {
      const n = i * 16;
      moteMatrices[n + 12] = (selectedId === 'orchard' ? -4.5 + (i * .73 % 9) : -5 + (i * 1.73 % 10)) + Math.sin(seconds * .32 + i) * .18;
      moteMatrices[n + 13] = .5 + (i * .71 % (house.rooms.length === 3 ? 5 : 2.5)) + Math.sin(seconds * .48 + i * 2) * .17;
      moteMatrices[n + 14] = selectedId === 'orchard' ? -3.8 + (i * .43 % 7) : -1.4 + (i * .83 % 4);
    }
    motes.thinInstanceBufferUpdated('matrix');
    smoke.mesh.setEnabled(Boolean(model.chimney) && !motion.matches && selectedId !== 'orchard');
    if (smoke.mesh.isEnabled()) {
      smokeLocal.fromArray(model.chimney.point); Vector3.TransformCoordinatesToRef(smokeLocal, model.chimney.node.getWorldMatrix(), smokeAt);
      smoke.animate(seconds, smokeAt, camera);
    }
    if (rain.mesh.isEnabled()) rain.animate(seconds, engine.getRenderWidth() / engine.getRenderHeight());
    const readyBeforeDraw = scene.isReady();
    engine.beginFrame(); scene.render(); engine.endFrame(); renderCount++;
    // A shader may finish after its mesh was skipped during this draw.
    if (!motion.matches || turning || reacting || swinging || !readyBeforeDraw || !scene.isReady()) requestRender();
  }
  function requestRender() { if (!disposed && !suspended && !document.hidden && !frame) frame = requestAnimationFrame(render); }
  function resize() {
    if (disposed || suspended) return;
    engine.resize();
    backdrop.hidden = selectedId === 'orchard';
    if (backdrop.isConnected && !backdrop.hidden) backdrop.innerHTML = islandSkyArt(theme, Math.max(1, window.innerWidth), Math.max(1, window.innerHeight));
    if (model) { roomMotion.restore(); present(); }
  }
  function fitCamera() {
    if (!model) return;
    const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight);
    const garden = selectedId === 'orchard', phone = width <= 700 || (width <= 1000 && height > 650);
    const bottom = garden ? 230 : 0;
    const left = garden ? 18 : 0, top = garden ? phone ? 100 : 76 : 0;
    const usableWidth = Math.max(180, width - left * 2);
    const usableHeight = Math.max(130, height - top - bottom);
    const frame = houseFrame(garden ? RETREAT_BOUNDS : [...model.framing, forest.framing], camera.getViewMatrix(true), usableWidth / usableHeight, garden ? .95 : .92);
    const scale = frame.height / usableHeight;
    camera.orthoLeft = frame.x - usableWidth * scale / 2 - left * scale; camera.orthoRight = camera.orthoLeft + width * scale;
    camera.orthoTop = frame.y + frame.height / 2 + top * scale; camera.orthoBottom = camera.orthoTop - height * scale;
    camera.getProjectionMatrix(true); positionTags();
  }
  function positionTags() {
    const width = container.clientWidth, height = container.clientHeight, matrix = camera.getTransformationMatrix();
    for (const button of tags.children) {
      const id = button.dataset.room;
      const plot = /^plot-[0-5]$/.test(id) ? Number(id.slice(5)) : null;
      button.hidden = (id === 'garden-exit' || plot !== null) !== (selectedId === 'orchard');
      const base = HOUSE_POSITIONS[id], offset = model.levels[id]?.position;
      if (plot !== null) { const [x, z] = RETREAT_SPOTS[plot]; tagPoint.set(x + .65, .52, z + .54); }
      else if (!base) tagPoint.set(...(id === 'garden-exit' ? GARDEN_EXIT_TAG : id === 'pond' ? POND_TAG : GARDEN_TAG));
      else tagPoint.set(base[0] + offset.x, base[1] + offset.y - .15 + (button.classList.contains('is-site') ? 1.6 : id === 'loft' ? .7 : 0), base[2] + offset.z + 2.08);
      Vector3.TransformCoordinatesToRef(tagPoint, matrix, tagProjection);
      const half = Math.min(24, width / 4);
      button.style.left = `${Math.max(half, Math.min(width - half, (tagProjection.x + 1) * width / 2))}px`;
      button.style.top = `${Math.max(52, Math.min(height - 12, (1 - tagProjection.y) * height / 2))}px`;
    }
  }
  function present() {
    roomMotion.restore();
    const toggle = controls.querySelector('[data-house-open]');
    toggle.setAttribute('aria-pressed', String(!closed)); toggle.textContent = closed ? 'Open the house' : 'Close the house';
    note.textContent = closed ? 'Drag to turn · open the house to peek inside' : 'Drag to turn · choose a room to step inside';
    shadows.getShadowMap().resetRefreshCounter(); fitCamera(); requestRender();
  }
  // Close the whole house (the postcard look), or open it again.
  function setClosed(value) { closed = Boolean(value); openAt = 0; lastOpenStep = 0; present(); }
  function turn(direction) { if (direction === 0) { targetAngle = homeAngle; targetTilt = 1.02; } else targetAngle = turnTo(targetAngle + direction * .22); requestRender(); }
  controls.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.houseOpen !== undefined) setClosed(!closed);
  });
  tags.addEventListener('click', event => { const button = event.target.closest('button'); if (button) onSelect(button.dataset.room); });
  function update(next, selected, atmosphere = theme, appearance = avatar) {
    const previousSelection = selectedId, hadModel = Boolean(model);
    canvas.setAttribute('aria-label', selected === 'orchard' ? 'Your miniature garden. Tap a flower bed to choose a plant, or choose a marker with your keyboard.' : 'Your miniature cottage. Choose a room or building site. Use the room navigation to choose with a keyboard.');
    roomMotion.stop();
    house = next; selectedId = selected; theme = atmosphere; avatar = appearance;
    water.mesh.setEnabled(selectedId !== 'orchard');
    grass.mesh.setEnabled(container.id === 'house-canvas' && selectedId !== 'orchard');
    forest.setEnabled(selectedId !== 'orchard');
    gardenRing.setEnabled(selectedId === 'orchard' && gardenPlot !== null); if (gardenPlot !== null) gardenRing.position.set(RETREAT_SPOTS[gardenPlot][0], .18, RETREAT_SPOTS[gardenPlot][1]);
    const island = container.id === 'house-canvas' && selectedId !== 'orchard', light = island ? ISLAND_ATMOSPHERES[theme] : selectedId === 'orchard' ? RETREAT_LIGHT[theme]
      : { sky: '#ffffff', ground: '#a0a7a4', sun: theme === 'dusk' ? '#ead2ab' : '#fff3d9', fill: theme === 'dusk' ? .56 : .62, key: theme === 'dusk' ? .8 : .95 };
    sky.intensity = light.fill; sun.intensity = light.key;
    sky.diffuse = Color3.FromHexString(light.sky); sky.groundColor = Color3.FromHexString(light.ground);
    sun.diffuse = Color3.FromHexString(light.sun); water.setTheme(theme); smoke.setTheme(theme); rain.setTheme(theme);
    painterly.setTheme(theme); grass.setTheme(theme); forest.setTheme(theme);
    const previous = model;
    builds++;
    model = createHouseModel(scene, house, selectedId, theme, avatar, previous);
    previous?.dispose();
    roomMotion.bind(model);
    const nextStroll = JSON.stringify([avatar, house.pet]);
    if (nextStroll !== strollKey) { strollKey = nextStroll; stroll?.dispose(); stroll = createStroll(scene, avatar, house.pet || 'cat'); }
    if (!motion.matches) {
      house.rooms.forEach((entry, index) => {
        const key = JSON.stringify(entry.layout);
        const kind = !hadModel ? 'arrive' : layoutKeys.get(entry.id) !== key ? 'design' : selectedId !== previousSelection && entry.id === selectedId ? 'select' : null;
        if (kind) roomMotion.trigger(entry.id, kind, performance.now(), hadModel ? 0 : index * 110);
      });
    }
    layoutKeys = new Map(house.rooms.map(entry => [entry.id, JSON.stringify(entry.layout)]));
    tags.replaceChildren();
    for (const entry of house.rooms) {
      const here = entry.id === house.activeId;
      const button = pin('button', entry.id === 'loft' ? 'loft' : 'room', entry.id, roomDisplayName(entry), here ? 'You’re here' : entry.id === 'loft' ? 'Upstairs' : 'Ground floor');
      button.setAttribute('aria-label', `Visit ${roomDisplayName(entry)}`); button.setAttribute('aria-current', here ? 'location' : 'false');
    }
    if (selectedId === 'orchard') {
      pin('button', 'island', 'garden-exit', 'Island').setAttribute('aria-label', 'Back to island');
      RETREAT_SPOTS.forEach((_, index) => {
        const plant = house.plants?.find(item => item.slot === index), button = pin('button', plant ? 'garden' : 'site', `plot-${index}`, plant ? gardenPlantName(plant) : 'Plant a seed');
        button.id = `garden-spot-${index}`; button.classList.add('garden-bed-pin');
        button.setAttribute('aria-label', `Spot ${index + 1}, ${plant ? gardenPlantName(plant) : 'empty'}`);
        button.setAttribute('aria-pressed', String(gardenPlot === index));
      });
    }
    pin('button', 'garden', 'orchard', 'Garden').classList.add('is-garden');
    const pond = pin('button', 'pond', 'pond', 'Willow Pond', 'Go fishing'); pond.classList.add('is-pond'); pond.setAttribute('aria-label', 'Go fishing at Willow Pond');
    // The blueprint's tag: what grows next and how close it is.
    const site = nextExpansion(house);
    if (site && container.id === 'house-canvas') {
      const button = pin('button', 'site', site.id, `${site.short} · ${Math.min(house.coins, site.price)} / ${site.price}`, 'Room to grow'); button.classList.add('is-site');
      button.setAttribute('aria-label', `Plan ${site.label}, ${Math.min(house.coins, site.price)} of ${site.price} coins`);
    }
    for (const mesh of model.meshes) mesh.receiveShadows = true;
    // Babylon removes disposed casters from this list. Keep it separate from
    // model.meshes so disposal cannot skip every other room batch.
    shadows.getShadowMap().renderList = model.meshes.filter(mesh => mesh.isEnabled());
    shadows.getShadowMap().resetRefreshCounter(); resize();
  }
  function pin(tag, icon, id, title, note) {
    const element = document.createElement(tag); element.className = 'house-room-tag'; element.dataset.room = id;
    if (tag === 'button') element.type = 'button';
    element.innerHTML = `<span class="house-pin" aria-hidden="true"><svg viewBox="0 0 24 24">${PIN_ICONS[icon]}</svg></span><span class="house-pin-label">${note ? '<small></small>' : ''}<strong></strong></span>`;
    element.querySelector('strong').textContent = title;
    if (note) element.querySelector('small').textContent = note;
    tags.appendChild(element); return element;
  }
  function pick(event) {
    const rect = canvas.getBoundingClientRect();
    // Babylon converts CSS pixels to render pixels using hardware scaling.
    const hit = scene.pick(event.clientX - rect.left, event.clientY - rect.top);
    const slot = hit?.pickedMesh?.metadata?.houseSlot;
    const plot = slot === 'orchard' && hit.pickedPoint ? gardenPlotAt(hit.pickedPoint.x, hit.pickedPoint.z, selectedId === 'orchard' ? RETREAT_SPOTS : PLANT_SPOTS, selectedId === 'orchard' ? 1.05 : .6) : -1;
    return plot >= 0 ? `plot-${plot}` : slot;
  }
  const onDown = event => { if (event.button !== 0 || dragging) return; dragging = { id: event.pointerId, x: event.clientX, y: event.clientY, angle: targetAngle, tilt: targetTilt, moved: false }; };
  const onUp = event => {
    const gesture = dragging; if (!gesture || gesture.id !== event.pointerId) return; dragging = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    canvas.style.cursor = 'grab';
    if (!gesture.moved) { const id = pick(event); if (id) onSelect(id); }
  };
  const onCancel = () => { dragging = null; canvas.style.cursor = 'grab'; };
  const onLeave = () => { if (!dragging?.moved) onCancel(); };
  const onMove = event => {
    if (dragging && dragging.id === event.pointerId) {
      const dx = event.clientX - dragging.x, dy = event.clientY - dragging.y;
      if (!dragging.moved && Math.hypot(dx, dy) < 6) return;
      if (!dragging.moved && event.pointerType === 'touch' && Math.abs(dy) > Math.abs(dx)) { onCancel(); return; }
      dragging.moved = true; canvas.setPointerCapture(event.pointerId); canvas.style.cursor = 'grabbing';
      targetAngle = turnTo(dragging.angle - dx * .004); targetTilt = tiltTo(dragging.tilt - dy * .003); requestRender(); return;
    }
    if (performance.now() - lastPick < 55) return;
    lastPick = performance.now(); const id = pick(event);
    if (id === hovering) return;
    hovering = id; canvas.style.cursor = id ? 'pointer' : 'grab';
    const room = house.rooms.find(room => room.id === id);
    canvas.title = id?.startsWith('plot-') ? gardenPlantName(house.plants?.find(plant => plant.slot === Number(id.slice(5)))) : id === 'garden-exit' ? 'Back to island' : id === 'orchard' ? 'Your garden' : id === 'pond' ? 'Willow Pond' : id ? room ? roomDisplayName(room) : 'A little room to grow' : '';
  };
  const onVisibility = () => { if (document.hidden) { onCancel(); roomMotion.stop(); shadows.getShadowMap().resetRefreshCounter(); cancelAnimationFrame(frame); frame = 0; } else requestRender(); };
  window.addEventListener('blur', onCancel); canvas.addEventListener('lostpointercapture', onCancel); canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onCancel); canvas.addEventListener('pointerleave', onLeave); canvas.addEventListener('pointermove', onMove);
  document.addEventListener('visibilitychange', onVisibility);
  const onMotionChange = () => { roomMotion.stop(); shadows.getShadowMap().resetRefreshCounter(); requestRender(); };
  motion.addEventListener('change', onMotionChange);
  const observer = new ResizeObserver(resize); observer.observe(container);
  update(house, selectedId);
  return {
    update,
    turn,
    selectGardenPlot(index) { gardenPlot = index; tags.querySelectorAll('.garden-bed-pin').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.room === `plot-${index}`))); if (index !== null) gardenRing.position.set(RETREAT_SPOTS[index][0], .18, RETREAT_SPOTS[index][1]); gardenRing.setEnabled(selectedId === 'orchard' && index !== null); requestRender(); },
    celebrate(id) { if (!motion.matches) roomMotion.trigger(id, 'build', performance.now()); burst = { start: performance.now(), origin: (HOUSE_POSITIONS[id] || [0, 0, 0]).map((v, i) => v + (model.levels[id]?.position.asArray()[i] || 0)) }; requestRender(); },
    async createPostcard(name, caption) {
      // Copy immediately after rendering: WebGL's default buffer need not be
      // preserved between frames (which would cost memory on every visit).
      engine.beginFrame(); scene.render(); engine.endFrame();
      return createHousePostcard(canvas, name, caption, theme, selectedId !== 'orchard');
    },
    setClosed,
    // Keep the house built while its page is away; it arrives closed again.
    setSuspended(value) {
      if (suspended === Boolean(value)) return;
      suspended = Boolean(value); cancelAnimationFrame(frame); frame = 0; onCancel();
      if (suspended) { roomMotion.stop(); return; }
      closed = false; openAt = arrival(); lastOpenStep = 0; lastDraw = 0; model.setOpen(motion.matches ? 1 : 0);
      if (!motion.matches) house.rooms.forEach((entry, index) => roomMotion.trigger(entry.id, 'arrive', performance.now(), index * 110));
      resize();
    },
    setFocused(value) { if (focused === Boolean(value)) return; focused = Boolean(value); requestRender(); },
    diagnostics: () => ({ scene, engine, closed, builds, angle: camera.alpha, tilt: camera.beta, turning: Math.abs(targetAngle - camera.alpha) > .001 || Math.abs(targetTilt - camera.beta) > .001, trees: model.trees, plots: selectedId === 'orchard' ? RETREAT_SPOTS : PLANT_SPOTS, stroll: focused && selectedId !== 'orchard' ? null : stroll?.pose, strollPet: focused && selectedId !== 'orchard' ? null : stroll?.pet, activeRoomMotions: roomMotion.activeCount, open: model.openAmount, renderCount, drawCalls: instrumentation.drawCallsCounter.current, triangles: scene.getActiveIndices() / 3 }),
    dispose() { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); motion.removeEventListener('change', onMotionChange); roomMotion.dispose(); document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('blur', onCancel); canvas.removeEventListener('lostpointercapture', onCancel); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onCancel); canvas.removeEventListener('pointerleave', onLeave); canvas.removeEventListener('pointermove', onMove); stroll?.dispose(); model.dispose(); grass.dispose(); forest.dispose(); painterly.dispose(); instrumentation.dispose(); scene.dispose(); engine.dispose(); canvas.remove(); backdrop.remove(); controls.remove(); tags.remove(); note.remove(); },
  };
}
