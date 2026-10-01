import { terrainRing } from './terrain-mesh.js';

self.onmessage = ({ data: { index } }) => {
  const ring = terrainRing(index);
  self.postMessage({ index, ring }, [ring.positions.buffer, ring.normals.buffer, ring.colors.buffer, ring.indices.buffer]);
};
