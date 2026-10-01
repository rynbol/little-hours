export function streamVertices(mesh, kind, data) {
  mesh.getVertexBuffer(kind).update(data);
}
