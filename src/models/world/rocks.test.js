import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import * as rocks from './rocks.js';
import { heightAt, padDistance, pathCenter, pathDistance } from '../../core/world-terrain.js';
import { WORLD_ATMOSPHERES } from './atmosphere.js';
import { createMovementState, stepMovement, WILDS_MOVEMENT } from '../../core/wilds/movement.js';

const PER_ROCK = 240, EYE = [-2, 2.24, -2.41];
const { createWorldRocks, meadowRocks, MEADOW_ROCKS, rockClearings, rockCollider } = rocks;
const rockVertices = (positions, r) => Array.from({ length: PER_ROCK }, (_, v) => positions.slice((r * PER_ROCK + v) * 3, (r * PER_ROCK + v) * 3 + 3));

test('default room rock geometry and paint buffers remain unchanged', () => {
  const mesh = meadowRocks(), hash = createHash('sha256');
  for (const key of ['positions', 'normals', 'colors', 'indices']) hash.update(Buffer.from(mesh[key].buffer));
  assert.equal(hash.digest('hex'), '3906976e5a80b1fe695b2bccf1a5d294377df54f2c73182cfae5cffea73d2ce9');
});

test('meadow rocks sit low beside the path, half sunk into the slope and clear of the house', () => {
  const { positions } = meadowRocks();
  assert.equal(positions.length / 3, MEADOW_ROCKS.length * PER_ROCK);
  MEADOW_ROCKS.forEach((rock, r) => {
    const x = pathCenter(rock.ahead) + rock.side, z = -rock.ahead, ground = heightAt(x, z), points = rockVertices(positions, r);
    const fromPath = pathDistance(x, z);
    assert.ok(fromPath > 1.5 && fromPath < 6, `rock ${r} is ${fromPath} m from the path`);
    assert.ok(points.some(([px, py, pz]) => py < heightAt(px, pz) - 0.15), `rock ${r} is buried`);
    assert.ok(Math.max(...points.map(([, py]) => py - ground)) < 1, `rock ${r} stays low`);
    assert.ok(points.every(([px, , pz]) => padDistance(px, pz) > 2), `rock ${r} is off the house pad`);
  });
});

test('the rocks stay below the valley view from the desk, and one has a flat seat', () => {
  const { positions } = meadowRocks();
  const lowest = MEADOW_ROCKS.map((_, r) => Math.min(...rockVertices(positions, r).map(([px, py, pz]) => Math.atan2(EYE[1] - py, Math.hypot(px - EYE[0], pz - EYE[2])) * 180 / Math.PI)));
  assert.ok(lowest.every(angle => angle > 11), lowest.join());
  const seated = MEADOW_ROCKS.map((_, r) => {
    const heights = rockVertices(positions, r).map(([, py]) => py), top = Math.max(...heights);
    return heights.filter(py => py > top - 0.03).length;
  });
  assert.deepEqual(seated, [34, 12, 6, 6, 6, 6, 6]);
  assert.equal(MEADOW_ROCKS.findIndex(rock => rock.seat), 0);
});

test('rock tops carry moss, their lower halves do not, and every vertex is marked as stone', () => {
  const { positions, colors } = meadowRocks(), mean = values => Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 1000) / 1000;
  const moss = MEADOW_ROCKS.map((_, r) => {
    const heights = rockVertices(positions, r).map(([, py]) => py), top = Math.max(...heights), foot = Math.min(...heights), span = top - foot;
    const mossAt = v => colors[(r * PER_ROCK + v) * 4 + 2];
    return [mean(heights.flatMap((py, v) => py > top - span * 0.15 ? [mossAt(v)] : [])), mean(heights.flatMap((py, v) => py < foot + span * 0.5 ? [mossAt(v)] : []))];
  });
  assert.deepEqual(moss, [[0.684, 0], [0.91, 0], [1, 0], [0.971, 0], [0.909, 0], [0.914, 0], [0.88, 0]]);
  for (let v = 0; v < colors.length / 4; v++) assert.equal(colors[v * 4 + 3], 0);
});

test('the rocks are one draw on the terrain paint and take the theme', () => {
  const scene = new Scene(new NullEngine()), root = new TransformNode('world', scene);
  const rocks = createWorldRocks(scene, { root, still: true });
  assert.equal(scene.meshes.length, 1);
  assert.equal(rocks.mesh.parent, root);
  assert.equal(rocks.mesh.getTotalIndices(), MEADOW_ROCKS.length * PER_ROCK);
  assert.equal(rocks.mesh.material._floats.gusts, 0);
  rocks.setTheme(WORLD_ATMOSPHERES.rain);
  assert.equal(rocks.mesh.material._colors3.rock.toHexString().toLowerCase(), WORLD_ATMOSPHERES.rain.rock);
});

test('explicit rock positions use the rendered surface supplied by their world', () => {
  const rocks = [{ x: 12, z: -21, turn: 0, size: [1, 1, 1] }], low = meadowRocks(rocks, () => ({ height: 10 })), high = meadowRocks(rocks, () => ({ height: 42 }));
  assert.deepEqual(rockClearings(rocks), [12, -21, 1.15, 0]);
  for (let i = 1; i < high.positions.length; i += 3) assert.ok(Math.abs(high.positions[i] - low.positions[i] - 32) < 0.00001);
  const missing = meadowRocks(rocks, () => null);
  assert.ok(missing.positions[1] < -9998);
});

test('every climbable rock support point including the mounting rim lies on its rendered flat summit', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const heightOnMesh = (mesh, x, z) => {
    let height = -Infinity;
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const [a, b, c] = Array.from(mesh.indices.slice(t, t + 3), index => Array.from(mesh.positions.slice(index * 3, index * 3 + 3)));
      const bx = b[0] - a[0], bz = b[2] - a[2], cx = c[0] - a[0], cz = c[2] - a[2], det = bx * cz - bz * cx;
      if (Math.abs(det) < 1e-8) continue;
      const wb = ((x - a[0]) * cz - (z - a[2]) * cx) / det, wc = (bx * (z - a[2]) - bz * (x - a[0])) / det;
      if (wb < -1e-5 || wc < -1e-5 || wb + wc > 1.00001) continue;
      height = Math.max(height, a[1] + (b[1] - a[1]) * wb + (c[1] - a[1]) * wc);
    }
    return height;
  };
  const mesh = meadowRocks(WILDS_WORLD.rocks, () => ({ height: 7 }));
  for (const rock of WILDS_WORLD.rocks.filter(rock => rock.climbable)) {
    const radius = rockCollider(rock).radius, top = 7 + rock.size[1] * (rock.seat ? 0.968 : 1.4);
    for (const reach of [0, 0.5, 0.95, 1]) for (let turn = 0; turn < 96; turn++) {
      const angle = turn / 96 * Math.PI * 2, y = heightOnMesh(mesh, rock.x + Math.sin(angle) * radius * reach, rock.z + Math.cos(angle) * radius * reach);
      assert.ok(Math.abs(y - top) < 0.00001, `${rock.x},${rock.z} summit at ${turn}/${reach}: ${y} vs ${top}`);
    }
  }
});

test('climbable stones have irregular shoulders and sloping facets around their level summit', () => {
  const rock = { x: 5.5, z: -8, turn: 0.4, size: [1.9, 1.15, 1.6], seat: true, climbable: true };
  const mesh = meadowRocks([rock], () => ({ height: 0 })), points = Array.from({ length: mesh.positions.length / 3 }, (_, i) => Array.from(mesh.positions.slice(i * 3, i * 3 + 3)));
  const top = Math.max(...points.map(p => p[1])), rim = points.filter(p => Math.abs(p[1] - top) < 0.00001 && Math.hypot(p[0] - 5.5, p[2] + 8) > rockCollider(rock).radius * .9);
  const radii = rim.map(p => Math.hypot(p[0] - 5.5, p[2] + 8));
  assert.ok(Math.max(...radii) - Math.min(...radii) > rockCollider(rock).radius * .04);
  assert.ok(new Set(points.map(p => p[1].toFixed(3))).size > 12);
  const shoulder = points.filter(p => p[1] > 0.1 && p[1] < top - 0.1);
  assert.ok(shoulder.length > 24);
  assert.ok(shoulder.every(p => Math.hypot(p[0] - 5.5, p[2] + 8) > rockCollider(rock).radius));
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const face = Array.from(mesh.indices.slice(i, i + 3), index => points[index]);
    if (!face.every(p => Math.abs(p[1] - top) < 0.00001)) continue;
    const edge = face.filter(p => Math.hypot(p[0] - 5.5, p[2] + 8) > rockCollider(rock).radius * .9);
    assert.equal(edge.length, 2);
    const [a, b] = edge, dx = b[0] - a[0], dz = b[2] - a[2], length = Math.hypot(dx, dz);
    assert.ok(Math.abs(dx * (-8 - a[2]) - dz * (5.5 - a[0])) / length > rockCollider(rock).radius);
  }
  const tilted = Array.from({ length: mesh.normals.length / 3 }, (_, i) => mesh.normals[i * 3 + 1]).filter(y => Math.abs(y) > 0.05 && Math.abs(y) < 0.95);
  assert.ok(tilted.length > 24);
});

test('climbable rock shoulders broaden below the summit and taper into their buried base', () => {
  const mesh = meadowRocks([{ x: 0, z: 0, size: [2, 1, 2], climbable: true }], () => ({ height: 0 }));
  const points = Array.from({ length: mesh.positions.length / 3 }, (_, i) => Array.from(mesh.positions.slice(i * 3, i * 3 + 3)));
  const radii = points.filter(p => p[1] > 0.25 && p[1] < 0.95).map(p => Math.hypot(p[0], p[2]));
  const summit = points.filter(p => p[1] > 1.39999), base = points.filter(p => p[1] < 0);
  const summitRadius = Math.max(...summit.map(p => Math.hypot(p[0], p[2]))), baseRadius = Math.max(...base.map(p => Math.hypot(p[0], p[2])));
  assert.ok(Math.max(...radii) > summitRadius * 1.22);
  assert.ok(Math.max(...radii) > baseRadius * 1.2);
  for (let i = 0; i < points.length; i++) if (points[i][1] > 1.39999 && Math.hypot(points[i][0], points[i][2]) < 0.01) assert.ok(mesh.normals[i * 3 + 1] > 0.99);
});

test('defined rocks use their own stone paint in one draw and share theme and contact shadow updates', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const scene = new Scene(new NullEngine()), root = new TransformNode('world', scene);
  const rocks = createWorldRocks(scene, { root, still: true, definition: WILDS_WORLD, surface: () => ({ height: 0 }) });
  assert.equal(scene.meshes.length, 1);
  assert.equal(rocks.mesh.material.name, 'world-rock-paint');
  rocks.setTheme(WORLD_ATMOSPHERES.dusk);
  assert.equal(rocks.mesh.material._colors3.rockDark.toHexString().toLowerCase(), '#5f6874');
  rocks.setContactShadow(1, 2, 3, 0.4);
  assert.deepEqual(rocks.mesh.material._vectors4.contactShadow.asArray(), [1, 2, 3, 0.4]);
  scene.dispose();
});

test('walk and climb bodies clear the actual triangles of every supported trail rock', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const baseY = 7, all = meadowRocks(WILDS_WORLD.rocks, () => ({ height: baseY }));
  for (const [index, rock] of WILDS_WORLD.rocks.entries()) {
    if (!rock.climbable) continue;
    const from = meadowRocks(WILDS_WORLD.rocks.slice(0, index)).indices.length, until = meadowRocks(WILDS_WORLD.rocks.slice(0, index + 1)).indices.length;
    const obstacle = { ...rock, ...rockCollider(rock, index), baseY };
    const actualRadiusBetween = (bottom, top) => {
      let radius = 0;
      for (let t = from; t < until; t += 3) for (let edge = 0; edge < 3; edge++) {
        const a = all.indices[t + edge] * 3, b = all.indices[t + (edge + 1) % 3] * 3, ay = all.positions[a + 1], by = all.positions[b + 1];
        if (ay >= bottom && ay <= top) radius = Math.max(radius, Math.hypot(all.positions[a] - rock.x, all.positions[a + 2] - rock.z));
        for (const y of [bottom, top]) {
          if (ay === by || y < Math.min(ay, by) || y > Math.max(ay, by)) continue;
          const fraction = (y - ay) / (by - ay);
          radius = Math.max(radius, Math.hypot(all.positions[a] + (all.positions[b] - all.positions[a]) * fraction - rock.x, all.positions[a + 2] + (all.positions[b + 2] - all.positions[a + 2]) * fraction - rock.z));
        }
      }
      return radius;
    };
    const world = { surfaceAt: () => ({ height: baseY, normal: { x: 0, y: 1, z: 0 } }), obstacles: [obstacle] };
    const outer = Math.max(...obstacle.radiusProfile.map(point => point.radius));
    for (let turn = 0; turn < 12; turn++) {
      const yaw = turn / 12 * Math.PI * 2;
      let state = createMovementState({ position: { x: rock.x + Math.sin(yaw) * (outer + 1), y: baseY, z: rock.z + Math.cos(yaw) * (outer + 1) } });
      state = stepMovement(state, { forward: 1, cameraYaw: yaw }, world, 1000, 1000).state;
      let time = 1000;
      for (let frame = 0; frame < 300 && !(state.grounded && state.position.y >= baseY + obstacle.height - 0.00001); frame++) {
        const inner = Math.hypot(state.position.x - rock.x, state.position.z - rock.z) - WILDS_MOVEMENT.radius;
        const actual = actualRadiusBetween(state.position.y + .00001, state.position.y + WILDS_MOVEMENT.height);
        assert.ok(actual === 0 || inner >= actual - 0.00001, `rock ${index}, turn ${turn}, height ${state.position.y}: body ${inner} penetrates mesh ${actual}`);
        const delta = Math.min(1000 / 120, state.mantle ? state.mantle.startedAt + state.mantle.durationMs - time : Infinity);
        time += delta;
        state = stepMovement(state, { forward: 1, climb: true, cameraYaw: yaw }, world, delta, time).state;
      }
      assert.equal(state.grounded, true);
      assert.ok(Math.abs(state.position.y - baseY - obstacle.height) < 0.00001);
      assert.ok(Math.hypot(state.position.x - rock.x, state.position.z - rock.z) < obstacle.radius, `rock ${index}, turn ${turn}: settled root must stay inside the actual flat summit`);
    }
  }
});

test('Wilds trail stone shoulders shade continuously across their visible triangle boundaries', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  for (const [index, rock] of WILDS_WORLD.rocks.entries()) {
    const mesh = meadowRocks([rock], () => ({ height: 0 })), normals = new Map();
    let widest = 0;
    for (let v = 0; v < mesh.positions.length; v += 3) {
      const p = Array.from(mesh.positions.slice(v, v + 3)), key = p.map(n => n.toFixed(5)).join(','), n = Array.from(mesh.normals.slice(v, v + 3));
      if (p[1] < .1 || n[1] > .999) continue;
      if (normals.has(key)) widest = Math.max(widest, Math.hypot(...n.map((value, i) => value - normals.get(key)[i])));
      else normals.set(key, n);
    }
    assert.ok(widest < .001, `trail rock ${index} has normal jump ${widest.toFixed(3)}`);
    assert.ok(normals.size > 20);
  }
});

test('climbable trail boulders have compact support caps without exceeding the authored mantle reach', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  for (const [index, rock] of WILDS_WORLD.rocks.entries()) {
    if (!rock.climbable) continue;
    const obstacle = { ...rock, ...rockCollider(rock, index), baseY: 0 }, outer = Math.max(...obstacle.radiusProfile.map(point => point.radius));
    const world = { surfaceAt: () => ({ height: 0, normal: { x: 0, y: 1, z: 0 } }), obstacles: [obstacle] };
    let state = createMovementState({ position: { x: rock.x, y: 0, z: rock.z + outer + 1 } }), time = 1000;
    state = stepMovement(state, { forward: 1, cameraYaw: 0 }, world, 1000, time).state;
    for (let frame = 0; frame < 300 && !state.mantle; frame++) { time += 1000 / 120; state = stepMovement(state, { forward: 1, climb: true, cameraYaw: 0 }, world, 1000 / 120, time).state; }
    assert.ok(state.mantleAdvance > .8 && state.mantleAdvance <= 1.1819, `rock ${index} mantle reaches ${state.mantleAdvance}`);
    if (rock.seat) continue;
    const mesh = meadowRocks([rock], () => ({ height: 0 }));
    let capRadius = 0;
    for (let v = 0; v < mesh.positions.length; v += 3) if (mesh.positions[v + 1] >= obstacle.height - .00001) capRadius = Math.max(capRadius, Math.hypot(mesh.positions[v] - rock.x, mesh.positions[v + 2] - rock.z));
    assert.ok(capRadius * 2 < obstacle.height * 1.2, `rock ${index} cap is ${capRadius * 2} m across for ${obstacle.height} m height`);
  }
});
