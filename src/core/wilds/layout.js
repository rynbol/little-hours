import { smooth } from '../world-terrain.js';

const STONES = 9;
const ring = Object.freeze({ x: 6, z: -36, radius: 13.5, facing: 0, stones: 11 });
const mesa = Object.freeze({ x: -22, z: -9, halfX: 8.6, halfZ: 11.5, corner: 3.5, step: 4.6, face: 2, ledge: 2.2 });

export const HILL = Object.freeze({
  spawn: Object.freeze({ x: 0, z: 4.2, facing: Math.PI }),
  dummy: Object.freeze({ x: 2.6, z: -3.6 }),
  posts: Object.freeze([[-5.6, -11.5], [4.8, -13], [9.4, -7.5], [-2.4, -17.5], [12.5, -14]].map(Object.freeze)),
  mesa,
  updrafts: Object.freeze([Object.freeze({ x: -5, z: -15, radius: 5.5, lift: 1.6 })]),
  ring: Object.freeze({ ...ring, places: Object.freeze(Array.from({ length: STONES }, (_, i) => { const a = (i + 0.5) / STONES * Math.PI * 2; return Object.freeze([ring.x + Math.sin(a) * ring.stones, ring.z + Math.cos(a) * ring.stones]); })) }),
  stone: Object.freeze({ radius: 0.78, height: 3.3 }),
  campfires: Object.freeze([Object.freeze({ id: 'camp', x: -3.2, z: 6.4 }), Object.freeze({ id: 'stones', x: -6.5, z: -25 })]),
  lookout: Object.freeze({ x: -20.2, z: -13.4 }),
  bounds: Object.freeze({ x: 0, z: -18, radius: 46 }),
  spots: Object.freeze([[-4.5, -1.5], [5.5, 1.8], [-8.5, -6], [8, -10], [-2, -20]].map(([x, z]) => Object.freeze({ x, z }))),
});

export function insideMesa(x, z, shape = mesa) {
  const qx = Math.abs(x - shape.x) - (shape.halfX - shape.corner), qz = Math.abs(z - shape.z) - (shape.halfZ - shape.corner);
  return shape.corner - Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) - Math.min(Math.max(qx, qz), 0);
}

export function mesaRise(x, z, shape = mesa) {
  const depth = insideMesa(x, z, shape), upper = shape.face + shape.ledge;
  return shape.step * (smooth(0, shape.face, depth) + smooth(upper, upper + shape.face, depth));
}

export function shapeHill(heightAt) {
  const floor = heightAt(ring.x, ring.z);
  return (x, z) => {
    const raw = heightAt(x, z), blend = smooth(ring.radius + 9, ring.radius + 1.5, Math.hypot(x - ring.x, z - ring.z));
    return raw + (floor - raw) * blend + mesaRise(x, z);
  };
}
