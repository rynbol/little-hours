import { Vector3 } from 'three';
import { heightAt } from '../../core/world-terrain.js';
import { DUMMY, POSTS } from '../../core/wilds/feel.js';

const clamp = (n, low, high) => Math.min(high, Math.max(low, n));
const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export function createWildsCamera(camera, { target: getTarget = () => DUMMY, obstacles = POSTS, world = null, heading = 0 } = {}) {
  const target = new Vector3(), desired = new Vector3(), follow = new Vector3();
  let yaw = heading, pitch = .3, distance = 6.6, initialized = false, clipped = false, effectiveYaw = heading, orbitOffset = 0, elevatedPitch = 0, lockFraming = false;
  function update(player, locked, dt, impact = 0) {
    if (locked) lockFraming = true;
    target.set(player.x, player.y + 1.05, player.z);
    let reach = distance;
    const focus = getTarget();
    if (locked && focus) {
      const separation = Math.hypot(focus.x - player.x, focus.z - player.z);
      const direction = Math.atan2(focus.x - player.x, -(focus.z - player.z));
      yaw += angleDifference(direction, yaw) * (1 - Math.exp(-dt * 6));
      target.x += (focus.x - player.x) * .28;
      target.z += (focus.z - player.z) * .28;
      const focusFloor = Number.isFinite(focus.y) ? focus.y : heightAt(focus.x, focus.z);
      const bottom = Math.min(player.y, focusFloor);
      const top = Math.max(player.y + 1.65, focusFloor + (focus.height || 1.8) + 0.3);
      target.y = (bottom + top) * 0.5;
      const verticalExtent = (top - bottom) * 0.5 + separation * 0.6 * Math.sin(pitch);
      const viewTangent = Math.tan(camera.fov * Math.PI / 360);
      reach = Math.max(distance, 8.4, verticalExtent / (viewTangent * 0.78) + separation * 0.65 + 1);
    }
    if (!initialized) { follow.copy(target); initialized = true; }
    follow.lerp(target, 1 - Math.exp(-dt * 18));
    const collisionPosts = world ? [...obstacles, ...(world.trees || []).filter(tree => Math.hypot(tree.x - follow.x, tree.z - follow.z) < reach + tree.radius + 1)] : obstacles;
    const setDesired = (candidateYaw, candidatePitch) => desired.set(follow.x - Math.sin(candidateYaw) * Math.cos(candidatePitch) * reach, follow.y + Math.sin(candidatePitch) * reach, follow.z + Math.cos(candidateYaw) * Math.cos(candidatePitch) * reach);
    const clearFraction = () => {
      let fraction = 1;
      const dx = desired.x - follow.x, dy = desired.y - follow.y, dz = desired.z - follow.z;
      for (const box of world?.solids || []) {
        let enter = 0, exit = 1;
        for (const [origin, delta, low, high] of [[follow.x, dx, box.x - box.halfX - .3, box.x + box.halfX + .3], [follow.y, dy, box.bottom - .3, box.top + .3], [follow.z, dz, box.z - box.halfZ - .3, box.z + box.halfZ + .3]]) {
          if (Math.abs(delta) < 1e-8) { if (origin < low || origin > high) { enter = 2; break; } }
          else { const a = (low - origin) / delta, b = (high - origin) / delta; enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b)); }
        }
        if (enter <= exit && exit > 0 && enter < fraction) fraction = Math.max(.01, enter - .04);
      }
      for (const post of collisionPosts) {
        const x = follow.x - post.x, z = follow.z - post.z, radius = post.radius + .38;
        const a = dx * dx + dz * dz, b = 2 * (x * dx + z * dz), c = x * x + z * z - radius * radius;
        const discriminant = b * b - 4 * a * c;
        if (discriminant < 0 || a < .001) continue;
        const t = (-b - Math.sqrt(discriminant)) / (2 * a);
        const ground = post.y ?? heightAt(post.x, post.z);
        if (c <= 0 && b < 0 && follow.y < ground + post.height + .3) { fraction = Math.min(fraction, .01); continue; }
        if (t > 0 && t < fraction && follow.y + dy * t < ground + post.height + .3) fraction = Math.max(.08, t - .04);
      }
      for (let i = 1; i <= 20; i++) {
        const t = fraction * i / 20, x = follow.x + dx * t, z = follow.z + dz * t;
        if (follow.y + dy * t < (world ? world.cameraFloorAt(x, z, follow.y + dy * t) : heightAt(x, z)) + .3) { fraction = Math.max(.08, fraction * (i - 1) / 20); break; }
      }
      return fraction;
    };
    const fitsActors = (candidateYaw, candidatePitch, fraction) => {
      const tangent = Math.tan(camera.fov * Math.PI / 360), sy = Math.sin(candidateYaw), cy = Math.cos(candidateYaw), sp = Math.sin(candidatePitch), cp = Math.cos(candidatePitch);
      const fits = (x, y, z) => {
        const dx = x - follow.x, dy = y - follow.y, dz = z - follow.z;
        const depth = reach * fraction + dx * sy * cp - dy * sp - dz * cy * cp;
        return depth > camera.near && Math.abs((dx * cy + dz * sy) / (depth * tangent * camera.aspect)) < .9 && Math.abs((-dx * sy * sp + dy * cp + dz * cy * sp) / (depth * tangent)) < .9;
      };
      if (!locked || !focus) return fits(player.x, player.y, player.z) && fits(player.x, player.y + 1.65, player.z);
      const floor = Number.isFinite(focus.y) ? focus.y : heightAt(focus.x, focus.z), radius = focus.radius ?? 1.3;
      return fits(player.x, player.y, player.z) && fits(player.x, player.y + 1.65, player.z) && fits(focus.x, floor + (focus.height || 1.8), focus.z) && fits(focus.x - radius, floor, focus.z) && fits(focus.x + radius, floor, focus.z) && fits(focus.x, floor, focus.z - radius) && fits(focus.x, floor, focus.z + radius);
    };
    let selectedYaw = yaw, selectedPitch = pitch;
    setDesired(selectedYaw, selectedPitch);
    let fraction = clearFraction();
    if ((lockFraming || world) && (fraction < .98 || orbitOffset || elevatedPitch)) {
      let found = false;
      if (fraction >= .98 && fitsActors(yaw, pitch, fraction)) {
        const recovery = Math.exp(-dt * 4), candidateYaw = yaw + orbitOffset * recovery, candidatePitch = clamp(pitch + elevatedPitch * recovery, .09, 1.05);
        setDesired(candidateYaw, candidatePitch);
        const candidateFraction = clearFraction();
        if (candidateFraction >= .98 && fitsActors(candidateYaw, candidatePitch, candidateFraction)) { selectedYaw = candidateYaw; selectedPitch = candidatePitch; fraction = candidateFraction; found = true; }
      }
      for (const offset of [orbitOffset, 0, -.22, .22, -.4, .4, -.65, .65, -.9, .9, -1.2, 1.2, ...(world && !locked ? [-1.57, 1.57, -1.9, 1.9, -2.3, 2.3, Math.PI] : [])]) {
        if (found) break;
        for (const lift of [elevatedPitch, 0, .18, .35]) {
          const candidateYaw = yaw + offset, candidatePitch = clamp(pitch + lift, .09, 1.05);
          setDesired(candidateYaw, candidatePitch);
          const candidateFraction = clearFraction();
          if (candidateFraction < .98 || !fitsActors(candidateYaw, candidatePitch, candidateFraction)) continue;
          selectedYaw = candidateYaw; selectedPitch = candidatePitch; fraction = candidateFraction; found = true;
          break;
        }
        if (found) break;
      }
    }
    orbitOffset = lockFraming || world ? angleDifference(selectedYaw, yaw) : 0;
    elevatedPitch = lockFraming || world ? selectedPitch - pitch : 0;
    effectiveYaw = selectedYaw;
    setDesired(selectedYaw, selectedPitch);
    clipped = fraction < .99;
    camera.position.copy(follow).lerp(desired, fraction);
    camera.position.y = Math.max(camera.position.y, (world ? world.cameraFloorAt(camera.position.x, camera.position.z, camera.position.y) : heightAt(camera.position.x, camera.position.z)) + .35);
    camera.position.x += impact * .055;
    camera.lookAt(follow);
  }
  return {
    update,
    reset() { yaw = heading; pitch = .3; distance = 6.6; initialized = false; clipped = false; effectiveYaw = heading; orbitOffset = 0; elevatedPitch = 0; lockFraming = false; },
    orbit(dx, dy) { yaw -= dx * .006; pitch = clamp(pitch + dy * .004, .09, 1.05); },
    zoom(delta) { distance = clamp(distance + delta, 3, 11); },
    get yaw() { return initialized ? effectiveYaw : yaw; },
    diagnostics: () => ({ yaw: initialized ? effectiveYaw : yaw, pitch, distance, clipped, orbitOffset, elevatedPitch, position: camera.position.toArray(), target: follow.toArray() }),
  };
}
