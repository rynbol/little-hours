// The one cottage around all the rooms: a front that opens like a dollhouse,
// roofs that run on from room to room, and a stair hall up to the loft.
// Each part is built in room coordinates. Moving parts hang on hinges, so the
// house opens by turning hinges, never by rebuilding geometry.
export const WALL_TOP = 2.95, FRONT = 2.2, BACK = -2.2, HALF = 2.55, RISE = 1.75, BAY = .7;
const plaster = '#f8ecd6', stone = '#cdbb9f', timber = '#76553f', cream = '#f6ecd6';
const shutter = '#8fa487', door = '#8b5d44', slate = ['#5a746c', '#526a62'], ceiling = '#c9a47c', brick = '#ae8b70';
const EAVE = .32, END = .25, slope = RISE / FRONT;
// How far each moving part turns when the house is fully open (radians).
export const OPEN_TURN = { front: 1.95, side: 1.6, lid: -2.25 };
// The front roof also rises this far as it tips up.
export const LID_LIFT = .35;

// What each room adds to the house, and how it joins its neighbours.
// The studio and loft fronts open to the left, the garden wing's to the right.
export function exteriorPlan(house, id) {
  const built = new Set(house.rooms.map(room => room.id)), loft = built.has('loft'), garden = built.has('garden');
  const options = {
    bay: loft && id !== 'garden' ? BAY : 0, hingeRight: id === 'garden', under: id === 'studio' && loft,
    leftEnd: id !== 'garden', rightEnd: id !== 'studio' || !garden, chimney: id === 'garden' || house.rooms.length === 1,
  };
  const parts = ['front', 'roof'];
  if (!options.under) parts.push('lid');
  if (id !== 'studio' || !garden) parts.push('side');
  return { parts, options };
}

// Where each moving part turns, in room coordinates.
export function hingeOf(part, options) {
  if (part === 'front') return [options.hingeRight ? HALF : -HALF - options.bay, 0, FRONT];
  if (part === 'side') return [HALF, 0, BACK];
  return [0, WALL_TOP + RISE, 0];
}

// The pose of a moving part at `eased` open (0 closed, 1 open).
export function hingePose(part, options, eased) {
  if (part === 'lid') return { rotation: [OPEN_TURN.lid * eased, 0, 0], lift: LID_LIFT * eased };
  const turn = part === 'front' ? (options.hingeRight ? OPEN_TURN.front : -OPEN_TURN.front) : OPEN_TURN.side;
  return { rotation: [0, turn * eased, 0], lift: 0 };
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
  const rows = 8, run = FRONT + EAVE, length = run * Math.hypot(1, slope) / rows;
  for (let i = 0; i < rows; i++) {
    const t = (i + .5) / rows, z = side * run * (1 - t), y = WALL_TOP + RISE - slope * Math.abs(z) + .1;
    api.box((x0 + x1) / 2, y, z, x1 - x0, .12, length + .06, slate[i % 2], [side * Math.atan(slope), 0, 0]);
  }
  // Warm boards under the slates, seen when the front roof tips up.
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

// Build one part of one room, in room coordinates.
export function buildExteriorPart(api, part, id, theme, options) {
  const x0 = -HALF - options.bay, x1 = HALF;
  if (part === 'front') {
    const holes = id === 'studio' ? [[-.48, .48, 0, 1.95], [-2.05, -1.05, .95, 2.05], [1.05, 2.05, .95, 2.05]]
      : id === 'garden' ? [[-1.75, .05, .75, 2.15], [.9, 1.9, .95, 2.05]] : [[-1.6, -.6, .9, 2.0], [.6, 1.6, .9, 2.0]];
    // The stair hall gets a narrow window on each floor.
    if (options.bay) holes.push([x0 + .17, x0 + .53, 1.05, 2.05]);
    wallWithHoles(x0, x1, WALL_TOP, holes, (u, v, w, h) => api.box(u + w / 2, v + h / 2, FRONT, w, h, .14, plaster));
    if (id !== 'loft') wallWithHoles(x0, x1, .34, holes.filter(hole => hole[2] < .34), (u, v, w, h) => api.box(u + w / 2, v + h / 2, FRONT + .03, w, h, .12, stone));
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
    if (id !== 'loft') api.box(HALF + .03, .17, 0, .12, .34, FRONT - BACK, stone);
    api.box(HALF + .04, WALL_TOP - .07, 0, .16, .14, FRONT - BACK, timber);
    api.box(HALF + .04, WALL_TOP / 2, BACK + .06, .16, WALL_TOP, .14, timber);
    windowAt(api, HALF, 1.5, 0, 1.1, 1.1, theme, 'side');
  } else if (part === 'lid') {
    // The front roof slope: it tips up from the ridge to show the rooms.
    const l = x0 - (options.leftEnd ? END : 0), r = x1 + (options.rightEnd ? END : 0);
    slopeRows(api, l, r, 1);
    api.box((l + r) / 2, WALL_TOP - EAVE * slope + .02, FRONT + EAVE, r - l, .16, .1, timber);
  } else if (options.under) {
    // The loft sits on the studio: a short pent roof covers the ledge, and the
    // stair hall's outer wall climbs both floors.
    api.box((x0 + x1) / 2, WALL_TOP + .12, FRONT - .12, x1 - x0 + .1, .12, .9, slate[0], [Math.atan(.35), 0, 0]);
    api.box((x0 + x1) / 2, WALL_TOP + .02, FRONT + .03, x1 - x0 + .1, .12, .18, timber);
    api.box(x0 - .07, WALL_TOP / 2, 0, .14, WALL_TOP, FRONT - BACK, plaster);
    api.box(x0 - .07, WALL_TOP * 1.5, -.45, .14, WALL_TOP, FRONT - BACK, plaster);
    api.box(x0 - .1, .17, 0, .12, .34, FRONT - BACK, stone);
  } else {
    // The back slope, the ridge, the gable ends and the chimney stay put.
    const l = x0 - (options.leftEnd ? END : 0), r = x1 + (options.rightEnd ? END : 0);
    slopeRows(api, l, r, -1);
    api.box((l + r) / 2, WALL_TOP + RISE + .14, 0, r - l + .04, .14, .26, timber);
    api.box((l + r) / 2, WALL_TOP - EAVE * slope + .02, BACK - EAVE, r - l, .16, .1, timber);
    if (options.leftEnd) gableEnd(api, x0, -1, theme);
    if (options.rightEnd) gableEnd(api, x1, 1, theme);
    if (options.chimney) {
      // A brick chimney on the back slope.
      const [x, top, z] = CHIMNEY_TOP;
      api.box(x, top - .8, z, .5, 1.3, .5, brick); api.box(x, top - .11, z, .62, .12, .62, cream);
    }
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
