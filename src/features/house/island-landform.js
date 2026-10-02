export const ISLAND = Object.freeze({ cx: 2.85, cz: .1, rx: 10.15, rz: 5.2, power: 2.9 });

export function edgePoint(a, scale = 1) {
  const { cx, cz, rx, rz, power } = ISLAND, c = Math.cos(a), s = Math.sin(a);
  const r = (Math.abs(c / rx) ** power + Math.abs(s / rz) ** power) ** (-1 / power);
  const wobble = 1 + .018 * Math.sin(a * 5 + 1.3) + .012 * Math.sin(a * 9 + .4) + .008 * Math.sin(a * 17 + 2);
  return [cx + c * r * wobble * scale, cz + s * r * wobble * scale];
}
export function onIsland(x, z, margin = 0) {
  const { cx, cz } = ISLAND, a = Math.atan2(z - cz, x - cx), [ex, ez] = edgePoint(a);
  return Math.hypot(x - cx, z - cz) <= Math.hypot(ex - cx, ez - cz) - margin;
}

export const FOREST_REACH = Object.freeze({ from: -2.3, to: -.3, peak: 1.1, lean: 2.3 });

export function forestBulge(a) {
  const { from, to, peak, lean } = FOREST_REACH, t = (Math.atan2(Math.sin(a), Math.cos(a)) - from) / (to - from);
  return t <= 0 || t >= 1 ? 0 : peak * Math.sin(Math.PI * t ** lean) ** 2 * (1 + .07 * Math.sin(a * 11 + .5) + .04 * Math.sin(a * 23 + 1.7));
}

export const landmassEdge = (a, scale = 1) => edgePoint(a, scale * (1 + forestBulge(a)));

export function onLandmass(x, z, margin = 0) {
  const { cx, cz } = ISLAND, a = Math.atan2(z - cz, x - cx), [ex, ez] = landmassEdge(a);
  return Math.hypot(x - cx, z - cz) <= Math.hypot(ex - cx, ez - cz) - margin;
}
