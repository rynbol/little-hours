import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { Vector3, Quaternion, Matrix } from '@babylonjs/core/Maths/math.vector.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';

export const ROOF = Object.freeze({ back: -4.6, side: -5.94, right: 6.03, front: 4.65, eave: 5.8, run: 0.8, rise: 1.35 });
export const roofTop = type => type === 'studio' ? 0 : ROOF.eave + ROOF.rise + 0.12;

const backPoint = (x, t) => [x, ROOF.eave + t * ROOF.rise, ROOF.back + t * ROOF.run];
const sidePoint = (z, t) => [ROOF.side + t * ROOF.run, ROOF.eave + t * ROOF.rise, z];

function quad(points, color, uvs = null) {
  const data = new VertexData(), positions = points.flat();
  data.positions = positions; data.indices = [0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2];
  data.normals = []; VertexData.ComputeNormals(positions, data.indices, data.normals);
  data.colors = points.flatMap(() => [color.r, color.g, color.b, 1]);
  if (uvs) data.uvs = uvs;
  return data;
}

function beam(a, b, size, color, scene) {
  const start = Vector3.FromArray(a), end = Vector3.FromArray(b), delta = end.subtract(start);
  const mesh = MeshBuilder.CreateBox('roof-beam', { width: size, height: delta.length(), depth: size }, scene);
  const rotation = Quaternion.FromUnitVectorsToRef(Vector3.Up(), delta.normalize(), new Quaternion());
  const data = VertexData.ExtractFromMesh(mesh, true, true); mesh.dispose();
  data.transform(Matrix.Compose(Vector3.One(), rotation, start.add(end).scale(0.5)));
  data.colors = []; for (let i = 0; i < data.positions.length / 3; i++) data.colors.push(color.r, color.g, color.b, 1);
  return data;
}

function merged(name, parts, material, scene, parent, colored = true) {
  const mesh = new Mesh(name, scene), [first, ...rest] = parts;
  if (rest.length) first.merge(rest, true);
  first.applyToMesh(mesh); mesh.material = material; mesh.useVertexColors = colored; mesh.parent = parent;
  mesh.isPickable = false; mesh.metadata = { castShadow: false, roof: true }; mesh.freezeWorldMatrix();
  return mesh;
}

const hash = value => { let h = value | 0 || 1; h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
export function skyStars(sessions, limit = 150) {
  const stars = sessions.slice(-limit).map(session => ({ x: 12 + hash(session.at) * 232, y: 10 + hash(session.at * 7 + 3) * 140, bright: session.minutes >= 50 }));
  const left = stars.filter(star => star.bright).sort((a, b) => a.x - b.x), lines = left.splice(0, 1);
  while (left.length) {
    const last = lines.at(-1), next = left.reduce((best, star, i) => Math.hypot(star.x - last.x, star.y - last.y) < best.d ? { i, d: Math.hypot(star.x - last.x, star.y - last.y) } : best, { i: 0, d: Infinity });
    lines.push(...left.splice(next.i, 1));
  }
  return { stars, lines };
}
function paintSky(texture, theme, sky = null) {
  const ctx = texture.getContext(), w = 256, h = 160, night = theme === 'dusk', day = theme === 'day';
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  (day ? ['#7fbcd8', '#c5e2e6'] : night ? ['#111b36', '#2d3a5e'] : ['#5f7486', '#9aabb3']).forEach((hex, i) => gradient.addColorStop(i, hex));
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
  if (night) {
    ctx.fillStyle = '#fff2d055';
    for (let i = 0; i < (sky ? 14 : 34); i++) { ctx.beginPath(); ctx.arc((i * 83) % w, (i * 47) % h, 0.9, 0, Math.PI * 2); ctx.fill(); }
    if (sky) {
      ctx.strokeStyle = '#f7e5b588'; ctx.lineWidth = 1.2; ctx.beginPath();
      sky.lines.forEach((star, i) => i ? ctx.lineTo(star.x, star.y) : ctx.moveTo(star.x, star.y)); ctx.stroke();
      for (const star of sky.stars) {
        ctx.fillStyle = star.bright ? '#ffe9a8' : '#fff6e0cc';
        ctx.beginPath(); ctx.arc(star.x, star.y, star.bright ? 2.6 : 1.3, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.fillStyle = '#fff2d0';
      for (let i = 0; i < 34; i++) if (i % 7 === 0) { ctx.beginPath(); ctx.arc((i * 83) % w, (i * 47) % h, 2.1, 0, Math.PI * 2); ctx.fill(); }
    }
  } else {
    ctx.fillStyle = day ? '#ffffffcc' : '#d7dde088';
    for (const [x, y, s] of [[70, 60, 1], [190, 110, 0.7]]) { ctx.beginPath(); ctx.ellipse(x, y, 40 * s, 13 * s, 0, 0, Math.PI * 2); ctx.ellipse(x + 26 * s, y - 8 * s, 28 * s, 14 * s, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  texture.update(true);
}

function skyMaterial(name, scene, materials, textures) {
  const texture = new DynamicTexture(`${name}-sky`, { width: 256, height: 160 }, scene, true); textures.push(texture);
  texture.wrapU = DynamicTexture.MIRROR_ADDRESSMODE;
  const mat = new StandardMaterial(name, scene); mat.disableLighting = true; mat.emissiveTexture = texture; mat.diffuseColor = Color3.Black(); mat.backFaceCulling = false; materials.push(mat);
  return { mat, texture };
}

export function createRoomRoof(type, scene) {
  const root = new TransformNode(`roof-${type}`, scene), meshes = [], materials = [], textures = [];
  const hex = value => Color3.FromHexString(value);
  const paint = new StandardMaterial(`roof-${type}-paint`, scene); paint.specularColor.set(0.04, 0.04, 0.04); paint.backFaceCulling = false; materials.push(paint);
  const corner = [ROOF.side, ROOF.eave, ROOF.back], ridgeStart = backPoint(ROOF.side + ROOF.run, 1);
  const greenhouse = type === 'greenhouse', frame = greenhouse ? hex('#f1ead8') : hex('#7a5440'), trim = hex('#c79a5b');
  const beams = [
    beam(ridgeStart, backPoint(ROOF.right, 1), 0.13, frame, scene),
    beam(sidePoint(ROOF.back + ROOF.run, 1), sidePoint(ROOF.front, 1), 0.13, frame, scene),
    beam(corner, ridgeStart, 0.14, frame, scene),
    beam(backPoint(ROOF.side + ROOF.run, 1.03), backPoint(ROOF.right, 1.03), 0.04, trim, scene),
    beam(sidePoint(ROOF.back + ROOF.run, 1.03), sidePoint(ROOF.front, 1.03), 0.04, trim, scene),
  ];
  const step = greenhouse ? 0.95 : 1.2, rafter = greenhouse ? 0.07 : 0.12;
  for (let x = ROOF.side + ROOF.run + step * 0.6; x < ROOF.right - 0.2; x += step) beams.push(beam(backPoint(x, 0), backPoint(x, 1), rafter, frame, scene));
  for (let z = ROOF.back + ROOF.run + step * 0.6; z < ROOF.front - 0.2; z += step) beams.push(beam(sidePoint(z, 0), sidePoint(z, 1), rafter, frame, scene));
  const sky = skyMaterial(`roof-${type}-glass`, scene, materials, textures);
  if (greenhouse) {
    beams.push(beam(backPoint(ROOF.side + ROOF.run * 0.5, 0.5), backPoint(ROOF.right, 0.5), 0.05, frame, scene));
    beams.push(beam(sidePoint(ROOF.back + ROOF.run * 0.5, 0.5), sidePoint(ROOF.front, 0.5), 0.05, frame, scene));
    const back = quad([corner, backPoint(ROOF.right, 0), backPoint(ROOF.right, 1), ridgeStart], hex('#ffffff'), [0, 1, 4, 1, 4, 0, 0.3, 0]);
    const side = quad([corner, sidePoint(ROOF.back + ROOF.run, 1), sidePoint(ROOF.front, 1), sidePoint(ROOF.front, 0)], hex('#ffffff'), [0, 1, 0.3, 0, 3, 0, 3, 1]);
    meshes.push(merged('greenhouse-panes', [back, side], sky.mat, scene, root, false));
  } else {
    const boards = ['#9a6b4f', '#8d6147', '#a57556'], light = { from: 0.4, to: 3.1 }, panes = [];
    for (let row = 0; row < 5; row++) {
      const t0 = row / 5, t1 = (row + 1) / 5, color = hex(boards[row % 3]), left = t => ROOF.side + ROOF.run * t;
      if (t1 <= 0.2 || t0 >= 0.8) panes.push(quad([backPoint(left(t0), t0), backPoint(ROOF.right, t0), backPoint(ROOF.right, t1), backPoint(left(t1), t1)], color));
      else {
        panes.push(quad([backPoint(left(t0), t0), backPoint(light.from, t0), backPoint(light.from, t1), backPoint(left(t1), t1)], color));
        panes.push(quad([backPoint(light.to, t0), backPoint(ROOF.right, t0), backPoint(ROOF.right, t1), backPoint(light.to, t1)], color));
      }
      panes.push(quad([sidePoint(ROOF.back + ROOF.run * t0, t0), sidePoint(ROOF.back + ROOF.run * t1, t1), sidePoint(ROOF.front, t1), sidePoint(ROOF.front, t0)], color));
    }
    const edges = [[light.from, 0.2], [light.to, 0.2], [light.to, 0.8], [light.from, 0.8]].map(([x, t]) => backPoint(x, t));
    edges.forEach((point, i) => beams.push(beam(point, edges[(i + 1) % 4], 0.1, hex('#e9d6b0'), scene)));
    beams.push(beam(backPoint((light.from + light.to) / 2, 0.2), backPoint((light.from + light.to) / 2, 0.8), 0.04, hex('#e9d6b0'), scene));
    meshes.push(merged('attic-boards', panes, paint, scene, root));
    meshes.push(merged('attic-skylight', [quad(edges, hex('#ffffff'), [0, 1, 1, 1, 1, 0, 0, 0])], sky.mat, scene, root, false));
  }
  meshes.push(merged(`roof-${type}-frame`, beams, paint, scene, root));
  let shownTheme = null, stars = greenhouse ? null : skyStars([]), starKey = '';
  return {
    root, top: roofTop(type),
    setTheme(theme) { shownTheme = theme; paintSky(sky.texture, theme, stars); },
    setSessions(sessions) {
      if (greenhouse) return;
      const key = `${sessions.length}:${sessions.at(-1)?.at}`;
      if (key === starKey) return;
      starKey = key; stars = skyStars(sessions); if (shownTheme) paintSky(sky.texture, shownTheme, stars);
    },
    dispose() { root.dispose(false, false); for (const mesh of meshes) mesh.dispose(); for (const mat of materials) mat.dispose(); for (const texture of textures) texture.dispose(); },
  };
}
