function axis(centre, half, step, far, rings, refine) {
  const inner = Math.round(half / step), values = [];
  for (let i = -inner; i <= inner; i++) values.push(centre + i * step);
  const grow = (far / half) ** (1 / rings);
  for (let k = 1; k <= rings; k++) { values.push(centre + half * grow ** k); values.unshift(centre - half * grow ** k); }
  for (const [lo, hi, fine] of refine) for (let v = lo; v <= hi + 1e-9; v += fine) values.push(v);
  values.sort((a, b) => a - b);
  return Float64Array.from(values.filter((v, i) => i === 0 || v - values[i - 1] > 1e-3));
}

function cell(values, v) {
  let lo = 0, hi = values.length - 2;
  if (v <= values[0]) return 0;
  if (v >= values[hi + 1]) return hi;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (values[mid] <= v) lo = mid; else hi = mid - 1; }
  return lo;
}

export function createGround(heightAt, { centre = [0, 0], half = 52, step = 0.8, far = 900, rings = 28, refine = { x: [], z: [] } } = {}) {
  const [halfX, halfZ] = Array.isArray(half) ? half : [half, half];
  const xs = axis(centre[0], halfX, step, far, rings, refine.x), zs = axis(centre[1], halfZ, step, far, rings, refine.z), columns = xs.length;
  const heights = new Float32Array(columns * zs.length);
  for (let j = 0; j < zs.length; j++) for (let i = 0; i < columns; i++) heights[j * columns + i] = heightAt(xs[i], zs[j]);
  function at(x, z) {
    const i = cell(xs, x), j = cell(zs, z);
    const u = Math.min(1, Math.max(0, (x - xs[i]) / (xs[i + 1] - xs[i]))), v = Math.min(1, Math.max(0, (z - zs[j]) / (zs[j + 1] - zs[j])));
    const k = j * columns + i, h00 = heights[k], h10 = heights[k + 1], h01 = heights[k + columns], h11 = heights[k + columns + 1];
    return u >= v ? h00 + u * (h10 - h00) + v * (h11 - h10) : h00 + v * (h01 - h00) + u * (h11 - h01);
  }
  return { xs, zs, heights, columns, rows: zs.length, at };
}
