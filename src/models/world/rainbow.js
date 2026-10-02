import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { clockRandom } from '../../core/test-pins.js';
import { LIGHTNING_RAINBOW_GAP } from '../../core/lightning.js';

export const RAINBOW = Object.freeze({
  firstAfter: Object.freeze([40, 110]), gap: Object.freeze([150, 320]), rise: 14, hold: Object.freeze([35, 60]), fall: 18,
  primary: 42, secondary: 51, inner: 36, outer: 56, sweep: 80, rings: 6, segments: 40, distance: 2600,
});

export const RAINBOW_SUN = Object.freeze([0, Math.sin(0.42), Math.cos(0.42)]);

const DEGREE = Math.PI / 180;
const ease = t => t * t * (3 - 2 * t);
const between = ([low, high], random) => low + (high - low) * random();

export function rainbowPresence(age, hold) {
  if (age < 0) return 0;
  if (age < RAINBOW.rise) return ease(age / RAINBOW.rise);
  if (age < RAINBOW.rise + hold) return 1;
  return 1 - ease(Math.min(1, (age - RAINBOW.rise - hold) / RAINBOW.fall));
}

export function createSunBreak({ random = clockRandom } = {}) {
  let nextAt = null, start = -Infinity, hold = 0, presence = 0, forced = null;
  const lightningClear = (now, lightning) => !lightning || (!lightning.active && now - lightning.idleSince >= LIGHTNING_RAINBOW_GAP);
  return {
    get presence() { return presence; },
    get nextAt() { return nextAt; },
    show(seconds = RAINBOW.hold[1]) { forced = seconds; },
    update(now, raining, still, lightning) {
      if (!raining || still) { nextAt = null; start = -Infinity; presence = 0; forced = null; return presence; }
      if (forced !== null) { start = now - RAINBOW.rise; hold = forced; nextAt = null; forced = null; }
      const age = now - start;
      if (age >= RAINBOW.rise + hold + RAINBOW.fall) {
        if (Number.isFinite(start)) { nextAt = now + between(RAINBOW.gap, random); start = -Infinity; }
        nextAt ??= now + between(RAINBOW.firstAfter, random);
        if (now >= nextAt && lightningClear(now, lightning)) { start = now; hold = between(RAINBOW.hold, random); nextAt = null; }
      }
      presence = rainbowPresence(now - start, hold);
      return presence;
    },
  };
}

export function bowFrame(sun) {
  const length = Math.hypot(sun[0], sun[1], sun[2]), axis = [-sun[0] / length, -sun[1] / length, -sun[2] / length];
  const lift = [-axis[1] * axis[0], 1 - axis[1] * axis[1], -axis[1] * axis[2]], liftLength = Math.hypot(...lift), up = lift.map(value => value / liftLength);
  const side = [axis[1] * up[2] - axis[2] * up[1], axis[2] * up[0] - axis[0] * up[2], axis[0] * up[1] - axis[1] * up[0]];
  return { axis, up, side };
}

export function bowShape(sun = RAINBOW_SUN) {
  const { axis, up, side } = bowFrame(sun), positions = [], uvs = [], indices = [], across = RAINBOW.segments + 1;
  for (let ring = 0; ring <= RAINBOW.rings; ring++) {
    const radius = RAINBOW.inner + (RAINBOW.outer - RAINBOW.inner) * ring / RAINBOW.rings, out = Math.sin(radius * DEGREE), along = Math.cos(radius * DEGREE);
    for (let step = 0; step < across; step++) {
      const turn = (-RAINBOW.sweep + 2 * RAINBOW.sweep * step / RAINBOW.segments) * DEGREE, u = Math.cos(turn) * out, s = Math.sin(turn) * out;
      for (let k = 0; k < 3; k++) positions.push((axis[k] * along + up[k] * u + side[k] * s) * RAINBOW.distance);
      uvs.push(radius, turn);
      if (ring && step) { const a = ring * across + step, b = a - across; indices.push(b - 1, b, a, b - 1, a, a - 1); }
    }
  }
  return { positions, uvs, indices };
}

const BOW_VERTEX = `precision highp float;
attribute vec3 position; attribute vec2 uv; uniform mat4 world, viewProjection; varying vec3 vDir; varying vec2 vBand;
void main() { vDir = position; vBand = uv; gl_Position = viewProjection * world * vec4(position, 1.); }`;

const BOW_FRAGMENT = `precision highp float;
varying vec3 vDir; varying vec2 vBand; uniform float presence;
vec3 spectrum(float t) {
  vec3 c = mix(vec3(.54, .48, .69), vec3(.44, .56, .72), smoothstep(0., .2, t));
  c = mix(c, vec3(.55, .69, .49), smoothstep(.2, .42, t));
  c = mix(c, vec3(.85, .81, .54), smoothstep(.42, .6, t));
  c = mix(c, vec3(.85, .66, .45), smoothstep(.6, .78, t));
  return mix(c, vec3(.78, .5, .42), smoothstep(.78, 1., t));
}
float band(float t) { return smoothstep(-.35, .15, t) * (1. - smoothstep(.85, 1.35, t)); }
void main() {
  float radius = vBand.x, p = (radius - 40.4) / 2.2, s = (radius - 50.1) / 3.4;
  float primary = band(p) * .22, secondary = band(s) * .1;
  float inner = smoothstep(${RAINBOW.inner.toFixed(1)}, 40., radius) * (1. - smoothstep(40., 41., radius)) * .05;
  float dark = smoothstep(42.8, 44.2, radius) * (1. - smoothstep(48.8, 50.2, radius)) * .06;
  vec3 color = spectrum(clamp(p, 0., 1.)) * primary + spectrum(clamp(1. - s, 0., 1.)) * secondary + vec3(.78, .8, .74) * inner + vec3(.2, .22, .19) * dark;
  float alpha = primary + secondary + inner + dark;
  float land = smoothstep(-.03, .15, normalize(vDir).y), brush = (.8 + .2 * sin(vBand.y * 4.1 + .7) * sin(vBand.y * 1.7 + 2.)) * (.25 + .75 * smoothstep(-1.1, -.15, vBand.y));
  gl_FragColor = vec4(color / max(alpha, 1e-4), alpha * land * brush * presence);
}`;

export function createWorldRainbow(scene, sun = RAINBOW_SUN) {
  const paint = new ShaderMaterial('world-rainbow-paint', scene, { vertexSource: BOW_VERTEX, fragmentSource: BOW_FRAGMENT }, { attributes: ['position', 'uv'], uniforms: ['world', 'viewProjection', 'presence'], needAlphaBlending: true });
  paint.backFaceCulling = false; paint.disableDepthWrite = true; paint.setFloat('presence', 0);
  const bow = new Mesh('world-rainbow', scene);
  Object.assign(new VertexData(), bowShape(sun)).applyToMesh(bow);
  bow.material = paint; bow.infiniteDistance = true; bow.renderingGroupId = 1; scene.setRenderingAutoClearDepthStencil(1, false, false, false); bow.isPickable = false; bow.alwaysSelectAsActiveMesh = true; bow.metadata = { castShadow: false, world: true, effect: 'rainbow' };
  bow.setEnabled(false);
  return {
    bow, paint, sun,
    ready: () => paint.forceCompilationAsync(bow),
    show(presence) {
      const on = presence > 0.002;
      if (on) paint.setFloat('presence', presence);
      if (bow.isEnabled(false) !== on) bow.setEnabled(on);
    },
    dispose() { paint.dispose(); bow.dispose(); },
  };
}

export function createRainbow(outdoor, options) {
  const sunBreak = createSunBreak(options), sky = outdoor ? createWorldRainbow(outdoor) : null;
  return {
    sunBreak, sky,
    get presence() { return sunBreak.presence; },
    ready: () => sky?.ready(),
    show(seconds) { sunBreak.show(seconds); },
    update(now, raining, still, lightning) {
      const presence = sunBreak.update(now, raining, still, lightning);
      sky?.show(presence);
      return presence;
    },
  };
}
