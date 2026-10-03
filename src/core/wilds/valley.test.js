import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGround } from './ground.js';
import { CLIMB, GLIDE, MOVE, SWIM, createPlayer, floorAt, pressPlayer, stepPlayer } from './player.js';
import { DECKS, GRID, HERB_SPOTS, SECRET_SPOTS, TRAIL, VALLEY, WALLS, WEST_TRAIL, lakeEdge, valleyHeight, waterAt } from './valley.js';

const grid = createGround(valleyHeight, GRID), ground = (x, z) => grid.at(x, z);
const world = { ground, decks: DECKS, water: waterAt, bounds: VALLEY.bounds, updrafts: VALLEY.updrafts, solids: WALLS, targets: [], lock: null };
const DT = 1 / 120;
const idle = { moveX: 0, moveZ: 0, sprint: false, attackHeld: false, view: 0 };

function walk(path, every = 0.5) {
  const out = [];
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1], [bx, bz] = path[i], steps = Math.ceil(Math.hypot(bx - ax, bz - az) / every);
    for (let k = i === 1 ? 0 : 1; k <= steps; k++) out.push([ax + (bx - ax) * k / steps, az + (bz - az) * k / steps]);
  }
  return out;
}

function run(player, input, seconds, until = () => false) {
  for (let t = 0; t < seconds; t += DT) { stepPlayer(player, input, DT, world); if (until(player)) return true; }
  return false;
}

test('both trails from the camp to the stone ring stay walkable and above swimming depth all the way', () => {
  for (const path of [TRAIL, WEST_TRAIL]) {
    let y = floorAt(world, ...path[0]), steepest = 0, deepest = 0;
    const points = walk(path);
    for (let i = 1; i < points.length; i++) {
      const [x, z] = points[i], floor = floorAt(world, x, z, y + 0.4);
      steepest = Math.max(steepest, Math.abs(floor - y) / Math.hypot(x - points[i - 1][0], z - points[i - 1][1]));
      deepest = Math.max(deepest, waterAt(x, z) - floor);
      y = floor;
    }
    assert.ok(steepest < CLIMB.steep * 0.88, `steepest ${steepest.toFixed(2)}`);
    assert.ok(deepest < SWIM.depth - 0.2, `deepest ${deepest.toFixed(2)}`);
  }
});

test('a glide from the great oak lands on the chest pillar, which no swimmer can climb', () => {
  const { oak, pillar } = VALLEY;
  const player = createPlayer({ x: oak.x, z: oak.z, ground });
  assert.ok(Math.abs(player.y - oak.fork) < 0.2);
  const toward = { ...idle };
  const aim = p => { const dx = pillar.x - p.x, dz = pillar.z - p.z, length = Math.hypot(dx, dz) || 1; toward.moveX = dx / length; toward.moveZ = dz / length; return length; };
  aim(player);
  assert.ok(run(player, toward, 3, p => !p.grounded));
  assert.ok(run(player, toward, 1, p => p.y < oak.fork - GLIDE.height - 0.3));
  pressPlayer(player, 'jump');
  assert.ok(run(player, toward, 1, p => p.state === 'glide'));
  assert.ok(run(player, toward, 30, p => aim(p) < 0.8 || p.grounded));
  assert.ok(player.y > pillar.top + 0.5);
  pressPlayer(player, 'jump');
  run(player, idle, 3, p => p.grounded);
  run(player, idle, 1);
  assert.ok(Math.hypot(player.x - pillar.x, player.z - pillar.z) < pillar.radius, `landed ${player.x.toFixed(1)}, ${player.z.toFixed(1)}`);
  assert.ok(Math.abs(player.y - pillar.top) < 0.3);
  for (let a = 0; a < Math.PI * 2; a += 0.2) {
    const x = pillar.x + Math.sin(a) * (pillar.radius + 1.2), z = pillar.z + Math.cos(a) * (pillar.radius + 1.2);
    assert.ok(waterAt(x, z) - ground(x, z) > SWIM.depth + 0.3, `shallow at ${a.toFixed(1)}`);
  }
  for (let x = oak.x - 16; x <= oak.x + 16; x += 0.5) for (let z = oak.z - 16; z <= oak.z + 16; z += 0.5) {
    if (Math.hypot(x - oak.x, z - oak.z) < oak.trunk + 0.6) continue;
    const reach = (ground(x, z) - pillar.top) * GLIDE.speed / GLIDE.sink;
    assert.ok(reach < Math.hypot(pillar.x - x, pillar.z - z) - pillar.radius, `the knoll at ${x}, ${z} reaches the pillar`);
  }
});

test('the vista crag above the camp is a real climb, and a glide off its valley side rides the updraft', () => {
  const [crag] = VALLEY.rocks, draft = VALLEY.updrafts[0];
  assert.ok(crag.top - ground(crag.x, crag.z + crag.radius + 3) > 8, 'climb from the camp side');
  const player = createPlayer({ x: crag.x, z: crag.z, ground });
  assert.ok(Math.abs(player.y - crag.top) < 0.4);
  const toward = { ...idle };
  const aim = p => { const dx = draft.x - p.x, dz = draft.z - p.z, length = Math.hypot(dx, dz) || 1; toward.moveX = dx / length; toward.moveZ = dz / length; return length; };
  aim(player);
  assert.ok(run(player, toward, 3, p => !p.grounded));
  assert.ok(run(player, toward, 1, p => p.y < crag.top - GLIDE.height - 0.3));
  pressPlayer(player, 'jump');
  assert.ok(run(player, toward, 1, p => p.state === 'glide'));
  assert.ok(run(player, toward, 12, p => aim(p) < draft.radius * 0.5 || p.grounded));
  assert.equal(player.state, 'glide');
  const entered = player.y;
  run(player, toward, 3, p => { aim(p); return p.grounded; });
  assert.ok(player.y > entered + 1.5, `rose ${(player.y - entered).toFixed(2)}`);
});

test('you can wade across the falls pool, walk the shelf behind the lower fall and step into the recess', () => {
  const { falls } = VALLEY, player = createPlayer({ x: falls.pool.x + 3, z: falls.z + 0.4, ground });
  let swam = false;
  run(player, { ...idle, moveX: -1 }, 7, p => { swam ||= p.state === 'swim'; return p.x < falls.recess.x + 1.2; });
  assert.equal(swam, false);
  assert.ok(player.x < falls.recess.x + 1.2, `stopped at ${player.x.toFixed(2)}`);
  assert.ok(Math.abs(player.y - falls.shelf) < 0.2);
  assert.ok(ground(falls.recess.x + 1, falls.z + falls.recess.half + 1.2) > falls.shelf + 8);
});

test('the lake has a deep centre, and the islet is a short swim from the nearest dry shore', () => {
  const { lake, islet } = VALLEY;
  const middle = [(lake.ax + lake.bx) / 2 - 12, (lake.az + lake.bz) / 2];
  assert.ok(waterAt(...middle) - ground(...middle) > 4);
  let nearest = Infinity;
  for (let a = 0; a < Math.PI * 2; a += 0.05) for (let r = islet.radius; r < 80; r += 0.5) {
    const x = islet.x + Math.sin(a) * r, z = islet.z + Math.cos(a) * r;
    if (waterAt(x, z) - ground(x, z) < SWIM.shallow) { if (r > islet.radius + 2) nearest = Math.min(nearest, r - islet.radius); break; }
  }
  assert.ok(nearest > 12 && nearest < 30, `nearest shore ${nearest.toFixed(1)} m`);
  assert.ok(lakeEdge(islet.x, islet.z) < -10);
});

test('every secret rests on solid ground or a deck, and the deck ends meet the ground within a step', () => {
  for (const spot of SECRET_SPOTS) {
    const floor = floorAt(world, spot.x, spot.z, spot.deck ? 8 : Infinity);
    assert.ok(waterAt(spot.x, spot.z) < floor + 0.05, spot.id);
    assert.ok(Number.isFinite(floor), spot.id);
  }
  assert.ok(floorAt(world, ...[SECRET_SPOTS[0].x, SECRET_SPOTS[0].z], 6) > ground(SECRET_SPOTS[0].x, SECRET_SPOTS[0].z) + 0.2);
  const ends = [[DECKS[0].ax, DECKS[0].az, DECKS[0].ay], [DECKS[2].bx, DECKS[2].bz, DECKS[2].by], [DECKS[4].ax, DECKS[4].az, DECKS[4].ay], [DECKS[4].bx, DECKS[4].bz, DECKS[4].by]];
  for (const [x, z, y] of ends) assert.ok(y - ground(x, z) >= -0.05 && y - ground(x, z) < MOVE.snap, `${x}, ${z}: ${(y - ground(x, z)).toFixed(2)}`);
  assert.ok(HERB_SPOTS.length >= 20);
});
