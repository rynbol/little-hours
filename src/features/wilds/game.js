import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera.js';
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
import { createSky } from '../../models/wilds/sky.js';
import { surveyValley, createTerrain } from '../../models/wilds/terrain.js';

const START_HOUR = 17.2;

export function createWildsGame(canvas, options) {
  const engine = new Engine(canvas, true, { stencil: true, powerPreference: 'high-performance', antialias: false }, false);
  engine.setHardwareScalingLevel(1 / renderRatioCeiling(window.devicePixelRatio, engine.getGlInfo?.()?.renderer));
  const scene = new Scene(engine);
  scene.clearColor = new Color4(.05, .06, .1, 1);
  scene.skipPointerMovePicking = true;
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = .00042;

  const camera = new UniversalCamera('wilds-camera', new Vector3(VALLEY.vista.x, 34, VALLEY.vista.z - 6), scene);
  camera.minZ = .12; camera.maxZ = 9000; camera.fov = 1.02;
  camera.setTarget(new Vector3(VALLEY.vista.x + 30, 18, VALLEY.vista.z + 160));

  const key = new DirectionalLight('wilds-key', new Vector3(-.6, -.4, .6), scene);
  const ambient = new HemisphericLight('wilds-ambient', new Vector3(0, 1, 0), scene);
  const painterly = createPainterly(scene, 'day');
  painterly.state.look = .62;
  painterly.setDepth(260, 2600, -20, 40);

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
  let terrain = null, failure = null, built = false, paused = false, muted = false, disposed = false;
  let clockOffset = msAtHour(START_HOUR) - clockNow(), last = clockNow(), sky0 = null;

  const gameMs = () => clockNow() + clockOffset;
  const loading = options.loading;

  surveyValley().then(survey => {
    if (disposed) return;
    terrain = createTerrain(scene, survey);
    built = true;
    scene.executeWhenReady(() => loading?.classList.add('is-done'));
  }).catch(error => { failure = error.message; console.error('Could not build the valley:', error); });

  function applySky(state) {
    sky0 = state;
    key.direction.set(-state.key.direction[0], -state.key.direction[1], -state.key.direction[2]);
    key.diffuse.set(...state.key.color); key.intensity = state.key.intensity; key.specular.set(...state.key.color.map(value => value * .4));
    ambient.diffuse.set(...state.ambient.sky); ambient.groundColor.set(...state.ambient.ground); ambient.intensity = state.ambient.intensity;
    scene.fogColor.set(...state.fog);
    scene.fogDensity = .00026 + state.haze * .00034 + state.shower * .0012;
    painterly.state.haze = state.fog; painterly.state.shadow = state.shadow; painterly.state.rim = state.rim.map(value => value * .5);
    grade.exposure = state.exposure;
    sky.update(state, gameMs() / 1000);
  }

  function frame() {
    const now = clockNow(), dt = Math.min(.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (paused) return;
    applySky(skyAt(hourAt(gameMs())));
    scene.render();
    return dt;
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
    setPaused(value) { paused = value; last = clockNow(); },
    cancel: () => false,
    setProgress() {},
    setHour(hour) { clockOffset = msAtHour(NAMED_HOURS[hour] ?? hour) - clockNow(); },
    look(at, target) { camera.position.set(...at); camera.setTarget(new Vector3(...target)); },
    diagnostics: () => ({ engine, scene, failure, ready: built, now: gameMs(), hour: sky0?.hour ?? null, segment: sky0?.segment ?? null, renderCount: scene.getRenderId(), pixelRatio: 1 / engine.getHardwareScalingLevel(), drawCalls: engine._drawCalls?.current ?? 0 }),
    dispose() {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      engine.stopRenderLoop();
      terrain?.dispose();
      painterly.dispose();
      scene.dispose(); engine.dispose();
    },
  };
}
