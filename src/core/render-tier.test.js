import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pixelRatioCeiling } from './render-tier.js';

const GPU = 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)';
const SWIFTSHADER = 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)';

test('a GPU renders at the display density, capped at 2x, and Save energy at 1x', () => {
  const ceilings = [['auto', 3], ['auto', 2], ['auto', 1], ['high', 2], ['battery', 2], ['battery', 0.5]].map(([quality, devicePixelRatio]) => pixelRatioCeiling({ quality, devicePixelRatio, renderer: GPU }));
  assert.deepEqual(ceilings, [2, 2, 1, 2, 1, 0.5]);
});

test('a software renderer starts Adaptive and Save energy at 0.75x, where every pixel costs CPU time, and leaves Crisp at the display density', () => {
  const ceilings = [['auto', 2], ['auto', 1], ['battery', 2], ['high', 2], ['auto', 0.5]].map(([quality, devicePixelRatio]) => pixelRatioCeiling({ quality, devicePixelRatio, renderer: SWIFTSHADER }));
  const others = ['llvmpipe (LLVM 15.0.7, 256 bits)', 'ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)'].map(renderer => pixelRatioCeiling({ quality: 'auto', devicePixelRatio: 2, renderer }));
  assert.deepEqual(ceilings, [0.75, 0.75, 0.75, 2, 0.5]);
  assert.deepEqual(others, [0.75, 0.75]);
});
