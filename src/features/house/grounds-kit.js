const rgb = hex => [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16) / 255);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = v => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
export const groundsHash = n => { const s = Math.sin(n * 91.7 + 17.3) * 43758.5453; return s - Math.floor(s); };

export function groundsKit() {
  const positions = [], colors = [], normals = [];
  const paint = (hex, light = 1) => [...rgb(hex).map(value => value * light), 1];
  function tri(a, b, c, color, facing) {
    const n = cross(sub(b, a), sub(c, a));
    const [p, q] = dot(n, facing) > 0 ? [c, b] : [b, c];
    const normal = unit(dot(n, facing) > 0 ? n : n.map(value => -value));
    for (const point of [a, p, q]) { positions.push(...point); colors.push(...color); normals.push(...normal); }
  }
  function quad(a, b, c, d, color, facing) { tri(a, b, c, color, facing); tri(a, c, d, color, facing); }
  function solid(rings, color, center, { top = 1, bottom = false } = {}) {
    const count = rings[0].length;
    for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < count; i++) {
      const a = rings[r][i], b = rings[r][(i + 1) % count], c = rings[r + 1][(i + 1) % count], d = rings[r + 1][i];
      const mid = [0, 1, 2].map(k => (a[k] + b[k] + c[k] + d[k]) / 4);
      quad(a, b, c, d, paint(color, .84 + .1 * Math.cos(i * 2.1)), sub(mid, center));
    }
    const cap = (ring, up, light) => {
      const middle = [0, 1, 2].map(k => ring.reduce((sum, point) => sum + point[k], 0) / count);
      for (let i = 0; i < count; i++) tri(middle, ring[i], ring[(i + 1) % count], paint(color, light), [0, up, 0]);
    };
    cap(rings[0], 1, top);
    if (bottom) cap(rings.at(-1), -1, .7);
  }
  const kit = {
    beam(a, b, width, height, hex, light = 1) {
      const dir = unit(sub(b, a)), side = unit(cross(Math.abs(dir[1]) > .95 ? [1, 0, 0] : [0, 1, 0], dir)), up = cross(dir, side);
      const corner = (p, u, v) => p.map((value, k) => value + side[k] * u * width / 2 + up[k] * v * height / 2);
      const ring = p => [corner(p, -1, 1), corner(p, 1, 1), corner(p, 1, -1), corner(p, -1, -1)];
      const center = [0, 1, 2].map(k => (a[k] + b[k]) / 2), color = paint(hex, light), dark = paint(hex, light * .82);
      const ra = ring(a), rb = ring(b);
      for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad(ra[i], ra[j], rb[j], rb[i], i % 2 ? dark : color, sub(ra[i].map((v, k) => (v + ra[j][k]) / 2), a)); }
      quad(...ra, dark, sub(a, center)); quad(...rb, color, sub(b, center));
    },
    post(x, y, z, height, radius, hex, { sides = 6, taper = .82, lean = [0, 0], seed = 0 } = {}) {
      const ring = (level, scale) => Array.from({ length: sides }, (_, i) => {
        const a = i / sides * Math.PI * 2 + seed, wobble = 1 + (groundsHash(seed * 13 + i) - .5) * .18;
        return [x + Math.cos(a) * radius * scale * wobble + lean[0] * (level - y), level, z + Math.sin(a) * radius * scale * wobble + lean[1] * (level - y)];
      });
      solid([ring(y + height, taper), ring(y, 1)], hex, [x, y + height / 2, z], { top: 1.08 });
    },
    slab(x, y, z, radius, thick, hex, { sides = 7, seed = 0, stretch = 1, yaw = 0, light = 1 } = {}) {
      const ring = (level, scale) => Array.from({ length: sides }, (_, i) => {
        const a = (i + groundsHash(seed + i * 3.1) * .55) / sides * Math.PI * 2, r = radius * scale * (.78 + groundsHash(seed * 7 + i) * .3);
        const u = Math.cos(a) * r * stretch, v = Math.sin(a) * r;
        return [x + u * Math.cos(yaw) - v * Math.sin(yaw), level, z + u * Math.sin(yaw) + v * Math.cos(yaw)];
      });
      solid([ring(y, .86), ring(y - thick * .35, 1), ring(y - thick, 1.04)], hex, [x, y - thick * 2, z], { top: light * 1.04 });
    },
    blob(x, y, z, w, h, d, hex, light = 1, { rows = 3, sides = 6, seed = 0, glowing = false } = {}) {
      const rings = [], first = normals.length;
      for (let r = 0; r <= rows; r++) {
        const phi = r / rows * Math.PI, level = y + Math.cos(phi) * h / 2, spread = Math.sin(phi);
        rings.push(Array.from({ length: sides }, (_, i) => { const a = (i + r * .5) / sides * Math.PI * 2 + seed; return [x + Math.cos(a) * w / 2 * spread, level, z + Math.sin(a) * d / 2 * spread]; }));
      }
      const center = [x, y, z], count = sides;
      for (let r = 0; r < rows; r++) for (let i = 0; i < count; i++) {
        const a = rings[r][i], b = rings[r][(i + 1) % count], c = rings[r + 1][(i + 1) % count], e = rings[r + 1][i];
        const shade = paint(hex, light * (.82 + .18 * (1 - r / rows)));
        if (r === 0) tri(a, c, e, shade, sub(c, center));
        else if (r === rows - 1) tri(a, b, e, shade, sub(a, center));
        else quad(a, b, c, e, shade, sub([0, 1, 2].map(k => (a[k] + c[k]) / 2), center));
      }
      if (glowing) for (let i = first; i < normals.length; i += 3) normals.splice(i, 3, 0, 1, 0);
    },
    patch(points, y, hex, light = 1) {
      const middle = [points.reduce((s, p) => s + p[0], 0) / points.length, y, points.reduce((s, p) => s + p[1], 0) / points.length];
      points.forEach((p, i) => { const q = points[(i + 1) % points.length]; tri(middle, [p[0], y, p[1]], [q[0], y, q[1]], paint(hex, light), [0, 1, 0]); });
    },
    ribbon(rows, colorsByRow, facing = [0, 1, 0]) {
      for (let i = 0; i < rows.length - 1; i++) for (let k = 0; k < rows[i].length - 1; k++) {
        const a = rows[i][k], b = rows[i][k + 1], c = rows[i + 1][k + 1], d = rows[i + 1][k];
        const ca = colorsByRow[i][k], cb = colorsByRow[i][k + 1], cc = colorsByRow[i + 1][k + 1], cd = colorsByRow[i + 1][k];
        for (const [p, q, r, cp, cq, cr] of [[a, b, c, ca, cb, cc], [a, c, d, ca, cc, cd]]) {
          const n = cross(sub(q, p), sub(r, p)), flip = dot(n, facing) > 0, normal = unit(flip ? n : n.map(value => -value));
          for (const [point, color] of flip ? [[p, cp], [r, cr], [q, cq]] : [[p, cp], [q, cq], [r, cr]]) { positions.push(...point); colors.push(...color); normals.push(...normal); }
        }
      }
    },
    paint,
    absorb(other, scale, origin) {
      const from = other.data;
      for (let i = 0; i < from.positions.length; i++) positions.push(origin[i % 3] + (from.positions[i] - origin[i % 3]) * scale);
      colors.push(...from.colors); normals.push(...from.normals);
      for (const list of Object.values(from)) list.length = 0;
    },
    flush(api) {
      if (positions.length) api.shape(positions.splice(0), colors.splice(0), normals.splice(0));
    },
    get vertices() { return positions.length / 3; },
    data: { positions, colors, normals },
  };
  return kit;
}

const footStone = '#b3ab97';

export function lanternPost(kit, x, y, z, [glow, strength], { yaw = 0, height = 1.05, seed = 0, wood: lanternWood = '#a07a54', iron: lanternIron = '#3f3a33' } = {}) {
  const ax = Math.cos(yaw), az = Math.sin(yaw), lean = (groundsHash(seed) - .5) * .05;
  kit.slab(x, y + .05, z, .17, .07, footStone, { sides: 6, seed });
  kit.post(x, y, z, height, .055, lanternWood, { sides: 5, taper: .8, lean: [lean, -lean * .6], seed });
  const top = [x + lean * height, y + height, z - lean * .6 * height];
  kit.blob(top[0], top[1] + .02, top[2], .1, .07, .1, lanternWood, 1.1, { rows: 2, sides: 5 });
  const tip = [top[0] + ax * .3, top[1] - .02, top[2] + az * .3];
  kit.beam([top[0], top[1] - .06, top[2]], tip, .035, .035, lanternWood);
  kit.beam([top[0], top[1] - .25, top[2]], [top[0] + ax * .17, top[1] - .07, top[2] + az * .17], .025, .025, lanternWood);
  const hang = [tip[0], tip[1] - .07, tip[2]];
  kit.beam(tip, hang, .012, .012, lanternIron);
  const [hx, hy, hz] = hang, body = .19;
  kit.post(hx, hy - .045, hz, .045, .03, lanternIron, { sides: 4, taper: .3, seed: Math.PI / 4 });
  kit.post(hx, hy - .075, hz, .045, .13, lanternIron, { sides: 4, taper: .35, seed: Math.PI / 4 });
  kit.blob(hx, hy - .075 - body / 2, hz, .12, body * .95, .12, glow, strength, { rows: 3, sides: 6, glowing: true });
  for (const [u, w] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) kit.beam([hx + u * .058, hy - .075, hz + w * .058], [hx + u * .058, hy - .075 - body, hz + w * .058], .016, .016, lanternIron);
  kit.slab(hx, hy - .075 - body, hz, .07, .025, lanternIron, { sides: 4, seed: 1 });
}

export function stringLights(kit, points, [glow, strength], { sag = .22, spacing = .24, wire = '#6b5a47' } = {}) {
  const bulbs = [];
  for (let s = 0; s < points.length - 1; s++) {
    const a = points[s], b = points[s + 1], span = Math.hypot(b[0] - a[0], b[2] - a[2]), steps = Math.max(4, Math.round(span / .14));
    const at = t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag * Math.min(1.4, span / 1.6), a[2] + (b[2] - a[2]) * t];
    for (let i = 0; i < steps; i++) kit.beam(at(i / steps), at((i + 1) / steps), .011, .011, wire);
    const count = Math.max(1, Math.floor(span / spacing));
    for (let i = 1; i < count; i++) {
      const [x, y, z] = at(i / count);
      kit.beam([x, y, z], [x, y - .05, z], .012, .012, wire);
      kit.blob(x, y - .085, z, .085, .1, .085, glow, strength * (i % 3 === 1 ? 1.06 : 1), { rows: 2, sides: 5, glowing: true });
      bulbs.push([x, y - .085, z]);
    }
  }
  return bulbs;
}

export function railFence(kit, posts, y, { wood = '#94704f', rail = '#a8845f', height = .5, seed = 0 } = {}) {
  const tops = posts.map(([x, z], i) => {
    const h = height * (.92 + groundsHash(seed + i * 5.3) * .16), lean = (groundsHash(seed + i * 2.7) - .5) * .06;
    kit.post(x, y - .04, z, h + .04, .05, wood, { sides: 5, taper: .78, lean: [lean, lean * .5], seed: seed + i });
    return [x + lean * h, y + h, z + lean * .5 * h];
  });
  for (let i = 0; i < posts.length - 1; i++) {
    const a = tops[i], b = tops[i + 1];
    for (const [drop, droop] of [[.12, .02], [.33, .035]]) {
      const lift = (groundsHash(seed + i * 9.1 + drop) - .5) * .05;
      const p = [a[0], a[1] - drop + lift, a[2]], q = [b[0], b[1] - drop - lift, b[2]];
      const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2 - droop, (p[2] + q[2]) / 2];
      kit.beam(p, mid, .045, .055, rail); kit.beam(mid, q, .045, .055, rail);
    }
  }
}

export function gardenBench(kit, x, y, z, yaw, { wood = '#a97a52', dark = '#6f5039', cushion = '#c7866e', length = 1.05 } = {}) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const at = (u, v, w) => [x + u * c - w * s, y + v, z + u * s + w * c];
  for (const u of [-length / 2 + .08, length / 2 - .08]) {
    kit.beam(at(u, 0, .1), at(u, .32, .1), .07, .07, dark);
    kit.beam(at(u, 0, -.12), at(u, .66, -.15), .07, .07, dark);
    kit.beam(at(u, .44, .14), at(u, .44, -.15), .06, .06, dark);
    kit.beam(at(u, .2, .1), at(u, .44, .14), .055, .055, dark);
  }
  for (const [i, w] of [.08, -.01, -.1].entries()) kit.beam(at(-length / 2, .33, w), at(length / 2, .33, w), .085, .04, wood, i === 1 ? .93 : 1);
  for (const v of [.48, .6]) kit.beam(at(-length / 2 + .02, v, -.15 + (v - .48) * .07), at(length / 2 - .02, v, -.15 + (v - .48) * .07), .09, .03, wood);
  kit.blob(...at(-length * .16, .38, -.01), .42, .08, .26, cushion, 1, { rows: 2, sides: 6 });
  kit.blob(...at(length * .24, .49, -.08), .2, .2, .08, '#e4cf9e', 1, { rows: 3, sides: 5 });
}

export function barrelPlanter(kit, x, y, z, { radius = .22, height = .28, seed = 0, blooms = ['#e6a0a8', '#f2d88f', '#c9b1e6'] } = {}) {
  kit.post(x, y, z, height, radius, '#8f6a4a', { sides: 9, taper: 1.08, seed });
  for (const level of [.06, height - .06]) kit.post(x, y + level - .018, z, .036, radius * (level > .1 ? 1.1 : 1.02), '#4f4135', { sides: 9, taper: 1, seed });
  kit.blob(x, y + height + .02, z, radius * 1.9, .1, radius * 1.9, '#5f4a38', 1, { rows: 2, sides: 8 });
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4 + seed, r = i ? radius * .55 : 0, fx = x + Math.cos(a) * r, fz = z + Math.sin(a) * r, h = height + .14 + groundsHash(seed + i) * .14;
    kit.blob(fx, y + h - .05, fz, .17, .13, .17, ['#6f8e57', '#82a062', '#5f7f4c'][i % 3], 1, { rows: 2, sides: 5, seed: i });
    if (i % 2 === 0) kit.blob(fx + .03, y + h + .02, fz, .09, .07, .09, blooms[(i / 2 + seed) % blooms.length], 1.08, { rows: 2, sides: 5 });
  }
}

export function wildflowers(kit, x, y, z, seed, { count = 6, spread = .2, height = .2, palette = ['#f1e6c8', '#e9b3b9', '#f4d47c', '#b9a3dc', '#ffffff'] } = {}) {
  kit.blob(x, y + .02, z, spread * 2.2, .07, spread * 1.9, ['#6f8f4f', '#7d9a55', '#678a4c'][seed % 3], 1, { rows: 2, sides: 6, seed });
  for (let i = 0; i < count; i++) {
    const a = i * 2.4 + seed * 1.3, r = spread * (.25 + groundsHash(seed * 3 + i) * .75), fx = x + Math.cos(a) * r, fz = z + Math.sin(a) * r;
    const h = height * (.55 + groundsHash(seed * 5 + i) * .6);
    kit.beam([fx, y, fz], [fx + (groundsHash(i + seed) - .5) * .04, y + h, fz], .014, .014, '#5f7c45');
    kit.blob(fx, y + h + .015, fz, .095, .055, .095, palette[(i + seed) % palette.length], 1.06, { rows: 2, sides: 5, seed: i });
  }
}
