import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';
import { Engine } from '@babylonjs/core/Engines/engine.js';

const SIZE = 256;
const GRADIENTS = Array.from({ length: 256 }, (_, i) => { const a = i / 256 * Math.PI * 2 + .37; return [Math.cos(a), Math.sin(a)]; });
const hash = (ix, iy, seed) => {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return (h ^ (h >>> 16)) & 255;
};

function periodic(x, y, period, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, wrap = value => ((value % period) + period) % period;
  const g = (cx, cy, dx, dy) => { const [gx, gy] = GRADIENTS[hash(wrap(cx), wrap(cy), seed)]; return gx * dx + gy * dy; };
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const top = g(ix, iy, fx, fy) + (g(ix + 1, iy, fx - 1, fy) - g(ix, iy, fx, fy)) * u;
  const bottom = g(ix, iy + 1, fx, fy - 1) + (g(ix + 1, iy + 1, fx - 1, fy - 1) - g(ix, iy + 1, fx, fy - 1)) * u;
  return (top + (bottom - top) * v) * 1.42;
}

function periodicFbm(x, y, period, octaves, seed) {
  let sum = 0, amplitude = .5, scale = 1, norm = 0;
  for (let i = 0; i < octaves; i++) { sum += periodic(x * scale, y * scale, period * scale, seed + i * 13) * amplitude; norm += amplitude; amplitude *= .5; scale *= 2; }
  return sum / norm;
}

export function noisePixels(size = SIZE) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, i = (y * size + x) * 4;
    data[i] = Math.max(0, Math.min(255, (periodicFbm(u * 8, v * 8, 8, 5, 11) * .5 + .5) * 255));
    data[i + 1] = Math.max(0, Math.min(255, (periodicFbm(u * 16, v * 16, 16, 4, 23) * .5 + .5) * 255));
    data[i + 2] = Math.max(0, Math.min(255, (1 - Math.abs(periodicFbm(u * 6, v * 6, 6, 4, 37))) ** 3 * 255));
    data[i + 3] = Math.max(0, Math.min(255, (periodic(u * 32, v * 32, 32, 41) * .5 + .5) * 255));
  }
  return data;
}

const cache = new WeakMap();
export function noiseTexture(scene) {
  if (!cache.has(scene)) {
    const texture = RawTexture.CreateRGBATexture(noisePixels(), SIZE, SIZE, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE, Engine.TEXTURETYPE_UNSIGNED_BYTE);
    texture.wrapU = texture.wrapV = Texture.WRAP_ADDRESSMODE;
    texture.name = 'wilds-noise';
    cache.set(scene, texture);
  }
  return cache.get(scene);
}
