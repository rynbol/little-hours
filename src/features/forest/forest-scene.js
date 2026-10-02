import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { buildOutdoorWorld, buildGrassBlades, buildTerrainRings } from '../../models/world/world.js';
import { renderRatioCeiling } from '../../core/render-scale.js';
import { terrainMeshHeight } from '../../models/world/water.js';
import { createIslandRain } from '../house/index.js';
import { FOREST_WALK, createWalker, stepWalk, trunkGrid } from './forest-walk.js';

export const FOREST_VIEW = Object.freeze({ fov: 1.1, near: 0.15, far: 16000, longestStep: 0.1 });
const SKY = Object.freeze({ day: [0.66, 0.78, 0.84], dusk: [0.6, 0.58, 0.56], rain: [0.36, 0.4, 0.36] });
const nextTask = () => new Promise(resolve => setTimeout(resolve, 0));

export function createForestScene(container, { theme = 'day', reducedMotion = false, input, workers, onReady }) {
  const canvas = document.createElement('canvas'); canvas.className = 'forest-canvas'; canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'A path through the forest beyond the island');
  container.appendChild(canvas);
  const engine = new Engine(canvas, true, { stencil: false, powerPreference: 'high-performance' });
  engine.setHardwareScalingLevel(1 / renderRatioCeiling(window.devicePixelRatio, engine.getGlInfo?.()?.renderer));
  const scene = new Scene(engine); scene.useRightHandedSystem = true;
  scene.clearColor = new Color4(...(SKY[theme] || SKY.day), 1);
  scene.skipPointerMovePicking = true; scene.skipPointerDownPicking = true; scene.skipPointerUpPicking = true;
  const heights = new Map(), height = (x, z) => terrainMeshHeight(x, z, undefined, heights);
  const walker = createWalker(FOREST_WALK.start, height), ground = { height, trunks: null };
  const camera = new FreeCamera('forest-walker', new Vector3(walker.x, walker.y, walker.z), scene);
  camera.fov = FOREST_VIEW.fov; camera.minZ = FOREST_VIEW.near; camera.maxZ = FOREST_VIEW.far;
  const place = () => { camera.position.set(walker.x, walker.y, walker.z); camera.rotation.set(walker.pitch, -walker.yaw, 0); };
  place();
  const rain = createIslandRain(scene, theme);
  let world = null, disposed = false, last = performance.now(), drawn = 0, pending = 2;

  const building = Promise.all([buildTerrainRings({ workers }), buildGrassBlades({ workers })]).then(async ([rings, blades]) => {
    const steps = buildOutdoorWorld(scene, { theme, still: reducedMotion, rings, blades });
    while (!disposed) {
      const step = steps.next();
      if (step.done) { world = step.value; ground.trunks = trunkGrid(world.trees); await scene.whenReadyAsync(); pending = 2; if (!disposed) onReady?.(); return; }
      await nextTask();
    }
  });
  building.catch(error => { if (!disposed) console.error('Could not build the forest:', error); });

  engine.runRenderLoop(() => {
    if (disposed || document.hidden || !world) return;
    const now = performance.now(), seconds = Math.min(FOREST_VIEW.longestStep, (now - last) / 1000); last = now;
    const active = input.moving || walker.vx !== 0 || walker.vz !== 0;
    if (active) { stepWalk(walker, input.read(seconds), seconds, ground); place(); pending = 2; }
    if (reducedMotion && pending <= 0) return;
    if (rain.mesh.isEnabled()) rain.animate(now / 1000, engine.getRenderWidth() / engine.getRenderHeight());
    pending--; scene.render(); drawn++;
  });
  const resize = () => { engine.resize(); pending = 2; };
  window.addEventListener('resize', resize);

  return {
    canvas,
    get ready() { return Boolean(world) && scene.isReady(); },
    setTheme(next) { world?.setTheme(next); rain.setTheme(next); scene.clearColor.set(...(SKY[next] || SKY.day), 1); pending = 2; },
    diagnostics: () => ({ scene, engine, camera, drawn, start: FOREST_WALK.start, ready: Boolean(world), walker: { x: walker.x, y: walker.y, z: walker.z, yaw: walker.yaw, pitch: walker.pitch, speed: Math.hypot(walker.vx, walker.vz) }, trees: world?.trees.count ?? 0, raining: rain.mesh.isEnabled() }),
    dispose() {
      disposed = true; window.removeEventListener('resize', resize); engine.stopRenderLoop();
      scene.dispose(); engine.dispose(); canvas.remove();
    },
  };
}
