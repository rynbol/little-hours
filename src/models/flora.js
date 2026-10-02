const TAU = Math.PI * 2, UP = [0, 1, 0];
const hash = n => { const s = Math.sin(n * 113.7 + 5.3) * 43758.5453; return s - Math.floor(s); };
const rgb = hex => [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16) / 255);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const times = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const frame = axis => { const u = unit(cross(axis, Math.abs(axis[1]) > .9 ? [1, 0, 0] : UP)); return [u, cross(axis, u)]; };
const around = (a, reach = 1, y = 0) => [Math.cos(a) * reach, y, Math.sin(a) * reach];

export const FLORA_STAGES = Object.freeze(['seed', 'sprout', 'leafy', 'budding', 'bloom']);
export const floraStage = growth => Math.min(4, Math.floor(Math.max(0, growth) * 4));
export const FLORA_LIGHT = Object.freeze({ day: [1, 1, 1], dusk: [.8, .76, .88], rain: [.86, .9, .94] });
export const FLORA_GLOW = Object.freeze({ day: 1, dusk: 1.22, rain: 1 });
export const FLORA = Object.freeze({
  cosmos: { leaf: ['#4a8439', '#86b651'], petal: ['#ea9bb3', '#f8cbd6', '#d3708f'], heart: ['#e2a52e', '#f7d75c'], seed: '#6b5138', tall: 1.1, give: .3 },
  lavender: { leaf: ['#567f66', '#93b291'], petal: ['#bfa9ea', '#dccff8', '#a48ad6'], heart: ['#7a66cc', '#cdbcf4'], seed: '#4a3d33', tall: 1.15, give: .2 },
  sunflower: { leaf: ['#3a772f', '#73a83f'], petal: ['#f6c636', '#ffe272', '#e89a1f'], heart: ['#7a4a26', '#3f2717'], seed: '#3b342f', tall: 1.9, give: .12 },
  moonflower: { leaf: ['#3a7a55', '#70ad7c'], petal: ['#f4f1ff', '#ffffff', '#c3b4ea'], heart: ['#dfe9b4', '#f6f2c4'], seed: '#8a765c', tall: 1.7, give: .1 },
});
const SOIL = ['#4a3629', '#6b503d'], CANE = ['#a98a56', '#d6bb80'], TWINE = '#8d7350';
const LEAF = [[0, 0], [.3, 1], [.65, .75], [1, 0]], HEART = [[0, 0], [.14, .92], [.48, 1], [.8, .5], [1, 0]], NEEDLE = [[0, 1], [1, 0]];
const PETAL = [[0, 0], [.42, .8], [.78, 1], [1, .3]], RAY = [[0, .35], [.4, 1], [1, 0]], NOTCHED = [[0, 0], [.5, .78], [.86, 1], [1, .62]];

function pen({ x, z, floor, scale, tall, give, light, seed }) {
  const body = { positions: [], colors: [], normals: [], indices: [], sway: [] }, state = { phase: hash(seed) * TAU, give };
  const read = (list, i) => [list[i * 3], list[i * 3 + 1], list[i * 3 + 2]];
  const put = (p, n, color, glow = 1) => {
    const tint = glow > 1 ? [glow, glow, glow] : light;
    body.positions.push(x + p[0] * scale, floor + p[1] * scale, z + p[2] * scale);
    body.normals.push(n[0], n[1], n[2]);
    body.colors.push(color[0] * tint[0], color[1] * tint[1], color[2] * tint[2], 1);
    body.sway.push(state.phase, Math.min(1, Math.max(0, p[1] / tall)), state.give * scale);
    return body.positions.length / 3 - 1;
  };
  const face = (a, b, c) => {
    const turn = cross(sub(read(body.positions, b), read(body.positions, a)), sub(read(body.positions, c), read(body.positions, a)));
    const out = add(add(read(body.normals, a), read(body.normals, b)), read(body.normals, c));
    if (dot(turn, out) > 0) body.indices.push(a, c, b); else body.indices.push(a, b, c);
  };
  const band = (low, high) => { for (let k = 0; k < low.length; k++) { const next = (k + 1) % low.length; face(low[k], low[next], high[k]); face(low[next], high[next], high[k]); } };
  const tube = (points, radius, color, sides = 5, glow = 1) => {
    const last = points.length - 1;
    const rings = points.map((p, i) => {
      const t = last ? i / last : 0, dir = unit(sub(points[Math.min(last, i + 1)], points[Math.max(0, i - 1)])), [side, lift] = frame(dir);
      return Array.from({ length: sides }, (_, k) => { const a = k / sides * TAU, n = add(times(side, Math.cos(a)), times(lift, Math.sin(a))); return put(add(p, times(n, radius(t, i))), n, color(t, i), glow); });
    });
    for (let i = 0; i < last; i++) band(rings[i], rings[i + 1]);
  };
  const sheet = (base, dir, length, width, from, to, { lift = UP, rise = .3, droop = .35, outline = LEAF, glow = 1 } = {}) => {
    const side = unit(cross(dir, lift)), spine = t => add(base, add(times(dir, length * t), times(lift, length * (rise * t - droop * t * t))));
    const normal = unit(add(unit(cross(side, sub(spine(.6), base))), times(lift, .6)));
    for (const flip of [1, -1]) {
      const n = times(normal, flip), rows = outline.map(([t, w]) => (w ? [1, -1] : [0]).map(edge => put(add(spine(t), times(side, edge * width * w / 2)), n, mix(from, to, t), glow)));
      for (let i = 0; i < rows.length - 1; i++) {
        const low = rows[i], high = rows[i + 1];
        if (low.length === 2 && high.length === 2) { face(low[0], low[1], high[0]); face(low[1], high[1], high[0]); }
        else if (low.length === 2) face(low[0], low[1], high[0]);
        else face(low[0], high[0], high[1]);
      }
    }
  };
  const dome = (center, axis, radius, height, from, to, sides = 8, glow = 1) => {
    const [u, v] = frame(axis);
    const ring = (reach, along, color) => Array.from({ length: sides }, (_, k) => { const out = add(times(u, Math.cos(k / sides * TAU)), times(v, Math.sin(k / sides * TAU))); return put(add(center, add(times(out, radius * reach), times(axis, height * along))), unit(add(times(out, reach), times(axis, .35 + along))), color, glow); });
    const low = ring(1, 0, from), mid = ring(.66, .72, mix(from, to, .6)), top = put(add(center, times(axis, height)), axis, to, glow);
    band(low, mid);
    for (let k = 0; k < sides; k++) face(mid[k], mid[(k + 1) % sides], top);
  };
  const blob = (center, radius, height, from, to = from, { axis = UP, sides = 6, glow = 1 } = {}) => {
    dome(center, axis, radius, height, mix(from, to, .5), to, sides, glow);
    dome(center, times(axis, -1), radius, height, mix(from, to, .5), from, sides, glow);
  };
  const flower = (center, axis, { count, length, width, from, to, heart, size, cup = .2, layers = 1, outline = PETAL, spin = 0, glow = 1 }) => {
    const [u, v] = frame(axis);
    for (let layer = 0; layer < layers; layer++) for (let k = 0; k < count; k++) {
      const a = (k + layer * .5) / count * TAU + spin, flat = add(times(u, Math.cos(a)), times(v, Math.sin(a)));
      sheet(add(center, times(flat, size * .5)), flat, length * (1 - layer * .16), width, from, to[(k + layer) % to.length], { lift: axis, rise: cup + layer * .3, droop: .22, outline, glow });
    }
    dome(center, axis, size, size * .5, heart[0], heart[1], 8, glow);
  };
  const trumpet = (base, axis, size, look, glow) => {
    const [u, v] = frame(axis), sides = 10, profile = [[0, .1], [.45, .16], [.8, .5], [.95, 1], [.9, 1.16]];
    for (const inside of [true, false]) {
      const rings = profile.map(([along, reach], j) => Array.from({ length: sides }, (_, k) => {
        const a = k / sides * TAU, out = add(times(u, Math.cos(a)), times(v, Math.sin(a))), lobe = j > 2 ? 1 + .12 * Math.cos(5 * a) : 1;
        const color = j < 2 ? rgb(look.heart[0]) : mix(rgb(look.petal[k % 2 ? 0 : 2]), rgb(look.petal[1]), k % 2 ? .5 : j === 2 ? .1 : .45);
        return put(add(base, add(times(axis, along * size), times(out, reach * size * lobe))), unit(inside ? sub(times(axis, .8), times(out, .45)) : sub(times(out, .8), times(axis, .3))), color, glow);
      }));
      for (let j = 0; j < rings.length - 1; j++) band(rings[j], rings[j + 1]);
    }
  };
  return { body, put, face, tube, sheet, dome, blob, flower, trumpet, stem(index) { state.phase = hash(seed * 3.1 + index * 7.7) * TAU; }, still(build) { const keep = state.give; state.give = 0; build(); state.give = keep; } };
}

function seedMound(draw, look, t, seed) {
  const pale = mix(rgb(look.leaf[1]), [1, 1, .8], .35);
  for (let i = 0; i < 5; i++) {
    const a = i * 1.26 + seed, [mx, , mz] = around(a, i ? .3 : 0), size = .085 + hash(seed + i * 2.7) * .03;
    draw.still(() => {
      draw.blob([mx, .02, mz], size, size * .42, rgb(SOIL[1]), mix(rgb(SOIL[1]), [.86, .7, .52], .25), { sides: 8 });
      draw.blob([mx + .02, size * .42, mz + .02], .042, .028, rgb(look.seed), mix(rgb(look.seed), [1, 1, 1], .35));
    });
    if (t > .15) { draw.stem(i); draw.tube([[mx, size * .4, mz], [mx - .01, size * .4 + .16 * t, mz], [mx + .04, size * .4 + .2 * t, mz]], () => .016, () => pale, 3); }
  }
}

function sprouts(draw, look, t, seed, { count, height, length, width, outline, spread }) {
  const [dark, light] = look.leaf.map(rgb);
  for (let i = 0; i < count; i++) {
    draw.stem(i);
    const a = i * 2.4 + seed, reach = count === 1 ? 0 : spread * (.5 + hash(seed + i * 3.3) * .5), [bx, , bz] = around(a, reach), tall = height * (.7 + t * .5) * (.8 + hash(seed + i) * .4);
    const top = [bx + Math.cos(a) * .02, tall, bz + Math.sin(a) * .02], turn = hash(seed * 2 + i) * TAU;
    draw.tube([[bx, 0, bz], top], () => .012, s => mix(dark, light, s), 3);
    for (const side of [0, Math.PI]) draw.sheet(top, around(turn + side), length * (.7 + t * .4), width * (.7 + t * .4), dark, light, { rise: .55, droop: .3, outline });
  }
}

function sunflower(draw, look, stage, t, seed) {
  if (stage === 1) return sprouts(draw, look, t, seed, { count: 6, height: .32, length: .27, width: .21, outline: HEART, spread: .42 });
  const [dark, light] = look.leaf.map(rgb), [gold, pale, amber] = look.petal.map(rgb), grown = stage - 2 + t;
  [[0, -.2, 1.12], [-.44, .1, .9], [.46, .04, .8], [-.14, .4, .64], [.2, -.52, .72]].forEach(([sx, sz, size], i) => {
    draw.stem(i);
    const tall = (.55 + .5 * grown) * size, lean = (hash(seed + i * 4.1) - .5) * .16, nod = stage === 4 ? .1 : 0;
    const at = s => [sx + lean * s * s * tall, tall * s, sz + (.05 + nod) * s * s * s * tall];
    draw.tube([0, .25, .5, .75, 1].map(at), s => (.042 - .016 * s) * size, s => mix(dark, light, .25 + s * .5), 5);
    const leaves = 3 + Math.floor(grown * 1.5);
    for (let k = 0; k < leaves; k++) {
      const s = .18 + .62 * k / leaves, reach = (.36 - .13 * k / leaves) * size * (.75 + Math.min(1, grown) * .25);
      draw.sheet(at(s), around(i * 1.1 + k * 2.4 + seed), reach, reach * .78, dark, mix(light, dark, hash(seed + i + k * 1.9) * .4), { rise: .4, droop: .6, outline: HEART });
    }
    const facing = unit([.22 + (i % 3 - 1) * .24, stage === 4 ? .42 : 1, stage === 4 ? .88 : .25]), top = at(1);
    if (stage === 3) {
      const swell = .06 + t * .035;
      draw.blob(top, swell * size, swell * 1.1 * size, dark, light, { axis: facing });
      for (let k = 0; k < 7; k++) draw.sheet(top, around(k / 7 * TAU), .11 * size, .05 * size, dark, light, { rise: 1.1 + t * .3, droop: .5, outline: RAY });
      if (t > .4) draw.dome(add(top, times(facing, swell * size)), facing, swell * .55 * size, .03 * size, amber, gold, 6);
    }
    if (stage === 4) {
      const head = add(top, times(facing, .03 * size));
      draw.dome(sub(head, times(facing, .005)), times(facing, -1), .2 * size, .08 * size, light, dark, 8);
      for (let k = 0; k < 9; k++) draw.sheet(head, around(k / 9 * TAU), .2 * size, .07 * size, dark, light, { lift: times(facing, -1), rise: .1, droop: .1, outline: RAY });
      draw.flower(head, facing, { count: 15, layers: 2, length: .25 * size, width: .095 * size, from: amber, to: [gold, pale], heart: look.heart.map(rgb), size: .17 * size, cup: .1, outline: PETAL, spin: seed + i });
      draw.dome(add(head, times(facing, .03 * size)), facing, .1 * size, .06 * size, mix(rgb(look.heart[1]), amber, .25), rgb(look.heart[1]), 8);
    }
  });
}

function lavender(draw, look, stage, t, seed) {
  const [dark, light] = look.leaf.map(rgb), [violet, lilac, deep] = look.petal.map(rgb), grown = stage - 2 + t;
  if (stage === 1) {
    for (let i = 0; i < 36; i++) { draw.stem(i); const a = i * 2.4 + seed; draw.sheet(around(a, .04 + (i % 3) * .06), unit(around(a, .5, 1)), .28 + t * .1 + hash(seed + i) * .1, .055, dark, light, { rise: .2, droop: .1, outline: NEEDLE }); }
    return;
  }
  const reach = .44 + .22 * Math.min(1, grown), needles = 110 + Math.round(50 * Math.min(1, grown));
  draw.blob([0, reach * .32, 0], reach * .82, reach * .5, dark, mix(dark, light, .45), { sides: 8 });
  for (let i = 0; i < needles; i++) {
    draw.stem(i % 9);
    const a = i * 2.39996 + seed, rise = .12 + .88 * hash(seed + i * 1.7), out = Math.sqrt(1 - rise * rise * .8);
    draw.sheet([Math.cos(a) * reach * out * .7, reach * rise * .45, Math.sin(a) * reach * out * .7], unit(around(a, out, .35 + rise * .9)), .24 + hash(seed + i * 2.9) * .14, .05, dark, mix(light, dark, hash(i * 5.3) * .5), { rise: .1, droop: .12, outline: NEEDLE });
  }
  if (stage < 3) return;
  const stalks = stage === 4 ? 46 : 26;
  for (let i = 0; i < stalks; i++) {
    draw.stem(i);
    const a = i * 2.39996 + seed * 2, spread = Math.sqrt((i + .5) / stalks), tall = stage === 4 ? .78 + .32 * hash(seed + i * 3.7) - spread * .14 : .52 + t * .16 + .1 * hash(seed + i * 3.7);
    const foot = [Math.cos(a) * reach * spread * .6, reach * .5 * (1 - spread * .5), Math.sin(a) * reach * spread * .6], dir = unit(around(a, spread * .55, 1));
    const tip = add(foot, times(dir, tall - foot[1])), length = stage === 4 ? .26 + .09 * hash(i * 9.1) : .08 + t * .06;
    draw.tube([foot, tip], () => .008, () => mix(dark, light, .6), 3);
    const beads = stage === 4 ? [.35, 1, .8, 1.05, .75, .9, .5, .15] : [.5, 1, .6, .15], girth = stage === 4 ? .052 : .028;
    draw.tube(beads.map((_, k) => add(tip, times(dir, length * k / (beads.length - 1)))), (_, k) => girth * beads[k], (_, k) => stage === 4 ? [violet, lilac, deep][(k + i) % 3] : mix(light, lilac, t * .7 + k * .08), 4);
  }
}

function cosmos(draw, look, stage, t, seed) {
  if (stage === 1) return sprouts(draw, look, t, seed, { count: 13, height: .27, length: .19, width: .045, outline: NEEDLE, spread: .46 });
  const [dark, light] = look.leaf.map(rgb), shades = look.petal.map(rgb), grown = stage - 2 + t, stems = stage === 4 ? 17 : 14 + Math.floor(Math.min(1, grown) * 3);
  for (let i = 0; i < stems; i++) {
    draw.stem(i);
    const a = i * 2.39996 + seed, reach = .1 + .58 * Math.sqrt((i + .5) / stems), tall = (.42 + .33 * grown) * (.68 + .5 * hash(seed + i * 2.3));
    const [fx, , fz] = around(a, reach), [lx, , lz] = around(a + (hash(seed + i * 6.1) - .5), .1 + .12 * hash(i * 4.7));
    const at = s => [fx + lx * s * tall + Math.sin(s * 5 + i) * .012, tall * s, fz + lz * s * tall];
    draw.tube([0, .34, .67, 1].map(at), s => .013 - .006 * s, s => mix(dark, light, .3 + s * .5), 3);
    for (let k = 0; k < 3; k++) for (let f = -1; f <= 1; f++) {
      const turn = a + k * 2.1 + i + f * .55;
      draw.sheet(at(.2 + k * .22), unit(around(turn, 1, .45)), .21 - k * .03, .032, dark, light, { rise: .15, droop: .3, outline: NEEDLE });
    }
    const top = at(1), facing = unit([lx * 2.2 + .14, 1, lz * 2.2 + .32]);
    if (stage === 3 || (stage === 4 && i % 4 === 3)) draw.blob(top, .05 + t * .012, .062, mix(light, shades[0], stage === 4 ? .7 : t * .8), shades[i % 3], { axis: facing, sides: 5 });
    else if (stage === 4) {
      const tone = shades[i % 3], size = .18 + .04 * hash(seed + i * 8.3);
      draw.flower(top, facing, { count: 8, length: size, width: size * .62, from: mix(tone, shades[2], .55), to: [tone, mix(tone, [1, 1, 1], .18)], heart: look.heart.map(rgb), size: .05, cup: .16, outline: NOTCHED, spin: i });
    }
  }
}

function moonflower(draw, look, stage, t, seed, theme) {
  const [dark, light] = look.leaf.map(rgb), [, white] = look.petal.map(rgb), cane = CANE.map(rgb), grown = stage - 2 + t, apex = 1.6, foot = .52;
  const coneAt = y => foot * (1 - y / apex) + .035;
  draw.still(() => {
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + .5, [x, , z] = around(a, foot); draw.tube([[x, 0, z], [-x * .14, apex + .12, -z * .14]], () => .017, s => mix(cane[0], cane[1], s), 4); }
    for (const y of [.5, 1.05]) draw.tube(Array.from({ length: 4 }, (_, i) => around(i / 3 * TAU + .5, coneAt(y) - .02, y)), () => .009, () => rgb(TWINE), 3);
  });
  if (stage === 1) return sprouts(draw, look, t, seed, { count: 4, height: .3, length: .25, width: .21, outline: HEART, spread: .24 });
  const glow = FLORA_GLOW[theme] || 1, reach = Math.min(apex - .04, .62 + .48 * grown);
  [[0, 1], [Math.PI, .82]].forEach(([turn, share], vine) => {
    draw.stem(vine);
    const top = reach * share, steps = Math.max(4, Math.round(top / .055)), at = s => { const y = top * s, a = turn + seed + y * 6.4; return around(a, coneAt(y) + .012, y); };
    draw.tube(Array.from({ length: steps + 1 }, (_, i) => at(i / steps)), s => .016 - .007 * s, s => mix(dark, light, .2 + s * .5), 3);
    for (let i = 1; i < steps; i += 2) {
      const s = i / steps, p = at(s), out = unit([p[0], 0, p[2]]), size = .26 - s * .07;
      draw.sheet(p, unit(add(out, around(i * 1.3, .5))), size, size * .95, dark, mix(light, dark, hash(seed + i * 3.1 + vine) * .45), { rise: .25, droop: .6, outline: HEART });
    }
    const blooms = stage === 4 ? 5 - vine : stage === 3 ? 3 - vine : 0;
    for (let i = 0; i < blooms; i++) {
      const s = .3 + .66 * (i + .5 * vine + .3) / blooms, p = at(Math.min(1, s)), out = unit([p[0], 0, p[2]]), axis = unit(add(add(out, [.1, .55, .38]), around(i * 2.1, .15)));
      if (stage === 4 && (i + vine) % 4 !== 3) draw.trumpet(add(p, times(out, .02)), axis, .19 * (glow > 1 ? 1 : .9), look, glow);
      else draw.tube([0, .5, 1].map(k => add(p, times(axis, k * (.13 + t * .05)))), (_, k) => [.012, .034, .006][k], (_, k) => mix(rgb(look.heart[0]), white, k / 2), 5);
    }
  });
}

const SPECIES = { cosmos, lavender, sunflower, moonflower };

export function plantBody(species, growth, { x = 0, z = 0, floor = 0, scale = 1, theme = 'day', seed = 0 } = {}) {
  const id = Object.hasOwn(FLORA, species) ? species : 'cosmos', look = FLORA[id], stage = floraStage(growth), t = stage === 4 ? 0 : Math.max(0, growth) * 4 - stage;
  const draw = pen({ x, z, floor, scale, tall: look.tall, give: look.give, light: FLORA_LIGHT[theme] || FLORA_LIGHT.day, seed });
  if (stage === 0) seedMound(draw, look, t, seed); else SPECIES[id](draw, look, stage, t, seed, theme);
  let crown = floor;
  for (let i = 1; i < draw.body.positions.length; i += 3) crown = Math.max(crown, draw.body.positions[i]);
  return { ...draw.body, crown: [x, crown, z] };
}
