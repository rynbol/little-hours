import { Vector3 } from 'three';
import { heightAt } from '../../core/world-terrain.js';
import { DUMMY, POSTS } from '../../core/wilds/feel.js';

const clamp = (n, low, high) => Math.min(high, Math.max(low, n));
const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export function createWildsCamera(camera) {
  const target = new Vector3(), desired = new Vector3(), follow = new Vector3();
  let yaw = 0, pitch = .3, distance = 6.6, initialized = false, clipped = false;
  function update(player, locked, dt, impact = 0) {
    target.set(player.x, player.y + 1.05, player.z);
    let reach = distance;
    if (locked) {
      const separation = Math.hypot(DUMMY.x - player.x, DUMMY.z - player.z);
      const direction = Math.atan2(DUMMY.x - player.x, -(DUMMY.z - player.z));
      yaw += angleDifference(direction, yaw) * (1 - Math.exp(-dt * 6));
      target.x += (DUMMY.x - player.x) * .28;
      target.z += (DUMMY.z - player.z) * .28;
      reach = Math.max(distance, Math.min(11, separation * .9 + 3));
    }
    if (!initialized) { follow.copy(target); initialized = true; }
    follow.lerp(target, 1 - Math.exp(-dt * 18));
    desired.set(follow.x - Math.sin(yaw) * Math.cos(pitch) * reach, follow.y + Math.sin(pitch) * reach, follow.z + Math.cos(yaw) * Math.cos(pitch) * reach);
    let fraction = 1;
    const dx = desired.x - follow.x, dy = desired.y - follow.y, dz = desired.z - follow.z;
    for (const post of POSTS) {
      const x = follow.x - post.x, z = follow.z - post.z, radius = post.radius + .38;
      const a = dx * dx + dz * dz, b = 2 * (x * dx + z * dz), c = x * x + z * z - radius * radius;
      const discriminant = b * b - 4 * a * c;
      if (discriminant < 0 || a < .001) continue;
      const t = (-b - Math.sqrt(discriminant)) / (2 * a);
      const ground = heightAt(post.x, post.z);
      if (c <= 0 && b < 0 && follow.y < ground + post.height + .3) { fraction = Math.min(fraction, .01); continue; }
      if (t > 0 && t < fraction && follow.y + dy * t < ground + post.height + .3) fraction = Math.max(.08, t - .04);
    }
    for (let i = 1; i <= 20; i++) {
      const t = fraction * i / 20, x = follow.x + dx * t, z = follow.z + dz * t;
      if (follow.y + dy * t < heightAt(x, z) + .3) { fraction = Math.max(.08, fraction * (i - 1) / 20); break; }
    }
    clipped = fraction < .99;
    camera.position.copy(follow).lerp(desired, fraction);
    camera.position.y = Math.max(camera.position.y, heightAt(camera.position.x, camera.position.z) + .35);
    camera.position.x += impact * .055;
    camera.lookAt(follow);
  }
  return {
    update,
    orbit(dx, dy) { yaw -= dx * .006; pitch = clamp(pitch + dy * .004, .09, 1.05); },
    zoom(delta) { distance = clamp(distance + delta, 3, 11); },
    get yaw() { return yaw; },
    diagnostics: () => ({ yaw, pitch, distance, clipped, position: camera.position.toArray(), target: follow.toArray() }),
  };
}
