import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';

const BODIES = {
  slim: { length: 1, height: .3, thick: .5, peak: .36, tail: .55, fin: .5 },
  deep: { length: 1, height: .5, thick: .42, peak: .38, tail: .5, fin: .55 },
  round: { length: .9, height: .6, thick: .4, peak: .42, tail: .45, fin: .5 },
  long: { length: 1.15, height: .3, thick: .52, peak: .34, tail: .55, fin: .45 },
  koi: { length: 1.05, height: .36, thick: .56, peak: .36, tail: .8, fin: .6, flowing: true },
  eel: { length: 1.9, height: .13, thick: .8, peak: .2, tail: 0, fin: .3, eel: true },
  sturgeon: { length: 1.4, height: .24, thick: .7, peak: .42, tail: .6, fin: .45, snout: true },
};
const RINGS = 44, SIDES = 22;
function profile(body, u) {
  if (body.eel) return Math.min(1, Math.sqrt(u / .06)) * (1 - u * .85);
  const a = body.peak * 1.3, b = (1 - body.peak) * 1.3, top = a ** a * b ** b / (a + b) ** (a + b);
  const nose = body.snout ? u ** 1.6 : u;
  return Math.max(.001, nose ** a * (1 - u) ** b / top * .88 + .12 * u ** 3);
}

function paintSkin(scene, look, name) {
  const W = 256, Hpx = 128, texture = new DynamicTexture(name, { width: W, height: Hpx }, scene, true), ctx = texture.getContext();
  const C = hex => Color3.FromHexString(hex), body = C(look.body), belly = C(look.belly), back = body.scale(.8);
  const upAt = y => Math.sin(y / Hpx * Math.PI * 2);
  for (let y = 0; y < Hpx; y++) {
    const up = upAt(y + .5);
    let c = Color3.Lerp(belly, body, Math.min(1, Math.max(0, (up + .35) * 1.3)));
    if (up > .75) c = Color3.Lerp(c, back, (up - .75) * 3);
    ctx.fillStyle = c.toHexString(); ctx.fillRect(0, y, W, 1);
  }
  const rows = (low, high) => { const out = []; for (let y = 0; y < Hpx; y++) { const up = upAt(y + .5); if (up >= low && up <= high) out.push(y); } return out; };
  let seed = look.body.charCodeAt(1) * 131 + look.fin.charCodeAt(2) * 7 + 1;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const pick = list => list[Math.floor(rand() * list.length)];
  ctx.strokeStyle = look.fin; ctx.globalAlpha = .35; ctx.lineWidth = 1.5;
  for (const y of [Hpx * .02, Hpx * .48]) { ctx.beginPath(); ctx.moveTo(W * .2, y); ctx.lineTo(W * .92, y); ctx.stroke(); }
  ctx.globalAlpha = 1;
  if (look.mark === 'spots') { ctx.fillStyle = 'rgba(61, 58, 51, .55)'; const upper = rows(-.15, .95); for (let i = 0; i < 70; i++) { ctx.beginPath(); ctx.arc(W * (.12 + rand() * .78), pick(upper), 2 + rand() * 2.6, 0, Math.PI * 2); ctx.fill(); } }
  if (look.mark === 'stripes') { ctx.fillStyle = 'rgba(78, 90, 52, .5)'; for (let i = 0; i < 6; i++) { const x = W * (.2 + i * .11); for (const y of rows(-.25, 1)) ctx.fillRect(x - 4 + Math.sin(y * .2) * 1.5, y, 8, 1); } }
  if (look.mark === 'patches') { ctx.fillStyle = look.patch; for (const [x, w] of [[.2, .1], [.38, .12], [.58, .09], [.74, .07]]) for (const y0 of [Hpx * .22, Hpx * .72]) { ctx.beginPath(); ctx.ellipse(W * x, y0 + (rand() - .5) * 12, W * w * (.7 + rand() * .5), Hpx * (.1 + rand() * .08), rand(), 0, Math.PI * 2); ctx.fill(); } }
  if (look.mark === 'stars') { ctx.fillStyle = '#fff6d8'; const upper = rows(0, .95); for (let i = 0; i < 60; i++) { const x = W * (.12 + rand() * .8), y = pick(upper), r = 1.6 + rand() * 2.2; ctx.beginPath(); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, d = k % 2 ? r * .35 : r; ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); } ctx.fill(); } }
  if (look.mark === 'plates') { ctx.fillStyle = 'rgba(217, 212, 230, .8)'; for (const y of [Hpx * .1, Hpx * .4]) for (let i = 0; i < 12; i++) { const x = W * (.15 + i * .065); ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 5); ctx.lineTo(x - 5, y); ctx.fill(); } }
  texture.update(false);
  return texture;
}

function bodyMesh(scene, body) {
  const positions = [], uvs = [], indices = [], L = body.length, H = body.height;
  for (let r = 0; r <= RINGS; r++) {
    const u = r / RINGS, x = L * (.5 - u), half = H / 2 * profile(body, u), wave = body.eel ? Math.sin(u * 9) * .05 : 0, sag = -H * .06 * profile(body, u);
    for (let s = 0; s <= SIDES; s++) {
      const around = s / SIDES * Math.PI * 2, up = Math.sin(around), y = sag + half * up, z = wave + half * body.thick * Math.cos(around);
      positions.push(x, y, z); uvs.push(u, 1 - s / SIDES);
      if (r && s) { const n = r * (SIDES + 1) + s; indices.push(n - SIDES - 2, n - 1, n - SIDES - 1, n - SIDES - 1, n - 1, n); }
    }
  }
  const data = Object.assign(new VertexData(), { positions, uvs, indices }), normals = [];
  VertexData.ComputeNormals(positions, indices, normals); data.normals = normals;
  const mesh = new Mesh('lake-fish-body', scene); data.applyToMesh(mesh);
  return mesh;
}

function finMesh(scene, name, outline, base, tip) {
  const positions = [0, 0, 0], colors = [...base, 1], indices = [];
  outline.forEach(([x, y, edge], i) => {
    positions.push(x, y, 0);
    const c = Color3.Lerp(new Color3(...base), new Color3(...tip), edge);
    colors.push(c.r, c.g, c.b, 1);
    if (i) indices.push(0, i, i + 1);
  });
  const data = Object.assign(new VertexData(), { positions, colors, indices }), normals = [];
  VertexData.ComputeNormals(positions, indices, normals); data.normals = normals;
  const mesh = new Mesh(name, scene); data.applyToMesh(mesh);
  return mesh;
}

const arc = (points, steps = 5) => points.flatMap(([x0, y0, e0], i) => {
  const next = points[i + 1];
  if (!next) return [[x0, y0, e0]];
  return Array.from({ length: steps }, (_, k) => { const t = k / steps; return [x0 + (next[0] - x0) * t, y0 + (next[1] - y0) * t, e0 + (next[2] - e0) * t]; });
});

export function buildFishModel(scene, species, size, glow) {
  const look = species.look, body = BODIES[look.shape], L = body.length, H = body.height;
  const root = new TransformNode('lake-fish', scene);
  const skin = new StandardMaterial('lake-fish-skin', scene); skin.specularColor.setAll(.4); skin.specularPower = 48;
  const finPaint = new StandardMaterial('lake-fish-fin', scene); finPaint.backFaceCulling = false; finPaint.twoSidedLighting = true; finPaint.alpha = .9; finPaint.specularColor.setAll(.15);
  if (look.glow) { skin.emissiveColor = Color3.FromHexString(look.glow).scale(.22); finPaint.emissiveColor = Color3.FromHexString(look.glow).scale(.3); }
  skin.diffuseTexture = paintSkin(scene, look, 'lake-fish-skin-paint');
  const trunk = bodyMesh(scene, body); trunk.material = skin; trunk.parent = root;
  const fin = Color3.FromHexString(look.fin), edge = Color3.Lerp(fin, Color3.FromHexString(look.belly), .55), base = [fin.r, fin.g, fin.b], tip = [edge.r, edge.g, edge.b];
  const tail = new TransformNode('lake-fish-tail', scene); tail.parent = root; tail.position.x = -L / 2 + .01;
  if (!body.eel) {
    const reach = H * body.tail * (body.flowing ? 1.5 : 1.15), spread = H * (body.flowing ? .75 : .62);
    const outline = arc([[0, H * .08, 0], [-reach * .55, spread * .7, .6], [-reach, spread, 1], [-reach * .7, spread * .25, 1], [-reach * .62, 0, .8], [-reach * .7, -spread * .25, 1], [-reach, -spread, 1], [-reach * .55, -spread * .7, .6], [0, -H * .08, 0]]);
    const caudal = finMesh(scene, 'lake-fish-caudal', outline, base, tip); caudal.material = finPaint; caudal.parent = tail;
  }
  const top = u => H / 2 * profile(body, u) - H * .06 * profile(body, u), xAt = u => L * (.5 - u);
  const dorsalOutline = body.eel
    ? arc(Array.from({ length: 9 }, (_, i) => { const u = .15 + i * .1; return [xAt(u), top(u) + H * .35 * Math.sin(i / 8 * Math.PI), 1]; }), 3)
    : arc([[xAt(.3), top(.3) * .9, 0], [xAt(.36), top(.36) + H * body.fin * .75, 1], [xAt(.5), top(.5) + H * body.fin * .55, 1], [xAt(.66), top(.66) * .9, 0]], 4);
  const dorsal = finMesh(scene, 'lake-fish-dorsal', [[xAt(.48), top(.48) * .92, 0], ...dorsalOutline], base, tip); dorsal.material = finPaint; dorsal.parent = root;
  const eyeWhite = new StandardMaterial('lake-fish-eye-white', scene); eyeWhite.diffuseColor = Color3.FromHexString('#f7f2ea'); eyeWhite.specularColor.setAll(.3);
  const eyeDark = new StandardMaterial('lake-fish-eye', scene); eyeDark.diffuseColor = Color3.FromHexString('#1f1b18'); eyeDark.specularColor.setAll(1); eyeDark.specularPower = 90;
  const eyeR = Math.max(.026, H * (body.eel ? .2 : .095)), eyeU = body.eel ? .03 : body.snout ? .16 : .1;
  for (const side of [-1, 1]) {
    const surface = H / 2 * profile(body, eyeU), at = [xAt(eyeU), H * .08, side * surface * body.thick * .82];
    const sclera = MeshBuilder.CreateSphere('lake-fish-eye-white', { diameter: eyeR * 2, segments: 6 }, scene);
    sclera.material = eyeWhite; sclera.parent = root; sclera.position.set(...at);
    const pupil = MeshBuilder.CreateSphere('lake-fish-eye', { diameter: eyeR * 1.3, segments: 6 }, scene);
    pupil.material = eyeDark; pupil.parent = root; pupil.position.set(at[0] + eyeR * .15, at[1] + eyeR * .05, at[2] + side * eyeR * .45);
  }
  if (look.whiskers) {
    const barbelPaint = new StandardMaterial('lake-fish-whisker', scene); barbelPaint.diffuseColor = Color3.Lerp(fin, Color3.FromHexString(look.belly), .3); barbelPaint.specularColor.setAll(.1);
    for (const side of [-1, 1]) {
      const nose = xAt(0), w = H * .32, path = [new Vector3(nose - .01, -H * .1, side * H * .06), new Vector3(nose + w * .3, -H * .24, side * H * .14), new Vector3(nose + w * .15, -H * .5, side * H * .2)];
      const barbel = MeshBuilder.CreateTube('lake-fish-whisker', { path, radiusFunction: i => .01 * (1 - i / 3) + .003, tessellation: 5 }, scene);
      barbel.material = barbelPaint; barbel.parent = root;
    }
  }
  const scale = Math.max(.42, Math.min(1.5, size / 38)) * .62;
  root.scaling.setAll(scale);
  root.getChildMeshes().forEach(mesh => { mesh.isPickable = false; if (look.glow) glow?.addIncludedOnlyMesh?.(mesh); });
  return { root, tail, species, scale, length: L, width: H * body.thick };
}
