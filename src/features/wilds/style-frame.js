import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { clockNow } from '../../core/test-pins.js';
import { createWildsWorld, wildsAtmosphere } from '../../models/wilds/world.js';
import { loadStyleActors, STYLE_ACTOR_DEFINITIONS } from '../../models/wilds/style-actors.js';

export const STYLE_COMPOSITION = Object.freeze({
  avatar: Object.freeze({ x: -129.82, z: -212.16, yaw: .18 }),
  cat: Object.freeze({ x: -128.7, z: -212.1, yaw: .34 }),
  warden: Object.freeze({ x: -131.24, z: -216.62, yaw: .14 }),
});
export const STYLE_FRAME_PRESETS = Object.freeze({
  group: Object.freeze({ x: -131.4, z: -214.5, targetHeight: 1.2, distance: 10.5, elevation: 3.2, fov: .58, yaw: .62 }),
  avatar: Object.freeze({ targetHeight: .88, distance: 4.5, elevation: 1.1, fov: .53 }),
  cat: Object.freeze({ targetHeight: .32, distance: 2.3, elevation: .53, fov: .55 }),
  warden: Object.freeze({ targetHeight: 1.5, distance: 7.8, elevation: 1.85, fov: .55 }),
});
const ANGLES = Object.freeze({ front: 0, 'three-quarter': .62, side: Math.PI / 2 });
const DEFAULTS = { createWorld: createWildsWorld, loadActors: loadStyleActors, createRain: (...args) => import('../house/index.js').then(module => module.createIslandRain(...args)) };

export function createWildsStyleView(engine, canvas, state, now = clockNow, dependencies = DEFAULTS, { presentation: initialPresentation = {} } = {}) {
  dependencies = { ...DEFAULTS, ...dependencies };
  const owner = canvas.ownerDocument, host = owner.defaultView;
  const scene = new Scene(engine), instrumentation = new SceneInstrumentation(scene);
  const drawCalls = instrumentation.drawCallsCounter;
  scene.useRightHandedSystem = true;
  scene.skipPointerMovePicking = true;
  const camera = new FreeCamera('wilds-style-camera', new Vector3(-125, -27, -205), scene);
  camera.minZ = .04; camera.maxZ = 30000;
  const framingTarget = new Vector3(-131.4, -30, -214.5);
  camera.setTarget(framingTarget);
  scene.activeCamera = camera;
  const still = host.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const controller = new AbortController();
  let world, actors, rain, failure = null, loaded = false, phase = 'suspended', renderCount = 0, readyFrames = 0, at = now();
  let current = { subject: 'group', angle: 'three-quarter', theme: ['day', 'dusk', 'rain'].includes(state.theme) ? state.theme : 'day', actors: true, backdrop: 'forest', ...initialPresentation };
  scene.clearColor = Color4.FromHexString(`${wildsAtmosphere(current.theme).horizon}ff`);

  function frameCamera() {
    if (current.camera) {
      camera.position.copyFromFloats(...current.camera.position);
      framingTarget.copyFromFloats(...current.camera.target);
      camera.setTarget(framingTarget);
      camera.fov = current.camera.fov ?? .58;
      return;
    }
    const subject = STYLE_ACTOR_DEFINITIONS[current.subject] ? current.subject : 'group';
    const preset = STYLE_FRAME_PRESETS[subject];
    const position = subject === 'group' ? preset : STYLE_COMPOSITION[subject];
    const ground = world.surfaceAt(position.x, position.z)?.height ?? 0;
    const yaw = subject === 'group' ? ANGLES[current.angle] : position.yaw + ANGLES[current.angle];
    const target = new Vector3(position.x, ground + preset.targetHeight, position.z);
    camera.position.set(position.x + Math.sin(yaw) * preset.distance, ground + preset.elevation, position.z + Math.cos(yaw) * preset.distance);
    framingTarget.copyFrom(target);
    camera.setTarget(framingTarget);
    camera.fov = preset.fov;
  }

  function present(next = {}) {
    if (!loaded || phase === 'disposed') return false;
    if (next.subject !== undefined && !['group', 'scenery', ...Object.keys(STYLE_ACTOR_DEFINITIONS)].includes(next.subject)) return false;
    if (next.angle !== undefined && !Object.hasOwn(ANGLES, next.angle)) return false;
    if (next.backdrop !== undefined && !['forest', 'portrait'].includes(next.backdrop)) return false;
    if (next.theme !== undefined && !['day', 'dusk', 'rain'].includes(next.theme)) return false;
    if (next.camera && (!['position', 'target'].every(key => Array.isArray(next.camera[key]) && next.camera[key].length === 3 && next.camera[key].every(Number.isFinite)) || next.camera.fov !== undefined && (!Number.isFinite(next.camera.fov) || next.camera.fov <= 0 || next.camera.fov >= Math.PI))) return false;
    current = { ...current, ...next };
    world.setTheme(current.theme);
    actors.setTheme(current.theme);
    actors.setSubject(current.actors && current.subject !== 'scenery' ? current.subject : 'scenery', { shadows: current.backdrop === 'forest' });
    world.root?.setEnabled(current.backdrop === 'forest');
    rain.setTheme(current.backdrop === 'forest' ? current.theme : 'day');
    scene.clearColor = Color4.FromHexString(current.backdrop === 'portrait' ? '#dfd7caff' : `${wildsAtmosphere(current.theme).horizon}ff`);
    frameCamera();
    return true;
  }

  const initialization = Promise.allSettled([
    Promise.resolve().then(() => dependencies.createWorld(scene, { theme: current.theme, still, signal: controller.signal })),
    Promise.resolve().then(() => dependencies.loadActors(scene, { theme: current.theme, signal: controller.signal })),
    Promise.resolve().then(() => dependencies.createRain(scene, current.theme)),
  ]).then(results => {
    const rejected = results.find(result => result.status === 'rejected');
    if (phase === 'disposed' || rejected) {
      for (const result of results) if (result.status === 'fulfilled') result.value.dispose();
      if (rejected && phase !== 'disposed') failure = rejected.reason?.message || String(rejected.reason);
      return;
    }
    [world, actors, rain] = results.map(result => result.value);
    actors.place(STYLE_COMPOSITION, world.surfaceAt);
    loaded = true;
    present();
  }).catch(error => {
    failure = error.message; loaded = false;
    actors?.dispose(); world?.dispose(); rain?.dispose();
    actors = world = rain = null;
  });

  function render() {
    if (phase !== 'running' || owner.hidden) return;
    at = now();
    if (rain?.mesh.isEnabled()) rain.animate(still ? 0 : at / 1000, engine.getRenderWidth() / engine.getRenderHeight());
    scene.render();
    renderCount++;
    if (loaded) readyFrames++;
  }
  function visibility() {
    if (phase === 'disposed') return;
    const next = owner.hidden ? 'suspended' : 'running';
    if (phase === next) return;
    phase = next;
    if (phase === 'running') engine.runRenderLoop(render);
    else engine.stopRenderLoop(render);
  }
  function resize() { if (phase !== 'disposed') engine.resize(); }
  const observer = new host.ResizeObserver(resize);
  observer.observe(canvas.parentElement);
  host.addEventListener('resize', resize); owner.addEventListener('visibilitychange', visibility);
  visibility();

  return {
    initialization,
    ready: () => phase !== 'disposed' && loaded && readyFrames > 0 && scene.isReady(),
    presentation: present,
    diagnostics: () => ({ engine, scene, camera, phase, failure, loaded, still, renderCount, now: at, drawCalls: drawCalls.current, pixelRatio: 1 / engine.getHardwareScalingLevel(), presentation: { ...current }, cameraState: { position: camera.position.asArray(), target: framingTarget.asArray(), fov: camera.fov }, actors: actors?.diagnostics(), world: world?.diagnostics(), styleFrame: true }),
    dispose() {
      if (phase === 'disposed') return;
      phase = 'disposed'; loaded = false; controller.abort();
      observer.disconnect(); host.removeEventListener('resize', resize); owner.removeEventListener('visibilitychange', visibility);
      engine.stopRenderLoop(render);
      actors?.dispose(); world?.dispose(); rain?.dispose(); instrumentation.dispose(); scene.dispose(); engine.dispose(); canvas.remove();
    },
  };
}

export function enterWildsStyle(container, state, options = {}) {
  const canvas = container.ownerDocument.createElement('canvas');
  canvas.id = 'wilds-style-canvas';
  canvas.setAttribute('aria-label', 'The Wilds Forest style frame');
  Object.assign(canvas.style, { display: 'block', width: '100%', height: '100%' });
  container.append(canvas);
  let engine;
  try {
    engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: false });
    engine.setHardwareScalingLevel(1 / Math.min(2, container.ownerDocument.defaultView.devicePixelRatio || 1));
    return createWildsStyleView(engine, canvas, state, undefined, undefined, options);
  } catch (error) {
    engine?.dispose(); canvas.remove(); throw error;
  }
}
