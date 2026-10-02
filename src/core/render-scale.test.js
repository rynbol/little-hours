import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderRatioCeiling } from './render-scale.js';

test('a GPU renders at the display density, up to 2x', () => {
  assert.equal(renderRatioCeiling(1, 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)'), 1);
  assert.equal(renderRatioCeiling(3, 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)'), 2);
  assert.equal(renderRatioCeiling(undefined, ''), 1);
});

test('a software renderer draws the full-screen room at a reduced density', () => {
  assert.equal(renderRatioCeiling(1, 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)'), 0.6);
  assert.equal(renderRatioCeiling(2, 'llvmpipe (LLVM 15.0.7, 256 bits)'), 0.6);
  assert.equal(renderRatioCeiling(2, 'Microsoft Basic Render Driver (Software Adapter)'), 0.6);
});
