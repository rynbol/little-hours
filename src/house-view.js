import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { Camera } from '@babylonjs/core/Cameras/camera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color4 } from '@babylonjs/core/Maths/math.color.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import '@babylonjs/core/Culling/ray.js';
import { createHouseModel } from './house-model.js';

export function createHouseView(container, { house, selectedId, theme, onSelect }) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Your miniature cottage. Choose a room or building site. The room buttons below also work with a keyboard.');
  container.appendChild(canvas);
  const engine = new Engine(canvas, true, { alpha: true, stencil: false, powerPreference: 'low-power' });
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));
  const scene = new Scene(engine); scene.useRightHandedSystem = true; scene.clearColor = new Color4(0, 0, 0, 0);
  scene.skipPointerMovePicking = true; scene.skipPointerDownPicking = true; scene.skipPointerUpPicking = true;
  const camera = new ArcRotateCamera('cottage-camera', Math.PI / 2.8, 1.08, 24, new Vector3(0, 1.3, 0), scene);
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  const sky = new HemisphericLight('soft-sky', new Vector3(0, 1, 0), scene);
  const sun = new DirectionalLight('afternoon', new Vector3(-1, -2, -1), scene);
  let model, frame = 0, disposed = false, renderCount = 0;
  function render() {
    frame = 0;
    if (disposed || document.hidden) return;
    const readyBeforeDraw = scene.isReady();
    engine.beginFrame(); scene.render(); engine.endFrame(); renderCount++;
    // A shader may finish after its mesh was skipped during this draw.
    if (!readyBeforeDraw || !scene.isReady()) requestRender();
  }
  function requestRender() { if (!disposed && !document.hidden && !frame) frame = requestAnimationFrame(render); }
  function resize() {
    if (disposed) return;
    engine.resize();
    // Fit all corners rather than cropping the garden on portrait screens.
    const view = camera.getViewMatrix(true), points = [];
    for (const x of [-6.1, 6.1]) for (const y of [-.8, house.rooms.length === 3 ? 6.9 : house.rooms.length === 2 ? 4.1 : 3.9]) for (const z of [-3.3, 3.3]) points.push(Vector3.TransformCoordinates(new Vector3(x, y, z), view));
    const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
    const aspect = Math.max(.1, container.clientWidth / Math.max(1, container.clientHeight));
    const height = Math.max(maxY - minY, (maxX - minX) / aspect) * 1.06;
    const cx = (maxX + minX) / 2, cy = (maxY + minY) / 2;
    camera.orthoLeft = cx - height * aspect / 2; camera.orthoRight = cx + height * aspect / 2;
    camera.orthoTop = cy + height / 2; camera.orthoBottom = cy - height / 2;
    requestRender();
  }
  function update(next, selected, atmosphere = theme) {
    house = next; selectedId = selected; theme = atmosphere; model?.dispose();
    sky.intensity = theme === 'dusk' ? .6 : .95; sun.intensity = theme === 'dusk' ? .45 : .65;
    model = createHouseModel(scene, house, selectedId, theme); resize();
  }
  function pick(event) {
    const rect = canvas.getBoundingClientRect();
    // Babylon converts CSS pixels to render pixels using hardware scaling.
    return scene.pick(event.clientX - rect.left, event.clientY - rect.top)?.pickedMesh?.metadata?.houseSlot;
  }
  const onClick = event => { const id = pick(event); if (id) onSelect(id); };
  const onMove = event => { canvas.style.cursor = pick(event) ? 'pointer' : 'default'; };
  const onVisibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else requestRender(); };
  canvas.addEventListener('click', onClick); canvas.addEventListener('pointermove', onMove);
  document.addEventListener('visibilitychange', onVisibility);
  const observer = new ResizeObserver(resize); observer.observe(container);
  update(house, selectedId);
  return {
    update,
    diagnostics: () => ({ renderCount, drawCalls: model.meshes.length, triangles: model.meshes.reduce((total, mesh) => total + mesh.getTotalIndices() / 3, 0) }),
    dispose() { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener('visibilitychange', onVisibility); canvas.removeEventListener('click', onClick); canvas.removeEventListener('pointermove', onMove); model.dispose(); scene.dispose(); engine.dispose(); canvas.remove(); },
  };
}
