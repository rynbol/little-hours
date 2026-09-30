import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { createBuddyModel } from '../../models/buddy.js';

const TWIRL = 1.3;

export function createBuddyCloseup(host) {
  const canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true'); host.append(canvas);
  const engine = new Engine(canvas, true, { alpha: true, stencil: false, preserveDrawingBuffer: false }, false);
  engine.canvasTabIndex = -1; canvas.tabIndex = -1;
  const scene = new Scene(engine); scene.clearColor = new Color4(0, 0, 0, 0);
  const camera = new ArcRotateCamera('buddy-closeup-camera', Math.PI / 2, 1.38, 1.05, new Vector3(0, 0.04, 0), scene);
  camera.fov = 0.5; camera.minZ = 0.01;
  const sky = new HemisphericLight('buddy-closeup-fill', new Vector3(0.2, 1, 0.4), scene);
  sky.intensity = 0.7; sky.groundColor = Color3.FromHexString('#c9b8d8');
  const key = new DirectionalLight('buddy-closeup-key', new Vector3(-0.5, -1, -0.7), scene);
  key.diffuse = Color3.FromHexString('#fff1e0'); key.intensity = 0.55;
  const motion = matchMedia('(prefers-reduced-motion: reduce)'), listeners = new AbortController(), pointer = { x: 0, y: 0 };
  const pose = { x: 0, y: 0, z: 0, visible: true, scale: 1, spin: 0, flying: 0, heading: 0, faceYaw: 0, squash: 0, trail: false, holding: false, activity: 'hover', activityAge: 0, ground: -1, ghost: false };
  let model = null, look = '', visible = true, disposed = false, frame = 0, previous = 0, seconds = 0, twirlAt = -Infinity;
  function draw(at) {
    frame = 0;
    if (disposed || !visible || document.hidden) return;
    const dt = Math.min(0.05, previous ? (at - previous) / 1000 : 1 / 30); previous = at; seconds += dt;
    if (model) {
      const age = seconds - twirlAt, blend = motion.matches ? 1 : 1 - Math.exp(-dt * 5);
      pose.activity = age < TWIRL ? 'twirl' : 'hover'; pose.activityAge = Math.max(0, age);
      pose.faceYaw += (pointer.x * 0.7 - pose.faceYaw) * blend;
      pose.y = motion.matches ? 0 : pointer.y * 0.02;
      model.animate(pose, dt, seconds, motion.matches);
      model.contact.setEnabled(false);
    }
    engine.beginFrame(); scene.render(); engine.endFrame();
    if (!motion.matches || !scene.isReady()) frame = requestAnimationFrame(schedule);
  }
  function schedule(at) { frame = 0; if (at - previous >= 32) draw(at); else if (!disposed && visible && !document.hidden) frame = requestAnimationFrame(schedule); }
  function wake() { if (disposed || frame || !visible || document.hidden) return; frame = requestAnimationFrame(draw); }
  const resize = new ResizeObserver(() => { if (disposed) return; engine.setHardwareScalingLevel(1 / Math.min(devicePixelRatio || 1, 2)); engine.resize(); wake(); }); resize.observe(host);
  const viewport = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (!visible) { cancelAnimationFrame(frame); frame = 0; previous = 0; } else wake(); }); viewport.observe(host);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; previous = 0; } else wake(); }, { signal: listeners.signal });
  motion.addEventListener('change', wake, { signal: listeners.signal });
  host.addEventListener('pointermove', event => { const box = host.getBoundingClientRect(); pointer.x = (event.clientX - box.left) / box.width * 2 - 1; pointer.y = 1 - (event.clientY - box.top) / box.height * 2; wake(); }, { signal: listeners.signal });
  host.addEventListener('pointerleave', () => { pointer.x = 0; pointer.y = 0; wake(); }, { signal: listeners.signal });
  return {
    update({ colors, stage, name }) {
      const next = `${colors.body}${stage}`;
      host.setAttribute('aria-label', name);
      if (next === look) return;
      const changed = Boolean(look); look = next;
      if (!model) { model = createBuddyModel(scene, colors, stage); model.halo.setEnabled(false); }
      else model.setLook(colors, stage);
      if (changed) { twirlAt = seconds; model.burst(); }
      wake();
    },
    diagnostics() { return { scene, engine, frames: scene.getFrameId(), twirling: seconds - twirlAt < TWIRL, look }; },
    dispose() { if (disposed) return; disposed = true; cancelAnimationFrame(frame); resize.disconnect(); viewport.disconnect(); listeners.abort(); model?.dispose(); scene.dispose(); engine.dispose(); canvas.remove(); },
  };
}
