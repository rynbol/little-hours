import { Scene } from '@babylonjs/core/scene.js';
import { TargetCamera } from '@babylonjs/core/Cameras/targetCamera.js';
import { Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { buildOutdoorWorld, buildGrassBlades, buildTerrainRings } from '../../models/world/world.js';

export const yieldToBrowser = () => new Promise(resolve => setTimeout(resolve, 0));
export const WINDOW_WORLD_DEPTH = Object.freeze({ near: 0.5, far: 20000 });

export function createWindowWorld(engine, anchor, { workers } = {}) {
  const scene = new Scene(engine, { virtual: true });
  scene.detachControl();
  scene.useRightHandedSystem = true; scene.skipPointerMovePicking = true; scene.clearColor = new Color4(0.66, 0.78, 0.84, 1);
  const camera = new TargetCamera('window-world-camera', new Vector3(), scene, true);
  camera.minZ = WINDOW_WORLD_DEPTH.near; camera.maxZ = WINDOW_WORLD_DEPTH.far;
  const inverse = new Matrix(), target = new Vector3();
  let world = null, building = null, theme = 'day', still = false, disposed = false;

  function prepare(options = {}) {
    theme = options.theme ?? theme; still = options.still ?? still;
    building ??= Promise.all([buildTerrainRings({ workers }), buildGrassBlades({ workers })]).then(async ([rings, blades]) => {
      const steps = buildOutdoorWorld(scene, { theme, still, rings, blades });
      while (!disposed) {
        const step = steps.next();
        if (step.done) { world = step.value; world.setTheme(theme); return scene.whenReadyAsync(); }
        await yieldToBrowser();
      }
      return null;
    });
    return building;
  }
  function follow(source) {
    anchor.getWorldMatrix().invertToRef(inverse);
    Vector3.TransformCoordinatesToRef(source.globalPosition, inverse, camera.position);
    Vector3.TransformCoordinatesToRef(source.getTarget(), inverse, target);
    camera.setTarget(target); camera.fov = source.fov;
  }
  function render(source) {
    if (!world) return false;
    follow(source);
    scene.render();
    return true;
  }
  return {
    scene, camera,
    get ready() { return Boolean(world); },
    get theme() { return theme; },
    prepare,
    follow,
    render,
    setTheme(next) { theme = next; world?.setTheme(next); },
    dispose() { disposed = true; scene.dispose(); },
  };
}
