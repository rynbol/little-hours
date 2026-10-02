import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { CreateIcoSphereVertexData } from '@babylonjs/core/Meshes/Builders/icoSphereBuilder.pure.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { Vector4 } from '@babylonjs/core/Maths/math.vector.js';
import { heightAt, noise2, pathCenter, smooth } from '../../core/world-terrain.js';
import { createTerrainPaint, groundGLSL, GROUND_UNIFORMS, applyGround } from './terrain-paint.js';
import { GROVE_UNIFORMS } from './grove-light.js';
import { followEye } from './world-glsl.js';

export const MEADOW_ROCKS = Object.freeze([
  Object.freeze({ ahead: 21, side: -3.6, size: [1.5, 0.62, 0.72], seat: true }),
  Object.freeze({ ahead: 9, side: 2.1, size: [0.45, 0.3, 0.42] }),
  Object.freeze({ ahead: 23, side: -5.4, size: [0.5, 0.34, 0.45] }),
  Object.freeze({ ahead: 27, side: 2.6, size: [0.65, 0.42, 0.55] }),
  Object.freeze({ ahead: 38, side: -3, size: [0.9, 0.55, 0.75] }),
  Object.freeze({ ahead: 40, side: -4.9, size: [0.45, 0.3, 0.4] }),
  Object.freeze({ ahead: 52, side: 3.2, size: [1.1, 0.65, 0.85] }),
]);

const SINK = 0.3;
const SUMMIT_RADIUS = .4;
const SHOULDER_RADIUS = .528;

function rockPlace({ ahead, side, x: placedX, z: placedZ, turn = 0 }, surface) {
  if (placedX !== undefined) return { x: placedX, z: placedZ, ground: surface ? surface(placedX, placedZ)?.height ?? -10000 : heightAt(placedX, placedZ), cos: Math.cos(turn), sin: Math.sin(turn) };
  const z = -ahead, x = pathCenter(ahead) + side, run = pathCenter(ahead + 1) - pathCenter(ahead - 1), along = Math.hypot(run, 2);
  return { x, z, ground: heightAt(x, z), cos: run / along, sin: -2 / along };
}

export const rockClearings = (rocks = MEADOW_ROCKS) => rocks.flatMap(rock => {
  const { x, z } = rockPlace(rock);
  return [x, z, Math.sqrt(rock.size[0] * rock.size[2]) * 1.15, 0];
});

function summitStone(seed) {
  const positions = [], indices = [], rings = [[], [], [], [], []], sides = 32;
  const triangle = (a, b, c) => {
    const start = positions.length / 3;
    positions.push(...a, ...b, ...c); indices.push(start, start + 1, start + 2);
  };
  for (let side = 0; side < sides; side++) {
    const angle = side / sides * Math.PI * 2, x = Math.cos(angle), z = Math.sin(angle);
    const grain = noise2(x * 2.4 + seed * 7.3, z * 2.4 + 0.37, 91), split = noise2(x * 3.7 + 0.61, z * 3.7 + seed * 3.1, 92);
    const radii = [(1.025 + 0.1 * Math.abs(grain)) * SUMMIT_RADIUS / SHOULDER_RADIUS, 1.06 + 0.12 * Math.abs(split), 1.36 + 0.2 * Math.abs(grain + split), 1.22 + 0.17 * Math.abs(grain), 0.98 + 0.15 * Math.abs(split)];
    const heights = [0.5, 0.38 + 0.07 * split, -0.08 + 0.1 * grain, -0.29 + 0.07 * split, -0.5];
    for (let ring = 0; ring < rings.length; ring++) {
      const turn = angle + (ring === 0 ? 0 : Math.sin(seed * 1.9 + ring * 2.4) * 0.06);
      rings[ring].push([Math.cos(turn) * radii[ring], heights[ring], Math.sin(turn) * radii[ring]]);
    }
  }
  for (let side = 0; side < sides; side++) {
    const next = (side + 1) % sides;
    triangle([0, 0.5, 0], rings[0][side], rings[0][next]);
    for (let ring = 0; ring < rings.length - 1; ring++) {
      triangle(rings[ring][side], rings[ring + 1][side], rings[ring][next]);
      triangle(rings[ring + 1][side], rings[ring + 1][next], rings[ring][next]);
    }
    triangle([0, -0.5, 0], rings[4][next], rings[4][side]);
  }
  return { positions, indices };
}

export function rockCollider(rock, index = 0) {
  const radius = Math.max(rock.size[0], rock.size[2]) * (rock.climbable ? SUMMIT_RADIUS : .86), height = rock.size[1] * (rock.seat ? 0.968 : 1.4);
  if (!rock.climbable) return { radius, height };
  const shape = summitStone(index), levels = [...new Set(shape.positions.filter((_, i) => i % 3 === 1))].sort((a, b) => a - b);
  const radiusProfile = levels.map(level => {
    let bound = 0;
    for (let t = 0; t < shape.indices.length; t += 3) for (let edge = 0; edge < 3; edge++) {
      const a = shape.indices[t + edge] * 3, b = shape.indices[t + (edge + 1) % 3] * 3, ay = shape.positions[a + 1], by = shape.positions[b + 1];
      if (level < Math.min(ay, by) || level > Math.max(ay, by)) continue;
      if (ay === by) {
        bound = Math.max(bound, Math.hypot(shape.positions[a], shape.positions[a + 2]), Math.hypot(shape.positions[b], shape.positions[b + 2]));
      } else {
        const fraction = (level - ay) / (by - ay);
        bound = Math.max(bound, Math.hypot(shape.positions[a] + (shape.positions[b] - shape.positions[a]) * fraction, shape.positions[a + 2] + (shape.positions[b + 2] - shape.positions[a + 2]) * fraction));
      }
    }
    return { height: (level + 0.5) * (height + 0.1) - 0.1, radius: bound * Math.max(rock.size[0], rock.size[2]) * SHOULDER_RADIUS };
  });
  return { radius, height, radiusProfile };
}

export function meadowRocks(rocks = MEADOW_ROCKS, surface) {
  const organic = CreateIcoSphereVertexData({ radius: 1, subdivisions: 2 });
  const weathered = CreateIcoSphereVertexData({ radius: 1, subdivisions: 4 });
  const shapes = rocks.map((rock, index) => rock.climbable ? summitStone(index) : rock.x !== undefined ? weathered : organic), total = shapes.reduce((sum, shape) => sum + shape.positions.length / 3, 0);
  const positions = new Float32Array(total * 3), colors = new Float32Array(total * 4), indices = [];
  let start = 0;
  rocks.forEach((rock, r) => {
    const { size: [sx, sy, sz], seat, climbable } = rock, shape = shapes[r], count = shape.positions.length / 3;
    const { x, z, ground, cos, sin } = rockPlace(rock, surface);
    for (let v = 0; v < count; v++) {
      const ux = shape.positions[v * 3], uy = shape.positions[v * 3 + 1], uz = shape.positions[v * 3 + 2];
      const lump = 1 + 0.2 * noise2(ux * 1.6 + r * 7, uz * 1.6 + uy, 81) + 0.07 * noise2(ux * 4.1 + uy * 3, uz * 4.1 + r, 82);
      const lift = seat ? Math.min(uy, 0.55 + (uy - 0.55) * 0.15) : uy;
      const radius = Math.max(sx, sz) * SHOULDER_RADIUS, summitHeight = sy * (seat ? 0.968 : 1.4);
      const lx = climbable ? ux * radius : ux * sx * lump, above = climbable ? (uy + 0.5) * (summitHeight + 0.1) - 0.1 : (lift * lump + 1 - 2 * SINK) * sy, lz = climbable ? uz * radius : uz * sz * lump, at = (start + v) * 3;
      positions[at] = x + lx * cos - lz * sin; positions[at + 1] = ground + above; positions[at + 2] = z + lx * sin + lz * cos;
      colors.set([Math.max(0.6, 0.9 * (1 - smooth(0, 0.3, above))), 0, smooth(0.45, 0.8, uy + 0.35 * noise2(ux * 2 + r, uz * 2, 83)), 0], (start + v) * 4);
    }
    for (const index of shape.indices) indices.push(start + index);
    start += count;
  });
  const normals = new Float32Array(positions.length);
  VertexData.ComputeNormals(positions, indices, normals);
  let offset = 0;
  for (let r = 0; r < rocks.length; r++) {
    const count = shapes[r].positions.length;
    if (rocks[r].x !== undefined) {
      const joined = new Map();
      for (let i = offset; i < offset + count; i += 3) {
        const key = `${positions[i].toFixed(5)},${positions[i + 1].toFixed(5)},${positions[i + 2].toFixed(5)}`;
        if (!joined.has(key)) joined.set(key, { vertices: [], normal: [0, 0, 0] });
        const group = joined.get(key); group.vertices.push(i);
        for (let axis = 0; axis < 3; axis++) group.normal[axis] += normals[i + axis];
      }
      for (const { vertices, normal } of joined.values()) {
        const length = Math.hypot(...normal);
        for (const i of vertices) for (let axis = 0; axis < 3; axis++) normals[i + axis] = normal[axis] / length;
      }
    }
    offset += count;
  }
  return { positions, normals, colors, indices: new Uint32Array(indices) };
}

export function createWorldRocks(scene, { root, still, definition, surface, grove }) {
  const { paint, setTheme, setContactShadow } = definition ? createRockPaint(scene, { still, definition, grove }) : createTerrainPaint(scene, { still });
  const mesh = new Mesh('world-rocks', scene);
  Object.assign(new VertexData(), meadowRocks(definition?.rocks, surface)).applyToMesh(mesh);
  mesh.material = paint; mesh.parent = root; mesh.isPickable = false; mesh.metadata = { castShadow: false, world: true };
  mesh.freezeWorldMatrix();
  return { mesh, setTheme, setContactShadow, refresh() { if (definition) Object.assign(new VertexData(), meadowRocks(definition.rocks, surface)).applyToMesh(mesh); } };
}

function createRockPaint(scene, { still, definition, grove }) {
  const vertexSource = `precision highp float;
attribute vec3 position, normal; attribute vec4 color; uniform mat4 world, viewProjection;
varying vec3 vWorld, vNormal; varying float vMoss;
void main() { vec4 p = world * vec4(position, 1.); vWorld = p.xyz; vNormal = normal; vMoss = color.b; gl_Position = viewProjection * p; }`;
  const fragmentSource = `precision highp float;
varying vec3 vWorld, vNormal; varying float vMoss;
${groundGLSL(definition, !!grove)}
void main() {
  vec3 n = normalize(vNormal);
  float grain = worldNoise(vWorld.xz * 2.3 + vWorld.y * .8), mottle = worldNoise(vWorld.xz * .9 + vWorld.y * .2);
  float strata = sin(vWorld.y * 5.4 + vWorld.x * 1.3 - vWorld.z * .6 + worldNoise(vWorld.xz * .7) * 2.4);
  vec3 stone = mix(rockDark, rock, .52 + .36 * mottle) * (.97 + (grain - .5) * .12 + strata * .075);
  float seam = abs(sin(vWorld.y * 5.4 + vWorld.x * 1.3 - vWorld.z * .6 + worldNoise(vWorld.xz * .7) * 2.4));
  float fissure = (1. - smoothstep(.018, .075, seam)) * smoothstep(.48, .7, worldNoise(vWorld.xz * 1.1 + vWorld.y));
  stone = mix(stone, rockDark * .78, fissure * .48);
  stone = mix(stone, stone * vec3(1.1, 1.04, .88), smoothstep(.56, .76, mottle) * .42);
  float moss = vMoss * smoothstep(.1, .78, n.y) * smoothstep(.35, .62, mottle);
  vec3 color = mix(stone, mix(forestFloor, grassLight, .25) * (.9 + grain * .12), moss * .88);
  ${grove ? 'vec4 grove = groveAt(vWorld.xz, 0.); grove.g = 1.; color = groveLight(color, n, grove);' : 'color *= groundLight(n, .08);'}
  color *= contactShade(vWorld.xz);
  gl_FragColor = vec4(worldAir(color, vWorld, eye, sun, fogNear, fogFar, fogSun, fogDensity, fogHeight), 1.);
}`;
  const paint = new ShaderMaterial('world-rock-paint', scene, { vertexSource, fragmentSource }, { attributes: ['position', 'normal', 'color'], uniforms: ['world', 'viewProjection', ...GROUND_UNIFORMS, ...(grove ? GROVE_UNIFORMS : [])], samplers: grove ? ['groveField'] : [] });
  grove?.bind(paint);
  paint.backFaceCulling = false;
  paint.setFloat('gusts', still ? 0 : 1);
  const shadow = new Vector4(0, 0, 1, 0); paint.setVector4('contactShadow', shadow);
  followEye(scene, paint, still);
  return { paint, setTheme: atmosphere => applyGround(paint, atmosphere), setContactShadow(x, z, radius, strength) { shadow.set(x, z, radius, strength); paint.setVector4('contactShadow', shadow); } };
}
