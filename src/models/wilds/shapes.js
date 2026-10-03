import { BufferAttribute, Color, Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const matrix = new Matrix4(), turn = new Quaternion(), euler = new Euler(), at = new Vector3(), size = new Vector3();

export function part(geometry, colour, { position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1], shade } = {}) {
  geometry.applyMatrix4(matrix.compose(at.set(...position), turn.setFromEuler(euler.set(...rotation)), size.set(...scale)));
  const base = new Color(colour), tint = new Color(), positions = geometry.attributes.position, colours = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    tint.copy(base);
    if (shade) tint.multiplyScalar(shade(positions.getX(i), positions.getY(i), positions.getZ(i)));
    colours[i * 3] = tint.r; colours[i * 3 + 1] = tint.g; colours[i * 3 + 2] = tint.b;
  }
  geometry.setAttribute('color', new BufferAttribute(colours, 3));
  return geometry.index ? geometry.toNonIndexed() : geometry;
}

export function merge(parts) {
  for (const geometry of parts) geometry.deleteAttribute('uv');
  const merged = mergeGeometries(parts);
  for (const geometry of parts) geometry.dispose();
  return merged;
}
