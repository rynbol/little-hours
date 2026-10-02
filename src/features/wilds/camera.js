import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { obstacleRadiusBetween, WILDS_MOVEMENT } from '../../core/wilds/movement.js';

const DISTANCE = 6.5, TARGET_HEIGHT = 1.25, RADIUS = .28, MIN_DISTANCE = 3, MAX_PITCH = 1.25;
const INITIAL_PITCH = Math.asin((2.2 - TARGET_HEIGHT) / DISTANCE);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

function obstructed(world, x, y, z, padding = RADIUS, avoidWater = true) {
  const surface = world.surfaceAt(x, z);
  if (!surface || y < surface.height + padding / Math.max(.2, surface.normal.y)) return true;
  const water = avoidWater && world.waterAt?.(x, z);
  if (water && y < water.height + padding) return true;
  for (const obstacle of world.obstacles || []) {
    if (y - padding > obstacle.baseY + obstacle.height || y + padding < obstacle.baseY) continue;
    const radius = obstacle.cameraRadius ?? obstacleRadiusBetween(obstacle, y - padding, y + padding);
    if (Math.hypot(x - obstacle.x, z - obstacle.z) < radius + padding) return true;
  }
  return false;
}

function rayDistance(world, target, direction, requested, avoidWater = true, originPadding = .04, endPadding = RADIUS) {
  const samples = Math.ceil(requested / .08);
  for (let index = 1; index <= samples; index++) {
    const length = requested * index / samples;
    if (obstructed(world, target.x + direction.x * length, target.y + direction.y * length, target.z + direction.z * length, originPadding + (endPadding - originPadding) * length / requested, avoidWater)) return Math.max(0, requested * (index - 1) / samples - .06);
  }
  return requested;
}

function viewAt(world, target, yaw, pitch, requested) {
  const direction = new Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const distance = rayDistance(world, target, direction, requested);
  return { yaw, pitch, distance, position: target.add(direction.scale(distance)) };
}

function visible(world, target, position) {
  const direction = position.subtract(target), distance = direction.length();
  return distance >= MIN_DISTANCE - .00001 && rayDistance(world, target, direction.scale(1 / distance), distance) >= distance - .00001;
}

function travelClear(world, target, start, end) {
  const distance = Vector3.Distance(start, end), samples = Math.ceil(distance / .08);
  for (let index = 1; index <= samples; index++) {
    const point = Vector3.Lerp(start, end, index / samples);
    if (Vector3.Distance(point, target) < WILDS_MOVEMENT.height + RADIUS || obstructed(world, point.x, point.y, point.z)) return false;
  }
  return true;
}

export function createWildsCamera(scene, canvas, { world, still = false }) {
  const camera = new FreeCamera('wilds-camera', new Vector3(0, 2.2, DISTANCE), scene);
  camera.minZ = .08;
  camera.maxZ = 4000;
  camera.fov = .88;
  camera.inputs.clear();
  const target = new Vector3(), previousTarget = new Vector3();
  let yaw = 0, pitch = INITIAL_PITCH, distance = DISTANCE, desiredDistance = DISTANCE, resolvedYaw = 0, resolvedPitch = INITIAL_PITCH;
  let occluded = false, recovering = false, initialized = false, disposed = false, explicitYaw = false, snap = false, settled = false;

  function update(player, input = {}, deltaMs = 0) {
    if (disposed) return { cameraYaw: yaw, cameraPitch: pitch };
    if (!initialized && !explicitYaw) yaw = player.yaw || 0;
    if (input.lookX && initialized && occluded) yaw = resolvedYaw;
    if (input.lookY && initialized && occluded) pitch = clamp(resolvedPitch, -.15, 1.1);
    yaw -= (input.lookX || 0) * .003;
    pitch = clamp(pitch + (input.lookY || 0) * .0025, -.15, 1.1);
    previousTarget.copyFrom(target);
    target.set(player.position.x, player.position.y + TARGET_HEIGHT, player.position.z);
    const stationary = initialized && Vector3.DistanceSquared(target, previousTarget) < 1e-12 && !input.lookX && !input.lookY;
    if (stationary && !snap && deltaMs <= 0) return { cameraYaw: yaw, cameraPitch: pitch };
    const frameScale = clamp(deltaMs / (1000 / 60), .25, 3);
    const reach = Math.max(12, Math.hypot(camera.position.x - target.x, camera.position.z - target.z) + 3);
    const nearby = { surfaceAt: world.surfaceAt, waterAt: world.waterAt, obstacles: (world.obstacles || []).filter(obstacle => {
      const radius = obstacle.cameraRadius ?? obstacle.radiusProfile?.reduce((maximum, point) => Math.max(maximum, point.radius), 0) ?? obstacle.radius;
      return Math.hypot(obstacle.x - target.x, obstacle.z - target.z) < reach + radius;
    }) };
    const requested = viewAt(nearby, target, yaw, pitch, desiredDistance);
    const followed = camera.position.add(target.subtract(previousTarget));
    const feet = new Vector3(player.position.x, player.position.y + .12, player.position.z);
    const approachingFeet = feet.clone();
    if (player.velocity) {
      approachingFeet.x += player.velocity.x * .4;
      approachingFeet.z += player.velocity.z * .4;
      const ground = world.surfaceAt(approachingFeet.x, approachingFeet.z);
      approachingFeet.y = Math.max((ground?.height ?? feet.y - .12) + .12, feet.y + player.velocity.y * .4 - (player.grounded ? 0 : WILDS_MOVEMENT.gravity * .08));
      for (const obstacle of nearby.obstacles) {
        const top = obstacle.baseY + obstacle.height, dx = approachingFeet.x - obstacle.x, dz = approachingFeet.z - obstacle.z, reach = Math.hypot(dx, dz);
        if (player.position.y >= top - .001 && reach < obstacle.radius) { approachingFeet.y = Math.max(approachingFeet.y, top + .12); continue; }
        if (approachingFeet.y - .12 >= top || approachingFeet.y + WILDS_MOVEMENT.height < obstacle.baseY) continue;
        const radius = obstacleRadiusBetween(obstacle, approachingFeet.y - .12, approachingFeet.y + WILDS_MOVEMENT.height) + WILDS_MOVEMENT.radius;
        if (reach && reach < radius) { approachingFeet.x = obstacle.x + dx / reach * radius; approachingFeet.z = obstacle.z + dz / reach * radius; }
      }
      if (player.grounded) approachingFeet.y = Math.max(approachingFeet.y, (world.surfaceAt(approachingFeet.x, approachingFeet.z)?.height ?? feet.y - .12) + .12);
    }
    const bodyYaw = player.yaw || 0, rightX = Math.cos(bodyYaw), rightZ = -Math.sin(bodyYaw);
    const bodyPoints = [[1.1, -.3, 0], [1.1, .3, 0], [1.1, 0, -.17], [1.1, 0, .17], [1.5, -.25, 0], [1.5, .25, 0], [1.5, 0, -.21], [1.5, 0, .21]].map(([height, side, front]) => new Vector3(player.position.x + rightX * side - rightZ * front, player.position.y + height, player.position.z + rightZ * side + rightX * front));
    const bodyVisible = position => {
      if (!visible(nearby, target, position)) return false;
      const direction = position.subtract(feet), length = direction.length();
      if (rayDistance(nearby, feet, direction.scale(1 / length), length, false) < length - .00001) return false;
      for (const origin of bodyPoints) {
        const direction = position.subtract(origin), length = direction.length();
        if (rayDistance(nearby, origin, direction.scale(1 / length), length, false, 0, 0) < length - .00001) return false;
      }
      return true;
    };
    const approachPenalty = position => {
      let penalty = 0;
      for (let index = 1; index < 16; index++) {
        const point = Vector3.Lerp(approachingFeet, position, index / 16);
        const ground = nearby.surfaceAt(point.x, point.z);
        if (ground) penalty += Math.max(0, ground.height + .08 - point.y) ** 2;
        for (const obstacle of nearby.obstacles) {
          const top = obstacle.baseY + obstacle.height;
          if (point.y > top + .08 || point.y < obstacle.baseY - .08) continue;
          const radius = obstacle.cameraRadius ?? obstacleRadiusBetween(obstacle, point.y);
          penalty += Math.max(0, Math.min(top + .08 - point.y, radius + .08 - Math.hypot(point.x - obstacle.x, point.z - obstacle.z))) ** 2;
        }
      }
      return penalty;
    };
    const reachable = position => !initialized || snap || travelClear(nearby, target, camera.position, position);
    const requestedClear = requested.distance >= desiredDistance && bodyVisible(requested.position) && approachPenalty(requested.position) < .00001;
    occluded = !requestedClear;
    recovering = false;
    let position;
    if (requestedClear) {
      const eased = !initialized || still || snap ? requested.position : Vector3.Lerp(followed, requested.position, 1 - Math.exp(-Math.max(0, deltaMs) / 110));
      if (bodyVisible(eased) && reachable(eased)) position = eased;
      else if (reachable(requested.position)) position = requested.position;
    }
    if (!position && settled && stationary && !snap && bodyVisible(camera.position)) position = camera.position.clone();
    if (!position) {
      let goal = requested, goalScore = Infinity;
      for (const turn of [0, .3, -.3, .6, -.6, .9, -.9, 1.2, -1.2, Math.PI / 2, -Math.PI / 2, 2.1, -2.1, Math.PI]) {
        for (const rise of [pitch, Math.max(pitch, 0), Math.max(pitch, .2), Math.max(pitch, .45), Math.max(pitch, .8), Math.max(pitch, 1.1), MAX_PITCH]) {
          const view = viewAt(nearby, target, yaw + turn, rise, desiredDistance);
          const score = turn ** 2 * .35 + (rise - pitch) ** 2 * 1.2 + Math.max(0, rise - Math.max(.75, pitch)) ** 2 * 10 + (view.distance - desiredDistance) ** 2 * .6 + approachPenalty(view.position) * 30 + angleDifference(view.yaw, resolvedYaw) ** 2 * .08;
          if (view.distance >= MIN_DISTANCE && score < goalScore && bodyVisible(view.position)) { goal = view; goalScore = score; }
        }
      }
      let best = null, bestScore = Infinity, limitTravel = true;
      const consider = point => {
        const offset = point.subtract(target), length = offset.length();
        if (length < MIN_DISTANCE - .000001 || length > desiredDistance + .00001) return;
        if (limitTravel && initialized && !snap && !still && Vector3.DistanceSquared(camera.position, point) > (.9 * frameScale) ** 2) return;
        const candidateYaw = Math.atan2(offset.x, offset.z), candidatePitch = Math.atan2(offset.y, Math.hypot(offset.x, offset.z));
        const score = angleDifference(candidateYaw, goal.yaw) ** 2 * 3 + (candidatePitch - goal.pitch) ** 2 * 3 + (length - goal.distance) ** 2 * .6 + (initialized && !snap && !still ? Vector3.DistanceSquared(followed, point) * 2 / frameScale ** 2 : 0) + approachPenalty(point) * 30;
        if (score >= bestScore || !bodyVisible(point) || !reachable(point)) return;
        best = point; bestScore = score;
      };
      const testOrbit = (candidateYaw, candidatePitch) => {
        const view = viewAt(nearby, target, candidateYaw, candidatePitch, desiredDistance);
        if (view.distance < MIN_DISTANCE) return;
        consider(view.position);
        if (initialized && distance < view.distance) consider(target.add(view.position.subtract(target).scale(Math.max(MIN_DISTANCE, Math.min(view.distance, distance + .2 * frameScale)) / view.distance)));
      };
      if (initialized && !snap) { consider(followed); consider(camera.position); }
      testOrbit(yaw, pitch);
      const currentOffset = followed.subtract(target), currentYaw = Math.atan2(currentOffset.x, currentOffset.z), currentPitch = Math.atan2(currentOffset.y, Math.hypot(currentOffset.x, currentOffset.z));
      const yaws = initialized && !snap ? [currentYaw, currentYaw - .04 * frameScale, currentYaw + .04 * frameScale, currentYaw - .12 * frameScale, currentYaw + .12 * frameScale, currentYaw - .3 * frameScale, currentYaw + .3 * frameScale, goal.yaw] : [yaw];
      const pitches = initialized && !snap ? [pitch, currentPitch, currentPitch - .04 * frameScale, currentPitch + .04 * frameScale, currentPitch - .12 * frameScale, currentPitch + .12 * frameScale, currentPitch + .3 * frameScale, goal.pitch, MAX_PITCH] : [pitch, 0, .2, .4, .7, 1, MAX_PITCH];
      for (const candidateYaw of yaws) for (const candidatePitch of pitches) testOrbit(candidateYaw, clamp(candidatePitch, -.15, MAX_PITCH));
      if (!best) {
        limitTravel = false;
        for (let turn = 0; turn <= 12; turn++) {
          for (const sign of [1, -1]) for (let lift = 0; lift <= 7; lift++) testOrbit(yaw + turn * Math.PI / 12 * sign, Math.min(MAX_PITCH, pitch + lift * .2));
        }
      }
      position = best;
    }
    if (!position) {
      recovering = true;
      position = target.add(new Vector3(Math.sin(yaw) * 3, 4, Math.cos(yaw) * 3));
      for (let lift = 0; lift < 80 && obstructed(nearby, position.x, position.y, position.z); lift++) position.y += .5;
    }
    settled = stationary && Vector3.DistanceSquared(position, camera.position) < 1e-12;
    camera.position.copyFrom(position);
    camera.setTarget(target);
    const offset = camera.position.subtract(target);
    distance = offset.length();
    resolvedYaw = Math.atan2(offset.x, offset.z);
    resolvedPitch = Math.atan2(offset.y, Math.hypot(offset.x, offset.z));
    initialized = true;
    snap = false;
    return { cameraYaw: yaw, cameraPitch: pitch };
  }

  return {
    camera,
    update,
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    setPose(pose) {
      if (Number.isFinite(pose.yaw)) { yaw = pose.yaw; explicitYaw = true; }
      if (Number.isFinite(pose.pitch)) pitch = clamp(pose.pitch, -.15, 1.1);
      if (Number.isFinite(pose.distance)) desiredDistance = clamp(pose.distance, 3, 9);
      snap = true;
    },
    diagnostics: () => ({ yaw, pitch, resolvedYaw, resolvedPitch, distance, occluded, recovering, target: { x: target.x, y: target.y, z: target.z }, disposed }),
    dispose() {
      if (disposed) return;
      disposed = true;
      camera.dispose();
    },
  };
}
