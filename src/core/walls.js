import { getFurniture } from './catalog.js';

// Wall pieces hang on the back wall or on the side wall. A wall piece stores
// its `wall`, `u` (its center along the wall: x on the back wall, z on the side
// wall) and `v` (its center height). Each room shell gives the mount face, the
// usable span and the fixtures that wall pieces keep clear of: posts, windows,
// curtains, vines, fairy lights, lanterns and ceiling lamps.
export const WALL_GRID = 0.05;
// Solid floor pieces keep this much space clear in front of a wall piece, so a
// bookcase never stands in front of a picture or through a shelf.
export const WALL_CLEARANCE = 0.5;
const EPSILON = 1e-7;
// `gap` is how far in front of the wall a fixture hangs: flat pieces that
// are no deeper than it (pictures, the clock) may hang behind it.
const fixture = (minU, maxU, minV, maxV, name, gap = 0) => ({ minU, maxU, minV, maxV, name, gap });
const string = (minU, maxU, minV, gap) => fixture(minU, maxU, minV, 5.6, 'fairy lights', gap);
const post = (minU, maxU) => fixture(minU, maxU, -1, 7, 'post');

export const SHELLS = {
  retreat: {
    back: { face: -4.49, min: -5.65, max: 5.68, bottom: 1.45, top: 5.66, fixtures: [
      post(-5.87, -5.65), post(-0.29, -0.07), post(5.68, 5.9),
      fixture(-5.01, -0.39, 1.36, 5.42, 'window'), fixture(-5.52, -4.77, 1.45, 5.48, 'curtain'), fixture(-0.63, 0.11, 1.45, 5.48, 'curtain'),
      fixture(-5.87, -5.11, 3.44, 5.68, 'vine'), fixture(-0.38, 0.73, 3.9, 5.85, 'vine'), fixture(0.3, 5.4, 4.95, 5.85, 'vine'),
      string(-5.65, -3.7, 4.951, 0.31), string(-3.7, -1.8, 4.772, 0.31), string(-1.8, 0.1, 4.69, 0.31),
      string(0.1, 2.0, 4.688, 0.31), string(2.0, 3.9, 4.806, 0.31), string(3.9, 5.68, 5.003, 0.31),
      fixture(1.37, 1.91, 3.96, 5.5, 'lantern'), fixture(4.13, 4.67, 4.155, 5.7, 'lantern'),
    ] },
    side: { face: -5.83, min: -4.27, max: 4.27, bottom: 1.45, top: 5.66, fixtures: [
      post(-0.21, 0.01),
      fixture(-4.27, -3.85, 3.44, 5.68, 'vine'), fixture(-2.24, -1.69, 3.9, 5.71, 'vine'),
      string(-4.27, -2.4, 4.872, 0.29), string(-2.4, -0.5, 4.712, 0.29), string(-0.5, 1.4, 4.698, 0.29),
      string(1.4, 3.3, 4.783, 0.29), string(3.3, 4.27, 5.022, 0.29),
      fixture(2.59, 3.13, 3.93, 5.48, 'lantern'),
    ] },
  },
  sakura: {
    back: { face: -4.49, min: -5.68, max: 5.72, bottom: 1.1, top: 5.31, fixtures: [
      post(-0.43, -0.27), fixture(-4.975, -0.425, 1.1, 5.31, 'window'),
      fixture(0.23, 0.97, 4.56, 5.72, 'lamp', 0.42), fixture(4.25, 5.25, 4.04, 5.72, 'lamp', 0.24),
    ] },
    side: { face: -5.65, min: -4.28, max: 4.5, bottom: 1.1, top: 5.31, fixtures: [] },
  },
  cloud: {
    back: { face: -4.49, min: -5.68, max: 5.9, bottom: 1.35, top: 5.71, fixtures: [
      fixture(-4.76, -0.64, 1.29, 5.41, 'window'),
      fixture(0.03, 0.57, 4.65, 5.72, 'lamp', 0.72), fixture(3.03, 3.67, 3.9, 5.72, 'lamp', 0.57), fixture(4.86, 5.34, 4.83, 5.72, 'lamp', 0.7),
    ] },
    side: { face: -5.83, min: -4.29, max: 4.5, bottom: 1.35, top: 5.71, fixtures: [] },
  },
  metro: {
    back: { face: -4.49, min: -5.59, max: 5.9, bottom: 1.54, top: 5.17, fixtures: [fixture(-5.3, 3.3, 1.4, 5.31, 'window')] },
    side: { face: -5.7975, min: -4.3, max: 4.28, bottom: 1.54, top: 5.17, fixtures: [post(0.1, 0.3), fixture(-0.84, -0.76, -1, 7, 'pipe')] },
  },
};
const shellOf = style => SHELLS[style] || SHELLS.retreat;

export const isWallPiece = item => getFurniture(item?.type)?.mount === 'wall';
export function wallRect(item) {
  const [width, height] = getFurniture(item.type).size;
  return { minU: item.u - width / 2, maxU: item.u + width / 2, minV: item.v - height / 2, maxV: item.v + height / 2 };
}
// The world box a wall piece fills, `depth` out from its wall.
export function wallBox(item, style = 'retreat', depth = getFurniture(item.type).depth) {
  const rect = wallRect(item), face = shellOf(style)[item.wall].face;
  return item.wall === 'back'
    ? { minX: rect.minU, maxX: rect.maxU, minY: rect.minV, maxY: rect.maxV, minZ: face, maxZ: face + depth }
    : { minX: face, maxX: face + depth, minY: rect.minV, maxY: rect.maxV, minZ: rect.minU, maxZ: rect.maxU };
}
// The space a wall piece keeps clear of solid floor pieces.
export const wallClearance = (item, style) => wallBox(item, style, Math.max(WALL_CLEARANCE, getFurniture(item.type).depth));
export function floorBox(item) {
  const definition = getFurniture(item.type), [width, depth] = item.rotation % 2 ? [...definition.footprint].reverse() : definition.footprint;
  return { minX: item.x - width / 2, maxX: item.x + width / 2, minY: 0.22, maxY: 0.22 + definition.height, minZ: item.z - depth / 2, maxZ: item.z + depth / 2 };
}
export const boxesMeet = (a, b) => a.minX < b.maxX - EPSILON && a.maxX > b.minX + EPSILON && a.minY < b.maxY - EPSILON && a.maxY > b.minY + EPSILON && a.minZ < b.maxZ - EPSILON && a.maxZ > b.minZ + EPSILON;
const rectsMeet = (a, b) => a.minU < b.maxU - EPSILON && a.maxU > b.minU + EPSILON && a.minV < b.maxV - EPSILON && a.maxV > b.minV + EPSILON;
const nameOf = item => getFurniture(item.type).name.toLowerCase();

// Why a wall piece cannot hang at `candidate`, or '' when it can. `others`
// excludes the candidate itself.
export function wallPlacementReason(others, candidate, style = 'retreat') {
  if (!['back', 'side'].includes(candidate.wall) || !Number.isFinite(candidate.u) || !Number.isFinite(candidate.v)) return 'Choose a spot on a wall.';
  const shell = shellOf(style)[candidate.wall], rect = wallRect(candidate);
  if (rect.minU < shell.min - EPSILON || rect.maxU > shell.max + EPSILON || rect.minV < shell.bottom - EPSILON || rect.maxV > shell.top + EPSILON) return 'Keep the whole piece on the wall.';
  const depth = getFurniture(candidate.type).depth, fixed = shell.fixtures.find(entry => depth > entry.gap && rectsMeet(rect, entry));
  if (fixed) return `That spot is taken by the ${fixed.name}.`;
  const box = wallBox(candidate, style), clear = wallClearance(candidate, style);
  const neighbor = others.find(other => isWallPiece(other) && boxesMeet(box, wallBox(other, style)));
  if (neighbor) return `That spot overlaps the ${nameOf(neighbor)}.`;
  const blocker = others.find(other => !isWallPiece(other) && getFurniture(other.type)?.blocking && boxesMeet(clear, floorBox(other)));
  return blocker ? `The ${nameOf(blocker)} stands in front of that spot.` : '';
}
// Why a solid floor piece at `candidate` would stand in front of a wall piece.
export function wallClearanceReason(others, candidate, style = 'retreat') {
  if (!getFurniture(candidate.type)?.blocking) return '';
  const box = floorBox(candidate), piece = others.find(other => isWallPiece(other) && boxesMeet(box, wallClearance(other, style)));
  return piece ? `That spot is in front of the ${nameOf(piece)}.` : '';
}

// Grid offsets in rings out to `reach`, nearest first, shared by every search.
const rings = new Map();
function ringOffsets(reach) {
  if (!rings.has(reach)) {
    const steps = Math.floor(reach / WALL_GRID + EPSILON), offsets = [];
    for (let i = -steps; i <= steps; i++) for (let j = -steps; j <= steps; j++) if (Math.hypot(i, j) * WALL_GRID <= reach + EPSILON) offsets.push([i * WALL_GRID, j * WALL_GRID, Math.hypot(i, j)]);
    offsets.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]); rings.set(reach, offsets);
  }
  return rings.get(reach);
}
// Dividing by the step count keeps grid values exact decimals (2.65, not 2.6500000000000004).
export const snapWall = value => Math.round(value / WALL_GRID) / Math.round(1 / WALL_GRID);
// The closest free spot on the same wall, within `reach`.
export function nearestWallSpot(others, candidate, style = 'retreat', reach = 0.75) {
  const u = snapWall(candidate.u), v = snapWall(candidate.v);
  for (const [du, dv] of ringOffsets(reach)) {
    const spot = { u: Math.round((u + du) * 1000) / 1000, v: Math.round((v + dv) * 1000) / 1000 };
    if (!wallPlacementReason(others, { ...candidate, ...spot }, style)) return spot;
  }
  return null;
}
// A free spot for a new wall piece: the back wall first, at eye height,
// searching outwards from the middle of each wall.
export function findFreeWallSpot(items, type, style = 'retreat') {
  for (const wall of ['back', 'side']) {
    const shell = shellOf(style)[wall], [width, height] = getFurniture(type).size;
    const us = []; for (let u = snapWall(shell.min + width / 2 + WALL_GRID); u <= shell.max - width / 2; u += 0.25) us.push(Math.round(u * 1000) / 1000);
    us.sort((a, b) => Math.abs(a - (shell.min + shell.max) / 2) - Math.abs(b - (shell.min + shell.max) / 2));
    const vs = []; for (let v = snapWall(shell.bottom + height / 2 + WALL_GRID); v <= shell.top - height / 2; v += 0.25) vs.push(Math.round(v * 1000) / 1000);
    vs.sort((a, b) => Math.abs(a - 3.3) - Math.abs(b - 3.3));
    for (const v of vs) for (const u of us) if (!wallPlacementReason(items, { type, wall, u, v }, style)) return { wall, u, v };
  }
  return null;
}

// Windows cut a real opening through their wall, so daylight falls through
// them. The opening sits just inside the frame, which covers its cut edges.
export const OPENING_INSET = 0.06;
export const isOpening = item => Boolean(getFurniture(item?.type)?.opening);
export function openings(items, skipId = null) {
  return items.filter(item => isOpening(item) && item.id !== skipId).map(item => {
    const rect = wallRect(item);
    return { wall: item.wall, minU: rect.minU + OPENING_INSET, maxU: rect.maxU - OPENING_INSET, minV: rect.minV + OPENING_INSET, maxV: rect.maxV - OPENING_INSET };
  });
}
// The parts of `rect` outside `hole`: whole-height strips left and right of
// it, then the pieces below and above it.
export function subtractRect(rect, hole) {
  if (hole.minU >= rect.maxU || hole.maxU <= rect.minU || hole.minV >= rect.maxV || hole.maxV <= rect.minV) return [rect];
  const parts = [];
  if (hole.minU > rect.minU) parts.push({ ...rect, maxU: hole.minU });
  if (hole.maxU < rect.maxU) parts.push({ ...rect, minU: hole.maxU });
  const minU = Math.max(rect.minU, hole.minU), maxU = Math.min(rect.maxU, hole.maxU);
  if (hole.minV > rect.minV) parts.push({ minU, maxU, minV: rect.minV, maxV: hole.minV });
  if (hole.maxV < rect.maxV) parts.push({ minU, maxU, minV: hole.maxV, maxV: rect.maxV });
  return parts;
}
// A rectangle minus every hole; slivers under 1 mm are dropped.
export function cutRect(rect, holes) {
  let parts = [rect];
  for (const hole of holes) parts = parts.flatMap(part => subtractRect(part, hole));
  return parts.filter(part => part.maxU - part.minU > 0.001 && part.maxV - part.minV > 0.001);
}
