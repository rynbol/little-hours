import test from 'node:test';
import assert from 'node:assert/strict';
import { ColorCurves } from '@babylonjs/core/Materials/colorCurves.js';
import { seatedDim, deskLamp, LAMP_AT, gradeFocus } from './room-lighting.js';

test('seated at dusk or in rain, the room ambient and key light dim so the lamp and candles lead', () => {
  assert.equal(seatedDim('day', 1), 1);
  assert.equal(seatedDim('dusk', 0), 1);
  assert.ok(seatedDim('dusk', 1) <= 0.55);
  assert.ok(seatedDim('rain', 1) <= 0.7);
  assert.ok(seatedDim('dusk', 0.5) < 1 && seatedDim('dusk', 0.5) > seatedDim('dusk', 1));
});

test('seated, the desk lamp tucks under its shade and throws a tight warm pool at dusk and in rain', () => {
  assert.deepEqual(deskLamp('dusk', 0).offset, LAMP_AT.room);
  assert.deepEqual(deskLamp('rain', 1).offset, LAMP_AT.seated);
  for (const theme of ['dusk', 'rain']) {
    const room = deskLamp(theme, 0), seated = deskLamp(theme, 1);
    assert.ok(seated.range <= 2 && seated.range < room.range, `${theme} pool reaches ${seated.range} m`);
    assert.ok(seated.intensity >= 2, `${theme} lamp shines at ${seated.intensity}`);
  }
  assert.ok(deskLamp('day', 1).intensity < 0.5, 'the day lamp stays a gentle accent');
  assert.equal(deskLamp('dusk', 0).range, 3.4, 'the dollhouse keeps its lamplight');
});

function curveAt(curves, luma) {
  const uniforms = {};
  ColorCurves.Bind(curves, { setFloat4: (name, ...value) => { uniforms[name] = value; } });
  const lift = Math.min(1, Math.max(0, luma * 3 - 1.5)), drop = Math.min(1, Math.max(0, 1.5 - luma * 3));
  return uniforms.vCameraColorCurveNeutral.map((neutral, i) => neutral + lift * uniforms.vCameraColorCurvePositive[i] - drop * uniforms.vCameraColorCurveNegative[i]);
}

test('the Focus grade lifts shade, softens highlights and warms toward gold, and is neutral in the dollhouse', () => {
  const room = gradeFocus(new ColorCurves(), 0);
  for (const luma of [0.1, 0.5, 0.9]) assert.deepEqual(curveAt(room, luma).map(v => +v.toFixed(6)), [1, 1, 1, 1]);
  const seated = gradeFocus(new ColorCurves(), 1);
  const [shadeR, shadeG, shadeB] = curveAt(seated, 0.1), [lightR] = curveAt(seated, 0.9), [, , , midSaturation] = curveAt(seated, 0.5);
  assert.ok(shadeR > 1.12, `shade lifts ${shadeR}`);
  assert.ok(lightR < 0.95, `highlights ease to ${lightR}`);
  assert.ok(shadeB < shadeG && shadeG > shadeR * 0.97, `tint ${shadeR} ${shadeG} ${shadeB} leans gold, not red`);
  assert.ok(midSaturation > 1.1, `midtones saturate ${midSaturation}`);
});
