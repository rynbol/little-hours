import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { createDetail, disposeDetails, hasDetail, isDetailLoaded, loadDetails, dimPage, spillWindow, DETAIL_SOURCES } from './detail.js';
import { SURFACE_KIND } from './storybook.js';
import { getFurniture } from '../core/catalog.js';
import { createFurniture, LAPTOP } from './furniture.js';
import { furnitureRepaint } from './architecture.js';
import { bloomEmission } from '../features/room/room-lighting.js';

const bounds = node => { const low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity]; for (const mesh of node.getChildMeshes()) { mesh.computeWorldMatrix(true); const { minimumWorld, maximumWorld } = mesh.getBoundingInfo().boundingBox; minimumWorld.asArray().forEach((v, i) => { low[i] = Math.min(low[i], v); }); maximumWorld.asArray().forEach((v, i) => { high[i] = Math.max(high[i], v); }); } return [...low, ...high]; };
const extent = mesh => { mesh.computeWorldMatrix(true); const { minimumWorld, maximumWorld } = mesh.getBoundingInfo().boundingBox; return { min: minimumWorld.asArray(), max: maximumWorld.asArray() }; };

test('every detailed model belongs to a piece of furniture in the catalogue', () => {
  for (const type of Object.keys(DETAIL_SOURCES)) assert.ok(getFurniture(type), type);
  assert.equal(hasDetail('study-desk'), true);
  assert.equal(hasDetail('not-a-piece'), false);
});

test('a detailed model builds once it has loaded, in paint, metal and glow layers', async () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  await loadDetails(['study-desk', 'study-desk', 'not-a-piece']);
  assert.equal(isDetailLoaded('study-desk'), true);
  const desk = createDetail('study-desk', scene);
  const layers = Object.fromEntries(desk.getChildMeshes().map(mesh => [mesh.material.name, mesh]));
  assert.deepEqual(Object.keys(layers).sort(), ['detail-glow', 'detail-glow-page', 'detail-metal', 'detail-paint', 'detail-spill']);
  assert.equal(desk.isEnabled(false), false);
  const paint = layers['detail-paint'];
  assert.equal(paint.getVerticesData(SURFACE_KIND).length, paint.getTotalVertices());
  assert.ok(paint.getVerticesData(SURFACE_KIND).includes(9));
  for (const glow of ['detail-glow', 'detail-glow-page']) assert.ok(layers[glow].metadata.castShadow === false && !layers[glow].receiveShadows, `${glow} neither casts nor takes shadow`);
  const { min, max } = extent(paint);
  assert.ok(max[0] - min[0] > 2.9 && max[0] - min[0] < 3.2, `desk is ${max[0] - min[0]} wide`);
  assert.ok(min[1] > -0.01 && min[1] < 0.05, `legs reach ${min[1]}`);
  disposeDetails(scene); engine.dispose();
});

test('a room design repaints only the parts cut from the colour it replaces', async () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  await loadDetails(['study-desk']);
  const plain = createDetail('study-desk', scene).getChildMeshes().find(mesh => mesh.material.name === 'detail-paint');
  const painted = createDetail('study-desk', scene, [{ from: '#83968a', to: '#b98770' }]).getChildMeshes().find(mesh => mesh.material.name === 'detail-paint');
  const { slots, palette } = plain.metadata, sage = palette.indexOf('#83968a'), wood = palette.indexOf('#aa7954');
  const before = plain.getVerticesData('color'), after = painted.getVerticesData('color');
  const cushion = slots.indexOf(sage), top = slots.indexOf(wood);
  assert.ok(after[cushion * 4] > before[cushion * 4] * 1.2, 'the sage cushion turns rose');
  assert.deepEqual([...after.slice(top * 4, top * 4 + 4)], [...before.slice(top * 4, top * 4 + 4)]);
  assert.notEqual(plain.geometry, painted.geometry);
  disposeDetails(scene); engine.dispose();
});

test('nothing is built for a model that has not loaded', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  assert.equal(createDetail('bookcase', scene), null);
  engine.dispose();
});

test('every detailed model keeps the size and place of the dollhouse piece it stands in for', async () => {
  const engine = new NullEngine(), scene = new Scene(engine), types = Object.keys(DETAIL_SOURCES);
  await loadDetails(types);
  for (const type of types) {
    const piece = createFurniture(type, scene), detail = createDetail(type, scene); detail.parent = piece;
    const body = bounds(piece.metadata.body), model = bounds(detail);
    model.forEach((value, i) => assert.ok(Math.abs(value - body[i]) < 0.15, `${type} ${['left', 'bottom', 'back', 'right', 'top', 'front'][i]} is ${value.toFixed(2)}, the dollhouse piece ${body[i].toFixed(2)}`));
  }
  disposeDetails(scene); engine.dispose();
});

test('the study laptop is a walnut case with brass fittings and a sepia screen, in both the detailed and the dollhouse desk', async () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  await loadDetails(['study-desk']);
  const meshes = createDetail('study-desk', scene).getChildMeshes(), palette = name => meshes.find(mesh => mesh.material.name === name).metadata.palette;
  assert.ok(palette('detail-paint').includes(LAPTOP.walnut) && palette('detail-paint').includes(LAPTOP.leather), 'detailed laptop case is walnut with a leather trackpad');
  assert.ok(palette('detail-metal').includes(LAPTOP.brass) && !palette('detail-metal').includes('#b3a189'), 'detailed laptop fittings are brass');
  const luminance = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  assert.ok(palette('detail-paint').includes('#aa7954') && luminance(LAPTOP.walnut) < luminance('#aa7954') * 0.75, 'the walnut case is a clearly deeper value than the desk boards so the laptop does not dissolve into them');
  const tints = new Set();
  for (const glow of meshes.filter(mesh => mesh.material.name.startsWith('detail-glow'))) { const colors = glow.getVerticesData('color'); for (let i = 0; i < colors.length; i += 4) tints.add(colors[i] >= colors[i + 2] ? 'warm' : 'cool'); }
  assert.deepEqual([...tints], ['warm'], 'every lit part of the desk glows warm');
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const has = hex => { const target = rgb(hex), near = (c, i) => Math.abs(c[i] - target[0]) + Math.abs(c[i + 1] - target[1]) + Math.abs(c[i + 2] - target[2]) < 0.02;
    return createFurniture('study-desk', scene).getChildMeshes().some(mesh => { const colors = mesh.getVerticesData('color'); if (colors) { for (let i = 0; i < colors.length; i += 4) if (near(colors, i)) return true; } const paint = mesh.material?.diffuseColor; return paint && near([paint.r, paint.g, paint.b], 0); }); };
  assert.ok(has(LAPTOP.walnut) && has(LAPTOP.brass), 'the dollhouse laptop shares the walnut case and brass hinge');
  disposeDetails(scene); engine.dispose();
});

test('turning the laptop page down dims what the page draws and what it blooms, leaves the lamp shade lit, and never compounds', async () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  await loadDetails(['study-desk']);
  const detail = createDetail('study-desk', scene), layer = name => detail.getChildMeshes().find(mesh => mesh.material.name === name);
  const page = layer('detail-glow-page'), shade = layer('detail-glow'), used = mesh => new Set([...mesh.metadata.slots].map(slot => mesh.metadata.palette[slot]));
  assert.deepEqual([...used(page)].sort(), [...LAPTOP.page].sort(), 'the page layer holds the whole page and nothing else');
  assert.ok(![...used(shade)].some(hex => LAPTOP.page.includes(hex)) && used(shade).has('#ffd08a'), 'the lamp shade glows on its own');
  const bloom = material => { const out = {}; bloomEmission(material, 1, { set: (r, g, b) => Object.assign(out, { r, g, b }) }); return out; };
  const lit = { draw: page.material.emissiveColor.g, bloom: bloom(page.material).g, shade: bloom(shade.material).g };
  dimPage(scene, 0.58); dimPage(scene, 0.58);
  assert.ok(Math.abs(page.material.emissiveColor.g - lit.draw * 0.58) < 1e-6, 'the page draws at the dimmed level, once');
  assert.ok(Math.abs(bloom(page.material).g - lit.bloom * 0.58) < 1e-6, 'and its bloom follows, so the halo cannot put the brightness back');
  assert.equal(bloom(shade.material).g, lit.shade, 'the lamp shade keeps its glow');
  dimPage(scene, 1);
  assert.equal(page.material.emissiveColor.g, lit.draw, 'turning it back up restores the page');
  const later = new Scene(engine); dimPage(later, 0.58);
  assert.ok(Math.abs(createDetail('study-desk', later).getChildMeshes().find(mesh => mesh.material.name === 'detail-glow-page').material.emissiveColor.g - lit.draw * 0.58) < 1e-6, 'a desk first built after dark gets the dimmed page');
  disposeDetails(scene); disposeDetails(later); engine.dispose();
});

test('window light spills onto both desk tops as a soft dappled wash, strongest by the window and fading toward the chair and the ends', async () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  await loadDetails(['study-desk', 'writing-desk']);
  for (const type of ['study-desk', 'writing-desk']) {
    const meshes = createDetail(type, scene).getChildMeshes(), spill = meshes.find(mesh => mesh.material.name === 'detail-spill'), desk = meshes.find(mesh => mesh.material.name === 'detail-paint');
    assert.ok(spill && spill.metadata.castShadow === false && !spill.receiveShadows && !spill.isPickable, `${type} spill neither casts, takes nor catches anything`);
    const positions = spill.getVerticesData('position'), alpha = spill.getVerticesData('color').filter((value, i) => i % 4 === 3), heights = positions.filter((value, i) => i % 3 === 1);
    const surfaces = desk.getVerticesData(SURFACE_KIND), woodHeights = desk.getVerticesData('position').filter((value, i) => i % 3 === 1 && surfaces[(i - 1) / 3] === 9), below = woodHeights.filter(y => y > heights[0] - 0.008 && y < heights[0] - 0.001);
    assert.ok(heights.every(y => y === heights[0]) && below.length >= 20, `${type} spill lies flat just above the wooden top, over ${below.length} top vertices`);
    const zs = positions.filter((value, i) => i % 3 === 2), xs = positions.filter((value, i) => i % 3 === 0), window = Math.min(...zs), chair = Math.max(...zs), ends = Math.max(...xs);
    const mean = pick => { const chosen = alpha.filter((value, v) => pick(xs[v], zs[v])); return chosen.reduce((sum, value) => sum + value, 0) / chosen.length; };
    const back = mean((x, z) => z < window + 0.1 && Math.abs(x) < ends * 0.6), front = mean((x, z) => z > chair - 0.2 && Math.abs(x) < ends * 0.6);
    assert.ok(back > 0.45 && front < back * 0.15, `${type} spill runs ${back.toFixed(2)} by the window and ${front.toFixed(2)} by the chair`);
    assert.ok(Math.max(...alpha.filter((value, v) => Math.abs(xs[v]) === ends)) === 0 && Math.max(...alpha) <= 1, `${type} spill has no hard ends`);
    const row = alpha.filter((value, v) => zs[v] === window && Math.abs(xs[v]) < ends * 0.6), rowMean = row.reduce((sum, value) => sum + value, 0) / row.length;
    const spread = Math.sqrt(row.reduce((sum, value) => sum + (value - rowMean) ** 2, 0) / row.length);
    assert.ok(spread / rowMean > 0.12, `${type} spill is dappled by leaves, varying ${(spread / rowMean * 100).toFixed(0)}% along the window edge`);
  }
  disposeDetails(scene); engine.dispose();
});

test('the window spill takes the colour and strength of each theme, stays hidden when it has none, and a desk built later picks up the current light', async () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  await loadDetails(['study-desk']);
  spillWindow(scene, ['#fff1d0', 0.08]);
  const spill = createDetail('study-desk', scene).getChildMeshes().find(mesh => mesh.material.name === 'detail-spill');
  assert.equal(spill.material.emissiveColor.toHexString(), '#FFF1D0', 'a desk first built by day shows the day spill');
  assert.ok(spill.isVisible && Math.abs(spill.material.alpha - 0.08) < 1e-9, 'at the day strength');
  assert.ok(spill.material.disableLighting && spill.material.disableDepthWrite && spill.hasVertexAlpha, 'the spill is unlit light laid over the wood without hiding what is drawn after it');
  spillWindow(scene, ['#ffc478', 0.09]); spillWindow(scene, ['#ffc478', 0.09]);
  assert.ok(spill.material.emissiveColor.toHexString() === '#FFC478' && Math.abs(spill.material.alpha - 0.09) < 1e-9 && spill.isVisible, 'dusk turns it amber, once');
  spillWindow(scene, ['#ffffff', 0]);
  assert.equal(spill.isVisible, false, 'rain casts no spill and so draws nothing');
  const later = createDetail('study-desk', scene).getChildMeshes().find(mesh => mesh.material.name === 'detail-spill');
  assert.equal(later.isVisible, false, 'a desk built in rain stays without it');
  disposeDetails(scene); engine.dispose();
});

test('the desk lamp shade glows evenly from within instead of being lit across its pleats', async () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  await loadDetails(['study-desk']);
  const layers = Object.fromEntries(createDetail('study-desk', scene).getChildMeshes().map(mesh => [mesh.material.name, mesh.metadata.palette]));
  assert.ok(layers['detail-glow'].includes('#ffd08a'), 'the shade glows');
  assert.ok(!layers['detail-paint'].includes('#d6a766'), 'no lit cloth shade is left to catch the bulb light across its pleats');
  disposeDetails(scene); engine.dispose();
});

test('the desk mug turns its handle toward the seat so it reads in profile from the chair', async () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  await loadDetails(['study-desk']);
  const paint = createDetail('study-desk', scene).getChildMeshes().find(mesh => mesh.material.name === 'detail-paint'), positions = paint.getVerticesData('position');
  let handle = 0, seatward = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const dx = positions[i] - 0.83, y = positions[i + 1] - 1.26, dz = positions[i + 2] + 0.13;
    if (y > 0.07 && y < 0.15 && Math.hypot(dx, dz) > 0.135 && Math.hypot(dx, dz) < 0.19) { handle++; if (dz > 0.06) seatward++; }
  }
  assert.ok(handle > 20, `${handle} handle vertices beside the mug`);
  assert.ok(seatward / handle > 0.8, `${seatward} of ${handle} handle vertices face the seat`);
  disposeDetails(scene); engine.dispose();
});

test('the desk succulent is a blush-tipped rosette in a glazed pot', async () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  await loadDetails(['study-desk']);
  const { palette } = createDetail('study-desk', scene).getChildMeshes().find(mesh => mesh.material.name === 'detail-paint').metadata;
  assert.ok(['#667c78', '#efe2c4', '#8fb07c', '#c9dea8', '#d8958a'].every(hex => palette.includes(hex)), 'glazed pot with a cream band, graded rosette leaves and blushed tips');
  disposeDetails(scene); engine.dispose();
});

test('the moon tree charms hang on strings that rise into the canopy or loop over a branch', async () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  await loadDetails(['moon-tree']);
  const paint = createDetail('moon-tree', scene).getChildMeshes().find(mesh => mesh.material.name === 'detail-paint');
  const positions = paint.getVerticesData('position'), colors = paint.getVerticesData('color'), string = [0x8e / 255, 0x6f / 255, 0x45 / 255];
  const tops = [-Infinity, -Infinity];
  let strands = 0;
  for (let i = 0, c = 0; i < positions.length; i += 3, c += 4) {
    if (Math.abs(colors[c] - string[0]) + Math.abs(colors[c + 1] - string[1]) + Math.abs(colors[c + 2] - string[2]) > 0.08) continue;
    strands++;
    [[-0.48, 0.2], [0.42, 0.27]].forEach(([x, z], k) => { if (Math.hypot(positions[i] - x, positions[i + 2] - z) < 0.02) tops[k] = Math.max(tops[k], positions[i + 1]); });
  }
  assert.ok(strands > 20, `${strands} string vertices`);
  tops.forEach(top => assert.ok(top > 2.38, `a string reaches ${top}`));
  disposeDetails(scene); engine.dispose();
});

test('baked contact shade keeps most of each colour, so crevices stay warm instead of crushing to black', async () => {
  const engine = new NullEngine(), scene = new Scene(engine), types = ['bookcase', 'study-desk', 'lounge-chair', 'fireplace'];
  await loadDetails(types);
  for (const type of types) {
    const kept = [];
    for (const mesh of createDetail(type, scene).getChildMeshes().filter(mesh => !mesh.material.name.startsWith('detail-glow') && !mesh.metadata.spill)) {
      const colors = mesh.getVerticesData('color'), { slots, palette } = mesh.metadata;
      const brightest = palette.map(hex => Math.max(...[1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16) / 255)));
      slots.forEach((slot, v) => kept.push(Math.max(colors[v * 4], colors[v * 4 + 1], colors[v * 4 + 2]) / brightest[slot]));
    }
    kept.sort((a, b) => a - b);
    assert.ok(kept[Math.floor(kept.length * 0.02)] > 0.5, `${type} crevices keep ${kept[Math.floor(kept.length * 0.02)].toFixed(2)} of their colour`);
  }
  disposeDetails(scene); engine.dispose();
});

test('the bookcase spines vary in style, with raised ribs and title bands in darker shades of their cloth', async () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  await loadDetails(['bookcase']);
  const { palette } = createDetail('bookcase', scene).getChildMeshes().find(mesh => mesh.material.name === 'detail-paint').metadata;
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const shadeOf = (dark, cloth) => [0.72, 0.78].some(k => rgb(cloth).every((c, i) => Math.abs(Math.round(c * k) - rgb(dark)[i]) <= 1));
  const shaded = palette.filter(dark => palette.some(cloth => cloth !== dark && shadeOf(dark, cloth)));
  assert.ok(shaded.length >= 4, `${shaded.length} darker cloth shades`);
  disposeDetails(scene); engine.dispose();
});

test('the laptop keyboard staggers its rows around modifier keys and a wide centred spacebar, keeping its footprint', async () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  await loadDetails(['study-desk']);
  const paint = createDetail('study-desk', scene).getChildMeshes().find(mesh => mesh.material.name === 'detail-paint');
  const positions = paint.getVerticesData('position'), { slots, palette } = paint.metadata, top = palette.indexOf('#f4ecd8'), seat = palette.indexOf('#22170f');
  const tops = [], shadows = [];
  slots.forEach((slot, v) => { if (slot === top) tops.push([positions[v * 3], positions[v * 3 + 2]]); if (slot === seat) shadows.push(positions[v * 3]); });
  const row = z => tops.filter(([, pz]) => Math.abs(pz - (-0.43 + z)) < 0.018).map(([x]) => x);
  const bottom = row(-0.17 + 4 * 0.048), home = row(-0.17 + 2 * 0.048), numbers = row(-0.17);
  assert.ok(bottom.length && !bottom.some(x => Math.abs(x) < 0.14) && bottom.some(x => x < -0.145) && bottom.some(x => x > 0.145), 'one spacebar spans the middle of the bottom row');
  assert.ok(Math.max(...home.map(x => Math.min(...numbers.map(n => Math.abs(n - x))))) > 0.006, 'the home row is staggered against the number row');
  assert.ok(shadows.length > 100 && Math.min(...shadows) > -0.335 && Math.max(...shadows) < 0.335 && Math.max(...tops.map(([x]) => Math.abs(x))) < 0.33, 'the keys sit in shaded seats inside the original keyboard width');
  disposeDetails(scene); engine.dispose();
});

test('the desk lamp shade shows its pleat folds, a rust trim at both rims, a gilt bead fringe and a brass finial', async () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  await loadDetails(['study-desk']);
  const layers = Object.fromEntries(createDetail('study-desk', scene).getChildMeshes().map(mesh => [mesh.material.name, mesh]));
  const at = (layer, hex) => { const { slots, palette } = layers[layer].metadata, slot = palette.indexOf(hex), p = layers[layer].getVerticesData('position'), out = []; slots.forEach((s, v) => { if (s === slot) out.push([p[v * 3], p[v * 3 + 1], p[v * 3 + 2]]); }); return out; };
  const nearShade = ([x, , z]) => Math.hypot(x - 0.96, z + 0.69) < 0.27;
  assert.ok(at('detail-glow', '#eeb26a').filter(nearShade).length > 200, 'darker fold lines run down the glowing shade');
  const trim = at('detail-paint', '#8e6048').filter(nearShade).map(([, y]) => y);
  assert.ok(trim.some(y => y < 1.8) && trim.some(y => y > 1.98), 'a rust trim binds the bottom and top rims');
  const beads = at('detail-metal', '#cdb07e').filter(([x, y, z]) => Math.abs(Math.hypot(x - 0.96, z + 0.69) - 0.256) < 0.012 && Math.abs(y - 1.76) < 0.015);
  assert.ok(beads.length > 24 * 6, `${beads.length} fringe bead vertices`);
  assert.ok(at('detail-metal', '#b99a6e').some(([x, y, z]) => Math.hypot(x - 0.96, z + 0.69) < 0.03 && y > 2.05), 'a brass finial crowns the shade');
  disposeDetails(scene); engine.dispose();
});

test('the desk close-ups are lifted earth tones, with no saturated primaries or blue cloth', async () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  await loadDetails(['study-desk']);
  const lit = createDetail('study-desk', scene).getChildMeshes().filter(mesh => !mesh.material.name.startsWith('detail-glow') && !mesh.metadata.spill);
  const used = new Set(lit.flatMap(mesh => [...mesh.metadata.slots].map(slot => mesh.metadata.palette[slot].toLowerCase())));
  const loud = [...used].filter(hex => {
    const color = Color3.FromHexString(hex), [h, s, v] = color.toHSV().asArray(), chroma = Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b);
    return v > 0.3 && (chroma > 0.36 || s > 0.56 || (h > 180 && h < 260 && s > 0.15));
  });
  assert.deepEqual(loud, [], 'desk close-ups that shout from the chair');
  disposeDetails(scene); engine.dispose();
});

test('shelf books are earthy leather and cloth tones, with no pale pastel blues or greens', async () => {
  const engine = new NullEngine(), scene = new Scene(engine), types = ['bookcase', 'wall-shelf'];
  await loadDetails(types);
  for (const type of types) {
    const { palette } = createDetail(type, scene).getChildMeshes().find(mesh => mesh.material.name === 'detail-paint').metadata;
    const pastel = palette.filter(hex => { const [h, s, v] = Color3.FromHexString(hex).toHSV().asArray(); return h > 120 && h < 260 && s > 0.08 && v > 0.5; });
    assert.deepEqual(pastel, [], `${type} has pale cool spines`);
  }
  disposeDetails(scene); engine.dispose();
});

test('from the chair the desk wood reads a soft honey oak that drifts slowly in tone across the boards, its darkest parts stay lifted, the laptop keeps its walnut, and a room design keeps its own wood', async () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  await loadDetails(['study-desk']);
  const paintOf = repaint => createDetail('study-desk', scene, repaint).getChildMeshes().find(mesh => mesh.material.name === 'detail-paint');
  const plain = paintOf([]), { slots, palette, baseColors, tones } = plain.metadata, surfaces = plain.getVerticesData(SURFACE_KIND), colors = plain.getVerticesData('color'), positions = plain.getVerticesData('position');
  const hsv = (array, v) => new Color3(array[v * 4], array[v * 4 + 1], array[v * 4 + 2]).toHSV().asArray(), luma = (array, v) => 0.2126 * array[v * 4] + 0.7152 * array[v * 4 + 1] + 0.0722 * array[v * 4 + 2];
  const at = (sorted, share) => sorted[Math.floor(sorted.length * share)], sorted = values => values.sort((a, b) => a - b);
  const wood = [...slots.keys()].filter(v => surfaces[v] === 9 && ['#aa7954', '#73533d'].includes(palette[slots[v]]));
  const hues = sorted(wood.map(v => hsv(colors, v)[0])), saturations = sorted(wood.map(v => hsv(colors, v)[1]));
  assert.ok(at(hues, 0.1) >= 28.5 && at(hues, 0.9) <= 33, `desk wood hue runs ${at(hues, 0.1).toFixed(1)}-${at(hues, 0.9).toFixed(1)}`);
  assert.ok(at(saturations, 0.9) <= 0.38, `desk wood saturation reaches ${at(saturations, 0.9).toFixed(2)}`);
  const boards = wood.filter(v => palette[slots[v]] === '#aa7954'), drift = sorted(boards.map(v => colors[v * 4 + 1] / baseColors[v * 4 + 1]));
  assert.ok(at(drift, 0.9) / at(drift, 0.1) >= 1.04, `the board tone drifts ${((at(drift, 0.9) / at(drift, 0.1) - 1) * 100).toFixed(1)}% across the desk`);
  let steepest = 0;
  for (let a = 0; a < boards.length; a += 7) for (const b of boards) {
    const [i, j] = [boards[a] * 3, b * 3], gap = Math.hypot(positions[i] - positions[j], positions[i + 1] - positions[j + 1], positions[i + 2] - positions[j + 2]);
    if (gap > 0 && gap < 0.02) steepest = Math.max(steepest, Math.abs(tones[boards[a]] - tones[b]));
  }
  assert.ok(steepest < 0.012, `the drift is soft: boards 2 cm apart differ in tone by up to ${(steepest * 100).toFixed(1)}%`);
  const walnut = [...slots.keys()].filter(v => palette[slots[v]] === LAPTOP.walnut).map(v => hsv(colors, v));
  assert.ok(walnut.length && walnut.every(([h, saturation]) => h >= 24 && h <= 32 && saturation >= 0.3), 'the laptop case stays a warm walnut instead of greying with the boards');
  const darkest = Math.min(...[...slots.keys()].map(v => luma(colors, v)));
  assert.ok(darkest >= 0.17, `the darkest desk crevice is ${darkest.toFixed(3)}`);
  const sakura = paintOf(furnitureRepaint('sakura')), top = slots.indexOf(palette.indexOf('#aa7954'));
  const sakuraHue = Color3.FromHexString('#c39e70').toHSV().r, ratio = sakura.getVerticesData('color')[top * 4] / sakura.metadata.baseColors[top * 4] / sakura.metadata.tones[top];
  assert.ok(Math.abs(hsv(sakura.getVerticesData('color'), top)[0] - sakuraHue) < 1.5, 'sakura wood keeps its own hue');
  assert.ok(Math.abs(ratio - Color3.FromHexString('#c39e70').r / Color3.FromHexString('#aa7954').r) < 0.01, 'sakura wood is cut from the model colour, not the close-up one');
  disposeDetails(scene); engine.dispose();
});

test('from the chair the keyboard well and the key gaps are lifted enough to stay above the frame floor in the lid shadow, and the keys still read against them', async () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  await loadDetails(['study-desk']);
  const paint = createDetail('study-desk', scene).getChildMeshes().find(mesh => mesh.material.name === 'detail-paint'), { slots, palette } = paint.metadata, colors = paint.getVerticesData('color');
  const shown = hex => { const values = [...slots.keys()].filter(v => palette[slots[v]] === hex).map(v => 0.2126 * colors[v * 4] + 0.7152 * colors[v * 4 + 1] + 0.0722 * colors[v * 4 + 2]).sort((a, b) => a - b); return values[values.length >> 1]; };
  const well = shown('#3d2b22'), gaps = shown('#22170f'), keys = shown('#d8caa9');
  assert.ok(well >= 0.29, `the keyboard well shows at luma ${well.toFixed(3)}`);
  assert.ok(gaps >= 0.26 && gaps < well, `the key gaps show at luma ${gaps.toFixed(3)}, under the well at ${well.toFixed(3)}`);
  assert.ok(keys > well * 1.35, `the key skirts at ${keys.toFixed(3)} stand clear of the well at ${well.toFixed(3)}`);
  disposeDetails(scene); engine.dispose();
});
