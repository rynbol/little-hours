export const LAMPLIGHT = Object.freeze({
  day: Object.freeze({ shade: 1.1, pool: 0, hearth: 0, reach: 0 }),
  dusk: Object.freeze({ shade: 3.4, pool: 1.5, hearth: .62, reach: 2.4 }),
  rain: Object.freeze({ shade: 2.1, pool: .6, hearth: .26, reach: 2 }),
});
const WARM = Object.freeze([1.2, .58, -.2]);
const HEARTH = Object.freeze({ at: [0, 1.4, .2], reach: 5.2 });
const GLOWING = .25;

export const lamplight = theme => LAMPLIGHT[theme] || LAMPLIGHT.day;

export function glowOf(material) {
  const e = material?.emissiveColor;
  return e && e.r + e.g + e.b > GLOWING ? [e.r, e.g, e.b] : null;
}

export function lampAt(positions, glow) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], positions[i + k]); max[k] = Math.max(max[k], positions[i + k]); }
  const peak = Math.max(...glow);
  return { at: min.map((v, k) => (v + max[k]) / 2), tint: glow.map((v, k) => v / peak * .5 + WARM[k] * .5), power: Math.min(1, (glow[0] + glow[1] + glow[2]) / 1.4) };
}

export function warmRoom(parts, lamps, theme, origin = [0, 0, 0]) {
  const { pool, hearth, reach } = lamplight(theme);
  const lights = lamps.map(lamp => ({ ...lamp, reach, strength: pool * lamp.power }));
  if (hearth) lights.push({ at: HEARTH.at.map((v, k) => v + origin[k]), tint: WARM, reach: HEARTH.reach, strength: hearth, wide: true });
  if (!lights.some(light => light.strength > 0)) return;
  for (const { positions, colors } of parts) {
    if (!colors) continue;
    for (let v = 0, c = 0; v < positions.length; v += 3, c += 4) {
      let r = 0, g = 0, b = 0;
      for (const { at, tint, reach: far, strength, wide } of lights) {
        const d = Math.hypot(positions[v] - at[0], positions[v + 1] - at[1], positions[v + 2] - at[2]);
        if (d >= far) continue;
        const k = (1 - d / far) ** (wide ? 1 : 2) * strength;
        r += tint[0] * k; g += tint[1] * k; b += tint[2] * k;
      }
      colors[c] *= 1 + r; colors[c + 1] *= 1 + g; colors[c + 2] *= Math.max(.55, 1 + b);
    }
  }
}
