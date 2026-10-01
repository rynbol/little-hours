import { Scene } from '@babylonjs/core/scene.js';
import { TargetCamera } from '@babylonjs/core/Cameras/targetCamera.js';
import { Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { buildOutdoorWorld, buildGrassBlades, buildTerrainRings } from '../../models/world/world.js';

export const yieldToBrowser = () => new Promise(resolve => setTimeout(resolve, 0));
export const WINDOW_WORLD_DEPTH = Object.freeze({ near: 0.5, far: 20000 });
const OPENING_MARGIN = 0.1, EDGE_PIXELS = 2, IN_FRONT = 1e-3;
const BOX_FACES = Int8Array.from([0, 2, 6, 4, 1, 3, 7, 5, 0, 1, 5, 4, 2, 3, 7, 6, 0, 1, 3, 2, 4, 5, 7, 6]);
const CLIP_PLANES = Float64Array.from([0, 0, 1, IN_FRONT, -1, 0, 1, 0, 1, 0, 1, 0, 0, -1, 1, 0, 0, 1, 1, 0]);

export function createWindowWorld(engine, anchor, { workers } = {}) {
  const scene = new Scene(engine, { virtual: true });
  scene.detachControl();
  scene.useRightHandedSystem = true; scene.skipPointerMovePicking = true; scene.clearColor = new Color4(0.66, 0.78, 0.84, 1);
  const camera = new TargetCamera('window-world-camera', new Vector3(), scene, true);
  camera.minZ = WINDOW_WORLD_DEPTH.near; camera.maxZ = WINDOW_WORLD_DEPTH.far;
  const inverse = new Matrix(), target = new Vector3(), viewProjection = new Matrix(), clip = new Float64Array(24), polygonA = new Float64Array(30), polygonB = new Float64Array(30), bounds = new Float64Array(4), rect = new Int32Array(4);
  const reach = (x, y, w) => { bounds[0] = Math.min(bounds[0], x / w); bounds[1] = Math.max(bounds[1], x / w); bounds[2] = Math.min(bounds[2], y / w); bounds[3] = Math.max(bounds[3], y / w); };
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
  function clipFace(face) {
    let from = polygonA, to = polygonB, count = 4;
    for (let k = 0; k < 4; k++) { const c = BOX_FACES[face + k] * 3; from[k * 3] = clip[c]; from[k * 3 + 1] = clip[c + 1]; from[k * 3 + 2] = clip[c + 2]; }
    for (let p = 0; p < CLIP_PLANES.length && count; p += 4) {
      const ax = CLIP_PLANES[p], ay = CLIP_PLANES[p + 1], aw = CLIP_PLANES[p + 2], least = CLIP_PLANES[p + 3];
      let kept = 0;
      for (let k = 0; k < count; k++) {
        const a = k * 3, b = (k + 1) % count * 3;
        const da = ax * from[a] + ay * from[a + 1] + aw * from[a + 2] - least, db = ax * from[b] + ay * from[b + 1] + aw * from[b + 2] - least;
        if (da >= 0) { to[kept * 3] = from[a]; to[kept * 3 + 1] = from[a + 1]; to[kept * 3 + 2] = from[a + 2]; kept++; }
        if ((da >= 0) !== (db >= 0)) {
          const t = da / (da - db);
          for (let i = 0; i < 3; i++) to[kept * 3 + i] = from[a + i] + (from[b + i] - from[a + i]) * t;
          kept++;
        }
      }
      const swap = from; from = to; to = swap; count = kept;
    }
    for (let k = 0; k < count; k++) reach(from[k * 3], from[k * 3 + 1], from[k * 3 + 2]);
  }
  function frameOpenings(source, openings) {
    source.getViewMatrix().multiplyToRef(source.getProjectionMatrix(), viewProjection);
    const m = viewProjection.m;
    bounds[0] = bounds[2] = Infinity; bounds[1] = bounds[3] = -Infinity;
    for (let at = 0; at + 6 <= openings.length; at += 6) {
      for (let c = 0; c < 8; c++) {
        const x = c & 1 ? openings[at + 3] + OPENING_MARGIN : openings[at] - OPENING_MARGIN, y = c & 2 ? openings[at + 4] + OPENING_MARGIN : openings[at + 1] - OPENING_MARGIN, z = c & 4 ? openings[at + 5] + OPENING_MARGIN : openings[at + 2] - OPENING_MARGIN;
        clip[c * 3] = x * m[0] + y * m[4] + z * m[8] + m[12]; clip[c * 3 + 1] = x * m[1] + y * m[5] + z * m[9] + m[13]; clip[c * 3 + 2] = x * m[3] + y * m[7] + z * m[11] + m[15];
      }
      for (let face = 0; face < BOX_FACES.length; face += 4) clipFace(face);
    }
    const width = engine.getRenderWidth(), height = engine.getRenderHeight();
    const x0 = Math.max(0, Math.floor((bounds[0] + 1) / 2 * width) - EDGE_PIXELS), x1 = Math.min(width, Math.ceil((bounds[1] + 1) / 2 * width) + EDGE_PIXELS);
    const y0 = Math.max(0, Math.floor((bounds[2] + 1) / 2 * height) - EDGE_PIXELS), y1 = Math.min(height, Math.ceil((bounds[3] + 1) / 2 * height) + EDGE_PIXELS);
    rect[0] = x0; rect[1] = y0; rect[2] = Math.max(0, x1 - x0); rect[3] = Math.max(0, y1 - y0);
    return rect[2] > 0 && rect[3] > 0;
  }
  function render(source, openings) {
    if (!world) return false;
    follow(source);
    engine.clear(scene.clearColor, true, true, true);
    if (!frameOpenings(source, openings)) return true;
    engine.enableScissor(rect[0], rect[1], rect[2], rect[3]);
    scene.render();
    engine.disableScissor();
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
