import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector2 } from '@babylonjs/core/Maths/math.vector.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';
import { heightAt } from '../../core/world-terrain.js';

export const LIGHTNING_SKY = Object.freeze({
  shell: 4300, glow: 0.85, tint: '#b4c4e8', bolt: '#e8ecff', boltStrength: 0.9,
  top: 1150, bottom: 0, width: 120, branchWidth: 70, sway: 0.07, seeds: Object.freeze([3, 11, 23]), footSink: 80, footHaze: 100,
});

const GLOW_VERTEX = `precision highp float;
attribute vec3 position; uniform mat4 world, viewProjection; varying vec3 vDir;
void main() { vDir = position; gl_Position = viewProjection * world * vec4(position, 1.); }`;
const GLOW_FRAGMENT = `precision highp float;
varying vec3 vDir; uniform vec3 tint; uniform vec2 bearing; uniform float strength;
void main() {
  vec3 d = normalize(vDir);
  float lobe = pow(max(dot(normalize(d.xz + vec2(1e-4)), bearing), 0.), 4.), up = smoothstep(-.02, .35, d.y);
  gl_FragColor = vec4(tint * strength * (.3 + .7 * lobe) * (.35 + .65 * up), 1.);
}`;
const BOLT_VERTEX = `precision highp float;
attribute vec3 position; attribute vec2 uv; uniform mat4 world, viewProjection; varying vec2 vEdge; varying float vHeight;
void main() { vec4 placed = world * vec4(position, 1.); vEdge = uv; vHeight = placed.y; gl_Position = viewProjection * placed; }`;
const BOLT_FRAGMENT = `precision highp float;
varying vec2 vEdge; varying float vHeight; uniform vec3 tint; uniform float strength, ground;
void main() {
  float across = abs(vEdge.x), glow = exp(-across * across * 11.) + .3 * (1. - across) * (1. - across);
  float haze = smoothstep(ground - ${LIGHTNING_SKY.footSink.toFixed(1)}, ground + ${LIGHTNING_SKY.footHaze.toFixed(1)}, vHeight) * (1. - smoothstep(.72, 1., vEdge.y));
  gl_FragColor = vec4(tint, strength * glow * haze);
}`;

function seeded(seed) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

export function boltShape(seed, { top = LIGHTNING_SKY.top, bottom = LIGHTNING_SKY.bottom, width = LIGHTNING_SKY.width, branchWidth = LIGHTNING_SKY.branchWidth, sway = LIGHTNING_SKY.sway } = {}) {
  const random = seeded(seed), positions = [], uvs = [], indices = [], tall = top - bottom;
  const strip = (points, half, taper) => {
    const first = positions.length / 3, last = points.length - 1;
    points.forEach(([x, y], i) => {
      const [ax, ay] = points[Math.max(0, i - 1)], [bx, by] = points[Math.min(last, i + 1)], length = Math.hypot(bx - ax, by - ay);
      const reach = half * (1 - taper * i / last), nx = -(by - ay) / length * reach, ny = (bx - ax) / length * reach, height = (y - bottom) / tall;
      positions.push(x - nx, y - ny, 0, x + nx, y + ny, 0);
      uvs.push(-1, height, 1, height);
      if (i < last) { const a = first + i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
  };
  const steps = 16, trunk = [[0, top]];
  for (let i = 1; i <= steps; i++) trunk.push([trunk[i - 1][0] + (random() - 0.5) * tall * sway, top - tall * i / steps]);
  strip(trunk, width / 2, 0);
  for (let branch = 0, count = 2 + Math.floor(random() * 2); branch < count; branch++) {
    const side = random() < 0.5 ? -1 : 1, limb = [trunk[2 + Math.floor(random() * (steps / 2))]];
    for (let i = 0, reach = 4 + Math.floor(random() * 3); i < reach; i++) {
      const [x, y] = limb[i];
      limb.push([x + side * tall * (0.02 + random() * 0.03), y - tall * (0.03 + random() * 0.04)]);
    }
    strip(limb, branchWidth / 2, 0.6);
  }
  return { positions, uvs, indices };
}

export function skylineAt(bearing, distance, height = heightAt) {
  const x = Math.sin(bearing), z = -Math.cos(bearing);
  let slope = 0;
  for (let step = 300; step < distance; step += 50) slope = Math.max(slope, height(x * step, z * step) / step);
  return slope * distance;
}

function additive(scene, name, vertexSource, fragmentSource, attributes) {
  const paint = new ShaderMaterial(name, scene, { vertexSource, fragmentSource }, { attributes, uniforms: ['world', 'viewProjection', 'tint', 'strength', 'bearing', 'ground'], needAlphaBlending: true });
  paint.backFaceCulling = false; paint.disableDepthWrite = true;
  return paint;
}

export function createWorldLightning(scene) {
  const facing = new Vector2(0, -1);
  const glowPaint = additive(scene, 'world-lightning-glow-paint', GLOW_VERTEX, GLOW_FRAGMENT, ['position']);
  glowPaint.alphaMode = Constants.ALPHA_ONEONE;
  glowPaint.setColor3('tint', Color3.FromHexString(LIGHTNING_SKY.tint)); glowPaint.setFloat('strength', 0); glowPaint.setVector2('bearing', facing);
  const glow = CreateSphere('world-lightning-glow', { diameter: LIGHTNING_SKY.shell * 2, segments: 12, sideOrientation: Mesh.BACKSIDE }, scene);
  glow.onBeforeDrawObservable.add(() => scene.getEngine().alphaState.setAlphaBlendFunctionParameters(Constants.GL_ALPHA_FUNCTION_DST_COLOR, 1, 0, 1));
  const boltPaint = additive(scene, 'world-lightning-bolt-paint', BOLT_VERTEX, BOLT_FRAGMENT, ['position', 'uv']);
  boltPaint.alphaMode = Constants.ALPHA_ADD;
  boltPaint.setColor3('tint', Color3.FromHexString(LIGHTNING_SKY.bolt)); boltPaint.setFloat('strength', 0); boltPaint.setFloat('ground', 0);
  const bolts = LIGHTNING_SKY.seeds.map((seed, index) => {
    const mesh = new Mesh(`world-lightning-bolt-${index}`, scene), { positions, uvs, indices } = boltShape(seed);
    Object.assign(new VertexData(), { positions, uvs, indices }).applyToMesh(mesh);
    mesh.material = boltPaint; mesh.alphaIndex = Infinity;
    return mesh;
  });
  glow.material = glowPaint;
  for (const mesh of [glow, ...bolts]) { mesh.isPickable = false; mesh.alwaysSelectAsActiveMesh = true; mesh.metadata = { castShadow: false, world: true, effect: 'lightning' }; mesh.setEnabled(false); }
  let shown = false, aimed = NaN, reach = NaN;

  function hide() {
    if (!shown) return;
    glow.setEnabled(false); for (const bolt of bolts) bolt.setEnabled(false);
    shown = false;
  }
  return {
    glow, bolts,
    ready: () => Promise.all([glowPaint.forceCompilationAsync(glow), boltPaint.forceCompilationAsync(bolts[0])]),
    show(level, shape) {
      if (level <= 0.002) { hide(); return; }
      shown = true;
      facing.set(Math.sin(shape.bearing), -Math.cos(shape.bearing));
      glowPaint.setFloat('strength', level * LIGHTNING_SKY.glow); glow.setEnabled(true);
      for (let i = 0; i < bolts.length; i++) {
        const bolt = bolts[i], on = i === shape.bolt;
        bolt.setEnabled(on);
        if (!on) continue;
        bolt.position.set(Math.sin(shape.bearing) * shape.distance, 0, -Math.cos(shape.bearing) * shape.distance);
        bolt.rotation.y = -shape.bearing;
        if (aimed !== shape.bearing || reach !== shape.distance) { aimed = shape.bearing; reach = shape.distance; boltPaint.setFloat('ground', skylineAt(aimed, reach)); }
      }
      boltPaint.setFloat('strength', level * LIGHTNING_SKY.boltStrength);
    },
    dispose() { glowPaint.dispose(); boltPaint.dispose(); glow.dispose(); for (const bolt of bolts) bolt.dispose(); },
  };
}
