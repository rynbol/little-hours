// The one cottage around all the rooms: a front that opens like a dollhouse,
// roofs that run on from room to room, and a stair hall up to the loft.
export const STAIR_TOP = -1.03, WALL_TOP = 2.95, FRONT = 2.2, BACK = -2.2, HALF = 2.55, RISE = 1.75, BAY = .7;
export const PALETTE = Object.freeze({
  plaster: Object.freeze(['#f4e6ca', '#f0dfc0', '#f6ead2', '#ecdab9']), timber: '#5c3f2e', cream: '#f3e6cc',
  shutter: '#6b9086', door: '#8b5b3c', ceiling: '#c9a47c', iron: '#3b302b', lamp: '#ffd27e',
  stones: Object.freeze(['#bcae95', '#a99a80', '#cbbd9f', '#9d9180', '#b4a68c']),
  shingles: Object.freeze(['#8f5c47', '#875643', '#96634c', '#80513f', '#8c5f48', '#7f5543']),
  ridge: '#6b4233', moss: Object.freeze(['#76804f', '#6c7a4a', '#808a58']),
  blossoms: Object.freeze(['#f1b2ad', '#f7e0a0', '#c4b0de', '#f4cfd8', '#ffe9c2']), leaves: Object.freeze(['#6f8d5c', '#86a46c']),
});
const { timber, cream, shutter, door, ceiling, iron, stones, shingles, moss, blossoms, leaves } = PALETTE;
const PLINTH = .5;
const hash = n => { const s = Math.sin(n * 78.233 + 12.9898) * 43758.5453; return s - Math.floor(s); };
const pick = (list, n) => list[Math.floor(hash(n) * list.length)];
const plasterAt = n => pick(PALETTE.plaster, n * 3.7);
export const EAVE = .46;
const END = .34, KICK = .17;
const slope = RISE / FRONT, RUN = FRONT + EAVE, BELL = FRONT * .55;
export const roofY = d => WALL_TOP + RISE - slope * d + KICK * Math.max(0, (d - BELL) / (RUN - BELL)) ** 2;
export const OPEN_FRONT_RAIL = .32;
export const HOUSE_POSITIONS = { studio: [-2.55, 0, 0], garden: [2.55, 0, 0], loft: [-2.55, 2.95, 0] };

// What each room adds to the house, and how it joins its neighbours.
export function exteriorPlan(house, id) {
  const built = new Set(house.rooms.map(room => room.id)), loft = built.has('loft'), garden = built.has('garden');
  const options = {
    bay: loft && id !== 'garden' ? BAY : 0, hingeRight: id === 'garden', under: id === 'studio' && loft, floor: id === 'loft' ? WALL_TOP : 0,
    leftEnd: id !== 'garden', rightEnd: id !== 'studio' || !garden, chimney: id === 'garden' || house.rooms.length === 1,
  };
  const parts = ['front', 'roof', 'back'];
  if (!options.under) parts.push('lid');
  if (id !== 'studio' || !garden) parts.push('side');
  return { parts, options };
}

// Where each moving part turns, in room coordinates.
export function hingeOf(part, options) {
  if (part === 'front') return [options.hingeRight ? HALF : -HALF - options.bay, 0, FRONT];
  return [0, WALL_TOP + RISE, 0];
}

// The pose of a moving part at `eased` open (0 closed, 1 open).
export function hingePose(part, options, eased) {
  if (part === 'lid') return { lift: 0, fold: 1 - eased * .98 };
  const rest = options.floor ? -.2 : OPEN_FRONT_RAIL;
  return { lift: -(options.floor + WALL_TOP - rest) * eased, fold: 1 };
}

const windowGlass = theme => theme === 'dusk' ? ['#ffd88f', 2.1] : theme === 'rain' ? ['#f0d6a0', 1.45] : ['#b9cfc8', 1];
const curtainGlow = theme => theme === 'dusk' ? ['#f6c27e', 1.7] : theme === 'rain' ? ['#efc996', 1.2] : ['#efe1c8', 1];

// A wall with rectangular openings, as a few boxes. `holes` are [u0, u1, v0, v1]
// along the wall; `put(u, v, w, h)` places one solid piece.
function wallWithHoles(u0, u1, top, holes, put) {
  let u = u0;
  for (const [a, b, v0, v1] of [...holes].sort((p, q) => p[0] - q[0])) {
    if (a > u) put(u, 0, a - u, top);
    if (v0 > 0) put(a, 0, b - a, v0);
    if (v1 < top) put(a, v1, b - a, top - v1);
    u = b;
  }
  if (u < u1) put(u, 0, u1 - u, top);
}

function stoneCourses(u0, u1, top, seed, put) {
  const rows = Math.max(1, Math.round(top / .17)), h = top / rows;
  for (let row = 0; row < rows; row++) {
    let u = u0 - (row % 2) * .12 * hash(seed + row);
    for (let i = 0; u < u1; i++) {
      const n = seed * 131 + row * 17 + i, w = .24 + hash(n) * .2, a = Math.max(u0, u), b = Math.min(u1, u + w);
      if (b - a > .03) put(a + .01, row * h + .01, b - a - .02, h - .02, stones[Math.floor(hash(n * 1.7) * stones.length)], .01 + hash(n * 2.3) * .03);
      u += w;
    }
  }
}

function timberFrame(u0, u1, holes, bottom, top, put) {
  const posts = [...new Set([u0 + .07, u1 - .07, ...holes.filter(hole => hole[2] > 0).flatMap(([a, b]) => [a - .06, b + .06])])]
    .filter(u => u > u0 && u < u1).sort((a, b) => a - b);
  for (let i = posts.length - 1; i > 0; i--) {
    const a = posts[i - 1], b = posts[i], bays = Math.ceil((b - a) / 1.45);
    if (bays > 1 && !holes.some(([ha, hb]) => ha < b && hb > a)) posts.splice(i, 0, ...Array.from({ length: bays - 1 }, (_, k) => a + (b - a) * (k + 1) / bays));
  }
  for (const u of posts) put(u, (bottom + top) / 2, .12, top - bottom, 0);
  let u = u0;
  for (const [a, b, v0] of [...holes].sort((p, q) => p[0] - q[0])) {
    if (v0 === 0) { if (a > u) put((u + a) / 2, bottom, a - u, .1, 0); u = b; }
  }
  if (u < u1) put((u + u1) / 2, bottom, u1 - u, .1, 0);
  for (let i = 0; i + 1 < posts.length; i++) {
    const a = posts[i] + .06, b = posts[i + 1] - .06;
    if (b - a < .45 || holes.some(([ha, hb]) => ha < b && hb > a)) continue;
    const du = (b - a) * (i % 2 ? -1 : 1), dv = top - bottom - .2;
    put((a + b) / 2, (bottom + top) / 2, .1, Math.hypot(b - a, dv), -Math.atan2(du, dv));
  }
}

function frontFacing(api, x, y, z, facing) {
  const box = (u, v, t, w, h, d, hex, angle = 0, strength = 1) => facing === 'front'
    ? api.box(x + u, y + v, z + t, w, h, d, hex, angle, strength)
    : api.box(x + t, y + v, z + u, d, h, w, hex, [-angle, 0, 0], strength);
  const ball = (u, v, t, w, h, d, hex, strength = 1) => facing === 'front'
    ? api.ball(x + u, y + v, z + t, w, h, d, hex, strength)
    : api.ball(x + t, y + v, z + u, d, h, w, hex, strength);
  return { box, ball };
}

function shutterAt(box, u, h, n) {
  box(u, 0, .05, .3, h, .05, shutter);
  for (const s of [-.075, .075]) box(u + s, 0, .08, .02, h - .04, .01, '#587a71');
  for (const v of [-h / 2 + .14, h / 2 - .14]) box(u, v, .09, .26, .06, .03, '#5b7c73');
  box(u, 0, .095, .05, h - .32, .025, '#5b7c73', (n % 2 ? 1 : -1) * Math.atan2(.18, h - .3));
}

function windowAt(api, x, y, z, w, h, theme, facing = 'front', flowers = true) {
  const [glass, glow] = windowGlass(theme), [curtain, warm] = curtainGlow(theme), { box, ball } = frontFacing(api, x, y, z, facing);
  box(0, 0, -.02, w - .06, h - .06, .04, glass, 0, glow);
  for (const s of [-1, 1]) box(s * (w / 2 - .12), .02, .005, .14, h - .14, .02, curtain, 0, warm);
  box(0, h / 2 - .1, .006, w - .1, .08, .02, curtain, 0, warm);
  for (const u of [-w / 2, w / 2]) box(u, 0, .045, .09, h + .06, .09, cream);
  box(0, -h / 2 - .02, .07, w + .2, .07, .16, cream);
  box(0, h / 2 + .09, .06, w + .34, .13, .1, timber);
  box(0, 0, .03, .05, h, .06, cream); box(0, 0, .03, w, .05, .06, cream);
  if (w > .9) for (const s of [-1, 1]) box(s * w / 4, 0, .025, .03, h, .04, cream);
  if (!flowers) return;
  shutterAt(box, -w / 2 - .2, h, 0); shutterAt(box, w / 2 + .2, h, 1);
  box(0, -h / 2 - .17, .14, w + .12, .17, .22, timber);
  box(0, -h / 2 - .1, .255, w + .14, .03, .02, '#7a5640');
  const count = Math.max(5, Math.round(w * 6));
  for (let i = 0; i < count; i++) {
    const u = -w / 2 + .06 + i * w / (count - 1) * .94, n = x * 13 + y * 7 + i;
    ball(u, -h / 2 - .08 + hash(n) * .04, .15, .16, .12, .16, pick(leaves, n * 1.3));
    ball(u + .02, -h / 2 + hash(n * 2.1) * .06, .17, .1, .09, .1, pick(blossoms, n * 3.3), 1.05);
    if (i % 3 === 1) ball(u, -h / 2 - .31, .24, .08, .2, .06, pick(leaves, n));
  }
}

function frontDoor(api, theme) {
  const [glass, glow] = windowGlass(theme), z = FRONT;
  api.box(0, .97, z - .02, .9, 1.93, .08, door);
  for (const x of [-.22, 0, .22]) api.box(x, .9, z + .025, .02, 1.7, .01, '#6e4630');
  for (const y of [.42, 1.32]) { api.box(-.08, y, z + .035, .66, .06, .02, iron); api.ball(.25, y, z + .04, .07, .07, .03, iron); }
  api.box(0, 1.6, z + .02, .34, .3, .02, glass, 0, glow); api.box(0, 1.6, z + .035, .38, .03, .02, cream); api.box(0, 1.6, z + .035, .03, .34, .02, cream);
  api.ball(.3, .95, z + .06, .07, .07, .07, '#e2bc72');
  api.box(0, 2.0, z + .05, 1.16, .14, .16, timber);
  for (const x of [-.52, .52]) api.box(x, .97, z + .04, .12, 1.95, .14, cream);
  for (const s of [-1, 1]) {
    const reach = .7, drop = .32;
    api.box(s * reach / 2, 2.38 - drop / 2, z + .27, Math.hypot(reach, drop) + .06, .07, .62, shingles[s > 0 ? 0 : 2], -s * Math.atan2(drop, reach));
    api.box(s * .55, 1.83, z + .2, .07, .5, .07, timber, [Math.atan2(.38, .32), 0, 0]);
  }
  api.prism(0, 2.03, z + .5, 1.3, .33, .05, cream);
  api.box(0, 2.42, z + .27, .09, .09, .66, PALETTE.ridge, [0, 0, Math.PI / 4]);
  api.box(.86, 1.86, z + .08, .05, .05, .2, iron); api.box(.86, 1.8, z + .17, .03, .1, .03, iron);
  api.box(.86, 1.75, z + .17, .17, .04, .17, iron); api.ball(.86, 1.62, z + .17, .13, .2, .13, PALETTE.lamp, windowGlass(theme)[1] * 1.25);
  api.box(.86, 1.5, z + .17, .15, .04, .15, iron);
}

function roofSpan(d0, d1) {
  const y0 = roofY(d0), y1 = roofY(d1);
  return { d: (d0 + d1) / 2, y: (y0 + y1) / 2, length: Math.hypot(d1 - d0, y1 - y0), angle: Math.atan2(y0 - y1, d1 - d0) };
}

// One roof slope running along the house, from eave to ridge.
function slopeRows(api, x0, x1, side, ends) {
  const rows = 13, seg = RUN / rows;
  for (let i = 0; i < rows; i++) {
    const { d, y, length, angle } = roofSpan(RUN - (i + 1) * seg, RUN - i * seg), z = side * d, tilt = [side * (angle + .05), 0, 0];
    let x = x0 - (i % 2) * .18;
    for (let k = 0; x < x1; k++) {
      const n = i * 97 + k * 13 + side * 7 + Math.round(x0 * 10), w = .3 + hash(n) * .14, a = Math.max(x0, x), b = Math.min(x1, x + w);
      const mossy = i < 3 && hash(n * 5.7) > .9;
      if (b - a > .04) api.box((a + b) / 2, y + .11 + hash(n * 3.1) * .025, z, b - a - .025, .1, length * 1.35, mossy ? pick(moss, n) : pick(shingles, n * 1.3), tilt);
      x += w;
    }
  }
  for (let k = 0; k < 4; k++) {
    const { d, y, length, angle } = roofSpan(RUN * k / 4, RUN * (k + 1) / 4);
    api.box((x0 + x1) / 2, y - .02, side * d, x1 - x0 - .1, .06, length + .02, ceiling, [side * angle, 0, 0]);
    for (const [x, end] of [[x0 + .04, ends[0]], [x1 - .04, ends[1]]]) if (end) api.box(x, y + .05, side * d, .1, .3, length + .03, timber, [side * angle, 0, 0]);
  }
  const eave = roofSpan(RUN - .12, RUN);
  api.box((x0 + x1) / 2, eave.y + .04, side * (RUN + .02), x1 - x0, .26, .1, timber);
  const tail = roofSpan(FRONT + .16, RUN - .06);
  for (let x = x0 + .3; x < x1 - .2; x += .48) {
    api.box(x, tail.y - .1, side * tail.d, .08, .1, tail.length, timber, [side * tail.angle, 0, 0]);
  }
}

function dormer(api, theme) {
  const face = 1.5, base = roofY(face) + .02, top = base + .62, back = (RISE - (top - WALL_TOP)) / slope, ridge = top + .3;
  for (const s of [-1, 1]) api.box(s * .5, (base + top) / 2, (face + back) / 2, .1, top - base + .1, face - back, PALETTE.plaster[0]);
  api.box(0, (base + top) / 2, face - .08, 1.06, top - base, .08, PALETTE.plaster[1]);
  windowAt(api, 0, base + .32, face, .62, .42, theme, 'front', false);
  api.prism(0, top, face, 1.12, ridge - top, .08, PALETTE.plaster[2]);
  for (const s of [-1, 1]) {
    const reach = .68, drop = ridge - top + .1;
    const angle = -s * Math.atan2(drop, reach), from = back - .1, to = face + .3;
    api.box(s * reach / 2, ridge - drop / 2 + .03, (from + to) / 2, Math.hypot(reach, drop) + .04, .06, to - from, PALETTE.ridge, angle);
    for (let row = 0; row < 3; row++) {
      const t = (row + .5) / 3;
      for (let z = from - (row % 2) * .11; z < to; z += .22) {
        const a = Math.max(from, z), b = Math.min(to, z + .22), n = row * 17 + z * 31 + s * 5;
        if (b - a > .05) api.box(s * reach * t, ridge - drop * t + .1, (a + b) / 2, Math.hypot(reach, drop) / 3 * 1.3, .07, b - a - .02, pick(shingles, n), angle - s * .06);
      }
    }
    api.box(s * reach / 2, ridge - drop / 2, face + .28, Math.hypot(reach, drop), .14, .06, timber, -s * Math.atan2(drop, reach));
  }
  api.box(0, ridge + .06, (face + back) / 2 + .1, .1, .1, face - back + .4, PALETTE.ridge, [0, 0, Math.PI / 4]);
}

// A gable end: the triangle under the roof at the end of the house.
function gableEnd(api, x, facing, theme) {
  api.prism(x, WALL_TOP, 0, FRONT - BACK, RISE, .14, PALETTE.plaster[2], true);
  const face = x + facing * .09;
  api.box(face, WALL_TOP + .06, 0, .06, .12, FRONT - BACK, timber);
  for (const z of [-1.15, 1.15]) {
    const height = roofY(Math.abs(z)) - WALL_TOP - .1;
    api.box(face, WALL_TOP + height / 2, z, .06, height, .12, timber);
  }
  const [glass, glow] = windowGlass(theme), centre = WALL_TOP + RISE * .42;
  api.disc(x + facing * .08, centre, 0, .66, .08, timber, 1, true); api.disc(x + facing * .1, centre, 0, .52, .06, glass, glow, true);
  api.box(x + facing * .13, centre, 0, .03, .5, .04, cream); api.box(x + facing * .13, centre, 0, .03, .04, .5, cream);
  api.box(x + facing * .04, WALL_TOP + RISE + .02, 0, .1, .5, .1, timber);
  api.ball(x + facing * .04, WALL_TOP + RISE - .3, 0, .1, .14, .1, timber);
}

function endWall(api, x, floors) {
  const top = WALL_TOP * floors;
  api.box(x - .07, top / 2, 0, .14, top, FRONT - BACK, plasterAt(floors));
  stoneCourses(BACK, FRONT, PLINTH, 7, (u, v, w, h, hex, out) => api.box(x - .12 - out, v + h / 2, u + w / 2, .1, h, w, hex));
  const face = x - .17;
  for (let f = 0; f < floors; f++) {
    const bottom = f ? WALL_TOP * f : PLINTH;
    timberFrame(BACK, FRONT, [], bottom, WALL_TOP * (f + 1) - .07, (u, v, w, h, angle) => api.box(face, v, u, .06, h, w, timber, [-angle, 0, 0]));
    api.box(face, WALL_TOP * (f + 1) - .07, 0, .06, .12, FRONT - BACK, timber);
  }
}

function chimney(api) {
  const [x, top, z] = CHIMNEY_TOP, foot = roofY(Math.abs(z) + .4) - .1;
  api.box(x, (foot + top) / 2 - .1, z, .5, top - foot - .2, .5, '#9a8d7b');
  for (let y = foot, row = 0; y < top - .28; y += .19, row++) {
    for (const [u, v] of [[0, .26], [0, -.26], [.26, 0], [-.26, 0]]) {
      const n = row * 11 + u * 7 + v * 5, w = .3 + hash(n) * .2;
      api.box(x + u + (u ? 0 : (hash(n * 2) - .5) * .18), y + .09, z + v + (v ? 0 : (hash(n * 3) - .5) * .18), u ? .04 : w, .17, u ? w : .04, pick(stones, n * 1.9));
    }
  }
  api.box(x, top - .2, z, .66, .1, .66, '#d8ccb4');
  for (const dx of [-.12, .12]) { api.box(x + dx, top - .07, z, .15, .2, .15, '#b06a4b'); api.box(x + dx, top + .04, z, .18, .04, .18, '#9c5c41'); }
}

// Build one part of one room, in room coordinates.
export function buildExteriorPart(api, part, id, theme, options) {
  const x0 = -HALF - options.bay, x1 = HALF, ends = [options.leftEnd, options.rightEnd];
  if (part === 'front') {
    const holes = id === 'studio' ? [[-.48, .48, 0, 1.95], [-2.05, -1.05, .95, 2.05], [1.05, 2.05, .95, 2.05]]
      : id === 'garden' ? [[-1.75, .05, .75, 2.15], [.9, 1.9, .95, 2.05]] : [[-1.6, -.6, .9, 2.0], [.6, 1.6, .9, 2.0]];
    // The stair hall gets a narrow window on each floor.
    if (options.bay) holes.push([x0 + .17, x0 + .53, 1.05, 2.05]);
    wallWithHoles(x0, x1, WALL_TOP, holes, (u, v, w, h) => api.box(u + w / 2, v + h / 2, FRONT, w, h, .14, plasterAt(u + v)));
    if (id !== 'loft') wallWithHoles(x0, x1, PLINTH, holes.filter(hole => hole[2] < PLINTH), (u, v, w, h) => stoneCourses(u, u + w, h, id.length + u * 7, (su, sv, sw, sh, hex, out) => api.box(su + sw / 2, v + sv + sh / 2, FRONT + .04 + out, sw, sh, .1, hex)));
    timberFrame(x0, x1, holes, id === 'loft' ? .07 : PLINTH, WALL_TOP - .07, (u, v, w, h, angle) => api.box(u, v, FRONT + .08, w, h, .06, timber, angle));
    // Timber at the outer corners only, so the rooms read as one front.
    for (const [x, outer] of [[x0 + .06, !options.hingeRight], [x1 - .06, options.hingeRight || options.rightEnd]]) if (outer) api.box(x, WALL_TOP / 2, FRONT + .04, .14, WALL_TOP, .16, timber);
    api.box((x0 + x1) / 2, WALL_TOP - .07, FRONT + .04, x1 - x0, .14, .16, timber);
    for (const hole of holes) {
      if (hole[2] === 0) frontDoor(api, theme);
      else windowAt(api, (hole[0] + hole[1]) / 2, (hole[2] + hole[3]) / 2, FRONT, hole[1] - hole[0], hole[3] - hole[2], theme, 'front', hole[1] - hole[0] > .5);
    }
  } else if (part === 'side') {
    const holes = [[-.55, .55, .95, 2.05]];
    wallWithHoles(BACK, FRONT, WALL_TOP, holes, (u, v, w, h) => api.box(HALF, v + h / 2, u + w / 2, .14, h, w, plasterAt(u - v)));
    if (id !== 'loft') stoneCourses(BACK, FRONT, PLINTH, 3, (u, v, w, h, hex, out) => api.box(HALF + .04 + out, v + h / 2, u + w / 2, .1, h, w, hex));
    timberFrame(BACK, FRONT, holes, id === 'loft' ? .07 : PLINTH, WALL_TOP - .07, (u, v, w, h, angle) => api.box(HALF + .08, v, u, .06, h, w, timber, [-angle, 0, 0]));
    api.box(HALF + .04, WALL_TOP - .07, 0, .16, .14, FRONT - BACK, timber);
    api.box(HALF + .04, WALL_TOP / 2, BACK + .06, .16, WALL_TOP, .14, timber);
    windowAt(api, HALF, 1.5, 0, 1.1, 1.1, theme, 'side');
  } else if (part === 'back') {
    api.box((x0 + x1) / 2, WALL_TOP / 2, BACK - .07, x1 - x0 + .14, WALL_TOP, .14, PALETTE.plaster[1]);
    stoneCourses(x0 - .07, x1 + .07, PLINTH, 5, (u, v, w, h, hex, out) => api.box(u + w / 2, v + h / 2, BACK - .12 - out, w, h, .1, hex));
    timberFrame(x0, x1, [], id === 'loft' ? .07 : PLINTH, WALL_TOP - .07, (u, v, w, h, angle) => api.box(u, v, BACK - .17, w, h, .06, timber, -angle));
    api.box(0, -.03, 0, 2 * HALF, .06, FRONT - BACK, ceiling);
    const landing = options.under ? FRONT : STAIR_TOP;
    if (options.bay) api.box(x0 + options.bay / 2, -.03, (BACK + landing) / 2, options.bay, .06, landing - BACK, ceiling);
  } else if (part === 'lid') {
    // The front roof slope: it tips up from the ridge to show the rooms.
    const l = x0 - (options.leftEnd ? END : 0), r = x1 + (options.rightEnd ? END : 0);
    slopeRows(api, l, r, 1, ends);
    dormer(api, theme);
  } else if (options.under) {
    api.box((x0 + x1) / 2, WALL_TOP + .02, FRONT + .05, x1 - x0 + .1, .12, .2, timber);
    endWall(api, x0, 2);
  } else {
    // The back slope, the ridge, the gable ends and the chimney stay put.
    const l = x0 - (options.leftEnd ? END : 0), r = x1 + (options.rightEnd ? END : 0);
    slopeRows(api, l, r, -1, ends);
    api.box((l + r) / 2, WALL_TOP + RISE + .16, 0, r - l + .06, .2, .2, PALETTE.ridge, [Math.PI / 4, 0, 0]);
    if (options.leftEnd) gableEnd(api, x0, -1, theme);
    if (id === 'studio') endWall(api, x0, 1);
    if (options.rightEnd) gableEnd(api, x1, 1, theme);
    if (options.chimney) chimney(api);
  }
}

export function buildClosedHouse(api, house, theme) {
  for (const { id } of house.rooms) {
    const [ox, oy, oz] = HOUSE_POSITIONS[id], { parts, options } = exteriorPlan(house, id);
    const placed = Object.fromEntries(['box', 'ball', 'prism', 'disc'].map(name => [name, (x, y, z, ...rest) => api[name](x + ox, y + oy, z + oz, ...rest)]));
    for (const part of parts) buildExteriorPart(placed, part, id, theme, options);
  }
}

// Where the chimney smoke starts, in room coordinates.
export const CHIMNEY_TOP = [1.3, WALL_TOP + RISE - slope * .9 + 1.25, -.9];

// A dotted outline of the next room: its walls and its roof, in dashes.
export function buildBlueprint(api) {
  const hex = '#fbf1da', dash = .22, gap = .16, t = .045;
  const line = (a, b) => {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), steps = Math.floor(length / (dash + gap));
    for (let i = 0; i <= steps; i++) {
      const s = Math.min(1, (i * (dash + gap) + dash / 2) / length), l = Math.min(dash, length - i * (dash + gap)); if (l <= 0) break;
      const p = a.map((v, k) => v + (b[k] - v) * s), d = b.map((v, k) => v - a[k]);
      const horizontal = Math.hypot(d[0], d[2]);
      api.box(p[0], p[1], p[2], t, l, t, hex, [0, -Math.atan2(d[2], d[0]), -Math.atan2(horizontal, d[1])], 1.3);
    }
  };
  const x = HALF - .02, zf = FRONT, zb = BACK, top = WALL_TOP, ridge = WALL_TOP + RISE;
  const corners = [[-x, zf], [x, zf], [x, zb], [-x, zb]];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
    line([ax, .05, az], [bx, .05, bz]); line([ax, top, az], [bx, top, bz]); line([ax, 0, az], [ax, top, az]);
  }
  for (const end of [-x, x]) { line([end, top, zf], [end, ridge, 0]); line([end, ridge, 0], [end, top, zb]); }
  line([-x, ridge, 0], [x, ridge, 0]);
}
