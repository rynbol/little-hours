import { landmarkGeometry } from './landmarks.js';
import { sampleTerrainSurface } from './terrain-mesh.js';

self.onmessage = ({ data: { definition, rings } }) => {
  const geometry = landmarkGeometry({ definition, surface: (x, z) => sampleTerrainSurface(rings, x, z) });
  self.postMessage(geometry, Object.values(geometry).map(array => array.buffer));
};
