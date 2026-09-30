// The one cottage around all the rooms: a front that opens like a dollhouse,
// roofs that run on from room to room, and a stair hall up to the loft.
export const STAIR_TOP = -1.03, WALL_TOP = 2.95, FRONT = 2.2, BACK = -2.2, HALF = 2.55, RISE = 1.75, BAY = .7;
const plaster = '#f0e2c6', timber = '#6b4a36', cream = '#f3e6cc';
const shutter = '#7f9c7a', door = '#86573f', ceiling = '#c9a47c', brick = '#ae8b70';
const stones = ['#b8aa92', '#a5977f', '#c8bba1', '#9a8f7e', '#b0a58f'];
const shingles = ['#58707a', '#536b76', '#5c7479', '#50677a', '#5a7372', '#566e75'];
const PLINTH = .5;
const hash = n => { const s = Math.sin(n * 78.233 + 12.9898) * 43758.5453; return s - Math.floor(s); };
const EAVE = .32, END = .25, slope = RISE / FRONT;
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

const windowGlass = theme => theme === 'dusk' ? ['#ffd88f', 2.1] : theme === 'rain' ? ['#e9d6a8', 1.35] : ['#b9cfc8', 1];

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

function halfTimber(u0, u1, holes, put) {
  const posts = new Set([u0 + .07, u1 - .07]);
  for (const [a, b, v0] of holes) if (v0 > 0) { posts.add(a - .06); posts.add(b + .06); }
  for (const u of posts) if (u > u0 && u < u1) put(u - .06, PLINTH, .12, WALL_TOP - PLINTH);
  let u = u0;
  for (const [a, b, v0] of [...holes].sort((p, q) => p[0] - q[0])) {
    if (v0 === 0) { if (a > u) put(u, PLINTH, a - u, .1); u = b; }
  }
  if (u < u1) put(u, PLINTH, u1 - u, .1);
}

function windowAt(api, x, y, z, w, h, theme, facing = 'front', flowers = true) {
  const [glass, glow] = windowGlass(theme);
  const along = (u, v, pw, ph, depth, hex, lift = 0, strength = 1) => facing === 'front'
    ? api.box(x + u, y + v, z + depth / 2 + lift, pw, ph, depth, hex, undefined, strength)
    : api.box(x + depth / 2 + lift, y + v, z + u, depth, ph, pw, hex, undefined, strength);
  along(0, 0, w - .06, h - .06, .04, glass, -.04, glow);
  for (const u of [-w / 2, w / 2]) along(u, 0, .09, h + .06, .09, cream);
  for (const v of [-h / 2, h / 2]) along(0, v, w + .1, .09, .09, cream);
  along(0, 0, .05, h, .06, cream); along(0, 0, w, .05, .06, cream);
  if (!flowers) return;
  for (const u of [-w / 2 - .2, w / 2 + .2]) along(u, 0, .3, h, .05, shutter);
  // A window box with a few blossoms.
  along(0, -h / 2 - .14, w + .12, .17, .22, timber, .04);
  for (let i = 0; i < 5; i++) along(-w / 2 + .1 + i * (w - .2) / 4, -h / 2 - .02, .13, .12, .13, ['#e9b9b3', '#f5e4bd', '#c8b7d7', '#8fa87c'][i % 4], .06);
}

// One roof slope running along the house, from eave to ridge.
function slopeRows(api, x0, x1, side) {
  const rows = 12, run = FRONT + EAVE, length = run * Math.hypot(1, slope) / rows, tilt = [side * (Math.atan(slope) + .05), 0, 0];
  for (let i = 0; i < rows; i++) {
    const t = (i + .5) / rows, z = side * run * (1 - t), y = WALL_TOP + RISE - slope * Math.abs(z) + .1;
    let x = x0 - (i % 2) * .18;
    for (let k = 0; x < x1; k++) {
      const n = i * 97 + k * 13 + side * 7 + Math.round(x0 * 10), w = .3 + hash(n) * .14, a = Math.max(x0, x), b = Math.min(x1, x + w);
      if (b - a > .04) api.box((a + b) / 2, y + hash(n * 3.1) * .025, z, b - a - .025, .09, length * 1.35, shingles[Math.floor(hash(n * 1.3) * shingles.length)], tilt);
      x += w;
    }
  }
  api.box((x0 + x1) / 2, WALL_TOP + RISE - slope * run / 2 - .02, side * run / 2, x1 - x0 - .1, .04, run * Math.hypot(1, slope), ceiling, [side * Math.atan(slope), 0, 0]);
}

// A gable end: the triangle under the roof at the end of the house.
function gableEnd(api, x, facing, theme) {
  api.prism(x, WALL_TOP, 0, FRONT - BACK, RISE, .14, plaster, true);
  if (facing > 0) {
    const [glass, glow] = windowGlass(theme);
    api.disc(x + .08, WALL_TOP + RISE * .4, 0, .62, .06, cream, 1, true); api.disc(x + .1, WALL_TOP + RISE * .4, 0, .48, .04, glass, glow, true);
  }
}

function endWall(api, x, floors) {
  api.box(x - .07, WALL_TOP * floors / 2, 0, .14, WALL_TOP * floors, FRONT - BACK, plaster);
  stoneCourses(BACK, FRONT, PLINTH, 7, (u, v, w, h, hex, out) => api.box(x - .12 - out, v + h / 2, u + w / 2, .1, h, w, hex));
  const face = x - .17, top = WALL_TOP * floors;
  for (const z of [BACK + .07, 0, FRONT - .07]) api.box(face, (PLINTH + top) / 2, z, .06, top - PLINTH, .12, timber);
  for (const y of [PLINTH, ...Array.from({ length: floors }, (_, f) => WALL_TOP * (f + 1) - .07)]) api.box(face, y, 0, .06, .12, FRONT - BACK, timber);
  for (let f = 0; f < floors; f++) {
    const bottom = f ? WALL_TOP * f : PLINTH, rise = WALL_TOP * (f + 1) - .13 - bottom, run = FRONT - .13;
    for (const side of [-1, 1]) api.box(face, bottom + rise / 2, side * run / 2, .05, Math.hypot(rise, run), .1, timber, [side * Math.atan2(run, rise), 0, 0]);
  }
}

// Build one part of one room, in room coordinates.
export function buildExteriorPart(api, part, id, theme, options) {
  const x0 = -HALF - options.bay, x1 = HALF;
  if (part === 'front') {
    const holes = id === 'studio' ? [[-.48, .48, 0, 1.95], [-2.05, -1.05, .95, 2.05], [1.05, 2.05, .95, 2.05]]
      : id === 'garden' ? [[-1.75, .05, .75, 2.15], [.9, 1.9, .95, 2.05]] : [[-1.6, -.6, .9, 2.0], [.6, 1.6, .9, 2.0]];
    // The stair hall gets a narrow window on each floor.
    if (options.bay) holes.push([x0 + .17, x0 + .53, 1.05, 2.05]);
    wallWithHoles(x0, x1, WALL_TOP, holes, (u, v, w, h) => api.box(u + w / 2, v + h / 2, FRONT, w, h, .14, plaster));
    if (id !== 'loft') wallWithHoles(x0, x1, PLINTH, holes.filter(hole => hole[2] < PLINTH), (u, v, w, h) => stoneCourses(u, u + w, h, id.length + u * 7, (su, sv, sw, sh, hex, out) => api.box(su + sw / 2, v + sv + sh / 2, FRONT + .04 + out, sw, sh, .1, hex)));
    halfTimber(x0, x1, holes, (u, v, w, h) => api.box(u + w / 2, v + h / 2, FRONT + .08, w, h, .06, timber));
    // Timber at the outer corners only, so the rooms read as one front.
    for (const [x, outer] of [[x0 + .06, !options.hingeRight], [x1 - .06, options.hingeRight || options.rightEnd]]) if (outer) api.box(x, WALL_TOP / 2, FRONT + .04, .14, WALL_TOP, .16, timber);
    api.box((x0 + x1) / 2, WALL_TOP - .07, FRONT + .04, x1 - x0, .14, .16, timber);
    for (const hole of holes) {
      if (hole[2] === 0) {
        // The front door, with its lamp.
        api.box(0, .97, FRONT - .02, .9, 1.93, .08, door); api.box(0, 1.98, FRONT + .03, 1.08, .1, .14, cream);
        for (const x of [-.5, .5]) api.box(x, .97, FRONT + .03, .1, 1.95, .14, cream);
        for (const y of [.5, 1.45]) api.box(0, y, FRONT + .03, .7, .05, .03, '#7a4f3a');
        api.ball(.3, .95, FRONT + .06, .07, .07, .07, '#e2bc72');
        api.box(.78, 1.72, FRONT + .1, .14, .22, .14, timber); api.ball(.78, 1.6, FRONT + .16, .12, .16, .12, windowGlass(theme)[0], windowGlass(theme)[1] * 1.2);
      } else windowAt(api, (hole[0] + hole[1]) / 2, (hole[2] + hole[3]) / 2, FRONT, hole[1] - hole[0], hole[3] - hole[2], theme, 'front', hole[1] - hole[0] > .5);
    }
  } else if (part === 'side') {
    wallWithHoles(BACK, FRONT, WALL_TOP, [[-.55, .55, .95, 2.05]], (u, v, w, h) => api.box(HALF, v + h / 2, u + w / 2, .14, h, w, plaster));
    if (id !== 'loft') stoneCourses(BACK, FRONT, PLINTH, 3, (u, v, w, h, hex, out) => api.box(HALF + .04 + out, v + h / 2, u + w / 2, .1, h, w, hex));
    halfTimber(BACK, FRONT, [[-.55, .55, .95, 2.05]], (u, v, w, h) => api.box(HALF + .08, v + h / 2, u + w / 2, .06, h, w, timber));
    api.box(HALF + .04, WALL_TOP - .07, 0, .16, .14, FRONT - BACK, timber);
    api.box(HALF + .04, WALL_TOP / 2, BACK + .06, .16, WALL_TOP, .14, timber);
    windowAt(api, HALF, 1.5, 0, 1.1, 1.1, theme, 'side');
  } else if (part === 'back') {
    api.box((x0 + x1) / 2, WALL_TOP / 2, BACK - .07, x1 - x0 + .14, WALL_TOP, .14, plaster);
    stoneCourses(x0 - .07, x1 + .07, PLINTH, 5, (u, v, w, h, hex, out) => api.box(u + w / 2, v + h / 2, BACK - .12 - out, w, h, .1, hex));
    api.box(0, -.03, 0, 2 * HALF, .06, FRONT - BACK, ceiling);
    const landing = options.under ? FRONT : STAIR_TOP;
    if (options.bay) api.box(x0 + options.bay / 2, -.03, (BACK + landing) / 2, options.bay, .06, landing - BACK, ceiling);
  } else if (part === 'lid') {
    // The front roof slope: it tips up from the ridge to show the rooms.
    const l = x0 - (options.leftEnd ? END : 0), r = x1 + (options.rightEnd ? END : 0);
    slopeRows(api, l, r, 1);
    api.box((l + r) / 2, WALL_TOP - EAVE * slope + .02, FRONT + EAVE, r - l, .16, .1, timber);
  } else if (options.under) {
    api.box((x0 + x1) / 2, WALL_TOP + .02, FRONT + .05, x1 - x0 + .1, .12, .2, timber);
    endWall(api, x0, 2);
  } else {
    // The back slope, the ridge, the gable ends and the chimney stay put.
    const l = x0 - (options.leftEnd ? END : 0), r = x1 + (options.rightEnd ? END : 0);
    slopeRows(api, l, r, -1);
    api.box((l + r) / 2, WALL_TOP + RISE + .14, 0, r - l + .04, .14, .26, timber);
    api.box((l + r) / 2, WALL_TOP - EAVE * slope + .02, BACK - EAVE, r - l, .16, .1, timber);
    if (options.leftEnd) gableEnd(api, x0, -1, theme);
    if (id === 'studio') endWall(api, x0, 1);
    if (options.rightEnd) gableEnd(api, x1, 1, theme);
    if (options.chimney) {
      // A brick chimney on the back slope.
      const [x, top, z] = CHIMNEY_TOP;
      api.box(x, top - .8, z, .5, 1.3, .5, brick); api.box(x, top - .11, z, .62, .12, .62, cream);
    }
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
