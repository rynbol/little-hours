import { Scene } from '@babylonjs/core/scene.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { clockNow } from '../../core/test-pins.js';

const SKY = { day: '#BFD9E8', dusk: '#D3B7C9', rain: '#A2B2BD' };

export function createWildsView(engine, canvas, state, now = clockNow) {
  const owner = canvas.ownerDocument, host = owner.defaultView;
  const scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  scene.clearColor = Color4.FromHexString(`${SKY[state.theme] || SKY.day}FF`);
  scene.skipPointerMovePicking = true;
  const camera = new FreeCamera('wilds-camera', new Vector3(0, 2.2, 6.5), scene);
  camera.setTarget(new Vector3(0, 1.2, 0));
  camera.minZ = .1;
  camera.maxZ = 4000;
  let phase = 'suspended', renderCount = 0, previousAt = null, elapsedMs = 0, deltaMs = 0, at = now();

  function render() {
    if (phase !== 'running' || owner.hidden) return;
    at = now();
    deltaMs = previousAt === null ? 0 : Math.max(0, Math.min(100, at - previousAt));
    previousAt = at;
    elapsedMs += deltaMs;
    scene.render();
    renderCount++;
  }

  function visibility() {
    if (phase === 'disposed') return;
    const next = owner.hidden ? 'suspended' : 'running';
    if (phase === next) return;
    phase = next;
    previousAt = null;
    deltaMs = 0;
    if (phase === 'running') engine.runRenderLoop(render);
    else engine.stopRenderLoop(render);
  }

  function resize() {
    if (phase !== 'disposed') engine.resize();
  }

  const observer = new host.ResizeObserver(resize);
  observer.observe(canvas.parentElement);
  host.addEventListener('resize', resize);
  owner.addEventListener('visibilitychange', visibility);
  visibility();

  return {
    ready: () => phase !== 'disposed' && renderCount > 0 && scene.isReady(),
    diagnostics: () => ({ engine, scene, camera, phase, renderCount, now: at, elapsedMs, deltaMs, drawCalls: engine._drawCalls.current, pixelRatio: 1 / engine.getHardwareScalingLevel() }),
    dispose() {
      if (phase === 'disposed') return;
      phase = 'disposed';
      observer.disconnect();
      host.removeEventListener('resize', resize);
      owner.removeEventListener('visibilitychange', visibility);
      engine.stopRenderLoop(render);
      scene.dispose();
      engine.dispose();
      canvas.remove();
    },
  };
}
