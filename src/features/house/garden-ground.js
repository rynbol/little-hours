const origin = [-1.2, -1.4];
const outlines = [[0, .05, 6, 5.4], [-3.4, -4.2, 3.4, 4.4]];
const profile = [[0, .985, '#a0b282'], [-.1, 1, '#a0b282'], [-.26, 1.004, '#829765'], [-.52, 1, '#baae91'], [-1.2, .99, '#b1a58c'], [-1.82, .97, '#a2987e'], [-2.15, .9, '#92917a'], [-2.24, .65, '#858b72']];

function edge(angle) {
  const dx = Math.cos(angle), dz = Math.sin(angle);
  const distance = Math.max(...outlines.map(([x, z, width, depth]) => {
    const ox = origin[0] - x, oz = origin[1] - z;
    const a = dx * dx / width ** 2 + dz * dz / depth ** 2;
    const b = 2 * (ox * dx / width ** 2 + oz * dz / depth ** 2);
    const c = ox * ox / width ** 2 + oz * oz / depth ** 2 - 1;
    return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  }));
  return distance * (1 + Math.sin(angle * 7 + 1) * .008 + Math.sin(angle * 11) * .005);
}

export function gardenGround() {
  const segments = 128, positions = [], colors = [], indices = [], normals = [];
  for (const [level, radius, hex] of profile) {
    const rgb = [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16) / 255);
    for (let i = 0; i < segments; i++) {
      const angle = i / segments * Math.PI * 2, reach = edge(angle) * radius;
      const folds = level < -.3 ? Math.sin(angle * 9 + level * .8) * .045 + Math.sin(angle * 17 - level) * .018 : 0;
      positions.push(origin[0] + Math.cos(angle) * (reach + folds), level, origin[1] + Math.sin(angle) * (reach + folds));
      const light = level < -.3 ? 1 + Math.sin(angle * 5 + level * 1.3) * .035 : 1;
      colors.push(...rgb.map(value => value * light), 1);
    }
  }
  for (let row = 0; row < profile.length - 1; row++) for (let i = 0; i < segments; i++) {
    const a = row * segments + i, b = row * segments + (i + 1) % segments, c = a + segments, d = b + segments;
    indices.push(a, c, b, b, c, d);
  }
  const top = positions.length / 3;
  positions.push(origin[0], 0, origin[1], origin[0], -2.24, origin[1]);
  colors.push(...colors.slice(0, 4), ...colors.slice(-4));
  for (let i = 0; i < segments; i++) {
    indices.push(top, i, (i + 1) % segments);
    indices.push(top + 1, (profile.length - 1) * segments + (i + 1) % segments, (profile.length - 1) * segments + i);
  }
  normals.push(...Array(positions.length).fill(0));
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    const u = [0, 1, 2].map(k => positions[b + k] - positions[a + k]), v = [0, 1, 2].map(k => positions[c + k] - positions[a + k]);
    const n = [u[2] * v[1] - u[1] * v[2], u[0] * v[2] - u[2] * v[0], u[1] * v[0] - u[0] * v[1]];
    for (const at of [a, b, c]) for (let k = 0; k < 3; k++) normals[at + k] += n[k];
  }
  for (let i = 0; i < normals.length; i += 3) {
    const size = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
    for (let k = 0; k < 3; k++) normals[i + k] /= size;
  }
  return { positions, colors, normals, indices };
}
