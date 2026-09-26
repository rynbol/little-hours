// Fit the authored pieces, not a single oversized cube around an L-shaped home.
// The point groups are built once; orbiting only projects the cached bounds.
export function boundsPoints(parts) {
  const points = [];
  for (const part of parts) {
    const p = part.positions;
    if (!p?.length) continue;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < p.length; i += 3) {
      x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]);
      y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]);
      z0 = Math.min(z0, p[i + 2]); z1 = Math.max(z1, p[i + 2]);
    }
    for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) points.push(x, y, z);
  }
  return new Float32Array(points);
}

export function houseFrame(groups, view, aspect, occupancy = .94) {
  const m = view.m;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const { points, offset, node } of groups) {
    // A hinged part frames in its current pose, through its node's world matrix.
    const w = node?.getWorldMatrix().m;
    for (let i = 0; i < points.length; i += 3) {
      let x = points[i] + (offset?.x || 0), y = points[i + 1] + (offset?.y || 0), z = points[i + 2] + (offset?.z || 0);
      if (w) [x, y, z] = [x * w[0] + y * w[4] + z * w[8] + w[12], x * w[1] + y * w[5] + z * w[9] + w[13], x * w[2] + y * w[6] + z * w[10] + w[14]];
      const px = x * m[0] + y * m[4] + z * m[8] + m[12];
      const py = x * m[1] + y * m[5] + z * m[9] + m[13];
      minX = Math.min(minX, px); maxX = Math.max(maxX, px);
      minY = Math.min(minY, py); maxY = Math.max(maxY, py);
    }
  }
  const height = Math.max(maxY - minY, (maxX - minX) / Math.max(.1, aspect)) / occupancy;
  return { x: (maxX + minX) / 2, y: (maxY + minY) / 2, height };
}
