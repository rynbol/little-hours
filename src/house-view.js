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
import { createHousePostcard } from './house-postcard.js';
import { houseFrame } from './house-framing.js';
import { createHouseMotion } from './house-motion.js';
import { nextExpansion } from './house.js';
import './whole-house.css';

export function createHouseView(container, { house, selectedId, theme, avatar, onSelect, focused = false }) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Your miniature cottage. Choose a room or building site. Use the room navigation to choose with a keyboard.');
  container.appendChild(canvas);
  const engine = new Engine(canvas, true, { alpha: true, stencil: false, powerPreference: 'low-power' });
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));
  const scene = new Scene(engine); scene.useRightHandedSystem = true; scene.clearColor = new Color4(0, 0, 0, 0);
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType = 1;
  scene.imageProcessingConfiguration.exposure = 1.12;
  scene.skipPointerMovePicking = true; scene.skipPointerDownPicking = true; scene.skipPointerUpPicking = true;
  const camera = new ArcRotateCamera('cottage-camera', Math.PI / 2.8, 1.02, 32, new Vector3(0, 1.3, 0), scene);
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA; camera.minZ = .1; camera.maxZ = 100;
  scene.doNotHandleCursors = true;
  const sky = new HemisphericLight('soft-sky', new Vector3(0, 1, 0), scene);
  const sun = new DirectionalLight('afternoon', new Vector3(-1, -2, -1), scene);
  sun.position.set(0, 12, 6);
  const shadows = new ShadowGenerator(1024, sun); shadows.usePercentageCloserFiltering = true; shadows.bias = .002; shadows.normalBias = .02; shadows.darkness = .22;
  shadows.getShadowMap().refreshRate = 0;
  const instrumentation = new SceneInstrumentation(scene);
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const roomMotion = createHouseMotion(HOUSE_POSITIONS);
  let layoutKeys = new Map();
  const motes = MeshBuilder.CreateSphere('cottage-fireflies', { diameter: .045, segments: 3 }, scene);
  const motePaint = new StandardMaterial('cottage-firefly-light', scene); motePaint.disableLighting = true; motePaint.emissiveColor = Color3.FromHexString('#efd6a5'); motes.material = motePaint; motes.isPickable = false;
  // A few soft puffs of chimney smoke, one draw call, animated with the motes.
  const smoke = MeshBuilder.CreateSphere('cottage-smoke', { diameter: .5, segments: 8 }, scene);
  const smokePaint = new StandardMaterial('cottage-smoke-paint', scene); smokePaint.disableLighting = true; smokePaint.emissiveColor = Color3.FromHexString('#f3ebe2'); smokePaint.alpha = .3; smoke.material = smokePaint; smoke.isPickable = false;
  const smokeMatrices = new Float32Array(5 * 16), smokeAt = new Vector3(), smokeLocal = new Vector3();
  smoke.thinInstanceSetBuffer('matrix', smokeMatrices, 16, false); smoke.alwaysSelectAsActiveMesh = true;
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
  controls.innerHTML = `<div class="house-camera-group"><button type="button" data-house-open aria-pressed="true">Close the house</button></div>${container.id === 'house-in-room' ? '<div class="house-camera-group" role="group" aria-label="House angle"><button type="button" class="house-camera-turn" data-turn="-1" aria-label="Turn house left">↶</button><button type="button" data-turn="0" aria-label="Reset house view">Recenter</button><button type="button" class="house-camera-turn" data-turn="1" aria-label="Turn house right">↷</button></div>' : ''}`;
  container.appendChild(controls);
  const tags = document.createElement('div'); tags.className = 'house-room-tags'; container.appendChild(tags);
  const note = document.createElement('span'); note.className = 'house-camera-note'; container.appendChild(note);
  const tagPoint = new Vector3(), tagProjection = new Vector3();
  let dragging = null;
  const homeAngle = Math.PI / 2.8;
  let targetAngle = homeAngle, lastPick = 0, hovering = null, burst = null;
  let model, frame = 0, disposed = false, suspended = false, renderCount = 0, lastDraw = 0;
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
    const lively = dragging?.moved || Math.abs(targetAngle - camera.alpha) > .001 || roomMotion.activeCount > 0 || model.openAmount !== (!closed && now >= openAt ? 1 : 0);
    if (!motion.matches && now - lastDraw < 1000 / (lively ? 60 : 30) - 1) { requestRender(); return; }
    lastDraw = now;
    const seconds = motion.matches ? 0 : now / 1000;
    const wasReacting = roomMotion.activeCount > 0;
    roomMotion.restore();
    model.animate(seconds, focused, motion.matches);
    const turning = Math.abs(targetAngle - camera.alpha) > .001;
    if (turning) { camera.alpha = motion.matches || dragging?.moved ? targetAngle : targetAngle + (camera.alpha - targetAngle) * Math.exp(-dt * 11); fitCamera(); }
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
      moteMatrices[n + 12] = -5 + (i * 1.73 % 10) + Math.sin(seconds * .32 + i) * .18;
      moteMatrices[n + 13] = .5 + (i * .71 % (house.rooms.length === 3 ? 5 : 2.5)) + Math.sin(seconds * .48 + i * 2) * .17;
      moteMatrices[n + 14] = -1.4 + (i * .83 % 4);
    }
    motes.thinInstanceBufferUpdated('matrix');
    smoke.setEnabled(Boolean(model.chimney) && !motion.matches);
    if (smoke.isEnabled()) {
      smokeLocal.fromArray(model.chimney.point); Vector3.TransformCoordinatesToRef(smokeLocal, model.chimney.node.getWorldMatrix(), smokeAt);
      for (let i = 0; i < 5; i++) {
        const n = i * 16, t = (seconds * .16 + i / 5) % 1, size = .6 + t * 1.5;
        smokeMatrices[n] = smokeMatrices[n + 5] = smokeMatrices[n + 10] = size * Math.min(1, t * 6) * (1 - t * .55); smokeMatrices[n + 15] = 1;
        smokeMatrices[n + 12] = smokeAt.x + Math.sin(t * 5 + i) * .12 + t * .5; smokeMatrices[n + 13] = smokeAt.y + t * 1.9; smokeMatrices[n + 14] = smokeAt.z - t * .2;
      }
      smoke.thinInstanceBufferUpdated('matrix');
    }
    const readyBeforeDraw = scene.isReady();
    engine.beginFrame(); scene.render(); engine.endFrame(); renderCount++;
    // A shader may finish after its mesh was skipped during this draw.
    if (!motion.matches || turning || reacting || swinging || !readyBeforeDraw || !scene.isReady()) requestRender();
  }
  function requestRender() { if (!disposed && !suspended && !document.hidden && !frame) frame = requestAnimationFrame(render); }
  function resize() {
    if (disposed || suspended) return;
    engine.resize();
    if (model) { roomMotion.restore(); present(); }
  }
  function fitCamera() {
    if (!model) return;
    const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight);
    const frame = houseFrame(model.framing, camera.getViewMatrix(true), width / height, .92);
    const halfWidth = frame.height * width / height / 2;
    camera.orthoLeft = frame.x - halfWidth; camera.orthoRight = frame.x + halfWidth;
    camera.orthoTop = frame.y + frame.height / 2; camera.orthoBottom = frame.y - frame.height / 2;
    camera.getProjectionMatrix(true); positionTags();
  }
  function positionTags() {
    const width = container.clientWidth, height = container.clientHeight, matrix = camera.getTransformationMatrix();
    for (const button of tags.children) {
      const id = button.dataset.room, base = HOUSE_POSITIONS[id], offset = model.levels[id].position;
      tagPoint.set(base[0] + offset.x, base[1] + offset.y - .15 + (button.classList.contains('is-site') ? 1.6 : 0), base[2] + offset.z + 2.08);
      Vector3.TransformCoordinatesToRef(tagPoint, matrix, tagProjection);
      const half = Math.min(90, width / 4);
      button.style.left = `${Math.max(half, Math.min(width - half, (tagProjection.x + 1) * width / 2))}px`;
      button.style.top = `${Math.max(52, Math.min(height - 57, (1 - tagProjection.y) * height / 2 + 5))}px`;
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
  function turn(direction) { targetAngle = direction === 0 ? homeAngle : Math.max(.65, Math.min(1.45, targetAngle + direction * .22)); requestRender(); }
  controls.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.houseOpen !== undefined) setClosed(!closed);
    if (button.dataset.turn !== undefined) turn(Number(button.dataset.turn));
  });
  tags.addEventListener('click', event => { const button = event.target.closest('button'); if (button) onSelect(button.dataset.room); });
  function update(next, selected, atmosphere = theme, appearance = avatar) {
    const previousSelection = selectedId, hadModel = Boolean(model);
    roomMotion.stop();
    house = next; selectedId = selected; theme = atmosphere; avatar = appearance;
    sky.intensity = theme === 'dusk' ? .56 : .62; sun.intensity = theme === 'dusk' ? .8 : .95;
    sun.diffuse = Color3.FromHexString(theme === 'dusk' ? '#ead2ab' : '#fff3d9');
    const previous = model;
    model = createHouseModel(scene, house, selectedId, theme, avatar, previous);
    previous?.dispose();
    roomMotion.bind(model);
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
      const button = document.createElement('button'); button.type = 'button'; button.className = 'house-room-tag'; button.dataset.room = entry.id;
      button.setAttribute('aria-label', `Visit ${entry.name}`); button.setAttribute('aria-current', entry.id === house.activeId ? 'location' : 'false');
      const level = document.createElement('small'); level.textContent = entry.id === 'loft' ? 'Upstairs' : entry.id === house.activeId ? 'You’re here' : 'Ground floor';
      const name = document.createElement('strong'); name.textContent = entry.name; button.append(level, name); tags.appendChild(button);
    }
    // The blueprint's tag: what grows next and how close it is.
    const site = nextExpansion(house);
    if (site && container.id === 'house-canvas') {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'house-room-tag is-site'; button.dataset.room = site.id;
      button.setAttribute('aria-label', `Plan ${site.label}, ${Math.min(house.coins, site.price)} of ${site.price} coins`);
      const level = document.createElement('small'); level.textContent = 'Room to grow';
      const name = document.createElement('strong'); name.textContent = `${site.short} · ${Math.min(house.coins, site.price)} / ${site.price}`;
      button.append(level, name); tags.appendChild(button);
    }
    for (const mesh of model.meshes) mesh.receiveShadows = true;
    // Babylon removes disposed casters from this list. Keep it separate from
    // model.meshes so disposal cannot skip every other room batch.
    shadows.getShadowMap().renderList = [...model.meshes];
    shadows.getShadowMap().resetRefreshCounter(); resize();
  }
  function pick(event) {
    const rect = canvas.getBoundingClientRect();
    // Babylon converts CSS pixels to render pixels using hardware scaling.
    return scene.pick(event.clientX - rect.left, event.clientY - rect.top)?.pickedMesh?.metadata?.houseSlot;
  }
  const onDown = event => { if (event.button !== 0 || dragging) return; dragging = { id: event.pointerId, x: event.clientX, y: event.clientY, angle: targetAngle, moved: false }; };
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
      targetAngle = Math.max(.65, Math.min(1.45, dragging.angle - dx * .004)); requestRender(); return;
    }
    if (performance.now() - lastPick < 55) return;
    lastPick = performance.now(); const id = pick(event);
    if (id === hovering) return;
    hovering = id; canvas.style.cursor = id ? 'pointer' : 'grab';
    canvas.title = id ? house.rooms.find(room => room.id === id)?.name || 'A little room to grow' : '';
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
    celebrate(id) { if (!motion.matches) roomMotion.trigger(id, 'build', performance.now()); burst = { start: performance.now(), origin: (HOUSE_POSITIONS[id] || [0, 0, 0]).map((v, i) => v + (model.levels[id]?.position.asArray()[i] || 0)) }; requestRender(); },
    async createPostcard(name, caption) {
      // Copy immediately after rendering: WebGL's default buffer need not be
      // preserved between frames (which would cost memory on every visit).
      engine.beginFrame(); scene.render(); engine.endFrame();
      return createHousePostcard(canvas, name, caption, theme);
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
    diagnostics: () => ({ activeRoomMotions: roomMotion.activeCount, open: model.openAmount, renderCount, drawCalls: instrumentation.drawCallsCounter.current, triangles: scene.getActiveIndices() / 3 }),
    dispose() { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); motion.removeEventListener('change', onMotionChange); roomMotion.dispose(); document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('blur', onCancel); canvas.removeEventListener('lostpointercapture', onCancel); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onCancel); canvas.removeEventListener('pointerleave', onLeave); canvas.removeEventListener('pointermove', onMove); model.dispose(); instrumentation.dispose(); scene.dispose(); engine.dispose(); canvas.remove(); controls.remove(); tags.remove(); note.remove(); },
  };
}
