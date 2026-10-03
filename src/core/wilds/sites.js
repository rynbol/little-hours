import { VALLEY, valleyHeight, bridgeDeck } from './valley.js';
import { random } from './noise.js';

const along = (x, z, yaw) => s => ({ x: x + Math.sin(yaw) * s, z: z + Math.cos(yaw) * s });
const grounded = (x, z, extra = {}) => ({ x, z, y: valleyHeight(x, z), ...extra });

function bridgeSite() {
  const { x, z, yaw, length, width } = VALLEY.bridge, deck = bridgeDeck(), at = along(x, z, yaw), gap = 2.2;
  return {
    x, z, yaw, deck, width, length, gap,
    spans: [[-length / 2 - .6, -gap], [gap, length / 2 + .6]],
    piers: [-gap - .35, gap + .35].map(s => ({ ...at(s), s, floor: valleyHeight(at(s).x, at(s).z) })),
    log: { from: -gap - .8, to: gap + .8, top: deck + .3, radius: .29 },
    rubble: [[-1.1, .6, .55], [.4, -.7, .62], [1.3, .5, .42], [-.2, .9, .36]].map(([s, side, size]) => {
      const p = at(s), right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
      return grounded(p.x + right.x * side, p.z + right.z * side, { size });
    }),
  };
}

function fallenTreeSite() {
  const { x, z, yaw, length } = VALLEY.fallenTree, radius = 1.6, bottom = 3.5, centre = bottom + radius;
  return { x, z, yaw, length, radius, wall: .36, bottom, centre, floor: centre - .95, ceiling: centre + radius - .36 };
}

function ringSite() {
  const { x, z, radius, stones } = VALLEY.ring, rand = random(907);
  return {
    ...grounded(x, z), radius,
    stones: Array.from({ length: stones }, (_, k) => {
      const angle = Math.PI + (k + 1) * Math.PI * 2 / (stones + 1) + (rand() - .5) * .12, r = radius + (rand() - .5) * .8;
      return grounded(x + Math.sin(angle) * r, z + Math.cos(angle) * r, {
        angle, yaw: angle + Math.PI, height: 3.4 + rand() * 1.1, width: 1.2 + rand() * .35, depth: .74 + rand() * .2,
        lean: (rand() - .5) * .1, tilt: (rand() - .5) * .07, seed: k,
      });
    }),
  };
}

function oakSite() {
  const { x, z } = VALLEY.oak, swingYaw = -1.95, reach = 3.4;
  return {
    ...grounded(x, z), trunk: 1.15, height: 15,
    swing: grounded(x + Math.sin(swingYaw) * reach, z + Math.cos(swingYaw) * reach, { yaw: swingYaw + Math.PI / 2, branch: 4.6, seat: .55 }),
  };
}

function campSite() {
  const fire = VALLEY.campfires[0];
  return {
    fire: grounded(fire.x, fire.z),
    bedroll: grounded(-8.6, -169.4, { yaw: .9 }),
    lantern: grounded(-6.8, -163.2),
    seat: grounded(-.4, -168.6, { yaw: -.7, length: 2.4 }),
    trophy: grounded(-10.2, -166.6, { yaw: 1.2 }),
    pack: grounded(-7.6, -167.4, { yaw: .3 }),
  };
}

let cache = null;
export function sites() {
  cache ??= {
    bridge: bridgeSite(),
    fallenTree: fallenTreeSite(),
    ring: ringSite(),
    oak: oakSite(),
    shrine: grounded(VALLEY.shrine.x, VALLEY.shrine.z, { yaw: -1.7 }),
    camp: campSite(),
    campfires: VALLEY.campfires.map(fire => grounded(fire.x, fire.z, { id: fire.id })),
  };
  return cache;
}

const beam = (from, to, y0, y1, half, extra = {}) => ({ ax: from.x, az: from.z, bx: to.x, bz: to.z, y0, y1, half, crown: 0, ceiling: Infinity, ...extra });

export function walkDecks({ bridge, fallenTree } = sites()) {
  const onBridge = along(bridge.x, bridge.z, bridge.yaw), onTree = along(fallenTree.x, fallenTree.z, fallenTree.yaw), reach = fallenTree.length / 2 + .4;
  return [
    ...bridge.spans.map(([from, to]) => beam(onBridge(from), onBridge(to), bridge.deck, bridge.deck, bridge.width / 2 - .25)),
    beam(onBridge(bridge.log.from), onBridge(bridge.log.to), bridge.log.top, bridge.log.top, .3, { crown: .07 }),
    beam(onTree(-reach), onTree(reach), fallenTree.floor, fallenTree.floor, .75, { ceiling: fallenTree.ceiling }),
  ];
}

export function siteColliders({ bridge, fallenTree, ring, oak, shrine, camp, campfires } = sites()) {
  const list = [], add = (x, z, r, bottom, top) => list.push({ x, z, r, bottom, top });
  for (const stone of ring.stones) add(stone.x, stone.z, .8, stone.y - 1, stone.y + stone.height);
  add(oak.x, oak.z, oak.trunk + .1, oak.y - 1, oak.y + oak.height);
  for (const stone of bridge.rubble) add(stone.x, stone.z, stone.size * .8, stone.y - 1, stone.y + stone.size * .8);
  add(shrine.x, shrine.z, .85, shrine.y - 1, shrine.y + 1.9);
  for (const fire of campfires) add(fire.x, fire.z, .62, fire.y - 1, fire.y + 1.6);
  add(camp.lantern.x, camp.lantern.z, .12, camp.lantern.y - 1, camp.lantern.y + 1.6);
  add(camp.trophy.x, camp.trophy.z, .4, camp.trophy.y - 1, camp.trophy.y + 1.4);
  const seat = along(camp.seat.x, camp.seat.z, camp.seat.yaw);
  for (const s of [-.8, 0, .8]) add(seat(s).x, seat(s).z, .26, camp.seat.y - 1, camp.seat.y + .45);
  const onBridge = along(bridge.x, bridge.z, bridge.yaw), right = { x: Math.cos(bridge.yaw), z: -Math.sin(bridge.yaw) };
  for (const [from, to] of bridge.spans) for (let s = from + .1; s <= to; s += .4) for (const side of [-1, 1]) {
    const p = onBridge(s), offset = (bridge.width / 2 - .05) * side;
    add(p.x + right.x * offset, p.z + right.z * offset, .2, bridge.deck - 2.4, bridge.deck + .55);
  }
  const onTree = along(fallenTree.x, fallenTree.z, fallenTree.yaw), across = { x: Math.cos(fallenTree.yaw), z: -Math.sin(fallenTree.yaw) };
  for (let s = -fallenTree.length / 2; s <= fallenTree.length / 2; s += .45) for (const side of [-1, 1]) {
    const p = onTree(s), offset = (fallenTree.radius - .3) * side;
    add(p.x + across.x * offset, p.z + across.z * offset, .38, fallenTree.bottom - .4, fallenTree.centre + fallenTree.radius);
  }
  return list;
}
