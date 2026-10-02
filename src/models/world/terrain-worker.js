import { terrainRing } from './terrain-mesh.js';
import { grassBlades } from './grass-blades.js';

const JOBS = { ring: ({ index, rings, definition, center }) => terrainRing(index, rings, definition, center), grass: ({ layers }) => grassBlades(layers) };

self.onmessage = ({ data }) => {
  const result = JOBS[data.job](data);
  self.postMessage(result, Object.values(result).map(array => array.buffer));
};
