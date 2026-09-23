import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { createRoundedBox } from './furniture.js';

// Each shell is authored in JavaScript, in the same editable floor footprint.
// Only the current alternative shell exists; its static paint shares one draw.
export function createArchitecture(style, scene) {
  const root = new TransformNode(`architecture-${style}`, scene);
  const parts = [], materials = [], textures = [], glows = [], paint = new Map();
  // `radius` marks Cloud loft's round opening; the other shells are rectangles.
  const window = style === 'metro' ? { x: -1, y: 3.35, width: 8.1, height: 3.65, radius: 0 } : { x: -2.7, y: 3.35, width: 4.2, height: 3.82, radius: style === 'cloud' ? 1.95 : 0 };
  const tint = hex => Color3.FromHexString(hex);
  function material(hex, glow = false) {
    const key = hex + glow;
    if (!paint.has(key)) {
      const mat = new StandardMaterial(`${style}-${key}`, scene); mat.diffuseColor = tint(hex); mat.specularColor.set(.04, .04, .04);
      if (glow) { mat.emissiveColor = tint(hex); glows.push(mat); }
      materials.push(mat); paint.set(key, mat);
    }
    return paint.get(key);
  }
  function finish(mesh, xyz, hex, glow = false) { mesh.position.set(...xyz); mesh.parent = root; mesh.material = material(hex, glow); mesh.receiveShadows = !glow; mesh.isPickable = false; mesh.metadata = { castShadow: !glow, architecture: style }; parts.push(mesh); return mesh; }
  function box(size, xyz, hex, radius = 0) { return finish(radius ? createRoundedBox('architectural-joinery', size, radius, scene) : MeshBuilder.CreateBox('architectural-joinery', { width: size[0], height: size[1], depth: size[2] }, scene), xyz, hex); }
  function ball(size, xyz, hex, glow = false) { const mesh = finish(MeshBuilder.CreateSphere('architectural-orb', { diameter: 2, segments: 8 }, scene), xyz, hex, glow); mesh.scaling.set(...size); return mesh; }
  function rod(a, b, radius, hex, glow = false) {
    const start = Vector3.FromArray(a), end = Vector3.FromArray(b), delta = end.subtract(start);
    const mesh = finish(MeshBuilder.CreateCylinder('architectural-stem', { diameter: radius * 2, height: delta.length(), tessellation: 8 }, scene), start.add(end).scale(.5).asArray(), hex, glow);
    mesh.rotationQuaternion = Quaternion.FromUnitVectorsToRef(Vector3.Up(), delta.normalize(), new Quaternion()); return mesh;
  }
  function curve(points, radius, hex, glow = false) { return finish(MeshBuilder.CreateTube('architectural-curve', { path: points.map(p => Vector3.FromArray(p)), radius, tessellation: 6, cap: Mesh.CAP_ALL }, scene), [0, 0, 0], hex, glow); }
  function pendant(x, z, y, radius, hex, ribbed = false) {
    rod([x, 5.72, z], [x, y + radius, z], .016, '#73646b');
    ball([radius, radius * .92, radius], [x, y, z], hex, true);
    if (ribbed) for (let i = -3; i <= 3; i++) {
      const dy = i * radius * .21, r = Math.sqrt(radius * radius - dy * dy / .8464) + .009;
      curve(Array.from({ length: 33 }, (_, j) => [x + Math.cos(j / 32 * Math.PI * 2) * r, y + dy, z + Math.sin(j / 32 * Math.PI * 2) * r]), .008, '#d6bd94');
    }
  }
  function rectangularWall(hex) {
    const left = window.x - window.width / 2, right = window.x + window.width / 2, bottom = window.y - window.height / 2, top = window.y + window.height / 2;
    box([12, bottom - .22, .22], [0, (bottom + .22) / 2, -4.6], hex);
    box([12, 5.8 - top, .22], [0, (5.8 + top) / 2, -4.6], hex);
    box([left + 6, window.height, .22], [(left - 6) / 2, window.y, -4.6], hex);
    box([6 - right, window.height, .22], [(right + 6) / 2, window.y, -4.6], hex);
  }
  const wood = style === 'sakura' ? '#a77b53' : style === 'cloud' ? '#d5b9bb' : '#343b50';
  box([12.15, .40, 9.4], [0, -.09, 0], wood, .14);
  box([12.05, .14, 9.3], [0, .10, 0], style === 'metro' ? '#596173' : '#e2cdb1', .04);

  if (style === 'sakura') {
    box([12, .04, 9.2], [0, .19, 0], '#7c7655');
    for (let col = 0; col < 3; col++) for (let row = 0; row < 2; row++) {
      const x = -4 + col * 4, z = -2.28 + row * 4.56;
      box([3.88, .035, 4.43], [x, .207, z], (col + row) % 2 ? '#c8bd87' : '#d7ca97');
      for (let stripe = 0; stripe < 44; stripe++) box([3.85, .003, .014], [x, .226, z - 2.14 + stripe * .099], '#bdb27f');
    }
    rectangularWall('#eee2c6'); box([.22, 5.6, 9.2], [-5.94, 3.01, 0], '#e8ddc4');
    for (let panel = 0; panel < 4; panel++) {
      const z = -3.42 + panel * 2.27;
      box([.06, 3.95, 2.12], [-5.79, 3.12, z], '#f8efd4');
      for (let i = 0; i < 5; i++) box([.10, 4.1, .038], [-5.71, 3.12, z - 1.04 + i * .52], wood);
      for (let i = 0; i < 9; i++) box([.10, .035, 2.12], [-5.70, 1.16 + i * .49, z], wood);
    }
    for (const y of [.43, 1.03, 5.38, 5.78]) { box([.27, .13, 9.25], [-5.78, y, 0], wood); box([12.05, .13, .27], [0, y, -4.43], wood); }
    for (const x of [-5.76, -.35, 5.8]) box([.16, 5.5, .22], [x, 3.02, -4.4], wood);
    for (const x of [-4.8, -2.7, -.6]) box([.075, 3.9, .22], [x, 3.35, -4.44], wood);
    for (const y of [1.43, 2.3, 3.35, 4.4, 5.27]) box([4.35, .075, .24], [-2.7, y, -4.43], wood);
    box([4.55, .13, .57], [-2.7, 1.41, -4.25], '#b98c5f', .025);
    pendant(.6, -3.7, 4.9, .36, '#ffe5b7', true); pendant(4.75, -3.75, 4.5, .49, '#fff0d0', true);
  } else if (style === 'cloud') {
    for (let x = 0; x < 16; x++) for (let z = 0; z < 12; z++) box([.746, .05, .765], [-5.625 + x * .75, .194, -4.2075 + z * .765], (x + z) % 2 ? '#dfc6c0' : '#f3e7db');
    box([.22, 5.6, 9.2], [-5.94, 3.01, 0], '#dcbfcf');
    // A genuine circular opening, filled around with narrow plaster strips.
    const radius = window.radius;
    for (let i = 0; i < 96; i++) {
      const x = -6 + (i + .5) * .125, dx = x - window.x;
      if (Math.abs(dx) >= radius) box([.13, 5.58, .22], [x, 3.01, -4.6], '#b5afcf');
      else { const dy = Math.sqrt(radius ** 2 - dx ** 2), bottom = window.y - dy, top = window.y + dy; box([.13, bottom - .22, .22], [x, (.22 + bottom) / 2, -4.6], '#b5afcf'); box([.13, 5.8 - top, .22], [x, (5.8 + top) / 2, -4.6], '#b5afcf'); }
    }
    curve(Array.from({ length: 65 }, (_, i) => [window.x + Math.cos(i / 64 * Math.PI * 2) * radius, window.y + Math.sin(i / 64 * Math.PI * 2) * radius, -4.4]), .11, '#f4dfd2');
    box([.055, 3.8, .14], [-2.7, 3.35, -4.36], '#f2dfd4'); box([3.8, .055, .14], [-2.7, 3.35, -4.36], '#f2dfd4');
    box([.12, 1.02, 9.1], [-5.78, .76, 0], '#eee1d4');
    for (let i = 0; i < 47; i++) box([.035, .93, .028], [-5.7, .78, -4.4 + i * .19], '#c8b3bd');
    for (const y of [.32, 1.3, 5.76]) { box([.22, .10, 9.25], [-5.75, y, 0], '#f2e2d4'); box([12, .10, .22], [0, y, -4.4], '#f2e2d4'); }
    pendant(.3, -3.5, 4.9, .27, '#ffe5ca'); pendant(3.35, -3.6, 4.2, .32, '#ffc6da'); pendant(5.1, -3.55, 5.05, .24, '#d7d3ff');
  } else {
    for (let x = 0; x < 6; x++) for (let z = 0; z < 5; z++) box([1.99, .05, 1.826], [-5 + x * 2, .194, -3.66 + z * 1.83], (x + z) % 2 ? '#677080' : '#747b89');
    rectangularWall('#434b61'); box([.22, 5.6, 9.2], [-5.94, 3.01, 0], '#5b4f5b');
    for (let row = 0; row < 17; row++) for (let col = 0; col < 10; col++) {
      const z = -4.35 + col * .89 + (row % 2) * .44;
      if (z > 4.45) continue;
      box([.025, .27, .83], [-5.81, .51 + row * .305, z], ['#826365', '#976e69', '#765b61', '#aa7d70'][(row * 3 + col) % 4], .008);
    }
    for (const y of [.36, 1.47, 5.24, 5.77]) { box([12.02, .13, .27], [0, y, -4.42], '#262d3f'); box([.20, .13, 9.2], [-5.76, y, 0], '#343546'); }
    for (let i = 0; i < 6; i++) box([.09, 3.82, .23], [-5.05 + i * 1.62, 3.35, -4.40], '#293345');
    box([8.23, .09, .23], [-1, 3.25, -4.40], '#293345');
    for (const z of [-4.4, .2, 4.38]) box([.22, 5.5, .19], [-5.70, 3.03, z], '#343546');
    box([8.6, .13, .53], [-1, 1.48, -4.21], '#333b51', .025);
    // An exposed copper pipe; the neon sign and records are movable wall pieces.
    curve([[-5.57, .5, -.8], [-5.57, 5.3, -.8], [-5.57, 5.3, 4.3]], .032, '#b49380');
    rod([-4.85, 5.17, -4.26], [2.89, 5.17, -4.26], .018, '#77c8e6', true);
    pendant(-4.8, -3.6, 4.57, .19, '#ffc89f'); pendant(.8, -3.6, 4.85, .19, '#ffc89f');
  }

  // Bake all the architectural paint into one colored mesh; luminous accents
  // remain a tiny number of batches. Temporary source materials are released.
  const buckets = new Map();
  for (const part of parts) {
    part.computeWorldMatrix(true);
    const glow = glows.includes(part.material), key = glow ? part.material.uniqueId : 'paint';
    if (!buckets.has(key)) buckets.set(key, { mat: glow ? part.material : null, data: [] });
    const data = VertexData.ExtractFromMesh(part, true, true); data.transform(part.getWorldMatrix()); data.uvs = undefined; data.colors = [];
    const color = part.material.diffuseColor;
    for (let i = 0; i < data.positions.length / 3; i++) data.colors.push(color.r, color.g, color.b, 1);
    buckets.get(key).data.push(data);
  }
  const bodyMaterial = new StandardMaterial(`${style}-batched-paint`, scene); bodyMaterial.diffuseColor = Color3.White(); bodyMaterial.specularColor.set(.035, .035, .035); materials.push(bodyMaterial);
  for (const [key, bucket] of buckets) {
    const data = bucket.data[0]; if (bucket.data.length > 1) data.merge(bucket.data.slice(1), true);
    // Accent lights take a tap outside Decorate, which switches them.
    const mesh = new Mesh(`${style}-${key === 'paint' ? 'architecture' : 'accent'}`, scene); data.applyToMesh(mesh); mesh.parent = root; mesh.material = bucket.mat || bodyMaterial; mesh.useVertexColors = true; mesh.receiveShadows = !bucket.mat; mesh.isPickable = Boolean(bucket.mat); mesh.metadata = { architecture: style, castShadow: !bucket.mat, lightSwitch: Boolean(bucket.mat) }; mesh.freezeWorldMatrix();
  }
  parts.forEach(part => part.dispose(false, false));
  for (const mat of paint.values()) if (!glows.includes(mat)) { mat.dispose(); materials.splice(materials.indexOf(mat), 1); }

  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
  const texture = new DynamicTexture(`${style}-view`, canvas, scene, false); textures.push(texture);
  const viewMaterial = new StandardMaterial(`${style}-view`, scene); viewMaterial.disableLighting = true; viewMaterial.emissiveTexture = texture; viewMaterial.diffuseColor = Color3.Black(); viewMaterial.backFaceCulling = false; materials.push(viewMaterial);
  const view = MeshBuilder.CreatePlane(`${style}-window-view`, { width: window.width, height: window.height }, scene); view.position.set(window.x, window.y, -4.64); view.material = viewMaterial; view.parent = root; view.isPickable = false; view.metadata = { castShadow: false, architecture: style };
  // Accent lights switch off rather than vanish: the globes and neon keep their
  // shape with no glow, so cords and lantern ribs never hang empty.
  let theme = 'dusk', lit = true;
  const applyGlow = () => { for (const mat of glows) mat.emissiveColor = lit ? mat.diffuseColor.scale(theme === 'day' ? .32 : theme === 'rain' ? .6 : .9) : Color3.Black(); };
  function setTheme(next) {
    theme = next; paintView(texture.getContext(), style, theme); texture.update(true); applyGlow();
  }
  // Top of the walkable floor surface (tatami stripes stand slightly proud).
  const floorTop = style === 'sakura' ? .2275 : .219;
  return { root, window, floorTop, setTheme, setLights(enabled) { lit = enabled; applyGlow(); }, dispose() { root.dispose(false, false); materials.forEach(mat => mat.dispose()); textures.forEach(texture => texture.dispose()); } };
}

// Procedural views are painted once per atmosphere change, never per frame.
function paintView(ctx, style, theme) {
  const day = theme === 'day', night = theme === 'dusk', w = 1024, h = 512;
  const colors = style === 'sakura' ? (day ? ['#b7d6d6', '#f5e5cc'] : night ? ['#293654', '#b487a2'] : ['#8798ab', '#ddcecb']) : style === 'cloud' ? (day ? ['#a6bdde', '#f6c7bd'] : night ? ['#45436e', '#ad8fb8'] : ['#9eabc2', '#d7c1ca']) : (day ? ['#799fb7', '#d6b3ac'] : night ? ['#1c2442', '#755475'] : ['#56657e', '#9e8b9a']);
  const gradient = ctx.createLinearGradient(0, 0, 0, h); colors.forEach((c, i) => gradient.addColorStop(i, c)); ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = night ? '#fff1ce' : '#fff2d9'; ctx.beginPath(); ctx.arc(760, 120, night ? 38 : 50, 0, Math.PI * 2); ctx.fill();
  if (night) for (let i = 0; i < 40; i++) { ctx.fillStyle = '#fff5da'; ctx.fillRect((i * 157) % w, 20 + (i * 97) % 280, 2, 2); }
  if (style === 'metro') {
    for (let layer = 0; layer < 3; layer++) for (let i = 0; i < 18; i++) {
      const x = i * 68 - layer * 21, top = 150 + ((i * 71 + layer * 109) % 210) + layer * 30, width = 46 + (i % 3) * 10;
      ctx.fillStyle = day ? ['#818ca6', '#697690', '#4d5e77'][layer] : ['#4c4c70', '#353c5a', '#242f4b'][layer]; ctx.fillRect(x, top, width, h - top);
      if (i % 4 === 0) ctx.fillRect(x + width / 2, top - 30, 3, 30);
      for (let y = top + 12; y < h; y += 17) for (let col = 0; col < 4; col++) if ((i + y + col + layer) % 5 !== 0) { ctx.fillStyle = day ? '#b1bbc7' : ['#e3b08b', '#95b8d6', '#b79cce'][(i + col) % 3]; ctx.fillRect(x + 7 + col * 11, y, 4, 7); }
    }
  } else if (style === 'cloud') {
    for (let layer = 0; layer < 3; layer++) {
      ctx.fillStyle = (day ? ['#d7d8ed', '#f1dbe4', '#fff0e0'] : ['#6e6b97', '#a18cad', '#d0acc7'])[layer];
      ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, 330 + layer * 60);
      for (let x = -90; x < w + 150; x += 140) ctx.ellipse(x, 330 + layer * 65 + Math.sin(x) * 22, 125, 60 + layer * 10, 0, Math.PI, 0);
      ctx.lineTo(w, h); ctx.fill();
    }
  } else {
    for (let layer = 0; layer < 3; layer++) {
      ctx.fillStyle = (day ? ['#a5b6ad', '#849c93', '#667f77'] : ['#77758c', '#535d78', '#3e4b62'])[layer]; ctx.beginPath(); ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 20) ctx.lineTo(x, 330 + layer * 43 + Math.sin(x * .006 + layer * 2) * 45); ctx.lineTo(w, h); ctx.fill();
    }
    ctx.strokeStyle = night ? '#4a4057' : '#795e62'; ctx.lineWidth = 15; ctx.lineCap = 'round';
    for (const [x, y, endX, endY] of [[0, 405, 440, 85], [1000, 470, 815, 195], [150, 296, 160, 45], [263, 215, 545, 173]]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 100, endY, endX, endY); ctx.stroke(); }
    for (let i = 0; i < 145; i++) {
      const x = (i * 173) % 620, y = 35 + (i * 71) % 260;
      if ((x / 640) + y / 350 > 1.6) continue;
      ctx.fillStyle = (night ? ['#c99eaf', '#a484a4', '#e0bbcd'] : ['#efbac4', '#fad8d7', '#dfa4b6'])[i % 3]; ctx.beginPath(); ctx.arc(x, y, 7 + i % 9, 0, Math.PI * 2); ctx.fill();
    }
  }
}

const recolors = {
  sakura: ['#c39e70', '#d6b888', '#81654d', '#dad5b9', '#b5bb9a', '#ebe1c2', '#ba9595', '#adbdad', '#9e8772', '#c1ac87'],
  cloud: ['#d5b9a3', '#f0d8c2', '#9e8c9b', '#b4a6ce', '#d8c5de', '#f4e4d9', '#bea0c6', '#d7bdcf', '#ab9bc4', '#e5c8b4'],
  metro: ['#8e766e', '#b29988', '#424557', '#8196a7', '#a7b3c4', '#cbbdb7', '#757899', '#a7a2be', '#464b69', '#9b8e9e'],
};
const originalPaint = ['#aa7954', '#bc9169', '#73533d', '#83968a', '#a0afa0', '#dfd1b2', '#785965', '#91707c', '#654939', '#baa07a'];
// Recolor only static furniture geometry, leaving the companion and animated
// leaves/fire untouched. Source templates and other instances stay shared/safe.
export function styleFurniture(root, style) {
  if (!recolors[style]) return;
  const replacements = [...originalPaint.map((hex, i) => [hex, i]), ['#64483b', 2], ['#936c4e', 0], ['#c29c68', 1], ['#73533f', 2], ['#c6a16b', 1]].map(([hex, i]) => ({ from: Color3.FromHexString(hex), to: Color3.FromHexString(recolors[style][i]) }));
  for (const mesh of root.getChildMeshes()) {
    if (mesh.metadata?.effect || (root.metadata.avatar && mesh.isDescendantOf(root.metadata.avatar)) || mesh.metadata?.dynamic) continue;
    const source = mesh.getVerticesData('color'); if (!source) continue;
    let changed = false; const colors = Float32Array.from(source);
    for (let i = 0; i < colors.length; i += 4) {
      const match = replacements.find(({ from }) => Math.abs(from.r - colors[i]) + Math.abs(from.g - colors[i + 1]) + Math.abs(from.b - colors[i + 2]) < .004);
      if (match) { colors[i] = match.to.r; colors[i + 1] = match.to.g; colors[i + 2] = match.to.b; changed = true; }
    }
    if (changed) { mesh.makeGeometryUnique(); mesh.setVerticesData('color', colors); }
  }
}
