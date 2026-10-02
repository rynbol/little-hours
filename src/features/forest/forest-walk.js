import { heightAt } from '../../core/world-terrain.js';

export const FOREST_WALK = Object.freeze({
  start: Object.freeze({ x: -106.5, z: -180, yaw: -0.6 }),
  reach: 110, edge: 16, eye: 1.65, speed: 4.2, ease: 0.14, settle: 0.09, climb: 1.1,
  pitch: Object.freeze([-0.75, 0.6]), body: 0.4, trunk: 0.5, cell: 8,
});

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

export function createWalker({ x, z, yaw } = FOREST_WALK.start, height = heightAt) {
  return { x, z, yaw, pitch: 0, vx: 0, vz: 0, y: height(x, z) + FOREST_WALK.eye };
}

export function trunkGrid({ count, x, z, width }, cell = FOREST_WALK.cell) {
  const cells = new Map(), key = (cx, cz) => cx * 73856093 ^ cz * 19349663;
  for (let i = 0; i < count; i++) {
    const at = key(Math.floor(x[i] / cell), Math.floor(z[i] / cell));
    if (!cells.has(at)) cells.set(at, []);
    cells.get(at).push(x[i], z[i], width[i] * FOREST_WALK.trunk);
  }
  return (px, pz, visit) => {
    const cx = Math.floor(px / cell), cz = Math.floor(pz / cell);
    for (let i = cx - 1; i <= cx + 1; i++) for (let j = cz - 1; j <= cz + 1; j++) {
      const trunks = cells.get(key(i, j));
      if (trunks) for (let k = 0; k < trunks.length; k += 3) visit(trunks[k], trunks[k + 1], trunks[k + 2]);
    }
  };
}

export function stepWalk(walker, { forward = 0, strafe = 0, turn = 0, look = 0 }, seconds, { height = heightAt, trunks = null, home = FOREST_WALK.start } = {}) {
  const { reach, edge, eye, speed, ease, settle, climb, pitch, body } = FOREST_WALK;
  walker.yaw += turn;
  walker.pitch = clamp(walker.pitch + look, pitch[0], pitch[1]);
  const sin = Math.sin(walker.yaw), cos = Math.cos(walker.yaw), push = Math.max(1, Math.hypot(forward, strafe));
  const wishX = (forward * sin + strafe * cos) / push * speed, wishZ = (-forward * cos + strafe * sin) / push * speed;
  const blend = 1 - Math.exp(-seconds / ease);
  walker.vx += (wishX - walker.vx) * blend; walker.vz += (wishZ - walker.vz) * blend;
  if (Math.hypot(walker.vx, walker.vz) < 1e-3) { walker.vx = 0; walker.vz = 0; }
  let stepX = walker.vx * seconds, stepZ = walker.vz * seconds;
  const outX = walker.x - home.x, outZ = walker.z - home.z, out = Math.hypot(outX, outZ);
  if (out > reach - edge) {
    const along = (stepX * outX + stepZ * outZ) / out;
    if (along > 0) { const keep = clamp((reach - out) / edge, 0, 1) - 1; stepX += outX / out * along * keep; stepZ += outZ / out * along * keep; }
  }
  let x = walker.x + stepX, z = walker.z + stepZ;
  const travelled = Math.hypot(stepX, stepZ);
  if (travelled > 0 && height(x, z) - height(walker.x, walker.z) > travelled * climb) { x = walker.x; z = walker.z; walker.vx = 0; walker.vz = 0; }
  trunks?.(x, z, (tx, tz, radius) => {
    const dx = x - tx, dz = z - tz, gap = Math.hypot(dx, dz), room = radius + body;
    if (gap >= room) return;
    if (gap < 1e-6) { x = tx + room; return; }
    x = tx + dx / gap * room; z = tz + dz / gap * room;
  });
  walker.x = x; walker.z = z;
  walker.y += (height(x, z) + eye - walker.y) * (1 - Math.exp(-seconds / settle));
  return walker;
}
