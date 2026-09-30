import { TargetCamera } from '@babylonjs/core/Cameras/targetCamera.js';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector.js';

export const SEAT_LOOK = { pitchMin: -0.85, pitchMax: 0.24, restYaw: 0.3, restPitch: -0.2, pull: 0.24, rise: 0.05 };
export const SEAT_SECONDS = { enter: 1.6, leave: 1.2 };
const FAR = 60, BODY_CLEARANCE = 0.9, DRAG_RADIANS_PER_PIXEL = 0.0042;

export const clampLook = (yaw, pitch) => ({
  yaw,
  pitch: Math.min(SEAT_LOOK.pitchMax, Math.max(SEAT_LOOK.pitchMin, pitch)),
});

export function seatFov(aspect) {
  const minimumHorizontal = 1.5, vertical = 2 * Math.atan(Math.tan(minimumHorizontal / 2) / Math.max(0.2, aspect));
  return Math.min(1.9, Math.max(1.22, vertical));
}

export function seatEye(head, forward) {
  return new Vector3(head.x - forward.x * SEAT_LOOK.pull, head.y + SEAT_LOOK.rise, head.z - forward.z * SEAT_LOOK.pull);
}

export function lookDirection(forward, yaw, pitch) {
  const heading = Math.atan2(forward.x, forward.z) + yaw;
  return new Vector3(Math.sin(heading) * Math.cos(pitch), Math.sin(pitch), Math.cos(heading) * Math.cos(pitch));
}

export function farFrame(roomCamera, height, centerX, centerY) {
  const view = roomCamera.getViewMatrix(true), inverse = Matrix.Invert(view);
  const local = Vector3.TransformCoordinates(roomCamera.target, view);
  local.x = centerX; local.y = centerY;
  const center = Vector3.TransformCoordinates(local, inverse);
  const direction = roomCamera.target.subtract(roomCamera.position).normalize();
  return { position: center.subtract(direction.scale(FAR)), target: center, fov: 2 * Math.atan(height / 2 / FAR), minZ: 1 };
}

const ease = t => t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

export function blendFrame(from, to, t, out) {
  const e = ease(Math.min(1, Math.max(0, t))), towardSeat = e ** 1.4;
  Vector3.LerpToRef(from.position, to.position, towardSeat, out.position);
  Vector3.LerpToRef(from.target, to.target, e, out.target);
  out.fov = 2 * Math.atan(Math.exp(Math.log(Math.tan(from.fov / 2)) * (1 - e) + Math.log(Math.tan(to.fov / 2)) * e));
  out.minZ = from.minZ + (to.minZ - from.minZ) * e;
  return out;
}

export function createFirstPersonView(scene, canvas, { roomCamera, seat, roomFrame, onChange, onLook }) {
  const camera = new TargetCamera('seat-camera', new Vector3(0, 2, 0), scene, false);
  camera.maxZ = 200; camera.layerMask = roomCamera.layerMask;
  const look = { yaw: SEAT_LOOK.restYaw, pitch: SEAT_LOOK.restPitch }, aim = { ...look };
  const current = { position: new Vector3(), target: new Vector3(), fov: 1, minZ: 1 };
  let state = 'room', elapsed = 0, from = null, pose = null, drag = null, seconds = 0, inside = false, blend = 0;

  function seatFrame() {
    const direction = lookDirection(pose.forward, look.yaw, look.pitch + (state === 'seated' ? Math.sin(seconds * 1.1) * 0.006 : 0));
    return { position: pose.eye, target: pose.eye.add(direction), fov: seatFov(pose.aspect), minZ: 0.03 };
  }
  function copyFrame(frame, out) {
    out.position.copyFrom(frame.position); out.target.copyFrom(frame.target); out.fov = frame.fov; out.minZ = frame.minZ;
    return out;
  }
  function apply(frame) {
    camera.position.copyFrom(frame.position); camera.setTarget(frame.target); camera.fov = frame.fov; camera.minZ = frame.minZ;
  }
  function transition(nextState, nextInside = inside) {
    if (state === nextState && inside === nextInside) return;
    state = nextState; inside = nextInside;
    onChange?.({ state, inside });
  }
  function begin(next, frame) {
    from = copyFrame(frame, { position: new Vector3(), target: new Vector3(), fov: 1, minZ: 1 });
    copyFrame(frame, current); elapsed = 0;
    transition(next);
  }

  const farRoomFrame = () => { const frame = roomFrame(); return farFrame(roomCamera, frame.height, frame.centerX, frame.centerY); };
  function enter(reducedMotion) {
    if (state === 'entering' || state === 'seated') return true;
    pose = seat(); if (!pose) return false;
    if (state === 'room') { look.yaw = aim.yaw = SEAT_LOOK.restYaw; look.pitch = aim.pitch = SEAT_LOOK.restPitch; }
    scene.activeCamera = camera;
    begin('entering', state === 'room' ? farRoomFrame() : current);
    if (reducedMotion) elapsed = SEAT_SECONDS.enter;
    return true;
  }
  function leave({ instant = false } = {}) {
    if (state === 'room') return;
    if (state !== 'leaving') begin('leaving', state === 'seated' ? seatFrame() : current);
    if (instant) finishLeaving();
  }
  function finishLeaving() {
    pose = null; drag = null; blend = 0; scene.activeCamera = roomCamera;
    transition('room', false);
  }

  function update(dt, reducedMotion, aspect) {
    if (state === 'room') return false;
    seconds += reducedMotion ? 0 : dt;
    pose.aspect = aspect;
    const follow = reducedMotion ? 1 : 1 - Math.exp(-dt * 9);
    look.yaw += (aim.yaw - look.yaw) * follow; look.pitch += (aim.pitch - look.pitch) * follow;
    if (state === 'seated') { blend = 1; apply(seatFrame()); return Math.abs(aim.yaw - look.yaw) + Math.abs(aim.pitch - look.pitch) > 0.0005 || !reducedMotion; }
    elapsed += dt;
    const entering = state === 'entering', duration = entering ? SEAT_SECONDS.enter : SEAT_SECONDS.leave, t = Math.min(1, elapsed / duration);
    apply(blendFrame(from, entering ? seatFrame() : farRoomFrame(), t, current));
    blend = entering ? Math.max(blend, ease(t)) : Math.min(blend, 1 - ease(t));
    const nextInside = Vector3.Distance(current.position, pose.eye) < BODY_CLEARANCE;
    if (t < 1) transition(state, nextInside);
    else if (entering) transition('seated', nextInside);
    else finishLeaving();
    return true;
  }

  function onPointerDown(event) { if (state !== 'seated' && state !== 'entering') return; drag = { id: event.pointerId, x: event.clientX, y: event.clientY }; }
  function onPointerMove(event) {
    if (!drag || drag.id !== event.pointerId) return;
    Object.assign(aim, clampLook(aim.yaw + (event.clientX - drag.x) * DRAG_RADIANS_PER_PIXEL, aim.pitch + (event.clientY - drag.y) * DRAG_RADIANS_PER_PIXEL));
    drag.x = event.clientX; drag.y = event.clientY; onLook?.();
  }
  function onPointerEnd(event) { if (drag?.id === event.pointerId) drag = null; }
  canvas.addEventListener('pointerdown', onPointerDown); canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerEnd); canvas.addEventListener('pointercancel', onPointerEnd);

  function prepareShaders() {
    if (state !== 'room') return [];
    const engine = scene.getEngine(), previous = scene.activeCamera;
    apply(farRoomFrame());
    engine.beginFrame();
    scene.activeCamera = camera; scene.render();
    scene.activeCamera = previous; scene.render();
    engine.endFrame();
    return scene.meshes.filter(mesh => !mesh.isAnInstance && !mesh.isEnabled()).flatMap(mesh => (mesh.subMeshes ?? []).map(subMesh => [mesh, subMesh]));
  }
  function compileShaders(pending, budget) {
    const previous = scene.activeCamera, until = performance.now() + budget;
    scene.activeCamera = camera;
    while (pending.length) { const [mesh, subMesh] = pending.pop(); if (!mesh.isDisposed()) subMesh.getMaterial()?.isReadyForSubMesh(mesh, subMesh, mesh.hasInstances || mesh.hasThinInstances); if (performance.now() >= until) break; }
    scene.activeCamera = previous;
    return pending.length;
  }

  return {
    camera, enter, leave, update, prepareShaders, compileShaders,
    get state() { return state; },
    get inside() { return inside; },
    get blend() { return blend; },
    get look() { return { ...look }; },
    dispose() {
      canvas.removeEventListener('pointerdown', onPointerDown); canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerEnd); canvas.removeEventListener('pointercancel', onPointerEnd);
      camera.dispose();
    },
  };
}
