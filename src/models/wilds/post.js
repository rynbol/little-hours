import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline.js';
import '@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent.js';

export const WILDS_POST = Object.freeze({ samples: 4, bloom: Object.freeze({ threshold: 0.82, kernel: 56, scale: 0.5 }) });

export function createWildsPost(scene, { atmosphere }) {
  const pipeline = new DefaultRenderingPipeline('wilds-post', true, scene, []);
  pipeline.imageProcessingEnabled = false;
  pipeline.samples = WILDS_POST.samples;
  pipeline.bloomEnabled = true; pipeline.bloomThreshold = WILDS_POST.bloom.threshold; pipeline.bloomKernel = WILDS_POST.bloom.kernel; pipeline.bloomScale = WILDS_POST.bloom.scale;
  let lit = null;
  function attach(camera) {
    if (camera === lit) return;
    if (lit) pipeline.removeCamera(lit);
    lit = camera;
    if (camera) pipeline.addCamera(camera);
  }
  const watch = scene.onActiveCameraChanged.add(() => attach(scene.activeCamera));
  attach(scene.activeCamera);
  const setTheme = next => { pipeline.bloomWeight = next.bloom; };
  setTheme(atmosphere);
  return { pipeline, setTheme, cameras: () => (lit ? [lit.name] : []), dispose() { scene.onActiveCameraChanged.remove(watch); lit = null; pipeline.dispose(); } };
}
