export const PLACES = Object.freeze({
  home: Object.freeze({ x: 0, y: -1 }),
  island: Object.freeze({ x: 0, y: 1 }),
  garden: Object.freeze({ x: -1, y: .35 }),
  pond: Object.freeze({ x: 1, y: .35 }),
  forest: Object.freeze({ x: .7, y: 1.8 }),
});

export const SKIES = Object.freeze({
  day: Object.freeze({ lit: '#fffbf3', shade: '#b4c7d9', rim: '#fffaf0', sky: '#bcd6ea', sun: Object.freeze([-.45, .9]) }),
  dusk: Object.freeze({ lit: '#ffdcbc', shade: '#988bb6', rim: '#fff0da', sky: '#a194c0', sun: Object.freeze([-.8, .6]) }),
  rain: Object.freeze({ lit: '#d9e1e1', shade: '#8796a0', rim: '#eef2ef', sky: '#9aabb3', sun: Object.freeze([.2, 1]) }),
});

export const CLOUD_TIMING = Object.freeze({ close: 380, part: 620 });
export const FADE_TIMING = Object.freeze({ close: 140, part: 200 });

export function planTrip({ from, to, theme, still, seed }) {
  const sky = SKIES[theme] || SKIES.dusk;
  if (still) return { kind: 'fade', ...FADE_TIMING, sky };
  const a = PLACES[from] || PLACES.home, b = PLACES[to] || PLACES.home;
  const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
  const heading = length ? [dx / length, dy / length] : [0, 1];
  return { kind: 'clouds', ...CLOUD_TIMING, sky, heading, seed };
}

const smooth = t => t * t * (3 - 2 * t);
const clamp01 = t => Math.min(1, Math.max(0, t));

export function cloudFrame(plan, phase, progress) {
  const t = clamp01(progress), [hx, hy] = plan.heading;
  const journey = phase === 'closing' ? .42 * t : phase === 'closed' ? .42 : .42 + .58 * t;
  const cover = phase === 'closing' ? smooth(t) : phase === 'closed' ? 1 : (1 - t) ** 1.25;
  const travel = .55 * journey;
  return { cover, depth: journey, drift: [hx * travel, hy * travel] };
}
