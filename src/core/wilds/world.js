import { waterAt } from './valley.js';

const CELL = 8, key = (cx, cz) => (cx + 4096) * 8192 + cz + 4096;

function deckHeight(deck, x, z) {
  const dx = deck.bx - deck.ax, dz = deck.bz - deck.az, length = Math.hypot(dx, dz);
  const t = ((x - deck.ax) * dx + (z - deck.az) * dz) / (length * length);
  if (t < 0 || t > 1) return null;
  const side = Math.abs((x - deck.ax) * dz - (z - deck.az) * dx) / length;
  if (side > deck.half) return null;
  return deck.y0 + (deck.y1 - deck.y0) * t - deck.crown * (side / deck.half) ** 2;
}

export function createWalkWorld({ heightAt, decks = [], colliders = [], bounds = null, water = waterAt }) {
  const cells = new Map();
  for (const collider of colliders) {
    const reach = collider.r;
    for (let cx = Math.floor((collider.x - reach) / CELL); cx <= Math.floor((collider.x + reach) / CELL); cx++)
      for (let cz = Math.floor((collider.z - reach) / CELL); cz <= Math.floor((collider.z + reach) / CELL); cz++) {
        const id = key(cx, cz);
        if (!cells.has(id)) cells.set(id, []);
        cells.get(id).push(collider);
      }
  }
  const found = [], heights = [], seen = new Set();
  return {
    bounds, colliders,
    ground: (x, z) => heightAt(x, z) ?? 0,
    water,
    decks(x, z) {
      heights.length = 0;
      for (const deck of decks) { const y = deckHeight(deck, x, z); if (y !== null) heights.push(y); }
      return heights;
    },
    ceiling(x, z, y) {
      let lowest = Infinity;
      for (const deck of decks) if (deck.ceiling < lowest && deck.ceiling > y) { const floor = deckHeight(deck, x, z); if (floor !== null && floor <= y + .05) lowest = deck.ceiling; }
      return lowest;
    },
    blockers(x, z, reach) {
      found.length = 0; seen.clear();
      for (let cx = Math.floor((x - reach) / CELL); cx <= Math.floor((x + reach) / CELL); cx++)
        for (let cz = Math.floor((z - reach) / CELL); cz <= Math.floor((z + reach) / CELL); cz++)
          for (const collider of cells.get(key(cx, cz)) ?? []) if (!seen.has(collider)) { seen.add(collider); found.push(collider); }
      return found;
    },
  };
}
