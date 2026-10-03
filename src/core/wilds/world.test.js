import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valleyHeight } from './valley.js';
import { sites, walkDecks, siteColliders } from './sites.js';
import { createWalkWorld } from './world.js';
import { createBody, stepBody } from './motion.js';

const world = createWalkWorld({ heightAt: valleyHeight, decks: walkDecks(), colliders: siteColliders() });
const heading = yaw => ({ x: Math.sin(yaw), z: Math.cos(yaw) });
const startOn = (site, s, side = 0) => {
  const x = site.x + Math.sin(site.yaw) * s + Math.cos(site.yaw) * side, z = site.z + Math.cos(site.yaw) * s - Math.sin(site.yaw) * side;
  return createBody({ x, z, y: valleyHeight(x, z), yaw: site.yaw });
};
const walk = (body, input, seconds, each = () => {}) => { for (let t = 0; t < seconds; t += 1 / 60) { body = stepBody(body, input, world, 1 / 60); each(body); } return body; };

test('the broken bridge is crossed on the log without dropping into the stream', () => {
  const { bridge } = sites();
  let lowest = Infinity, onLog = false;
  const body = walk(startOn(bridge, -7.5), heading(bridge.yaw), 5, b => {
    const s = (b.x - bridge.x) * Math.sin(bridge.yaw) + (b.z - bridge.z) * Math.cos(bridge.yaw);
    if (s > -5 && s < 5) lowest = Math.min(lowest, b.y);
    if (Math.abs(s) < 1) onLog ||= b.y > bridge.deck + .2;
  });
  assert.ok((body.x - bridge.x) * Math.sin(bridge.yaw) + (body.z - bridge.z) * Math.cos(bridge.yaw) > 7, 'reached the far bank');
  assert.ok(lowest > bridge.deck - .05, `lowest ${lowest}`);
  assert.ok(onLog, 'walked over the log');
});

test('stepping off the side of the log drops you into the stream to wade out', () => {
  const { bridge } = sites();
  let body = walk(startOn(bridge, -7.5), heading(bridge.yaw), 1.6);
  body = walk(body, heading(bridge.yaw + Math.PI / 2), 1.2);
  body = walk(body, { x: 0, z: 0 }, 1.5);
  assert.ok(body.y < bridge.deck - 1, `y ${body.y}`);
  assert.ok(body.wading > .2, `wading ${body.wading}`);
});

test('the hollow fallen tree is a tunnel over the stream', () => {
  const { fallenTree: tree } = sites();
  let highest = -Infinity, lowest = Infinity;
  const body = walk(startOn(tree, -11), heading(tree.yaw), 6, b => {
    const s = (b.x - tree.x) * Math.sin(tree.yaw) + (b.z - tree.z) * Math.cos(tree.yaw);
    if (Math.abs(s) < 3) { highest = Math.max(highest, b.y); lowest = Math.min(lowest, b.y); }
  });
  assert.ok((body.x - tree.x) * Math.sin(tree.yaw) + (body.z - tree.z) * Math.cos(tree.yaw) > 9.5, 'came out the far end');
  assert.ok(Math.abs(lowest - tree.floor) < .05 && Math.abs(highest - tree.floor) < .05, `${lowest}..${highest}`);
});

test('the standing stones of the ring stop you walking through them', () => {
  const stone = sites().ring.stones[3], from = { x: stone.x + 4 * Math.sin(stone.angle), z: stone.z + 4 * Math.cos(stone.angle) };
  const body = walk(createBody({ ...from, y: valleyHeight(from.x, from.z) }), { x: -Math.sin(stone.angle), z: -Math.cos(stone.angle) }, 3);
  assert.ok(Math.hypot(body.x - stone.x, body.z - stone.z) > .8 + .3, 'kept outside the stone');
});

test('the ring has nine stones on dry ground with an opening towards the trail', () => {
  const { ring } = sites();
  assert.equal(ring.stones.length, 9);
  const south = ring.stones.filter(stone => Math.cos(stone.angle) < -.85);
  assert.equal(south.length, 0);
  for (const stone of ring.stones) assert.ok(Math.abs(stone.y - ring.y) < 1.2, `stone ${stone.seed} at ${stone.y}`);
});
