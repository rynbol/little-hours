import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { createFurniture } from './furniture.js';
import { styleFurniture, createArchitecture } from './architecture.js';
import { getFurniture } from './catalog.js';
import { tintPaint } from './tints.js';
import { surfacePaint } from './surfaces.js';
import { openings, SHELLS } from './walls.js';

export function bakeHousePart(mesh) {
  mesh.unfreezeWorldMatrix(); mesh.computeWorldMatrix(true);
  const data = VertexData.ExtractFromMesh(mesh, true, true);
  data.transform(mesh.getWorldMatrix());
  const diffuse = mesh.material?.diffuseColor || { r: 1, g: 1, b: 1 };
  const original = data.colors, colors = new Float32Array(data.positions.length / 3 * 4);
  for (let i = 0; i < colors.length; i += 4) {
    colors[i] = (original?.[i] ?? 1) * diffuse.r;
    colors[i + 1] = (original?.[i + 1] ?? 1) * diffuse.g;
    colors[i + 2] = (original?.[i + 2] ?? 1) * diffuse.b;
    colors[i + 3] = original?.[i + 3] ?? 1;
  }
  data.colors = colors;
  data.uvs = null; data.uvs2 = null; data.matricesIndices = null; data.matricesWeights = null;
  return data;
}

export function houseArchitecture(scene, layout, style, origin, theme, roomId) {
  const architecture = createArchitecture(style, scene);
  architecture.setSurfaces({ walls: surfacePaint(style, 'walls', layout.walls) || {}, floor: surfacePaint(style, 'floor', layout.floor) || {} });
  const door = roomId === 'garden' ? [{ wall: 'side', minU: 1.5, maxU: 3.9, minV: .1, maxV: 3.4 }] : roomId === 'loft' ? [{ wall: 'side', minU: -2.3, maxU: .1, minV: .1, maxV: 3.4 }] : [];
  architecture.setOpenings([...openings(layout.items), ...door]); architecture.setTheme(theme);
  architecture.root.scaling.setAll(.43); architecture.root.position.set(...origin);
  const parts = [], visible = [];
  for (const mesh of architecture.root.getChildMeshes()) {
    mesh.unfreezeWorldMatrix(); mesh.computeWorldMatrix(true);
    if (mesh.material?.emissiveTexture || (mesh.material?.emissiveColor?.r || 0) + (mesh.material?.emissiveColor?.g || 0) + (mesh.material?.emissiveColor?.b || 0) > .1) {
      mesh.isPickable = false; visible.push(mesh);
    } else {
      parts.push(bakeHousePart(mesh)); mesh.setEnabled(false);
    }
  }
  return { root: architecture.root, parts, visible, floor: architecture.floorTop * .43 + .012, dispose: () => architecture.dispose() };
}

// The house uses the SAME authored furniture as the room. Static geometry is
// baked into the house batches; only the occupied desk keeps its live rig.
export function houseFurniture(scene, item, { style, origin, occupied, floor = .16, rugScale = 1 }) {
  const definition = getFurniture(item.type);
  const root = createFurniture(item.type, scene);
  styleFurniture(root, style, tintPaint(item.type, item.tint));
  root.metadata.avatar?.setEnabled(Boolean(occupied));
  root.metadata.off = Boolean(item.off);
  root.metadata.animate?.(0, occupied, true);
  root.scaling.set(.43, .43 * rugScale, .43);
  if (definition.mount === 'wall') {
    const side = item.wall === 'side';
    const face = style === 'retreat' ? (side ? -2.3 : -1.8) : SHELLS[style][side ? 'side' : 'back'].face * .43;
    root.position.set(origin[0] + (side ? face : item.u * .43), origin[1] + item.v * .43, origin[2] + (side ? item.u * .43 : face));
    root.rotation.y = side ? Math.PI / 2 : 0;
  } else {
    root.position.set(origin[0] + item.x * .43, origin[1] + floor, origin[2] + item.z * .43);
    root.rotation.y = item.rotation * Math.PI / 2;
  }
  const parts = [];
  for (const mesh of root.getChildMeshes()) {
    const avatar = root.metadata.avatar && mesh.isDescendantOf(root.metadata.avatar);
    if (occupied && avatar) { mesh.isPickable = false; continue; }
    if (mesh.isEnabled() && !mesh.metadata?.effect && mesh.getTotalVertices() && (mesh.material?.alpha ?? 1) >= 1) {
      parts.push(bakeHousePart(mesh));
    }
    mesh.setEnabled(false);
  }
  if (!occupied) root.dispose(false, false);
  return { parts, live: occupied ? root : null };
}
