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

export function createHouseView(container, { house, selectedId, theme, onSelect, focused = false }) {
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
  const camera = new ArcRotateCamera('cottage-camera', Math.PI / 2.8, 1.08, 24, new Vector3(0, 1.3, 0), scene);
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  const sky = new HemisphericLight('soft-sky', new Vector3(0, 1, 0), scene);
  const sun = new DirectionalLight('afternoon', new Vector3(-1, -2, -1), scene);
  sun.position.set(0, 12, 6);
  const shadows = new ShadowGenerator(1024, sun); shadows.usePercentageCloserFiltering = true; shadows.bias = .002; shadows.normalBias = .02; shadows.darkness = .22;
  shadows.getShadowMap().refreshRate = 0;
  const instrumentation = new SceneInstrumentation(scene);
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motes = MeshBuilder.CreateSphere('cottage-fireflies', { diameter: .045, segments: 3 }, scene);
  const motePaint = new StandardMaterial('cottage-firefly-light', scene); motePaint.disableLighting = true; motePaint.emissiveColor = Color3.FromHexString('#efd6a5'); motes.material = motePaint; motes.isPickable = false;
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
  const homeAngle = Math.PI / 2.8;
  let targetAngle = homeAngle, lastPick = 0, hovering = null, burst = null;
  let model, frame = 0, disposed = false, renderCount = 0, lastDraw = 0;
  function render(now = 0) {
    frame = 0;
    if (disposed || document.hidden) return;
    if (!motion.matches && now - lastDraw < 1000 / 30 - 1) { requestRender(); return; }
    lastDraw = now;
    const seconds = motion.matches ? 0 : now / 1000;
    model.animate(seconds, focused, motion.matches);
    const turning = Math.abs(targetAngle - camera.alpha) > .001;
    if (turning) { camera.alpha = motion.matches ? targetAngle : camera.alpha + (targetAngle - camera.alpha) * .18; fitCamera(); }
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
    const readyBeforeDraw = scene.isReady();
    engine.beginFrame(); scene.render(); engine.endFrame(); renderCount++;
    // A shader may finish after its mesh was skipped during this draw.
    if (!motion.matches || turning || !readyBeforeDraw || !scene.isReady()) requestRender();
  }
  function requestRender() { if (!disposed && !document.hidden && !frame) frame = requestAnimationFrame(render); }
  function resize() {
    if (disposed) return;
    engine.resize();
    fitCamera(); requestRender();
  }
  function fitCamera() {
    // Fit all corners rather than cropping the garden on portrait screens.
    const view = camera.getViewMatrix(true), points = [];
    for (const x of [-6.1, 6.1]) for (const y of [-.8, house.rooms.length === 3 ? 6.4 : 3.7]) for (const z of [-3.3, 3.3]) points.push(Vector3.TransformCoordinates(new Vector3(x, y, z), view));
    const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
    const aspect = Math.max(.1, container.clientWidth / Math.max(1, container.clientHeight));
    const height = Math.max(maxY - minY, (maxX - minX) / aspect) * 1.06;
    const cx = (maxX + minX) / 2, cy = (maxY + minY) / 2;
    camera.orthoLeft = cx - height * aspect / 2; camera.orthoRight = cx + height * aspect / 2;
    camera.orthoTop = cy + height / 2; camera.orthoBottom = cy - height / 2;
  }
  function update(next, selected, atmosphere = theme) {
    house = next; selectedId = selected; theme = atmosphere; model?.dispose();
    sky.intensity = theme === 'dusk' ? .56 : .62; sun.intensity = theme === 'dusk' ? .8 : .95;
    sun.diffuse = Color3.FromHexString(theme === 'dusk' ? '#ead2ab' : '#fff3d9');
    model = createHouseModel(scene, house, selectedId, theme);
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
  const onClick = event => { const id = pick(event); if (id) onSelect(id); };
  const onMove = event => {
    if (performance.now() - lastPick < 55) return;
    lastPick = performance.now(); const id = pick(event);
    if (id === hovering) return;
    hovering = id; canvas.style.cursor = id ? 'pointer' : 'default';
    canvas.title = id ? house.rooms.find(room => room.id === id)?.name || 'A little room to grow' : '';
  };
  const onVisibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else requestRender(); };
  canvas.addEventListener('click', onClick); canvas.addEventListener('pointermove', onMove);
  document.addEventListener('visibilitychange', onVisibility);
  motion.addEventListener('change', requestRender);
  const observer = new ResizeObserver(resize); observer.observe(container);
  update(house, selectedId);
  return {
    update,
    turn(direction) { targetAngle = direction === 0 ? homeAngle : Math.max(.65, Math.min(1.85, targetAngle + direction * .22)); requestRender(); },
    celebrate(id) { burst = { start: performance.now(), origin: HOUSE_POSITIONS[id] || [0, 0, 0] }; requestRender(); },
    async createPostcard(name, caption) {
      // Copy immediately after rendering: WebGL's default buffer need not be
      // preserved between frames (which would cost memory on every visit).
      engine.beginFrame(); scene.render(); engine.endFrame();
      return createHousePostcard(canvas, name, caption, theme);
    },
    setFocused(value) { if (focused === Boolean(value)) return; focused = Boolean(value); requestRender(); },
    diagnostics: () => ({ renderCount, drawCalls: instrumentation.drawCallsCounter.current, triangles: scene.getActiveIndices() / 3 }),
    dispose() { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); motion.removeEventListener('change', requestRender); document.removeEventListener('visibilitychange', onVisibility); canvas.removeEventListener('click', onClick); canvas.removeEventListener('pointermove', onMove); model.dispose(); instrumentation.dispose(); scene.dispose(); engine.dispose(); canvas.remove(); },
  };
}
