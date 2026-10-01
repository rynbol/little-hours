import test from 'node:test';
import assert from 'node:assert/strict';
import { ColorCurves } from '@babylonjs/core/Materials/colorCurves.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { ROOM_LIGHTS, seatedDim, windowSun, deskLamp, LAMP_AT, gradeFocus, roomBloom, bloomEmission } from './room-lighting.js';

test('seated at dusk or in rain, the room ambient dims so the lamp and candles lead', () => {
  assert.ok(seatedDim('day', 1) >= 0.6 && seatedDim('day', 1) < 0.8, 'by day the seat keeps most of its ambient light');
  assert.equal(seatedDim('dusk', 0), 1);
  assert.ok(seatedDim('dusk', 1) <= 0.55);
  assert.ok(seatedDim('rain', 1) <= 0.7);
  assert.ok(seatedDim('dusk', 0.5) < 1 && seatedDim('dusk', 0.5) > seatedDim('dusk', 1));
});

test('seated by day, a cool sun through the window outweighs the ambient so the desk reads window-lit, and dusk and rain keep a gentler cool wash', () => {
  const color = new Color3(), warmth = c => c.r - c.b;
  assert.equal(windowSun('day', 0, color), ROOM_LIGHTS.day.sun);
  assert.equal(color.toHexString().toLowerCase(), ROOM_LIGHTS.day.sunColor, 'the dollhouse keeps its sun');
  const daySun = windowSun('day', 1, color), ambient = ROOM_LIGHTS.day.ambient * seatedDim('day', 1);
  assert.ok(daySun >= 2.4 && daySun / ambient >= 3.5, `day sun ${daySun} against ambient ${ambient.toFixed(2)}`);
  assert.ok(color.b > color.r && warmth(color) < warmth(Color3.FromHexString(ROOM_LIGHTS.day.sunColor)), `the seated day sun is cool, ${color.toHexString()}`);
  for (const theme of ['dusk', 'rain']) {
    const sun = windowSun(theme, 1, color);
    assert.ok(sun > ROOM_LIGHTS[theme].sun * seatedDim(theme, 1) && sun < daySun * 0.3, `${theme} wash ${sun}`);
    assert.ok(color.b > color.r, `${theme} wash is cool`);
  }
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

test('seated, candle and lamp bloom roughly doubles so flames carry soft halos, strongest after dark', () => {
  for (const theme of ['day', 'dusk', 'rain']) assert.ok(roomBloom(theme, 1) >= roomBloom(theme, 0) * 1.6, `${theme} bloom ${roomBloom(theme, 0)} → ${roomBloom(theme, 1)}`);
  assert.equal(roomBloom('dusk', 0), 0.4);
  assert.ok(roomBloom('dusk', 1) > roomBloom('rain', 1) && roomBloom('rain', 1) > roomBloom('day', 1));
  assert.ok(roomBloom('dusk', 1) <= 1.4, 'halos stay soft, not a wash');
});

test('seated, glowing paint like the laptop screen blooms faintly so it keeps its page, while flames keep full halos', () => {
  const paint = { name: 'detail-glow', emissiveColor: new Color3(0.66, 0.64, 0.58), alpha: 1 }, flame = { name: 'candle-flame', emissiveColor: new Color3(1, 0.8, 0.5), alpha: 1 };
  assert.deepEqual(bloomEmission(paint, 0, new Color4()).asArray(), [0.66, 0.64, 0.58, 1]);
  const seated = bloomEmission(paint, 1, new Color4());
  assert.ok(seated.r * roomBloom('dusk', 1) < 0.3, `screen glow ${seated.r * roomBloom('dusk', 1)} at dusk would wash the page out`);
  assert.deepEqual(bloomEmission(flame, 1, new Color4()).asArray(), [1, 0.8, 0.5, 1]);
});

test('the laptop page is turned down after dark and in rain, so it never outshines the lamp', () => {
  assert.equal(ROOM_LIGHTS.day.screen, 1);
  assert.ok(ROOM_LIGHTS.dusk.screen <= 0.65 && ROOM_LIGHTS.dusk.screen < ROOM_LIGHTS.rain.screen && ROOM_LIGHTS.rain.screen < 1);
});

test('window light spills onto the desk as a faint warm wash by day, amber at dusk, and not at all in rain', () => {
  const [dayColor, day] = ROOM_LIGHTS.day.spill ?? [], [duskColor, dusk] = ROOM_LIGHTS.dusk.spill ?? [], [, rain] = ROOM_LIGHTS.rain.spill ?? [];
  assert.equal(dayColor, '#fff1d0');
  assert.equal(duskColor, '#ffc478');
  assert.ok(day >= 0.06 && day <= 0.1 && dusk >= 0.06 && dusk <= 0.1, `the spill stays faint: ${day} by day, ${dusk} at dusk`);
  assert.equal(rain, 0);
});
