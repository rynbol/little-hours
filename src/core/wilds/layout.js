import { smooth } from '../world-terrain.js';

export const HILL = Object.freeze({
  spawn: Object.freeze({ x: 0, z: 4.2, facing: Math.PI }),
  dummy: Object.freeze({ x: 0.4, z: -3.6 }),
  posts: Object.freeze([[-5.6, -11.5], [4.8, -15], [-2.6, -21.5], [7.2, -25.5], [-8.4, -29], [1.8, -33]].map(Object.freeze)),
  mesa: Object.freeze({ x: -22, z: -9, halfX: 8.6, halfZ: 11.5, corner: 3.5, step: 4.6, face: 2, ledge: 2.2 }),
  updrafts: Object.freeze([Object.freeze({ x: -5, z: -15, radius: 5.5, lift: 1.6 })]),
  bounds: Object.freeze({ x: 0, z: -14, radius: 34 }),
});

export function insideMesa(x, z, mesa = HILL.mesa) {
  const qx = Math.abs(x - mesa.x) - (mesa.halfX - mesa.corner), qz = Math.abs(z - mesa.z) - (mesa.halfZ - mesa.corner);
  return mesa.corner - Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) - Math.min(Math.max(qx, qz), 0);
}

export function mesaRise(x, z, mesa = HILL.mesa) {
  const depth = insideMesa(x, z, mesa), upper = mesa.face + mesa.ledge;
  return mesa.step * (smooth(0, mesa.face, depth) + smooth(upper, upper + mesa.face, depth));
}

export const shapeHill = heightAt => (x, z) => heightAt(x, z) + mesaRise(x, z);
