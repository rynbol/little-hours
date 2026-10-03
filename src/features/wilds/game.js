import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TargetCamera } from '@babylonjs/core/Cameras/targetCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color4 } from '@babylonjs/core/Maths/math.color.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline.js';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration.js';
import { ColorCurves } from '@babylonjs/core/Materials/colorCurves.js';
import { createPainterly } from '../../models/painterly.js';
import { renderRatioCeiling } from '../../core/render-scale.js';
import { clockNow } from '../../core/test-pins.js';
import { VALLEY } from '../../core/wilds/valley.js';
import { hourAt, msAtHour, skyAt, NAMED_HOURS } from '../../core/wilds/sky-clock.js';
import { createBody, stepBody } from '../../core/wilds/motion.js';
import { createRig, frameRig, orbitRig, zoomRig } from '../../core/wilds/camera-rig.js';
import { createWalkWorld } from '../../core/wilds/world.js';
import { walkDecks, siteColliders } from '../../core/wilds/sites.js';
import { createSky } from '../../models/wilds/sky.js';
import { createAir } from '../../models/wilds/air.js';
import { surveyValley, createTerrain } from '../../models/wilds/terrain.js';
import { createStandIn } from '../../models/wilds/stand-in.js';
import { createGrass } from '../../models/wilds/grass.js';
import { createWind } from '../../models/wilds/wind.js';
import { createInput } from './input.js';

const START_HOUR = 17.2;

export function createWildsGame(canvas, options) {
  const engine = new Engine(canvas, true, { stencil: true, powerPreference: 'high-performance', antialias: false }, false);
  engine.setHardwareScalingLevel(1 / renderRatioCeiling(window.devicePixelRatio, engine.getGlInfo?.()?.renderer));
  const scene = new Scene(engine);
  scene.clearColor = new Color4(.05, .06, .1, 1);
  scene.skipPointerMovePicking = true;

  const camera = new TargetCamera('wilds-camera', new Vector3(VALLEY.vista.x, 34, VALLEY.vista.z - 6), scene);
  camera.minZ = .12; camera.maxZ = 9000; camera.fov = 1.02;
  camera.setTarget(new Vector3(VALLEY.vista.x + 30, 18, VALLEY.vista.z + 160));
  const lookAt = new Vector3();

  const key = new DirectionalLight('wilds-key', new Vector3(-.6, -.4, .6), scene);
  const ambient = new HemisphericLight('wilds-ambient', new Vector3(0, 1, 0), scene);
  const painterly = createPainterly(scene, 'day');
  painterly.state.look = .62;
  painterly.setDepth(1e6, 2e6, -1e6, -1e6 + 1);
  const air = createAir(scene);

  const pipeline = new DefaultRenderingPipeline('wilds-post', true, scene, [camera]);
  pipeline.fxaaEnabled = true;
  pipeline.bloomEnabled = true; pipeline.bloomThreshold = .82; pipeline.bloomWeight = .22; pipeline.bloomKernel = 48; pipeline.bloomScale = .5;
  const grade = scene.imageProcessingConfiguration;
  grade.toneMappingEnabled = true; grade.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  grade.contrast = 1.08; grade.vignetteEnabled = true; grade.vignetteWeight = 1.6; grade.vignetteColor = new Color4(.12, .07, .1, 0);
  grade.colorCurvesEnabled = true;
  const curves = grade.colorCurves = new ColorCurves();
  curves.globalSaturation = 12; curves.highlightsHue = 40; curves.highlightsDensity = 18; curves.highlightsSaturation = 20; curves.shadowsHue = 235; curves.shadowsDensity = 22; curves.shadowsSaturation = 18;

  const sky = createSky(scene);
  let terrain = null, failure = null, built = false, paused = false, muted = false, disposed = false, held = null;
  let clockOffset = msAtHour(START_HOUR) - clockNow(), last = clockNow(), sky0 = null;
  let world = null, body = null, rig = createRig(VALLEY.spawn.yaw), player = null, grass = null;
  const wind = createWind(), still = () => Boolean(options.reducedMotion?.matches);
  const input = createInput(canvas, { now: clockNow, onMute: () => { muted = !muted; } });

  const gameMs = () => clockNow() + clockOffset;
  const loading = options.loading;

  surveyValley().then(survey => {
    if (disposed) return;
    terrain = createTerrain(scene, survey);
    const { minX, maxX, minZ, maxZ } = VALLEY.core;
    world = createWalkWorld({ heightAt: survey.grid.heightAt, decks: walkDecks(), colliders: siteColliders(), bounds: { minX: minX + 6, maxX: maxX - 6, minZ: minZ + 6, maxZ: maxZ - 6 } });
    body = createBody({ ...VALLEY.spawn, y: world.ground(VALLEY.spawn.x, VALLEY.spawn.z) });
    player = createStandIn(scene);
    grass = createGrass(scene, survey);
    built = true;
    scene.executeWhenReady(() => loading?.classList.add('is-done'));
  }).catch(error => { failure = error.message; console.error('Could not build the valley:', error); });

  function applySky(state) {
    sky0 = state;
    key.direction.set(-state.key.direction[0], -state.key.direction[1], -state.key.direction[2]);
    key.diffuse.set(...state.key.color); key.intensity = state.key.intensity; key.specular.set(...state.key.color.map(value => value * .4));
    ambient.diffuse.set(...state.ambient.sky); ambient.groundColor.set(...state.ambient.ground); ambient.intensity = state.ambient.intensity;
    air.update(state, gameMs() / 1000);
    painterly.state.shadow = state.shadow; painterly.state.rim = state.rim.map(value => value * .5);
    grade.exposure = state.exposure;
    sky.update(state, gameMs() / 1000);
  }

  function play(dt) {
    const intent = input.sample(rig.yaw, dt);
    rig = zoomRig(orbitRig(rig, intent.orbit.x, intent.orbit.y), intent.zoom);
    for (let left = dt; left > 1e-6; left -= 1 / 60) body = stepBody(body, intent, world, Math.min(left, 1 / 60));
    const view = frameRig(rig, { at: body, sprint: body.gait === 'sprint', steering: intent.steering }, world, dt);
    rig = view.rig;
    camera.position.set(view.eye.x, view.eye.y, view.eye.z);
    camera.setTarget(lookAt.set(view.look.x, view.look.y, view.look.z));
    camera.fov = view.fov;
    player.update(body, dt);
  }

  function frame() {
    const now = clockNow(), dt = Math.min(.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (paused) return;
    if (built && !held) play(dt);
    applySky(skyAt(hourAt(gameMs())));
    wind.update(gameMs() / 1000, { shower: sky0.shower, still: still() });
    grass?.update(camera, {
      wind: wind.uniform(), pushers: body ? [[body.x, body.z, 1.1, body.grounded ? 1 : .35]] : [],
      sun: sky0.key.direction, sunColor: sky0.key.color.map(value => value * sky0.key.intensity), glow: .55,
    });
    scene.render();
  }

  const onVisibility = () => { if (document.hidden) engine.stopRenderLoop(); else { last = clockNow(); engine.runRenderLoop(frame); } };
  document.addEventListener('visibilitychange', onVisibility);
  const onResize = () => engine.resize();
  window.addEventListener('resize', onResize);
  if (!document.hidden) engine.runRenderLoop(frame);

  return {
    ready: () => built && scene.isReady() && !failure,
    get muted() { return muted; },
    toggleMute() { muted = !muted; },
    setPaused(value) { paused = value; input.enabled = !value; last = clockNow(); },
    cancel: () => false,
    setProgress() {},
    setHour(hour) { clockOffset = msAtHour(NAMED_HOURS[hour] ?? hour) - clockNow(); },
    look(at, target) { held = { at, target }; camera.position.set(...at); camera.setTarget(new Vector3(...target)); },
    release() { held = null; },
    place(x, z, yaw = rig.yaw) { body = createBody({ x, z, y: world.ground(x, z), yaw }); rig = { ...createRig(yaw), distance: rig.distance }; held = null; },
    diagnostics: () => ({
      engine, scene, failure, ready: built, now: gameMs(), hour: sky0?.hour ?? null, segment: sky0?.segment ?? null, renderCount: scene.getRenderId(),
      pixelRatio: 1 / engine.getHardwareScalingLevel(), drawCalls: engine._drawCalls?.current ?? 0,
      player: body && { x: body.x, y: body.y, z: body.z, yaw: body.yaw, gait: body.gait, stamina: body.stamina, wading: body.wading, grounded: body.grounded },
      camera: { yaw: rig.yaw, pitch: rig.pitch, reach: rig.reach, x: camera.position.x, y: camera.position.y, z: camera.position.z },
    }),
    dispose() {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      engine.stopRenderLoop();
      input.dispose();
      player?.dispose();
      grass?.dispose();
      terrain?.dispose();
      painterly.dispose();
      air.dispose();
      scene.dispose(); engine.dispose();
    },
  };
}
