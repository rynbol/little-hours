const TAU = Math.PI * 2;
const hash = n => { const s = Math.sin(n * 47.9 + 3.7) * 43758.5453; return s - Math.floor(s); };
const rgb = hex => [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16) / 255);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

export const BEDS = Object.freeze([
  { x: -2.35, z: -1.95, width: 2.3, depth: 1.65, turn: .28, dent: .16 },
  { x: 2.35, z: -1.95, width: 2.3, depth: 1.65, turn: -.28, dent: .16 },
  { x: -2.95, z: .25, width: 1.72, depth: 1.6, turn: 0, dent: 0 },
  { x: 2.95, z: .25, width: 1.72, depth: 1.6, turn: 0, dent: 0 },
  { x: -2.25, z: 2.4, width: 2.1, depth: 1.55, turn: -.32, dent: .1 },
  { x: 2.25, z: 2.4, width: 2.1, depth: 1.55, turn: .32, dent: .1 },
].map(Object.freeze));
export const BED = Object.freeze({ rim: .27, soil: .2, stakes: 30, bands: 3 });
export const BED_LIGHT = Object.freeze({ day: [1, 1, 1], dusk: [.92, .88, 1], rain: [.8, .84, .88] });
export const SOIL_WET = Object.freeze({ day: 1, dusk: 1, rain: .7 });
const WILLOW = ['#a07a4e', '#c49c68', '#84603c'], STAKE = ['#7a5a3c', '#b08a5c'], SOIL = ['#6b4c38', '#977354', '#57402f'], STONE = ['#8e8b84', '#a7a399'], MOSS = '#6f9440', CARD = '#efe2c2';

export function bedEdge(bed, angle, scale = 1) {
  const wobble = 1 + Math.sin(angle * 3 + bed.x * 1.7) * .03 - bed.dent * Math.max(0, Math.cos(angle - Math.PI / 2)) ** 6;
  const lx = Math.cos(angle) * bed.width / 2 * wobble * scale, lz = Math.sin(angle) * bed.depth / 2 * wobble * scale, c = Math.cos(bed.turn), s = Math.sin(bed.turn);
  return [bed.x + lx * c - lz * s, bed.z + lx * s + lz * c];
}

export function inBed(x, z, margin = 0, beds = BEDS) {
  return beds.some(bed => {
    const angle = Math.atan2((-(x - bed.x) * Math.sin(bed.turn) + (z - bed.z) * Math.cos(bed.turn)) / bed.depth, ((x - bed.x) * Math.cos(bed.turn) + (z - bed.z) * Math.sin(bed.turn)) / bed.width);
    const [ex, ez] = bedEdge(bed, angle);
    return Math.hypot(x - bed.x, z - bed.z) < Math.hypot(ex - bed.x, ez - bed.z) + margin;
  });
}

export const bedMarker = bed => { const [x, z] = bedEdge(bed, Math.PI * .28 - bed.turn, .78); return [x, z]; };

function shape() {
  const body = { positions: [], colors: [], normals: [] };
  const tri = (a, b, c, ca, cb = ca, cc = ca, normal) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const turn = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx], out = normal || (turn[1] < 0 ? turn.map(v => -v) : turn), length = Math.hypot(...out) || 1;
    if (turn[0] * out[0] + turn[1] * out[1] + turn[2] * out[2] > 0) { [b, c] = [c, b]; [cb, cc] = [cc, cb]; }
    body.positions.push(...a, ...b, ...c); body.colors.push(...ca, 1, ...cb, 1, ...cc, 1);
    for (let i = 0; i < 3; i++) body.normals.push(out[0] / length, out[1] / length, out[2] / length);
  };
  return { body, tri, quad(a, b, c, d, ca, cb = ca, normal) { tri(a, b, c, ca, ca, cb, normal); tri(b, d, c, ca, cb, cb, normal); } };
}

export function bedBody(bed, theme = 'day', slot = 0) {
  const { body, tri, quad } = shape(), light = BED_LIGHT[theme] || BED_LIGHT.day, wet = SOIL_WET[theme] || 1;
  const lit = (color, shade = 1) => color.map((v, i) => v * light[i] * shade);
  const { stakes, bands, rim, soil } = BED, steps = stakes * 2;
  const ring = (scale, y, weave = 0) => Array.from({ length: steps + 1 }, (_, i) => { const [x, z] = bedEdge(bed, i / steps * TAU, scale + (i % 2 ? weave : -weave)); return [x, y, z]; });
  const outward = i => { const [ax, az] = bedEdge(bed, (i - .5) / steps * TAU), [bx, bz] = bedEdge(bed, (i + .5) / steps * TAU), l = Math.hypot(bx - ax, bz - az) || 1; return [(bz - az) / l, .25, -(bx - ax) / l]; };
  for (let level = 0; level < bands; level++) {
    const low = ring(1, level * rim / bands, level % 2 ? .012 : -.012), high = ring(1, (level + 1) * rim / bands - .012, level % 2 ? .012 : -.012);
    for (let i = 0; i < steps; i++) {
      const tone = rgb(WILLOW[(Math.floor((i + level) / 2) + level) % 3]), shade = .9 + hash(i * 3.1 + level * 7 + slot) * .2;
      quad(low[i + 1], low[i], high[i + 1], high[i], lit(tone, shade * .9), lit(tone, shade * 1.08), outward(i + .5));
    }
  }
  const lip = ring(1, rim - .012), inner = ring(.94, rim - .03);
  for (let i = 0; i < steps; i++) quad(lip[i], lip[i + 1], inner[i], inner[i + 1], lit(rgb(WILLOW[1]), 1.05), lit(rgb(WILLOW[0])), [0, 1, 0]);
  for (let i = 0; i < stakes; i++) {
    const angle = (i + .5) / stakes * TAU, [x, z] = bedEdge(bed, angle, 1.005), top = rim + .025 + hash(i * 5.7 + slot) * .03, r = .034;
    const corners = [0, 1, 2, 3].map(k => [x + Math.cos(angle + k * TAU / 4) * r, z + Math.sin(angle + k * TAU / 4) * r]);
    for (let k = 0; k < 4; k++) {
      const [ax, az] = corners[k], [bx, bz] = corners[(k + 1) % 4], normal = [(ax + bx) / 2 - x, 0, (az + bz) / 2 - z].map(v => v / (r * .71));
      quad([bx, 0, bz], [ax, 0, az], [bx, top, bz], [ax, top, az], lit(rgb(STAKE[0])), lit(rgb(STAKE[1])), normal);
    }
    tri([x, top + .02, z], [corners[0][0], top, corners[0][1]], [corners[1][0], top, corners[1][1]], lit(rgb(STAKE[1]), 1.1), undefined, undefined, [0, 1, 0]);
    tri([x, top + .02, z], [corners[2][0], top, corners[2][1]], [corners[3][0], top, corners[3][1]], lit(rgb(STAKE[1]), 1.1), undefined, undefined, [0, 1, 0]);
  }
  const rows = 6, segments = 40, c = Math.cos(bed.turn), s = Math.sin(bed.turn);
  const ground = (k, j) => {
    const t = k / rows, [ex, ez] = bedEdge(bed, j / segments * TAU, .94 * t), along = (ex - bed.x) * c + (ez - bed.z) * s;
    const furrow = Math.sin(along * 9) * (1 - t * t * t), y = soil + (1 - t * t) * .13 + furrow * .034 + (hash(k * 9.1 + j * 2.3 + slot) - .5) * .012;
    const tone = mix(mix(rgb(SOIL[0]), rgb(SOIL[1]), .5 + furrow * .5), rgb(SOIL[2]), hash(k * 3.3 + j * 7.1 + slot) * .35);
    return [[ex, y, ez], lit(tone, wet)];
  };
  for (let k = 0; k < rows; k++) for (let j = 0; j < segments; j++) {
    const [a, ca] = ground(k, j), [b, cb] = ground(k, j + 1), [d, cd] = ground(k + 1, j), [e, ce] = ground(k + 1, j + 1);
    if (k) tri(a, d, b, ca, cd, cb);
    tri(b, d, e, cb, cd, ce);
  }
  for (let i = 0; i < 5; i++) {
    const angle = hash(slot * 3.3 + i * 1.9) * TAU, [x, z] = bedEdge(bed, angle, 1.07), size = .09 + hash(i * 4.4 + slot) * .07, mossy = hash(i * 6.6 + slot) > .45;
    const base = Array.from({ length: 6 }, (_, k) => [x + Math.cos(k / 6 * TAU) * size * (.85 + hash(k + i * 3) * .3), 0, z + Math.sin(k / 6 * TAU) * size * .8]), top = [x, size * .85, z];
    for (let k = 0; k < 6; k++) {
      const p = base[k], q = base[(k + 1) % 6], shade = .85 + hash(k * 2.2 + i) * .3;
      tri(top, q, p, lit(mossy ? mix(rgb(STONE[1]), rgb(MOSS), .7) : rgb(STONE[1])), lit(rgb(STONE[0]), shade), lit(rgb(STONE[0]), shade), [(p[0] + q[0]) / 2 - x, size * .7, (p[2] + q[2]) / 2 - z].map(v => v / size));
    }
  }
  return body;
}

export function markerBody(bed, theme = 'day') {
  const { body, quad } = shape(), light = BED_LIGHT[theme] || BED_LIGHT.day, lit = (hex, shade = 1) => rgb(hex).map((v, i) => v * light[i] * shade);
  const [x, z] = bedMarker(bed), y = BED.soil + .06;
  const box = (cx, cy, cz, w, h, d, hex) => {
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    quad([x0, y0, z1], [x1, y0, z1], [x0, y1, z1], [x1, y1, z1], lit(hex), lit(hex, 1.06), [0, .2, 1]);
    quad([x1, y0, z0], [x0, y0, z0], [x1, y1, z0], [x0, y1, z0], lit(hex, .8), lit(hex, .85), [0, .2, -1]);
    quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z1], [x1, y1, z0], lit(hex, .9), lit(hex, .95), [1, .2, 0]);
    quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z0], [x0, y1, z1], lit(hex, .86), lit(hex, .9), [-1, .2, 0]);
    quad([x0, y1, z1], [x1, y1, z1], [x0, y1, z0], [x1, y1, z0], lit(hex, 1.1), lit(hex, 1.1), [0, 1, 0]);
  };
  box(x, y + .15, z, .035, .42, .035, STAKE[1]);
  box(x, y + .3, z + .02, .24, .17, .03, CARD);
  box(x, y + .3, z + .04, .07, .09, .012, MOSS);
  return body;
}
