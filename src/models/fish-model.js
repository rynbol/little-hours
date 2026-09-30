import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';

const FIN = { from: .3, to: .66, h: .5 };
const BODIES = {
  slim: { length: 1, height: .3, thick: .5, peak: .36, tail: .55, dorsal: FIN, hump: .12, flat: .1 },
  deep: { length: 1, height: .5, thick: .42, peak: .38, tail: .5, dorsal: { ...FIN, h: .55 }, hump: .28, flat: .05 },
  round: { lips: .1, length: .9, height: .6, thick: .4, peak: .42, tail: .45, dorsal: FIN, hump: .1 },
  long: { length: 1.15, height: .3, thick: .52, peak: .34, tail: .55, dorsal: { ...FIN, h: .45 }, hump: .08, flat: .15 },
  koi: { length: 1.05, height: .36, thick: .56, peak: .36, tail: .8, flowing: true, dorsal: { ...FIN, h: .6 }, hump: .1, flat: .12 },
  eel: { length: 1.9, height: .13, thick: .8, peak: .2, tail: 0, eel: true },
  sturgeon: { length: 1.4, height: .24, thick: .7, peak: .42, tail: .6, snout: true, dorsal: { ...FIN, h: .45 }, hump: .15, flat: .3 },
  angel: { lips: .12, length: .72, height: .82, thick: .26, peak: .42, tail: .42, dorsal: { from: .3, to: .6, h: .95, sweep: .45 }, anal: { from: .38, to: .62, h: .85, sweep: .45 }, hump: .05 },
  betta: { length: .9, height: .3, thick: .5, peak: .4, tail: 1.5, veil: true, dorsal: { from: .38, to: .8, h: .8, sweep: .25 }, anal: { from: .35, to: .85, h: 1.1, sweep: .3 }, hump: .1 },
  puffer: { lips: .16, length: .72, height: .64, thick: .92, peak: .45, tail: .32, spikes: true, dorsal: { from: .56, to: .74, h: .22 }, flat: .08 },
  star: { length: 1, height: 1, star: true },
  jelly: { length: .7, height: 1, jelly: true },
};
const RINGS = 44, SIDES = 22, W = 256, SKIN = 128, TALL = 160;
const rowV = row => row / TALL, FIN_V = rowV(138), WHITE_V = rowV(151), DARK_V = rowV(157);

function profile(body, u) {
  if (body.eel) return Math.min(1, Math.sqrt(u / .06)) * (1 - u * .85);
  const a = body.peak * 1.3, b = (1 - body.peak) * 1.3, top = a ** a * b ** b / (a + b) ** (a + b);
  const nose = body.snout ? u ** 1.6 : u;
  return Math.max(.001, nose ** a * (1 - u) ** b / top * .88 + .12 * u ** 3);
}

function paintSkin(scene, look, radial, name) {
  const texture = new DynamicTexture(name, { width: W, height: TALL }, scene, true), ctx = texture.getContext();
  const C = hex => Color3.FromHexString(hex), body = C(look.body), belly = C(look.belly), back = body.scale(.8), fin = C(look.fin);
  const upAt = y => Math.sin(y / SKIN * Math.PI * 2);
  if (radial) {
    for (let x = 0; x < W; x++) { ctx.fillStyle = Color3.Lerp(body.scale(.92), belly, (x / W) ** 1.6).toHexString(); ctx.fillRect(x, 0, 1, SKIN); }
  } else for (let y = 0; y < SKIN; y++) {
    const up = upAt(y + .5);
    let c = Color3.Lerp(belly, body, Math.min(1, Math.max(0, (up + .35) * 1.3)));
    if (up > .75) c = Color3.Lerp(c, back, (up - .75) * 3);
    ctx.fillStyle = c.toHexString(); ctx.fillRect(0, y, W, 1);
  }
  const rows = (low, high) => { const out = []; for (let y = 0; y < SKIN; y++) { const up = radial ? 0 : upAt(y + .5); if (up >= low && up <= high) out.push(y); } return out; };
  let seed = look.body.charCodeAt(1) * 131 + look.fin.charCodeAt(2) * 7 + 1;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const pick = list => list[Math.floor(rand() * list.length)];
  if (!radial) {
    ctx.strokeStyle = look.fin; ctx.globalAlpha = .35; ctx.lineWidth = 1.5;
    for (const y of [SKIN * .02, SKIN * .48]) { ctx.beginPath(); ctx.moveTo(W * .2, y); ctx.lineTo(W * .92, y); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  if (look.mark === 'rainbow') {
    for (let x = 0; x < W; x++) { ctx.fillStyle = `hsl(${(x / W * 330 + 330) % 360}, 95%, 74%)`; ctx.fillRect(x, 0, 1, SKIN); }
    ctx.globalAlpha = .35;
    for (const y of rows(-1, -.3)) { ctx.fillStyle = look.belly; ctx.fillRect(0, y, W, 1); }
    ctx.globalAlpha = 1;
  }
  if (look.mark === 'spots') { ctx.fillStyle = radial ? 'rgba(255, 244, 222, .75)' : 'rgba(61, 58, 51, .55)'; const upper = rows(-.15, .95); for (let i = 0; i < 70; i++) { ctx.beginPath(); ctx.arc(W * (radial ? .08 + rand() * .85 : .12 + rand() * .78), pick(upper), 2 + rand() * 2.6, 0, Math.PI * 2); ctx.fill(); } }
  if (look.mark === 'stripes') { ctx.fillStyle = look.stripe || 'rgba(78, 90, 52, .5)'; ctx.globalAlpha = look.stripe ? .6 : 1; for (let i = 0; i < 6; i++) { const x = W * (.2 + i * .11); for (const y of rows(-.25, 1)) ctx.fillRect(x - 4 + Math.sin(y * .2) * 1.5, y, 8, 1); } ctx.globalAlpha = 1; }
  if (look.mark === 'patches') { ctx.fillStyle = look.patch; for (const [x, w] of [[.2, .1], [.38, .12], [.58, .09], [.74, .07]]) for (const y0 of [SKIN * .22, SKIN * .72]) { ctx.beginPath(); ctx.ellipse(W * x, y0 + (rand() - .5) * 12, W * w * (.7 + rand() * .5), SKIN * (.1 + rand() * .08), rand(), 0, Math.PI * 2); ctx.fill(); } }
  if (look.mark === 'stars') { ctx.fillStyle = '#fff6d8'; const upper = rows(0, .95); for (let i = 0; i < 60; i++) { const x = W * (.12 + rand() * .8), y = pick(upper), r = 1.6 + rand() * 2.2; ctx.beginPath(); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, d = k % 2 ? r * .35 : r; ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); } ctx.fill(); } }
  if (look.mark === 'plates') { ctx.fillStyle = 'rgba(217, 212, 230, .8)'; for (const y of [SKIN * .1, SKIN * .4]) for (let i = 0; i < 12; i++) { const x = W * (.15 + i * .065); ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 5); ctx.lineTo(x - 5, y); ctx.fill(); } }
  if (look.blush || ['puffer', 'round', 'angel', 'betta'].includes(look.shape)) {
    const cheek = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); cheek.addColorStop(0, 'rgba(242, 133, 150, .55)'); cheek.addColorStop(1, 'rgba(242, 133, 150, 0)');
    for (const y of [SKIN * .1, SKIN * .4]) { ctx.save(); ctx.translate(W * .16, y); ctx.scale(W * .06, SKIN * .07); ctx.fillStyle = cheek; ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  }
  const tip = Color3.Lerp(fin, belly, .55);
  for (let x = 0; x < W; x++) {
    ctx.fillStyle = look.mark === 'rainbow' ? `hsl(${(x / W * 300 + 180) % 360}, 95%, 80%)` : Color3.Lerp(fin, tip, x / W).toHexString();
    ctx.fillRect(x, SKIN, 1, 20);
  }
  ctx.fillStyle = '#f7f2ea'; ctx.fillRect(0, 148, W, 6);
  ctx.fillStyle = '#1f1b18'; ctx.fillRect(0, 154, W, 6);
  texture.update(false);
  return texture;
}

function fromData(scene, name, positions, uvs, indices) {
  const data = Object.assign(new VertexData(), { positions, uvs, indices }), normals = [];
  VertexData.ComputeNormals(positions, indices, normals); data.normals = normals;
  const mesh = new Mesh(name, scene); data.applyToMesh(mesh);
  return mesh;
}
const flatUV = (mesh, u, v) => { const count = mesh.getTotalVertices(), uvs = []; for (let i = 0; i < count; i++) uvs.push(u, v); mesh.setVerticesData('uv', uvs); return mesh; };

function bodyMesh(scene, body) {
  const positions = [], uvs = [], indices = [], L = body.length, H = body.height;
  for (let r = 0; r <= RINGS; r++) {
    const u = r / RINGS, x = L * (.5 - u), half = H / 2 * profile(body, u), wave = body.eel ? Math.sin(u * 9) * .05 : 0, sag = -H * .06 * profile(body, u);
    for (let s = 0; s <= SIDES; s++) {
      const around = s / SIDES * Math.PI * 2, up = Math.sin(around), shape = up > 0 ? 1 + (body.hump || 0) * Math.sin(u * Math.PI) : 1 - (body.flat || 0) * Math.sin(u * Math.PI);
      const y = sag + half * up * shape, z = wave + half * body.thick * Math.cos(around);
      positions.push(x, y, z); uvs.push(u, s / SIDES * SKIN / TALL);
      if (r && s) { const n = r * (SIDES + 1) + s; indices.push(n - SIDES - 2, n - 1, n - SIDES - 1, n - SIDES - 1, n - 1, n); }
    }
  }
  return fromData(scene, 'fish-body', positions, uvs, indices);
}

function starMesh(scene) {
  const positions = [], uvs = [], indices = [], STEPS = 80, OUT = 7, reach = a => .17 + .33 * ((1 + Math.cos(5 * a)) / 2) ** 1.3;
  for (const side of [1, -1]) {
    const start = positions.length / 3;
    for (let k = 0; k <= OUT; k++) for (let i = 0; i <= STEPS; i++) {
      const a = i / STEPS * Math.PI * 2 + Math.PI / 2, t = k / OUT, R = reach(a), rho = t * R;
      const puff = .1 * (R / .5) ** .5 * (1 - t * t) ** .55;
      positions.push(Math.cos(a) * rho, Math.sin(a) * rho, side * (puff + .004)); uvs.push(t, i / STEPS * SKIN / TALL);
      if (k && i) { const n = start + k * (STEPS + 1) + i, p = n - STEPS - 1; side > 0 ? indices.push(p - 1, n - 1, p, p, n - 1, n) : indices.push(p - 1, p, n - 1, p, n, n - 1); }
    }
  }
  return fromData(scene, 'fish-body', positions, uvs, indices);
}

function jellyMesh(scene) {
  const positions = [], uvs = [], indices = [], BANDS = 14, AROUND = 32;
  for (let b = 0; b <= BANDS; b++) for (let i = 0; i <= AROUND; i++) {
    const t = b / BANDS, a = i / AROUND * Math.PI * 2, frill = t > .8 ? 1 + .07 * Math.sin(a * 8) * (t - .8) * 5 : 1;
    const r = .34 * Math.sin(t * Math.PI / 2) ** .75 * frill, y = .28 * Math.cos(t * Math.PI / 2) - (t > .85 ? (t - .85) * .25 : 0);
    positions.push(Math.cos(a) * r, y, Math.sin(a) * r); uvs.push(t, i / AROUND * SKIN / TALL);
    if (b && i) { const n = b * (AROUND + 1) + i, p = n - AROUND - 1; indices.push(p - 1, n - 1, p, p, n - 1, n); }
  }
  return fromData(scene, 'fish-body', positions, uvs, indices);
}

function finMesh(scene, name, outline) {
  const positions = [...outline.center, 0], uvs = [.02, FIN_V], indices = [];
  outline.points.forEach(([x, y, edge], i) => { positions.push(x, y, 0); uvs.push(.02 + edge * .96, FIN_V); if (i) indices.push(0, i, i + 1); });
  return fromData(scene, name, positions, uvs, indices);
}

const arc = (points, steps = 5) => points.flatMap(([x0, y0, e0], i) => {
  const next = points[i + 1];
  if (!next) return [[x0, y0, e0]];
  return Array.from({ length: steps }, (_, k) => { const t = k / steps; return [x0 + (next[0] - x0) * t, y0 + (next[1] - y0) * t, e0 + (next[2] - e0) * t]; });
});

function tube(scene, path, radius) {
  return flatUV(MeshBuilder.CreateTube('fish-strand', { path, radiusFunction: i => radius * (1 - i / path.length) + .003, tessellation: 5 }, scene), .5, FIN_V);
}

function eyes(scene, parts, at, radius) {
  for (const side of [-1, 1]) {
    const [x, y, z] = at(side);
    const sclera = flatUV(MeshBuilder.CreateSphere('fish-eye-white', { diameter: radius * 2, segments: 6 }, scene), .5, WHITE_V); sclera.position.set(x, y, z);
    const pupil = flatUV(MeshBuilder.CreateSphere('fish-eye', { diameter: radius * 1.4, segments: 6 }, scene), .5, DARK_V); pupil.position.set(x + radius * .18, y + radius * .02, z + side * radius * .5);
    const spark = flatUV(MeshBuilder.CreateSphere('fish-eye-spark', { diameter: radius * .5, segments: 4 }, scene), .5, WHITE_V); spark.position.set(x + radius * .38, y + radius * .32, z + side * radius * .95);
    parts.push(sclera, pupil, spark);
  }
}

function fishParts(scene, body, look) {
  const L = body.length, H = body.height, parts = [], tailParts = [];
  if (body.star) {
    parts.push(starMesh(scene));
    for (const side of [-1, 1]) {
      const sclera = flatUV(MeshBuilder.CreateSphere('fish-eye-white', { diameter: .07, segments: 6 }, scene), .5, WHITE_V); sclera.position.set(side * .045, .03, .1);
      const pupil = flatUV(MeshBuilder.CreateSphere('fish-eye', { diameter: .042, segments: 6 }, scene), .5, DARK_V); pupil.position.set(side * .045, .035, .125);
      parts.push(sclera, pupil);
    }
    return { parts, tailParts };
  }
  if (body.jelly) {
    parts.push(jellyMesh(scene));
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, r = .3;
      parts.push(tube(scene, Array.from({ length: 6 }, (_, k) => new Vector3(Math.cos(a) * (r - k * .02) + Math.sin(k * 1.3 + i) * .025, .01 - k * .11, Math.sin(a) * (r - k * .02))), .012));
    }
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2 + .4;
      parts.push(tube(scene, Array.from({ length: 6 }, (_, k) => new Vector3(Math.cos(a) * (.05 + Math.sin(k * .9) * .04), .06 - k * .09, Math.sin(a) * (.05 + Math.sin(k * .9) * .04))), .03));
    }
    return { parts, tailParts };
  }
  parts.push(bodyMesh(scene, body));
  const top = u => H * .44 * profile(body, u) * (1 + (body.hump || 0) * Math.sin(u * Math.PI)), bottom = u => -H * .56 * profile(body, u) * (1 - (body.flat || 0) * Math.sin(u * Math.PI)), xAt = u => L * (.5 - u);
  const sail = (fin, edge, sign) => {
    const { from, to, h, sweep = 0 } = fin, lift = H * h, span = to - from;
    const points = sweep
      ? arc([[xAt(from), edge(from) * .9, 0], [xAt(from + span * .45), edge(from + span * .45) + sign * lift * .55, .7], [xAt(to + sweep * .7), edge(to) + sign * lift * .95, 1], [xAt(to + sweep), edge(to) + sign * lift, 1], [xAt(to + sweep * .45), edge(to) + sign * lift * .35, .8], [xAt(to), edge(to) * .9, 0]], 4)
      : arc([[xAt(from), edge(from) * .9, 0], [xAt(from + span * .2), edge(from + span * .2) + sign * lift * .75, 1], [xAt(from + span * .55), edge(from + span * .55) + sign * lift * .55, 1], [xAt(to), edge(to) * .9, 0]], 4);
    return finMesh(scene, 'fish-fin', { center: [xAt(from + span * .5), edge(from + span * .5) * .92], points });
  };
  if (body.eel) parts.push(finMesh(scene, 'fish-fin', { center: [xAt(.48), top(.48) * .92], points: arc(Array.from({ length: 9 }, (_, i) => { const u = .15 + i * .1; return [xAt(u), top(u) + H * .35 * Math.sin(i / 8 * Math.PI), 1]; }), 3) }));
  if (body.dorsal) parts.push(sail(body.dorsal, top, 1));
  if (body.anal) parts.push(sail(body.anal, bottom, -1));
  if (!body.eel) {
    const reach = H * body.tail * (body.flowing ? 1.5 : 1.15), spread = H * (body.veil ? 1.1 : body.flowing ? .75 : .62);
    const points = body.veil
      ? [...Array.from({ length: 25 }, (_, i) => { const a = (i / 24 - .5) * 2.5, R = reach * (1 + .07 * Math.sin(i * 1.7)); return [-Math.cos(a) * R, Math.sin(a) * R * 1.2, i % 24 ? 1 : .3]; })]
      : arc([[0, H * .08, 0], [-reach * .55, spread * .7, .6], [-reach, spread, 1], [-reach * .7, spread * .25, 1], [-reach * .62, 0, .8], [-reach * .7, -spread * .25, 1], [-reach, -spread, 1], [-reach * .55, -spread * .7, .6], [0, -H * .08, 0]]);
    tailParts.push(finMesh(scene, 'fish-caudal', { center: [0, 0], points }));
  }
  if (body.spikes) for (let r = 1; r < 7; r++) for (let s = 0; s < 9; s++) {
    const u = .12 + r * .11, around = (s + (r % 2) * .5) / 9 * Math.PI * 2, half = H / 2 * profile(body, u);
    const spike = flatUV(MeshBuilder.CreateCylinder('fish-spike', { height: .07, diameterTop: 0, diameterBottom: .03, tessellation: 4 }, scene), .7, FIN_V);
    const dir = new Vector3(0, Math.sin(around), Math.cos(around) * body.thick).normalize();
    spike.position.set(xAt(u), -H * .06 * profile(body, u) + half * Math.sin(around) + dir.y * .02, half * body.thick * Math.cos(around) + dir.z * .02);
    spike.rotation.x = Math.atan2(dir.z, dir.y);
    parts.push(spike);
  }
  const eyeU = body.eel ? .03 : body.snout ? .16 : .1, eyeR = Math.max(.03, H * (body.eel ? .22 : body.spikes ? .16 : .12));
  eyes(scene, parts, side => [xAt(eyeU), H * .08, side * H / 2 * profile(body, eyeU) * body.thick * .82], eyeR);
  if (body.lips) { const lip = flatUV(MeshBuilder.CreateSphere('fish-lips', { diameter: 1, segments: 6 }, scene), .9, FIN_V); lip.scaling.set(H * .1, H * body.lips, H * .2 * body.thick + .02); lip.position.set(xAt(0) + .005, -H * .04, 0); parts.push(lip); }
  if (!body.eel) for (const side of [-1, 1]) {
    const u = .22, surface = H / 2 * profile(body, u) * body.thick, reach = H * (body.flowing || body.veil ? .45 : .3);
    const pec = finMesh(scene, 'fish-pectoral', { center: [0, 0], points: arc([[0, .01, 0], [-reach * .8, -reach * .35, 1], [-reach, -reach * .75, 1], [-reach * .3, -reach * .45, .6], [0, -.01, 0]], 3) });
    pec.position.set(xAt(u), -H * .12, side * surface * .95); pec.rotation.y = side * -.5; parts.push(pec);
  }
  if (look.whiskers) for (const side of [-1, 1]) {
    const nose = xAt(0), w = H * .32;
    parts.push(tube(scene, [new Vector3(nose - .01, -H * .1, side * H * .06), new Vector3(nose + w * .3, -H * .24, side * H * .14), new Vector3(nose + w * .15, -H * .5, side * H * .2)], .01));
  }
  return { parts, tailParts };
}

const merged = (list, name) => { const mesh = list.length > 1 ? Mesh.MergeMeshes(list, true, true) : list[0]; if (mesh) mesh.name = name; return mesh; };

export function buildFishModel(scene, species, size, glow) {
  const look = species.look, body = BODIES[look.shape], L = body.length, H = body.height;
  const root = new TransformNode('lake-fish', scene), tail = new TransformNode('lake-fish-tail', scene); tail.parent = root; tail.position.x = -L / 2 + .01;
  const paint = new StandardMaterial('fish-paint', scene); paint.backFaceCulling = false; paint.twoSidedLighting = true; paint.specularColor.setAll(.35); paint.specularPower = 48;
  paint.diffuseTexture = paintSkin(scene, look, body.star || body.jelly, 'fish-skin');
  if (look.glow) paint.emissiveColor = Color3.FromHexString(look.glow).scale(look.mark === 'rainbow' ? .12 : .22);
  if (look.mark === 'rainbow') { paint.emissiveTexture = paint.diffuseTexture; paint.emissiveTexture.level = .6; }
  if (body.jelly) paint.alpha = .8;
  const { parts, tailParts } = fishParts(scene, body, look);
  const trunk = merged(parts, 'lake-fish-body'), fin = merged(tailParts, 'lake-fish-caudal');
  trunk.material = paint; trunk.parent = root;
  if (fin) { fin.material = paint; fin.parent = tail; }
  const scale = Math.max(.42, Math.min(1.5, (size ?? 38) / 38)) * .62;
  root.scaling.setAll(scale);
  root.getChildMeshes().forEach(mesh => { mesh.isPickable = false; if (look.glow) glow?.addIncludedOnlyMesh?.(mesh); });
  const kind = body.star ? 'creep' : body.jelly ? 'drift' : 'swim';
  return { root, tail, species, scale, length: body.star ? .8 : L, width: body.star || body.jelly ? .6 : H * body.thick, height: body.jelly ? .9 : H, kind };
}
